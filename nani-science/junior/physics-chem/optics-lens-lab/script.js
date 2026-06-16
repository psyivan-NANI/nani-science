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