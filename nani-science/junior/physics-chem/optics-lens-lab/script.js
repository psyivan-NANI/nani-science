const canvas = document.getElementById('lensCanvas');
const ctx = canvas.getContext('2d');

// 幾何光學核心參數（單位：像素）
let lensType = 'convex'; // 'convex' 凸透鏡, 'concave' 凹透鏡
let focalLength = 80;    // 焦距 f = 80px
let objectX = 160;       // 預設物距 p = 160px (剛好是 2F)
let objectHeight = 60;   // 物體高度 h_o = 60px

function resizeCanvas() {
    const rect = canvas.parentElement.getBoundingClientRect();
    canvas.width = rect.width * window.devicePixelRatio;
    canvas.height = rect.height * window.devicePixelRatio;
    ctx.scale(window.devicePixelRatio, window.devicePixelRatio);
    drawScene();
}

function drawScene() {
    if (!canvas || !ctx) return;
    
    const w = canvas.width / window.devicePixelRatio;
    const h = canvas.height / window.devicePixelRatio;

    ctx.clearRect(0, 0, w, h);

    // 光學幾何中心點（透鏡中心，定義為坐標原點）
    const cx = w / 2;
    const cy = h / 2 - 20;

    // --- 1. 繪製背景與主光軸 ---
    ctx.fillStyle = '#050b14';
    ctx.fillRect(0, 0, w, h);

    ctx.strokeStyle = 'rgba(255, 255, 255, 0.15)';
    ctx.lineWidth = 1.5;
    ctx.beginPath(); 
    ctx.moveTo(10, cy); 
    ctx.lineTo(w - 10, cy); 
    ctx.stroke();

    // --- 2. 標註地標：雙側焦點 F 與 2F ---
    const focalPoints = [
        { x: cx - focalLength, label: "F" },
        { x: cx - focalLength * 2, label: "2F" },
        { x: cx + focalLength, label: "F" },
        { x: cx + focalLength * 2, label: "2F" }
    ];

    ctx.fillStyle = '#94a3b8';
    ctx.font = '12px sans-serif';
    ctx.textAlign = 'center';
    focalPoints.forEach(pt => {
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.4)';
        ctx.beginPath(); 
        ctx.moveTo(pt.x, cy - 6); 
        ctx.lineTo(pt.x, cy + 6); 
        ctx.stroke();
        ctx.fillText(pt.label, pt.x, cy + 22);
    });

    // --- 3. 繪製透鏡外觀 ---
    ctx.strokeStyle = '#00d2ff';
    ctx.lineWidth = 3.5;
    ctx.beginPath();
    if (lensType === 'convex') {
        ctx.moveTo(cx, cy - 95);
        ctx.quadraticCurveTo(cx + 16, cy, cx, cy + 95);
        ctx.quadraticCurveTo(cx - 16, cy, cx, cy - 95);
    } else {
        ctx.moveTo(cx - 14, cy - 95);
        ctx.lineTo(cx + 14, cy - 95);
        ctx.quadraticCurveTo(cx, cy, cx + 14, cy + 95);
        ctx.lineTo(cx - 14, cy + 95);
        ctx.quadraticCurveTo(cx, cy, cx - 14, cy - 95);
    }
    ctx.stroke();

    // --- 4. 繪製真實物體（綠色箭頭：固定在左側且永遠正立向上） ---
    const objXAbs = cx - objectX; 
    const objYAbs = cy - objectHeight; // Canvas 減代表主光軸上方

    ctx.strokeStyle = '#22c55e';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(objXAbs, cy);
    ctx.lineTo(objXAbs, objYAbs);
    ctx.lineTo(objXAbs - 6, objYAbs + 10);
    ctx.moveTo(objXAbs, objYAbs);
    ctx.lineTo(objXAbs + 6, objYAbs + 10);
    ctx.stroke();

    ctx.fillStyle = '#22c55e';
    ctx.font = 'bold 12px sans-serif';
    ctx.fillText("物體", objXAbs, cy - objectHeight - 8);

    // --- 5. 幾何光學核心物理公式（嚴格代數對齊） ---
    let p = objectX; 
    let f = (lensType === 'convex') ? focalLength : -focalLength; 
    
    // 判斷是否剛好在凸透鏡焦點上
    let noImage = (lensType === 'convex' && Math.abs(p - focalLength) < 1.5);
    let q = noImage ? 0 : (f * p) / (p - f);
    
    // 高斯橫向放大率公式： m = -q / p
    // 實像時 q > 0，m 為負值（倒立）；虛像時 q < 0，m 為正值（正立）
    let m = noImage ? 0 : -q / p;
    let imgHeight = objectHeight * m; 

    // 成像點的絕對 Canvas 座標
    let imgXAbs = cx + q; 
    let imgYAbs = cy - imgHeight; // Canvas 的 Y 軸方向：減為向上，加為向下。當 m 為負時，-imgHeight 變成正值，精準落於主光軸下方（倒立）
    let isRealImage = (q > 0); 

    // --- 6. 繪製幾何追蹤光線 ---
    if (noImage) {
        // 【特例：剛好在焦點上】射出平行光
        ctx.strokeStyle = 'rgba(239, 68, 68, 0.85)';
        ctx.lineWidth = 1.5;
        ctx.beginPath(); ctx.moveTo(objXAbs, objYAbs); ctx.lineTo(cx, objYAbs); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(cx, objYAbs); ctx.lineTo(w - 10, objYAbs + (w - 10 - cx) * (objectHeight / focalLength)); ctx.stroke();

        ctx.strokeStyle = 'rgba(245, 158, 11, 0.85)';
        ctx.beginPath(); ctx.moveTo(objXAbs, objYAbs); ctx.lineTo(cx, cy); ctx.lineTo(w - 10, cy + (cy - objYAbs) * (w - 10 - cx) / (cx - objXAbs)); ctx.stroke();

        ctx.fillStyle = '#ef4444';
        ctx.font = 'bold 14px sans-serif';
        ctx.fillText("💥 剛好在焦點上：折射光完全平行，無法成像！", cx, cy - 115);
    } else {
        // ---【第一條光線：平行主軸 -> 折射過右焦點（或由左焦點發散）】---
        ctx.lineWidth = 1.5;
        ctx.strokeStyle = 'rgba(239, 68, 68, 0.85)'; // 紅光
        
        // 入射段：物體頂端 -> 垂直射向透鏡中心軸
        ctx.beginPath(); 
        ctx.moveTo(objXAbs, objYAbs); 
        ctx.lineTo(cx, objYAbs); 
        ctx.stroke();
        
        // 折射段：其直線方程必須完美綁定幾何折射路徑
        ctx.beginPath();
        ctx.moveTo(cx, objYAbs);
        if (lensType === 'convex') {
            if (isRealImage) {
                // 實像：折射光從透鏡軸 (cx, objYAbs) 出發，必須精準穿過成像頂點 (imgXAbs, imgYAbs)
                let slope = (imgYAbs - objYAbs) / (imgXAbs - cx);
                ctx.lineTo(w - 10, objYAbs + (w - 10 - cx) * slope);
                ctx.stroke();
            } else {
                // 虛像（焦點內）：折射光線向右下發散（通過右焦點）
                let slope = (cy + focalLength - objYAbs) / focalLength;
                ctx.lineTo(w - 10, objYAbs + (w - 10 - cx) * slope);
                ctx.stroke();

                // 繪製向左後方追蹤至虛像頂點的虛線
                ctx.strokeStyle = 'rgba(239, 68, 68, 0.4)';
                ctx.setLineDash([4, 4]);
                ctx.beginPath(); ctx.moveTo(cx, objYAbs); ctx.lineTo(imgXAbs, imgYAbs); ctx.stroke();
                ctx.setLineDash([]);
            }
        } else {
            // 凹透鏡：折射光向右上發散，其反向延長線指向左焦點
            let slope = (objYAbs - (cy - focalLength)) / cx; // 依據幾何發散推導
            ctx.lineTo(w - 10, objYAbs + (w - 10 - cx) * slope);
            ctx.stroke();

            // 繪製向左後方追蹤至虛像頂點與左焦點的虛線
            ctx.strokeStyle = 'rgba(239, 68, 68, 0.4)';
            ctx.setLineDash([4, 4]);
            ctx.beginPath(); ctx.moveTo(cx, objYAbs); ctx.lineTo(imgXAbs, imgYAbs); ctx.lineTo(cx - focalLength, cy); ctx.stroke();
            ctx.setLineDash([]);
        }

        // ---【第二條光線：通過光心，傳播方向不變】---
        ctx.strokeStyle = 'rgba(245, 158, 11, 0.85)'; // 橘光
        ctx.beginPath();
        ctx.moveTo(objXAbs, objYAbs);
        ctx.lineTo(cx, cy); 
        // 嚴格依據光心斜率延伸至畫布邊緣
        let slopeCenter = (cy - objYAbs) / (cx - objXAbs);
        ctx.lineTo(w - 10, cy + (w - 10 - cx) * slopeCenter);
        ctx.stroke();

        // 虛像狀態下，光心光線向左後方的反向延長線
        if (!isRealImage) {
            ctx.strokeStyle = 'rgba(245, 158, 11, 0.4)';
            ctx.setLineDash([4, 4]);
            ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(imgXAbs, imgYAbs); ctx.stroke();
            ctx.setLineDash([]);
        }

        // --- 7. 繪製成像箭頭（嚴格根據 Y 軸位置決定方向） ---
        ctx.strokeStyle = isRealImage ? '#ef4444' : '#d946ef';
        ctx.lineWidth = 3;
        
        if (!isRealImage) ctx.setLineDash([4, 4]); 
        
        ctx.beginPath();
        ctx.moveTo(imgXAbs, cy);
        ctx.lineTo(imgXAbs, imgYAbs); // 像身
        
        // 幾何嚴格箭頭判斷：
        // 若 imgYAbs > cy (在主光軸下方，即倒立實像)，箭頭尖端必須向下指，倒勾要往上減
        // 若 imgYAbs < cy (在主光軸上方，即正立虛像)，箭頭尖端必須向上指，倒勾要往下加
        if (imgYAbs > cy) {
            ctx.lineTo(imgXAbs - 5, imgYAbs - 10);
            ctx.moveTo(imgXAbs, imgYAbs);
            ctx.lineTo(imgXAbs + 5, imgYAbs - 10);
        } else {
            ctx.lineTo(imgXAbs - 5, imgYAbs + 10);
            ctx.moveTo(imgXAbs, imgYAbs);
            ctx.lineTo(imgXAbs + 5, imgYAbs + 10);
        }
        ctx.stroke();
        ctx.setLineDash([]); // 重置虛線

        // 像的標籤文字位置適配
        ctx.fillStyle = isRealImage ? '#ef4444' : '#d946ef';
        ctx.font = 'bold 12px sans-serif';
        ctx.fillText(
            isRealImage ? "實像 (倒立)" : "虛像 (正立)", 
            imgXAbs, 
            imgYAbs + (imgYAbs > cy ? 18 : -8)
        );
    }
}

