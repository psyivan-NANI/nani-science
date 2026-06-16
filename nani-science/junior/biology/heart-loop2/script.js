// heart-loop2 升級版：體循環+肺循環完整模擬，保留10題題庫
const canvas = document.getElementById('heartFlowCanvas');
const ctx = canvas.getContext('2d');
const ecgCanvas = document.getElementById('ecgCanvas');
const ecgCtx = ecgCanvas.getContext('2d');

let isPlaying = true, speed = 1.0, focusMode = 'all', teachMode = true;
let phase = 0, shownSteps = new Set();
let particles = [], ecgBuf = new Array(320).fill(0);

const TEACH_STEPS = [
  {p:0.04,dur:5000,msg:'【等容收縮期】心室開始收縮，<strong>兩組瓣膜同時關閉</strong>。心室容積暫時不變，壓力急速上升——這是大考最常考的特殊狀態！'},
  {p:0.14,dur:5000,msg:'【射血期】心室壓超越動脈壓，<strong>半月瓣打開</strong>。左心室射充氧血入主動脈（體循環啟動）；右心室射缺氧血入肺動脈（肺循環啟動）。兩側同步進行！'},
  {p:0.44,dur:5000,msg:'【半月瓣關閉】心室舒張，動脈血試圖倒流，<strong>半月瓣立即關閉</strong>（第二心音「噠」）。注意：此時兩組瓣膜再度同時關閉（等容舒張期）。'},
  {p:0.62,dur:4500,msg:'【肺循環氣體交換】缺氧血在肺泡微血管<strong>排出CO₂、吸收O₂</strong>，轉變為充氧血，再由肺靜脈送回左心房。肺靜脈流充氧血（與名稱相反！）'},
  {p:0.84,dur:4500,msg:'【心房收縮】心房主動收縮，房室瓣開啟，<strong>最後20%血液擠入心室</strong>。完成充血，準備下一次射血。竇房結在此發出電訊號。'},
];

const STAGE_DESCS = [
  {range:[0,0.08],title:'等容收縮期',desc:'心室開始收縮，<strong>兩組瓣膜皆關閉</strong>（房室瓣+半月瓣）。心室容積不變，壓力急速上升。',tip:'兩組瓣膜同時關閉=等容期。是大考超高頻考點，需特別記憶。'},
  {range:[0.08,0.40],title:'射血期（心室收縮）',desc:'心室壓超越動脈壓，<strong>半月瓣開啟</strong>。充氧血由左心室→主動脈；缺氧血由右心室→肺動脈。兩側同步射血。',tip:'此時房室瓣關閉 / 半月瓣開啟。左右心臟「同步射血」概念要記清楚。'},
  {range:[0.40,0.56],title:'等容舒張期',desc:'心室舒張，壓力驟降。<strong>半月瓣關閉</strong>（第二心音），房室瓣尚未開啟。兩組瓣膜再度同時關閉。',tip:'第二心音＝半月瓣關閉。連同等容收縮期，共有兩段「兩閥皆關」的時期。'},
  {range:[0.56,0.84],title:'心室充血期（被動）',desc:'心室壓低於心房，<strong>房室瓣開啟</strong>。血液從心房被動流入心室（約佔充血量80%）。同時肺部完成氣體交換。',tip:'被動充血佔80%，心房主動收縮佔20%。肺靜脈此時正在送充氧血回左心房。'},
  {range:[0.84,1.00],title:'心房收縮期',desc:'心房主動收縮，<strong>最後20%血液</strong>擠入心室，完成充血。竇房結（右心房壁）發出電訊號。',tip:'竇房結是天然節律點（PaceMaker），位於右心房靠近大靜脈入口處。'},
];

function resize(){
  const ca=canvas.parentElement;
  const sz=Math.min(ca.clientWidth-20,ca.clientHeight-20,500);
  canvas.width=canvas.height=sz*devicePixelRatio;
  canvas.style.width=canvas.style.height=sz+'px';
  ctx.scale(devicePixelRatio,devicePixelRatio);
  const ew=ecgCanvas.parentElement.clientWidth-80;
  ecgCanvas.width=Math.max(ew,100)*devicePixelRatio;
  ecgCanvas.height=44*devicePixelRatio;
  ecgCtx.scale(devicePixelRatio,devicePixelRatio);
  initParticles();
}

