const canvas = document.getElementById('microCanvas');
const ctx = canvas.getContext('2d');

// 宏觀實驗開關狀態
let isSwitchedOn = false;
let isBridgePresent = true;

// 核心聯立邏輯：唯有導線接通且鹽橋存在，電路才真正導通
function isCircuitActive() {
    return isSwitchedOn && isBridgePresent;
}

// 粒子數據群
let zincIons = [];     // 負極溶液中的 Zn2+
let copperIons = [];   // 正極溶液中的 Cu2+
let electrons = [];    // 外導線移動中的電子
let bridgeAnions = []; // 鹽橋內的 NO3- (流向負極)
let bridgeCations = [];// 鹽橋內的 K+ (流向正極)

// 固定電極幾何與燒杯邊界 (由網頁自適應調整計算)
let geom = {};

function initGeometry() {
    const w = canvas.width / window.devicePixelRatio;
    const h = canvas.height / window.devicePixelRatio;
    
    geom = {
        w, h,
        beakerY: h * 0.42,
        beakerW: w * 0.32,
        beakerH: h * 0.45,
        leftBeakerX: w * 0.12,
        rightBeakerX: w * 0.56,
        plateW: 24,
        plateH: h * 0.38,
        wireY: h * 0.15
    };
}

function resizeCanvas() {
    const rect = canvas.parentElement.getBoundingClientRect();
    canvas.width = rect.width * window.devicePixelRatio;
    canvas.height = rect.height * window.devicePixelRatio;
    ctx.scale(window.devicePixelRatio, window.devicePixelRatio);
    initGeometry();
    resetParticles();
    drawScene();
}

// 初始化/重置微觀微粒數值與隨機分佈
function resetParticles() {
    zincIons = [];
    copperIons = [];
    electrons = [];
    bridgeAnions = [];
    bridgeCations = [];

    // 初始化左側負極溶液中的 Zn2+
    for(let i=0; i<15; i++) {
        zincIons.push({
            x: geom.leftBeakerX + 15 + Math.random() * (geom.beakerW - 30),
            y: geom.beakerY + 20 + Math.random() * (geom.beakerH - 45),
            vx: (Math.random() - 0.5) * 0.4,
            vy: (Math.random() - 0.5) * 0.4
        });
    }

    // 初始化右側正極溶液中的 Cu2+ (大考重點：此溶液初呈藍色)
    for(let i=0; i<15; i++) {
        copperIons.push({
            x: geom.rightBeakerX + 15 + Math.random() * (geom.beakerW - 30),
            y: geom.beakerY + 20 + Math.random() * (geom.beakerH - 45),
            vx: (Math.random() - 0.5) * 0.4,
            vy: (Math.random() - 0.5) * 0.4
        });
    }

    // 初始化鹽橋內部的 K+ 與 NO3- 離子對
    if (isBridgePresent) {
        const midX = geom.w / 2;
        for(let i=0; i<8; i++) {
            // 硝酸根陰離子 (偏左安置)
            bridgeAnions.push({
                x: midX - 40 + Math.random() * 35,
                y: geom.beakerY - 25 + Math.random() * 20
            });
            // 鉀陽離子 (偏右安置)
            bridgeCations.push({
                x: midX + 5 + Math.random() * 35,
                y: geom.beakerY - 25 + Math.random() * 20
            });
        }
    }
}

