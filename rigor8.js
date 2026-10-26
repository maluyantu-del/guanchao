// 观潮 · rigor8：向开源方法借鉴的 6 条（在 v7ui.js 之后加载；不改任何已有文件、不改任何已有数字）
// A1 CausalImpact：抽屉里的"累计增量"曲线 + "碰巧出现的可能"
// A2 Prophet：把"平时的样子"拆成长期走势 + 星期规律
// A3 DoWhy：反驳测试——数据子集复算、推翻门槛（抗干扰度）
// A4 PyMC-Marketing 式模型自检：波动带体检
// A5 Robyn / Meridian：用对照实验校准估算（校准系数）
// A6 GeoLift：实验前算"最小能测出多大的效果"
// 另：幕后新增「站在巨人肩上」——和开源方法的对照 + 下一步
(function () {
  'use strict';
  var LE = function () { try { return typeof LedgerEngine !== 'undefined' ? LedgerEngine : window.LedgerEngine; } catch (e) { return null; } };
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };
  var esc = function (s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); };
  var f0 = function (v) { return Math.round(v).toLocaleString('zh-CN'); };
  var f1 = function (v) { return (Math.round(v * 10) / 10).toFixed(1); };
  var f2 = function (v) { return (+v).toFixed(2); };
  var pc = function (v, d) { return (v * 100).toFixed(d || 0) + '%'; };
  var sum = function (a) { return a.reduce(function (x, y) { return x + y; }, 0); };
  var md = function (d) { var x = new Date(d + 'T00:00:00'); return (x.getMonth() + 1) + '月' + x.getDate() + '日'; };
  var Phi = function (z) { var t = 1 / (1 + 0.2316419 * Math.abs(z)), d = 0.3989423 * Math.exp(-z * z / 2); var p = d * t * (0.3193815 + t * (-0.3565638 + t * (1.781478 + t * (-1.821256 + t * 1.330274)))); return z > 0 ? 1 - p : p; };

  /* ================= 算法扩展（挂在 LedgerEngine 上，只读 compute 的结果） ================= */
  function install(E) {
    if (!E || E.components) return; var Z = E.Z || 1.645;
    // A1 累计增量：观察期里一天天加起来的"多出的量"，以及到那天为止的波动带
    E.cumulative = function (r, n) { var out = [], c = 0, ts = [], ds = []; for (var t = n.p; t <= n.end; t++) { c += r.y[t] - r.baseline[t]; ts.push(t); ds.push(r.dates[t]); out.push({ date: r.dates[t], label: md(r.dates[t]), cum: c, band: Z * r.sigma * Math.sqrt(r.varFn(ts.slice(), ds.slice())) }); } return out; };
    // A1 碰巧出现的可能：按正常波动，这么大的增量纯属巧合的概率
    E.chance = function (r, n) { var b = n.organic != null ? n.organic : n.total; return 1 - Phi(b / Math.max(n.bandN / Z, 1e-9)); };
    // A2 平时的样子拆成两部分（站内站外合起来）
    E.components = function (r) { var N = r.dates.length, tm = (N - 1) / 2, lv = function (f, t) { return Math.max(0, f.a + f.slope * t); };
      var L0 = sum(r.fits.map(function (f) { return lv(f, 0); })), L1 = sum(r.fits.map(function (f) { return lv(f, N - 1); })), Lm = sum(r.fits.map(function (f) { return lv(f, tm); })) || 1;
      var wf = [0, 1, 2, 3, 4, 5, 6].map(function (w) { return sum(r.fits.map(function (f) { return lv(f, tm) * f.wf[w]; })) / Lm; });
      var hi = wf.indexOf(Math.max.apply(null, wf)), lo = wf.indexOf(Math.min.apply(null, wf));
      var cnt = [0, 0, 0, 0, 0, 0, 0]; r.clean.forEach(function (t) { cnt[new Date(r.dates[t] + 'T00:00:00').getDay()]++; });
      return { start: L0, end: L1, weekday: wf, hi: hi, lo: lo, ratio: wf[hi] / Math.max(wf[lo], 1e-9), days: N, cntMin: Math.min.apply(null, cnt), cntMax: Math.max.apply(null, cnt) }; };
    // A3 数据子集复算：随机去掉 2 成平常日子再算，真有效还在不在
    E.subsample = function (r, o) { o = o || {}; var runs = o.runs || 30, frac = o.frac || 0.2, seed = o.seed || 7, rnd = function () { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
      var real = r.done.filter(function (n) { return n.verdict === 'real'; }).map(function (n) { return n.title; }), keep = {}, tot = 0, kept = 0;
      real.forEach(function (t) { keep[t] = 0; });
      for (var i = 0; i < runs; i++) { var drop = r.clean.filter(function () { return rnd() < frac; }).map(function (t) { return r.dates[t]; });
        var s2 = Object.assign({}, r.sample, { promo_dates: (r.sample.promo_dates || []).concat(drop) }), r2 = E.compute(s2, { ac: (r.opts || {}).ac });
        real.forEach(function (t) { tot++; var m = r2.notes.find(function (x) { return x.title === t; }); if (m && m.verdict === 'real') { kept++; keep[t]++; } }); }
      return { runs: runs, frac: frac, rate: tot ? kept / tot : 1, perNote: real.map(function (t) { return { title: t, rate: keep[t] / runs }; }) }; };
    // A3 推翻门槛：观察期每天要多出多少与笔记无关的量，才能把"真有效"推翻
    E.tipping = function (r) { return r.done.filter(function (n) { return n.verdict === 'real'; }).map(function (n) { var b = n.organic != null ? n.organic : n.total, per = (b - n.bandN) / n.len, base = 0; for (var t = n.p; t <= n.end; t++) base += r.baseline[t]; base /= n.len; var share = per / Math.max(base, 1e-9);
      return { title: n.title, perDay: per, base: base, share: share, level: share >= 0.25 ? 'strong' : share >= 0.10 ? 'mid' : 'weak' }; }); };
    // A4 波动带体检：平常日子里有多少天落在"正常范围"（理论约 90%）
    E.bandCheck = function (r) { var inside = r.clean.filter(function (t) { return Math.abs(r.y[t] - r.baseline[t]) <= Z * r.sigma; }).length; return { inside: inside, total: r.clean.length, rate: inside / Math.max(1, r.clean.length), theory: 0.9, inSample: true }; };
    // A5 实验校准：实验级 ÷ 估算级
    E.calibration = function (d) { if (!d || !d.exp || !d.exp.ok || !d.est || !d.est.meanReal) return null; return { factor: d.exp.diff / d.est.meanReal, exp: d.exp.diff, est: d.est.meanReal }; };
    // A6 最小能测出的效果（单侧 95% 把握、80% 机会测出）
    E.mde = function (r, sample, o) { var x = E.experiment(r, sample, o || {}); if (!x || !x.ok) return null; return { perArm: x.perArm, delta: x.delta, mde: (1.645 + 0.84) * x.sdNote * Math.sqrt(2 / x.perArm) }; };
    // 和开源方法的对照（星数为 2026-10-12 在 GitHub 查询）
    E.LINEAGE = [
      ['逐篇算增量：先估"没发这篇会怎样"，再算多出来的', 'CausalImpact', 'Google', 1862, '同一思路的轻量版：能逐篇算、小数据也能跑、每一步可解释'],
      ['"平时的样子"＝长期走势 × 星期规律', 'Prophet', 'Meta', 20435, '同样拆成走势和星期规律；观潮多了"只用干净日来估"'],
      ['假日期检验、数据子集复算、推翻门槛', 'DoWhy', '微软等', 8347, '对应它的安慰剂反驳、子集反驳和敏感性分析'],
      ['波动带体检', 'PyMC-Marketing', 'PyMC Labs', 1279, '模型自检：预测范围能不能罩住实际'],
      ['实验级 + 校准系数', 'Robyn / Meridian', 'Meta / Google', 1563, '用对照实验结果反过来校准模型'],
      ['对照实验方案：要几篇、最小能测出多大', 'GeoLift', 'Meta', 269, '实验前先做功效分析'],
      ['（下一步）哪类笔记投流最值', 'CausalML', 'Uber', 6021, '平台规模下的增量建模']
    ];
  }

  /* ---------- 当前店铺（与 v7ui 相同的取法） ---------- */
  var SKIP = { '商家': 1, '客户经理': 1, '导入数据': 1 };
  function curName() { var meta = $('.hero:not(.mhero) .hero-meta'); if (meta && meta.textContent) return meta.textContent.split('·')[0].trim(); var act = $$('.seg-btn.active').map(function (b) { return b.textContent.trim(); }).filter(function (t) { return t && !SKIP[t]; }); return act[0] || null; }
  function ctx() { var E = LE(); if (!E || !E.lastResult) return null; var r = E.lastResult(curName()); return r ? { r: r, sample: r.sample } : null; }
  var CACHE = typeof WeakMap !== 'undefined' ? new WeakMap() : null;
  function memo(r, k, fn) { if (!CACHE) return fn(); var m = CACHE.get(r); if (!m) { m = {}; CACHE.set(r, m); } if (!(k in m)) m[k] = fn(); return m[k]; }
  var LV = { strong: ['强', 'ok'], mid: ['中', 'mid'], weak: ['弱', 'warn'] };
  var later = function (fn, ms) { return setTimeout(fn, ms); };

  /* ================= 1. 检验单：5 项 → 8 项 ================= */
  function liHTML(k, t, body, st, stTxt, d) { return '<li class="rg-ci r8-ci" data-k="' + k + '" style="--d:' + d + 's"><i class="rg-ic ' + st + '"></i><div class="rg-ci-t"><b>' + t + '</b><span>' + body + '</span></div><em class="rg-st ' + st + '">' + stTxt + '</em></li>'; }
  function extendChecklist() {
    $$('.rg-check').forEach(function (chk) {
      if (chk.__r8) return; var c = ctx(); if (!c) return; chk.__r8 = true; var E = LE(), r = c.r, M = c.sample.metric;
      var h = chk.querySelector('.rg-check-h b'); if (h) h.textContent = '这本账做过 8 项检验';
      var ol = chk.querySelector('ol'); if (!ol) return;
      var bc = memo(r, 'bc', function () { return E.bandCheck(r); }), tp = memo(r, 'tp', function () { return E.tipping(r); }), weak = tp.filter(function (x) { return x.level === 'weak'; });
      ol.insertAdjacentHTML('beforeend',
        liHTML('sub', '数据子集复算', '随机去掉 2 成平常日子、重算 30 次，看真有效还在不在 <span class="r8-wait">计算中…</span>', 'idle', '计算中', '.62') +
        liHTML('tip', '推翻门槛（抗干扰度）', '要把这 ' + tp.length + ' 条真有效推翻，观察期每天得多出一些与笔记无关的' + esc(M) + '：' + (weak.length ? '<b class="warn">' + weak.length + ' 条不到平时的 1 成就会被推翻（' + weak.map(function (x) { return '「' + esc(x.title.slice(0, 10)) + (x.title.length > 10 ? '…' : '') + '」'; }).join('') + '），这几条请谨慎</b>' : '每条都要多出平时的 1 成以上，<b>抗干扰度不错</b>') + '；每篇的门槛在"这笔账怎么算的"里', weak.length ? 'warn' : 'ok', weak.length ? '有 ' + weak.length + ' 条脆弱' : '通过', '.74') +
        liHTML('band', '波动带体检', '平常日子 ' + bc.total + ' 天里 <b>' + bc.inside + '</b> 天落在"正常范围"内（' + pc(bc.rate) + '，理论约 90%）：波动带' + (bc.rate >= 0.85 ? '没有画窄，只会偏严' : '偏窄，结论偏松，请谨慎') + '<span class="r8-note">（用的是估"平时样子"的那批日子，结果会偏乐观）</span>', bc.rate >= 0.85 ? 'ok' : 'warn', bc.rate >= 0.85 ? '通过' : '偏窄', '.86'));
      later(function () { var sb = memo(r, 'sub', function () { return E.subsample(r); }), li = ol.querySelector('[data-k="sub"]'); if (!li) return; var ok = sb.rate >= 0.85;
        li.querySelector('.rg-ci-t>span').innerHTML = '随机去掉 2 成平常日子、重算 ' + sb.runs + ' 次：真有效结论保持 <b>' + pc(sb.rate) + '</b>' + (ok ? '，结论不依赖某几天的数据' : '，<b class="warn">有结论依赖某几天的数据</b>');
        li.querySelector('.rg-ic').className = 'rg-ic ' + (ok ? 'ok' : 'warn'); var st = li.querySelector('.rg-st'); st.className = 'rg-st ' + (ok ? 'ok' : 'warn'); st.textContent = ok ? '通过' : '有变化'; }, 60);
    });
    $$('.rg-chip').forEach(function (b) { if (/5 项检验/.test(b.innerHTML)) b.innerHTML = b.innerHTML.replace('5 项检验', '8 项检验'); });
  }

  /* ================= 2. 抽屉：累计增量 + 碰巧的可能 + 推翻门槛 ================= */
  function cumSVG(cum) {
    var W = 360, H = 120, P = { l: 30, r: 10, t: 12, b: 22 }, n = cum.length; if (n < 2) return '';
    var hi = Math.max.apply(null, cum.map(function (x) { return Math.max(x.cum, x.band); })) * 1.1, lo = Math.min(0, Math.min.apply(null, cum.map(function (x) { return Math.min(x.cum, -x.band); })));
    var X = function (i) { return P.l + (W - P.l - P.r) * i / (n - 1); }, Y = function (v) { return P.t + (H - P.t - P.b) * (1 - (v - lo) / (hi - lo)); };
    var band = cum.map(function (x, i) { return X(i).toFixed(1) + ',' + Y(x.band).toFixed(1); }).concat(cum.map(function (x, i) { return X(i).toFixed(1) + ',' + Y(-x.band).toFixed(1); }).reverse()).join(' ');
    var line = cum.map(function (x, i) { return X(i).toFixed(1) + ',' + Y(x.cum).toFixed(1); }).join(' ');
    var cross = -1; cum.forEach(function (x, i) { if (cross < 0 && x.cum > x.band) cross = i; });
    var lab = cum.map(function (x, i) { return (i === 0 || i === n - 1) ? '<text x="' + X(i).toFixed(1) + '" y="' + (H - 6) + '" class="r8-ax" text-anchor="' + (i === 0 ? 'start' : 'end') + '">' + x.label + '</text>' : ''; }).join('');
    return '<'+'svg class="r8-cum" viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="累计多出的量">' +
      '<polygon points="' + band + '" class="r8-band"/><line x1="' + P.l + '" x2="' + (W - P.r) + '" y1="' + Y(0).toFixed(1) + '" y2="' + Y(0).toFixed(1) + '" class="r8-zero"/>' +
      '<polyline points="' + line + '" class="r8-line" pathLength="1"/>' + cum.map(function (x, i) { return '<circle cx="' + X(i).toFixed(1) + '" cy="' + Y(x.cum).toFixed(1) + '" r="2.6" class="r8-dot' + (x.cum > x.band ? ' out' : '') + '" style="--d:' + (0.25 + i * 0.12).toFixed(2) + 's"/>'; }).join('') +
      (cross >= 0 ? '<text x="' + (X(cross) + (cross < n / 3 ? -2 : cross > n * 2 / 3 ? 2 : 0)).toFixed(1) + '" y="' + (Y(cum[cross].cum) - 8).toFixed(1) + '" class="r8-ax r8-cross" text-anchor="' + (cross < n / 3 ? 'start' : cross > n * 2 / 3 ? 'end' : 'middle') + '">第 ' + (cross + 1) + ' 天冲出正常范围</text>' : '') +
      '<text x="' + (P.l - 4) + '" y="' + (Y(0) + 4).toFixed(1) + '" class="r8-ax" text-anchor="end">0</text>' + lab + '</svg>';
  }
  function enhanceDrawer() {
    var body = $('.exd-wrap.show') || $('.exd-wrap'); if (!body) return; var titleEl = body.querySelector('.exd-title'), foot = body.querySelector('.exd-foot'); if (!titleEl || !foot) return;
    var title = titleEl.textContent.trim(); if (body.__r8 === title && body.querySelector('.r8-exd')) return; body.__r8 = title;
    var c = ctx(); if (!c) return; var E = LE(), r = c.r, n = r.notes.find(function (x) { return x.title === title; }); if (!n) return;
    var old = body.querySelector('.r8-exd'); if (old) old.remove();
    var cum = E.cumulative(r, n), ch = E.chance(r, n), tp = n.verdict === 'real' && !n.live ? E.tipping(r).find(function (x) { return x.title === title; }) : null, M = c.sample.metric;
    var div = document.createElement('div'); div.className = 'r8-exd';
    div.innerHTML = '<div class="exd-steps-h">一天天加起来看</div>' + cumSVG(cum) +
      '<p class="r8-p">红线是观察期里一天天加起来的"多出的量"，浅色带是到那天为止的正常波动范围；红线冲出浅色带，才说明不是巧合。</p>' +
      '<div class="r8-facts"><div><span>碰巧出现的可能</span><b>' + (ch < 0.001 ? '不到 0.1%' : ch < 0.01 ? pc(ch, 1) : pc(ch)) + '</b><em>按正常波动，这么大的增量纯属巧合的概率</em></div>' +
      (tp ? '<div><span>推翻门槛</span><b class="' + LV[tp.level][1] + '">每天 +' + f1(tp.perDay) + ' 个</b><em>观察期每天多出这么多与笔记无关的' + esc(M) + '（平时约 ' + f1(tp.base) + ' 个，占 ' + pc(tp.share) + '），结论就会被推翻 · 抗干扰度' + LV[tp.level][0] + '</em></div>' : '') + '</div>';
    foot.parentNode.insertBefore(div, foot);
    later(function () { div.classList.add('in'); }, 30);
  }

  /* ================= 3. 笔记明细：拆开看"平时的样子" ================= */
  var WD = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];
  function enhanceComponents() {
    var box = $('.nt-chart-box'); if (!box) return; var card = box.closest('section') || box.parentNode; var c = ctx(); if (!c) return;
    var host = card.querySelector('.r8-comp'); if (host && host.__r === c.r) return;
    if (!host) { host = document.createElement('div'); host.className = 'r8-comp'; card.appendChild(host); } host.__r = c.r;
    var cp = LE().components(c.r), M = c.sample.metric, order = [1, 2, 3, 4, 5, 6, 0], mx = Math.max.apply(null, cp.weekday);
    var trend = '<'+'svg viewBox="0 0 160 54" class="r8-tr"><line x1="6" y1="' + (46 - 36 * cp.start / Math.max(cp.end, cp.start)).toFixed(1) + '" x2="154" y2="' + (46 - 36 * cp.end / Math.max(cp.end, cp.start)).toFixed(1) + '" pathLength="1"/><circle cx="6" cy="' + (46 - 36 * cp.start / Math.max(cp.end, cp.start)).toFixed(1) + '" r="3"/><circle cx="154" cy="' + (46 - 36 * cp.end / Math.max(cp.end, cp.start)).toFixed(1) + '" r="3"/></svg>';
    host.innerHTML = '<div class="r8-comp-h"><b>拆开看"平时的样子"</b><span>它由两部分相乘：长期走势 × 星期规律（只用没发笔记、没投流的日子估出来）</span></div>' +
      '<div class="r8-comp-g"><div class="r8-comp-c"><span class="r8-k">长期走势</span>' + trend + '<p>平时每天从约 <b>' + f1(cp.start) + '</b> 个' + esc(M) + '涨到约 <b>' + f1(cp.end) + '</b> 个（' + cp.days + ' 天）</p></div>' +
      '<div class="r8-comp-c"><span class="r8-k">星期规律</span><div class="r8-wk">' + order.map(function (w, i) { var v = cp.weekday[w]; return '<div class="r8-wb' + (w === cp.hi ? ' hi' : w === cp.lo ? ' lo' : '') + '" title="' + WD[w] + '：平时的 ' + f2(v) + ' 倍"><i style="--h:' + (v / mx * 100).toFixed(1) + '%;--d:' + (i * 0.06).toFixed(2) + 's"></i><span>' + WD[w].slice(1) + '</span></div>'; }).join('') + '</div>' +
      '<p>平时<b>' + WD[cp.hi] + '</b>约是<b>' + WD[cp.lo] + '</b>的 <b>' + f1(cp.ratio) + '</b> 倍。发在高峰日的笔记，不能把那天本来就多的部分算成自己的功劳。<span class="r8-note">每个星期几只有 ' + cp.cntMin + '～' + cp.cntMax + ' 个平常日子，这个规律估得比较粗——所以"不调星期规律"是 3 种复算之一。</span></p></div></div>';
    later(function () { host.classList.add('in'); }, 30);
  }

  /* ================= 4. 实验：校准系数 + 最小能测出的效果 ================= */
  function enhanceExperiment() {
    var E = LE();
    var tt = $$('.ged-tt').find(function (x) { return /三种口径/.test(x.textContent); });
    if (tt && !tt.parentNode.querySelector('.r8-calib')) { var d = null; try { d = E.experimentDemo(EXPERIMENT_DEMO); } catch (e) {} var cal = E.calibration(d);
      if (cal) { var p = document.createElement('div'); p.className = 'r8-calib'; p.innerHTML = '<span class="r8-k">校准系数</span><b>' + f1(cal.exp) + ' ÷ ' + f1(cal.est) + ' ≈ ' + f2(cal.factor) + '</b><span>实验级 ÷ 估算级。以后这家店的"去水分"估计按 ' + f2(cal.factor) + ' 修正：先估算 → 做实验 → 再回头校准估算，形成闭环。</span>'; tt.parentNode.appendChild(p); } }
    var c4 = $$('section.card').find(function (s) { return /想把投流效果测准/.test((s.querySelector('h2') || {}).textContent || ''); }); if (!c4) return; var c = ctx(); if (!c) return;
    var vals = $$('.inv-slider-val', c4).map(function (b) { return b.textContent; }); if (vals.length < 2) return;
    var spend = +vals[0].replace(/[^\d.]/g, ''), plan = +vals[1].replace(/[^\d]/g, ''); var key = spend + '|' + plan + '|' + c.sample.name;
    var host = c4.querySelector('.r8-mde'); if (host && host.__k === key) return;
    var x = E.mde(c.r, c.sample, { plan: plan, spend: spend }), body = c4.querySelector('.exp-body');
    if (!host) { host = document.createElement('p'); host.className = 'r8-mde'; if (body && body.nextSibling) c4.insertBefore(host, body.nextSibling); else c4.appendChild(host); } host.__k = key;
    if (!x || !body || body.textContent.indexOf(x.perArm + ' + ' + x.perArm) < 0) { host.innerHTML = ''; return; }
    var enough = x.delta >= x.mde;
    host.innerHTML = '🔍 实验前先算清楚测不测得出来：按这个方案（每组 ' + x.perArm + ' 篇），最小能测出每篇约 <b>' + f1(x.mde) + '</b> 个' + esc(c.sample.metric) + '的投流效果；预计效果约 <b>' + f1(x.delta) + '</b> 个，' + (enough ? '<b class="ok">测得出来</b>。' : '<b class="warn">偏小，可能测不出来，建议加篇数或加大每篇投入</b>。');
  }

  /* ================= 5. 幕后：8 项检验 + 站在巨人肩上 ================= */
  function enhanceBehind() {
    var gb = $('.gb'); if (!gb || gb.__r8) return; var test = gb.querySelector('#gb-test'); if (!test || !test.querySelector('.rg-tbl')) return; gb.__r8 = true; var E = LE();
    $$('.gb-h3', test).forEach(function (h) { if (/5 项检验/.test(h.textContent)) { h.textContent = '每本账都会做的 8 项检验'; var p = h.nextElementSibling; if (p) p.insertAdjacentHTML('beforeend', ' ⑥ 数据子集复算：随机去掉 2 成平常日子重算 30 次，看结论还在不在。⑦ 推翻门槛：算出观察期每天要多出多少与笔记无关的量才能推翻结论，不到平时 1 成就标"脆弱"。⑧ 波动带体检：平常日子有多少落在"正常范围"里，理论约 90%。'); } });
    var rows = E.LINEAGE.map(function (x) { return '<tr><td>' + esc(x[0]) + '</td><td><b>' + esc(x[1]) + '</b><span class="r8-who">' + esc(x[2]) + ' · ' + (x[3] >= 1000 ? (x[3] / 1000).toFixed(1) + 'k' : x[3]) + ' ★</span></td><td>' + esc(x[4]) + '</td></tr>'; }).join('');
    var html = '<p class="gb-p">观潮的每一块方法，都能在大厂开源的项目里找到同路人。它们是给数据科学家写代码用的；观潮做的，是把同样的思路变成中小商家点几下就能用的账本。</p>' +
      '<div class="rg-tbl-w"><table class="rg-tbl r8-tbl"><thead><tr><th>观潮的做法</th><th>同路的开源项目</th><th>一样在哪 / 观潮的取舍</th></tr></thead><tbody>' + rows + '</tbody></table></div>' +
      '<p class="gb-p r8-src">星数为 2026 年 10 月 12 日在 GitHub 查询。</p>' +
      '<div class="gb-h3">下一步：向它们学</div>' +
      ['1. 大店不适用 → 学 Prophet 的"变点"：让长期走势可以在几个点上拐弯，描得住季节和突发热点。', '2. 相关不是因果 → 学 GeoLift 的合成对照：用相似商家拼出一个"对照店"。', '3. 单店投流只有两三笔 → 学 CausalML 的增量建模：平台有成千上万商家后，学出"哪类笔记投流最值"。', '4. 检验仍偏内生 → 用 CausalImpact 的贝叶斯模型在同一份数据上对一遍，当"第三轮考试"。', '5. 预算模型地基薄 → 学 Robyn 的 Hill 饱和曲线和广告余温，替换现在的指数饱和曲线；并用实验结果做校准。'].map(function (l) { return '<p class="gb-p">' + l + '</p>'; }).join('');
    var ai = gb.querySelector('#gb-ai'), anchor = ai || test;
    var sec = document.createElement('section'); sec.className = 'gb-sec'; sec.id = 'gb-giants'; sec.innerHTML = '<h2><span class="gb-num">0</span>站在巨人肩上：和开源方法的对照</h2><div class="gb-box">' + html + '</div>'; anchor.parentNode.insertBefore(sec, anchor.nextSibling);
    var toc = gb.querySelector('.gb-toc'), ta = toc && (toc.querySelector('a[data-go="ai"]') || toc.querySelector('a[data-go="test"]'));
    if (ta) { var a = document.createElement('a'); a.setAttribute('data-go', 'giants'); a.textContent = '站在巨人肩上'; ta.parentNode.insertBefore(a, ta.nextSibling);
      var pgEl = gb.closest('.gp-page, .gp'); if (pgEl) pgEl.addEventListener('scroll', function () { setTimeout(function () { var top = sec.getBoundingClientRect().top, nx = sec.nextElementSibling ? sec.nextElementSibling.getBoundingClientRect().top : 1e9, OFF = window.innerWidth <= 760 ? 120 : 90; if (top <= OFF + 4 && nx > OFF + 4) $$('a', toc).forEach(function (x) { x.classList.toggle('on', x === a); }); else if (a.classList.contains('on') && !(top <= OFF + 4 && nx > OFF + 4)) a.classList.remove('on'); }, 0); });
      a.onclick = function () { $$('a', toc).forEach(function (x) { x.classList.toggle('on', x === a); }); var pg = gb.closest('.gp-page, .gp') || document.scrollingElement; var y = sec.getBoundingClientRect().top - (pg.getBoundingClientRect ? pg.getBoundingClientRect().top : 0) + (pg.scrollTop || 0) - 70; try { pg.scrollTo({ top: y, behavior: 'smooth' }); } catch (e) { pg.scrollTop = y; } }; }
    var NUM = ['①', '②', '③', '④', '⑤', '⑥', '⑦', '⑧', '⑨', '⑩'];
    $$('.gb-sec', gb).forEach(function (s, i) { var nn = s.querySelector('.gb-num'); if (nn) nn.textContent = i + 1; });
    if (toc) $$('a', toc).forEach(function (x, i) { x.textContent = NUM[i] + ' ' + x.textContent.replace(/^[①-⑩]\s*/, ''); });
  }

  /* ---------- 调度 ---------- */
  var T = null;
  function sweep() { T = null; var E = LE(); if (!E || !E.fdr) return; install(E); [extendChecklist, enhanceDrawer, enhanceComponents, enhanceExperiment, enhanceBehind].forEach(function (fn) { try { fn(); } catch (e) { try { console.warn('[rigor8]', fn.name, e); } catch (e2) {} } }); }
  function kick() { if (!T) T = setTimeout(sweep, 160); }
  if (typeof MutationObserver !== 'undefined') new MutationObserver(kick).observe(document.documentElement, { childList: true, subtree: true });
  try { install(LE()); } catch (e) {}
  kick();
  window.GuanchaoR8 = { sweep: sweep };
})();
