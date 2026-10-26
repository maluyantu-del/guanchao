/* 观潮 · 主逻辑（所有数字一律来自 LedgerEngine.compute，本文件不产生任何业务数字） */
/* v20：动效包（数字活起来、潮水、开场过场、闯关、行动包、图表联动、客户经理、导入/实验/AI、导览/幕后/细节）——只加动效，不改数字和功能
   v19：视觉加法（包 20 横幅「本店的潮汐」；包 21 横幅悬停、大图潮汐化、预算浮标、客户卡迷你潮汐）——装饰层，不改数字和功能
   v18：终版微调（顶栏「3 分钟导览」按钮放到「种草侦探」右边、「⋯」只留演示重置；抽屉柱图日期不重叠、图例移到图下方）
   v17：QA 修复（去水分卡标题行补回「看起来 → 去水分后」、总账展开按钮换店后第一次点击无效）
   v16：视觉与手机打磨（切页淡入、2 位小数统一、横幅不闪 0、导入体检中、模块失败兜底、长标题省略）
   v15：3 分钟导览（⋯ 菜单 / 侦探成绩单 / 首次跳过气泡 三个入口）
   v14 收束：顶栏精简 + ⋯ 菜单、页签分三组、每页副标题、总览减负、证据标签合一、幕后页合并、AI 入口归位 */