// 核心物理化學演繹步進
function updatePhysics() {
    const active = isCircuitActive();

    // 1. 溶液內基本離子布朗運動與定向漂移
    zincIons.forEach(p => {
        if (!active) {
            // 斷路時：純隨機擴散
            p.x += p.vx; p.y += p.vy;
        } else {
            // 通路時：Zn2+ 由鋅極板微幅向外排斥漂移
            let dx = p.x - (geom.leftBeakerX + geom.beakerW/2);
            p.x += p.vx + (dx > 0 ? 0.15 : -0.15);
            p.y += p.vy;
        }
        // 燒杯邊界碰撞檢查
        if (p.x < geom.leftBeakerX + 5 || p.x > geom.leftBeakerX + geom.beakerW - 5) p.vx *= -1;
        if (p.y < geom.beakerY + 10 || p.y > geom.beakerY + geom.beakerH - 5) p.vy *= -1;
    });

    copperIons.forEach((p, index) => {
        if (!active) {
            p.x += p.vx; p.y += p.vy;
        } else {
            // 通路時：Cu2+ 受到電場吸引，定向朝右側銅極板漂移 (銅極板位於燒杯中央)
            const targetX = geom.rightBeakerX + geom.beakerW / 2;
            if (p.x < targetX) p.x += 0.35;
            else p.x -= 0.35;
            p.y += p.vy;

            // 【原子守恆轉換點】當 Cu2+ 碰撞到銅極板，發生還原反應，轉化為結晶
            if (Math.abs(p.x - targetX) < 8 && p.y > geom.beakerY && p.y < geom.beakerY + geom.plateH) {
                copperIons.splice(index, 1); // 溶液中 Cu2+ 減少 (藍色變淡)
            }
        }
        if (p.x < geom.rightBeakerX + 5 || p.x > geom.rightBeakerX + geom.beakerW - 5) p.vx *= -1;
        if (p.y < geom.beakerY + 10 || p.y > geom.beakerY + geom.beakerH - 5) p.vy *= -1;
    });

    // 2. 鹽橋內部離子的「電中性維持補償流」
    if (active) {
        bridgeAnions.forEach(p => {
            // 陰離子 NO3- 朝向負極（左燒杯）移動
            p.x -= 0.25;
            if (p.y < geom.beakerY + 30) p.y += 0.05;
            // 降落到左邊燒杯後轉化為普通溶液陰離子
            if (p.x < geom.leftBeakerX + geom.beakerW * 0.7) {
                p.x = geom.leftBeakerX + 20 + Math.random() * (geom.beakerW - 40);
                p.y = geom.beakerY + 20 + Math.random() * (geom.beakerH - 40);
            }
        });

        bridgeCations.forEach(p => {
            // 陽離子 K+ 朝向正極（右燒杯）移動
            p.x += 0.25;
            if (p.y < geom.beakerY + 30) p.y += 0.05;
            // 降落到右邊燒杯
            if (p.x > geom.rightBeakerX + geom.beakerW * 0.3) {
                p.x = geom.rightBeakerX + 20 + Math.random() * (geom.beakerW - 40);
                p.y = geom.beakerY + 20 + Math.random() * (geom.beakerH - 40);
            }
        });

        // 3. 氧化反應動態產生：定時從鋅極板產生電子與 Zn2+
        if (Math.random() < 0.03 && zincIons.length < 35) {
            // 產生一個 Zn2+ 進入左側溶液
            zincIons.push({
                x: geom.leftBeakerX + geom.beakerW/2 + (Math.random() > 0.5 ? 13 : -13),
                y: geom.beakerY + Math.random() * (geom.plateH - 20),
                vx: (Math.random() - 0.5) * 0.4,
                vy: (Math.random() - 0.5) * 0.4
            });
            // 外導線同步注入兩個電子 (大考計量重點：Zn -> Zn2+ + 2e-)
            electrons.push({ pos: 0 });
            electrons.push({ pos: 0.05 });
        }
    }

    // 4. 外導線電子流向步進（從左至右：Zn -> 外導線 -> Cu）
    if (active) {
        electrons.forEach((e, idx) => {
            e.pos += 0.006;
            if (e.pos >= 1.0) electrons.splice(idx, 1); // 到達正極被 Cu2+ 消耗
        });
    } else {
        // 斷路時外導線電子瞬間失去漂移驅動力，維持原地
    }
}

