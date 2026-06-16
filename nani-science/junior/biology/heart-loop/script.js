const canvas = document.getElementById('heartCanvas');
const ctx = canvas.getContext('2d');

let isPlaying = true;
let heartRateBpm = 70; 
let pulsePhase = 0;    
let particles = [];    

function resizeCanvas() {
    const rect = canvas.parentElement.getBoundingClientRect();
    canvas.width = rect.width * window.devicePixelRatio;
    canvas.height = rect.height * window.devicePixelRatio;
    ctx.scale(window.devicePixelRatio, window.devicePixelRatio);
}

function createParticle(type, pathType) {
    return {
        type: type, 
        pathType: pathType,
        progress: Math.random(), 
        speed: 0.004 + Math.random() * 0.003,
        size: 2 + Math.random() * 2.5,
        seedY: Math.random() * 12 - 6
    };
}

function initParticles() {
    particles = [];
    for (let i = 0; i < 30; i++) particles.push(createParticle('deoxy', 'lung')); 
    for (let i = 0; i < 30; i++) particles.push(createParticle('oxy', 'body'));  
}

function updateAndDrawParticles(cx, cy, isSystole) {
    particles.forEach(p => {
        if (isPlaying) {
            // 心室收縮時血流顯著加速，舒張時減速，符合流體力學與心臟生理學
            let currentSpeed = isSystole ? p.speed * 1.8 : p.speed * 0.5;
            p.progress += currentSpeed;
            if (p.progress > 1) {
                p.progress = 0;
                p.seedY = Math.random() * 12 - 6;
            }
        }

        let pt = { x: 0, y: 0 };

        if (p.pathType === 'lung') {
            // 右心與肺循環軌道 (右心房 -> 右心室 -> 肺動脈 -> 兩側肺部 -> 肺靜脈 -> 左心房)
            if (p.progress < 0.2) {
                // 流入右心房與右心室
                let t = p.progress / 0.2;
                pt.x = cx - 40 + p.seedY;
                pt.y = cy - 60 + t * 90;
            } else if (p.progress < 0.5) {
                // 從右心室衝入肺動脈往左側延伸
                let t = (p.progress - 0.2) / 0.3;
                pt.x = (cx - 30) - t * 90;
                pt.y = (cy + 30) - t * 80 + p.seedY;
            } else if (p.progress < 0.8) {
                // 模擬在肺部微血管完成氣體交換，轉為充氧血返回左心房
                let t = (p.progress - 0.5) / 0.3;
                p.type = 'oxy'; // 氣體交換
                pt.x = (cx - 120) + t * 140;
                pt.y = (cy - 50) + t * 20 + p.seedY;
            } else {
                // 進入左心房
                let t = (p.progress - 0.8) / 0.2;
                pt.x = cx + 20 + t * 10 + p.seedY;
                pt.y = cy - 30 + t * 20;
            }
        } else {
            // 左心與體循環軌道 (左心房 -> 左心室 -> 主動脈 -> 全身各處 -> 大靜脈 -> 右心房)
            if (p.progress < 0.2) {
                // 左心房流入左心室
                let t = p.progress / 0.2;
                pt.x = cx + 30 + p.seedY;
                pt.y = cy - 20 + t * 70;
            } else if (p.progress < 0.5) {
                // 左心室強力噴射出主動脈向上彎曲
                let t = (p.progress - 0.2) / 0.3;
                pt.x = (cx + 20) + t * 80;
                pt.y = (cy + 50) - t * 120 + p.seedY;
            } else if (p.progress < 0.8) {
                // 體循環微血管網交換，轉為缺氧血
                let t = (p.progress - 0.5) / 0.3;
                p.type = 'deoxy'; // 釋放氧氣
                pt.x = (cx + 100) - t * 120;
                pt.y = (cy - 70) + t * 30 + p.seedY;
            } else {
                // 經由大靜脈回到右心房
                let t = (p.progress - 0.8) / 0.2;
                pt.x = cx - 40 + p.seedY;
                pt.y = (cy - 40) - (1 - t) * 30;
            }
        }

        ctx.fillStyle = p.type === 'oxy' ? '#ff3344' : '#3388ff';
        ctx.shadowBlur = 4;
        ctx.shadowColor = ctx.fillStyle;
        ctx.beginPath();
        ctx.arc(pt.x, pt.y, p.size, 0, Math.PI * 2);
        ctx.fill();
        ctx.shadowBlur = 0;
    });
}

