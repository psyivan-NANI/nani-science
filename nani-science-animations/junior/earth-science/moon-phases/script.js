const canvas = document.getElementById('moonCanvas');
const ctx = canvas.getContext('2d');

let lunarDate = 15; // 預設農曆十五 (滿月)

function resizeCanvas() {
    const rect = canvas.parentElement.getBoundingClientRect();
    canvas.width = rect.width * window.devicePixelRatio;
    canvas.height = rect.height * window.devicePixelRatio;
    ctx.scale(window.devicePixelRatio, window.devicePixelRatio);
}

// 根據天體幾何公式流暢繪製雙視角聯動（全面修正為太陽光由右側射入）
function drawScene() {
    const w = canvas.width / window.devicePixelRatio;
    const h = canvas.height / window.devicePixelRatio;

    ctx.clearRect(0, 0, w, h);

    // 【地科嚴謹幾何代數定義】
    // 農曆初一(朔)：月球在地球與太陽之間，即右側，角度為 0
    // 農曆初八(上弦)：月球公轉到地球正上方，角度為 Math.PI / 2 (90度)
    // 農曆十五(望)：月球在地球左側，角度為 Math.PI (180度)
    // 農曆二十二(下弦)：月球在地球正下方，角度為 Math.PI * 1.5 (270度)
    const angle = ((lunarDate - 1) / 29.53) * Math.PI * 2;

    // --- 區塊一：左側「太空俯視圖幾何」 (佔據左半邊) ---
    const sCx = w * 0.26;
    const sCy = h * 0.5;
    const orbitRadius = 70;

    // 繪製從右側射入的平行太陽光指示線
    ctx.strokeStyle = 'rgba(255, 170, 0, 0.2)';
    ctx.lineWidth = 1.5;
    for (let i = -5; i <= 5; i++) {
        ctx.beginPath();
        ctx.moveTo(sCx + orbitRadius + 50, sCy + i * 22);
        ctx.lineTo(sCx + orbitRadius + 15, sCy + i * 22);
        // 畫箭頭符號
        ctx.moveTo(sCx + orbitRadius + 22, sCy + i * 22 - 4);
        ctx.lineTo(sCx + orbitRadius + 15, sCy + i * 22);
        ctx.lineTo(sCx + orbitRadius + 22, sCy + i * 22 + 4);
        ctx.stroke();
    }

    // 繪製月球公轉軌道虛線（圓心為地球）
    ctx.strokeStyle = 'rgba(0, 210, 255, 0.25)';
    ctx.lineWidth = 1.2;
    ctx.setLineDash([4, 4]);
    ctx.beginPath();
    ctx.arc(sCx, sCy, orbitRadius, 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]);

    // 繪製中央地球（右側面光為藍色亮面，左側背光為暗面）
    ctx.save();
    ctx.translate(sCx, sCy);
    // 亮面（右半球）
    ctx.fillStyle = '#2563eb';
    ctx.beginPath();
    ctx.arc(0, 0, 18, -Math.PI * 0.5, Math.PI * 0.5);
    ctx.fill();
    // 暗面（左半球）
    ctx.fillStyle = '#1e293b';
    ctx.beginPath();
    ctx.arc(0, 0, 18, Math.PI * 0.5, Math.PI * 1.5);
    ctx.fill();

    // 【地科關鍵動態圖層】：地表觀測者指針（頭頂朝向天頂，代表隨著地球自轉看月球的方向）
    // 讓觀測者指針永遠對準月球，藉此模擬「正值中午/黃昏/半夜/清晨」的觀測視角
    ctx.rotate(angle); 
    ctx.strokeStyle = '#00ffcc';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(26, 0); // 朝向月球的視線
    ctx.stroke();
    ctx.fillStyle = '#00ffcc';
    ctx.beginPath();
    ctx.arc(26, 0, 3, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    // 計算月球在太空中的標準逆時針公轉座標
    const mX = sCx + orbitRadius * Math.cos(angle);
    const mY = sCy - orbitRadius * Math.sin(angle); // 減號確保逆時針向上公轉

    // 繪製公轉月球（在太空俯視圖中，無論到哪裡，永遠是右亮左暗！）
    ctx.save();
    ctx.translate(mX, mY);
    ctx.fillStyle = '#ffee55'; // 右側亮面
    ctx.beginPath();
    ctx.arc(0, 0, 9, -Math.PI * 0.5, Math.PI * 0.5);
    ctx.fill();
    ctx.fillStyle = '#334155'; // 左側暗面
    ctx.beginPath();
    ctx.arc(0, 0, 9, Math.PI * 0.5, Math.PI * 1.5);
    ctx.fill();
    // 描邊以便辨識圓廓
    ctx.strokeStyle = 'rgba(255,255,255,0.2)';
    ctx.lineWidth = 0.5;
    ctx.beginPath(); ctx.arc(0, 0, 9, 0, Math.PI*2); ctx.stroke();
    ctx.restore();


    // --- 區塊二：右側「人眼夜空主觀視角月相」 (佔據右半邊) ---
    const vCx = w * 0.74;
    const vCy = h * 0.5;
    const vRadius = 65; // 主視角大月球半徑

    // 背景星空裝飾微光圈
    ctx.fillStyle = 'rgba(255,255,255,0.02)';
    ctx.beginPath(); ctx.arc(vCx, vCy, vRadius + 20, 0, Math.PI * 2); ctx.fill();

    ctx.save();
    ctx.translate(vCx, vCy);

    // 預設先鋪滿全黑的月面暗底圓
    ctx.fillStyle = '#111827';
    ctx.beginPath();
    ctx.arc(0, 0, vRadius, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#ffee55'; // 亮面金黃色
    ctx.shadowBlur = 15;
    ctx.shadowColor = 'rgba(255, 238, 85, 0.6)';

    // 使用高階傅立葉餘弦分量，精準渲染東/西側圓缺形狀（完美符合光學投影）
    const cosVal = Math.cos(angle);

    if (angle >= 0 && angle <= Math.PI) {
        // 農曆初一 到 十五（上半月）：月球在太空上方，地表看過去「右側（西側）」是亮面
        // 1. 先畫右半邊半圓亮面
        ctx.beginPath();
        ctx.arc(0, 0, vRadius, -Math.PI * 0.5, Math.PI * 0.5);
        ctx.fill();

        // 2. 透過橢圓投影係數來修正內凹或外凸
        ctx.beginPath();
        ctx.ellipse(0, 0, vRadius * Math.abs(cosVal), vRadius, 0, -Math.PI * 0.5, Math.PI * 0.5);
        if (lunarDate < 8.4) {
            // 新月到上弦月（亮面小於一半）：左側黑影內凹覆蓋右半邊
            ctx.fillStyle = '#111827';
            ctx.fill();
        } else {
            // 上弦月到滿月（亮面大於一半）：亮面朝左側（東側）外凸鼓起
            ctx.fillStyle = '#ffee55';
            ctx.fill();
        }
    } else {
        // 農曆十五 到 三十（下半月）：月球在太空下方，地表看過去「左側（東側）」是亮面
        // 1. 先畫左半邊半圓亮面
        ctx.beginPath();
        ctx.arc(0, 0, vRadius, Math.PI * 0.5, Math.PI * 1.5);
        ctx.fill();

        // 2. 透過下半月橢圓投影係數修正
        ctx.beginPath();
        ctx.ellipse(0, 0, vRadius * Math.abs(cosVal), vRadius, 0, Math.PI * 0.5, Math.PI * 1.5);
        if (lunarDate < 23) {
            // 滿月到下弦月（亮面大於一半）：亮面朝右側（西側）外凸鼓起
            ctx.fillStyle = '#ffee55';
            ctx.fill();
        } else {
            // 下弦月到殘月（亮面小於一半）：右側黑影內凹覆蓋左半邊
            ctx.fillStyle = '#111827';
            ctx.fill();
        }
    }
    
    ctx.restore();
    ctx.shadowBlur = 0;

    // 繪製左右兩視角中央的科學分割線
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.08)';
    ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(w * 0.5, 30); ctx.lineTo(w * 0.5, h - 30); ctx.stroke();
}

