const canvas = document.getElementById('faultCanvas');
const ctx = canvas.getContext('2d');

// 構造地質學三大核心受力狀態模式
let currentMode = 'normal'; // 'normal' (正斷層), 'reverse' (逆斷層), 'strike' (平移斷層)

// 應變與位移核心控制變數
let strainProgress = 0;   // 應變累積進度 (0 ~ 1)
let activeDisplacement = 0; // 發生斷裂後的相對位移像素值
let erosionHeight = 0;    // 被侵蝕削平的高度像素值

// 幾何構造控制參數
let faultAngle = Math.PI / 3; // 斷層傾角預設 60 度 (正斷層常用)
let isBroken = false;         // 岩層是否已超過剪切強度而斷裂

// 精細岩層配色 (符合野外沉積地層沈積相外觀，上新老下)
const layerColors = [
    { name: '砂岩層 A (新)', fill: '#eab308', stroke: '#ca8a04' },
    { name: '頁岩層 B', fill: '#38bdf8', stroke: '#0284c7' },
    { name: '石灰岩層 C', fill: '#10b981', stroke: '#059669' },
    { name: '礫岩層 D (老)', fill: '#f97316', stroke: '#ea580c' }
];

function resizeCanvas() {
    const rect = canvas.parentElement.getBoundingClientRect();
    canvas.width = rect.width * window.devicePixelRatio;
    canvas.height = rect.height * window.devicePixelRatio;
    ctx.scale(window.devicePixelRatio, window.devicePixelRatio);
    drawScene();
    updateLabelsPosition();
}