function getCycleState(p){
  const inEjection=p>0.08&&p<0.40, inSystole=p<0.40, inAtrSys=p>0.84;
  const ventP=inSystole?10+Math.pow(Math.sin(p/0.4*Math.PI),1.2)*115:8+Math.exp(-(p-0.4)*6)*28;
  const atrP=inAtrSys?14:5+Math.sin(p*Math.PI*2)*2;
  return{inSystole,inEjection,inAtrSys,ventP,atrP,avOpen:p>=0.56,slOpen:inEjection,beat:inSystole?Math.sin(p/0.4*Math.PI)*0.06:0};
}

function getStageDesc(p){return STAGE_DESCS.find(s=>p>=s.range[0]&&p<s.range[1])||STAGE_DESCS[1];}

function initParticles(){
  particles=[];
  for(let i=0;i<24;i++){
    particles.push({loop:'sys',prog:i/24,speed:0.0028+Math.random()*0.002,r:3+Math.random()*2,jit:(Math.random()-.5)*5});
    particles.push({loop:'pul',prog:i/24,speed:0.0028+Math.random()*0.002,r:3+Math.random()*2,jit:(Math.random()-.5)*5});
  }
}

function getPaths(S){
  const cx=S/2,cy=S/2,sc=S/480,s=v=>v*sc;
  const RA={x:cx-s(88),y:cy-s(48)},RV={x:cx-s(78),y:cy+s(58)};
  const LA={x:cx+s(78),y:cy-s(48)},LV={x:cx+s(68),y:cy+s(58)};
  const sys=[{x:LV.x,y:LV.y},{x:LV.x+s(25),y:cy-s(92)},{x:cx+s(155),y:cy-s(82)},{x:cx+s(165),y:cy+s(95)},{x:cx+s(18),y:cy+s(138)},{x:RA.x+s(8),y:RA.y+s(8)},{x:RA.x,y:RA.y}];
  const pul=[{x:RV.x,y:RV.y},{x:RV.x-s(28),y:cy-s(82)},{x:cx-s(175),y:cy-s(68)},{x:cx-s(170),y:cy+s(38)},{x:cx-s(38),y:cy+s(8)},{x:LA.x-s(8),y:LA.y+s(8)},{x:LA.x,y:LA.y}];
  return{sys,pul,RA,RV,LA,LV,cx,cy,sc,s};
}

function pathPoint(path,prog,jit){
  const n=path.length-1,seg=Math.min(Math.floor(prog*n),n-1),t=prog*n-seg;
  const p0=path[seg],p1=path[seg+1],dx=p1.x-p0.x,dy=p1.y-p0.y,len=Math.hypot(dx,dy)||1;
  return{x:p0.x+dx*t+(-dy/len)*jit,y:p0.y+dy*t+(dx/len)*jit};
}

