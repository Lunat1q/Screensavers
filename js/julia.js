// --- Animation 16: Julia Set ---
function drawJuliaSet(color) {
    const speed = parseFloat(document.getElementById('juliaSpeed').value);
    const zoom = parseFloat(document.getElementById('juliaZoom').value);
    const maxIter = parseInt(document.getElementById('juliaIter').value);
    const rgb = hexToRgb(color);

    if (!plasmaCanvas) {
        plasmaCanvas = document.createElement('canvas');
        plasmaCtx = plasmaCanvas.getContext('2d');
    }

    const res = 4;
    const pw = Math.ceil(width / res);
    const ph = Math.ceil(height / res);

    if (plasmaCanvas.width !== pw || plasmaCanvas.height !== ph) {
        plasmaCanvas.width = pw;
        plasmaCanvas.height = ph;
    }

    const imgData = plasmaCtx.createImageData(pw, ph);
    const data = imgData.data;

    // Animate c parameter in a smooth complex orbit
    const t = time * speed * 0.3;
    const cr = 0.7885 * Math.cos(t * 0.6 + Math.sin(t * 0.15) * 0.5);
    const ci = 0.7885 * Math.sin(t * 0.6 + Math.cos(t * 0.2) * 0.3);

    const invZoom = 1.5 / zoom;
    const aspect = pw / ph;

    for (let py = 0; py < ph; py++) {
        for (let px = 0; px < pw; px++) {
            let zr = (px / pw - 0.5) * 2 * aspect * invZoom;
            let zi = (py / ph - 0.5) * 2 * invZoom;

            let iter = 0;
            while (iter < maxIter) {
                let zr2 = zr * zr;
                let zi2 = zi * zi;
                if (zr2 + zi2 > 4) break;
                zi = 2 * zr * zi + ci;
                zr = zr2 - zi2 + cr;
                iter++;
            }

            let idx = (py * pw + px) * 4;
            if (iter === maxIter) {
                data[idx] = data[idx + 1] = data[idx + 2] = 0;
            } else {
                // Smooth coloring (continuous iteration count)
                let log_zn = Math.log(zr * zr + zi * zi) / 2;
                let nu = Math.log(log_zn / Math.LN2) / Math.LN2;
                let smoothIter = iter + 1 - nu;
                let s = smoothIter * 0.04;

                // Cosine palette (Inigo Quilez technique) blended with base color
                let cr2 = 0.5 + 0.5 * Math.cos(6.2832 * (s + 0.0));
                let cg = 0.5 + 0.5 * Math.cos(6.2832 * (s + 0.15));
                let cb = 0.5 + 0.5 * Math.cos(6.2832 * (s + 0.33));

                data[idx]     = Math.min(255, Math.floor(cr2 * rgb.r * 1.2));
                data[idx + 1] = Math.min(255, Math.floor(cg * rgb.g * 1.2));
                data[idx + 2] = Math.min(255, Math.floor(cb * rgb.b * 1.2));
            }
            data[idx + 3] = 255;
        }
    }

    plasmaCtx.putImageData(imgData, 0, 0);
    ctx.imageSmoothingEnabled = true;
    ctx.drawImage(plasmaCanvas, 0, 0, width, height);
    time += 0.008;
}
