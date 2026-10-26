// 观潮 · 种草侦探（开场闯关模块）
// 用法：GuanchaoDetective.open({ story: LedgerEngine.story(SAMPLES), onExit: function (action) { ... } })
// 所有数字都取自 story；本文件不含任何写死的业务数字。
// onExit 收到的 action：
//   { type: 'skip' }                      点了「跳过，直接看账本」
//   { type: 'actionpack', shop: 'shop' }  老板成绩单「看观潮为你准备的行动包」
//   { type: 'ledger', shop: 'shop' }      老板成绩单「进入完整账本」
//   { type: 'tour', shop: 'shop' }        老板成绩单「带我 3 分钟看完观潮」：先进账本，再开始导览
//   { type: 'proposal', client: 'coffee' } 客户经理成绩单「一键生成…拜访要点」
//   { type: 'board' }                     客户经理成绩单「进入客户看板」
(function () {
  var SEEN_KEY = 'guanchao_detective_seen_v1';
  var root = null, stage = null, opts = null, hits = [], timers = [];

  // ---------- 工具 ----------
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function r0(v) { var x = Math.round(v); return x === 0 ? 0 : x; }
  function money(v) { return '¥' + r0(v).toLocaleString('en-US'); }
  function f2(v) { return (Math.round(v * 100) / 100).toFixed(2); }
  function sg(v) { var x = r0(v); return (x > 0 ? '+' : '') + x; }
  function pct(v) { return r0(v * 100) + '%'; }
  function later(fn, ms) { timers.push(setTimeout(fn, ms)); }
  function clearTimers() { timers.forEach(clearTimeout); timers = []; }
  function $(sel) { return stage.querySelector(sel); }
  function $$(sel) { return Array.prototype.slice.call(stage.querySelectorAll(sel)); }

  var IC = {
    wave: '<path d="M3 15c2 0 2-2 4.5-2S10 15 12 15s2-2 4.5-2S19 15 21 15"/><path d="M3 10c2 0 2-2 4.5-2S10 10 12 10s2-2 4.5-2S19 10 21 10"/>',
    search: '<circle cx="10.5" cy="10.5" r="6.5"/><path d="M20 20l-4.8-4.8"/>',
    store: '<path d="M3.5 9.5L5 4h14l1.5 5.5"/><path d="M3.5 9.5a2.8 2.8 0 0 0 5.6 0 2.8 2.8 0 0 0 5.8 0 2.8 2.8 0 0 0 5.6 0"/><path d="M5 12v8h14v-8"/><path d="M10 20v-5h4v5"/>',
    users: '<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20v-1.5A4.5 4.5 0 0 1 7 14h4a4.5 4.5 0 0 1 4.5 4.5V20"/><path d="M16 4.6a3.5 3.5 0 0 1 0 6.8"/><path d="M21.5 20v-1.5a4.5 4.5 0 0 0-3.2-4.3"/>',
    check: '<path d="M5 12.5l4.5 4.5L19 7.5"/>',
    arrow: '<path d="M5 12h14"/><path d="M13 6l6 6-6 6"/>',
    bulb: '<path d="M9 18h6"/><path d="M10 21.5h4"/><path d="M12 2.5a6.5 6.5 0 0 0-3.8 11.8c.5.4.8 1 .8 1.6V16h6v-.1c0-.6.3-1.2.8-1.6A6.5 6.5 0 0 0 12 2.5z"/>',
    party: '<path d="M4 20.5l3.6-10.3 6.7 6.7z"/><path d="M14.5 3.5v2"/><path d="M19.5 5.5L18 7"/><path d="M21 10.5h-2"/><path d="M12 8.5c.8-1.6 2.6-2.3 4-1.6"/><path d="M15.5 12c1.6-.8 3.4-.4 4.2.9"/>',
    rocket: '<path d="M5 15c-1.3 1.3-1.5 4.5-1.5 4.5s3.2-.2 4.5-1.5"/><path d="M14.5 4.5c2.6-.9 5-.9 5-.9s0 2.4-.9 5L13 14.2 9.8 11z"/><path d="M9.8 11L7 10.4l2.2-2.8 3.3.2"/><path d="M13 14.2l.6 2.8 2.8-2.2-.2-3.3"/>',
    layout: '<rect x="3.5" y="3.5" width="7" height="7" rx="1.5"/><rect x="13.5" y="3.5" width="7" height="7" rx="1.5"/><rect x="3.5" y="13.5" width="7" height="7" rx="1.5"/><rect x="13.5" y="13.5" width="7" height="7" rx="1.5"/>',
    file: '<path d="M14 3.5H7.5a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2h9a2 2 0 0 0 2-2V8z"/><path d="M14 3.5V8h4.5"/><path d="M9 13h6"/><path d="M9 16.5h4"/>',
    refresh: '<path d="M19.5 12a7.5 7.5 0 1 1-2.2-5.3"/><path d="M19.5 4.5v4h-4"/>'
  };
  function ic(name, size) {
    var s = size || 18;
    return '<' + 'svg class="gcd-ic" width="' + s + '" height="' + s + '" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + IC[name] + '</svg>';
  }

  // ---------- 样式 ----------
  var CSS = [
    '.gcd{position:fixed;inset:0;z-index:9000;background:#F6F4F1;overflow-y:auto;-webkit-overflow-scrolling:touch;color:#17171C;font:15px/1.7 -apple-system,BlinkMacSystemFont,"PingFang SC","Microsoft YaHei",sans-serif}',
    '.gcd *{box-sizing:border-box}',
    '.gcd-ic{display:inline-block;vertical-align:-3px;flex:none}',
    '.gcd-top{position:sticky;top:0;z-index:2;display:flex;align-items:center;justify-content:space-between;gap:12px;padding:12px 16px;background:rgba(246,244,241,.92);backdrop-filter:blur(8px);-webkit-backdrop-filter:blur(8px)}',
    '.gcd-brand{display:flex;align-items:center;gap:8px;font-weight:700;font-size:15px}',
    '.gcd-logo{width:30px;height:30px;border-radius:9px;background:linear-gradient(135deg,#FF2442,#FF7A59);color:#fff;display:flex;align-items:center;justify-content:center}',
    '.gcd-skip{border:0;background:none;color:#5D5D68;font:inherit;font-size:14px;cursor:pointer;padding:6px 4px;display:flex;align-items:center;gap:4px;white-space:nowrap}',
    '.gcd-skip:hover{color:#17171C}',
    '.gcd-wrap{max-width:720px;margin:4px auto 40px;padding:0 16px}',
    '.gcd-card{background:#fff;border-radius:20px;box-shadow:0 1px 2px rgba(23,23,28,.04),0 8px 24px rgba(23,23,28,.06);padding:22px 22px 24px}',
    '.gcd-in{animation:gcdIn .35s ease both}',
    '@keyframes gcdIn{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:none}}',
    '.gcd-eyebrow{font-size:13px;color:#5D5D68;display:flex;align-items:center;gap:8px;flex-wrap:wrap}',
    '.gcd-h1{font-size:24px;line-height:1.35;font-weight:800;margin:10px 0 6px;letter-spacing:.2px}',
    '.gcd-h2{font-size:19px;line-height:1.45;font-weight:700;margin:10px 0 6px}',
    '.gcd-p{margin:0 0 12px;color:#2B2B33}',
    '.gcd-sub{color:#5D5D68;font-size:14px;margin:0 0 14px}',
    '.gcd-muted{color:#9A9AA4;font-size:12px}',
    '.gcd-small{font-size:13px;color:#5D5D68}',
    '.gcd-num{font-variant-numeric:tabular-nums}',
    '.gcd-prog{display:flex;gap:6px;margin-bottom:14px}.gcd-prog i{flex:1;height:5px;border-radius:3px;background:#EFECE8}.gcd-prog i.on{background:#FF2442}',
    '.gcd-pill{display:inline-flex;align-items:center;gap:4px;background:#FFF4DB;color:#946500;border-radius:999px;padding:1px 10px;font-size:13px;font-weight:600}',
    '.gcd-ids{display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-top:18px}',
    '.gcd-id{all:unset;box-sizing:border-box;cursor:pointer;border:1.5px solid #ECE8E3;border-radius:16px;padding:16px;display:flex;flex-direction:column;gap:8px;transition:border-color .2s,transform .2s,box-shadow .2s;background:#fff}',
    '.gcd-id:hover,.gcd-id:focus-visible{border-color:#FF8A9A;transform:translateY(-2px);box-shadow:0 8px 20px rgba(255,36,66,.10)}',
    '.gcd-id-ic{width:40px;height:40px;border-radius:12px;display:flex;align-items:center;justify-content:center;background:#FFEEF0;color:#FF2442}',
    '.gcd-id-ic.blue{background:#EEF2FF;color:#4C6FFF}',
    '.gcd-id b{font-size:17px}',
    '.gcd-id span{font-size:14px;color:#5D5D68;line-height:1.6}',
    '.gcd-id em{font-style:normal;font-size:13px;color:#FF2442;display:flex;align-items:center;gap:4px;margin-top:2px}',
    '.gcd-foot{margin-top:18px;text-align:center}',
    '.gcd-btns{display:flex;gap:10px;flex-wrap:wrap;margin-top:16px}',
    '.gcd-btn{font:inherit;font-size:15px;font-weight:600;border-radius:12px;padding:10px 16px;cursor:pointer;display:inline-flex;align-items:center;gap:6px;border:1.5px solid #E2DDD7;background:#fff;color:#17171C}',
    '.gcd-btn:hover{border-color:#CFC9C2}',
    '.gcd-btn.pri{background:#FF2442;border-color:#FF2442;color:#fff}',
    '.gcd-btn.pri:hover{background:#E81E3A}',
    '.gcd-chart{width:100%;margin:6px 0 4px}',
    '.gcd-chart text{font-size:12px;fill:#8A8A94}',
    '.gcd-slider{display:flex;align-items:center;gap:14px;margin-top:6px}',
    '.gcd-slider input{flex:1;accent-color:#FF2442;height:28px}',
    '.gcd-slider b{font-size:22px;min-width:96px;text-align:right;font-variant-numeric:tabular-nums}',
    '.gcd-fb{border-radius:12px;padding:10px 14px;font-weight:600;margin:10px 0 4px;font-size:15px}',
    '.gcd-fb.good{background:#E6F6EE;color:#0F7A45}',
    '.gcd-fb.warm{background:#FFF4DB;color:#946500}',
    '.gcd-box{border-radius:14px;padding:12px 14px;margin-top:12px;font-size:14px}',
    '.gcd-box.red{background:#FFEEF0;color:#C8102E;font-weight:600}',
    '.gcd-box.green{background:#E6F6EE;color:#0F7A45}',
    '.gcd-calc{padding:18px 0 6px}',
    '.gcd-calc-t{font-weight:700;font-size:17px;display:flex;align-items:center;gap:8px}',
    '.gcd-calc-t i{width:8px;height:8px;border-radius:50%;background:#FF2442;animation:gcdPulse 1s ease-in-out infinite}',
    '@keyframes gcdPulse{50%{opacity:.25}}',
    '.gcd-calc-l{margin-top:12px;display:grid;gap:8px}',
    '.gcd-calc-l div{display:flex;align-items:center;gap:8px;color:#2B2B33;animation:gcdIn .3s ease both}',
    '.gcd-calc-l .gcd-ic{color:#16A05D}',
    '.gcd-picks{display:grid;grid-template-columns:repeat(auto-fit,minmax(240px,1fr));gap:10px;margin-top:6px}',
    '.gcd-pick{all:unset;box-sizing:border-box;cursor:pointer;border:1.5px solid #ECE8E3;border-radius:14px;padding:12px 14px;background:#fff;transition:border-color .2s,background .2s}',
    '.gcd-pick:hover,.gcd-pick:focus-visible{border-color:#FF8A9A;background:#FFFAFA}',
    '.gcd-pick .t{font-weight:600;line-height:1.5}',
    '.gcd-pick .s{font-size:13px;color:#5D5D68;margin-top:4px}',
    '.gcd-row{display:flex;justify-content:space-between;align-items:baseline;gap:4px 10px;flex-wrap:wrap}',
    '.gcd-tile{border:1.5px solid #ECE8E3;border-radius:14px;padding:12px 14px}',
    '.gcd-tile.ok{border-color:#16A05D;background:#FAFFFC}',
    '.gcd-tiles{display:grid;gap:10px;margin-top:12px}',
    '.gcd-bar{height:8px;border-radius:4px;background:#F1EEEA;overflow:hidden;margin:8px 0 4px}',
    '.gcd-bar b{display:block;height:100%;width:0;border-radius:4px;transition:width .9s cubic-bezier(.2,.8,.2,1)}',
    '.gcd-trap{font-size:13px;color:#946500;margin-top:4px}',
    '.gcd-green{color:#0F7A45}.gcd-red{color:#C8102E}',
    '.gcd-check{display:flex;gap:10px;align-items:flex-start;cursor:pointer;border:1.5px solid #ECE8E3;border-radius:12px;padding:10px 12px;font-size:15px}',
    '.gcd-check input{margin-top:5px;accent-color:#FF2442;width:16px;height:16px;flex:none}',
    '.gcd-err{font-size:13px;color:#C8102E;min-height:20px;margin-top:6px}',
    '.gcd-item{display:flex;gap:10px;align-items:flex-start;padding:10px 12px;border-radius:12px;background:#FAF9F7}',
    '.gcd-item .gcd-ic{margin-top:3px}',
    '.gcd-tag{display:inline-block;font-size:12px;color:#5D5D68;background:#EFECE8;border-radius:999px;padding:0 8px;margin-left:6px;font-weight:500}',
    '.gcd-truths{display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin-top:14px}',
    '.gcd-truth{border-radius:14px;background:#FAF9F7;padding:12px 14px}',
    '.gcd-truth .k{font-size:12px;color:#5D5D68}',
    '.gcd-truth .v{font-weight:700;font-size:16px;margin:2px 0}',
    '.gcd-truth .n{font-size:13px;color:#5D5D68}',
    '.gcd-plan{border-radius:14px;border:1.5px solid #ECE8E3;padding:12px 16px;margin-top:12px}',
    '.gcd-plan .h{font-weight:700;margin-bottom:4px}',
    '.gcd-plan div{font-size:14px;line-height:1.9}',
    '.gcd-title-ic{color:#FF2442;margin-right:4px;vertical-align:-4px}',
    '@media (max-width:600px){.gcd-card{padding:18px 16px 20px}.gcd-h1{font-size:21px}.gcd-h2{font-size:17px}.gcd-ids{grid-template-columns:1fr}.gcd-truths{grid-template-columns:1fr}.gcd-slider b{font-size:19px;min-width:80px}.gcd-btn{flex:1 1 auto;justify-content:center}.gcd-skip{font-size:13px}}',
    'body.gcd-open{overflow:hidden}'
  ].join('\n');

  function ensureStyle() {
    if (document.getElementById('gcd-style')) return;
    var st = document.createElement('style'); st.id = 'gcd-style'; st.textContent = CSS;
    document.head.appendChild(st);
  }

  // ---------- 通用片段 ----------
  function prog(k) { var h = '<div class="gcd-prog">'; for (var i = 1; i <= 3; i++) h += '<i class="' + (i <= k ? 'on' : '') + '"></i>'; return h + '</div>'; }
  function pill(n) { return '<span class="gcd-pill">' + ic('bulb', 14) + '解锁真相 ' + n + '/3</span>'; }
  function good(t) { return '<div class="gcd-fb good">✦ ' + t + '</div>'; }
  function warm(t) { return '<div class="gcd-fb warm">♡ ' + t + '</div>'; }
  function nextBtn(label) { return '<div class="gcd-btns"><button class="gcd-btn pri" data-next>' + esc(label) + ' ' + ic('arrow', 16) + '</button></div>'; }
  function show(html) {
    clearTimers();
    stage.innerHTML = html;
    stage.classList.remove('gcd-in'); void stage.offsetWidth; stage.classList.add('gcd-in');
    if (root) root.scrollTop = 0;
    stageLook();
  }
  // v3 视觉加法：首页和成绩单是深色夜潮（底部三层波浪），三关内页保持浅色卡片；成绩单涨潮 + 标题高光
  function wavePath(amp, y0, w, h) { var d = 'M0 ' + y0, seg = w / 8; for (var i = 0; i < 8; i++) { var x = i * seg; d += ' Q' + (x + seg / 4) + ' ' + (y0 - amp) + ' ' + (x + seg / 2) + ' ' + y0 + ' T' + (x + seg) + ' ' + y0; } return d + ' L' + w + ' ' + h + ' L0 ' + h + ' Z'; }
  function addWaves() {
    if (!root || root.querySelector('.gcd-wave')) return;
    [['w1', 'rgba(255,36,66,.38)', 26, 60], ['w2', 'rgba(255,122,89,.35)', 20, 72], ['w3', 'rgba(255,255,255,.18)', 14, 84]].forEach(function (w) {
      var d = document.createElement('div'); d.className = 'gcd-wave ' + w[0]; d.setAttribute('aria-hidden', 'true');
      d.innerHTML = '<' + 'svg viewBox="0 0 2000 200" preserveAspectRatio="none"><path d="' + wavePath(w[2], w[3], 2000, 200) + '" fill="' + w[1] + '"/></svg>';
      root.insertBefore(d, root.firstChild);
    });
  }
  function stageLook() {
    if (!root || !stage) return;
    var isEnd = !!stage.querySelector('.gcd-truths');
    var isLevel = !isEnd && !!(stage.querySelector('.gcd-prog') || stage.querySelector('.gcd-calc'));
    root.classList.toggle('gcd-level', isLevel);
    if (isEnd) {
      root.classList.remove('gcd-rise'); void root.offsetWidth; root.classList.add('gcd-rise');
      var h1 = stage.querySelector('.gcd-h1'); if (h1) h1.classList.add('gcd-shine');
      var badge = stage.querySelector('.gcd-title-ic'); if (badge) badge.classList.add('gcd-drop');
      var all = hits.length === 3 && hits.every(Boolean);
      later(function () { if (!stage) return; var b = (badge || stage).getBoundingClientRect(); confetti(b.left + b.width / 2, b.top + b.height / 2, all ? ['#F5C542', '#FFE08A', '#E0A526', '#FFF4CC'] : ['#FF2442', '#FFFFFF', '#FF8A96', '#FFD1D7']); }, 650);
    } else { root.classList.remove('gcd-rise'); }
    if (stage.querySelector('.gcd-calc')) { stage.classList.remove('gcd-shake'); void stage.offsetWidth; stage.classList.add('gcd-shake'); }
  }
  function confetti(x, y, colors) {
    if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    for (var i = 0; i < 56; i++) {
      var c = document.createElement('i'); c.className = 'fx-confetti';
      c.style.left = x + 'px'; c.style.top = y + 'px'; c.style.background = colors[i % colors.length];
      c.style.setProperty('--dx', ((Math.random() - 0.5) * 420).toFixed(0) + 'px'); c.style.setProperty('--dy', (-(150 + Math.random() * 200)).toFixed(0) + 'px'); c.style.setProperty('--rot', ((Math.random() * 720 - 360) | 0) + 'deg');
      c.style.animationDelay = (Math.random() * 0.15).toFixed(2) + 's';
      document.body.appendChild(c);
      (function (el) { setTimeout(function () { if (el.parentNode) el.parentNode.removeChild(el); }, 2000); })(c);
    }
  }
  function growBars() { later(function () { $$('[data-w]').forEach(function (e) { e.style.width = e.getAttribute('data-w') + '%'; }); }, 60); }
  function calc(lines, next) {
    show('<div class="gcd-calc"><div class="gcd-calc-t"><i></i>观潮正在算账</div><div class="gcd-calc-l" id="gcd-cl"></div></div>');
    var box = $('#gcd-cl'), i = 0;
    (function step() {
      if (i < lines.length) { box.insertAdjacentHTML('beforeend', '<div>' + ic('check', 16) + esc(lines[i++]) + '</div>'); later(step, 400); }
      else later(next, 350);
    })();
  }

  // 折线图：按容器实际宽度画，文字固定 12px
  function drawChart(el, series, withOrganic) {
    var W = Math.max(280, el.clientWidth || 600), H = 190, L = 12, R = 12, T = 26, B = 30;
    var a = series.actual, o = series.organic, n = a.length, k = series.boostStartIndex;
    var vals = a.concat(withOrganic ? o : []), mx = Math.max.apply(null, vals), mn = Math.min(0, Math.min.apply(null, vals));
    mx = mx * 1.12 || 1;
    var X = function (i) { return L + 18 + i * (W - L - R - 36) / (n - 1); };
    var Y = function (v) { return T + (H - T - B) * (1 - (v - mn) / (mx - mn)); };
    var pts = function (arr, from) { return arr.map(function (v, i) { return i < (from || 0) ? null : X(i).toFixed(1) + ',' + Y(v).toFixed(1); }).filter(Boolean).join(' '); };
    var s = '<' + 'svg width="' + W + '" height="' + H + '" viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="投流前后每天多出来的量">';
    s += '<line x1="' + L + '" x2="' + (W - R) + '" y1="' + Y(0).toFixed(1) + '" y2="' + Y(0).toFixed(1) + '" stroke="#DDD8D2" stroke-width="1"/>';
    if (withOrganic) {
      var top = a.slice(k).map(function (v, i) { return X(i + k).toFixed(1) + ',' + Y(v).toFixed(1); });
      var bot = o.slice(k).map(function (v, i) { return X(i + k).toFixed(1) + ',' + Y(v).toFixed(1); }).reverse();
      s += '<polygon points="' + top.concat(bot).join(' ') + '" fill="#FF2442" opacity=".16"/>';
    }
    s += '<line x1="' + X(k).toFixed(1) + '" x2="' + X(k).toFixed(1) + '" y1="' + (T - 8) + '" y2="' + Y(mn).toFixed(1) + '" stroke="#9A9AA4" stroke-dasharray="4 4"/>';
    s += '<text x="' + (X(k) + 6).toFixed(1) + '" y="' + (T - 10) + '" style="fill:#5D5D68">开始投流</text>';
    if (withOrganic) s += '<polyline points="' + pts(o) + '" fill="none" stroke="#8A8A94" stroke-width="2" stroke-dasharray="6 5"/>';
    s += '<polyline points="' + pts(a) + '" fill="none" stroke="#FF2442" stroke-width="2.4" stroke-linejoin="round"/>';
    a.forEach(function (v, i) { s += '<circle cx="' + X(i).toFixed(1) + '" cy="' + Y(v).toFixed(1) + '" r="3" fill="#FF2442"/>'; });
    for (var i = 0; i < n; i++) s += '<text x="' + X(i).toFixed(1) + '" y="' + (H - 8) + '" text-anchor="middle">第' + (i + 1) + '天</text>';
    el.innerHTML = s + '</svg>';
  }
  var chartState = null;
  function mountChart(withOrganic) {
    var el = $('.gcd-chart'); if (!el) return;
    chartState = { el: el, series: opts.story.merchant.boost.series, withOrganic: withOrganic };
    drawChart(el, chartState.series, withOrganic);
  }
  function onResize() { if (chartState && chartState.el.isConnected) drawChart(chartState.el, chartState.series, chartState.withOrganic); }

  // ---------- 首页 ----------
  function home() {
    hits = []; chartState = null;
    show('<div class="gcd-eyebrow">' + ic('search', 15) + '观潮 · 种草侦探</div>' +
      '<div class="gcd-h1">选一个身份，1 分钟闯三关</div>' +
      '<p class="gcd-sub">每一关都是你在小红书生意里真会遇到的判断题</p>' +
      '<div class="gcd-ids">' +
      '<button class="gcd-id" data-role="m"><div class="gcd-id-ic">' + ic('store', 22) + '</div><b>香薰小店老板</b><span>月底了：投流、达人、内容，下个月钱怎么花</span><em>开始闯关 ' + ic('arrow', 14) + '</em></button>' +
      '<button class="gcd-id" data-role="a"><div class="gcd-id-ic blue">' + ic('users', 22) + '</div><b>小红书客户经理</b><span>季度复盘前：3 个客户，谁要流失、谁真在亏</span><em>开始闯关 ' + ic('arrow', 14) + '</em></button>' +
      '</div>' +
      '<div class="gcd-foot gcd-muted">示例店铺与数据为模拟，用于演示</div>');
    $('[data-role="m"]').onclick = function () { hits = []; m1(); };
    $('[data-role="a"]').onclick = function () { hits = []; a1(); };
  }

  // ---------- 老板线 ----------
  function m1() {
    var d = opts.story.merchant, b = d.boost, seen = r0(b.seen), real = r0(b.real), organic = r0(b.organic);
    var def = r0(seen * 0.875);
    show(prog(1) + '<div class="gcd-eyebrow">第 1 关 · 投流的水分</div>' +
      '<div class="gcd-h2">「' + esc(b.title) + '」第 ' + b.boostDay + ' 天开始投流 ' + money(b.cost) + '</div>' +
      '<p class="gcd-p">投流那 ' + (8 - b.boostDay) + ' 天，比平时多出了 <b>' + seen + ' 单</b>。凭你的感觉，其中有多少单是投流带来的？</p>' +
      '<div class="gcd-chart"></div>' +
      '<div class="gcd-slider"><span class="gcd-emo" id="gcd-emo" aria-hidden="true">😮</span><input type="range" id="gcd-g" min="0" max="' + seen + '" step="1" value="' + def + '" aria-label="你猜投流带来多少单"><b id="gcd-gv">' + def + ' 单</b></div>' +
      '<div class="gcd-btns"><button class="gcd-btn pri" id="gcd-go">揭晓 ' + ic('arrow', 16) + '</button></div>');
    mountChart(false);
    var g = $('#gcd-g');
    function emo() { var e = $('#gcd-emo'); if (!e) return; var p = seen > 0 ? (+g.value) / seen : 0; e.textContent = p < 0.4 ? '😐' : p < 0.75 ? '😮' : '😱'; e.style.left = (p * 100).toFixed(1) + '%'; e.classList.remove('bump'); void e.offsetWidth; e.classList.add('bump'); }
    g.oninput = function () { $('#gcd-gv').textContent = g.value + ' 单'; emo(); };
    emo();
    $('#gcd-go').onclick = function () {
      var v = +g.value, close = Math.abs(v - real) <= 10; hits[0] = close;
      var face = close ? '😎' : Math.abs(v - real) <= 25 ? '😮' : '😱';
      var fb = close ? good('眼光很准！你猜 ' + v + ' 单，真实是 ' + real + ' 单')
        : v > real ? warm('你猜 ' + v + ' 单，是很自然的判断——投流那几天确实涨得很猛，这正是水分最会骗人的地方')
          : warm('你猜 ' + v + ' 单，比较谨慎——其实投流的功劳比你想的多一些');
      calc(['读取' + d.inName + '每天的订单…', '读取' + d.outName + '每天的订单…', '扣掉笔记本来就会带来的订单…'], function () {
        var ov = d.overall;
        show(prog(1) + '<div class="gcd-eyebrow">第 1 关 · 揭晓 ' + pill(1) + '<span class="gcd-emo-freeze" aria-hidden="true">' + face + '</span></div>' + fb +
          '<div class="gcd-h2">真相：' + real + ' 单是投流的功劳，另外 ' + organic + ' 单本来就会来</div>' +
          '<div class="gcd-chart"></div>' +
          '<div class="gcd-small">灰色虚线：这篇笔记不投流本来会怎么走；红色阴影：投流的真实功劳。</div>' +
          '<div class="gcd-box red">放到全店 ' + ov.boostCount + ' 笔投流：每 1 元看起来换回 ' + f2(ov.roiSeen) + ' 元，去掉水分只有 ' + f2(ov.roiReal) + ' 元，低于保本线 ' + f2(ov.breakEven) + ' 元</div>' +
          nextBtn('下一关'));
        mountChart(true);
        $('[data-next]').onclick = m2;
      });
    };
  }

  function m2() {
    var d = opts.story.merchant, C = d.cards, order = [C[1], C[0], C[2], C[3]].filter(Boolean);
    chartState = null;
    show(prog(2) + '<div class="gcd-eyebrow">第 2 关 · 被冤枉的笔记</div>' +
      '<div class="gcd-h2">只看' + esc(d.inName) + '，这 4 篇都像"没什么效果"</div>' +
      '<p class="gcd-p">其中有一篇其实是真有效的，只是生意跑去' + esc(d.outName) + '了。你觉得是哪一篇？</p>' +
      '<div class="gcd-picks">' + order.map(function (c, k) {
        return '<button class="gcd-pick" data-k="' + k + '"><div class="t">' + esc(c.title) + '</div><div class="s">' + esc(d.inName) + '：' + sg(c.inside) + ' 单</div></button>';
      }).join('') + '</div>');
    $$('[data-k]').forEach(function (btn) {
      btn.onclick = function () {
        var c = order[+btn.getAttribute('data-k')]; hits[1] = !!c.answer;
        var fb = c.answer ? good('眼光很准！就是它')
          : c.trap ? warm('很合理的选择——它在站内涨得最多，任何人都会先怀疑它。这恰恰是这一关埋的陷阱')
            : warm('很合理的怀疑——只看站内，几篇确实很难分清。算上' + esc(d.outName) + '，答案就清楚了');
        calc(['把' + d.outName + '的订单也算进来…'], function () {
          var ans = C.filter(function (x) { return x.answer; })[0] || C[0];
          var share = r0(ans.outside / (ans.inside + ans.outside) * 100);
          var maxOut = Math.max.apply(null, order.map(function (x) { return Math.max(0, x.outside); })) || 1;
          var VL = { real: '真有效', maybe: '可能是巧合', none: '没看到效果' };
          show(prog(2) + '<div class="gcd-eyebrow">第 2 关 · 揭晓 ' + pill(2) + '</div>' + fb +
            '<div class="gcd-h2">真相：「' + esc(ans.title) + '」被冤枉了，' + share + '% 的订单在' + esc(d.outName) + '</div>' +
            '<div class="gcd-tiles">' + order.map(function (x) {
              return '<div class="gcd-tile' + (x.answer ? ' ok' : '') + '">' +
                '<div class="gcd-row"><b>' + esc(x.title) + '</b><span class="gcd-small gcd-num' + (x.answer ? ' gcd-green' : '') + '" style="white-space:nowrap">合计 ' + sg(x.total) + ' 单 · ' + (VL[x.verdict] || '') + '</span></div>' +
                '<div class="gcd-small gcd-num">' + esc(d.inName) + ' ' + sg(x.inside) + ' · ' + esc(d.outName) + ' ' + sg(x.outside) + '</div>' +
                '<div class="gcd-bar"><b style="background:#4C6FFF" data-w="' + (Math.max(0, x.outside) / maxOut * 100).toFixed(1) + '"></b></div>' +
                (x.trap ? '<div class="gcd-trap">隐藏发现：站内涨得最多，但' + esc(d.outName) + '同期少了 ' + Math.abs(r0(x.outside)) + ' 单——只是换了个地方买</div>' : '') +
                '</div>';
            }).join('') + '</div>' + nextBtn('下一关'));
          growBars();
          $('[data-next]').onclick = m3;
        });
      };
    });
  }

  function kolParts(name) { var p = String(name).split(' · '); return { first: p[0], rest: p.slice(1).join(' · ') }; }

  function m3() {
    var d = opts.story.merchant, k = d.kol, kp = kolParts(k.name), be = r0(k.breakEven), cost = r0(k.cost);
    show(prog(3) + '<div class="gcd-eyebrow">第 3 关 · 达人报价谈判</div>' +
      '<div class="gcd-h2">' + esc(kp.first) + (kp.rest ? '（' + esc(kp.rest) + '）' : '') + '要续约，报价 ' + money(cost) + '</div>' +
      '<p class="gcd-p">上次合作那篇「' + esc(k.title) + '」多带来 ' + r0(k.inc) + ' 单（客单价 ¥' + d.unitPrice + '，毛利 ' + r0(d.margin * 100) + '%）。这次你愿意出多少？</p>' +
      '<div class="gcd-slider"><input type="range" id="gcd-p" min="1000" max="6000" step="100" value="' + cost + '" aria-label="你的出价"><b id="gcd-pv">' + money(cost) + '</b></div>' +
      '<div class="gcd-btns"><button class="gcd-btn pri" id="gcd-go">出价 ' + ic('arrow', 16) + '</button></div>');
    var p = $('#gcd-p'); p.oninput = function () { $('#gcd-pv').textContent = money(+p.value); };
    $('#gcd-go').onclick = function () {
      var v = +p.value; hits[2] = v <= be;
      var fb = v <= be ? good('谈判高手！' + money(v) + ' 在回本线以内，这次合作稳赚')
        : v < cost ? warm('你已经帮店里省下 ' + money(cost - v) + '，很会谈！再往下谈 ' + money(v - be) + ' 就能回本')
          : warm('你是很爽快的合作伙伴！按账本算，把报价谈到 ' + money(be) + ' 以内会更划算');
      calc(['读取这篇合作笔记带来的订单…', '按客单价和毛利算回本报价…'], function () {
        show(prog(3) + '<div class="gcd-eyebrow">第 3 关 · 揭晓 ' + pill(3) + '</div>' + fb +
          '<div class="gcd-h2">真相：这位博主的回本报价是 ' + money(be) + '</div>' +
          '<p class="gcd-p">按原价 ' + money(cost) + ' 续约，每 1 元报价只换回 ' + f2(k.roi) + ' 元，低于保本线 ' + f2(d.overall.breakEven) + ' 元。带货能力是真的，只是报价偏高。</p>' +
          '<div class="gcd-bar" style="height:14px;border-radius:7px"><b style="background:' + (v <= be ? '#16A05D' : '#F08C1A') + '" data-w="' + (v / 6000 * 100).toFixed(1) + '"></b></div>' +
          '<div class="gcd-small gcd-num">你的出价 ' + money(v) + ' · 回本线 ' + money(be) + ' · 原报价 ' + money(cost) + '</div>' +
          nextBtn('看我的成绩单'));
        growBars();
        $('[data-next]').onclick = mEnd;
      });
    };
  }

  function mEnd() {
    var d = opts.story.merchant, ov = d.overall, k = d.kol, be = r0(k.breakEven), all = hits.length === 3 && hits.every(Boolean);
    var t = (d.plan && d.plan.topTypes) || [];
    show('<div class="gcd-eyebrow">种草成绩单 · ' + esc(d.shop) + '</div>' +
      '<div class="gcd-h1">' + ic('party', 24).replace('class="gcd-ic"', 'class="gcd-ic gcd-title-ic"') + '恭喜解锁 3 个种草真相' + (all ? ' · 获得「金牌种草侦探」称号' : '') + '</div>' +
      '<p class="gcd-sub">' + (all ? '三关都看得很准，你对种草生意的直觉相当敏锐。' : '你的每一个判断都很自然——这些坑，正是商家每天都会遇到、却很难自己算清的。') + '</p>' +
      '<div class="gcd-truths">' +
      '<div class="gcd-truth"><div class="k">真相 1 · 投流的水分</div><div class="v gcd-num">真实回报 ' + f2(ov.roiReal) + ' 元</div><div class="n">看起来是 ' + f2(ov.roiSeen) + ' 元</div></div>' +
      '<div class="gcd-truth"><div class="k">真相 2 · 被冤枉的笔记</div><div class="v gcd-num">' + pct(ov.outShare) + ' 订单在' + esc(d.outName) + '</div><div class="n">只看站内会误判</div></div>' +
      '<div class="gcd-truth"><div class="k">真相 3 · 达人报价</div><div class="v gcd-num">回本报价 ' + money(be) + '</div><div class="n">原报价 ' + money(k.cost) + '</div></div>' +
      '</div>' +
      '<div class="gcd-plan"><div class="h">观潮给你的下月计划</div>' +
      (t.length >= 2 ? '<div>1. 多写「' + esc(t[0].type) + '」「' + esc(t[1].type) + '」，平均每篇分别多带来约 ' + r0(t[0].avg) + ' 单和 ' + r0(t[1].avg) + ' 单</div>' : '') +
      '<div>2. 只给发布两天就跑赢平时的笔记投流，每篇约 ' + money(d.plan.spendPerGreen) + '，月预算约 ' + money(d.plan.budget) + '</div>' +
      '<div>3. ' + esc(kolParts(k.name).first) + ' 续约前，把报价谈到 ' + money(be) + ' 以内</div></div>' +
      '<div class="gcd-btns">' +
      '<button class="gcd-btn pri" data-go="pack">' + ic('rocket', 16) + '看观潮为你准备的行动包</button>' +
      '<button class="gcd-btn" data-go="ledger">' + ic('layout', 16) + '进入完整账本</button>' +
      '<button class="gcd-btn" data-go="tour">' + ic('arrow', 16) + '带我 3 分钟看完观潮</button>' +
      '<button class="gcd-btn" data-go="again">' + ic('refresh', 16) + '换客户经理视角再玩</button></div>');
    $('[data-go="pack"]').onclick = function () { exit({ type: 'actionpack', shop: 'shop' }); };
    $('[data-go="ledger"]').onclick = function () { exit({ type: 'ledger', shop: 'shop' }); };
    $('[data-go="tour"]').onclick = function () { exit({ type: 'tour', shop: 'shop' }); };
    $('[data-go="again"]').onclick = function () { hits = []; a1(); };
  }

  // ---------- 客户经理线 ----------
  function cls(m) {
    var by = function (s) { return m.clients.filter(function (c) { return c.status === s; })[0]; };
    return { risk: by('risk') || m.clients[0], loss: by('loss') || m.clients[1], ok: by('ok') || m.clients[2] };
  }

  function a1() {
    var m = opts.story.manager, g = cls(m); chartState = null;
    show(prog(1) + '<div class="gcd-eyebrow">第 1 关 · 谁最可能流失</div>' +
      '<div class="gcd-h2">季度复盘前，你只来得及先拜访一位客户</div>' +
      '<p class="gcd-p">这是客户自己在小红书后台看到的"投流每 1 元换回"。你觉得谁最可能砍预算？</p>' +
      '<div class="gcd-tiles">' + m.clients.map(function (c, k) {
        return '<button class="gcd-pick" data-k="' + k + '"><div class="gcd-row"><span class="t">' + esc(c.name) + '</span><b class="gcd-num' + (c.roiIn < c.breakEven ? ' gcd-red' : '') + '">' + f2(c.roiIn) + ' 元</b></div><div class="s">保本线 ' + f2(c.breakEven) + ' 元</div></button>';
      }).join('') + '</div>');
    $$('[data-k]').forEach(function (btn) {
      btn.onclick = function () {
        var c = m.clients[+btn.getAttribute('data-k')]; hits[0] = c.status === 'risk';
        var fb = c.status === 'risk' ? good('判断很准！它看起来亏得最厉害，最可能砍预算')
          : c.status === 'loss' ? warm('很有洞察——' + esc(g.loss.name) + '确实是真正在亏的那位，你看到了另一个重点')
            : warm('很稳妥的选择——大客户永远值得优先维护');
        calc(['读取三位客户的站外成交…', '扣掉投流里的自然流量水分…'], function () {
          var mx = Math.max.apply(null, m.clients.map(function (x) { return Math.max(x.roiReal, x.roiIn); })) * 1.1;
          show(prog(1) + '<div class="gcd-eyebrow">第 1 关 · 揭晓 ' + pill(1) + '</div>' + fb +
            '<div class="gcd-h2">真相：看起来最危险的' + esc(g.risk.name) + '，其实在赚</div>' +
            '<div class="gcd-tiles">' + m.clients.map(function (x) {
              var okc = x.roiReal >= x.breakEven;
              var note = x.status === 'risk' ? pct(x.outShare) + ' 的订单在' + esc(x.outName) + '成交：最需要讲清全域账的客户'
                : x.status === 'loss' ? '算全了还是没回本：需要帮它改打法' : '健康，可以建议加预算';
              return '<div class="gcd-tile"><div class="gcd-row"><b>' + esc(x.name) + '</b><span class="gcd-num ' + (okc ? 'gcd-green' : 'gcd-red') + '" style="font-weight:600;white-space:nowrap">' + f2(x.roiIn) + ' → ' + f2(x.roiReal) + ' 元</span></div>' +
                '<div class="gcd-bar"><b style="background:' + (okc ? '#16A05D' : '#FF2442') + '" data-w="' + (x.roiReal / mx * 100).toFixed(1) + '"></b></div>' +
                '<div class="gcd-small">' + note + '</div></div>';
            }).join('') + '</div>' + nextBtn('下一关'));
          growBars();
          $('[data-next]').onclick = a2;
        });
      };
    });
  }

  function a2() {
    var g = cls(opts.story.manager), r = g.risk, w = r.winwin || {};
    var bText = '算上' + esc(r.outName) + '并去掉水分，每 1 元换回 ' + f2(r.roiReal) + ' 元，高于保本线。不是小红书不带货，是货在' + esc(r.outName) + '成交了。';
    var R = [
      { t: '理解，那下个月先减预算', ok: false, h: '很有温度的回应', f: '很体贴客户的回应。不过账还没算全：如果真的减了，客户每月少赚约 ' + money(w.curProfit) + ' 毛利，平台每月也少约 ' + money(w.curMonthly) + ' 投放。' },
      { t: '先把' + esc(r.outName) + '成交和自然流量水分都算清，再一起定预算', ok: true, h: '回得漂亮！', f: bText },
      { t: '我再给您申请点流量扶持，先别停', ok: false, h: '很有温度的回应', f: '很想帮客户留下来的心意！再加一步把全域账算清，客户就不会下个月又想停了。' }
    ];
    show(prog(2) + '<div class="gcd-eyebrow">第 2 关 · 怎么回客户</div>' +
      '<div class="gcd-h2">' + esc(r.name) + '："投流每 1 元只换回 ' + f2(r.roiIn) + ' 元，下个月不投了"</div>' +
      '<div class="gcd-tiles">' + R.map(function (x, k) {
        return '<button class="gcd-pick" data-k="' + k + '"><div class="t">' + String.fromCharCode(65 + k) + '. ' + x.t + '</div></button>';
      }).join('') + '</div>');
    $$('[data-k]').forEach(function (btn) {
      btn.onclick = function () {
        var x = R[+btn.getAttribute('data-k')]; hits[1] = x.ok;
        calc(['算一算减预算后，客户和平台各少多少…', '把' + r.outName + '的成交也算进来…'], function () {
          show(prog(2) + '<div class="gcd-eyebrow">第 2 关 · 揭晓 ' + pill(2) + '</div>' +
            (x.ok ? good(x.h) : warm(x.h)) + '<p class="gcd-p" style="margin-top:8px">' + x.f + '</p>' +
            (x.ok ? '' : '<div class="gcd-box green">观潮建议的回法：先把' + esc(r.outName) + '成交和自然流量水分都算清。' + bText + '</div>') +
            nextBtn('下一关'));
          $('[data-next]').onclick = a3;
        });
      };
    });
  }

  function a3() {
    var m = opts.story.manager, g = cls(m), P = m.prescription || [];
    show(prog(3) + '<div class="gcd-eyebrow">第 3 关 · 给真正亏钱的客户开药方</div>' +
      '<div class="gcd-h2">' + esc(m.prescriptionFor) + '算全了还是没回本，你会给哪些建议？</div>' +
      '<p class="gcd-small" style="margin:0 0 10px">可以多选</p>' +
      '<div class="gcd-tiles" style="margin-top:0">' + P.map(function (o, k) {
        return '<label class="gcd-check"><input type="checkbox" data-k="' + k + '"><span>' + esc(o.text) + '</span></label>';
      }).join('') + '</div>' +
      '<div class="gcd-err" id="gcd-er"></div>' +
      '<div class="gcd-btns" style="margin-top:4px"><button class="gcd-btn pri" id="gcd-go">开药方 ' + ic('arrow', 16) + '</button></div>');
    $('#gcd-go').onclick = function () {
      var sel = $$('input:checked').map(function (e) { return +e.getAttribute('data-k'); });
      if (!sel.length) { $('#gcd-er').textContent = '先选至少一条建议'; return; }
      var nRight = P.filter(function (o) { return o.right; }).length;
      var right = sel.filter(function (k) { return P[k].right; }).length, wrong = sel.length - right;
      var full = right === nRight && wrong === 0; hits[2] = full;
      var fb = full ? good('药方很专业！三条关键建议你都选中了')
        : right > 0 ? warm('你选中的 ' + right + ' 条都很到位') : warm('每一条都是在认真帮客户想办法');
      calc(['逐条核对这些建议在本店的历史效果…', '测算调整后商家和平台各多得多少…'], function () {
        var wi = 0, lw = g.loss.winwin || {};
        show(prog(3) + '<div class="gcd-eyebrow">第 3 关 · 揭晓 ' + pill(3) + '</div>' + fb +
          '<div class="gcd-tiles">' + P.map(function (o, k) {
            var note = '';
            if (!o.right) { note = (wi === 0 ? '想帮客户把声量做大的思路很好，不过' : '展示品牌故事的想法不错，只是') + esc(o.note); wi++; }
            return '<div class="gcd-item"><span class="' + (o.right ? 'gcd-green' : '') + '" style="' + (o.right ? '' : 'color:#946500') + '">' + ic(o.right ? 'check' : 'bulb', 18) + '</span><div><div>' + esc(o.text) + (sel.indexOf(k) >= 0 ? '<span class="gcd-tag">你选了</span>' : '') + '</div>' + (note ? '<div class="gcd-small">' + note + '</div>' : '') + '</div></div>';
          }).join('') + '</div>' +
          '<div class="gcd-box green">按这三条调整（发文节奏不变）：商家每月多赚约 ' + money(lw.dMerchant) + ' 毛利，平台每月多约 ' + money(lw.dPlatform) + ' 投放——双赢</div>' +
          nextBtn('看我的成绩单'));
        $('[data-next]').onclick = aEnd;
      });
    };
  }

  function aEnd() {
    var g = cls(opts.story.manager), all = hits.length === 3 && hits.every(Boolean);
    show('<div class="gcd-eyebrow">客户经理成绩单</div>' +
      '<div class="gcd-h1">' + ic('party', 24).replace('class="gcd-ic"', 'class="gcd-ic gcd-title-ic"') + '恭喜解锁 3 个种草真相' + (all ? ' · 获得「金牌客户经理」称号' : '') + '</div>' +
      '<p class="gcd-sub">' + (all ? '三关都判断得很准，你很懂客户的生意。' : '你的每个选择都在为客户着想——再加上一本算清的全域账，客户和平台都会是赢家。') + '</p>' +
      '<div class="gcd-truths">' +
      '<div class="gcd-truth"><div class="k">真相 1</div><div class="v">' + esc(g.risk.name) + '其实在赚</div><div class="n gcd-num">站内 ' + f2(g.risk.roiIn) + ' → 全域 ' + f2(g.risk.roiReal) + ' 元</div></div>' +
      '<div class="gcd-truth"><div class="k">真相 2</div><div class="v">先算账，再谈预算</div><div class="n">避免双输</div></div>' +
      '<div class="gcd-truth"><div class="k">真相 3</div><div class="v">' + esc(g.loss.name) + '要换打法</div><div class="n">商家与平台都能多得</div></div>' +
      '</div>' +
      '<div class="gcd-btns">' +
      '<button class="gcd-btn pri" data-go="prop">' + ic('file', 16) + '一键生成' + esc(g.risk.name) + '拜访要点</button>' +
      '<button class="gcd-btn" data-go="board">' + ic('users', 16) + '进入客户看板</button>' +
      '<button class="gcd-btn" data-go="again">' + ic('refresh', 16) + '换老板视角再玩</button></div>');
    $('[data-go="prop"]').onclick = function () { exit({ type: 'proposal', client: g.risk.key }); };
    $('[data-go="board"]').onclick = function () { exit({ type: 'board' }); };
    $('[data-go="again"]').onclick = function () { hits = []; m1(); };
  }

  // ---------- 打开 / 关闭 ----------
  function markSeen() { try { localStorage.setItem(SEEN_KEY, '1'); } catch (e) { } }
  function hasSeen() { try { return localStorage.getItem(SEEN_KEY) === '1'; } catch (e) { return false; } }

  function exit(action) {
    try {
      var ts = stage ? stage.querySelectorAll('.gcd-truth') : [];
      if (ts.length && action && (action.type === 'ledger' || action.type === 'tour')) {
        action.truths = Array.prototype.map.call(ts, function (t) { var r = t.getBoundingClientRect(); return { rect: { left: r.left, top: r.top, width: r.width, height: r.height }, html: t.innerHTML }; });
      }
    } catch (e) { }
    markSeen(); close();
    if (opts && typeof opts.onExit === 'function') { try { opts.onExit(action); } catch (e) { console.error(e); } }
  }

  function open(o) {
    opts = o || {};
    if (!opts.story) { console.error('GuanchaoDetective: 缺少 story（请传 LedgerEngine.story(SAMPLES)）'); return; }
    ensureStyle();
    close();
    root = document.createElement('div');
    root.className = 'gcd'; root.id = 'gcd';
    root.setAttribute('role', 'dialog'); root.setAttribute('aria-label', '种草侦探');
    root.innerHTML = '<div class="gcd-top"><div class="gcd-brand"><span class="gcd-logo">' + ic('wave', 18) + '</span>观潮</div>' +
      '<button class="gcd-skip" id="gcd-skip">跳过，直接看账本 ' + ic('arrow', 15) + '</button></div>' +
      '<div class="gcd-wrap"><div class="gcd-card" id="gcd-stage"></div></div>';
    document.body.appendChild(root);
    document.body.classList.add('gcd-open');
    stage = root.querySelector('#gcd-stage');
    addWaves();
    root.querySelector('#gcd-skip').onclick = function () { exit({ type: 'skip' }); };
    window.addEventListener('resize', onResize);
    home();
  }

  function close() {
    clearTimers(); chartState = null;
    window.removeEventListener('resize', onResize);
    if (root && root.parentNode) root.parentNode.removeChild(root);
    root = null; stage = null;
    document.body.classList.remove('gcd-open');
  }

  // 第一次打开网页时自动进入；以后不再自动打开
  function autoOpen(o) { if (!hasSeen()) { open(o); return true; } return false; }

  function reset() { try { localStorage.removeItem(SEEN_KEY); } catch (e) { } close(); }
  window.GuanchaoDetective = { open: open, close: close, autoOpen: autoOpen, hasSeen: hasSeen, reset: reset, isOpen: function () { return !!root; } };
})();
