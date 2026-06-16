// ═══════════════════════════════════════════════════════
//  心臟循環升級版 script.js
//  升級：ECG、瓣膜狀態、壓力數值、體/肺切換、教師步驟點
//  保留：完整10題題庫、知識說明動態更新
// ═══════════════════════════════════════════════════════

const hCanvas = document.getElementById('heartCanvas');
const hCtx = hCanvas.getContext('2d');
const ecgCanvas = document.getElementById('ecgCanvas');
const ecgCtx = ecgCanvas.getContext('2d');

let isPlaying = true;
let speed = 1.0;
let focusMode = 'all';
let teachMode = true;
let phase = 0;          // 0~1 完整心動週期
let particles = [];
let ecgBuf = new Array(320).fill(0);
let shownSteps = new Set();

// ── 教師步驟提示節點 ──
const TEACH_STEPS = [
  { p:0.04, dur:5000, msg:'【第一心音】心室開始收縮，室內壓力升高。<strong>房室瓣瞬間關閉</strong>，防止血液倒流回心房，這就是我們聽到的「咚」聲。' },
  { p:0.14, dur:5000, msg:'【射血期開始】心室壓力超過動脈壓，<strong>半月瓣被推開</strong>。充氧血衝入主動脈，缺氧血衝入肺動脈，兩側同步射血。' },
  { p:0.42, dur:5000, msg:'【第二心音】心室開始舒張，壓力下降。動脈血試圖倒流，<strong>半月瓣立即關閉</strong>，這就是「噠」聲。此後心室進入充血準備。' },
  { p:0.60, dur:4500, msg:'【被動充血】心室壓低於心房，<strong>房室瓣開啟</strong>。血液從心房被動流入心室（約佔充血量的80%）。' },
  { p:0.82, dur:4500, msg:'【心房收縮】心房主動收縮，將最後約<strong>20%的血液</strong>擠入心室，完成充血，準備下一次射血。' },
];

// ── 各心動週期的側邊欄說明 ──
const STAGE_DESCS = [
  { range:[0, 0.08], title:'等容收縮期', desc:'心室開始收縮但半月瓣尚未打開。房室瓣已關閉（第一心音），心室容積<strong>暫時不變</strong>，壓力急速上升。', tip:'「等容」= 容積不變。兩組瓣膜同時關閉的特殊狀態，是大考高頻考點。' },
  { range:[0.08, 0.40], title:'射血期（心室收縮）', desc:'心室壓超越動脈壓，<strong>半月瓣推開</strong>。充氧血從左心室衝入主動脈；缺氧血從右心室衝入肺動脈。房室瓣保持關閉。', tip:'房室瓣關閉 / 半月瓣開啟 → 為射血期標準組合。' },
  { range:[0.40, 0.55], title:'等容舒張期', desc:'心室舒張，室內壓力驟降。動脈血試圖倒流，<strong>半月瓣立即關閉</strong>（第二心音）。此時兩組瓣膜再度同時關閉。', tip:'第二心音=半月瓣關閉。接下來壓力繼續降至低於心房壓時，房室瓣才開啟。' },
  { range:[0.55, 0.82], title:'心室充血期（被動）', desc:'心室壓低於心房，<strong>房室瓣開啟</strong>。血液從心房被動流入心室（佔充血量約80%），此階段心室體積增大。', tip:'「被動充血」不消耗能量，靠壓力差驅動。充血量的80%在此完成。' },
  { range:[0.82, 1.00], title:'心房收縮期', desc:'心房主動收縮，將最後約<strong>20%的血液</strong>用力擠入心室，完成充血。竇房結（節律點）在此時發出電訊號。', tip:'竇房結位於右心房壁靠近大靜脈入口處，是心臟的「天然節律器」。' },
];