// 根據斷層力學模式實時繪製剖面幾何
function drawScene() {
    const w = canvas.width / window.devicePixelRatio;
    const h = canvas.height / window.devicePixelRatio;
    ctx.clearRect(0, 0, w, h);

    // 建立地質透視背景網格
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.02)';
    ctx.lineWidth = 1;
    for(let i=0; i<w; i+=40) {
        ctx.beginPath(); ctx.moveTo(i, 0); ctx.lineTo(i, h); ctx.stroke();
    }

    const midX = w / 2;
    const surfaceY = h * 0.3; // 原始未侵蝕地表面高度
    const layerH = h * 0.12;   // 每個岩層的單純厚度

    // 計算斷層線幾何：一條穿過中心點、傾角為 faultAngle 的斜線
    // 斜率 k = tan(faultAngle)
    const k = Math.tan(faultAngle);
    
    // 定義斷層線在 X 軸中點與地表交會
    // 斷層線公式： y - h*0.5 = k * (x - midX) -> x = midX + (y - h*0.5)/k
    function getFaultX(y) {
        return midX + (y - h * 0.55) / k;
    }

    // 計算三大應力模式下的相對移動向量
    let moveX = 0;
    let moveY = 0;

    if (isBroken) {
        if (currentMode === 'normal') {
            // 正斷層：上盤（右側塊體）沿著斷層面向下滑動
            moveX = activeDisplacement * Math.cos(faultAngle);
            moveY = activeDisplacement * Math.sin(faultAngle);
        } else if (currentMode === 'reverse') {
            // 逆斷層：上盤（右側塊體）逆著重力向上爬升
            moveX = -activeDisplacement * Math.cos(faultAngle);
            moveY = -activeDisplacement * Math.sin(faultAngle);
        } else if (currentMode === 'strike') {
            // 平移斷層（以三維側視透視模擬）：塊體發生水平位移错動，垂直無明顯高度差
            moveX = activeDisplacement * 0.4;
            moveY = -activeDisplacement * 0.15; // 產生微幅立體透視位移
        }
    }

    // ----------------------------------------------------
    // 【下盤 (Footwall) 塊體繪製】位於斷層面下方（左側固定端）
    // ----------------------------------------------------
    layerColors.forEach((layer, idx) => {
        const currentLayerTop = surfaceY + idx * layerH;
        
        ctx.fillStyle = layer.fill;
        ctx.strokeStyle = layer.stroke;
        ctx.lineWidth = 1.5;

        ctx.beginPath();
        ctx.moveTo(0, currentLayerTop);
        
        // 應變階段的微幅「褶皺彎曲」前兆模擬
        if (!isBroken && strainProgress > 0) {
            const flexureY = currentMode === 'reverse' ? -strainProgress * 12 : strainProgress * 12;
            ctx.quadraticCurveTo(getFaultX(currentLayerTop) * 0.5, currentLayerTop + flexureY, getFaultX(currentLayerTop), currentLayerTop);
        } else {
            ctx.lineTo(getFaultX(currentLayerTop), currentLayerTop);
        }

        ctx.lineTo(getFaultX(currentLayerTop + layerH), currentLayerTop + layerH);
        ctx.lineTo(0, currentLayerTop + layerH);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
    });

    // ----------------------------------------------------
    // 【上盤 (Hanging Wall) 塊體繪製】位於斷層線右側（滑動端）
    // ----------------------------------------------------
    ctx.save();
    // 將畫布矩陣平移，精確演繹上盤隨斷層滑動面的向量移動
    ctx.translate(moveX, moveY);
    
    layerColors.forEach((layer, idx) => {
        const currentLayerTop = surfaceY + idx * layerH;
        
        ctx.fillStyle = layer.fill;
        ctx.strokeStyle = layer.stroke;
        ctx.lineWidth = 1.5;

        ctx.beginPath();
        ctx.moveTo(getFaultX(currentLayerTop), currentLayerTop);
        ctx.lineTo(w + 100, currentLayerTop);
        ctx.lineTo(w + 100, currentLayerTop + layerH);
        ctx.lineTo(getFaultX(currentLayerTop + layerH), currentLayerTop + layerH);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
    });
    ctx.restore();

    // ----------------------------------------------------
    // 【斷層線與地表侵蝕面削平遮罩】
    // ----------------------------------------------------
    // 繪製斷層滑動面 (亮紫色發光感)
    ctx.strokeStyle = isBroken ? 'var(--fault-purple)' : 'rgba(255,255,255,0.15)';
    ctx.lineWidth = isBroken ? 3 : 1.5;
    if (isBroken) {
        ctx.shadowBlur = 8; ctx.shadowColor = '#a78bfa';
    }
    ctx.beginPath();
    ctx.moveTo(getFaultX(surfaceY - 50), surfaceY - 50);
    ctx.lineTo(getFaultX(h), h);
    ctx.stroke();
    ctx.shadowBlur = 0; // 還原

    // 模擬風化侵蝕（削平地面）：用大氣背景色直接向下遮蔽蓋平
    if (erosionHeight > 0) {
        ctx.fillStyle = '#090e18';
        ctx.fillRect(0, surfaceY, w, erosionHeight);
        
        // 侵蝕後的新地表線
        ctx.strokeStyle = '#10b981';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(0, surfaceY + erosionHeight);
        ctx.lineTo(w, surfaceY + erosionHeight);
        ctx.stroke();
    }
}

// 動態更新科學標籤的絕對 CSS 位置，確保與畫布上的斷層面完全鎖死聯動
function updateLabelsPosition() {
    const w = canvas.width / window.devicePixelRatio;
    const h = canvas.height / window.devicePixelRatio;

    const lblHanging = document.getElementById('lbl-hanging');
    const lblFoot = document.getElementById('lbl-foot');

    // 根據正逆斷層動態微調標籤座標
    lblFoot.style.left = `${w * 0.22}px`;
    lblFoot.style.top = `${h * 0.55}px`;

    if (isBroken) {
        let offset = currentMode === 'reverse' ? -25 : 25;
        lblHanging.style.left = `${w * 0.65}px`;
        lblHanging.style.top = `${h * 0.55 + offset}px`;
    } else {
        lblHanging.style.left = `${w * 0.65}px`;
        lblHanging.style.top = `${h * 0.55}px`;
    }
}

