const canvas = document.getElementById('meiosisCanvas');
const ctx = canvas.getContext('2d');

// 0:間期, 1:前期, 2:減I中後, 3:減I末(雙細胞), 4:減II中後, 5:減II末(四細胞)
let currentStage = 0; 
let isCrossoverTriggered = false; 
let animProgress = 0;

const stageDetails = [
    { text: "間期（DNA複製）", n: "2n (成對)", c: "4C", desc: "【步驟0】分裂前準備：細胞正在進行 DNA 複製。此時遺傳物質總量已經翻倍囉！" },
    { text: "第一次分裂前期（同源染色體靠攏）", n: "2n (成對)", c: "4C", desc: "【步驟1】同源染色體手牽手：來自父母的同源染色體成雙成對緊密靠攏。此時可點擊上方按鈕模擬基因重組！" },
    { text: "第一次分裂中後期（同源染色體分離）", n: "2n → n", c: "4C", desc: "【步驟2】第一次分裂：紡錘絲發動！成對的**『同源染色體』被拆散分離**，分別拉向細胞兩端。這是數目減半的關鍵！" },
    { text: "第一次分裂末期（形成兩個子細胞）", n: "n (單套)", c: "2C", desc: "【步驟3】完成首輪分裂：細胞從中央凹陷拆成兩個細胞。此時染色體已沒有成對，套數減半（2n → n）。" },
    { text: "第二次分裂中後期（姊妹分體分離）", n: "n (單套)", c: "2C", desc: "【步驟4】第二次分裂：各染色體在兩個細胞內整隊排好。隨後，黏在一起的**『姊妹染色分體』被拉開拆散**。" },
    { text: "第二次分裂末期（完全形成四個生殖細胞）", n: "n (單套)", c: "C", desc: "【步驟5】大功告成：兩個細胞再次發生凹陷縊裂，**最終分裂成 4 個獨立的生殖細胞（配子）**！每個細胞均精準分到一條染色體。" }
];

function resizeCanvas() {
    const rect = canvas.parentElement.getBoundingClientRect();
    canvas.width = rect.width * window.devicePixelRatio;
    canvas.height = rect.height * window.devicePixelRatio;
    ctx.scale(window.devicePixelRatio, window.devicePixelRatio);
}

// 高階單臂/雙臂染色體繪製器（支援尾端基因互換膚色變更）
function drawChromaArm(x, y, length, angle, radius, baseColor, tipColor = null) {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(angle);
    
    if (!tipColor) {
        // 單一顏色染色體
        ctx.fillStyle = baseColor;
        ctx.beginPath(); ctx.rect(-radius, 0, radius * 2, length); ctx.fill();
        ctx.beginPath(); ctx.arc(0, length, radius, 0, Math.PI * 2); ctx.fill();
    } else {
        // 帶有重組互換片段的染色體（前段原色，後段互換色）
        const seg = length * 0.65;
        ctx.fillStyle = baseColor;
        ctx.beginPath(); ctx.rect(-radius, 0, radius * 2, seg); ctx.fill();
        
        ctx.fillStyle = tipColor;
        ctx.beginPath(); ctx.rect(-radius, seg, radius * 2, length - seg); ctx.fill();
        ctx.beginPath(); ctx.arc(0, length, radius, 0, Math.PI * 2); ctx.fill();
    }
    ctx.restore();
}

// 嚴謹的細胞邊界渲染器：支援動態雙細胞分裂成四細胞
function drawCellBoundaries(cx, cy, p) {
    ctx.strokeStyle = 'rgba(0, 255, 200, 0.25)';
    ctx.lineWidth = 3;

    if (currentStage <= 2) {
        ctx.beginPath(); ctx.arc(cx, cy, 140, 0, Math.PI * 2); ctx.stroke();
    } else if (currentStage === 3) {
        ctx.beginPath(); ctx.arc(cx, cy - 75, 70, 0, Math.PI * 2); ctx.stroke();
        ctx.beginPath(); ctx.arc(cx, cy + 75, 70, 0, Math.PI * 2); ctx.stroke();
    } else if (currentStage === 4) {
        ctx.beginPath(); ctx.arc(cx, cy - 80, 65, 0, Math.PI * 2); ctx.stroke();
        ctx.beginPath(); ctx.arc(cx, cy + 80, 65, 0, Math.PI * 2); ctx.stroke();
    } else if (currentStage === 5) {
        let offsetX = p * 45; 
        ctx.beginPath(); ctx.arc(cx - offsetX, cy - 80, 42, 0, Math.PI * 2); ctx.stroke();
        ctx.beginPath(); ctx.arc(cx + offsetX, cy - 80, 42, 0, Math.PI * 2); ctx.stroke();
        ctx.beginPath(); ctx.arc(cx - offsetX, cy + 80, 42, 0, Math.PI * 2); ctx.stroke();
        ctx.beginPath(); ctx.arc(cx + offsetX, cy + 80, 42, 0, Math.PI * 2); ctx.stroke();
    }
}