// ═══ 畫布尺寸 ═══
function resize() {
  const ca = hCanvas.parentElement;
  const sz = Math.min(ca.clientWidth - 20, ca.clientHeight - 20, 500);
  hCanvas.width = hCanvas.height = sz * devicePixelRatio;
  hCanvas.style.width = hCanvas.style.height = sz + 'px';
  hCtx.scale(devicePixelRatio, devicePixelRatio);

  const ew = ecgCanvas.parentElement.clientWidth - 80;
  ecgCanvas.width = Math.max(ew, 100) * devicePixelRatio;
  ecgCanvas.height = 44 * devicePixelRatio;
  ecgCtx.scale(devicePixelRatio, devicePixelRatio);
  initParticles();
}

// ═══ 心動週期物理函數 ═══
function getCycleState(p) {
  const inEjection = p > 0.08 && p < 0.40;
  const inSystole  = p < 0.40;
  const inAtrSys   = p > 0.82;
  const ventP = inSystole
    ? 10 + Math.pow(Math.sin(p / 0.4 * Math.PI), 1.2) * 115
    : 8 + Math.exp(-(p - 0.4) * 6) * 28;
  const atrP = inAtrSys ? 14 : 5 + Math.sin(p * Math.PI * 2) * 2;
  const avOpen = p >= 0.55;
  const slOpen = inEjection;
  const beat   = inSystole ? Math.sin(p / 0.4 * Math.PI) * 0.06 : 0;
  return { inSystole, inEjection, inAtrSys, ventP, atrP, avOpen, slOpen, beat };
}

function getStageDesc(p) {
  return STAGE_DESCS.find(s => p >= s.range[0] && p < s.range[1]) || STAGE_DESCS[1];
}

// ═══ 粒子 ═══
function initParticles() {
  particles = [];
  for (let i = 0; i < 24; i++) {
    particles.push({ loop:'sys', prog: i/24, speed: 0.0028+Math.random()*0.002, r: 3+Math.random()*2, jit:(Math.random()-.5)*5 });
    particles.push({ loop:'pul', prog: i/24, speed: 0.0028+Math.random()*0.002, r: 3+Math.random()*2, jit:(Math.random()-.5)*5 });
  }
}

// ═══ 路徑 ═══
function getPaths(S) {
  const cx=S/2, cy=S/2, sc=S/480;
  const s=v=>v*sc;
  const RA={x:cx-s(88),y:cy-s(48)};
  const RV={x:cx-s(78),y:cy+s(58)};
  const LA={x:cx+s(78),y:cy-s(48)};
  const LV={x:cx+s(68),y:cy+s(58)};
  const sys=[
    {x:LV.x,y:LV.y},
    {x:LV.x+s(25),y:cy-s(92)},
    {x:cx+s(155),y:cy-s(82)},
    {x:cx+s(165),y:cy+s(95)},
    {x:cx+s(18),y:cy+s(138)},
    {x:RA.x+s(8),y:RA.y+s(8)},
    {x:RA.x,y:RA.y},
  ];
  const pul=[
    {x:RV.x,y:RV.y},
    {x:RV.x-s(28),y:cy-s(82)},
    {x:cx-s(175),y:cy-s(68)},
    {x:cx-s(170),y:cy+s(38)},
    {x:cx-s(38),y:cy+s(8)},
    {x:LA.x-s(8),y:LA.y+s(8)},
    {x:LA.x,y:LA.y},
  ];
  return {sys,pul,RA,RV,LA,LV,cx,cy,sc,s};
}

function pathPoint(path, prog, jit) {
  const n=path.length-1;
  const seg=Math.min(Math.floor(prog*n),n-1);
  const t=prog*n-seg;
  const p0=path[seg],p1=path[seg+1];
  const dx=p1.x-p0.x,dy=p1.y-p0.y,len=Math.hypot(dx,dy)||1;
  return {x:p0.x+dx*t+(-dy/len)*jit, y:p0.y+dy*t+(dx/len)*jit};
}

