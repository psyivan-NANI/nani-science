const canvas = document.getElementById('photoCanvas');
const ctx = canvas.getContext('2d');
const lightSlider = document.getElementById('light-slider');
const co2Slider = document.getElementById('co2-slider');

let particles = [];
let time = 0;

function resize() {
    const rect = canvas.parentElement.getBoundingClientRect();
    canvas.width = rect.width * window.devicePixelRatio;
    canvas.height = rect.height * window.devicePixelRatio;
    ctx.scale(window.devicePixelRatio, window.devicePixelRatio);
}

class Particle {
    constructor(type) {
        this.reset(type);
    }
    reset(type) {
        this.type = type; // 'water', 'light', 'oxygen', 'co2', 'sugar', 'energy'
        this.life = 0;
        this.speed = 1 + Math.random();
        
        if (type === 'water') { this.x = 100; this.y = 400; this.targetY = 250; }
        if (type === 'light') { this.x = 50; this.y = 50; this.targetX = 180; this.targetY = 200; }
        if (type === 'co2') { this.x = 400; this.y = 400; this.targetY = 250; }
    }
    update(rate) {
        this.life += 0.01 * rate;
        if (this.type === 'water') { this.y -= this.speed * rate; if (this.y < 250) this.reset('oxygen'); }
        if (this.type === 'oxygen') { this.y -= this.speed * rate; this.x += 1; if (this.y < 50) this.reset('water'); }
        if (this.type === 'light') { this.x += 2 * rate; this.y += 2 * rate; if (this.x > 180) this.reset('light'); }
        if (this.type === 'co2') { this.y -= this.speed * rate; if (this.y < 250) this.reset('sugar'); }
        if (this.type === 'sugar') { this.x += this.speed * rate; if (this.x > 600) this.reset('co2'); }
    }
    draw() {
        ctx.beginPath();
        if (this.type === 'water') ctx.fillStyle = '#38bdf8';
        else if (this.type === 'oxygen') ctx.fillStyle = '#f87171';
        else if (this.type === 'light') ctx.fillStyle = '#fbbf24';
        else if (this.type === 'co2') ctx.fillStyle = '#94a3b8';
        else if (this.type === 'sugar') ctx.fillStyle = '#4ade80';
        
        ctx.arc(this.x, this.y, 4, 0, Math.PI * 2);
        ctx.fill();
    }
}

// 初始化粒子
for(let i=0; i<15; i++) {
    particles.push(new Particle('water'));
    particles.push(new Particle('light'));
    particles.push(new Particle('co2'));
}

function drawScene() {
    const w = canvas.width / window.devicePixelRatio;
    const h = canvas.height / window.devicePixelRatio;
    ctx.clearRect(0, 0, w, h);

    const light = lightSlider.value / 50;
    const co2 = co2Slider.value / 50;
    const rate = Math.min(light, co2);

    // 更新顯示文字
    const rateDisplay = document.getElementById('rate-display');
    if (rate === 0) rateDisplay.textContent = "狀態：停止 (缺乏原料或能量)";
    else if (rate < 0.5) rateDisplay.textContent = "狀態：速率緩慢";
    else rateDisplay.textContent = "狀態：光合作用進行中";

    // 繪製葉綠體構造 (兩個圓型代表光/碳反應區)
    ctx.lineWidth = 3;
    ctx.strokeStyle = '#166534';
    // 左區
    ctx.fillStyle = 'rgba(22, 101, 52, 0.2)';
    ctx.beginPath(); ctx.arc(200, 250, 100, 0, Math.PI*2); ctx.fill(); ctx.stroke();
    // 右區
    ctx.beginPath(); ctx.arc(450, 250, 100, 0, Math.PI*2); ctx.fill(); ctx.stroke();

    // 繪製能量循環箭頭
    ctx.strokeStyle = '#facc15';
    ctx.beginPath(); ctx.arc(325, 250, 40, Math.PI*1.2, Math.PI*1.8); ctx.stroke();
    ctx.font = '12px Arial'; ctx.fillText('能量傳遞', 305, 200);

    particles.forEach(p => {
        p.update(rate);
        p.draw();
    });

    requestAnimationFrame(drawScene);
}

window.addEventListener('resize', resize);
resize();
drawScene();