function drawHeartStructure(cx, cy, scale) {
    // 繪製心臟外壁肌肉輪廓 (使用立體漸層增強幾何美感)
    let heartGrad = ctx.createRadialGradient(cx, cy, 10, cx, cy, 140);
    heartGrad.addColorStop(0, '#2d1a24');
    heartGrad.addColorStop(1, '#1a0d14');
    
    ctx.strokeStyle = '#5c2d42';
    ctx.lineWidth = 14 + scale * 4; // 心室收縮時心肌增厚，完全符合解剖學特徵！
    ctx.fillStyle = heartGrad;
    
    ctx.beginPath();
    ctx.moveTo(cx, cy - 60);
    ctx.bezierCurveTo(cx - 90, cy - 110, cx - 120, cy + 10, cx, cy + 110);
    ctx.bezierCurveTo(cx + 120, cy + 10, cx + 90, cy - 110, cx, cy - 60);
    ctx.fill();
    ctx.stroke();

    // 繪製內部中隔 (房室分隔)
    ctx.strokeStyle = '#4a2536';
    ctx.lineWidth = 12;
    ctx.beginPath();
    ctx.moveTo(cx - 5, cy - 50);
    ctx.lineTo(cx - 5, cy + 100);
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(cx - 80, cy + 5);
    ctx.lineTo(cx + 80, cy + 5);
    ctx.stroke();
}

function drawValves(cx, cy, isSystole) {
    ctx.lineWidth = 4;
    ctx.lineCap = 'round';

    // 1. 房室瓣 (位於心房與心室之間)
    ctx.strokeStyle = isSystole ? '#ff3344' : '#00ffcc'; 
    if (isSystole) {
        // 收縮期：房室瓣緊閉，防止血液逆流
        ctx.beginPath(); ctx.moveTo(cx - 65, cy + 5); ctx.lineTo(cx - 5, cy + 5); ctx.stroke(); // 右房室瓣
        ctx.beginPath(); ctx.moveTo(cx + 5, cy + 5); ctx.lineTo(cx + 65, cy + 5); ctx.stroke(); // 左房室瓣
    } else {
        // 舒張期：房室瓣開啟，血液湧入心室
        ctx.beginPath(); ctx.moveTo(cx - 65, cy + 5); ctx.lineTo(cx - 45, cy + 25); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(cx + 65, cy + 5); ctx.lineTo(cx + 45, cy + 25); ctx.stroke();
    }

    // 2. 半月瓣 (動脈瓣，位於心室與動脈出口)
    ctx.strokeStyle = isSystole ? '#00ffcc' : '#ff3344';
    if (isSystole) {
        // 收縮期：半月瓣被衝開，血液射入動脈
        ctx.beginPath(); ctx.moveTo(cx - 50, cy - 15); ctx.lineTo(cx - 60, cy - 35); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(cx + 50, cy - 15); ctx.lineTo(cx + 60, cy - 35); ctx.stroke();
    } else {
        // 舒張期：半月瓣關閉，防止動脈血倒流
        ctx.beginPath(); ctx.moveTo(cx - 65, cy - 25); ctx.lineTo(cx - 35, cy - 25); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(cx + 35, cy - 25); ctx.lineTo(cx + 65, cy - 25); ctx.stroke();
    }
}

function updateLabels(cx, cy) {
    const labels = {
        '.lbl-ra': { x: cx - 55, y: cy - 40 },
        '.lbl-rv': { x: cx - 55, y: cy + 45 },
        '.lbl-la': { x: cx + 25, y: cy - 40 },
        '.lbl-lv': { x: cx + 25, y: cy + 45 },
        '.lbl-ao': { x: cx + 75, y: cy - 85 },
        '.lbl-pa': { x: cx - 110, y: cy - 90 },
        '.lbl-vc': { x: cx - 110, y: cy - 20 },
        '.lbl-pv': { x: cx + 80, y: cy - 15 }
    };

    for (let sel in labels) {
        let el = document.querySelector(sel);
        if (el) {
            el.style.left = `${labels[sel].x}px`;
            el.style.top = `${labels[sel].y}px`;
            el.style.display = 'block';
        }
    }
}

function drawScene() {
    const w = canvas.width / window.devicePixelRatio;
    const h = canvas.height / window.devicePixelRatio;
    const cx = w / 2;
    const cy = h / 2 - 20;

    ctx.clearRect(0, 0, w, h);

    if (isPlaying) {
        // 依據 BPM 計算相位增量
        pulsePhase += (heartRateBpm / 60) * 0.05;
    }

    // 利用正弦函數精準模擬心臟舒張與收縮週期
    let pulseFactor = Math.sin(pulsePhase); 
    let scale = pulseFactor * 0.08; 
    let isSystole = pulseFactor < 0; // 正值為舒張期，負值為收縮期

    // 動態更新資訊面板數值
    document.getElementById('val-atria').innerText = isSystole ? "舒張 (血液流入)" : "收縮 (推入心室)";
    document.getElementById('val-ventricles').innerText = isSystole ? "收縮 (強力射血)" : "舒張 (容納房血)";
    document.getElementById('val-valves').innerText = isSystole ? "房室瓣【關閉】 / 半月瓣【開啟】" : "房室瓣【開啟】 / 半月瓣【關閉】";

    drawHeartStructure(cx, cy, scale);
    drawValves(cx, cy, isSystole);
    updateAndDrawParticles(cx, cy, isSystole);
    updateLabels(cx, cy);

    requestAnimationFrame(drawScene);
}

