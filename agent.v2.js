// 观潮 Agent：今日行动包 + 截图补录（界面模块）
// 依赖：engine.js（LedgerEngine）。所有数字来自 LedgerEngine，本文件不含写死的业务数字。
//
// 1) GuanchaoAgent.renderActionPack(容器元素, {
//      r, sample,                       // r = LedgerEngine.compute(sample)
//      others: [{ title, desc, btnText, onClick }],   // 原「今日待办」里不属于行动包的提醒，收进「其他提醒」
//      onSupplement: function () {},    // 点「补录本周数据」
//      onJump: function (kind) {},      // 可选：点每项右侧「看依据 →」时跳到对应卡片（boost/hold→该不该投，content→笔记明细，negotiate→达人账，report→总账）
//      polish: async function (item, aiContext) { return '新草稿' }  // 可选：接入大模型时传入，否则不显示「AI 润色」
//    })
// 2) GuanchaoAgent.openSupplement({
//      sample, shopKey,                 // 当前店铺数据与 key
//      demo: SCREENSHOT_DEMO,           // samples.js 里的示例数据
//      demoImage: '示例截图的地址',
//      switchShop: function (key) { return 该店铺的 sample },   // 「用示例截图试试」时切到示例店铺
//      recognize: async function (imageDataUrl) { return [{date,xhs,out}] },  // 可选：接入能看图的大模型时传入
//      onConfirm: function (newSample, oldSample) {},  // 用新数据替换当前店铺并重算全站、回到总览
//      onUndo: function (oldSample) {}                 // 撤销补录：恢复旧数据并重算
//    })
// 3) GuanchaoAgent.reset()                            // 演示重置：行动包全部回到「待采纳」并清掉补录通知
(function () {
  var E = function () { return window.LedgerEngine || (typeof LedgerEngine !== 'undefined' ? LedgerEngine : null); };
  var adopted = {};          // 采纳状态：key = 店名|日期|标题
  var drafts = {};           // 润色后的草稿
  var WK = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function md(iso) { var p = String(iso).split('-'); return (+p[1]) + '月' + (+p[2]) + '日'; }
  function mdw(iso) { var p = String(iso).split('-'), d = new Date(+p[0], +p[1] - 1, +p[2]); return md(iso) + ' ' + WK[d.getDay()]; }
  function r0(v) { var x = Math.round(v); return x === 0 ? 0 : x; }

  var IC = {
    boost: '<path d="M5 15c-1.3 1.3-1.5 4.5-1.5 4.5s3.2-.2 4.5-1.5"/><path d="M14.5 4.5c2.6-.9 5-.9 5-.9s0 2.4-.9 5L13 14.2 9.8 11z"/><path d="M9.8 11L7 10.4l2.2-2.8 3.3.2"/><path d="M13 14.2l.6 2.8 2.8-2.2-.2-3.3"/>',
    hold: '<circle cx="12" cy="12" r="8.5"/><path d="M10 9v6"/><path d="M14 9v6"/>',
    content: '<path d="M4 20h4L19 9a2.8 2.8 0 0 0-4-4L4 16z"/><path d="M13.5 6.5l4 4"/>',
    negotiate: '<path d="M4 18.5V7a2.5 2.5 0 0 1 2.5-2.5h11A2.5 2.5 0 0 1 20 7v7a2.5 2.5 0 0 1-2.5 2.5H8z"/><path d="M8.5 9.5h7"/><path d="M8.5 12.5h4.5"/>',
    report: '<rect x="4.5" y="3.5" width="15" height="17" rx="2"/><path d="M8.5 16v-3"/><path d="M12 16v-6"/><path d="M15.5 16v-4.5"/>',
    check: '<path d="M5 12.5l4.5 4.5L19 7.5"/>',
    upload: '<path d="M12 15.5V4.5"/><path d="M7.5 9L12 4.5 16.5 9"/><path d="M4.5 15.5v2a2 2 0 0 0 2 2h11a2 2 0 0 0 2-2v-2"/>',
    image: '<rect x="3.5" y="4.5" width="17" height="15" rx="2"/><circle cx="9" cy="10" r="1.6"/><path d="M20.5 16l-5-5-8.5 8.5"/>',
    x: '<path d="M6 6l12 12"/><path d="M18 6L6 18"/>',
    sparkle: '<path d="M12 3.5l1.8 4.7 4.7 1.8-4.7 1.8L12 16.5l-1.8-4.7L5.5 10l4.7-1.8z"/><path d="M18.5 15.5l.8 2 2 .8-2 .8-.8 2-.8-2-2-.8 2-.8z"/>',
    chevron: '<path d="M7 10l5 5 5-5"/>',
    arrow: '<path d="M5 12h14"/><path d="M13 6l6 6-6 6"/>'
  };
  function ic(n, s) { return '<svg class="gca-ic" width="' + (s || 18) + '" height="' + (s || 18) + '" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + IC[n] + '</svg>'; }

  var KIND = {
    boost: { c: '#FF2442', bg: '#FFEEF0', jump: '看依据' },
    hold: { c: '#D99400', bg: '#FFF4DB', jump: '看依据' },
    content: { c: '#16A05D', bg: '#E6F6EE', jump: '看依据' },
    negotiate: { c: '#4C6FFF', bg: '#EEF2FF', jump: '看依据' },
    report: { c: '#7A4DFF', bg: '#F1ECFF', jump: '看依据' }
  };

  var CSS = [
    '.gca{background:#fff;border-radius:20px;box-shadow:0 1px 2px rgba(23,23,28,.04),0 8px 24px rgba(23,23,28,.06);padding:20px;color:#17171C;font-size:15px;line-height:1.65}',
    '.gca *{box-sizing:border-box}',
    '.gca-ic{display:inline-block;vertical-align:-3px;flex:none}',
    '.gca-head{display:flex;justify-content:space-between;align-items:flex-start;gap:12px;flex-wrap:wrap}',
    '.gca-h{font-size:19px;font-weight:800;margin:0}',
    '.gca-sub{font-size:13px;color:#5D5D68;margin-top:2px}',
    '.gca-tools{display:flex;gap:8px;align-items:center;flex-wrap:wrap}',
    '.gca-count{display:inline-flex;align-items:center;gap:4px;border-radius:999px;padding:2px 10px;font-size:13px;font-weight:700;background:#FFEEF0;color:#FF2442;font-variant-numeric:tabular-nums}',
    '.gca-count.done{background:#E6F6EE;color:#0F7A45}',
    '.gca-mini{font:inherit;font-size:13px;border:1.5px solid #E2DDD7;background:#fff;border-radius:999px;padding:3px 10px;cursor:pointer;display:inline-flex;align-items:center;gap:4px;color:#17171C}',
    '.gca-mini:hover{border-color:#CFC9C2}',
    '.gca-list{display:grid;gap:10px;margin-top:14px}',
    '.gca-item{border:1.5px solid #F0ECE7;border-radius:16px;padding:12px 14px;transition:border-color .25s,background .25s}',
    '.gca-item.ok{border-color:#BFE8D2;background:#FBFFFD}',
    '.gca-row{display:flex;gap:12px;align-items:flex-start}',
    '.gca-kic{width:36px;height:36px;border-radius:11px;display:flex;align-items:center;justify-content:center;flex:none}',
    '.gca-main{flex:1;min-width:0}',
    '.gca-t{font-weight:700;line-height:1.5}',
    '.gca-s{font-size:13px;color:#5D5D68;margin-top:2px}',
    '.gca-st{flex:none;font-size:12px;font-weight:700;border-radius:999px;padding:1px 9px;background:#F1EEEA;color:#5D5D68;white-space:nowrap;margin-top:2px}',
    '.gca-st.ok{background:#E6F6EE;color:#0F7A45}',
    '.gca-btns{display:flex;gap:8px;margin-top:10px;flex-wrap:wrap;padding-left:48px}',
    '.gca-btn{font:inherit;font-size:14px;font-weight:600;border-radius:10px;padding:6px 14px;cursor:pointer;border:1.5px solid #E2DDD7;background:#fff;color:#17171C;display:inline-flex;align-items:center;gap:4px}',
    '.gca-btn:hover{border-color:#CFC9C2}',
    '.gca-btn.pri{background:#FF2442;border-color:#FF2442;color:#fff}',
    '.gca-btn.pri:hover{background:#E81E3A}',
    '.gca-btn:disabled{cursor:default;background:#E6F6EE;border-color:#E6F6EE;color:#0F7A45}',
    '.gca-link{font:inherit;font-size:13px;border:0;background:none;color:#5D5D68;cursor:pointer;padding:6px 4px;display:inline-flex;align-items:center;gap:2px}',
    '.gca-link:hover{color:#FF2442}',
    '.gca-draft{margin:10px 0 0 48px;background:#FAF9F7;border-radius:12px;padding:12px 14px;font-size:14px;white-space:pre-wrap;line-height:1.75}',
    '.gca-draft-tools{display:flex;justify-content:flex-end;gap:8px;margin-top:8px;white-space:normal}',
    '.gca-dots{display:inline-flex;gap:4px;align-items:center;padding:4px 0}',
    '.gca-dots i{width:6px;height:6px;border-radius:50%;background:#B9B5AF;animation:gcaDot 1s infinite ease-in-out}',
    '.gca-dots i:nth-child(2){animation-delay:.15s}.gca-dots i:nth-child(3){animation-delay:.3s}',
    '@keyframes gcaDot{0%,80%,100%{transform:translateY(0);opacity:.5}40%{transform:translateY(-4px);opacity:1}}',
    '.gca-allok{margin-top:12px;border-radius:12px;background:#E6F6EE;color:#0F7A45;font-weight:700;padding:10px 14px;display:flex;align-items:center;gap:6px;animation:gcaIn .35s ease both}',
    '@keyframes gcaIn{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:none}}',
    '.gca-other{margin-top:12px;border-top:1px dashed #E8E4DF;padding-top:10px}',
    '.gca-other summary{cursor:pointer;font-size:14px;color:#5D5D68;list-style:none;display:flex;align-items:center;gap:4px}',
    '.gca-other summary::-webkit-details-marker{display:none}',
    '.gca-other[open] summary .gca-ic{transform:rotate(180deg)}',
    '.gca-oth{display:flex;justify-content:space-between;align-items:center;gap:10px;padding:8px 0;border-bottom:1px solid #F3F0EC;font-size:14px}',
    '.gca-oth:last-child{border-bottom:0}',
    '.gca-oth b{display:block;font-weight:600}',
    '.gca-oth span{font-size:13px;color:#5D5D68}',
    '.gca-toast{position:fixed;left:0;right:0;margin:0 auto;width:fit-content;bottom:96px;z-index:9500;background:#17171C;color:#fff;border-radius:12px;padding:10px 16px;font-size:14px;box-shadow:0 8px 24px rgba(0,0,0,.18);animation:gcaIn .25s ease both;max-width:calc(100vw - 32px)}',
    // 补录面板
    '.gcs-mask{position:fixed;inset:0;z-index:9200;background:rgba(23,23,28,.42);display:flex;align-items:center;justify-content:center;padding:16px;animation:gcaIn .2s ease both}',
    '.gcs{background:#fff;border-radius:20px;width:min(760px,100%);max-height:calc(100vh - 32px);overflow:auto;padding:20px;color:#17171C;font-size:15px;line-height:1.65;box-shadow:0 20px 60px rgba(0,0,0,.2)}',
    '.gcs *{box-sizing:border-box}',
    '.gcs-top{display:flex;justify-content:space-between;align-items:flex-start;gap:12px}',
    '.gcs-x{border:0;background:#F3F1EE;border-radius:50%;width:32px;height:32px;cursor:pointer;display:flex;align-items:center;justify-content:center;color:#5D5D68;flex:none}',
    '.gcs-grid{display:grid;grid-template-columns:220px 1fr;gap:16px;margin-top:14px}',
    '.gcs-drop{border:2px dashed #E2DDD7;border-radius:16px;min-height:200px;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:6px;text-align:center;padding:14px;cursor:pointer;color:#5D5D68;font-size:14px;transition:border-color .2s,background .2s;position:relative;overflow:hidden}',
    '.gcs-drop:hover,.gcs-drop.over{border-color:#FF8A9A;background:#FFFAFA}',
    '.gcs-drop img{max-width:100%;max-height:260px;border-radius:10px;display:block}',
    '.gcs-note{font-size:12px;color:#9A9AA4;margin:6px 0}',
    '.gcs-warn{font-size:13px;color:#946500;background:#FFF4DB;border-radius:10px;padding:8px 12px;margin-bottom:8px}',
    '.gcs-ta{width:100%;min-height:120px;border:1.5px solid #E2DDD7;border-radius:12px;padding:10px;font:13px/1.6 ui-monospace,Menlo,monospace;resize:vertical}',
    '.gcs-tb{width:100%;border-collapse:collapse;font-size:14px;font-variant-numeric:tabular-nums}',
    '.gcs-tb th{font-weight:600;color:#5D5D68;font-size:13px;text-align:left;padding:6px 8px;border-bottom:1px solid #EFECE8}',
    '.gcs-tb td{padding:4px 8px;border-bottom:1px solid #F5F2EE}',
    '.gcs-tb input{width:100%;max-width:110px;border:1.5px solid #E8E4DF;border-radius:8px;padding:4px 8px;font:inherit;font-size:14px}',
    '.gcs-tb input.null{background:#FFF4DB;border-color:#F2C94C}',
    '.gcs-act{display:flex;gap:10px;justify-content:flex-end;margin-top:14px;flex-wrap:wrap}',
    '.gcs-err{color:#C8102E;font-size:13px;min-height:18px;margin-top:6px}',
    '.gcs-empty{color:#9A9AA4;font-size:14px;padding:30px 0;text-align:center}',
    '@media (max-width:640px){.gca{padding:16px}.gca-btns{padding-left:0}.gca-draft{margin-left:0}.gcs-mask{align-items:flex-end;padding:0}.gcs{border-radius:20px 20px 0 0;max-height:88vh;padding:16px;animation:gcsUp .28s ease both}.gcs-grid{grid-template-columns:1fr}.gcs-drop{min-height:140px}}',
    '@keyframes gcsUp{from{transform:translateY(40px);opacity:.6}to{transform:none;opacity:1}}',
    // 补录后的通知
    '.gcn{position:fixed;top:12px;left:0;right:0;margin:0 auto;z-index:9100;width:min(720px,calc(100vw - 24px));background:#E6F6EE;border:1.5px solid #BFE8D2;color:#0F5C36;border-radius:16px;padding:12px 14px;box-shadow:0 10px 30px rgba(15,122,69,.15);font-size:14px;line-height:1.7;display:flex;gap:10px;align-items:flex-start;animation:gcaIn .3s ease both}',
    '.gcn b{display:block;font-size:15px;margin-bottom:2px}',
    '.gcn ul{margin:0;padding-left:18px}',
    '.gcn-btns{display:flex;gap:6px;flex:none;align-items:center}',
    '.gcn-undo{font:inherit;font-size:13px;font-weight:600;border:1.5px solid #9FD9BA;background:#fff;color:#0F7A45;border-radius:999px;padding:3px 10px;cursor:pointer;white-space:nowrap}',
    '.gcn-x{border:0;background:none;color:#0F7A45;cursor:pointer;padding:2px}',
    '@media (max-width:640px){.gcn{flex-direction:column}.gcn-btns{align-self:flex-end}}'
  ].join('\n');
  function ensureStyle() {
    if (document.getElementById('gca-style')) return;
    var st = document.createElement('style'); st.id = 'gca-style'; st.textContent = CSS; document.head.appendChild(st);
  }
  function toast(msg) {
    ensureStyle();
    var old = document.querySelector('.gca-toast'); if (old) old.remove();
    var t = document.createElement('div'); t.className = 'gca-toast'; t.textContent = msg; document.body.appendChild(t);
    setTimeout(function () { if (t.parentNode) t.remove(); }, 2400);
  }
  function copy(text) {
    try { if (navigator.clipboard && navigator.clipboard.writeText) return navigator.clipboard.writeText(text).catch(fallback); } catch (e) { }
    fallback();
    function fallback() { var ta = document.createElement('textarea'); ta.value = text; ta.style.position = 'fixed'; ta.style.opacity = '0'; document.body.appendChild(ta); ta.select(); try { document.execCommand('copy'); } catch (e) { } ta.remove(); }
    return Promise.resolve();
  }

  // ---------- 1. 今日行动包 ----------
  function renderActionPack(el, o) {
    ensureStyle();
    var LE = E(), r = o.r, sample = o.sample;
    var pack = LE.actionPack(r, sample), items = pack.items, N = items.length, others = o.others || [];
    var base = sample.name + '|' + pack.date + '|';
    var keyOf = function (it) { return base + it.title; };
    var draftOf = function (it) { return drafts[keyOf(it)] || it.draft; };
    var nOk = function () { return items.filter(function (it) { return adopted[keyOf(it)]; }).length; };

    var h = '<div class="gca" data-gca>' +
      '<div class="gca-head"><div><h3 class="gca-h">观潮已为你准备好今天的 ' + N + ' 件事</h3>' +
      '<div class="gca-sub">' + mdw(pack.date) + ' · 数字由算法算出，草稿由 AI 撰写</div></div>' +
      '<div class="gca-tools"><span class="gca-count" data-count></span>' +
      '<button class="gca-mini" data-supp>' + ic('upload', 14) + '补录本周数据</button></div></div>' +
      '<div class="gca-list">' + items.map(function (it, i) {
        var k = KIND[it.kind] || KIND.report;
        return '<div class="gca-item" data-i="' + i + '">' +
          '<div class="gca-row"><div class="gca-kic" style="background:' + k.bg + ';color:' + k.c + '">' + ic(IC[it.kind] ? it.kind : 'report', 19) + '</div>' +
          '<div class="gca-main"><div class="gca-t">' + esc(it.title) + '</div><div class="gca-s">' + esc(it.summary) + '</div></div>' +
          '<span class="gca-st" data-st>待采纳</span></div>' +
          '<div class="gca-btns"><button class="gca-btn" data-view>查看草稿</button><button class="gca-btn pri" data-ok>采纳</button>' +
          (o.onJump ? '<button class="gca-link" data-jump>' + k.jump + ' ' + ic('arrow', 13) + '</button>' : '') + '</div>' +
          '<div class="gca-draft" data-draft hidden></div></div>';
      }).join('') + '</div>' +
      '<div data-allok></div>' +
      (others.length ? '<details class="gca-other"><summary>其他提醒（' + others.length + '）' + ic('chevron', 15) + '</summary>' +
        others.map(function (x, i) {
          return '<div class="gca-oth"><div><b>' + esc(x.title) + '</b>' + (x.desc ? '<span>' + esc(x.desc) + '</span>' : '') + '</div>' +
            (x.btnText ? '<button class="gca-mini" data-oth="' + i + '">' + esc(x.btnText) + '</button>' : '') + '</div>';
        }).join('') + '</details>' : '') +
      '</div>';
    el.innerHTML = h;
    var card = el.querySelector('[data-gca]');

    function refresh() {
      var n = nOk(), c = card.querySelector('[data-count]');
      c.textContent = n + '/' + N + ' 已采纳'; c.classList.toggle('done', n === N);
      items.forEach(function (it, i) {
        var row = card.querySelector('[data-i="' + i + '"]'), ok = !!adopted[keyOf(it)];
        row.classList.toggle('ok', ok);
        var st = row.querySelector('[data-st]'); st.textContent = ok ? '已采纳' : '待采纳'; st.classList.toggle('ok', ok);
        var b = row.querySelector('[data-ok]'); b.disabled = ok; b.innerHTML = ok ? ic('check', 15) + '已采纳' : '采纳';
      });
      card.querySelector('[data-allok]').innerHTML = n === N ? '<div class="gca-allok">' + ic('check', 17) + '今天的事都处理完了。</div>' : '';
    }
    function fillDraft(row, it) {
      var box = row.querySelector('[data-draft]');
      box.innerHTML = esc(draftOf(it)) + '<div class="gca-draft-tools">' + (o.polish ? '<button class="gca-mini" data-polish>' + ic('sparkle', 14) + 'AI 润色</button>' : '') + '</div>';
      var pb = box.querySelector('[data-polish]');
      if (pb) pb.onclick = function () {
        box.innerHTML = '<span class="gca-dots"><i></i><i></i><i></i></span>';
        Promise.resolve().then(function () { return o.polish(it, LE.aiContext(r, sample)); }).then(function (txt) {
          if (txt && String(txt).trim()) drafts[keyOf(it)] = String(txt).trim();
          fillDraft(row, it);
        }).catch(function () { fillDraft(row, it); toast('AI 润色暂时不可用，已保留原草稿'); });
      };
    }
    items.forEach(function (it, i) {
      var row = card.querySelector('[data-i="' + i + '"]');
      row.querySelector('[data-view]').onclick = function () {
        var box = row.querySelector('[data-draft]'), open = box.hidden;
        if (open) fillDraft(row, it);
        box.hidden = !open; this.textContent = open ? '收起草稿' : '查看草稿';
      };
      row.querySelector('[data-ok]').onclick = function () {
        adopted[keyOf(it)] = true; refresh();
        if (it.kind === 'boost') toast('已加入排期：' + md(it.data.checkDate) + ' 上午复查');
        else if (it.kind === 'hold') toast('已记下，明天提醒你再看');
        else if (it.kind === 'content') toast('已加入下月选题');
        else if (it.kind === 'negotiate') copy(draftOf(it)).then(function () { toast('已复制，可直接发给达人'); });
        else if (it.kind === 'report') copy(draftOf(it)).then(function () { toast('周报已复制'); });
      };
      var j = row.querySelector('[data-jump]'); if (j) j.onclick = function () { o.onJump(it.kind, it); };
    });
    card.querySelector('[data-supp]').onclick = function () { if (o.onSupplement) o.onSupplement(); };
    others.forEach(function (x, i) { var b = card.querySelector('[data-oth="' + i + '"]'); if (b && x.onClick) b.onclick = x.onClick; });
    refresh();
    return { items: items, date: pack.date };
  }

  // ---------- 2. 截图补录 ----------
  function parseText(txt) {
    var rows = [], bad = 0;
    String(txt || '').split(/\n+/).forEach(function (line) {
      line = line.trim(); if (!line) return;
      var p = line.split(/[,，\t ]+/);
      var d = (p[0] || '').replace(/[./年月]/g, '-').replace(/日$/, '');
      var m = d.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/) || d.match(/^(\d{1,2})-(\d{1,2})$/);
      if (!m) { bad++; return; }
      var y = m.length === 4 ? +m[1] : 2026, mo = m.length === 4 ? +m[2] : +m[1], da = m.length === 4 ? +m[3] : +m[2];
      var iso = y + '-' + String(mo).padStart(2, '0') + '-' + String(da).padStart(2, '0');
      var num = function (v) { return v == null || v === '' || isNaN(+v) ? null : +v; };
      rows.push({ date: iso, xhs: num(p[1]), out: num(p[2]) });
    });
    return { rows: rows, bad: bad };
  }

  var VERD = { real: '真有效', maybe: '可能是巧合', none: '没看到效果' };

  function openSupplement(o) {
    ensureStyle();
    var LE = E(), cur = { sample: o.sample, key: o.shopKey }, rows = null, preset = false, img = null;
    var mask = document.createElement('div'); mask.className = 'gcs-mask';
    var ch = function () { var c = cur.sample.channels || []; return { inn: (c.filter(function (x) { return x.scope === 'in'; })[0] || {}).name || '站内', out: (c.filter(function (x) { return x.scope === 'out'; })[0] || {}).name || '站外' }; };
    mask.innerHTML = '<div class="gcs" role="dialog" aria-label="补录本周数据">' +
      '<div class="gcs-top"><div><div class="gca-h">截图补录：把后台截图拖进来，AI 帮你录数据</div><div class="gca-sub" data-shop></div></div><button class="gcs-x" data-x aria-label="关闭">' + ic('x', 16) + '</button></div>' +
      '<div class="gcs-grid"><div><label class="gcs-drop" data-drop><input type="file" accept="image/*" hidden data-file><span data-dropin>' + ic('image', 28) + '<br>拖入或点击上传后台数据截图</span></label>' +
      '<div style="margin-top:10px;text-align:center"><button class="gca-btn" data-demo>' + ic('sparkle', 15) + '用示例截图试试</button></div></div>' +
      '<div data-right><div class="gcs-empty">上传截图后，这里会显示识别出的每日数据</div></div></div>' +
      '<div class="gcs-err" data-err></div>' +
      '<div class="gcs-act"><button class="gca-btn" data-cancel>取消</button><button class="gca-btn pri" data-confirm disabled>确认补录</button></div></div>';
    document.body.appendChild(mask);
    var $ = function (s) { return mask.querySelector(s); };
    function setShopLine() { $('[data-shop]').textContent = '当前店铺：' + cur.sample.name; }
    setShopLine();
    function close() { mask.remove(); }
    $('[data-x]').onclick = close; $('[data-cancel]').onclick = close;
    mask.addEventListener('click', function (e) { if (e.target === mask) close(); });

    function showImg(src) { $('[data-dropin]').innerHTML = '<img src="' + src + '" alt="后台数据截图">'; }
    function renderTable(note) {
      var c = ch();
      $('[data-right]').innerHTML = (note || '') +
        '<table class="gcs-tb"><thead><tr><th>日期</th><th>' + esc(c.inn) + '</th><th>' + esc(c.out) + '</th></tr></thead><tbody>' +
        rows.map(function (r, i) {
          var cell = function (k) { var v = r[k]; return '<td><input inputmode="decimal" data-r="' + i + '" data-k="' + k + '" value="' + (v == null ? '' : v) + '" class="' + (v == null ? 'null' : '') + '" placeholder="待补"></td>'; };
          return '<tr><td>' + md(r.date) + '</td>' + cell('xhs') + cell('out') + '</tr>';
        }).join('') + '</tbody></table>';
      Array.prototype.forEach.call(mask.querySelectorAll('.gcs-tb input'), function (inp) {
        inp.oninput = function () {
          var v = inp.value.trim(), n = v === '' || isNaN(+v) ? null : +v;
          rows[+inp.getAttribute('data-r')][inp.getAttribute('data-k')] = n; inp.classList.toggle('null', n == null);
        };
      });
      $('[data-confirm]').disabled = !rows.length;
    }
    function pasteMode(msg) {
      var c = ch();
      $('[data-right]').innerHTML = '<div class="gcs-warn">' + esc(msg) + '</div>' +
        '<textarea class="gcs-ta" data-ta placeholder="2026-09-04,6,5&#10;2026-09-05,8,5"></textarea>' +
        '<div class="gcs-note">每行一天：日期,' + esc(c.inn) + ',' + esc(c.out) + '</div>' +
        '<button class="gca-btn" data-parse>识别</button>';
      $('[data-parse]').onclick = function () {
        var p = parseText($('[data-ta]').value);
        if (!p.rows.length) { $('[data-err]').textContent = '没有读到数据，请按"日期,站内,站外"每行一天填写'; return; }
        $('[data-err]').textContent = p.bad ? '有 ' + p.bad + ' 行格式不对，已跳过' : '';
        rows = p.rows; preset = false; renderTable('');
      };
    }
    function handleFile(f) {
      if (!f || !/^image\//.test(f.type)) { $('[data-err]').textContent = '请上传图片格式的截图'; return; }
      $('[data-err]').textContent = '';
      var fr = new FileReader();
      fr.onload = function () {
        img = fr.result; showImg(img); preset = false;
        if (o.recognize) {
          $('[data-right]').innerHTML = '<div class="gca-sub">AI 正在识别截图里的数字…</div><span class="gca-dots"><i></i><i></i><i></i></span>';
          Promise.resolve().then(function () { return o.recognize(img); }).then(function (res) {
            var arr = Array.isArray(res) ? res : [];
            rows = arr.filter(function (x) { return x && /^\d{4}-\d{2}-\d{2}$/.test(x.date); }).map(function (x) { return { date: x.date, xhs: x.xhs == null ? null : +x.xhs, out: x.out == null ? null : +x.out }; });
            if (!rows.length) pasteMode('没有识别出数据，请把截图里的数字按"日期,站内,站外"粘贴到下方');
            else renderTable('<div class="gcs-note">AI 识别结果，请核对；黄色格子看不清，需要手动补</div>');
          }).catch(function () { pasteMode('识图暂时不可用，请把截图里的数字按"日期,站内,站外"粘贴到下方'); });
        } else pasteMode('当前平台暂不支持识图，请把截图里的数字按"日期,站内,站外"粘贴到下方');
      };
      fr.readAsDataURL(f);
    }
    var drop = $('[data-drop]'), file = $('[data-file]');
    file.onchange = function () { handleFile(file.files[0]); };
    drop.addEventListener('dragover', function (e) { e.preventDefault(); drop.classList.add('over'); });
    drop.addEventListener('dragleave', function () { drop.classList.remove('over'); });
    drop.addEventListener('drop', function (e) { e.preventDefault(); drop.classList.remove('over'); handleFile(e.dataTransfer.files[0]); });
    $('[data-demo]').onclick = function () {
      var d = o.demo; if (!d) return;
      if (d.shop && d.shop !== cur.key && o.switchShop) { var s = o.switchShop(d.shop); if (s) { cur.sample = s; cur.key = d.shop; setShopLine(); } }
      if (o.demoImage) showImg(o.demoImage);
      rows = d.rows.map(function (x) { return { date: x.date, xhs: x.xhs, out: x.out }; }); preset = true;
      $('[data-err]').textContent = '';
      renderTable('<div class="gcs-note">示例截图的识别结果（预置）</div>');
    };
    $('[data-confirm]').onclick = function () {
      if (!rows || !rows.length) return;
      if (rows.some(function (r) { return r.xhs == null || r.out == null; })) { $('[data-err]').textContent = '还有黄色格子没填，补上数字再确认'; return; }
      var old = cur.sample, neu = LE.appendDaily(old, rows);
      var ra = LE.compute(old), rb = LE.compute(neu), M = old.metric;
      var ds = rows.map(function (r) { return r.date; }).sort();
      var lines = ['种草一共多带来：' + r0(ra.summary.totalInc) + ' → ' + r0(rb.summary.totalInc) + ' 个' + M];
      (ra.live || []).forEach(function (n) {
        var m = (rb.done || []).filter(function (x) { return x.title === n.title; })[0];
        if (m) lines.push('「' + m.title + '」观察期结束：' + (VERD[m.verdict] || '') + '，多带来约 ' + r0(m.total) + ' 个' + M);
      });
      var head = '已补录 ' + md(ds[0]) + '–' + md(ds[ds.length - 1]) + ' 共 ' + ds.length + ' 天，观潮重新算了一遍：';
      close();
      if (o.onConfirm) o.onConfirm(neu, old);
      showNotice(head, lines, function () { if (o.onUndo) o.onUndo(old); toast('已撤销补录'); });
    };
  }

  function showNotice(head, lines, onUndo) {
    ensureStyle();
    var old = document.querySelector('.gcn'); if (old) old.remove();
    var n = document.createElement('div'); n.className = 'gcn'; n.setAttribute('role', 'status');
    n.innerHTML = '<div style="flex:1;min-width:0"><b>' + esc(head) + '</b><ul>' + lines.map(function (l) { return '<li>' + esc(l) + '</li>'; }).join('') + '</ul></div>' +
      '<div class="gcn-btns"><button class="gcn-undo">撤销补录</button><button class="gcn-x" aria-label="关闭">' + ic('x', 16) + '</button></div>';
    document.body.appendChild(n);
    n.querySelector('.gcn-x').onclick = function () { n.remove(); };
    n.querySelector('.gcn-undo').onclick = function () { n.remove(); if (onUndo) onUndo(); };
  }

  window.GuanchaoAgent = { renderActionPack: renderActionPack, openSupplement: openSupplement, toast: toast, reset: function () { adopted = {}; drafts = {}; var n = document.querySelector('.gcn'); if (n) n.remove(); } };
})();
