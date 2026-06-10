// 修正點一：對齊 HTML 的 Canvas ID「windCanvas」，解決動畫不流動的問題
const canvas = document.getElementById('windCanvas');
const ctx = canvas.getContext('2d');

let isRotating = true;       
let seasonalShiftY = 0;      
let currentSeason = 'equinox'; 

let windParticles = [];
const PARTICLE_COUNT = 300; 

// 修正點二：完整寫入 10 題地科題目，並嚴格遵循您指定的排版換行格式
const quizData = [
    {
        q: "大氣環流的形成受多種地球物理因素主導。若僅考慮「太陽輻射在各緯度受熱不均（熱力因素）」而完全不考慮地球自轉，全球的大氣環流特徵最可能為下列何者？",
        opts: [
            "A 赤道氣流上升，一路流向極地降落，形成南北半球各一個大型對流圈",
            "B 因缺乏自轉，全球大氣將呈現靜止狀態，無任何風帶或對流存在",
            "C 在地表仍會分裂出赤道低壓帶、副熱帶高壓帶等七個氣壓帶",
            "D 中緯度地區仍會吹盛行西風，且風向完全為正西風"
        ],
        ans: 0,
        msg: "正確！不考慮自轉就沒有科氏力，赤道受熱上升的氣流會直接向極地推進，在極地冷卻下沉後由地表回流，形成簡單的單圈環流。"
    },
    {
        q: "關於行星風系中「三圈環流」各氣壓帶的成因分類，下列哪一組氣壓帶的成因完全相同，皆屬於「動力因素」？",
        opts: [
            "A 副熱帶高壓帶、副極地低壓帶",
            "B 赤道低壓帶、極地高壓帶",
            "C 赤道低壓帶、副極地低壓帶",
            "D 副熱帶高壓帶、極地高壓帶"
        ],
        ans: 0,
        msg: "完全正確！副熱帶高壓由高空氣流堆積下沉而成，副極地低壓由冷暖氣團交會輻合抬升而成（極鋒），兩者皆為動力學機制所致。"
    },
    {
        q: "科氏力是行星風系風向偏轉的關鍵。假設某天地球的自轉速度突然「加倍」，在其他條件不變下，關於科氏力與風帶的預測下列何者最合理？",
        opts: [
            "A 科氏力效應增強，地表風向沿前進方向偏轉的角度會變大",
            "B 赤道上的科氏力將由零轉為最大值，使赤道無風帶消失",
            "C 科氏力的大小在各緯度皆相同，不再隨緯度增加而增大",
            "D 南半球風向偏轉方向將改變，從向左偏改為向右偏"
        ],
        ans: 0,
        msg: "答對了！自轉加倍時科氏力增加，風向偏轉更顯著。而赤道上緯度為0，科氏力永遠保持為零。"
    },
    {
        q: "某探險隊開船從北緯 50° 出發，一路向南航行至南緯 50°。若僅考慮理想的行星風系分佈，他們沿途所經歷的地表盛行風向順序應為何？",
        opts: [
            "A 西風 ➔ 東北信風 ➔ 東南信風 ➔ 西風",
            "B 東風 ➔ 東北信風 ➔ 東南信風 ➔ 東風",
            "C 西風 ➔ 西南信風 ➔ 西北信風 ➔ 西風",
            "D 東風 ➔ 西南信風 ➔ 西北信風 ➔ 東風"
        ],
        ans: 0,
        msg: "賓果！50°N屬中緯度西風帶；0°~30°N吹東北信風；跨越赤道後，0°~30°S吹東南信風；50°S則再度進入西風帶。"
    },
    {
        q: "「氣壓帶季移」是地科學測高頻考點。當北半球正值「夏至」時，關於全球氣壓帶與風帶的位置變化，下列敘述何者正確？",
        opts: [
            "A 因太陽直射北回歸線，全球的氣壓帶與風帶皆會集體向北移動",
            "B 間熱帶輻合區 (ITCZ) 會移動到南半球，引發南半球夏季大雨",
            "C 北半球的副熱帶高壓帶會往南移動，靠近赤道",
            "D 太陽直射點移動速度極快，大氣環流慣性大，因此風帶完全不會移動"
        ],
        ans: 0,
        msg: "答對了！配合口訣「北風北移，南風南移」。夏至時地表熱量核心北移，導致全球行星風系整體往北幾何緯度推移。"
    },
    {
        q: "下表為某島嶼一年中兩個不同月份的主導風向與氣候特徵。判斷該島嶼最可能位於全球行星風系的哪一個緯度區間？\n1月：盛行西風 / 溫和多雨\n7月：副熱帶高壓控制 / 炎熱乾燥",
        opts: [
            "A 北半球的緯度 30° ~ 40° 之間",
            "B 南半球的緯度 30° ~ 40° 之間",
            "C 赤道附近（緯度 0° ~ 5° 之間）",
            "D 高緯度地區（緯度 60° ~ 70° 之間）"
        ],
        ans: 0,
        msg: "正確！7月(北半球夏季)高壓北移籠罩導致炎熱乾燥；1月(北半球冬季)風帶南移接受西風帶吹拂。此為北半球典型地中海型氣候。"
    },
    {
        q: "間熱帶輻合區（ITCZ）大氣的垂直與水平運動極為劇烈。有關 ITCZ 的大氣物理特徵，下列敘述何者錯誤？",
        opts: [
            "A 此區盛行強類的下沉氣流，因此地表氣壓極高，天氣晴朗乾燥",
            "B 在水平方向上，此處為東北信風與東南信風交會輻合的地帶",
            "C 此區因為水平風力微弱，在航海時代常被稱為「赤道無風帶」",
            "D 其緯度位置並非固定不變，會隨季節在赤道南北兩側往返移動"
        ],
        ans: 0,
        msg: "完全正確！ITCZ是低緯度信風輻合、受熱上升的區域，盛行對流「上升」氣流，地表為低壓多雨，選項A的敘述是錯誤的。"
    },
    {
        q: "臺灣（約北緯 22°~25°）在理想的行星風系架構中，地表應屬於哪一個風帶或氣壓帶？又實際上的氣候主要受什麼因素擾動？",
        opts: [
            "A 副熱帶高壓帶或東北信風帶；主要受海陸分佈引發的季風系統干擾",
            "B 盛行西風帶；主要受高度發達的梅雨鋒面系統干擾",
            "C 赤道低壓帶；主要受強類的科氏力引發的颱風干擾",
            "D 極地東風帶；主要受來自西伯利亞的蒙古高壓冷氣團干擾"
        ],
        ans: 0,
        msg: "太棒了！按緯度臺灣應處於副熱帶高壓或信風帶，但因位處全球最大海陸交界，強烈海陸熱力性質差異形成的「季風」取代了理想風系。"
    },
    {
        q: "大氣環流中的「費雷爾圈（Ferrel Cell）」常被地科界稱為「間接環流圈」。其被冠上「間接」的主要動力學原因為何？",
        opts: [
            "A 它不是由局部的冷熱直接驅動，而是被兩側的哈德里圈與極地圈齒輪狀帶動",
            "B 它的氣流只在海洋上空循環，無法跨越陸地高山阻隔",
            "C 此環流圈內的科氏力剛好為零，氣流不會發生任何偏轉",
            "D 它只存在於北半球，南半球因海洋面積過大而無法形成"
        ],
        ans: 0,
        msg: "好厲害！費雷爾圈在30°相對寒冷處下沉、60°相對溫暖處上升，違反熱力學。它是被兩側熱力對流圈機械式被動帶動的動力環流。"
    },
    {
        q: "航海時代，從歐洲開帆船前往美洲新大陸的船長，通常會刻意將航線「往南壓」至北緯 20° 附近；回程時則會「往北繞」至北緯 40° 附近。這套航海路線精準利用了哪些風帶？",
        opts: [
            "A 去程利用東北信風（向西推進）；回程利用盛行西風（向東推進）",
            "B 去程利用盛行西風（向西推進）；回程利用極地東風（向東推進）",
            "C 去程利用赤道無風帶（順流前進）；回程利用副熱帶高壓（下沉前進）",
            "D 去程利用東南信風（跨越赤道）；回程利用東北信風（順風返回）"
        ],
        ans: 0,
        msg: "完美答對！去程往西走，順著 20°N 的東北信風向西前進；回程往東走，順著 40°N 的中緯度盛行西風向東返航。"
    }
];