// 繪圖渲染主引擎
function drawScene() {
    ctx.clearRect(0, 0, geom.w, geom.h);

    // 1. 繪製左右兩側實驗燒杯與水溶液
    ctx.lineWidth = 3;
    ctx.strokeStyle = '#4b5563';
    
    // 左燒杯 (ZnSO4 - 無色澄清，以微弱灰色襯底)
    ctx.fillStyle = 'rgba(255,255,255,0.02)';
    ctx.fillRect(geom.leftBeakerX, geom.beakerY, geom.beakerW, geom.beakerH);
    ctx.strokeRect(geom.leftBeakerX, geom.beakerY, geom.beakerW, geom.beakerH);
    
    // 右燒杯 (CuSO4 - 因含銅離子，大考明示呈現【藍色】，隨反應進行可微幅變淡)
    let blueAlpha = 0.12 + (copperIons.length / 15) * 0.15;
    ctx.fillStyle = `rgba(14, 165, 233, ${blueAlpha})`;
    ctx.fillRect(geom.rightBeakerX, geom.beakerY, geom.beakerW, geom.beakerH);
    ctx.strokeRect(geom.rightBeakerX, geom.beakerY, geom.beakerW, geom.beakerH);

    // 2. 繪製外導線電路與開關
    ctx.strokeStyle = '#374151';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    const plateLeftX = geom.leftBeakerX + geom.beakerW / 2;
    const plateRightX = geom.rightBeakerX + geom.beakerW / 2;
    ctx.moveTo(plateLeftX, geom.beakerY);
    ctx.lineTo(plateLeftX, geom.wireY);
    ctx.lineTo(plateRightX, geom.wireY);
    ctx.lineTo(plateRightX, geom.beakerY);
    ctx.stroke();

    // 繪製刀閘開關幾何
    ctx.strokeStyle = isSwitchedOn ? '#10b981' : '#ef4444';
    ctx.lineWidth = 4;
    ctx.beginPath();
    const switchX = geom.w * 0.38;
    ctx.moveTo(switchX, geom.wireY);
    if (isSwitchedOn) {
        ctx.lineTo(switchX + 25, geom.wireY);
    } else {
        // 斷路時向上翹起 35 度
        ctx.lineTo(switchX + 22, geom.wireY - 15);
    }
    ctx.stroke();

    // 3. 繪製鹽橋本體 U 型管
    if (isBridgePresent) {
        ctx.strokeStyle = 'rgba(167, 139, 250, 0.3)';
        ctx.lineWidth = 26;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.beginPath();
        const bridgeLeftX = geom.leftBeakerX + geom.beakerW * 0.78;
        const bridgeRightX = geom.rightBeakerX + geom.beakerW * 0.22;
        ctx.moveTo(bridgeLeftX, geom.beakerY + 40);
        ctx.lineTo(bridgeLeftX, geom.beakerY - 30);
        ctx.lineTo(bridgeRightX, geom.beakerY - 30);
        ctx.lineTo(bridgeRightX, geom.beakerY + 40);
        ctx.stroke();
        ctx.lineCap = 'butt'; // 還原
    }

    // 4. 繪製金屬電極極板
    // 左極：鋅片（銀灰色）
    ctx.fillStyle = '#94a3b8';
    ctx.fillRect(plateLeftX - geom.plateW/2, geom.beakerY - 15, geom.plateW, geom.plateH);
    ctx.strokeStyle = '#64748b';
    ctx.lineWidth = 1.5;
    ctx.strokeRect(plateLeftX - geom.plateW/2, geom.beakerY - 15, geom.plateW, geom.plateH);

    // 右極：銅片（經典紅棕色/橙色）
    ctx.fillStyle = '#ea580c';
    ctx.fillRect(plateRightX - geom.plateW/2, geom.beakerY - 15, geom.plateW, geom.plateH);
    ctx.strokeStyle = '#c2410c';
    ctx.strokeRect(plateRightX - geom.plateW/2, geom.beakerY - 15, geom.plateW, geom.plateH);

    // 5. 渲染外導線中的電子流粒子（黃色發光球）
    electrons.forEach(e => {
        let ex, ey;
        // 根據進度比例計算在 U 型折線導線上的座標
        const totalW = (plateRightX - plateLeftX);
        const h1 = (geom.beakerY - geom.wireY);
        const totalLen = h1 + totalW + h1;
        
        let curLen = e.pos * totalLen;
        if (curLen < h1) {
            ex = plateLeftX;
            ey = geom.beakerY - curLen;
        } else if (curLen < h1 + totalW) {
            ex = plateLeftX + (curLen - h1);
            ey = geom.wireY;
        } else {
            ex = plateRightX;
            ey = geom.wireY + (curLen - h1 - totalW);
        }

        ctx.fillStyle = varColor('--electron-yellow');
        ctx.shadowBlur = 6; ctx.shadowColor = '#eab308';
        ctx.beginPath(); ctx.arc(ex, ey, 4, 0, Math.PI*2); ctx.fill();
        ctx.shadowBlur = 0;
    });

    // 6. 渲染溶液內部微觀化學物種（離子）
    // 鋅離子 Zn2+ (藍青色圓球)
    zincIons.forEach(p => {
        ctx.fillStyle = '#0ea5e9';
        ctx.beginPath(); ctx.arc(p.x, p.y, 4.5, 0, Math.PI*2); ctx.fill();
        ctx.fillStyle = '#fff'; ctx.font = '7px sans-serif'; ctx.textAlign='center';
        ctx.fillText('Zn²', p.x, p.y + 2.5);
    });

    // 銅離子 Cu2+ (深橙藍色圓球)
    copperIons.forEach(p => {
        ctx.fillStyle = '#f97316';
        ctx.beginPath(); ctx.arc(p.x, p.y, 4.5, 0, Math.PI*2); ctx.fill();
        ctx.fillStyle = '#fff'; ctx.font = '7px sans-serif'; ctx.textAlign='center';
        ctx.fillText('Cu²', p.x, p.y + 2.5);
    });

    // 鹽橋陰陽離子
    if (isBridgePresent) {
        bridgeAnions.forEach(p => {
            ctx.fillStyle = '#ec4899'; // NO3- 亮粉
            ctx.beginPath(); ctx.arc(p.x, p.y, 3.5, 0, Math.PI*2); ctx.fill();
        });
        bridgeCations.forEach(p => {
            ctx.fillStyle = '#10b981'; // K+ 翠綠
            ctx.beginPath(); ctx.arc(p.x, p.y, 3.5, 0, Math.PI*2); ctx.fill();
        });
    }
}

