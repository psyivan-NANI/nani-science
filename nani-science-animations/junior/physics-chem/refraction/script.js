const canvas = document.getElementById('refractionCanvas');
const ctx = canvas.getContext('2d');

let isPlaying = true;
let incidentAngleDeg = 45; 
let currentMode = 'air-water'; // 'air-water' 或 'water-air'
let particleOffset = 0; // 用於光束粒子流動效果

function resizeCanvas() {
    const rect = canvas.parentElement.getBoundingClientRect();
    canvas.width = rect.width * window.devicePixelRatio;
    canvas.height = rect.height * window.devicePixelRatio;
    ctx.scale(window.devicePixelRatio, window.devicePixelRatio);
}

// 根據真實折射率計算折射角 (空氣 n1=1.0, 水 n2=1.33)
function calculateRefraction(angleDeg, mode) {
    const nAir = 1.0;
    const nWater = 1.33;
    const angleRad = (angleDeg * Math.PI) / 180;

    if (mode === 'air-water') {
        // 空氣到水：sin(r) = sin(i) * nAir / nWater
        let sinR = Math.sin(angleRad) * nAir / nWater;
        return Math.asin(sinR) * 180 / Math.PI;
    } else {
        // 水到空氣：sin(r) = sin(i) * nWater / nAir
        let sinR = Math.sin(angleRad) * nWater / nAir;
        if (sinR > 1.0) return -1; // 發生全反射特例
        return Math.asin(sinR) * 180 / Math.PI;
    }
}