let currentQuizIdx = 0;

function resizeCanvas() {
    const rect = canvas.parentElement.getBoundingClientRect();
    canvas.width = rect.width;
    canvas.height = rect.height;
    initParticles();
}

function initParticles() {
    windParticles = [];
    const w = canvas.width;
    const h = canvas.height;

    for (let i = 0; i < PARTICLE_COUNT; i++) {
        const isNorth = Math.random() > 0.5;
        const randVal = Math.random();
        let cellType = 0; 

        if (randVal < 0.45) cellType = 0;
        else if (randVal < 0.8) cellType = 1;
        else cellType = 2;

        let tempColor = '#ef4444'; 
        if (cellType === 1) tempColor = '#a855f7'; 
        if (cellType === 2) tempColor = '#3b82f6'; 

        windParticles.push({
            x: Math.random() * (w * 0.6),
            y: Math.random() * h,
            angle: Math.random() * Math.PI * 2, 
            speed: Math.random() * 0.015 + 0.01,
            age: Math.random() * 100,
            cell: cellType,
            isNorth: isNorth,
            color: tempColor
        });
    }
}

function drawScene() {
    const w = canvas.width;
    const h = canvas.height;
    if (w === 0 || h === 0) return;
    ctx.clearRect(0, 0, w, h);

    const cx = w * 0.35;    
    const cy = h * 0.5;     
    const r = Math.min(w, h) * 0.35;     
    const atmoHeight = 35;  

    if (currentSeason === 'equinox') seasonalShiftY = 0;
    else if (currentSeason === 'solstice-n') seasonalShiftY = -h * 0.05;
    else if (currentSeason === 'solstice-s') seasonalShiftY = h * 0.05;

    // 繪製地球背景球體
    ctx.fillStyle = '#f8fafc';
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#cbd5e1';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    // 繪製緯線
    const latitudes = [0, 30, 60, -30, -60];
    latitudes.forEach(lat => {
        const currentLatY = cy - r * Math.sin((lat * Math.PI) / 180) + seasonalShiftY;
        if (currentLatY > cy - r && currentLatY < cy + r) {
            ctx.strokeStyle = lat === 0 ? 'rgba(239, 68, 68, 0.4)' : 'rgba(148, 163, 184, 0.3)';
            ctx.lineWidth = lat === 0 ? 2 : 1;
            ctx.beginPath();
            const halfWidth = Math.sqrt(r * r - Math.pow(cy - currentLatY, 2));
            ctx.moveTo(cx - halfWidth, currentLatY);
            ctx.lineTo(cx + halfWidth, currentLatY);
            ctx.stroke();
        }
    });

    // 大氣粒子循環與渲染引擎
    windParticles.forEach(p => {
        p.age += 0.15;
        p.angle += p.speed;

        if (!isRotating) {
            let targetLatDeg = p.isNorth ? 45 + Math.sin(p.angle) * 45 : -45 - Math.sin(p.angle) * 45;
            let currentRad = r + (Math.cos(p.angle) * 0.5 + 0.5) * atmoHeight;
            let radAngle = (targetLatDeg * Math.PI) / 180;
            p.x = cx + currentRad * Math.cos(radAngle);
            p.y = cy - currentRad * Math.sin(radAngle) + seasonalShiftY;
        } else {
            let latMin = 0, latMax = 30;
            let direction = p.isNorth ? 1 : -1;

            if (p.cell === 0) {
                latMin = 0; latMax = 30;
                let tLat = latMin + (latMax - latMin) * (0.5 + Math.sin(p.angle) * 0.5);
                let currentRad = r + (Math.cos(p.angle) * 0.5 + 0.5) * atmoHeight;
                let radAngle = (tLat * direction * Math.PI) / 180;
                p.x = cx + currentRad * Math.cos(radAngle);
                p.y = cy - currentRad * Math.sin(radAngle) + seasonalShiftY;
                if (Math.cos(p.angle) < 0) p.x -= p.age * 0.03; 
            } else if (p.cell === 1) {
                latMin = 30; latMax = 60;
                let tLat = latMin + (latMax - latMin) * (0.5 - Math.sin(p.angle) * 0.5);
                let currentRad = r + (Math.cos(p.angle) * 0.5 + 0.5) * atmoHeight;
                let radAngle = (tLat * direction * Math.PI) / 180;
                p.x = cx + currentRad * Math.cos(radAngle);
                p.y = cy - currentRad * Math.sin(radAngle) + seasonalShiftY;
                if (Math.cos(p.angle) > 0) p.x += p.age * 0.04;
            } else {
                latMin = 60; latMax = 90;
                let tLat = latMin + (latMax - latMin) * (0.5 + Math.sin(p.angle) * 0.5);
                let currentRad = r + (Math.cos(p.angle) * 0.5 + 0.5) * atmoHeight;
                let radAngle = (tLat * direction * Math.PI) / 180;
                p.x = cx + currentRad * Math.cos(radAngle);
                p.y = cy - currentRad * Math.sin(radAngle) + seasonalShiftY;
                if (Math.cos(p.angle) < 0) p.x -= p.age * 0.015;
            }
        }

        if (p.x > w || p.x < 0 || p.y > h || p.y < 0 || p.age > 120) {
            p.age = 0;
            p.angle = Math.random() * Math.PI * 2;
            p.x = cx + (r * (Math.random() * 0.3 + 0.8));
            p.y = Math.random() * h;
        }

        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.arc(p.x, p.y, 2.5, 0, Math.PI * 2);
        ctx.fill();
    });

    // 太陽直射線
    ctx.fillStyle = 'var(--accent-gold)';
    ctx.font = 'bold 11px sans-serif';
    ctx.fillText("☀️ 太陽直射點線", cx - r - 105, cy + seasonalShiftY + 4);
    
    ctx.strokeStyle = 'var(--accent-gold)';
    ctx.lineWidth = 1.5;
    ctx.setLineDash([5, 4]);
    ctx.beginPath();
    ctx.moveTo(cx - r - 22, cy + seasonalShiftY);
    ctx.lineTo(cx - r + 12, cy + seasonalShiftY);
    ctx.stroke();
    ctx.setLineDash([]); 

    updateLabelsPosition(cx, cy, r);
}