// ═══ 繪製 ═══
function draw() {
  const S = hCanvas.width / devicePixelRatio;
  hCtx.clearRect(0,0,S,S);
  hCtx.fillStyle='#0a0f1e'; hCtx.fillRect(0,0,S,S);

  const cs = getCycleState(phase);
  const {sys,pul,RA,RV,LA,LV,cx,cy,sc,s} = getPaths(S);

  // 管道背景光軌
  if (focusMode!=='pul') drawGlow(sys,'#e53e3e',0.10,s(7));
  if (focusMode!=='sys') drawGlow(pul,'#3b82f6',0.10,s(7));

  // 心臟外型
  drawHeartShape(cx,cy,sc,cs.beat);

  // 腔室
  drawChamber(RA.x,RA.y,s(40),s(34),cs.inSystole?0.08:0,'#3b82f6');
  drawChamber(RV.x,RV.y,s(48),s(40),cs.inSystole?0.14:0,'#3b82f6');
  drawChamber(LA.x,LA.y,s(40),s(34),cs.inSystole?0.08:0,'#e53e3e');
  drawChamber(LV.x,LV.y,s(48),s(42),cs.inSystole?0.16:0,'#e53e3e');

  // 腔室文字標籤
  drawChamberLabel(RA.x,RA.y-s(52),'右心房\n(RA)','#3b82f6',s(10));
  drawChamberLabel(RV.x,RV.y+s(52),'右心室\n(RV)','#3b82f6',s(10));
  drawChamberLabel(LA.x,LA.y-s(52),'左心房\n(LA)','#e53e3e',s(10));
  drawChamberLabel(LV.x,LV.y+s(52),'左心室\n(LV)','#e53e3e',s(10));

  // 瓣膜
  drawValve((RA.x+RV.x)/2, cy-s(6), cs.avOpen, '三尖瓣', sc);
  drawValve((LA.x+LV.x)/2, cy-s(6), cs.avOpen, '僧帽瓣', sc);
  drawValve(RV.x-s(10), cy-s(30), cs.slOpen, '肺動脈瓣', sc);
  drawValve(LV.x+s(6),  cy-s(30), cs.slOpen, '主動脈瓣', sc);

  // 血管標籤
  drawVesLabel(cx+s(128),cy-s(88),'主動脈','#e53e3e',sc);
  drawVesLabel(cx-s(145),cy-s(76),'肺動脈','#3b82f6',sc);
  drawVesLabel(cx-s(148),cy+s(50),'肺靜脈','#e53e3e',sc);
  drawVesLabel(cx+s(142),cy+s(108),'大靜脈','#3b82f6',sc);

  // 粒子更新與繪製
  const bpmMul = cs.inEjection ? 1.8 : (cs.inSystole ? 0.55 : 0.38);
  particles.forEach(p => {
    if (focusMode==='sys'&&p.loop!=='sys') return;
    if (focusMode==='pul'&&p.loop!=='pul') return;
    if (isPlaying) { p.prog += p.speed * speed * bpmMul; if(p.prog>=1) p.prog=0; }
    const path = p.loop==='sys' ? sys : pul;
    const pt = pathPoint(path, p.prog, p.jit);
    const isOxy = p.loop==='sys' ? p.prog<0.45 : p.prog>0.52;
    const col = isOxy ? '#e53e3e' : '#3b82f6';
    hCtx.shadowBlur=8; hCtx.shadowColor=isOxy?'#ff6b6b':'#60a5fa';
    hCtx.fillStyle=col;
    hCtx.beginPath(); hCtx.arc(pt.x,pt.y,p.r,0,Math.PI*2); hCtx.fill();
    hCtx.shadowBlur=0;
  });

  // 方向箭頭
  if(focusMode!=='pul') drawArrow(cx+s(162),cy-s(28), 0,       '#e53e3e', 0.75);
  if(focusMode!=='sys') drawArrow(cx-s(175),cy-s(18), Math.PI, '#3b82f6', 0.75);

  // 側邊欄同步更新
  updateSidebar(cs);
  drawECG(cs);
  if (teachMode) checkTeachStep();
}

