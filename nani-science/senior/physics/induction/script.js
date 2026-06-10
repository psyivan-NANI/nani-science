const canvas = document.getElementById('inductionCanvas');
const ctx = canvas.getContext('2d');

// 物理動力學狀態變數
let magnet = {
    x: 80, // 磁鐵中心 X 座標
    y: 160, // 磁鐵中心 Y 座標
    w: 140, // 磁鐵長度
    h: 45,  // 磁鐵高度
    isDragging: false,
    lastX: 80,
    speedX: 0 // 即時移動速度 Δx/Δt
};

// 線圈幾何固定參數
const coil = {
    x: 480, // 線圈在畫布橫向的位置
    y: 160,
    radiusY: 65,
    radiusX: 22,
    turns: 4
};

// 檢流計指針旋轉角度與動畫緩動
let pointerAngle = 0;
let targetAngle = 0;
let currentOffsetTime = 0; // 用於流體粒子動畫計時

// 滑鼠/觸控拖曳座標偏移紀錄
let dragOffsetX = 0;

function resizeCanvas() {
    const rect = canvas.parentElement.getBoundingClientRect();
    canvas.width = rect.width * window.devicePixelRatio;
    canvas.height = rect.height * window.devicePixelRatio;
    ctx.scale(window.devicePixelRatio, window.devicePixelRatio);
}

// 監聽滑鼠與觸控事件
function getEventX(e) {
    const rect = canvas.getBoundingClientRect();
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    return (clientX - rect.left) * (canvas.width / window.devicePixelRatio / rect.width);
}

canvas.addEventListener('mousedown', (e) => {
    const mouseX = getEventX(e);
    const mouseY = (e.clientY - canvas.getBoundingClientRect().top) * (canvas.height / window.devicePixelRatio / canvas.getBoundingClientRect().height);

    if (mouseX >= magnet.x - magnet.w / 2 && mouseX <= magnet.x + magnet.w / 2 &&
        mouseY >= magnet.y - magnet.h / 2 && mouseY <= magnet.y + magnet.h / 2) {
        magnet.isDragging = true;
        dragOffsetX = mouseX - magnet.x;
    }
});

window.addEventListener('mousemove', (e) => {
    if (!magnet.isDragging) return;
    const mouseX = getEventX(e);

    let newX = mouseX - dragOffsetX;
    if (newX < 70) newX = 70;
    if (newX > 530) newX = 530;

    magnet.speedX = newX - magnet.x;
    magnet.x = newX;
});

window.addEventListener('mouseup', () => {
    magnet.isDragging = false;
});

canvas.addEventListener('touchstart', (e) => {
    const mouseX = getEventX(e);
    if (mouseX >= magnet.x - magnet.w / 2 && mouseX <= magnet.x + magnet.w / 2) {
        magnet.isDragging = true;
        dragOffsetX = mouseX - magnet.x;
    }
});
window.addEventListener('touchmove', (e) => {
    if (!magnet.isDragging) return;
    const mouseX = getEventX(e);
    let newX = mouseX - dragOffsetX;
    if (newX < 70) newX = 70;
    if (newX > 530) newX = 530;
    magnet.speedX = newX - magnet.x;
    magnet.x = newX;
});
window.addEventListener('touchend', () => { magnet.isDragging = false; });

document.getElementById('btn-reset-magnet').addEventListener('click', () => {
    magnet.x = 80;
    magnet.speedX = 0;
    targetAngle = 0;
});

