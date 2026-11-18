// --- Animation 18: Phoenix Fractal ---
function drawPhoenix(color) {
    const speed = parseFloat(document.getElementById('phxSpeed').value);
    const maxIter = parseInt(document.getElementById('phxIter').value);
    const distort = parseFloat(document.getElementById('phxDistort').value);
    const rgb = hexToRgb(color);

    const { pw, ph } = ensureFractalCanvas();
    const imgData = plasmaCtx.createImageData(pw, ph);
    const data = imgData.data;

    const t = time * speed * 0.3;
    const aspect = pw / ph;

    // Animated Phoenix parameters — p and c orbit slowly
    const cr = -0.5 + Math.sin(t * 0.2) * 0.15;
    const ci = Math.cos(t * 0.17) * 0.1;
    const pr = 0.5667 + Math.sin(t * 0.25) * distort * 0.15;
    const pi = Math.cos(t * 0.3) * distort * 0.1;

    // Animated view — gentle zoom + drift
    const zoomCycle = (Math.sin(t * 0.15) + 1) * 0.5;
    const zoom = Math.pow(2, 0.3 + zoomCycle * 2.5);
    const viewSize = 3.0 / zoom;
    const panX = Math.sin(t * 0.08) * 0.3;
    const panY = Math.cos(t * 0.06) * 0.2;
    const paletteShift = time * speed * 0.02;

    for (let py2 = 0; py2 < ph; py2++) {
        for (let px2 = 0; px2 < pw; px2++) {
            // Map pixel to complex plane
            let y0 = panY + (py2 / ph - 0.5) * viewSize;
            let x0 = panX + (px2 / pw - 0.5) * viewSize * aspect;

            // Phoenix iteration: z_{n+1} = z_n^2 + c + p * z_{n-1}
            let zr = x0, zi = y0;
            let prevR = 0, prevI = 0;
            let iter = 0;

            while (iter < maxIter) {
                let zr2 = zr * zr, zi2 = zi * zi;
                if (zr2 + zi2 > 4) break;

                let newR = zr2 - zi2 + cr + pr * prevR - pi * prevI;
                let newI = 2 * zr * zi + ci + pr * prevI + pi * prevR;

                prevR = zr;
                prevI = zi;
                zr = newR;
                zi = newI;
                iter++;
            }

            let idx = (py2 * pw + px2) * 4;
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
