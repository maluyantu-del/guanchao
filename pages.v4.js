// 观潮 · 打磨模块（v4：问观潮逐字打出 + 数字胶囊、幕后目录浮标、术语问号悬停变「!」）：问观潮悬浮面板、专业词小问号、「落地设想」页、「幕后」页
// 依赖 engine.js（LedgerEngine）。示意图里的数字都从 LedgerEngine 算出，本文件不含写死的业务数字。
//
// 1) GuanchaoAsk.mount({
//      getContext: function () { return 'overview' | 'notes' | 'invest' | 'budget' | 'ai' | 'manager'; },  // 当前所在位置
//      ask: async function (question) { return '回答文字'; }   // 复用「AI 参谋」的回答能力（规则回答或大模型）
//    })
//    种草侦探打开期间（body 上有 class gcd-open）按钮自动隐藏。
// 2) GuanchaoGlossary.tip('保本线')      → 返回小问号的 HTML 字符串，放在词后面
//    GuanchaoGlossary.attach(根元素)     → 在根元素里自动给每个术语"第一次出现的地方"加小问号（每次重新渲染后调用一次）
// 3) GuanchaoPages.openVision({ samples: SAMPLES, onBack })   // 「如果观潮长在小红书里」
//    GuanchaoPages.openBehind({ onBack })                      // 「幕后」
(function () {
  var E = function () { return window.LedgerEngine || (typeof LedgerEngine !== 'undefined' ? LedgerEngine : null); };
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function r0(v) { var x = Math.round(v); return x === 0 ? 0 : x; }
  function money(v) { return '¥' + r0(v).toLocaleString('en-US'); }
  var IC = {
    sparkle: '<path d="M12 3.5l1.8 4.7 4.7 1.8-4.7 1.8L12 16.5l-1.8-4.7L5.5 10l4.7-1.8z"/><path d="M18.5 15.5l.8 2 2 .8-2 .8-.8 2-.8-2-2-.8 2-.8z"/>',
    x: '<path d="M6 6l12 12"/><path d="M18 6L6 18"/>',
    send: '<path d="M4 12l16-8-6 16-2.5-6.5z"/>',
    back: '<path d="M19 12H5"/><path d="M11 6l-6 6 6 6"/>',
    wave: '<path d="M3 15c2 0 2-2 4.5-2S10 15 12 15s2-2 4.5-2S19 15 21 15"/><path d="M3 10c2 0 2-2 4.5-2S10 10 12 10s2-2 4.5-2S19 10 21 10"/>'
  };
  function ic(n, s) {
    var sz = s || 18;
    return '<' + 'svg class="gp-ic" width="' + sz + '" height="' + sz + '" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + IC[n] + '</svg>';
  }

  var CSS = [
    '.gp-ic{display:inline-block;vertical-align:-3px;flex:none}',
    // 术语小问号
    '.gg-q{display:inline-flex;align-items:center;justify-content:center;width:16px;height:16px;border-radius:50%;border:1.5px solid currentColor;opacity:.55;font:700 11px/1 -apple-system,sans-serif;margin-left:4px;vertical-align:1px;cursor:help;background:none;color:inherit;padding:0;flex:none}',
    '.gg-q:hover,.gg-q.on{opacity:1}',
    '.gg-pop{position:absolute;z-index:9400;max-width:280px;background:#17171C;color:#fff;border-radius:12px;padding:10px 12px;font-size:13px;line-height:1.6;box-shadow:0 10px 30px rgba(0,0,0,.2);animation:ggIn .18s ease both}',
    '.gg-pop b{display:block;margin-bottom:2px;font-size:13px}',
    '@keyframes ggIn{from{opacity:0;transform:translateY(4px)}to{opacity:1;transform:none}}',
    // 问观潮
    '.gq-fab{position:fixed;right:16px;bottom:24px;z-index:8800;display:flex;align-items:center;gap:8px;cursor:pointer;border:0;background:none;padding:0;font:inherit}',
    '.gq-fab i{width:52px;height:52px;border-radius:50%;background:linear-gradient(135deg,#7A4DFF,#FF2442);color:#fff;display:flex;align-items:center;justify-content:center;box-shadow:0 8px 24px rgba(255,36,66,.3);transition:transform .2s}',
    '.gq-fab:hover i{transform:scale(1.06)}',
    '.gq-fab span{font-size:13px;font-weight:700;color:#17171C;background:#fff;border-radius:999px;padding:4px 10px;box-shadow:0 2px 10px rgba(23,23,28,.12)}',
    'body.gcd-open .gq-fab,body.gcd-open .gq-wrap{display:none!important}',
    '.gq-wrap{position:fixed;inset:0;z-index:8900;display:flex;justify-content:flex-end;background:rgba(23,23,28,.25)}',
    '.gq{width:min(420px,100%);height:100%;background:#fff;display:flex;flex-direction:column;box-shadow:-10px 0 40px rgba(0,0,0,.15);animation:gqSlide .28s ease both;color:#17171C;font-size:15px;line-height:1.65}',
    '.gq *{box-sizing:border-box}',
    '@keyframes gqSlide{from{transform:translateX(40px);opacity:.5}to{transform:none;opacity:1}}',
    '.gq-top{display:flex;align-items:center;justify-content:space-between;padding:14px 16px;border-bottom:1px solid #F0ECE7}',
    '.gq-top b{display:flex;align-items:center;gap:8px;font-size:16px}',
    '.gq-top b i{width:28px;height:28px;border-radius:50%;background:linear-gradient(135deg,#7A4DFF,#FF2442);color:#fff;display:flex;align-items:center;justify-content:center}',
    '.gq-x{border:0;background:#F3F1EE;border-radius:50%;width:30px;height:30px;cursor:pointer;display:flex;align-items:center;justify-content:center;color:#5D5D68}',
    '.gq-note{font-size:12px;color:#9A9AA4;padding:8px 16px 0}',
    '.gq-quick{display:flex;flex-wrap:wrap;gap:6px;padding:8px 16px 10px}',
    '.gq-quick button{font:inherit;font-size:13px;border:1.5px solid #E2DDD7;background:#fff;border-radius:999px;padding:4px 12px;cursor:pointer;color:#17171C}',
    '.gq-quick button:hover{border-color:#FF8A9A;color:#FF2442}',
    '.gq-msgs{flex:1;overflow-y:auto;padding:6px 16px 12px;display:flex;flex-direction:column;gap:10px;background:#FAF9F7}',
    '.gq-m{max-width:88%;border-radius:14px;padding:9px 12px;font-size:14px;white-space:pre-wrap;line-height:1.65}',
    '.gq-m.u{align-self:flex-end;background:#17171C;color:#fff;border-bottom-right-radius:4px}',
    '.gq-m.a{align-self:flex-start;background:#fff;border:1px solid #EFECE8;border-bottom-left-radius:4px}',
    '.gq-dots{display:inline-flex;gap:4px;align-items:center;padding:2px 0}.gq-dots i{width:6px;height:6px;border-radius:50%;background:#B9B5AF;animation:gqDot 1s infinite ease-in-out}.gq-dots i:nth-child(2){animation-delay:.15s}.gq-dots i:nth-child(3){animation-delay:.3s}',
    '@keyframes gqDot{0%,80%,100%{transform:translateY(0);opacity:.5}40%{transform:translateY(-4px);opacity:1}}',
    '.gq-in{display:flex;gap:8px;padding:10px 16px;border-top:1px solid #F0ECE7;background:#fff}',
    '.gq-in input{flex:1;border:1.5px solid #E2DDD7;border-radius:12px;padding:9px 12px;font:inherit;font-size:14px;min-width:0}',
    '.gq-in input:focus{outline:0;border-color:#FF8A9A}',
    '.gq-in button{border:0;background:#FF2442;color:#fff;border-radius:12px;width:42px;cursor:pointer;display:flex;align-items:center;justify-content:center}',
    '@media (max-width:640px){.gq-fab{right:12px;bottom:76px}.gq-fab span{display:none}.gq-wrap{align-items:flex-end}.gq{width:100%;height:82vh;border-radius:20px 20px 0 0;animation:gqUp .28s ease both}@keyframes gqUp{from{transform:translateY(40px);opacity:.5}to{transform:none;opacity:1}}}',
    // 独立页
    '.gp{position:fixed;inset:0;z-index:8700;background:#F6F4F1;overflow-y:auto;-webkit-overflow-scrolling:touch;color:#17171C;font-size:15px;line-height:1.7;font-family:-apple-system,BlinkMacSystemFont,"PingFang SC","Microsoft YaHei",sans-serif}',
    '.gp *{box-sizing:border-box}',
    '.gp-top{position:sticky;top:0;z-index:2;display:flex;align-items:center;gap:12px;padding:12px 16px;background:rgba(246,244,241,.92);backdrop-filter:blur(8px);-webkit-backdrop-filter:blur(8px)}',
    '.gp-back{font:inherit;font-size:14px;font-weight:600;border:1.5px solid #E2DDD7;background:#fff;border-radius:999px;padding:6px 14px 6px 10px;cursor:pointer;display:inline-flex;align-items:center;gap:4px;color:#17171C}',
    '.gp-wrap{max-width:900px;margin:4px auto 48px;padding:0 16px}',
    '.gp-h1{font-size:26px;font-weight:800;margin:8px 0 4px;line-height:1.35}',
    '.gp-sub{color:#5D5D68;font-size:14px;margin:0 0 18px}',
    '.gp-grid{display:grid;grid-template-columns:1fr 1fr;gap:14px}',
    '.gp-card{background:#fff;border-radius:20px;box-shadow:0 1px 2px rgba(23,23,28,.04),0 8px 24px rgba(23,23,28,.06);overflow:hidden}',
    '.gp-mock{background:#F3F1EE;padding:16px;min-height:170px;display:flex;align-items:center;justify-content:center}',
    '.gp-body{padding:14px 18px 18px}',
    '.gp-body b{display:block;font-size:16px;margin-bottom:4px}',
    '.gp-body p{margin:0;font-size:14px;color:#2B2B33}',
    '.gp-sec{background:#fff;border-radius:20px;box-shadow:0 1px 2px rgba(23,23,28,.04),0 8px 24px rgba(23,23,28,.06);padding:18px 20px;margin-top:14px}',
    '.gp-sec h3{margin:0 0 6px;font-size:17px}',
    '.gp-sec p{margin:0;font-size:15px}',
    '.gp-sec ol{margin:4px 0 0;padding-left:22px}',
    '.gp-sec li{margin:4px 0}',
    '.gp-tag{display:inline-block;font-size:12px;color:#5D5D68;background:#EFECE8;border-radius:999px;padding:1px 8px;margin-left:8px;vertical-align:2px}',
    // 线框示意图元素
    '.wf{width:100%;max-width:340px;font-size:11px;color:#5D5D68;font-variant-numeric:tabular-nums}',
    '.wf-win{background:#fff;border:1.5px solid #D9D4CD;border-radius:10px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,.05)}',
    '.wf-bar{height:10px;background:#E8E4DF;display:flex;gap:4px;padding:0 6px;align-items:center}.wf-bar i{width:5px;height:5px;border-radius:50%;background:#CFC9C2}',
    '.wf-side{width:78px;background:#F6F4F1;padding:8px 6px;display:flex;flex-direction:column;gap:5px;border-right:1px solid #E8E4DF}',
    '.wf-side span{height:9px;border-radius:3px;background:#DED9D2;display:block}.wf-side .on{background:#FF2442;color:#fff;height:auto;font-size:10px;padding:2px 5px;border-radius:5px}',
    '.wf-main{flex:1;padding:8px}',
    '.wf-hero{background:linear-gradient(135deg,#FF2442,#FF7A59);color:#fff;border-radius:8px;padding:8px 10px}.wf-hero b{display:block;font-size:20px;line-height:1.2}.wf-hero small{opacity:.9}',
    '.wf-line{height:7px;border-radius:3px;background:#E8E4DF;margin:6px 0}',
    '.wf-btn{display:inline-block;background:#FF2442;color:#fff;border-radius:6px;padding:4px 14px;font-weight:700;font-size:12px}',
    '.wf-tip{background:#E6F6EE;color:#0F7A45;border:1px solid #BFE8D2;border-radius:8px;padding:6px 8px;font-size:11px;margin-bottom:8px;font-weight:600}',
    '.wf-row{display:flex;justify-content:space-between;align-items:center;gap:8px;padding:6px 8px;border-bottom:1px solid #F0ECE7;background:#fff}',
    '.wf-row:last-child{border-bottom:0}',
    '.wf-y{background:#FFF4DB;color:#946500;border-radius:999px;padding:0 6px;font-size:10px;font-weight:700}',
    '.wf-r{background:#FFEEF0;color:#C8102E;border-radius:999px;padding:0 6px;font-size:10px;font-weight:700}',
    '.wf-g{background:#E6F6EE;color:#0F7A45;border-radius:999px;padding:0 6px;font-size:10px;font-weight:700}',
    '.wf-av{width:28px;height:28px;border-radius:50%;background:#DED9D2;flex:none}',
    '@media (max-width:640px){.gp-grid{grid-template-columns:1fr}.gp-h1{font-size:22px}.gp-sec{padding:16px}}'
  ].join('\n');
  function ensureStyle() { if (document.getElementById('gp-style')) return; var st = document.createElement('style'); st.id = 'gp-style'; st.textContent = CSS; document.head.appendChild(st); }

  // ================= 1. 术语小问号 =================
  var TERMS = {
    '保本线': '每花 1 元至少要换回多少元才不亏，等于 1 ÷ 毛利率。保本线按毛利率计，未计人工、房租等固定成本；商家可按自身情况上调。可以在总览的"调整假设"里改成你自己的数。',
    '去水分': '投流那几天的增长里，扣掉笔记本来就会带来的部分，剩下的才算投流的功劳。',
    '全域': '站内（小红书）和站外（淘宝、天猫、公众号等）的成交一起算。',
    '平时的样子': '没发笔记、没投流时，每天自然会来的量，已考虑周末规律和长期走势。',
    '正常波动': '平时每天也会忽高忽低，在这个范围内的变化可能只是运气。',
    '真有效': '多出来的量明显超出正常波动（约 95% 把握）才算真有效，否则可能是巧合。',
    '可能是巧合': '多出来的量明显超出正常波动（约 95% 把握）才算真有效，否则可能是巧合。',
    '绿灯线': '发布后两天比平时多出来的量超过这条线，才建议投流。',
    '回本报价': '按这位博主带来的生意算，报价不超过这个数才不亏。',
    '可信度': '结论超出正常波动 2 倍以上为高，1～2 倍为中，不到 1 倍为低。'
  };
  var pop = null;
  function closePop() { if (pop) { pop.remove(); pop = null; } Array.prototype.forEach.call(document.querySelectorAll('.gg-q.on'), function (b) { b.classList.remove('on'); b.textContent = '?'; }); }
  function showPop(btn) {
    ensureStyle(); closePop();
    var term = btn.getAttribute('data-term'), text = TERMS[term]; if (!text) return;
    pop = document.createElement('div'); pop.className = 'gg-pop'; pop.setAttribute('role', 'tooltip');
    pop.innerHTML = '<b>' + esc(term) + '</b>' + esc(text);
    document.body.appendChild(pop); btn.classList.add('on'); btn.textContent = '!';
    var r = btn.getBoundingClientRect(), w = pop.offsetWidth, h = pop.offsetHeight;
    var left = Math.min(Math.max(8, r.left + window.scrollX - 8), window.scrollX + document.documentElement.clientWidth - w - 8);
    var top = r.bottom + window.scrollY + 6;
    if (r.bottom + h + 12 > window.innerHeight && r.top - h - 6 > 0) top = r.top + window.scrollY - h - 6;
    pop.style.left = left + 'px'; pop.style.top = top + 'px';
  }
  function tip(term) { ensureStyle(); if (!TERMS[term]) return ''; return '<button type="button" class="gg-q" data-term="' + esc(term) + '" aria-label="什么是' + esc(term) + '">?</button>'; }
  var TIP_TERMS = ['平时的样子', '正常波动', '去水分', '保本线'];   // 收束后：小问号只给这 4 个核心词，其余解释在幕后页「术语表」
  function attach(root) {
    ensureStyle(); root = root || document.body;
    TIP_TERMS.forEach(function (term) {
      if (root.querySelector('.gg-q[data-term="' + term + '"]')) return;   // 已经有了
      var walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
        acceptNode: function (n) {
          var p = n.parentNode; if (!p || n.nodeValue.indexOf(term) < 0) return NodeFilter.FILTER_SKIP;
          var tag = p.tagName; if (/^(SCRIPT|STYLE|TEXTAREA|INPUT|BUTTON|OPTION|SELECT)$/.test(tag) || p.closest('.gg-q,.gq,.gp,.gcd,.gg-pop,[data-no-glossary]')) return NodeFilter.FILTER_SKIP;
          if (p.closest('h1,h2,h3,.gca-h,.gx-h')) return NodeFilter.FILTER_SKIP;   // 卡片大标题不加，交给正文第一次出现
          return NodeFilter.FILTER_ACCEPT;
        }
      });
      // 收束后：挂在第一个"不拆词"的位置——后面紧跟汉字、引号、括号、冒号的出现跳过，接着找下一处
      var node, k, from, end, nc;
      while ((node = walker.nextNode())) {
        from = 0;
        while ((k = node.nodeValue.indexOf(term, from)) >= 0) {
          end = k + term.length; nc = nextChar(node, end);
          if (!nc || !BAD_NEXT.test(nc)) {
            var after = node.splitText(end), span = document.createElement('span'); span.innerHTML = tip(term);
            after.parentNode.insertBefore(span.firstChild, after);
            return;
          }
          from = end;
        }
      }
    });
  }
  var BAD_NEXT = /[\u4E00-\u9FFF\u201c\u201d\u2018\u2019\u300c\u300d\u300e\u300f\uff08\uff09\uff1a"'(]/;
  function nextChar(node, idx) {
    var v = node.nodeValue; if (idx < v.length) return v.charAt(idx);
    var w = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, null); w.currentNode = node; var n;
    while ((n = w.nextNode())) { if (!n.nodeValue) continue; if (/^\s/.test(n.nodeValue)) return ' '; return n.nodeValue.charAt(0); }
    return '';
  }
  document.addEventListener('click', function (e) {
    var b = e.target.closest && e.target.closest('.gg-q');
    if (b) { e.preventDefault(); e.stopPropagation(); if (b.classList.contains('on')) closePop(); else showPop(b); return; }
    if (pop && !e.target.closest('.gg-pop')) closePop();
  }, true);
  document.addEventListener('mouseover', function (e) { var b = e.target.closest && e.target.closest('.gg-q'); if (b && !b.classList.contains('on')) showPop(b); });
  document.addEventListener('mouseout', function (e) { var b = e.target.closest && e.target.closest('.gg-q'); if (b && pop && !(e.relatedTarget && e.relatedTarget.closest && e.relatedTarget.closest('.gg-pop'))) closePop(); });
  window.addEventListener('scroll', function () { if (pop) closePop(); }, { passive: true });
  window.GuanchaoGlossary = { tip: tip, attach: attach, terms: TERMS };

  // ================= 2. 问观潮 =================
  var QUICK = {
    overview: ['这家店的种草到底赚不赚？', '投流为什么被高估了？', '下个月最该做哪件事？'],
    notes: ['哪篇笔记最值得复制？', '为什么有的笔记判成可能是巧合？', '站外成交占多少？'],
    invest: ['这篇现在该不该投？', '绿灯线是怎么定的？', '对照实验要做多久？'],
    budget: ['下个月预算怎么分？', '为什么投多了反而亏？', '内容该怎么配？'],
    ai: ['下个月预算怎么分？', '哪类内容最值得多写？', '投流到底值不值？'],
    manager: ['哪个客户最需要先拜访？', '怎么跟山野咖啡解释全域账？', '香薰小店该怎么调整？']
  };
  var askOpts = null, fab = null, panel = null, history = [];
  function mountAsk(o) {
    ensureStyle(); askOpts = o || {};
    if (fab) fab.remove();
    fab = document.createElement('button'); fab.className = 'gq-fab'; fab.setAttribute('aria-label', '问观潮');
    fab.innerHTML = '<span>问观潮</span><i>' + ic('sparkle', 24) + '</i>';
    fab.onclick = openAsk; document.body.appendChild(fab);
  }
  function openAsk() {
    if (panel) return;
    var ctx = (askOpts.getContext && askOpts.getContext()) || 'overview', qs = QUICK[ctx] || QUICK.overview;
    panel = document.createElement('div'); panel.className = 'gq-wrap';
    panel.innerHTML = '<div class="gq" role="dialog" aria-label="问观潮"><div class="gq-top"><b><i>' + ic('sparkle', 16) + '</i>问观潮</b><button class="gq-x" aria-label="关闭">' + ic('x', 16) + '</button></div>' +
      '<div class="gq-note">观潮的 AI 只引用算法算出的数字，不自己编数</div>' +
      '<div class="gq-quick">' + qs.map(function (q) { return '<button type="button">' + esc(q) + '</button>'; }).join('') + '</div>' +
      '<div class="gq-msgs"></div>' +
      '<form class="gq-in"><input type="text" placeholder="问问这本账…" aria-label="输入问题"><button type="submit" aria-label="发送">' + ic('send', 18) + '</button></form></div>';
    document.body.appendChild(panel);
    var msgs = panel.querySelector('.gq-msgs');
    function add(cls, html) { var d = document.createElement('div'); d.className = 'gq-m ' + cls; d.innerHTML = html; msgs.appendChild(d); msgs.scrollTop = msgs.scrollHeight; return d; }
    history.forEach(function (m) { add(m.cls, esc(m.text)); });
    if (!history.length) add('a', esc('你好，我是观潮。可以问我这家店的账：哪篇笔记真带货、投流值不值、下个月怎么花。'));
    function send(q) {
      q = String(q || '').trim(); if (!q) return;
      add('u', esc(q)); history.push({ cls: 'u', text: q });
      var d = add('a', '<span class="gq-dots"><i></i><i></i><i></i></span>');
      var t0 = Date.now();
      Promise.resolve().then(function () { return askOpts.ask ? askOpts.ask(q) : '（还没有接入回答能力）'; }).then(function (a) {
        var wait = Math.max(0, 600 - (Date.now() - t0));
        setTimeout(function () {
          a = String(a == null ? '' : a); history.push({ cls: 'a', text: a });
          var finalHtml = numCaps(esc(a));
          if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) { d.innerHTML = finalHtml; msgs.scrollTop = msgs.scrollHeight; return; }
          var i = 0, step = Math.max(1, Math.ceil(a.length / 90));
          (function tick() {
            if (!d.isConnected) return;
            i = Math.min(a.length, i + step); d.textContent = a.slice(0, i); msgs.scrollTop = msgs.scrollHeight;
            if (i < a.length) setTimeout(tick, 16); else { d.innerHTML = finalHtml; msgs.scrollTop = msgs.scrollHeight; }
          })();
        }, wait);
      }).catch(function () { d.textContent = '这个问题我暂时答不上来，换个问法试试？'; });
    }
    Array.prototype.forEach.call(panel.querySelectorAll('.gq-quick button'), function (b) { b.onclick = function () { send(b.textContent); }; });
    var form = panel.querySelector('form'), inp = form.querySelector('input');
    form.onsubmit = function (e) { e.preventDefault(); send(inp.value); inp.value = ''; };
    panel.querySelector('.gq-x').onclick = closeAsk;
    panel.addEventListener('click', function (e) { if (e.target === panel) closeAsk(); });
    setTimeout(function () { inp.focus(); }, 50);
  }
  // 回答里的数字（含 ¥、%、万、元/个/篇/单 前的数）包成红色小胶囊；只改样式，不改文字
  function numCaps(html) { return String(html).replace(/(¥?[+\-−]?\d[\d,]*(?:\.\d+)?(?:\s?万)?%?)/g, '<b class="gq-num">$1</b>'); }
  function closeAsk() { if (panel) { panel.remove(); panel = null; } }
  function resetAsk() { history = []; closeAsk(); }
  window.GuanchaoAsk = { mount: mountAsk, open: openAsk, close: closeAsk, reset: resetAsk };

  // ================= 3. 独立页 =================
  var page = null;
  function openPage(title, bodyHtml, onBack) {
    ensureStyle(); closePage();
    page = document.createElement('div'); page.className = 'gp'; page.setAttribute('role', 'dialog'); page.setAttribute('aria-label', title);
    page.innerHTML = '<div class="gp-top"><button class="gp-back">' + ic('back', 16) + '返回</button><span style="font-weight:700;display:flex;align-items:center;gap:6px">' + ic('wave', 16) + '观潮</span></div><div class="gp-wrap">' + bodyHtml + '</div>';
    document.body.appendChild(page);
    page.querySelector('.gp-back').onclick = function () { closePage(); if (onBack) onBack(); };
  }
  function closePage() { if (page) { page.remove(); page = null; } }

  var BEHIND_CSS = '.gb{display:grid;grid-template-columns:200px minmax(0,1fr);gap:28px;max-width:1080px;margin:4px auto 64px;padding:0 16px}.gb-toc{position:sticky;top:64px;align-self:start;display:flex;flex-direction:column;gap:2px}.gb-toc a{display:block;padding:7px 12px;border-radius:10px;color:#5D5D68;text-decoration:none;font-size:14px;line-height:1.4;cursor:pointer}.gb-toc a:hover{background:#EFECE8;color:#17171C}.gb-toc a.on{background:#FFEEF0;color:#FF2442;font-weight:700}.gb-main{min-width:0}.gb-sec{scroll-margin-top:72px;margin-bottom:28px}.gb-sec>h2{font-size:20px;font-weight:800;margin:0 0 12px;display:flex;align-items:center;gap:8px}.gb-num{display:inline-flex;width:26px;height:26px;border-radius:50%;background:#FF2442;color:#fff;font-size:13px;align-items:center;justify-content:center;flex:none}.gb-box{background:#fff;border-radius:20px;box-shadow:0 1px 2px rgba(23,23,28,.04),0 8px 24px rgba(23,23,28,.06);padding:18px 20px}.gb-tl{position:relative;padding-left:22px}.gb-tl:before{content:"";position:absolute;left:6px;top:6px;bottom:6px;width:2px;background:#E8E4DF}.gb-ti{position:relative;margin:0 0 14px}.gb-ti:before{content:"";position:absolute;left:-21px;top:6px;width:12px;height:12px;border-radius:50%;background:#CFC9C2;border:2px solid #fff}.gb-ti.gap:before{background:#F2B33D}.gb-ti.me:before{background:#FF2442}.gb-ti b{display:block}.gb-ti p{margin:2px 0 0;font-size:14px;color:#2B2B33}.gb-foot{font-size:12px;color:#9A9AA4;margin-top:6px}.gb-gl{display:grid;gap:10px}.gb-gl div{background:#FAF9F7;border-radius:12px;padding:10px 14px;font-size:14px}.gb-gl b{display:block;margin-bottom:2px}.gb-p{margin:6px 0;font-size:15px}.gb-h3{font-size:16px;font-weight:700;margin:14px 0 4px}@media (max-width:640px){.gb .gp-grid{grid-template-columns:minmax(0,1fr)}}@media (max-width:760px){.gb{grid-template-columns:minmax(0,1fr);gap:12px}.gb-toc{min-width:0;max-width:100vw;position:sticky;top:56px;z-index:2;flex-direction:row;overflow-x:auto;background:rgba(246,244,241,.96);padding:6px 0;margin:0 -16px;padding-left:16px;-webkit-overflow-scrolling:touch}.gb-toc a{white-space:nowrap;flex:none}.gb-sec{scroll-margin-top:110px}.gb-box{padding:16px}}';

  var WHY_ITEMS = [
    ['', '2022｜小红星（与阿里妈妈合作）', '统计达人种草给淘宝店铺带来的访客，第一次尝试把站外效果算回来'],
    ['', '2023｜种草值 TrueInterest · 小红盟（与京东合作）', '种草值用长时间阅读、搜索商品词等 11 类深度行为衡量种草；小红盟把京东的站外成交数据回传，所有类目按 50% 抽样'],
    ['', '2025｜种草直达（红猫、红京、红美计划）', '广告笔记可以挂链接跳到淘宝、京东等平台成交，订单回传；据报道，双 11 使用的商家数比 618 增长 109%'],
    ['', '2025 年 12 月｜WILL 商业大会', '种草进入"效果化"时代，灵犀全量开放，提出"人群资产、内容效率、转化效果"三维度量'],
    ['gap', '还缺的一块｜中小商家仍然算不清的账', '据 2025 年报道，种草直达只支持广告笔记跳转，普通笔记带去站外的生意追踪不到；投流期间的增长里有多少本来就会来，需要剔除干扰；中小商家需要零门槛、用自己的数据就能用的工具'],
    ['me', '观潮｜给中小商家的轻量补充', '用商家自己的站内、站外每日数据，估算每篇普通笔记的全域增量，并给投流去水分；算得清，商家才敢持续种草，品牌与平台双赢']
  ];

  function visionCardsHtml(S) {
    var LE = E();
    var r = LE.compute(S.study), inc = r0(r.summary.totalInc), out = r0(r.summary.outShare * 100), M = S.study.metric;
    var boost = LE.actionPack(r, S.study).items.filter(function (i) { return i.kind === 'boost'; })[0];
    var st = LE.story(S), kol = st.merchant.kol, clients = st.manager.clients;
    var tag = function (x) { return x === 'risk' ? '<span class="wf-y">有砍预算风险</span>' : x === 'loss' ? '<span class="wf-r">投流没回本</span>' : '<span class="wf-g">可以加预算</span>'; };
    var cards = [
      { t: '千帆商家后台 · 种草账本', p: '商家后台多一个栏目，每周自动出全域账和行动包；接入店铺订单和站外回传后，不用再手动导入。',
        m: '<div class="wf"><div class="wf-win"><div class="wf-bar"><i></i><i></i><i></i></div><div style="display:flex"><div class="wf-side"><span></span><span></span><span class="on">种草账本</span><span></span><span></span></div><div class="wf-main"><div class="wf-hero"><small>种草一共多带来</small><b>' + inc + ' 个' + esc(M) + '</b><small>站外成交占 ' + out + '%</small></div><div class="wf-line" style="width:70%"></div><div class="wf-line" style="width:90%"></div><div class="wf-line" style="width:55%"></div></div></div></div></div>' },
      { t: '聚光 · 投流前红绿灯', p: '点"推广"之前，先看这篇笔记的红绿灯和建议预算：绿灯才投，减少给没跑起来的笔记花冤枉钱。',
        m: '<div class="wf"><div class="wf-win" style="padding:10px"><div class="wf-line" style="width:60%;height:9px;background:#CFC9C2"></div><div class="wf-line" style="width:95%"></div><div class="wf-line" style="width:80%"></div><div style="margin-top:10px"><div class="wf-tip">红绿灯：绿灯 · 建议投 ' + (boost ? money(boost.data.spend) : '—') + '</div><span class="wf-btn">推广</span></div></div></div>' },
      { t: '蒲公英 · 回本报价参考', p: '在达人报价旁边显示"按本店历史，回本报价约 ¥X"，品牌和达人都有据可谈。',
        m: '<div class="wf"><div class="wf-win"><div class="wf-row"><div class="wf-av"></div><div style="flex:1"><div style="font-weight:700;color:#17171C;font-size:12px">' + esc(kol.name) + '</div><div class="wf-line" style="width:60%;margin:4px 0 0"></div></div><div style="text-align:right"><div style="font-weight:700;color:#17171C;font-size:13px">报价 ' + money(kol.cost) + '</div><div style="color:#0F7A45">回本报价约 ' + money(kol.breakEven) + '</div></div></div></div></div>' },
      { t: '客户经理工作台', p: '按"最需要沟通"排序的客户看板，一键生成拜访要点和双赢测算，让客户算清账、留下来。',
        m: '<div class="wf"><div class="wf-win">' + clients.map(function (c) { return '<div class="wf-row"><span style="font-weight:700;color:#17171C;font-size:12px">' + esc(c.name) + '</span>' + tag(c.status) + '</div>'; }).join('') + '</div></div>' }
    ];
    return '<p class="gp-sub" style="margin-top:0">概念示意，非小红书官方界面</p>' +
      '<div class="gp-grid">' + cards.map(function (c, i) { return '<div class="gp-card"><div class="gp-mock">' + c.m + '</div><div class="gp-body"><b>' + (i + 1) + '. ' + esc(c.t) + '</b><p>' + esc(c.p) + '</p></div></div>'; }).join('') + '</div>' +
      '<div class="gp-sec"><h3>为什么对平台也是好事</h3><p>算得清，商家才敢持续种草：投放更稳，平台的商业化收入也更可持续。这就是品牌与平台的双赢。</p></div>' +
      '<div class="gp-sec"><h3>落地三步（设想）</h3><ol><li>先作为独立工具给中小商家试用：导入数据即可用</li><li>接入店铺订单和站外回传，账本自动更新</li><li>与平台现有的种草度量工具互补，覆盖普通笔记和中小商家</li></ol></div>';
  }

  // GuanchaoPages.openBehind({ samples, whyHtml, howHtml, section, onBack })
  //   whyHtml / howHtml：可选，传入总览原来那两张卡片渲染出的 HTML，原样放进 ① ③；不传则用模块内置的同款内容
  //   section：打开后直接跳到哪一节：'why' | 'vision' | 'how' | 'test' | 'data' | 'glossary' | 'built'
  function openBehind(o) {
    o = o || {}; var S = o.samples || window.SAMPLES;
    if (!document.getElementById('gb-style')) { var st = document.createElement('style'); st.id = 'gb-style'; st.textContent = BEHIND_CSS; document.head.appendChild(st); }
    var P = function (lines) { return lines.map(function (l) { return '<p class="gb-p">' + esc(l) + '</p>'; }).join(''); };
    var whyHtml = o.whyHtml || ('<div class="gb-tl">' + WHY_ITEMS.map(function (x) { return '<div class="gb-ti ' + x[0] + '"><b>' + esc(x[1]) + '</b><p>' + esc(x[2]) + '</p></div>'; }).join('') + '</div><div class="gb-foot">以上信息整理自界面新闻、数英、经济观察网、第一财经等公开报道，具体规则以小红书官方为准。</div>');
    var howHtml = o.howHtml || P(['看潮水：先知道平时的潮位怎么涨落，才分得清哪一波是笔记掀起来的。', '① 先找"平时的样子"：挑出前后没发笔记、没投流的日子，考虑周末规律和长期走势，站内站外分开算再加总。', '② 量出"正常波动"有多大。', '③ 笔记发出后 7 天的实际成交减去平时，就是多带来的量（下一篇提前发了就截短，避免重复算）。', '④ 超出正常波动（约 95% 把握）才算"真有效"。', '⑤ 投流去水分：用本店没投流的笔记，算出流量一天天变少的规律，推算"不投流本来会来多少"再扣掉。']);
    var secs = [
      ['why', '为什么需要观潮', whyHtml],
      ['vision', '落地设想', visionCardsHtml(S)],
      ['how', '这些数是怎么算出来的', howHtml],
      ['test', '怎么检验的、局限与处理',
        '<div class="gb-h3">检验结果（如实）</div>' + P(['没有效果的笔记被误判成"真有效"的比例约 7%（设计目标 5%）。', '真实效果明显的笔记，约 9 成能被识别出来。', '投流贡献的估计略偏保守，宁可少算，不多算。']) +
        '<div class="gb-h3">局限与处理</div>' + P(['这些数是估算，不是实验结论——所以我们这样处理：', '1. 每个结论都标"估算级"；按产品里的对照实验方案投一轮，导入后自动升级为"实验级"。', '2. 发布当天就投流的笔记分不开，我们给区间而不是拒绝回答。', '3. 站外数据由商家导出，导入时自动体检：缺天、重复、连续为零、异常尖峰都会提示。', '4. 7 天观察期、长期趋势、星期规律都是假设，所以每个结论都换 3 种假设重算，不变的才标"稳健"。算法用数据实测的波动，不假设任何分布；在比泊松更乱的噪声下，误判率仍在 9% 以内。', '5. 大促和节假日可以标记并剔除。', '6. 客单价和毛利率由商家输入，可以随时在"调整假设"里改，结论实时重算，并提示哪些结论对假设敏感。'])],
      ['data', '数据从哪来', '<div data-gb-ds></div>'],
      ['glossary', '术语表', '<div class="gb-gl">' + Object.keys(TERMS).filter(function (k) { return k !== '可能是巧合'; }).map(function (k) { return '<div><b>' + esc(k === '真有效' ? '真有效 / 可能是巧合' : k) + '</b>' + esc(TERMS[k]) + '</div>'; }).join('') + '</div>'],
      ['built', '48 小时怎么做的',
        '<div class="gb-h3">问题从哪来</div>' + P(['做留学服务创业时，靠内容获客，却说不清哪篇内容、哪个渠道带来了客户，推广费花得值不值。', '在内容平台做运营时，见过流量扶持给了本来就在涨的内容，数据好看，却分不清多少是扶持带来的。', '做量化研究时养成的习惯：先确定"正常波动"，再判断信号真假，并用模拟数据检验方法本身。']) +
        '<div class="gb-h3">怎么做的</div>' + P(['算法的逻辑由我设计，代码借助 AI 工具完成并反复检验：用"平时的样子 + 正常波动"判断每篇笔记的增量，用"不投流本来会来多少"给投流去水分，站内站外一起算。', '检验在本地做：用 300 组已知答案的模拟数据反复跑，修掉了三处会让结果偏高或偏低的问题。', '界面在 REDcowork 上搭：先画设计稿，再把算法文件和示例数据原样交给平台，分多轮描述需求，逐轮验收。', '分工：数字一律由算法算，AI 负责解读、起草和办事，人做最后的决定。']) +
        '<div class="gb-h3">下一步</div>' + P(['接入店铺订单和站外回传，账本自动更新；与平台现有的种草度量工具互补，覆盖普通笔记和中小商家。'])]
    ];
    var nums = ['①', '②', '③', '④', '⑤', '⑥', '⑦'];
    var html = '<h1 class="gp-h1">幕后</h1><p class="gp-sub">算法算对 · AI 办事 · 人做决定</p>' +
      '<div class="gb" style="margin:0;padding:0;max-width:none"><nav class="gb-toc" aria-label="幕后目录">' + secs.map(function (x, k) { return '<a data-go="' + x[0] + '">' + nums[k] + ' ' + esc(x[1]) + '</a>'; }).join('') + '</nav>' +
      '<div class="gb-main">' + secs.map(function (x, k) { return '<section class="gb-sec" id="gb-' + x[0] + '"><h2><span class="gb-num">' + (k + 1) + '</span>' + esc(x[1]) + '</h2><div class="gb-box">' + x[2] + '</div></section>'; }).join('') + '</div></div>';
    openPage('幕后', html, o.onBack);
    page.querySelector('.gp-wrap').style.maxWidth = '1080px';
    renderDataSource(page.querySelector('[data-gb-ds]'), { extraNote: o.dataNote || '' });
    var links = Array.prototype.slice.call(page.querySelectorAll('.gb-toc a'));
    var pinned = null, OFF = function () { return window.innerWidth <= 760 ? 108 : 70; };
    var go = function (id, instant) { pinned = id; setOn(id); var el = page.querySelector('#gb-' + id); if (!el) return; var y = el.getBoundingClientRect().top - page.getBoundingClientRect().top + page.scrollTop - OFF(); if (instant || !('scrollBehavior' in document.documentElement.style)) page.scrollTop = y; else page.scrollTo({ top: y, behavior: 'smooth' }); };
    links.forEach(function (a) { a.onclick = function () { go(a.getAttribute('data-go')); }; });
    var tocEl = page.querySelector('.gb-toc'), tocMark = document.createElement('i'); tocMark.className = 'gb-mark'; tocMark.setAttribute('aria-hidden', 'true'); if (tocEl) tocEl.appendChild(tocMark);
    function moveMark(a) { if (!a || !tocEl) return; var m = tocMark.style; if (window.innerWidth <= 760) { m.top = (a.offsetTop + a.offsetHeight - 3) + 'px'; m.left = a.offsetLeft + 'px'; m.width = a.offsetWidth + 'px'; m.height = '3px'; } else { m.left = '0px'; m.width = '3px'; m.top = a.offsetTop + 'px'; m.height = a.offsetHeight + 'px'; } }
    function setOn(id) { links.forEach(function (a) { if (a.getAttribute('data-go') === id) moveMark(a); });
      links.forEach(function (a) { var on = a.getAttribute('data-go') === id; a.classList.toggle('on', on); if (on && a.scrollIntoView && window.innerWidth <= 760) { var t = a.parentNode; t.scrollLeft = a.offsetLeft - 16; } }); }
    var mark = function () {
      var atBottom = page.scrollTop + page.clientHeight >= page.scrollHeight - 4;
      if (pinned && atBottom) { setOn(pinned); return; }
      var cur = secs[0][0], pr = page.getBoundingClientRect().top;
      secs.forEach(function (x) { var el = page.querySelector('#gb-' + x[0]); if (el && el.getBoundingClientRect().top - pr <= OFF() + 24) cur = x[0]; });
      setOn(cur);
    };
    page.addEventListener('wheel', function () { pinned = null; }, { passive: true });
    page.addEventListener('touchmove', function () { pinned = null; }, { passive: true });
    page.addEventListener('scroll', mark, { passive: true }); mark();
    if (o.section) { go(o.section, true); mark(); }
  }
  // 兼容旧入口：「落地设想」现在是幕后页的第 ② 节
  function openVision(o) { o = o || {}; o.section = 'vision'; openBehind(o); }

  // ================= 4. 「数据从哪来」说明卡 + 导入模板 =================
  var DS_CSS = '.gd-card{background:#fff;border-radius:20px;box-shadow:0 1px 2px rgba(23,23,28,.04),0 8px 24px rgba(23,23,28,.06);padding:20px;color:#17171C;font-size:15px;line-height:1.65}.gd-card *{box-sizing:border-box}.gd-h{font-size:19px;font-weight:800;margin:0}.gd-sub{font-size:13px;color:#5D5D68;margin-top:2px}.gd-cols{display:grid;grid-template-columns:repeat(3,1fr);gap:12px;margin-top:14px}.gd-col{background:#FAF9F7;border-radius:14px;padding:12px 14px;font-size:14px}.gd-col b{display:block;margin-bottom:4px;font-size:15px}.gd-req{margin-top:12px;font-size:13px;color:#5D5D68}.gd-btns{display:flex;gap:8px;flex-wrap:wrap;margin-top:12px}.gd-btn{font:inherit;font-size:14px;font-weight:600;border-radius:12px;padding:8px 14px;cursor:pointer;border:1.5px solid #E2DDD7;background:#fff;color:#17171C}.gd-btn:hover{border-color:#CFC9C2}@media (max-width:640px){.gd-card{padding:16px}.gd-cols{grid-template-columns:1fr}}';
  function downloadCSV(name, rows) {
    var csv = '﻿' + rows.map(function (r) { return r.join(','); }).join('\r\n');
    var blob = new Blob([csv], { type: 'text/csv;charset=utf-8' }), url = URL.createObjectURL(blob);
    var a = document.createElement('a'); a.href = url; a.download = name; document.body.appendChild(a); a.click();
    setTimeout(function () { a.remove(); URL.revokeObjectURL(url); }, 300);
  }
  var TEMPLATE_DAILY = [['日期', '站内数量', '站外数量'], ['2026-05-01', '10', '12'], ['2026-05-02', '13', '11'], ['2026-05-03', '9', '14']];
  var TEMPLATE_NOTES = [['发布日期', '标题', '类型(可空)', '投流开始日期(可空)', '投流花费(可空)', '达人名称(可空)', '达人报价(可空)'], ['2026-05-29', '出租屋氛围感改造', '场景种草', '', '', '', ''], ['2026-06-06', '5款平价香薰实测', '测评对比', '2026-06-08', '1500', '', '']];
  function renderDataSource(el, o) {
    ensureStyle(); o = o || {};
    if (!document.getElementById('gd-style')) { var st = document.createElement('style'); st.id = 'gd-style'; st.textContent = DS_CSS; document.head.appendChild(st); }
    el.innerHTML = '<div class="gd-card"><h3 class="gd-h">数据从哪来：三步准备，十分钟搞定</h3><div class="gd-sub">这些数据商家后台都能导出，不需要技术</div>' +
      '<div class="gd-cols"><div class="gd-col"><b>① 站内成交或咨询</b>电商：从千帆商家后台导出按天的订单数。服务类：从小红书私信或企业号后台统计每天的咨询数，也可以手工记录。</div>' +
      '<div class="gd-col"><b>② 站外成交（没有可不填）</b>淘宝、天猫：从生意参谋导出按天的支付订单数。公众号或官网：导出每天的新增关注或咨询数。</div>' +
      '<div class="gd-col"><b>③ 笔记、投流与达人</b>笔记：创作者中心的笔记列表里有发布日期和标题。投流：聚光或薯条的投放记录里有开始日期和花费。达人合作：记下合作笔记、报价和发布日期。</div></div>' +
      '<div class="gd-req">至少 45 天的每日数据、5 篇以上笔记；投流和达人记录可选。账本在浏览器本地计算，不会上传你的原始数据。' + (o.extraNote ? ' ' + esc(o.extraNote) : '') + '</div>' +
      '<div class="gd-btns"><button class="gd-btn" data-dl="daily">下载每日数据模板</button><button class="gd-btn" data-dl="notes">下载笔记记录模板</button></div></div>';
    el.querySelector('[data-dl="daily"]').onclick = function () { downloadCSV('每日数据模板.csv', TEMPLATE_DAILY); };
    el.querySelector('[data-dl="notes"]').onclick = function () { downloadCSV('笔记记录模板.csv', TEMPLATE_NOTES); };
  }
  window.GuanchaoPages = { openVision: openVision, openBehind: openBehind, close: closePage, renderDataSource: renderDataSource, templates: { daily: TEMPLATE_DAILY, notes: TEMPLATE_NOTES } };
})();