// 核心發電機物理動畫繪圖引擎
function drawScene() {
    const w = canvas.width / window.devicePixelRatio;
    const h = canvas.height / window.devicePixelRatio;

    ctx.clearRect(0, 0, w, h);

    // 模擬滑鼠放開後的物理慣性減速
    if (!magnet.isDragging) {
        magnet.speedX *= 0.85;
        if (Math.abs(magnet.speedX) < 0.01) magnet.speedX = 0;
    }

    // 視覺強化：粒子動態速度
    if (Math.abs(magnet.speedX) > 0.02) {
        currentOffsetTime += 0.16 + Math.abs(magnet.speedX) * 0.15;
    } else {
        currentOffsetTime += 0.005; 
    }

    // --- 1. 計算電磁感應物理回饋 (法拉第定律 + 冷次定律) ---
    const distanceToCoil = coil.x - (magnet.x + magnet.w / 2);

    let emf = 0;
    if (Math.abs(magnet.speedX) > 0.005) {
        const distanceFactor = Math.max(40, distanceToCoil);
        // 優化電壓輸出係數
        emf = magnet.speedX * (35000 / (distanceFactor * distanceFactor));
    }

    if (emf > 45) emf = 45;
    if (emf < -45) emf = -45;

    // 【物理校正】：修正檢流計指針偏轉方向與感應電流流入方向的一致性
    targetAngle = emf * 1.2; 
    pointerAngle += (targetAngle - pointerAngle) * 0.2;
    document.getElementById('g-pointer').style.transform = `rotate(${pointerAngle}deg)`;

    const lblFlux = document.getElementById('lbl-flux-status');
    const lblLenz = document.getElementById('lbl-lenz-dir');
    const titleEl = document.getElementById('induction-title');
    const descEl = document.getElementById('induction-desc');

    let showInducedField = false;
    let inducedFieldDirection = 0;
    let currentFlowDirection = 1; // 1 代表在立體前半弧向下流，-1 代表向上流

    if (Math.abs(magnet.speedX) <= 0.02 && !magnet.isDragging) {
        lblFlux.textContent = "磁通量變化：無 (靜止)";
        lblFlux.style.background = "transparent";
        lblLenz.style.opacity = "0";
        titleEl.textContent = "狀態：靜止無感應電流";
        descEl.innerHTML = "磁鐵與線圈相對靜止，線圈內的<strong>磁通量未發生時間變化率 ($\Delta\Phi/\Delta t = 0$)</strong>，故不產生任何感應電動勢與感應電流。";
    } else if (magnet.speedX > 0) {
        // 【物理校正】：向右推進 -> 向右磁通量增加 -> 產生向左感應磁場抗拒 -> 右手螺旋判定：前端電流必須「向下」！
        showInducedField = true;
        inducedFieldDirection = 1; // 表示對抗接近，左端產生 N 極（向左的感應磁場）
        currentFlowDirection = 1;  // 粒子在前方半弧向下流動（順時針觀測）
        lblFlux.textContent = "磁通量變化：向右遞增 (➔)";
        lblFlux.style.background = "rgba(239, 68, 68, 0.3)";
        lblLenz.style.opacity = "1";
        lblLenz.textContent = "感應電流：順時針 (前端向下) ▼";
        titleEl.textContent = "狀態：磁鐵接近中！產生感應電流";
        descEl.innerHTML = "磁鐵向右推進，穿過線圈向右的磁通量增加。依據<strong>冷次定律</strong>，線圈左端自發感應出向左的磁場以抵抗增加（左端形成 N 極）。配合<strong>右手螺旋定則</strong>，線圈面向學生之前端產生向下的感應電流，電流由右側導線流入檢流計，使指針向右偏轉。";
    } else if (magnet.speedX < 0) {
        // 【物理校正】：向左拉離 -> 向右磁通量減少 -> 產生向右感應磁場挽留 -> 右手螺旋判定：前端電流必須「向上」！
        showInducedField = true;
        inducedFieldDirection = -1; // 表示挽留遠離，左端產生 S 極（向右的感應磁場）
        currentFlowDirection = -1;  // 粒子在前方半弧向上流動（逆時針觀測）
        lblFlux.textContent = "磁通量變化：向右遞減 (🠠)";
        lblFlux.style.background = "rgba(59, 130, 246, 0.3)";
        lblLenz.style.opacity = "1";
        lblLenz.textContent = "感應電流：逆時針 (前端向上) ▲";
        titleEl.textContent = "狀態：磁鐵拉離中！電流反向擺盪";
        descEl.innerHTML = "磁鐵向左拉離，穿過線圈向右的磁通量減少。依據<strong>冷次定律</strong>，線圈左端自發感應出向右的磁場以吸引挽留磁鐵（左端形成 S 極）。配合<strong>右手螺旋定則</strong>，線圈前端感應電流方向立即反轉向上，指針向左偏轉。";
    }

    // --- 2. 繪製動態背景外部磁力線 ---
    ctx.lineWidth = 1.5;
    const rightPoleX = magnet.x + magnet.w / 2;
    const leftPoleX = magnet.x - magnet.w / 2;

    for (let i = -3; i <= 3; i++) {
        const offsetMultiplier = i * 25;
        ctx.strokeStyle = `rgba(56, 189, 248, ${0.4 - Math.abs(i) * 0.08})`;
        ctx.beginPath();
        ctx.moveTo(rightPoleX, magnet.y + i * 5);
        ctx.bezierCurveTo(
            rightPoleX + 120 - Math.abs(offsetMultiplier) * 0.2, magnet.y + offsetMultiplier * 1.5,
            leftPoleX - 120 + Math.abs(offsetMultiplier) * 0.2, magnet.y + offsetMultiplier * 1.5,
            leftPoleX, magnet.y + i * 5
        );
        ctx.stroke();
    }

    // --- 3. 繪製實體 N / S 條形磁鐵 ---
    ctx.fillStyle = '#3b82f6';
    ctx.fillRect(magnet.x - magnet.w / 2, magnet.y - magnet.h / 2, magnet.w / 2, magnet.h);
    ctx.fillStyle = '#ef4444';
    ctx.fillRect(magnet.x, magnet.y - magnet.h / 2, magnet.w / 2, magnet.h);

    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 16px sans-serif';
    ctx.fillText('S', magnet.x - magnet.w / 3 - 5, magnet.y + 6);
    ctx.fillText('N', magnet.x + magnet.w / 3 - 5, magnet.y + 6);

    // --- 4. 繪製與檢流計連通的下引導線 ---
    ctx.strokeStyle = '#475569';
    ctx.lineWidth = 2.5;
    ctx.beginPath(); ctx.moveTo(coil.x - 15, coil.y + coil.radiusY - 5); ctx.lineTo(w * 0.45, h * 0.74); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(coil.x + 15, coil.y + coil.radiusY - 5); ctx.lineTo(w * 0.53, h * 0.74); ctx.stroke();

    // --- 5. 繪製多匝封閉立體金屬線圈 ---
    for (let t = 0; t < coil.turns; t++) {
        const turnOffsetX = (t - (coil.turns - 1) / 2) * 16;
        const cx = coil.x + turnOffsetX;

        // A. 繪製線圈後半弧（立體後方）
        ctx.strokeStyle = '#581c87';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.ellipse(cx, coil.y, coil.radiusX, coil.radiusY, 0, Math.PI * 0.5, Math.PI * 1.5);
        ctx.stroke();

        // B. 渲染高亮感應電流流體粒子 (【物理校正】：粒子圓周運動流向)
        if (Math.abs(magnet.speedX) > 0.02 || (magnet.isDragging && Math.abs(magnet.speedX) > 0.005)) {
            ctx.save();
            ctx.fillStyle = '#00ffcc';
            ctx.shadowColor = '#00ffcc';
            ctx.shadowBlur = 12;

            const particleCount = 3;
            for (let p = 0; p < particleCount; p++) {
                // 依據 currentFlowDirection 修正粒子的圓周運動參數軌跡
                const angleParam = (currentOffsetTime * currentFlowDirection + (p / particleCount) * Math.PI * 2) % (Math.PI * 2);

                const pX = cx + coil.radiusX * Math.cos(angleParam);
                const pY = coil.y + coil.radiusY * Math.sin(angleParam);

                // 僅在前半弧 (0 ~ 180度，即立體視覺的正面) 渲染流體粒子
                if (angleParam >= 0 && angleParam <= Math.PI) {
                    ctx.beginPath();
                    ctx.arc(pX, pY, 5.5, 0, Math.PI * 2);
                    ctx.fill();
                }
            }
            ctx.restore();
        }

        // C. 繪製線圈前半弧（立體前方）
        ctx.strokeStyle = '#a855f7';
        ctx.lineWidth = 5;
        ctx.beginPath();
        ctx.ellipse(cx, coil.y, coil.radiusX, coil.radiusY, 0, Math.PI * 1.5, Math.PI * 0.5);
        ctx.stroke();
    }

    // --- 6. 冷次定律動態感應磁場 (B_induced) 幾何發光箭頭 ---
    if (showInducedField && Math.abs(magnet.speedX) > 0.03) {
        ctx.save();
        ctx.lineWidth = 4;
        ctx.strokeStyle = '#10b981';
        ctx.fillStyle = '#10b981';
        ctx.shadowColor = '#10b981';
        ctx.shadowBlur = 8;

        const arrowY = coil.y;
        const startX = coil.x - 40;
        const endX = coil.x - 140;

        ctx.beginPath();
        if (inducedFieldDirection === 1) {
            // 【物理校正】：抗拒 N 極接近 -> 產生向左的感應磁場箭頭 (🠠)
            ctx.moveTo(startX, arrowY);
            ctx.lineTo(endX, arrowY);
            ctx.stroke();
            ctx.beginPath();
            ctx.moveTo(endX, arrowY);
            ctx.lineTo(endX + 12, arrowY - 6);
            ctx.lineTo(endX + 12, arrowY + 6);
            ctx.fill();

            ctx.fillStyle = '#10b981';
            ctx.font = 'bold 13px sans-serif';
            ctx.fillText('感應 N 極 (向左對抗)', coil.x - 130, coil.y - coil.radiusY - 10);
        } else {
            // 【物理校正】：挽留 N 極遠離 -> 產生向右的感應磁場箭頭 (➔)
            ctx.moveTo(endX, arrowY);
            ctx.lineTo(startX, arrowY);
            ctx.stroke();
            ctx.beginPath();
            ctx.moveTo(startX, arrowY);
            ctx.lineTo(startX - 12, arrowY - 6);
            ctx.lineTo(startX - 12, arrowY + 6);
            ctx.fill();

            ctx.fillStyle = '#38bdf8';
            ctx.font = 'bold 13px sans-serif';
            ctx.fillText('感應 S 極 (向右挽留)', coil.x - 130, coil.y - coil.radiusY - 10);
        }
        ctx.restore();
    }

    requestAnimationFrame(drawScene);
}

