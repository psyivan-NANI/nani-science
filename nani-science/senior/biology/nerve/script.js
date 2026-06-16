const canvas = document.getElementById('nerveCanvas');
const ctx = canvas.getContext('2d');

let timeStep = 0; // 0 到 600 代表時間演進 (0.00ms ~ 6.00ms)
let animationInterval = null;

// 建立更綿密、具備傳導空間感的神經軸突通道群 (精準定義其在軸突上的橫向相對位置比例)
const channels = [
    { x: 0.15, type: 'Na', id: 1 },
    { x: 0.25, type: 'K',  id: 2 },
    { x: 0.40, type: 'Na', id: 3 },
    { x: 0.50, type: 'K',  id: 4 },
    { x: 0.65, type: 'Na', id: 5 },
    { x: 0.75, type: 'K',  id: 6 }
];

function resizeCanvas() {
    const rect = canvas.parentElement.getBoundingClientRect();
    canvas.width = rect.width * window.devicePixelRatio;
    canvas.height = rect.height * window.devicePixelRatio;
    ctx.scale(window.devicePixelRatio, window.devicePixelRatio);
    drawScene();
}

// 【嚴格生理學定量方程】核心代數點對點映射
function getElectrophysiology(t) {
    let mv = -70;
    let stageStr = "靜止膜電位 (Polarization)";
    let naState = "關閉 (可活化狀態)";
    let kState = "關閉";
    let desc = "神經元未受刺激時。由於鈉鉀幫浦（消耗 ATP）持續進行主動運輸（泵出 3 Na⁺、泵入 2 K⁺），加上 K⁺ 漏失通道作用，使膜外帶正電、膜內帶負電，維持在穩定的靜止膜電位。";
    
    // 控制微觀離子通道活化波形的前進位置 (0.00 到 1.00)
    let waveFront = 0; 

    if (t > 0 && t <= 60) {
        let progress = t / 60;
        mv = -70 + progress * 15; 
        stageStr = "刺激產生 ── 趨向閾電位";
        desc = "受刺激後，局部配體或機械通道微幅開啟，使少量 Na⁺ 內流。膜電位朝向最關鍵的【閾電位（-55 mV）】緩步攀升。";
        waveFront = 0.1;
    } else if (t > 60 && t <= 140) {
        let progress = (t - 60) / 80;
        mv = -55 + progress * 85;
        stageStr = "去極化 (Depolarization)";
        naState = "⚡ 全面爆發性開啟 (電壓閘控)";
        kState = "關閉";
        desc = "膜電位達 -55 mV 閾值！電位敏感型 Na⁺ 通道發生構形改變而爆發性全面開啟。因細胞外 [Na⁺] 遠高於細胞內，Na⁺ 順著濃度與電位梯度**大量擴散衝入細胞質**，使膜內反轉為正電。";
        waveFront = 0.1 + progress * 0.4; // 波動隨時間向右傳導
    } else if (t > 140 && t <= 260) {
        let progress = (t - 140) / 120;
        mv = 30 - progress * 105;
        stageStr = "再極化 (Repolarization)";
        naState = "🚫 關閉並去活化 (進入不反應期)";
        kState = "⚡ 延遲開啟完畢";
        desc = "電位達 +30 mV 時，Na⁺ 通道的不活化閘門（Inactivation gate）瞬間關閉並鎖定。此時遲到的電位敏感型 K⁺ 通道全面打開，細胞內高濃度的 K⁺ 順著梯度**大量擴散衝出細胞外**，電位急速下墜。";
        waveFront = 0.5 + progress * 0.2;
    } else if (t > 260 && t <= 420) {
        let progress = (t - 260) / 160;
        if (progress <= 0.4) {
            mv = -75 - (progress / 0.4) * 5; // 探底到 -80mV
            kState = "⏳ 關閉速度遲緩中";
            desc = "由於電位敏感型 K⁺ 通道關閉響應較慢，導致 K⁺ 擴散外流過頭（Outflow overshoot），膜電位短暫跌落至比靜止電位更低的低谷（約 -80 mV），形成過極化。";
        } else {
            // 【學術校正點】過極化後半段，K+ 通道已完全關閉，由鈉鉀幫浦主導回升！
            let recoveryProg = (progress - 0.4) / 0.6;
            mv = -80 + recoveryProg * 6;
            kState = "🚫 已完全關閉";
            desc = "【生理機制校正】此時 K⁺ 通道已完全關閉。膜電位正依賴**鈉鉀幫浦消耗 ATP** 逆濃度梯度泵回離子，由 -80 mV 緩步拉回原先的平衡靜止電位。";
        }
        naState = "關閉 (去活化閘門逐漸解除)";
        waveFront = 0.7 + progress * 0.15;
    } else if (t > 420) {
        let progress = (t - 420) / 180;
        mv = -74 + progress * 4;
        stageStr = "恢復期 / 離子濃度重置平衡";
        naState = "關閉 (完全復原，可接受下一次刺激)";
        kState = "關閉";
        desc = "所有電壓閘控通道皆回到原點。鈉鉀幫浦（主動運輸）與 K⁺ 漏失通道協同運作，徹底將膜內外離子濃度梯度與靜止膜電位（-70 mV）恢復原狀。";
        waveFront = 0.85;
    }

    return { mv: Math.round(mv), stageStr, naState, kState, desc, waveFront };
}