// 綁定 UI 控制件
const btnPlayPause = document.getElementById('btn-play-pause');
const sliderRate = document.getElementById('slider-rate');
const rateText = document.getElementById('rate-text');

btnPlayPause.onclick = function() {
    isPlaying = !isPlaying;
    this.innerText = isPlaying ? "暫停跳動" : "恢復跳動";
    if (isPlaying) this.classList.add('active');
    else this.classList.remove('active');
};

sliderRate.oninput = function() {
    heartRateBpm = parseInt(this.value);
    if (heartRateBpm < 60) rateText.innerText = `慢速/睡眠 (${heartRateBpm} bpm)`;
    else if (heartRateBpm <= 90) rateText.innerText = `安靜/正常 (${heartRateBpm} bpm)`;
    else rateText.innerText = `運動/緊張 (${heartRateBpm} bpm)`;
};

// --- 嚴格教育專家精心設計：10題滿分級隨堂題庫資料庫 ---
const quizData = [
    {
        q: "1. 醫生使用聽診器在病人的胸前聽到「咚、噠」的心音，其中體積較大、聲音較長的「第一心音（咚）」主要是由下列哪一個生理事件所產生的？",
        opts: [
            "A) 心房收縮，血液充填至心室的撞擊聲",
            "B) 心室收縮，導致房室瓣瞬間關閉的振動聲",
            "C) 心室舒張，導致半月瓣緊急關閉的阻擋聲",
            "D) 血液由大靜脈流回右心房的摩擦聲"
        ],
        a: "B",
        r: "第一心音出現在心室收縮早期。此時心室強力收縮使室內壓飆升，為了防止血液逆流回心房，『房室瓣（僧帽瓣與三尖瓣）』會瞬間關閉，引發結構振動，形成第一心音。而第二心音則是半月瓣關閉所致。"
    },
    {
        q: "2. 當我們在做健康檢查時，常聽到的「血壓高低」是指血液流經下列哪一種血管時，血管壁所承受的側壓力？",
        opts: [
            "A) 主動脈與大動脈",
            "B) 全身組織微血管",
            "C) 上下大靜脈",
            "D) 肺靜脈"
        ],
        a: "A",
        r: "一般醫學上量測的血壓（收縮壓與舒張壓），是指心室射血時對『動脈壁』產生的壓力。當血液流經微血管與靜脈時，壓力已大幅衰減，因此靜脈血壓極低，無法用傳統血壓計量測。"
    },
    {
        q: "3. 一顆紅血球由大腿肌肉的微血管出發，若要前往肺部進行氣體交換，在不流經其他多餘分支的路徑下，它『最少』必須流經心臟的房室幾次？",
        opts: [
            "A) 右心房1次、右心室1次",
            "B) 左心房1次、左心室1次",
            "C) 右心房、右心室、左心房、左心室各1次",
            "D) 直接經由下大靜脈進入肺動脈，不需經過心室"
        ],
        a: "A",
        r: "下肢缺氧血經由下大靜脈回流，首先進入『右心房』，隨後進入『右心室』，再由右心室壓入肺動脈前往肺部。因此在到達肺部之前，它只經過右側的心房與心室各1次。"
    },
    {
        q: "4. 有關人體充氧血與缺氧血的分布區域，下列哪一組血管或心臟腔室的配對中，內部流動的完全是『充氧血』？",
        opts: [
            "A) 右心房、肺動脈",
            "B) 左心室、大靜脈",
            "C) 左心房、肺靜脈",
            "&D) 右心室、主動脈"
        ],
        a: "C",
        r: "人體的心臟左半邊（左心房、左心室）以及離開肺部的『肺靜脈』、前往全身的『主動脈』，內部流動的都是富含氧氣的『充氧血（鮮紅色）』；右半邊與肺動脈、大靜脈則流缺氧血。"
    },
    {
        q: "5. 若某位病人的心臟「半月瓣」因疾病而出現嚴重閉鎖不全的現象，這會直接導致心臟在何種生理狀態時，血液發生倒流？",
        opts: [
            "A) 心房收縮時，血液倒流回大靜脈",
            "B) 心室收縮時，血液倒流回心房",
            "C) 心室舒張時，動脈血倒流回心室",
            "D) 心房舒張時，心室血倒流回心房"
        ],
        a: "C",
        r: "半月瓣（動脈瓣）位於心室與動脈的交界處。當心室舒張時，動脈內的壓力高於心室，此時半月瓣應當關閉以阻止血液倒流。若半月瓣閉鎖不全，動脈血就會在『心室舒張時』逆流回心室，加重心臟負擔。"
    },
    {
        q: "6. 有關血管結構與生理特徵的比較，下列哪一項敘述是完全符合生物學事實的？",
        opts: [
            "A) 靜脈的管壁最厚、彈性最好，能承受高壓",
            "B) 動脈內部具有許多瓣膜，用以防止血液倒流",
            "C) 微血管僅由單層上皮細胞構成，是物質交換的唯一場所",
            "D) 血液在三種血管中的流速快慢為：靜脈 > 動脈 > 微血管"
        ],
        a: "C",
        r: "微血管管壁僅由單層上皮細胞構成，管徑極小、血流速度最慢，最利於組織間的物質交換。動脈壁最厚彈性最好且無瓣膜；靜脈內具有瓣膜以防止逆流；流速大小為動脈 > 靜脈 > 微血管。"
    },
    {
        q: "7. 在人體的血液循環系統中，哪一條血管內部的血液其「二氧化碳濃度最低、氧氣濃度最高」？",
        opts: [
            "A) 主動脈",
            "B) 肺靜脈",
            "C) 肺動脈",
            "D) 上大靜脈"
        ],
        a: "B",
        r: "血液在流經肺部微血管時，會排除二氧化碳並吸飽氧氣。因此，剛離開肺部、準備流回左心房的『肺靜脈』，是全身上下氧氣濃度最高（二氧化碳最低）的血管。主動脈雖然也是充氧血，但其氧濃度與肺靜脈相同或略低。"
    },
    {
        q: "8. 某臨床藥物是由手臂的靜脈注射打入人體，若該藥物的目標是治癒患者的「肺部發炎」，則藥物分子隨血液循環首度抵達肺部的路徑順序為何？",
        opts: [
            "A) 手臂靜脈 → 上大靜脈 → 右心房 → 右心室 → 肺動脈 → 肺部",
            "B) 手臂靜脈 → 肺靜脈 → 左心房 → 左心室 → 主動脈 → 肺部",
            "C) 手臂靜脈 → 右心房 → 左心房 → 肺動脈 → 肺部",
            "D) 手臂靜脈 → 主動脈 → 右心室 → 右心房 → 肺部"
        ],
        a: "A",
        r: "靜脈注射的藥物會順著體循環靜脈回流至『上大靜脈』，進入『右心房』、再到『右心室』，隨後經由『肺動脈』直接進入肺部微血管網。此時尚未進入左心與體循環動脈。"
    },
    {
        q: "9. 正常狀況下，當心臟的「心房收縮」時，下列腔室與瓣膜的動態敘述何者正確？",
        opts: [
            "A) 房室瓣關閉，血液留在心房",
            "B) 房室瓣開啟，血液被推入心室",
            "C) 半月瓣開啟，血液射入動脈",
            "D) 心室同時處於收縮狀態"
        ],
        a: "B",
        r: "當心房收縮時，心房內壓力略高，此時『房室瓣會開啟』，將心房內的血液做最後的擠壓充填擠入『處於舒張狀態的心室』。此時半月瓣是關閉的。"
    },
    {
        q: "10. 門診中常有「心律不整」的個案，是因為心臟內部負責發出電訊號、主導心肌協調收縮的組織發生異常。這個人體天然的「節律點（PaceMaker）」位於心臟的哪一個位置？",
        opts: [
            "A) 左心室壁底部",
            "B) 右心房壁靠近大靜脈入口處",
            "C) 房室中隔的正中央",
            "D) 主動脈基部的半月瓣後方"
        ],
        a: "B",
        r: "心臟的天然節律點被稱為『竇房結（SA node）』，它位於『右心房壁』靠近上大靜脈的入口處。它能自主且規律地發出微弱電訊號，傳導至全心肌，引導心房與心室依序收縮舒張。"
    }
];

let currentQuizIndex = 0;

function initQuiz() {
    currentQuizIndex = 0;
    renderQuiz();
}

function renderQuiz() {
    const qItem = quizData[currentQuizIndex];
    document.getElementById('quiz-q').innerText = qItem.q;

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

    document.getElementById('btn-next-quiz').classList.remove('hidden');
}

document.getElementById('btn-next-quiz').onclick = function() {
    currentQuizIndex++;
    if (currentQuizIndex >= quizData.length) {
        currentQuizIndex = 0;
    }
    renderQuiz();
};

window.onresize = resizeCanvas;
window.onload = () => {
    resizeCanvas();
    initParticles();
    drawScene();
    initQuiz();
};