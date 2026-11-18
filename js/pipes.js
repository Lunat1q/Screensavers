// --- Animation 21: 3D Pipes ---
// Pipes grow cell by cell through a 3D grid, turning at random and never crossing themselves.
// Every piece is a depth-sorted 2D drawing (painter's algorithm): tubes are stacked strokes
// and joints stacked discs, each lighter and nudged toward the light, which reads as a shiny cylinder.
let pipes = null;
const PIPE_DIRS = [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]];

function initPipes(color, colorMode) {
    const ny = 11, nz = 11, nx = Math.max(8, Math.round(ny * width / height));
    const side = () => (Math.random() < 0.5 ? -1 : 1);
    const yaw = side() * (0.25 + Math.random() * 0.3), pitch = side() * (0.12 + Math.random() * 0.2);
    pipes = {
        color, colorMode, width, height, nx, ny, nz,
        grid: new Uint8Array(nx * ny * nz),
        items: [], live: [], filled: 0, fade: 0,
        cy: Math.cos(yaw), sy: Math.sin(yaw), cp: Math.cos(pitch), sp: Math.sin(pitch),
        dist: Math.max(nx, ny, nz) * 1.6
    };
    pipes.focal = Math.min(width / nx, height / ny) * pipes.dist * 0.85;
}

// Grid coords -> camera space: centered, turned by yaw then pitch, pushed away from the eye
function pipeCam(x, y, z) {
    const P = pipes;
    x -= (P.nx - 1) / 2; y -= (P.ny - 1) / 2; z -= (P.nz - 1) / 2;
    const x1 = x * P.cy + z * P.sy, z1 = z * P.cy - x * P.sy;
    const y1 = y * P.cp - z1 * P.sp, z2 = z1 * P.cp + y * P.sp + P.dist;
    return [width / 2 + x1 * P.focal / z2, height / 2 + y1 * P.focal / z2, z2];
}

function pipeColor(P) {
    if (P.colorMode === 'base') {
        const c = hexToRgb(P.color), k = 0.75 + Math.random() * 0.5;
        return [c.r * k, c.g * k, c.b * k];
    }
    // Random saturated hue (HSL with s=0.85, l=0.5)
    const h = Math.random() * 12;
    const f = n => { const k = (n + h) % 12; return 255 * (0.5 - 0.425 * Math.max(-1, Math.min(k - 3, 9 - k, 1))); };
    return [f(0), f(8), f(4)];
}

function pipeShades(rgb) {
    const s = (k, w) => `rgb(${rgb.map(v => Math.min(255, Math.round(v * k + 255 * w))).join(',')})`;
    return [s(0.25, 0), s(0.5, 0), s(0.78, 0), s(1, 0.05), s(0.55, 0.45)];
}

function pipeFree(x, y, z) {
    const P = pipes;
    return x >= 0 && y >= 0 && z >= 0 && x < P.nx && y < P.ny && z < P.nz && !P.grid[(z * P.ny + y) * P.nx + x];
}

function pipeTake(x, y, z) {
    pipes.grid[(z * pipes.ny + y) * pipes.nx + x] = 1;
    pipes.filled++;
}

function pipeAdd(item) {
    const items = pipes.items, d = item.depth;
    let lo = 0, hi = items.length; // keep sorted far -> near
    while (lo < hi) { const m = (lo + hi) >> 1; if (items[m].depth > d) lo = m + 1; else hi = m; }
    items.splice(lo, 0, item);
}

function pipeJoint(p, big) {
    pipeAdd({ kind: 'ball', p: [p.x, p.y, p.z], r: big ? 0.34 : 0.24, shades: p.shades, depth: pipeCam(p.x, p.y, p.z)[2] });
}

function pipeSpawn() {
    for (let tries = 0; tries < 40; tries++) {
        const x = Math.random() * pipes.nx | 0, y = Math.random() * pipes.ny | 0, z = Math.random() * pipes.nz | 0;
        if (!pipeFree(x, y, z)) continue;
        pipeTake(x, y, z);
        const p = { x, y, z, dir: Math.random() * 6 | 0, shades: pipeShades(pipeColor(pipes)), balls: Math.random() < 0.5, prog: 0, head: null };
        pipeJoint(p, true);
        pipes.live.push(p);
        return true;
    }
    return false;
}