function drawScene() {
    const w = canvas.width / window.devicePixelRatio;
    const h = canvas.height / window.devicePixelRatio;
    const cx = w / 2;
    const cy = h / 2;

    ctx.clearRect(0, 0, w, h);

    if (animProgress < 1) animProgress += 0.04; // 調慢動畫，讓演繹更具教學效果
    if (animProgress > 1) animProgress = 1;

    const colorFather = '#00a3ff'; // 藍
    const colorMother = '#ff3377'; // 紅
    const radius = 7;
    const armLen = 26;

    // 1. 繪製細胞外圈
    drawCellBoundaries(cx, cy, animProgress);

    // 2. 染色體與動態軌跡渲染
    ctx.shadowBlur = 4;
    
    if (currentStage === 0) {
        // 間期：絲狀未定型
        ctx.lineWidth = 3; ctx.shadowColor = colorFather; ctx.strokeStyle = colorFather;
        ctx.beginPath(); ctx.moveTo(cx - 25, cy - 15); ctx.bezierCurveTo(cx - 5, cy - 35, cx - 35, cy + 15, cx - 15, cy + 30); ctx.stroke();
        ctx.shadowColor = colorMother; ctx.strokeStyle = colorMother;
        ctx.beginPath(); ctx.moveTo(cx + 15, cy - 25); ctx.bezierCurveTo(cx + 35, cy - 5, cx + 5, cy + 25, cx + 25, cy + 15); ctx.stroke();
    } 
    else if (currentStage === 1 || currentStage === 2) {
        // 減I：同源染色體並排與分離
        let sepY = 0; if (currentStage === 2) sepY = animProgress * 55;

        // 上方（父系藍底）
        const fX = cx, fY = cy - 20 - sepY;
        const tipR = isCrossoverTriggered ? colorMother : colorFather;
        drawChromaArm(fX, fY, armLen, -Math.PI/6, radius, colorFather);
        drawChromaArm(fX, fY, armLen, -Math.PI/1.2, radius, colorFather);
        drawChromaArm(fX, fY, armLen, Math.PI/6, radius, colorFather);
        drawChromaArm(fX, fY, armLen, Math.PI/1.2, radius, colorFather, tipR); // 有重組則右下臂帶紅尾巴
        ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(fX, fY, 3, 0, Math.PI*2); ctx.fill();

        // 下方（母系紅底）
        const mX = cx, mY = cy + 20 + sepY;
        const tipL = isCrossoverTriggered ? colorFather : colorMother;
        drawChromaArm(mX, mY, armLen, -Math.PI/6, radius, colorMother, tipL); // 有重組則左上臂帶藍尾巴
        drawChromaArm(mX, mY, armLen, -Math.PI/1.2, radius, colorMother);
        drawChromaArm(mX, mY, armLen, Math.PI/6, radius, colorMother);
        drawChromaArm(mX, mY, armLen, Math.PI/1.2, radius, colorMother);
        ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(mX, mY, 3, 0, Math.PI*2); ctx.fill();
    }
    else if (currentStage === 3) {
        // 減I末期：雙細胞靜態期
        const tipR = isCrossoverTriggered ? colorMother : colorFather;
        drawChromaArm(cx, cy - 75, armLen, -Math.PI/4, radius, colorFather);
        drawChromaArm(cx, cy - 75, armLen, Math.PI/4, radius, colorFather, tipR);
        ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(cx, cy - 75, 3, 0, Math.PI*2); ctx.fill();

        const tipL = isCrossoverTriggered ? colorFather : colorMother;
        drawChromaArm(cx, cy + 75, armLen, -Math.PI/4, radius, colorMother, tipL);
        drawChromaArm(cx, cy + 75, armLen, Math.PI/4, radius, colorMother);
        ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(cx, cy + 75, 3, 0, Math.PI*2); ctx.fill();
    }
    else if (currentStage === 4) {
        // 減II 中期：姊妹分體在各自細胞中央橫向排好，並被拉開
        let sepX = animProgress * 25; 

        // 上細胞解離（純藍 vs 帶紅尾藍）
        const tipR = isCrossoverTriggered ? colorMother : colorFather;
        drawChromaArm(cx - sepX, cy - 80, armLen, Math.PI, radius - 1, colorFather);
        drawChromaArm(cx + sepX, cy - 80, armLen, 0, radius - 1, colorFather, tipR);
        
        // 下細胞解離（帶藍尾紅 vs 純紅）
        const tipL = isCrossoverTriggered ? colorFather : colorMother;
        drawChromaArm(cx - sepX, cy + 80, armLen, Math.PI, radius - 1, colorMother, tipL);
        drawChromaArm(cx + sepX, cy + 80, armLen, 0, radius - 1, colorMother);
    }
    else if (currentStage === 5) {
        // 【完全重構】減II 末期：染色體完全同步鎖定在 4 個新細胞的幾何圓心！
        let offsetX = animProgress * 45;
        const tipR = isCrossoverTriggered ? colorMother : colorFather;
        const tipL = isCrossoverTriggered ? colorFather : colorMother;

        // 左上細胞中心：純藍單體
        drawChromaArm(cx - offsetX, cy - 80, armLen, Math.PI/2, radius - 1, colorFather);
        // 右上細胞中心：重組藍單體（帶紅尾）
        drawChromaArm(cx + offsetX, cy - 80, armLen, Math.PI/2, radius - 1, colorFather, tipR);
        // 左下細胞中心：重組紅單體（帶藍尾）
        drawChromaArm(cx - offsetX, cy + 80, armLen, Math.PI/2, radius - 1, colorMother, tipL);
        // 右下細胞中心：純紅單體
        drawChromaArm(cx + offsetX, cy + 80, armLen, Math.PI/2, radius - 1, colorMother);
    }

    ctx.shadowBlur = 0;
    requestAnimationFrame(drawScene);
}