// 根據日期時間軸動態更新說明卡與狀態（完全匹配教科書地科名詞描述）
function updateInterface() {
    let name = "";
    let title = "";
    let desc = "";

    if (lunarDate === 1) {
        name = "朔（新月）";
        title = "農曆初一：日・月・地 排成一直線";
        desc = "【潮汐：大潮】此時月球位於日地之間，亮面完全背對地球。月球與太陽同時在**清晨6點升起、黃昏18點落下**，故夜空全黑不可見。";
    } else if (lunarDate > 1 && lunarDate < 8) {
        name = "新眉月";
        title = "農曆初三～初五：亮面逐漸顯現";
        desc = "【潮汐：中潮】月球公轉離開日地直線，從地球看過去，可看見**右側（西側）如鐮刀般的微弱發光弧線**。黃昏時可在西方低空短暫看見。";
    } else if (lunarDate === 8) {
        name = "上弦月";
        title = "農曆初八：日-地-月 連線呈現直角 90°";
        desc = "【潮汐：小潮】觀測者面朝南方，可見**月球右半邊（西側）發亮**。上弦月於**中午12點升起，黃昏18點正值天頂，半夜24點自西方落下**。";
    } else if (lunarDate > 8 && lunarDate < 15) {
        name = "盈凸月";
        title = "農曆初十～十三：亮面超過半圓";
        desc = "【潮汐：中潮】月球持續往地球後方公轉，發光面積越來越大，亮面依然集中在右邊（西側）。黃昏時已高掛在東方天空。";
    } else if (lunarDate === 15) {
        name = "望（滿月）";
        title = "農曆十五：日・地・月 排成一直線";
        desc = "【潮汐：大潮】月球運行到地球正後方，亮面完全朝向地球。**黃昏18點從東方升起，半夜24點高掛天頂，清晨6點自西方落下**，整夜清晰可見。";
    } else if (lunarDate > 15 && lunarDate < 23) {
        name = "虧凸月";
        title = "農曆十七～二十：亮面從右側開始缺損";
        desc = "【潮汐：中潮】過了農曆十五後，月球開始走入下半月軌道。此時**左半邊（東側）保持發亮**，右側西面則開始出現陰影缺損。";
    } else if (lunarDate === 23) {
        name = "下弦月";
        title = "農曆二十三：日-地-月 連線再度呈現直角";
        desc = "【潮汐：小潮】觀測者面朝南方，可見**月球左半邊（東側）發亮**。下弦月於**半夜24點才從東方升起，清晨6點正值天頂，中午12點自西方落下**。";
    } else {
        name = "殘月（殘眉月）";
        title = "農曆二十六～二十八：亮面即將隱沒";
        desc = "【潮汐：中潮】月球繞行即將回到初一位置，只剩下**左側（東側）細細的一縷月牙**。只有在清晨拂曉前的東方低空才能勉強觀測到。";
    }

    document.getElementById('date-text').textContent = `農曆 ${lunarDate} 日 (${name})`;
    document.getElementById('status-title').textContent = title;
    document.getElementById('status-desc').innerHTML = desc;
}