// ── 繪製輔助 ──
function drawGlow(path, col, alpha, w) {
  hCtx.save();
  hCtx.strokeStyle=col; hCtx.lineWidth=w;
  hCtx.globalAlpha=alpha; hCtx.lineCap='round'; hCtx.lineJoin='round';
  hCtx.shadowBlur=14; hCtx.shadowColor=col;
  hCtx.beginPath();
  path.forEach((p,i)=>i===0?hCtx.moveTo(p.x,p.y):hCtx.lineTo(p.x,p.y));
  hCtx.stroke(); hCtx.restore();
}

function drawHeartShape(cx,cy,sc,beat) {
  const s=v=>v*sc, b=1-beat;
  hCtx.save(); hCtx.translate(cx,cy); hCtx.scale(b,b);
  const g=hCtx.createRadialGradient(0,0,s(8),0,0,s(125));
  g.addColorStop(0,'#2d1a24'); g.addColorStop(1,'#160a12');
  hCtx.fillStyle=g; hCtx.strokeStyle='#7c3a54'; hCtx.lineWidth=s(9);
  hCtx.beginPath();
  hCtx.moveTo(0,s(-55));
  hCtx.bezierCurveTo(s(-88),s(-105),s(-112),s(12),0,s(105));
  hCtx.bezierCurveTo(s(112),s(12),s(88),s(-105),0,s(-55));
  hCtx.fill(); hCtx.stroke();
  // 中隔
  hCtx.strokeStyle='#4a2536'; hCtx.lineWidth=s(7);
  hCtx.beginPath(); hCtx.moveTo(s(-4),s(-48)); hCtx.bezierCurveTo(s(-4),s(20),s(-4),s(50),s(-4),s(98)); hCtx.stroke();
  // 橫隔（房室分隔）
  hCtx.lineWidth=s(6);
  hCtx.beginPath(); hCtx.moveTo(s(-78),s(4)); hCtx.lineTo(s(78),s(4)); hCtx.stroke();
  hCtx.restore();
}

function drawChamber(x,y,rx,ry,pulse,col) {
  const alpha=0.20+pulse*0.28, beat=1-pulse*0.1;
  hCtx.save(); hCtx.translate(x,y); hCtx.scale(beat,beat);
  hCtx.fillStyle=col; hCtx.globalAlpha=alpha;
  hCtx.shadowBlur=pulse>0.04?16:0; hCtx.shadowColor=col;
  hCtx.beginPath(); hCtx.ellipse(0,0,rx,ry,0,0,Math.PI*2); hCtx.fill();
  hCtx.shadowBlur=0; hCtx.globalAlpha=0.45;
  hCtx.strokeStyle=col; hCtx.lineWidth=1.5;
  hCtx.beginPath(); hCtx.ellipse(0,0,rx,ry,0,0,Math.PI*2); hCtx.stroke();
  hCtx.restore();
}

function drawChamberLabel(x,y,txt,col,fs) {
  hCtx.save(); hCtx.fillStyle=col; hCtx.globalAlpha=0.7;
  hCtx.font=`${fs}px PingFang TC,sans-serif`; hCtx.textAlign='center';
  txt.split('\n').forEach((line,i)=>hCtx.fillText(line,x,y+i*fs*1.3));
  hCtx.restore();
}

function drawValve(x,y,isOpen,name,sc) {
  const s=v=>v*sc;
  const col=isOpen?'#00e5a0':'#ff4d6d';
  hCtx.save(); hCtx.translate(x,y);
  hCtx.strokeStyle=col; hCtx.lineWidth=s(2.5); hCtx.lineCap='round';
  hCtx.shadowBlur=isOpen?10:0; hCtx.shadowColor=col;
  if(isOpen){
    hCtx.beginPath();hCtx.moveTo(s(-9),s(-7));hCtx.lineTo(s(-9),s(7));hCtx.stroke();
    hCtx.beginPath();hCtx.moveTo(s(9),s(-7));hCtx.lineTo(s(9),s(7));hCtx.stroke();
  } else {
    hCtx.beginPath();hCtx.moveTo(s(-9),0);hCtx.lineTo(s(9),0);hCtx.stroke();
  }
  hCtx.shadowBlur=0;
  hCtx.fillStyle=col; hCtx.globalAlpha=0.75;
  hCtx.font=`${s(7.5)}px PingFang TC,sans-serif`; hCtx.textAlign='center';
  hCtx.fillText(name,0,s(-12));
  hCtx.restore();
}

