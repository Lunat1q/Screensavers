// --- Animation 22: Strange Attractors ---
// Thousands of particles follow a chaotic ODE in 3D; additive trails trace out the attractor's shape.
let attractor = null;
const ATTRACTORS = {
    lorenz: { dt: 0.005, scale: 25, c: [0, 0, 25], f(x, y, z, o) { o[0] = 10 * (y - x); o[1] = x * (28 - z) - y; o[2] = x * y - 8 / 3 * z; } },
    thomas: { dt: 0.045, scale: 4, c: [0, 0, 0], f(x, y, z, o) { o[0] = Math.sin(y) - 0.208 * x; o[1] = Math.sin(z) - 0.208 * y; o[2] = Math.sin(x) - 0.208 * z; } },
    aizawa: { dt: 0.01, scale: 1.9, c: [0, 0, 0.5], f(x, y, z, o) {
        o[0] = (z - 0.7) * x - 3.5 * y; o[1] = 3.5 * x + (z - 0.7) * y;
        o[2] = 0.6 + 0.95 * z - z * z * z / 3 - (x * x + y * y) * (1 + 0.25 * z) + 0.1 * z * x * x * x;
    } },
    halvorsen: { dt: 0.005, scale: 13, c: [-2.5, -2.5, -2.5], f(x, y, z, o) {
        o[0] = -1.89 * x - 4 * y - 4 * z - y * y; o[1] = -1.89 * y - 4 * z - 4 * x - z * z; o[2] = -1.89 * z - 4 * x - 4 * y - x * x;
    } }
};

function drawAttractor(color) {
    const kind = document.getElementById('attrKind').value;
    const n = parseInt(document.getElementById('attrCount').value);
    const speed = parseFloat(document.getElementById('attrSpeed').value);
    const trail = parseFloat(document.getElementById('attrTrail').value);

    if (particles.length === 0 || !attractor || attractor.n !== n) {
        attractor = {
            n, pos: new Float32Array(n * 3).map(() => Math.random() - 0.5), scr: new Float32Array(n * 2).fill(NaN),
            t: 0, rot: Math.random() * 6, scale: 0, c: [0, 0, 0], vmax: 1e-9
        };
        particles = [attractor]; // resetCanvas() empties particles, which forces a rebuild here
    }
    const A = attractor, dt = frameDt(A), k = dt * 60;
    const names = Object.keys(ATTRACTORS);
    const S = ATTRACTORS[kind === 'cycle' ? names[Math.floor(A.t / 40) % names.length] : kind] || ATTRACTORS.lorenz;
    A.t += dt;
    A.rot += dt * 0.12;

    // Ease the camera toward the current system's size and center so switches glide
    const e = A.scale ? 1 - Math.exp(-dt * 1.2) : 1;
    if (!A.scale) A.pos.forEach((v, i) => { A.pos[i] = S.c[i % 3] + v * S.scale * 1.5; }); // first frame: scatter across the system
    A.scale += (S.scale - A.scale) * e;
    for (let i = 0; i < 3; i++) A.c[i] += (S.c[i] - A.c[i]) * e;

    ctx.globalCompositeOperation = 'source-over';
    // Fade at 30 Hz whatever the refresh rate: tiny per-frame alphas round to nothing on an 8-bit canvas and leave ghosts
    A.fade = (A.fade || 0) + dt;
    if (A.fade >= 1 / 30) {
        ctx.fillStyle = `rgba(0, 0, 0, ${1 - Math.pow(1 - trail, A.fade * 60)})`;
        ctx.fillRect(0, 0, width, height);
        A.fade = 0;
    }

    const B = 24, paths = Array.from({ length: B }, () => new Path2D());
    const o = [0, 0, 0], h = S.dt * speed * k / 2, lim = (S.scale * 6) ** 2;
    const cr = Math.cos(A.rot), sr = Math.sin(A.rot), cp = Math.cos(0.35), sp = Math.sin(0.35);
    const unit = Math.min(width, height) * 0.46, { pos, scr } = A;
    let fmax = 0;
    for (let i = 0; i < n; i++) {
        let x = pos[i * 3], y = pos[i * 3 + 1], z = pos[i * 3 + 2], skip = false;
        for (let s = 0; s < 2; s++) { S.f(x, y, z, o); x += o[0] * h; y += o[1] * h; z += o[2] * h; }
        if (!(x * x + y * y + z * z < lim)) { // flew off (or NaN): drop it back near the origin
            x = Math.random() - 0.5; y = Math.random() - 0.5; z = Math.random() - 0.5; skip = true;
        }
        pos[i * 3] = x; pos[i * 3 + 1] = y; pos[i * 3 + 2] = z;
        const v = Math.hypot(o[0], o[1], o[2]) * S.dt / S.scale;
        if (v > fmax) fmax = v;

        const X = (x - A.c[0]) / A.scale, Y = (y - A.c[1]) / A.scale, Z = (z - A.c[2]) / A.scale; // z is up
        const x1 = X * cr - Y * sr, d = X * sr + Y * cr;
        const pf = unit * 3.2 / (3.2 + d * cp + Z * sp);
        const sx = width / 2 + x1 * pf, sy = height / 2 + (d * sp - Z * cp) * pf;
        const ox = scr[i * 2], oy = scr[i * 2 + 1];
        if (ox === ox && !skip) {
            const p = paths[Math.min(B - 1, Math.sqrt(v / A.vmax) * B | 0)];
            p.moveTo(ox, oy);
            p.lineTo(sx, sy);
        }
        scr[i * 2] = skip ? NaN : sx; scr[i * 2 + 1] = sy;
    }
    A.vmax = Math.max(A.vmax * 0.98, fmax);

    ctx.globalCompositeOperation = 'lighter';
    ctx.lineWidth = Math.max(1, height / 900);
    ctx.lineCap = 'round';
    for (let b = 0; b < B; b++) {
        ctx.strokeStyle = `rgba(${duoRamp(color, b / (B - 1)).map(Math.round).join(',')}, 0.5)`;
        ctx.stroke(paths[b]);
    }
    ctx.globalCompositeOperation = 'source-over';
}