(function () {
'use strict';

/* ================= 常量与元信息 ================= */
var SHOP_META = {
  study:  { key:'study',  name:'远帆留学工作室', short:'留学工作室', kind:'lead',  kindLabel:'服务类 · 看咨询', m:'咨询', price:6800, inCh:'小红书私信',   outCh:'公众号/官网咨询' },
  shop:   { key:'shop',   name:'慢燃香薰小店',   short:'香薰小店',   kind:'order', kindLabel:'电商 · 看订单',   m:'订单', price:89,   inCh:'小红书店铺',   outCh:'淘宝店' },
  coffee: { key:'coffee', name:'山野咖啡',       short:'山野咖啡',   kind:'order', kindLabel:'电商 · 看订单',   m:'订单', price:98,   inCh:'小红书店铺',   outCh:'天猫旗舰店' }
};
var TABS = [
  { id:'overview', label:'总览',     icon:'chart' },
  { id:'notes',    label:'笔记明细', icon:'doc'   },
  { id:'invest',   label:'该不该投', icon:'light' },
  { id:'budget',   label:'预算怎么花', icon:'coin' },
  { id:'ai',       label:'AI 参谋',  icon:'spark' }
];
/* v14：页签分三组（名称不变）+ 每页一句开场 */
var TAB_GROUPS = [
  { t:'算清账', ids:['overview','notes'] },
  { t:'做决定', ids:['invest','budget'] },
  { t:'去执行', ids:['ai'] }
];
var TAB_LEDE = {
  overview:'这期间种草带来了什么',
  notes:'每一篇、每一天',
  invest:'新笔记发出两天后再决定',
  budget:'下个月的钱怎么分',
  ai:'草稿已写好，你来决定'
};
var PH_COPY = {
  notes:  { icon:'📝', title:'「笔记明细」下一轮开放', text:'每篇笔记的日流水、红绿灯走势、渠道拆分和贡献明细，会在这里逐篇展开。这一版先把「总览」做扎实。' },
  invest: { icon:'🚦', title:'「该不该投」下一轮开放', text:'输入在投笔记和预算，用保本线和走势红绿灯判断值不值得追投。这一版先看总览里的建议。' },
  budget: { icon:'💰', title:'「预算怎么花」下一轮开放', text:'给定下个月的总预算，帮你分配到每篇笔记、每个渠道。总览里已经给了预算建议的预览。' },
  ai:     { icon:'🤖', title:'「AI 参谋」下一轮开放', text:'把这本账讲成人话：为什么这篇行、那篇不行，下周写什么。这一版先用总览的待办清单。' }
};

var state = { shop:'study', tab:'overview', view:'merchant', checked:{}, importMode:false
};
var DEBUG = /[?&]debug=1/.test(location.search);
var WARN = [];

/* ================= 工具 ================= */
function $(s){ return document.querySelector(s); }
function el(tag, cls, html){ var e=document.createElement(tag); if(cls)e.className=cls; if(html!=null)e.innerHTML=html; return e; }
function esc(s){ return String(s==null?'':s).replace(/[&<>"']/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c];}); }

function num(x){ return (typeof x==='number' && isFinite(x)); }
function fmtInt(x){ if(!num(x)) return '—'; var v=Math.round(x); if(v===0) v=0; return v.toLocaleString('zh-CN'); }
function toPct(x){ return num(x) ? (x<=1? x*100 : x) : null; }
function fmtPct(x){ var p=toPct(x); return p==null?'—':String(Math.round(p)); }
function fmt1(x){ if(!num(x)) return '—'; var v=Math.round(x*10)/10; return (v%1===0? String(v): v.toFixed(1)); }
function fmt2(x){ if(!num(x)) return '—'; return (Math.round(x*100)/100).toFixed(2); }
function fmtMoney(x){ if(!num(x)) return '—'; return '¥'+Math.round(x).toLocaleString('zh-CN'); }
function fmtWan(x){
  if(!num(x)) return '—';
  if(Math.abs(x)>=10000){ var w=Math.round(x/10000*10)/10; return '¥'+(w%1===0?String(w):w.toFixed(1))+' 万'; }
  return fmtMoney(x);
}

function parseDate(v){
  if(!v) return null;
  if(v instanceof Date) return isNaN(v)?null:v;
  if(typeof v==='number'){ if(v>1e8) { var d=new Date(v); return isNaN(d)?null:d; } return null; }
  var s=String(v), m=s.match(/(\d{4})[-\/](\d{1,2})[-\/](\d{1,2})/);
  if(m) return new Date(+m[1], +m[2]-1, +m[3]);
  if(/^\d{4}-\d{2}$/.test(s)){ var d2=new Date(s+'-01'); return isNaN(d2)?null:d2; }
  var d3=new Date(s); return isNaN(d3)?null:d3;
}
var WK=['日','一','二','三','四','五','六'];
function fmtDay(d){ return (d.getMonth()+1)+'月'+d.getDate()+'日'; }
function fmtDayWeek(d){ return fmtDay(d)+' 周'+WK[d.getDay()]; }
function addDays(d,n){ var x=new Date(d); x.setDate(x.getDate()+n); return x; }
function warn(msg){ if(WARN.indexOf(msg)<0) WARN.push(msg); }

/* ================= 图标 ================= */
function S(p){ return '<'+'svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">'+p+'</svg>'; }
function F(p){ return '<'+'svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">'+p+'</svg>'; }
var ICONS = {
  bolt: F('<path d="M13 2 4.6 13.6h5.5L9.4 22l8.8-11.6h-5.7L13 2z"/>'),
  eye: S('<path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>'),
  ban: S('<circle cx="12" cy="12" r="9"/><path d="M5.6 5.6l12.8 12.8"/>'),
  pause: F('<rect x="6" y="5" width="4" height="14" rx="1.2"/><rect x="14" y="5" width="4" height="14" rx="1.2"/>'),
  down: S('<polyline points="23 18 13.5 8.5 8.5 13.5 2 7"/><polyline points="17 18 23 18 23 12"/>'),
  pen: S('<path d="M17 3.5l3.5 3.5L8 19.5 3.5 20l.5-4.5L17 3.5z"/>'),
  compass: S('<circle cx="12" cy="12" r="9"/><path d="M16 8l-2.4 5.6L8 16l2.4-5.6L16 8z"/>'),
  flask: S('<path d="M9.5 3h5M10 3v5.5L4.8 18a2.2 2.2 0 0 0 2 3h10.4a2.2 2.2 0 0 0 2-3L14 8.5V3"/><path d="M7.4 14.5h9.2"/>'),
  chart: S('<path d="M4 4v16h16"/><path d="M8 16v-4M12 16V8M16 16v-6"/>'),
  doc: S('<path d="M6 2h8l4 4v16H6V2z"/><path d="M14 2v4h4"/><path d="M9 12h6M9 16h6"/>'),
  light: S('<rect x="7" y="2" width="10" height="20" rx="4"/><path d="M12 7h.01M12 12h.01M12 17h.01"/>'),
  coin: S('<circle cx="12" cy="12" r="9"/><path d="M9 7.5l3 4 3-4"/><path d="M12 11.5v5"/><path d="M9.5 14h5"/>'),
  spark: F('<path d="M12 2l2 6 6 2-6 2-2 6-2-6-6-2 6-2 2-6z"/>'),
  check: F('<path d="M20 6.5 9.5 17 4 11.5" stroke="#fff" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" fill="none"/>')
};

/* ================= 引擎接入 ================= */
function engineReady(){
  return typeof LedgerEngine!=='undefined' && LedgerEngine && typeof LedgerEngine.compute==='function'
      && typeof SAMPLES!=='undefined' && SAMPLES;
}
/* v6：假设调整只在内存里（SETTING_OVR），刷新页面恢复默认 */
var SETTING_OVR={}, OVR_STAMP=0;
/* v7：演示重置用——启动时留一份示例店的原始数据快照（补录/导入都不碰它） */
var SAMPLES_SNAPSHOT={};
try{
  for(var _sk in SAMPLES){
    if(Object.prototype.hasOwnProperty.call(SAMPLES,_sk) && SAMPLES[_sk]){
      SAMPLES_SNAPSHOT[_sk]=JSON.parse(JSON.stringify(SAMPLES[_sk]));
    }
  }
}catch(e){}
function getRawSample(key){
  try{
    if(Array.isArray(SAMPLES)) return SAMPLES.filter(function(s){ return s && (s.key===key||s.id===key); })[0];
    if(SAMPLES && typeof SAMPLES==='object'){
      if(SAMPLES[key]) return SAMPLES[key];
      var lower=key.toLowerCase();
      for(var k in SAMPLES){ if(k.toLowerCase()===lower) return SAMPLES[k]; }
    }
  }catch(e){}
  return null;
}
function getSample(key){
  var s=getRawSample(key);
  if(s && SETTING_OVR[key]){
    var c={}; for(var kk in s) c[kk]=s[kk];
    c.settings=SETTING_OVR[key];
    return c;
  }
  return s;
}
/* v6：稳健性每店算一次并缓存；假设调整后失效重算 */
var RB_CACHE={ shop:'', stamp:-1, val:null };
function getRobust(r){
  try{
    if(RB_CACHE.shop===state.shop && RB_CACHE.stamp===OVR_STAMP && RB_CACHE.val) return RB_CACHE.val;
    var v=LedgerEngine.robustness(r);
    RB_CACHE.shop=state.shop; RB_CACHE.stamp=OVR_STAMP; RB_CACHE.val=v;
    return v;
  }catch(e){ return null; }
}
function compute(key){
  var s=getSample(key);
  if(!s) return { err:'找不到店铺数据「'+key+'」：samples.js 里没有这个 key。' };
  try{ return { r: LedgerEngine.compute(s), sample:s }; }
  catch(e){ return { err:'引擎计算出错：'+((e&&e.message)||e) }; }
}

/* ---- 渠道（站内/站外）解析 ---- */
function guessRole(name, meta){
  name=String(name||'');
  if(name===meta.inCh) return 'in';
  if(name===meta.outCh) return 'out';
  return /公众号|官网|淘宝|天猫|外/.test(name) ? 'out' : 'in';
}
function resolveChannels(r, meta){
  var out=[], raw=r && r.channels;
  function push(name, role, key){ if(name) out.push({ name:String(name), role:role, key:key||String(name) }); }
  if(Array.isArray(raw)){
    raw.forEach(function(c){
      if(typeof c==='string'){ push(c, guessRole(c, meta)); }
      else if(c && typeof c==='object'){
        var name=c.name||c.label||c.title;
        var role=String(c.role||c.side||c.scope||(c.in?'in':(c.out?'out':''))||'');
        push(name, /out|外/.test(role)?'out':'in', c.key||c.id);
      }
    });
  } else if(raw && typeof raw==='object'){
    Object.keys(raw).forEach(function(k){
      var v=raw[k];
      if(v && typeof v==='object'){
        var role=String(v.role||v.side||v.scope||(v.in?'in':(v.out?'out':''))||'');
        push(v.name||v.label||k, /out|外/.test(role)?'out':guessRole(v.name||k, meta), k);
      } else { push(k, guessRole(k, meta), k); }
    });
  }
  if(!out.length){ push(meta.inCh,'in'); push(meta.outCh,'out'); warn('channels 未识别，使用元信息兜底'); }
  return out;
}
function pickNum(obj){
  for(var i=1;i<arguments.length;i++){ var v=obj[arguments[i]]; if(typeof v==='number'&&isFinite(v)) return v; }
  return null;
}
function chAmts(byCh, chans, meta){
  var res={ inSum:0, outSum:0 };
  if(!byCh) { warn('byCh 为空/缺失'); return res; }
  /* 引擎形态：byCh 是数组，与 r.channels 一一对应 */
  if(Array.isArray(byCh)){
    var hit=0;
    for(var i=0;i<byCh.length;i++){
      var v=byCh[i];
      if(typeof v!=='number'||!isFinite(v)) continue;
      var ch=chans[i]||{};
      if(ch.role==='out') res.outSum+=v; else res.inSum+=v;
      hit++;
    }
    if(!hit) warn('byCh 数组无数值');
    return res;
  }
  if(typeof byCh!=='object') { warn('byCh 类型未识别'); return res; }
  var inV=pickNum(byCh,'in','xhs','insite','in_site','site','on');
  var outV=pickNum(byCh,'out','off','offsite','off_site','outside');
  if(inV!=null || outV!=null){ res.inSum=inV||0; res.outSum=outV||0; return res; }
  var matched=false;
  chans.forEach(function(ch){
    var v=pickNum(byCh, ch.key, ch.name);
    if(v!=null){ matched=true; if(ch.role==='out') res.outSum+=v; else res.inSum+=v; }
  });
  if(!matched){
    Object.keys(byCh).forEach(function(k){
      var v=byCh[k]; if(typeof v!=='number'||!isFinite(v)) return;
      if(guessRole(k, meta)==='out') res.outSum+=v; else res.inSum+=v;
    });
    warn('byCh 键未匹配到渠道，按名称猜角色');
  }
  return res;
}
function chName(chans, role, meta){ 
  var c=chans.filter(function(x){return x.role===role;})[0];
  return c? c.name : (role==='in'? meta.inCh : meta.outCh);
}

/* ---- 日期范围 ---- */
function firstDate(r){
  if(r && Array.isArray(r.dates) && r.dates.length){ var d0=parseDate(r.dates[0]); if(d0) return d0; }
  var c=[r&&r.firstDate, r&&r.startDate, r&&r.start, r&&r.from, r&&r.range&&(r.range.from||r.range.start||(Array.isArray(r.range)&&r.range[0]))], d=null;
  for(var i=0;i<c.length;i++){ d=parseDate(c[i]); if(d) return d; }
  (r&&r.notes||[]).forEach(function(n){ var x=parseDate(n.date||n.d||n.day||n.time); if(x&&(!d||x<d)) d=x; });
  if(!d) warn('起始日期未识别');
  return d;
}
function lastDate(r){
  if(r && Array.isArray(r.dates) && r.dates.length){ var dN=parseDate(r.dates[r.dates.length-1]); if(dN) return dN; }
  var s=(r&&r.summary)||{};
  var c=[r&&r.lastDate, r&&r.endDate, r&&r.end, r&&r.to, s.lastDate, s.to, s.end, r&&r.range&&(r.range.to||r.range.end||(Array.isArray(r.range)&&r.range[1]))], d=null;
  for(var i=0;i<c.length;i++){ d=parseDate(c[i]); if(d) return d; }
  (r&&r.notes||[]).forEach(function(n){ var x=parseDate(n.date||n.d||n.day||n.time); if(x&&(!d||x>d)) d=x; });
  if(!d) warn('结束日期未识别');
  return d;
}

/* ---- 笔记字段 ---- */
function nTitle(n){ return esc(n.title||n.name||n.label||('笔记'+(n.id!=null?(' '+n.id):''))); }
function nDate(n){ return parseDate(n.date||n.d||n.day||n.time); }
function safeBudget(r){
  if(!r || typeof r.budget!=='function') { warn('r.budget 不可用'); return null; }
  try{
    var b=r.budget({plan:8});
    if(b && typeof b==='object'){
      var B=(b.Bstar!=null?b.Bstar:(b.bstar!=null?b.bstar:null));
      var C=(b.cStar!=null?b.cStar:(b.cstar!=null?b.cstar:null));
      if(B==null&&C==null) warn('budget 返回字段未识别: '+Object.keys(b).join(','));
      return { Bstar:B, cStar:C };
    }
    if(typeof b==='number') return { Bstar:b, cStar:null };
  }catch(e){ warn('r.budget({plan:8}) 抛错: '+e.message); }
  return null;
}

/* ================= 通用 UI ================= */
var toastTimer=null;
function toast(msg){
  var t=$('#toast'); t.textContent=msg; t.classList.add('show');
  clearTimeout(toastTimer); toastTimer=setTimeout(function(){ t.classList.remove('show'); },2600);
}
var COUNT_FIRST={ hero:true, wan:true };
function countUp(node, target, dur){
  dur=dur||950;
  if(!COUNT_FIRST.hero){ var v0=+target; if(!isFinite(v0)) v0=0; try{ node.textContent=Math.round(v0).toLocaleString('zh-CN'); }catch(e){} return; }
  COUNT_FIRST.hero=false;
  /* v10：先把文字落成目标值，再从 0 动画覆盖；rAF 不跑/被节流也最终停在目标值 */
  var v=+target; if(!isFinite(v)) v=0;
  var finalTxt=Math.round(v).toLocaleString('zh-CN');
  try{ node.textContent=finalTxt; }catch(e){ return; }
  var done=false;
  function finish(){ if(done) return; done=true; try{ node.textContent=finalTxt; }catch(e){} }
  var t0=null;
  function step(t){
    if(done) return;
    if(t0==null)t0=t;
    var p=Math.min(1,(t-t0)/dur), e=1-Math.pow(1-p,3);
    node.textContent=Math.round(v*e).toLocaleString('zh-CN');
    if(p>=1){ finish(); return; }
    requestAnimationFrame(step);
  }
  requestAnimationFrame(step);
  setTimeout(finish, dur+400);
}
function goJump(target){
  if(!target) return;
  if(target.type==='tab'){ switchTab(target.id); return; }
  if(target.type==='scroll'){
    var node=document.querySelector(target.sel);
    if(!node) return;
    expandWrap(node);
    try{ node.scrollIntoView({behavior:'smooth', block:'start'}); }catch(e){ node.scrollIntoView(); }
    node.classList.remove('flash'); void node.offsetWidth; node.classList.add('flash');
    setTimeout(function(){ node.classList.remove('flash'); },1800);
  }
}
/* v4：跳转目标在折叠区块里时，先展开再滚动（点 30 秒卡片 / 行动包跳转用；目标自身是折叠壳时也展开） */
function expandWrap(node){
  for(var p=node; p; p=p.parentNode){
    if(p.tagName==='DETAILS' && p.classList && p.classList.contains('col-wrap') && !p.open){ p.open=true; }
  }
}
/* v4：可折叠区块外壳（标题 + 一句关键数字 + 展开看依据） */
function wrapCollapse(opt){
  var d=el('details','col-wrap card-float');
  if(opt.id) d.id=opt.id;
  var s=el('summary','');
  s.innerHTML='<span class="col-t">'+esc(opt.title)+'</span>'+
    (opt.sub?'<span class="col-s">'+esc(opt.sub)+'</span>':'')+
    (opt.key?'<span class="col-k">'+esc(opt.key)+'</span>':'')+
    '<span class="col-hint" aria-hidden="true"></span>';
  d.appendChild(s);
  var b=el('div','col-body');
  d.appendChild(b);
  d.open=!!opt.open;
  return d;
}
/* v4：数据从哪来卡片（pages.js） */
function appendDataSource(container){
  if(!container) return;
  if(typeof GuanchaoPages==='undefined' || !GuanchaoPages || typeof GuanchaoPages.renderDataSource!=='function') return;
  var box=el('div','');
  try{ GuanchaoPages.renderDataSource(box, { extraNote: '导入时会自动体检：天数不够、缺天、重复、连续为零、异常尖峰都会当场提示。' }); }catch(e){ return; }
  container.appendChild(box);
}
function secHeader(title, sub){
  return el('div','sec','<h2>'+esc(title)+'</h2>'+(sub?'<span class="sec-sub">'+esc(sub)+'</span>':''));
}

/* ================= 总览：各区块 ================= */
function secHero(r, meta){
  var S=r.summary||{};
  var M=meta.m;
  var orders = meta.kind==='lead' ? (S.totalValue/meta.price) : S.totalInc;
  var d0=firstDate(r), d1=lastDate(r);
  var range = (d0&&d1) ? (fmtDay(d0)+'–'+fmtDay(d1)) : '';
  var sec=el('section','card hero card-float');
  sec.id='card-hero';
  sec.innerHTML=
    '<div class="hero-top">'+
      '<span class="hero-badge">'+esc(meta.kindLabel)+'</span>'+
      '<span class="hero-meta">'+esc(meta.name)+(range?(' · '+range):'')+' · '+fmtInt(S.noteCount)+' 篇笔记</span>'+
    '</div>'+
    '<div class="hero-main">'+
      '<div class="hero-big">'+
        '<div class="hero-big-label">种草一共多带来</div>'+
        '<div class="hero-big-num num"><span class="count">0</span><span class="unit">个'+esc(M)+'</span></div>'+
        '<div class="hero-big-sub">'+(meta.kind==='lead'
            ? ('预计转化 <b>'+fmt1(orders)+'</b> 单 · 约 <b>'+fmtWan(S.totalValue)+'</b> 生意')
            : ('直接成交 <b>'+fmtInt(S.totalInc)+'</b> 单 · 约 <b>'+fmtWan(S.totalValue)+'</b> 生意'))+'</div>'+
      '</div>'+
      '<div class="hero-minis">'+
        '<div class="mini"><div class="mini-num num">'+fmtPct(S.outShare)+'%</div><div class="mini-label">站外成交占</div></div>'+
        '<div class="mini"><div class="mini-num num">'+fmt2(S.roiReal)+'<small> 元/1元</small></div><div class="mini-label">投流真实回报</div></div>'+
        '<div class="mini"><div class="mini-num num">'+fmtInt(S.real)+'<small>/'+fmtInt(S.noteCount)+'</small></div><div class="mini-label" data-no-glossary>真有效笔记</div></div>'+
      '</div>'+
    '</div>';
  var target=Math.round(num(S.totalInc)?S.totalInc:0);
  /* v10：渲染横幅时就重新跑滚动动画（countUp 先落目标值再从 0 动画） */
  var c0=sec.querySelector('.count');
  if(c0) countUp(c0,target);
  return sec;
}

/* ---- 待办 ---- */
function buildTodos(r, meta){
  var S=r.summary||{}, M=meta.m, items=[];
  var bud=safeBudget(r);
  var spendTxt = (bud&&bud.cStar!=null) ? ' '+fmtMoney(bud.cStar) : '';

  /* 1. 在投/近期笔记红绿灯 */
  var live=(r.live||[]).filter(function(n){ return n && n.p!=null; });
  live.sort(function(a,b){ return (b.total||0)-(a.total||0); });
  var liveCount=0;
  live.some(function(n){
    if(liveCount>=2) return true;
    var d1=(r.y && r.y[n.p]!=null)? r.y[n.p] : null;
    var d2=(r.y && r.y[n.p+1]!=null)? r.y[n.p+1] : null;
    var col='yellow', li=null;
    if(d1!=null && d2!=null && typeof r.light==='function'){
      try{
        li=r.light(String(n.date||''), d1, d2);
        if(typeof li==='string'){ col=li; li=null; }
        else if(li && typeof li==='object'){ col=String(li.color||'yellow'); }
        else { col='yellow'; li=null; }
      }catch(e){ warn('r.light 调用失败: '+e.message); }
    } else { warn('live 笔记「'+nTitle(n)+'」只有第一天数据，跳过红绿灯'); }
    liveCount++;
    var jt={label:'看红绿灯 →', target:{type:'tab', id:'invest'}};
    var exTxt=(li && num(li.ex)) ? fmt1(li.ex) : '—';
    if(col==='green'){
      var rankTxt='';
      if(li && num(li.rank) && li.rank<=3){
        var beaten=(li.hist||[]).filter(function(h){ return (h.ex2||0) < li.ex; }).length;
        rankTxt='，开局比历史上 '+beaten+' 篇笔记都好';
      }
      items.push({ icon:'bolt', color:'red', title:'今天给「'+nTitle(n)+'」投流'+spendTxt,
        desc:'发布 2 天已明显跑赢平时（多出 +'+exTxt+' 个'+esc(M)+'）；按本店历史，给这类笔记投流去水分后仍高于保本线'+rankTxt, jump:jt, inPack:true });
    }else if(col==='yellow'){
      items.push({ icon:'eye', color:'yellow', title:'「'+nTitle(n)+'」再观察一天',
        desc:'前两天多出 +'+exTxt+' 个，还在正常波动内，可能是运气；明天仍高于平时再投', jump:jt, inPack:true });
    }else{
      items.push({ icon:'ban', color:'red', title:'先别给「'+nTitle(n)+'」投流',
        desc:'前两天没跑赢平时；给没起来的笔记投流，本店历史上基本没效果。建议改标题或封面后重发', jump:jt, inPack:true });
    }
    return false;
  });

  /* 2. 最弱的选题方向 */
  var types=(r.types||[]).filter(function(t){ return t && t.type; });
  if(types.length>=2){
    var tv=function(t){ return pickNum(t,'value','avg','inc','mean','total')||0; };
    var top=types[0], weak=types[types.length-1];
    if(tv(top)>0 && tv(weak) < 0.3*tv(top)){
      items.push({ icon:'pause', color:'gray', title:'暂停「'+esc(weak.type)+'」类内容',
        desc:'最近效果不到「'+esc(top.type)+'」的三成，先别再写。', jump:{label:'看内容分析 →', target:{type:'tab', id:'notes'}} });
    }
  }

  /* 3. 没跑起来的投流 */
  var bad=(r.notes||[]).filter(function(n){ return n.boost && (n.boost.verdict==='none'||n.boost.verdict==='loss'); });
  bad.sort(function(a,b){ return (b.boost.cost||0)-(a.boost.cost||0); });
  if(bad.length){
    items.push({ icon:'down', color:'red', title:'别再给没跑起来的笔记投流',
      desc:'「'+nTitle(bad[0])+'」投了 '+fmtMoney(bad[0].boost.cost)+'，去水分后没看到额外效果', jump:{label:'看去水分 →', target:{type:'scroll', sel:'#sec-boost'}} });
  }

  /* 4. 本周写什么 */
  if(types.length){
    items.push({ icon:'pen', color:'blue', title:'本周写一篇「'+esc(types[0].type)+'」',
      desc:'这是最近最能带来'+esc(M)+'的选题方向。', jump:{label:'让 AI 帮选题 →', target:{type:'tab', id:'ai'}}, inPack:true });
  }

  /* 5. 站外渠道 */
  var osp=toPct(S.outShare);
  if(osp!=null && osp>=30){
    items.push({ icon:'compass', color:'blue', title:'复盘时把「'+esc(meta.outCh)+'」的数据一起算',
      desc:'站外成交占 '+fmtInt(osp)+'%，只看站内就漏掉了这部分。', jump:{label:'看全域账 →', target:{type:'scroll', sel:'#card-funnel'}} });
  }

  /* 6. 对照实验 */
  items.push({ icon:'flask', color:'yellow', title:'这个月做一次投流对照实验',
    desc:'同类笔记一半投、一半不投，才能把投流的真实效果测准', jump:{label:'看实施方案 →', target:{type:'tab', id:'invest'}} });

  return items.slice(0,6);
}
function secTodos(r, sample, meta){
  var items=buildTodos(r, meta);

  /* 行动包（agent.js）：标题 / 日期 / 草稿 / 采纳 / 计数 / 全部完成横条 / 其他提醒折叠都由模块负责 */
  if(typeof GuanchaoAgent!=='undefined' && GuanchaoAgent && typeof GuanchaoAgent.renderActionPack==='function'){
    var others=items.filter(function(it){ return !it.inPack; }).map(function(it){
      return { title:it.title, desc:it.desc, btnText:it.jump.label,
        onClick:function(){ goJump(it.jump.target); } };
    });
    var sec=el('section','');
    sec.id='card-todo';
    GuanchaoAgent.renderActionPack(sec, {
      r:r, sample:sample, others:others,
      onSupplement:openScreenshotSupplement,
      onJump:function(kind, item){
        if(kind==='boost'||kind==='hold'){
          /* v11：跳到该不该投后，自动展开「这个灯是怎么判的」 */
          INV.explain=true;
          switchTab('invest');
          goJump({ type:'scroll', sel:'#card-light' });
        }
        else if(kind==='content'){
          /* v10：跳到笔记明细页的「什么内容最带货」卡片 */
          switchTab('notes');
          goJump({ type:'scroll', sel:'#card-types' });
        }
        else if(kind==='negotiate'){
          if(state.importMode || state.tab!=='overview'){ switchTab('overview'); }
          var kolName=(item && item.data && item.data.kol) || null;
          if(typeof GuanchaoExtras!=='undefined' && typeof GuanchaoExtras.highlightKol==='function' && kolName){
            try{ expandWrap(document.querySelector('#sec-kol')); }catch(e){}
            try{ GuanchaoExtras.highlightKol(kolName); }catch(e){}
            goJump({ type:'scroll', sel:'#sec-kol' });
            return;
          }
          goJump({ type:'scroll', sel:'#sec-kol' });
        }
        else if(kind==='report'){
          /* v11：跳到总览总账卡片，并自动展开「这 N 个是怎么加出来的」表 */
          if(state.importMode || state.tab!=='overview'){ switchTab('overview'); }
          LEDGER_EXP.shop=state.shop; LEDGER_EXP.open=true;
          goJump({ type:'scroll', sel:'#card-ledger-w' });
          setTimeout(function(){ renderInner(); }, 60);
        }
      }
    });
    return sec;
  }

  /* 兜底：agent.js 未加载时退回旧版今日待办 */
  var t=(function(){ var l=lastDate(r); return l? addDays(l,1): null; })();
  var l=lastDate(r);
  var sec=el('section','card card-float');
  sec.id='card-todo';
  sec.innerHTML=
    '<div class="todo-head">'+
      '<div><h2>今天该做的 '+items.length+' 件事</h2>'+
      '<div class="todo-sub">'+(t?fmtDayWeek(t):'今天')+' · 数据截至 '+(l?fmtDay(l):'—')+'，做完一件勾一件</div></div>'+
      '<span class="todo-badge">'+items.length+' 件待办</span>'+
    '</div>';
  items.forEach(function(it,i){
    var key=state.shop+':'+state.tab+':'+i;
    var row=el('div','todo-item'+(state.checked[key]?' done':''));
    row.innerHTML=
      '<button class="todo-check'+(state.checked[key]?' done':'')+'" aria-label="标记完成">'+ICONS.check+'</button>'+
      '<span class="todo-ic ic-'+it.color+'">'+ICONS[it.icon]+'</span>'+
      '<div class="todo-body"><div class="todo-title">'+it.title+'</div><div class="todo-desc">'+it.desc+'</div></div>'+
      '<button class="todo-jump" data-jump=\'1\'>'+it.jump.label+'</button>';
    row.querySelector('.todo-check').addEventListener('click',function(){
      state.checked[key]=!state.checked[key];
      row.classList.toggle('done', state.checked[key]);
      this.classList.toggle('done', state.checked[key]);
    });
    var btn=row.querySelector('.todo-jump');
    btn.addEventListener('click',function(){ goJump(it.jump.target); });
    sec.appendChild(row);
  });
  return sec;
}

/* ---- 截图补录（agent.js） ---- */
function openScreenshotSupplement(){
  if(typeof GuanchaoAgent==='undefined' || !GuanchaoAgent || typeof GuanchaoAgent.openSupplement!=='function'){ toast('补录组件未加载'); return; }
  var key=state.shop;
  /* v6：补录基于存里的原始样本；「调整假设」只是内存覆盖 */
  var s=getRawSample(key);
  if(!s){ toast('当前店铺没有数据'); return; }
  GuanchaoAgent.openSupplement({
    sample:s,
    shopKey:key,
    demo:(typeof SCREENSHOT_DEMO!=='undefined') ? SCREENSHOT_DEMO : null,
    demoImage:'demo.png',
    switchShop:function(k){
      key=k;
      if(state.view!=='merchant'){ setView('merchant'); }
      state.tab='overview';
      selectShop(k);
      if(state.view==='manager'){ renderManager(); }
      return getRawSample(k);
    },
    onConfirm:function(newSample){
      try{ SAMPLES[key]=newSample; }catch(e){}
      delete SETTING_OVR[key]; OVR_STAMP++;
      state.tab='overview';
      selectShop(key);
      if(state.view==='manager'){ renderManager(); }
    },
    onUndo:function(oldSample){
      try{ SAMPLES[key]=oldSample; }catch(e){}
      delete SETTING_OVR[key]; OVR_STAMP++;
      render();
      if(state.view==='manager'){ renderManager(); }
    }
  });
}

/* 导入页顶部的截图补录入口卡 */
function renderSuppEntry(){
  var sec=el('section','card imp-card card-float');
  sec.innerHTML=
    '<h2 class="imp-title">截图补录：把后台截图拖进来，AI 帮你录数据</h2>'+
    '<p class="imp-sub">商家每周把后台数据截图拖进来，AI 识别出数字，账本自动重算</p>'+
    '<div class="imp-btns"><button type="button" class="btn-main imp-supp-go">补录本周数据</button></div>';
  sec.querySelector('.imp-supp-go').addEventListener('click', openScreenshotSupplement);
  return sec;
}

/* ---- 故事卡 ---- */
function secStory(r, meta){
  var S=r.summary||{}, M=meta.m;
  var mis=null;
  (r.notes||[]).some(function(n){ if(n.misjudged){ mis=n; return true; } return false; });
  var be=(r && typeof r.be==='number')? r.be : null;
  var bud=safeBudget(r);
  var wrap=el('div');
  wrap.appendChild(secHeader('30 秒看懂这家店','三个视角，点卡片跳到对应的账'));
  var row=el('div','story-row');

  function card(opt){
    var c=el('div','card story card-float');
    c.innerHTML='<span class="story-step '+opt.stepCls+'">'+opt.step+'</span>'+
      '<h3>'+opt.title+'</h3>'+
      '<div class="story-num num '+opt.numCls+'">'+opt.num+'</div>'+
      '<div class="story-text">'+opt.text+'</div>'+
      '<span class="story-link" data-no-glossary>'+opt.link+' →</span>';
    c.addEventListener('click',function(){ goJump(opt.target); });
    return c;
  }
  row.appendChild(card({
    step:'1', stepCls:'st-red', title:'全域成交',
    num:fmtPct(S.outShare)+'<span class="unit">%</span>', numCls:'',
    text:'的'+esc(M)+'发生在「'+esc(meta.outCh)+'」'+(mis?('；「'+nTitle(mis)+'」只看站内像巧合，算上站外才看清。'):'。'),
    link:'看全域账', target:{type:'scroll', sel:'#card-funnel'}
  }));
  var beTxt=(be==null)?null:fmt2(be);
  var s2Text;
  if(be==null){ s2Text=''; }
  else if(num(S.roiSeen) && num(S.roiReal) && S.roiSeen>=be && S.roiReal<be){
    s2Text='投流看着赚，去水分后其实没回本（保本线 '+beTxt+' 元）';
  }
  else if(num(S.roiSeen) && num(S.roiReal) && S.roiReal>0){
    s2Text='每花 1 元的真实回报被高估了 '+Math.round((S.roiSeen/S.roiReal-1)*100)+'%，去水分后仍高于保本线 '+beTxt+' 元';
  }
  else if(num(S.roiReal)){ s2Text=(S.roiReal>=be ? '去掉水分后仍高于保本线 '+beTxt+' 元，投流是划算的。' : '低于保本线 '+beTxt+' 元，投流要更挑笔记。'); }
  else { s2Text=''; }
  row.appendChild(card({
    step:'2', stepCls:'st-orange', title:'投流去水分',
    num:(num(S.roiSeen)?('<s>'+fmt2(S.roiSeen)+'</s><span class="arr">→</span>'):'')+fmt2(S.roiReal)+'<span class="unit"> 元/1元</span>',
    numCls:'',
    text:s2Text,
    link:'看去水分', target:{type:'scroll', sel:'#sec-boost'}
  }));
  row.appendChild(card({
    step:'3', stepCls:'st-green', title:'下个月怎么做',
    num:(bud&&bud.Bstar!=null? fmtMoney(bud.Bstar):'—'),
    numCls:'',
    text:'建议的下月投流总预算'+(bud&&bud.cStar!=null?('，每篇配 '+fmtMoney(bud.cStar)):'')+'。',
    link:'看预算方案', target:{type:'tab', id:'budget'}
  }));
  wrap.appendChild(row);
  return wrap;
}

/* v11：总账「这 N 个是怎么加出来的」展开状态（按店记忆） */
var LEDGER_EXP={ shop:'', open:false };
/* ---- 总账 + 全域账 ---- */
function secCols(r, meta, sample){
  var S=r.summary||{}, M=meta.m;
  /* v6：稳健性（换 3 种算法不变的比例） */
  var LEC=(typeof LedgerEngine!=='undefined')?LedgerEngine:null;
  var rb=(LEC && typeof LEC.robustness==='function')? getRobust(r) : null;
  var rbHtml='';
  if(rb && num(rb.robustCount) && num(rb.total)){
    rbHtml='<p class="ledger-rb"><b class="num">'+fmtInt(rb.robustCount)+'/'+fmtInt(rb.total)+'</b> 篇的结论换 3 种算法都不变</p>';
  }
  var S=r.summary||{}, M=meta.m;
  var chans=resolveChannels(r, meta);
  var a=chAmts(S.incByCh, chans, meta);
  var tot=a.inSum+a.outSum;
  var inPct=tot>0? Math.round(a.inSum/tot*100):0, outPct=tot>0? Math.round(a.outSum/tot*100):0;
  if(!tot) warn('S.incByCh 解析为 0');
  var orders=meta.kind==='lead'? (S.totalValue/meta.price): S.totalInc;
  var boosted=(r.notes||[]).filter(function(n){ return n.boost; }).length;
  var inName=chName(chans,'in',meta), outName=chName(chans,'out',meta);

  var wrap=el('div','cols');

  var leftIn=el('section','card col-card');
  leftIn.id='card-ledger';
  leftIn.innerHTML=
    '<div class="h2-row"><h2>总账</h2><span class="h2-sub">这期间种草一共带来什么</span></div>'+
    '<p class="ledger-sum">'+fmtInt(S.noteCount)+' 篇笔记（'+fmtInt(boosted)+' 篇投流）一共多带来 <b>'+fmtInt(S.totalInc)+'</b> 个'+esc(M)+'，'+
      (meta.kind==='lead'? ('预计 <b>'+fmt1(orders)+'</b> 单，'):('直接成交 <b>'+fmtInt(S.totalInc)+'</b> 单，'))+
      '约 <b>'+fmtWan(S.totalValue)+'</b> 生意</p>'+
    '<div class="prop-bar"><span class="in" style="width:'+inPct+'%"></span><span class="out" style="width:'+outPct+'%"></span></div>'+
    '<div class="prop-legend">'+
      '<span><i class="dot d-in"></i>'+esc(inName)+' '+fmtInt(a.inSum)+' · '+inPct+'%</span>'+
      '<span><i class="dot d-out"></i>'+esc(outName)+' '+fmtInt(a.outSum)+' · '+outPct+'%</span>'+
    '</div>'+
    '<div class="stats3">'+
      '<div class="stat"><label>多带来'+esc(M)+'</label><b class="num">'+fmtInt(S.totalInc)+'</b></div>'+
      '<div class="stat"><label>投流总花费</label><b class="num">'+fmtMoney(S.boostCost)+'</b></div>'+
      '<div class="stat"><label>投流真实回报</label><b class="num">'+fmt2(S.roiReal)+'<span class="unit"> 元/1元</span></b></div>'+
    '</div>'+rbHtml;

  /* v11：「这 N 个是怎么加出来的」展开：逐篇表 + 步骤 */
  var LEC=(typeof LedgerEngine!=='undefined')?LedgerEngine:null;
  var lxOpen=!!(LEDGER_EXP.shop===state.shop && LEDGER_EXP.open);
  var lxToggle=el('button','tx-toggle', '这 '+fmtInt(S.totalInc)+' 个是怎么加出来的 ▾');
  lxToggle.classList.toggle('open', lxOpen);
  var lxBox=el('div','tx-expand lg-exp');
  lxBox.classList.toggle('show', lxOpen);
  lxToggle.addEventListener('click', function(){
    LEDGER_EXP.open=!lxOpen;
    LEDGER_EXP.shop=state.shop;
    renderInner();
  });
  if(lxOpen && LEC && typeof LEC.explainTotal==='function'){
    var lt=null;
    try{ lt=LEC.explainTotal(r); }catch(e){}
    if(lt){
      var rows=lt.rows||[];
      var trs='';
      rows.forEach(function(n){
        var vc=NT_VC[n.verdict]||NT_VC.none;
        var boostCol;
        if(n.boostMerged) boostCol='分不开';
        else if(n.boostReal!=null) boostCol=fx1s(n.boostReal);
        else boostCol='—';
        trs+='<tr>'+
          '<td class="lg-t" title="'+esc(n.title)+'">'+esc(n.title)+'</td>'+
          '<td class="num">'+esc(fmtDayMD(n.date))+'</td>'+
          '<td><span class="nt-verdict" style="color:'+vc+';background:'+vc+'1F">'+esc(n.verdictLabel)+'</span></td>'+
          '<td class="num">'+fx1s(n.total)+'</td>'+
          '<td class="num">'+boostCol+'</td>'+
        '</tr>';
      });
      var lxTable=el('table','lg-table');
      lxTable.innerHTML=
        '<thead><tr><th>笔记</th><th>日期</th><th>结论</th><th>多出的量</th><th>其中投流带来</th></tr></thead>'+
        '<tbody>'+trs+'</tbody>'+
        '<tfoot><tr><td colspan="4">合计</td><td class="num"><b>'+fmtInt(lt.totalInc)+'</b></td></tr></tfoot>';
      var lxScroll=el('div','lg-scroll');
      lxScroll.appendChild(lxTable);
      lxBox.appendChild(lxScroll);
      if(lt.steps && lt.steps.length) lxBox.appendChild(expStepsList(lt.steps));
    }
  }
  leftIn.appendChild(lxToggle);
  leftIn.appendChild(lxBox);

  /* v6：调整假设（assumptions.js）——只在内存里改，刷新页面恢复默认 */
  if(typeof GuanchaoAssumptions!=='undefined' && GuanchaoAssumptions && typeof GuanchaoAssumptions.render==='function'){
    var asmBox=el('div','gc-asm');
    leftIn.appendChild(asmBox);
    var rawS=getRawSample(state.shop);
    var defSet=(rawS && rawS.settings) || (sample && sample.settings) || {};
    try{
      GuanchaoAssumptions.render(asmBox, {
        sample: sample,
        defaults: defSet,
        r: r,
        onChange: function(st){
          SETTING_OVR[state.shop]=st;
          OVR_STAMP++;
          render();
          if(state.view==='manager'){ renderManager(); }
        }
      });
    }catch(e){}
  }
  var left=wrapCollapse({
    id:'card-ledger-w', title:'总账', sub:'这期间种草一共带来什么',
    key:'多带来 '+fmtInt(S.totalInc)+' 个'+esc(M)+' · 约 '+fmtWan(S.totalValue)+' 生意'
  });
  left.querySelector('.col-body').appendChild(leftIn);
  wrap.appendChild(left);

  var rightIn=el('section','card col-card');
  rightIn.id='card-funnel';
  var notes=(r.notes||[]).slice().sort(function(x,y){ return (y.total||0)-(x.total||0); }).slice(0,7);
  if(!notes.length){ rightIn.appendChild(el('div','empty-tip','没有笔记数据。')); }
  notes.forEach(function(n){
    var ca=chAmts(n.byCh, chans, meta);
    var nt=ca.inSum+ca.outSum;
    var ip=nt>0? Math.round(ca.inSum/nt*100):null;
    var item=el('div','fn-item');
    item.innerHTML=
      '<div class="fn-head"><span class="fn-title">'+nTitle(n)+'</span>'+
        '<span class="fn-inc num">+'+fmtInt(n.total)+'</span></div>'+
      (n.misjudged? '<span class="fn-tag" data-no-glossary>只看站内：可能是巧合 → 算上站外：真有效</span>':'')+
      (ip!=null? ('<div class="fn-bars"><span class="in" style="width:'+ip+'%;background:#FF2442"></span><span class="out" style="width:'+(100-ip)+'%;background:#4C6FFF"></span></div>'):'')+
      (nt>0? ('<div class="fn-ch">'+esc(inName)+' '+fmtInt(ca.inSum)+' · '+esc(outName)+' '+fmtInt(ca.outSum)+'</div>'):'');
    rightIn.appendChild(item);
  });
  var right=wrapCollapse({
    id:'card-funnel-w', title:'全域账', sub:'成交在哪都算 · 前 7 篇',
    key: outPct+'% 在'+esc(outName)+'成交'
  });
  right.querySelector('.col-body').appendChild(rightIn);
  wrap.appendChild(right);
  return wrap;
}

/* ---- v14：证据胶囊「估算级 · 稳健 · 可信度中」（GuanchaoExtras.evidencePill，缺模块时本地兜底） ---- */
function noteGrade(n){
  if(n && n.live) return '进行中';
  return (n && (n.exp_group || n.evidence==='experiment-pending')) ? '实验级' : '估算级';
}
function evPillHtml(o){
  var GX=(typeof GuanchaoExtras!=='undefined')?GuanchaoExtras:null;
  if(GX && typeof GX.evidencePill==='function'){ try{ return GX.evidencePill(o); }catch(e){} }
  var parts=[o.grade||'估算级'];
  if(o.robust===true) parts.push('稳健'); else if(o.robust===false) parts.push('换算法会变');
  if(o.conf && o.conf.label) parts.push('可信度'+o.conf.label);
  var txt=esc(parts.join(' · '));
  return o.explain ? '<button type="button" class="gx-ev" data-explain="'+esc(o.explain)+'" title="点开看这笔账怎么算的">'+txt+'</button>' : '<span class="gx-ev">'+txt+'</span>';
}
/* 胶囊点开「这笔账怎么算的」抽屉：按笔记在 r.notes 里的序号 */
function noteIndexOf(r, n){ return (r && r.notes) ? r.notes.indexOf(n) : -1; }
function bindEvPill(root, r, meta, i){
  if(!root || i<0) return;
  var p=root.querySelector('.gx-ev[data-explain]');
  if(!p) return;
  p.addEventListener('click', function(ev){ ev.stopPropagation(); exdOpen(r, meta, i); });
}

/* ---- 投流去水分 ---- */
var BOOST_TAGS={
  worth:  { cls:'tag-worth',   ic:'✓', label:'值回票价' },
  loss:   { cls:'tag-loss',    ic:'✕', label:'亏了' },
  unclear:{ cls:'tag-unclear', ic:'?', label:'算不准' },
  none:   { cls:'tag-none',    ic:'⊘', label:'没效果' },
  merged: { cls:'tag-merged',  ic:'⇉', label:'合并评估' }
};
function boostCard(n, meta, r){
  var b=n.boost, M=meta.m;
  var merged=(b.verdict==='merged')||b.merged;
  var tag=BOOST_TAGS[b.verdict]||BOOST_TAGS.unclear;
  if(!BOOST_TAGS[b.verdict]) warn('未知 boost.verdict: '+b.verdict);
  /* v6：同日投流给区间 */
  var R=(merged && b.range && num(b.range.lo)!=null && num(b.range.hi)!=null)? b.range : null;
  if(merged && R) tag={ cls:'tag-range', ic:'≈', label:'区间估计' };
  var d0=parseDate(b.from||b.start||b.begin), d1=parseDate(b.to||b.end||b.finish);
  var GX=(typeof GuanchaoExtras!=='undefined')?GuanchaoExtras:null;
  var LEC=(typeof LedgerEngine!=='undefined')?LedgerEngine:null;
  /* v14：估算级 + 可信度 合成一个灰色胶囊，点开看这笔账怎么算的 */
  var bConf=null;
  if(!merged && LEC && typeof LEC.confidence==='function'){
    try{ bConf=LEC.confidence(b.real, b.band); }catch(e){}
  }
  var bIdx=noteIndexOf(r, n);
  var evHtml=evPillHtml({ grade:noteGrade(n), conf:bConf, explain:(bIdx>=0? (n.title||String(bIdx)) : null) });
  var c=el('div','card boost-card card-float');
  var html=
    '<div class="boost-head"><div class="boost-title" title="'+nTitle(n)+'">'+nTitle(n)+'</div>'+
      '<span class="boost-tags"><span class="tag '+tag.cls+'"><i>'+tag.ic+'</i>'+tag.label+'</span>'+evHtml+'</span></div>'+
    '<div class="boost-meta">'+((d0&&d1)?('投流 '+fmtDay(d0)+'–'+fmtDay(d1)+' · '):'')+'花费 '+fmtMoney(b.cost)+'</div>';
  if(!merged && num(b.seen) && b.seen>0){
    var oPct=Math.max(0, Math.min(100, Math.round((b.expectedOrganic||0)/b.seen*100)));
    html+=
      '<div class="boost-formula num">看起来多了 <b>'+fmt1(b.seen)+'</b> <span class="op">=</span> 本来就会来 <b>'+fmt1(b.expectedOrganic)+'</b> <span class="op">+</span> 投流真贡献 <b class="rp">'+fmt1(b.real)+'</b></div>'+
      '<div class="boost-bar"><span class="organic" style="width:'+oPct+'%"></span><span class="real" style="width:'+(100-oPct)+'%"></span></div>'+
      '<div class="boost-legend"><span><i class="lo"></i>本来就会来 '+oPct+'%</span><span><i class="lr"></i>投流真贡献 '+(100-oPct)+'%</span></div>'+
      '<div class="gx-boost-slot"></div>';
  } else if(!merged){
    html+='<div class="boost-formula num">投流期间整体<b>低于自然基线</b>，没有可拆的增量</div>';
  }
  var advice;
  if(merged && R){
    advice='发布当天就开始投流，自然流量和投流分不开，只能给区间：投流贡献在 '+fmtInt(R.lo)+'～'+fmtInt(R.hi)+' 个'+esc(M)+'之间（下限按'+esc(R.basis)+' '+fmtInt(R.ref)+' 个扣除）。';
    if(num(b.roiLo)!=null && num(b.roiHi)!=null) advice+='每 1 元换回 '+fmt2(b.roiLo)+'～'+fmt2(b.roiHi)+' 元。';
    if(b.rangeVerdict==='worth') advice+='区间下限也高于保本线：值得投';
    else if(b.rangeVerdict==='loss') advice+='区间上限都低于保本线：亏了';
    else advice+='区间跨过保本线，说不清。下次先自然发 2 天再投，就能算清。';
  }
  else if(merged){
    advice='发布和投流同一天开始，分不清哪些是自然流量、哪些是投流带来的，合计多了 +'+fmt1(b.seen)+' 个。下次先自然发 2 天再投，就能算清。';
  } else if(b.verdict==='worth'){
    advice='去掉水分，投流真贡献 '+fmt1(b.real)+' 个'+esc(M)+'，'+fmtMoney(b.cost)+' 花得值，可以继续投。';
  } else if(b.verdict==='loss'){
    advice='真贡献只有 '+fmt1(b.real)+' 个'+esc(M)+'，抵不回 '+fmtMoney(b.cost)+' 的成本，建议停投。';
  } else if(b.verdict==='none'){
    advice='投流期间没有超出自然基线，'+fmtMoney(b.cost)+' 基本没溅起水花，别续了。';
  } else {
    advice='投流多出的 +'+fmt1(b.real)+' 个还在正常波动范围内（±'+fmt1(b.band)+'），数据太少，说不清是投流的功劳还是运气，先别加钱。';
  }
  html+='<div class="boost-advice">'+advice+'</div>';
  c.innerHTML=html;
  bindEvPill(c, r, meta, bIdx);
  /* 去水分小图：挂进 DOM 后由 renderOverview 统一按真实宽度绘制 */
  var slot=c.querySelector('.gx-boost-slot');
  if(slot && !merged && GX && LEC && typeof LEC.boostSeries==='function' && typeof GX.boostChart==='function'){
    try{ slot._series=LEC.boostSeries(r, n); }catch(e){}
  }
  return c;
}
function boostKeyText(r){
  var S=(r && r.summary)||{};
  if(num(S.roiSeen) && num(S.roiReal)) return '看起来 '+fmt2(S.roiSeen)+' → 去水分后 '+fmt2(S.roiReal)+' 元/1元';
  if(num(S.roiReal)) return '去掉水分后真实回报 '+fmt2(S.roiReal)+' 元/1元';
  if(num(S.boostCost)) return '这期间投流共 '+fmtMoney(S.boostCost);
  return '点开看怎么拆';
}
function secBoost(r, meta){
  var wrap=wrapCollapse({
    id:'sec-boost', title:'投流去水分', sub:'看起来多了 ≠ 投流的功劳：拆掉「本来就会来」的部分',
    key: boostKeyText(r)
  });
  var body=wrap.querySelector('.col-body');
  var boosted=(r.notes||[]).filter(function(n){ return n.boost; });
  if(!boosted.length){
    body.appendChild(el('div','card empty-tip card-float','这家店这期间没投过流。想看去水分的逻辑，切到另一家示例店试试。'));
  } else {
    var grid=el('div','boost-grid');
    boosted.forEach(function(n){ grid.appendChild(boostCard(n, meta, r)); });
    body.appendChild(grid);
  }
  return wrap;
}

/* ---- 为什么需要观潮（静态） ---- */
function secTimeline(useCollapse){
  var sec=el('section','card card-float');
  sec.innerHTML=
    '<div class="h2-row"><h2>为什么需要观潮</h2><span class="h2-sub">种草度量这件事，走到了哪一步</span></div>'+
    '<div class="timeline">'+
      '<div class="tl-item"><span class="tl-dot"></span><div class="tl-when">2022</div><div class="tl-title">小红星（与阿里妈妈合作）</div><div class="tl-text">统计达人种草给淘宝店铺带来的访客，第一次尝试把站外效果算回来</div></div>'+
      '<div class="tl-item"><span class="tl-dot"></span><div class="tl-when">2023</div><div class="tl-title">种草值 TrueInterest · 小红盟（与京东合作）</div><div class="tl-text">种草值用长时间阅读、搜索商品词等 11 类深度行为衡量种草；小红盟把京东的站外成交数据回传，所有类目按 50% 抽样</div></div>'+
      '<div class="tl-item"><span class="tl-dot"></span><div class="tl-when">2025</div><div class="tl-title">种草直达（红猫、红京、红美计划）</div><div class="tl-text">广告笔记可以挂链接跳到淘宝、京东等平台成交，订单回传；据报道，双 11 使用的商家数比 618 增长 109%</div></div>'+
      '<div class="tl-item"><span class="tl-dot"></span><div class="tl-when">2025 年 12 月</div><div class="tl-title">WILL 商业大会</div><div class="tl-text">种草进入"效果化"时代，灵犀全量开放，提出"人群资产、内容效率、转化效果"三维度量</div></div>'+
      '<div class="tl-item tl-yellow"><span class="tl-dot"></span><div class="tl-when">还缺的一块</div><div class="tl-title">中小商家仍然算不清的账</div><div class="tl-text">据 2025 年报道，种草直达只支持广告笔记跳转，普通笔记带去站外的生意追踪不到；投流期间的增长里有多少本来就会来，需要剔除干扰；中小商家需要零门槛、用自己的数据就能用的工具</div></div>'+
      '<div class="tl-item tl-red"><span class="tl-dot"></span><div class="tl-when">观潮</div><div class="tl-title">给中小商家的轻量补充</div><div class="tl-text">用商家自己的站内、站外每日数据，估算每篇普通笔记的全域增量，并给投流去水分；算得清，商家才敢持续种草，品牌与平台双赢</div></div>'+
    '</div>'+
    '<div class="tl-foot">以上信息整理自界面新闻、数英、经济观察网、第一财经等公开报道，具体规则以小红书官方为准。</div>';
  if(!useCollapse) return sec;
  var w=wrapCollapse({
    id:'sec-why', title:'为什么需要观潮', sub:'种草度量这件事，走到了哪一步',
    key:'中小商家仍然算不清的账'
  });
  w.querySelector('.col-body').appendChild(sec);
  return w;
}

/* ---- 方法论折叠（静态） ---- */
function howInnerHTML(){
  return ''+
    '<p class="how-lede">像看潮水：每天自然涨落是<b>基线</b>，笔记是掀起的大浪——<b>浪高过基线的部分</b>，才算笔记真带来的量。</p>'+
    '<div class="step"><span class="step-n num">1</span><div class="step-t"><b>量潮位</b>：用没发笔记的日子，估计每天自然来的量（基线）。</div></div>'+
    '<div class="step"><span class="step-n num">2</span><div class="step-t"><b>数浪高</b>：发布后 7 天，实际量减去基线就是增量；但平时也有涨落，只有明显超出正常波动（约 95% 把握）才算"真有效"</div></div>'+
    '<div class="step"><span class="step-n num">3</span><div class="step-t"><b>站外也数</b>：站外渠道的增量也一起算，不只看站内</div></div>'+
    '<div class="step"><span class="step-n num">4</span><div class="step-t"><b>投流去水分</b>：「看起来多了」拆成「本来就会来」和「投流真贡献」。</div></div>'+
    '<div class="step"><span class="step-n num">5</span><div class="step-t"><b>红绿灯</b>：发布后两天的走势，决定这篇值不值得追投。</div></div>'+
    '<p class="how-be"><b>保本线</b>：每花 1 元投流至少要换回多少生意才不亏（毛利的倒数）。保本线按毛利率计，未计人工、房租等固定成本；商家可按自身情况上调。</p>'+
    '<p class="how-why-sim">为什么用模拟数据检验：只有模拟数据才知道每篇笔记的真实效果，才能核对算法有没有算准。</p>'+
    '<p class="how-conf">可信度：结论超出正常波动 2 倍以上为高，1～2 倍为中，不到 1 倍为低</p>'+
    '<p class="how-rb">稳健性检验：每个结论都用 3 种不同假设再算一遍（观察期改为 5 天、去掉长期趋势、不调星期规律），结论不变才标"稳健"。在模拟检验中，标"稳健"的结论准确率约 89%，没标的约 61%。</p>'+
    '<div class="how-stats">'+
      '<div class="how-stat"><b class="num">≈7%</b><span>把平静日子误判成有浪的比例（目标 5% 以内）</span></div>'+
      '<div class="how-stat"><b class="num">≈9 成</b><span>真实增量能被识别出来的比例</span></div>'+
      '<div class="how-stat"><b>宁少勿多</b><span>投流贡献的估计偏保守，宁可少报</span></div>'+
    '</div>'+
    '<p class="how-note">这些数是估算，不是实验结论——所以我们这样处理：<br>'+
      '1. 每个结论都标"估算级"；按产品里的对照实验方案投一轮，导入后自动升级为"实验级"。<br>'+
      '2. 发布当天就投流的笔记分不开，我们给区间而不是拒绝回答。<br>'+
      '3. 站外数据由商家导出，导入时自动体检：缺天、重复、连续为零、异常尖峰都会提示。<br>'+
      '4. 7 天观察期、长期趋势、星期规律都是假设，所以每个结论都换 3 种假设重算，不变的才标"稳健"。算法用数据实测的波动，不假设任何分布；在比泊松更乱的噪声下，误判率仍在 9% 以内。<br>'+
      '5. 大促和节假日可以标记并剔除。<br>'+
      '6. 客单价和毛利率由商家输入，可以随时在"调整假设"里改，结论实时重算，并提示哪些结论对假设敏感。</p>';
}
function secHow(){
  var inner=el('div','how');
  inner.innerHTML=howInnerHTML();
  var w=wrapCollapse({
    id:'sec-how', title:'这些数是怎么算出来的？', sub:'潮水比喻 + 5 步',
    key:'误判 ≈7% · 识别 ≈9 成'
  });
  w.querySelector('.col-body').appendChild(inner);
  return w;
}

/* ================= 客户经理视角 ================= */
var MC_STATUS = {
  risk: { cls:'st-risk', t:'只看站内像在亏，实际在赚：有砍预算风险', d:'先帮客户把站外成交算进来，讲清种草的全域价值，再谈续投' },
  loss: { cls:'st-loss', t:'投流整体没回本：需要帮客户调整打法',      d:'停掉给没起来的笔记投流，只投绿灯笔记；内容向带货类型倾斜' },
  ok:   { cls:'st-ok',   t:'种草和投流都健康：可以建议加预算',        d:'按最优点提案加预算，并约定下期做对照实验' }
};
var MC_ORD = { risk:0, loss:1, ok:2 };
function classifyShop(S, be){
  if(num(S.roiIn) && S.roiIn < be && num(S.roiReal) && S.roiReal >= be) return 'risk';
  if(num(S.roiReal) && S.roiReal < be) return 'loss';
  return 'ok';
}
function countUpWan(node, targetWan, dur){
  dur=dur||950;
  if(!COUNT_FIRST.wan){ COUNT_FIRST._skip=true; }
  COUNT_FIRST.wan=false;
  /* v10：同 countUp，任何情况下最终都落在目标值 */
  var v=+targetWan; if(!isFinite(v)) v=0;
  var finalTxt=(Math.round(v*10)/10).toFixed(1);
  try{ node.textContent=finalTxt; }catch(e){ return; }
  if(COUNT_FIRST._skip){ COUNT_FIRST._skip=false; return; }
  var done=false;
  function finish(){ if(done) return; done=true; try{ node.textContent=finalTxt; }catch(e){} }
  var t0=null;
  function step(t){
    if(done) return;
    if(t0==null)t0=t;
    var p=Math.min(1,(t-t0)/dur), e=1-Math.pow(1-p,3);
    node.textContent=(Math.round(v*10*e)/10).toFixed(1);
    if(p>=1){ finish(); return; }
    requestAnimationFrame(step);
  }
  requestAnimationFrame(step);
  setTimeout(finish, dur+400);
}
function copyText(txt){
  function fallback(){
    var ta=el('textarea'); ta.value=txt;
    ta.setAttribute('style','position:fixed;left:-999px;top:0;opacity:0');
    document.body.appendChild(ta);
    var ok=false;
    try{ ta.select(); if(document.execCommand) ok=document.execCommand('copy'); }catch(e){}
    if(ta.parentNode) ta.parentNode.removeChild(ta);
    toast(ok?'已复制到剪贴板':'复制失败，请长按文字手动复制');
  }
  if(navigator.clipboard && navigator.clipboard.writeText){
    navigator.clipboard.writeText(txt).then(function(){ toast('已复制到剪贴板'); }, fallback);
  } else fallback();
}
function managerEntries(){
  var entries=[];
  Object.keys(SHOP_META).forEach(function(k){
    if(k==='import') return;
    var res=compute(k);
    if(res.err){ warn(res.err); return; }
    var S=res.r.summary||{};
    entries.push({ key:k, meta:SHOP_META[k], res:res, st:classifyShop(S, res.r.be) });
  });
  entries.sort(function(a,b){ return (MC_ORD[a.st]!=null?MC_ORD[a.st]:9)-(MC_ORD[b.st]!=null?MC_ORD[b.st]:9); });
  return entries;
}
function managerHero(entries){
  var sumTV=0, sumIV=0, notes=0, d0=null, d1=null;
  entries.forEach(function(e){
    var S=e.res.r.summary||{};
    if(num(S.totalValue)) sumTV+=S.totalValue;
    if(num(S.incInValue)) sumIV+=S.incInValue;
    if(num(S.noteCount)) notes+=S.noteCount;
    var a=firstDate(e.res.r), b=lastDate(e.res.r);
    if(a && (!d0 || a<d0)) d0=a;
    if(b && (!d1 || b>d1)) d1=b;
  });
  var range=(d0&&d1)?(' · '+fmtDay(d0)+'–'+fmtDay(d1)):'';
  var counts={risk:0, loss:0, ok:0};
  entries.forEach(function(e){ counts[e.st]=(counts[e.st]||0)+1; });
  var minis=[
    { k:'risk', label:'有砍预算风险' },
    { k:'loss', label:'投流没回本' },
    { k:'ok',   label:'可以加预算' }
  ].map(function(m){
    return '<div class="mini" data-no-glossary><div class="mini-num num">'+counts[m.k]+' 个客户</div><div class="mini-label">'+m.label+'</div></div>';
  }).join('');
  var sec=el('section','card hero mhero card-float');
  sec.innerHTML=
    '<div class="hero-top">'+
      '<span class="hero-badge">小红书客户经理视角</span>'+
      '<span class="hero-meta">我负责的 '+entries.length+' 个客户'+range+' · '+fmtInt(notes)+' 篇笔记</span>'+
    '</div>'+
    '<h1 class="mhero-title">我负责的 '+entries.length+' 个客户</h1>'+
    '<div class="hero-main">'+
      '<div class="hero-big">'+
        '<div class="hero-big-label" data-no-glossary>种草为客户带来的生意（全域）</div>'+
        '<div class="hero-big-num num">¥<span class="count">0.0</span><span class="unit">万</span></div>'+
        '<div class="hero-big-sub">只看小红书站内只有 '+fmtWan(sumIV)+'，会少算 '+fmtWan(sumTV-sumIV)+'</div>'+
      '</div>'+
      '<div class="hero-minis">'+minis+'</div>'+
    '</div>';
  var targetWan=Math.round(sumTV/1000)/10;
  /* v10：渲染横幅时就重新跑滚动动画（countUpWan 先落目标值再从 0 动画） */
  var c0=sec.querySelector('.count');
  if(c0) countUpWan(c0,targetWan);
  return sec;
}
function chByScope(sample, scope){
  var cs=(sample&&sample.channels)||[];
  for(var i=0;i<cs.length;i++){ if(cs[i] && cs[i].scope===scope && cs[i].name) return cs[i].name; }
  return scope==='in' ? '站内渠道' : '站外渠道';
}
function proposalText(entry){
  var r=entry.res.r, S=r.summary||{}, be=r.be, meta=entry.meta;
  var chIn=chByScope(entry.res.sample,'in'), chOut=chByScope(entry.res.sample,'out');
  var L=[];
  /* ① 按状态 */
  if(entry.st==='risk'){
    L.push('① 先对齐口径（最重要）');
    L.push('只看「'+chIn+'」，投流每 1 元换回 '+fmt2(S.roiIn)+' 元，低于保本线 '+fmt2(be)+' 元，客户会觉得在亏；把「'+chOut+'」的成交算进来并去掉自然流量水分，每 1 元换回 '+fmt2(S.roiReal)+' 元，是赚的。种草带来的成交里 '+fmtPct(S.outShare)+'% 发生在「'+chOut+'」。一句话：不是小红书不带货，是货在「'+chOut+'」成交了。');
  } else if(entry.st==='loss'){
    L.push('① 坦诚复盘');
    L.push('看起来每 1 元换回 '+fmt2(S.roiSeen)+'，去水分后只有 '+fmt2(S.roiReal)+'，低于保本线；问题不在小红书，在投法：钱投给了没跑起来的笔记。');
  } else {
    L.push('① 成绩');
    L.push('种草带来的生意共 '+fmtWan(S.totalValue)+'，其中 '+fmtPct(S.outShare)+'% 发生在站外；投流去水分后每 1 元换回 '+fmt2(S.roiReal)+' 元，高于保本线 '+fmt2(be)+' 元。');
  }
  /* ② 真正带货的内容 */
  var top2=(r.notes||[]).slice().sort(function(a,b){ return (b.total||0)-(a.total||0); }).slice(0,2);
  var types=(r.types||[]).slice().sort(function(a,b){ return (b.avg||0)-(a.avg||0); });
  L.push('② 真正带货的内容');
  L.push('效果最好的两篇是「'+top2[0].title+'」和「'+top2[1].title+'」；最强的内容类型是「'+types[0].type+'」。');
  /* ③ 下期方案 */
  var bud=safeBudget(r);
  var pause=(r.types||[]).filter(function(x){ return (x.realRate||0)===0; }).map(function(x){ return '「'+x.type+'」'; }).join('、');
  L.push('③ 下期方案');
  L.push('投流预算按最优点约 '+(bud&&bud.Bstar!=null?fmtMoney(bud.Bstar):'—')+'，平均每篇 '+(bud&&bud.cStar!=null?fmtMoney(bud.cStar):'—')+
    '；主攻「'+types[0].type+'」'+(pause?('，暂停 '+pause+' 这类没跑起来的'):'')+'；结案按全域口径，站内站外一起算。');
  /* ④ 对照实验 */
  var ex=null;
  try{ ex=LedgerEngine.experiment(r, entry.res.sample, {plan:8}); }catch(e){ ex=null; }
  L.push('④ 让下期结案更有说服力');
  L.push(ex&&ex.ok
    ? ('和客户约定做对照实验：下期 '+ex.total+' 篇笔记单数投、双数不投，约 '+Math.round(ex.months)+' 个月出结论。')
    : '和客户约定做对照实验：同类内容拆开发、只投一半，拿真实对比验证投流效果。');
  return L.join('\n');
}
var MP={ card:null, entry:null, timer:null };
function proposalCard(){
  var c=el('section','card mc-prop-card card-float');
  c.id='mvProposal';
  c.innerHTML=
    '<div class="mc-prop-head">'+
      '<div class="mc-prop-txt">'+
        '<div class="mc-prop-title">提案要点</div>'+
        '<div class="mc-prop-sub">数字全部来自该客户的账本，可直接复制带去拜访</div>'+
      '</div>'+
      '<button class="pp-copy" type="button" hidden>复制</button>'+
    '</div>'+
    '<div class="pp-body mc-prop-empty">点上方任意客户卡片的「生成提案要点」，提案会出现在这里。</div>';
  return c;
}
function showProposal(entry){
  var card=MP.card;
  if(!card || !card.parentNode) return;
  if(MP.timer){ clearTimeout(MP.timer); MP.timer=null; }
  MP.entry=entry;
  var meta=entry.meta;
  var full=proposalText(entry);
  card.querySelector('.mc-prop-title').textContent='提案要点 · '+meta.name;
  var copyBtn=card.querySelector('.pp-copy');
  copyBtn.hidden=false;
  copyBtn.textContent='复制';
  copyBtn.onclick=function(){
    copyText('提案要点 · '+meta.name+'\n\n'+full);
    copyBtn.textContent='已复制';
    setTimeout(function(){ if(copyBtn.parentNode) copyBtn.textContent='复制'; }, 3000);
  };
  var body=card.querySelector('.pp-body');
  body.innerHTML='<div class="pp-typing"><i></i><i></i><i></i><span>正在输入</span></div>';
  body.classList.remove('mc-prop-empty');
  try{ card.scrollIntoView({behavior:'smooth', block:'start'}); }
  catch(e){ try{ card.scrollIntoView(); }catch(e2){} }
  MP.timer=setTimeout(function(){
    MP.timer=null;
    if(MP.entry!==entry || !card.parentNode) return;
    if(FX_REDUCED){ body.textContent=full; return; }
    /* v20：像电报一样逐行打出 */
    var lines=String(full).split('\n'), k=0;
    body.textContent='';
    (function next(){
      if(MP.entry!==entry || !card.parentNode) return;
      if(k>=lines.length){ body.textContent=full; copyBtn.classList.remove('fx-bounce'); void copyBtn.offsetWidth; copyBtn.classList.add('fx-bounce'); return; }
      body.appendChild(document.createTextNode(lines[k]+(k<lines.length-1?'\n':''))); k++;
      MP.timer=setTimeout(next, 70);
    })();
  }, 600);
}
function clientCard(entry){
  var meta=entry.meta, r=entry.res.r, S=r.summary||{}, be=r.be, st=MC_STATUS[entry.st];
  var c=el('section','card mc-card card-float');
  var scale=Math.max(num(S.roiIn)?S.roiIn:0, num(S.roiReal)?S.roiReal:0, num(be)?be:0);
  if(scale<=0) scale=1; else scale*=1.12;
  function pct(v){ return Math.max(2, Math.min(100, v/scale*100)); }
  c.innerHTML=
    '<div class="mc-head">'+
      '<div class="mc-name">'+esc(meta.name)+'</div>'+
      '<div class="mc-out num">站外 '+fmtPct(S.outShare)+'%</div>'+
    '</div>'+
    '<div class="mc-meta">'+esc(meta.kindLabel)+' · '+esc(meta.inCh)+' + '+esc(meta.outCh)+'</div>'+
    '<div class="mc-status '+st.cls+'">'+
      '<div class="mc-st-t">'+esc(st.t)+'</div>'+
      '<div class="mc-st-d">'+esc(st.d)+'</div>'+
    '</div>'+
    '<div class="mc-compare">'+
      '<div class="mc-cp"><span>只看站内的生意</span><b class="num">'+fmtWan(S.incInValue)+'</b></div>'+
      '<div class="mc-cp hot"><span>算上站外（全域）</span><b class="num">'+fmtWan(S.totalValue)+'</b></div>'+
    '</div>'+
    '<div class="mc-bars">'+
      '<div class="mc-bar">'+
        '<div class="mc-bar-top"><span>投流每 1 元换回 · 只看站内</span><b class="num">'+fmt2(S.roiIn)+' 元</b></div>'+
        '<div class="mc-bar-line"><i class="bar-fill in" style="width:'+pct(S.roiIn)+'%"></i><i class="be-mark" style="left:'+pct(be)+'%"></i></div>'+
      '</div>'+
      '<div class="mc-bar">'+
        '<div class="mc-bar-top"><span>投流每 1 元换回 · 全域去水分</span><b class="num '+(num(S.roiReal)&&S.roiReal>=be?'v-ok':'v-loss')+'">'+fmt2(S.roiReal)+' 元</b></div>'+
        '<div class="mc-bar-line"><i class="bar-fill '+(num(S.roiReal)&&S.roiReal>=be?'real-ok':'real-loss')+'" style="width:'+pct(S.roiReal)+'%"></i><i class="be-mark" style="left:'+pct(be)+'%"></i></div>'+
      '</div>'+
      '<div class="mc-bar-note">黑色竖线是保本线 <b class="num">'+fmt2(be)+'</b> 元</div>'+
    '</div>'+
    '<div class="mc-actions">'+
      '<button class="btn-main" type="button">生成提案要点</button>'+
      '<button class="btn-line" type="button">进入店铺看板 →</button>'+
    '</div>';
  c.querySelector('.btn-line').addEventListener('click', function(){
    state.shop=entry.key; WARN=[];
    updateShopSeg();
    setView('merchant');
    render();
    window.scrollTo(0,0);
  });
  c.querySelector('.btn-main').addEventListener('click', function(){
    showProposal(entry);
  });
  return c;
}
function renderManager(){
  var mv=$('#managerView');
  mv.innerHTML='';
  if(!engineReady()){ mv.appendChild(renderMissingFiles()); return; }
  var entries=managerEntries();
  if(!entries.length){ mv.appendChild(renderError('三家示例店铺一个都没算出来')); return; }
  mv.appendChild(safeSec(function(){ return managerHero(entries); }));
  mv.appendChild(secHeader('客户看板','按"最需要我去沟通"排序 · 点"生成提案要点"准备下次拜访'));
  entries.forEach(function(e){ mv.appendChild(safeSec(function(){ var c=clientCard(e); try{ wowMcTide(c, e.res && e.res.r); }catch(err){} return c; })); });
  /* 双赢测算（extras.js）：客户卡片下面、提案要点上面 */
  var winwinBox=el('div','');
  winwinBox.id='sec-winwin';
  var GXW=(typeof GuanchaoExtras!=='undefined')?GuanchaoExtras:null;
  if(GXW && typeof GXW.renderWinwin==='function'){
    try{
      GXW.renderWinwin(winwinBox, { clients: entries.map(function(e){ return { key:e.key, sample:e.res.sample, r:e.res.r }; }) });
    }catch(err){ winwinBox.innerHTML=''; winwinBox.appendChild(failCard()); }
  }else{ winwinBox.appendChild(failCard()); }
  mv.appendChild(winwinBox);
  try{
    var big=winwinBox.querySelector('.gx-big');
    if(big && !big.querySelector('.fx-scale')){
      var sc=el('div','fx-scale');
      sc.setAttribute('aria-hidden','true');
      sc.innerHTML='<'+'svg viewBox="0 0 64 44" width="64" height="44"><path d="M32 6v30" stroke="#1D1D1F" stroke-width="2"/><path d="M22 40h20" stroke="#1D1D1F" stroke-width="2.5" stroke-linecap="round"/><g class="fx-beam"><path d="M8 10h48" stroke="#1D1D1F" stroke-width="2.5" stroke-linecap="round"/><g class="fx-pan l"><path d="M8 10l-5 12h10z" fill="none" stroke="#0F7A45" stroke-width="1.6"/><path d="M2 22h12" stroke="#0F7A45" stroke-width="2.2" stroke-linecap="round"/></g><g class="fx-pan r"><path d="M56 10l-5 12h10z" fill="none" stroke="#FF2442" stroke-width="1.6"/><path d="M50 22h12" stroke="#FF2442" stroke-width="2.2" stroke-linecap="round"/></g></g><circle cx="32" cy="8" r="3" fill="#1D1D1F"/></svg>';
      big.appendChild(sc);
    }
  }catch(e){}
  MP.card=proposalCard(); MP.entry=null;
  if(MP.timer){ clearTimeout(MP.timer); MP.timer=null; }
  mv.appendChild(MP.card);
  /* v14 收束：「为什么需要观潮」搬进幕后页 */
  var floats=mv.querySelectorAll('.card-float');
  for(var i=0;i<floats.length;i++){ floats[i].style.animationDelay=(i*55)+'ms'; }
  attachGlossary(mv);
  try{ fxTitle(); }catch(e){}
}
function updateShopSeg(){
  document.querySelectorAll('#segShop .seg-btn').forEach(function(x){
    x.classList.toggle('active', state.importMode ? x.dataset.shop==='import' : x.dataset.shop===state.shop);
  });
}
function setView(v){
  if(state.view===v) return;
  state.view=v;
  var isM=(v==='manager');
  document.body.classList.toggle('view-manager', isM);
  $('#main').hidden=isM;
  $('#managerView').hidden=!isM;
  document.querySelectorAll('#segView .seg-btn').forEach(function(b){ b.classList.toggle('active', b.dataset.view===v); });
  if(isM){ renderManager(); }
  window.scrollTo(0,0);
}

/* ================= 页面渲染 ================= */
/* v16：任何区块渲染失败，原位置显示一句提示，不留空白 */
function failCard(){ return el('div','card fail-card card-float','这一块暂时加载失败，刷新页面再试'); }
function safeSec(fn){
  try{ var n=fn(); return n || el('div',''); }
  catch(e){ try{ console.warn('[观潮] 区块渲染失败', e); }catch(e2){} return failCard(); }
}
function renderOverview(r, sample, meta){
  var main=$('#main');
  main.appendChild(safeSec(function(){ var h=secHero(r, meta); try{ wowHeroTide(h, r); }catch(e){} try{ fxHero(h, r); fxTide(h, r); }catch(e){} return h; }));
  main.appendChild(safeSec(function(){ return secTodos(r, sample, meta); }));
  /* v14 收束：删掉「30 秒看懂这家店」「为什么需要观潮」和总览底部的「数据从哪来」（后两者搬进幕后页） */
  main.appendChild(safeSec(function(){ return secCols(r, meta, sample); }));
  main.appendChild(safeSec(function(){ return secBoost(r, meta); }));
  main.appendChild(safeSec(function(){ return secKolLedger(r, sample); }));
  main.appendChild(safeSec(function(){ return secHow(); }));
  try{ fxOverview(main); fxRunBar(main, r); }catch(e){}
  if(FX.flyTruths){ var ft=FX.flyTruths; FX.flyTruths=null; fxLater(function(){ fxFlyTruths(ft); }, 80); }
  var floats=main.querySelectorAll('.card-float');
  for(var i=0;i<floats.length;i++){ floats[i].style.animationDelay=(i*55)+'ms'; }
  /* 去水分小图：全部挂进 DOM 后按真实容器宽度绘制（折叠中的等展开后再画） */
  var GX=(typeof GuanchaoExtras!=='undefined')?GuanchaoExtras:null;
  if(GX && typeof GX.boostChart==='function'){
    function inClosedWrap(n){
      for(var p=n && n.parentNode; p; p=p.parentNode){
        if(p.tagName==='DETAILS' && p.classList && p.classList.contains('col-wrap') && !p.open) return true;
      }
      return false;
    }
    function drawSlot(sl){ if(sl && sl._series){ try{ GX.boostChart(sl, sl._series); }catch(e){} } }
    var slots=main.querySelectorAll('.gx-boost-slot');
    for(var k=0;k<slots.length;k++){
      if(!inClosedWrap(slots[k])) drawSlot(slots[k]);
    }
    var wraps=main.querySelectorAll('details.col-wrap');
    for(var w=0;w<wraps.length;w++){
      (function(d){
        d.addEventListener('toggle', function(){
          if(!d.open) return;
          var ss=d.querySelectorAll('.gx-boost-slot');
          for(var j=0;j<ss.length;j++) drawSlot(ss[j]);
        });
      })(wraps[w]);
    }
  }
}


/* ================= v19：视觉加法（装饰层，数字一律来自 LedgerEngine，不改任何结论） ================= */
var WOW_NS='http://www.w3.org/2000/svg';
function wowSm(pts){
  if(!pts.length) return '';
  if(pts.length<3) return 'M'+pts.map(function(p){ return p[0].toFixed(1)+' '+p[1].toFixed(1); }).join(' L');
  var d='M'+pts[0][0].toFixed(1)+' '+pts[0][1].toFixed(1);
  for(var i=0;i<pts.length-1;i++){
    var p0=pts[Math.max(0,i-1)], p1=pts[i], p2=pts[i+1], p3=pts[Math.min(pts.length-1,i+2)];
    var c1=[p1[0]+(p2[0]-p0[0])/6, p1[1]+(p2[1]-p0[1])/6], c2=[p2[0]-(p3[0]-p1[0])/6, p2[1]-(p3[1]-p1[1])/6];
    d+=' C'+c1[0].toFixed(1)+' '+c1[1].toFixed(1)+' '+c2[0].toFixed(1)+' '+c2[1].toFixed(1)+' '+p2[0].toFixed(1)+' '+p2[1].toFixed(1);
  }
  return d;
}
function wowMa(a, k){ return a.map(function(_, i){ var s=0, c=0; for(var j=i-k;j<=i+k;j++){ if(j>=0 && j<a.length){ s+=a[j]; c++; } } return c? s/c : 0; }); }
function wowSmoothPts(pts, k){ var ys=wowMa(pts.map(function(p){ return p[1]; }), k); return pts.map(function(p, i){ return [p[0], ys[i]]; }); }
function wowMk(tag, attrs){ var e=document.createElementNS(WOW_NS, tag); for(var k in attrs) e.setAttribute(k, attrs[k]); return e; }
function wowParsePts(str){ return String(str||'').trim().split(/\s+/).map(function(s){ return s.split(',').map(Number); }).filter(function(p){ return p.length===2 && isFinite(p[0]) && isFinite(p[1]); }); }

/* 包 20：总览横幅下半部「本店的潮汐」（实际 5 日平均 + 平时的样子，真实数据）；包 21：悬停看当天 */
function wowHeroTide(hero, r){
  if(!hero || !r || !r.y || r.y.length<3 || hero.querySelector('.hero-tide')) return;
  var W=1000, H=300, n=r.y.length;
  var ya=wowMa(r.y, 2), yb=wowMa(r.baseline||r.y.map(function(){ return 0; }), 2);
  var mx=Math.max.apply(null, ya)*1.3 || 1;
  function X(i){ return (i/(n-1))*W; }
  function Y(v){ return H-(v/mx)*H*0.8-4; }
  var pa=ya.map(function(v, i){ return [X(i), Y(v)]; }), pb=yb.map(function(v, i){ return [X(i), Y(v)]; });
  function area(pts){ return wowSm(pts)+' L'+W+' '+H+' L0 '+H+' Z'; }
  var div=el('div','hero-tide');
  div.innerHTML='<'+'svg viewBox="0 0 '+W+' '+H+'" preserveAspectRatio="none" aria-hidden="true"><defs><linearGradient id="tideA" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#FF2442" stop-opacity=".22"/><stop offset="1" stop-color="#FF7A59" stop-opacity="0"/></linearGradient><linearGradient id="tideB" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#1D1D1F" stop-opacity=".07"/><stop offset="1" stop-color="#1D1D1F" stop-opacity="0"/></linearGradient></defs>'+
    '<g class="tide-move"><path d="'+area(pa)+'" fill="url(#tideA)"/><path d="'+wowSm(pa)+'" fill="none" stroke="#FF2442" stroke-opacity=".45" stroke-width="2"/><path d="'+area(pb)+'" fill="url(#tideB)"/><path d="'+wowSm(pb)+'" fill="none" stroke="#1D1D1F" stroke-opacity=".28" stroke-width="1.5" stroke-dasharray="6 6"/></g></svg>';
  hero.insertBefore(div, hero.firstChild);
  /* 悬停：白点标在曲线上 + 深色浮层（手机不做） */
  if(window.matchMedia && window.matchMedia('(hover: none)').matches) return;
  var LEC=(typeof LedgerEngine!=='undefined')?LedgerEngine:null;
  if(!LEC || typeof LEC.dayInfo!=='function') return;
  var svg=div.querySelector('svg');
  var mk=wowMk('circle', { 'class':'tide-mk', r:5 }); mk.style.display='none'; svg.appendChild(mk);
  var tip=el('div','hero-tip'); hero.appendChild(tip);
  function hide(){ tip.style.display='none'; mk.style.display='none'; }
  hero.addEventListener('mousemove', function(e){
    var bb=div.getBoundingClientRect();
    if(e.clientY<bb.top || e.clientY>bb.bottom){ hide(); return; }
    var ratio=Math.max(0, Math.min(1, (e.clientX-bb.left)/bb.width));
    var t=Math.round(ratio*(n-1));
    var info=null; try{ info=LEC.dayInfo(r, t); }catch(err){ info=null; }
    if(!info){ hide(); return; }
    var yy=Y(ya[t]);
    mk.setAttribute('cx', (ratio*W).toFixed(1)); mk.setAttribute('cy', yy.toFixed(1)); mk.style.display='block';
    var hb=hero.getBoundingClientRect();
    tip.style.left=(e.clientX-hb.left)+'px';
    tip.style.top=(bb.top-hb.top+yy/H*bb.height-12)+'px';
    var nt=(info.notes && info.notes.length)? String(info.notes[0]) : '';
    tip.innerHTML='<b>'+esc(info.label)+' '+esc(info.weekday)+'</b>实际 '+fmtInt(info.actual)+' · 平时 '+fx1(info.baseline)+
      (nt? '<br>「'+esc(nt.slice(0,14))+(nt.length>14?'…':'')+'」观察期' : '');
    tip.style.display='block';
  });
  hero.addEventListener('mouseleave', hide);
}

/* 包 21 #4：笔记明细大图潮汐化——读出原图的像素点，画平滑水面、平滑曲线、入场描画、浪头；原图元素保留（悬停浮层、圆点跳转不变） */
function wowChart(box, r){
  var svg=box && box.querySelector('svg');
  if(!svg || svg.getAttribute('data-wow')) return;
  var realEl=svg.querySelector('.nt-real'), baseEl=svg.querySelector('.nt-base');
  if(!realEl || !baseEl) return;
  var real=wowParsePts(realEl.getAttribute('points')), base=wowParsePts(baseEl.getAttribute('points'));
  var N=real.length; if(N<5 || base.length!==N) return;
  svg.setAttribute('data-wow','1');
  var paths=[].slice.call(svg.querySelectorAll('path'));
  var bandPath=paths.filter(function(p){ return (p.getAttribute('fill')||'').indexOf('rgba(255,36,66,.06')===0; })[0];
  var fillPaths=paths.filter(function(p){ return !p.getAttribute('class') && p!==bandPath && /^rgba/.test(p.getAttribute('fill')||''); });
  var upper=[], lower=[];
  if(bandPath){
    var nums=(bandPath.getAttribute('d').match(/-?[\d.]+/g)||[]).map(Number), pts=[];
    for(var i=0;i+1<nums.length;i+=2) pts.push([nums[i], nums[i+1]]);
    upper=pts.slice(0, N); lower=pts.slice(N, 2*N).reverse();
    bandPath.classList.add('wow-hide');
  }
  fillPaths.forEach(function(p){ p.classList.add('wow-hide'); });
  var realS=wowSmoothPts(real, 1), baseS=wowSmoothPts(base, 2);
  var g=wowMk('g', { 'class':'wow-tide' });
  var defs=wowMk('defs', {});
  defs.innerHTML='<linearGradient id="ntWater" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#FF2442" stop-opacity=".12"/><stop offset="1" stop-color="#FF2442" stop-opacity=".03"/></linearGradient>';
  g.appendChild(defs);
  if(upper.length===N && lower.length===N){
    var up=wowSmoothPts(upper, 3), lo=wowSmoothPts(lower, 3);
    g.appendChild(wowMk('path', { 'class':'nt-water', d:wowSm(up)+' '+wowSm(lo.slice().reverse()).replace(/^M/,'L')+' Z', fill:'url(#ntWater)' }));
  }
  (r && r.notes || []).forEach(function(n){
    if(n.p==null || n.end==null || n.end>=N) return;
    var seg=realS.slice(n.p, n.end+1), back=baseS.slice(n.p, n.end+1).reverse();
    if(seg.length<2) return;
    var k=n.live?'live':(n.verdict||'none');
    g.appendChild(wowMk('path', { d:wowSm(seg)+' '+wowSm(back).replace(/^M/,'L')+' Z', fill:NT_FILL[k]||NT_FILL.none }));
  });
  g.appendChild(wowMk('path', { 'class':'nt-base-smooth', d:wowSm(baseS) }));
  g.appendChild(wowMk('path', { 'class':'nt-real-smooth', d:wowSm(realS) }));
  [].slice.call(svg.querySelectorAll('.nt-dot')).forEach(function(dot, i){
    var cx=+dot.getAttribute('cx'), best=0, bd=1e9;
    real.forEach(function(p, j){ var dd=Math.abs(p[0]-cx); if(dd<bd){ bd=dd; best=j; } });
    g.appendChild(wowMk('circle', { 'class':'nt-crest', cx:cx.toFixed(1), cy:realS[best][1].toFixed(1), r:5, fill:'none', stroke:dot.getAttribute('fill')||'#FF2442', 'stroke-width':1.5, style:'animation-delay:'+(i*0.3).toFixed(1)+'s' }));
  });
  svg.insertBefore(g, baseEl);
}

/* 包 21 #6：预算曲线——当前预算的黑点换成浮标；最划算点加绿色脉冲环（正好重合时不再叠绿点） */
function wowBudget(cbox){
  var svg=cbox && cbox.querySelector('svg');
  if(!svg || svg.getAttribute('data-wow')) return;
  if(FX.btFirst){ FX.btFirst=false; FX.btTrail=[]; svg.classList.add('bt-draw'); }
  var dot=svg.querySelector('circle[fill="#1D1D1F"]'), green=svg.querySelector('line[stroke="#16A05D"]');
  if(!dot) return;
  svg.setAttribute('data-wow','1');
  var cx=dot.getAttribute('cx'), cy=dot.getAttribute('cy');
  dot.style.opacity=0;
  var g=wowMk('g', { transform:'translate('+cx+' '+cy+')' }), inner=wowMk('g', { 'class':'bt-buoy-in' });
  inner.appendChild(wowMk('circle', { r:12, fill:'rgba(255,36,66,.12)' }));
  inner.appendChild(wowMk('circle', { r:6.5, fill:'#fff', stroke:'#FF2442', 'stroke-width':2.5 }));
  inner.appendChild(wowMk('circle', { r:2.2, fill:'#FF2442' }));
  g.appendChild(inner); svg.appendChild(g);
  /* v20 #12：拖动时留一串渐隐的轨迹点；拖到最划算点弹「叮」 */
  FX.btTrail.push([+cx, +cy]); if(FX.btTrail.length>7) FX.btTrail.shift();
  FX.btTrail.slice(0, -1).forEach(function(p, k, arr){
    svg.insertBefore(wowMk('circle', { 'class':'bt-trail', cx:p[0].toFixed(1), cy:p[1].toFixed(1), r:3, fill:'#FF2442', 'fill-opacity':((k+1)/(arr.length+1)*0.35).toFixed(2) }), g);
  });
  if(green && FX.btTrail.length>1 && Math.abs(+green.getAttribute('x1')-(+cx))<4){
    var dg=wowMk('g', { 'class':'bt-ding', transform:'translate('+cx+' '+(+cy-26)+')' });
    dg.appendChild(wowMk('rect', { x:-30, y:-13, width:60, height:22, rx:11, fill:'#16A05D' }));
    var tx=wowMk('text', { x:0, y:2, 'text-anchor':'middle', 'font-size':12, 'font-weight':700, fill:'#fff' }); tx.textContent='叮！最划算';
    dg.appendChild(tx); svg.appendChild(dg);
  }
  if(green){
    var px=green.getAttribute('x1'), py=green.getAttribute('y1'), same=Math.abs(+px-(+cx))<8;
    svg.insertBefore(wowMk('circle', { 'class':'bt-pulse', cx:px, cy:py, r:5, fill:'none', stroke:'#16A05D', 'stroke-width':2 }), g);
    if(!same) svg.appendChild(wowMk('circle', { cx:px, cy:py, r:4, fill:'#16A05D', stroke:'#fff', 'stroke-width':2 }));
  }
}

/* 包 21 #7：客户经理卡片右上角的迷你潮汐（这家店的真实数据） */
function wowMcTide(card, r){
  var head=card && card.querySelector('.mc-head');
  if(!head || !r || !r.y || r.y.length<3 || head.querySelector('.mc-tide')) return;
  var W=150, H=38, ya=wowMa(r.y, 2), yb=wowMa(r.baseline||[], 2), n=ya.length, mx=(Math.max.apply(null, ya)*1.15)||1;
  function X(i){ return (i/(n-1))*W; }
  function Y(v){ return H-(v/mx)*(H-4)-2; }
  var pa=ya.map(function(v, i){ return [X(i), Y(v)]; }), pb=yb.map(function(v, i){ return [X(i), Y(v)]; });
  var gid='mcT'+Math.random().toString(36).slice(2,7);
  var mini=el('div','mc-tide');
  mini.title='这家店 '+n+' 天的潮汐：红线实际，虚线平时';
  mini.innerHTML='<'+'svg viewBox="0 0 '+W+' '+H+'" preserveAspectRatio="none" aria-hidden="true"><defs><linearGradient id="'+gid+'" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#FF2442" stop-opacity=".28"/><stop offset="1" stop-color="#FF2442" stop-opacity="0"/></linearGradient></defs><path d="'+wowSm(pa)+' L'+W+' '+H+' L0 '+H+' Z" fill="url(#'+gid+')"/><path d="'+wowSm(pa)+'" fill="none" stroke="#FF2442" stroke-opacity=".7" stroke-width="1.5"/>'+(pb.length?'<path d="'+wowSm(pb)+'" fill="none" stroke="#1D1D1F" stroke-opacity=".3" stroke-width="1" stroke-dasharray="3 3"/>':'')+'</svg>';
  head.insertBefore(mini, head.lastElementChild);
}


/* ================= v20：动效包（只做动效，不改任何数字和功能） ================= */
var FX={ hero:null, tide:null, breathed:false, runBar:false, light:'', btTrail:[], btFirst:false, flyTruths:null };
var FX_REDUCED=!!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
function fxLater(fn, ms){ return setTimeout(function(){ try{ fn(); }catch(e){} }, ms||0); }
function fxIsMobile(){ return document.documentElement.clientWidth<=640; }
/* 纸屑：colors 为颜色数组，从 (x,y) 附近向上散开后落下 */
function fxConfetti(x, y, colors, n){
  if(FX_REDUCED) return;
  n=n||46;
  for(var i=0;i<n;i++){
    var c=document.createElement('i');
    c.className='fx-confetti';
    var dx=(Math.random()-0.5)*360, dy=-(140+Math.random()*180), rot=(Math.random()*720-360)|0;
    c.style.left=x+'px'; c.style.top=y+'px';
    c.style.background=colors[i%colors.length];
    c.style.setProperty('--dx', dx.toFixed(0)+'px'); c.style.setProperty('--dy', dy.toFixed(0)+'px'); c.style.setProperty('--rot', rot+'deg');
    c.style.animationDelay=(Math.random()*0.12).toFixed(2)+'s';
    document.body.appendChild(c);
    (function(el){ setTimeout(function(){ if(el.parentNode) el.parentNode.removeChild(el); }, 1900); })(c);
  }
}
/* 数字滚动：只处理"一个数字 + 前后缀"的纯文本元素，结束时恢复原文 */
function fxRoll(node, dur){
  if(!node || FX_REDUCED) return;
  var tn=null;
  for(var c=node.firstChild;c;c=c.nextSibling){ if(c.nodeType===3 && /\d/.test(c.nodeValue)){ tn=c; break; } if(c.nodeType===1) break; }
  if(!tn) return;
  if(tn._fxRolling) return; tn._fxRolling=true;
  var txt=tn.nodeValue, m=txt.match(/^([^\d\-+]*)([+\-]?)([\d,]+(?:\.\d+)?)(.*)$/);
  if(!m){ tn._fxRolling=false; return; }
  node={ set textContent(v){ tn.nodeValue=v; } };
  var raw=m[3].replace(/,/g,''), v=parseFloat(raw); if(!isFinite(v)) return;
  var dec=(raw.split('.')[1]||'').length, comma=m[3].indexOf(',')>=0, t0=null; dur=dur||650;
  function f(x){ var s=x.toFixed(dec); if(comma){ var p=s.split('.'); p[0]=p[0].replace(/\B(?=(\d{3})+(?!\d))/g, ','); s=p.join('.'); } return m[1]+m[2]+s+m[4]; }
  function step(t){ if(t0==null) t0=t; var p=Math.min(1,(t-t0)/dur), e=1-Math.pow(1-p,3); node.textContent=f(v*e); if(p<1) requestAnimationFrame(step); else { node.textContent=txt; tn._fxRolling=false; } }
  requestAnimationFrame(step);
  setTimeout(function(){ node.textContent=txt; tn._fxRolling=false; }, dur+300);
}
/* 打字机：逐字打出，结束时恢复原文 */
function fxType(node, text, perChar){
  if(!node || FX_REDUCED) return;
  var tries=0; perChar=perChar||45;
  /* 元素还没挂到页面上时先等一等；没挂上就不动它，保证文字不会被清空 */
  (function start(){
    if(!node.isConnected){ if(++tries<25) setTimeout(start, 30); return; }
    var i=0; node.textContent='';
    (function tick(){ if(!node.isConnected) return; i++; node.textContent=text.slice(0,i); if(i<text.length) setTimeout(tick, perChar); else node.textContent=text; })();
  })();
}

/* #1 横幅翻页计数 + #2 小卡「每 1 元换回」到位后跳一下（高于保本线绿光圈，低于闪红） */
function fxHero(h, r){
  if(!h || !r) return;
  var cnt=h.querySelector('.hero-big-num .count');
  if(cnt){
    var newT=cnt.textContent;
    if(FX.hero && FX.hero.text && FX.hero.text!==newT && !FX_REDUCED){
      var oldT=FX.hero.text;
      cnt.innerHTML='<span class="flip-wrap"><span class="flip-old">'+esc(oldT)+'</span><span class="flip-new">'+esc(newT)+'</span></span>';
      fxLater(function(){ if(cnt.isConnected) cnt.textContent=newT; }, 800);
    }
    FX.hero={ shop:state.shop, text:newT };
  }
  var minis=h.querySelectorAll('.hero-minis .mini');
  var roiMini=minis[1], S=r.summary||{};
  if(roiMini && num(S.roiReal) && num(r.be)){
    var good=S.roiReal>=r.be;
    fxLater(function(){ roiMini.classList.add('mini-pop', good?'good':'bad'); }, 950);
  }
}

/* #4 潮汐从平线涨成真实形状，换店时旧潮退；#19 月份刻度 + 每篇笔记发布日的小浪头 */
function fxTide(h, r){
  var tide=h && h.querySelector('.hero-tide');
  if(!tide || !r || !r.y) return;
  tide.classList.add('tide-rise');
  if(FX.tide && FX.tide.shop!==state.shop && FX.tide.html && !FX_REDUCED){
    var old=el('div','hero-tide tide-out'); old.innerHTML=FX.tide.html; old.setAttribute('aria-hidden','true');
    h.insertBefore(old, tide);
    fxLater(function(){ if(old.parentNode) old.parentNode.removeChild(old); }, 900);
  }
  var svg=tide.querySelector('svg');
  FX.tide={ shop:state.shop, html:svg? svg.outerHTML : '' };
  /* 月份刻度 */
  var n=r.y.length, dates=r.dates||[];
  if(n>2 && dates.length===n){
    var ticks=el('div','tide-ticks'), lastM=-1, html='';
    dates.forEach(function(ds, i){
      var d=parseDate(ds); if(!d) return;
      var m=d.getMonth();
      if(m!==lastM){ if(lastM>=0 || d.getDate()<=3) html+='<span style="left:'+(i/(n-1)*100).toFixed(2)+'%">'+(m+1)+'月</span>'; lastM=m; }
    });
    ticks.innerHTML=html; ticks.setAttribute('aria-hidden','true');
    tide.appendChild(ticks);
  }
  /* 每篇笔记发布那天一个小浪头（与横幅潮汐同一坐标） */
  var ya=wowMa(r.y, 2), mx=Math.max.apply(null, ya)*1.3 || 1, crest=el('div','tide-crests');
  crest.setAttribute('aria-hidden','true');
  (r.notes||[]).forEach(function(nt, k){
    if(nt.p==null || nt.p>=n) return;
    var top=(1-(ya[nt.p]/mx)*0.8)*100-1.3;
    var vc=NT_VC[ntKey(nt)]||NT_VC.none;
    crest.innerHTML+='<i style="left:'+(nt.p/(n-1)*100).toFixed(2)+'%;top:'+Math.max(2,top).toFixed(1)+'%;--c:'+vc+';animation-delay:'+(1.1+k*0.08).toFixed(2)+'s"></i>';
  });
  tide.appendChild(crest);
}

/* #17 从成绩单进账本：三张真相卡飞到横幅对应的小卡上 */
function fxFlyTruths(truths){
  if(!truths || !truths.length || FX_REDUCED) return;
  var hero=document.getElementById('card-hero'); if(!hero) return;
  var minis=hero.querySelectorAll('.hero-minis .mini');
  var targets=[minis[1], minis[0], document.querySelector('#sec-kol > summary .col-k')||document.querySelector('#sec-kol')];
  truths.forEach(function(t, i){
    var tg=targets[i]; if(!tg || !t || !t.rect) return;
    var tr=tg.getBoundingClientRect(); if(!tr.width) return;
    var f=el('div','fx-fly', t.html);
    f.style.left=t.rect.left+'px'; f.style.top=t.rect.top+'px'; f.style.width=t.rect.width+'px'; f.style.height=t.rect.height+'px';
    document.body.appendChild(f);
    fxLater(function(){
      f.style.transitionDelay=(i*0.12)+'s';
      f.style.left=tr.left+'px'; f.style.top=tr.top+'px'; f.style.width=tr.width+'px'; f.style.height=tr.height+'px';
      f.classList.add('go');
    }, 60);
    fxLater(function(){ if(f.parentNode) f.parentNode.removeChild(f); tg.classList.remove('fx-land'); void tg.offsetWidth; tg.classList.add('fx-land'); }, 1000+i*120);
  });
}

/* #14 切店 / 进账本时顶部「算法运行条」：1 秒跑完 6 步再收成一行 */
function fxRunBar(main, r){
  if(!FX.runBar || !main || !r) return;
  FX.runBar=false;
  var steps=['读每日数据','量平时的样子','量正常波动','算每篇增量','投流去水分','达人回本价'];
  var bar=el('div','fx-run');
  bar.setAttribute('role','status');
  bar.innerHTML='<div class="fx-run-steps">'+steps.map(function(t, i){ return '<span style="animation-delay:'+(i*0.15).toFixed(2)+'s"><i></i>'+esc(t)+'</span>'; }).join('')+'</div>'+
    '<div class="fx-run-done">算法已算完：'+fmtInt((r.dates||[]).length)+' 天数据 · '+fmtInt((r.notes||[]).length)+' 篇笔记 · 数字全部来自算法</div>';
  var lede=main.querySelector('.tab-lede');
  if(lede && lede.nextSibling) main.insertBefore(bar, lede.nextSibling); else main.insertBefore(bar, main.firstChild);
  fxLater(function(){ bar.classList.add('done'); }, FX_REDUCED? 0 : 1100);
}

/* #23 行动卡像通知一样逐张推进来；#21 折叠卡关键数字呼吸一次；#22 「展开看依据」箭头点两下 */
function fxOverview(main){
  FX.confettiKey='';
  if(!main || FX_REDUCED) return;
  [].slice.call(main.querySelectorAll('#card-todo .gca-item')).forEach(function(it, i){
    it.classList.add('fx-push'); it.style.animationDelay=(0.15+i*0.12).toFixed(2)+'s';
  });
  if(!FX.breathed){
    FX.breathed=true;
    [].slice.call(main.querySelectorAll('.col-wrap > summary .col-k')).forEach(function(k, i){ k.classList.add('fx-breathe'); k.style.animationDelay=(0.9+i*0.12).toFixed(2)+'s'; });
    [].slice.call(main.querySelectorAll('.col-wrap > summary .col-hint')).forEach(function(k, i){ k.classList.add('fx-nudge'); k.style.animationDelay=(1.4+i*0.1).toFixed(2)+'s'; });
  }
}

/* #3 采纳：打勾 → 小纸飞机飞到「已采纳 n/4」；全部采纳撒红白纸屑 */
document.addEventListener('click', function(ev){
  var b=ev.target && ev.target.closest ? ev.target.closest('#card-todo [data-ok]') : null;
  if(!b || b.disabled || FX_REDUCED) return;
  var r0=b.getBoundingClientRect();
  fxLater(function(){
    var cnt=document.querySelector('#card-todo [data-count]'); if(!cnt) return;
    var r1=cnt.getBoundingClientRect();
    var p=el('div','fx-plane','<'+'svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true"><path d="M2 11l20-8-6 18-4-7-10-3z" fill="#FF2442"/><path d="M12 14l4-7" stroke="#fff" stroke-width="1.4"/></svg>');
    p.style.left=(r0.left+r0.width/2-10)+'px'; p.style.top=(r0.top-6)+'px';
    document.body.appendChild(p);
    setTimeout(function(){ p.style.left=(r1.left+r1.width/2-10)+'px'; p.style.top=(r1.top+r1.height/2-10)+'px'; p.classList.add('go'); }, 30);
    fxLater(function(){
      if(p.parentNode) p.parentNode.removeChild(p);
      cnt.classList.remove('fx-land'); void cnt.offsetWidth; cnt.classList.add('fx-land');
      var m=String(cnt.textContent).match(/(\d+)\s*\/\s*(\d+)/);
      var ck=state.shop+'|'+(m?m[2]:'');
      if(m && +m[1]===+m[2] && +m[2]>0 && FX.confettiKey!==ck){ FX.confettiKey=ck; var rr=cnt.getBoundingClientRect(); fxConfetti(rr.left+rr.width/2, rr.top+rr.height/2, ['#FF2442','#FFFFFF','#FF8A96','#FFD1D7']); }
    }, 720);
  }, 40);
}, true);

/* #5 总览空白处划过有淡水波纹，点击出涟漪；#6 Logo 连点 5 次小鲸鱼游过潮汐 */
var FX_RIP_T=0;
function fxRippleTarget(t){
  if(state.view!=='merchant' || state.tab!=='overview' || state.importMode) return false;
  if(document.body.classList.contains('gcd-open') || document.body.classList.contains('tour-on') || document.querySelector('.gp')) return false;
  if(!t || !t.closest) return false;
  if(t.closest('.card,.col-wrap,button,a,input,details,.topbar,.tabs,.bottom-nav,.gq-wrap,.gq-fab,.notice')) return false;
  return !!t.closest('.wrap') || t===document.body;
}
function fxRipple(x, y, big){
  if(FX_REDUCED) return;
  var d=el('i','fx-ripple'+(big?' big':''));
  d.style.left=x+'px'; d.style.top=y+'px';
  document.body.appendChild(d);
  setTimeout(function(){ if(d.parentNode) d.parentNode.removeChild(d); }, big? 1000 : 900);
}
document.addEventListener('mousemove', function(ev){
  var now=Date.now(); if(now-FX_RIP_T<110) return;
  if(!fxRippleTarget(ev.target)) return;
  FX_RIP_T=now; fxRipple(ev.clientX, ev.clientY, false);
}, { passive:true });
document.addEventListener('click', function(ev){ if(fxRippleTarget(ev.target)) fxRipple(ev.clientX, ev.clientY, true); });
var FX_LOGO={ n:0, t:0 };
function fxBindLogo(){
  var logo=document.querySelector('.topbar .logo'); if(!logo || logo._fx) return;
  logo._fx=true;
  logo.addEventListener('click', function(){
    var now=Date.now();
    if(now-FX_LOGO.t>2500) FX_LOGO.n=0;
    FX_LOGO.t=now; FX_LOGO.n++;
    if(FX_LOGO.n>=5){ FX_LOGO.n=0; fxWhale(); }
  });
}
function fxWhale(){
  var host=document.querySelector('#card-hero .hero-tide');
  var w=el('div','fx-whale','🐋');
  w.setAttribute('aria-hidden','true');
  if(host){ host.appendChild(w); } else { w.classList.add('fixed'); document.body.appendChild(w); }
  setTimeout(function(){ if(w.parentNode) w.parentNode.removeChild(w); }, 4600);
}

/* #42 演示重置：整页潮水涨上来盖住，再退去；#16 首次打开：一层潮水从上方退下露出侦探首页 */
function fxTideCover(done){
  if(FX_REDUCED){ done(); return; }
  var c=el('div','fx-cover');
  c.innerHTML='<'+'svg viewBox="0 0 1200 60" preserveAspectRatio="none" aria-hidden="true"><path d="M0 60 L0 30 Q150 0 300 30 T600 30 T900 30 T1200 30 L1200 60 Z" fill="#B3203A"/></svg>';
  document.body.appendChild(c);
  setTimeout(function(){ c.classList.add('up'); }, 30);
  setTimeout(function(){
    try{ done(); }catch(e){}
    c.classList.add('down');
    setTimeout(function(){ if(c.parentNode) c.parentNode.removeChild(c); }, 700);
  }, 480);
}
function fxCurtain(){
  if(FX_REDUCED) return;
  var c=el('div','fx-curtain');
  c.innerHTML='<'+'svg viewBox="0 0 1200 60" preserveAspectRatio="none" aria-hidden="true"><path d="M0 0 L1200 0 L1200 30 Q1050 60 900 30 T600 30 T300 30 T0 30 Z" fill="#2A1A2E"/></svg>';
  document.body.appendChild(c);
  setTimeout(function(){ c.classList.add('go'); }, 30);
  setTimeout(function(){ if(c.parentNode) c.parentNode.removeChild(c); }, 1000);
}

/* #15 页脚三个词依次点亮；#43 浏览器标签标题随店铺变，前面 🌊 轻轻交替 */
function fxFooter(){
  var f=document.querySelector('.foot'); if(!f || f._fx) return;
  f._fx=true;
  var words=['算法算对','AI 办事','人做决定'], h=esc(f.textContent);
  words.forEach(function(w, i){ h=h.replace(esc(w), '<span class="fx-word" style="animation-delay:'+(0.4+i*0.35).toFixed(2)+'s">'+esc(w)+'</span>'); });
  f.innerHTML=h;
}
var FX_TITLE={ base:'', flip:false, timer:null };
function fxTitle(){
  var meta=SHOP_META[state.shop];
  var name=state.view==='manager'? '客户经理视角' : (state.importMode? '导入数据' : (meta? meta.name : ''));
  FX_TITLE.base='观潮 · '+(name||'从种草到成交的全域账');
  var cur=document.title||'';
  if(cur.indexOf('观潮')===0 || cur.indexOf('🌊')===0 || cur.indexOf('〰')===0) document.title='🌊 '+FX_TITLE.base;
  if(!FX_TITLE.timer){
    FX_TITLE.timer=setInterval(function(){
      var t=document.title||'';
      if(t.indexOf('🌊')!==0 && t.indexOf('〰')!==0) return;
      FX_TITLE.flip=!FX_TITLE.flip;
      document.title=(FX_TITLE.flip?'〰 ':'🌊 ')+FX_TITLE.base;
    }, 1800);
  }
}

/* #20 折叠卡展开像账本翻开（样式里做轻微 3D 翻转），里面的数字从 0 滚到位 */
document.addEventListener('toggle', function(ev){
  var d=ev.target;
  if(FX_REDUCED || !d || d.tagName!=='DETAILS' || !d.open || !d.classList || !d.classList.contains('col-wrap')) return;
  [].slice.call(d.querySelectorAll('.col-body b, .col-body .num, .col-body .v')).slice(0, 24).forEach(function(n){ fxRoll(n, 650); });
}, true);

/* #10 鼠标停在某篇笔记行：大图里它的圆点跳一下、观察期区域亮起 */
function fxNotesHover(main, rNow){
  FX.notesR=rNow;
  var svg=main && main.querySelector('.nt-chart-box svg'); if(!svg || main._fxHover) return;
  main._fxHover=true;
  var cur=-1;
  function clear(){
    var s=main.querySelector('.nt-chart-box svg'); if(!s) return;
    [].slice.call(s.querySelectorAll('.nt-dot.fx-jump')).forEach(function(d){ d.classList.remove('fx-jump'); });
    var hl=s.querySelector('.fx-win'); if(hl) hl.parentNode.removeChild(hl);
  }
  main.addEventListener('mouseover', function(ev){
    var row=ev.target && ev.target.closest ? ev.target.closest('.nt-row') : null;
    var i=row? +row.getAttribute('data-i') : -1;
    if(i===cur) return;
    cur=i; clear();
    if(i<0) return;
    var s=main.querySelector('.nt-chart-box svg'); if(!s) return;
    var dot=s.querySelector('.nt-dot[data-i="'+i+'"]'); if(dot) dot.classList.add('fx-jump');
    var realEl=s.querySelector('.nt-real'); if(!realEl) return;
    var r=FX.notesR||{}, pts=wowParsePts(realEl.getAttribute('points')), n=(r.notes||[])[i];
    if(!n || n.p==null || !pts[n.p]) return;
    var x0=pts[n.p][0], x1=pts[Math.min(n.end, pts.length-1)][0];
    var vb=(s.getAttribute('viewBox')||'0 0 0 0').split(/\s+/).map(Number);
    var hl=wowMk('rect', { 'class':'fx-win', x:x0.toFixed(1), y:'0', width:Math.max(3, x1-x0).toFixed(1), height:String(vb[3]||250), rx:'4' });
    s.insertBefore(hl, s.firstChild);
  });
  main.addEventListener('mouseleave', function(){ cur=-1; clear(); });
}

/* ---- 达人合作账（extras.js）：投流去水分卡片下面 ---- */
function secKolLedger(r, sample){
  var sec=el('div','');
  sec.id='sec-kol-in';
  var GX=(typeof GuanchaoExtras!=='undefined')?GuanchaoExtras:null;
  if(!GX || typeof GX.renderKolLedger!=='function'){ return failCard(); }
  var kMeta=SHOP_META[state.shop]||{ name:'', m:'咨询', inCh:'站内', outCh:'站外', kind:'order' };
  try{
    GX.renderKolLedger(sec, { r:r, sample:sample, onExplain:function(title){
      var idx=-1;
      (r.notes||[]).some(function(x, j){ if(String(x.title)===String(title)){ idx=j; return true; } return false; });
      if(idx>=0) exdOpen(r, kMeta, idx);
    } });
  }catch(e){}
  if(!sec.innerHTML){ return el('div',''); }
  var LEC=(typeof LedgerEngine!=='undefined')?LedgerEngine:null;
  var kols=0;
  if(LEC && typeof LEC.kolLedger==='function'){
    try{ kols=(LEC.kolLedger(r)||[]).length; }catch(e){ kols=0; }
  }
  var w=wrapCollapse({
    id:'sec-kol', title:'达人合作账', sub:'这位博主值不值这个报价',
    key: kols?('合作达人 '+kols+' 位'):'按合作笔记直接带来的生意计'
  });
  w.querySelector('.col-body').appendChild(sec);
  return w;
}

function renderPlaceholder(tabId){
  var p=PH_COPY[tabId]||{icon:'🚧',title:'下一轮开放',text:'这个区块下一轮接上。'};
  var c=el('div','card ph-card card-float');
  c.innerHTML='<div class="ph-icon">'+p.icon+'</div><h2>'+esc(p.title)+'</h2><p>'+esc(p.text)+'</p>'+
    '<button class="btn-ghost">← 回总览</button>';
  c.querySelector('.btn-ghost').addEventListener('click',function(){ switchTab('overview'); });
  return c;
}
function renderMissingFiles(){
  var hasE=typeof LedgerEngine!=='undefined', hasS=typeof SAMPLES!=='undefined';
  var c=el('div','card ph-card card-float');
  c.innerHTML=
    '<div class="ph-icon">📦</div>'+
    '<h2>界面就绪，还差两个核心文件</h2>'+
    '<p>「观潮」的界面已经全部搭好，但计算引擎还没放进工作区（之前的附件链接已失效）。把这两个文件再发我一次，我<b>原样</b>放进去，所有数字就会由引擎算出来。</p>'+
    '<div class="ph-files">'+
      '<div>engine.js（LedgerEngine 计算引擎）　'+(hasE?'✅ 已就位':'⬜ 缺失')+'</div>'+
      '<div>samples.js（三家具示例店铺数据）　'+(hasS?'✅ 已就位':'⬜ 缺失')+'</div>'+
    '</div>';
  return c;
}
function renderError(msg){
  var c=el('div','card ph-card card-float');
  c.innerHTML='<div class="ph-icon">⚠️</div><h2>引擎没有跑起来</h2><p>'+esc(msg)+'</p>';
  return c;
}

/* ================= 笔记明细 ================= */
var NT = { shop:null, mode:0, sort:'time', exp:{}, _rs:false };
var NT_VC   = { real:'#16A05D', maybe:'#D99400', none:'#9A9AA4', live:'#4C6FFF' };
var NT_FILL = { real:'rgba(22,160,93,.15)', maybe:'rgba(217,148,0,.15)', none:'rgba(154,154,164,.12)', live:'rgba(76,111,255,.14)' };
var NT_TP = ['#FF2442','#4C6FFF','#16A05D','#D99400','#9A59C5','#00A3BF','#E8618C','#7C8A99'];

function ntKey(n){ return n.live ? 'live' : (n.verdict || 'none'); }
function ntVC(n){ return NT_VC[ntKey(n)] || NT_VC.none; }
function ntTypeColors(r){
  var m={}, c=0;
  (r.types||[]).forEach(function(t){ m[t.type]=NT_TP[c%NT_TP.length]; c++; });
  return m;
}
/* 当前模式对应的线：全部 / 站内 j / 站外 j */
function ntChan(r, mode){
  var j = (mode===1 && r.inIdx>=0) ? r.inIdx : (mode===2 && r.outIdx>=0) ? r.outIdx : -1;
  if(j>=0) return { j:j, y:r.ys[j], base:r.fits[j].baseline, sig:r.chSigma[j] };
  return { j:-1, y:r.y, base:r.baseline, sig:r.sigma };
}
/* 找某天落在哪篇笔记的观察窗里 */
function ntNoteAt(r, t){
  for(var i=0;i<r.notes.length;i++){ var n=r.notes[i]; if(t>=n.p && t<=n.end) return n; }
  return null;
}
function fx(v){ return v.toFixed(1); }

/* ================= v11：解释抽屉 + 步骤列表（通用） ================= */
/* 步骤列表：编号圆点 + title 加粗 + text 原样（textContent，防注入也保模板原样） */
function expStepsList(steps){
  var box=el('div','exp-steps');
  (steps||[]).forEach(function(st, i){
    var it=el('div','exp-step');
    var n=el('i','exp-step-n num'); n.textContent=String(i+1);
    var bd=el('div','exp-step-b');
    var t=el('b','exp-step-t'); t.textContent=String(st.title||'');
    var tx=el('span','exp-step-x'); tx.textContent=String(st.text||'');
    bd.appendChild(t); bd.appendChild(tx);
    it.appendChild(n); it.appendChild(bd);
    box.appendChild(it);
  });
  return box;
}

/* 强制 1 位小数（36 → 36.0）；带符号版本（24 → +24.0） */
function fx1(x){ if(!num(x)) return '—'; return x.toFixed(1); }
function fx1s(x){ if(!num(x)) return '—'; return (x>=0?'+':'')+x.toFixed(1); }

function fx2(x){ if(x==null||!isFinite(+x)) return '—'; return (+x).toFixed(2); }

/* v13：实验级示例（EXPERIMENT_DEMO，数据见 experiment_demo.v1.js；只读 LedgerEngine.experimentDemo 的结果） */
var GED_OPEN=false;
function gedStyle(){
  if(document.getElementById('ged-style')) return;
  var st=document.createElement('style'); st.id='ged-style';
  st.textContent=[
    '.ged-btn{font:inherit;font-size:13px;font-weight:700;color:#FF2442;background:#fff;border:1.5px solid #FFD1D8;border-radius:999px;padding:6px 14px;cursor:pointer;margin-top:12px;display:inline-flex;align-items:center;gap:6px}',
    '.ged-btn:hover{border-color:#FF2442}',
    '.ged-caret{display:inline-block;transition:transform .2s;font-size:11px;color:#FF2442}',
    '.ged-btn.open .ged-caret{transform:rotate(180deg)}',
    '.ged-panel{display:none;margin-top:12px;border-top:1px dashed #E8E4DF;padding-top:14px}',
    '.ged-panel.open{display:block}',
    '.ged-desc{margin:0;font-size:13px;color:#5D5D68;line-height:1.7}',
    '.ged-stats{display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin-top:12px}',
    '.ged-stat{background:#FAF9F7;border-radius:12px;padding:10px 12px}',
    '.ged-stat .k{font-size:12px;color:#5D5D68;font-weight:700}',
    '.ged-stat .v{font-size:22px;font-weight:800;font-variant-numeric:tabular-nums;margin-top:2px}',
    '.ged-stat .s{font-size:12px;color:#9A9AA4;margin-top:2px;line-height:1.5}',
    '@media (max-width:640px){.ged-stats{grid-template-columns:1fr}}',
    '.ged-verdict{margin:12px 0 0;font-size:14px;line-height:1.7;color:#17171C;display:flex;align-items:flex-start;gap:8px;flex-wrap:wrap}',
    '.ged-verdict .ge-lv{flex:none}',
    '.ged-tt{font-size:14px;font-weight:800;margin:14px 0 6px}',
    '.ged-table{width:100%;border-collapse:collapse;font-size:13px}',
    '.ged-table th,.ged-table td{border:1px solid #EDEAE5;padding:6px 10px;text-align:left;vertical-align:top}',
    '.ged-table th{background:#FAF9F7;font-weight:700;color:#2B2B33}',
    '.ged-table td:first-child{color:#5D5D68}',
    '.ged-table .num{font-variant-numeric:tabular-nums;white-space:nowrap}',
    '.ged-note{margin:10px 0 0;font-size:12.5px;color:#9A9AA4;line-height:1.7}',
    '.ged-foot{margin:10px 0 0;font-size:12.5px;color:#9A9AA4;line-height:1.7;border-top:1px dashed #E8E4DF;padding-top:10px}'
  ].join('\n');
  document.head.appendChild(st);
}
function mountExpDemo(host, d){
  gedStyle();
  var ex=d.exp, es=d.est, tr=d.truth, be=d.be;
  var verdict;
  if(ex.significant){
    verdict='差值超出了随机波动（约 95% 把握）：投流真实效果 ≈ 每篇 '+fx1(ex.diff)+' 个咨询，每 1 元换回 '+fx2(ex.roi)+' 元（保本线 '+fx2(be)+' 元）→ 实验级结论：'+((num(ex.roi)&&num(be)&&ex.roi>=be)?'值得投':'亏了');
  }else{
    verdict='差值还在随机波动内：还不能下实验级结论，需要再多几篇';
  }
  var panel=el('div','ged-panel');
  panel.innerHTML=
    '<p class="ged-desc">示例：远帆留学工作室按观潮的方案做完一轮对照实验（模拟数据）。9月10日起每 7 天发一篇，共 14 篇；单数篇发布后第 3 天投流 ¥1,690，双数篇不投。</p>'+
    '<div class="ged-stats">'+
      '<div class="ged-stat"><div class="k">投流组</div><div class="v">'+fx1(ex.meanBoost)+'</div><div class="s">'+ex.nBoost+' 篇，平均每篇多带来的咨询</div></div>'+
      '<div class="ged-stat"><div class="k">不投组</div><div class="v">'+fx1(ex.meanHold)+'</div><div class="s">'+ex.nHold+' 篇，平均每篇多带来的咨询</div></div>'+
      '<div class="ged-stat"><div class="k">差值</div><div class="v">'+fx1s(ex.diff)+'</div><div class="s">可能 '+fx1(ex.lo)+'～'+fx1(ex.hi)+'</div></div>'+
    '</div>'+
    '<p class="ged-verdict"><span class="ge-lv exp">实验级</span><span>'+esc(verdict)+'</span></p>'+
    '<div class="ged-tt">三种口径放在一起</div>'+
    '<table class="ged-table"><thead><tr><th>列</th><th>每篇投流带来</th><th>每 1 元换回</th></tr></thead><tbody>'+
      '<tr><td>实验级（两组相比）</td><td class="num">'+fx1(ex.diff)+' 个</td><td class="num">'+fx2(ex.roi)+' 元</td></tr>'+
      '<tr><td>估算级（同一批投流笔记去水分）</td><td class="num">'+fx1(es.meanReal)+' 个</td><td class="num">'+fx2(es.roi)+' 元</td></tr>'+
      '<tr><td>模拟器设定的真实效果</td><td class="num">'+tr.perNote+' 个</td><td class="num">'+fx2(tr.roi)+' 元</td></tr>'+
    '</tbody></table>'+
    '<p class="ged-note">估算级和实验级都接近设定值：不做实验时的"去水分"估计也靠得住，实验把它从估算级升级成了实验级。</p>'+
    '<p class="ged-foot">换成你自己的数据：在「导入数据」的笔记记录里给"实验分组"列填 boost 或 hold，账本会自动给出实验级结论。</p>';
  var btn=el('button','ged-btn');
  btn.type='button';
  btn.innerHTML='看一个实验级的例子<span class="ged-caret">▾</span>';
  if(GED_OPEN){ btn.classList.add('open'); panel.classList.add('open'); }
  btn.addEventListener('click', function(){
    GED_OPEN=panel.classList.toggle('open');
    btn.classList.toggle('open', GED_OPEN);
    /* v20：两组数字赛跑式同涨，差值弹出并盖「实验级」章 */
    if(GED_OPEN && !FX_REDUCED){
      var vs=panel.querySelectorAll('.ged-stat .v');
      if(vs[0]) fxRoll(vs[0], 900); if(vs[1]) fxRoll(vs[1], 900);
      if(vs[2]){ vs[2].classList.remove('fx-pop'); void vs[2].offsetWidth; vs[2].classList.add('fx-pop'); }
      var lv=panel.querySelector('.ged-verdict .ge-lv'); if(lv){ lv.classList.remove('fx-stamp'); void lv.offsetWidth; lv.classList.add('fx-stamp'); }
    }
  });
  var ge=host.querySelector('.ge');
  if(ge){ ge.appendChild(btn); ge.appendChild(panel); }
}
/* ---- 「这笔账怎么算的」抽屉 ---- */
var EXD={ shop:'', tab:'', open:false };
function exdEnsure(){
  var w=document.querySelector('.exd-wrap');
  if(w) return w;
  w=el('div','exd-wrap');
  w.innerHTML='<div class="exd-mask"></div><div class="exd-panel" role="dialog" aria-label="这笔账怎么算的"><button class="exd-close" aria-label="关闭">×</button><div class="exd-body"></div></div>';
  w.querySelector('.exd-mask').addEventListener('click', exdClose);
  w.querySelector('.exd-close').addEventListener('click', exdClose);
  document.body.appendChild(w);
  return w;
}
function exdClose(){
  EXD.open=false;
  var w=document.querySelector('.exd-wrap');
  if(w) w.classList.remove('show');
}
function exdOpen(r, meta, i){
  var LEC=(typeof LedgerEngine!=='undefined')?LedgerEngine:null;
  if(!LEC || typeof LEC.explainNote!=='function') return;
  var rb=null;
  try{ rb=getRobust(r); }catch(e){}
  var ex=null;
  try{ ex=LEC.explainNote(r, i, rb); }catch(e){}
  if(!ex) return;
  var w=exdEnsure();
  var body=w.querySelector('.exd-body');
  body.innerHTML='';
  /* 1. 顶部：标题 / 类型 / 日期 / 结论 / 可信度（沿用笔记行样式） */
  var k=ex.live? 'live' : (ex.verdict||'none');
  var vc=NT_VC[k]||NT_VC.none;
  var exN=(r.notes||[])[i]||{};
  var exRb=(rb && rb.perNote && rb.perNote[i] && !ex.live)? (rb.perNote[i].robust===true) : null;
  var confHtml=evPillHtml({ grade:noteGrade(exN), robust:exRb, conf:ex.confidence||null });
  var head=el('div','exd-head');
  head.innerHTML=
    '<div class="exd-title">'+esc(ex.title)+'</div>'+
    '<div class="exd-meta">'+
      '<span class="nt-type" style="color:'+vc+';background:'+vc+'1F">'+esc(ex.type)+'</span>'+
      '<span class="num">'+esc(fmtDayMD(ex.date))+'</span>'+
      '<span class="nt-verdict" style="color:'+vc+';background:'+vc+'1F">'+esc(ex.verdictLabel)+'</span>'+
      confHtml+
    '</div>';
  body.appendChild(head);
  /* 2. 小柱图：观察期每天 平时预计（浅灰）/ 实际（红）；挂进 DOM 后按真实宽度画 */
  var exdCh=exdChart(ex);
  body.appendChild(exdCh);
  exdChartDraw(exdCh);
  var sumRow=el('p','exd-sum');
  sumRow.innerHTML='这 '+esc(String(ex.window.days))+' 天合计：实际 <b class="num">'+fmtInt(ex.sumActual)+'</b> · 平时预计 <b class="num">'+fx1(ex.sumBaseline)+'</b> · 多出 <b class="num">'+fx1s(ex.total)+'</b>';
  body.appendChild(sumRow);
  /* 3. 算账步骤 */
  var stHead=el('div','exd-steps-h');
  stHead.textContent='算账步骤';
  body.appendChild(stHead);
  body.appendChild(expStepsList(ex.steps));
  /* 4. 底部灰字 */
  body.appendChild(el('p','exd-foot','数字由算法算出；文字为固定模板，不是 AI 生成。'));
  EXD.open=true; EXD.shop=state.shop; EXD.tab=state.tab;
  w.classList.add('show');
  body.scrollTop=0;
}
/* 小柱图（SVG，width:100% 自适应）
   v18：先量出图的真实宽度再画——柱子和柱顶数值保持原样；日期标签按真实 11px 画（首日「6月21日」，其余「22日」，换月时带月份），
        挤不下就隔开隐藏，任何宽度都不重叠；图例移到横轴下方 */
function exdChart(ex){
  var holder=el('div','exd-chart');
  holder._ex=ex;
  return holder;
}
function exdChartDraw(holder){
  var ex=holder && holder._ex, days=(ex && ex.days)||[];
  if(!days.length) return;
  var bw=9, gap=3, grp=bw*2+gap, padL=26, padR=10, padT=22, plotH=148;
  var W=padL+padR+grp*days.length;
  var px=(holder.clientWidth||0)-16;
  var sc=(px>0)? px/W : 2;
  function u(p){ return p/sc; }
  var base=padT+plotH;
  var yDate=base+u(15), yWeek=base+u(29), yLeg=base+u(50), H=yLeg+u(8);
  var hi=0;
  days.forEach(function(d){ hi=Math.max(hi, d.actual, d.baseline); });
  if(!(hi>0)) hi=1;
  function Y(v){ return padT+plotH*(1-Math.max(0,v)/hi); }
  var fsAx=fx(u(11)), fsLg=fx(u(12));
  var s='', prevM=null;
  days.forEach(function(d, i){
    var x0=padL+grp*i;
    /* 平时预计：浅灰柱（左），1 位小数标柱上方 */
    var yb=Y(d.baseline);
    s+='<rect class="exd-bar" style="animation-delay:'+(i*0.07).toFixed(2)+'s" x="'+(x0+1)+'" y="'+fx(yb)+'" width="'+bw+'" height="'+fx(Math.max(1,plotH-(yb-padT)))+'" rx="2" fill="#D8D3C9"></rect>';
    s+='<text class="exd-cb" x="'+(x0+1+bw/2)+'" y="'+fx(yb-4)+'">'+fx1(d.baseline)+'</text>';
    /* 实际：红柱（右），整数标柱上方 */
    var ya=Y(d.actual);
    s+='<rect class="exd-bar" style="animation-delay:'+(i*0.07+0.03).toFixed(2)+'s" x="'+(x0+1+bw+2)+'" y="'+fx(ya)+'" width="'+bw+'" height="'+fx(Math.max(1,plotH-(ya-padT)))+'" rx="2" fill="#FF2442"></rect>';
    s+='<text class="exd-ca" x="'+(x0+1+bw*1.5+2)+'" y="'+fx(ya-4)+'">'+fmtInt(d.actual)+'</text>';
    /* x 轴：首日和换月那天写「6月21日」，其余只写「22日」；下面一行星期 */
    var lab=String(d.label||''), m=lab.match(/^(\d+)月(\d+)日$/), short=lab;
    if(m){ short=(i===0 || m[1]!==prevM)? lab : (m[2]+'日'); prevM=m[1]; }
    s+='<text class="exd-cx" data-i="'+i+'" x="'+(x0+1+bw)+'" y="'+fx(yDate)+'" style="font-size:'+fsAx+'px">'+esc(short)+'</text>';
    s+='<text class="exd-cw" data-i="'+i+'" x="'+(x0+1+bw)+'" y="'+fx(yWeek)+'" style="font-size:'+fsAx+'px">'+esc(d.weekday)+'</text>';
  });
  /* 图例：横轴下方 */
  var lx=padL, sq=u(10);
  s+='<rect x="'+fx(lx)+'" y="'+fx(yLeg-u(9))+'" width="'+fx(sq)+'" height="'+fx(sq)+'" rx="'+fx(u(2))+'" fill="#D8D3C9"></rect>';
  s+='<text class="exd-clg exd-lg1" x="'+fx(lx+u(14))+'" y="'+fx(yLeg)+'" style="font-size:'+fsLg+'px">平时预计</text>';
  s+='<rect class="exd-lg2r" x="'+fx(lx+u(80))+'" y="'+fx(yLeg-u(9))+'" width="'+fx(sq)+'" height="'+fx(sq)+'" rx="'+fx(u(2))+'" fill="#FF2442"></rect>';
  s+='<text class="exd-clg exd-lg2" x="'+fx(lx+u(94))+'" y="'+fx(yLeg)+'" style="font-size:'+fsLg+'px">实际</text>';
  holder.innerHTML='<'+'svg viewBox="0 0 '+W+' '+fx(H)+'" style="width:100%;height:auto;display:block" role="img" aria-label="观察期每天：平时预计与实际"></svg>';
  var svg=holder.querySelector('svg');
  if(!svg) return;
  svg.innerHTML=s;
  /* 图例第二项紧跟第一项文字之后 */
  try{
    var t1=svg.querySelector('.exd-lg1'), w1=t1.getComputedTextLength();
    if(w1>0){
      var x2=lx+u(14)+w1+u(14);
      svg.querySelector('.exd-lg2r').setAttribute('x', fx(x2));
      svg.querySelector('.exd-lg2').setAttribute('x', fx(x2+u(14)));
    }
  }catch(e){}
  /* 日期挤不下：从左到右，和上一个保留的标签距离不足就隐藏（同一天的星期一起隐藏） */
  try{
    var xs=svg.querySelectorAll('.exd-cx'), ws=svg.querySelectorAll('.exd-cw'), lastR=-1e9, minGap=u(4);
    /* 首日标签较长：先往左挪（左边留白够用），挪完还挤才隐藏后面的 */
    if(xs.length>1){
      var w0=xs[0].getComputedTextLength(), w1b=xs[1].getComputedTextLength();
      var c0=+xs[0].getAttribute('x'), c1=+xs[1].getAttribute('x');
      var over=(c0+w0/2+minGap)-(c1-w1b/2);
      if(w0>0 && over>0){ var c0n=Math.max(u(2)+w0/2, c0-over-u(1.5)); xs[0].setAttribute('x', fx(c0n)); }
    }
    for(var k=0;k<xs.length;k++){
      var tw=Math.max(xs[k].getComputedTextLength(), ws[k]? ws[k].getComputedTextLength() : 0);
      var cx=+xs[k].getAttribute('x'), left=cx-tw/2, right=cx+tw/2;
      if(tw>0 && left<lastR+minGap){ xs[k].style.display='none'; if(ws[k]) ws[k].style.display='none'; }
      else{ lastR=right; }
    }
  }catch(e){}
}
function fmtDayMD(ds){
  var d=parseDate(ds);
  if(!d) return ds||'';
  return (d.getMonth()+1)+'月'+d.getDate()+'日';
}

/* ---- 1. 「每天的{M}」折线图 ---- */
function ntChartCard(r, meta){
  var card=el('section','card card-float');
  var dual = r.inIdx>=0 && r.outIdx>=0 && r.channels && r.channels.length>1;
  var head=el('div','h2-row');
  head.innerHTML='<h2>每天的'+esc(meta.m)+'</h2>';
  if(dual){
    var seg=el('div','seg nt-seg');
    ['全部','站内','站外'].forEach(function(label, k){
      var b=el('button','seg-btn'+(NT.mode===k?' active':''), label);
      b.addEventListener('click', function(){ NT.mode=k; render(); });
      seg.appendChild(b);
    });
    head.appendChild(seg);
  }
  card.appendChild(head);
  card.appendChild(el('p','inv-sub nt-chart-sub',
    '深灰实线是实际每天的量，虚线是平时的样子，浅红色带是平时的正常波动；顶部每个圆点是一篇笔记（点一下跳到下面的账），红色的「¥」是投流开始的那天。'));

  var box=el('div','nt-chart-box');
  card.appendChild(box);
  return card;
}

/* 量出实际像素宽再画：坐标全用真实 px，轴文字 12px 即 12px */
function ntChartFill(box, r, meta){
  var ch=ntChan(r, NT.mode);
  var W=Math.round(box.clientWidth)||640;
  if(!isFinite(W) || W<280) W=640;
  NT._w=W;
  while(box.firstChild) box.removeChild(box.firstChild);
  var built=ntChartSVG(r, meta, ch, W);
  box.appendChild(built.node);
  ntBindChart(box, r, ch, built.g);
  try{ wowChart(box, r); }catch(e){}
}

function ntChartSVG(r, meta, ch, W){
  var N=r.dates.length;
  W=Math.round(W)||640; if(!isFinite(W)||W<280) W=640;
  var H=252;
  var padL=42, padR=14, padT=48, padB=26;
  var PW=W-padL-padR, PH=H-padT-padB;
  var band=1.645*(ch.sig||0);
  var lo=Infinity, hi=-Infinity, t;
  for(t=0;t<N;t++){
    lo=Math.min(lo, ch.y[t], ch.base[t]-band);
    hi=Math.max(hi, ch.y[t], ch.base[t]+band);
  }
  var pad=(hi-lo)*0.06||1; lo-=pad; hi+=pad;
  function X(i){ return padL+PW*i/(N-1); }
  function Y(v){ return padT+PH*(1-(v-lo)/(hi-lo)); }

  /* 网格与 y 轴刻度 */
  var span=hi-lo, steps=[1,2,2.5,5], ystep=10;
  for(var s10=0.1; s10<1e5; s10*=10){
    for(var q=0;q<steps.length;q++){
      if(span/steps[q]/s10<=4){ ystep=steps[q]*s10; s10=1e6; break; }
    }
  }
  var grid='', ylab='';
  for(var v=Math.ceil(lo/ystep)*ystep; v<=hi; v+=ystep){
    grid+='<line class="nt-grid" x1="'+padL+'" y1="'+fx(Y(v))+'" x2="'+(W-padR)+'" y2="'+fx(Y(v))+'"></line>';
    ylab+='<text class="nt-ax nt-ax-y" x="'+(padL-7)+'" y="'+fx(Y(v)+4)+'">'+fmtInt(v)+'</text>';
  }
  /* x 轴日期 */
  var want=Math.max(3, Math.floor(W/95));
  var lstep=Math.ceil((N-1)/want/5)*5, xlab='';
  for(t=0;t<N;t+=lstep){
    var d=parseDate(r.dates[t]);
    xlab+='<text class="nt-ax nt-ax-x" x="'+fx(Math.min(W-padR-18, Math.max(padL+18, X(t))))+'" y="'+(H-8)+'">'+(d?fmtDay(d):'')+'</text>';
  }
  /* 浅红色带：平时 ±1.645σ */
  var bp='';
  for(t=0;t<N;t++) bp+=(t?'L':'M')+fx(X(t))+' '+fx(Y(ch.base[t]+band));
  for(t=N-1;t>=0;t--) bp+='L'+fx(X(t))+' '+fx(Y(ch.base[t]-band));
  bp+='Z';
  /* 虚线（平时）与实线（实际） */
  var dline='', aline='';
  for(t=0;t<N;t++){ dline+=fx(X(t))+','+fx(Y(ch.base[t]))+' '; aline+=fx(X(t))+','+fx(Y(ch.y[t]))+' '; }
  /* 每篇笔记的半透明填充 + 顶部圆点 + ¥ */
  var fills='', dots='', yens='';
  r.notes.forEach(function(n, i){
    var k=ntKey(n);
    var pth='M'+fx(X(n.p))+' '+fx(Y(ch.y[n.p]));
    for(t=n.p+1;t<=n.end;t++) pth+='L'+fx(X(t))+' '+fx(Y(ch.y[t]));
    for(t=n.end;t>=n.p;t--) pth+='L'+fx(X(t))+' '+fx(Y(ch.base[t]));
    pth+='Z';
    fills+='<path d="'+pth+'" fill="'+NT_FILL[k]+'"></path>';
    dots+='<circle class="nt-hit" data-i="'+i+'" cx="'+fx(X(n.p))+'" cy="16" r="12" fill="transparent"><title>'+nTitle(n)+'</title></circle>'+
      '<circle class="nt-dot" data-i="'+i+'" cx="'+fx(X(n.p))+'" cy="16" r="5.5" fill="'+ntVC(n)+'" stroke="#fff" stroke-width="1.5"><title>'+nTitle(n)+'</title></circle>';
    if(n.b!=null) yens+='<text class="nt-yen" text-anchor="middle" x="'+fx(X(n.b))+'" y="34">¥</text>';
  });

  var holder=el('div');
  holder.innerHTML=
    '<'+'svg viewBox="0 0 '+W+' '+H+'" width="'+W+'" height="'+H+'" style="width:100%;height:auto" role="img" aria-label="每天的'+esc(meta.m)+'折线图">'+
      grid+ylab+xlab+
      '<path d="'+bp+'" fill="rgba(255,36,66,.06)"></path>'+
      fills+
      '<polyline class="nt-base" points="'+dline+'"></polyline>'+
      '<polyline class="nt-real" points="'+aline+'"></polyline>'+
      yens+dots+
      '<line class="nt-vline" x1="0" y1="'+padT+'" x2="0" y2="'+(H-padB)+'" style="display:none"></line>'+
      '<circle class="nt-marker" r="4" style="display:none"></circle>'+
      '<rect class="nt-hover" x="'+padL+'" y="'+(padT-10)+'" width="'+PW+'" height="'+(PH+10)+'" fill="rgba(0,0,0,0)"></rect>'+
    '</svg>';
  var svg=holder.querySelector('svg');
  return { node: svg || holder, g: { X:X, Y:Y, W:W, N:N, padL:padL, PW:PW } };
}

/* 悬停/点按：竖线 + 提示框；点圆点：跳到下方对应笔记 */
function ntBindChart(box, r, ch, g){
  if(typeof box.getBoundingClientRect!=='function') return;
  function q(cls){
    var list=[];
    (function walk(n){
      var cn = (n.getAttribute && n.getAttribute('class')) || (typeof n.className==='string' ? n.className : '');
      if(cn.split(/\s+/).indexOf(cls)>=0) list.push(n);
      var ch=n.children||[];
      for(var i=0;i<ch.length;i++) walk(ch[i]);
    })(box);
    return list;
  }
  q('nt-dot').concat(q('nt-hit')).forEach(function(d){
    d.addEventListener('click', function(ev){
      if(ev && ev.stopPropagation) ev.stopPropagation();
      var i=+(d.getAttribute('data-i')||0);
      NT.exp[i]=true; render();
      setTimeout(function(){
        var row=$('.nt-row[data-i="'+i+'"]');
        if(row && typeof row.scrollIntoView==='function') row.scrollIntoView({behavior:'smooth', block:'center'});
      }, 40);
    });
  });
  var hovers=q('nt-hover');
  if(!hovers.length) return;
  var svg=hovers[0].parentNode;
  if(!svg || typeof svg.getBoundingClientRect!=='function') return;
  var hover=hovers[0], vl=q('nt-vline')[0], mk=q('nt-marker')[0];
  var tip=el('div','nt-tip'); tip.style.display='none'; box.appendChild(tip);

  /* v11：悬停浮层升级为 dayInfo 详情（竖线 + 左右自适应 + 点空白关闭） */
  var LEC=(typeof LedgerEngine!=='undefined')?LedgerEngine:null;
  var docHide=null;
  function show(ev){
    if(ev.clientX==null) return;
    var bb=svg.getBoundingClientRect(), sc=bb.width? bb.width/g.W : 1;
    var px=(ev.clientX-bb.left)/sc;
    var t=Math.round((px-g.padL)/(g.PW/(g.N-1)));
    t=Math.max(0, Math.min(g.N-1, t));
    var x=g.X(t);
    vl.setAttribute('x1', fx(x)); vl.setAttribute('x2', fx(x)); vl.style.display='';
    mk.setAttribute('cx', fx(x)); mk.setAttribute('cy', fx(g.Y(ch.y[t]))); mk.style.display='';
    var info=(LEC && typeof LEC.dayInfo==='function')? LEC.dayInfo(r, t) : null;
    if(info){
      var chLine=(info.channels||[]).map(function(c){ return esc(c.name)+' '+fmtInt(c.actual); }).join(' · ');
      var html='<b>'+esc(info.label)+' '+esc(info.weekday)+'</b>'+
        '<span>实际 '+fmtInt(info.actual)+'</span>'+
        '<span>平时预计 '+fx1(info.baseline)+'（正常范围 '+fmtInt(Math.max(0,info.lo))+'～'+fmtInt(info.hi)+'）</span>'+
        (chLine? '<span>'+chLine+'</span>' : '');
      if(info.notes && info.notes.length) html+='<span class="tip-note">在「'+esc(info.notes[0])+'」观察期内</span>';
      if(info.boosts && info.boosts.length) html+='<span class="tip-boost">投流中</span>';
      if(info.clean) html+='<span class="tip-clean">干净日（用来估平时的样子）</span>';
      if(info.promo) html+='<span class="tip-promo">大促 / 节日（已从平时的样子里剔除）</span>';
      tip.innerHTML=html;
    }else{
      var d0=parseDate(r.dates[t]);
      tip.innerHTML='<b>'+(d0?fmtDayWeek(d0):'')+'</b><span>实际 '+fmtInt(ch.y[t])+' 个 · 平时约 '+fmt1(ch.base[t])+'</span>';
    }
    tip.style.display='block';
    /* 靠右时显示在鼠标左侧 */
    var tipW=tip.offsetWidth||206;
    var dispX=x*sc;
    var left;
    if(dispX+tipW+14 > bb.width) left=Math.max(2, dispX-tipW-12);
    else left=Math.min(bb.width-tipW-2, dispX+12);
    tip.style.left=left+'px';
    tip.style.top='4px';
    if(!docHide){
      docHide=function(ev2){
        if(!box.contains(ev2.target)){ hide(); }
      };
      document.addEventListener('pointerdown', docHide, true);
    }
  }
  function hide(){
    if(vl) vl.style.display='none';
    if(mk) mk.style.display='none';
    if(tip) tip.style.display='none';
    if(docHide){ document.removeEventListener('pointerdown', docHide, true); docHide=null; }
  }
  hover.addEventListener('pointermove', show);
  hover.addEventListener('pointerdown', show);
  hover.addEventListener('pointerleave', hide);
}

/* ---- 2. 左卡「每篇笔记的账」 ---- */
function ntListCard(r, meta, tcMap){
  var card=el('section','card card-float');
  var head=el('div','h2-row');
  head.innerHTML='<h2>每篇笔记的账</h2>';
  var seg=el('div','seg nt-seg');
  [['time','按时间'],['effect','按效果']].forEach(function(p){
    var b=el('button','seg-btn'+(NT.sort===p[0]?' active':''), p[1]);
    b.addEventListener('click', function(){ NT.sort=p[0]; render(); });
    seg.appendChild(b);
  });
  head.appendChild(seg);
  card.appendChild(head);
  card.appendChild(el('p','inv-sub', '点一行展开解释；每行下面的细条是它带来的量里站内（红）／站外（蓝）的占比。'));

  if(!r.notes.length){
    card.appendChild(el('p','inv-sub','这段时间还没有发过笔记。'));
    return card;
  }
  var order=r.notes.map(function(n,i){ return i; });
  if(NT.sort==='time') order.sort(function(a,b){ return r.notes[b].p-r.notes[a].p; });
  else order.sort(function(a,b){ return (r.notes[b].total||0)-(r.notes[a].total||0); });
  order.forEach(function(i){ card.appendChild(ntRow(r, meta, i, tcMap)); });
  return card;
}

function ntRow(r, meta, i, tcMap){
  var n=r.notes[i];
  var k=ntKey(n), vc=ntVC(n), tc=tcMap[n.type]||'#9A9AA4';
  var vLabel = n.live ? ('进行中 · 第 '+n.len+' 天')
    : (n.verdict==='real' ? '真有效' : n.verdict==='maybe' ? '可能是巧合' : '没看到效果');
  var plus=(n.total>=0?'+':'')+fmt1(n.total);
  var range = n.live ? '' : '<span class="nt-range num">可能 '+fmtInt(Math.max(0, n.lo||0))+'~'+fmtInt(n.hi||0)+'</span>';
  var LEC=(typeof LedgerEngine!=='undefined')?LedgerEngine:null;
  var nConf=null;
  if(LEC && typeof LEC.confidence==='function'){
    try{ nConf=LEC.confidence(n.organic!=null?n.organic:n.total, n.bandN); }catch(e){}
  }
  var d=nDate(n) || (r.dates[n.p]?parseDate(r.dates[n.p]):null);
  var inPct = (n.outShare==null || !num(n.outShare)) ? 100 : Math.round((1-n.outShare)*100);
  /* v6：稳健标签（非进行中的笔记）+ 估算级 */
  var LECRB=(typeof LedgerEngine!=='undefined')?LedgerEngine:null;
  var rbP=null;
  if(!n.live && LECRB && typeof LECRB.robustness==='function'){
    var rbx=getRobust(r);
    if(rbx && rbx.perNote && rbx.perNote[i]) rbP=rbx.perNote[i];
  }
  /* v14：结论标签旁只留一个灰色胶囊「估算级 · 稳健 · 可信度中」，点它打开「这笔账怎么算的」 */
  var sideExtra=evPillHtml({ grade:noteGrade(n), robust:(!n.live && rbP)? (rbP.robust===true) : null, conf:nConf, explain:(n.title||String(i)) });
  var head=el('div','nt-head');
  head.innerHTML=
    '<i class="nt-vbar" style="background:'+vc+'"></i>'+
    '<div class="nt-body">'+
      '<div class="nt-t1" title="'+nTitle(n)+'">'+nTitle(n)+'</div>'+
      '<div class="nt-t2">'+
        '<span class="nt-type" style="color:'+tc+';background:'+tc+'1F">'+esc(n.type)+'</span>'+
        (n.kol_cost ? '<span class="nt-kol">达人合作 '+fmtMoney(n.kol_cost)+'</span>' : '')+
        '<span>'+(d?fmtDay(d):'—')+'</span>'+
        (n.boost_cost ? '<span class="num">投流 '+fmtMoney(n.boost_cost)+'</span>' : '')+
        (n.promo ? '<span class="nt-promo">观察期碰到大促</span>' : '')+
        (n.misjudged ? '<span class="nt-mis">只看站内会误判</span>' : '')+
      '</div>'+
      '<div class="nt-share" title="站内/站外占比"><i style="width:'+inPct+'%"></i></div>'+
    '</div>'+
    '<div class="nt-side">'+
      '<span class="nt-verdict'+(!n.live && n.verdict==='real'?' v-real':'')+'" style="color:'+vc+';background:'+vc+'1F">'+vLabel+'</span>'+
      sideExtra+
      '<b class="nt-plus num'+(n.total<0?' neg':'')+'">'+plus+'</b>'+
      range+
      '<button class="nt-calc" title="这笔账怎么算的" aria-label="这笔账怎么算的"><'+'svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="4" y="2" width="16" height="20" rx="2"/><line x1="8" y1="6" x2="16" y2="6"/><line x1="8" y1="11" x2="8" y2="11.01"/><line x1="12" y1="11" x2="12" y2="11.01"/><line x1="16" y1="11" x2="16" y2="11.01"/><line x1="8" y1="15" x2="8" y2="15.01"/><line x1="12" y1="15" x2="12" y2="15.01"/><line x1="16" y1="15" x2="16" y2="18"/><line x1="8" y1="18" x2="12" y2="18"/></svg>这笔账怎么算的</button>'+
    '</div>';
  /* v11：点「这笔账怎么算的」打开抽屉（不触发行展开） */
  var calcBtn=head.querySelector('.nt-calc');
  if(calcBtn){
    calcBtn.addEventListener('click', function(ev){
      ev.stopPropagation();
      exdOpen(r, meta, i);
    });
  }
  /* v14：点胶囊也打开抽屉；「换算法会变」悬停时列出哪种算法下会变 */
  bindEvPill(head, r, meta, i);
  var evP=head.querySelector('.gx-ev');
  if(evP && rbP && rbP.robust===false && rbP.changed && rbP.changed.length){
    evP.title='换算法后：'+rbP.changed.join('；')+'。点开看这笔账怎么算的';
  }
  var row=el('div','nt-row'+(NT.exp[i]?' open':''));
  row.dataset.i=i;
  row.appendChild(head);
  if(NT.exp[i]) row.appendChild(ntDetail(r, meta, n));
  head.addEventListener('click', function(){ NT.exp[i]=!NT.exp[i]; render(); });
  return row;
}

function ntDetail(r, meta, n){
  var sb=0, sa=0, k;
  for(k=n.p;k<=n.end && k<r.dates.length;k++){ sb+=r.baseline[k]; sa+=r.y[k]; }
  var inV=(n.byCh && r.inIdx>=0)? n.byCh[r.inIdx] : null;
  var outV=(n.byCh && r.outIdx>=0)? n.byCh[r.outIdx] : null;
  var L=[];
  L.push('平时这几天大约 <b class="num">'+fmt1(sb)+'</b> 个，实际 <b class="num">'+fmt1(sa)+'</b> 个，多出 <b class="num">'+(n.total>=0?'+':'')+fmt1(n.total)+'</b>。');
  if(inV!=null || outV!=null)
    L.push('其中站内 <b class="num">'+fmt1(inV||0)+'</b> 个、站外 <b class="num">'+fmt1(outV||0)+'</b> 个。');
  if(n.boost && !n.boost.merged)
    L.push('投流真带来 <b class="num">'+fmt1(n.boost.real)+'</b> 个（花了 '+fmtMoney(n.boost.cost)+'，回报约 '+fmt2(n.boost.roiReal)+' 倍）。');
  if(n.boost && n.boost.merged)
    L.push('这篇发布和投流是同一天开始的，投流的贡献单独算不出来。');
  /* v6：观察期碰到大促（进行中笔记，解释末尾） */
  if(n.promo)
    L.push('这几天的大促已从"平时的样子"里剔除，但笔记效果里可能混有大促带来的量，结论请谨慎');
  if(n.live){
    var d1=Math.round(r.y[n.p]), d2=(n.p+1<r.dates.length)?Math.round(r.y[n.p+1]):0;
    var o=r.light(n.date||r.dates[n.p], d1, d2);
    var ttl=o.color==='green'?'建议投流':(o.color==='yellow'?'再等一天':'先别投');
    var extra='';
    if(o.color==='green' && o.bm && o.bm.ok && o.spend>0){
      var per=o.bm.curve(o.spend*o.bm.G).units/o.bm.G;
      var roi=per*r.uv/o.spend;
      extra='建议投 '+fmtMoney(o.spend)+'：预计再多带来约 '+fmt1(per)+' 个'+meta.m+'，每花 1 元换回 '+fmt2(roi)+' 元（保本线 '+fmt2(r.be)+' 元）。';
    }
    var d=el('div','nt-detail');
    d.innerHTML=
      L.map(function(x){ return '<p>'+x+'</p>'; }).join('')+
      '<div class="nt-light">'+
        '<div class="tlight-row">'+
          '<div class="tlight-shell" aria-hidden="true">'+
            '<span class="tlight-lamp tlight-red'+(o.color==='red'?' on':'')+'"></span>'+
            '<span class="tlight-lamp tlight-yellow'+(o.color==='yellow'?' on':'')+'"></span>'+
            '<span class="tlight-lamp tlight-green'+(o.color==='green'?' on':'')+'"></span>'+
          '</div>'+
          '<div class="tlight-text v-'+o.color+'">'+
            '<h3>'+ttl+'</h3>'+
            '<p>平时这两天大约 '+fmt1(o.b1+o.b2)+' 个，这篇来了 '+fmtInt(d1+d2)+' 个，多出 '+(o.ex>=0?'+':'')+fmt1(o.ex)+'（正常波动约 ±'+fmt1(o.thr)+'）。</p>'+
            (extra?('<p>'+extra+'</p>'):'')+
          '</div>'+
        '</div>'+
      '</div>';
    return d;
  }
  if(n.verdict==='real')
    L.push('多出的量超过了正常波动范围（±<b class="num">'+fmt1(n.bandN)+'</b>），基本可以排除巧合。');
  else if(n.verdict==='maybe')
    L.push('多出的量在正常波动范围（±<b class="num">'+fmt1(n.bandN)+'</b>）以内，可能是巧合。');
  else
    L.push('观察期里没跑赢平时水平，这篇没看到带来什么。');
  if(n.cutByNext)
    L.push('观察期被下一篇笔记截短（只观察到 '+n.len+' 天），实际效果可能被低估。');
  /* v6：观察期碰到大促（已完成笔记，解释末尾） */
  if(n.promo)
    L.push('这几天的大促已从"平时的样子"里剔除，但笔记效果里可能混有大促带来的量，结论请谨慎');
  var d=el('div','nt-detail');
  d.innerHTML=L.map(function(x){ return '<p>'+x+'</p>'; }).join('');
  return d;
}

/* ---- 3. 右卡「什么内容最带货」 ---- */
function ntTypesCard(r, meta){
  var card=el('section','card card-float');
  /* v10：行动包「内容稿 · 看依据」的跳转锚点 */
  card.id='card-types';
  card.innerHTML='<div class="h2-row"><h2>什么内容最带货</h2></div>';
  card.appendChild(el('p','inv-sub','每类笔记平均多带来的'+esc(meta.m)+'，条越长越能带。'));
  var types=r.types||[];
  if(!types.length){
    card.appendChild(el('p','inv-sub','还没有能算的笔记。'));
    return card;
  }
  var maxA=Math.max.apply(null, types.map(function(t){ return t.avg||0; }));
  types.forEach(function(t, i){
    var c=NT_TP[i%NT_TP.length];
    var pct=Math.max(3, Math.round((t.avg||0)/maxA*100));
    card.appendChild(el('div','tp-row',
      '<span class="nt-type" style="color:'+c+';background:'+c+'1F">'+esc(t.type)+'</span>'+
      '<div class="tp-bar"><i style="width:'+pct+'%;background:linear-gradient(90deg,'+c+'2E,'+c+')"></i></div>'+
      '<span class="tp-val num">+'+fmt1(t.avg)+' · '+t.count+' 篇</span>'));
  });
  var top=types[0], concl;
  if(types.length>1)
    concl='其中「'+esc(top.type)+'」最带货：平均每篇 +'+fmt1(top.avg)+'，是第二名的 '+fmt1(top.avg/Math.max(1e-9, types[1].avg))+' 倍。';
  else
    concl='目前只有一类内容，多攒几篇再比较会更靠谱。';
  card.appendChild(el('p','tp-concl', concl));
  return card;
}

function fxTypesCrown(main){
  var first=main && main.querySelector('#card-types .tp-row .tp-bar');
  if(first && !first.querySelector('.tp-crown')){ var c=el('span','tp-crown','👑'); c.setAttribute('aria-hidden','true'); first.appendChild(c); }
}
function renderNotesTab(r, sample, meta){
  if(NT.shop!==state.shop){ NT.shop=state.shop; NT.mode=0; NT.sort='time'; NT.exp={}; }
  var wrap=el('div','nt-wrap');
  var chartCard=ntChartCard(r, meta);
  wrap.appendChild(chartCard);
  /* 先挂进 DOM 才能量出真实宽度，轴文字 12px 即 12px */
  $('#main').appendChild(wrap);
  ntChartFill(chartCard.querySelector('.nt-chart-box'), r, meta);
  var cols=el('div','nt-cols');
  var tcMap=ntTypeColors(r);
  cols.appendChild(ntListCard(r, meta, tcMap));
  cols.appendChild(ntTypesCard(r, meta));
  wrap.appendChild(cols);
  /* 列表渲染后可能出现竖向滚动条，宽度变了就重画一次图 */
  try{ fxTypesCrown($('#main')); fxNotesHover($('#main'), r); }catch(e){}
  var w2=Math.round(chartCard.querySelector('.nt-chart-box').clientWidth)||0;
  if(w2>0 && Math.abs(w2-NT._w)>2) ntChartFill(chartCard.querySelector('.nt-chart-box'), r, meta);
  if(!NT._rs){
    NT._rs=true;
    var tmr=null;
    window.addEventListener('resize', function(){
      clearTimeout(tmr);
      tmr=setTimeout(function(){ if(state.tab==='notes') render(); }, 200);
    });
  }
}

/* ================= 预算怎么花 ================= */
var BT = { shop:null, plan:8, mix:'reco', B:null, sat:1, adv:false, hyp:false };

/* 把配比篇数取整，保证总数等于计划篇数 */
function btRoundMix(list, plan){
  var arr=[], i;
  (list||[]).forEach(function(x){
    var n=Math.max(0, x.n||0);
    arr.push({ type:x.type, n:Math.floor(n+1e-9), fr:n-Math.floor(n+1e-9) });
  });
  var sum=0;
  arr.forEach(function(x){ sum+=x.n; });
  var left=plan-sum;
  if(left>0){
    var idx=[];
    for(i=0;i<arr.length;i++) idx.push(i);
    idx.sort(function(a,b){ return (arr[b].fr-arr[a].fr) || (a-b); });
    for(i=0;i<left && i<idx.length;i++) arr[idx[i]].n++;
  }
  return arr.filter(function(x){ return x.n>0; });
}
function btNum(v){ return v>=10 ? fmtInt(v) : fmt1(v); }

/* 「投多少最划算」曲线：W 用容器真实像素，文字恒为 12px */
function btCurveSVG(bm, meta, B, W){
  var Bmax=Math.round(bm.Bstar*2.5);
  W=Math.round(W);
  if(!isFinite(W) || W<260) W=640;
  var H=252, padL=50, padR=14, padT=42, padB=28;
  var PW=W-padL-padR, PH=H-padT-padB;
  var K=80, xs=[], ys=[], i, b, p, hi=-Infinity, lo=0;
  for(i=0;i<=K;i++){
    b=Bmax*i/K;
    p=bm.curve(b).profit;
    xs.push(b); ys.push(p);
    if(p>hi) hi=p;
    if(p<lo) lo=p;
  }
  var span=(hi-lo)||1;
  var hiP=hi;
  hi+=span*0.07;
  if(lo<0) lo-=span*0.07;
  function X(v){ return padL+PW*v/Bmax; }
  function Y(v){ return padT+PH*(1-(v-lo)/(hi-lo)); }
  var line='';
  for(i=0;i<=K;i++) line+=(i?'L':'M')+fx(X(xs[i]))+' '+fx(Y(ys[i]));
  var base=Y(lo);
  var area=line+'L'+fx(X(Bmax))+' '+fx(base)+'L'+fx(X(0))+' '+fx(base)+'Z';
  var peakY=Y(hiP), peakX=X(bm.Bstar);
  var cur=bm.curve(B);
  var dotX=X(B), dotY=Y(cur.profit);
  var bubT='最划算 ¥'+fmtInt(bm.Bstar);
  var bubW=48+(bubT.length-3)*7, bubH=26;
  var bubX=Math.min(Math.max(peakX-bubW/2, padL+2), W-padR-bubW-2);
  var bubY=Math.max(6, peakY-40);
  var mid=Bmax/2;
  var s='';
  s+='<'+'svg viewBox="0 0 '+W+' '+H+'" width="'+W+'" height="'+H+'" role="img" aria-label="投流净赚毛利随预算变化的曲线">';
  s+='<defs><linearGradient id="btG" x1="0" y1="0" x2="0" y2="1">'+
    '<stop offset="0" stop-color="#FF2442" stop-opacity="0.20"/>'+
    '<stop offset="1" stop-color="#FF2442" stop-opacity="0.03"/></linearGradient></defs>';
  /* 网格与刻度 */
  [0, hiP].forEach(function(v){
    var y=fx(Y(v));
    s+='<line x1="'+padL+'" y1="'+y+'" x2="'+(W-padR)+'" y2="'+y+'" stroke="#EDEAE4" stroke-width="1"/>';
    s+='<text class="nt-ax" x="'+(padL-8)+'" y="'+(y+4)+'" text-anchor="end">'+esc(fmtWan(v))+'</text>';
  });
  [0, mid, Bmax].forEach(function(v){
    s+='<text class="nt-ax" x="'+fx(X(v))+'" y="'+(H-8)+'" text-anchor="middle">'+esc(fmtWan(v))+'</text>';
  });
  /* 曲线与渐变填充 */
  s+='<path d="'+area+'" fill="url(#btG)"/>';
  s+='<path d="'+line+'" fill="none" stroke="#FF2442" stroke-width="2.2" stroke-linejoin="round" stroke-linecap="round"/>';
  /* 最划算：绿虚线 + 气泡 */
  s+='<line x1="'+fx(peakX)+'" y1="'+fx(peakY)+'" x2="'+fx(peakX)+'" y2="'+(H-padB)+'" stroke="#16A05D" stroke-width="1.5" stroke-dasharray="5 4"/>';
  s+='<rect class="bt-bubble" x="'+fx(bubX)+'" y="'+fx(bubY)+'" width="'+fx(bubW)+'" height="'+bubH+'" rx="7"/>';
  s+='<polygon points="'+fx(peakX-5)+','+fx(bubY+bubH)+' '+fx(peakX+5)+','+fx(bubY+bubH)+' '+fx(peakX)+','+fx(Math.min(peakY-2, bubY+bubH+6))+'" fill="#1D1D1F"/>';
  s+='<text x="'+fx(bubX+bubW/2)+'" y="'+fx(bubY+17)+'" text-anchor="middle" font-size="12" fill="#fff">'+esc(bubT)+'</text>';
  /* 当前预算：灰虚线 + 黑点 */
  s+='<line x1="'+fx(dotX)+'" y1="'+fx(dotY)+'" x2="'+fx(dotX)+'" y2="'+(H-padB)+'" stroke="#B9B4AA" stroke-width="1" stroke-dasharray="3 3"/>';
  s+='<circle cx="'+fx(dotX)+'" cy="'+fx(dotY)+'" r="4.5" fill="#1D1D1F" stroke="#fff" stroke-width="1.5"/>';
  s+='</svg>';
  return s;
}

function renderBudgetTab(r, sample, meta){
  FX.btFirst=true;
  if(BT.shop!==state.shop){ BT.shop=state.shop; BT.plan=8; BT.mix='reco'; BT.B=null; BT.sat=1; BT.adv=false; BT.hyp=false; }
  var wrap=el('div','bt-wrap');
  if(typeof r.budget!=='function' || !r.budget({plan:8}).ok){
    var warnCard=el('section','card card-float');
    warnCard.innerHTML='<div class="h2-row"><h2><span class="h2-ic">💰</span>下个月的种草预算</h2></div>'+
      '<p class="bt-empty-text">还没有给跑起来的笔记投流的记录，先按“该不该投”的规则小额试投两三次</p>';
    wrap.appendChild(warnCard);
    $('#main').appendChild(wrap);
    return;
  }
  var ch0=r.budget({plan:8}).ch;
  function mkBM(){ return r.budget({ plan:BT.plan, mix:BT.mix, saturation: ch0*BT.sat }); }
  var bm=mkBM();
  var settings=(sample && sample.settings) || {};
  var lead=meta.kind==='lead';
  var lastW=0;

  /* ---------- 左列：控制卡 ---------- */
  var left=el('div','bt-left');
  var ctl=el('section','card card-float');
  ctl.innerHTML='<div class="h2-row"><h2><span class="h2-ic">💰</span>下个月的种草预算</h2></div>'+
    '<p class="inv-sub">规则：多写带货的内容；只投“该不该投”亮绿灯的笔记投流，回报率来自本店历史投流的真实效果（已去水分）。</p>';
  var planRow=el('div','inv-slider-row');
  var planLab=el('span','inv-f-label','计划发几篇');
  var planInp=el('input','inv-range');
  planInp.type='range'; planInp.min=4; planInp.max=20; planInp.step=1; planInp.value=BT.plan;
  var planVal=el('span','inv-slider-val');
  planVal.setAttribute('data-fmt','%v 篇');
  planVal.textContent=BT.plan+' 篇';
  planRow.appendChild(planLab); planRow.appendChild(planInp); planRow.appendChild(planVal);
  ctl.appendChild(planRow);
  var mixRow=el('div','bt-row');
  mixRow.innerHTML='<span class="bt-row-label">内容怎么配</span>';
  var seg=el('div','seg');
  var segReco=el('button','seg-btn'+(BT.mix==='reco'?' on':''),'按推荐');
  var segHist=el('button','seg-btn'+(BT.mix==='hist'?' on':''),'按原来的比例');
  seg.appendChild(segReco); seg.appendChild(segHist);
  mixRow.appendChild(seg);
  ctl.appendChild(mixRow);
  var bRow=el('div','inv-slider-row');
  var bLab=el('span','inv-f-label','投流预算');
  var bInp=el('input','inv-range');
  bInp.type='range'; bInp.min=0; bInp.step=1;
  var bVal=el('span','inv-slider-val');
  bVal.setAttribute('data-fmt','¥%v');
  bRow.appendChild(bLab); bRow.appendChild(bInp); bRow.appendChild(bVal);
  ctl.appendChild(bRow);
  var advHead=el('button','bt-adv-toggle','<span>ⓘ 高级：单篇饱和点</span><span class="bt-chev">▾</span>');
  var advBody=el('div','bt-adv-body');
  var satRow=el('div','inv-slider-row');
  var satLab=el('span','inv-f-label','单篇饱和点');
  var satInp=el('input','inv-range');
  satInp.type='range'; satInp.min=0.5; satInp.max=3; satInp.step=0.05; satInp.value=BT.sat;
  var satVal=el('span','inv-slider-val');
  satVal.setAttribute('data-fmt','×%v');
  satRow.appendChild(satLab); satRow.appendChild(satInp); satRow.appendChild(satVal);
  advBody.appendChild(satRow);
  advBody.appendChild(el('p','bt-adv-sub','基准 ¥'+fmtInt(ch0)+'（本店历史平均每次投流的花费），可调到它的 0.5~3 倍'));
  advBody.hidden=!BT.adv;
  ctl.appendChild(advHead);
  ctl.appendChild(advBody);
  left.appendChild(ctl);

  /* ---------- 左列：推荐方案卡 ---------- */
  var planCard=el('section','card card-float');
  planCard.innerHTML='<div class="h2-row"><h2><span class="h2-ic">🎯</span>推荐方案</h2></div>';
  var mixList=el('div','bt-mix');
  planCard.appendChild(mixList);
  var stats=el('div','bt-stats');
  planCard.appendChild(stats);
  var verb=el('p','bt-verb');
  planCard.appendChild(verb);
  left.appendChild(planCard);

  /* ---------- 右列：曲线卡 ---------- */
  var right=el('div','bt-right');
  var curveCard=el('section','card card-float');
  curveCard.id='card-curve';
  curveCard.innerHTML='<div class="h2-row"><h2><span class="h2-ic">📈</span>投多少最划算</h2></div>'+
    '<p class="inv-sub">横轴：投流预算；纵轴：投流净赚的毛利（已扣掉投流花费）。</p>';
  var cbox=el('div','bt-curve-box');
  curveCard.appendChild(cbox);
  var curveNote=el('p','bt-verb bt-curve-note');
  curveCard.appendChild(curveNote);
  right.appendChild(curveCard);

  /* ---------- 右列：假设卡 ---------- */
  var hypCard=el('section','card card-float bt-hyp-card');
  var hypHead=el('button','bt-hyp-head','<span>ⓘ 这个模拟用了哪些假设</span><span class="bt-chev">▾</span>');
  var hypBody=el('ul','bt-hyp-body');
  hypBody.innerHTML='<li>回报率来自本店历史投流的真实效果</li>'+
    '<li>饱和点可调</li>'+
    '<li>各类内容表现来自历史平均</li>'+
    '<li>记录少时结果不确定</li>';
  hypBody.hidden=!BT.hyp;
  hypCard.appendChild(hypHead);
  hypCard.appendChild(hypBody);
  right.appendChild(hypCard);

  var grid=el('div','bt-grid');
  grid.appendChild(left); grid.appendChild(right);
  wrap.appendChild(grid);
  /* 先挂进 DOM 才能量出真实宽度 */
  $('#main').appendChild(wrap);

  var tcMap=ntTypeColors(r);
  function upd(){
    bm=mkBM();
    var Bmax=Math.round(bm.Bstar*2.5);
    if(BT.B==null || !isFinite(BT.B) || BT.B>Bmax || BT.B<0) BT.B=Math.round(bm.Bstar);
    bInp.max=Bmax; bInp.value=BT.B;
    planInp.value=BT.plan; planVal.textContent=BT.plan+' 篇';
    bVal.textContent='¥'+fmtInt(BT.B);
    satInp.value=BT.sat; satVal.textContent='×'+fmt2(BT.sat);
    var cur=bm.curve(BT.B);
    var total=bm.useMix.organic+cur.units;
    var deals=total*(settings.conv_rate||1);
    var biz=deals*(settings.price||1);
    /* 内容配比：取整，总数=计划篇数 */
    mixList.innerHTML=btRoundMix(bm.mixes[BT.mix], BT.plan).map(function(x){
      var c=tcMap[x.type]||'#7C8A99';
      return '<span class="bt-mix-item"><span class="nt-type" style="color:'+c+';background:'+c+'1F">'+esc(x.type)+'</span><b class="num">'+x.n+'</b><span class="bt-mix-p">篇</span></span>';
    }).join('') || '<span class="bt-mix-p">还没有内容记录</span>';
    /* 4 个统计 */
    var greenTxt=fmt1(bm.G)+' 篇';
    var orgTxt=btNum(bm.RC.organic)+' 个';
    var orgSub='按原比例只有 '+btNum(bm.H.organic)+' 个';
    var unitsTxt=btNum(cur.units)+' 个';
    var unitSub='每篇绿灯投 ¥'+fmtInt(cur.c);
    var profitTxt='¥'+fmtInt(cur.profit);
    var profitCls=cur.profit>=0?'pos':'neg';
    stats.innerHTML=
      '<div class="bt-stat"><div class="bt-stat-label">预计亮绿灯</div><div class="bt-stat-v num">'+greenTxt+'</div><div class="bt-stat-sub">只给这些投流</div></div>'+
      '<div class="bt-stat"><div class="bt-stat-label">笔记自然带来</div><div class="bt-stat-v num">'+orgTxt+'</div><div class="bt-stat-sub">'+orgSub+'</div></div>'+
      '<div class="bt-stat"><div class="bt-stat-label">投流再带来</div><div class="bt-stat-v num">'+unitsTxt+'</div><div class="bt-stat-sub">'+unitSub+'</div></div>'+
      '<div class="bt-stat"><div class="bt-stat-label">投流净赚毛利</div><div class="bt-stat-v num '+profitCls+'">'+profitTxt+'</div><div class="bt-stat-sub">已扣掉投流花费</div></div>';
    /* 判断句 */
    var ratio=BT.B/bm.Bstar;
    var judgeTxt = ratio<0.75 ? '这个预算偏少（最划算约在 ¥'+fmtInt(bm.Bstar)+'）。'
      : ratio>1.25 ? '这个预算偏多（最划算约在 ¥'+fmtInt(bm.Bstar)+'）。'
      : '这个预算接近最划算的位置。';
    verb.innerHTML='📍 '+judgeTxt+'下月种草合计预计多带来约 <b>'+btNum(total)+' 个'+esc(meta.m)+'</b>'+
      (lead? '（约 <b>'+fmt1(deals)+' 单签约</b>）':'')+'，约 <b>'+fmtMoney(biz)+'</b> 生意。';
    /* 曲线 */
    var w=cbox.clientWidth;
    cbox.innerHTML=btCurveSVG(bm, meta, BT.B, w);
    try{ wowBudget(cbox); }catch(e){}
    lastW=w;
    curveNote.innerHTML='📍 曲线先升后降：一开始每多投 1 元能多赚；投到 <b>¥'+fmtInt(bm.Bstar)+'</b>（每篇绿灯笔记约 <b>¥'+fmtInt(bm.cStar)+'</b>）之后，多投的钱就赚不回来了。';
  }

  planInp.addEventListener('input', function(){
    BT.plan=+planInp.value||8;
    planVal.textContent=BT.plan+' 篇';
    upd();
  });
  bInp.addEventListener('input', function(){
    BT.B=+bInp.value||0;
    bVal.textContent='¥'+fmtInt(BT.B);
    upd();
  });
  satInp.addEventListener('input', function(){
    BT.sat=+satInp.value||1;
    satVal.textContent='×'+fmt2(BT.sat);
    upd();
  });
  segReco.addEventListener('click', function(){ BT.mix='reco'; segReco.classList.add('on'); segHist.classList.remove('on'); upd(); });
  segHist.addEventListener('click', function(){ BT.mix='hist'; segHist.classList.add('on'); segReco.classList.remove('on'); upd(); });
  advHead.addEventListener('click', function(){
    BT.adv=!BT.adv;
    advBody.hidden=!BT.adv;
    advHead.classList.toggle('open', BT.adv);
  });
  hypHead.addEventListener('click', function(){
    BT.hyp=!BT.hyp;
    hypBody.hidden=!BT.hyp;
    hypHead.classList.toggle('open', BT.hyp);
  });

  upd();
  /* 布局完成后竖向滚动条可能让容器变窄，重画一次 */
  setTimeout(function(){
    var w=cbox.clientWidth;
    if(w && Math.abs(w-lastW)>2) upd();
  }, 0);

  if(!BT._rs){
    BT._rs=true;
    var tmr=null;
    window.addEventListener('resize', function(){
      clearTimeout(tmr);
      tmr=setTimeout(function(){ if(state.tab==='budget') render(); }, 200);
    });
  }
}

/* ================= 该不该投 ================= */
var INV = { shop:null, date:null, d1:0, d2:0, preset:null, liveReal:false, plan:8, mult:1, explain:false };
var INV_QUICK = [
  { k:'hot',  label:'🔥 一篇爆款',    s1:2.6, s2:2.0 },
  { k:'norm', label:'一篇普通的',      s1:1.0, s2:0.9 },
  { k:'cold', label:'一篇没起来的',    s1:-0.6, s2:-0.4 }
];

function invDayDiff(a, b){
  return Math.round((new Date(b+'T00:00:00') - new Date(a+'T00:00:00')) / 864e5);
}
function invAddDays(s, k){
  var x=new Date(s+'T00:00:00'); x.setDate(x.getDate()+k);
  var p=function(n){ return String(n).padStart(2,'0'); };
  return x.getFullYear()+'-'+p(x.getMonth()+1)+'-'+p(x.getDate());
}
/* 平时水平：各渠道 r.fits[j].predict(天序号, 日期) 之和 */
function invBases(r, date){
  var t0=invDayDiff(r.dates[0], date), d2=invAddDays(date, 1), b1=0, b2=0;
  (r.fits||[]).forEach(function(f){ b1+=f.predict(t0, date); b2+=f.predict(t0+1, d2); });
  return { b1:b1, b2:b2 };
}
function invInit(r){
  INV.shop=state.shop; INV.preset=null; INV.liveReal=false; INV.plan=8; INV.mult=1; INV.explain=INV.explain||false;
  var live=(r.live && r.live[0]) || null;
  if(live && live.p!=null && r.dates[live.p]!=null && r.dates[live.p+1]!=null){
    INV.date=r.dates[live.p];
    INV.d1=Math.round(r.y[live.p]);
    INV.d2=Math.round(r.y[live.p+1]);
    INV.liveReal=true;
  } else {
    INV.date=r.dates[Math.max(0, r.dates.length-2)];
    var b=invBases(r, INV.date);
    INV.d1=Math.max(0, Math.round(b.b1));
    INV.d2=Math.max(0, Math.round(b.b2));
  }
}

function invVerdictHTML(o, r, sample){
  var d1=INV.d1, d2=INV.d2;
  var M=(sample&&sample.metric)||'订单';
  var exS=(o.ex>=0?'+':'')+fmt1(o.ex);
  var numLine='平时这两天大约 '+fmt1(o.b1+o.b2)+' 个，这篇来了 '+(d1+d2)+' 个，多出 '+exS+'（正常波动约 ±'+fmt1(o.thr)+'）。';
  if(o.color==='green'){
    var extra='';
    if(o.bm && o.bm.ok && o.spend>0){
      var per=o.bm.curve(o.spend*o.bm.G).units/o.bm.G;
      var roi=per*r.uv/o.spend;
      extra='建议投 '+fmtMoney(o.spend)+'：预计再多带来约 '+fmt1(per)+' 个'+M+'，每花 1 元换回 '+fmt2(roi)+' 元（保本线 '+fmt2(r.be)+' 元）。';
    }
    return '<p>'+numLine+'</p>'+
      '<p>预计这篇自然会带来约 '+fmtInt(o.pred)+' 个（可能 '+fmtInt(o.predLo)+'~'+fmtInt(o.predHi)+'）。</p>'+
      (extra?('<p>'+extra+'</p>'):'');
  }
  if(o.color==='yellow'){
    return '<p>'+numLine+'</p>'+
      '<p>有点苗头，但还在正常波动范围内，可能是运气；第 3 天如果还明显高于平时再投。</p>';
  }
  var noneN=(r.done||[]).filter(function(n){ return n.boost && n.boost.verdict==='none'; })[0];
  var ex=noneN ? ('，比如「'+nTitle(noneN)+'」投了也没看到效果') : '';
  return '<p>'+numLine+'</p>'+
    '<p>还没跑赢平时。给没起来的笔记投流，历史上基本看不到效果'+ex+'；建议改标题或封面后重发。</p>';
}

function invHistCard(r, o){
  var card=el('section','card card-float');
  card.innerHTML=
    '<div class="h2-row"><h2><span class="inv-h2-dot"></span>和历史笔记比一比</h2></div>'+
    '<p class="inv-sub">每个圆点是一篇历史笔记"前两天多出来的量"，颜色是它最后的结论；悬停看标题</p>';
  var vals=(r.done||[]).map(function(n){ return (n.excess[0]||0)+(n.excess[1]||0); });
  var all=vals.concat([o.ex, o.thr]);
  var lo=Math.min.apply(null, all), hi=Math.max.apply(null, all);
  var pad=(hi-lo)*0.08 || 5; lo-=pad; hi+=pad;
  function pct(v){ var p=(v-lo)/(hi-lo)*100; return Math.max(1, Math.min(99, p)); }

  var plot=el('div','inv-plot');
  var thrPct=pct(o.thr);
  var zone=el('div','inv-zone'); zone.style.left=thrPct+'%';
  var axis=el('div','inv-axis');
  var line=el('div','inv-thrline'); line.style.left=thrPct+'%';
  var label=el('div','inv-thr-label'); label.textContent='绿灯线：从这里开始建议投';
  if(thrPct>55){ label.style.right='2px'; label.style.textAlign='right'; }
  else{ label.style.left='calc('+thrPct+'% + 10px)'; }
  plot.appendChild(zone); plot.appendChild(axis); plot.appendChild(line); plot.appendChild(label);

  (r.done||[]).forEach(function(n, i){
    var v=(n.excess[0]||0)+(n.excess[1]||0);
    var d=el('span','inv-dot d-'+(n.verdict||'none'));
    d.style.left=pct(v)+'%';
    d.style.bottom=(i%2 ? 18 : 4)+'px';
    d.title=n.title;
    plot.appendChild(d);
  });
  var cur=el('div','inv-cur'); cur.style.left=pct(o.ex)+'%';
  cur.innerHTML='<span class="inv-cur-tri"></span><span class="inv-cur-tag">这篇</span>';
  var curLine=el('div','inv-cur-line'); curLine.style.left=pct(o.ex)+'%';
  plot.appendChild(curLine); plot.appendChild(cur);
  card.appendChild(plot);

  var X=0,Y=0,Z=0,W=0;
  (r.done||[]).forEach(function(n){
    var v=(n.excess[0]||0)+(n.excess[1]||0);
    if(v>=o.thr){ X++; if(n.verdict==='real') Y++; }
    else{ Z++; if(n.verdict==='real') W++; }
  });
  card.appendChild(el('div','inv-legend',
    '<span><i class="lg-dot lg-real"></i>最后真有效</span>'+
    '<span><i class="lg-dot lg-maybe"></i>可能是巧合</span>'+
    '<span><i class="lg-dot lg-none"></i>没看到效果</span>'));
  card.appendChild(el('p','inv-statline',
    '历史上前两天就过了绿灯线的 <b>'+X+'</b> 篇里，<b>'+Y+'</b> 篇最后真有效；没过线的 <b>'+Z+'</b> 篇里，只有 <b>'+W+'</b> 篇最后真有效。前两天的表现，基本就能看出一篇笔记行不行。'));
  return { card:card, cur:cur, curLine:curLine, pct:pct };
}

function invExpStats(r, sample, o){
  var bm=o.bm||{};
  if(!bm.ok || !num(bm.cStar) || bm.cStar<=0){
    return { stats:'<p class="inv-sub">这家店的历史数据还撑不起预算模型，实验建议先放一放。</p>', why:'' };
  }
  var spend=Math.max(0, bm.cStar*INV.mult);
  var e=LedgerEngine.experiment(r, sample, { plan:INV.plan, spend:spend });
  if(!e || !e.ok){
    return { stats:'<p class="inv-sub">按当前的投流额度算不出实验规模，先把每篇投的金额调高一点。</p>', why:'' };
  }
  var total=e.perArm*2, show=Math.min(total, 12), circles='';
  for(var i=1;i<=show;i++){ circles+='<span class="exp-num'+(i%2?' odd':' even')+'">'+i+'</span>'; }
  if(total>show){ circles+='<span class="exp-num-more">… 共 '+total+' 篇</span>'; }
  var legend='<div class="exp-legend">'+
    '<span><i class="lg-dot lg-on"></i>投流 '+fmtMoney(spend)+'</span>'+
    '<span><i class="lg-dot lg-off"></i>不投</span>'+
  '</div>';
  var stats='<div class="exp-stats">'+
    '<div class="exp-stat"><span class="es-label">至少需要</span><b class="num">'+e.perArm+' + '+e.perArm+' 篇</b><span class="es-sub">投流组 + 不投组（都要亮绿灯）</span></div>'+
    '<div class="exp-stat"><span class="es-label">大约多久出结论</span><b class="num">'+fmt1(e.months)+' 个月</b><span class="es-sub">每月约 '+fmt1(e.greens)+' 篇亮绿灯</span></div>'+
    '<div class="exp-stat"><span class="es-label">实验投流花费</span><b class="num">'+fmtMoney(e.cost)+'</b><span class="es-sub">投流组 '+e.perArm+' 篇 × '+fmtMoney(spend)+'</span></div>'+
  '</div>';
  var why='<div class="exp-why">💡 为什么要这么多篇？同类笔记的效果本来就差很多（相差 ±'+fmtInt(e.het)+' 个），而每篇投 '+fmtMoney(spend)+' 预计只多带来约 '+fmt1(e.delta)+' 个'+((sample&&sample.metric)||'订单')+'，多发几篇，才能把"投流的功劳"从"笔记本身的好坏"里分出来。每篇投得越多，效果越明显，需要的篇数越少。</div>';
  return { stats: circles+legend+stats, why: why };
}

function renderInvest(r, sample){
  if(INV.shop!==state.shop){ invInit(r); }
  var sigma=r.sigma||0;
  var o=r.light(INV.date, INV.d1, INV.d2);
  var wrap=el('div','inv-wrap');

  /* ---- 卡1：新笔记发出两天了 ---- */
  var live=(r.live && r.live[0]) || null;
  var c1=el('section','card card-float');
  c1.innerHTML=
    '<div class="h2-row"><h2><span class="h2-ic">🕐</span>新笔记发出两天了</h2></div>'+
    '<p class="inv-sub">先别急着投流。看发出后两天的'+((sample&&sample.metric)||'订单')+'（站内+站外）有没有跑赢平时，跑赢了再投。</p>';
  var dateRow=el('div','inv-form-row');
  dateRow.innerHTML='<label class="inv-f-label" for="invDate">发布日期</label>';
  var dInp=el('input','inv-date');
  dInp.type='date'; dInp.id='invDate';
  dInp.min=r.dates[0]; dInp.max=r.dates[r.dates.length-2];
  dInp.value=INV.date;
  dInp.addEventListener('change', function(){
    var v=String(dInp.value||'');
    if(!/^(\d{4})-(\d{2})-(\d{2})$/.test(v)){ dInp.value=INV.date; return; }
    if(v<dInp.min) v=dInp.min;
    if(v>dInp.max) v=dInp.max;
    if(v===INV.date){ dInp.value=v; return; }
    INV.date=v; INV.liveReal=false; INV.preset=null;
    render();
  });
  dateRow.appendChild(dInp);
  c1.appendChild(dateRow);

  var qRow=el('div','inv-quick-row');
  INV_QUICK.forEach(function(q){
    var b=el('button','inv-quick'+(INV.preset===q.k?' active':''));
    b.textContent=q.label;
    b.addEventListener('click', function(){
      var bs=invBases(r, INV.date);
      var t1=Math.max(0, Math.round(bs.b1+q.s1*sigma)), t2=Math.max(0, Math.round(bs.b2+q.s2*sigma));
      var in1=row1 && row1.querySelector('input'), in2=row2 && row2.querySelector('input');
      if(FX_REDUCED || !in1 || !in2 || t1>+in1.max || t2>+in2.max){
        INV.d1=t1; INV.d2=t2; INV.preset=q.k; INV.liveReal=false; render(); return;
      }
      /* v20：滑块自己滑到位，灯跟着变——看到因果 */
      hideTip();
      var f1=INV.d1, f2=INV.d2, t0=null, D=650;
      INV.preset=q.k; INV.liveReal=false;
      Array.prototype.forEach.call(qRow.children, function(x){ x.classList.toggle('active', x===b); });
      (function step(t){
        if(t0==null) t0=t;
        var p=Math.min(1,(t-t0)/D), e=1-Math.pow(1-p,3);
        INV.d1=Math.round(f1+(t1-f1)*e); INV.d2=Math.round(f2+(t2-f2)*e);
        in1.value=INV.d1; in2.value=INV.d2;
        var bd1=row1.querySelector('.inv-slider-val'), bd2=row2.querySelector('.inv-slider-val');
        if(bd1) bd1.textContent=String(INV.d1); if(bd2) bd2.textContent=String(INV.d2);
        updLight();
        if(p<1) requestAnimationFrame(step);
        else Array.prototype.forEach.call(qRow.children, function(x){ x.classList.toggle('active', x===b); });
      })(performance.now());
    });
    qRow.appendChild(b);
  });
  c1.appendChild(qRow);

  var bases=invBases(r, INV.date);
  var max1=Math.max(30, Math.ceil(bases.b1+3*sigma)+6, INV.d1+8);
  var max2=Math.max(30, Math.ceil(bases.b2+3*sigma)+6, INV.d2+8);
  var tip=null;

  function invSlider(label, val, max, onInput){
    var row=el('div','inv-slider-row');
    row.innerHTML='<span class="inv-f-label">'+label+'</span>';
    var inp=el('input','inv-range');
    inp.type='range'; inp.min=0; inp.max=max; inp.step=1; inp.value=val;
    var badge=el('span','inv-slider-val num', String(val));
    inp.addEventListener('input', function(){
      var v=+inp.value;
      badge.textContent=String(v);
      onInput(v);
    });
    row.appendChild(inp); row.appendChild(badge);
    return row;
  }
  function hideTip(){
    if(tip && tip.parentNode){ tip.parentNode.removeChild(tip); }
    tip=null;
    Array.prototype.forEach.call(qRow.children, function(b){ b.classList.remove('active'); });
  }
  var row1=invSlider('发布当天', INV.d1, max1, function(v){
    INV.d1=v; INV.liveReal=false; INV.preset=null; hideTip(); updLight();
  });
  var row2=invSlider('第 2 天', INV.d2, max2, function(v){
    INV.d2=v; INV.liveReal=false; INV.preset=null; hideTip(); updLight();
  });
  c1.appendChild(row1);
  c1.appendChild(row2);
  if(INV.liveReal && live){
    tip=el('div','inv-tip',
      '<span class="inv-tip-ic">🕐</span><span>正在看真实笔记「'+nTitle(live)+'」发布后两天的数据；拖动滑块可以模拟其他情况</span>');
    c1.appendChild(tip);
  }
  wrap.appendChild(c1);

  /* ---- 卡2：红绿灯（v11：加「这个灯是怎么判的」锚点与展开） ---- */
  var c2=el('section','card card-float');
  c2.id='card-light';
  var tlBody=el('div','tlight-body');
  c2.appendChild(tlBody);
  var expTgBtn=el('button','tx-toggle', '这个灯是怎么判的 ▾');
  c2.appendChild(expTgBtn);
  var expLgBox=el('div','tx-expand');
  c2.appendChild(expLgBox);
  expTgBtn.addEventListener('click', function(){
    INV.explain=!INV.explain;
    expTgBtn.classList.toggle('open', INV.explain);
    expLgBox.classList.toggle('show', INV.explain);
    updLight();
  });
  wrap.appendChild(c2);

  var hist=invHistCard(r, o);
  wrap.appendChild(hist.card);

  function updLight(){
    o=r.light(INV.date, INV.d1, INV.d2);
    var title=o.color==='green' ? '建议投流' : (o.color==='yellow' ? '再等一天' : '先别投');
    tlBody.innerHTML=
      '<div class="tlight-row">'+
        '<div class="tlight-shell" aria-hidden="true">'+
          '<span class="tlight-lamp tlight-red'+(o.color==='red'?' on':'')+'"></span>'+
          '<span class="tlight-lamp tlight-yellow'+(o.color==='yellow'?' on':'')+'"></span>'+
          '<span class="tlight-lamp tlight-green'+(o.color==='green'?' on':'')+'"></span>'+
        '</div>'+
        '<div class="tlight-text v-'+o.color+'">'+
          '<h3>'+title+'</h3>'+
          invVerdictHTML(o, r, sample)+
        '</div>'+
      '</div>';
    try{
      var fxH=tlBody.querySelector('.tlight-text h3');
      if(fxH && FX.light!==o.color+'|'+state.shop){ FX.light=o.color+'|'+state.shop; fxType(fxH, fxH.textContent, 70); }
    }catch(e){}
    hist.cur.style.left=hist.pct(o.ex)+'%';
    hist.curLine.style.left=hist.pct(o.ex)+'%';
    /* v11：展开时随滑块/preset 更新「这个灯是怎么判的」 */
    var LEC=(typeof LedgerEngine!=='undefined')?LedgerEngine:null;
    expTgBtn.classList.toggle('open', !!INV.explain);
    expLgBox.classList.toggle('show', !!INV.explain);
    expLgBox.innerHTML='';
    if(INV.explain && LEC && typeof LEC.explainLight==='function'){
      var le=null;
      try{ le=LEC.explainLight(r, o, INV.d1, INV.d2); }catch(e){}
      if(le && le.steps && le.steps.length) expLgBox.appendChild(expStepsList(le.steps));
    }
  }

  /* ---- 卡4：对照实验 ---- */
  var bm=o.bm||{};
  var cStar=num(bm.cStar)? bm.cStar : 0;
  var c4=el('section','card card-float');
  c4.innerHTML=
    '<div class="h2-row"><h2><span class="h2-ic">🧪</span>想把投流效果测准？做一次对照实验</h2></div>'+
    '<p class="inv-sub">"去水分"是用历史数据估算的，想要更硬的结论，就像做药物试验一样：同类笔记一半投、一半不投，再比较两组。</p>';
  var sRow=el('div','inv-slider-row');
  sRow.innerHTML='<span class="inv-f-label">每篇投多少</span>';
  var sInp=el('input','inv-range');
  sInp.type='range'; sInp.min=0.4; sInp.max=2.5; sInp.step=0.05; sInp.value=INV.mult;
  var sBadge=el('span','inv-slider-val num', fmtMoney(cStar*INV.mult));
  sInp.addEventListener('input', function(){
    INV.mult=+sInp.value;
    sBadge.textContent=fmtMoney(cStar*INV.mult);
    updExp();
  });
  sRow.appendChild(sInp); sRow.appendChild(sBadge);
  c4.appendChild(sRow);
  var pRow=el('div','inv-slider-row');
  pRow.innerHTML='<span class="inv-f-label">每月发几篇</span>';
  var pInp=el('input','inv-range');
  pInp.type='range'; pInp.min=4; pInp.max=20; pInp.step=1; pInp.value=INV.plan;
  var pBadge=el('span','inv-slider-val num', INV.plan+' 篇');
  pInp.addEventListener('input', function(){
    INV.plan=+pInp.value;
    pBadge.textContent=INV.plan+' 篇';
    updExp();
  });
  pRow.appendChild(pInp); pRow.appendChild(pBadge);
  c4.appendChild(pRow);
  var expBody=el('div','exp-body');
  c4.appendChild(expBody);
  c4.appendChild(el('ol','exp-rules',
    '<li><i>1</i><span>单数篇投，双数篇不投。不要按"看起来好的"去投，否则又会高估投流。</span></li>'+
    '<li><i>2</i><span>两组都按"该不该投"的规则，只在亮绿灯后才进入实验。</span></li>'+
    '<li><i>3</i><span>实验结束后导入数据，账本会自动比较两组笔记 7 天的平均增量，差值就是投流的真实效果。</span></li>'));
  var whyBody=el('div','exp-why-body');
  c4.appendChild(whyBody);
  wrap.appendChild(c4);

  /* v6：实验级结论（assumptions.js）——对照实验卡片下方 */
  if(typeof GuanchaoAssumptions!=='undefined' && GuanchaoAssumptions && typeof GuanchaoAssumptions.renderExperiment==='function'){
    var expBox=el('div','invest-exp');
    try{ GuanchaoAssumptions.renderExperiment(expBox, { r:r, sample:sample }); }catch(e){}
    wrap.appendChild(expBox);
  }

  /* v13：实验级示例（EXPERIMENT_DEMO）——挂在「实验级结论」卡片内，不影响本店任何数字 */
  try{ var gedLE=(typeof LedgerEngine!=='undefined')?LedgerEngine:null;
    if(typeof EXPERIMENT_DEMO!=='undefined' && expBox && gedLE && typeof gedLE.experimentDemo==='function'){
    var gedD=gedLE.experimentDemo(EXPERIMENT_DEMO);
    if(gedD && gedD.exp && gedD.est && gedD.truth) mountExpDemo(expBox, gedD);
  } }catch(e){ console.error('GED mount fail:', e); }

  function updExp(){
    var t=invExpStats(r, sample, o);
    expBody.innerHTML=t.stats;
    whyBody.innerHTML=t.why;
  }

  updLight();
  updExp();
  $('#main').appendChild(wrap);
}

/* v4：渲染完页面主体后，给术语加小问号（pages.js） */
/* v10：调用前给胶囊/横幅小卡/伪按钮补 data-no-glossary（attach 会跳过）；句末问号前后留一个空格 */
function noGlossaryMarks(root){
  var sel='.mini,.story-link,.fn-tag,.gx-conf,.gx-pill,.gx-ev,.tab-lede,.hero-big-label,.col-t,.col-s,.col-k,.gca-oth,.tl-text,.step-t,.how-conf';
  try{
    var xs=root.querySelectorAll(sel);
    for(var i=0;i<xs.length;i++){ xs[i].setAttribute('data-no-glossary',''); }
  }catch(e){}
}
function spaceTipEnds(root){
  try{
    var qs=root.querySelectorAll('.gg-q');
    for(var i=0;i<qs.length;i++){
      var q=qs[i], prev=q.previousSibling, next=q.nextSibling;
      var atEnd=!next || (next.nodeType===3 && !next.nodeValue.trim());
      if(atEnd && prev && prev.nodeType===3 && prev.nodeValue && !/\s$/.test(prev.nodeValue)){
        prev.nodeValue=prev.nodeValue+' ';
        if(next && next.nodeType===3) next.nodeValue=' '+next.nodeValue;
      }
    }
  }catch(e){}
}
function pruneTipMids(root){
  /* v10：问号后紧跟汉字/中文标点 = 词中或括号引号冒号前，删掉，保证不拆词 */
  try{
    var qs=root.querySelectorAll('.gg-q');
    for(var i=0;i<qs.length;i++){
      var q=qs[i], n=q.nextSibling;
      while(n && n.nodeType!==3){ n=n.nextSibling; }
      var s=n? String(n.nodeValue||'').trim() : '';
      if(!s) continue;
      var ch=s.charAt(0);
      var code=ch.charCodeAt(0);
      var bad=(code>=0x4E00 && code<=0x9FFF) || '\u201c\u201d\u2018\u2019\u300c\u300d\u300e\u300f\uff08\uff09\uff1a'.indexOf(ch)>-1 || ch==='\"' || ch==="'";
      if(bad && q.parentNode){ q.parentNode.removeChild(q); }
    }
  }catch(e){}
}
function attachGlossary(root){
  if(!root || root.hidden) return;
  if(typeof GuanchaoGlossary==='undefined' || !GuanchaoGlossary || typeof GuanchaoGlossary.attach!=='function') return;
  noGlossaryMarks(root);
  try{ GuanchaoGlossary.attach(root); }catch(e){}
  pruneTipMids(root);
  spaceTipEnds(root);
}
function render(){
  try{ fxTitle(); }catch(e){}
  /* v11：离开笔记明细或换店时，关掉「这笔账怎么算的」抽屉 */
  if(EXD.open && (state.tab!==EXD.tab || state.shop!==EXD.shop)) exdClose();
  renderInner();
  FX.runBar=false;
  attachGlossary(document.getElementById('main'));
}
function renderInner(){
  try{ renderInnerCore(); }
  catch(e){
    try{ console.warn('[观潮] 页面渲染失败', e); }catch(e2){}
    var mm=$('#main'); if(mm) mm.appendChild(failCard());
  }
}
function renderInnerCore(){
  var main=$('#main');
  main.innerHTML='';
  updateTabUI();
  var fN=$('#fictionNotice');
  if(fN){ fN.hidden = state.importMode || !!IMPORT_KEYS[state.shop]; }
  if(state.importMode){
    main.appendChild(renderSuppEntry());
    appendDataSource(main);
    main.appendChild(renderImportForm());
    attachGlossary(main);
    return;
  }
  /* v14：每页一句开场（手机上页签在底部，前面带上页签名） */
  if(TAB_LEDE[state.tab]){
    var tl=TABS.filter(function(x){ return x.id===state.tab; })[0];
    main.appendChild(el('p','tab-lede', '<b class="tab-lede-n">'+esc(tl?tl.label:'')+'</b>'+esc(TAB_LEDE[state.tab])));
  }
  if(state.tab!=='overview'){
    if(state.tab==='notes' && engineReady()){
      var resN=compute(state.shop);
      if(resN.err){ main.appendChild(renderError(resN.err)); return; }
      var metaN=SHOP_META[state.shop]||{ name:'', kindLabel:'', m:'咨询', price:1, inCh:'站内', outCh:'站外', kind:'order' };
      if(!SHOP_META[state.shop]) warn('未知店铺 key：'+state.shop);
      renderNotesTab(resN.r, resN.sample, metaN);
      return;
    }
    if(state.tab==='invest' && engineReady()){
      var resI=compute(state.shop);
      if(resI.err){ main.appendChild(renderError(resI.err)); return; }
      renderInvest(resI.r, resI.sample);
      return;
    }
    if(state.tab==='budget' && engineReady()){
      var resB=compute(state.shop);
      if(resB.err){ main.appendChild(renderError(resB.err)); return; }
      var metaB=SHOP_META[state.shop]||{ name:'', m:'咨询', inCh:'站内', outCh:'站外', kind:'order' };
      if(!SHOP_META[state.shop]) warn('未知店铺 key：'+state.shop);
      renderBudgetTab(resB.r, resB.sample, metaB);
      return;
    }
    if(state.tab==='ai'){
      if(engineReady()){
        var resA=compute(state.shop);
        if(resA.err){ main.appendChild(renderError(resA.err)); return; }
        main.appendChild(renderAI(resA.r, resA.sample));
      }else{
        main.appendChild(renderPlaceholder('ai'));
      }
      return;
    }
    main.appendChild(renderPlaceholder(state.tab));
    return;
  }
  if(!engineReady()){ main.appendChild(renderMissingFiles()); return; }
  var res=compute(state.shop);
  if(res.err){ main.appendChild(renderError(res.err)); return; }
  var meta=SHOP_META[state.shop]||{ name:'', kindLabel:'', m:'咨询', price:1, inCh:'站内', outCh:'站外', kind:'order' };
  if(!SHOP_META[state.shop]) warn('未知店铺 key：'+state.shop);
  if(DEBUG){
    try{ console.log('[观潮] r keys:', Object.keys(res.r)); console.log('[观潮] S:', res.r.summary); console.log('[观潮] sample keys:', Object.keys(res.sample)); }catch(e){}
  }
  renderOverview(res.r, res.sample, meta);
  if(DEBUG && WARN.length){
    var dbg=el('div','dbg','观潮 debug 警告：\n'+WARN.join('\n'));
    document.body.appendChild(dbg);
  }
}

/* ================= AI 参谋（原型：关键词规则模拟，非大模型） ================= */
var AI={ busy:false, seq:0 };
var TYPE_KW={
  '避雷指南': /避雷|劝退|踩坑|千万别|智商税|割韭菜|翻车|别买/,
  '促销活动': /优惠|折扣|满减|秒杀|福利|囤|大促|双11|618|大促活动/,
  '送礼清单': /送礼|礼物|伴手礼|礼盒|七夕|情人节|母亲节|教师节/,
  '新品上市': /新品|上新|首发|新款|开箱|尝鲜/,
  '测评对比': /实测|测评|评测|盲测|对比|横评|vs|VS|pk|PK|排名|排行榜/,
  '制作过程': /做法|自制|手作|怎么做|步骤|配方|过程/,
  '教程干货': /教程|手把手|零基础|保姆级|step|Step|入门/,
  '场景种草': /氛围|改造|出租屋|书桌|宿舍|布置|软装|幸福感|治愈|独居|房间|工位/,
  '费用对比': /多少钱|费用|成本|开销|花销|平价|省钱|价格|预算|花销/,
  '院校介绍': /院校|大学|G5|藤校|港新|港三|新国立|南洋理工|学校|专业|申请|择校|选校|保底|时间线/,
  '干货清单': /清单|合集|盘点|必备|书单/,
  '干货技巧': /技巧|方法|窍门|攻略|指南|小白|怎么选|怎么写|避坑/,
  '经验故事': /经验|经历|故事|复盘|毕业|留学|转行|裸辞|一年|半年/
};
function classifyTitle(title){
  var t=String(title||'');
  for(var k in TYPE_KW){ if(TYPE_KW[k].test(t)) return k; }
  return '经验故事';
}
function aiBudget(r){
  if(!r || typeof r.budget!=='function') return null;
  try{ var b=r.budget({plan:8}); return (b && typeof b==='object')?b:null; }
  catch(e){ return null; }
}
function aiTopNotes(r, n){
  var arr=(r.done||[]).map(function(x){
    var ex=0;
    if(x.excess){ ex=(x.excess[0]||0)+(x.excess[1]||0); }
    else if(x.organic!=null){ ex=x.organic; }
    else if(x.total!=null){ ex=x.total; }
    return { title:(x.title||''), ex:ex };
  }).sort(function(a,b){ return b.ex-a.ex; });
  return arr.slice(0, n||3);
}
function aiMisoNote(r){
  var arr=(r.done||[]).filter(function(x){ return x.misjudged; });
  return arr[0]||null;
}
function aiTypesSorted(r){
  return (r.types||[]).slice().sort(function(a,b){ return (b.realRate||0)-(a.realRate||0); });
}
function aiKol(q, r, sample, meta){
  var M=meta.m||'订单';
  var LEC=(typeof LedgerEngine!=='undefined')?LedgerEngine:null;
  if(!LEC || typeof LEC.kolLedger!=='function') return null;
  var list=[]; try{ list=LEC.kolLedger(r)||[]; }catch(e){ list=[]; }
  if(!list.length) return '这本账里还没有达人合作记录（蒲公英合作笔记没填报价），达人账跑不起来。';
  function adv(k){
    if(k.verdict==='worth') return '每 1 元报价换回 '+fmt2(k.roi)+' 元，高于保本线，可以续约。下次报价在 ¥'+fmtInt(k.breakEven)+' 以内都划算。';
    if(k.verdict==='loss') return '带来了生意，但报价偏高：每 1 元只换回 '+fmt2(k.roi)+' 元，低于保本线。续约前把报价谈到 ¥'+fmtInt(k.breakEven)+' 以内。';
    if(k.verdict==='unclear') return '多带来的量还在正常波动范围内，说不清是不是这位博主的功劳。先小额再合作一次，或换同类博主做对照。';
    return '这篇合作笔记没看到额外的'+M+'，不建议续约。';
  }
  var hit=list.filter(function(k){ var seg=String(k.kol||'').split(' \u00b7 ')[0]; return seg && q.indexOf(seg)>=0; });
  var R=[];
  if(hit.length){
    hit.forEach(function(k){
      R.push('\u300c'+k.kol+'\u300d合作的那篇\u300a'+k.title+'\u300b（'+fmtDayMD(k.date)+'，报价 ¥'+fmtInt(k.cost)+'）：多带来 '+fmtInt(k.inc)+' 个'+M+'（可能 '+fmtInt(Math.max(0,k.lo))+'~'+fmtInt(k.hi)+'）。');
      R.push(adv(k));
    });
    R.push('口径：按合作笔记直接带来的生意计，保本线 '+fmt2(r.be)+'（毛利的倒数）。');
    return R.join('\n');
  }
  R.push('这本账里有 '+list.length+' 位合作达人：');
  list.forEach(function(k){ R.push('\u00b7 '+k.kol+'：'+adv(k)); });
  R.push('报出达人名字，我可以单独算那位。');
  return R.join('\n');
}
/* 笔记标题匹配：问题里出现某篇标题的连续 4 个字 */
function aiNoteHit(q, r){
  var qs=String(q||''), best=null;
  (r.notes||[]).forEach(function(n){
    if(best) return;
    var t=String(n.title||''); if(t.length<4) return;
    for(var i=0;i+4<=t.length;i++){
      if(qs.indexOf(t.substr(i,4))>=0){ best=n; return; }
    }
  });
  return best;
}
function aiNoteEx(n, r){
  var LEC=(typeof LedgerEngine!=='undefined')?LedgerEngine:null;
  if(!LEC || typeof LEC.explainNote!=='function') return null;
  var ex=null;
  try{ ex=LEC.explainNote(r, n.title, getRobust(r)); }catch(e){ ex=null; }
  if(!ex || !ex.steps || !ex.steps.length) return null;
  var R=['\u300a'+ex.title+'\u300b这笔账是这么算的：'];
  ex.steps.forEach(function(s, i){ R.push((i+1)+'. '+String(s.text||'')); });
  return R.join('\n');
}
function aiAnswer(q, r, sample, meta){
  q=String(q||'');
  var S=r.summary||{}, M=meta.m||'订单', R=[], bud=aiBudget(r);
  function push(s){ R.push(s); }
  /* B 版：意图匹配。具体在前（达人续约先于投流「值不值」），笔记标题放 6 类之后 */
  if(/达人|博主|报价|续约/.test(q)){
    var kolA=aiKol(q, r, sample, meta);
    if(kolA) return kolA;
  }
  if(/站外|全域|公众号|淘宝|天猫|官网|误判|站内|渠道|看漏/.test(q)){
    if(S.outShare!=null){
      push('这本账里，站外渠道「'+meta.outCh+'」贡献了增量的 '+fmtPct(S.outShare)+'%。');
      push('只盯小红书站内后台，这部分会整段看漏。');
    }else{
      push('这本账里没有配置站外渠道。');
    }
    push('');
    if(S.misjudged>0){
      var mn=aiMisoNote(r);
      push('更隐蔽的是「误判」：有 '+S.misjudged+' 篇笔记，只看站内像没起量，把站外算进来其实是有效增量。'+(mn?('比如《'+mn.title+'》。'):''));
      push('这就是为什么账本要把两个渠道放在一起算，而不是各看各的。');
    }else{
      push('目前没有「只看站内会误判」的笔记：每篇的站内站外表现是一致的。');
    }
    return R.join('\n');
  }
  if(/预算|花钱|投多少|分配|怎么分|下个月|盘子/.test(q)){
    if(bud && bud.ok){
      push('按这本账算（'+S.days+' 天 · '+S.noteCount+' 篇笔记）：');
      push('');
      push('· 写作盘子：一个月规划 '+bud.plan+' 篇，按绿灯率折算约 '+fmt1(bud.G)+' 篇能成；');
      push('· 投流节奏：每篇从 ¥'+fmtInt(bud.ch)+' 起步试投，全月加到 ¥'+fmtInt(bud.Bstar)+' 附近性价比最高——再往上，回报按边际递减折算；');
      var mix=(bud.mixes && bud.mixes.reco)||[];
      if(mix.length){
        var parts=mix.map(function(x){ return x.type+'×'+fmt1(x.n); });
        push('· 内容配比（按绿灯率推荐）：'+parts.join('、')+'。');
      }
      push('');
      push('同一口径的曲线在「预算怎么花」页，可以自己拖预算验证。');
    }else{
      push('这本账里还没有「投了流且被验证为真」的笔记，预算模型跑不起来。');
      push('先按现在的节奏把笔记发起来，等第一笔投流有了完整记录（开始日期 + 花费），再来问怎么分。');
    }
    return R.join('\n');
  }
  if(/哪类|哪一篇|哪篇|什么类型|什么内容|内容最好|类型/.test(q)){
    var ts=aiTypesSorted(r);
    if(ts.length){
      push('按绿灯率（真实增量判定）排：');
      ts.slice(0,3).forEach(function(t){
        push('· '+t.type+'：'+t.count+' 篇，绿灯 '+fmt1(t.green)+' 篇，平均每篇 +'+fmt1(t.avg)+'；');
      });
      push('');
      push('下个月把「'+ts[0].type+'」当主力，'+(ts[1]?('「'+ts[1].type+'」补位。'):'其余类型试水。'));
    }else{
      push('这本账里还没有笔记分类数据。');
    }
    return R.join('\n');
  }
  if(/内容|选题|写什么|下一篇|标题|灵感|创意/.test(q)){
    var top=aiTopNotes(r,3);
    if(top.length){
      push('账本里最能带量的笔记是：');
      top.forEach(function(t,i){ push((i+1)+'. 《'+t.title+'》\u3000+'+fmt1(t.ex)); });
      push('');
      push('+ 号的数字 = 发布后头两天超出基线的量，来自红绿灯判定，不是播放量。');
    }else{
      push('这本账里还没有出结果的笔记。');
    }
    var ts2=aiTypesSorted(r).filter(function(t){ return (t.count||0)>=2; });
    if(ts2.length>=2){
      push('');
      push('类型上也照这个方向找角度：'+ts2[0].type+' 平均每篇 +'+fmt1(ts2[0].avg)+'，'+ts2[1].type+' 平均每篇 +'+fmt1(ts2[1].avg)+'。');
    }else if(ts2.length===1){
      push('');
      push('类型上优先写 '+ts2[0].type+'（平均每篇 +'+fmt1(ts2[0].avg)+'）。');
    }
    return R.join('\n');
  }
  if(/投流|值不值|去水分|回报|roi|ROI|投广告|投放/.test(q)){
    var hasBoost=(S.sepCost!=null && S.sepCost>0) || (S.boostCost!=null && S.boostCost>0);
    if(!hasBoost){
      push('这本账里还没有投流记录（没有笔记填投流开始日期和花费）。');
      push('值不值要等第一笔投流跑完才答得出来——投的时候记好开始日期和花费，账本会自动算红绿灯和回报。');
    }else{
      push('账本口径的答案：');
      push('');
      if(S.sepCost>0 && S.roiReal!=null){
        push('· 投流花了 ¥'+fmtInt(S.sepCost)+'；');
        push('· 按真实口径（把站外增量也算进来）回报是 '+fmt2(S.roiReal)+'，保本线在 '+fmt2(r.be)+'（毛利的倒数）；');
        if(S.roiReal>r.be){ push('· 结论：现在的投法是赚的，可以继续；'); }
        else{ push('· 结论：现在的投法在保本线以下，先停一停，别急着加预算；'); }
      }else{
        push('· 投流已花 ¥'+fmtInt(S.boostCost||0)+'，但还没有笔记出判定，回报等红绿灯出来再算；');
      }
      if(bud && bud.ok){ push('· 模型估算的最划算月投放是 ¥'+fmtInt(bud.Bstar)+'，超过这个数性价比就开始往下走。'); }
      push('');
      push('同口径的明细在「该不该投」页。');
    }
    return R.join('\n');
  }
  /* 笔记标题：问题里出现某篇标题的连续 4 个字 */
  var nh=aiNoteHit(q, r);
  if(nh){
    var na=aiNoteEx(nh, r);
    if(na) return na;
  }
  if(/复盘|结案|报告|汇报|总结/.test(q)){
    return aiReport(/客户|结案/.test(q)?'client':'boss', r, sample, meta);
  }
  return '这个问题账本里没有对应的数据。我能回答的有：下个月预算怎么分、哪类内容最值得写、投流值不值、达人报价值不值、站外成交占多少、某篇笔记的账是怎么算的。';
}
function aiReport(kind, r, sample, meta){
  var S=r.summary||{}, M=meta.m||'订单', bud=aiBudget(r);
  var top=aiTopNotes(r,3), ts=aiTypesSorted(r), L=[];
  if(kind==='client'){
    L.push('【投放结案 · '+meta.name+'】');
    L.push('数据区间：'+S.days+' 天 · '+S.noteCount+' 篇笔记 · 站内 '+meta.inCh+' + 站外 '+meta.outCh);
    L.push('');
    L.push('一、投放成果');
    L.push('· 带来'+M+'增量 +'+fmt1(S.totalInc)+'（全渠道口径）；');
    if(S.outShare!=null){ L.push('· 其中站外渠道占 '+fmtPct(S.outShare)+'%——这部分在小红书站内后台里看不到；'); }
    L.push('· '+S.noteCount+' 篇内容里，'+S.real+' 篇被判定为真实有效。');
    L.push('');
    L.push('二、代表性笔记');
    if(top.length){
      top.forEach(function(t,i){ L.push((i+1)+'. 《'+t.title+'》 +'+fmt1(t.ex)+'（头两天超出基线）'); });
    }else{
      L.push('（还没有出结果的笔记。）');
    }
    L.push('');
    L.push('三、内容结构');
    if(ts.length){
      ts.slice(0,3).forEach(function(t){ L.push('· '+t.type+'：'+t.count+' 篇 · 平均每篇 +'+fmt1(t.avg)); });
    }else{
      L.push('（暂无分类数据。）');
    }
    L.push('');
    L.push('四、口径说明');
    L.push('· 「超出基线」= 发布后头两天实际量减去无笔记时的预期量；');
    L.push('· 数字全部由账本引擎计算，可逐笔记复核（见「笔记明细」页）。');
  }else{
    L.push('【种草复盘 · '+meta.name+'】');
    L.push('数据区间：'+S.days+' 天 · '+S.noteCount+' 篇笔记');
    L.push('');
    L.push('一、生意增量');
    L.push('· '+M+'增量合计 +'+fmt1(S.totalInc)+'；');
    if(S.outShare!=null){ L.push('· 站外渠道占 '+fmtPct(S.outShare)+'%，只看站内会低估这部分；'); }
    L.push('· 误判笔记 '+S.misjudged+' 篇（只看站内会判错结论）。');
    L.push('');
    L.push('二、笔记质量');
    L.push('· 真实有效 '+S.real+' 篇 / 待观察 '+S.maybe+' 篇 / 无明显效果 '+S.none+' 篇；');
    if(S.sepCost>0 && S.roiReal!=null){
      L.push('· 投流：花了 ¥'+fmtInt(S.sepCost)+'，真实回报 '+fmt2(S.roiReal)+'（保本线 '+fmt2(r.be)+'）；');
    }else if(S.boostCost>0){
      L.push('· 投流：花了 ¥'+fmtInt(S.boostCost)+'，回报要等红绿灯判定出来才有口径；');
    }else{
      L.push('· 投流：账本里暂无投流记录；');
    }
    L.push('');
    L.push('三、下一步');
    if(ts.length){ L.push('· 主力内容：'+ts[0].type+'（绿灯率最高）；'); }
    if(bud && bud.ok){ L.push('· 投流预算：每月 ¥'+fmtInt(bud.Bstar)+' 以内（性价比顶点），每篇 ¥'+fmtInt(bud.ch)+' 起步；'); }
    L.push('· 其余按总览页的待办清单执行。');
  }
  L.push('');
  L.push('（原型说明：本报告为规则模拟生成，全部数字来自账本引擎。）');
  return L.join('\n');
}
function aiTypeInto(bub, text){
  text=String(text==null?'':text);
  var i=0, seq=++AI.seq;
  var step=Math.max(2, Math.ceil(text.length/180));
  var timer=setInterval(function(){
    if(seq!==AI.seq){ clearInterval(timer); return; }
    i=Math.min(text.length, i+step);
    bub.textContent=text.slice(0,i);
    if(i>=text.length){ clearInterval(timer); AI.busy=false; }
  }, 14);
}
function renderAI(r, sample){
  AI.busy=false; AI.seq++;
  var meta=SHOP_META[state.shop]||{ name:'这家店', m:'订单', inCh:'站内', outCh:'站外' };
  var wrap=el('div','ai-wrap');
  /* 头部 */
  var head=el('section','card ai-head card-float');
  head.appendChild(el('div','ai-av','🤖'));
  var ht=el('div','ai-head-txt');
  ht.innerHTML='<div class="t1">AI 参谋<span class="ai-badge">🧪 规则模拟</span></div><div class="t2">当前账本：'+esc(meta.name)+' · 只引用本页算好的数字，不自己编数</div><div class="ai-note-line">观潮的 AI 只引用算法算出的数字，不自己编数。有问题也可以随时点右下角的"问观潮"。</div>';
  head.appendChild(ht);
  wrap.appendChild(head);

  /* 发布前体检（聊天区上方；切换店铺时 renderAI 重跑，即重新调用） */
  try{
    if(window.GuanchaoPlanner && typeof window.GuanchaoPlanner.renderNoteCheck==='function'){
      var PLANNER_EX={ study:'秋季申请季，我整理了一份文书准备清单', shop:'秋冬卧室香薰怎么选', coffee:'挂耳咖啡怎么泡才好喝' };
      var pex=PLANNER_EX[state.shop] || ((sample && sample.name ? sample.name : '这家店')+'的 3 个小技巧');
      var nc=el('section','card card-float');
      wrap.appendChild(nc);
      GuanchaoPlanner.renderNoteCheck(nc, { r:r, sample:sample, classify:classifyTitle, example:pex });
    }else{
      warn('planner.v1.js 未加载，跳过发布前体检');
    }
  }catch(e){ warn('发布前体检渲染失败：'+((e&&e.message)||e)); }

  var grid=el('div','ai-grid');
  var chat=el('section','card ai-chat card-float');
  var msgs=el('div','ai-msgs');
  var gret=el('div','ai-msg bot');
  gret.appendChild(el('div','ai-mav','🤖'));
  gret.appendChild(el('div','ai-bubble','问我这家店的种草账：预算怎么分、写什么、投流值不值……'));
  msgs.appendChild(gret);

  function scrollMsgs(){ try{ msgs.scrollTop=msgs.scrollHeight; }catch(e){} }
  function pushBot(gen){
    if(AI.busy) return;
    AI.busy=true;
    var brow=el('div','ai-msg bot');
    brow.appendChild(el('div','ai-mav','🤖'));
    var bub=el('div','ai-bubble');
    bub.innerHTML='<div class="pp-typing"><i></i><i></i><i></i><span>正在输入</span></div>';
    brow.appendChild(bub);
    msgs.appendChild(brow);
    scrollMsgs();
    setTimeout(function(){
      aiTypeInto(bub, gen());
      scrollMsgs();
    }, 550);
  }
  function aiSend(q){
    if(AI.busy) return;
    var urow=el('div','ai-msg me');
    urow.appendChild(el('div','ai-bubble', esc(q)));
    msgs.appendChild(urow);
    scrollMsgs();
    pushBot(function(){ return aiAnswer(q, r, sample, meta); });
  }

  /* 快捷问题 */
  var pills=el('div','ai-pills');
  var qs=['下个月预算怎么分？','哪类内容最值得多写？','给我 3 个下一篇的选题','投流到底值不值？'];
  var mn=aiMisoNote(r);
  if(mn){ qs.push('为什么《'+mn.title+'》只看站内会误判？'); }
  qs.forEach(function(q){
    var p=el('button','ai-pill'); p.type='button'; p.textContent=q;
    p.addEventListener('click', function(){ aiSend(q); });
    pills.appendChild(p);
  });

  /* 输入行 */
  var row=el('div','ai-inputrow');
  var inp=el('input','ai-input'); inp.type='text'; inp.placeholder='例如：下个月 5000 块预算怎么分？';
  var send=el('button','ai-send'); send.type='button'; send.textContent='发送';
  function doSend(){
    var t=String(inp.value||'').trim();
    if(!t) return;
    inp.value='';
    aiSend(t);
  }
  send.addEventListener('click', doSend);
  inp.addEventListener('keydown', function(e){ if(e && e.key==='Enter'){ e.preventDefault(); doSend(); } });
  row.appendChild(inp); row.appendChild(send);

  chat.appendChild(msgs); chat.appendChild(pills); chat.appendChild(row);

  /* 右栏：一键写报告 */
  var side=el('div','ai-side');
  var c1=el('section','card ai-tool card-float');
  c1.innerHTML='<h3>一键写报告</h3>'+
    '<p class="sub">数字全部来自账本，可直接复制发出</p>'+
    '<div class="ai-tbtns"><button type="button" class="ai-btn-red">给品牌客户的结案报告</button></div>';
  /* v14 收束：「给老板的复盘」去掉（行动包里的周报就是它），只留结案报告 */
  c1.querySelector('.ai-btn-red').addEventListener('click', function(){ pushBot(function(){ return aiReport('client', r, sample, meta); }); });
  side.appendChild(c1);

  /* v14 收束：「AI 自动识别内容类型」独立块去掉（发布前体检已自带识别） */
  grid.appendChild(chat); grid.appendChild(side);
  wrap.appendChild(grid);
  wrap.appendChild(el('div','ai-foot','ⓘ 原型中的 AI 回答为规则模拟；正式版接入大模型，并以账本数字作为唯一依据。'));
  return wrap;
}

/* ================= 导入数据 ================= */
var IMPORT_SEQ=0, IMPORT_KEYS={};
function selectShop(k){
  if(!k) return;
  if(k==='import'){
    if(state.view!=='merchant') setView('merchant');
    state.importMode=true;
  }else{
    if(!SHOP_META[k]){ toast('没听过这家店：'+k); return; }
    state.importMode=false;
    if(state.shop!==k) FX.runBar=true;
    state.shop=k;
  }
  WARN=[];
  updateShopSeg();
  render();
  window.scrollTo(0,0);
}
function impDate(off){
  var d=new Date(); d.setDate(d.getDate()+(off||0));
  function p(n){ return (n<10?'0':'')+n; }
  return d.getFullYear()+'-'+p(d.getMonth()+1)+'-'+p(d.getDate());
}
function impExampleDaily(){
  var pat=[3,5,2,4,6,3,2], out=[], i;
  for(i=47;i>=0;i--){ out.push(impDate(-i)+','+pat[i%7]+','+((i%3===0)?1:2)); }
  return out.join('\n');
}
function impExampleNotes(){
  return [
    impDate(-40)+',开店三个月踩过的坑,,,',
    impDate(-25)+',出租屋氛围感改造,,,',
    impDate(-12)+',新手第一支香薰怎么选,干货技巧,'+impDate(-10)+',300'
  ].join('\n');
}
function impSplitCsvLine(t){
  /* 带分隔符的切分：标题里可能正好有逗号，超过 8 列时把多余列并回标题（用原分隔符） */
  var raw=t.split(/([,，;；\t])/), f=[], d=[], i;
  for(i=0;i<raw.length;i+=2){ f.push(String(raw[i]).trim()); if(i+1<raw.length) d.push(raw[i+1]); }
  while(f.length>8 && f.length>3){ f[1]=f[1]+d[1]+f[2]; f.splice(2,1); d.splice(1,1); }
  return f;
}
function impParseDate(s){
  var m=/^(\d{4})[-/.年](\d{1,2})[-/.月](\d{1,2})日?$/.exec(String(s||'').trim());
  if(!m) return null;
  var y=+m[1], mo=+m[2], d=+m[3];
  var dt=new Date(y, mo-1, d);
  if(dt.getFullYear()!==y || dt.getMonth()!==mo-1 || dt.getDate()!==d) return null;
  function p(n){ return (n<10?'0':'')+n; }
  return y+'-'+p(mo)+'-'+p(d);
}
function renderImportForm(){
  var card=el('section','card imp-card card-float');
  card.innerHTML=
    '<h2 class="imp-title">导入你自己的数据</h2>'+
    '<p class="imp-sub">两家渠道（站内 + 站外）+ 每天流水 + 笔记发布记录，就能生成一本同款账本。数据只在你这台设备的浏览器里计算。</p>'+
    '<div class="imp-grid">'+
      '<div class="imp-field"><label>店铺名</label><input class="imp-in imp-name" placeholder="例如：XX烘焙小店"></div>'+
      '<div class="imp-field"><label>看什么</label><div class="imp-seg"><button type="button" class="imp-k-order on">订单</button><button type="button" class="imp-k-lead">咨询</button></div></div>'+
      '<div class="imp-field"><label>客单价（元）</label><input class="imp-in imp-price" placeholder="例如 89"></div>'+
      '<div class="imp-field"><label>毛利率（0–1）</label><input class="imp-in imp-margin" placeholder="例如 0.55"></div>'+
      '<div class="imp-field imp-ratef"><label>咨询→成交率（0–1）</label><input class="imp-in imp-rate" placeholder="例如 0.08"></div>'+
      '<div class="imp-field"><label>站内渠道名</label><input class="imp-in imp-inch" placeholder="例如：小红书店铺"></div>'+
      '<div class="imp-field"><label>站外渠道名</label><input class="imp-in imp-outch" placeholder="例如：淘宝店"></div>'+
    '</div>'+
    '<label class="imp-ta-lab">每天流水，一天一行：日期，站内数量，站外数量（至少 45 天）</label>'+
    '<textarea class="imp-ta imp-daily" rows="6" placeholder="2026-08-01,3,2"></textarea>'+
    '<label class="imp-ta-lab">笔记，一篇一行：发布日期，标题，类型（可空，自动识别），投流开始日期，投流花费（元）；达人合作笔记再加：达人名称，达人报价（元）；实验分组(可空，填 boost 或 hold)</label>'+
    '<textarea class="imp-ta imp-notes" rows="5" placeholder="2026-09-01,出租屋氛围感改造,场景种草,,"></textarea>'+
    '<label class="imp-ta-lab">大促或节假日日期（可选，每行一个，如 2026-06-18）</label>'+
    '<textarea class="imp-ta imp-promo" rows="2" placeholder="2026-06-18"></textarea>'+
    '<div class="imp-err" role="alert"></div>'+
    '<div class="imp-check" role="status"></div>'+
    '<div class="imp-btns">'+
      '<button type="button" class="btn-main imp-go">生成我的账本</button>'+
      '<button type="button" class="imp-ghost imp-fill">填入示例格式</button>'+
    '</div>';

  var kind='order';
  var bO=card.querySelector('.imp-k-order'), bL=card.querySelector('.imp-k-lead');
  function setKind(k){
    kind=k;
    bO.classList.toggle('on', k==='order');
    bL.classList.toggle('on', k==='lead');
    card.querySelector('.imp-ratef').style.display=(k==='lead')?'':'none';
    resetDC();
  }
  bO.addEventListener('click', function(){ setKind('order'); });
  bL.addEventListener('click', function(){ setKind('lead'); });
  setKind('order');

  card.querySelector('.imp-fill').addEventListener('click', function(){
    card.querySelector('.imp-daily').value=impExampleDaily();
    card.querySelector('.imp-notes').value=impExampleNotes();
    resetDC();
  });

  /* v6：数据体检状态（改了任何输入都要重新体检） */
  var dcAck=false;
  function resetDC(){
    dcAck=false;
    card.querySelector('.imp-go').disabled=false;
    card.querySelector('.imp-go').textContent='生成我的账本';
    var dcBox=card.querySelector('.imp-check');
    if(dcBox) dcBox.innerHTML='';
  }
  card.addEventListener('input', resetDC);

  function showErr(list){
    var e=card.querySelector('.imp-err');
    if(list && list.length){ e.textContent=list.join('\n'); e.classList.add('show'); }
    else{ e.textContent=''; e.classList.remove('show'); }
  }

  card.querySelector('.imp-go').addEventListener('click', function(){
    var errs=[], f;
    var name=String((f=card.querySelector('.imp-name')).value||'').trim();
    var ps=String(card.querySelector('.imp-price').value||'').trim();
    var ms=String(card.querySelector('.imp-margin').value||'').trim();
    var rs=String(card.querySelector('.imp-rate').value||'').trim();
    var inCh=String(card.querySelector('.imp-inch').value||'').trim();
    var outCh=String(card.querySelector('.imp-outch').value||'').trim();
    if(!name){ errs.push('店铺名还没填。'); }
    var price=+ps; if(!ps || !isFinite(price) || price<=0){ errs.push('客单价要填一个正数（例如 89）。'); }
    var margin=+ms;
    if(isFinite(margin) && margin>1 && margin<=100){ margin=margin/100; } /* 也接受 50 这种百分数写法 */
    if(!ms || !isFinite(margin) || margin<=0 || margin>1){ errs.push('毛利率要填 0–1 之间的小数（例如 0.55）。'); }
    var rate=1;
    if(kind==='lead'){
      rate=+rs;
      if(!rs || !isFinite(rate) || rate<=0 || rate>1){ errs.push('咨询→成交率要填 0–1 之间的小数（例如 0.08）。'); }
    }
    if(!inCh){ errs.push('站内渠道名还没填（例如：小红书店铺）。'); }
    if(!outCh){ errs.push('站外渠道名还没填（例如：淘宝店）。'); }
    if(inCh && outCh && inCh===outCh){ errs.push('站内、站外渠道名不能相同。'); }

    /* 每天流水 */
    var dmap={}, dkeys=[], dcount=0;
    String(String(card.querySelector('.imp-daily').value||'').replace(/^\uFEFF+/,'')).split(/\n/).forEach(function(line, idx){
      var t=line.trim(); if(!t) return;
      var parts=t.split(/[,，;；\t]/).map(function(x){ return x.trim(); });
      if(parts.length<3){ errs.push('每天流水第 '+(idx+1)+' 行：列数不够，要「日期，站内数量，站外数量」三列。'); return; }
      var d=impParseDate(parts[0]);
      if(!d){
        if(String(parts[0]).indexOf('日期')>=0){ return; } /* 模板表头行：自动跳过 */
        errs.push('每天流水第 '+(idx+1)+' 行：日期「'+parts[0]+'」看不懂，要 2026-08-01 这种写法。'); return;
      }
      if(dmap[d]){ errs.push('每天流水：日期 '+d+' 出现了两次，一天只能一行。'); return; }
      var x=+parts[1], o=+parts[2];
      if(!isFinite(x)||!isFinite(o)||x<0||o<0){ errs.push('每天流水第 '+(idx+1)+' 行：数量要是 0 或正数。'); return; }
      dmap[d]={ date:d, xhs:x, out:o };
      dkeys.push(d); dcount++;
    });
    if(dkeys.length){ dkeys.sort(); }
    if(dcount<45){ errs.push('每天流水只有 '+dcount+' 天，不够 45 天：基线要用至少 45 天的数据才稳，先继续记账再来。'); }

    /* 笔记 */
    var notes=[];
    String(String(card.querySelector('.imp-notes').value||'').replace(/^\uFEFF+/,'')).split(/\n/).forEach(function(line, idx){
      var t=line.trim(); if(!t) return;
      var parts=impSplitCsvLine(t);
      if(parts.length>8){ errs.push('笔记第 '+(idx+1)+' 行：列太多了（8 列封顶，标题里别用逗号）。'); return; }
      if(parts.length<2){ errs.push('笔记第 '+(idx+1)+' 行：至少要有「发布日期，标题」两列。'); return; }
      var d=impParseDate(parts[0]);
      if(!d){
        if(String(parts[0]).indexOf('日期')>=0){ return; } /* 模板表头行：自动跳过 */
        errs.push('笔记第 '+(idx+1)+' 行：日期「'+parts[0]+'」看不懂。'); return;
      }
      if(dkeys.length && (d<dkeys[0] || d>dkeys[dkeys.length-1])){ errs.push('笔记第 '+(idx+1)+' 行：发布日期 '+d+' 不在每天流水的日期范围内。'); return; }
      var title=parts[1];
      if(!title){ errs.push('笔记第 '+(idx+1)+' 行：标题是空的。'); return; }
      var type=parts[2]||'';
      if(!type){ type=classifyTitle(title); }
      var bdtS=parts[3]||'', bcS=parts[4]||'';
      /* 达人合作两列：达人名称 / 达人报价（空就不写） */
      var kolS=parts[5]||'', kolCS=parts[6]||'', kolName='', kolCost=null;
      if(kolS){ kolName=kolS; }
      if(kolCS){
        kolCost=+kolCS;
        if(!isFinite(kolCost) || kolCost<0){ errs.push('笔记第 '+(idx+1)+' 行：达人报价要是非负数字（元）。'); return; }
      }
      function withKol(o){
        if(kolName){ o.kol_name=kolName; }
        if(kolCost!=null && kolCS){ o.kol_cost=kolCost; }
        return o;
      }
      /* v6：实验分组（可空，boost 或 hold） */
      var eg=String(parts[7]||'').trim().toLowerCase();
      if(eg && eg!=='boost' && eg!=='hold'){ errs.push('笔记第 '+(idx+1)+' 行：实验分组只能填 boost 或 hold。'); return; }
      if(bdtS || bcS){
        if(!bdtS || !bcS){ errs.push('笔记第 '+(idx+1)+' 行：投流开始日期和投流花费要成对填。'); return; }
        var bd=impParseDate(bdtS);
        if(!bd){ errs.push('笔记第 '+(idx+1)+' 行：投流日期「'+bdtS+'」看不懂。'); return; }
        if(bd<d){ errs.push('笔记第 '+(idx+1)+' 行：投流开始日期不能早于发布日期。'); return; }
        var cost=+bcS;
        if(!isFinite(cost) || cost<0){ errs.push('笔记第 '+(idx+1)+' 行：投流花费要是非负数字（元）。'); return; }
        var oB=withKol({ date:d, title:title, type:type, boost_date:bd, boost_cost:cost });
        if(eg) oB.exp_group=eg;
        notes.push(oB);
      }else{
        var oN=withKol({ date:d, title:title, type:type });
        if(eg) oN.exp_group=eg;
        notes.push(oN);
      }
    });
    if(notes.length<1){ errs.push('至少要有一篇笔记（发布日期，标题）。'); }

    /* v6：大促/节假日日期（可选，每行一个） */
    var promoDates=[];
    String(String(card.querySelector('.imp-promo').value||'').replace(/^\uFEFF+/,'')).split(/\n/).forEach(function(line, idx){
      var t=line.trim(); if(!t) return;
      var pd=impParseDate(t);
      if(!pd){ errs.push('大促日期第 '+(idx+1)+' 行：「'+t+'」看不懂，要 2026-06-18 这种写法。'); return; }
      if(promoDates.indexOf(pd)<0) promoDates.push(pd);
    });

    if(errs.length){ showErr(errs); return; }
    showErr([]);

    /* v16：先显示「体检中…」，让按钮状态先刷出来，再跑体检和生成 */
    var goBtn=card.querySelector('.imp-go');
    if(!goBtn._checking){
      var goSelf=this;
      goBtn._checking=true; goBtn._label=goBtn.textContent;
      goBtn.textContent='体检中…'; goBtn.disabled=true;
      /* v20：逐项打勾的体检单，0.8 秒跑完 */
      var ckBox=card.querySelector('.imp-check');
      if(ckBox){
        ckBox.innerHTML='<div class="fx-check">'+['天数','缺天','重复','连续为零','尖峰'].map(function(t, i){ return '<span style="animation-delay:'+(i*0.16).toFixed(2)+'s">'+t+'<b>✓</b></span>'; }).join('')+'</div>';
      }
      setTimeout(function(){ goBtn.disabled=false; goBtn.textContent=goBtn._label; goSelf.click(); }, 900);
      return;
    }
    goBtn._checking=false;
    /* v6：生成前先做数据体检（engine.v5 dataCheck） */
    var dcBox=card.querySelector('.imp-check');
    var preSample={
      name:name, kind:kind, metric:(kind==='lead'?'咨询':'订单'), unit:'个',
      settings:{ price:price, margin:margin, conv_rate:(kind==='lead'?rate:1) },
      channels:[ { key:'xhs', name:inCh, scope:'in' }, { key:'out', name:outCh, scope:'out' } ],
      daily:dkeys.map(function(d){ return dmap[d]; }),
      notes:notes
    };
    if(promoDates.length) preSample.promo_dates=promoDates;
    var dc=null;
    if(typeof LedgerEngine!=='undefined' && LedgerEngine && typeof LedgerEngine.dataCheck==='function'){
      try{ dc=LedgerEngine.dataCheck(preSample); }catch(e){ dc=null; }
    }
    function dcList(items){
      return (items||[]).map(function(x){ return '<div class="imp-dc-'+esc(x.level)+'">'+esc(x.text)+'</div>'; }).join('');
    }
    if(dc && dc.issues && dc.issues.length){
      var hasErr=dc.issues.some(function(x){ return x.level==='error'; });
      if(hasErr){
        dcBox.innerHTML=dcList(dc.issues);
        goBtn.disabled=true;
        goBtn.textContent='先处理上面的问题';
        return;
      }
      if(!dcAck){
        dcBox.innerHTML=dcList(dc.issues);
        goBtn.textContent='知道了，继续生成';
        dcAck=true;
        return;
      }
    }
    if(dc && dc.ok){
      dcBox.innerHTML='<div class="imp-dc-ok">数据体检通过：'+dcount+' 天、'+notes.length+' 篇笔记</div>';
    }

    IMPORT_SEQ++;
    var key='my'+IMPORT_SEQ;
    var sample=preSample;
    try{ SAMPLES[key]=sample; }
    catch(e){ showErr(['注册店铺失败：'+((e&&e.message)||e)]); return; }
    IMPORT_KEYS[key]=1;
    SHOP_META[key]={ key:key, name:name, short:(name.length>6?name.slice(0,6):name), kind:kind,
      kindLabel:(kind==='lead'?'服务类 · 看咨询':'电商 · 看订单'), m:(kind==='lead'?'咨询':'订单'),
      price:price, inCh:inCh, outCh:outCh };
    var test=compute(key);
    if(test.err){
      delete SAMPLES[key]; delete SHOP_META[key]; delete IMPORT_KEYS[key];
      showErr([test.err]);
      return;
    }
    var b=el('button','seg-btn', esc(name.length>6?name.slice(0,6):name));
    b.dataset.shop=key;
    b.addEventListener('click', function(){ selectShop(key); });
    $('#segShop').appendChild(b);
    toast('账本生成好了：'+name);
    state.tab='overview';
    selectShop(key);
  });
  return card;
}

/* ================= 页签 & 控件 ================= */
function buildTabs(){
  var tabs=$('#tabs'), nav=$('#bottomNav');
  var inner=el('div','bottom-nav-inner bn-grouped');
  TAB_GROUPS.forEach(function(g){
    var tg=el('div','tab-group');
    tg.style.flexGrow=String(g.ids.length);
    tg.appendChild(el('div','tab-group-t', esc(g.t)));
    var tgb=el('div','tab-group-btns');
    var bg=el('div','bn-group');
    bg.style.flexGrow=String(g.ids.length);
    bg.appendChild(el('div','bn-group-t', esc(g.t)));
    var bgb=el('div','bn-group-btns');
    g.ids.forEach(function(id){
      var t=TABS.filter(function(x){ return x.id===id; })[0];
      if(!t) return;
      var b=el('button','tab-btn',''+esc(t.label));
      b.type='button';
      b.dataset.tab=t.id;
      b.addEventListener('click',function(){ switchTab(t.id); });
      tgb.appendChild(b);
      var n=el('button','bn-item',ICONS[t.icon]+'<span>'+esc(t.label)+'</span>');
      n.type='button';
      n.dataset.tab=t.id;
      n.addEventListener('click',function(){ switchTab(t.id); });
      bgb.appendChild(n);
    });
    tg.appendChild(tgb); tabs.appendChild(tg);
    bg.appendChild(bgb); inner.appendChild(bg);
  });
  nav.appendChild(inner);
}
function updateTabUI(){
  document.querySelectorAll('#tabs .tab-btn, #bottomNav .bn-item').forEach(function(b){
    b.classList.toggle('active', b.dataset.tab===state.tab);
  });
}
function fadeMain(dir){
  var m=$('#main'); if(!m) return;
  m.classList.remove('fade-in','slide-l','slide-r'); void m.offsetWidth;
  m.classList.add(dir>0? 'slide-r' : dir<0? 'slide-l' : 'fade-in');
}
function switchTab(id){
  if(state.importMode){ state.importMode=false; updateShopSeg(); }
  var fxFrom=TABS.map(function(t){ return t.id; }).indexOf(state.tab), fxTo=TABS.map(function(t){ return t.id; }).indexOf(id);
  state.tab=id;
  render();
  fadeMain(fxFrom<0||fxTo<0? 0 : (fxTo>fxFrom? 1 : fxTo<fxFrom? -1 : 0));
  window.scrollTo(0,0);
}
function buildControls(){
  document.querySelectorAll('#segShop .seg-btn').forEach(function(b){
    b.addEventListener('click',function(){ selectShop(b.dataset.shop); });
  });
  document.querySelectorAll('#segView .seg-btn').forEach(function(b){
    b.addEventListener('click',function(){
      setView(b.dataset.view);
    });
  });
}

/* ================= 种草侦探（detective.js） ================= */
function detectiveStory(){
  /* v6：假设调整（内存覆盖）也反映到种草侦探 */
  var src=SAMPLES, hasOvr=false, k;
  for(k in SETTING_OVR){ if(SETTING_OVR[k] && getRawSample(k)){ hasOvr=true; break; } }
  if(hasOvr){
    src={};
    for(k in SAMPLES){
      var s=SAMPLES[k];
      src[k]=(s && SETTING_OVR[k] && typeof s==='object')? Object.assign({}, s, { settings: SETTING_OVR[k] }) : s;
    }
  }
  return LedgerEngine.story(src);
}
function detectiveOpen(){
  if(!window.GuanchaoDetective) return;
  try{ GuanchaoDetective.open({ story: detectiveStory(), onExit: detectiveExit }); }
  catch(e){ try{ console.warn('[种草侦探] 打开失败', e); }catch(e2){} }
  armDetectiveResetBtn();
}
function detectiveExit(a){
  a=a||{};
  try{
    if(a.type==='skip'){
      toMerchantOverview(state.shop);
      tourHintShow();
    }else if(a.type==='actionpack'){
      toMerchantOverview(a.shop||'shop');
      flashActionPack();
    }else if(a.type==='ledger'){
      if(a.truths) FX.flyTruths=a.truths;
      FX.runBar=true;
      toMerchantOverview(a.shop||'shop');
    }else if(a.type==='tour'){
      if(a.truths) FX.flyTruths=a.truths;
      toMerchantOverview(a.shop||'shop');
      setTimeout(function(){ tourStart(); }, a.truths? 1300 : 250);
    }else if(a.type==='proposal'){
      enterManagerAndPropose(a.client||'coffee');
    }else if(a.type==='board'){
      if(state.view!=='manager') setView('manager'); else renderManager();
      window.scrollTo(0,0);
    }
  }catch(e){
    try{ console.warn('[种草侦探] 跳转失败', e); }catch(e2){}
    try{ toMerchantOverview(state.shop); }catch(e3){}
  }
}
function toMerchantOverview(shopKey){
  if(state.view!=='merchant') setView('merchant');
  if(shopKey && SHOP_META[shopKey] && shopKey!==state.shop){ state.shop=shopKey; state.importMode=false; }
  if(state.tab!=='overview'){ switchTab('overview'); }
  WARN=[];
  updateShopSeg(); updateTabUI();
  render();
  window.scrollTo(0,0);
}
function flashActionPack(){
  setTimeout(function(){
    var card=document.querySelector('#card-todo [data-gca]')||document.querySelector('#card-todo');
    if(!card) return;
    try{ card.scrollIntoView({behavior:'smooth', block:'start'}); }catch(e){ try{ card.scrollIntoView(); }catch(e2){} }
    card.classList.add('pack-flash');
    setTimeout(function(){ card.classList.remove('pack-flash'); }, 3400);
  }, 200);
}
function enterManagerAndPropose(clientKey){
  if(state.view!=='manager') setView('manager'); else renderManager();
  window.scrollTo(0,0);
  setTimeout(function(){
    var entries=managerEntries();
    var entry=entries.filter(function(x){ return x.key===clientKey; })[0];
    if(!entry) entry=entries.filter(function(x){ return x.key===state.shop; })[0];
    if(!entry) entry=entries[0];
    if(entry) showProposal(entry);
  }, 80);
}


/* ================= v15：3 分钟导览 ================= */
/* 聚光灯式 7 站：只切页签、切视角、展开卡片，不改任何数据和选择 */
var TOUR={ on:false, i:0, steps:null, start:null, ov:null, hole:null, pop:null, tgt:null, raf:0 };
var TOUR_SEEN='guanchao_tour_seen';
function tourSeen(){ try{ return localStorage.getItem(TOUR_SEEN)==='1'; }catch(e){ return false; } }
function tourMarkSeen(){ try{ localStorage.setItem(TOUR_SEEN,'1'); }catch(e){} }
function tourOpenWrap(sel){ var d=document.querySelector(sel); if(d && d.tagName==='DETAILS') d.open=true; return d; }
function tourToMerchant(tab){
  if(state.importMode){ state.importMode=false; updateShopSeg(); }
  if(state.view!=='merchant') setView('merchant');
  if(state.tab!==tab){ state.tab=tab; render(); }
}
function tourSteps(){
  var res=compute(state.shop);
  var r=res && !res.err ? res.r : null;
  var meta=SHOP_META[state.shop]||{ m:'订单' };
  var S=(r && r.summary)||{};
  var bud=r ? safeBudget(r) : null;
  var tM=null, tP=null;
  try{
    var LEC=(typeof LedgerEngine!=='undefined')?LedgerEngine:null;
    if(LEC && typeof LEC.winwin==='function'){
      tM=0; tP=0;
      managerEntries().forEach(function(e){ var w=LEC.winwin(e.res.r, e.res.sample); tM+=w.dMerchant; tP+=w.dPlatform; });
    }
  }catch(e){ tM=null; tP=null; }
  function sgnMoney(v){ if(!num(v)) return '—'; var x=Math.round(v); return (x>=0?'+':'−')+'¥'+Math.abs(x).toLocaleString('zh-CN'); }
  return [
    { prep:function(){ tourToMerchant('overview'); }, sel:'#card-hero', title:'先看总数',
      text:'这家店这期间种草一共多带来 '+fmtInt(S.totalInc)+' 个'+esc(meta.m)+'，'+fmtPct(S.outShare)+'% 在站外成交——只看站内会少算一截。' },
    { prep:function(){ tourToMerchant('overview'); }, sel:'#card-todo', title:'算法算数，AI 办事',
      text:'算法算出该做什么，AI 把投流单、内容稿、议价稿、周报都写好了，你只要点"采纳"。' },
    { prep:function(){ tourToMerchant('overview'); tourOpenWrap('#sec-boost'); }, sel:'#sec-boost', title:'投流到底值不值',
      text:'看起来每 1 元换回 '+fx2(S.roiSeen)+' 元，扣掉"本来就会来"的部分，真实是 '+fx2(S.roiReal)+' 元（保本线 '+fx2(r?r.be:null)+' 元）。' },
    { prep:function(){ tourToMerchant('invest'); }, sel:'#card-light', title:'投前判断',
      text:'新笔记发出两天，跑赢平时才投；每篇投多少也算好了。' },
    { prep:function(){ tourToMerchant('budget'); }, sel:'#card-curve', title:'下个月怎么花',
      text:'投到 '+(bud && num(bud.Bstar) ? fmtMoney(bud.Bstar) : '—')+' 之后，多投的钱就赚不回来了。' },
    { prep:function(){ if(state.view!=='manager') setView('manager'); }, sel:'#sec-winwin', title:'平台也赢',
      text:'算清账以后，商家每月多赚毛利 '+sgnMoney(tM)+'，平台每月多获投放 '+sgnMoney(tP)+'。' },
    { prep:function(){ tourToMerchant('overview'); tourOpenWrap('#sec-how'); }, sel:'#sec-how', title:'每个数都能追到底',
      text:'所有结论都标"估算级"，换 3 种算法不变才标"稳健"；用 300 组已知答案的模拟数据检验过，误判约 7%。每篇笔记旁边都有"这笔账怎么算的"。' }
  ];
}
function tourEnsureDom(){
  if(TOUR.ov) return;
  var ov=el('div','tour-ov'); ov.setAttribute('aria-hidden','true');
  var hole=el('div','tour-hole');
  var pop=el('div','tour-pop'); pop.setAttribute('role','dialog'); pop.setAttribute('aria-label','3 分钟导览');
  ov.addEventListener('click', function(ev){ ev.stopPropagation(); ev.preventDefault(); });
  document.body.appendChild(ov); document.body.appendChild(hole); document.body.appendChild(pop);
  TOUR.ov=ov; TOUR.hole=hole; TOUR.pop=pop;
}
function tourPlace(){
  if(!TOUR.on || !TOUR.tgt) return;
  var t=TOUR.tgt, hole=TOUR.hole, pop=TOUR.pop;
  var rc=t.getBoundingClientRect(), pad=6;
  var vw=document.documentElement.clientWidth, vh=window.innerHeight;
  var top=Math.max(4, rc.top-pad), left=Math.max(4, rc.left-pad);
  var bottom=Math.min(vh-4, rc.bottom+pad), right=Math.min(vw-4, rc.right+pad);
  hole.style.top=top+'px'; hole.style.left=left+'px';
  hole.style.width=Math.max(0,right-left)+'px'; hole.style.height=Math.max(0,bottom-top)+'px';
  if(vw<=640){ pop.style.left=''; pop.style.top=''; return; }
  var pw=pop.offsetWidth||340, ph=pop.offsetHeight||180;
  var px=Math.min(Math.max(12, left), vw-pw-12);
  var py;
  if(bottom+12+ph<=vh-8) py=bottom+12;
  else if(top-12-ph>=8) py=top-12-ph;
  else py=Math.max(8, vh-ph-16);
  pop.style.left=px+'px'; pop.style.top=py+'px';
}
function tourOnMove(){ if(TOUR.raf) return; TOUR.raf=requestAnimationFrame(function(){ TOUR.raf=0; tourPlace(); }); }
function tourKey(ev){ if(TOUR.on && ev.key==='Escape'){ ev.preventDefault(); tourEnd(); } }
function tourShow(i){
  if(!TOUR.on) return;
  TOUR.i=i;
  var st=TOUR.steps[i], n=TOUR.steps.length, last=(i===n-1);
  try{ st.prep(); }catch(e){ try{ console.warn('[导览] 切换失败', e); }catch(e2){} }
  if(i===0) TOUR.hole.classList.remove('show');
  TOUR.pop.classList.remove('show');
  setTimeout(function(){
    if(!TOUR.on || TOUR.i!==i) return;
    var t=document.querySelector(st.sel);
    TOUR.tgt=t;
    if(t){
      var rc=t.getBoundingClientRect(), vh=window.innerHeight;
      var mob=document.documentElement.clientWidth<=640;
      var y=mob ? (window.scrollY+rc.top-16) : (window.scrollY+rc.top-(rc.height<vh*0.62 ? (vh*0.42-rc.height/2) : 72));
      window.scrollTo(0, Math.max(0, y));
    }
    var pop=TOUR.pop;
    pop.innerHTML='<div class="tour-prog num">'+(i+1)+' / '+n+'</div>'+
      '<div class="tour-t">'+esc(st.title)+'</div>'+
      '<p class="tour-p">'+st.text+'</p>'+
      '<div class="tour-btns">'+
        (last ? '<button type="button" class="tour-b pri" data-t="home">回到总览</button><button type="button" class="tour-b" data-t="again">再看一遍</button>'
              : '<button type="button" class="tour-b pri" data-t="next">下一站 →</button><button type="button" class="tour-b" data-t="skip">跳过导览</button>')+
      '</div>';
    pop.querySelectorAll('[data-t]').forEach(function(b){
      b.addEventListener('click', function(ev){
        ev.stopPropagation();
        var k=b.getAttribute('data-t');
        if(k==='next') tourShow(i+1);
        else if(k==='skip') tourEnd();
        else if(k==='again') tourShow(0);
        else if(k==='home'){ tourEnd(true); tourToMerchant('overview'); window.scrollTo(0,0); }
      });
    });
    setTimeout(function(){
      if(!TOUR.on || TOUR.i!==i) return;
      tourPlace();
      TOUR.hole.classList.add('show'); pop.classList.add('show');
      var f=pop.querySelector('.tour-b.pri'); if(f){ try{ f.focus({ preventScroll:true }); }catch(e){} }
    }, 120);
  }, 180);
}
function tourStart(){
  if(!engineReady()) return;
  tourHintHide();
  closeTopMenu();
  try{ if(window.GuanchaoAsk && typeof GuanchaoAsk.close==='function') GuanchaoAsk.close(); }catch(e){}
  exdClose();
  TOUR.start={ view:state.view, tab:state.tab, importMode:state.importMode };
  TOUR.steps=tourSteps();
  tourEnsureDom();
  TOUR.on=true;
  tourMarkSeen();
  document.body.classList.add('tour-on');
  TOUR.ov.classList.add('show');
  window.addEventListener('scroll', tourOnMove, { passive:true });
  window.addEventListener('resize', tourOnMove);
  document.addEventListener('keydown', tourKey, true);
  tourShow(0);
}
/* 退出：默认回到导览开始前的视角和页签；stay=true 时不回（「回到总览」自己处理） */
function tourEnd(stay){
  if(!TOUR.on) return;
  TOUR.on=false; TOUR.tgt=null;
  window.removeEventListener('scroll', tourOnMove);
  window.removeEventListener('resize', tourOnMove);
  document.removeEventListener('keydown', tourKey, true);
  document.body.classList.remove('tour-on');
  if(TOUR.ov){ TOUR.ov.classList.remove('show'); TOUR.hole.classList.remove('show'); TOUR.pop.classList.remove('show'); }
  var s0=TOUR.start; TOUR.start=null;
  if(!stay && s0){
    if(s0.view==='manager'){ if(state.view!=='manager') setView('manager'); }
    else{
      if(state.view!=='merchant') setView('merchant');
      if(s0.importMode){ state.importMode=true; updateShopSeg(); render(); }
      else if(state.tab!==s0.tab){ state.tab=s0.tab; render(); }
    }
    window.scrollTo(0,0);
  }
}
/* 首次从侦探「跳过」进入账本：问观潮上方的小气泡，10 秒后自动消失；看过导览就不再出现 */
var TOUR_HINT={ node:null, timer:null };
function tourHintHide(){
  if(TOUR_HINT.timer){ clearTimeout(TOUR_HINT.timer); TOUR_HINT.timer=null; }
  if(TOUR_HINT.node && TOUR_HINT.node.parentNode) TOUR_HINT.node.parentNode.removeChild(TOUR_HINT.node);
  TOUR_HINT.node=null;
}
function tourHintShow(){
  if(tourSeen()) return;
  tourHintHide();
  var b=el('button','tour-hint','第一次来？3 分钟导览 →');
  b.type='button';
  b.addEventListener('click', function(){ tourHintHide(); tourStart(); });
  document.body.appendChild(b);
  TOUR_HINT.node=b;
  TOUR_HINT.timer=setTimeout(tourHintHide, 10000);
}

/* ================= v7：演示重置 ================= */
var RESET_ICON=S('<path d="M20 12a8 8 0 1 1-2.34-5.66"/><path d="M20 4v4h-4"/>');
function resetDemo(){ fxTideCover(resetDemoCore); }
function resetDemoCore(){
  FX.hero=null; FX.tide=null; FX.breathed=false; FX.light='';
  /* 1. 清掉 localStorage 里所有观潮写入的记录 */
  try{
    var rm=[], i, k;
    for(i=0;i<localStorage.length;i++){ k=localStorage.key(i); if(k && String(k).indexOf('guanchao')===0) rm.push(k); }
    for(i=0;i<rm.length;i++){ try{ localStorage.removeItem(rm[i]); }catch(e){} }
  }catch(e){}
  /* 各模块自带的重置接口 */
  try{ if(window.GuanchaoDetective && typeof GuanchaoDetective.reset==='function') GuanchaoDetective.reset(); }catch(e){}
  try{ if(window.GuanchaoAgent && typeof GuanchaoAgent.reset==='function') GuanchaoAgent.reset(); }catch(e){}
  try{ if(window.GuanchaoAsk && typeof GuanchaoAsk.reset==='function') GuanchaoAsk.reset(); }catch(e){}
  try{ if(window.GuanchaoAssumptions && typeof GuanchaoAssumptions.reset==='function') GuanchaoAssumptions.reset(); }catch(e){}
  try{ tourEnd(true); }catch(e){}
  tourHintHide();
  /* 2. 内存状态全部恢复默认 */
  state.shop='study'; state.tab='overview'; state.view='merchant'; state.checked={}; state.importMode=false;
  WARN=[];
  SETTING_OVR={}; OVR_STAMP++;
  RB_CACHE={ shop:'', stamp:-1, val:null };
  var kk;
  for(kk in IMPORT_KEYS){ try{ delete SAMPLES[kk]; }catch(e){} try{ delete SHOP_META[kk]; }catch(e){} }
  IMPORT_KEYS={}; IMPORT_SEQ=0;
  for(kk in SAMPLES_SNAPSHOT){ try{ SAMPLES[kk]=JSON.parse(JSON.stringify(SAMPLES_SNAPSHOT[kk])); }catch(e){} }
  NT.shop=null; BT.shop=null; INV.shop=null;
  if(MP.timer){ try{ clearTimeout(MP.timer); }catch(e){} MP.timer=null; }
  MP.card=null; MP.entry=null;
  var seg=$('#segShop');
  if(seg){ seg.querySelectorAll('.seg-btn').forEach(function(b){ if(/^my/.test(String(b.dataset.shop||''))) b.remove(); }); }
  document.body.classList.remove('view-manager');
  $('#main').hidden=false; $('#managerView').hidden=true;
  document.querySelectorAll('#segView .seg-btn').forEach(function(b){ b.classList.toggle('active', b.dataset.view==='merchant'); });
  updateShopSeg(); updateTabUI();
  render();
  window.scrollTo(0,0);
  /* 3. 回到种草侦探首页（与第一次打开一致）+ 2 秒后自动消失的小提示 */
  try{
    GuanchaoDetective.open({ story: detectiveStory(), onExit: detectiveExit });
    armDetectiveResetBtn();
  }catch(e){ try{ console.warn('[演示重置] 重新打开种草侦探失败', e); }catch(e2){} }
  try{
    if(window.GuanchaoAgent && typeof GuanchaoAgent.toast==='function'){ GuanchaoAgent.toast('已重置为首次打开状态'); }
    else{ toast('已重置为首次打开状态'); }
  }catch(e){ toast('已重置为首次打开状态'); }
}
/* 侦探顶栏「跳过，直接看账本」旁边追加同样的按钮 */
function armDetectiveResetBtn(){
  var top=null;
  try{ top=document.querySelector('.gcd-top'); }catch(e){}
  if(!top || top.querySelector('.gcd-demo-reset')) return;
  var b=el('button','gcd-demo-reset', RESET_ICON+'<span>演示重置</span>');
  b.type='button'; b.title='演示重置';
  b.addEventListener('click', function(ev){ ev.stopPropagation(); resetDemo(); });
  var skip=top.querySelector('#gcd-skip');
  if(skip && skip.parentNode===top){ top.insertBefore(b, skip); }else{ top.appendChild(b); }
}

/* ================= 启动 ================= */
buildTabs();
buildControls();
render();
/* v4：右下角「问观潮」悬浮面板（pages.js） */
function mountAskPanel(){
  if(typeof GuanchaoAsk==='undefined' || !GuanchaoAsk || typeof GuanchaoAsk.mount!=='function') return;
  function getContext(){
    if(state.view==='manager') return 'manager';
    if(state.importMode) return 'overview';
    return state.tab || 'overview';
  }
  function ask(q){
    return new Promise(function(resolve){
      var ans='';
      try{
        if(engineReady()){
          var res=compute(state.shop);
          var meta=SHOP_META[state.shop]||{ name:'这家店', m:'订单', inCh:'站内', outCh:'站外' };
          if(res && !res.err){ ans=aiAnswer(q, res.r, res.sample, meta); }
          else{ ans='这家店的账本还没算出来：先选一家示例店或导入数据，再问我。'; }
        }else{
          ans='计算引擎还没就位，先看看页面上的示例，或导入自己的数据。';
        }
      }catch(e){ ans='这个问题我暂时没接住，换个问法试试。'; }
      setTimeout(function(){ resolve(String(ans==null?'':ans)); }, 250);
    });
  }
  try{ GuanchaoAsk.mount({ getContext:getContext, ask:ask }); }catch(e){}
}
/* v14：顶栏收束——左「观潮 · 种草侦探」，中「视角 · 店铺」，右「幕后 · ⋯」；「⋯」里放演示重置（3 分钟导览也放这里） */
var TOP_MENU=null;
function closeTopMenu(){
  if(!TOP_MENU) return;
  TOP_MENU.menu.hidden=true;
  TOP_MENU.btn.setAttribute('aria-expanded','false');
}
function buildTopbar(){
  var inner=document.querySelector('.topbar-inner');
  if(!inner || document.getElementById('btnMore')) return;
  var bv=document.getElementById('btnVision');
  if(bv && bv.parentNode) bv.parentNode.removeChild(bv);
  var right=el('div','tb-right');
  var bb=document.getElementById('btnBehind');
  if(bb){ bb.className='brand-link tb-behind'; right.appendChild(bb); }
  var wrapM=el('div','tb-more-wrap');
  var btn=el('button','tb-more','<span aria-hidden="true">⋯</span>');
  btn.id='btnMore'; btn.type='button'; btn.title='更多';
  btn.setAttribute('aria-label','更多'); btn.setAttribute('aria-haspopup','menu'); btn.setAttribute('aria-expanded','false');
  var menu=el('div','tb-menu');
  menu.id='tbMenu'; menu.setAttribute('role','menu'); menu.hidden=true;
  wrapM.appendChild(btn); wrapM.appendChild(menu);
  right.appendChild(wrapM);
  inner.appendChild(right);
  TOP_MENU={ btn:btn, menu:menu };
  /* v18：「3 分钟导览」放在「种草侦探」右边，同款按钮但灰色，侦探仍是主入口；窄屏文字缩成「导览」 */
  var det=document.getElementById('btnDetective');
  if(det && det.parentNode && !document.getElementById('btnTour')){
    var tb=el('button','detective-btn tour-btn',
      '<'+'svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="9"></circle><path d="M15.5 8.5l-2 5-5 2 2-5z"></path></svg>'+
      '<span class="tb-tour-full">3 分钟导览</span><span class="tb-tour-short">导览</span>');
    tb.id='btnTour'; tb.type='button'; tb.title='3 分钟导览'; tb.setAttribute('aria-label','3 分钟导览');
    det.parentNode.insertBefore(tb, det.nextSibling);
    tb.addEventListener('click', function(){ tourStart(); });
  }
  var reset=document.getElementById('btnResetDemo');
  if(reset){
    reset.className='tb-menu-item';
    reset.setAttribute('role','menuitem');
    menu.appendChild(reset);
  }
  btn.addEventListener('click', function(ev){
    ev.stopPropagation();
    var open=menu.hidden;
    menu.hidden=!open;
    btn.setAttribute('aria-expanded', open?'true':'false');
  });
  menu.addEventListener('click', function(ev){
    var it=ev.target && ev.target.closest ? ev.target.closest('.tb-menu-item') : null;
    if(it) closeTopMenu();
  });
  document.addEventListener('click', function(ev){
    if(!menu.hidden && !(ev.target && ev.target.closest && ev.target.closest('.tb-more-wrap'))) closeTopMenu();
  });
  document.addEventListener('keydown', function(ev){ if(ev.key==='Escape') closeTopMenu(); });
}
/* 往「⋯」菜单里加一项：addTopMenuItem('3 分钟导览', 图标HTML, 点击函数, { first:true, id:'btnTour' }) */
function addTopMenuItem(label, iconHtml, onClick, opt){
  opt=opt||{};
  if(!TOP_MENU) buildTopbar();
  if(!TOP_MENU) return null;
  if(opt.id && document.getElementById(opt.id)) return document.getElementById(opt.id);
  var b=el('button','tb-menu-item',(iconHtml||'')+'<span>'+esc(label)+'</span>');
  b.type='button'; b.setAttribute('role','menuitem');
  if(opt.id) b.id=opt.id;
  b.addEventListener('click', function(){ closeTopMenu(); if(typeof onClick==='function') onClick(); });
  if(opt.first && TOP_MENU.menu.firstChild) TOP_MENU.menu.insertBefore(b, TOP_MENU.menu.firstChild);
  else TOP_MENU.menu.appendChild(b);
  return b;
}
window.GuanchaoTopMenu={ add:addTopMenuItem, close:closeTopMenu };
/* v14：「幕后」= 带目录的长页（为什么需要观潮 / 落地设想 / 怎么算 / 检验与局限 / 数据从哪来 / 术语表 / 48 小时） */
function openBehindPage(section){
  var GP=(typeof GuanchaoPages!=='undefined')?GuanchaoPages:null;
  if(!GP || typeof GP.openBehind!=='function') return;
  var S0=(typeof SAMPLES!=='undefined')?SAMPLES:null;
  try{
    GP.openBehind({
      samples:S0,
      howHtml:'<div class="how">'+howInnerHTML()+'</div>',
      dataNote:'导入时会自动体检：天数不够、缺天、重复、连续为零、异常尖峰都会当场提示。',
      section:section||null
    });
  }catch(e){ try{ console.warn('[幕后] 打开失败', e); }catch(e2){} }
}
function bindExtraPages(){
  buildTopbar();
  var bb=document.getElementById('btnBehind');
  if(bb) bb.addEventListener('click', function(){ openBehindPage(); });
}
mountAskPanel();
bindExtraPages();
try{ fxBindLogo(); fxFooter(); fxTitle(); }catch(e){}
/* v18：「3 分钟导览」已移到顶栏「种草侦探」右边，「⋯」里只留演示重置 */
(function bindResetDemo(){
  var b=(typeof document.getElementById==='function') ? document.getElementById('btnResetDemo') : null;
  if(b) b.addEventListener('click', resetDemo);
})();
(function bootDetective(){
  var b=(typeof document.getElementById==='function') ? document.getElementById('btnDetective') : null;
  if(b) b.addEventListener('click', detectiveOpen);
  if(!window.GuanchaoDetective || typeof GuanchaoDetective.autoOpen!=='function') return;
  try{
    var fxOpened=GuanchaoDetective.autoOpen({ story: detectiveStory(), onExit: detectiveExit });
    if(fxOpened) fxCurtain();
  }catch(e){ try{ console.warn('[种草侦探] 自动开启失败', e); }catch(e2){} }
  armDetectiveResetBtn();
})();
})();