window.addEventListener('resize', () => { resizeCanvas(); });

// 初始調度
resizeCanvas();
drawScene();


// --- 核心 4: 高中物理電磁感應與冷次定律 10 題核心精選結構化題庫 ---
// 【教育修正】：全面修正口語化文字，改用科學敘述，並修正第 2 題與第 10 題的文字邏輯錯誤。
const quizData = [
    {
        q: "1. 依據法拉第電磁感應定律，當條形磁鐵沿線圈中軸線運動時，線圈產生的感應電動勢大小取決於下列哪一個物理量？",
        opts: ["(A) 磁鐵的總質量與體積大小", "(B) 瞬間穿過線圈的總磁通量絕對值", "(C) 穿過線圈的磁通量隨時間的變化率（ΔΦ/Δt）", "(D) 周圍環境的空氣濕度與溫度"],
        a: "C",
        r: "正確！法拉第定律指出感應電動勢 ε = -N(ΔΦ/Δt)，這意味著感應電壓與磁通量的「時間變化率」成正比。若磁鐵靜止不動（變化率為 0），便不會產生任何感應電流。"
    },
    {
        q: "2. 將條形磁鐵的 N 極「快速插入」一個封閉的固定銅線圈中，由磁鐵插入端（左側）向線圈望去，線圈表面所產生的感應電流方向為何？",
        opts: ["(A) 順時針方向", "(B) 逆時針方向", "(C) 毫無感應電流", "(D) 電流方向與移動快慢無關，始終為零"],
        a: "B",
        r: "正確！依據冷次定律，當 N 極接近時，線圈為了抵抗向內增加的向右磁通量，其左端端面必須自發感應出對抗 N 極的磁場（即左端生出 N 極）。根據右手螺旋定則，由左向右觀看，線圈將產生「逆時針方向」的感應電流。"
    },
    {
        q: "3. 承上題，此時線圈與條形磁鐵之間會產生何種幾何力學作用？",
        opts: ["(A) 互相吸引的引力", "(B) 互相排斥的斥力", "(C) 不產生任何相互作用力", "(D) 產生順時針的轉矩"],
        a: "B",
        r: "正確！這正是經典的「來拒去留」原理。當 N 極接近時，線圈感應出 N 極以對抗其移近，因此兩者之間會產生「互相排斥的斥力」。外力必須克服此斥力做功，方能轉化為電能。"
    },
    {
        q: "4. 如果將條形磁鐵的 N 極由封閉線圈內部「向左快速拉出遠離」，則此時線圈端點產生的感應極性與磁力表現為何？",
        opts: ["(A) 線圈端面感應出 N 極，與磁鐵產生斥力", "(B) 線圈端面感應出 S 極，與磁鐵產生吸引力，試圖挽留磁鐵", "(C) 線圈端面不帶任何磁極", "(D) 線圈會因高熱融化"],
        a: "B",
        r: "正確！當 N 極向左拉離時，穿過線圈向右的磁通量正在減少。依據冷次定律，線圈會試圖反抗此減少，因而在左端面感應出「S 極」以挽留 N 極，兩者表現為「吸引力」。"
    },
    {
        q: "5. 有一個均勻磁場垂直穿過一固定的圓形金屬線圈。若該磁場的磁感應強度 B 隨時間 t 呈「線性均勻隨時間遞增」，則線圈內的感應電流大小將如何變化？",
        opts: ["(A) 隨時間均勻遞增", "(B) 隨時間均勻遞減", "(C) 保持大小恆定不變", "(D) 始終為零"],
        a: "C",
        r: "正確！因為磁場 B 隨時間線性均勻遞增，代表磁通量的變化率（ΔΦ/Δt）是一個恆定的常數。由於變化率恆定，依據法拉第定律，所產生的感應電動勢與感應電流大小亦將「保持恆定不變」。"
    },
    {
        q: "6. 在電磁感應現象中，冷次定律所描述的「感應電流磁場永遠反抗原有磁通量變化」，在本質上是哪一個宇宙黃金守恆定律的必然結果？",
        opts: ["(A) 電量守恆定律", "(B) 動量守恆定律", "(C) 能量守恆定律", "(D) 質量守恆定律"],
        a: "C",
        r: "正確！冷次定律是「能量守恆定律」在電磁學上的體現。若感應電流的方向不是反抗而是順應磁通量變化（即來助去送），則只要稍微移動磁鐵，系統就會無限制自我放大，憑空產生無限電能，這違反了能量守恆定律。"
    },
    {
        q: "7. 某同學將磁鐵由同一高度自由下落，使其穿過一個水平放置的封閉銅線圈。在磁鐵尚未進入線圈、正在接近線圈的過程中，磁鐵下落的加速度 a 與地心引力加速度 g 的大小關係為何？",
        opts: ["(A) a > g", "(B) a = g", "(C) a < g", "(D) a = 0"],
        a: "C",
        r: "正確！當磁鐵接近封閉線圈時，線圈產生的感應電流磁場會對磁鐵施加一個向上的排斥阻力。此阻力與重力方向相反，使得磁鐵受到的合力小於自身重力，故其下落加速度「a < g」。"
    },
    {
        q: "8. 若將上題中的銅線圈切開一個「小缺口」，使其變成一個非封閉的斷路開口線圈。當磁鐵再度由上方自由下落穿過它時，線圈的感應狀態為何？",
        opts: ["(A) 線圈內有感應電動勢，亦有感應電流，加速度 a < g", "(B) 線圈內無感應電動勢，亦無感應電流，加速度 a = g", "(C) 線圈內有感應電動勢，但無感應電流，磁鐵下落加速度 a = g", "(D) 線圈會自發產生劇烈爆炸"],
        a: "C",
        r: "正確！因為磁通量依然在發生變化，所以線圈兩端依舊會產生「感應電動勢（電壓）」。但由於線圈有缺口未封閉，電路呈斷路狀態，因此「無法形成感應電流」，不產生磁力阻力，磁鐵下落加速度 a = g。"
    },
    {
        q: "9. 日常生活中的「法拉第微型手搖手電筒」與「晃動發電鑰匙圈」，其內部的核心發電物理構造與運作原理是什麼？",
        opts: ["(A) 利用水力在內部推動微型渦輪機", "(B) 晃動時使條形磁鐵反覆穿過線圈，將機械能轉化為電能的電磁感應現象", "(C) 利用摩擦起電將電荷儲存在電容器中", "(D) 化學電池的氧化還原反應"],
        a: "B",
        r: "正確！手搖或晃動發電裝置，本質上就是透過人體晃動提供機械能，使內部的磁鐵與螺線管線圈發生相對運動，利用「電磁感應」源源不絕地產生電流並儲存起來。"
    },
    {
        q: "10. 水力發電廠或風力發電機，通常是讓巨大的線圈在強大磁場中做穩定的勻速圓周旋轉。請問這樣的發電機所輸出的電流，其波形與特徵屬於下列何者？",
        opts: ["(A) 大小與方向皆不隨時間改變的直流電（DC）", "(B) 大小與方向隨時間呈正弦或餘弦週期性起伏變化的交流電（AC）", "(C) 穩定不變的脈衝突波電流", "(D) 恆定不變的靜電場高壓放電"],
        a: "B",
        r: "正確！當線圈在磁場中勻速旋轉時，穿過線圈的磁通量會隨時間呈餘弦（cos）週期函數波動。其時間變化率（導數）則呈正弦（sin）週期變化，因此產生的大小與方向皆週期改變的「交流電（AC）」目標波形。"
    }
];

let currentQuizIndex = 0;

function initQuiz() {
    const container = document.getElementById('quiz-container');
    if (!container) return;

    if (currentQuizIndex >= quizData.length) {
        container.innerHTML = "<div class='quiz-question' style='color:#00ffcc; text-align:center;'>🎉 恭喜！電磁感應與冷次定律 10 題大考核心考點，你已全部完美通關！</div>";
        return;
    }

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

function nextQuestion() {
    currentQuizIndex++;
    initQuiz();
}

window.addEventListener('DOMContentLoaded', initQuiz);