// 聯動同步與更新右側 UI 面板力學文字與大考應力指標
function updateUI() {
    const badge = document.getElementById('cell-status');
    const zone = document.getElementById('status-zone');
    const tStress = document.getElementById('td-stress-type');
    const tDisp = document.getElementById('td-displacement');
    const tEnergy = document.getElementById('td-energy-state');
    const desc = document.getElementById('stage-desc');

    const arrowL = document.getElementById('stress-L');
    const arrowR = document.getElementById('stress-R');

    // 更新應力方向箭頭視覺外觀
    if (currentMode === 'normal') {
        tStress.textContent = "水平張力 (Tensional)";
        tStress.style.color = "#38bdf8";
        arrowL.style.transform = "translateY(-50%) rotate(180deg)"; // 向左拉伸
        arrowR.style.transform = "translateY(-50%) rotate(0deg)";   // 向右拉伸
    } else if (currentMode === 'reverse') {
        tStress.textContent = "水平壓力 (Compressional)";
        tStress.style.color = "#f43f5e";
        arrowL.style.transform = "translateY(-50%) rotate(0deg)";   // 向內擠壓
        arrowR.style.transform = "translateY(-50%) rotate(180deg)"; // 向內擠壓
    } else {
        tStress.textContent = "剪切力 (Shear Stress)";
        tStress.style.color = "#a78bfa";
    }

    if (!isBroken) {
        zone.textContent = "應變累積中 (Elastic Strain Accumulating)";
        zone.style.borderLeftColor = "#eab308";
        tDisp.textContent = "0 公尺 (鎖定中)";
        tEnergy.innerHTML = `<span style='color:#eab308;'>已累積 ${(strainProgress*100).toFixed(0)}% 能量</span>`;
        desc.textContent = "地殼板塊正持續施加構造應力，岩層內部正發生微幅的彈性形變。尚未達到岩石破裂的極限臨界值。";
    } else {
        zone.textContent = "構造斷裂！引發瞬時地震波能量釋放";
        zone.style.borderLeftColor = "#ef4444";
        tDisp.textContent = `${(activeDisplacement * 1.8).toFixed(0)} 公尺 (相對位移)`;
        tEnergy.innerHTML = "<span style='color:#ef4444;'>⚡ 應力釋放完畢</span>";
        
        if (currentMode === 'normal') {
            desc.innerHTML = "<strong>【大考重點】正斷層成立。</strong>由於環境受到外擴張張力，斷層坡面上的<strong>上盤相對順著重力向下滑動</strong>，此構造常見於張裂性板塊邊界。";
        } else if (currentMode === 'reverse') {
            desc.innerHTML = "<strong>【大考重點】逆斷層成立。</strong>環境受到強烈擠壓聚合壓力，斜坡上的<strong>上盤克服重力強行向上爬升</strong>，此構造為造山帶與聚合性邊界（如臺灣）最核心的構造特徵。";
        } else {
            desc.innerHTML = "<strong>【大考重點】平移斷層。</strong>岩層受水平走向剪力錯動，垂直方向無明顯落差，主要為水平方向的平移。";
        }
    }
}

// ----------------------------------------------------
// 力學操作動態觸發引擎 (連續平滑動畫)
// ----------------------------------------------------
let animationInterval = null;

document.getElementById('btn-apply-stress').onclick = function() {
    if (isBroken) return; // 已斷裂則需先重置
    
    let targetStrain = 0;
    if (animationInterval) clearInterval(animationInterval);

    animationInterval = setInterval(() => {
        strainProgress += 0.08;
        if (strainProgress >= 1.0) {
            strainProgress = 1.0;
            isBroken = true; // 超過極限，瞬時發生構造斷裂
            // 觸發錯動位移
            activeDisplacement = 45; 
            clearInterval(animationInterval);
            // 模擬震動感
            triggerEarthquakeGlow();
        }
        updateUI();
        drawScene();
        updateLabelsPosition();
    }, 40);
};

// 模擬地震發光的發能效果
function triggerEarthquakeGlow() {
    canvas.style.transform = "scale(1.02)";
    setTimeout(() => { canvas.style.transform = "scale(1)"; }, 150);
}

