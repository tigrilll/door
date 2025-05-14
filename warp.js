<!DOCTYPE html>
<html lang="ru">
<head>
  <meta charset="UTF-8">
  <title>Дверной редактор — Перспективный варп (фикс)</title>
  <script src="https://cdnjs.cloudflare.com/ajax/libs/fabric.js/5.3.0/fabric.min.js"></script>
  <script src="https://cdnjs.cloudflare.com/ajax/libs/numeric/1.2.6/numeric.min.js"></script>
  <style>
    body { margin:0; display:flex; font-family:sans-serif; }
    .sidebar { width:150px; background:#f0f0f0; padding:10px; border-right:1px solid #ccc; height:100vh; overflow:auto; }
    .door-thumb { width:100%; margin-bottom:10px; cursor:pointer; border:2px solid transparent; }
    .door-thumb:hover { border-color:#007bff; }
    .main { flex:1; padding:10px; }
    canvas { border:1px solid #aaa; display:block; }
    .status { margin-top:10px; font-size:14px; color:green; }
  </style>
</head>
<body>
<div class="sidebar">
  <h3>Двери</h3>
  <img src="door1.png" class="door-thumb" onclick="warpDoor(this)">
<img src="https://i.postimg.cc/m2trTjsw/DUR1111-removebg-preview.png" class="door-thumb" onclick="warpDoor(this)">
<img src="https://i.postimg.cc/m2trTjsw/DUR1111-removebg-preview.png" class="door-thumb" onclick="warpDoor(this)">
<img src="https://i.postimg.cc/m2trTjsw/DUR1111-removebg-preview.png" class="door-thumb" onclick="warpDoor(this)">
<img src="https://i.postimg.cc/m2trTjsw/DUR1111-removebg-preview.png" class="door-thumb" onclick="warpDoor(this)">
</div>
<div class="main">
  <input type="file" id="upload" accept="image/*">
  <button onclick="startDraw()">✏️ Нарисовать рамку</button>
  <button onclick="resetFrame()">❌ Сбросить</button>
  <canvas id="c"></canvas>
  <div class="status" id="status">Готово</div>
</div>

<script>
const canvas = new fabric.Canvas('c', { preserveObjectStacking: true });
let points = [], framePoly = null, drawing = false;

function log(...args) { console.log('🟢', ...args); }
function updateStatus(text) { document.getElementById('status').textContent = text; }

document.getElementById('upload').addEventListener('change', e => {
  const file = e.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = evt => {
    const bg = new Image();
    bg.onload = () => {
      canvas.setWidth(bg.width);
      canvas.setHeight(bg.height);
      fabric.Image.fromURL(evt.target.result, img => {
        img.set({ left:0, top:0, selectable:false });
        canvas.setBackgroundImage(img, canvas.renderAll.bind(canvas));
        log("📷 Фон загружен");
        updateStatus("Фон загружен");
      });
    };
    bg.src = evt.target.result;
  };
  reader.readAsDataURL(file);
});

function startDraw() {
  resetFrame();
  drawing = true;
  updateStatus("🖊 Начните рисовать рамку");
}

function resetFrame() {
  points = [];
  drawing = false;
  canvas.getObjects('circle').forEach(o => canvas.remove(o));
  if (framePoly) canvas.remove(framePoly);
  framePoly = null;
  updateStatus("Рамка сброшена");
}

canvas.on('mouse:down', opt => {
  if (!drawing) return;
  const p = canvas.getPointer(opt.e);
  points.push({ x:p.x, y:p.y });
  canvas.add(new fabric.Circle({ left: p.x, top: p.y, radius:4, fill:'red', originX:'center', originY:'center', selectable:false }));
  log(`📍 Точка ${points.length}: (${p.x.toFixed(1)}, ${p.y.toFixed(1)})`);
  if (points.length === 4) {
    drawing = false;
    const cx = points.reduce((s,p)=>s+p.x,0)/4;
    const cy = points.reduce((s,p)=>s+p.y,0)/4;
    const sorted = points.slice().sort((a,b)=>{
      const a1 = Math.atan2(a.y-cy,a.x-cx);
      const b1 = Math.atan2(b.y-cy,b.x-cx);
      return a1 - b1;
    });
    framePoly = new fabric.Polygon(sorted, {
      fill:'rgba(0,0,255,0.1)', stroke:'blue', strokeWidth:2, selectable:false
    });
    canvas.add(framePoly);
    log("✅ Рамка завершена", sorted);
    updateStatus("Рамка завершена. Выберите дверь.");
  }
});

function warpDoor(imgEl) {
  if (!framePoly) return alert('Сначала нарисуйте рамку.');
  const dst = framePoly.points.map(p => [p.x, p.y]);
  const door = new Image();
  door.crossOrigin = 'anonymous';
  door.onload = () => {
    const src = [[0,0], [door.width,0], [door.width,door.height], [0,door.height]];
    const A = [];
    for (let i = 0; i < 4; i++) {
      const [x, y] = dst[i];
      const [u, v] = src[i];
      A.push([x, y, 1, 0, 0, 0, -u*x, -u*y]);
      A.push([0, 0, 0, x, y, 1, -v*x, -v*y]);
    }
    const b = src.flat();
    const h = numeric.solve(A, b).concat(1);
    const Hinv = [
      [h[0], h[1], h[2]],
      [h[3], h[4], h[5]],
      [h[6], h[7], h[8]]
    ];

    const result = document.createElement('canvas');
    result.width = canvas.width;
    result.height = canvas.height;
    const ctx = result.getContext('2d');

    const srcCanvas = document.createElement('canvas');
    srcCanvas.width = door.width;
    srcCanvas.height = door.height;
    srcCanvas.getContext('2d').drawImage(door, 0, 0);
    const srcData = srcCanvas.getContext('2d').getImageData(0, 0, door.width, door.height);
    const dstData = ctx.getImageData(0, 0, result.width, result.height);

    let copied = 0;
    for (let j = 0; j < result.height; j++) {
      for (let i = 0; i < result.width; i++) {
        const vec = [i, j, 1];
        const denom = Hinv[2][0]*vec[0] + Hinv[2][1]*vec[1] + Hinv[2][2];
        const x = (Hinv[0][0]*vec[0] + Hinv[0][1]*vec[1] + Hinv[0][2]) / denom;
        const y = (Hinv[1][0]*vec[0] + Hinv[1][1]*vec[1] + Hinv[1][2]) / denom;

        const xi = Math.floor(x);
        const yi = Math.floor(y);
        if (xi >= 0 && yi >= 0 && xi < door.width && yi < door.height) {
          const srcIdx = (yi * door.width + xi) * 4;
          const dstIdx = (j * result.width + i) * 4;
          dstData.data[dstIdx]     = srcData.data[srcIdx];
          dstData.data[dstIdx + 1] = srcData.data[srcIdx + 1];
          dstData.data[dstIdx + 2] = srcData.data[srcIdx + 2];
          dstData.data[dstIdx + 3] = 255;
          copied++;
        }
      }
    }

    ctx.putImageData(dstData, 0, 0);
    const url = result.toDataURL();
    fabric.Image.fromURL(url, fImg => {
      fImg.set({ left:0, top:0, selectable:false });
      canvas.add(fImg);
      canvas.renderAll();
      updateStatus(`✅ Дверь вставлена с перспективным варпом (${copied} пикселей)`);
      log("✅ Вставка завершена");
    });
  };
  door.src = imgEl.src;
}
</script>
</body>
</html>