function draw(){
  const S=canvas.width/devicePixelRatio;
  ctx.clearRect(0,0,S,S);ctx.fillStyle='#0a0f1e';ctx.fillRect(0,0,S,S);
  const cs=getCycleState(phase);
  const{sys,pul,RA,RV,LA,LV,cx,cy,sc,s}=getPaths(S);

  if(focusMode!=='pul')drawGlow(sys,'#e53e3e',0.10,s(7));
  if(focusMode!=='sys')drawGlow(pul,'#3b82f6',0.10,s(7));
  drawHeartShape(cx,cy,sc,cs.beat);
  drawChamber(RA.x,RA.y,s(40),s(34),cs.inSystole?0.08:0,'#3b82f6');
  drawChamber(RV.x,RV.y,s(48),s(40),cs.inSystole?0.14:0,'#3b82f6');
  drawChamber(LA.x,LA.y,s(40),s(34),cs.inSystole?0.08:0,'#e53e3e');
  drawChamber(LV.x,LV.y,s(48),s(42),cs.inSystole?0.16:0,'#e53e3e');
  drawLabel(RA.x,RA.y-s(52),'右心房(RA)','#3b82f6',s(10));
  drawLabel(RV.x,RV.y+s(52),'右心室(RV)','#3b82f6',s(10));
  drawLabel(LA.x,LA.y-s(52),'左心房(LA)','#e53e3e',s(10));
  drawLabel(LV.x,LV.y+s(52),'左心室(LV)','#e53e3e',s(10));
  drawValve((RA.x+RV.x)/2,cy-s(6),cs.avOpen,'三尖瓣',sc);
  drawValve((LA.x+LV.x)/2,cy-s(6),cs.avOpen,'僧帽瓣',sc);
  drawValve(RV.x-s(10),cy-s(30),cs.slOpen,'肺動脈瓣',sc);
  drawValve(LV.x+s(6),cy-s(30),cs.slOpen,'主動脈瓣',sc);
  drawLabel(cx+s(128),cy-s(88),'主動脈','#e53e3e',s(11));
  drawLabel(cx-s(145),cy-s(76),'肺動脈','#3b82f6',s(11));
  drawLabel(cx-s(148),cy+s(50),'肺靜脈','#e53e3e',s(11));
  drawLabel(cx+s(142),cy+s(108),'大靜脈','#3b82f6',s(11));

  const bpmMul=cs.inEjection?1.8:(cs.inSystole?0.55:0.38);
  particles.forEach(p=>{
    if(focusMode==='sys'&&p.loop!=='sys')return;
    if(focusMode==='pul'&&p.loop!=='pul')return;
    if(isPlaying){p.prog+=p.speed*speed*bpmMul;if(p.prog>=1)p.prog=0;}
    const path=p.loop==='sys'?sys:pul;
    const pt=pathPoint(path,p.prog,p.jit);
    const isOxy=p.loop==='sys'?p.prog<0.45:p.prog>0.52;
    const col=isOxy?'#e53e3e':'#3b82f6';
    ctx.shadowBlur=8;ctx.shadowColor=isOxy?'#ff6b6b':'#60a5fa';
    ctx.fillStyle=col;ctx.beginPath();ctx.arc(pt.x,pt.y,p.r,0,Math.PI*2);ctx.fill();ctx.shadowBlur=0;
  });

  if(focusMode!=='pul')drawArrow(cx+s(162),cy-s(28),0,'#e53e3e',0.75);
  if(focusMode!=='sys')drawArrow(cx-s(175),cy-s(18),Math.PI,'#3b82f6',0.75);

  // 步驟時間軸高亮
  const stepIdx=phase<0.04?0:phase<0.08?1:phase<0.40?2:phase<0.56?3:4;
  document.querySelectorAll('.step-node').forEach((n,i)=>n.classList.toggle('active',i===stepIdx));

  updateSidebar(cs);drawECG();
  if(teachMode)checkTeachStep();
}

function drawGlow(path,col,alpha,w){
  ctx.save();ctx.strokeStyle=col;ctx.lineWidth=w;ctx.globalAlpha=alpha;
  ctx.lineCap='round';ctx.lineJoin='round';ctx.shadowBlur=14;ctx.shadowColor=col;
  ctx.beginPath();path.forEach((p,i)=>i===0?ctx.moveTo(p.x,p.y):ctx.lineTo(p.x,p.y));
  ctx.stroke();ctx.restore();
}

function drawHeartShape(cx,cy,sc,beat){
  const s=v=>v*sc,b=1-beat;
  ctx.save();ctx.translate(cx,cy);ctx.scale(b,b);
  const g=ctx.createRadialGradient(0,0,s(8),0,0,s(125));
  g.addColorStop(0,'#2d1a24');g.addColorStop(1,'#160a12');
  ctx.fillStyle=g;ctx.strokeStyle='#7c3a54';ctx.lineWidth=s(9);
  ctx.beginPath();ctx.moveTo(0,s(-55));
  ctx.bezierCurveTo(s(-88),s(-105),s(-112),s(12),0,s(105));
  ctx.bezierCurveTo(s(112),s(12),s(88),s(-105),0,s(-55));
  ctx.fill();ctx.stroke();
  ctx.strokeStyle='#4a2536';ctx.lineWidth=s(7);
  ctx.beginPath();ctx.moveTo(s(-4),s(-48));ctx.bezierCurveTo(s(-4),s(20),s(-4),s(50),s(-4),s(98));ctx.stroke();
  ctx.lineWidth=s(6);ctx.beginPath();ctx.moveTo(s(-78),s(4));ctx.lineTo(s(78),s(4));ctx.stroke();
  ctx.restore();
}

