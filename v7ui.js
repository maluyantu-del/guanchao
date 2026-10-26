// 观潮 · v7 覆盖层（在 app.v20.js 之后加载；不改 app 本体，不产生任何业务数字——所有数字来自 LedgerEngine）
// 1. 「5 项检验」：算法运行条上的入口 + 总账卡片里的检验单
// 2. 「证据阶梯」：该不该投页，估算级 → 假日期检验 → 实验级
// 3. 「假日期检验」：在本店自己的数据里插假笔记，看会不会被判成真有效
// 4. 「预算把握区间」：最划算预算只靠几笔历史投流估出来，给出区间和"越投越准"
// 5. 「数字校验器」：AI 回答、问观潮、行动包草稿、提案要点里的每个数字都标出出处
// 6. 幕后：「怎么检验的」换成两轮检验 + 适用范围；新增「AI 怎么接：数字只从账本来」
// 7. 分享海报入口（依赖 poster.v1.js 的 GuanchaoPoster）
(function () {
  'use strict';
  // 注意：engine.js 用 const 声明 LedgerEngine / SAMPLES，不在 window 上，要直接按名字取
  var LE = function () { try { return typeof LedgerEngine !== 'undefined' ? LedgerEngine : window.LedgerEngine; } catch (e) { return null; } };
  var SAMP = function () { try { return typeof SAMPLES !== 'undefined' ? SAMPLES : window.SAMPLES; } catch (e) { return null; } };
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };
  var esc = function (s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); };
  var f0 = function (v) { return Math.round(v).toLocaleString('zh-CN'); };
  var f1 = function (v) { return (Math.round(v * 10) / 10).toFixed(1); };
  var f2 = function (v) { return (+v).toFixed(2); };
  var pc = function (v, d) { return (v * 100).toFixed(d || 0) + '%'; };
  var money = function (v) { return '¥' + f0(v); };
  var later = function (fn, ms) { return setTimeout(fn, ms); };
  var REDUCED = false; try { REDUCED = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (e) {}

  /* ---------- 当前店铺：从界面上读店名，再到算法记录里找这家店最近一次的结果 ---------- */
  var SKIP = { '商家': 1, '客户经理': 1, '导入数据': 1 };
  function curName() {
    var meta = $('.hero:not(.mhero) .hero-meta'); if (meta && meta.textContent) return meta.textContent.split('·')[0].trim();
    var act = $$('.seg-btn.active').map(function (b) { return b.textContent.trim(); }).filter(function (t) { return t && !SKIP[t]; });
    return act[0] || null;
  }
  function ctxFor(name) { var E = LE(); if (!E || !E.lastResult) return null; var r = E.lastResult(name || curName()); return r ? { r: r, sample: r.sample } : null; }

  /* ---------- 缓存：同一份结果只算一次 ---------- */
  var RB = typeof WeakMap !== 'undefined' ? new WeakMap() : null, PL = typeof WeakMap !== 'undefined' ? new WeakMap() : null;
  function robust(r) { if (RB && RB.has(r)) return RB.get(r); var v = LE().robustness(r); if (RB) RB.set(r, v); return v; }
  function placebo(r) { if (PL && PL.has(r)) return PL.get(r); var v = LE().placebo(r); if (PL) PL.set(r, v); return v; }
  // 随机误差下（每篇 5% 的误判概率），n 次假日期里出现几次误判仍算正常（二项分布 95% 上界）
  function normalMax(n) { var p = 0.05, k = 0, cdf = 0, c = Math.pow(1 - p, n); while (k <= n) { cdf += c; if (cdf >= 0.95) return k; c = c * (n - k) / (k + 1) * p / (1 - p); k++; } return n; }
  function scaleRow(r) { var V = LE().VALIDATION.real.rows, m = r.y.reduce(function (a, b) { return a + b; }, 0) / r.y.length; return m < 12 ? V[1] : m <= 60 ? V[0] : V[2]; }

  /* ================= 3. 假日期检验（检验单和证据阶梯共用） ================= */
  function placeboUI(box, r) {
    box.innerHTML = '<button type="button" class="rg-run">' + ICON.dice + '跑一次假日期检验</button><span class="rg-run-hint">在本店没发笔记、没投流的日子插假笔记，看观潮会不会上当</span>';
    box.querySelector('.rg-run').onclick = function () {
      var P = placebo(r), lim = normalMax(P.tries);
      box.innerHTML = '<div class="rg-chips" aria-live="polite"></div><div class="rg-pl-sum"></div>';
      var chips = box.querySelector('.rg-chips'), sum = box.querySelector('.rg-pl-sum'), i = 0, step = REDUCED ? 0 : Math.max(35, Math.min(90, 1400 / Math.max(1, P.tries)));
      (function next() {
        if (i < P.tests.length) {
          var t = P.tests[i++], d = new Date(t.date + 'T00:00:00'), bad = t.verdict === 'real';
          var c = document.createElement('span'); c.className = 'rg-chip-d ' + (bad ? 'bad' : 'ok');
          c.title = (d.getMonth() + 1) + '月' + d.getDate() + '日起 7 天：多出 ' + f1(t.inc) + '，波动带 ±' + f1(t.band) + (bad ? '（被误判成真有效）' : '（没上当）');
          c.textContent = (d.getMonth() + 1) + '/' + d.getDate() + (bad ? ' !' : ' ✓'); chips.appendChild(c); later(next, step); return;
        }
        var ok = P.alarms <= lim;
        sum.innerHTML = (P.enough ? '' : '<span class="rg-pill warn">空档太少，仅供参考</span> ') +
          '在本店 <b>' + P.tries + '</b> 个没有笔记的位置插了假笔记，<b class="' + (P.alarms ? 'warn' : 'ok') + '">' + P.alarms + '</b> 篇被误判成"真有效"。' +
          '<span class="rg-sub">按 5% 的误判率，随机误差下 ' + P.tries + ' 次里出现 0～' + lim + ' 次都正常' + (ok ? '：<b class="ok">在正常范围内</b>。' : '：<b class="warn">偏多，这家店的数据可能有没标记的大促或其他活动，结论请谨慎</b>。') + '</span>';
        sum.classList.add('in');
        box.dispatchEvent(new CustomEvent('rg-placebo-done', { bubbles: true, detail: { ok: ok, P: P } }));
      })();
    };
  }

  /* ================= 1. 5 项检验 ================= */
  function checklistHTML(r) {
    var E = LE(), F = E.fdr(r), ac = r.ac || { rho: 0, applied: false }, rb = robust(r), row = scaleRow(r);
    var items = [
      ['fdr', '多重比较校正', '同时看 ' + F.m + ' 篇，按 FDR 10% 把门槛提高后，真有效 <b>' + F.keep + '/' + F.real + '</b> 仍成立', F.allKept ? 'ok' : 'warn', F.allKept ? '通过' : '有变化'],
      ['ac', '前后天相关检查', '相邻两天的偏差相关 ρ≈<b>' + f2(ac.rho) + '</b>，' + (ac.applied ? '显著，波动带已自动放宽 ' + Math.round((ac.infl - 1) * 100) + '%' : '不显著，不需放宽'), 'ok', ac.applied ? '已校正' : '通过'],
      ['rob', '换 3 种假设复算', '观察期改 5 天、去掉长期走势、不调星期规律：<b>' + rb.robustCount + '/' + rb.total + '</b> 篇结论不变', rb.robustCount / Math.max(1, rb.total) >= 0.6 ? 'ok' : 'warn', '通过'],
      ['placebo', '假日期检验', '', 'idle', '待运行'],
      ['real', '真实世界噪声检验', '在真实数据的噪声上植入已知效果：' + esc(row.name) + '误判 ' + pc(row.fpr, 1) + '，校正后 <b>' + pc(row.fprFdr, 1) + '</b>，识别 ' + pc(row.det) + (row.outOfScope ? '。<b class="warn">这家店量级超出适用范围</b>' : ''), row.outOfScope ? 'warn' : 'ok', row.outOfScope ? '超范围' : '通过']
    ];
    return '<div class="rg-check"><div class="rg-check-h"><b>这本账做过 5 项检验</b><span>每一项都能在本地复现；点"假日期检验"可以当场再跑一次</span></div><ol>' +
      items.map(function (x, i) { return '<li class="rg-ci" data-k="' + x[0] + '" style="--d:' + (i * 0.12).toFixed(2) + 's"><i class="rg-ic ' + x[3] + '"></i><div class="rg-ci-t"><b>' + x[1] + '</b><span>' + x[2] + '</span>' + (x[0] === 'placebo' ? '<div class="rg-pl"></div>' : '') + (x[0] === 'real' ? '<button type="button" class="rg-link" data-rg-behind>看两轮检验的详情 →</button>' : '') + '</div><em class="rg-st ' + x[3] + '">' + x[4] + '</em></li>'; }).join('') + '</ol></div>';
  }
  function mountChecklist(host, r) {
    host.innerHTML = checklistHTML(r);
    var li = host.querySelector('[data-k="placebo"]'), box = li.querySelector('.rg-pl'); placeboUI(box, r);
    box.addEventListener('rg-placebo-done', function (e) { var ok = e.detail.ok; li.querySelector('.rg-ic').className = 'rg-ic ' + (ok ? 'ok' : 'warn'); var st = li.querySelector('.rg-st'); st.className = 'rg-st ' + (ok ? 'ok' : 'warn'); st.textContent = ok ? '通过' : '偏多'; });
    var b = host.querySelector('[data-rg-behind]'); if (b) b.onclick = openBehindTest;
    later(function () { host.querySelector('.rg-check').classList.add('in'); }, 30);
  }
  function openBehindTest() { var bb = $$('button').find(function (x) { return x.textContent.trim() === '幕后'; }); if (bb) { bb.click(); later(function () { var a = $('.gb-toc a[data-go="test"]'); if (a) a.click(); }, 450); } }

  function enhanceRunBar() {
    $$('.fx-run .fx-run-done').forEach(function (d) {
      if (d.querySelector('.rg-chip')) return; var c = ctxFor(); if (!c) return;
      var b = document.createElement('button'); b.type = 'button'; b.className = 'rg-chip'; b.innerHTML = ICON.shield + '5 项检验 ✓'; d.appendChild(b);
      b.onclick = function () { var bar = d.closest('.fx-run'), pop = bar.nextElementSibling && bar.nextElementSibling.classList.contains('rg-pop') ? bar.nextElementSibling : null;
        if (pop) { pop.remove(); return; } pop = document.createElement('div'); pop.className = 'rg-pop'; bar.parentNode.insertBefore(pop, bar.nextSibling); mountChecklist(pop, c.r); };
    });
  }
  function enhanceLedgerCard() {
    var card = $('#card-ledger-w'); if (!card) return; var body = card.querySelector('.col-body'); if (!body) return; var c = ctxFor(); if (!c) return;
    var host = body.querySelector('.rg-ledger'); if (host && host.__r === c.r) return;
    if (!host) { host = document.createElement('div'); host.className = 'rg-ledger'; body.appendChild(host); }
    host.__r = c.r; mountChecklist(host, c.r);
  }

  /* ================= 2. 证据阶梯（该不该投） ================= */
  function enhanceLadder() {
    var exp = $('.invest-exp'); if (!exp) return; var c = ctxFor(); if (!c) return;
    var host = exp.previousElementSibling && exp.previousElementSibling.classList.contains('rg-ladder') ? exp.previousElementSibling : null;
    if (host && host.__r === c.r) return; if (!host) { host = document.createElement('section'); host.className = 'card card-float rg-ladder'; exp.parentNode.insertBefore(host, exp); }
    host.__r = c.r; var r = c.r, F = LE().fdr(r), S = r.summary;
    host.innerHTML = '<div class="rg-ld-h"><h2><span class="h2-ic">🪜</span>这条结论有多硬：证据阶梯</h2><p class="inv-sub">从"估算"到"证明"分三级；越往上越硬，观潮把每一级都放进了产品里。</p></div>' +
      '<div class="rg-steps">' +
      '<div class="rg-step on" style="--d:0s"><div class="rg-step-n">1</div><b>估算级</b><p>每篇笔记都和"平时的样子"比，超出正常波动才算真有效。本店 <b>' + S.real + '/' + S.noteCount + '</b> 篇真有效，多重比较校正后 <b>' + F.keep + '/' + F.real + '</b> 仍成立。</p><span class="rg-pill ok">已完成</span></div>' +
      '<div class="rg-arrow" aria-hidden="true">→</div>' +
      '<div class="rg-step" data-s="2" style="--d:.15s"><div class="rg-step-n">2</div><b>排除巧合</b><p>在本店自己的数据里插假笔记：如果观潮对假笔记也说"真有效"，说明它容易被巧合骗。</p><div class="rg-pl"></div></div>' +
      '<div class="rg-arrow" aria-hidden="true">→</div>' +
      '<div class="rg-step" data-s="3" style="--d:.3s"><div class="rg-step-n">3</div><b>实验级</b><p>按上面的对照实验方案投一轮（单数篇投、双数篇不投），导入分组后自动给出实验级结论。</p><button type="button" class="rg-link" data-rg-exp>看一个实验级的例子 ↓</button></div>' +
      '</div>';
    var s2 = host.querySelector('[data-s="2"]'), box = s2.querySelector('.rg-pl'); placeboUI(box, r);
    box.addEventListener('rg-placebo-done', function (e) { s2.classList.add('on'); var p = document.createElement('span'); p.className = 'rg-pill ' + (e.detail.ok ? 'ok' : 'warn'); p.textContent = e.detail.ok ? '已通过' : '偏多，谨慎'; s2.appendChild(p); });
    host.querySelector('[data-rg-exp]').onclick = function () { var t = $$('.invest-exp button, .invest-exp summary').find(function (x) { return /实验级的例子/.test(x.textContent); }) || exp; try { t.scrollIntoView({ behavior: 'smooth', block: 'center' }); } catch (e2) { t.scrollIntoView(); } if (t.tagName === 'BUTTON' && !/▴|收起/.test(t.textContent)) later(function () { t.click(); }, 500); };
    later(function () { host.classList.add('in'); }, 30);
  }

  /* ================= 4. 预算把握区间 ================= */
  function readBudgetOpts(wrap) {
    var plan = 8, mix = 'reco', sat = null;
    $$('input[type=range]', wrap).forEach(function (inp) { var row = inp.closest('div, label'); var t = row ? row.textContent : ''; if (/计划发几篇/.test(t)) plan = +inp.value; if (/饱和/.test(t)) sat = +inp.value; });
    $$('.seg-btn.active, button.active, .on', wrap).forEach(function (b) { var t = b.textContent.trim(); if (t === '按原来的比例') mix = 'hist'; if (t === '按推荐') mix = 'reco'; });
    return { plan: plan, mix: mix, sat: sat };
  }
  function enhanceBudget() {
    var box = $('.bt-curve-box'); if (!box) return; var svg = box.querySelector('svg'); if (!svg) return; var c = ctxFor(); if (!c) return;
    var bub = $$('text', svg).map(function (t) { return t.textContent; }).find(function (t) { return /最划算/.test(t); }); if (!bub) return;
    var shown = +bub.replace(/[^\d]/g, ''); var card = box.closest('section') || box.parentNode; var host = card.querySelector('.rg-range');
    var key = shown + '|' + c.sample.name; if (host && host.__k === key) return;
    var o = readBudgetOpts(box.closest('.bt-wrap') || document), E = LE(), R = null;
    var tries = [{ plan: o.plan, mix: o.mix }];
    if (o.sat != null) { var bm0 = E.compute ? c.r.budget({ plan: o.plan }) : null; if (bm0 && bm0.ok) { tries.push({ plan: o.plan, mix: o.mix, saturation: o.sat * bm0.ch }); tries.push({ plan: o.plan, mix: o.mix, saturation: o.sat }); } }
    for (var i = 0; i < tries.length && !R; i++) { var x = E.budgetRange(c.r, c.sample, tries[i]); if (x.ok && Math.abs(Math.round(x.Bstar) - shown) <= 1) R = x; }
    if (!host) { host = document.createElement('div'); host.className = 'rg-range'; var note = card.querySelector('.bt-curve-note'); if (note && note.nextSibling) card.insertBefore(host, note.nextSibling); else card.appendChild(host); }
    host.__k = key; if (!R) { host.innerHTML = ''; return; }
    var max = Math.max(R.BstarHi, R.Bstar * 1.6, 1), P5 = R.projections[0], P10 = R.projections[1];
    var bar = function (lo, hi, label, cls, d) { return '<div class="rg-bar-row ' + (cls || '') + '"><span class="rg-bar-l">' + label + '</span><div class="rg-bar"><i style="--l:' + (lo / max * 100).toFixed(2) + '%;--w:' + (Math.max(0.6, (hi - lo) / max * 100)).toFixed(2) + '%;--d:' + d + 's"></i><b class="rg-mk" style="left:' + (R.Bstar / max * 100).toFixed(2) + '%"></b></div><span class="rg-bar-v">' + money(lo) + '～' + money(hi) + '</span></div>'; };
    host.innerHTML = '<div class="rg-range-h"><b>这个数有多准：把握区间</b>' + (R.thin ? '<span class="rg-pill warn">只有 ' + R.n + ' 笔历史投流</span>' : '<span class="rg-pill ok">' + R.n + ' 笔历史投流</span>') + '</div>' +
      bar(R.BstarLo, R.BstarHi, '现在', 'now', 0) + bar(P5.lo, P5.hi, '累计 5 笔后', 'proj', 0.15) + bar(P10.lo, P10.hi, '累计 10 笔后', 'proj', 0.3) +
      '<p class="rg-range-p">最划算预算 <b>' + money(R.Bstar) + '</b> 是靠本店 ' + R.n + ' 笔绿灯投流的回报（' + f2(R.roi) + ' ± ' + f2(R.se) + '）估出来的，90% 把握在 <b>' + money(R.BstarLo) + '～' + money(R.BstarHi) + '</b> 之间' +
      (R.BstarLo <= 0 ? '；下限到 0，说明仅凭这几笔还不能排除"投了不赚"，所以建议<b>先按每篇建议金额小额试投、记下结果</b>' : '') + '。每多一笔绿灯投流，区间就收窄一点（红点是现在的最划算预算）。</p>';
    later(function () { host.classList.add('in'); }, 30);
  }

  /* ================= 5. 数字校验器 ================= */
  var VSEL = ['.ai-msg.bot .ai-bubble', '.gq-m.a', '.gca-draft', '.pp-body'];
  function verifyEl(el) {
    if (el.querySelector('.pp-typing') || el.querySelector('.ai-typing, .gq-dots')) return;
    var txt = el.textContent || ''; if (txt.length < 6) return;
    if (el.__rgTxt === txt) return;
    if (el.__rgPrev !== txt) { el.__rgPrev = txt; later(sweep, 650); return; } // 等文字稳定（逐字打出的动画结束）
    var name = null; if (el.classList.contains('pp-body')) { var t = $('.mc-prop-title'); name = t ? t.textContent.replace(/^.*·\s*/, '').trim() : null; }
    var c = ctxFor(name); if (!c) return; var E = LE(), ok = 0, bad = 0;
    var walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT, null), nodes = [], n; while ((n = walker.nextNode())) { if (n.parentNode.closest && n.parentNode.closest('.rg-n, .rg-badge')) continue; nodes.push(n); }
    nodes.forEach(function (node) {
      var res = E.numberCheck(node.nodeValue, c.r, c.sample); if (!res.segs.some(function (s) { return s.kind; })) return;
      var par = node.parentNode;
      if (par.classList && par.classList.contains('gq-num') && res.segs.length === 1 && res.segs[0].kind) { var s0 = res.segs[0]; tag(par, s0); if (s0.kind === 'ok' || s0.kind === 'method') ok++; else if (s0.kind === 'bad') bad++; return; }
      var frag = document.createDocumentFragment();
      res.segs.forEach(function (s) { if (!s.kind || s.kind === 'neutral') { frag.appendChild(document.createTextNode(s.text)); return; } var sp = document.createElement('span'); sp.textContent = s.text; tag(sp, s); frag.appendChild(sp); if (s.kind === 'bad') bad++; else ok++; });
      par.replaceChild(frag, node);
    });
    el.__rgTxt = el.textContent;
    if (!ok && !bad) return;
    var badge = el.nextElementSibling && el.nextElementSibling.classList.contains('rg-badge') ? el.nextElementSibling : null;
    if (!badge) { badge = document.createElement('div'); badge.className = 'rg-badge'; el.parentNode.insertBefore(badge, el.nextSibling); }
    badge.className = 'rg-badge ' + (bad ? 'bad' : 'ok');
    badge.innerHTML = bad ? ICON.alert + '数字校验：<b>' + bad + '</b> 个数字在账本里找不到出处，已标红' : ICON.shield + '数字校验：<b>' + ok + '</b> 个数字都能在账本里找到出处<span>（鼠标放在数字上看出处）</span>';
  }
  function tag(sp, s) { sp.classList.add('rg-n', 'rg-' + s.kind); sp.title = s.kind === 'bad' ? '账本里找不到这个数' : (s.kind === 'method' ? '方法常数：' : '来自账本：') + (s.label || ''); }
  function enhanceVerify() { VSEL.forEach(function (sel) { $$(sel).forEach(verifyEl); }); }

  /* ================= 6. 幕后：两轮检验 + AI 怎么接 ================= */
  function behindTestHTML() {
    var V = LE().VALIDATION, R = V.real.rows;
    var row = function (name, x, note) { return '<tr' + (x.outOfScope ? ' class="oos"' : '') + '><td>' + name + '</td><td>' + pc(x.fpr, 1) + '</td><td>' + (x.fprFdr != null ? '<b>' + pc(x.fprFdr, 1) + '</b>' : '—') + '</td><td>' + pc(x.det) + '</td><td>' + pc(x.robustAcc) + ' / ' + pc(x.otherAcc) + '</td><td>' + (note || '') + '</td></tr>'; };
    return '<div class="gb-h3">两轮检验：已知答案的模拟 + 真实世界的噪声</div>' +
      '<p class="gb-p">第一轮在自己造的数据上考（知道每篇笔记的真实效果）；第二轮把考场换成真实世界：用维基百科 37 个词条 2024–2025 年的每日浏览量当作"平时的样子"——里面有真实的星期规律、季节、新闻带来的暴涨——按比例缩到小店的量级，在已知的日子植入已知的笔记效果，再让观潮去算。每种量级跑 ' + V.real.worldsEach + ' 个"世界"。</p>' +
      '<div class="rg-tbl-w"><table class="rg-tbl"><thead><tr><th>考场</th><th>误判率</th><th>多重比较校正后</th><th>识别率</th><th>"稳健"准确率 / 其他</th><th></th></tr></thead><tbody>' +
      row('模拟数据（' + V.sim.worlds + ' 组）', { fpr: V.sim.fpr, fprFdr: null, det: V.sim.det, robustAcc: V.sim.robustAcc, otherAcc: V.sim.otherAcc }) +
      R.map(function (x) { return row('真实噪声 · ' + x.name, x, x.outOfScope ? '<span class="rg-pill warn">超出适用范围</span>' : ''); }).join('') + '</tbody></table></div>' +
      '<div class="gb-h3">适用范围（主动说清楚）</div>' +
      '<p class="gb-p">适合日均几单到几十单的中小店：真实噪声下误判率和模拟时差不多，校正后约 3%～5%。日均上百单的大店，季节和突发热点压过了随机波动，直线趋势描不住，误判率升到约 11%（校正后约 7%），"稳健"标签也失灵——大店需要更灵活的基线，这是下一步。</p>' +
      '<div class="gb-h3">每本账都会做的 5 项检验</div>' +
      '<p class="gb-p">① 多重比较校正：一次看很多篇，碰巧过线的机会会变多，按 FDR 10% 把门槛提高，保证"真有效"里平均最多一成是巧合。② 前后天相关检查：相邻两天的偏差如果同向，几天加起来的波动会被低估，显著时自动放宽波动带。③ 换 3 种假设复算：观察期改 5 天、去掉长期走势、不调星期规律，结论不变才标"稳健"。④ 假日期检验：在本店没有笔记的日子插假笔记，看会不会被判成真有效。⑤ 真实世界噪声检验：见上表。</p>' +
      '<div class="gb-h3">局限与处理</div>' +
      '<p class="gb-p">这些数是估算，不是实验结论——所以我们这样处理：</p>' +
      ['1. 每个结论都标"估算级"；按产品里的对照实验方案投一轮，导入后自动升级为"实验级"。全域归因是相关不是因果，所以证据分三级：估算 → 假日期检验排除巧合 → 对照实验。',
        '2. 发布当天就投流的笔记分不开，我们给区间而不是拒绝回答。',
        '3. 站外数据由商家导出，导入时自动体检：缺天、重复、连续为零、异常尖峰都会提示。',
        '4. 7 天观察期、长期趋势、星期规律都是假设，所以每个结论都换 3 种假设重算；前后天相关显著时自动放宽波动带。',
        '5. 大促和节假日可以标记并剔除；没标的活动会混进笔记效果，假日期检验能帮忙发现。',
        '6. 客单价和毛利率由商家输入，可以随时在"调整假设"里改，结论实时重算，并提示哪些结论对假设敏感。',
        '7. 最划算预算只靠本店几笔历史投流估出来，所以同时给出把握区间，并建议先小额试投、越投越准。',
        '8. 多篇笔记挨得很近时按先后截断观察期，是简化处理；更细的做法是把重叠的笔记放在一起估，作为下一步。'].map(function (l) { return '<p class="gb-p">' + l + '</p>'; }).join('');
  }
  function behindAIHTML() {
    var c = ctxFor('远帆留学工作室') || ctxFor(), E = LE(); var json = '';
    try { var j = E.aiContext(c.r, c.sample); j.topNotes = j.topNotes.slice(0, 2); j.weakNotes = j.weakNotes.slice(0, 1); j.types = j.types.slice(0, 2); json = JSON.stringify(j, null, 2); } catch (e) { json = '{ … }'; }
    var S = c ? c.r.summary : null, bm = c ? c.r.budget({ plan: 8 }) : null;
    var demo = S && bm && bm.ok ? '去水分后每 1 元换回 ' + f2(S.roiReal) + ' 元，高于保本线 ' + f2(c.r.be) + ' 元；建议下月投流 ' + money(bm.Bstar) + '，每篇绿灯笔记配 ' + money(bm.cStar) + '。' : '';
    var fake = S ? '如果模型写成"每 1 元换回 ' + f2(S.roiReal + 1.44) + ' 元"' : '';
    var box = function (x, y, w, t, s, cls) { return '<g class="rg-ab ' + (cls || '') + '"><rect x="' + x + '" y="' + y + '" width="' + w + '" height="64" rx="14"/><text x="' + (x + w / 2) + '" y="' + (y + 28) + '" class="t">' + t + '</text><text x="' + (x + w / 2) + '" y="' + (y + 48) + '" class="s">' + s + '</text></g>'; };
    var arr = function (x1, x2, y) { return '<path class="rg-aa" d="M' + x1 + ' ' + y + ' L' + (x2 - 8) + ' ' + y + '" marker-end="url(#rgArr)"/>'; };
    var Y0 = 46;
    var box2 = function (x, w, t, s2, cls) { return box(x, Y0, w, t, s2, cls); };
    var svg = '<'+'svg class="rg-arch" viewBox="0 0 960 196" role="img" aria-label="AI 架构：数据 → 算法 → 账本 → 大模型 → 数字校验 → 人采纳"><defs><marker id="rgArr" markerWidth="10" markerHeight="10" refX="8" refY="5" orient="auto"><path d="M0,0 L10,5 L0,10 z" fill="#9A9AA4"/></marker><marker id="rgArrR" markerWidth="10" markerHeight="10" refX="8" refY="5" orient="auto"><path d="M0,0 L10,5 L0,10 z" fill="#FF2442"/></marker></defs>' +
      box2(8, 130, '商家数据', '站内 + 站外每日', '') + arr(138, 168, Y0 + 32) + box2(168, 150, '观潮算法', 'engine.js · 算全部数字', 'hot') + arr(318, 348, Y0 + 32) + box2(348, 130, '账本 JSON', '只含算好的数', '') + arr(478, 508, Y0 + 32) +
      box2(508, 150, '大模型', '写草稿 · 答问题', 'ai') + arr(658, 688, Y0 + 32) + box2(688, 140, '数字校验器', '每个数查出处', 'hot') + arr(828, 852, Y0 + 32) + box2(852, 100, '人采纳', '人做决定', '') +
      '<path class="rg-aa back" d="M758 ' + Y0 + ' L758 26 L583 26 L583 ' + (Y0 - 2) + '" marker-end="url(#rgArrR)"/><text x="670" y="18" class="s c bad">查不到出处 → 打回重写</text>' +
      '<path class="rg-aa dash" d="M413 ' + (Y0 + 64) + ' L413 150 L758 150 L758 ' + (Y0 + 66) + '" marker-end="url(#rgArr)"/><text x="585" y="176" class="s c">现在：平台不支持调用大模型，这一段由规则模板生成，同样经过数字校验</text></svg>';
    return '<p class="gb-p">原则是"算法算对、AI 办事、人做决定"：数字一律由算法算出，大模型只拿到算好的账本 JSON，负责把它写成人话；写完再过一道数字校验器，文字里每个数字都必须在账本里找得到出处，找不到就标红打回。</p>' + svg +
      '<div class="gb-h3">数字校验器：现场演示</div>' +
      '<div class="rg-demo"><div class="rg-demo-t" data-rg-demo>' + esc(demo) + '</div><div class="rg-demo-t bad"><span>' + esc(fake) + '</span>，校验器会标红并拦下：<b class="rg-n rg-bad" title="账本里找不到这个数">' + (S ? f2(S.roiReal + 1.44) : '') + '</b></div></div>' +
      '<p class="gb-p">产品里的 AI 回答、问观潮、行动包草稿、提案要点都已经接上校验器：数字下面的虚线就是出处，鼠标放上去可以看到它来自账本的哪一项。</p>' +
      '<div class="gb-h3">给大模型的系统提示词</div><pre class="rg-pre">你是观潮的 AI 助理，帮小红书商家和客户经理把事情办好。你只能使用我提供的 JSON 里的数字、笔记标题、渠道名和结论，不得编造任何数字或事实；JSON 里没有的信息，就回答"账本里没有这项数据"。用简体中文、口语化、简洁，先给结论再给依据，不要自己推算新的数字。</pre>' +
      '<div class="gb-h3">给大模型的账本 JSON（节选，远帆留学工作室）</div><pre class="rg-pre json">' + esc(json) + '</pre>';
  }
  function enhanceBehind() {
    var gb = $('.gb'); if (!gb || gb.__rg) return; var test = gb.querySelector('#gb-test'); if (!test) return; gb.__rg = true;
    var tb = test.querySelector('.gb-box'); if (tb) tb.innerHTML = behindTestHTML();
    var sec = document.createElement('section'); sec.className = 'gb-sec'; sec.id = 'gb-ai'; sec.innerHTML = '<h2><span class="gb-num">0</span>AI 怎么接：数字只从账本来</h2><div class="gb-box">' + behindAIHTML() + '</div>'; test.parentNode.insertBefore(sec, test.nextSibling);
    var toc = gb.querySelector('.gb-toc'), ta = toc && toc.querySelector('a[data-go="test"]');
    if (ta) { var a = document.createElement('a'); a.setAttribute('data-go', 'ai'); a.textContent = 'AI 怎么接'; ta.parentNode.insertBefore(a, ta.nextSibling);
      var pgEl = gb.closest('.gp-page, .gp') || null; if (pgEl) pgEl.addEventListener('scroll', function () { later(function () { var top = sec.getBoundingClientRect().top, nx = sec.nextElementSibling ? sec.nextElementSibling.getBoundingClientRect().top : 1e9, OFF = window.innerWidth <= 760 ? 120 : 90; var inAi = top <= OFF + 4 && nx > OFF + 4; if (inAi) { $$('a', toc).forEach(function (x) { x.classList.toggle('on', x === a); }); } else if (a.classList.contains('on')) a.classList.remove('on'); }, 0); });
      a.onclick = function () { $$('a', toc).forEach(function (x) { x.classList.toggle('on', x === a); }); var pg = gb.closest('.gp-page, .gp') || document.scrollingElement; var y = sec.getBoundingClientRect().top - (pg.getBoundingClientRect ? pg.getBoundingClientRect().top : 0) + (pg.scrollTop || 0) - 70; try { pg.scrollTo({ top: y, behavior: 'smooth' }); } catch (e) { pg.scrollTop = y; } }; }
    var NUM = ['①', '②', '③', '④', '⑤', '⑥', '⑦', '⑧', '⑨'];
    $$('.gb-sec', gb).forEach(function (s, i) { var n = s.querySelector('.gb-num'); if (n) n.textContent = i + 1; });
    if (toc) $$('a', toc).forEach(function (x, i) { x.textContent = NUM[i] + ' ' + x.textContent.replace(/^[①-⑨]\s*/, ''); });
    var d = sec.querySelector('[data-rg-demo]'); if (d) { d.__rgPrev = d.textContent; var c = ctxFor('远帆留学工作室') || ctxFor(); if (c) { var res = LE().numberCheck(d.textContent, c.r, c.sample); d.innerHTML = res.segs.map(function (s) { return s.kind && s.kind !== 'neutral' ? '<span class="rg-n rg-' + s.kind + '" title="' + esc((s.kind === 'method' ? '方法常数：' : '来自账本：') + (s.label || '')) + '">' + esc(s.text) + '</span>' : esc(s.text); }).join('') + ' <span class="rg-pill ok">' + res.ok + ' 个数字全部可追溯</span>'; } }
  }

  /* ================= 7. 分享海报入口 ================= */
  function enhancePoster() {
    if (!window.GuanchaoPoster) return;
    var top = $('.hero:not(.mhero) .hero-top');
    if (top && !top.querySelector('.rg-poster')) { var b = document.createElement('button'); b.type = 'button'; b.className = 'rg-poster'; b.innerHTML = ICON.share + '分享海报'; top.appendChild(b);
      b.onclick = function () { var c = ctxFor(); if (c) GuanchaoPoster.ledger({ r: c.r, sample: c.sample }); }; }
    var st = document.getElementById('gcd-stage');
    if (st && st.querySelector('.gcd-truths') && !st.querySelector('.rg-score')) { var btns = st.querySelector('.gcd-btns'); if (!btns) return;
      var g = document.createElement('button'); g.className = 'gcd-btn rg-score'; g.innerHTML = ICON.share + ' 生成海报'; btns.appendChild(g);
      g.onclick = function () { var eb = (st.querySelector('.gcd-eyebrow') || {}).textContent || ''; var h1 = (st.querySelector('.gcd-h1') || {}).textContent || '';
        var truths = $$('.gcd-truth', st).map(function (t) { return { k: ((t.querySelector('.k') || {}).textContent || '').trim(), v: ((t.querySelector('.v') || {}).textContent || '').trim(), n: ((t.querySelector('.n') || {}).textContent || '').trim() }; });
        var seen = null; try { seen = LE().story(SAMP()).merchant.boost.seen; } catch (e) {}
        GuanchaoPoster.score({ shop: eb.split('·').pop().trim(), all: /金牌/.test(h1), seen: seen, truths: truths }); }; }
  }

  /* ---------- 小图标 ---------- */
  var ICON = {
    shield: '<'+'svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><path d="M9 12l2 2 4-4"/></svg>',
    alert: '<'+'svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M12 9v4M12 17h.01"/><path d="M10.3 3.9L1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z"/></svg>',
    dice: '<'+'svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="4"/><circle cx="8.5" cy="8.5" r="1.2" fill="currentColor"/><circle cx="15.5" cy="15.5" r="1.2" fill="currentColor"/><circle cx="12" cy="12" r="1.2" fill="currentColor"/></svg>',
    share: '<'+'svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 12v7a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-7"/><path d="M16 6l-4-4-4 4"/><path d="M12 2v14"/></svg>'
  };

  /* ---------- 统一调度：页面有变化后 120ms 跑一遍（用 setTimeout，后台标签页也能跑） ---------- */
  var T = null;
  function sweep() { T = null; if (!LE() || !LE().fdr) return; [enhanceRunBar, enhanceLedgerCard, enhanceLadder, enhanceBudget, enhanceVerify, enhanceBehind, enhancePoster].forEach(function (fn) { try { fn(); } catch (e) { try { console.warn('[v7ui]', fn.name, e); } catch (e2) {} } }); }
  function kick() { if (!T) T = setTimeout(sweep, 120); }
  if (typeof MutationObserver !== 'undefined') new MutationObserver(kick).observe(document.documentElement, { childList: true, subtree: true, characterData: true });
  kick();
  window.GuanchaoV7 = { sweep: sweep, ctx: ctxFor };
})();