// 數據看板更新邏輯
function updateLabelsAndUI() {
    const distanceText = document.getElementById('distance-text');
    if (distanceText) distanceText.textContent = `${objectX} cm`;
    
    const tdObjPos = document.getElementById('td-obj-pos');
    const tdImgPos = document.getElementById('td-img-pos');
    const tdImgProp = document.getElementById('td-img-prop');
    const statusZone = document.getElementById('status-zone');
    const statusDesc = document.getElementById('status-desc');

    if (!tdObjPos || !tdImgPos || !tdImgProp || !statusZone || !statusDesc) return;

    if (lensType === 'convex') {
        const titleLabel = document.getElementById('lens-title-label');
        if (titleLabel) titleLabel.textContent = "凸透鏡 (匯聚作用)";
        
        if (objectX > focalLength * 2) {
            statusZone.textContent = "目前位置：【區段一】二倍焦距外 (p > 2F)";
            tdObjPos.textContent = "2F 之外";
            tdImgPos.textContent = "另一側 F ~ 2F 之間";
            tdImgProp.className = "highlight-text text-green";
            tdImgProp.textContent = "倒立、縮小、實像";
            statusDesc.innerHTML = "💡 <strong>照相機與眼睛</strong>的原理！遠處巨大的物體，在透鏡另一側縮小成倒立實像，剛好投射在底片或視網膜上。";
        } else if (objectX === focalLength * 2) {
            statusZone.textContent = "目前位置：【點二】剛好在二倍焦距上 (p = 2F)";
            tdObjPos.textContent = "剛好在 2F 上";
            tdImgPos.textContent = "另一側 2F 上";
            tdImgProp.className = "highlight-text text-yellow";
            tdImgProp.textContent = "倒立、等大、實像";
            statusDesc.innerHTML = "💡 <strong>測量焦距</strong>的黃金位置！像的大小與物體完全相等，此時物體與成像之間的總距離剛好等於 4 倍焦距。";
        } else if (objectX > focalLength && objectX < focalLength * 2) {
            statusZone.textContent = "目前位置：【區段三】一倍焦距到二倍焦距間 (F < p < 2F)";
            tdObjPos.textContent = "F ~ 2F 之間";
            tdImgPos.textContent = "另一側 2F 之外";
            tdImgProp.className = "highlight-text text-red";
            tdImgProp.textContent = "倒立、放大、實像";
            statusDesc.innerHTML = "💡 <strong>電影投影機、幻燈片、顯微鏡物鏡</strong>的原理！把微小的正立幻燈片倒著放，就能在遠處螢幕上投影出放大的倒立實像。";
        } else if (objectX === focalLength) {
            statusZone.textContent = "目前位置：【點四】剛好在焦點上 (p = F)";
            tdObjPos.textContent = "剛好在 F 上";
            tdImgPos.textContent = "無窮遠處 (不成像)";
            tdImgProp.className = "highlight-text text-muted";
            tdImgProp.textContent = "不成像";
            statusDesc.innerHTML = "💡 <strong>手電筒與探照燈</strong>的應用！當光源放在焦點上，折射後的光線會變成**完全平行主軸的平行光**，可以射向極遠方。";
        } else {
            statusZone.textContent = "目前位置：【區段五】一倍焦距內 (p < F)";
            tdObjPos.textContent = "焦點 F 之內";
            tdImgPos.textContent = "同側、且在物體後方";
            tdImgProp.className = "highlight-text text-purple";
            tdImgProp.textContent = "正立、放大、虛像";
            statusDesc.innerHTML = "💡 <strong>放大鏡與老花眼鏡</strong>的原理！光線太過發散，折射後無法在右側交會。大腦沿著光線反向延伸，在物體後方產生放大的正立虛像。";
        }
    } else {
        const titleLabel = document.getElementById('lens-title-label');
        if (titleLabel) titleLabel.textContent = "凹透鏡 (發散作用)";
        statusZone.textContent = "目前位置：凹透鏡任何位置";
        tdObjPos.textContent = "不論放在何處";
        tdImgPos.textContent = "同側、一倍焦距 F 之內";
        tdImgProp.className = "highlight-text text-concave-blue";
        tdImgProp.textContent = "正立、縮小、虛像";
        statusDesc.innerHTML = "💡 <strong>近視眼鏡</strong>的原理！因為凹透鏡對光線具有**發散**作用，右側折射光四散，只有反向延長線能在左側焦點內縮成縮小正立虛像。";
    }
}

