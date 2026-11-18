// --- Animation 12: Water Ripples ---
// A heightfield wave simulation at 1/3 resolution. Each pixel refracts a moonlit night-sky
// backdrop by the local surface slope and adds a specular glint, so drops read as real water.
let rip = null;

function initRipples(color) {
    const cell = 3;
    const w = Math.ceil(width / cell) + 2, h = Math.ceil(height / cell) + 2; // +2: border ring stays flat
    const c = hexToRgb(color);
    const bg = new Float32Array(w * h * 3);
    const mx = w * 0.64, my = h * 0.18;
    for (let y = 0; y < h; y++) {
        const v = y / h;
        const sky = 0.07 + 0.36 * (1 - v) * (1 - v); // tinted glow near the horizon, deep water below
        for (let x = 0; x < w; x++) {
            const ex = (x - mx) / (w * 0.03), ey = (y - my) / (h * 0.3);
            const moon = Math.exp(-(ex * ex + ey * ey)) * 0.8 + Math.exp(-(ex * ex) / 30 - ey * ey) * 0.12;
            const i = (y * w + x) * 3;
            bg[i] = c.r * sky + (210 + c.r * 0.2) * moon;
            bg[i + 1] = c.g * sky + (215 + c.g * 0.2) * moon;
            bg[i + 2] = c.b * sky + (225 + c.b * 0.2) * moon;
        }
    }
    for (let k = 0; k < w * h / 1500; k++) { // reflected stars, so the distortion has detail to bend
        const i = ((Math.random() * h * 0.7 | 0) * w + (Math.random() * w | 0)) * 3;
        const s = 30 + Math.random() * Math.random() * 200;
        bg[i] += s; bg[i + 1] += s; bg[i + 2] += s;
    }
    const out = document.createElement('canvas');
    out.width = w - 2;
    out.height = h - 2;
    const octx = out.getContext('2d');
    const img = octx.createImageData(w - 2, h - 2);
    for (let i = 3; i < img.data.length; i += 4) img.data[i] = 255;
    rip = { color, width, height, w, h, bg, out, octx, img, cur: new Float32Array(w * h), prev: new Float32Array(w * h), acc: 0 };
}

function rippleDrop(x, y, r, amp) {
    const { w, h, cur } = rip;
    for (let j = Math.max(1, Math.floor(y - r)); j <= Math.min(h - 2, Math.ceil(y + r)); j++) {
        for (let k = Math.max(1, Math.floor(x - r)); k <= Math.min(w - 2, Math.ceil(x + r)); k++) {
            const d = Math.hypot(k - x, j - y) / r;
            if (d < 1) cur[j * w + k] -= amp * (Math.cos(d * Math.PI) + 1) * 0.5;
        }
    }
}

function drawRipples(color) {
    const freq = parseFloat(document.getElementById('rippleFreq').value);
    const rippleSpeed = parseFloat(document.getElementById('rippleSpeed').value);
    const maxSize = parseFloat(document.getElementById('rippleMaxSize').value);

    if (particles.length === 0 || !rip || rip.color !== color || rip.width !== width || rip.height !== height) {
        initRipples(color);
        particles = [rip]; // resetCanvas() empties particles, which forces a rebuild here
    }
    const now = performance.now();
    const dt = Math.min(0.1, (now - (rip.last ?? now)) / 1000);
    rip.last = now;
    const { w, h, bg, img } = rip;

    // Rain: on average freq * 2.5 drops per second, now and then a big plop
    for (let n = freq * 2.5 * dt; Math.random() < n; n--) {
        const big = Math.random() < 0.08;
        const r = (1.5 + maxSize / 30 * (0.4 + Math.random() * 0.6)) * (big ? 1.8 : 1);
        rippleDrop(1 + Math.random() * (w - 2), 1 + Math.random() * (h - 2), r, (big ? 30 : 18) + r * 2);
    }

    // Wave equation: 30 * speed steps per second, whatever the refresh rate
    rip.acc += dt * 30 * rippleSpeed;
    const steps = Math.min(8, rip.acc | 0);
    rip.acc = rip.acc > 8 ? 0 : rip.acc - steps;
    for (let s = 0; s < steps; s++) {
        const cur = rip.cur, prev = rip.prev;
        for (let y = 1; y < h - 1; y++) {
            for (let i = y * w + 1, end = y * w + w - 1; i < end; i++) {
                prev[i] = ((cur[i - 1] + cur[i + 1] + cur[i - w] + cur[i + w]) * 0.5 - prev[i]) * 0.985;
            }
        }
        rip.cur = prev;
        rip.prev = cur;
    }

    // Shade: the slope bends the backdrop lookup and lights a glint from the upper left
    const cur = rip.cur, d = img.data;
    let o = 0;
    for (let y = 1; y < h - 1; y++) {
        for (let x = 1; x < w - 1; x++) {
            const i = y * w + x;
            const sx = cur[i - 1] - cur[i + 1], sy = cur[i - w] - cur[i + w];
            let bx = (x + sx * 3) | 0, by = (y + sy * 3) | 0;
            bx = bx < 0 ? 0 : bx >= w ? w - 1 : bx;
            by = by < 0 ? 0 : by >= h ? h - 1 : by;
            const b = (by * w + bx) * 3;
            const l = sx * 0.6 + sy * 0.8;
            const spec = l > 0 ? l * l * 3 : 0;
            const shade = 1 + l * 0.06;
            d[o] = bg[b] * shade + spec;
            d[o + 1] = bg[b + 1] * shade + spec;
            d[o + 2] = bg[b + 2] * shade + spec;
            o += 4;
        }
    }
    rip.octx.putImageData(img, 0, 0);
    ctx.imageSmoothingEnabled = true;
    ctx.drawImage(rip.out, 0, 0, (w - 2) * 3, (h - 2) * 3); // 3 = cell size, a few px past the edge is fine
}