// 輔助獲取 CSS 變數顏色
function varColor(name) {
    return getComputedStyle(document.documentElement).getPropertyValue(name).trim() || '#fff';
}

// 聯動同步 UI 面板狀態與宏觀檢流計偏轉
function updateUI() {
    const active = isCircuitActive();
    const pointer = document.getElementById('meter-pointer');
    const badge = document.getElementById('cell-status');
    const zone = document.getElementById('status-zone');

    if (!isSwitchedOn) {
        pointer.style.transform = 'translateX(-50%) rotate(0deg)'; // 零點中央
        badge.textContent = "導線斷路中 ── 電池未工作";
        zone.textContent = "斷路狀態 (Open Circuit)";
        zone.style.borderLeftColor = "#64748b";
        document.getElementById('td-anode-rxn').innerHTML = "Zn → Zn²⁺ + 2e⁻ <span style='color:#64748b;'>(已停止)</span>";
        document.getElementById('td-cathode-rxn').innerHTML = "Cu²⁺ + 2e⁻ → Cu <span style='color:#64748b;'>(已停止)</span>";
        document.getElementById('td-bridge-flow').textContent = "無定向移動";
        document.getElementById('stage-desc').textContent = "外導線切斷（開關未按）。電子缺乏外部通道，導致化學能無法轉換成電能，全機微觀粒子處於熱運動平衡。";
    } else if (isSwitchedOn && !isBridgePresent) {
        pointer.style.transform = 'translateX(-50%) rotate(0deg)';
        badge.textContent = "鹽橋已拔除 ── 內部斷路";
        zone.textContent = "鹽橋斷路 (Missing Salt Bridge)";
        zone.style.borderLeftColor = "#ef4444";
        document.getElementById('td-anode-rxn').innerHTML = "Zn → Zn²⁺ + 2e⁻ <span style='color:#ef4444;'>(斷路鎖死)</span>";
        document.getElementById('td-cathode-rxn').innerHTML = "Cu²⁺ + 2e⁻ → Cu <span style='color:#ef4444;'>(斷路鎖死)</span>";
        document.getElementById('td-bridge-flow').textContent = "鹽橋已抽離";
        document.getElementById('stage-desc').textContent = "【大考關鍵】雖然外導線閉合，但鹽橋被拔除，兩側溶液無法維持電中性，瞬時產生的靜電阻力讓電子流與離子流在一瞬間完全凍結！";
    } else {
        // 【最高學術修正：對齊真實電流方向】
        // 電子由左向右，故傳統電流方向是由右向左（Cu 流向 Zn）。檢流計指針朝電流流入端（左側）偏轉。
        pointer.style.transform = 'translateX(-50%) rotate(-28deg)'; // 向左偏轉！
        badge.textContent = "🔋 電池全力發電中...";
        zone.textContent = "閉合通路 (Closed Circuit)";
        zone.style.borderLeftColor = "#10b981";
        document.getElementById('td-anode-rxn').innerHTML = "Zn → Zn²⁺ + 2e⁻ 氧化反應 <span style='color:#10b981;'>● 放電中</span>";
        document.getElementById('td-cathode-rxn').innerHTML = "Cu²⁺ + 2e⁻ → Cu 還原反應 <span style='color:#10b981;'>● 放電中</span>";
        document.getElementById('td-bridge-flow').innerHTML = "陰離子 NO₃⁻ → 負極；陽離子 K⁺ → 正極";
        document.getElementById('stage-desc').innerHTML = "電路完全導通！活性大的鋅原子源源不絕釋放電子，經外導線作功流向銅片。鹽橋中的 <strong>NO₃⁻ 陰離子流向左側</strong>補償新產生的 Zn²⁺；<strong>K⁺ 陽離子流向右側</strong>補償因還原而減少的 Cu²⁺，發電持續進行。";
    }
}

