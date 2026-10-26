// 种草参谋计算引擎：所有数字由这里算出，AI 只负责解读
// 第七版：新增 fdr（多重比较校正）/ autocorr（前后天相关诊断，显著时自动放宽波动带）/ placebo（假日期检验）/ budgetRange（预算把握区间）/ numberCheck（数字校验器）/ VALIDATION（检验结果）。示例店的所有数字不变。
// 第六版：新增 explainNote / explainLight / explainTotal（把计算过程逐步列出）、dayInfo（折线图悬停）、experimentDemo（实验级示例）。已有接口和数字不变。
const LedgerEngine = (() => {
  const WINDOW = 7, BOOST_WINDOW = 5, Z = 1.645;
  const DEFAULT_SHAPE = [0.28, 0.22, 0.16, 0.12, 0.09, 0.07, 0.06];
  const SHAPE10 = [0.26, 0.20, 0.15, 0.11, 0.08, 0.06, 0.05, 0.04, 0.03, 0.02];
  const shapeFor = (W) => { if (W === 7) return DEFAULT_SHAPE.slice(); const base = (W <= 7 ? DEFAULT_SHAPE : SHAPE10).slice(0, W); const t = sum(base); return base.map((v) => v / t); };
  const sum = (a) => a.reduce((x, y) => x + y, 0);
  const mean = (a) => (a.length ? sum(a) / a.length : 0);
  const weekday = (d) => new Date(d + 'T00:00:00').getDay();
  const addDays = (d, k) => { const x = new Date(d + 'T00:00:00'); x.setDate(x.getDate() + k); const p = (n) => String(n).padStart(2, '0'); return `${x.getFullYear()}-${p(x.getMonth() + 1)}-${p(x.getDate())}`; };
  const dayDiff = (a, b) => Math.round((new Date(b + 'T00:00:00') - new Date(a + 'T00:00:00')) / 864e5);

  // 平时的样子：星期规律 × 长期走势，只用"干净日"来估
  function fitBaseline(y, dates, clean, useTrend = true, useWeekday = true) {
    // 星期规律与长期走势交替估计（各迭代几次），避免"干净日"在一周内分布不均时两者互相干扰
    const wd = clean.map((t) => weekday(dates[t]));
    let wf = new Array(7).fill(1), a = mean(clean.map((t) => y[t])), slope = 0;
    for (let it = 0; it < 8; it++) {
      const zs = clean.map((t, i) => y[t] / (wf[wd[i]] || 1));
      if (useTrend && clean.length >= 10) {
        const mx = mean(clean), mz = mean(zs);
        const sxx = sum(clean.map((x) => (x - mx) ** 2));
        slope = sxx > 0 ? sum(clean.map((x, i) => (x - mx) * (zs[i] - mz))) / sxx : 0;
        a = mz - slope * mx;
      } else { a = mean(zs); slope = 0; }
      const nw = new Array(7).fill(1);
      for (let w = 0; w < 7; w++) {
        const idx = clean.map((t, i) => i).filter((i) => wd[i] === w);
        const lv = idx.map((i) => Math.max(1e-6, a + slope * clean[i]));
        if (idx.length >= 2) nw[w] = sum(idx.map((i) => y[clean[i]])) / sum(lv);
      }
      const m = mean(nw); wf = useWeekday ? nw.map((v) => v / m) : new Array(7).fill(1);
    }
    const predict = (t, d) => Math.max(0, (a + slope * t) * wf[weekday(d)]);
    const baseline = dates.map((d, t) => predict(t, d));
    return { wf, a, slope, baseline, predict };
  }
  function residSigma(y, baseline, clean) {
    // 自由度修正：平时的样子用掉了约 8 个参数（整体水平、走势、星期规律），波动要除以 (天数 − 8)，否则会低估
    const r = clean.map((t) => y[t] - baseline[t]);
    return Math.sqrt(sum(r.map((v) => v * v)) / Math.max(1, r.length - 8));
  }

  function acDiag(y, baseline, clean, W) {
    const cl = new Set(clean); let num = 0, den = 0, pairs = 0;
    clean.forEach((t) => { const e = y[t] - baseline[t]; den += e * e; if (cl.has(t + 1)) { num += e * (y[t + 1] - baseline[t + 1]); pairs++; } });
    const rho = den > 0 ? num / den : 0, thr = pairs ? Z / Math.sqrt(pairs) : 1;
    let f = W; for (let j = 1; j < W; j++) f += 2 * (W - j) * Math.pow(Math.max(0, rho), j);
    return { rho, pairs, thr, significant: pairs >= 10 && rho > thr, infl: Math.sqrt(f / W) };
  }

  // 逐篇算账：观察期、增量、自然衰减、投流去水分、结论
  // 观察期内"多出来的量"的不确定性 = 每天的随机波动 + "平时的样子"本身的估计误差（整体水平、长期走势、星期规律）
  function makeVarFn(clean, dates) {
    const nc = Math.max(1, clean.length), mx = mean(clean), sxx = Math.max(1e-9, sum(clean.map((x) => (x - mx) ** 2)));
    const nw = new Array(7).fill(0); clean.forEach((t) => nw[weekday(dates[t])]++);
    return (ts, dts) => { const n = ts.length, tb = mean(ts);
      return n + n * n * (1 / nc + (tb - mx) ** 2 / sxx) + sum(dts.map((d) => 1 / Math.max(1, nw[weekday(d)]))); };
  }
  function analyze(y, baseline, sigma, notes0, N, uv, be, varFn, dates, W = WINDOW) {
    const DS = shapeFor(W);
    const win = (a, b) => { const ts = [], ds = []; for (let t = a; t <= b; t++) { ts.push(t); ds.push(dates[t]); } return [ts, ds]; };
    const bandW = (a, b) => Z * sigma * Math.sqrt(varFn(...win(a, b)));
    const band = (n) => Z * sigma * Math.sqrt(n);
    const notes = notes0.map((n, i) => {
      const nextP = i + 1 < notes0.length ? notes0[i + 1].p : N;
      const end = Math.min(n.p + W - 1, nextP - 1, N - 1);
      const excess = []; for (let t = n.p; t <= end; t++) excess.push(y[t] - baseline[t]);
      return { ...n, end, len: end - n.p + 1, cutByNext: n.p + W - 1 > nextP - 1 && nextP < N, cutByEnd: n.p + W - 1 > N - 1, excess, total: sum(excess) };
    });
    const src = notes.filter((n) => n.b == null && n.len === W && n.total > bandW(n.p, n.end));
    let shape = DS.slice(), shapeFromShop = false;
    if (src.length >= 2) {
      // 合并计算（各天增量之和 ÷ 总增量之和），不把单日的负数截成 0，避免把衰减规律估得过平
      const tot = sum(src.map((n) => n.total));
      const est = DS.map((_, k) => Math.max(0.01, sum(src.map((n) => n.excess[k])) / tot));
      const s = sum(est); shape = est.map((v, k) => 0.5 * (v / s) + 0.5 * DS[k]); shapeFromShop = true;
    }
    notes.forEach((n) => {
      n.boost = null;
      if (n.b == null) n.organic = n.total;
      else {
        const off = Math.max(0, n.b - n.p), cost = +n.boost_cost || 0;
        if (off === 0 || n.b > n.end) { n.organic = null; n.boost = { merged: true, cost, seen: n.total, verdict: 'merged' }; }
        else {
          const preSum = sum(n.excess.slice(0, off)), wPre = sum(shape.slice(0, off));
          const orgEst = Math.max(0, preSum / wPre), ratio = sum(shape.slice(off, n.len)) / wPre; n._shape = shape;
          const expectedOrganic = orgEst * sum(shape.slice(off, n.len));
          const seen = sum(n.excess.slice(off)), real = seen - expectedOrganic, bLen = n.len - off;
          n.organic = preSum + expectedOrganic;
          const B = n.boost = { merged: false, cost, seen, expectedOrganic, real, days: bLen, off, orgEst,
            band: Z * sigma * Math.sqrt(varFn(...win(n.b, n.end)) + ratio * ratio * varFn(...win(n.p, n.b - 1))),
            roiSeen: cost ? (seen * uv) / cost : null, roiReal: cost ? (real * uv) / cost : null };
          B.verdict = B.real <= 0 ? 'none' : B.real < B.band ? 'unclear' : B.roiReal >= be ? 'worth' : 'loss';
        }
      }
      n.bandN = bandW(n.p, n.end);
      const basis = n.organic != null ? n.organic : n.total;
      n.verdict = basis >= n.bandN ? 'real' : basis > 0 ? 'maybe' : 'none';
    });
    // 同日投流分不开的笔记：用同类（否则全店）无投流笔记的平均自然增量当"本来就会来"的参考，给出投流贡献的区间
    notes.forEach((n) => {
      if (!n.boost || !n.boost.merged) return;
      const finished = (m) => !(m.cutByEnd && m.len < W);
      const all = notes.filter((m) => m !== n && !m.boost && finished(m)), peers = all.filter((m) => m.type === n.type);
      const avg = (arr) => (arr.length ? mean(arr.map((m) => Math.max(0, m.total))) : 0);
      const ref = peers.length >= 2 ? avg(peers) : Math.max(avg(peers), avg(all)); const pool = peers.length >= 2 ? peers : all;
      const hi = Math.max(0, n.total), lo = Math.max(0, n.total - ref);
      const B = n.boost;
      B.range = { lo, hi, ref, basis: peers.length >= 2 ? `同类「${n.type}」笔记平均` : '本店无投流笔记平均', n: pool.length };
      B.roiLo = B.cost ? (lo * uv) / B.cost : null; B.roiHi = B.cost ? (hi * uv) / B.cost : null;
      B.rangeVerdict = B.roiLo != null && B.roiLo >= be ? 'worth' : B.roiHi != null && B.roiHi < be ? 'loss' : 'unclear';
    });
    return { notes, shape, shapeFromShop, sigma };
  }

  function compute(sample, opts = {}) {
    const W = opts.window || WINDOW, useTrend = opts.trend !== false, useWeekday = opts.weekday !== false;
    const daily = sample.daily, N = daily.length, dates = daily.map((d) => d.date);
    const idx = {}; dates.forEach((d, i) => (idx[d] = i));
    const st = sample.settings, uv = (sample.kind === 'lead' ? st.conv_rate : 1) * st.price, be = 1 / st.margin;
    const channels = sample.channels && sample.channels.length ? sample.channels : [{ key: 'value', name: sample.metric, scope: 'in' }];
    const ys = channels.map((c) => daily.map((d) => +d[c.key] || 0));
    const notes0 = sample.notes.map((n) => ({ ...n, p: idx[n.date], b: n.boost_date ? idx[n.boost_date] : null }))
      .filter((n) => n.p != null).sort((a, b) => a.p - b.p);
    const affected = new Array(N).fill(false);
    notes0.forEach((n) => {
      for (let k = 0; k < W && n.p + k < N; k++) affected[n.p + k] = true;
      if (n.b != null) for (let k = 0; k < BOOST_WINDOW && n.b + k < N; k++) affected[n.b + k] = true;
    });
    // 大促 / 节假日：从"平时的样子"里剔除
    const promo = new Set((sample.promo_dates || []).map((d) => idx[d]).filter((i) => i != null));
    promo.forEach((i) => (affected[i] = true));
    const clean = []; for (let t = 0; t < N; t++) if (!affected[t]) clean.push(t);

    const fits = ys.map((y) => fitBaseline(y, dates, clean, useTrend, useWeekday));
    const varFn = makeVarFn(clean, dates);
    const yT = dates.map((_, t) => sum(ys.map((y) => y[t])));
    const baseT = dates.map((_, t) => sum(fits.map((f) => f.baseline[t])));
    // 前后天相关（自相关）诊断：干净日里相邻两天的偏差是否同向；显著为正时，几天加总的波动会被低估，自动放宽波动带
    const ac = acDiag(yT, baseT, clean, W); const acOn = opts.ac !== false && ac.significant; const sF = acOn ? ac.infl : 1; ac.applied = acOn;
    const perCh = ys.map((y, j) => analyze(y, fits[j].baseline, residSigma(y, fits[j].baseline, clean) * sF, notes0, N, uv, be, varFn, dates, W));
    const sigmaT = residSigma(yT, baseT, clean) * sF;
    const T = analyze(yT, baseT, sigmaT, notes0, N, uv, be, varFn, dates, W);
    const inIdx = channels.findIndex((c) => c.scope === 'in');
    const outIdx = channels.findIndex((c) => c.scope === 'out');

    T.notes.forEach((n, i) => {
      n.byCh = perCh.map((a) => a.notes[i].total);
      n.inVerdict = inIdx >= 0 && channels.length > 1 ? perCh[inIdx].notes[i].verdict : null;
      n.misjudged = n.inVerdict != null && n.verdict === 'real' && n.inVerdict !== 'real';
      const pos = n.byCh.map((v) => Math.max(0, v)), ps = sum(pos);
      n.outShare = outIdx >= 0 && ps > 0 ? pos[outIdx] / ps : null;
      n.lo = n.total - n.bandN; n.hi = n.total + n.bandN;
    });

    const notes = T.notes;
    // 观察期还没走完的"进行中"笔记：不进总账，交给今日待办
    notes.forEach((n) => { n.live = n.cutByEnd && n.len < W; if (n.live) n.misjudged = false;
      n.promo = false; for (let t = n.p; t <= n.end; t++) if (promo.has(t)) n.promo = true;
      n.evidence = n.exp_group ? 'experiment-pending' : 'estimate'; });
    const done = notes.filter((n) => !n.live), totalInc = sum(done.map((n) => n.total));
    const incByCh = channels.map((_, j) => sum(done.map((n) => n.byCh[j])));
    const boosted = done.filter((n) => n.boost), sep = boosted.filter((n) => !n.boost.merged);
    const sepIdx = sep.map((n) => notes.indexOf(n)), sepCost0 = sum(sep.map((n) => n.boost.cost));
    // 只看站内的投流贡献 = 全域投流真贡献 × 投流那几天站内所占的份额（保证不会比全域还高）
    const inB = (i) => { const n = notes[i], off = n.b - n.p; if (inIdx < 0) return 0;
      const seenIn = sum(perCh[inIdx].notes[i].excess.slice(off)), seenT = n.boost.seen;
      const share = seenT > 0 ? Math.min(1, Math.max(0, seenIn / seenT)) : 0; return Math.max(0, n.boost.real) * share; };
    const roiIn = inIdx >= 0 && channels.length > 1 && sepCost0 ? (sum(sepIdx.map(inB)) * uv) / sepCost0 : null;
    const sepCost = sum(sep.map((n) => n.boost.cost));
    const byType = {};
    done.forEach((n) => { const v = n.organic != null ? n.organic : n.total; (byType[n.type] = byType[n.type] || []).push({ v, real: n.verdict === 'real' }); });
    const types = Object.entries(byType).map(([type, a]) => ({ type, count: a.length, avg: mean(a.map((x) => x.v)), realRate: a.filter((x) => x.real).length / a.length,
      green: (a.filter((x) => x.real).length + 0.5) / (a.length + 1) })).sort((p, q) => q.avg - p.avg);

    const r = {
      dates, y: yT, baseline: baseT, sigma: sigmaT, ys, channels, fits, clean, chSigma: perCh.map((a) => a.sigma), perCh, shape: T.shape, shapeFromShop: T.shapeFromShop,
      notes, done, live: notes.filter((n) => n.live), uv, be, types, inIdx, outIdx, window: W, useTrend, useWeekday, promoDays: promo.size, ac,
      summary: {
        days: N, noteCount: done.length, totalInc, roiIn, incInValue: inIdx >= 0 ? incByCh[inIdx] * uv : null, totalValue: totalInc * uv, incByCh,
        outShare: outIdx >= 0 ? Math.max(0, incByCh[outIdx]) / Math.max(1e-9, sum(incByCh.map((v) => Math.max(0, v)))) : null,
        misjudged: done.filter((n) => n.misjudged).length,
        real: done.filter((n) => n.verdict === 'real').length, maybe: done.filter((n) => n.verdict === 'maybe').length, none: done.filter((n) => n.verdict === 'none').length,
        boostCost: sum(boosted.map((n) => n.boost.cost)), sepCost,
        boostRealUnits: sum(sep.map((n) => n.boost.real)), boostSeenUnits: sum(sep.map((n) => n.boost.seen)),
        roiReal: sepCost ? (sum(sep.map((n) => n.boost.real)) * uv) / sepCost : null,
        roiSeen: sepCost ? (sum(sep.map((n) => n.boost.seen)) * uv) / sepCost : null,
      },
    };
    r.varFn = varFn; r.opts = opts; r.sample = sample;
    r.light = (date, d1, d2) => trafficLight(r, sample, date, d1, d2);
    r.budget = (opts) => budgetModel(r, sample, opts);
    return r;
  }

  // 投流红绿灯：新笔记前两天，跑赢平时了吗？
  function trafficLight(r, sample, date, d1, d2) {
    const t0 = dayDiff(r.dates[0], date), d2date = addDays(date, 1);
    const b1 = sum(r.fits.map((f) => f.predict(t0, date))), b2 = sum(r.fits.map((f) => f.predict(t0 + 1, d2date)));
    const sd2 = r.sigma * Math.sqrt(r.varFn([t0, t0 + 1], [date, d2date]));
    const ex = d1 + d2 - b1 - b2, z = ex / sd2;
    const w2 = r.shape[0] + r.shape[1];
    const pred = Math.max(0, ex) / w2, predBand = (Z * sd2) / w2;
    const color = z >= Z ? 'green' : z >= 0.5 ? 'yellow' : 'red';
    const hist = r.done.map((n) => ({ title: n.title, ex2: (n.excess[0] || 0) + (n.excess[1] || 0), verdict: n.verdict, boost: n.boost }));
    const rank = hist.filter((h) => h.ex2 > ex).length + 1;
    const bm = budgetModel(r, sample, {});
    return { b1, b2, ex, z, sd2, thr: Z * sd2, pred, predLo: Math.max(0, pred - predBand), predHi: pred + predBand, color, hist, rank, spend: bm.ok ? bm.cStar : 0, bm };
  }

  // 预算模拟：只给绿灯笔记投流 + 投流回报边际递减
  function budgetModel(r, sample, opts) {
    const st = sample.settings, uv = r.uv, m = st.margin;
    const good = r.done.filter((n) => n.boost && !n.boost.merged && n.verdict === 'real');
    const cost = sum(good.map((n) => n.boost.cost));
    const roiObs = cost ? (sum(good.map((n) => n.boost.real)) * uv) / cost : null;
    const ch = good.length ? cost / good.length : 0;
    const out = { ok: !!(roiObs && roiObs > 0), roiObs, ch, sourceCount: good.length };
    if (!out.ok) return out;
    const cs = opts.saturation || ch;
    const R0 = (roiObs * ch) / (cs * (1 - Math.exp(-ch / cs)));
    const plan = opts.plan || 8;
    const pos = r.types.map((t) => ({ ...t, mu: Math.max(0, t.avg) }));
    const topMu = Math.max(...pos.map((t) => t.mu), 1e-9);
    const reco = pos.filter((t) => t.mu >= 0.5 * topMu).slice(0, 3);
    const histCount = sum(pos.map((t) => t.count));
    const mixes = {
      hist: pos.map((t) => ({ type: t.type, n: (plan * t.count) / histCount, mu: t.mu, g: t.green })),
      reco: reco.map((t) => ({ type: t.type, n: plan / reco.length, mu: t.mu, g: t.green })),
    };
    const evalMix = (mix) => ({ organic: sum(mix.map((x) => x.n * x.mu)), green: sum(mix.map((x) => x.n * x.g)) });
    const H = evalMix(mixes.hist), RC = evalMix(mixes.reco);
    const useMix = opts.mix === 'hist' ? H : RC;
    const G = Math.max(useMix.green, 0.01);
    const curve = (B) => { const c = B / G; const rev = G * R0 * cs * (1 - Math.exp(-c / cs)); return { B, c, rev, units: rev / uv, profit: rev * m - B }; };
    const cStar = m * R0 > 1 ? cs * Math.log(m * R0) : 0;
    Object.assign(out, { cs, R0, plan, mixes, H, RC, useMix, G, curve, cStar, Bstar: cStar * G });
    return out;
  }

  // 对照实验：同类绿灯笔记一半投、一半不投，要多少篇才能测出投流效果
  function experiment(r, sample, opts) {
    const plan = opts.plan || 8, bm = budgetModel(r, sample, { plan });
    if (!bm.ok) return { ok: false };
    const spend = opts.spend || bm.cStar;
    const delta = (bm.R0 * bm.cs * (1 - Math.exp(-spend / bm.cs))) / r.uv;
    const realOrg = r.done.filter((n) => n.verdict === 'real').map((n) => (n.organic != null ? n.organic : n.total));
    const m = mean(realOrg), het = realOrg.length > 2 ? sum(realOrg.map((v) => (v - m) ** 2)) / (realOrg.length - 1) : (0.5 * m) ** 2;
    const varNote = het + r.sigma ** 2 * WINDOW;           // 一篇笔记的不确定性 = 笔记之间本来的差异 + 每天的随机波动
    const zA = 1.645, zB = 0.84;                           // 约 95% 把握不是巧合、80% 的机会能测出来
    const perArm = Math.max(2, Math.ceil((2 * (zA + zB) ** 2 * varNote) / Math.max(delta, 0.01) ** 2));
    const greens = Math.max(0.5, bm.G);
    return { ok: true, spend, delta, perArm, total: 2 * perArm, months: (2 * perArm) / greens, sdNote: Math.sqrt(varNote), het: Math.sqrt(het), greens, cost: perArm * spend, plan };
  }

  // —— 可信度：结论离"正常波动"有多远 ——
  function confidence(value, band) {
    const k = Math.abs(value) / Math.max(band, 1e-9);
    return k >= 2 ? { level: 'high', label: '高' } : k >= 1 ? { level: 'mid', label: '中' } : { level: 'low', label: '低' };
  }

  // —— 达人合作账：这位博主值不值这个报价 ——
  function kolLedger(r) {
    return r.done.filter((n) => n.kol_cost).map((n) => {
      const inc = n.organic != null ? n.organic : n.total, cost = +n.kol_cost;
      const revenue = inc * r.uv, roi = cost ? revenue / cost : null;
      const verdict = inc <= 0 ? 'none' : inc < n.bandN ? 'unclear' : roi >= r.be ? 'worth' : 'loss';
      const breakEven = Math.max(0, inc * r.uv / r.be);            // 报价不超过这个数才回本
      const perUnit = inc > 0 ? cost / inc : null;                    // 每个咨询/订单花了多少报价
      const advice = { worth: 'renew', loss: 'negotiate', unclear: 'test', none: 'stop' }[verdict];
      return { title: n.title, date: n.date, type: n.type, kol: n.kol_name || '合作达人', fans: n.kol_fans || null, cost, inc, band: n.bandN,
        lo: inc - n.bandN, hi: inc + n.bandN, revenue, roi, verdict, breakEven, perUnit, advice, outShare: n.outShare, conf: confidence(inc, n.bandN) };
    });
  }

  // —— 去水分小图：每天"实际多出来的量"和"不投流本来会来的量" ——
  function boostSeries(r, n) {
    if (!n.boost || n.boost.merged) return null;
    const B = n.boost, shape = n._shape || DEFAULT_SHAPE, days = [], actual = [], organic = [];
    for (let k = 0; k < n.len; k++) {
      days.push(r.dates[n.p + k]); actual.push(n.excess[k]);
      organic.push(k < B.off ? n.excess[k] : B.orgEst * shape[k]);
    }
    return { days, actual, organic, boostStartIndex: B.off, boostDate: n.boost_date };
  }

  // —— 双赢测算：保持现在的发文节奏，只按观潮调整投流 ——
  function winwin(r, sample) {
    const months = r.dates.length / 30;
    const plan = Math.max(3, Math.round(r.done.length / months));
    const bm = budgetModel(r, sample, { plan });
    const curMonthly = r.summary.boostCost / months;
    if (!bm.ok) return { ok: false, plan, curMonthly };
    const sug = bm.Bstar, cur = bm.curve(curMonthly), best = bm.curve(sug);
    return { ok: true, plan, curMonthly, sug, curProfit: cur.profit, sugProfit: best.profit,
      dMerchant: best.profit - cur.profit, dPlatform: sug - curMonthly, sugUnits: best.units, curUnits: cur.units };
  }

  // —— 下月排期表：哪天发什么、哪天看红绿灯、绿灯投多少 ——
  function schedule(r, sample, opts) {
    const plan = (opts && opts.plan) || 8, withExp = !(opts && opts.experiment === false);
    const bm = budgetModel(r, sample, { plan }); if (!bm.ok) return { ok: false };
    const last = r.dates[r.dates.length - 1], start = addDays(last, 1), N0 = r.dates.length;
    const base = (k) => sum(r.fits.map((f) => f.predict(N0 + k, addDays(start, k))));
    // 内容配比取整后交错排开
    const mix = bm.mixes.reco.map((x) => ({ ...x, k: Math.floor(x.n) }));
    let left = plan - sum(mix.map((x) => x.k));
    mix.slice().sort((a, b) => (b.n % 1) - (a.n % 1)).forEach((x) => { if (left > 0) { x.k++; left--; } });
    const seq = []; const cnt = mix.map((x) => x.k);
    while (seq.length < plan) { for (let i = 0; i < mix.length && seq.length < plan; i++) if (cnt[i] > 0) { seq.push(mix[i].type); cnt[i]--; } }
    const used = new Set(), posts = [];
    for (let i = 0; i < plan; i++) {
      let d = Math.round((i * 30) / plan) + 1, bestD = d;
      for (const dd of [d - 1, d, d + 1]) if (dd >= 0 && dd < 30 && !used.has(dd) && base(dd) > base(bestD)) bestD = dd;   // 挑附近流量更高的一天
      while (used.has(bestD)) bestD++;
      used.add(bestD);
      posts.push({ idx: i + 1, date: addDays(start, bestD), checkDate: addDays(start, bestD + 2), type: seq[i],
        expGroup: withExp ? (i % 2 === 0 ? 'boost' : 'hold') : null });
    }
    posts.sort((a, b) => (a.date < b.date ? -1 : 1));
    return { ok: true, start, end: addDays(start, 29), plan, spendPerGreen: bm.cStar, budget: bm.Bstar, expectedGreen: bm.G, posts };
  }

  // —— 笔记体检：给大模型的账本摘要 + 不接大模型时的规则版结论 ——
  function aiContext(r, sample) {
    const org = (n) => (n.organic != null ? n.organic : n.total);
    return {
      shop: sample.name, metric: sample.metric, valuePerUnit: Math.round(r.uv), breakEven: +r.be.toFixed(2),
      channels: r.channels.map((c) => c.name), outShare: r.summary.outShare != null ? +r.summary.outShare.toFixed(2) : null,
      types: r.types.map((t) => ({ type: t.type, notes: t.count, avgIncrease: +t.avg.toFixed(1), realRate: +t.realRate.toFixed(2) })),
      topNotes: r.done.filter((n) => n.verdict === 'real').sort((a, b) => org(b) - org(a)).slice(0, 5).map((n) => ({ title: n.title, type: n.type, increase: +org(n).toFixed(1) })),
      weakNotes: r.done.filter((n) => n.verdict !== 'real').slice(0, 5).map((n) => ({ title: n.title, type: n.type, increase: +org(n).toFixed(1) })),
      rules: ['发布后两天跑赢平时（绿灯）才投流', '没跑起来的笔记不要硬推', '效果要算上站外成交'],
    };
  }
  function noteCheck(r, title, body, classify) {
    const type = classify ? classify(title + ' ' + (body || '')) : '其他';
    const t = r.types.find((x) => x.type === type);
    const org = (n) => (n.organic != null ? n.organic : n.total);
    const tops = r.done.filter((n) => n.verdict === 'real').sort((a, b) => org(b) - org(a)).slice(0, 5);
    const has = (re, s) => re.test(s);
    const feat = (s) => ({ number: has(/\d/, s), firstPerson: has(/我|自己|亲测/, s), list: has(/清单|攻略|步骤|技巧|件事|表/, s), question: has(/[？?]|吗|怎么|多少/, s) });
    const f = feat(title), topShare = (key) => tops.filter((n) => feat(n.title)[key]).length / Math.max(1, tops.length);
    const tips = [];
    if (!f.number && topShare('number') >= 0.5) tips.push('标题里加一个具体数字：本店效果最好的笔记里，多数标题带数字');
    if (!f.firstPerson && topShare('firstPerson') >= 0.4) tips.push('加入亲身经历的说法（"我""亲测"）：经历类内容在本店更带货');
    if (!f.list && topShare('list') >= 0.4) tips.push('改成可照着做的清单或步骤，方便读者收藏');
    if (!f.question && topShare('question') >= 0.4) tips.push('用一个读者关心的问题开头，提高点击');
    if (t && r.types.indexOf(t) >= Math.ceil(r.types.length / 2)) tips.push(`「${type}」在本店排名靠后，考虑换成「${r.types[0].type}」的写法`);
    return { type, typeStats: t ? { avg: t.avg, count: t.count, realRate: t.realRate, rank: r.types.indexOf(t) + 1, of: r.types.length } : null,
      greenChance: t ? t.green : null, features: f, tips: tips.slice(0, 4), references: tops.slice(0, 3).map((n) => ({ title: n.title, type: n.type, increase: org(n) })) };
  }


  // —— 截图补录：把新识别出的几天数据并进店铺（同一天以新数据为准） ——
  function appendDaily(sample, rows) {
    const map = {}; sample.daily.forEach((d) => (map[d.date] = { ...d }));
    rows.forEach((r0) => { if (r0 && /^\d{4}-\d{2}-\d{2}$/.test(r0.date)) map[r0.date] = { ...(map[r0.date] || {}), ...r0 }; });
    const daily = Object.values(map).sort((a, b) => (a.date < b.date ? -1 : 1));
    return { ...sample, daily };
  }

  // —— 每日行动包：数字由算法给出，文字草稿由 AI 撰写（这里给出不接大模型时的模板草稿） ——
  function actionPack(r, sample) {
    const M = sample.metric, last = r.dates[r.dates.length - 1], today = addDays(last, 1), items = [];
    const money = (v) => '¥' + Math.round(v).toLocaleString('zh-CN');
    const org = (n) => (n.organic != null ? n.organic : n.total);
    // 1. 投流单
    r.live.forEach((n) => {
      const L = r.light(n.date, r.y[n.p], r.y[n.p + 1] || 0);
      if (L.color === 'green' && L.bm.ok) {
        const per = L.bm.curve(L.spend * L.bm.G).units / L.bm.G, roi = (per * r.uv) / Math.max(L.spend, 1);
        items.push({ kind: 'boost', title: `投流单：给「${n.title}」投 ${money(L.spend)}`, summary: `前两天已跑赢平时（绿灯），预计再多带来约 ${per.toFixed(1)} 个${M}，每 1 元换回约 ${roi.toFixed(2)} 元`,
          data: { note: n.title, spend: L.spend, days: 3, checkDate: addDays(today, 3), stopBelow: r.be, per, roi },
          draft: `笔记：${n.title}\n预算：${money(L.spend)}，分 3 天投完\n复查：${addDays(today, 3)} 上午复查一次\n自动停投规则：去水分后每 1 元换回低于 ${r.be.toFixed(2)} 元（保本线）就停` });
      } else {
        items.push({ kind: 'hold', title: `投流单：今天先不给「${n.title}」投流`, summary: L.color === 'yellow' ? '黄灯：前两天有苗头但还在正常波动内，明天再看' : '红灯：前两天没跑赢平时，建议改标题或封面后重发',
          data: { note: n.title, color: L.color }, draft: L.color === 'yellow' ? `明天上午再看一次：如果第 3 天仍明显高于平时，再按 ${money(L.spend)} 投。` : `建议改写标题和封面后重发，参考本店效果最好的「${r.types[0].type}」类写法。` });
      }
    });
    // 2. 内容稿
    const top = r.types[0], refs = r.done.filter((n) => n.type === top.type).sort((a, b) => org(b) - org(a)).slice(0, 3);
    items.push({ kind: 'content', title: `内容稿：下一篇写「${top.type}」`, summary: `这类在本店平均每篇多带来约 ${Math.round(top.avg)} 个${M}，排第 1`,
      data: { type: top.type, avg: top.avg, references: refs.map((n) => ({ title: n.title, increase: org(n) })) },
      draft: `参考本店效果最好的同类笔记：\n${refs.map((n) => `· ${n.title}（+${Math.round(org(n))} 个${M}）`).join('\n')}\n写法要点：标题里放具体数字或亲身经历；正文给出可以照着做的步骤；结尾放一张可保存的清单。` });
    // 3. 议价稿
    const kl = kolLedger(r), loss = kl.filter((k) => k.verdict === 'loss').sort((a, b) => b.cost - a.cost)[0], worth = kl.find((k) => k.verdict === 'worth');
    if (loss) items.push({ kind: 'negotiate', title: `议价稿：${loss.kol.split(' · ')[0]} 续约，报价谈到 ${money(loss.breakEven)} 以内`, summary: `上次报价 ${money(loss.cost)}，每 1 元只换回 ${loss.roi.toFixed(2)} 元，低于保本线`,
      data: loss, draft: `老师好！上次合作的《${loss.title}》反响很好，带来了不少真实的${M}，非常感谢～\n这次想继续合作，我们按实际效果核算了一下，预算大约在 ${money(Math.floor(loss.breakEven / 100) * 100)}。内容方向我们也准备了几个新选题供您挑选，期待继续合作！` });
    else if (worth) items.push({ kind: 'negotiate', title: `续约稿：${worth.kol.split(' · ')[0]} 值得按原价续约`, summary: `每 1 元报价换回 ${worth.roi.toFixed(2)} 元，高于保本线`, data: worth,
      draft: `老师好！上次合作的《${worth.title}》效果很好，想按原来的合作方式继续合作，期待您的新内容～` });
    // 4. 周报
    const S = r.summary;
    items.push({ kind: 'report', title: '周报：给老板的一页复盘', summary: `种草多带来 ${Math.round(S.totalInc)} 个${M}${S.outShare != null ? `，${Math.round(S.outShare * 100)}% 来自站外` : ''}`,
      data: { totalInc: S.totalInc, totalValue: S.totalValue, outShare: S.outShare, roiReal: S.roiReal },
      draft: `本期 ${S.noteCount} 篇笔记多带来约 ${Math.round(S.totalInc)} 个${M}${S.outShare != null ? `（${Math.round(S.outShare * 100)}% 在站外）` : ''}，约 ${money(S.totalValue)} 生意。\n投流去水分后每 1 元换回 ${S.roiReal != null ? S.roiReal.toFixed(2) : '—'} 元（保本线 ${r.be.toFixed(2)} 元）。\n下周：多写「${r.types.slice(0, 2).map((t) => t.type).join('」「')}」；只给绿灯笔记投流${loss ? `；${loss.kol.split(' · ')[0]} 续约前压价` : ''}。` });
    return { date: today, items };
  }

  // —— 种草侦探：开场闯关要用的全部数字（都从算法结果里取） ——
  function story(SAMPLES) {
    const sh = SAMPLES.shop, r = compute(sh), org = (n) => (n.organic != null ? n.organic : n.total);
    const bn = r.done.filter((n) => n.boost && !n.boost.merged).sort((a, b) => b.boost.seen - a.boost.seen)[0];
    const series = boostSeries(r, bn);
    const ans = r.done.find((n) => n.misjudged);
    const pool = r.done.filter((n) => n !== ans && !n.boost && n.inVerdict !== 'real').sort((a, b) => b.byCh[r.inIdx] - a.byCh[r.inIdx]).slice(0, 3);
    const card = (n) => ({ title: n.title, inside: n.byCh[r.inIdx], outside: n.byCh[r.outIdx], total: n.total, verdict: n.verdict, answer: n === ans, trap: n.byCh[r.outIdx] < -10 });
    const cards = [card(ans), ...pool.map(card)];
    const kl = kolLedger(r).filter((k) => k.verdict === 'loss').sort((a, b) => b.cost - a.cost)[0];
    const bm = r.budget({ plan: 8 });
    const merchant = { shop: sh.name, unitPrice: sh.settings.price, margin: sh.settings.margin, inName: r.channels[r.inIdx].name, outName: r.channels[r.outIdx].name,
      boost: { title: bn.title, cost: bn.boost.cost, boostDay: series.boostStartIndex + 1, seen: bn.boost.seen, organic: bn.boost.expectedOrganic, real: bn.boost.real, series },
      overall: { roiSeen: r.summary.roiSeen, roiReal: r.summary.roiReal, breakEven: r.be, boostCount: r.done.filter((n) => n.boost).length, boostCost: r.summary.boostCost, outShare: r.summary.outShare },
      cards, kol: kl ? { name: kl.kol, title: kl.title, cost: kl.cost, inc: kl.inc, roi: kl.roi, breakEven: kl.breakEven } : null,
      plan: { topTypes: r.types.slice(0, 2).map((t) => ({ type: t.type, avg: t.avg })), spendPerGreen: bm.cStar, budget: bm.Bstar } };
    const clients = ['coffee', 'shop', 'study'].map((k) => { const s = SAMPLES[k], rr = compute(s), w = winwin(rr, s), S = rr.summary;
      const status = S.roiIn < rr.be && S.roiReal >= rr.be ? 'risk' : S.roiReal < rr.be ? 'loss' : 'ok';
      return { key: k, name: s.name, roiIn: S.roiIn, roiReal: S.roiReal, breakEven: rr.be, outShare: S.outShare, outName: rr.channels[rr.outIdx].name, status, winwin: w }; });
    const lossC = clients.find((c) => c.status === 'loss'), lr = compute(SAMPLES[lossC.key]);
    const badBoost = lr.done.find((n) => n.boost && ['none', 'loss'].includes(n.boost.verdict));
    const lk = kolLedger(lr).filter((k) => k.verdict === 'loss').sort((a, b) => b.cost - a.cost)[0];
    const worst = lr.types[lr.types.length - 1];
    const rx = [
      { text: `停掉给没跑起来的笔记投流（如${badBoost ? '「' + badBoost.title + '」' : '去水分后没效果的那笔'}）`, right: true },
      { text: '只给发布两天就跑赢平时的笔记投流', right: true },
      lk ? { text: `${lk.kol.split(' · ')[0]} 续约前把报价谈到 ¥${Math.round(lk.breakEven).toLocaleString('zh-CN')} 以内`, right: true } : null,
      { text: '加大预算，所有笔记都投一遍', right: false, note: '没跑起来的笔记投流基本没效果，先把钱花在绿灯笔记上' },
      { text: `多做「${worst.type}」类内容`, right: false, note: `这类内容在本店平均每篇只多带来约 ${Math.max(0, Math.round(worst.avg))} 个${SAMPLES[lossC.key].metric}` },
    ].filter(Boolean);
    return { merchant, manager: { clients, prescriptionFor: lossC.name, prescription: rx } };
  }


  // —— 稳健性检验：换窗口、去趋势后，结论还一样吗 ——
  function robustness(r) {
    const sample = r.sample, variants = [{ window: 5, trend: true, weekday: true, tag: '5 天窗口' }, { window: 7, trend: false, weekday: true, tag: '去掉长期趋势' }, { window: 7, trend: true, weekday: false, tag: '不调星期规律' }];
    const runs = variants.map((v) => ({ v, r: compute(sample, v) }));
    const perNote = r.notes.map((n, i) => {
      const isReal = (x) => x.verdict === 'real', isWorth = (x) => !!(x.boost && !x.boost.merged && x.boost.verdict === 'worth');
      const base = isReal(n), bb = n.boost && !n.boost.merged ? isWorth(n) : null;
      const changed = [];
      runs.forEach(({ v, r: rr }) => { const m = rr.notes[i]; if (!m) return; const tag = v.tag;
        if (isReal(m) !== base) changed.push(`${tag}：${isReal(m) ? '变成真有效' : '不再是真有效'}`);
        if (bb != null && m.boost && !m.boost.merged && isWorth(m) !== bb) changed.push(`${tag}：投流${isWorth(m) ? '变成值得投' : '不再值得投'}`); });
      return { title: n.title, robust: changed.length === 0, changed };
    });
    const done = perNote.filter((_, i) => !r.notes[i].live);
    return { perNote, robustCount: done.filter((x) => x.robust).length, total: done.length, variants: variants.map((v) => v.tag) };
  }

  // —— 数据体检：导入或补录前先检查 ——
  function dataCheck(sample) {
    const issues = [], d = sample.daily || [], chans = (sample.channels && sample.channels.length ? sample.channels : [{ key: 'value', name: '数量' }]);
    const push = (level, text) => issues.push({ level, text });
    if (d.length < 45) push('error', `只有 ${d.length} 天数据，至少需要 45 天才能看清"平时的样子"`);
    const seen = new Set(); let gaps = 0, dup = 0;
    for (let i = 0; i < d.length; i++) {
      if (seen.has(d[i].date)) dup++; seen.add(d[i].date);
      if (i > 0 && dayDiff(d[i - 1].date, d[i].date) > 1) gaps += dayDiff(d[i - 1].date, d[i].date) - 1;
    }
    if (dup) push('error', `有 ${dup} 个重复日期`);
    if (gaps) push('warn', `中间缺了 ${gaps} 天，缺的日子会按没有数据处理`);
    chans.forEach((c) => {
      const v = d.map((x) => +x[c.key] || 0);
      if (v.some((x) => x < 0)) push('error', `「${c.name}」有负数`);
      let run = 0, maxRun = 0; v.forEach((x) => { run = x === 0 ? run + 1 : 0; maxRun = Math.max(maxRun, run); });
      if (maxRun >= 5) push('warn', `「${c.name}」有连续 ${maxRun} 天为 0，像是没录数据`);
      const sorted = v.slice().sort((a, b) => a - b), med = sorted[Math.floor(sorted.length / 2)] || 0;
      const mad = (sorted.map((x) => Math.abs(x - med)).sort((a, b) => a - b)[Math.floor(sorted.length / 2)] || 1);
      const spikes = d.filter((x, i) => v[i] > med + 6 * mad && v[i] > med + 10);
      if (spikes.length) push('warn', `「${c.name}」有 ${spikes.length} 天异常偏高（如 ${spikes[0].date}）：如果是大促，请在"大促日期"里标出来`);
    });
    const first = d[0] && d[0].date, last = d[d.length - 1] && d[d.length - 1].date;
    (sample.notes || []).forEach((n) => {
      if (first && (n.date < first || n.date > last)) push('warn', `笔记「${n.title}」的发布日期不在数据范围内，会被忽略`);
      if (n.boost_date && n.boost_date < n.date) push('error', `笔记「${n.title}」的投流开始日期早于发布日期`);
    });
    return { ok: !issues.some((x) => x.level === 'error'), issues };
  }

  // —— 假设敏感性：毛利率、客单价变化时，哪些投流/达人结论会翻转 ——
  function sensitivity(r) {
    const s = r.sample, base = r.be;
    const scenarios = [{ name: '毛利率 −20%', settings: { ...s.settings, margin: s.settings.margin * 0.8 } }, { name: '毛利率 +20%', settings: { ...s.settings, margin: Math.min(0.95, s.settings.margin * 1.2) } },
      { name: '客单价 −20%', settings: { ...s.settings, price: s.settings.price * 0.8 } }, { name: '客单价 +20%', settings: { ...s.settings, price: s.settings.price * 1.2 } }];
    const flips = [];
    scenarios.forEach((sc) => {
      const rr = compute({ ...s, settings: sc.settings });
      rr.notes.forEach((m, i) => { const n = r.notes[i]; if (n.boost && !n.boost.merged && m.boost && m.boost.verdict !== n.boost.verdict) flips.push(`${sc.name}：「${n.title}」投流 ${n.boost.verdict} → ${m.boost.verdict}`); });
      const k0 = kolLedger(r), k1 = kolLedger(rr);
      k0.forEach((k, i) => { if (k1[i] && k1[i].verdict !== k.verdict) flips.push(`${sc.name}：达人「${k.kol.split(' · ')[0]}」${k.verdict} → ${k1[i].verdict}`); });
    });
    return { breakEven: base, flips, stable: flips.length === 0 };
  }

  // —— 实验级结论：数据里带 exp_group（boost / hold）时，比较两组 ——
  function experimentResult(r) {
    const g = (k) => r.done.filter((n) => n.exp_group === k);
    const A = g('boost'), B = g('hold');
    if (A.length < 2 || B.length < 2) return { ok: false, nBoost: A.length, nHold: B.length };
    const v = (n) => n.total, mA = mean(A.map(v)), mB = mean(B.map(v));
    const varOf = (arr) => arr.length > 1 ? sum(arr.map((x) => (x - mean(arr)) ** 2)) / (arr.length - 1) : 0;
    const se = Math.sqrt(varOf(A.map(v)) / A.length + varOf(B.map(v)) / B.length) || 1e-9;
    const diff = mA - mB, z = diff / se, cost = mean(A.map((n) => (n.boost ? n.boost.cost : 0)));
    return { ok: true, nBoost: A.length, nHold: B.length, meanBoost: mA, meanHold: mB, diff, lo: diff - 1.645 * se, hi: diff + 1.645 * se, z, significant: z >= 1.645, roi: cost ? (diff * r.uv) / cost : null, cost };
  }


  // —— 这笔账怎么算的：把一篇笔记 / 一次红绿灯 / 总账的计算过程逐步列出来（给界面用；数字全部取自 compute 的结果，不另算一套） ——
  const WD = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];
  const f0 = (v) => String(Math.round(v));
  const f1 = (v) => (Math.round(v * 10) / 10).toFixed(1);
  const f2 = (v) => (Math.round(v * 100) / 100).toFixed(2);
  const sg = (v) => (v >= 0 ? '+' : '−') + f1(Math.abs(v));
  const pc = (v) => Math.round(v * 100) + '%';
  const md = (d) => { const x = new Date(d + 'T00:00:00'); return `${x.getMonth() + 1}月${x.getDate()}日`; };
  const money = (v) => '¥' + Math.round(v).toLocaleString('zh-CN');
  const VERDICT_LABEL = { real: '真有效', maybe: '可能是巧合', none: '没看到效果' };
  const BOOST_LABEL = { worth: '值得投', loss: '亏了', unclear: '说不清', none: '没看到效果', merged: '分不开' };

  // 某一天的情况（折线图悬停用）
  function dayInfo(r, t) {
    if (t < 0 || t >= r.dates.length) return null;
    const d = r.dates[t], band = Z * r.sigma;
    return { t, date: d, label: md(d), weekday: WD[weekday(d)], actual: r.y[t], baseline: r.baseline[t], excess: r.y[t] - r.baseline[t], lo: Math.max(0, r.baseline[t] - band), hi: r.baseline[t] + band,
      channels: r.channels.map((c, j) => ({ name: c.name, scope: c.scope, actual: r.ys[j][t], baseline: r.fits[j].baseline[t] })),
      clean: r.clean.indexOf(t) >= 0, notes: r.notes.filter((n) => t >= n.p && t <= n.end).map((n) => n.title),
      boosts: r.notes.filter((n) => n.b != null && t >= n.b && t < n.b + BOOST_WINDOW).map((n) => n.title),
      promo: (r.sample.promo_dates || []).indexOf(d) >= 0 };
  }

  // 一篇笔记的账是怎么算出来的（which：r.notes 的下标、笔记对象或标题；rb：可选，LedgerEngine.robustness(r) 的结果）
  function explainNote(r, which, rb) {
    const n = typeof which === 'number' ? r.notes[which] : r.notes.find((m) => m === which || m.title === which);
    if (!n) return null;
    const i = r.notes.indexOf(n), M = r.sample.metric, be = r.be;
    const days = []; for (let t = n.p; t <= n.end; t++) days.push({ date: r.dates[t], label: md(r.dates[t]), weekday: WD[weekday(r.dates[t])], actual: r.y[t], baseline: r.baseline[t], excess: r.y[t] - r.baseline[t],
      channels: r.channels.map((c, j) => ({ name: c.name, scope: c.scope, actual: r.ys[j][t], baseline: r.fits[j].baseline[t] })) });
    const sumA = sum(days.map((d) => d.actual)), sumB = sum(days.map((d) => d.baseline));
    const basis = n.organic != null ? n.organic : n.total, k = Math.abs(basis) / Math.max(n.bandN, 1e-9);
    const steps = [];
    const cut = n.live ? `（观察期还没走完，目前是第 ${n.len} 天）` : n.cutByNext ? `（被下一篇笔记截断，只算 ${n.len} 天）` : n.cutByEnd ? `（数据到期截止，只有 ${n.len} 天）` : '';
    steps.push({ key: 'window', title: '划出观察期', text: `从发布日 ${md(n.date)} 起算 ${n.len} 天（${md(r.dates[n.p])}–${md(r.dates[n.end])}）${cut}。` });
    steps.push({ key: 'baseline', title: '量平时的样子', text: `只用 ${r.clean.length} 个没有笔记和投流影响的"干净日"（共 ${r.dates.length} 天），拟合"整体水平 + 长期走势 × 星期规律"。按这个规律，这 ${n.len} 天平时预计合计 ${f1(sumB)} 个${M}。` });
    steps.push({ key: 'actual', title: '数实际来了多少', text: `这 ${n.len} 天实际 ${f0(sumA)} 个${M}，比平时多 ${sg(n.total)} 个。` });
    const B = n.boost;
    if (B && !B.merged) {
      const shape = n._shape || DEFAULT_SHAPE, preSum = sum(n.excess.slice(0, B.off)), wPre = sum(shape.slice(0, B.off));
      steps.push({ key: 'boost', title: '投流去水分', text: `投流从发布后第 ${B.off + 1} 天（${md(n.boost_date)}）开始，花了 ${money(B.cost)}。投流前 ${B.off} 天多出 ${f1(preSum)} 个；按本店的衰减规律，前 ${B.off} 天约占一篇笔记全部自然增量的 ${pc(wPre)}，推算这篇不投流也会带来约 ${f1(B.orgEst)} 个。投流的 ${B.days} 天里"本来就会来"约 ${f1(B.expectedOrganic)} 个，实际多出 ${f1(B.seen)} 个，所以投流真贡献 = ${f1(B.real)} 个（这几天的波动带 ±${f1(B.band)}）。每 1 元换回：看起来 ${f2(B.roiSeen)} 元 → 去水分后 ${f2(B.roiReal)} 元，保本线 ${f2(be)} 元 → ${BOOST_LABEL[B.verdict]}。` });
    } else if (B && B.merged && B.range) {
      const R = B.range;
      steps.push({ key: 'boost', title: '同日投流分不开', text: `发布当天就开始投流（${money(B.cost)}），自然流量和投流分不开。这 ${n.len} 天共多出 ${f1(n.total)} 个；按${R.basis}（${R.n} 篇）本来会来约 ${f1(R.ref)} 个，所以投流贡献在 ${f0(R.lo)}～${f0(R.hi)} 个之间，每 1 元换回 ${f2(B.roiLo)}～${f2(B.roiHi)} 元（保本线 ${f2(be)} 元）→ ${BOOST_LABEL[B.rangeVerdict]}。` });
    }
    const what = B && !B.merged ? `去掉投流贡献后，这篇自然多带来 ${sg(basis)} 个` : `多出的 ${sg(basis)} 个`;
    const judge = n.live ? `观察期还没走完，先不下结论，交给"该不该投"的红绿灯看前两天。` : n.verdict === 'real' ? `超过了波动带（约 95% 把握不是巧合）→ 真有效。` : n.verdict === 'maybe' ? `没有超过波动带，但大于 0 → 可能是巧合。` : `不大于 0 → 没看到效果。`;
    const acTxt = r.ac ? (r.ac.applied ? `（前后天相关 ρ≈${f2(r.ac.rho)}，显著，波动带已放宽 ${Math.round((r.ac.infl - 1) * 100)}%）` : `（已检查前后天相关 ρ≈${f2(r.ac.rho)}，不显著，不需放宽）`) : '';
    steps.push({ key: 'band', title: '问是不是巧合', text: `干净日里每天的正常波动 σ ≈ ${f1(r.sigma)}${acTxt}；${n.len} 天合计的波动带 = 1.645 × σ × √(天数 + 平时样子的估计误差) ≈ ±${f1(n.bandN)}。${what}，是波动带的 ${f1(k)} 倍，${judge}` });
    if (!n.live) { const F = fdr(r), row = F.rows.find((x) => x.title === n.title);
      if (row && n.verdict === 'real') steps.push({ key: 'fdr', title: '同时看 ' + F.m + ' 篇，还算不算数', text: row.keep ? `一次看 ${F.m} 篇，碰巧过线的机会会变多，所以再按多重比较校正（FDR 10%）把门槛提高：这篇仍然成立，本店 ${F.real} 篇真有效里 ${F.keep} 篇校正后仍成立。` : `一次看 ${F.m} 篇，碰巧过线的机会会变多；按多重比较校正（FDR 10%）把门槛提高后，这篇不再稳过线，请谨慎看待。` }); }
    if (r.channels.length > 1 && r.inIdx >= 0) {
      const inC = r.channels[r.inIdx], outC = r.channels[r.outIdx], inInc = n.byCh[r.inIdx], outInc = r.outIdx >= 0 ? n.byCh[r.outIdx] : 0;
      const inV = n.inVerdict ? VERDICT_LABEL[n.inVerdict] : '—';
      steps.push({ key: 'channels', title: '站内站外分开看', text: `站内「${inC.name}」多 ${sg(inInc)} 个（单独看是"${inV}"）${outC ? `，站外「${outC.name}」多 ${sg(outInc)} 个` : ''}；合起来才是"${n.live ? '进行中' : VERDICT_LABEL[n.verdict]}"${n.misjudged ? '——只看站内会误判。' : '。'}` });
    }
    const rbn = rb && rb.perNote ? rb.perNote[i] : null;
    if (rbn && !n.live) steps.push({ key: 'robust', title: '换 3 种算法再算一遍', text: rbn.robust ? `观察期改 5 天、去掉长期走势、不调星期规律，三种算法重算后结论都不变 → 标"稳健"。` : `换算法后结论有变化：${rbn.changed.join('；')} → 不标"稳健"，这个结论请谨慎。` });
    return { index: i, title: n.title, type: n.type, date: n.date, live: !!n.live, verdict: n.verdict, verdictLabel: n.live ? '进行中' : VERDICT_LABEL[n.verdict], confidence: confidence(basis, n.bandN),
      window: { start: r.dates[n.p], end: r.dates[n.end], days: n.len, cutByNext: !!n.cutByNext, cutByEnd: !!n.cutByEnd }, cleanDays: r.clean.length, totalDays: r.dates.length, sigma: r.sigma,
      days, sumActual: sumA, sumBaseline: sumB, total: n.total, organic: n.organic, basis, band: n.bandN, ratio: k, lo: n.lo, hi: n.hi,
      byCh: r.channels.map((c, j) => ({ name: c.name, scope: c.scope, inc: n.byCh[j] })), inVerdict: n.inVerdict, misjudged: !!n.misjudged, outShare: n.outShare,
      boost: B ? { ...B, boostDate: n.boost_date } : null, robust: rbn, steps };
  }

  // 红绿灯是怎么判的（L = r.light(date, d1, d2) 的结果）
  function explainLight(r, L, d1, d2) {
    const M = r.sample.metric, be = r.be, bm = L.bm, w2 = r.shape[0] + r.shape[1];
    const colorLabel = { green: '绿灯', yellow: '黄灯', red: '红灯' }[L.color];
    const steps = [];
    steps.push({ key: 'two', title: '看发布后两天', text: `平时发布当天预计 ${f1(L.b1)} 个${M}、第 2 天 ${f1(L.b2)} 个，合计 ${f1(L.b1 + L.b2)}；实际 ${f0(d1)} + ${f0(d2)} = ${f0(d1 + d2)} 个，多出 ${sg(L.ex)} 个。` });
    steps.push({ key: 'z', title: '跑赢平时了吗', text: `两天合计的正常波动 ≈ ±${f1(L.sd2)}；多出的量是波动的 ${f1(L.z)} 倍。规则：≥ 1.645 倍亮绿灯（约 95% 把握跑赢平时），0.5～1.645 倍黄灯，不到 0.5 倍红灯 → ${colorLabel}。` });
    steps.push({ key: 'pred', title: '预计整篇能带来多少', text: `按本店的衰减规律，前两天约占一篇笔记全部自然增量的 ${pc(w2)}，所以这篇预计自然带来约 ${f1(L.pred)} 个（可能 ${f0(L.predLo)}～${f0(L.predHi)}）。` });
    if (!bm.ok) steps.push({ key: 'spend', title: '投多少', text: `本店还没有"绿灯笔记投流"的历史，暂时给不出建议金额；先按小额试投，账本会记录效果。` });
    else if (L.color === 'green') {
      const per = bm.curve(L.spend * bm.G).units / bm.G, roi = (per * r.uv) / Math.max(L.spend, 1);
      steps.push({ key: 'spend', title: '投多少', text: `本店历史上给绿灯笔记投流，去水分后每 1 元换回 ${f2(bm.roiObs)} 元（${bm.sourceCount} 笔，平均每笔 ${money(bm.ch)}）。按"投得越多、每一元的回报越低"的递减模型，最划算的单篇投流 = 饱和点 × ln(毛利率 × 初始回报) ≈ ${money(L.spend)}；预计再多带来约 ${f1(per)} 个${M}，每 1 元换回 ${f2(roi)} 元（保本线 ${f2(be)} 元）。` });
    } else steps.push({ key: 'spend', title: '先不投', text: L.color === 'yellow' ? `黄灯：有苗头但还在正常波动内，明天再看一次；如果第 3 天仍明显高于平时，再按 ${money(L.spend)} 投。` : `红灯：前两天没跑赢平时，投流只会放大一篇没起来的笔记，建议改标题或封面后重发。` });
    return { color: L.color, colorLabel, steps, b1: L.b1, b2: L.b2, ex: L.ex, z: L.z, sd2: L.sd2, thr: L.thr, pred: L.pred, predLo: L.predLo, predHi: L.predHi, spend: L.spend, w2 };
  }

  // 总账是怎么加出来的
  function explainTotal(r) {
    const S = r.summary, M = r.sample.metric, st = r.sample.settings;
    const rows = r.done.map((n) => ({ title: n.title, date: n.date, type: n.type, total: n.total, organic: n.organic, boostReal: n.boost && !n.boost.merged ? n.boost.real : null, boostMerged: !!(n.boost && n.boost.merged), verdict: n.verdict, verdictLabel: VERDICT_LABEL[n.verdict], byCh: n.byCh }));
    const unitText = r.sample.kind === 'lead' ? `签约率 ${pc(st.conv_rate)} × 客单价 ${money(st.price)} ≈ ${money(r.uv)}` : `客单价 ${money(st.price)}`;
    const inName = r.inIdx >= 0 ? r.channels[r.inIdx].name : null, outName = r.outIdx >= 0 ? r.channels[r.outIdx].name : null;
    const steps = [
      { key: 'sum', title: '逐篇相加', text: `${S.noteCount} 篇已走完观察期的笔记，各自"实际 − 平时"的合计相加 = ${f0(S.totalInc)} 个${M}（含投流带来的部分，已把负数照实计入）${r.live.length ? `；进行中的 ${r.live.length} 篇不计入` : ''}。` },
      { key: 'value', title: '换算成生意', text: `每个${M}的价值按 ${unitText} 计，${f0(S.totalInc)} 个 ≈ ${money(S.totalValue)}。` },
    ];
    if (outName && S.outShare != null) steps.push({ key: 'channels', title: '站内站外各多少', text: `其中「${inName}」${f0(S.incByCh[r.inIdx])} 个，「${outName}」${f0(S.incByCh[r.outIdx])} 个（${pc(S.outShare)} 在站外）；只看站内会误判的笔记有 ${S.misjudged} 篇。` });
    return { rows, totalInc: S.totalInc, totalValue: S.totalValue, uv: r.uv, outShare: S.outShare, incByCh: S.incByCh, steps };
  }

  // 实验级示例：带 exp_group 的数据算一遍，并把"估算级"的看法和模拟器设定的真实效果放在一起
  function experimentDemo(sample) {
    const r = compute(sample), exp = experimentResult(r);
    const expBoost = r.done.filter((n) => n.exp_group === 'boost' && n.boost && !n.boost.merged);
    const est = expBoost.length ? { n: expBoost.length, meanReal: mean(expBoost.map((n) => n.boost.real)), meanSeen: mean(expBoost.map((n) => n.boost.seen)), cost: mean(expBoost.map((n) => n.boost.cost)) } : null;
    if (est) { est.roi = est.cost ? (est.meanReal * r.uv) / est.cost : null; est.roiSeen = est.cost ? (est.meanSeen * r.uv) / est.cost : null; }
    const truth = sample.truth_boost != null ? { perNote: sample.truth_boost, roi: est && est.cost ? (sample.truth_boost * r.uv) / est.cost : null } : null;
    return { r, exp, est, truth, be: r.be, uv: r.uv, metric: sample.metric };
  }


  // —— 正态分布右尾 ——
  const Phi = (z) => { const t = 1 / (1 + 0.2316419 * Math.abs(z)), d = 0.3989423 * Math.exp(-z * z / 2); const p = d * t * (0.3193815 + t * (-0.3565638 + t * (1.781478 + t * (-1.821256 + t * 1.330274)))); return z > 0 ? 1 - p : p; };

  // —— 多重比较校正（Benjamini–Hochberg，FDR 10%）：一次看很多篇，真有效里平均最多一成是巧合 ——
  function fdr(r, q = 0.10) {
    const rows = r.done.map((n) => { const basis = n.organic != null ? n.organic : n.total; const z = basis / Math.max(n.bandN / Z, 1e-9); return { title: n.title, z, p: 1 - Phi(z), verdict: n.verdict }; });
    const m = rows.length, order = rows.map((_, i) => i).sort((a, b) => rows[a].p - rows[b].p); let k = 0;
    order.forEach((idx, j) => { if (rows[idx].p <= ((j + 1) / m) * q) k = j + 1; });
    const thr = k ? rows[order[k - 1]].p : -1; rows.forEach((x) => (x.keep = x.verdict === 'real' && x.p <= thr));
    const real = rows.filter((x) => x.verdict === 'real').length, keep = rows.filter((x) => x.keep).length;
    return { q, m, threshold: thr, rows, real, keep, allKept: keep === real };
  }

  // —— 假日期检验（店内安慰剂）：在本店没有笔记、没有投流的日子插假笔记，看会不会被判成真有效 ——
  function placebo(r, opts = {}) {
    const s = r.sample, N = r.dates.length, W = r.window, busy = new Array(N).fill(false);
    r.notes.forEach((n) => { for (let t = n.p; t <= Math.min(N - 1, n.p + W - 1); t++) busy[t] = true; if (n.b != null) for (let t = n.b; t < Math.min(N, n.b + BOOST_WINDOW); t++) busy[t] = true; });
    const idx = {}; r.dates.forEach((d, i) => (idx[d] = i)); (s.promo_dates || []).forEach((d) => { if (idx[d] != null) busy[idx[d]] = true; });
    const positions = []; for (let t = 0; t + W <= N; t++) { let ok = true; for (let j = 0; j < W; j++) if (busy[t + j]) { ok = false; break; } if (ok) positions.push(t); }
    const max = opts.max || 40, step = Math.max(1, Math.ceil(positions.length / max)), pick = positions.filter((_, i) => i % step === 0);
    const tests = pick.map((t) => { const s2 = { ...s, notes: [...s.notes, { date: r.dates[t], title: '__假日期__', type: '假日期' }] }; const r2 = compute(s2, r.opts || {}); const pn = r2.notes.find((x) => x.title === '__假日期__');
      return { date: r.dates[t], verdict: pn ? pn.verdict : 'none', inc: pn ? pn.total : 0, band: pn ? pn.bandN : 0 }; });
    const alarms = tests.filter((x) => x.verdict === 'real').length;
    return { tries: tests.length, alarms, rate: tests.length ? alarms / tests.length : null, expected: 0.05, tests, enough: tests.length >= 5 };
  }

  // —— 预算把握区间：最划算预算只靠本店几笔绿灯投流估出来，笔数越少区间越宽 ——
  function budgetRange(r, sample, opts = {}) {
    const bm = budgetModel(r, sample, opts); if (!bm.ok) return { ok: false };
    const good = r.done.filter((n) => n.boost && !n.boost.merged && n.verdict === 'real'), cost = sum(good.map((n) => n.boost.cost));
    const se = (Math.sqrt(sum(good.map((n) => (n.boost.band / Z) ** 2))) * r.uv) / cost, z = opts.z || Z, m = sample.settings.margin;
    const at = (roi) => { const R0 = roi > 0 ? (roi * bm.ch) / (bm.cs * (1 - Math.exp(-bm.ch / bm.cs))) : 0; const cStar = m * R0 > 1 ? bm.cs * Math.log(m * R0) : 0;
      return { roi, R0, Bstar: cStar * bm.G, curve: (B) => { const c = B / bm.G; const rev = bm.G * R0 * bm.cs * (1 - Math.exp(-c / bm.cs)); return { B, profit: rev * m - B, units: rev / r.uv }; } }; };
    const lo = at(Math.max(0, bm.roiObs - z * se)), hi = at(bm.roiObs + z * se);
    const proj = (n) => { const s2 = se * Math.sqrt(good.length / n); return { n, lo: at(Math.max(0, bm.roiObs - z * s2)).Bstar, hi: at(bm.roiObs + z * s2).Bstar }; };
    return { ok: true, n: good.length, roi: bm.roiObs, se, roiLo: lo.roi, roiHi: hi.roi, Bstar: bm.Bstar, BstarLo: lo.Bstar, BstarHi: hi.Bstar, curveLo: lo.curve, curveHi: hi.curve, thin: good.length < 5, projections: [proj(5), proj(10)], level: 0.9 };
  }

  // —— 数字校验器：文字里的每个数字，能不能在账本里找到出处 ——
  function numberSources(r, sample, extra) {
    const S = r.summary, out = [], add = (v, label, kind) => { if (v != null && isFinite(v)) out.push({ v: +v, label, kind: kind || 'ledger' }); };
    const st = sample.settings, M = sample.metric;
    add(S.totalInc, `种草多带来的${M}（总账）`); add(S.totalValue, '换算成的生意额（总账）'); add(S.outShare, '站外成交占比（全域账）', 'pct'); add(S.roiReal, '投流真实回报（去水分后）'); add(S.roiSeen, '投流看起来的回报（去水分前）'); add(S.roiIn, '只看站内的投流回报');
    add(S.real, '真有效笔记数'); add(S.maybe, '可能是巧合的笔记数'); add(S.none, '没看到效果的笔记数'); add(S.noteCount, '已走完观察期的笔记数'); add(r.notes.length, '笔记总数'); add(S.misjudged, '只看站内会误判的笔记数'); add(S.boostCost, '投流总花费'); add(S.incInValue, '只看站内的生意额');
    (S.incByCh || []).forEach((v, j) => add(v, `「${r.channels[j].name}」多带来的${M}`)); add(r.be, '保本线'); add(r.uv, `每个${M}的价值`); add(st.price, '客单价'); add(st.margin, '毛利率', 'pct'); if (st.conv_rate) { add(st.conv_rate, '签约率', 'pct'); add(S.totalInc * st.conv_rate, '预计签约单数'); }
    add(r.dates.length, '数据天数'); add(r.clean.length, '干净日天数'); add(r.sigma, '正常波动 σ');
    r.notes.forEach((n) => { const T = `「${n.title.slice(0, 12)}${n.title.length > 12 ? '…' : ''}」`; add(n.total, T + '多出的量'); add(n.organic, T + '自然增量'); add(n.bandN, T + '波动带'); add(Math.max(0, n.lo), T + '区间下限'); add(n.hi, T + '区间上限'); (n.byCh || []).forEach((v, j) => add(v, T + `${r.channels[j].name}多出的量`)); if (n.outShare != null) add(n.outShare, T + '站外占比', 'pct');
      const B = n.boost; if (B) { add(B.cost, T + '投流花费'); add(B.seen, T + '投流期多出的量'); add(B.real, T + '投流真贡献'); add(B.expectedOrganic, T + '本来就会来'); add(B.roiSeen, T + '看起来的回报'); add(B.roiReal, T + '去水分后的回报'); add(B.band, T + '投流期波动带'); add(B.orgEst, T + '自然总量'); if (B.range) { add(B.range.lo, T + '投流贡献下限'); add(B.range.hi, T + '投流贡献上限'); add(B.range.ref, T + '同类平均'); add(B.roiLo, T + '回报下限'); add(B.roiHi, T + '回报上限'); } }
      if (n.kol_cost) add(+n.kol_cost, T + '达人报价'); });
    r.notes.forEach((n) => { const T = `「${n.title.slice(0, 12)}」`; let sa = 0, sb = 0; for (let t = n.p; t <= n.end; t++) { sa += r.y[t]; sb += r.baseline[t]; } add(sa, T + '观察期实际合计'); add(sb, T + '观察期平时预计合计'); const basis = n.organic != null ? n.organic : n.total; add(Math.abs(basis) / Math.max(n.bandN, 1e-9), T + '是波动带的几倍');
      const B = n.boost; if (B && !B.merged) { const sh = n._shape || DEFAULT_SHAPE; add(sum(n.excess.slice(0, B.off)), T + '投流前多出的量'); add(sum(sh.slice(0, B.off)), T + '投流前天数占衰减规律的比例', 'pct'); } });
    add(S.sepCost, '可拆分的投流花费'); add(S.boostRealUnits, '投流真贡献合计'); add(S.boostSeenUnits, '投流看起来多出的合计');
    r.done.forEach((n) => add((n.excess[0] || 0) + (n.excess[1] || 0), `「${n.title.slice(0, 12)}」头两天超出平时`));
    r.types.forEach((t) => { add(t.green, `「${t.type}」亮绿灯概率`, 'pct'); add(t.green * t.count, `「${t.type}」绿灯篇数`); });
    try { const bm8 = r.budget({ plan: 8 }); if (bm8.ok) ['reco', 'hist'].forEach((k) => bm8.mixes[k].forEach((x) => { add(x.n, `${k === 'reco' ? '推荐' : '原比例'}配比「${x.type}」篇数`); add(x.n * x.g, `${k === 'reco' ? '推荐' : '原比例'}配比「${x.type}」绿灯篇数`); add(x.n * x.mu, `${k === 'reco' ? '推荐' : '原比例'}配比「${x.type}」自然带来`); })); } catch (e) {}
    if (r.ac) { add(r.ac.rho, '前后天相关 ρ'); add(r.ac.thr, '前后天相关的显著门槛'); add(r.ac.infl - 1, '波动带放宽比例', 'pct'); }
    r.types.forEach((t) => { add(t.avg, `「${t.type}」平均每篇增量`); add(t.count, `「${t.type}」篇数`); add(t.realRate, `「${t.type}」真有效比例`, 'pct'); });
    kolLedger(r).forEach((k) => { const K = k.kol.split(' · ')[0]; add(k.cost, K + '报价'); add(k.inc, K + '带来的增量'); add(k.roi, K + '每 1 元报价换回'); add(k.breakEven, K + '回本报价'); add(Math.floor(k.breakEven / 100) * 100, K + '回本报价（取整）'); add(k.perUnit, K + '每个' + M + '花了'); });
    const bm = r.budget({ plan: 8 }); if (bm.ok) { add(bm.Bstar, '建议的下月投流预算'); add(bm.cStar, '每篇绿灯笔记建议投流'); add(bm.roiObs, '本店绿灯投流的历史回报'); add(bm.ch, '历史每笔绿灯投流平均花费'); add(bm.sourceCount, '历史绿灯投流笔数'); add(bm.G, '预计亮绿灯篇数'); add(bm.RC.organic, '笔记自然带来（推荐配比）'); add(bm.H.organic, '笔记自然带来（原比例）'); const cv = bm.curve(bm.Bstar); add(cv.units, '投流再带来'); add(cv.profit, '投流净赚毛利'); add(cv.rev, '投流带来的生意'); add(cv.units + bm.RC.organic, '下月合计多带来'); }
    r.live.forEach((n) => { const L = r.light(n.date, r.y[n.p], r.y[n.p + 1] || 0); ['b1', 'b2', 'ex', 'sd2', 'pred', 'predLo', 'predHi', 'spend', 'z', 'thr'].forEach((k) => add(L[k], '红绿灯：' + k)); add(L.b1 + L.b2, '红绿灯：平时两天合计'); add(r.y[n.p], '发布当天实际'); add(r.y[n.p + 1], '第 2 天实际'); add((r.y[n.p] || 0) + (r.y[n.p + 1] || 0), '两天实际合计'); if (L.bm && L.bm.ok) { const per = L.bm.curve(L.spend * L.bm.G).units / L.bm.G; add(per, '红绿灯：投流预计再多带来'); add((per * r.uv) / Math.max(L.spend, 1), '红绿灯：每 1 元换回'); } });
    try { actionPack(r, sample).items.forEach((it) => { const walk = (o, p) => { if (o == null) return; if (typeof o === 'number') add(o, '行动包 · ' + p); else if (typeof o === 'object') Object.keys(o).forEach((k) => walk(o[k], p ? p + '.' + k : k)); }; walk(it.data, it.kind); }); } catch (e) {}
    try { const rb = robustness(r); add(rb.robustCount, '稳健结论数'); add(rb.total, '参与稳健检验的笔记数'); const F = fdr(r); add(F.keep, '校正后仍成立'); add(F.m, '同时检验的笔记数'); } catch (e) {}
    [[1.645, '约 95% 把握对应的门槛'], [0.95, '把握程度', 'pct'], [0.05, '误判门槛', 'pct'], [0.10, 'FDR 校正水平', 'pct'], [7, '观察期天数'], [5, '投流观察天数'], [3, '换 3 种假设'], [300, '检验用的模拟组数'], [0.07, '模拟检验误判率', 'pct'], [0.9, '模拟检验识别率', 'pct'], [0.89, '稳健结论准确率', 'pct'], [0.61, '未标稳健的准确率', 'pct'], [0.5, '黄灯门槛']].forEach((x) => add(x[0], x[1], x[2] || 'method'));
    (extra || []).forEach((x) => add(x.v, x.label, x.kind));
    return out;
  }
  function numberCheck(text, r, sample, extra) {
    const src = numberSources(r, sample, extra), segs = [], re = /([¥￥]?\s?[−\-+]?\d[\d,]*(?:\.\d+)?)(\s?(?:万|%|％))?/g;
    const dateRe = /(\d{4}[-/年]\d{1,2}([-/月]\d{1,2}日?)?|\d{1,2}月\d{1,2}日|\d{1,2}月|\d{1,2}日)/g, dateSpans = [];
    let m; while ((m = dateRe.exec(text))) dateSpans.push([m.index, m.index + m[0].length]);
    const qRe = /「[^」]*」|《[^》]*》|“[^”]*”/g; let q; while ((q = qRe.exec(text))) dateSpans.push([q.index, q.index + q[0].length]);
    (sample.notes || []).forEach((n) => { if (!n.title) return; let from = 0, at; while ((at = text.indexOf(n.title, from)) >= 0) { dateSpans.push([at, at + n.title.length]); from = at + n.title.length; } });
    const inDate = (i) => dateSpans.some(([a, b]) => i >= a && i < b); let last = 0, ok = 0, bad = 0, neutral = 0;
    while ((m = re.exec(text))) {
      const raw = m[0], i = m.index; if (inDate(i)) continue;
      const num = parseFloat(m[1].replace(/[¥￥\s,]/g, '').replace('−', '-')), unit = (m[2] || '').trim(), dec = ((m[1].split('.')[1]) || '').length;
      const val = unit === '万' ? num * 1e4 : num, after = text.slice(i + raw.length, i + raw.length + 2), before = text.slice(Math.max(0, i - 2), i);
      const eq = (c) => { const cands = [c.v]; if (c.kind === 'pct' || unit === '%' || unit === '％') cands.push(c.v * 100); return cands.some((x) => { if (unit === '万') return Math.abs(Math.round((x / 1e4) * 10 ** dec) / 10 ** dec - num) < 1e-9; return Math.abs(Math.round(Math.abs(x) * 10 ** dec) / 10 ** dec - Math.abs(num)) < 1e-9 || Math.abs(Math.floor(Math.abs(x)) - Math.abs(num)) < 1e-9 && dec === 0 && Math.abs(x) >= 100; }); };
      const hit = src.find(eq);
      let kind, label = null;
      if (hit) { kind = hit.kind === 'method' ? 'method' : 'ok'; label = hit.label; }
      else if ((Math.abs(num) <= 31 && dec === 0 && /^[\s]?[天日月篇件笔步关位次倍周号点个种类条项轮组年]/.test(after)) || /每\s?$/.test(before) || /第\s?$/.test(before)) kind = 'neutral';
      else kind = 'bad';
      if (i > last) segs.push({ text: text.slice(last, i) }); segs.push({ text: raw, num: val, kind, label }); last = i + raw.length;
      if (kind === 'ok' || kind === 'method') ok++; else if (kind === 'bad') bad++; else neutral++;
    }
    if (last < text.length) segs.push({ text: text.slice(last) });
    return { segs, ok, bad, neutral, total: ok + bad };
  }

  // —— 检验结果（本地脚本 _dev/realnoise/ 复现；数字写在这里，界面只引用不另算） ——
  const VALIDATION = {
    sim: { worlds: 300, fpr: 0.07, det: 0.9, robustAcc: 0.89, otherAcc: 0.61 },
    real: { source: '维基百科 37 个词条 2024–2025 年每日浏览量（真实的星期规律、季节、新闻尖峰）', worldsEach: 250,
      rows: [{ name: '订单店（日均约 24）', fpr: 0.076, fprFdr: 0.048, det: 0.744, robustAcc: 0.813, otherAcc: 0.672 },
        { name: '咨询店（日均约 5）', fpr: 0.053, fprFdr: 0.026, det: 0.698, robustAcc: 0.718, otherAcc: 0.445 },
        { name: '大店（日均约 200）', fpr: 0.110, fprFdr: 0.074, det: 0.923, robustAcc: 0.628, otherAcc: 0.833, outOfScope: true }] },
  };

  // —— 记住界面最近一次算的每家店（给界面覆盖层读当前店铺用；内部的复算不登记） ——
  const LAST = {};
  function computePublic(sample, opts) { const r = compute(sample, opts); try { if (!opts || !Object.keys(opts).length) LAST[sample.name] = r; } catch (e) {} return r; }
  function lastResult(name) { if (!name) return null; if (LAST[name]) return LAST[name]; const k = Object.keys(LAST).find((n) => n.indexOf(name) >= 0 || name.indexOf(n) >= 0); return k ? LAST[k] : null; }

  return { compute: computePublic, lastResult, experiment, confidence, kolLedger, boostSeries, winwin, schedule, aiContext, noteCheck, appendDaily, actionPack, story, robustness, dataCheck, sensitivity, experimentResult, explainNote, explainLight, explainTotal, dayInfo, experimentDemo, fdr, placebo, budgetRange, numberSources, numberCheck, VALIDATION, WINDOW, BOOST_WINDOW, Z, addDays };
})();
if (typeof module !== 'undefined') module.exports = LedgerEngine;
