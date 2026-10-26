// 观潮 · 「调整假设」面板 + 「实验级结论」卡片（软肋改造包用）
// 依赖 engine.js v4（LedgerEngine.sensitivity / experimentResult）。所有数字来自 LedgerEngine，本文件不含写死的业务数字。
//
// GuanchaoAssumptions.render(容器元素, {
//   sample,                         // 当前店铺数据（含 settings: { price, margin, conv_rate }）
//   defaults,                       // 这家店的默认 settings（用于"恢复默认"和滑块范围）
//   r,                              // 当前 LedgerEngine.compute 结果（用来显示敏感性）
//   onChange: function (settings) { 用新 settings 重新 compute 当前店铺并刷新全站 }
// })
// GuanchaoAssumptions.renderExperiment(容器元素, { r, sample })   // 「实验级结论」卡片
// GuanchaoAssumptions.reset()                                   // 演示重置时调用：清掉记住的折叠状态
(function () {
  var E = function () { return window.LedgerEngine || (typeof LedgerEngine !== 'undefined' ? LedgerEngine : null); };
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function r0(v) { var x = Math.round(v); return x === 0 ? 0 : x; }
  function f1(v) { return (Math.round(v * 10) / 10).toFixed(1); }
  function f2(v) { return (Math.round(v * 100) / 100).toFixed(2); }
  function money(v) { return '¥' + r0(v).toLocaleString('en-US'); }
  var openState = {};

  var CSS = [
    '.ga{border:1.5px solid #F0ECE7;border-radius:14px;margin-top:12px;font-size:14px;color:#17171C}',
    '.ga *{box-sizing:border-box}',
    '.ga summary{list-style:none;cursor:pointer;padding:10px 14px;display:flex;justify-content:space-between;align-items:center;font-weight:700;font-size:15px}',
    '.ga summary::-webkit-details-marker{display:none}',
    '.ga summary span{font-size:12px;color:#5D5D68;font-weight:500}',
    '.ga[open] summary{border-bottom:1px dashed #E8E4DF}',
    '.ga-body{padding:12px 14px 14px;display:grid;gap:12px}',
    '.ga-row{display:grid;grid-template-columns:96px 1fr 72px;gap:10px;align-items:center}',
    '.ga-row label{font-size:13px;color:#5D5D68}',
    '.ga-row input{width:100%;accent-color:#FF2442;height:24px}',
    '.ga-row b{text-align:right;font-variant-numeric:tabular-nums;font-size:14px}',
    '.ga-row b.chg{color:#FF2442}',
    '.ga-be{font-size:13px;color:#5D5D68;display:flex;justify-content:space-between;gap:8px;flex-wrap:wrap}',
    '.ga-be b{color:#17171C;font-variant-numeric:tabular-nums}',
    '.ga-sens{border-radius:12px;padding:10px 12px;font-size:13px;line-height:1.6}',
    '.ga-sens.ok{background:#E6F6EE;color:#0F7A45}.ga-sens.warn{background:#FFF4DB;color:#7A5300}',
    '.ga-sens ul{margin:4px 0 0;padding-left:18px}',
    '.ga-btn{font:inherit;font-size:13px;font-weight:600;border-radius:999px;padding:5px 12px;cursor:pointer;border:1.5px solid #E2DDD7;background:#fff;color:#17171C;justify-self:start}',
    '.ga-btn:disabled{opacity:.45;cursor:default}',
    '.ga-note{font-size:12px;color:#9A9AA4}',
    '@media (max-width:640px){.ga-row{grid-template-columns:80px 1fr 60px;gap:8px}}',
    // 实验级结论
    '.ge{background:#fff;border-radius:20px;box-shadow:0 1px 2px rgba(23,23,28,.04),0 8px 24px rgba(23,23,28,.06);padding:20px;color:#17171C;font-size:15px;line-height:1.65}',
    '.ge-h{font-size:19px;font-weight:800;margin:0;display:flex;align-items:center;gap:8px;flex-wrap:wrap}',
    '.ge-lv{font-size:12px;font-weight:700;border-radius:999px;padding:1px 9px}',
    '.ge-lv.est{background:#F1F1F4;color:#5D5D68}.ge-lv.exp{background:#E6F6EE;color:#0F7A45}',
    '.ge-p{margin:10px 0 0;color:#2B2B33}',
    '.ge-stats{display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin-top:12px}',
    '.ge-stat{background:#FAF9F7;border-radius:12px;padding:8px 10px}.ge-stat .k{font-size:12px;color:#5D5D68}.ge-stat .v{font-size:18px;font-weight:800;font-variant-numeric:tabular-nums}',
    '@media (max-width:640px){.ge{padding:16px}.ge-stats{grid-template-columns:1fr 1fr}}'
  ].join('\n');
  function ensureStyle() { if (document.getElementById('ga-style')) return; var st = document.createElement('style'); st.id = 'ga-style'; st.textContent = CSS; document.head.appendChild(st); }

  function render(el, o) {
    ensureStyle();
    var LE = E(), s = o.sample, d = o.defaults || s.settings, cur = s.settings || d, isLead = s.kind === 'lead';
    var key = s.name || 'shop', open = !!openState[key];
    var changed = Math.abs(cur.price - d.price) > 1e-9 || Math.abs(cur.margin - d.margin) > 1e-9 || (isLead && Math.abs((cur.conv_rate || 0) - (d.conv_rate || 0)) > 1e-9);
    var sens = typeof LE.sensitivity === 'function' ? LE.sensitivity(o.r) : null;
    var rows = [
      { k: 'price', label: '客单价', min: Math.round(d.price * 0.5), max: Math.round(d.price * 2), step: Math.max(1, Math.round(d.price / 100)), val: cur.price, fmt: function (v) { return money(v); } },
      { k: 'margin', label: '毛利率', min: 20, max: 90, step: 1, val: Math.round(cur.margin * 100), fmt: function (v) { return v + '%'; }, to: function (v) { return v / 100; } }
    ];
    if (isLead) rows.push({ k: 'conv_rate', label: '签约率', min: 1, max: 30, step: 1, val: Math.round((cur.conv_rate || 0) * 100), fmt: function (v) { return v + '%'; }, to: function (v) { return v / 100; } });
    el.innerHTML = '<details class="ga"' + (open ? ' open' : '') + '><summary>调整假设<span>' + (changed ? '已修改 · ' : '') + '客单价 / 毛利率' + (isLead ? ' / 签约率' : '') + '</span></summary><div class="ga-body">' +
      rows.map(function (x) { return '<div class="ga-row"><label>' + x.label + '</label><input type="range" data-k="' + x.k + '" min="' + x.min + '" max="' + x.max + '" step="' + x.step + '" value="' + x.val + '" aria-label="' + x.label + '"><b data-v="' + x.k + '"' + (changed ? ' class="chg"' : '') + '>' + x.fmt(x.val) + '</b></div>'; }).join('') +
      '<div class="ga-be"><span>保本线 = 1 ÷ 毛利率</span><b>' + f2(o.r.be) + ' 元</b></div>' +
      (sens ? '<div class="ga-sens ' + (sens.stable ? 'ok' : 'warn') + '">' + (sens.stable ? '毛利率、客单价上下浮动 20%，投流和达人的结论都不变' : '毛利率或客单价浮动 20% 时，以下结论会翻转：<ul>' + sens.flips.map(function (f) { return '<li>' + esc(f) + '</li>'; }).join('') + '</ul>') + '</div>' : '') +
      '<button class="ga-btn" data-reset' + (changed ? '' : ' disabled') + '>恢复默认</button>' +
      '<div class="ga-note">拖动后全站数字实时重算；保本线按毛利率计，未计人工、房租等固定成本。</div></div></details>';
    var det = el.querySelector('details');
    det.addEventListener('toggle', function () { openState[key] = det.open; });
    var apply = function () {
      var st = Object.assign({}, cur);
      rows.forEach(function (x) { var v = +el.querySelector('[data-k="' + x.k + '"]').value; st[x.k] = x.to ? x.to(v) : v; });
      openState[key] = true;
      if (o.onChange) o.onChange(st);
    };
    var t = null;
    rows.forEach(function (x) {
      var inp = el.querySelector('[data-k="' + x.k + '"]');
      inp.oninput = function () { el.querySelector('[data-v="' + x.k + '"]').textContent = x.fmt(+inp.value); clearTimeout(t); t = setTimeout(apply, 250); };
    });
    el.querySelector('[data-reset]').onclick = function () { openState[key] = true; if (o.onChange) o.onChange(Object.assign({}, d)); };
  }

  function renderExperiment(el, o) {
    ensureStyle();
    var LE = E(), r = o.r, M = o.sample.metric, x = typeof LE.experimentResult === 'function' ? LE.experimentResult(r) : { ok: false };
    var h = '<div class="ge"><h3 class="ge-h">实验级结论<span class="ge-lv ' + (x.ok ? 'exp' : 'est') + '">' + (x.ok ? '实验级' : '目前只有估算级') + '</span></h3>';
    if (!x.ok) h += '<p class="ge-p">还没有带分组的实验数据：按上面的方案投一轮（单数投、双数不投），导入时在笔记记录里标上分组，这里就会自动给出实验级结论。</p>';
    else h += '<p class="ge-p">投流组平均多带来 ' + f1(x.meanBoost) + ' 个，对照组 ' + f1(x.meanHold) + ' 个，投流真实增量 ' + f1(x.diff) + ' 个（可能 ' + r0(x.lo) + '～' + r0(x.hi) + '），' + (x.significant ? '已明显超出随机波动' : '还没超出随机波动，再多做几篇') + '；每 1 元换回 ' + f2(x.roi) + ' 元。</p>' +
      '<div class="ge-stats"><div class="ge-stat"><div class="k">投流组篇数</div><div class="v">' + x.nBoost + '</div></div><div class="ge-stat"><div class="k">对照组篇数</div><div class="v">' + x.nHold + '</div></div><div class="ge-stat"><div class="k">实验投流花费</div><div class="v">' + money(x.cost || 0) + '</div></div></div>';
    el.innerHTML = h + '</div>';
    return x;
  }

  window.GuanchaoAssumptions = { render: render, renderExperiment: renderExperiment, reset: function () { openState = {}; } };
})();
