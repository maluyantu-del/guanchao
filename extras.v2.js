// 观潮 · 升级 A 模块：去水分小图、可信度胶囊、达人合作账、双赢测算
// 依赖 engine.js（LedgerEngine）。所有数字来自 LedgerEngine，本文件不含写死的业务数字。
//
// GuanchaoExtras.boostChart(容器元素, LedgerEngine.boostSeries(r, 笔记))   // merged 的笔记 boostSeries 返回 null，不要调用
// GuanchaoExtras.confPill(LedgerEngine.confidence(数值, 波动))              // 返回「可信度 高/中/低」胶囊的 HTML 字符串
// GuanchaoExtras.evidencePill({ grade:'估算级'|'实验级'|'进行中', robust:true|false|null, conf:{label}, explain:'笔记标题' })
//    → 一个灰色胶囊「估算级 · 稳健 · 可信度中」；带 explain 时可点击（data-explain=标题），由页面绑定打开「这笔账怎么算的」
// GuanchaoExtras.renderKolLedger(容器, { r, sample, onExplain: function (笔记标题) {} })  // onExplain 可选：点达人卡上的胶囊时调用
// GuanchaoExtras.renderKolLedger(容器元素, { r, sample, onJumpNote })     // 达人合作账卡片（没有达人记录时渲染空）
// GuanchaoExtras.highlightKol(达人名称)                                     // 高亮达人账里的某一位约 1 秒
// GuanchaoExtras.renderWinwin(容器元素, { clients: [{ key, sample, r }] })  // 客户经理视角的双赢测算卡片
(function () {
  var E = function () { return window.LedgerEngine || (typeof LedgerEngine !== 'undefined' ? LedgerEngine : null); };
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function r0(v) { var x = Math.round(v); return x === 0 ? 0 : x; }
  function f2(v) { return (Math.round(v * 100) / 100).toFixed(2); }
  function money(v) { return '¥' + r0(v).toLocaleString('en-US'); }
  function md(iso) { var p = String(iso).split('-'); return (+p[1]) + '月' + (+p[2]) + '日'; }
  function sum(arr, f) { return arr.reduce(function (a, x) { return a + (f ? f(x) : x); }, 0); }
  var VERD = { worth: ['值得续约', '#E6F6EE', '#0F7A45'], loss: ['报价偏高', '#FFEEF0', '#C8102E'], unclear: ['说不清', '#FFF4DB', '#946500'], none: ['没看到效果', '#F1F1F4', '#5D5D68'] };

  var CSS = [
    '.gx-card{background:#fff;border-radius:20px;box-shadow:0 1px 2px rgba(23,23,28,.04),0 8px 24px rgba(23,23,28,.06);padding:20px;color:#17171C;font-size:15px;line-height:1.65}',
    '.gx-card *{box-sizing:border-box}',
    '.gx-h{font-size:19px;font-weight:800;margin:0}',
    '.gx-sub{font-size:13px;color:#5D5D68;margin-top:2px}',
    '.gx-conf{display:inline-flex;align-items:center;border-radius:999px;padding:0 8px;font-size:12px;font-weight:600;line-height:20px;white-space:nowrap}',
    '.gx-conf.high{background:#E6F6EE;color:#0F7A45}.gx-conf.mid{background:#FFF4DB;color:#946500}.gx-conf.low{background:#F1F1F4;color:#5D5D68}',
    '.gx-bchart{width:100%;margin:8px 0 2px}.gx-bchart text{font-size:12px;fill:#8A8A94}',
    '.gx-legend{font-size:12px;color:#8A8A94;margin-bottom:6px}',
    '.gx-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(280px,1fr));gap:12px;margin-top:14px}',
    '.gx-kol{border:1.5px solid #F0ECE7;border-radius:16px;padding:14px;transition:box-shadow .3s,border-color .3s}',
    '.gx-kol.hl{border-color:#FF2442;box-shadow:0 0 0 4px rgba(255,36,66,.15)}',
    '.gx-row{display:flex;justify-content:space-between;align-items:center;gap:8px;flex-wrap:wrap}',
    '.gx-name{font-weight:700;font-size:16px}',
    '.gx-ev{display:inline-flex;align-items:center;border-radius:999px;padding:1px 9px;font-size:12px;font-weight:500;line-height:20px;white-space:nowrap;background:#F1F1F4;color:#5D5D68;border:0;font-family:inherit}',
    'button.gx-ev{cursor:pointer}button.gx-ev:hover{background:#E6E6EB;color:#17171C}',
    '.gx-pill{display:inline-flex;align-items:center;border-radius:999px;padding:1px 10px;font-size:12px;font-weight:700;white-space:nowrap}',
    '.gx-meta{font-size:13px;color:#5D5D68;margin-top:4px}',
    '.gx-stats{display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin:12px 0 10px}',
    '.gx-stat{background:#FAF9F7;border-radius:12px;padding:8px 10px}',
    '.gx-stat .k{font-size:12px;color:#5D5D68}.gx-stat .v{font-size:18px;font-weight:800;font-variant-numeric:tabular-nums;line-height:1.3}.gx-stat .n{font-size:11px;color:#9A9AA4}',
    '.gx-advice{font-size:14px;color:#2B2B33;background:#FAF9F7;border-radius:12px;padding:10px 12px;line-height:1.6}',
    '.gx-foot{margin-top:14px;padding-top:12px;border-top:1px dashed #E8E4DF;font-size:14px;color:#2B2B33}',
    '.gx-big{display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-top:14px}',
    '.gx-bigv{border-radius:16px;padding:14px 16px;background:#FAF9F7}',
    '.gx-bigv .k{font-size:13px;color:#5D5D68}.gx-bigv .v{font-size:28px;font-weight:800;font-variant-numeric:tabular-nums;line-height:1.3}',
    '.gx-bigv.m .v{color:#0F7A45}.gx-bigv.p .v{color:#FF2442}',
    '.gx-tb{width:100%;border-collapse:collapse;margin-top:14px;font-size:14px;font-variant-numeric:tabular-nums}',
    '.gx-tb th{text-align:right;font-weight:600;color:#5D5D68;font-size:12px;padding:6px 8px;border-bottom:1px solid #EFECE8;white-space:nowrap}',
    '.gx-tb th:first-child,.gx-tb td:first-child{text-align:left}',
    '.gx-tb td{text-align:right;padding:8px;border-bottom:1px solid #F5F2EE}',
    '.gx-tb tr.total td{font-weight:700;border-bottom:0;background:#FAF9F7}',
    '.gx-tb .pos{color:#0F7A45}.gx-tb .neg{color:#C8102E}',
    '.gx-mob{display:none}',
    '.gx-risk{margin-top:12px;background:#FFF4DB;color:#7A5300;border-radius:12px;padding:10px 14px;font-size:14px;line-height:1.7}',
    '.gx-note{margin-top:10px;font-size:12px;color:#9A9AA4}',
    '@media (max-width:640px){.gx-card{padding:16px}.gx-stats{grid-template-columns:repeat(3,1fr);gap:6px}.gx-stat .v{font-size:16px}.gx-big{grid-template-columns:1fr}.gx-tb{display:none}.gx-mob{display:grid;gap:10px;margin-top:12px}.gx-mc{border:1.5px solid #F0ECE7;border-radius:14px;padding:12px;font-size:14px;font-variant-numeric:tabular-nums}.gx-mc b{display:block;font-size:15px;margin-bottom:4px}.gx-mc div{display:flex;justify-content:space-between;gap:8px;color:#5D5D68}.gx-mc div span:last-child{color:#17171C;font-weight:600}}'
  ].join('\n');
  function ensureStyle() { if (document.getElementById('gx-style')) return; var st = document.createElement('style'); st.id = 'gx-style'; st.textContent = CSS; document.head.appendChild(st); }

  // ---------- 可信度胶囊 ----------
  function confPill(c) { if (!c) return ''; ensureStyle(); return '<span class="gx-conf ' + esc(c.level) + '">可信度 ' + esc(c.label) + '</span>'; }
  function evidencePill(o) {
    ensureStyle(); o = o || {};
    var parts = [o.grade || '估算级'];
    if (o.robust === true) parts.push('稳健'); else if (o.robust === false) parts.push('换算法会变');
    if (o.conf && o.conf.label) parts.push('可信度' + o.conf.label);
    var txt = esc(parts.join(' · '));
    if (o.explain) return '<button type="button" class="gx-ev" data-explain="' + esc(o.explain) + '" title="点开看这笔账怎么算的">' + txt + '</button>';
    return '<span class="gx-ev">' + txt + '</span>';
  }

  // ---------- 去水分小折线图 ----------
  function boostChart(el, s) {
    ensureStyle();
    if (!s) { el.innerHTML = ''; return; }
    var W = Math.max(260, el.clientWidth || 520), H = 150, L = 10, R = 10, T = 24, B = 26;
    var a = s.actual, o = s.organic, n = a.length, k = s.boostStartIndex;
    var vals = a.concat(o, [0]), mx = Math.max.apply(null, vals) * 1.12 || 1, mn = Math.min.apply(null, vals);
    if (mn < 0) mn *= 1.12;
    var X = function (i) { return L + 16 + i * (W - L - R - 32) / (n - 1); }, Y = function (v) { return T + (H - T - B) * (1 - (v - mn) / (mx - mn)); };
    var pts = function (arr) { return arr.map(function (v, i) { return X(i).toFixed(1) + ',' + Y(v).toFixed(1); }).join(' '); };
    var top = a.slice(k).map(function (v, i) { return X(i + k).toFixed(1) + ',' + Y(v).toFixed(1); });
    var bot = o.slice(k).map(function (v, i) { return X(i + k).toFixed(1) + ',' + Y(v).toFixed(1); }).reverse();
    var h = '<' + 'svg width="' + W + '" height="' + H + '" viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="投流前后每天比平时多出来的量">';
    h += '<line x1="' + L + '" x2="' + (W - R) + '" y1="' + Y(0).toFixed(1) + '" y2="' + Y(0).toFixed(1) + '" stroke="#DDD8D2"/>';
    h += '<polygon points="' + top.concat(bot).join(' ') + '" fill="#FF2442" opacity=".16"/>';
    h += '<line x1="' + X(k).toFixed(1) + '" x2="' + X(k).toFixed(1) + '" y1="' + (T - 6) + '" y2="' + (H - B) + '" stroke="#9A9AA4" stroke-dasharray="4 4"/>';
    h += '<text x="' + (X(k) + 5).toFixed(1) + '" y="' + (T - 8) + '" style="fill:#5D5D68">开始投流</text>';
    h += '<polyline points="' + pts(o) + '" fill="none" stroke="#8A8A94" stroke-width="2" stroke-dasharray="6 5"/>';
    h += '<polyline points="' + pts(a) + '" fill="none" stroke="#FF2442" stroke-width="2.4" stroke-linejoin="round"/>';
    for (var i = 0; i < n; i++) h += '<text x="' + X(i).toFixed(1) + '" y="' + (H - 6) + '" text-anchor="middle">第' + (i + 1) + '天</text>';
    el.innerHTML = '<div class="gx-bchart">' + h + '</svg></div><div class="gx-legend">灰色虚线：不投流本来会来　红色：实际　红色阴影：投流的真实功劳</div>';
  }

  // ---------- 达人合作账 ----------
  function renderKolLedger(el, o) {
    ensureStyle();
    var LE = E(), r = o.r, M = o.sample.metric, list = LE.kolLedger(r);
    if (!list.length) { el.innerHTML = ''; return list; }
    var adv = function (k) {
      if (k.verdict === 'worth') return '每 1 元报价换回 ' + f2(k.roi) + ' 元，高于保本线，可以续约。下次报价在 ' + money(k.breakEven) + ' 以内都划算。';
      if (k.verdict === 'loss') return '带来了生意，但报价偏高：每 1 元只换回 ' + f2(k.roi) + ' 元，低于保本线。续约前把报价谈到 ' + money(k.breakEven) + ' 以内。';
      if (k.verdict === 'unclear') return '多带来的量还在正常波动范围内，说不清是不是这位博主的功劳。先小额再合作一次，或换同类博主做对照。';
      return '这篇合作笔记没看到额外的' + M + '，不建议续约。';
    };
    var nW = list.filter(function (k) { return k.verdict === 'worth'; }).length, nL = list.filter(function (k) { return k.verdict === 'loss'; }).length;
    el.innerHTML = '<div class="gx-card" data-gx-kol>' +
      '<h3 class="gx-h">达人合作账：这位博主值不值这个报价</h3>' +
      '<div class="gx-sub">品牌找博主合作（蒲公英）也是一笔种草投入：用同样的方法算出每篇合作笔记多带来多少生意，再和报价比</div>' +
      '<div class="gx-note" style="margin-top:4px">口径：按合作笔记直接带来的生意计，未计品牌长期价值，适合效果导向的合作决策。</div>' +
      '<div class="gx-grid">' + list.map(function (k) {
        var v = VERD[k.verdict] || VERD.none;
        return '<div class="gx-kol" data-kol="' + esc(k.kol) + '">' +
          '<div class="gx-row"><span class="gx-name">' + esc(k.kol) + '</span><span style="display:flex;gap:6px;align-items:center"><span class="gx-pill" style="background:' + v[1] + ';color:' + v[2] + '">' + v[0] + '</span>' + evidencePill({ grade: '估算级', conf: k.conf, explain: o.onExplain ? k.title : null }) + '</span></div>' +
          '<div class="gx-meta">' + esc(k.title) + ' · ' + md(k.date) + ' · 报价 ' + money(k.cost) + '</div>' +
          '<div class="gx-stats">' +
          '<div class="gx-stat"><div class="k">多带来</div><div class="v">' + r0(k.inc) + ' 个' + esc(M) + '</div><div class="n">可能 ' + r0(Math.max(0, k.lo)) + '~' + r0(k.hi) + '</div></div>' +
          '<div class="gx-stat"><div class="k">每个' + esc(M) + '花了</div><div class="v">' + (k.inc > 0 && k.perUnit != null ? money(k.perUnit) : '—') + '</div><div class="n">报价 ÷ 多带来</div></div>' +
          '<div class="gx-stat"><div class="k">每 1 元报价换回</div><div class="v">' + f2(k.roi) + ' 元</div><div class="n">保本线 ' + f2(r.be) + ' 元</div></div>' +
          '</div><div class="gx-advice">' + adv(k) + '</div></div>';
      }).join('') + '</div>' +
      '<div class="gx-foot">本期达人合作共花 ' + money(sum(list, function (k) { return k.cost; })) + '，多带来约 ' + r0(sum(list, function (k) { return k.inc; })) + ' 个' + esc(M) + '；其中 ' + nW + ' 位值得续约，' + nL + ' 位需要压价。</div>' +
      '</div>';
    if (o.onExplain) Array.prototype.forEach.call(el.querySelectorAll('[data-explain]'), function (b) { b.onclick = function () { o.onExplain(b.getAttribute('data-explain')); }; });
    return list;
  }
  function highlightKol(name) {
    var first = String(name || '').split(' · ')[0];
    var cards = document.querySelectorAll('[data-gx-kol] .gx-kol');
    var hit = null;
    Array.prototype.forEach.call(cards, function (c) { if (!hit && c.getAttribute('data-kol').indexOf(first) === 0) hit = c; });
    var card = document.querySelector('[data-gx-kol]');
    if (card) card.scrollIntoView({ behavior: 'smooth', block: 'start' });
    if (hit) { hit.classList.add('hl'); setTimeout(function () { hit.classList.remove('hl'); }, 1200); }
  }

  // ---------- 双赢测算 ----------
  function renderWinwin(el, o) {
    ensureStyle();
    var LE = E(), rows = o.clients.map(function (c) {
      var r = c.r || LE.compute(c.sample), w = LE.winwin(r, c.sample), S = r.summary;
      var status = (S.roiIn < r.be && S.roiReal >= r.be) ? 'risk' : (S.roiReal < r.be ? 'loss' : 'ok');
      return { name: c.sample.name, w: w, status: status };
    }).filter(function (x) { return x.w && x.w.ok !== false; });
    var tM = sum(rows, function (x) { return x.w.dMerchant; }), tP = sum(rows, function (x) { return x.w.dPlatform; });
    var sgn = function (v) { return (v >= 0 ? '+' : '−') + money(Math.abs(v)); };
    var cls = function (v) { return v >= 0 ? 'pos' : 'neg'; };
    el.innerHTML = '<div class="gx-card">' +
      '<h3 class="gx-h">双赢测算：算清账以后，商家和平台各多得多少</h3>' +
      '<div class="gx-sub">保持每个客户现在的发文节奏不变，只按观潮的建议调整投流（只投亮绿灯的笔记）。平台收入按商家投流花费计；毛利已扣投流花费。</div>' +
      '<div class="gx-big"><div class="gx-bigv m"><div class="k">商家每月多赚毛利</div><div class="v">' + sgn(tM) + '</div></div><div class="gx-bigv p"><div class="k">平台每月多获投放</div><div class="v">' + sgn(tP) + '</div></div></div>' +
      '<table class="gx-tb"><thead><tr><th>客户</th><th>现在每月投流</th><th>建议每月投流</th><th>商家每月多赚毛利</th><th>平台每月投放变化</th></tr></thead><tbody>' +
      rows.map(function (x) { return '<tr><td>' + esc(x.name) + '</td><td>' + money(x.w.curMonthly) + '</td><td>' + money(x.w.sug) + '</td><td class="' + cls(x.w.dMerchant) + '">' + sgn(x.w.dMerchant) + '</td><td class="' + cls(x.w.dPlatform) + '">' + sgn(x.w.dPlatform) + '</td></tr>'; }).join('') +
      '<tr class="total"><td>合计</td><td>' + money(sum(rows, function (x) { return x.w.curMonthly; })) + '</td><td>' + money(sum(rows, function (x) { return x.w.sug; })) + '</td><td class="' + cls(tM) + '">' + sgn(tM) + '</td><td class="' + cls(tP) + '">' + sgn(tP) + '</td></tr></tbody></table>' +
      '<div class="gx-mob">' + rows.map(function (x) { return '<div class="gx-mc"><b>' + esc(x.name) + '</b><div><span>现在每月投流</span><span>' + money(x.w.curMonthly) + '</span></div><div><span>建议每月投流</span><span>' + money(x.w.sug) + '</span></div><div><span>商家每月多赚毛利</span><span>' + sgn(x.w.dMerchant) + '</span></div><div><span>平台每月投放变化</span><span>' + sgn(x.w.dPlatform) + '</span></div></div>'; }).join('') +
      '<div class="gx-mc"><b>合计</b><div><span>商家每月多赚毛利</span><span>' + sgn(tM) + '</span></div><div><span>平台每月多获投放</span><span>' + sgn(tP) + '</span></div></div></div>' +
      rows.filter(function (x) { return x.status === 'risk'; }).map(function (x) {
        return '<div class="gx-risk">如果「' + esc(x.name) + '」只看站内、觉得投流在亏而停投：平台每月少 ' + money(x.w.curMonthly) + ' 投放，客户每月也少赚 ' + money(x.w.curProfit) + ' 毛利——两边都输。讲清全域账，就是在保住这笔生意。</div>';
      }).join('') +
      '<div class="gx-note">测算基于各客户历史数据和"投流回报会递减"的假设，仅用于说明方向；实际以投放结果为准。</div>' +
      '</div>';
    return { rows: rows, dMerchant: tM, dPlatform: tP };
  }

  window.GuanchaoExtras = { boostChart: boostChart, confPill: confPill, evidencePill: evidencePill, renderKolLedger: renderKolLedger, highlightKol: highlightKol, renderWinwin: renderWinwin };
})();
