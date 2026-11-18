// --- Animation 17: Mandelbrot (auto-zoom) ---
function drawMandelbrot(color) {
    const speed = parseFloat(document.getElementById('mbSpeed').value);
    const maxIter = parseInt(document.getElementById('mbIter').value);
    const zoomDepth = parseFloat(document.getElementById('mbZoomDepth').value);
    const rgb = hexToRgb(color);

    const { pw, ph } = ensureFractalCanvas();
    const imgData = plasmaCtx.createImageData(pw, ph);
    const data = imgData.data;

    // Zoom target: a visually rich point on the Mandelbrot boundary
    const targetR = -0.7435669;
    const targetI = 0.1314023;

    const t = time * speed * 0.15;
    const cycle = (Math.sin(t * 0.5) + 1) * 0.5; // 0..1 ping-pong
    const zoomLevel = Math.pow(2, 1 + cycle * zoomDepth);
    const viewSize = 2.0 / zoomLevel;
    const aspect = pw / ph;

    // Slowly rotate color palette
    const paletteShift = time * speed * 0.02;

    for (let py = 0; py < ph; py++) {
        for (let px = 0; px < pw; px++) {
            let cr = targetR + (px / pw - 0.5) * viewSize * aspect;
            let ci = targetI + (py / ph - 0.5) * viewSize;

            let zr = 0, zi = 0, iter = 0;
            while (iter < maxIter) {
                let zr2 = zr * zr, zi2 = zi * zi;
                if (zr2 + zi2 > 4) break;
                zi = 2 * zr * zi + ci;
                zr = zr2 - zi2 + cr;
                iter++;
            }

            let idx = (py * pw + px) * 4;
            if (iter === maxIter) {
                data[idx] = data[idx + 1] = data[idx + 2] = 0;
            } else {
                let log_zn = Math.log(zr * zr + zi * zi) / 2;
                let nu = Math.log(log_zn / Math.LN2) / Math.LN2;
                let smoothIter = iter + 1 - nu + paletteShift * 25;
                let c = fractalCosinePalette(smoothIter, rgb);
                data[idx] = c[0]; data[idx+1] = c[1]; data[idx+2] = c[2];
            }
            data[idx + 3] = 255;
        }
    }

    plasmaCtx.putImageData(imgData, 0, 0);
    ctx.imageSmoothingEnabled = true;
    ctx.drawImage(plasmaCanvas, 0, 0, width, height);
    time += 0.008;
}
