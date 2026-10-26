// 观潮 · 升级 B 模块：下月排期表、发布前体检
// 依赖 engine.js（LedgerEngine）。所有数字来自 LedgerEngine，本文件不含写死的业务数字。
//
// GuanchaoPlanner.renderSchedule(容器元素, { r, sample, plan })        // 预算页"计划发几篇"变化时重新调用
// GuanchaoPlanner.renderNoteCheck(容器元素, { r, sample, classify, example, polish })
//    classify: 现有的内容类型识别函数 function (文本) { return 类型名 }
//    example: 「填入示例」要填的标题（留学「秋季申请季，我整理了一份文书准备清单」等，由调用方按店铺传）
//    polish: 可选，接入大模型时传 async function (title, body, ctx) { return 文字 }；不传则显示「当前为规则版体检」
(function () {
  var E = function () { return window.LedgerEngine || (typeof LedgerEngine !== 'undefined' ? LedgerEngine : null); };
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function r0(v) { var x = Math.round(v); return x === 0 ? 0 : x; }
  function money(v) { return '¥' + r0(v).toLocaleString('en-US'); }
  function md(iso) { var p = String(iso).split('-'); return (+p[1]) + '月' + (+p[2]) + '日'; }
  function toDate(iso) { var p = String(iso).split('-'); return new Date(+p[0], +p[1] - 1, +p[2]); }
  function iso(d) { return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); }
  var TYPE_COLORS = ['#FF2442', '#4C6FFF', '#16A05D', '#D99400', '#7A4DFF', '#0FA3B1', '#E05D9F', '#8A6D3B'];
  var WK = ['一', '二', '三', '四', '五', '六', '日'];

  var CSS = [
    '.gs-card{background:#fff;border-radius:20px;box-shadow:0 1px 2px rgba(23,23,28,.04),0 8px 24px rgba(23,23,28,.06);padding:20px;color:#17171C;font-size:15px;line-height:1.65}',
    '.gs-card *{box-sizing:border-box}',
    '.gs-h{font-size:19px;font-weight:800;margin:0}',
    '.gs-sub{font-size:13px;color:#5D5D68;margin-top:2px;font-variant-numeric:tabular-nums}',
    '.gs-cal{display:grid;grid-template-columns:repeat(7,1fr);gap:4px;margin-top:14px}',
    '.gs-wk{text-align:center;font-size:12px;color:#9A9AA4;padding:2px 0}',
    '.gs-d{min-height:78px;border-radius:10px;background:#FAF9F7;padding:5px 6px;font-size:11px;line-height:1.45;position:relative}',
    '.gs-d.out{background:#F6F4F1;opacity:.45}',
    '.gs-d.today{outline:1.5px solid #FF2442}',
    '.gs-d .n{font-size:12px;font-weight:700;color:#5D5D68;margin-bottom:2px;font-variant-numeric:tabular-nums}',
    '.gs-tag{display:inline-block;border-radius:999px;padding:0 6px;color:#fff;font-weight:700;font-size:10px;line-height:16px;max-width:100%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;vertical-align:top}',
    '.gs-post{font-weight:700;color:#17171C;margin-top:1px}',
    '.gs-chk{color:#5D5D68;display:flex;align-items:center;gap:3px;margin-top:2px}',
    '.gs-light{display:inline-flex;flex-direction:column;gap:1px;width:7px;flex:none}.gs-light i{width:5px;height:5px;border-radius:50%;background:#E8E4DF}.gs-light i:first-child{background:#FF2442}.gs-light i:nth-child(2){background:#D99400}.gs-light i:last-child{background:#16A05D}',
    '.gs-exp{color:#0F7A45;margin-top:1px}.gs-exp.hold{color:#5D5D68}',
    '.gs-list{display:none}',
    '.gs-rules{margin:14px 0 0;padding-left:20px;font-size:14px;color:#2B2B33}.gs-rules li{margin:4px 0}',
    '.gs-legend{display:flex;gap:10px;flex-wrap:wrap;margin-top:10px;font-size:12px;color:#5D5D68}.gs-legend i{display:inline-block;width:10px;height:10px;border-radius:50%;margin-right:4px;vertical-align:-1px}',
    '@media (max-width:640px){.gs-card{padding:16px}.gs-cal{display:none}.gs-list{display:grid;gap:8px;margin-top:12px}.gs-li{display:flex;gap:10px;align-items:flex-start;border:1.5px solid #F0ECE7;border-radius:12px;padding:10px 12px;font-size:14px}.gs-li .dt{min-width:56px;font-weight:700;color:#5D5D68;font-variant-numeric:tabular-nums}.gs-li .bd{flex:1}.gs-li .bd small{display:block;color:#5D5D68;font-size:12px}}',
    // 体检
    '.gc-form{display:grid;gap:10px;margin-top:14px}',
    '.gc-form input,.gc-form textarea{width:100%;border:1.5px solid #E2DDD7;border-radius:12px;padding:10px 12px;font:inherit;font-size:14px}',
    '.gc-form textarea{min-height:88px;resize:vertical}',
    '.gc-form input:focus,.gc-form textarea:focus{outline:0;border-color:#FF8A9A}',
    '.gc-btns{display:flex;gap:8px;flex-wrap:wrap}',
    '.gc-btn{font:inherit;font-size:14px;font-weight:600;border-radius:12px;padding:8px 16px;cursor:pointer;border:1.5px solid #E2DDD7;background:#fff;color:#17171C}',
    '.gc-btn.pri{background:#FF2442;border-color:#FF2442;color:#fff}',
    '.gc-res{margin-top:14px;display:grid;gap:10px}',
    '.gc-row{background:#FAF9F7;border-radius:12px;padding:10px 14px;font-size:14px}',
    '.gc-row b{display:block;margin-bottom:2px}',
    '.gc-type{display:inline-block;background:#EEF2FF;color:#4C6FFF;border-radius:999px;padding:0 10px;font-weight:700;font-size:13px}',
    '.gc-bar{height:10px;border-radius:5px;background:#EFECE8;overflow:hidden;margin:6px 0 2px}.gc-bar b{display:block;height:100%;width:0;background:linear-gradient(90deg,#16A05D,#8FD9B0);border-radius:5px;transition:width .8s cubic-bezier(.2,.8,.2,1)}',
    '.gc-tips{margin:4px 0 0;padding-left:20px}.gc-tips li{margin:3px 0}',
    '.gc-ref{display:flex;justify-content:space-between;gap:8px;padding:4px 0;border-bottom:1px solid #F0ECE7;font-size:14px}.gc-ref:last-child{border-bottom:0}.gc-ref span:last-child{color:#0F7A45;font-weight:700;white-space:nowrap}',
    '.gc-note{font-size:12px;color:#9A9AA4;margin-top:8px}',
    '.gc-err{font-size:13px;color:#C8102E;min-height:18px}',
    '.gc-dots{display:inline-flex;gap:4px;align-items:center;padding:4px 0}.gc-dots i{width:6px;height:6px;border-radius:50%;background:#B9B5AF;animation:gcDot 1s infinite ease-in-out}.gc-dots i:nth-child(2){animation-delay:.15s}.gc-dots i:nth-child(3){animation-delay:.3s}',
    '@keyframes gcDot{0%,80%,100%{transform:translateY(0);opacity:.5}40%{transform:translateY(-4px);opacity:1}}',
    '.gc-ai{white-space:pre-wrap}.gc-ai .alt{display:flex;justify-content:space-between;gap:8px;align-items:center;background:#fff;border:1.5px solid #F0ECE7;border-radius:10px;padding:6px 10px;margin:6px 0}.gc-ai .alt button{font:inherit;font-size:12px;border:1.5px solid #E2DDD7;background:#fff;border-radius:999px;padding:2px 10px;cursor:pointer}'
  ].join('\n');
  function ensureStyle() { if (document.getElementById('gs-style')) return; var st = document.createElement('style'); st.id = 'gs-style'; st.textContent = CSS; document.head.appendChild(st); }

  // ---------- 下月排期表 ----------
  function renderSchedule(el, o) {
    ensureStyle();
    var LE = E(), sc = LE.schedule(o.r, o.sample, { plan: o.plan });
    if (!sc || sc.ok === false) { el.innerHTML = '<div class="gs-card"><h3 class="gs-h">下月排期表</h3><div class="gs-sub">还没有给跑起来的笔记投流的记录，先按"该不该投"的规则小额试投两三次</div></div>'; return sc; }
    var types = []; sc.posts.forEach(function (p) { if (types.indexOf(p.type) < 0) types.push(p.type); });
    var color = function (t) { return TYPE_COLORS[types.indexOf(t) % TYPE_COLORS.length]; };
    var byDate = {}, byCheck = {};
    sc.posts.forEach(function (p) { byDate[p.date] = p; byCheck[p.checkDate] = p; });
    var start = toDate(sc.start), first = new Date(start); first.setDate(start.getDate() - ((start.getDay() + 6) % 7));   // 周一开始
    var cells = [];
    for (var i = 0; i < 35; i++) { var d = new Date(first); d.setDate(first.getDate() + i); cells.push(iso(d)); }
    var expLine = function (p) { if (!p.expGroup) return ''; return p.expGroup === 'boost' ? '<div class="gs-exp">若亮绿灯 → 投 ' + money(sc.spendPerGreen) + '</div>' : '<div class="gs-exp hold">若亮绿灯 → 先不投（对照组）</div>'; };
    var cal = '<div class="gs-cal">' + WK.map(function (w) { return '<div class="gs-wk">周' + w + '</div>'; }).join('') + cells.map(function (ds) {
      var inR = ds >= sc.start && ds <= sc.end, p = byDate[ds], c = byCheck[ds];
      var h = '<div class="gs-d' + (inR ? '' : ' out') + '"><div class="n">' + (+ds.split('-')[2]) + (ds.split('-')[2] === '01' || ds === cells[0] ? '<span style="font-weight:400"> /' + (+ds.split('-')[1]) + '月</span>' : '') + '</div>';
      if (p) h += '<span class="gs-tag" style="background:' + color(p.type) + '">' + esc(p.type) + '</span><div class="gs-post">发第 ' + p.idx + ' 篇</div>';
      if (c) h += '<div class="gs-chk"><span class="gs-light"><i></i><i></i><i></i></span>看第 ' + c.idx + ' 篇红绿灯</div>' + expLine(c);
      return h + '</div>';
    }).join('') + '</div>';
    var events = [];
    sc.posts.forEach(function (p) { events.push({ d: p.date, t: '发第 ' + p.idx + ' 篇', s: p.type, tp: p.type }); events.push({ d: p.checkDate, t: '看第 ' + p.idx + ' 篇红绿灯', s: p.expGroup === 'boost' ? '若亮绿灯 → 投 ' + money(sc.spendPerGreen) : p.expGroup === 'hold' ? '若亮绿灯 → 先不投（对照组）' : '' }); });
    events.sort(function (a, b) { return a.d < b.d ? -1 : a.d > b.d ? 1 : (a.tp ? -1 : 1); });
    var list = '<div class="gs-list">' + events.map(function (e) { return '<div class="gs-li"><span class="dt">' + md(e.d) + '</span><div class="bd">' + (e.tp ? '<span class="gs-tag" style="background:' + color(e.tp) + '">' + esc(e.tp) + '</span> ' : '') + esc(e.t) + (e.s && !e.tp ? '<small>' + esc(e.s) + '</small>' : '') + '</div></div>'; }).join('') + '</div>';
    el.innerHTML = '<div class="gs-card">' +
      '<h3 class="gs-h">下月排期表</h3>' +
      '<div class="gs-sub">' + md(sc.start) + '–' + md(sc.end) + ' · 发 ' + sc.plan + ' 篇 · 预计 ' + (Math.round(sc.expectedGreen * 10) / 10).toFixed(1) + ' 篇亮绿灯 · 绿灯每篇投 ' + money(sc.spendPerGreen) + '</div>' +
      cal + list +
      '<div class="gs-legend">' + types.map(function (t) { return '<span><i style="background:' + color(t) + '"></i>' + esc(t) + '</span>'; }).join('') + '</div>' +
      '<ol class="gs-rules"><li>发布后第 3 天上午看红绿灯：绿灯才投，黄灯再等一天，红灯改标题或封面重发。</li><li>单数篇进投流组、双数篇进对照组，月底就能比出投流的真实效果。</li><li>月底把数据导入观潮，账本会自动复盘，再生成下个月的排期。</li></ol>' +
      '</div>';
    return sc;
  }

  // ---------- 发布前体检 ----------
  function renderNoteCheck(el, o) {
    ensureStyle();
    var LE = E(), r = o.r, M = o.sample.metric;
    el.innerHTML = '<div class="gs-card">' +
      '<h3 class="gs-h">发布前体检：这篇笔记发出去，大概率怎么样？</h3>' +
      '<div class="gs-sub">贴上准备发的标题和正文，AI 会依据这家店自己的账本来判断，而不是泛泛而谈</div>' +
      '<div class="gc-form"><input type="text" data-title placeholder="标题" aria-label="标题"><textarea data-body placeholder="正文（可选）" aria-label="正文"></textarea>' +
      '<div class="gc-btns"><button class="gc-btn pri" data-go>开始体检</button><button class="gc-btn" data-ex>填入示例</button></div><div class="gc-err" data-err></div></div>' +
      '<div class="gc-res" data-res hidden></div>' + (o.polish ? '' : '<div class="gc-note">当前为规则版体检</div>') + '</div>';
    var $ = function (s) { return el.querySelector(s); };
    $('[data-ex]').onclick = function () { $('[data-title]').value = o.example || ''; $('[data-body]').value = ''; $('[data-err]').textContent = ''; };
    $('[data-go]').onclick = function () {
      var title = $('[data-title]').value.trim(), body = $('[data-body]').value.trim();
      if (!title) { $('[data-err]').textContent = '先填一个标题'; return; }
      $('[data-err]').textContent = '';
      var c = LE.noteCheck(r, title, body, o.classify);
      var res = $('[data-res]'); res.hidden = false;
      var h = '<div class="gc-row"><b>判断类型：<span class="gc-type">' + esc(c.type) + '</span></b>' +
        (c.typeStats ? '这类内容在本店排第 ' + c.typeStats.rank + '/' + c.typeStats.of + '，历史 ' + c.typeStats.count + ' 篇平均每篇多带来 ' + (Math.round(c.typeStats.avg * 10) / 10).toFixed(1) + ' 个' + esc(M) + '，' + r0(c.typeStats.realRate * 100) + '% 真有效' : '这类内容本店还没有历史记录，先按效果最好的类型的写法来') + '</div>';
      if (c.greenChance != null) h += '<div class="gc-row"><b>亮绿灯的把握</b><div class="gc-bar"><b data-w="' + r0(c.greenChance * 100) + '"></b></div><span style="font-variant-numeric:tabular-nums">' + r0(c.greenChance * 100) + '%</span></div>';
      h += '<div class="gc-row"><b>改进建议</b>' + (c.tips.length ? '<ul class="gc-tips">' + c.tips.map(function (t) { return '<li>' + esc(t) + '</li>'; }).join('') + '</ul>' : '标题写法和本店效果好的笔记接近，可以发') + '</div>';
      if (c.references.length) h += '<div class="gc-row"><b>参考这几篇的写法</b>' + c.references.map(function (n) { return '<div class="gc-ref"><span>' + esc(n.title) + '</span><span>+' + r0(n.increase) + ' 个' + esc(M) + '</span></div>'; }).join('') + '</div>';
      if (o.polish) h += '<div class="gc-row" data-ai><b>AI 改写建议</b><span class="gc-dots"><i></i><i></i><i></i></span></div>';
      res.innerHTML = h;
      setTimeout(function () { var b = res.querySelector('[data-w]'); if (b) b.style.width = b.getAttribute('data-w') + '%'; }, 50);
      if (o.polish) {
        Promise.resolve().then(function () { return o.polish(title, body, LE.aiContext(r, o.sample)); }).then(function (txt) {
          var box = res.querySelector('[data-ai]'); if (!box) return;
          var lines = String(txt || '').split('\n');
          box.innerHTML = '<b>AI 改写建议</b><div class="gc-ai">' + lines.map(function (l) {
            var m = l.match(/^\s*(?:标题\s*)?[①②③123][\.、）)．:：]\s*(.+)$/);
            if (m && m[1].length <= 40) return '<div class="alt"><span>' + esc(m[1]) + '</span><button type="button" data-copy="' + esc(m[1]) + '">复制</button></div>';
            return esc(l) + '\n';
          }).join('') + '</div>';
          Array.prototype.forEach.call(box.querySelectorAll('[data-copy]'), function (b) { b.onclick = function () { try { navigator.clipboard.writeText(b.getAttribute('data-copy')); } catch (e) { } b.textContent = '已复制'; }; });
        }).catch(function () { var box = res.querySelector('[data-ai]'); if (box) box.innerHTML = '<b>AI 改写建议</b>暂时不可用'; });
      }
    };
  }

  window.GuanchaoPlanner = { renderSchedule: renderSchedule, renderNoteCheck: renderNoteCheck };
})();
