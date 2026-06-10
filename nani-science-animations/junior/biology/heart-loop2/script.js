// --- 專業醫學動畫級：心臟解剖底圖自適應流體控制引擎 ---
const canvas = document.getElementById('heartFlowCanvas');
const ctx = canvas.getContext('2d');

// 載入使用者提供的精美心臟底圖
const heartBgImg = new Image();
heartBgImg.src = 'heart-bg.png'; // 如果是 JPG 格式請改為 'heart-bg.jpg'
let isImgLoaded = false;
heartBgImg.onload = () => {
    isImgLoaded = true;
};

let state = {
    isPaused: false,
    mode: 'all',          // all | systemic | pulmonary
    speed: 1.1,
    heartRateBpm: 75,     // 核心心率
    globalTime: 0
};

let particles = [];

function resizeCanvas() {
    const rect = canvas.parentElement.getBoundingClientRect();
    canvas.width = rect.width * window.devicePixelRatio;
    canvas.height = rect.height * window.devicePixelRatio;
    ctx.scale(window.devicePixelRatio, window.devicePixelRatio);
    initParticles();
}

// 根據真實解剖圖結構校準的自適應貝茲路徑 (相依於 Canvas 中央與比例)
function getAdaptivePaths(w, h) {
    const cx = w / 2;
    const cy = h / 2 - 20; // 微調置中點，配合圖片重心

    return {
        // 體循環：左心房 -> 左心室 -> 向上衝入主動脈弓 -> 流向外圍全身組織 -> 經上下大靜脈回流 -> 右心房
        systemic: [
            { x: cx + 45, y: cy + 10, type: 'move' }, // 左心房
            { x: cx + 45, y: cy + 70, type: 'line' }, // 流入左心室
            { x: cx + 30, y: cy - 90, cx1: cx + 70, cy1: cy + 30, cx2: cx + 60, cy2: cy - 50, type: 'bezier' }, // 強力衝入主動脈弓
            { x: cx + 180, y: cy + 80, cx1: cx, cy1: cy - 140, cx2: cx + 140, cy2: cy - 60, type: 'bezier' }, // 跨越主動脈向外流向全身
            { x: cx + 130, y: cy + 180, cx1: cx + 220, cy1: cy + 150, cx2: cx + 180, cy2: cy + 190, type: 'bezier' }, // 身體下半部微血管交換
            { x: cx - 65, y: cy + 40, cx1: cx + 20, cy1: cy + 170, cx2: cx - 40, cy2: cy + 110, type: 'bezier' }, // 經大靜脈引流回流
            { x: cx - 55, y: cy - 10, type: 'line' } // 進入右心房
        ],
        // 肺循環：右心房 -> 右心室 -> 向上衝入肺動脈分支 -> 流向外圍肺部氣體交換 -> 經左右肺靜脈 -> 回到左心房
        pulmonary: [
            { x: cx - 55, y: cy - 10, type: 'move' }, // 右心房
            { x: cx - 50, y: cy + 60, type: 'line' }, // 流入右心室
            { x: cx - 15, y: cy - 75, cx1: cx - 75, cy1: cy + 20, cx2: cx - 40, cy2: cy - 40, type: 'bezier' }, // 衝入右上方的肺動脈幹
            { x: cx - 190, y: cy - 40, cx1: cx - 10, cy1: cy - 110, cx2: cx - 140, cy2: cy - 90, type: 'bezier' }, // 分流至肺部微血管網
            { x: cx - 120, y: cy + 30, cx1: cx - 210, cy1: cy + 10, cx2: cx - 160, cy2: cy + 40, type: 'bezier' }, // 氣體交換完畢（轉充氧血）
            { x: cx + 45, y: cy + 10, cx1: cx - 40, cy1: cy + 10, cx2: cx, cy2: cy, type: 'bezier' } // 經由肺靜脈回到左心房
        ]
    };
}

function initParticles() {
    particles = [];
    // 基礎固有速度（會再乘上心率增幅）
    for (let i = 0; i < 40; i++) {
        particles.push({
            loopType: 'systemic',
            progress: Math.random(),
            baseSpeed: 0.002 + Math.random() * 0.002, // 基礎流速
            size: 3 + Math.random() * 2.5,
            offsetY: Math.random() * 10 - 5
        });
    }
    for (let i = 0; i < 40; i++) {
        particles.push({
            loopType: 'pulmonary',
            progress: Math.random(),
            baseSpeed: 0.0025 + Math.random() * 0.002, // 基礎流速
            size: 3 + Math.random() * 2.5,
            offsetY: Math.random() * 10 - 5
        });
    }
}

