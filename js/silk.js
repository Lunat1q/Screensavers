// --- Animation 23: Silk ---
// A Peter de Jong attractor drawn as a density map: every frame a few hundred thousand orbit points
// are binned into a buffer that fades slowly, while the four map parameters drift so the shape flows.
let silk = null;

function drawSilk(color) {
    const speed = parseFloat(document.getElementById('silkSpeed').value);
    const points = parseFloat(document.getElementById('silkPoints').value) * 100000;
    const q = Math.ceil(height / 600); // buffer of at most 600 rows keeps the per-pixel passes cheap
    const bw = Math.ceil(width / q), bh = Math.ceil(height / q);

    if (particles.length === 0 || !silk || silk.bw !== bw || silk.bh !== bh) {
        const cv = document.createElement('canvas');
        cv.width = bw; cv.height = bh;
        const cx = cv.getContext('2d'), img = cx.createImageData(bw, bh);
        silk = { bw, bh, cv, cx, img, px: new Uint32Array(img.data.buffer), dens: new Float32Array(bw * bh), tint: new Float32Array(bw * bh), t: Math.random() * 100, max: 1 };
        particles = [silk];
    }
    const S = silk, dt = frameDt(S), { dens, tint, px } = S;
    S.t += dt * speed * 0.02;
    const t = S.t;
    const a = 1.9 + 0.9 * Math.sin(t * 1.0), b = -2.0 + 0.8 * Math.sin(t * 0.73 + 1.3);
    const c = 2.0 + 0.8 * Math.sin(t * 0.61 + 2.9), d = -1.9 + 0.9 * Math.sin(t * 0.47 + 4.1);

    const decay = Math.pow(0.94, dt * 60);
    let max = 0;
    for (let i = 0; i < dens.length; i++) {
        tint[i] *= decay;
        if ((dens[i] *= decay) > max) max = dens[i];
    }

    const sy = Math.min(bw, bh) / 4.3, sx = sy * Math.min(1.6, bw / bh), ox = bw / 2, oy = bh / 2;
    let x = 0, y = 0;
    const count = points * Math.max(0.2, dt * 60); // same work per second at any refresh rate
    for (let i = 0; i < count; i++) {
        if (i % 2000 === 0) { x = Math.random() * 4 - 2; y = Math.random() * 4 - 2; }
        const say = Math.sin(a * y);
        const nx = say - Math.cos(b * x), ny = Math.sin(c * x) - Math.cos(d * y);
        x = nx; y = ny;
        if (i % 2000 < 20) continue; // let a fresh orbit settle onto the attractor first
        const p = (oy + y * sy | 0) * bw + (ox + x * sx | 0);
        dens[p]++;
        tint[p] += say * 0.5 + 0.5;
    }

    S.max += (max - S.max) * 0.1; // smoothed, or the exposure flickers
    const gain = 250 / (S.max + 1), inv = 1 / Math.log1p(250);
    const lo = duoRamp(color, 0), hi = duoRamp(color, 0.5);
    for (let i = 0; i < dens.length; i++) {
        const dn = dens[i];
        if (dn < 0.02) { px[i] = 0xff000000; continue; }
        const v = Math.min(1, Math.log1p(dn * gain) * inv), m = tint[i] / dn, w = v * v * v * 200;
        const r = (lo[0] + (hi[0] - lo[0]) * m) * v + w, g = (lo[1] + (hi[1] - lo[1]) * m) * v + w, bl = (lo[2] + (hi[2] - lo[2]) * m) * v + w;
        px[i] = 0xff000000 | (bl > 255 ? 255 : bl) << 16 | (g > 255 ? 255 : g) << 8 | (r > 255 ? 255 : r);
    }
    S.cx.putImageData(S.img, 0, 0);
    ctx.imageSmoothingEnabled = true;
    ctx.drawImage(S.cv, 0, 0, bw * q, bh * q);
}