// 核心光學物理渲染引擎
function drawScene() {
    const w = canvas.width / window.devicePixelRatio;
    const h = canvas.height / window.devicePixelRatio;

    ctx.clearRect(0, 0, w, h);

    const cx = w / 2;
    const cy = h / 2;
    const rayLength = Math.min(w, h) * 0.42;

    // --- 1. 繪製介質背景（水底著色） ---
    ctx.fillStyle = '#06152d'; // 上層背景 (深色天空)
    ctx.fillRect(0, 0, w, h);
    
    ctx.fillStyle = '#0b2447'; // 下層背景 (半透明藍色水體)
    ctx.fillRect(0, cy, w, h / 2);

    // --- 2. 繪製法線與介面 ---
    // 介面 (水平線)
    ctx.strokeStyle = 'rgba(0, 212, 255, 0.4)';
    ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(20, cy); ctx.lineTo(w - 20, cy); ctx.stroke();

    // 法線 (垂直虛線)
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)';
    ctx.lineWidth = 1.5;
    ctx.setLineDash([6, 6]);
    ctx.beginPath(); ctx.moveTo(cx, 15); ctx.lineTo(cx, h - 15); ctx.stroke();
    ctx.setLineDash([]);

    // --- 3. 計算光線幾何座標 ---
    let iAngleRad = (incidentAngleDeg * Math.PI) / 180;
    let rAngleDeg = calculateRefraction(incidentAngleDeg, currentMode);
    let isTotalInternalReflection = (rAngleDeg === -1);
    let rAngleRad = (rAngleDeg * Math.PI) / 180;

    // 入射光起點 (上方射入或下方射入)
    let idx = currentMode === 'air-water' ? cx - rayLength * Math.sin(iAngleRad) : cx - rayLength * Math.sin(iAngleRad);
    let idy = currentMode === 'air-water' ? cy - rayLength * Math.cos(iAngleRad) : cy + rayLength * Math.cos(iAngleRad);

    // --- 4. 繪製角度扇形半透明提示區域 ---
    if (incidentAngleDeg > 2) {
        ctx.fillStyle = 'rgba(255, 51, 51, 0.15)'; // 入射角範圍 (紅)
        ctx.beginPath();
        ctx.moveTo(cx, cy);
        if (currentMode === 'air-water') {
            ctx.arc(cx, cy, 35, -Math.PI/2, -Math.PI/2 - iAngleRad, true);
        } else {
            ctx.arc(cx, cy, 35, Math.PI/2, Math.PI/2 - iAngleRad, true);
        }
        ctx.closePath();
        ctx.fill();

        if (!isTotalInternalReflection) {
            ctx.fillStyle = 'rgba(0, 255, 204, 0.15)'; // 折射角範圍 (綠)
            ctx.beginPath();
            ctx.moveTo(cx, cy);
            if (currentMode === 'air-water') {
                ctx.arc(cx, cy, 35, Math.PI/2, Math.PI/2 - rAngleRad, false);
            } else {
                ctx.arc(cx, cy, 35, -Math.PI/2, -Math.PI/2 - rAngleRad, false);
            }
            ctx.closePath();
            ctx.fill();
        }
    }

    // --- 5. 繪製實際雷射光束射線 ---
    // 入射光線
    ctx.strokeStyle = '#ff3333';
    ctx.lineWidth = 3.5;
    ctx.shadowBlur = 10;
    ctx.shadowColor = '#ff3333';
    ctx.beginPath(); ctx.moveTo(idx, idy); ctx.lineTo(cx, cy); ctx.stroke();

    // 折射光線或反射光線
    let odx, ody;
    if (isTotalInternalReflection) {
        // 全反射特例：反射回水中
        odx = cx + rayLength * Math.sin(iAngleRad);
        ody = cy + rayLength * Math.cos(iAngleRad);
        ctx.strokeStyle = '#ff3333';
        ctx.shadowColor = '#ff3333';
    } else {
        // 標準折射
        odx = currentMode === 'air-water' ? cx + rayLength * Math.sin(rAngleRad) : cx + rayLength * Math.sin(rAngleRad);
        ody = currentMode === 'air-water' ? cy + rayLength * Math.cos(rAngleRad) : cy - rayLength * Math.cos(rAngleRad);
        ctx.strokeStyle = '#00ffcc';
        ctx.shadowColor = '#00ffcc';
    }
    ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(odx, ody); ctx.stroke();
    ctx.shadowBlur = 0; // 重置發光

    // --- 6. 繪製光流動能量粒子（展現波前傳播速度快慢之核心教學功能） ---
    if (isPlaying) {
        // 上半月/下半月傳播介質粒子速度補償
        // 空氣中速度較快(步進增量大)，水中較慢(步進增量小)
        let vTop = currentMode === 'air-water' ? 1.6 : 0.9;
        let vBottom = currentMode === 'air-water' ? 0.9 : 1.6;
        particleOffset += 1.2;

        ctx.fillStyle = '#ffffff';
        // 入射光粒子
        for (let i = 0; i < 3; i++) {
            let pProgress = ((particleOffset * vTop + i * 40) % rayLength) / rayLength;
            let px = idx + (cx - idx) * pProgress;
            let py = idy + (cy - idy) * pProgress;
            ctx.beginPath(); ctx.arc(px, py, 3, 0, Math.PI * 2); ctx.fill();
        }

        // 折射/反射光粒子
        if (!isTotalInternalReflection) {
            for (let i = 0; i < 3; i++) {
                let pProgress = ((particleOffset * vBottom + i * 40) % rayLength) / rayLength;
                let px = cx + (odx - cx) * pProgress;
                let py = cy + (ody - cy) * pProgress;
                ctx.beginPath(); ctx.arc(px, py, 3, 0, Math.PI * 2); ctx.fill();
            }
        }
    }

    // 繪製交界點法線核心圓圈
    ctx.fillStyle = '#ffffff';
    ctx.beginPath(); ctx.arc(cx, cy, 4, 0, Math.PI * 2); ctx.fill();

    // 在 Canvas 上即時手寫角度數值標籤以防重疊
    ctx.fillStyle = '#ff8888';
    ctx.font = '12px sans-serif';
    if (currentMode === 'air-water') {
        ctx.fillText(`入射角 ∠i = ${incidentAngleDeg}°`, cx - 95, cy - 45);
        if (!isTotalInternalReflection) {
            ctx.fillStyle = '#88ffdd';
            ctx.fillText(`折射角 ∠r = ${Math.round(rAngleDeg)}°`, cx + 25, cy + 55);
        }
    } else {
        ctx.fillText(`入射角 ∠i = ${incidentAngleDeg}°`, cx - 95, cy + 55);
        if (isTotalInternalReflection) {
            ctx.fillStyle = '#ff8888';
            ctx.fillText(`全反射！`, cx + 25, cy + 55);
        } else {
            ctx.fillStyle = '#88ffdd';
            ctx.fillText(`折射角 ∠r = ${Math.round(rAngleDeg)}°`, cx + 25, cy - 45);
        }
    }
}