function updateLabelsPosition(cx, cy, r) {
    const lblItcz = document.getElementById('lbl-itcz');
    const lblSthp = document.getElementById('lbl-sthp');
    const lblHadley = document.getElementById('lbl-hadley-n');
    const lblFerrel = document.getElementById('lbl-ferrel-n');
    const lblPolar = document.getElementById('lbl-polar-n');

    if(!lblItcz) return;

    lblItcz.style.left = `${cx + r + 25}px`;
    lblItcz.style.top = `${cy + seasonalShiftY}px`;

    lblSthp.style.left = `${cx + r + 25}px`;
    lblSthp.style.top = `${cy - r * Math.sin(30 * Math.PI / 180) + seasonalShiftY}px`;

    lblHadley.style.left = `${cx + 15}px`;
    lblHadley.style.top = `${cy - r * 0.28 + seasonalShiftY}px`;

    lblFerrel.style.left = `${cx + 15}px`;
    lblFerrel.style.top = `${cy - r * 0.68 + seasonalShiftY}px`;

    lblPolar.style.left = `${cx + 15}px`;
    lblPolar.style.top = `${cy - r * 0.92 + seasonalShiftY}px`;
}

function updateUI() {
    const zone = document.getElementById('status-zone');
    const tItcz = document.getElementById('td-itcz-status');
    const tMid = document.getElementById('td-mid-lat-status');
    const tCoriolis = document.getElementById('td-coriolis-status');
    const desc = document.getElementById('stage-desc');
    const btnRotation = document.getElementById('btn-toggle-earth-rotation');

    if(!zone) return;

    if (!isRotating) {
        btnRotation.textContent = "🔄 切換為：地球自轉 (分裂三圈環流)";
        btnRotation.classList.remove('rotating');
        zone.textContent = "當前環境：單圈環流模式 (地球不自轉)";
        tItcz.textContent = "單純熱力低壓 / 氣流向北推進";
        tMid.textContent = "無西風 / 純南北向大氣交疊";
        tCoriolis.textContent = "0 (不自轉，無科氏力)";
        desc.textContent = "當地球不自轉時，缺乏科氏力偏轉。赤道高溫膨脹的空氣直接上升並一路流向兩極，冷空氣則在地表流回赤道。全球大氣風場呈現「單一對流圈」狀態。";
    } else {
        btnRotation.textContent = "🔮 切換為：地球不自轉 (回復單圈對流)";
        btnRotation.classList.add('rotating');
        zone.textContent = "當前環境：行星風系三圈環流確立";
        tItcz.textContent = "赤道低壓帶 / 輻合上升氣流";
        tMid.textContent = "盛行西風帶 (Westerlies)";
        tCoriolis.textContent = "2Ω sinφ (隨緯度向兩極遞增)";
        
        let seasonText = "";
        if (currentSeason === 'equinox') seasonText = "【春秋分】：太陽直射赤道，ITCZ 回歸中心赤道線。";
        else if (currentSeason === 'solstice-n') seasonText = "【北半球夏至】：太陽直射北回歸線，全球氣壓帶與行星風帶【集體北移】。";
        else seasonText = "【北半球冬至】：太陽直射南回歸線，全球氣壓帶與行星風帶【集體南移】。";

        desc.innerHTML = `<strong>核心考點：</strong>自轉科氏力將單圈環流切分為哈德里圈、費雷爾圈與極地圈。粒子的<strong>顏色（紅/紫/藍）</strong>精準演繹了溫度差異。${seasonText}`;
    }
}