// 核心 Canvas 空間與時間雙維度幾何繪圖
function drawScene() {
    const w = canvas.width / window.devicePixelRatio;
    const h = canvas.height / window.devicePixelRatio;

    ctx.clearRect(0, 0, w, h);

    // 背景底色
    ctx.fillStyle = '#060a13';
    ctx.fillRect(0, 0, w, h);

    const cInfo = getElectrophysiology(timeStep);

    // --- 【上半部：軸突細胞膜微觀傳導演繹】 ---
    const membraneY = h * 0.32;
    const thickness = 22;

    // 繪製雙層磷脂質細胞膜基底
    ctx.fillStyle = '#16223f';
    ctx.fillRect(10, membraneY - thickness/2, w - 20, thickness);
    ctx.strokeStyle = '#223867';
    ctx.lineWidth = 2;
    ctx.strokeRect(10, membraneY - thickness/2, w - 20, thickness);

    // 渲染通道（引入波前演進演算法，使其具備向右傳導的空間順序感）
    channels.forEach(ch => {
        const chX = w * ch.x;
        ctx.fillStyle = ch.type === 'Na' ? '#ff9900' : '#00bfff';
        
        let isOpen = false;
        // 依據當前時間對應的波前 (waveFront) 位置，動態決定特定空間上的通道是否開啟
        if (timeStep > 60 && timeStep <= 140 && ch.type === 'Na' && ch.x <= cInfo.waveFront) {
            isOpen = true;
        }
        if (timeStep > 140 && timeStep <= 320 && ch.type === 'K' && ch.x <= cInfo.waveFront && ch.x > cInfo.waveFront - 0.4) {
            isOpen = true;
        }

        ctx.fillRect(chX - 12, membraneY - thickness, 24, thickness * 2);
        
        // 通道內離子擴散流動向量線條
        ctx.strokeStyle = '#fff';
        ctx.lineWidth = 1.5;
        if (isOpen) {
            ctx.clearRect(chX - 4, membraneY - thickness - 2, 8, thickness * 2 + 4);
            ctx.strokeStyle = ch.type === 'Na' ? '#ffaa00' : '#33ccff';
            ctx.lineWidth = 2.5;
            let offset = (Date.now() % 300) / 300 * 18;
            ctx.beginPath();
            if (ch.type === 'Na') {
                // Na+ 順著濃度差被動擴散進入細胞內（由上至下）
                ctx.moveTo(chX, membraneY - 20 + offset);
                ctx.lineTo(chX, membraneY + 5 + offset);
                ctx.moveTo(chX - 4, membraneY + offset);
                ctx.lineTo(chX, membraneY + 5 + offset);
                ctx.lineTo(chX + 4, membraneY + offset);
            } else {
                // K+ 順著濃度差被動擴散外流（由下至上）
                ctx.moveTo(chX, membraneY + 20 - offset);
                ctx.lineTo(chX, membraneY - 5 - offset);
                ctx.moveTo(chX - 4, membraneY - offset);
                ctx.lineTo(chX, membraneY - 5 - offset);
                ctx.lineTo(chX + 4, membraneY - offset);
            }
            ctx.stroke();
        }
        
        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 9px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(ch.type, chX, membraneY + 3);
    });

    // 【幾何嚴謹修正】電荷屏障不再是一整塊瞬間反轉，而是隨著波前進程（waveFront）由左向右依次反轉
    ctx.font = 'bold 12px sans-serif';
    ctx.textAlign = 'center';
    let idx = 0;
    for (let x = 30; x < w - 20; x += 35) {
        let currentXRatio = x / w;
        let isOuterPositive = true;

        // 依據時間波前動態計算特定 X 軸座標點的電荷狀態
        if (timeStep > 60 && timeStep <= 140) {
            if (currentXRatio <= cInfo.waveFront && currentXRatio > 0.1) isOuterPositive = false;
        } else if (timeStep > 140 && timeStep <= 260) {
            // 再極化由左側開始復原電荷，使反轉區塊向右位移
            let recoveryBound = (timeStep - 140) / 120 * 0.4 + 0.1;
            if (currentXRatio <= cInfo.waveFront && currentXRatio > recoveryBound) isOuterPositive = false;
        } else if (timeStep > 260 && timeStep <= 360) {
            let recoveryBound = 0.5 + (timeStep - 260) / 100 * 0.3;
            if (currentXRatio <= cInfo.waveFront && currentXRatio > recoveryBound) isOuterPositive = false;
        }

        ctx.fillStyle = isOuterPositive ? '#ef4444' : '#3b82f6';
        ctx.fillText(isOuterPositive ? "+" : "−", x, membraneY - 18); 
        ctx.fillStyle = isOuterPositive ? '#3b82f6' : '#ef4444';
        ctx.fillText(isOuterPositive ? "−" : "+", x, membraneY + 30); 
        idx++;
    }

    // --- 【下半部：巨觀經典動作電位座標圖表】 ---
    const chartX = w * 0.15;
    const chartY = h * 0.74;
    const chartW = w * 0.75;
    const chartH = h * 0.22;

    ctx.strokeStyle = '#475569';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(chartX, chartY - chartH - 10);
    ctx.lineTo(chartX, chartY + 10);
    ctx.lineTo(chartX + chartW + 10, chartY);
    ctx.stroke();

    ctx.fillStyle = '#94a3b8';
    ctx.font = '9px sans-serif';
    ctx.textAlign = 'right';
    ctx.fillText("+30 mV", chartX - 6, chartY - chartH);
    ctx.fillText("-55 mV", chartX - 6, chartY - chartH * 0.35);
    ctx.fillText("-70 mV", chartX - 6, chartY - chartH * 0.15);
    ctx.fillText("-80 mV", chartX - 6, chartY + chartH * 0.05);

    ctx.strokeStyle = 'rgba(255,255,255,0.06)';
    ctx.setLineDash([3, 3]);
    [-55, -70, +30].forEach(v => {
        let hRatio = (v - (-70)) / 100;
        let yPos = chartY - (chartH * 0.15) - (chartH * hRatio);
        ctx.beginPath(); ctx.moveTo(chartX, yPos); ctx.lineTo(chartX + chartW, yPos); ctx.stroke();
    });
    ctx.setLineDash([]);

    // 繪製完整的電位變化軌跡線
    ctx.strokeStyle = '#6366f1';
    ctx.lineWidth = 3;
    ctx.beginPath();
    
    let currentX = chartX;
    let currentY = chartY;

    for (let t = 0; t <= 600; t++) {
        let info = getElectrophysiology(t);
        let ratioY = (info.mv - (-70)) / 100; 
        let pX = chartX + (t / 600) * chartW;
        let pY = chartY - (chartH * 0.15) - (chartH * ratioY);

        if (t === 0) ctx.moveTo(pX, pY);
        else ctx.lineTo(pX, pY);

        if (t === timeStep) {
            currentX = pX;
            currentY = pY;
        }
    }
    ctx.stroke();

    // 繪製與時序完美同步的十字發光動態點
    if (timeStep > 0) {
        ctx.fillStyle = '#00ffcc';
        ctx.shadowBlur = 10;
        ctx.shadowColor = '#00ffcc';
        ctx.beginPath();
        ctx.arc(currentX, currentY, 5, 0, Math.PI * 2);
        ctx.fill();
        ctx.shadowBlur = 0; 
    }
}