// Advance one cell; false when boxed in
function pipeStep(p) {
    const ok = d => pipeFree(p.x + PIPE_DIRS[d][0], p.y + PIPE_DIRS[d][1], p.z + PIPE_DIRS[d][2]);
    let dir = p.dir;
    if (!ok(dir) || Math.random() < 0.25) {
        const opts = [0, 1, 2, 3, 4, 5].filter(d => (d ^ 1) !== p.dir && ok(d) && d !== p.dir);
        if (opts.length) dir = opts[Math.random() * opts.length | 0];
        else if (!ok(dir)) return false;
    }
    if (dir !== p.dir) pipeJoint(p, p.balls);
    const [dx, dy, dz] = PIPE_DIRS[dir];
    const a = [p.x, p.y, p.z], b = [p.x + dx, p.y + dy, p.z + dz];
    p.dir = dir; p.x = b[0]; p.y = b[1]; p.z = b[2];
    pipeTake(p.x, p.y, p.z);
    p.head = { kind: 'seg', a, b, pipe: p, shades: p.shades, depth: pipeCam((a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2)[2] };
    pipeAdd(p.head);
    return true;
}

function pipeDraw(it) {
    const s = it.shades;
    if (it.kind === 'ball') {
        const [x, y, z] = pipeCam(...it.p), r = it.r * pipes.focal / z;
        const k = [1, 0.8, 0.55, 0.32, 0.12];
        for (let i = 0; i < 5; i++) {
            const o = r * (1 - k[i]) * 0.55;
            ctx.fillStyle = s[i];
            ctx.beginPath();
            ctx.arc(x - o, y - o, r * k[i], 0, Math.PI * 2);
            ctx.fill();
        }
        return;
    }
    let b = it.b;
    if (it.pipe.head === it && it.pipe.prog < 1) { // the growing tip
        const t = it.pipe.prog;
        b = [it.a[0] + (b[0] - it.a[0]) * t, it.a[1] + (b[1] - it.a[1]) * t, it.a[2] + (b[2] - it.a[2]) * t];
    }
    const [x1, y1, z1] = pipeCam(...it.a), [x2, y2, z2] = pipeCam(...b);
    const r = 0.24 * pipes.focal * 2 / (z1 + z2);
    let nx = y1 - y2, ny = x2 - x1;
    const L = Math.hypot(nx, ny);
    if (L < 0.5) return; // end-on, the joints cover it
    nx /= L; ny /= L;
    if (nx + ny > 0) { nx = -nx; ny = -ny; } // normal pointing toward the light (upper left)
    const ex = (x2 - x1) / L * 1.5, ey = (y2 - y1) / L * 1.5; // overlap neighbours to hide AA seams
    const k = [1, 0.75, 0.5, 0.28, 0.1];
    for (let i = 0; i < 5; i++) {
        const o = r * (1 - k[i]) * 0.6;
        ctx.strokeStyle = s[i];
        ctx.lineWidth = 2 * r * k[i];
        ctx.beginPath();
        ctx.moveTo(x1 - ex + nx * o, y1 - ey + ny * o);
        ctx.lineTo(x2 + ex + nx * o, y2 + ey + ny * o);
        ctx.stroke();
    }
}

function drawPipes(color) {
    const speed = parseFloat(document.getElementById('pipeSpeed').value);
    const count = parseInt(document.getElementById('pipeCount').value);
    const fill = parseFloat(document.getElementById('pipeFill').value) / 100;
    const colorMode = document.getElementById('pipeColors').value;

    if (particles.length === 0 || !pipes || pipes.color !== color || pipes.colorMode !== colorMode ||
        pipes.width !== width || pipes.height !== height) {
        initPipes(color, colorMode);
        particles = [pipes]; // resetCanvas() empties particles, which forces a rebuild here
    }
    const P = pipes;
    const now = performance.now();
    const dt = Math.min(0.1, (now - (P.last ?? now)) / 1000);
    P.last = now;

    const full = P.filled >= fill * P.nx * P.ny * P.nz;
    if (P.fade > 0 || (full && !P.live.length)) {
        P.fade += dt / 1.5;
        if (P.fade >= 1) { initPipes(color, colorMode); particles = [pipes]; return; }
    } else {
        while (!full && P.live.length < count && pipeSpawn());
        if (!P.live.length && !full) P.fade = 0.001; // nowhere left to start: wipe and begin again
        for (let i = P.live.length - 1; i >= 0; i--) {
            const p = P.live[i];
            p.prog += dt * speed * 4;
            while (p.prog >= 1) {
                p.prog -= 1;
                if (full || !pipeStep(p)) { pipeJoint(p, true); p.prog = 1; P.live.splice(i, 1); break; }
            }
        }
    }

    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, width, height);
    ctx.lineCap = 'butt';
    for (const it of P.items) pipeDraw(it); // ponytail: full redraw each frame; cache settled pipes on a layer if it gets slow
    if (P.fade > 0) {
        ctx.fillStyle = `rgba(0, 0, 0, ${Math.min(1, P.fade)})`;
        ctx.fillRect(0, 0, width, height);
    }
}

// Seconds since this state's previous frame, capped so a background tab doesn't jump
function frameDt(s) {
    const now = performance.now();
    const dt = Math.min(0.1, (now - (s.last ?? now)) / 1000);
    s.last = now;
    return dt;
}

// Base color, its hue rotated by a third of the wheel, and a 3-stop ramp between them and white
function duoRamp(color, t) {
    const c = hexToRgb(color), a = [c.b, c.r, c.g], b = [c.r, c.g, c.b];
    return t < 0.5 ? a.map((v, i) => v + (b[i] - v) * t * 2) : b.map(v => v + (255 - v) * (t - 0.5) * 1.4);
}