// 修正點三：全新的 10 題互動式題庫渲染與判定機制
function loadQuiz() {
    const qEl = document.getElementById('quiz-q');
    const optsEl = document.getElementById('quiz-opts');
    const fbEl = document.getElementById('quiz-feedback');
    const nextBtn = document.getElementById('btn-next-quiz');
    const progressEl = document.getElementById('quiz-progress');

    if (!qEl || !optsEl) return;

    fbEl.classList.add('hidden');
    nextBtn.classList.add('hidden');
    optsEl.innerHTML = '';

    progressEl.textContent = `${currentQuizIdx + 1}/10`;
    const currentQuiz = quizData[currentQuizIdx];
    qEl.textContent = currentQuiz.q;

    // 將選項依據您的要求個別生成為單獨一行的按鈕
    currentQuiz.opts.forEach((opt, idx) => {
        const btn = document.createElement('button');
        btn.className = 'opt-btn';
        btn.textContent = opt;
        btn.onclick = () => checkAnswer(idx, btn);
        optsEl.appendChild(btn);
    });
}

function checkAnswer(selectedIdx, clickedBtn) {
    const currentQuiz = quizData[currentQuizIdx];
    const fbEl = document.getElementById('quiz-feedback');
    const nextBtn = document.getElementById('btn-next-quiz');
    const optsButtons = document.querySelectorAll('.opt-btn');

    optsButtons.forEach(btn => btn.disabled = true);

    fbEl.classList.remove('hidden');
    if (selectedIdx === currentQuiz.ans) {
        clickedBtn.classList.add('correct-choice');
        fbEl.className = 'quiz-feedback correct';
        fbEl.innerHTML = `<strong>⭕ 答對了！</strong><br>${currentQuiz.msg}`;
    } else {
        clickedBtn.classList.add('wrong-choice');
        optsButtons[currentQuiz.ans].classList.add('correct-choice');
        fbEl.className = 'quiz-feedback wrong';
        fbEl.innerHTML = `<strong>❌ 答錯囉！</strong><br>${currentQuiz.msg}`;
    }

    nextBtn.classList.remove('hidden');
}

