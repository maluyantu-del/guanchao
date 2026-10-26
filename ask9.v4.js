/* ask9.js —— 「问观潮」补全
 * 1. 面板里的预设问题全部有答案（原来有 9 个落到"账本里没有对应的数据"）；
 * 2. 回答里的每个数字都直接取自算法结果（LedgerEngine），不另编；
 * 3. 换店或切换视角后，对话自动清空，避免上一家店的数字挂在这家店下面。
 * 4.（v2）修正主程序回答模板里的三处口径：类型排行里的"绿灯 0.9 篇"其实是平滑后的亮绿灯概率，改成"其中 N 篇真有效"；
 *    预算回答的"每篇从 ¥A 起步试投"（A 是过去每笔平均）改成与行动包一致的建议金额；选题回答的开头说明是照哪几篇的角度写。
 *    同时作用于「问观潮」面板和「AI 参谋」页。
 * 5.（v3）页面文字修正，只改说法不改数字：假设敏感性里的英文代号改成中文结论；"草稿由 AI 撰写"改成与问卷、AI 参谋页一致的"按模板起草"；
 *    该不该投卡片里的 ±X 其实是绿灯线，改名；没跑赢平时的笔记不再写"多出 −13.1""波动的 −1.3 倍""约 0.0 个"；
 *    "只有 0 篇""是第二名的 1 倍"等句子改通顺；补两处句号；"误判率仍在 9% 以内"注明是模拟噪声。内容配比回答按整数篇（与预算页一致）。
 * 6.（v4）「3 分钟导览」统一改名「30 秒导览」（按钮、首次提示、侦探成绩单、悬停提示和读屏标签）；顶栏标语里轮换的红字与整行文字对齐。
 * 加载位置：pages.v4.js 之后、app.v20.js 之前（要在 app 调 GuanchaoAsk.mount 之前接管回答函数）。
 */