function drawChamber(x,y,rx,ry,pulse,col){
  const alpha=0.20+pulse*0.28,beat=1-pulse*0.1;
  ctx.save();ctx.translate(x,y);ctx.scale(beat,beat);
  ctx.fillStyle=col;ctx.globalAlpha=alpha;ctx.shadowBlur=pulse>0.04?16:0;ctx.shadowColor=col;
  ctx.beginPath();ctx.ellipse(0,0,rx,ry,0,0,Math.PI*2);ctx.fill();
  ctx.shadowBlur=0;ctx.globalAlpha=0.45;ctx.strokeStyle=col;ctx.lineWidth=1.5;
  ctx.beginPath();ctx.ellipse(0,0,rx,ry,0,0,Math.PI*2);ctx.stroke();ctx.restore();
}

function drawLabel(x,y,txt,col,fs){
  ctx.save();ctx.fillStyle=col;ctx.globalAlpha=0.8;
  ctx.font=fs+'px PingFang TC,sans-serif';ctx.textAlign='center';
  ctx.fillText(txt,x,y);ctx.restore();
}

function drawValve(x,y,isOpen,name,sc){
  const s=v=>v*sc,col=isOpen?'#00e5a0':'#ff4d6d';
  ctx.save();ctx.translate(x,y);ctx.strokeStyle=col;ctx.lineWidth=s(2.5);ctx.lineCap='round';
  ctx.shadowBlur=isOpen?10:0;ctx.shadowColor=col;
  if(isOpen){ctx.beginPath();ctx.moveTo(s(-9),s(-7));ctx.lineTo(s(-9),s(7));ctx.stroke();ctx.beginPath();ctx.moveTo(s(9),s(-7));ctx.lineTo(s(9),s(7));ctx.stroke();}
  else{ctx.beginPath();ctx.moveTo(s(-9),0);ctx.lineTo(s(9),0);ctx.stroke();}
  ctx.shadowBlur=0;ctx.fillStyle=col;ctx.globalAlpha=0.75;
  ctx.font=s(7.5)+'px PingFang TC,sans-serif';ctx.textAlign='center';ctx.fillText(name,0,s(-12));ctx.restore();
}

function drawArrow(x,y,rot,col,alpha){
  ctx.save();ctx.translate(x,y);ctx.rotate(rot);ctx.globalAlpha=alpha;
  ctx.strokeStyle=col;ctx.lineWidth=2;ctx.beginPath();
  ctx.moveTo(-11,0);ctx.lineTo(11,0);ctx.moveTo(5,-5);ctx.lineTo(11,0);ctx.lineTo(5,5);
  ctx.stroke();ctx.restore();
}

function updateSidebar(cs){
  const st=getStageDesc(phase);
  document.getElementById('statusTitle').textContent=st.title;
  document.getElementById('statusDesc').innerHTML=st.desc;
  document.getElementById('examTip').textContent=st.tip;
}

function ecgSample(p){
  if(p<0.055)return Math.sin(p/0.055*Math.PI)*0.28;
  if(p<0.075)return 0;
  if(p<0.09)return-Math.sin((p-0.075)/0.015*Math.PI)*0.28;
  if(p<0.11)return Math.sin((p-0.09)/0.02*Math.PI)*1.0;
  if(p<0.155)return-Math.sin((p-0.11)/0.045*Math.PI)*0.38;
  if(p<0.30)return Math.sin((p-0.155)/0.145*Math.PI)*0.38;
  return 0;
}

