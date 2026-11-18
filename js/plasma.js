// --- Animation 14: Plasma ---
function drawPlasma(color) {
    const speed = parseFloat(document.getElementById('plasmaSpeed').value);
    const scale = parseFloat(document.getElementById('plasmaScale').value);
    const rgb = hexToRgb(color);

    if (!plasmaCanvas) {
        plasmaCanvas = document.createElement('canvas');
        plasmaCtx = plasmaCanvas.getContext('2d');
    }

    const res = 6;
    const pw = Math.ceil(width / res);
    const ph = Math.ceil(height / res);

    if (plasmaCanvas.width !== pw || plasmaCanvas.height !== ph) {
        plasmaCanvas.width = pw;
        plasmaCanvas.height = ph;
    }

    const imgData = plasmaCtx.createImageData(pw, ph);
    const data = imgData.data;
    const t = time * speed;

    for (let py = 0; py < ph; py++) {
        for (let px = 0; px < pw; px++) {
            let x = px * res;
            let y = py * res;
            let v = Math.sin(x * scale * 0.008 + t);
            v += Math.sin((y * scale * 0.008 + t) * 0.5);
            v += Math.sin((x + y) * scale * 0.004 + t) * 0.5;
            v += Math.sin(Math.sqrt(x * x + y * y) * scale * 0.004 + t);

            let val = (Math.sin(v * Math.PI) + 1) * 0.5;
            let val2 = (Math.cos(v * Math.PI * 0.7) + 1) * 0.5;

            let idx = (py * pw + px) * 4;
            data[idx] = Math.floor(rgb.r * val + (1 - val) * 15);
            data[idx + 1] = Math.floor(rgb.g * val2 * 0.8 + (1 - val2) * 30);
            data[idx + 2] = Math.floor(rgb.b * (1 - val * 0.4) + val * 25);
            data[idx + 3] = 255;
        }
    }

    plasmaCtx.putImageData(imgData, 0, 0);
    ctx.imageSmoothingEnabled = true;
    ctx.drawImage(plasmaCanvas, 0, 0, width, height);
    time += 0.015;
}