// 動態更新側邊狀態說明
function updateInterface() {
    let rAngleDeg = calculateRefraction(incidentAngleDeg, currentMode);
    let title = "";
    let desc = "";

    document.getElementById('angle-text').textContent = `${incidentAngleDeg}°`;

    if (currentMode === 'air-water') {
        document.getElementById('lbl-top').textContent = "空氣 (光速較快)";
        document.getElementById('lbl-bottom').textContent = "水 (光速較慢)";
        
        if (incidentAngleDeg === 0) {
            title = "光線垂直入射 (∠i = 0°)";
            desc = "當光線垂直界面入射時，**前進方向保持直線不偏折**（折射角亦為 0°）。但是！因為介質改變，**光在水中的傳播速度依然變慢了**。這是會考極常考的秒殺陷阱題！";
        } else {
            title = `光由 空氣 斜射入 水 中 (快 → 慢)`;
            desc = `當光由光速較快的空氣進入光速較慢的水中時，光線前進方向會**偏向法線**。此時，**入射角大於折射角**（∠i > ∠r）。您可以觀察畫面上白點粒子的流動速度，進入水中後明顯變慢。`;
        }
    } else {
        document.getElementById('lbl-top').textContent = "空氣 (光速較快)";
        document.getElementById('lbl-bottom').textContent = "水 (光速較慢)";

        if (incidentAngleDeg === 0) {
            title = "光線垂直入射 (∠i = 0°)";
            desc = "當光線自水底垂直入射至空氣時，**前進方向不偏折**。但因為離開水體，**光在空氣中的傳播速度變快了**。";
        } else if (rAngleDeg === -1) {
            title = `💥 觸發臨界現象：全反射！`;
            desc = `當光由慢介質（水）進入快介質（空氣），且入射角太大（超過臨界角約 48.5°）時，光線**無法折射進入空氣**，而是全部如同鏡子般反射回水底，這稱為**全反射**！光纖通訊就是利用這個原理。`;
        } else {
            title = `光由 水 斜射入 空氣 中 (慢 → 快)`;
            desc = `當光由光速較慢的水進入較快的空氣時，光線前進方向會**偏離法線**。此時，**入射角小於折射角**（∠i < ∠r）。畫面中白色能量粒子進入空氣後，流動速率明顯暴增。`;
        }
    }

    document.getElementById('status-title').textContent = title;
    document.getElementById('status-desc').innerHTML = desc;
}

// 綁定 UI 互動控制項
document.getElementById('slider-angle').oninput = function () {
    incidentAngleDeg = parseInt(this.value);
    updateInterface();
    drawScene();
};

document.getElementById('mode-air-water').onclick = function () {
    currentMode = 'air-water';
    this.classList.add('active');
    document.getElementById('mode-water-air').classList.remove('active');
    updateInterface();
    drawScene();
};

document.getElementById('mode-water-air').onclick = function () {
    currentMode = 'water-air';
    this.classList.add('active');
    document.getElementById('mode-air-water').classList.remove('active');
    updateInterface();
    drawScene();
};

document.getElementById('btn-play-pause').onclick = function () {
    isPlaying = !isPlaying;
    this.textContent = isPlaying ? "暫停光束動態" : "啟動光束動態";
    this.classList.toggle('active', isPlaying);
};