function drawVesLabel(x,y,txt,col,sc) {
  hCtx.save();
  hCtx.fillStyle=col; hCtx.globalAlpha=0.82;
  hCtx.font=`bold ${sc*11}px PingFang TC,sans-serif`; hCtx.textAlign='center';
  hCtx.fillText(txt,x,y); hCtx.restore();
}

function drawArrow(x,y,rot,col,alpha) {
  hCtx.save(); hCtx.translate(x,y); hCtx.rotate(rot); hCtx.globalAlpha=alpha;
  hCtx.strokeStyle=col; hCtx.fillStyle=col; hCtx.lineWidth=2;
  hCtx.beginPath(); hCtx.moveTo(-11,0); hCtx.lineTo(11,0);
  hCtx.moveTo(5,-5); hCtx.lineTo(11,0); hCtx.lineTo(5,5);
  hCtx.stroke(); hCtx.restore();
}

// ═══ 側邊欄同步 ═══
function updateSidebar(cs) {
  // 即時數值
  document.getElementById('cyclePhase').textContent =
    cs.inSystole ? (cs.inEjection ? '射血期' : '等容收縮期') : (cs.inAtrSys ? '心房收縮期' : '心室充血期');
  document.getElementById('ventP').textContent = Math.round(cs.ventP) + ' mmHg';
  document.getElementById('atrP').textContent  = Math.round(cs.atrP)  + ' mmHg';

  const avEl=document.getElementById('avValve');
  avEl.innerHTML=cs.avOpen?'<span class="vdot open"></span> 開啟':'<span class="vdot closed"></span> 關閉';
  const slEl=document.getElementById('slValve');
  slEl.innerHTML=cs.slOpen?'<span class="vdot open"></span> 開啟':'<span class="vdot closed"></span> 關閉';

  // 動態說明
  const st=getStageDesc(phase);
  document.getElementById('statusTitle').textContent=st.title;
  document.getElementById('statusDesc').innerHTML=st.desc;
  document.getElementById('examTip').textContent=st.tip;
}

// ═══ ECG ═══
function ecgSample(p) {
  if(p<0.055) return Math.sin(p/0.055*Math.PI)*0.28;
  if(p<0.075) return 0;
  if(p<0.09)  return -Math.sin((p-0.075)/0.015*Math.PI)*0.28;
  if(p<0.11)  return  Math.sin((p-0.09)/0.02*Math.PI)*1.0;
  if(p<0.155) return -Math.sin((p-0.11)/0.045*Math.PI)*0.38;
  if(p<0.16)  return 0;
  if(p<0.30)  return  Math.sin((p-0.16)/0.14*Math.PI)*0.38;
  return 0;
}

function drawECG(cs) {
  ecgBuf.push(ecgSample(phase));
  if(ecgBuf.length>320) ecgBuf.shift();
  const W=ecgCanvas.width/devicePixelRatio, H=ecgCanvas.height/devicePixelRatio;
  ecgCtx.clearRect(0,0,W,H);
  ecgCtx.fillStyle='#0a0f1e'; ecgCtx.fillRect(0,0,W,H);
  // 基線
  ecgCtx.strokeStyle='rgba(255,255,255,0.07)'; ecgCtx.lineWidth=1;
  ecgCtx.beginPath(); ecgCtx.moveTo(0,H/2); ecgCtx.lineTo(W,H/2); ecgCtx.stroke();
  // 波形
  ecgCtx.strokeStyle='#00e5a0'; ecgCtx.lineWidth=1.5;
  ecgCtx.shadowBlur=4; ecgCtx.shadowColor='#00e5a0';
  ecgCtx.beginPath();
  ecgBuf.forEach((v,i)=>{
    const x=i/ecgBuf.length*W, y=H/2-v*H*0.4;
    i===0?ecgCtx.moveTo(x,y):ecgCtx.lineTo(x,y);
  });
  ecgCtx.stroke(); ecgCtx.shadowBlur=0;
}