function updateLabelsAndUI() {
    const cInfo = getElectrophysiology(timeStep);
    
    document.getElementById('time-text').textContent = (timeStep / 100).toFixed(2) + " ms";
    document.getElementById('status-zone').textContent = cInfo.stageStr;
    document.getElementById('td-mv').textContent = cInfo.mv + " mV";
    document.getElementById('td-na-gate').textContent = cInfo.naState;
    document.getElementById('td-k-gate').textContent = cInfo.kState;
    document.getElementById('stage-desc').innerHTML = cInfo.desc;

    const zone = document.getElementById('status-zone');
    if (timeStep > 60 && timeStep <= 140) zone.style.borderLeftColor = "#ef4444"; 
    else if (timeStep > 140 && timeStep <= 260) zone.style.borderLeftColor = "#33ccff"; 
    else if (timeStep > 260 && timeStep <= 420) zone.style.borderLeftColor = "#bd33ff"; 
    else zone.style.borderLeftColor = "#ffaa00";
}

document.getElementById('btn-stimulate').onclick = function() {
    if (animationInterval) clearInterval(animationInterval);
    timeStep = 0;
    
    animationInterval = setInterval(() => {
        timeStep += 2;
        if (timeStep > 600) {
            timeStep = 600;
            clearInterval(animationInterval);
        }
        document.getElementById('slider-time').value = timeStep;
        updateLabelsAndUI();
        drawScene();
    }, 16);
};