function drawECG(){
  ecgBuf.push(ecgSample(phase));if(ecgBuf.length>320)ecgBuf.shift();
  const W=ecgCanvas.width/devicePixelRatio,H=ecgCanvas.height/devicePixelRatio;
  ecgCtx.clearRect(0,0,W,H);ecgCtx.fillStyle='#0a0f1e';ecgCtx.fillRect(0,0,W,H);
  ecgCtx.strokeStyle='rgba(255,255,255,0.07)';ecgCtx.lineWidth=1;
  ecgCtx.beginPath();ecgCtx.moveTo(0,H/2);ecgCtx.lineTo(W,H/2);ecgCtx.stroke();
  ecgCtx.strokeStyle='#00e5a0';ecgCtx.lineWidth=1.5;ecgCtx.shadowBlur=4;ecgCtx.shadowColor='#00e5a0';
  ecgCtx.beginPath();ecgBuf.forEach((v,i)=>{const x=i/ecgBuf.length*W,y=H/2-v*H*0.4;i===0?ecgCtx.moveTo(x,y):ecgCtx.lineTo(x,y);});
  ecgCtx.stroke();ecgCtx.shadowBlur=0;
}

function checkTeachStep(){
  const overlay=document.getElementById('stepOverlay');
  for(const step of TEACH_STEPS){
    if(!shownSteps.has(step.p)&&Math.abs(phase-step.p)<0.013){
      shownSteps.add(step.p);overlay.innerHTML=step.msg;overlay.classList.remove('hidden');
      setTimeout(()=>overlay.classList.add('hidden'),step.dur);
    }
  }
}

let lastTs=0;
function loop(ts){
  const dt=Math.min((ts-lastTs)/1000,0.05);lastTs=ts;
  if(isPlaying){phase+=dt*speed*0.52;if(phase>=1){phase-=1;shownSteps.clear();}}
  draw();requestAnimationFrame(loop);
}

document.getElementById('btnPlay').onclick=function(){
  isPlaying=!isPlaying;this.textContent=isPlaying?'⏸ 暫停':'▶ 播放';this.className=isPlaying?'btn primary':'btn';
};
document.getElementById('btnStep').onclick=function(){
  const next=TEACH_STEPS.find(s=>s.p>phase+0.008);
  if(next){phase=next.p-0.004;}else{phase=0;shownSteps.clear();}
  isPlaying=true;document.getElementById('btnPlay').textContent='⏸ 暫停';document.getElementById('btnPlay').className='btn primary';
};
document.getElementById('btnReset').onclick=function(){
  phase=0;shownSteps.clear();isPlaying=true;
  document.getElementById('btnPlay').textContent='⏸ 暫停';document.getElementById('btnPlay').className='btn primary';
  document.getElementById('stepOverlay').classList.add('hidden');
};
document.getElementById('speedSlider').oninput=function(){speed=parseFloat(this.value);document.getElementById('speedVal').textContent=speed.toFixed(1)+'×';};
document.querySelectorAll('.fbtn').forEach(b=>{b.onclick=function(){document.querySelectorAll('.fbtn').forEach(x=>x.classList.remove('active'));this.classList.add('active');focusMode=this.dataset.f;};});
document.getElementById('modeTeach').onclick=function(){teachMode=true;shownSteps.clear();this.classList.add('active');document.getElementById('modeSelf').classList.remove('active');};
document.getElementById('modeSelf').onclick=function(){teachMode=false;this.classList.add('active');document.getElementById('modeTeach').classList.remove('active');document.getElementById('stepOverlay').classList.add('hidden');};
window.addEventListener('resize',resize);