// ═══ 教師步驟提示 ═══
function checkTeachStep() {
  const overlay=document.getElementById('stepOverlay');
  for(const step of TEACH_STEPS) {
    if(!shownSteps.has(step.p) && Math.abs(phase-step.p)<0.013) {
      shownSteps.add(step.p);
      overlay.innerHTML=step.msg;
      overlay.classList.remove('hidden');
      setTimeout(()=>overlay.classList.add('hidden'), step.dur);
    }
  }
}

// ═══ 主迴圈 ═══
let lastTs=0;
function loop(ts) {
  const dt=Math.min((ts-lastTs)/1000, 0.05);
  lastTs=ts;
  if(isPlaying) {
    phase += dt * speed * 0.52;
    if(phase>=1){ phase-=1; shownSteps.clear(); }
  }
  draw();
  requestAnimationFrame(loop);
}

// ═══ UI 事件 ═══
document.getElementById('btnPlay').onclick = function() {
  isPlaying=!isPlaying;
  this.textContent=isPlaying?'⏸ 暫停':'▶ 播放';
  this.className=isPlaying?'btn primary':'btn';
};

document.getElementById('btnStep').onclick = function() {
  const next=TEACH_STEPS.find(s=>s.p>phase+0.008);
  if(next){phase=next.p-0.004;}else{phase=0;shownSteps.clear();}
  isPlaying=true;
  document.getElementById('btnPlay').textContent='⏸ 暫停';
  document.getElementById('btnPlay').className='btn primary';
};

document.getElementById('btnReset').onclick = function() {
  phase=0; shownSteps.clear(); isPlaying=true;
  document.getElementById('btnPlay').textContent='⏸ 暫停';
  document.getElementById('btnPlay').className='btn primary';
  document.getElementById('stepOverlay').classList.add('hidden');
};

document.getElementById('speedSlider').oninput = function() {
  speed=parseFloat(this.value);
  document.getElementById('speedVal').textContent=speed.toFixed(1)+'×';
};

document.querySelectorAll('.fbtn').forEach(b=>{
  b.onclick=function(){
    document.querySelectorAll('.fbtn').forEach(x=>x.classList.remove('active'));
    this.classList.add('active'); focusMode=this.dataset.f;
  };
});

document.getElementById('modeTeach').onclick=function(){
  teachMode=true; shownSteps.clear();
  this.classList.add('active');
  document.getElementById('modeSelf').classList.remove('active');
};
document.getElementById('modeSelf').onclick=function(){
  teachMode=false;
  this.classList.add('active');
  document.getElementById('modeTeach').classList.remove('active');
  document.getElementById('stepOverlay').classList.add('hidden');
};

window.addEventListener('resize',()=>{resize();});