document.getElementById('btn-next-quiz').onclick = function() {
    currentQuizIdx = (currentQuizIdx + 1) % quizData.length;
    loadQuiz();
};

function animLoop() {
    drawScene();
    requestAnimationFrame(animLoop);
}

// 頂部按鈕事件綁定
document.getElementById('season-equinox').onclick = function() { changeSeason('equinox', this); };
document.getElementById('season-solstice-n').onclick = function() { changeSeason('solstice-n', this); };
document.getElementById('season-solstice-s').onclick = function() { changeSeason('solstice-s', this); };

function changeSeason(season, btnEl) {
    currentSeason = season;
    document.querySelectorAll('.control-panel .btn').forEach(b => b.classList.remove('active'));
    btnEl.classList.add('active');
    updateUI();
}

document.getElementById('btn-toggle-earth-rotation').onclick = function() {
    isRotating = !isRotating;
    updateUI();
};

document.getElementById('btn-reset').onclick = function() {
    isRotating = true;
    currentSeason = 'equinox';
    document.querySelectorAll('.control-panel .btn').forEach(b => b.classList.remove('active'));
    document.getElementById('season-equinox').classList.add('active');
    initParticles();
    updateUI();
};

window.addEventListener('resize', resizeCanvas);
window.addEventListener('DOMContentLoaded', () => {
    resizeCanvas();
    updateUI();
    loadQuiz(); // 正確在 DOM 載入後啟動 10 題隨堂測驗系統
    animLoop(); // 開啟流體畫布動畫循環
});