// --- 精選 10 題：國中理化會考【光的折射與光學】核心能力檢測題庫 ---
const quizData = [
    {
        q: "1. 當光線由空氣中「斜射」進入水中時，下列關於光的傳播途徑與物理量變化，哪一項敘述是正確的？",
        opts: ["(A) 傳播前進方向會偏離法線", "(B) 入射角會小於折射角", "(C) 光速在水中會變慢，且折射角小於入射角", "(D) 光速在水中會變快"],
        a: "C",
        r: "依照口訣『快大、慢小』：空氣中光速快、夾角大（入射角大）；水中光速慢、夾角小（折射角小）。因此光線會偏向法線，折射角小於入射角。"
    },
    {
        q: "2. 小明將一枝直尺垂直插入裝滿水的透明玻璃杯中，由岸上斜上方往下看。請問直尺在水中的外觀看起來會如何變化？",
        opts: ["(A) 看起來變長了", "(B) 看起來折斷了，且水下部分向上折起變淺", "(C) 看起來完全沒有變化", "(D) 尺上的刻度看起來變大拉長"],
        a: "B",
        r: "這是經典的會考題！水中的直尺反射的光線由水中進入空氣（慢到快，偏離法線），折射光線進入人眼後，大腦會沿著直線反向延伸，誤以為物體在較淺的位置。因此水中的物體看起來都會『往上浮、變淺』。"
    },
    {
        q: "3. 雷射光由空氣垂直（入射角 0°）射入一個厚玻璃磚中。請問下列有關雷射光的敘述何者正確？",
        opts: ["(A) 入射角為 0° 故不發生折射，前進方向不變，光速亦保持不變", "(B) 因為前進方向不變，所以不叫做折射現象", "(C) 雖然前進方向不折射，但因為光速變慢，它仍然屬於折射現象", "(D) 光線會沿著玻璃表面全反射"],
        a: "C",
        r: "極高頻率考點！折射的本質是『光速的改變』。雖然入射角為 0° 時，前進方向不會發生偏折，但光在玻璃中的傳播速度確實變慢了，因此它依然是折射現象的一種特例！"
    },
    {
        q: "4. 光在空氣、水、玻璃三種不同介質中的傳播速度大小關係為：空氣 > 水 > 玻璃。若有一束光以相同的入射角 45° 分別由空氣射入水、以及由空氣射入玻璃中，其折射角分別為 r1 與 r2。請問 r1 與 r2 的大小關係為何？",
        opts: ["(A) r1 > r2", "(B) r1 < r2", "(C) r1 = r2", "(D) 無法判斷"],
        a: "A",
        r: "根據『快大、慢小』規律，玻璃中的光速最慢，因此在玻璃中的折射角（夾角）必須最小（r2 最小）。水中的光速比玻璃快，所以夾角較大（r1 > r2）。"
    },
    {
        q: "5. 有關「全反射」現象的應用與科學 facts，下列哪一項敘述是錯誤的？",
        opts: ["(A) 光必須從光速慢的介質射向光速快的介質才有可能發生", "(B) 鑽石看起來閃閃發光是因為全反射的緣故", "(C) 現代光纖通訊網路是以玻璃纖維利用全反射傳遞訊號", "(D) 光由空氣射入水中時，只要入射角夠大就會觸發全反射"],
        a: "D",
        r: "全反射只有在光由『慢介質進入快介質』（如水到空氣、玻璃到空氣）且入射角大於臨界角時才會發生。如果光是從空氣進入水中（快到慢），不論入射角拉到多大，都只會發生標準折射，絕對不可能發生全反射！"
    },
    {
        q: "6. 小華在游泳池底往下看，看見池底有一顆漂亮的石頭。若小華想用魚叉精準刺中這顆石頭，他應該瞄準哪裡？",
        opts: ["(A) 正確瞄準他所看到的石頭位置", "(B) 瞄準他所看到的石頭位置的稍後方", "(C) 瞄準他所看到的石頭位置的稍微上方", "(D) 瞄準他所看到的石頭位置的稍微下方"],
        a: "D",
        r: "因為光的折射，水底物體反射的光線出水面時偏離法線，使得岸上的人看到的虛像比實際位置還要『高、淺』。所以真正的石頭是在看到的影像的『下方』，魚叉必須往下方瞄準才能刺中！"
    },
    {
        q: "7. 凸透鏡可以將太陽光匯聚於一點，這是利用了光的哪一種特性？",
        opts: ["(A) 光的直線傳播", "(B) 光的反射原理", "(C) 光經過曲面透鏡所發生的折射原理", "(D) 光的散射現象"],
        a: "C",
        r: "透鏡（不論凸透鏡或凹透鏡）都是透明的介質，光線穿過鏡片時會在前後兩個曲面上各發生一次折射。凸透鏡因為中央厚、邊緣薄，能使平行光線向中央軸線折射匯聚。"
    },
    {
        q: "8. 當一束紅光與一束藍光以相同的入射角斜斜射入同一塊玻璃磚中。已知藍光在玻璃中的光速比紅光還要慢一些。請問哪一種光在玻璃中的偏折程度較大（即折射角較小）？",
        opts: ["(A) 紅光偏折較大", "(B) 藍光偏折較大", "(C) 兩者偏折程度完全相同", "(D) 光速不影響偏折程度"],
        a: "B",
        r: "這是高中分科與國中資優班常考題！光速越慢，折射角越小（快大、慢小）。因為藍光在玻璃中的傳播速度比紅光慢，所以藍光的折射角較小。折射角越小，代表它偏離原前進直線的幅度『偏折得越厲害』！"
    },
    {
        q: "9. 電影中常看到沙漠中出現海市蜃樓的奇景，看見遠處有清澈的水面，走近一看卻是一場空。請問海市蜃樓的成因主要是因為什麼？",
        opts: ["(A) 沙漠空氣中水氣太多產生的反射", "(B) 大氣層高低空因為溫度不同，導致空氣密度與光速不同而產生的連續折射與全反射", "(C) 陽光太強導致眼睛產生的視網膜錯覺", "(D) 光線在沙粒表面發生的漫反射"],
        a: "B",
        r: "海市蜃樓是地科與理化的跨科經典現象。靠近沙漠地面的空氣溫度極高、密度小、光速快；高空空氣冷、密度大、光速慢。光線由高空往下傳播時（慢到快），會產生連續折射偏離法線，最後在接近地面處觸發全反射向上折回，讓人眼誤以為地面有天空的倒影。"
    },
    {
        q: "10. 如果我們在實驗室中，將一束光線由水底射向空氣，逐漸調大入射角。請問在畫面上會依序觀察到什麼現象？",
        opts: ["(A) 折射角逐漸變小，最後消失", "(B) 折射角逐漸變大，直到折射光線貼平介面（折射角90°），之後折射光消失，只剩下反射光", "(C) 光線直接穿透，沒有任何改變", "(D) 入射角永遠等於折射角"],
        a: "B",
        r: "當慢到快時，折射角大於入射角。隨著入射角調大，折射角會先達到 90°（貼平介面，此時的入射角稱為臨界角）。一旦入射角超越臨界角，折射光完全消失，所有能量反射回水中，達成全反射！"
    }
];

let currentQuizIndex = 0;

function initQuiz() {
    currentQuizIndex = 0;
    renderQuiz();
}

function renderQuiz() {
    const qItem = quizData[currentQuizIndex];
    document.getElementById('quiz-q').textContent = qItem.q;

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
        feedbackEl.innerHTML = `<strong>🟢 回答正確！觀念非常清晰！</strong><br>${qItem.r}`;
    } else {
        feedbackEl.className = "quiz-feedback wrong";
        feedbackEl.innerHTML = `<strong>🔴 回答錯誤（正確解析請看 ${qItem.a}）</strong><br>${qItem.r}`;
    }

    document.getElementById('btn-next-quiz').classList.remove('hidden');
}

document.getElementById('btn-next-quiz').onclick = function () {
    currentQuizIndex++;
    if (currentQuizIndex >= quizData.length) currentQuizIndex = 0;
    renderQuiz();
};

function tick() {
    if (isPlaying) {
        drawScene();
    }
    requestAnimationFrame(tick);
}

window.onresize = resizeCanvas;
window.onload = () => {
    resizeCanvas();
    updateInterface();
    drawScene();
    initQuiz();
    requestAnimationFrame(tick);
};