function getBezierPoint(p0, p1, p2, p3, t) {
    const cx = 3 * (p1.x - p0.x);
    const cy = 3 * (p1.y - p0.y);
    const bx = 3 * (p2.x - p1.x) - cx;
    const by = 3 * (p2.y - p1.y) - cy;
    const ax = p3.x - p0.x - cx - bx;
    const ay = p3.y - p0.y - cy - by;
    return {
        x: ax * Math.pow(t, 3) + bx * Math.pow(t, 2) + cx * t + p0.x,
        y: ay * Math.pow(t, 3) + by * Math.pow(t, 2) + cy * t + p0.y
    };
}

function getLinePoint(p0, p1, t) {
    return { x: p0.x + (p1.x - p0.x) * t, y: p0.y + (p1.y - p0.y) * t };
}

function renderLoop() {
    const w = canvas.width / window.devicePixelRatio;
    const h = canvas.height / window.devicePixelRatio;
    ctx.clearRect(0, 0, w, h);

    const cx = w / 2;
    const cy = h / 2 - 20;

    // 1. 繪製底圖
    if (isImgLoaded) {
        const imgW = 460;
        const imgH = 460;
        ctx.drawImage(heartBgImg, cx - imgW / 2, cy - imgH / 2, imgW, imgH);
    } else {
        ctx.fillStyle = '#4b5563';
        ctx.font = '14px sans-serif';
        ctx.fillText('正在加載醫學心臟解剖底圖...', cx - 90, cy);
    }

    const paths = getAdaptivePaths(w, h);

    if (!state.isPaused) {
        // 心跳脈動的時間流
        state.globalTime += (state.heartRateBpm / 60) * 0.03;
    }

    // 計算心率流速放大倍率 (以安靜狀態 75 bpm 為基準 1.0 倍)
    // 這樣當 40 bpm 時流速變 0.53 倍（明顯變慢），120 bpm 時變 1.6 倍（明顯變快！）
    const bpmFactor = state.heartRateBpm / 75;

    // 2. 渲染流體粒子
    particles.forEach(p => {
        if (state.mode !== 'all' && p.loopType !== state.mode) return;

        if (!state.isPaused) {
            // 心動週期脈動（收縮期衝刺，舒張期減速）
            let pulseFactor = Math.sin(state.globalTime * 5);
            let pulseModifier = pulseFactor > 0 ? 1.7 : 0.4;
            
            // 【關鍵修正】：流速精準乘上 bpmFactor，讓滑桿數值與顆粒速度絕對聯動！
            p.progress += p.baseSpeed * pulseModifier * bpmFactor;
            
            if (p.progress > 1) p.progress = 0;
        }

        const route = paths[p.loopType];
        const totalNodes = route.length - 1;
        const segment = Math.floor(p.progress * totalNodes);
        const segT = (p.progress * totalNodes) - segment;

        let pt = { x: 0, y: 0 };
        const n0 = route[segment];
        const n1 = route[segment + 1];

        if (n1 && n1.type === 'bezier') {
            pt = getBezierPoint(n0, n1, { x: n1.cx1, y: n1.cy1 }, { x: n1.cx2, y: n1.cy2 }, segT);
        } else if (n1) {
            pt = getLinePoint(n0, n1, segT);
        }

        // 判定充氧血 / 缺氧血 視覺變色
        let isOxy = true;
        if (p.loopType === 'systemic') {
            if (p.progress > 0.42) isOxy = false; 
        } else {
            if (p.progress < 0.65) isOxy = false; 
        }

        ctx.fillStyle = isOxy ? 'rgba(239, 68, 68, 0.95)' : 'rgba(59, 130, 246, 0.95)';
        ctx.shadowBlur = 8;
        ctx.shadowColor = ctx.fillStyle;
        ctx.beginPath();
        ctx.arc(pt.x, pt.y + p.offsetY, p.size, 0, Math.PI * 2);
        ctx.fill();
        ctx.shadowBlur = 0;
    });

    // 3. 醫學標籤同步
    const labels = {
        '.tag-la': { x: cx + 110, y: cy + 30 },
        '.tag-lv': { x: cx + 100, y: cy + 120 },
        '.tag-ra': { x: cx - 110, y: cy + 10 },
        '.tag-rv': { x: cx - 90, y: cy + 110 },
        '.tag-ao': { x: cx + 20, y: cy - 140 },
        '.tag-pa': { x: cx - 80, y: cy - 100 },
        '.tag-vc': { x: cx - 160, y: cy - 40 },
        '.tag-pv': { x: cx + 160, y: cy - 10 }
    };

    for (let selector in labels) {
        let el = document.querySelector(selector);
        if (el) {
            el.style.left = `${labels[selector].x}px`;
            el.style.top = `${labels[selector].y}px`;
        }
    }

    // 更新底部步進器狀態
    let currentStep = Math.floor((state.globalTime * 3) % 5) + 1;
    document.querySelectorAll('.step-node').forEach(node => {
        node.classList.toggle('active', parseInt(node.dataset.step) === currentStep);
    });

    requestAnimationFrame(renderLoop);
}