// 地表長期風化侵蝕削平功能
document.getElementById('btn-erode').onclick = function() {
    if (!isBroken) return;
    erosionHeight = 35; // 削平地表高出的構造崖
    drawScene();
    document.getElementById('stage-desc').innerHTML = "<strong>【地質學進階考點】侵蝕面形成。</strong>斷層崖露出地表後，經過長期的風化、侵蝕與搬運作用，高凸的構造崖被削平。此時野外露頭呈現出平整地表，是大考考題最常出現的標準構造圖。";
};

// 模式切換事件綁定
document.getElementById('mode-normal').onclick = function() { changeMode('normal', this); };
document.getElementById('mode-reverse').onclick = function() { changeMode('reverse', this); };
document.getElementById('mode-strike').onclick = function() { changeMode('strike', this); };

function changeMode(mode, btnEl) {
    currentMode = mode;
    document.querySelectorAll('.panel-group .btn').forEach(b => b.classList.remove('active'));
    btnEl.classList.add('active');
    
    // 平移斷層微調視角傾角
    if (mode === 'strike') faultAngle = Math.PI / 2.2; // 近乎垂直的面
    else faultAngle = Math.PI / 3; // 60度標準傾角

    resetGeology();
}

function resetGeology() {
    strainProgress = 0;
    activeDisplacement = 0;
    erosionHeight = 0;
    isBroken = false;
    if (animationInterval) clearInterval(animationInterval);
    updateUI();
    drawScene();
    updateLabelsPosition();
}

document.getElementById('btn-reset').onclick = resetGeology;

// ----------------------------------------------------
// 構造地質學大考專用高階題庫模組
// ----------------------------------------------------
const quizData = [
    {
        q: "在野外觀察一處因侵蝕而平整的地面露頭。若我們發現斷层線兩側的地層排列不連續，且順著斜面傾斜方向看去，位於上方的一盤（上盤）出現了較年輕的新地層，而下盤則是較老的地層，則此構造最可能經歷了何種應力作用？",
        opts: [
            "A. 受到強烈擠壓的水平壓力作用，形成逆斷層",
            "B. 受到地殼拉張的水平張力作用，形成正斷層",
            "C. 受到兩側剪切力的作用，形成轉形斷層",
            "D. 未受應力作用，純粹為老地層不連續沉積的現象"
        ],
        a: "B",
        r: "【核心力學邏輯】：正斷層的上盤相對下滑，這會導致當環境被侵蝕削平後，上盤較新（原本在高處）的地層會下降到與下盤較老地層並列的位置。因此在露頭面看見上盤地層較新，必為張力導致的正斷層構造。"
    },
    {
        q: "臺灣島位於菲律賓海板塊與歐亞板塊的聚合邊界，地表呈現高聳的造山帶。在這種大地構造背景下，臺灣本島最普遍且密集的斷層型態為何？",
        opts: [
            "A. 正斷層，因為板塊互相張裂拉伸",
            "B. 平移斷層，因為板塊僅發生南北向的平移錯動",
            "C. 逆斷層，因為聚合邊界提供強大的水平擠壓應力",
            "D. 正斷層與平移斷層各佔一半，無逆斷層存在"
        ],
        a: "C",
        r: "臺灣因受板塊碰撞擠壓（歐亞板塊與菲律賓海板塊聚合），大地構造應力場以【水平壓力】為主導，因此臺灣本島絕大多數的中央山脈逆衝構造與西部麓山帶皆為【逆斷層】與褶皺體系。"
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

    document.querySelectorAll('.opt-btn').forEach(b => b.disabled = true);

    if (userOpt === qItem.a) {
        feedbackEl.className = "quiz-feedback correct";
        feedbackEl.innerHTML = `<strong>🟢 嚴謹回答正確！</strong><br>${qItem.r}`;
    } else {
        feedbackEl.className = "quiz-feedback wrong";
        feedbackEl.innerHTML = `<strong>🔴 回答不夠精確（正確答案是 ${qItem.a}）</strong><br>${qItem.r}`;
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
    updateUI();
    loadQuiz();
});