document.getElementById('slider-date').oninput = function () {
    lunarDate = parseInt(this.value);
    updateInterface();
    drawScene();
};

// --- 精選 10 題：國中地科會考【月相與潮汐】核心題庫系統 ---
const quizData = [
    {
        q: "1. 當我們在農曆初八看到「上弦月」高掛天空時，如果不考慮地形阻擋，這時月球的亮面是朝向哪一個方位？",
        opts: ["(A) 東方", "(B) 西方", "(C) 南方", "(D) 北方"],
        a: "B",
        r: "上弦月是農曆上半月的月相，口訣是『上半月亮右邊、亮西側』。因此我們看到的亮面是朝向西方。"
    },
    {
        q: "2. 中秋節（農曆八月十五日）當天，若小明想要欣賞美麗的滿月，請問月亮大約會在什麼時間從什麼方向升起？",
        opts: ["(A) 中午 12 點，東方升起", "(B) 黃昏 18 點，東方升起", "(C) 半夜 24 點，西方升起", "(D) 清晨 6 點，西方升起"],
        a: "B",
        r: "滿月（望）時，日、地、月三者排成直線，月球正好在地球背對太陽的那一側。因此當黃昏 18 點太陽從西方落下時，滿月就會剛好從東方升起，整夜可見。"
    },
    {
        q: "3. 有關於月相變化的敘述，下列哪一項是完全正確的科學事實？",
        opts: ["(A) 月相會變化是因為地球的影子遮住了月球", "(B) 不論月球公轉到哪裡，在太空中它面向太陽的半球永遠是亮的", "(C) 月相變化的週期大約是一天（24小時）", "(D) 下半月的月亮，亮面通常集中在右側"],
        a: "B",
        r: "大考經典陷阱！月球本身不發光，它面向太陽的半球（右半球）在太空中『永遠是全亮的』。我們看到圓缺是因為日地月三者相對位置改變，導致我們在地球上能看到的亮面比例不同。遮住月球的是它自己的暗面，而不是地球的影子（那是月食）。"
    },
    {
        q: "4. 澎湖著名的『奎壁山摩西分海』奇景與潮汐息息相關。請問小明如果想在當月海水漲退潮最明顯的『大潮』當天前往旅遊，他應該選擇農曆的哪一天？",
        opts: ["(A) 農曆初一", "(B) 農曆初八", "(C) 農曆二十二", "(D) 農曆初十"],
        a: "A",
        r: "當農曆初一（朔）和十五（望）時，日、地、月排成一直線，太陽與月球的引力會疊加，此時潮差最大，稱為『大潮』。初八與二十二則為引力抵銷的『小潮』。"
    },
    {
        q: "5. 某天清晨 6 點，小明準備出門上學，一抬頭看見月亮正好高高掛在正頭頂的天頂天空。請問這天的農曆日期大約是幾日？",
        opts: ["(A) 農曆初一", "(B) 農曆初八", "(C) 農曆十五", "(D) 農曆二十三"],
        a: "D",
        r: "下弦月（農曆二十三）在半夜 24 點由東方升起，隨著地球自轉，到了清晨 6 點時正好運行到觀測者的正天頂。中午 12 點從西方落下。因此答案選下弦月。"
    },
    {
        q: "6. 如果我們從『地球北極正上方』俯視整個太陽系與月球公轉軌道。請問月球繞地球公轉的方向以及地球自轉的方向分別為何？",
        opts: ["(A) 月球逆時針公轉、地球順時針自轉", "(B) 月球順時針公轉、地球逆時針自轉", "(C) 兩者皆為逆時針方向", "(D) 兩者皆為順時針方向"],
        a: "C",
        r: "地科必背基本功！從北極俯視，地球自轉、月球公轉、甚至是地球繞太陽公轉，全部都是『逆時針方向』轉動。這個空間概念非常重要！"
    },
    {
        q: "7. 許多詩詞常與地科現象結合。高啟《蛾眉月》詩中提到：『江南孟春正朔後，蛾眉初見映清流。』請問這首詩中所描述的『蛾眉月』亮面形態以及它最可能出現在哪段時間的夜空中？",
        opts: ["(A) 亮左邊，清晨拂曉前", "(B) 亮右邊，清晨拂曉前", "(C) 亮左邊，黃昏入夜後", "(D) 亮右邊，黃昏入夜後"],
        a: "D",
        r: "詩中提到『正朔後』，也就是初一（朔）之後。農曆初三到初五的月相叫做新眉月（蛾眉月），屬於上半月，因此亮面朝右（西側）。因為它跟著太陽後面公轉，所以會在黃昏太陽剛落下時，短暫出現在西方低空。"
    },
    {
        q: "8. 當日、地、月三者的相對位置呈現 90 度垂直狀態（例如地球在中間，太陽在右側，月球在正下方）時，此時地表的觀測者會看到什麼月相？當天海水的潮差又是如何？",
        opts: ["(A) 上弦月、大潮", "(B) 下弦月、小潮", "(C) 上弦月、小潮", "(D) 下弦月、大潮"],
        a: "B",
        r: "當太陽在右側、月球在正下方時，月球在公轉軌道270度的位置，是農曆二十三的『下弦月』。此時日地連線與月地連線垂直，引力互相抵銷，海水潮差最小，稱為『小潮』。"
    },
    {
        q: "9. 住在基隆海邊的小華發現，今天海水最高潮的時間是中午 12:00。依照潮汐遲到的規律，小華如果明天想要在同一個海堤看最高潮，他大約要在明天的什麼時間去才對？",
        opts: ["(A) 中午 12:00", "(B) 中午 12:25", "(C) 下午 12:50", "(D) 下午 13:30"],
        a: "C",
        r: "因為月球繞地球公轉的關係，地表同一地點每天兩次滿潮（高潮）的時間會比前一天『大約延遲 50 分鐘』（每次滿潮約延遲 24~25 分鐘）。所以隔天的滿潮時間會是 12:50 分左右。"
    },
    {
        q: "10. 為什麼我們在地球上不論哪一天看月亮，月亮表面上的『陰影圖案（吳剛伐桂、玉兔搗藥）』看起來永遠是一模一樣的，從來不會轉到背面去？",
        opts: ["(A) 因為月球被地球擋住，根本不會自轉", "(B) 因為月球自轉一圈的時間，剛好等於它繞地球公轉一圈的時間", "(C) 因為月球表面是一面鏡子，反射了地球大陸的形狀", "(D) 因為太陽光永遠只照射到月球的同一面"],
        a: "B",
        r: "這就是著名的『同步自轉（潮汐鎖定）』現象。月球的自轉週期與公轉週期完全相同（都是大約 27.3 天），導致它永遠以同一個面朝向地球。所以我們在地球上永遠看不到月球的背面！"
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
        feedbackEl.innerHTML = `<strong>🟢 回答正確！老師為你感到驕傲！</strong><br>${qItem.r}`;
    } else {
        feedbackEl.className = "quiz-feedback wrong";
        feedbackEl.innerHTML = `<strong>🔴 回答錯誤（正確解法為 ${qItem.a}）</strong><br>${qItem.r}`;
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
    updateInterface();
    drawScene();
    initQuiz();
};