// UI 互動綁定
document.getElementById('btn-pause').onclick = function () {
    state.isPaused = !state.isPaused;
    this.textContent = state.isPaused ? "恢復動畫" : "暫停動畫";
    this.classList.toggle('active', state.isPaused);
};

const modes = { 'mode-all': 'all', 'mode-sys': 'systemic', 'mode-pul': 'pulmonary' };
for (let id in modes) {
    document.getElementById(id).onclick = function () {
        document.querySelectorAll('.mode-btn').forEach(b => b.classList.remove('active'));
        this.classList.add('active');
        state.mode = modes[id];
    };
}

const sliderBpm = document.getElementById('slider-bpm');
const lblBpm = document.getElementById('lbl-bpm');
const lblPulseType = document.getElementById('lbl-pulse-type');
const txtDesc = document.getElementById('txt-desc');

sliderBpm.oninput = function () {
    const bpm = parseInt(this.value);
    state.heartRateBpm = bpm; // 更新全域 BPM，渲染迴圈會直接抓取此數值計算流速
    lblBpm.textContent = `${bpm} bpm`;

    if (bpm < 60) {
        lblPulseType.textContent = '深度睡眠/心動過緩';
        lblPulseType.style.color = '#2563eb';
        txtDesc.innerHTML = `<strong>【生理現象：過緩/睡眠狀態】</strong> 當前心跳為 ${bpm} bpm。此時副交感神經占優勢，心肌收縮次數減少，血流速度顯著變緩，全身新陳代謝率降至最低。`;
    } else if (bpm <= 95) {
        lblPulseType.textContent = '正常安靜';
        lblPulseType.style.color = '#16a34a';
        txtDesc.innerHTML = `正常安靜狀態：人體心臟由強韌的心肌構成。當心室收縮時，房室瓣會立即關閉以防血液倒流（產生第一心音），此時充氧血從左心室強力泵入主動脈，開啟體循環。`;
    } else {
        lblPulseType.textContent = '劇烈運動/過速';
        lblPulseType.style.color = '#dc2626';
        txtDesc.innerHTML = `<span style=\"color:#dc2626; font-weight:bold;\">【生理現象：運動/興奮狀態】</span> 當前心跳高達 ${bpm} bpm！交感神經高度興奮，釋放去甲腎上腺素，急遽加速心臟跳動率，血管內血流速度大幅加快，以供應肌肉所需的氧氣。`;
    }
};

// --- 精選 10 題高鑑別度題庫系統 ---
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

let currentQuizIndex = 0;

function initQuiz() {
    currentQuizIndex = 0;
    renderQuiz();
}

function renderQuiz() {
    const qItem = quizData[currentQuizIndex];
    document.getElementById('quiz-question').textContent = qItem.q;

    const optBox = document.getElementById('quiz-options');
    optBox.innerHTML = '';

    const optKeys = ["A", "B", "C", "D"];
    qItem.opts.forEach((optText, idx) => {
        const btn = document.createElement('button');
        btn.className = 'quiz-opt';
        btn.textContent = optText;
        btn.onclick = () => checkAnswer(optKeys[idx]);
        optBox.appendChild(btn);
    });

    document.getElementById('quiz-reply').style.display = 'none';
    document.getElementById('btn-next-quiz').style.display = 'none';
}

function checkAnswer(userOpt) {
    const qItem = quizData[currentQuizIndex];
    const replyBox = document.getElementById('quiz-reply');
    replyBox.style.display = 'block';

    const btns = document.querySelectorAll('.quiz-opt');
    btns.forEach(b => b.disabled = true);

    if (userOpt === qItem.a) {
        replyBox.className = "quiz-feedback correct";
        replyBox.innerHTML = `<strong>🟢 回報正確！</strong><br>${qItem.r}`;
    } else {
        replyBox.className = "quiz-feedback wrong";
        replyBox.innerHTML = `<strong>🔴 回答錯誤（正確答案是 ${qItem.a}）</strong><br>${qItem.r}`;
    }

    document.getElementById('btn-next-quiz').style.display = 'block';
}

document.getElementById('btn-next-quiz').onclick = function () {
    currentQuizIndex++;
    if (currentQuizIndex >= quizData.length) currentQuizIndex = 0;
    renderQuiz();
};

window.onresize = resizeCanvas;
window.onload = () => {
    resizeCanvas();
    renderLoop();
    initQuiz();
};