// 互動 UI 監聽器
document.getElementById('slider-object-x').oninput = function () {
    objectX = parseInt(this.value);
    updateLabelsAndUI();
    drawScene();
};

document.getElementById('mode-convex').onclick = function () {
    lensType = 'convex';
    this.classList.add('active');
    document.getElementById('mode-concave').classList.remove('active');
    updateLabelsAndUI();
    drawScene();
};

document.getElementById('mode-concave').onclick = function () {
    lensType = 'concave';
    this.classList.add('active');
    document.getElementById('mode-convex').classList.remove('active');
    updateLabelsAndUI();
    drawScene();
};

// 窗體事件初始化
window.addEventListener('resize', resizeCanvas);
window.addEventListener('DOMContentLoaded', () => {
    resizeCanvas();
    updateLabelsAndUI();
});

const quizData = [
  {q:'1. 一物體放在凸透鏡「二倍焦距外（p > 2F）」，所成的像具有哪些特徵？這對應哪種光學儀器的原理？',opts:['A. 正立、放大、虛像；放大鏡','B. 倒立、縮小、實像；照相機與人眼','C. 倒立、放大、實像；電影投影機','D. 正立、縮小、虛像；近視眼鏡'],a:'B',r:'物體在2F外時，像成在透鏡另一側的F~2F之間，為倒立、縮小、實像。照相機和人眼（遠處物體→縮小倒立的實像投影在底片/視網膜上）就是這個原理。'},
  {q:'2. 物體放在凸透鏡「焦點之內（p < F）」，所成的像具有哪些特徵？',opts:['A. 倒立、縮小、實像','B. 倒立、放大、實像','C. 正立、放大、虛像（在物體同側後方）','D. 不成像'],a:'C',r:'物體在焦點內，光線折射後發散，無法在透鏡右側形成實像。但沿光線反向延伸，在物體同側後方形成正立、放大的虛像——這正是放大鏡的原理。'},
  {q:'3. 物體放在凸透鏡「一倍焦距到二倍焦距之間（F < p < 2F）」，所成的像在哪裡？有何特徵？',opts:['A. 在透鏡另一側的F~2F之間，倒立縮小實像','B. 在透鏡另一側的2F之外，倒立放大實像','C. 在物體同側，正立放大虛像','D. 無窮遠處，不成像'],a:'B',r:'此區間像成在透鏡另一側的2F之外，為倒立、放大、實像。電影投影機、幻燈機、顯微鏡物鏡的原理——把底片/標本放在F~2F間，在遠處螢幕上形成放大的倒立實像。'},
  {q:'4. 物體恰好放在凸透鏡的「焦點（p = F）」時，會成什麼像？有何實際應用？',opts:['A. 在另一側焦點處形成倒立等大實像','B. 光線折射後成為平行光，不成像（像在無窮遠處）','C. 在同側形成正立縮小虛像','D. 光線完全被吸收，不折射'],a:'B',r:'物體在焦點時，折射光成為完全平行主軸的平行光束，像在無窮遠處（不成像）。應用：手電筒、探照燈、汽車頭燈——將光源置於焦點，可產生平行光束射向遠方。'},
  {q:'5. 凹透鏡對各種位置的物體，成像的特徵始終為何？',opts:['A. 倒立、縮小、實像','B. 正立、放大、虛像','C. 正立、縮小、虛像（在物體同側，比物體更靠近透鏡）','D. 依物體位置不同而改變'],a:'C',r:'凹透鏡具有發散作用，對任何位置的物體都只能形成正立、縮小的虛像，且像位於物體和透鏡之間（比物體更靠近透鏡）。應用：近視眼鏡（將過近的成像點往後推到視網膜上）。'},
  {q:'6. 使用凸透鏡觀察小字（放大鏡），眼睛應如何配合才能看到放大的虛像？',opts:['A. 將文字放在焦點之外，眼睛靠近文字','B. 將文字放在焦點之內，眼睛在透鏡另一側透過透鏡觀看','C. 將眼睛放在文字和透鏡之間','D. 任何位置都可以，效果相同'],a:'B',r:'使用放大鏡時，將物體置於焦距內，眼睛透過透鏡看到物體的正立放大虛像。此虛像在物體的同側，比原物體更遠且更大。虛像的位置通常調整在明視距離（約25公分）處，最清晰舒適。'},
  {q:'7. 光學透鏡的成像公式為 1/f = 1/p + 1/q。若凸透鏡焦距f=10cm，物距p=15cm，則像距q為多少？像的性質為？',opts:['A. q=6cm，正立縮小虛像','B. q=30cm，倒立放大實像','C. q=-30cm，正立放大虛像','D. q=30cm，正立放大虛像'],a:'B',r:'代入公式：1/10 = 1/15 + 1/q → 1/q = 1/10 - 1/15 = 1/30 → q=30cm。q>0表示實像，在透鏡另一側。放大率m=-q/p=-30/15=-2，負號表示倒立，|m|=2表示放大2倍。'},
  {q:'8. 眼睛的「近視」與「遠視」分別需要配戴哪種透鏡矯正，原因為何？',opts:['A. 近視配凸透鏡；遠視配凹透鏡','B. 近視配凹透鏡（使光線發散，成像後移）；遠視配凸透鏡（使光線匯聚，成像前移）','C. 兩者都配凸透鏡，只是度數不同','D. 近視配稜鏡；遠視配平光鏡'],a:'B',r:'近視：眼球過長，平行光成像在視網膜前→需凹透鏡使光發散，等效縮短光程，使成像後移到視網膜上。遠視：眼球過短，平行光成像在視網膜後→需凸透鏡使光匯聚，使成像前移到視網膜上。'},
  {q:'9. 複式顯微鏡由「物鏡」和「目鏡」兩組凸透鏡組成。物體先由物鏡成何種像，再由目鏡放大？',opts:['A. 物鏡先成正立放大虛像，再由目鏡放大','B. 物鏡先成倒立放大實像（作為目鏡的虛物），再由目鏡成放大的正立虛像','C. 兩組透鏡各自獨立成像，最後影像疊加','D. 物鏡成縮小實像，目鏡成等大虛像'],a:'B',r:'複式顯微鏡的兩步成像：①物鏡：標本置於F~2F間→成倒立放大實像（在目鏡焦距內）。②目鏡：相當於放大鏡，將物鏡的實像（在其焦距內）再放大為正立放大虛像供眼睛觀察。總放大率＝物鏡倍率×目鏡倍率。'},
  {q:'10. 天文望遠鏡的物鏡（大口徑凸透鏡/反射鏡）主要功能是什麼？',opts:['A. 將遠處星光成縮小的虛像，方便目鏡放大','B. 將遠處平行光匯聚，在焦點附近成縮小倒立的實像，供目鏡放大','C. 產生平行光束射向星球','D. 過濾有害宇宙射線，只允許可見光通過'],a:'B',r:'天文望遠鏡物鏡的功能：收集大量遠處平行光（遠處星體光源），在其焦點附近成一個縮小的倒立實像（此像作為目鏡的「物」）。目鏡再如放大鏡一樣將此實像放大，使觀測者看到放大的虛像。物鏡口徑越大，收光量越多，解析度越高。'}
];
// 題庫由通用教學框架接管，此處無需額外處理