const quizData = [
    {
        q: "1. 當血液由右心室出發，經過肺部微血管完成氣體交換後，會轉變成何種血液？並首先流回哪一個腔室？",
        opts: ["(A) 缺氧血，流回左心房", "(B) 充氧血，流回左心房", "(C) 減氧血，流回右心房", "(D) 減氧血，流回左心室"],
        a: "B",
        r: "在肺部微血管完成氣體交換後，血液會轉變為富含氧氣的『充氧血（鮮紅色）』，並透過肺靜脈首先送回心臟的『左心房』。"
    },
    {
        q: "2. 胎兒在母體子宮內時無法進行肺呼吸。為此，胎兒心臟的左、右心房之間存在一個特化通道稱為「卵圓孔」。請問卵圓孔的主要生理功能為何？",
        opts: ["(A) 讓體循環的缺氧血直接進入左心室", "(B) 使右心房的充氧血直接流入左心房，繞過尚未充氣的肺部循環", "(C) 增加肺動脈的血流量以維持肺部發育", "(D) 阻止血液流入主動脈"],
        a: "B",
        r: "胎兒的氧氣來自胎盤，其肺部尚未充氣塌陷。右心房的血流大部份會透過『卵圓孔』直接射入左心房，直接進入體循環供應全身，繞過無功能的肺循環。"
    },
    {
        q: "3. 臨床上，醫生為病患量測血壓時，水銀血壓計所顯示的數值（如 120 / 80 mmHg），其中的「120（收縮壓）」代表心臟處於下列哪一種生理狀態時血管壁受到的壓力？",
        opts: ["(A) 心房收縮，房室瓣開啟", "(B) 心室收縮，半月瓣開啟，血液射入動脈", "(C) 全心舒張，血液大口湧入心房", "(D) 心室舒張，半月瓣關閉防止倒流"],
        a: "B",
        r: "收縮壓（高壓）是指『心室收縮』時，心室內壓超越動脈壓，推開半月瓣將大量血液強力注入動脈弓時，大動脈壁所承受的最大壓力。"
    },
    {
        q: "4. 如果某位病患因為細菌性心內膜炎，導致其「僧帽瓣（左房室瓣）」出現嚴重的毀損與閉鎖不全。請問當他的心臟「心室收縮」時，最可能引發下列哪一種病理現象？",
        opts: ["(A) 右心室的缺氧血逆流回右心房", "(B) 左心室的充氧血逆流回左心房", "(C) 主動脈的血液逆流回左心室", "(D) 肺動脈的血液逆流回右心室"],
        a: "B",
        r: "僧帽瓣（二尖瓣）位於左心房與左心室之間。功能是在心室收縮時關閉，防止血液逆流。若閉鎖不全，在『心室收縮』時，左心室的血液就會強力逆流回『左心房』。"
    },
    {
        q: "5. 生物老師在課堂上比喻：「人體某種血管管壁極薄、血流速度最慢、總管徑截面積最大，就像是物資卸載的港口。」請問老師描述的是哪一種血管？",
        opts: ["(A) 大動脈", "(B) 小動脈", "(C) 微血管", "(D) 大靜脈"],
        a: "C",
        r: "微血管僅由單層上皮細胞構成，其管徑最小、血流速度最慢，但全身上下微血管的『總截面積最大』，這提供了極佳的環境與充裕的時間進行物質交換。"
    },
    {
        q: "6. 在哺乳動物的雙循環（體循環與肺循環）系統中，下列哪一組血管內所流動的血液，其「氧氣濃度」在正常狀況下是完全相同的？",
        opts: ["(A) 主動脈 與 肺動脈", "(B) 肺靜脈 與 主動脈", "(C) 上大靜脈 與 肺靜脈", "(D) 肺動脈 與 肺靜脈"],
        a: "B",
        r: "剛離開肺部進行完氣體交換的『肺靜脈』內部是充氧血。這批血液流回左心房、左心室後，隨即被泵入『主動脈』送往全身。因此兩者內的氧氣濃度完全一致。"
    },
    {
        q: "7. 當我們聽診心音時，所聽到的第二心音（聲音較清脆、頻率較高、較短促的「噠」聲），主要是由下列哪一個心臟結構的變動所引發的？",
        opts: ["(A) 房室瓣關閉引起的振動", "(B) 半月瓣關閉引起的阻斷振動", "(C) 竇房結發出電訊號的衝擊", "(D) 心肌強力收縮時的肌肉摩擦聲"],
        a: "B",
        r: "第二心音發生於心室舒張早期。此時心室內壓驟降，動脈內的血液企圖倒流回心室，促使『半月瓣（主動脈瓣與肺動脈瓣）』緊急關閉，血液撞擊瓣膜引發振動。"
    },
    {
        q: "8. 假設某運動員在進行高強度訓練時，其心臟的每搏輸出量（Stroke Volume）為 100 mL，心跳速率為 150 bpm。請問該運動員此時的心輸出量（Cardiac Output）為每分鐘多少公升？",
        opts: ["(A) 1.5 公升", "(B) 10 公升", "(C) 15 公升", "(D) 150 公升"],
        a: "C",
        r: "心輸出量（CO）= 每搏輸出量（SV）× 心率（HR）。計算方式：100 mL × 150 bpm = 15000 mL/min = 15 L/min。"
    },
    {
        q: "9. 長途熬夜打電動的小明突然覺得下肢外側靜脈劇烈腫痛，就醫後診斷為「深層靜脈血栓（DVT）」。若這個位於腳部的血栓不小心脫落並隨血流回流，它『最先』會在哪一個器官的微血管網造成栓塞而引發危險？",
        opts: ["(A) 腦部", "(B) 肝臟", "(C) 腎臟", "(D) 肺部"],
        a: "D",
        r: "下肢靜脈血栓脫落後，會順著下大靜脈回流至右心房、右心室。右心室隨後將血液與血栓壓入『肺動脈』送往『肺部』。由於肺部微血管網極細密，會在此處卡住，造成致命的『肺栓塞』。"
    },
    {
        q: "10. 在心臟週期的「等容收縮期（Isovolumetric Contraction Phase）」中，此時心臟腔室與瓣膜的狀態呈現下列何種奇特的生理組合？",
        opts: ["(A) 心房收縮，房室瓣與半月瓣皆開啟", "(B) 心室收縮，房室瓣關閉但半月瓣尚未開啟", "(C) 心室舒張，房室瓣與半月瓣皆開啟", "(D) 心室舒張，房室瓣關閉且半月瓣開啟"],
        a: "B",
        r: "在等容收縮期，心室開始收縮，室內壓升高導致房室瓣瞬間關閉（產生第一心音），但此時室內壓還沒超越動脈壓，半月瓣也處於關閉狀態。在『兩組瓣膜皆關閉』下，心室容積不變。"
    }
];