// --- 隨堂測驗題庫 (10題會考模擬題) ---
const quizData = [
    {
        q: "1. 關於光合作用中的「光反應」，下列敘述何者正確？",
        opts: ["(A) 發生在葉綠體的基質中", "(B) 主要是為了產生二氧化碳", "(C) 會分解水分子並釋放出氧氣", "(D) 不需要光線也能進行"],
        a: "C",
        r: "光反應發生在類囊體（葉綠餅），利用光能分解水，產生氧氣、氫與能量。"
    },
    {
        q: "2. 光合作用所產生的葡萄糖，在植物體內常以何種形式儲存？",
        opts: ["(A) 蛋白質", "(B) 澱粉", "(C) 脂肪", "(D) 礦物質"],
        a: "B",
        r: "葡萄糖通常會轉換成不溶於水的澱粉進行儲存，以便長期保存。"
    },
    {
        q: "3. 進行光合作用實驗時，將葉片放入酒精中「隔水加熱」的目的為何？",
        opts: ["(A) 軟化葉片細胞壁", "(B) 溶出葉綠素以利觀察顏色變化", "(C) 檢驗有無葡萄糖生成", "(D) 直接觀察澱粉的分布"],
        a: "B",
        r: "葉綠素會干擾碘液變色的觀察，故需用酒精將其溶出（脫色）。"
    },
    {
        q: "4. 若將一盆植物放置在完全黑暗的密室中，下列哪一項生理作用會最先停止？",
        opts: ["(A) 呼吸作用", "(B) 蒸散作用", "(C) 光反應", "(D) 碳反應"],
        a: "C",
        r: "光反應直接依賴光能，一旦沒光會立刻停止。碳反應則會隨後因缺乏能量而停止。"
    },
    {
        q: "5. 植物光合作用釋放出的氧氣，其原子最初是來自於哪一種分子？",
        opts: ["(A) 二氧化碳 (CO₂)", "(B) 水 (H₂O)", "(C) 葡萄糖", "(D) 葉綠素"],
        a: "B",
        r: "這是科學家利用同位素證實的考點：氧氣來自於「水」的分解。"
    },
    {
        q: "6. 關於「碳反應」的敘述，下列何者錯誤？",
        opts: ["(A) 需要光反應產生的能量才能進行", "(B) 產物包含葡萄糖與水", "(C) 必須在完全黑暗的環境才能進行", "(D) 主要目的是固定二氧化碳"],
        a: "C",
        r: "「碳反應」雖然不直接需光，但在白天光反應提供能量時進行最旺盛，並非只能在黑暗進行。"
    },
    {
        q: "7. 使用碘液檢測葉片澱粉時，若碘液由黃褐色變為藍黑色，表示該處：",
        opts: ["(A) 有光合作用進行", "(B) 缺乏葉綠素", "(C) 正在進行呼吸作用", "(D) 沒有澱粉存在"],
        a: "A",
        r: "碘液遇到澱粉會變藍黑色，澱粉是光合作用的儲存產物，故代表有光合作用進行。"
    },
    {
        q: "8. 植物葉片背面的氣孔，在光合作用中扮演什麼角色？",
        opts: ["(A) 吸收陽光的通道", "(B) 葡萄糖運輸的出口", "(C) 氣體（CO₂、O₂）進出的門戶", "(D) 產生葉綠素的場所"],
        a: "C",
        r: "氣孔是二氧化碳進入、氧氣與水蒸氣離開植物體的主要通道。"
    },
    {
        q: "9. 葉大同想證明「光線是光合作用的必要條件」，他應該設計怎樣的對照實驗？",
        opts: ["(A) 同一片葉子，一半遮光一半不遮光", "(B) 兩株植物，一株澆水一株不澆水", "(C) 一片葉子塗抹凡士林，另一片不塗", "(D) 將植物放在不同溫度的環境"],
        a: "A",
        r: "探討光的影響，「光線」就是唯一的變因，其餘（水、二氧化碳、葉片種類）應保持一致。"
    },
    {
        q: "10. 光合作用對地球生態系最重要的貢獻不包括下列何者？",
        opts: ["(A) 維持大氣中氧氣的濃度", "(B) 提供消費者食物來源（能量）", "(C) 消耗溫室氣體二氧化碳", "(D) 增加土壤中的礦物質含量"],
        a: "D",
        r: "土壤礦物質主要來自岩石風化或分解者分解生物遺體，與光合作用無直接關係。"
    }
];

let currentQuizIndex = 0;
function initQuiz() {
    const qItem = quizData[currentQuizIndex];
    document.getElementById('quiz-q').innerText = qItem.q;
    const optsWrapper = document.getElementById('quiz-opts');
    optsWrapper.innerHTML = "";
    qItem.opts.forEach((opt, idx) => {
        const btn = document.createElement('button');
        btn.className = "opt-btn";
        btn.innerText = opt;
        btn.onclick = () => checkAnswer(idx);
        optsWrapper.appendChild(btn);
    });
    document.getElementById('quiz-feedback').classList.add('hidden');
    document.getElementById('btn-next-quiz').classList.add('hidden');
}

function checkAnswer(idx) {
    const qItem = quizData[currentQuizIndex];
    const feedback = document.getElementById('quiz-feedback');
    feedback.classList.remove('hidden');
    const userA = ["A", "B", "C", "D"][idx];
    if (userA === qItem.a) {
        feedback.className = "quiz-feedback correct";
        feedback.innerHTML = "🟢 正確！" + qItem.r;
    } else {
        feedback.className = "quiz-feedback wrong";
        feedback.innerHTML = `🔴 錯誤！正確答案是 ${qItem.a}。<br>${qItem.r}`;
    }
    document.getElementById('btn-next-quiz').classList.remove('hidden');
}

function nextQuestion() {
    currentQuizIndex = (currentQuizIndex + 1) % quizData.length;
    initQuiz();
}
window.onload = initQuiz;