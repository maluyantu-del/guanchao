// 观潮 · 动效三（fx3）：只加不改，紧跟在 rigor8.js 后加载。编号对应清单 #1～#32（#25 纯样式在 fx3.css）。
// 数字一律取自 LedgerEngine 结果或页面上已显示的数字，不自己编；页面有变化后 120ms 统一检查一遍（setTimeout 调度，后台标签页也能跑）。
(function () {
  'use strict';
  if (window.GuanchaoFX3) return;
  var RED = false, HOVER = false;
  try { RED = window.matchMedia('(prefers-reduced-motion: reduce)').matches; HOVER = window.matchMedia('(hover: hover) and (pointer: fine)').matches; } catch (e) {}
  var NS = 'http://www.w3.org/2000/svg', XL = 'http://www.w3.org/1999/xlink';
  var UID = 0;
  function $(s, r) { return (r || document).querySelector(s); }
  function $$(s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); }
  function later(fn, ms) { return setTimeout(fn, ms || 0); }
  function LE() { try { return typeof LedgerEngine !== 'undefined' ? LedgerEngine : window.LedgerEngine; } catch (e) { return null; } }
  function SAMP() { try { return typeof SAMPLES !== 'undefined' ? SAMPLES : window.SAMPLES; } catch (e) { return null; } }
  function ctx() { try { return window.GuanchaoV7 && GuanchaoV7.ctx ? GuanchaoV7.ctx() : null; } catch (e) { return null; } }
  function sv(tag, attrs, parent) { var e = document.createElementNS(NS, tag); if (attrs) for (var k in attrs) e.setAttribute(k, attrs[k]); if (parent) parent.appendChild(e); return e; }
  function el(tag, cls, html, parent) { var e = document.createElement(tag); if (cls) e.className = cls; if (html != null) e.innerHTML = html; if (parent) parent.appendChild(e); return e; }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function f1(v) { return (Math.round(v * 10) / 10).toFixed(1); }
  function f2(v) { return (Math.round(v * 100) / 100).toFixed(2); }
  function money(v) { return '¥' + Math.round(v).toLocaleString('en-US'); }
  function wan(v) { return '¥' + (Math.round(v / 1000) / 10).toFixed(1) + ' 万'; }
  function metricOf(c) { return (c && c.sample && c.sample.metric) || '订单'; }
  function shopName() { var b = $$('.seg-btn.active').map(function (x) { return x.textContent.trim(); }).filter(function (t) { return !/^(商家|客户经理|全部|站内|站外|按时间|按效果|按推荐|按原来的比例)$/.test(t); }); return b[0] || ''; }
  function onVisible(node, fn) {
    if (!('IntersectionObserver' in window)) { later(fn, 60); return; }
    var io = new IntersectionObserver(function (es) { es.forEach(function (e) { if (e.isIntersecting) { io.disconnect(); fn(); } }); }, { threshold: 0.3 });
    io.observe(node);
  }

  /* ================= #1 一杯水 + #24 解码 ================= */
  function enhanceGlass() {
    var d = document.getElementById('sec-boost'); if (!d || d.__fx3g) return; d.__fx3g = 1;
    var k = d.querySelector('summary .col-k'); if (k && !RED) onVisible(k, function () { decode(k); });
    var c = ctx(); if (!c) return; var S = c.r.summary || {}, be = +c.r.be;
    if (!(S.roiSeen > 0 && S.roiReal >= 0 && isFinite(be))) return;
    var body = d.querySelector('.col-body'); if (!body) return;
    var seen = S.roiSeen, real = Math.max(0, S.roiReal), max = Math.max(seen, be) * 1.12;
    var Y = function (v) { return 172 - v / max * 150; }, ys = Y(seen), yr = Y(real), yb = Y(be), id = 'fx3g' + (++UID);
    var box = el('div', 'fx3-glass');
    var s = sv('svg', { viewBox: '0 0 200 190', width: '200', height: '190', 'aria-hidden': 'true' }, box);
    var defs = sv('defs', null, s);
    var cp = sv('clipPath', { id: id + 'c' }, defs); sv('path', { d: 'M14 12 L104 12 L96 172 L22 172 Z' }, cp);
    var cp2 = sv('clipPath', { id: id + 'o' }, defs); sv('rect', { x: '0', y: '0', width: '200', height: String(yr + 1) }, cp2);
    function wave(y, fill, cls) { var dd = 'M-40 ' + y; for (var x = -40; x < 160; x += 20) dd += ' Q' + (x + 5) + ' ' + (y - 3.5) + ' ' + (x + 10) + ' ' + y + ' T' + (x + 20) + ' ' + y; dd += ' L160 ' + (y + 220) + ' L-40 ' + (y + 220) + ' Z'; return sv('path', { d: dd, fill: fill, 'class': 'wave' + (cls ? ' ' + cls : '') }); }
    var gAll = sv('g', { 'clip-path': 'url(#' + id + 'c)' }, s);
    var gOrgClip = sv('g', { 'clip-path': 'url(#' + id + 'o)' }, gAll);
    var gOrg = sv('g', { 'class': 'lv' }, gOrgClip); var gOrgD = sv('g', { 'class': 'drain' }, gOrg);
    gOrgD.appendChild(wave(ys, 'rgba(124,124,136,.38)'));
    var gReal = sv('g', { 'class': 'lv' }, gAll);
    gReal.appendChild(wave(yr, real >= be ? 'rgba(255,36,66,.55)' : 'rgba(255,36,66,.38)'));
    gReal.appendChild(wave(yr + 1, 'rgba(255,255,255,.25)', 'b'));
    [gOrg, gReal].forEach(function (g) { g.style.transform = 'translateY(160px)'; });
    sv('path', { d: 'M14 12 L104 12 L96 172 L22 172 Z', fill: 'none', stroke: '#B9BCC8', 'stroke-width': '2.5', 'stroke-linejoin': 'round' }, s);
    sv('line', { x1: '18', x2: '100', y1: String(yb), y2: String(yb), stroke: '#17171C', 'stroke-width': '1.4', 'stroke-dasharray': '4 3' }, s);
    var stream = sv('path', { d: 'M100 ' + (yr - 5) + ' C 120 ' + (yr - 4) + ' 124 ' + (yr + 30) + ' 128 186', fill: 'none', stroke: 'rgba(124,124,136,.7)', 'stroke-width': '4', 'stroke-linecap': 'round', 'class': 'stream' }, s);
    var lab = [{ y: ys, t: '看起来 ' + f2(seen), c: '#7C7C88' }, { y: yr, t: '真实 ' + f2(real), c: '#FF2442' }, { y: yb, t: '保本线 ' + f2(be), c: '#17171C' }];
    var sorted = lab.slice().sort(function (a, b) { return a.y - b.y; });
    for (var i = 1; i < sorted.length; i++) if (sorted[i].y - sorted[i - 1].y < 13) sorted[i].y = sorted[i - 1].y + 13;
    var tx = lab.map(function (l) { var t = sv('text', { x: '110', y: String(l.y + 4), fill: l.c, 'class': 'lbl' }, s); t.textContent = l.t; return t; });
    var verdict = real >= be ? '仍高于保本线，这笔投流值。' : '低于保本线：看着赚，其实没回本。';
    el('div', 'fx3-g-txt', '把投流的回报想成一杯水：看起来每 1 元换回 <b>' + f2(seen) + '</b> 元；拔掉塞子，<span class="g">「本来就会来」</span>的那部分流走后，剩下的才是投流真贡献：<b class="r">' + f2(real) + '</b> 元（保本线 ' + f2(be) + '）。' + verdict, box);
    body.insertBefore(box, body.firstChild);
    function play() {
      if (RED) { gOrg.style.transform = gReal.style.transform = 'none'; gOrgD.style.transform = 'translateY(' + (yr - ys + 3) + 'px)'; tx[1].classList.add('on'); tx[2].classList.add('on'); return; }
      later(function () { gOrg.style.transform = 'none'; gReal.style.transform = 'none'; }, 60);
      later(function () { tx[0].classList.add('on'); tx[2].classList.add('on'); }, 1000);
      later(function () { stream.classList.add('on'); gOrgD.style.transform = 'translateY(' + (yr - ys + 3) + 'px)'; }, 1700);
      later(function () { stream.classList.remove('on'); tx[0].style.opacity = '.45'; tx[1].classList.add('on'); }, 2950);
    }
    onVisible(box, play);
  }
  function decode(node) {
    var orig = node.textContent; if (!/\d+\.\d+/.test(orig)) return;
    var t0 = Date.now(), dur = 1000; node.classList.add('fx3-dec');
    (function tick() {
      if (!node.isConnected) return; var p = (Date.now() - t0) / dur;
      if (p >= 1) { node.textContent = orig; return; }
      node.textContent = orig.replace(/\d+\.\d+/g, function (m) { return m.replace(/\d/g, function (ch) { return Math.random() < p * p ? ch : String(Math.floor(Math.random() * 10)); }); });
      later(tick, 50);
    })();
  }

  /* ================= #2 成交流向图 + #21 前后对比滑块 ================= */
  function funnelParts() {
    return $$('#card-funnel .fn-item').map(function (it) {
      var t = (it.querySelector('.fn-ch') || {}).textContent || '';
      var m = t.match(/^\s*(.+?)\s+([\d,]+)\s*·\s*(.+?)\s+([\d,]+)\s*$/);
      return m ? { inName: m[1], inV: +m[2].replace(/,/g, ''), outName: m[3], outV: +m[4].replace(/,/g, '') } : null;
    }).filter(Boolean);
  }
  function enhanceFunnel() {
    var w = document.getElementById('card-funnel-w'); if (!w || w.__fx3f) return;
    var sec = document.getElementById('card-funnel'); if (!sec) return; w.__fx3f = 1;
    var c = ctx(); if (!c) return; var S = c.r.summary || {}; if (!(S.outShare >= 0)) return;
    var parts = funnelParts(); var p0 = parts[0] || { inName: '站内', outName: '站外' };
    var outP = Math.round(S.outShare * 100), inP = 100 - outP, M = metricOf(c);
    /* #2 */
    var fb = el('div', 'fx3-flow', '<div class="fx3-h">成交流向：种草带来的' + esc(M) + '最后在哪成交（粗细 = 占比）</div>');
    var s = sv('svg', { viewBox: '0 0 640 150', 'aria-hidden': 'true' }, fb), id = 'fx3f' + (++UID);
    var pIn = 'M118 75 C 300 75 290 37 468 37', pOut = 'M118 75 C 300 75 290 113 468 113';
    var bIn = sv('path', { id: id + 'a', d: pIn, 'class': 'band', stroke: '#FF2442', 'stroke-width': String(6 + 52 * inP / 100) }, s);
    var bOut = sv('path', { id: id + 'b', d: pOut, 'class': 'band', stroke: '#4C6FFF', 'stroke-width': String(6 + 52 * outP / 100) }, s);
    sv('rect', { x: '8', y: '45', width: '110', height: '60', rx: '14', fill: '#17171C' }, s);
    var t0 = sv('text', { x: '63', y: '81', 'text-anchor': 'middle', 'class': 'node w' }, s); t0.textContent = '种草笔记';
    [[10, '#FFE7EA', '#FF2442', p0.inName, inP], [86, '#E8EDFF', '#4C6FFF', p0.outName, outP]].forEach(function (n) {
      sv('rect', { x: '468', y: String(n[0]), width: '164', height: '54', rx: '14', fill: n[1] }, s);
      var a = sv('text', { x: '480', y: String(n[0] + 23), 'class': 'node' }, s); a.textContent = String(n[3]).slice(0, 8);
      var b = sv('text', { x: '480', y: String(n[0] + 47), 'class': 'pct' }, s); b.textContent = n[4] + '%'; b.style.fill = n[2];
    });
    [[id + 'a', '#FF2442', inP], [id + 'b', '#4C6FFF', outP]].forEach(function (q) {
      var n = Math.max(2, Math.round(q[2] / 9));
      for (var i = 0; i < n; i++) {
        var dot = sv('circle', { r: '3.2', fill: '#fff', stroke: q[1], 'stroke-width': '2' }, s);
        if (RED) { dot.setAttribute('cx', '300'); dot.setAttribute('cy', q[1] === '#FF2442' ? '56' : '94'); continue; }
        var am = sv('animateMotion', { dur: '2.4s', begin: (i * 2.4 / n).toFixed(2) + 's', repeatCount: 'indefinite', rotate: 'auto' }, dot);
        var mp = sv('mpath', null, am); mp.setAttributeNS(XL, 'xlink:href', '#' + q[0]); mp.setAttribute('href', '#' + q[0]);
      }
    });
    [bIn, bOut].forEach(function (b) { var L = b.getTotalLength ? 400 : 400; b.style.strokeDasharray = L; b.style.strokeDashoffset = RED ? 0 : L; b.style.transition = 'stroke-dashoffset 1.2s ease'; });
    /* #21 */
    var inV = +S.incInValue, totV = +S.totalValue, cmp = null;
    if (inV > 0 && totV >= inV && parts.length) {
      cmp = el('div', 'fx3-cmp');
      var big = '<span class="fx3-big">' + wan(inV) + '</span>';
      cmp.innerHTML = '<div class="fx3-h"><span>同一批笔记带来的生意：只看站内 → 算上站外</span>' + big + '</div>';
      var stage = el('div', 'stage', null, cmp);
      var mx = Math.max.apply(null, parts.map(function (p) { return p.inV + p.outV; })) || 1;
      function bars(cls) { var L = el('div', 'layer ' + cls, null, stage); parts.slice(0, 7).forEach(function (p) { var b = el('div', 'bar', null, L); el('i', 'in', null, b).style.height = (p.inV / mx * 92) + 'px'; el('i', 'out', null, b).style.height = (p.outV / mx * 92) + 'px'; }); return L; }
      bars('full'); var only = bars('only');
      el('span', 'tag l', '只看站内 ' + wan(inV), stage); el('span', 'tag r', '站内 + 站外 ' + wan(totV), stage);
      var hd = el('div', 'handle', null, stage);
      el('div', 'fx3-hint', '← 按住分界线往左拖：只看站内时看不见的站外成交，会从虚线里浮出来（红 = ' + esc(p0.inName) + '，蓝 = ' + esc(p0.outName) + '）', cmp);
      var bigEl = cmp.querySelector('.fx3-big');
      var setX = function (x) { x = Math.max(0, Math.min(100, x)); only.style.clipPath = 'inset(0 ' + (100 - x) + '% 0 0)'; hd.style.left = x + '%'; bigEl.textContent = wan(inV + (totV - inV) * (1 - x / 100)); };
      setX(100);
      var drag = false;
      var at = function (e) { var r = stage.getBoundingClientRect(); setX((e.clientX - r.left) / r.width * 100); };
      stage.addEventListener('pointerdown', function (e) { drag = true; try { stage.setPointerCapture(e.pointerId); } catch (x) {} at(e); });
      stage.addEventListener('pointermove', function (e) { if (drag) at(e); });
      stage.addEventListener('pointerup', function () { drag = false; });
      stage.addEventListener('pointercancel', function () { drag = false; });
      cmp.__demo = function () { if (RED) { setX(45); return; } var x = 100; (function step() { if (drag || !cmp.isConnected) return; x -= 2.6; setX(x); if (x > 42) later(step, 30); })(); };
    }
    var body = sec.parentNode; body.insertBefore(fb, sec); if (cmp) body.insertBefore(cmp, sec);
    onVisible(fb, function () { [bIn, bOut].forEach(function (b) { b.style.strokeDashoffset = 0; }); });
    if (cmp) onVisible(cmp, function () { later(cmp.__demo, 500); });
  }

  /* ================= #3 砍价尺 ================= */
  function enhanceKol() {
    $$('#sec-kol .gx-kol').forEach(function (k) {
      if (k.__fx3r) return; k.__fx3r = 1;
      var meta = (k.querySelector('.gx-meta') || k).textContent, all = k.textContent;
      var mq = meta.match(/报价\s*¥([\d,]+)/), mc = all.match(/(?:报价在|谈到)\s*¥([\d,]+)\s*以内/);
      if (!mq || !mc) return;
      var q = +mq[1].replace(/,/g, ''), cl = +mc[1].replace(/,/g, ''); if (!(q > 0 && cl > 0)) return;
      var over = q > cl, mx = Math.ceil(Math.max(q, cl) * 1.18 / 1000) * 1000, P = function (v) { return (v / mx * 100).toFixed(2) + '%'; };
      var r = el('div', 'fx3-ruler');
      var h = '<div class="track"><span class="ok" style="width:' + P(cl) + '"></span>' + (over ? '<span class="over" style="left:' + P(cl) + ';width:calc(' + P(q) + ' - ' + P(cl) + ')"></span>' : '') + '<span class="ceil" style="left:' + P(cl) + '"></span>' +
        [0, mx / 2, mx].map(function (v) { return '<span class="tick" style="left:' + P(v) + '">' + money(v) + '</span>'; }).join('') + '</div>' +
        '<span class="tagp' + (over ? '' : ' good') + '" style="left:' + P(q) + '">报价 ' + money(q) + '</span>' +
        (over ? '<span class="sc" style="left:' + P(q) + '">✂️</span><span class="ka" style="left:' + P(cl) + '">咔！</span>' : '') +
        '<div class="note">' + (over ? '报价超出回本价 <b class="r">' + money(q - cl) + '</b>：剪到 <b>' + money(cl) + '</b> 以内才划算（绿线 = 回本报价）' : '离回本报价还有 <b>' + money(cl - q) + '</b> 余地：这个价格划算（绿线 = 回本报价 ' + money(cl) + '）') + '</div>';
      r.innerHTML = h;
      var stats = k.querySelector('.gx-stats'); if (stats && stats.nextSibling) k.insertBefore(r, stats.nextSibling); else k.appendChild(r);
      if (!over) return;
      onVisible(r, function () {
        var sc = r.querySelector('.sc'), ka = r.querySelector('.ka'), ov = r.querySelector('.over'), tg = r.querySelector('.tagp');
        if (RED) { ov.classList.add('cut'); tg.style.left = P(cl); tg.textContent = '谈到 ' + money(cl); tg.classList.add('good'); return; }
        later(function () { sc.classList.add('on'); }, 300);
        later(function () { sc.style.left = P(cl); }, 600);
        later(function () { ka.classList.add('on'); ov.classList.add('cut'); }, 1500);
        later(function () { tg.style.left = P(cl); tg.textContent = '谈到 ' + money(cl); tg.classList.add('good'); sc.classList.remove('on'); }, 1800);
        later(function () { ka.classList.remove('on'); }, 2600);
      });
    });
  }

  /* ================= #4 拉幕（第一次进幕后） ================= */
  var CURTAIN = false;
  function curtainOnClick(e) {
    if (CURTAIN || RED) return; var b = e.target.closest && e.target.closest('.tb-behind'); if (!b) return;
    CURTAIN = true;
    var c = el('div', 'fx3-curtain', '<i class="l"></i><i class="r"></i><b>幕 后</b>'); document.body.appendChild(c);
    later(function () { c.classList.add('open'); }, 380);
    later(function () { if (c.parentNode) c.remove(); }, 1300);
  }

  /* ================= #5 商家 ⇄ 客户经理 翻面 ================= */
  function flipOnClick(e) {
    var b = e.target.closest && e.target.closest('.seg-btn'); if (!b || RED) return;
    var t = b.textContent.trim(); if (!/^(商家|客户经理)$/.test(t) || b.classList.contains('active')) return;
    later(function () { var m = document.getElementById('main'); if (!m) return; m.classList.remove('fx3-flip'); void m.offsetWidth; m.classList.add('fx3-flip'); later(function () { m.classList.remove('fx3-flip'); }, 650); }, 20);
  }

  /* ================= #6 海报：显影 + 日期印章 + 镭射 ================= */
  function stampDraw(g, cx, cy, r, date) {
    g.save(); g.translate(cx, cy); g.rotate(-12 * Math.PI / 180);
    g.strokeStyle = 'rgba(255,77,94,.92)'; g.fillStyle = 'rgba(255,77,94,.92)';
    g.lineWidth = r * 0.075; g.beginPath(); g.arc(0, 0, r, 0, Math.PI * 2); g.stroke();
    g.lineWidth = r * 0.03; g.beginPath(); g.arc(0, 0, r * 0.82, 0, Math.PI * 2); g.stroke();
    g.textAlign = 'center'; g.textBaseline = 'middle';
    g.font = '800 ' + Math.round(r * 0.34) + 'px -apple-system,"PingFang SC","Microsoft YaHei",sans-serif'; g.fillText('观潮核账', 0, -r * 0.12);
    g.font = '700 ' + Math.round(r * 0.19) + 'px -apple-system,"PingFang SC",sans-serif'; g.fillText(date, 0, r * 0.3);
    g.font = '700 ' + Math.round(r * 0.18) + 'px sans-serif'; g.fillText('★', 0, -r * 0.55);
    g.restore();
  }
  function enhancePoster() {
    var img = $('.gp-mask .gp-img'); if (!img || img.__fx3p) return; img.__fx3p = 1;
    var wrap = el('div', 'fx3-holo' + (RED ? '' : ' dev')); img.parentNode.insertBefore(wrap, img); wrap.appendChild(img);
    var sheen = el('div', 'sheen' + (RED ? '' : ' auto'), null, wrap);
    if (HOVER && !RED) {
      wrap.addEventListener('mousemove', function (e) { var r = wrap.getBoundingClientRect(), x = (e.clientX - r.left) / r.width, y = (e.clientY - r.top) / r.height; wrap.style.transform = 'perspective(900px) rotateX(' + ((0.5 - y) * 9).toFixed(2) + 'deg) rotateY(' + ((x - 0.5) * 11).toFixed(2) + 'deg)'; sheen.classList.remove('auto'); sheen.style.setProperty('--sx', (x * 100).toFixed(1) + '%'); });
      wrap.addEventListener('mouseleave', function () { wrap.style.transform = ''; });
    }
    var dt = new Date(), date = dt.getFullYear() + '.' + String(dt.getMonth() + 1).padStart(2, '0') + '.' + String(dt.getDate()).padStart(2, '0');
    function go() {
      var W = img.naturalWidth, H = img.naturalHeight; if (!W || !H) return;
      var cx = W * 0.8, cy = H * 0.255, rr = W * 0.085;
      var full = document.createElement('canvas'); full.width = W; full.height = H; var g = full.getContext('2d'); g.drawImage(img, 0, 0); stampDraw(g, cx, cy, rr, date);
      var url; try { url = full.toDataURL('image/png'); } catch (e) { return; }
      var swap = function () { img.src = url; var a = $('.gp-mask .gp-save'); if (a) a.href = url; };
      if (RED) { swap(); return; }
      later(function () {
        if (!wrap.isConnected) return;
        var sc = wrap.clientWidth / W, d = Math.ceil(rr * 2.4);
        var st = document.createElement('canvas'); st.width = d; st.height = d; stampDraw(st.getContext('2d'), d / 2, d / 2, rr, date);
        st.className = 'fx3-stamp'; st.style.width = (d * sc) + 'px'; st.style.height = (d * sc) + 'px'; st.style.left = ((cx - d / 2) * sc) + 'px'; st.style.top = ((cy - d / 2) * sc) + 'px';
        st.style.animation = 'none'; wrap.appendChild(st);
        st.animate([{ transform: 'scale(2.6) rotate(-18deg)', opacity: 0 }, { opacity: 1, offset: 0.7 }, { transform: 'scale(1) rotate(0deg)', opacity: 1 }], { duration: 460, easing: 'cubic-bezier(.3,1.5,.5,1)', fill: 'both' });
        later(function () { swap(); later(function () { if (st.parentNode) st.remove(); }, 120); }, 520);
      }, 1250);
    }
    if (img.complete && img.naturalWidth) go(); else img.addEventListener('load', function once() { img.removeEventListener('load', once); go(); });
  }

  /* ================= #7 排序平滑 ================= */
  function sortOnClick(e) {
    var b = e.target.closest && e.target.closest('#main .seg-btn'); if (!b || RED) return;
    if (!/^(按时间|按效果)$/.test(b.textContent.trim()) || b.classList.contains('active')) return;
    var old = {}; $$('#main .nt-row').forEach(function (r) { old[r.getAttribute('data-i')] = r.getBoundingClientRect().top; });
    later(function () {
      var rows = $$('#main .nt-row');
      rows.forEach(function (r) { var o = old[r.getAttribute('data-i')]; if (o == null) return; var dy = o - r.getBoundingClientRect().top; if (Math.abs(dy) < 2) return; r.style.transition = 'none'; r.style.transform = 'translateY(' + dy + 'px)'; });
      void document.body.offsetWidth;
      rows.forEach(function (r, i) { if (!r.style.transform) return; r.classList.add('fx3-mv'); r.style.transition = ''; r.style.transitionDelay = Math.min(i * 0.02, 0.2) + 's'; r.style.transform = ''; later(function () { r.classList.remove('fx3-mv'); r.style.transitionDelay = ''; }, 900); });
    }, 40);
  }

  /* ================= #8 排行榜赛跑 ================= */
  function enhanceTypes() {
    var card = document.getElementById('card-types'); if (!card || card.__fx3t) return; card.__fx3t = 1;
    var rows = $$('.tp-row', card); if (rows.length < 2 || RED) return;
    var tops = rows.map(function (r) { return r.offsetTop; }), n = rows.length, bars = rows.map(function (r) { return r.querySelector('.tp-bar i'); });
    var ws = bars.map(function (b) { return b ? b.style.width : ''; });
    card.classList.add('fx3-crown-wait');
    rows.forEach(function (r, i) { r.style.transition = 'none'; r.style.transform = 'translateY(' + (tops[n - 1 - i] - tops[i]) + 'px)'; if (bars[i]) { bars[i].style.transition = 'none'; bars[i].style.width = '0%'; } });
    void card.offsetWidth;
    later(function () {
      rows.forEach(function (r, i) { r.classList.add('fx3-race'); r.style.transition = ''; r.style.transform = ''; if (bars[i]) { bars[i].style.transition = ''; bars[i].style.transitionDelay = (0.05 + Math.random() * 0.2).toFixed(2) + 's'; bars[i].style.width = ws[i]; } });
    }, 90);
    later(function () { card.classList.remove('fx3-crown-wait'); var cr = card.querySelector('.tp-crown'); if (cr) { cr.classList.remove('fx3-crown'); void cr.offsetWidth; cr.classList.add('fx3-crown'); } }, 1150);
  }

  /* ================= #9 翻案印章 ================= */
  var FAN = {};
  function enhanceFan() {
    var tags = $$('#main .nt-mis').filter(function (t) { return !t.__fx3n; }); if (!tags.length) return;
    var shop = shopName() || '_'; var first = !FAN[shop]; FAN[shop] = 1;
    tags.forEach(function (t, i) {
      t.__fx3n = 1; if (!first || RED) return;
      var dl = 0.6 + i * 0.35; t.classList.add('fx3-has-fan');
      var s = el('span', 'fx3-fan', '翻案', t); s.style.animationDelay = dl + 's';
      var row = t.closest('.nt-row'); if (row) later(function () { row.classList.add('fx3-thud'); later(function () { row.classList.remove('fx3-thud'); }, 400); }, dl * 1000 + 250);
    });
  }

  /* ================= 大图工具：#20 回放 · #19 你来画 · #10 假日期纸船 ================= */
  var CHART_BUSY = false;
  function parsePts(node) { if (!node) return []; return (node.getAttribute('points') || '').trim().split(/\s+/).map(function (p) { var a = p.split(','); return { x: +a[0], y: +a[1] }; }).filter(function (p) { return isFinite(p.x) && isFinite(p.y); }); }
  function geom() {
    var box = $('#main .nt-chart-box'), svg = box && box.querySelector('svg:not(.fx3-ov)'); if (!svg) return null;
    var real = parsePts(svg.querySelector('.nt-real')), base = parsePts(svg.querySelector('.nt-base')); if (real.length < 10) return null;
    var vb = (svg.getAttribute('viewBox') || '0 0 990 252').split(/[\s,]+/).map(Number);
    var labs = $$('.nt-ax-y', svg).map(function (t) { return { v: parseFloat(t.textContent), y: +t.getAttribute('y') - 4 }; }).filter(function (o) { return isFinite(o.v); });
    var upx = labs.length >= 2 ? Math.abs((labs[1].v - labs[0].v) / (labs[1].y - labs[0].y)) : null;
    return { box: box, svg: svg, real: real, base: base, vb: vb, upx: upx };
  }
  function overlay(g) {
    var ov = sv('svg', { viewBox: g.vb.join(' '), 'class': 'fx3-ov', 'aria-hidden': 'true' });
    var a = g.svg.getBoundingClientRect(), b = g.box.getBoundingClientRect(); ov.style.left = (a.left - b.left + g.box.scrollLeft) + 'px'; ov.style.top = (a.top - b.top + g.box.scrollTop) + 'px'; ov.style.width = a.width + 'px'; ov.style.height = a.height + 'px';
    g.box.appendChild(ov); return ov;
  }
  function busy(on) { CHART_BUSY = on; $$('.fx3-tools button').forEach(function (b) { b.disabled = on; }); }
  function bgOf(node) { var c = node && node.closest('.card'); var b = c ? getComputedStyle(c).backgroundColor : ''; return b && b !== 'rgba(0, 0, 0, 0)' ? b : '#fff'; }
  function enhanceChartTools() {
    var box = $('#main .nt-chart-box'); if (!box) return; var card = box.closest('.card'); if (!card || card.__fx3c) return; card.__fx3c = 1;
    var c = ctx(); var N = c ? c.r.dates.length : 126;
    var tl = el('div', 'fx3-tools');
    var b1 = el('button', '', '▶ 回放这 ' + N + ' 天', tl); b1.type = 'button';
    var b2 = el('button', '', '✏️ 你来画「平时的样子」', tl); b2.type = 'button';
    var b3 = el('button', '', '⛵ 假日期检验', tl); b3.type = 'button';
    b1.onclick = replay; b2.onclick = drawGame; b3.onclick = boats;
    var hr = card.querySelector('.h2-row'); if (hr && hr.nextSibling) card.insertBefore(tl, hr.nextSibling); else card.insertBefore(tl, card.firstChild);
  }
  function noteCum(c, N) {
    var W = c.r.window || 7, inc = new Array(N).fill(0);
    (c.r.notes || []).forEach(function (n) { if (!(n.total > 0) || n.p == null) return; var e = Math.min(N, n.p + W), L = e - n.p; for (var t = n.p; t < e; t++) inc[t] += n.total / L; });
    var cum = [], s = 0; for (var t = 0; t < N; t++) { s += inc[t]; cum.push(s); } return cum;
  }
  function replay() {
    if (CHART_BUSY) return; var g = geom(), c = ctx(); if (!g || !c) return; busy(true);
    var N = g.real.length, S = c.r.summary || {}, M = metricOf(c), ov = overlay(g);
    sv('rect', { x: String(g.real[0].x - 2), y: '0', width: String(g.real[N - 1].x - g.real[0].x + 8), height: '232', fill: bgOf(g.box) }, ov);
    $$('.nt-grid', g.svg).forEach(function (l) { ov.appendChild(l.cloneNode(true)); });
    var pb = sv('polyline', { fill: 'none', stroke: '#9A9AA4', 'stroke-width': '1.6', 'stroke-dasharray': '4 3' }, ov);
    var pr = sv('polyline', { fill: 'none', stroke: '#FF2442', 'stroke-width': '2.2', 'stroke-linejoin': 'round' }, ov);
    var rip = sv('g', null, ov);
    var cnt = el('div', 'fx3-cnt', '种草多带来 <b>0</b> 个' + esc(M), g.box), cb = cnt.querySelector('b');
    var cum = noteCum(c, N), tot = cum[N - 1] || 1, target = S.totalInc || tot, byP = {};
    (c.r.notes || []).forEach(function (n, i) { if (n.p != null) (byP[n.p] = byP[n.p] || []).push(i); });
    var dots = {}; $$('.nt-dot', g.svg).forEach(function (d) { dots[d.getAttribute('data-i')] = d; });
    var i = 0, step = Math.max(16, Math.round(6000 / N)), ar = [], ab = [];
    function done() { cb.textContent = Math.round(target); later(function () { ov.style.transition = cnt.style.transition = 'opacity .5s'; ov.style.opacity = cnt.style.opacity = '0'; later(function () { ov.remove(); cnt.remove(); busy(false); }, 520); }, 1300); }
    (function tick() {
      if (!ov.isConnected) { cnt.remove(); busy(false); return; }
      for (var k = 0; k < (RED ? N : 1) && i < N; k++, i++) {
        ar.push(g.real[i].x + ',' + g.real[i].y); if (g.base[i]) ab.push(g.base[i].x + ',' + g.base[i].y);
        (byP[i] || []).forEach(function (ni) {
          var d = dots[String(ni)], x = g.real[i].x, y = g.real[i].y;
          if (d) { var cl = d.cloneNode(true); cl.removeAttribute('data-i'); ov.appendChild(cl); if (!RED) cl.animate([{ transform: 'scale(0)', transformOrigin: d.getAttribute('cx') + 'px ' + d.getAttribute('cy') + 'px' }, { transform: 'scale(1)', transformOrigin: d.getAttribute('cx') + 'px ' + d.getAttribute('cy') + 'px' }], { duration: 300, easing: 'cubic-bezier(.3,1.6,.5,1)' }); }
          if (!RED) { var cc = sv('circle', { cx: String(x), cy: String(y), r: '3', fill: 'none', stroke: '#FF2442', 'stroke-width': '2' }, rip); cc.animate([{ r: 3, opacity: 0.9 }, { r: 28, opacity: 0 }], { duration: 900, easing: 'ease-out', fill: 'forwards' }); }
        });
      }
      pr.setAttribute('points', ar.join(' ')); pb.setAttribute('points', ab.join(' '));
      cb.textContent = Math.round(cum[Math.min(i, N) - 1] / tot * target);
      if (i < N) later(tick, step); else done();
    })();
  }
  function drawGame() {
    if (CHART_BUSY) return; var g = geom(), c = ctx(); if (!g || !c || g.base.length < 10) return; busy(true);
    var M = metricOf(c), N = g.real.length, x0 = g.real[0].x, x1 = g.real[N - 1].x;
    g.svg.classList.add('fx3-hidebase');
    var ov = overlay(g); ov.classList.add('draw');
    var panel = el('div', 'fx3-panel', '按住鼠标（手机用手指），从左往右画出你猜的「平时的样子」：<br>不发笔记、不投流时，每天本来会有多少' + esc(M), g.box);
    var pts = [], line = null, drawing = false;
    function P(e) { var m = ov.getScreenCTM(); if (!m) return null; var p = ov.createSVGPoint(); p.x = e.clientX; p.y = e.clientY; p = p.matrixTransform(m.inverse()); return { x: Math.max(x0, Math.min(x1, p.x)), y: p.y }; }
    function cleanup() { ov.remove(); panel.remove(); g.svg.classList.remove('fx3-hidebase'); busy(false); }
    function finish() {
      drawing = false; if (pts.length < 4) return;
      var xs = pts.slice().sort(function (a, b) { return a.x - b.x; }), lo = xs[0].x, hi = xs[xs.length - 1].x;
      if (hi - lo < (x1 - x0) * 0.3) { panel.innerHTML = '画得太短了：至少画满三分之一的宽度再松手'; if (line) line.remove(); line = null; pts = []; return; }
      var yAt = function (x) { for (var j = 1; j < xs.length; j++) if (xs[j].x >= x) { var a = xs[j - 1], b = xs[j], t = b.x === a.x ? 0 : (x - a.x) / (b.x - a.x); return a.y + (b.y - a.y) * t; } return xs[xs.length - 1].y; };
      var diffs = []; g.base.forEach(function (p) { if (p.x >= lo && p.x <= hi) diffs.push(Math.abs(yAt(p.x) - p.y)); });
      var avg = diffs.reduce(function (s, v) { return s + v; }, 0) / Math.max(1, diffs.length), score = Math.round(100 * Math.exp(-avg / 35));
      var bl = sv('polyline', { points: g.base.map(function (p) { return p.x + ',' + p.y; }).join(' '), fill: 'none', stroke: '#4C6FFF', 'stroke-width': '2.6', 'stroke-dasharray': '5 4' }, ov);
      if (!RED) { bl.style.clipPath = 'inset(0 100% 0 0)'; bl.animate([{ clipPath: 'inset(0 100% 0 0)' }, { clipPath: 'inset(0 0% 0 0)' }], { duration: 1200, easing: 'ease-in-out', fill: 'forwards' }); }
      var du = g.upx ? '平均每天差约 ' + f1(avg * g.upx) + ' 个' + esc(M) : '';
      var word = score >= 80 ? '眼力很准！' : score >= 60 ? '还不错。' : '平时的样子比看上去难猜，这正是要让算法来量的原因。';
      later(function () {
        panel.innerHTML = '眼力分 <b>' + score + '</b> / 100<br>蓝色虚线是观潮算出的「平时的样子」，' + du + '。' + word + '<br><button type="button" data-a="re">再画一次</button><button type="button" data-a="x">收起</button>';
        panel.querySelector('[data-a="re"]').onclick = function () { cleanup(); later(drawGame, 30); };
        panel.querySelector('[data-a="x"]').onclick = cleanup;
      }, RED ? 0 : 1100);
      ov.classList.remove('draw');
    }
    ov.addEventListener('pointerdown', function (e) { if (!ov.classList.contains('draw')) return; e.preventDefault(); drawing = true; pts = []; if (line) line.remove(); line = sv('polyline', { fill: 'none', stroke: '#17171C', 'stroke-width': '2.6', 'stroke-linecap': 'round', 'stroke-linejoin': 'round' }, ov); try { ov.setPointerCapture(e.pointerId); } catch (x) {} var p = P(e); if (p) pts.push(p); });
    ov.addEventListener('pointermove', function (e) { if (!drawing) return; var p = P(e); if (!p) return; var last = pts[pts.length - 1]; if (last && Math.abs(p.x - last.x) + Math.abs(p.y - last.y) < 2) return; pts.push(p); line.setAttribute('points', pts.map(function (q) { return q.x.toFixed(1) + ',' + q.y.toFixed(1); }).join(' ')); });
    ov.addEventListener('pointerup', finish); ov.addEventListener('pointercancel', function () { drawing = false; });
  }
  function boats() {
    if (CHART_BUSY) return; var g = geom(), c = ctx(), E = LE(); if (!g || !c || !E || !E.placebo) return; busy(true);
    var res; try { res = E.placebo(c.r); } catch (e) { busy(false); return; }
    var N = g.real.length, W = c.r.window || 7, ov = overlay(g), idx = {}; c.r.dates.forEach(function (d, i) { idx[d] = i; });
    var panel = el('div', 'fx3-panel', '在没发笔记、没投流的日子插假笔记，看观潮会不会上当…', g.box);
    var gap = RED ? 0 : Math.max(90, Math.min(200, Math.round(3200 / Math.max(1, res.tests.length))));
    res.tests.forEach(function (t, k) {
      var i = idx[t.date]; if (i == null) return; var j = Math.min(N - 1, i + Math.floor(W / 2)), x = g.real[j].x, y = Math.max(22, Math.min(g.real[j].y, (g.base[j] || g.real[j]).y) - 14), bad = t.verdict === 'real';
      later(function () {
        var outer = sv('g', { transform: 'translate(' + x + ',' + y + ')' }, ov), inner = sv('g', { 'class': 'fx3-boat' }, outer);
        sv('path', { d: 'M-9 0 L9 0 L6 5 L-6 5 Z', fill: '#fff', stroke: bad ? '#FF2442' : '#4C6FFF', 'stroke-width': '1.4', 'stroke-dasharray': '2.5 2' }, inner);
        sv('path', { d: 'M0 0 L0 -11 L7 -2 Z', fill: '#fff', stroke: bad ? '#FF2442' : '#4C6FFF', 'stroke-width': '1.3', 'stroke-dasharray': '2.5 2' }, inner);
        if (!RED) inner.animate([{ transform: 'translateY(-8px)', opacity: 0 }, { transform: 'none', opacity: 1 }], { duration: 260, easing: 'ease-out' });
        later(function () { var m = sv('text', { x: '0', y: '-15', 'text-anchor': 'middle', 'font-size': '11', 'font-weight': '800', fill: bad ? '#FF2442' : '#16A05D' }, inner); m.textContent = bad ? '✕' : '✓'; if (!bad) later(function () { inner.classList.add('sink'); }, 420); }, RED ? 0 : 380);
      }, k * gap);
    });
    later(function () {
      var n = res.tries, p = res.expected || 0.05, cumP = 0, m = 0, comb = 1;
      for (var a = 0; a <= n; a++) { if (a > 0) comb = comb * (n - a + 1) / a; cumP += comb * Math.pow(p, a) * Math.pow(1 - p, n - a); if (cumP >= 0.95) { m = a; break; } }
      var ok = res.alarms <= m;
      panel.innerHTML = '插了 <b>' + n + '</b> 个假日期：' + res.alarms + ' 篇被误判成「真有效」<br>按 5% 的误判率，' + n + ' 次里 0～' + m + ' 次都正常：' + (ok ? '在正常范围内 ✓' : '偏多，需要复查') + '<br><button type="button" data-a="x">收起</button>';
      panel.querySelector('[data-a="x"]').onclick = function () { ov.remove(); panel.remove(); busy(false); };
    }, res.tests.length * gap + (RED ? 0 : 900));
  }

  /* ================= #11 48 小时表盘 ================= */
  function enhanceDial() {
    var h2 = $$('#main h2').filter(function (h) { return /新笔记发出两天了/.test(h.textContent) && !h.__fx3d; })[0]; if (!h2) return; h2.__fx3d = 1;
    var s = sv('svg', { viewBox: '0 0 22 22', 'class': 'fx3-dial', 'aria-hidden': 'true' }); h2.appendChild(s);
    var t = sv('title', null, s); t.textContent = '48 小时';
    sv('circle', { cx: '11', cy: '11', r: '9.2', fill: '#fff', stroke: '#D9D9E0', 'stroke-width': '1.6' }, s);
    [0, 90, 180, 270].forEach(function (a) { sv('line', { x1: '11', y1: '3.4', x2: '11', y2: '5.2', stroke: '#B9BCC8', 'stroke-width': '1.2', transform: 'rotate(' + a + ' 11 11)' }, s); });
    sv('line', { x1: '11', y1: '11', x2: '11', y2: '4.6', stroke: '#FF2442', 'stroke-width': '1.8', 'stroke-linecap': 'round', 'class': 'hand' }, s);
    sv('circle', { cx: '11', cy: '11', r: '1.4', fill: '#17171C' }, s);
    if (RED) return;
    var sec = h2.closest('section') || h2.parentNode, shell = (sec && sec.querySelector('.tlight-shell')) || $('#main .tlight-shell');
    if (shell) { shell.classList.add('fx3-hold'); later(function () { shell.classList.remove('fx3-hold'); }, 1300); }
  }

  /* ================= #12 数字校验扫光 ================= */
  function enhanceVerifySweep() {
    var ns = $$('.rg-n:not(.rg-bad)').filter(function (n) { return !n.__fx3s; }); if (!ns.length) return;
    var groups = []; ns.forEach(function (n) { n.__fx3s = 1; var k = n.parentNode; var g = groups.filter(function (x) { return x.k === k; })[0]; if (!g) { g = { k: k, a: [] }; groups.push(g); } g.a.push(n); });
    if (RED) return;
    groups.forEach(function (g) { g.a.forEach(function (n, i) { n.style.setProperty('--d', (0.15 + i * 0.12).toFixed(2) + 's'); n.classList.add('fx3-sw'); }); });
  }

  /* ================= #13 侦探换关：潮水冲刷 ================= */
  function washOnClick(e) {
    var nb = e.target.closest && e.target.closest('#gcd-stage [data-next]'); if (!nb || RED) return;
    var stage = document.getElementById('gcd-stage'), root = document.getElementById('gcd'); if (!stage || !root) return;
    var r = stage.getBoundingClientRect(); if (!r.width) return;
    var w = el('div', 'fx3-wash'); w.style.left = r.left + 'px'; w.style.top = r.top + 'px'; w.style.width = r.width + 'px'; w.style.height = r.height + 'px';
    var snap = stage.cloneNode(true); snap.removeAttribute('id'); $$('[id]', snap).forEach(function (x) { x.removeAttribute('id'); });
    snap.classList.add('snap'); snap.classList.remove('gcd-in'); snap.style.margin = '0'; snap.style.boxSizing = 'border-box'; snap.style.overflow = 'hidden'; snap.style.clipPath = 'inset(0 0 0 0)';
    w.appendChild(snap); var fr = el('div', 'front', null, w); root.appendChild(w);
    later(function () { snap.style.clipPath = 'inset(0 100% 0 0)'; fr.style.right = 'calc(100% - 45px)'; }, 30);
    later(function () { if (w.parentNode) w.remove(); }, 900);
  }

  /* ================= #14 第 3 关店主表情 ================= */
  function enhanceFace() {
    var inp = document.getElementById('gcd-p'); if (!inp || inp.__fx3f) return; inp.__fx3f = 1;
    var be, cost; try { var k = LE().story(SAMP()).merchant.kol; be = Math.round(k.breakEven); cost = Math.round(k.cost); } catch (e) { return; }
    if (!(be > 0 && cost > 0)) return;
    var face = el('span', 'fx3-face'); face.setAttribute('aria-hidden', 'true'); inp.parentNode.insertBefore(face, inp);
    var mx = +inp.max || cost * 1.5;
    function up() {
      var v = +inp.value; face.classList.remove('happy', 'sweat');
      if (v <= be) { face.textContent = '😄'; if (!RED) face.classList.add('happy'); }
      else if (v < cost) { face.textContent = '😅'; face.style.setProperty('--k', (0.4 + (v - be) / Math.max(1, cost - be) * 0.8).toFixed(2)); if (!RED) face.classList.add('sweat'); }
      else { face.textContent = '😰'; face.style.setProperty('--k', (1.3 + Math.min(1, (v - cost) / Math.max(1, mx - cost)) * 1.4).toFixed(2)); if (!RED) face.classList.add('sweat'); }
    }
    inp.addEventListener('input', up); up();
  }

  /* ================= #15 身份卡 3D · #16 水波 · #27 月光 · #28 星光 ================= */
  function enhanceDetective() {
    var root = document.getElementById('gcd'); if (!root) return;
    if (!root.__fx3r) {
      root.__fx3r = 1;
      if (!RED) { var rays = el('div', 'fx3-rays'); rays.setAttribute('aria-hidden', 'true'); [[8, -2], [30, -5], [55, -1], [78, -6]].forEach(function (a) { var i = el('i', '', null, rays); i.style.left = a[0] + '%'; i.style.animationDelay = a[1] + 's'; }); root.insertBefore(rays, root.firstChild); }
      if (HOVER && !RED) {
        var lastR = 0;
        root.addEventListener('mousemove', function (e) { if (root.classList.contains('gcd-level')) return; var now = Date.now(); if (now - lastR < 90) return; lastR = now; var r = el('span', 'fx3-rip'); r.style.left = e.clientX + 'px'; r.style.top = e.clientY + 'px'; root.insertBefore(r, root.firstChild); later(function () { r.remove(); }, 1150); });
      }
    }
    if (HOVER && !RED) $$('.gcd-id', root).forEach(function (b) {
      if (b.__fx3t) return; b.__fx3t = 1; b.classList.add('fx3-tilt'); el('span', 'fx3-gloss', null, b);
      b.addEventListener('mousemove', function (e) { var r = b.getBoundingClientRect(), x = (e.clientX - r.left) / r.width, y = (e.clientY - r.top) / r.height; b.style.transform = 'perspective(700px) rotateX(' + ((0.5 - y) * 10).toFixed(2) + 'deg) rotateY(' + ((x - 0.5) * 12).toFixed(2) + 'deg) translateY(-2px)'; b.style.setProperty('--gx', (x * 100).toFixed(0) + '%'); b.style.setProperty('--gy', (y * 100).toFixed(0) + '%'); });
      b.addEventListener('mouseleave', function () { b.style.transform = ''; });
    });
    var h1 = $('#gcd-stage .gcd-h1'); if (h1 && !h1.__fx3s && /「金牌/.test(h1.textContent)) {
      h1.__fx3s = 1;
      var w = document.createTreeWalker(h1, NodeFilter.SHOW_TEXT, null, false), tn;
      while ((tn = w.nextNode())) { var i0 = tn.data.indexOf('「金牌'); if (i0 < 0) continue; var i1 = tn.data.indexOf('」', i0); if (i1 < 0) continue;
        var mid = tn.splitText(i0); mid.splitText(i1 - i0 + 1); var sp = el('span', 'fx3-spark'); mid.parentNode.insertBefore(sp, mid); sp.appendChild(mid);
        if (!RED) [[-6, -30, 12], [18, -48, 10], [52, -38, 13], [86, -28, 11], [102, 30, 10], [-10, 55, 9], [40, 80, 10]].forEach(function (a, k) { var st = el('span', 'st', null, sp); st.setAttribute('aria-hidden', 'true'); st.style.left = a[0] + '%'; st.style.top = a[1] + '%'; st.style.fontSize = Math.round(a[2] * 1.35) + 'px'; st.style.animationDelay = (k * 0.23).toFixed(2) + 's'; });
        break; }
    }
  }

  /* ================= #17 小红书笔记小卡（示意） ================= */
  var TYPE_IC = { '经验故事': '📖', '干货清单': '📋', '测评对比': '⚖️', '场景种草': '🌿', '送礼清单': '🎁', '教程': '✏️', '避坑': '⚠️', '合集': '🗂️' };
  function enhanceXhs() {
    var head = $('.exd-panel .exd-head'); if (!head || head.__fx3x) return; head.__fx3x = 1;
    var c = ctx(); if (!c) return; var tt = (head.querySelector('.exd-title') || {}).textContent || '';
    var n = (c.r.notes || []).filter(function (x) { return x.title === tt; })[0]; if (!n) return;
    var te = head.querySelector('.nt-type'), col = te ? getComputedStyle(te).color : 'rgb(255,36,66)', m = col.match(/\d+/g) || [255, 36, 66];
    var rgb = m.slice(0, 3).join(','), typ = n.type || (te && te.textContent) || '笔记', M = metricOf(c);
    var hot = n.total > 0 ? '♥ 热度 +' + f1(n.total) + ' 个' + esc(M) : '♥ 热度 —';
    var card = el('div', 'fx3-xhs', '<div class="cv" style="background:linear-gradient(150deg,rgba(' + rgb + ',.95),rgba(' + rgb + ',.35))">' + (TYPE_IC[typ] || '✨') + '<span>' + esc(typ) + '</span></div>' +
      '<div class="mt"><div class="tt">' + esc(tt) + '</div><div class="ft"><span>● ' + esc((c.sample && c.sample.name) || shopName()) + '</span><span class="hot">' + hot + '</span></div>' +
      '<div style="font-size:11px;color:#9A9AA4">在小红书里大概长这样，"热度"就是这篇多带来的量<span class="sy">示意</span></div></div>');
    head.parentNode.insertBefore(card, head.nextSibling);
  }

  /* ================= #18 已复制小红心 ================= */
  function enhanceHeart() {
    var ts = $$('#toast.show, .gca-toast'); $$('#main .pp-copy, .pp-copy').forEach(function (b) { ts.push(b); });
    ts.forEach(function (t) { if (!/已复制/.test(t.textContent) || t.querySelector('.fx3-heart')) return; el('span', 'fx3-heart', '❤', t); });
  }

  /* ================= #22 架构图光束 ================= */
  function enhanceBeam() {
    var s = $('svg.rg-arch'); if (!s || s.__fx3b) return; s.__fx3b = 1; if (RED) return;
    var boxes = $$('g.rg-ab', s).map(function (g) { var r = g.querySelector('rect'); return { x: +r.getAttribute('x') + (+r.getAttribute('width')) / 2, y: +r.getAttribute('y') + (+r.getAttribute('height')) / 2, t: g.textContent }; }).sort(function (a, b) { return a.x - b.x; });
    if (boxes.length < 3) return; var y = boxes[0].y, id = 'fx3b' + (++UID);
    sv('path', { id: id + 'm', d: 'M' + boxes[0].x + ' ' + y + ' L' + boxes[boxes.length - 1].x + ' ' + y, fill: 'none', stroke: 'none' }, s);
    function rider(pid, color, r, dur, begin, keyP, keyT, opV, opT) {
      var c = sv('circle', { r: String(r), fill: color, 'class': 'fx3-beam-dot', opacity: '0' }, s);
      var am = sv('animateMotion', { dur: dur, begin: begin, repeatCount: 'indefinite' }, c);
      if (keyP) { am.setAttribute('keyPoints', keyP); am.setAttribute('keyTimes', keyT); am.setAttribute('calcMode', 'linear'); }
      var mp = sv('mpath', null, am); mp.setAttributeNS(XL, 'xlink:href', '#' + pid); mp.setAttribute('href', '#' + pid);
      sv('animate', { attributeName: 'opacity', values: opV, keyTimes: opT, dur: dur, begin: begin, repeatCount: 'indefinite' }, c);
    }
    rider(id + 'm', '#16A05D', 5, '3.6s', '0s', null, null, '0;1;1;0', '0;0.05;0.9;1');
    rider(id + 'm', '#16A05D', 4, '3.6s', '1.8s', null, null, '0;1;1;0', '0;0.05;0.9;1');
    var ai = boxes.filter(function (b) { return /大模型/.test(b.t); })[0], vf = boxes.filter(function (b) { return /校验/.test(b.t); })[0];
    if (ai && vf) {
      sv('path', { id: id + 'r', d: 'M' + ai.x + ' ' + y + ' L' + vf.x + ' ' + y + ' L' + vf.x + ' 26 L' + ai.x + ' 26 L' + ai.x + ' ' + (y - 8), fill: 'none', stroke: 'none' }, s);
      rider(id + 'r', '#FF2442', 5, '6s', '1s', '0;1;1', '0;0.55;1', '0;1;1;0;0', '0;0.04;0.53;0.56;1');
    }
  }

  /* ================= #23 荧光笔 ================= */
  var HL_RE = /(不是小红书不带货[^。！\n]*[。！]|问题不在小红书[^。\n]*。)/;
  function enhanceHL() {
    var pending = false, now = Date.now(), hits = [];
    var w = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, { acceptNode: function (n) { var p = n.parentNode; if (!p || /^(SCRIPT|STYLE|TEXTAREA|MARK|TITLE)$/.test(p.nodeName)) return NodeFilter.FILTER_REJECT; return HL_RE.test(n.data) ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_SKIP; } }, false), tn;
    while ((tn = w.nextNode())) hits.push(tn);
    hits.forEach(function (n) {
      var p = n.parentNode; if (!p || (p.closest && p.closest('mark.fx3-hl'))) return;
      var txt = p.textContent; if (p.__fx3txt !== txt) { p.__fx3txt = txt; p.__fx3ts = now; pending = true; return; }
      if (now - p.__fx3ts < 600) { pending = true; return; }
      var m = n.data.match(HL_RE); if (!m) return; var a = n.splitText(m.index); a.splitText(m[0].length);
      var mk = document.createElement('mark'); mk.className = 'fx3-hl'; if (RED) mk.style.animation = 'none', mk.style.backgroundSize = '100% 70%'; p.insertBefore(mk, a); mk.appendChild(a);
    });
    if (pending) later(kick, 700);
  }

  /* ================= #26 标语轮换 ================= */
  function enhanceTagline() {
    var s = $('.brand-sub'); if (!s || s.__fx3w) return; s.__fx3w = 1;
    s.innerHTML = '从种草到成交的全域账 · 算清每一<span class="fx3-rot"><i class="on">篇笔记</i><i>笔投流</i><i>位达人</i></span>带来的生意';
    if (RED) return; var k = 0;
    setInterval(function () { var it = $$('.fx3-rot i', s); if (it.length < 3 || document.hidden) return; var cur = it[k % 3], nx = it[(k + 1) % 3]; cur.classList.remove('on'); cur.classList.add('out'); nx.classList.remove('out'); nx.classList.add('on'); later(function () { cur.classList.remove('out'); }, 460); k++; }, 2400);
  }

  /* ================= #29 滚动水位线 ================= */
  var BAR = null;
  function onScroll(e) {
    if (!BAR) { BAR = el('div', 'fx3-scroll'); BAR.setAttribute('aria-hidden', 'true'); document.body.appendChild(BAR); }
    var t = e && e.target && e.target.nodeType === 1 ? e.target : document.scrollingElement;
    if (t !== document.scrollingElement && !(t.classList && t.classList.contains('gp'))) return;
    var max = t.scrollHeight - t.clientHeight, p = max > 40 ? Math.max(0, Math.min(1, t.scrollTop / max)) : 0;
    BAR.style.width = (p * 100).toFixed(1) + '%'; BAR.style.display = p > 0.005 ? '' : 'none';
  }

  /* ================= #30 小卡聚光 ================= */
  function enhanceMagic() {
    if (!HOVER || RED) return;
    $$('.hero:not(.mhero) .hero-minis .mini').forEach(function (m) {
      if (m.__fx3m) return; m.__fx3m = 1; m.classList.add('fx3-mag'); el('span', 'fx3-spot', null, m);
      m.addEventListener('mousemove', function (e) { var r = m.getBoundingClientRect(); m.style.setProperty('--mx', (e.clientX - r.left) + 'px'); m.style.setProperty('--my', (e.clientY - r.top) + 'px'); });
    });
  }

  /* ================= #31 点击火花 ================= */
  function sparkOnClick(e) {
    if (RED) return; var b = e.target.closest && e.target.closest('button'); if (!b) return;
    if (!(b.matches('.gca-btn.pri[data-ok]') || /跑一次假日期检验/.test(b.textContent))) return;
    for (var i = 0; i < 10; i++) { var s = el('span', 'fx3-spk'); s.style.left = e.clientX + 'px'; s.style.top = e.clientY + 'px'; s.style.setProperty('--r', (i * 36) + 'deg'); if (i % 2) s.style.background = '#FFB13B'; document.body.appendChild(s); (function (x) { later(function () { x.remove(); }, 560); })(s); }
  }

  /* ================= #32 种草天气预报（估算） ================= */
  var WD = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];
  function enhanceWeather() {
    var main = document.getElementById('main'); if (!main || !main.querySelector('#card-todo') || main.querySelector('.fx3-wx') || main.__fx3wx === main.firstChild) return;
    var c = ctx(), E = LE(); if (!c || !E || !E.addDays) return; var r = c.r, N = r.dates.length, B = r.baseline;
    if (!B || B.length !== N || N < 21) return;
    var f = []; for (var k = 0; k < 7; k++) { var j = N - 7 + k, pv = N - 14 + k, v = B[j] + (B[j] - B[pv]); if (!isFinite(v)) return; f.push(Math.max(0, v)); }
    var order = f.map(function (v, i) { return { v: v, i: i }; }).sort(function (a, b) { return b.v - a.v; });
    var hi = [order[0].i, order[1].i], lo = [order[5].i, order[6].i], M = metricOf(c), last = r.dates[N - 1];
    var days = f.map(function (v, k) {
      var d = E.addDays(last, k + 1), dt = new Date(d + 'T00:00:00'), cls = hi.indexOf(k) >= 0 ? 'hi' : lo.indexOf(k) >= 0 ? 'lo' : '';
      var ic = cls === 'hi' ? '🌊' : cls === 'lo' ? '🏖️' : '⛅', tg = cls === 'hi' ? '高潮日' : cls === 'lo' ? '低潮日' : '平潮';
      return '<div class="d ' + cls + '" style="animation-delay:' + (k * 0.06).toFixed(2) + 's">' + WD[dt.getDay()] + '<br>' + (dt.getMonth() + 1) + '/' + dt.getDate() + '<div class="ic">' + ic + '</div><b>约 ' + f1(v) + '</b><span class="tg">' + tg + '</span></div>';
    }).join('');
    var sec = el('section', 'card card-float fx3-wx',
      '<div class="h2-row"><h2><span class="h2-ic">🌦</span>种草天气预报：下周「本来就会来」多少</h2></div>' +
      '<p class="inv-sub">按「平时的样子」（星期规律 × 长期走势）往后推 7 天，<b>不含任何笔记和投流的效果</b>，单位：每天的' + esc(M) + '。它是一把尺子：下周发的笔记，要和这条线比，才知道是不是真有效。</p>' +
      '<div class="fx3-days">' + days + '</div>' +
      '<p class="inv-sub" style="font-size:12px">注意：高潮日自然量本来就多，在高潮日发笔记看上去涨得多，其中更多是「本来就会来」，观潮会自动扣掉。估算级：每个星期几只有 5～6 个平常日子，星期规律估得较粗。</p>');
    main.appendChild(sec);
  }

  /* ---------- 统一调度 ---------- */
  var T = null;
  var STEPS = [enhanceGlass, enhanceFunnel, enhanceKol, enhancePoster, enhanceTypes, enhanceFan, enhanceChartTools, enhanceDial, enhanceVerifySweep, enhanceFace, enhanceDetective, enhanceXhs, enhanceHeart, enhanceBeam, enhanceHL, enhanceTagline, enhanceMagic, enhanceWeather];
  function sweep() { T = null; if (!LE()) return; STEPS.forEach(function (fn) { try { fn(); } catch (e) { try { console.warn('[fx3]', fn.name, e && e.message); } catch (e2) {} } }); }
  function kick() { if (!T) T = setTimeout(sweep, 120); }
  if (typeof MutationObserver !== 'undefined') new MutationObserver(kick).observe(document.documentElement, { childList: true, subtree: true, characterData: true });
  document.addEventListener('click', function (e) { try { curtainOnClick(e); flipOnClick(e); sortOnClick(e); washOnClick(e); } catch (x) {} }, true);
  document.addEventListener('click', function (e) { try { sparkOnClick(e); } catch (x) {} }, false);
  document.addEventListener('scroll', function (e) { try { onScroll(e); } catch (x) {} }, { capture: true, passive: true });
  kick();
  window.GuanchaoFX3 = { sweep: sweep };
})();