// ═══════════════════════════════════════════════════════
//  完整 10 題題庫（保留原版所有題目與解析）
// ═══════════════════════════════════════════════════════
const quizData = [
  {
    q:'1. 醫生使用聽診器在病人的胸前聽到「咚、噠」的心音，其中體積較大、聲音較長的「第一心音（咚）」主要是由下列哪一個生理事件所產生的？',
    opts:['A) 心房收縮，血液充填至心室的撞擊聲','B) 心室收縮，導致房室瓣瞬間關閉的振動聲','C) 心室舒張，導致半月瓣緊急關閉的阻擋聲','D) 血液由大靜脈流回右心房的摩擦聲'],
    a:'B',
    r:'第一心音出現在心室收縮早期。此時心室強力收縮使室內壓飆升，為了防止血液逆流回心房，「房室瓣（僧帽瓣與三尖瓣）」會瞬間關閉，引發結構振動，形成第一心音。而第二心音則是半月瓣關閉所致。'
  },
  {
    q:'2. 當我們在做健康檢查時，常聽到的「血壓高低」是指血液流經下列哪一種血管時，血管壁所承受的側壓力？',
    opts:['A) 主動脈與大動脈','B) 全身組織微血管','C) 上下大靜脈','D) 肺靜脈'],
    a:'A',
    r:'一般醫學上量測的血壓（收縮壓與舒張壓），是指心室射血時對「動脈壁」產生的壓力。當血液流經微血管與靜脈時，壓力已大幅衰減，因此靜脈血壓極低，無法用傳統血壓計量測。'
  },
  {
    q:'3. 一顆紅血球由大腿肌肉的微血管出發，若要前往肺部進行氣體交換，在不流經其他多餘分支的路徑下，它「最少」必須流經心臟的房室幾次？',
    opts:['A) 右心房1次、右心室1次','B) 左心房1次、左心室1次','C) 右心房、右心室、左心房、左心室各1次','D) 直接經由下大靜脈進入肺動脈，不需經過心室'],
    a:'A',
    r:'下肢缺氧血經由下大靜脈回流，首先進入「右心房」，隨後進入「右心室」，再由右心室壓入肺動脈前往肺部。因此在到達肺部之前，它只經過右側的心房與心室各1次。'
  },
  {
    q:'4. 有關人體充氧血與缺氧血的分布區域，下列哪一組血管或心臟腔室的配對中，內部流動的完全是「充氧血」？',
    opts:['A) 右心房、肺動脈','B) 左心室、大靜脈','C) 左心房、肺靜脈','D) 右心室、主動脈'],
    a:'C',
    r:'人體的心臟左半邊（左心房、左心室）以及離開肺部的「肺靜脈」、前往全身的「主動脈」，內部流動的都是富含氧氣的充氧血（鮮紅色）；右半邊與肺動脈、大靜脈則流缺氧血。'
  },
  {
    q:'5. 若某位病人的心臟「半月瓣」因疾病而出現嚴重閉鎖不全的現象，這會直接導致心臟在何種生理狀態時，血液發生倒流？',
    opts:['A) 心房收縮時，血液倒流回大靜脈','B) 心室收縮時，血液倒流回心房','C) 心室舒張時，動脈血倒流回心室','D) 心房舒張時，心室血倒流回心房'],
    a:'C',
    r:'半月瓣（動脈瓣）位於心室與動脈的交界處。當心室舒張時，動脈內的壓力高於心室，此時半月瓣應當關閉以阻止血液倒流。若半月瓣閉鎖不全，動脈血就會在「心室舒張時」逆流回心室，加重心臟負擔。'
  },
  {
    q:'6. 有關血管結構與生理特徵的比較，下列哪一項敘述是完全符合生物學事實的？',
    opts:['A) 靜脈的管壁最厚、彈性最好，能承受高壓','B) 動脈內部具有許多瓣膜，用以防止血液倒流','C) 微血管僅由單層上皮細胞構成，是物質交換的唯一場所','D) 血液在三種血管中的流速快慢為：靜脈 > 動脈 > 微血管'],
    a:'C',
    r:'微血管管壁僅由單層上皮細胞構成，管徑極小、血流速度最慢，最利於組織間的物質交換。動脈壁最厚彈性最好且無瓣膜；靜脈內具有瓣膜以防止逆流；流速大小為動脈 > 靜脈 > 微血管。'
  },
  {
    q:'7. 在人體的血液循環系統中，哪一條血管內部的血液其「二氧化碳濃度最低、氧氣濃度最高」？',
    opts:['A) 主動脈','B) 肺靜脈','C) 肺動脈','D) 上大靜脈'],
    a:'B',
    r:'血液在流經肺部微血管時，會排除二氧化碳並吸飽氧氣。因此，剛離開肺部、準備流回左心房的「肺靜脈」，是全身上下氧氣濃度最高（二氧化碳最低）的血管。'
  },
  {
    q:'8. 某臨床藥物是由手臂的靜脈注射打入人體，若該藥物的目標是治癒患者的「肺部發炎」，則藥物分子隨血液循環首度抵達肺部的路徑順序為何？',
    opts:['A) 手臂靜脈 → 上大靜脈 → 右心房 → 右心室 → 肺動脈 → 肺部','B) 手臂靜脈 → 肺靜脈 → 左心房 → 左心室 → 主動脈 → 肺部','C) 手臂靜脈 → 右心房 → 左心房 → 肺動脈 → 肺部','D) 手臂靜脈 → 主動脈 → 右心室 → 右心房 → 肺部'],
    a:'A',
    r:'靜脈注射的藥物會順著體循環靜脈回流至「上大靜脈」，進入「右心房」、再到「右心室」，隨後經由「肺動脈」直接進入肺部微血管網。此時尚未進入左心與體循環動脈。'
  },
  {
    q:'9. 正常狀況下，當心臟的「心房收縮」時，下列腔室與瓣膜的動態敘述何者正確？',
    opts:['A) 房室瓣關閉，血液留在心房','B) 房室瓣開啟，血液被推入心室','C) 半月瓣開啟，血液射入動脈','D) 心室同時處於收縮狀態'],
    a:'B',
    r:'當心房收縮時，心房內壓力略高，此時「房室瓣會開啟」，將心房內的血液做最後的擠壓充填，擠入「處於舒張狀態的心室」。此時半月瓣是關閉的。'
  },
  {
    q:'10. 門診中常有「心律不整」的個案，是因為心臟內部負責發出電訊號、主導心肌協調收縮的組織發生異常。這個人體天然的「節律點（PaceMaker）」位於心臟的哪一個位置？',
    opts:['A) 左心室壁底部','B) 右心房壁靠近大靜脈入口處','C) 房室中隔的正中央','D) 主動脈基部的半月瓣後方'],
    a:'B',
    r:'心臟的天然節律點被稱為「竇房結（SA node）」，它位於「右心房壁」靠近上大靜脈的入口處。它能自主且規律地發出微弱電訊號，傳導至全心肌，引導心房與心室依序收縮舒張。'
  }
];