document.getElementById('btn-reset').onclick = function() {
    if (animationInterval) clearInterval(animationInterval);
    timeStep = 0;
    document.getElementById('slider-time').value = 0;
    updateLabelsAndUI();
    drawScene();
};

document.getElementById('slider-time').oninput = function() {
    if (animationInterval) clearInterval(animationInterval);
    timeStep = parseInt(this.value);
    updateLabelsAndUI();
    drawScene();
};

// 隨堂實戰測驗模組 (延續原設計)
const quizData = [
  {q:'1. 當神經元的膜電位從 -55 mV 急遽衝向 +30 mV（去極化）時，細胞膜上的主要離子事件為何？',opts:['A. 鈉鉀幫浦消耗ATP大量將Na⁺泵出','B. 電位敏感型Na⁺通道開啟，Na⁺被動擴散衝入細胞內','C. 電位敏感型K⁺通道開啟，K⁺衝出細胞外','D. K⁺透過主動運輸大量進入細胞質'],a:'B',r:'去極化時電位敏感型Na⁺通道全面爆發性開啟，Na⁺順著濃度差與電位差（兩者皆驅動Na⁺內流）快速被動擴散進入細胞，使內部電位反轉為正電。這是被動擴散，不消耗ATP。'},
  {q:'2. 動作電位後期出現「過極化（-80 mV）」的主要原因為何？',opts:['A. 鈉鉀幫浦突然停止運作','B. 細胞膜破裂導致離子漏失','C. 電位敏感型K⁺通道關閉較遲緩，K⁺持續外流過頭','D. 陰離子Cl⁻被主動運輸泵出膜外'],a:'C',r:'在再極化末期，K⁺通道的關閉反應較慢，導致K⁺外流超過平衡點，使細胞內部短暫比靜止膜電位更負（-80 mV），形成過極化低谷。'},
  {q:'3. 「全或無定律」在神經衝動傳導中的意義為何？',opts:['A. 刺激強度越大，動作電位幅度越高','B. 只要刺激達到閾電位，就會引發完整的動作電位，幅度不因刺激強度而改變','C. 弱刺激只產生小型動作電位','D. 動作電位的持續時間隨刺激強度增加'],a:'B',r:'全或無定律：膜電位一旦達到閾電位（-55mV），Na⁺通道就會爆發性全面開啟，產生完整的動作電位（+30mV）。刺激強度只影響「是否觸發」，不影響動作電位的幅度。'},
  {q:'4. 神經元在動作電位後的「絕對不反應期」期間，為什麼無法再次被激發？',opts:['A. 鈉鉀幫浦全速運作，將所有Na⁺泵出','B. Na⁺通道的不活化閘門（inactivation gate）關閉鎖定，無法再開啟','C. 軸突膜完全喪失通透性','D. K⁺濃度過高導致通道阻塞'],a:'B',r:'在去極化達到頂峰時，Na⁺通道的「不活化閘門」自動關閉並鎖定，即使再給予強刺激也無法重新開啟Na⁺通道。這段期間稱為絕對不反應期，確保動作電位單向傳導。'},
  {q:'5. 髓鞘化的有髓鞘神經纖維與無髓鞘神經纖維相比，傳導速度較快的原因為何？',opts:['A. 有髓鞘纖維的軸突直徑較小，阻力較低','B. 動作電位在有髓鞘纖維上發生「跳躍式傳導」，只在蘭氏節處去極化','C. 有髓鞘纖維的Na⁺通道密度更高','D. 髓鞘本身可以主動傳遞電訊號'],a:'B',r:'有髓鞘神經纖維的動作電位只在「蘭氏節（Ranvier節）」處產生，電流在蘭氏節之間跳躍式傳導（saltatory conduction），大幅減少需要去極化的區域數量，因此傳導速度比無髓鞘快得多。'},
  {q:'6. 靜止膜電位（-70 mV）的維持主要依賴哪兩個機制？',opts:['A. Na⁺通道持續開啟 + Ca²⁺主動運輸','B. K⁺漏失通道（靜止通透性）+ 鈉鉀幫浦（主動運輸）','C. Cl⁻通道開啟 + H⁺主動運輸','D. 所有離子通道完全關閉'],a:'B',r:'靜止膜電位由兩者共同維持：①K⁺漏失通道使K⁺持續緩慢外流，造成膜內偏負；②鈉鉀幫浦每次消耗ATP泵出3個Na⁺、泵入2個K⁺，維持膜內外離子濃度梯度。'},
  {q:'7. 神經肌肉接合處（突觸）的訊息傳遞方向為何，且傳遞物質是什麼？',opts:['A. 肌肉→神經元，傳遞物質為乙醯膽鹼','B. 神經元→肌肉，傳遞物質為乙醯膽鹼（ACh）','C. 雙向傳遞，傳遞物質為腎上腺素','D. 神經元→肌肉，傳遞物質為多巴胺'],a:'B',r:'突觸的訊息傳遞具有單向性：神經元（突觸前）釋放神經傳遞物質，擴散通過突觸間隙，與突觸後（肌肉或下一個神經元）的受體結合。運動神經與骨骼肌之間的傳遞物質為乙醯膽鹼（ACh）。'},
  {q:'8. 某毒素可以阻斷突觸前膜的Ca²⁺內流。請問這會對神經訊息傳遞造成什麼影響？',opts:['A. 動作電位幅度增大','B. 突觸小泡無法與突觸前膜融合，神經傳遞物質無法釋放','C. 突觸後膜上的受體大量增生','D. 靜止膜電位從-70mV升高至0mV'],a:'B',r:'突觸小泡與突觸前膜融合（胞吐作用）需要Ca²⁺的觸發。若Ca²⁺內流被阻斷，突觸小泡無法正常釋放神經傳遞物質，導致訊號傳遞中斷，肌肉無法收縮（如肉毒桿菌毒素的作用機制）。'},
  {q:'9. 動作電位為什麼只能「單向傳導」，而不會逆向傳回剛激發過的區域？',opts:['A. 軸突上有物理性的單向閥門','B. 剛去極化過的區域正處於絕對不反應期，Na⁺通道鎖定無法再開啟','C. 動作電位傳導時會消耗大量ATP，使後方區域缺乏能量','D. 靜止膜電位在已激發區域永久喪失'],a:'B',r:'動作電位單向傳導的原因：動作電位剛剛通過的區域，Na⁺通道的不活化閘門正處於關閉鎖定的「絕對不反應期」，即使接受到前方傳來的去極化電流也無法再次激發，因此訊號只能向前傳導。'},
  {q:'10. 下列哪一種藥物作用機制符合「增強突觸後膜的抑制效果」？',opts:['A. 阻斷Na⁺通道，使去極化無法發生','B. 模擬抑制性神經傳遞物質GABA，促使Cl⁻內流使膜電位更負','C. 阻斷乙醯膽鹼的降解，使其持續刺激受體','D. 抑制鈉鉀幫浦，使靜止膜電位升高'],a:'B',r:'許多鎮靜安眠藥（如苯二氮平類）的機制是加強GABA（主要抑制性神經傳遞物質）的效果，促進Cl⁻通道開啟，使更多Cl⁻流入細胞，使膜電位更負（超極化），降低神經元被激發的可能性。'}
];