// 事件綁定
document.getElementById('btn-toggle-switch').onclick = function() {
    isSwitchedOn = !isSwitchedOn;
    this.textContent = isSwitchedOn ? "導線：通路" : "導線：斷路";
    if (isSwitchedOn) this.classList.add('active'); else this.classList.remove('active');
    updateUI();
    drawScene();
};

document.getElementById('btn-toggle-bridge').onclick = function() {
    isBridgePresent = !isBridgePresent;
    this.textContent = isBridgePresent ? "鹽橋：已插入" : "鹽橋：已拔除";
    if (isBridgePresent) this.classList.add('active'); else this.classList.remove('active');
    resetParticles();
    updateUI();
    drawScene();
};

document.getElementById('btn-reset').onclick = function() {
    isSwitchedOn = false;
    isBridgePresent = true;
    const b1 = document.getElementById('btn-toggle-switch');
    b1.textContent = "導線：斷路"; b1.classList.remove('active');
    const b2 = document.getElementById('btn-toggle-bridge');
    b2.textContent = "鹽橋：已插入"; b2.classList.add('active');
    resetParticles();
    updateUI();
    drawScene();
};

// ----------------------------------------------------
// 隨堂實戰測驗模組（完全契合高中分科與學測考點）
// ----------------------------------------------------
const quizData = [
    {
        q: "關於鋅銅電池放電時的微觀變化與量測，下列哪一項敘述符合正確的化學與物理規律？",
        opts: [
            "A. 電子由鋅極經外導線流向銅極，故檢流計指針會向右（銅極）偏轉",
            "B. 負極的鋅原子失去電子變成鋅離子進入溶液，使負極板質量減輕",
            "C. 正極水溶液中的大分子硫酸根離子（SO₄²⁻）會穿越鹽橋流向負極",
            "D. 放電一段時間後，右側正極杯中的藍色會因為銅離子濃度增加而變深"
        ],
        a: "B",
        r: "負極活性大的 Zn 發生氧化反應失去電子（Zn → Zn²⁺ + 2e⁻），因此鋅原子溶解導致極板質量減輕。注意：檢流計指針偏轉方向為電流方向（由 Cu 至 Zn），故指針向左偏轉；鹽橋中移動的是其內部的移動離子（K⁺, NO₃⁻），而非外面的 SO₄²⁻。"
    },
    {
        q: "若在鋅銅電池持續放電的過程中，突然將鹽橋由燒杯中拔除，則有關此時電池內外粒子運動的說法，何者正確？",
        opts: [
            "A. 外導線的電子流依然可以靠著殘餘的電位差持續流動數分鐘",
            "B. 兩側溶液因為失去鹽橋，Zn²⁺ 與 Cu²⁺ 會開始直接透過空氣跨杯擴散",
            "C. 反應立即停止，外導線電子流與溶液內離子的定向移動皆瞬間完全靜止",
            "D. 拔除鹽橋相當於外導線斷路，但溶液內部的離子氧化還原反應仍會加速進行"
        ],
        a: "C",
        r: "拔除鹽橋會破壞內電路的「電中性維持機制」，溶液內部的離子無法再進行電荷補償，導致內電路與外電路同時形成【斷路】，因此整台電池的化學反應與所有粒子的定向移動都會在一瞬間完全停止。"
    }
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

// 起動與動畫主循環
window.addEventListener('resize', resizeCanvas);
window.addEventListener('DOMContentLoaded', () => {
    resizeCanvas();
    updateUI();
    loadQuiz();
    
    // 建立 30fps 的高頻動態物理更新循環，確保斷路、通路的瞬時鎖死物理能平滑表現
    setInterval(() => {
        updatePhysics();
        drawScene();
    }, 33);
});