let currentQ = 0;

function renderQuiz() {
  const q=quizData[currentQ];
  document.getElementById('quiz-q').textContent=q.q;
  document.getElementById('quizProgress').textContent=`${currentQ+1} / ${quizData.length}`;
  const optsEl=document.getElementById('quiz-opts');
  optsEl.innerHTML='';
  ['A','B','C','D'].forEach((key,i)=>{
    const btn=document.createElement('button');
    btn.className='opt-btn'; btn.textContent=q.opts[i];
    btn.onclick=()=>checkAnswer(key);
    optsEl.appendChild(btn);
  });
  const fb=document.getElementById('quiz-feedback');
  fb.style.display='none'; fb.className='quiz-feedback';
  document.getElementById('btn-next-quiz').style.display='none';
}

function checkAnswer(userKey) {
  const q=quizData[currentQ];
  const btns=document.querySelectorAll('.opt-btn');
  btns.forEach(b=>b.disabled=true);
  const idx=['A','B','C','D'].indexOf(userKey);
  const correctIdx=['A','B','C','D'].indexOf(q.a);
  btns[idx].classList.add(userKey===q.a?'correct':'wrong');
  if(userKey!==q.a) btns[correctIdx].classList.add('correct');

  const fb=document.getElementById('quiz-feedback');
  fb.style.display='block';
  if(userKey===q.a){
    fb.className='quiz-feedback correct';
    fb.innerHTML=`<strong>🟢 回答正確！</strong><br>${q.r}`;
  } else {
    fb.className='quiz-feedback wrong';
    fb.innerHTML=`<strong>🔴 答錯了（正確答案是 ${q.a}）</strong><br>${q.r}`;
  }
  document.getElementById('btn-next-quiz').style.display='block';
}

document.getElementById('btn-next-quiz').onclick=function(){
  currentQ=(currentQ+1)%quizData.length;
  renderQuiz();
};

// ═══ 啟動 ═══
window.addEventListener('resize',resize);
window.addEventListener('DOMContentLoaded',()=>{
  resize();
  renderQuiz();
  requestAnimationFrame(loop);
});