let currentQuizIndex = 0;

function loadQuiz() {
    const qItem = quizData[currentQuizIndex];
    document.getElementById('quiz-q').innerText = `【第 ${currentQuizIndex + 1} 題】${qItem.q}`;
    const optsWrapper = document.getElementById('quiz-opts');
    optsWrapper.innerHTML = "";
    
    const optKeys = ["A", "B", "C", "D"];
    qItem.opts.forEach((optText, idx) => {
        const btn = document.createElement('button');
        btn.className = "opt-btn";
        btn.innerText = optText;
        btn.onclick = () => checkAnswer(optKeys[idx]);
        optsWrapper.appendChild(btn);
    });
    document.getElementById('quiz-feedback').classList.add('hidden');
    document.getElementById('btn-next-quiz').classList.add('hidden');
}

function checkAnswer(userOpt) {
    const qItem = quizData[currentQuizIndex];
    const feedbackEl = document.getElementById('quiz-feedback');
    feedbackEl.classList.remove('hidden');
    const btns = document.querySelectorAll('.opt-btn');
    btns.forEach(b => b.disabled = true);

    if (userOpt === qItem.a) {
        feedbackEl.className = "quiz-feedback correct";
        feedbackEl.innerHTML = `<strong>🟢 回答正確！</strong><br>${qItem.r}`;
    } else {
        feedbackEl.className = "quiz-feedback wrong";
        feedbackEl.innerHTML = `<strong>🔴 回答錯誤（正確答案是 ${qItem.a}）</strong><br>${qItem.r}`;
    }
    if (currentQuizIndex < quizData.length - 1) {
        document.getElementById('btn-next-quiz').classList.remove('hidden');
    }
}

document.getElementById('btn-next-quiz').onclick = function() {
    currentQuizIndex++;
    loadQuiz();
};

window.addEventListener('resize', resizeCanvas);
window.addEventListener('DOMContentLoaded', () => {
    resizeCanvas();
    updateLabelsAndUI();
    loadQuiz();
    setInterval(() => { drawScene(); }, 50); // 提供穩定的微粒子流動動畫渲染
});