let currentQ=0;
function renderQuiz(){
  const q=quizData[currentQ];
  document.getElementById('quiz-q').textContent=q.q;
  document.getElementById('quizProgress').textContent=(currentQ+1)+' / '+quizData.length;
  const optsEl=document.getElementById('quiz-opts');optsEl.innerHTML='';
  const keys=['A','B','C','D'];
  q.opts.forEach((opt,i)=>{
    const btn=document.createElement('button');btn.className='opt-btn';btn.textContent=opt;
    btn.onclick=()=>checkAnswer(keys[i]);optsEl.appendChild(btn);
  });
  const fb=document.getElementById('quiz-feedback');fb.style.display='none';fb.className='quiz-feedback';
  document.getElementById('btn-next-quiz').style.display='none';
}
function checkAnswer(userKey){
  const q=quizData[currentQ];
  const btns=document.querySelectorAll('.opt-btn');btns.forEach(b=>b.disabled=true);
  const keys=['A','B','C','D'];
  btns[keys.indexOf(userKey)].classList.add(userKey===q.a?'correct':'wrong');
  if(userKey!==q.a)btns[keys.indexOf(q.a)].classList.add('correct');
  const fb=document.getElementById('quiz-feedback');fb.style.display='block';
  if(userKey===q.a){fb.className='quiz-feedback correct';fb.innerHTML='<strong>🟢 回答正確！</strong><br>'+q.r;}
  else{fb.className='quiz-feedback wrong';fb.innerHTML='<strong>🔴 答錯了（正確答案是 '+q.a+'）</strong><br>'+q.r;}
  document.getElementById('btn-next-quiz').style.display='block';
}
document.getElementById('btn-next-quiz').onclick=function(){currentQ=(currentQ+1)%quizData.length;renderQuiz();};

window.addEventListener('DOMContentLoaded',()=>{resize();renderQuiz();requestAnimationFrame(loop);});