(function () {
  'use strict';
  var A = window.GuanchaoAsk;
  if (!A || typeof A.mount !== 'function' || A.__ask9) return;
  A.__ask9 = true;

  function LE() { try { return LedgerEngine; } catch (e) { return null; } }
  function SA() { try { return SAMPLES; } catch (e) { return null; } }
  var origAsk = null, getCtx = null;
  var origMount = A.mount;
  A.mount = function (o) {
    o = o || {}; origAsk = o.ask || null; getCtx = o.getContext || null;
    return origMount.call(A, { getContext: o.getContext, ask: ask });
  };

  /* ---------- 格式 ---------- */
  var f1 = function (v) { return (Math.round(v * 10) / 10).toFixed(1); };
  var f2 = function (v) { return (+v).toFixed(2); };
  var f0 = function (v) { return String(Math.round(v)); };
  var pc = function (v) { return Math.round(v * 100) + '%'; };
  var money = function (v) { return '¥' + Math.round(v).toLocaleString('zh-CN'); };
  var md = function (d) { var x = new Date(d + 'T00:00:00'); return (x.getMonth() + 1) + '月' + x.getDate() + '日'; };
  var org = function (n) { return n.organic != null ? n.organic : n.total; };
  function $(s) { try { return document.querySelector(s); } catch (e) { return null; } }

  /* ---------- 当前店铺（与 v7ui 同一读法） ---------- */
  var SKIP = { '商家': 1, '客户经理': 1, '导入数据': 1 };
  function ctxName() { try { return getCtx ? getCtx() : 'overview'; } catch (e) { return 'overview'; } }
  function curName() {
    var meta = $('.hero:not(.mhero) .hero-meta'); if (meta && meta.textContent) return meta.textContent.split('·')[0].trim();
    var act = Array.prototype.slice.call(document.querySelectorAll('.seg-btn.active')).map(function (b) { return b.textContent.trim(); }).filter(function (t) { return t && !SKIP[t]; });
    return act[0] || null;
  }
  function curRes() {
    var E = LE(); if (!E || !E.lastResult) return null;
    var r = E.lastResult(curName()); return r && r.sample ? r : null;
  }
  var SHOP_KEYS = ['study', 'shop', 'coffee'];
  var ALIAS = { study: /留学|远帆/, shop: /香薰|慢燃/, coffee: /咖啡|山野/ };
  function shopRes(key) {
    var E = LE(), S = SA(); if (!E || !S || !S[key]) return null;
    var r = E.lastResult(S[key].name);
    if (!r) { try { r = E.compute(S[key]); } catch (e) { r = null; } }
    return r && r.sample ? r : null;
  }
  function namedShop(q) { for (var i = 0; i < SHOP_KEYS.length; i++) if (ALIAS[SHOP_KEYS[i]].test(q)) return SHOP_KEYS[i]; return null; }
  function status(r) { var S = r.summary, be = r.be; if (S.roiIn != null && S.roiIn < be && S.roiReal != null && S.roiReal >= be) return 'risk'; if (S.roiReal != null && S.roiReal < be) return 'loss'; return 'ok'; }
  function chNames(r) { return { inN: r.inIdx >= 0 ? r.channels[r.inIdx].name : '站内', outN: r.outIdx >= 0 ? r.channels[r.outIdx].name : '站外' }; }

  /* ---------- 「该不该投」页当前填的那篇；不在那页就用最新一篇还在观察期的笔记 ---------- */
  function lightCase(r) {
    var d = $('#invDate'), rg = document.querySelectorAll('.inv-range');
    if (d && d.value && rg.length >= 2 && d.offsetParent !== null) {
      var date = d.value, d1 = +rg[0].value, d2 = +rg[1].value, live = (r.live || []).filter(function (n) { return r.dates[n.p] === date; })[0];
      var title = live && Math.round(r.y[live.p]) === d1 && Math.round(r.y[live.p + 1] || 0) === d2 ? live.title : null;
      return { date: date, d1: d1, d2: d2, title: title, custom: !title };
    }
    var n = (r.live || []).filter(function (x) { return x && x.p != null && r.dates[x.p + 1] != null; })[0];
    if (!n) return null;
    return { date: r.dates[n.p], d1: r.y[n.p], d2: r.y[n.p + 1] || 0, title: n.title, custom: false };
  }

  /* ================= 各类问题的回答 ================= */
  function aProfit(r) {
    var S = r.summary, M = r.sample.metric, c = chNames(r), L = [];
    var head = S.totalInc > 0 ? '笔记在实打实地带生意' : '这段时间笔记还没带来明显的增量';
    if (S.roiReal != null) head += S.roiReal >= r.be ? '，投流也回本了。' : '，但投流这部分没回本。'; else head += '。';
    L.push('先说结论：' + head, '');
    L.push('· 这 ' + r.dates.length + ' 天里，' + S.noteCount + ' 篇笔记一共多带来约 ' + f0(S.totalInc) + ' 个' + M + '，折合生意约 ' + money(S.totalValue) + '；');
    if (S.outShare != null) L.push('· 其中 ' + pc(S.outShare) + ' 发生在「' + c.outN + '」，只看小红书后台会漏掉这一块；');
    if (S.roiReal != null && S.sepCost) L.push('· 投流花了 ' + money(S.sepCost) + '，扣掉"本来就会来"的水分后，每 1 元换回 ' + f2(S.roiReal) + ' 元；保本线是 ' + f2(r.be) + ' 元（毛利率的倒数），' + (S.roiReal >= r.be ? '在保本线以上。' : '在保本线以下。'));
    L.push('· 逐篇看：' + S.real + ' 篇真有效、' + S.maybe + ' 篇可能是巧合、' + S.none + ' 篇没看到效果。', '');
    L.push('笔记本身没有记成本，所以这里只算"多带来多少生意"；投流有花费记录，才算得出回没回本。');
    return L.join('\n');
  }

  function aOverest(r) {
    var S = r.summary, M = r.sample.metric, L = [];
    if (!S.sepCost) return '这本账里还没有能拆开算的投流记录（需要笔记填了投流开始日期和花费），所以还谈不上高估多少。';
    L.push('投流被高估，是因为投流期间多出来的量，有一部分本来就会来：笔记刚发的几天自己就在涨，投流正好叠在这段时间，后台会把这些都算成投流的功劳。', '');
    L.push('这本账里：');
    L.push('· 投流期一共多出 ' + f1(S.boostSeenUnits) + ' 个' + M + '，看起来每 1 元换回 ' + f2(S.roiSeen) + ' 元；');
    L.push('· 按本店笔记的自然衰减规律扣掉本来就会来的部分，投流真正多带来 ' + f1(S.boostRealUnits) + ' 个，每 1 元实际换回 ' + f2(S.roiReal) + ' 元；');
    L.push('· 保本线 ' + f2(r.be) + ' 元，' + (S.roiReal >= r.be ? '去水分后仍然回本。' : '去水分后其实没回本。'));
    var ex = r.done.filter(function (n) { return n.boost && !n.boost.merged; }).sort(function (a, b) { return b.boost.seen - a.boost.seen; })[0];
    if (ex) L.push('', '最典型的是《' + ex.title + '》：投流期多出 ' + f1(ex.boost.seen) + ' 个，其中约 ' + f1(ex.boost.expectedOrganic) + ' 个本来就会来。');
    L.push('', '每篇是怎么拆的，在「笔记明细」里点开那篇的账就能看到。');
    return L.join('\n');
  }

  function aMaybe(r) {
    var S = r.summary, M = r.sample.metric, L = [];
    L.push('「可能是巧合」不是说笔记没用，而是说：它多出来的量，还没大过这家店平时的自然起伏。', '');
    L.push('观潮先用没发笔记、没投流的日子，算出这家店每天会自然上下晃多少（正常波动带）。一篇笔记观察期里多出的量要超过它的波动带，才判「真有效」；没超过，就分不清是笔记带来的，还是平时本来就会有的起伏。', '');
    var ms = r.done.filter(function (n) { return n.verdict === 'maybe'; }).sort(function (a, b) { return org(b) / b.bandN - org(a) / a.bandN; });
    if (ms.length) {
      var n = ms[0], b = org(n);
      L.push('这本账里有 ' + S.maybe + ' 篇是这种情况。离"真有效"最近的是《' + n.title + '》：观察期多出约 ' + f1(b) + ' 个' + M + '，它的波动带是 ±' + f1(n.bandN) + '，只到波动带的 ' + f1(b / n.bandN) + ' 倍。', '');
    } else L.push('这本账里目前没有笔记落在这一档。', '');
    L.push('怎么办：别急着否定它。同类笔记再发一两篇，或者做个小对照实验（在「该不该投」页），样本多了自然看得清。');
    return L.join('\n');
  }

  function lightLines(r, k) {
    var E = LE(), Lt = r.light(k.date, k.d1, k.d2), X = E.explainLight(r, Lt, k.d1, k.d2);
    return { Lt: Lt, X: X };
  }

  function aShould(r) {
    var k = lightCase(r); if (!k) return '这家店现在没有还在观察期的新笔记。发了新笔记后，等两天的数据出来，我再告诉你该不该投。';
    var o = lightLines(r, k), L = [];
    L.push((k.title ? '《' + k.title + '》' : '你在「该不该投」页填的这篇') + '（' + md(k.date) + ' 发布）：' + o.X.colorLabel + '。', '');
    o.X.steps.forEach(function (s) { L.push('· ' + s.title + '：' + fixLightText(s.text)); });
    return L.join('\n');
  }

  function aGreen(r) {
    var M = r.sample.metric, L = [];
    L.push('红绿灯只看笔记发出后头两天，跟「平时的样子」比：');
    L.push('· 先算平时这两天大概会有多少个' + M + '，以及两天合计的正常波动有多大；');
    L.push('· 实际多出的量 ≥ 正常波动的 1.645 倍 → 绿灯（约 95% 把握不是巧合，可以投）；');
    L.push('· 在 0.5～1.645 倍之间 → 黄灯（有苗头，明天再看）；不到 0.5 倍 → 红灯（先别投，改标题或封面）。', '');
    L.push('为什么是 1.645：如果一篇笔记其实没效果，多出的量光靠运气超过 1.645 倍波动的机会只有约 5%，所以绿灯的误判被控制在 5% 左右。');
    var k = lightCase(r);
    if (k) {
      var o = lightLines(r, k), Lt = o.Lt, X = 0, Y = 0;
      (r.done || []).forEach(function (n) { if ((n.excess[0] || 0) + (n.excess[1] || 0) >= Lt.thr) { X++; if (n.verdict === 'real') Y++; } });
      L.push('', '拿' + (k.title ? '最新一篇《' + k.title + '》' : '你填的这篇') + '举例：平时这两天预计 ' + f1(Lt.b1 + Lt.b2) + ' 个，实际 ' + f0(k.d1 + k.d2) + ' 个，' + (Lt.ex >= 0 ? '多出 ' : '少了 ') + f1(Math.abs(Lt.ex)) + '；正常波动 ±' + f1(Lt.sd2) + '，' + (Lt.ex >= 0 ? '多出的量是波动的 ' + f1(Lt.z) + ' 倍' : '没有跑赢平时') + ' → ' + o.X.colorLabel + '。');
      if (X) L.push('', '本店历史上，前两天就过了绿灯线的 ' + X + ' 篇里，' + Y + ' 篇最后被判真有效。');
    }
    return L.join('\n');
  }

  function aExp(r) {
    var E = LE(), M = r.sample.metric, e = E.experiment(r, r.sample, { plan: 8 }), L = [];
    if (!e.ok) return '这家店还没有"给绿灯笔记投流"的历史，算不出实验要多大。先小额试投几笔、记好开始日期和花费，账本攒够记录后就能算。';
    L.push('按这家店的数据算：');
    L.push('· 做法：同类、都亮了绿灯的笔记分两组，一组每篇投 ' + money(e.spend) + '，一组不投，最后比两组多带来的量；');
    L.push('· 至少需要 ' + e.perArm + ' + ' + e.perArm + ' 篇（共 ' + e.total + ' 篇）；本店每月大约 ' + f1(e.greens) + ' 篇亮绿灯，所以约 ' + f1(e.months) + ' 个月出结论；');
    L.push('· 实验期间投流花费约 ' + money(e.cost) + '。', '');
    L.push('为什么要这么多篇：同类笔记之间本来就相差 ±' + f0(e.het) + ' 个' + M + '，而每篇投 ' + money(e.spend) + ' 预计只多带来约 ' + f1(e.delta) + ' 个，差别要靠篇数攒出来，才能有约 95% 把握不是巧合、80% 的机会测得出来。', '');
    L.push('实验做完，投流效果就从"估算级"升到"实验级"，下次的预算建议也会用实验结果来校准。');
    return L.join('\n');
  }

  function aOverspend(r) {
    var bm = r.budget({ plan: 8 }), L = [];
    if (!bm.ok) return '这本账里还没有"给绿灯笔记投流"的记录，算不出回报曲线；先小额试投几笔，账本会记录效果。';
    if (!(bm.Bstar > 0)) return '按本店历史，投流每 1 元换回 ' + f2(bm.roiObs) + ' 元，扣掉成本后已经不赚，最划算的做法是先不加投流，把钱放在内容上。';
    var a = bm.curve(bm.Bstar), b = bm.curve(2 * bm.Bstar);
    L.push('因为投流的回报是递减的：同一篇笔记，先推给最可能感兴趣的人，越往后推，看到的人越不相关，每多花 1 元换回的生意越来越少。', '');
    L.push('按这家店的历史（' + bm.sourceCount + ' 笔绿灯投流，去水分后每 1 元换回 ' + f2(bm.roiObs) + ' 元）算下个月：');
    L.push('· 投 ' + money(bm.Bstar) + '：投流净赚毛利约 ' + money(a.profit) + '，这是最划算的点；');
    L.push('· 翻倍投到 ' + money(2 * bm.Bstar) + '：净赚毛利反而降到约 ' + money(b.profit) + '，多花的 ' + money(bm.Bstar) + ' 没换回等值的毛利；');
    L.push('· 再往上加，多投的钱连本都收不回来，越投越亏。', '');
    if (bm.sourceCount < 5) L.push('注意：这条曲线只靠 ' + bm.sourceCount + ' 笔绿灯投流估出来，样本少，最划算的点可能偏得比较多；「预算怎么花」页给了它的把握区间，建议先按每篇建议金额小额试投、边投边记。', '');
    L.push('在「预算怎么花」页可以自己拖动预算，看这条曲线。');
    return L.join('\n');
  }

  function aMix(r) {
    var bm = r.budget({ plan: 8 }), M = r.sample.metric, L = [];
    if (!bm.ok) {
      var ts = r.types.slice(0, 2);
      return ts.length ? '这家店还没有绿灯投流记录，配比先按平均带货量排：主写「' + ts[0].type + '」' + (ts[1] ? '，「' + ts[1].type + '」补位' : '') + '。' : '这本账里还没有笔记分类数据。';
    }
    L.push('按每月 8 篇规划，观潮按各类型的平均带货量和亮绿灯的概率推荐：');
    var reco = bm.mixes.reco, base = reco.map(function (x) { return Math.floor(x.n); }), left = 8 - base.reduce(function (a, b) { return a + b; }, 0);
    reco.map(function (x, i) { return { i: i, f: x.n - Math.floor(x.n) }; }).sort(function (a, b) { return b.f - a.f || a.i - b.i; }).slice(0, Math.max(0, left)).forEach(function (o) { base[o.i]++; });
    reco.forEach(function (x, i) { L.push('· 「' + x.type + '」' + base[i] + ' 篇：这类平均每篇多带来 ' + f1(x.mu) + ' 个' + M + '，' + pc(x.g) + ' 的概率亮绿灯' + (((r.types || []).filter(function (t) { return t.type === x.type; })[0] || {}).count === 1 ? '（只有 1 篇历史样本，先多写两篇验证）' : '') + '；'); });
    L.push('', '按这个配比，下个月预计约 ' + f1(bm.RC.green) + ' 篇能亮绿灯，笔记自然多带来约 ' + f0(bm.RC.organic) + ' 个' + M + '；照原来的类型比例写，是 ' + f0(bm.H.organic) + ' 个。');
    var keep = {}; bm.mixes.reco.forEach(function (x) { keep[x.type] = 1; });
    var topMu = Math.max.apply(null, r.types.map(function (t) { return Math.max(0, t.avg); }).concat([1e-9]));
    var rest = r.types.filter(function (t) { return !keep[t.type]; });
    var low = rest.filter(function (t) { return Math.max(0, t.avg) < 0.5 * topMu; }), mid = rest.filter(function (t) { return Math.max(0, t.avg) >= 0.5 * topMu; });
    var nm = function (a) { return a.map(function (t) { return '「' + t.type + '」'; }).join(''); };
    if (low.length) L.push('', '先少写：' + nm(low) + '，这' + (low.length > 1 ? '几' : '') + '类平均每篇带来的量不到最好那类的一半。');
    if (mid.length) L.push((low.length ? '' : '\n') + nm(mid) + '的效果也过了一半线，只是名额排在前三之后，可以轮换着写。');
    L.push('', '在「预算怎么花」页可以切换"推荐配比 / 原来的比例"对比。');
    return L.join('\n');
  }

  var HEAD = {
    risk: function (r) { var S = r.summary, c = chNames(r); return '先把站外算进来，别砍投流预算。只看「' + c.inN + '」，投流每 1 元换回 ' + f2(S.roiIn) + ' 元，低于保本线 ' + f2(r.be) + ' 元，像在亏；算上「' + c.outN + '」并去掉水分后是 ' + f2(S.roiReal) + ' 元，其实是赚的。'; },
    loss: function (r) { var S = r.summary, bad = r.done.filter(function (n) { return n.boost && (n.boost.verdict === 'none' || n.boost.verdict === 'loss'); })[0];
      return '止损，只给发布两天就亮绿灯的笔记投流。现在投流去水分后每 1 元换回 ' + f2(S.roiReal) + ' 元，低于保本线 ' + f2(r.be) + ' 元' + (bad ? '，比如《' + bad.title + '》投了流却没换回够本的增量。' : '。'); },
    ok: function (r) { var S = r.summary, bm = r.budget({ plan: 8 }); return '把钱集中到绿灯笔记上，可以适度加预算。投流去水分后每 1 元换回 ' + f2(S.roiReal) + ' 元，高于保本线 ' + f2(r.be) + ' 元' + (bm.ok && bm.Bstar > 0 ? '；下个月投流按最划算的点，约 ' + money(bm.Bstar) + '。' : '。'); }
  };
  function aNext(r, who) {
    var E = LE(), st = status(r), L = [];
    if (r.summary.roiReal == null) L.push((who ? '「' + who + '」' : '') + '最该做的一件事：先把投流的开始日期和花费记全，账本才能算出投流值不值。');
    else L.push((who ? '「' + who + '」' : '') + '最该做的一件事：' + HEAD[st](r));
    var items = []; try { items = E.actionPack(r, r.sample).items.filter(function (it) { return it.kind !== 'report'; }).slice(0, 3); } catch (e) {}
    if (items.length) { L.push('', '接下来照着做：'); items.forEach(function (it) { L.push('· ' + it.title + '（' + it.summary + '）；'); }); }
    var worst = r.types[r.types.length - 1];
    if (worst && r.types.length > 2 && worst.avg < r.types[0].avg * 0.5) L.push('· 少写「' + worst.type + '」' + (worst.avg >= 0.5 ? '（这类平均每篇只多带来约 ' + f1(worst.avg) + ' 个' + r.sample.metric + '）' : '（这类几乎没带来增量）') + '。');
    L.push('', '完整的行动包在「总览」页，每一条都附了可以直接复制的草稿。');
    return L.join('\n');
  }

  var ST_SHORT = { risk: '只看站内像在亏、实际在赚，有砍预算风险', loss: '投流整体没回本，需要帮它调整投法', ok: '种草和投流都健康，可以谈加预算' };
  function aVisit() {
    var list = SHOP_KEYS.map(function (k) { var r = shopRes(k); return r ? { k: k, r: r, st: status(r), name: r.sample.name } : null; }).filter(Boolean);
    if (!list.length) return null;
    var ord = { risk: 0, loss: 1, ok: 2 }; list.sort(function (a, b) { return ord[a.st] - ord[b.st]; });
    var f = list[0], S = f.r.summary, c = chNames(f.r), L = [];
    L.push('先拜访「' + f.name + '」：' + ST_SHORT[f.st] + '。', '');
    if (f.st === 'risk') L.push('它的投流只看「' + c.inN + '」每 1 元换回 ' + f2(S.roiIn) + ' 元，低于保本线 ' + f2(f.r.be) + ' 元，客户自己看后台会觉得在亏、可能砍预算；把「' + c.outN + '」的成交算进来并去掉水分后是 ' + f2(S.roiReal) + ' 元，其实是赚的。不去讲清楚，客户会因为看错账而停投，所以最急。');
    else if (f.st === 'loss') L.push('投流去水分后每 1 元只换回 ' + f2(S.roiReal) + ' 元，低于保本线 ' + f2(f.r.be) + ' 元，需要帮它把钱挪到绿灯笔记上。');
    else L.push('投流去水分后每 1 元换回 ' + f2(S.roiReal) + ' 元，高于保本线 ' + f2(f.r.be) + ' 元。');
    if (list.length > 1) { L.push('', '然后是：'); list.slice(1).forEach(function (x) { L.push('· 「' + x.name + '」：' + ST_SHORT[x.st] + '（去水分后每 1 元换回 ' + f2(x.r.summary.roiReal) + ' 元，保本线 ' + f2(x.r.be) + ' 元）；'); }); }
    L.push('', '每家的提案要点在客户经理页下方「提案要点」里生成，数字都来自各自的账本。');
    return L.join('\n');
  }
  function aExplain(k) {
    var r = shopRes(k); if (!r) return null;
    var S = r.summary, M = r.sample.metric, c = chNames(r), L = [], mis = r.done.filter(function (n) { return n.misjudged; })[0];
    L.push('可以分三句话讲给「' + r.sample.name + '」：', '');
    L.push('① 你的种草不只在小红书里成交：这 ' + r.dates.length + ' 天笔记多带来的约 ' + f0(S.totalInc) + ' 个' + M + '里，有 ' + pc(S.outShare) + ' 发生在「' + c.outN + '」。只看小红书后台，这一块会整段看漏。');
    L.push('② 所以有的笔记被看错了：' + (mis ? '比如《' + mis.title + '》，只看站内像没起量，算上站外其实是有效的；这样的笔记有 ' + S.misjudged + ' 篇。' : '这家店目前没有这种笔记，站内站外的判断是一致的。'));
    if (S.roiReal != null) L.push('③ 投流也要按全域算：只看「' + c.inN + '」每 1 元换回 ' + f2(S.roiIn) + ' 元；算上站外、再扣掉本来就会来的水分，是 ' + f2(S.roiReal) + ' 元，保本线 ' + f2(r.be) + ' 元，' + (S.roiReal >= r.be ? '其实是赚的。' : '确实还没回本，要调投法。'));
    L.push('', '一句话：站内站外放在一起算，才是这家店种草的真实账。');
    return L.join('\n');
  }

  /* ---------- 红绿灯说明里"没跑赢平时"的说法（负数不再写成"多出"） ---------- */
  function fixLightText(t) {
    t = String(t == null ? '' : t);
    t = t.replace(/多出 ([+\-−]?)(\d+(?:\.\d+)?)（正常波动约 ±(\d+(?:\.\d+)?)）/g, function (m, sg, v, thr) { return (sg === '-' || sg === '−' ? '比平时少了 ' + v : '多出 +' + v) + '（绿灯线：多出 ' + thr + ' 以上）'; });
    t = t.replace(/多出 [\-−](\d+(?:\.\d+)?) 个/g, '比平时少了 $1 个');
    t = t.replace(/多出的量是波动的 [\-−](\d+(?:\.\d+)?) 倍/g, '实际比平时还少，谈不上跑赢');
    t = t.replace(/预计自然带来约 0\.0 个（可能 0～(\d+)）/g, '预计自然带来的量很少（最多约 $1 个）');
    return t;
  }

  /* ---------- 主程序回答模板的口径修正（只改说法，数字都取自同一份算法结果） ---------- */
  function fixAppText(text, r) {
    text = fixLightText(String(text == null ? '' : text)); if (!r) return text;
    var byType = {}; (r.types || []).forEach(function (t) { byType[t.type] = t; });
    text = text.replace(/按绿灯率（真实增量判定）排：/g, '按真有效的比例排（只算已走完观察期的笔记）：');
    text = text.replace(/(· ([^：\n]+)：(\d+) 篇，)绿灯[^，；\n]*/g, function (m, pre, type, cnt) {
      var t = byType[type.trim()]; if (!t) return m; return pre + '其中 ' + Math.round(t.realRate * t.count) + ' 篇真有效'; });
    var bm = null; try { bm = r.budget({ plan: 8 }); } catch (e) { bm = null; }
    if (bm && bm.ok && bm.cStar > 0) text = text.replace(/每篇从 (¥[\d,]+) 起步试投/g, function (m, a) { return '每篇绿灯笔记建议投 ' + money(bm.cStar) + '（过去每笔平均 ' + a + '）'; });
    text = text.replace(/账本里最能带量的笔记是：/g, '下一篇可以照这几篇的角度写（账本里最能带量的笔记）：');
    return text;
  }

  function aCopy(r) {
    var M = r.sample.metric, L = [];
    var top = r.done.filter(function (n) { return n.verdict === 'real'; }).sort(function (a, b) { return org(b) - org(a); }).slice(0, 3);
    if (!top.length) return '这本账里还没有判为真有效的笔记，先看「为什么有的笔记判成可能是巧合」。';
    L.push('最值得复制的是这几篇（判为真有效、观察期自然多带来最多的）：');
    top.forEach(function (n, i) { L.push((i + 1) + '. 《' + n.title + '》（' + n.type + '）：自然多带来约 ' + f1(org(n)) + ' 个' + M + '；'); });
    var cnt = {}; top.forEach(function (n) { cnt[n.type] = (cnt[n.type] || 0) + 1; });
    var main = Object.keys(cnt).sort(function (a, b) { return cnt[b] - cnt[a]; })[0], t = (r.types || []).filter(function (x) { return x.type === main; })[0];
    if (t) L.push('', '按类型看，「' + main + '」' + t.count + ' 篇里有 ' + Math.round(t.realRate * t.count) + ' 篇真有效，平均每篇多带来 ' + f1(t.avg) + ' 个。下一篇照这一类的写法来。');
    return L.join('\n');
  }

  var HELP = '这个问题账本里没有对应的数据，我只回答能用这本账算出来的问题。可以试试：这家店种草赚不赚、哪篇笔记最值得复制、为什么有的笔记判成可能是巧合、这篇现在该不该投、绿灯线是怎么定的、下个月预算怎么分、为什么投多了反而亏、对照实验要做多久、站外成交占多少。';
  var HELP_MGR = '在客户经理视角，我按三家客户的账本回答。可以问：哪个客户最需要先拜访、怎么跟山野咖啡解释全域账、香薰小店该怎么调整。想看某一家店的明细，在顶部切回「商家」。';
  function isFallback(t) { return /账本里没有对应的数据|暂时没接住|答不上来/.test(String(t || '')); }

  function route(q, orig) {
    var ctx = ctxName(), nk = namedShop(q), r = ctx === 'manager' ? null : curRes();
    if (nk && /解释|怎么跟|怎么向|怎么和|怎么给/.test(q)) {
      if (ctx === 'manager' || !r || ALIAS[nk].test(r.sample.name)) return aExplain(nk);
      return '这个问题要看「' + SA()[nk].name + '」的账：先在顶部切到这家店，或到客户经理视角再问我，数字会按那家店算。';
    }
    if (nk && /调整|怎么办|怎么改|怎么做|该怎么/.test(q)) {
      if (ctx === 'manager' || !r || ALIAS[nk].test(r.sample.name)) { var rr = shopRes(nk); return rr ? aNext(rr, rr.sample.name) : null; }
      return '这个问题要看「' + SA()[nk].name + '」的账：先在顶部切到这家店，或到客户经理视角再问我，数字会按那家店算。';
    }
    if (/拜访|哪个客户|哪家客户|最需要.*(沟通|客户)|先找哪/.test(q)) return ctx === 'manager' ? aVisit() : '这是客户经理视角的问题：在顶部切到「客户经理」再问我，我会把三家客户放在一起排。';
    if (ctx === 'manager') return HELP_MGR;
    if (!r) return isFallback(orig) ? HELP : null;
    if (/哪篇.*(复制|值得|最好|最能)/.test(q)) return aCopy(r);
    if (/高估|水分|虚高|看起来的回报/.test(q)) return aOverest(r);
    if (/怎么配|配比|搭配/.test(q)) return aMix(r);
    if (/巧合|分不清/.test(q)) return aMaybe(r);
    if (/绿灯线|红绿灯|绿灯.*(怎么|标准|门槛|规则)|黄灯|红灯|1\.645/.test(q)) return aGreen(r);
    if (/对照实验|做实验|实验.*(多久|多少|几篇|几个月)|A\/?B/i.test(q)) return aExp(r);
    if (/投多了|反而亏|越投越|边际|投太多/.test(q)) return aOverspend(r);
    if (/该不该投|要不要投|投不投|现在.*投|这篇.*投/.test(q)) return aShould(r);
    if (/赚不赚|赚没赚|到底赚|亏不亏|种草.*(赚|亏|值不值)/.test(q)) return aProfit(r);
    if (/最该做|先做什么|做哪件事|下一步|优先做/.test(q)) return aNext(r);
    return isFallback(orig) ? HELP : null;
  }

  function ask(q) {
    var p = origAsk ? Promise.resolve().then(function () { return origAsk(q); }) : Promise.resolve('');
    return p.then(function (orig) {
      var mine = null;
      try { mine = route(String(q || ''), orig); } catch (e) { mine = null; }
      if (mine != null) return mine;
      try { return fixAppText(orig, ctxName() === 'manager' ? null : curRes()); } catch (e) { return orig; }
    }, function () { var m = null; try { m = route(String(q || ''), ''); } catch (e) {} return m != null ? m : '这个问题我暂时没接住，换个问法试试。'; });
  }

  /* ---------- 数字校验器的出处补充：以下数都是算法的直接输出，只是不在原来的出处清单里 ---------- */
  var E0 = LE();
  if (E0 && typeof E0.numberCheck === 'function' && !E0.__ask9) {
    E0.__ask9 = true;
    var origCheck = E0.numberCheck, cache = typeof WeakMap !== 'undefined' ? new WeakMap() : null;
    var add = function (out, v, label, kind) { if (v != null && isFinite(v)) out.push({ v: +v, label: label, kind: kind || 'ledger' }); };
    var fixedFor = function (r, sample) {
      if (cache && cache.has(r)) return cache.get(r);
      var out = [];
      try { var e = E0.experiment(r, sample, { plan: 8 }); if (e.ok) { add(out, e.perArm, '对照实验：每组篇数'); add(out, e.total, '对照实验：总篇数'); add(out, e.months, '对照实验：约几个月出结论'); add(out, e.cost, '对照实验：投流花费'); add(out, e.delta, '对照实验：每篇投流预计多带来'); add(out, e.het, '对照实验：同类笔记之间的差异'); add(out, e.greens, '对照实验：每月亮绿灯篇数'); add(out, e.spend, '对照实验：每篇投流'); } } catch (x) {}
      try { var bm = r.budget({ plan: 8 }); if (bm.ok && bm.Bstar > 0) { var b = bm.curve(2 * bm.Bstar); add(out, 2 * bm.Bstar, '预算翻倍'); add(out, b.profit, '预算翻倍时的投流净赚毛利'); add(out, bm.RC.green, '推荐配比下亮绿灯篇数'); } } catch (x) {}
      add(out, r.shape[0] + r.shape[1], '前两天占一篇笔记自然增量的比例', 'pct');
      add(out, 0.8, '实验检出把握', 'method');
      if (cache) cache.set(r, out);
      return out;
    };
    var liveFor = function (r) {
      var out = [];
      try { var k = lightCase(r); if (k && k.custom) { var L = r.light(k.date, k.d1, k.d2); ['b1', 'b2', 'ex', 'sd2', 'pred', 'predLo', 'predHi', 'spend', 'z', 'thr'].forEach(function (f) { add(out, L[f], '红绿灯（你填的这篇）：' + f); }); add(out, L.b1 + L.b2, '红绿灯（你填的这篇）：平时两天合计'); add(out, k.d1, '你填的发布当天'); add(out, k.d2, '你填的第 2 天'); add(out, k.d1 + k.d2, '你填的两天合计'); if (L.bm && L.bm.ok) { var per = L.bm.curve(L.spend * L.bm.G).units / L.bm.G; add(out, per, '红绿灯（你填的这篇）：投流预计再多带来'); add(out, per * r.uv / Math.max(L.spend, 1), '红绿灯（你填的这篇）：每 1 元换回'); } } } catch (x) {}
      return out;
    };
    // 客户经理视角：回答涉及三家客户，出处清单 = 三家各自的账本（标签带店名）
    var mcache = typeof WeakMap !== 'undefined' ? new WeakMap() : null;
    var mgrFor = function () {
      var out = [];
      SHOP_KEYS.forEach(function (k) { var rr = shopRes(k); if (!rr) return;
        if (mcache && mcache.has(rr)) { out = out.concat(mcache.get(rr)); return; }
        var nm = rr.sample.name, one = [];
        try { E0.numberSources(rr, rr.sample).forEach(function (s) { one.push({ v: s.v, label: '「' + nm + '」' + s.label, kind: s.kind }); }); } catch (x) {}
        fixedFor(rr, rr.sample).forEach(function (s) { one.push({ v: s.v, label: '「' + nm + '」' + s.label, kind: s.kind }); });
        if (mcache) mcache.set(rr, one); out = out.concat(one); });
      return out;
    };
    E0.numberCheck = function (text, r, sample, extra) {
      var more = [];
      try { more = fixedFor(r, sample).concat(liveFor(r)); if (ctxName() === 'manager') more = more.concat(mgrFor()); } catch (x) { more = []; }
      return origCheck.call(E0, text, r, sample, (extra || []).concat(more));
    };
  }

  /* ---------- 笔记标题里的数字不加红色胶囊（如《中秋活动预告：满199送香薰小样》），校验器按整段标题识别为引用 ---------- */
  // 与校验器同一套"中性数字"规则：标题/引号里、日期、"每 N""第 N"、31 以内的整数后面跟量词（篇、天、个……）
  var UNIT = /^[\s]?[天日月篇件笔步关位次倍周号点个种类条项轮组年]/;
  function neutralAt(txt, i, s) {
    if (/[¥￥%％万]/.test(s)) return false;
    var num = parseFloat(s.replace(/[,\s]/g, '').replace('−', '-')), dec = (s.split('.')[1] || '').length;
    var after = txt.slice(i + s.length, i + s.length + 2), before = txt.slice(Math.max(0, i - 2), i);
    return (Math.abs(num) <= 31 && dec === 0 && UNIT.test(after)) || /每\s?$/.test(before) || /第\s?$/.test(before);
  }
  function unwrapTitles(el) {
    var caps = el.querySelectorAll('.gq-num'); if (!caps.length) return;
    var txt = el.textContent, spans = [], m;
    var re = /《[^》]*》|「[^」]*」|“[^”]*”|\d{4}[-/年]\d{1,2}([-/月]\d{1,2}日?)?|\d{1,2}月\d{1,2}日|\d{1,2}月|\d{1,2}日/g;
    while ((m = re.exec(txt))) spans.push([m.index, m.index + m[0].length]);
    var pos = 0, hit = [], w = document.createTreeWalker(el, NodeFilter.SHOW_TEXT, null), n;
    while ((n = w.nextNode())) {
      var p = n.parentNode;
      if (p && p.classList && p.classList.contains('gq-num') && !p.classList.contains('rg-n') &&
          (spans.some(function (s) { return pos >= s[0] && pos < s[1]; }) || neutralAt(txt, pos, n.nodeValue))) hit.push(p);
      pos += n.nodeValue.length;
    }
    hit.forEach(function (b) { b.parentNode.replaceChild(document.createTextNode(b.textContent), b); });
    if (hit.length) el.normalize();
  }
  // 新回答的校验条出来后，回答里的数字胶囊还会撑高一点：1.5 秒内保持贴底；用户自己滚动就松开
  function pinBottom(t) {
    if (t.__pin) clearInterval(t.__pin);
    var stop = function () { clearInterval(t.__pin); t.__pin = null; ['wheel', 'touchstart'].forEach(function (ev) { t.removeEventListener(ev, stop); }); };
    ['wheel', 'touchstart'].forEach(function (ev) { t.addEventListener(ev, stop, { passive: true }); });
    var n = 0; t.scrollTop = t.scrollHeight;
    t.__pin = setInterval(function () { t.scrollTop = t.scrollHeight; if (++n >= 15 || !t.isConnected) stop(); }, 100);
  }
  try {
    new MutationObserver(function (list) {
      list.forEach(function (mu) {
        var t = mu.target; if (!t || t.nodeType !== 1) return;
        if (t.classList && t.classList.contains('gq-msgs') && t.lastElementChild && t.lastElementChild.classList.contains('rg-badge') &&
            Array.prototype.some.call(mu.addedNodes, function (x) { return x === t.lastElementChild; })) {
          pinBottom(t);
        }
        if (t.classList && t.classList.contains('ai-bubble') && t.closest && t.closest('.ai-msg.bot') && t.childNodes.length === 1 && t.firstChild.nodeType === 3) {
          var raw = t.firstChild.nodeValue, fx = raw; try { fx = fixAppText(raw, curRes()); } catch (e) {}
          if (fx !== raw) t.firstChild.nodeValue = fx;
          return;
        }
        var a = t.classList && t.classList.contains('gq-m') ? t : (t.closest ? t.closest('.gq-m.a') : null);
        if (a && a.classList.contains('a')) unwrapTitles(a);
      });
    }).observe(document.documentElement, { childList: true, subtree: true });
  } catch (e) {}

  /* ---------- 面板里的「数字校验」小条：排成一行文字，窄屏自然换行（原来是弹性横排，会被挤成几列） ---------- */
  try {
    if (!document.getElementById('ask9-style')) {
      var st = document.createElement('style'); st.id = 'ask9-style';
      st.textContent = '.gq-msgs .rg-badge{display:block;line-height:1.55;padding:0 2px}.gq-msgs .rg-badge svg{vertical-align:-2px;margin-right:4px}.gq-msgs .rg-badge b{margin:0 2px}' +
        '.fx3-rot{vertical-align:top!important;height:auto!important;line-height:inherit!important}.fx3-rot i{line-height:inherit}';
      (document.head || document.documentElement).appendChild(st);
    }
  } catch (e) {}

  /* ---------- 页面文字修正（只改说法，不改数字） ---------- */
  var BV = { worth: '值回票价', loss: '亏了', unclear: '算不准', none: '没效果' }, KV = { worth: '值得续约', loss: '报价偏高', unclear: '说不清', none: '没看到效果' };
  function polishText(t) {
    var o = t;
    t = t.replace(/(达人「[^」]+」)(worth|loss|unclear|none) → (worth|loss|unclear|none)/g, function (m, pre, a, b) { return pre + '从「' + KV[a] + '」变成「' + KV[b] + '」'; });
    t = t.replace(/投流 (worth|loss|unclear|none) → (worth|loss|unclear|none)/g, function (m, a, b) { return '投流从「' + BV[a] + '」变成「' + BV[b] + '」'; });
    t = t.replace('数字由算法算出，草稿由 AI 撰写', '数字由算法算出，草稿按模板自动起草');
    t = t.replace(/3 分钟导览/g, '30 秒导览').replace(/带我 3 分钟看完观潮/g, '带我 30 秒看完观潮');
    t = t.replace(/只有 0 篇最后真有效/g, '没有一篇最后真有效');
    t = t.replace(/是第二名的 1(?:\.0)? 倍。/g, '和第二名几乎持平，两类都值得多写。');
    t = t.replace('在比泊松更乱的噪声下，误判率仍在 9% 以内。', '在比泊松更乱的模拟噪声下，误判率仍在 9% 以内（真实世界噪声的检验见幕后「怎么检验的」）。');
    if (/才算"真有效"$/.test(t) || /不只看站内$/.test(t)) t = t + '。';
    t = fixLightText(t);
    return t === o ? null : t;
  }
  function polishNode(root) {
    if (!root) return;
    if (root.nodeType === 3) { var p0 = root.parentNode; if (!p0 || (p0.closest && p0.closest('.gq, script, style, textarea'))) return; var v0 = polishText(root.nodeValue); if (v0 != null) root.nodeValue = v0; return; }
    if (root.nodeType !== 1 || (root.closest && root.closest('.gq, script, style, textarea'))) return;
    var attrEls = [root].concat(Array.prototype.slice.call(root.querySelectorAll ? root.querySelectorAll('[title*="3 分钟"],[aria-label*="3 分钟"]') : []));
    attrEls.forEach(function (e) { ['title', 'aria-label'].forEach(function (a) { var v = e.getAttribute && e.getAttribute(a); if (v && /3 分钟导览/.test(v)) e.setAttribute(a, v.replace(/3 分钟导览/g, '30 秒导览')); }); });
    var w = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, null), n, todo = [];
    while ((n = w.nextNode())) todo.push(n);
    todo.forEach(function (x) { var p = x.parentNode; if (p && p.closest && p.closest('.gq, script, style, textarea')) return; var v = polishText(x.nodeValue); if (v != null) x.nodeValue = v; });
    // "没过线的 N 篇里，只有 <b>0</b> 篇最后真有效" → "没有一篇最后真有效"（数字被加粗拆开，需按节点改）
    var lines = root.matches && root.matches('.inv-statline') ? [root] : Array.prototype.slice.call(root.querySelectorAll ? root.querySelectorAll('.inv-statline') : []);
    lines.forEach(function (el) { var ns = el.childNodes; for (var i = 0; i + 2 < ns.length; i++) {
      if (ns[i].nodeType === 3 && /只有 $/.test(ns[i].nodeValue) && ns[i + 1].nodeName === 'B' && ns[i + 1].textContent.trim() === '0' && ns[i + 2].nodeType === 3 && /^ 篇最后真有效/.test(ns[i + 2].nodeValue)) {
        ns[i].nodeValue = ns[i].nodeValue.replace(/只有 $/, ''); ns[i + 2].nodeValue = ns[i + 2].nodeValue.replace(/^ 篇最后真有效/, '没有一篇最后真有效'); el.removeChild(ns[i + 1]); break; } } });
  }
  try {
    new MutationObserver(function (list) {
      list.forEach(function (mu) { Array.prototype.forEach.call(mu.addedNodes, polishNode); });
    }).observe(document.documentElement, { childList: true, subtree: true });
    if (document.body) polishNode(document.body);
  } catch (e) {}

  /* ---------- 换店 / 换视角：对话清空 ---------- */
  var lastKey = null;
  function key() { return ctxName() === 'manager' ? 'manager' : 'shop:' + (curName() || ''); }
  document.addEventListener('click', function (e) {
    var t = e.target && e.target.closest && e.target.closest('.gq-fab'); if (!t) return;
    var k = key(); if (lastKey !== null && k !== lastKey && typeof A.reset === 'function') { try { A.reset(); } catch (x) {} }
    lastKey = k;
  }, true);
})();