document.getElementById('slider-stage').oninput = function() {
    currentStage = parseInt(this.value);
    animProgress = 0; 
    const details = stageDetails[currentStage];
    document.getElementById('stage-text').textContent = details.text;
    document.getElementById('lbl-chrom-n').textContent = details.n;
    document.getElementById('lbl-dna-c').textContent = details.c;
    document.getElementById('status-desc').innerHTML = details.desc;
};

document.getElementById('btn-crossover').onclick = function() {
    if (currentStage === 1) {
        isCrossoverTriggered = true;
        alert("💥 混合完成！非姊妹染色分體交換了部分基因，這就是為什麼你和親兄弟姊妹長得不會一模一樣的原因喔！");
    } else {
        alert("⚠️ 請先將滑桿拉到階段 1（同源染色體靠攏時），才能進行基因重組喔！");
    }
};

// --- 精選 10 題：國中會考生物科核心題庫系統 ---
const quizData = [
    {
        q: "1. 人類的「肌肉細胞」與「精子」內，所含有的染色體數量分別應該是多少條？",
        opts: ["(A) 46條、46條", "(B) 23條、23條", "(C) 46條、23條", "(D) 23條、46條"],
        a: "C",
        r: "肌肉細胞屬於體細胞，含有成對的完整染色體（共 46 條）；精子屬於生殖細胞，經過減數分裂後染色體數目減半，只有單套的 23 條。"
    },
    {
        q: "2. 關於「有絲細胞分裂」與「減數分裂」的對比，下列哪一項敘述是完全正確的？",
        opts: ["(A) 兩者都會使染色體數目減半", "(B) 兩者的遺傳物質（DNA）都只有複製一次", "(C) 細胞分裂需要分裂兩次", "(D) 減數分裂最終會產生兩個子細胞"],
        a: "B",
        r: "大重點！不論是細胞分裂還是減數分裂，遺傳物質（DNA）都只在間期複製「1次」。細胞分裂會分裂 1 次產生 2 細胞；減數分裂則分裂 2 次產生 4 細胞。"
    },
    {
        q: "3. 小明在顯微鏡下觀察某種正在分裂的黑猩猩細胞，發現「成雙成對的同源染色體正在互相分離、移向兩極」。請問這個細胞正在進行什麼分裂？",
        opts: ["(A) 減數分裂第一次分裂", "(B) 減數分裂第二次分裂", "(C) 一般的體細胞分裂", "(D) 遺傳物質複製"],
        a: "A",
        r: "只要看到「同源染色體分離」（成對的被拆散），就絕對是減數分裂的第一次分裂（減 I）。有絲分裂和減 II 拆散的都是姊妹染色分體。"
    },
    {
        q: "4. 青蛙的體細胞內含有 26 條染色體。當牠的原始生殖細胞完成減數分裂後，所產生的卵細胞內，染色體的基本型態呈現什麼狀態？",
        opts: ["(A) 13對，成雙成對", "(B) 26條，成雙成對", "(C) 13條，單套不成對", "(D) 26條，單套不成對"],
        a: "C",
        r: "卵細胞是生殖細胞（單套 n），26 條減半後是 13 條。既然是單套，細胞內的染色體彼此形狀大小都不同，是不成對的。"
    },
    {
        q: "5. 某種植物的葉片細胞具有 12 對染色體。請問該植物的「花粉粒（內含精細胞）」內有幾條染色體？",
        opts: ["(A) 12條", "(B) 24條", "(C) 6條", "(D) 6對"],
        a: "A",
        r: "葉片細胞是體細胞，有 12 對（等於 24 條）染色體。花粉粒內的精細胞是生殖細胞（單套 n），數目減半。24 條減半就是 12 條（不可以說是 6 對，因為沒有成對）。"
    },
    {
        q: "6. 減數分裂之所以被稱為「減數」，是因為分裂後子細胞內的染色體數目減半。請問這個染色體數目減半的現象，發生在什麼時候？",
        opts: ["(A) DNA進行複製時", "(B) 第一次分裂完成，形成兩個子細胞時", "(C) 第二次分裂完成，形成四個子細胞時", "(D) 精子與卵結合受精時"],
        a: "B",
        r: "會考超常考！染色體數目是在「第一次分裂完成時」就由 2n 減半為 n。第二次分裂只是把複製好的姊妹分體拉開，數目維持 n 不變。"
    },
    {
        q: "7. 水蜜桃的果肉細胞含有 16 條染色體。小明吃了一個甜美的水蜜桃並把種子種下。請問該水蜜桃的「種皮細胞選項」與種子內的「胚細胞」，其染色體數目分別為多少？",
        opts: ["(A) 8條、16條", "(B) 16條、16條", "(C) 16條、8條", "(D) 8條、8條"],
        a: "B",
        r: "果肉細胞、種皮細胞都是母體的一部分，屬於體細胞（16條）。而種子內的「胚細胞」是由精細胞和卵細胞受精結合而來的（8+8），所以也是體細胞（16條）。兩者都是 16 條！"
    },
    {
        q: "8. 媽媽生下了一對龍鳳胎（一男一女的雙胞胎）。從生物學的角度來看，關於這對雙胞胎的形成，下列敘述何者最合理？",
        opts: ["(A) 由同一個受精卵分裂而成", "(B) 由兩個精子與同一個卵細胞結合而成", "(C) 由兩個精子分別與兩個卵細胞結合而成", "(D) 媽媽進行細胞分裂時發生異常"],
        a: "C",
        r: "性別不同（一男一女）一定是「異卵雙胞胎」。也就是由媽媽排出兩個不同的卵，分別與爸爸的兩個精子受精（兩個受精卵），基因組合也完全不同。"
    },
    {
        q: "9. 請問生物透過「減數分裂」並進行「有性生殖」，在演化上最大的優勢是什麼？",
        opts: ["(A) 能夠在短時間內複製出大量外觀相同的後代", "(B) 可以百分之百保留親代最優良的特徵", "(C) 能讓後代產生各種不同的基因組合，增加適應環境的機會", "(D) 消耗的能量比無性生殖少很多"],
        a: "C",
        r: "減數分裂時基因會重新組合（如動畫中的分離與互換）。有性生殖產生的後代表現型多樣，當環境發生劇烈變動時，總會有部分個體能適應活下來！"
    },
    {
        q: "10. 如果用大寫「N」代表細胞內染色體套數。下列人類的哪一種細胞內，其染色體套數標記是錯誤的？",
        opts: ["(A) 卵細胞 ── 1N", "(B) 受精卵 ── 2N", "(C) 口腔上皮細胞 ── 2N", "(D) 成熟的紅血球細胞 ── 2N"],
        a: "D",
        r: "這是一題高難度陷阱題！人類成熟的紅血球細胞內部「沒有細胞核」，因此裡面根本沒有染色體（0N）。這個大考常客要特別注意喔！"
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
        feedbackEl.innerHTML = `<strong>🟢 答對了！太厲害了！</strong><br>${qItem.r}`;
    } else {
        feedbackEl.className = "quiz-feedback wrong";
        feedbackEl.innerHTML = `<strong>🔴 答錯囉（答案選 ${qItem.a}）</strong><br>${qItem.r}`;
    }

    document.getElementById('btn-next-quiz').classList.remove('hidden');
}

document.getElementById('btn-next-quiz').onclick = function () {
    currentQuizIndex++;
    if (currentQuizIndex >= quizData.length) currentQuizIndex = 0;
    renderQuiz();
};

window.onresize = resizeCanvas;
window.onload = () => {
    resizeCanvas();
    drawScene();
    initQuiz();
};