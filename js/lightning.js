// --- Animation 19: Lightning Storm ---
// Bolts are built once (midpoint displacement + forking branches) and then re-strike a few times
// while they fade, lighting the clouds around them from the inside.
let storm = null;

// Tileable-in-x value noise fBm, 0..1
function stormNoise(gw, gh, base, octaves) {
    const P = 512, lat = new Float32Array(P * P).map(Math.random);
    const out = new Float32Array(gw * gh);
    const smooth = t => t * t * (3 - 2 * t);
    for (let y = 0; y < gh; y++) {
        for (let x = 0; x < gw; x++) {
            let v = 0, amp = 0.5, norm = 0;
            for (let o = 0; o < octaves; o++) {
                const per = base << o; // lattice cells across the width at this octave, so x wraps cleanly
                const fx = x / gw * per, fy = y / gw * per + o * 37;
                const x0 = Math.floor(fx), y0 = Math.floor(fy), tx = smooth(fx - x0), ty = smooth(fy - y0);
                const xa = x0 % per, xb = (x0 + 1) % per, ya = y0 % P, yb = (y0 + 1) % P;
                const a = lat[ya * P + xa], b = lat[ya * P + xb], c = lat[yb * P + xa], d = lat[yb * P + xb];
                v += amp * (a + (b - a) * tx + (c - a + (a - b - c + d) * tx) * ty);
                norm += amp;
                amp *= 0.5;
            }
            out[y * gw + x] = v / norm;
        }
    }
    return out;
}

function initStorm(color) {
    const c = hexToRgb(color);
    const mix = (a, b, t) => Math.round(a + (b - a) * t);
    // Clouds at 1/6 resolution: one dark layer, one lit layer (same shape), and the shape mask
    const s = 4, gw = Math.ceil(width / s), gh = Math.ceil(height * 0.7 / s);
    const n = stormNoise(gw, gh, 3, 7);
    const mk = () => { const cv = document.createElement('canvas'); cv.width = gw; cv.height = gh; return cv; };
    const dark = mk(), lit = mk(), tmp = mk();
    const dctx = dark.getContext('2d'), lctx = lit.getContext('2d');
    const di = dctx.createImageData(gw, gh), li = lctx.createImageData(gw, gh);
    for (let y = 0; y < gh; y++) {
        const fall = Math.min(1, (1 - y / gh) * 1.6); // thick at the top, thinning out toward the bottom
        for (let x = 0; x < gw; x++) {
            const v = n[y * gw + x];
            const dens = Math.max(0, Math.min(1, (v - 0.38) / 0.3)) * fall;
            const k = (y * gw + x) * 4;
            const g = Math.max(0.25, Math.min(1.4, 0.4 + (v - 0.45) * 3.5)); // billowy light and shadow inside the cloud
            di.data[k] = mix(30, c.r, 0.05) * g; di.data[k + 1] = mix(32, c.g, 0.05) * g; di.data[k + 2] = mix(42, c.b, 0.05) * g;
            di.data[k + 3] = dens * 255;
            li.data[k] = mix(255, c.r, 0.45) * g * 0.8; li.data[k + 1] = mix(255, c.g, 0.45) * g * 0.8; li.data[k + 2] = mix(255, c.b, 0.45) * g * 0.8;
            li.data[k + 3] = dens * 255;
        }
    }
    dctx.putImageData(di, 0, 0);
    lctx.putImageData(li, 0, 0);

    // Ground: rolling hills silhouette along the bottom
    const ground = new Float32Array(Math.ceil(width / 4) + 2);
    const ph = [Math.random() * 9, Math.random() * 9, Math.random() * 9];
    for (let i = 0; i < ground.length; i++) {
        const x = i * 4 / width;
        ground[i] = height * (0.9 - 0.05 * Math.sin(x * 5 + ph[0]) - 0.025 * Math.sin(x * 13 + ph[1]) - 0.01 * Math.sin(x * 37 + ph[2]));
    }
    const rain = Array.from({ length: Math.round(width * height / 6000) }, () => ({ x: Math.random() * width, y: Math.random() * height, v: 900 + Math.random() * 500 }));

    storm = {
        color, width, height, dark, lit, tmp, ground, rain, events: [], drift: 0, cooldown: 1,
        tint: `${c.r}, ${c.g}, ${c.b}`,
        core: `${mix(255, c.r, 0.15)}, ${mix(255, c.g, 0.15)}, ${mix(255, c.b, 0.15)}`
    };
}

// Jagged polyline from a to b: halve every segment and nudge the midpoint sideways, finer each pass
function stormCrack(ax, ay, bx, by, rough, passes) {
    let pts = [ax, ay, bx, by];
    let disp = Math.hypot(bx - ax, by - ay) * rough;
    for (let p = 0; p < passes; p++, disp *= 0.6) { // 0.6 (not 0.5) keeps it jagged at small scales
        const next = [pts[0], pts[1]];
        for (let i = 0; i < pts.length - 2; i += 2) {
            const x1 = pts[i], y1 = pts[i + 1], x2 = pts[i + 2], y2 = pts[i + 3];
            const dx = x2 - x1, dy = y2 - y1, L = Math.hypot(dx, dy) || 1, o = (Math.random() - 0.5) * disp;
            next.push((x1 + x2) / 2 - dy / L * o, (y1 + y2) / 2 + dx / L * o, x2, y2);
        }
        pts = next;
    }
    return pts;
}

function stormBolt(x0, y0, x1, y1, branches) {
    const lines = [];
    const grow = (pts, depth) => {
        const path = new Path2D();
        path.moveTo(pts[0], pts[1]);
        for (let i = 2; i < pts.length; i += 2) path.lineTo(pts[i], pts[i + 1]);
        lines.push({ path, depth });
        if (depth >= 3) return;
        const count = pts.length / 2;
        for (let i = 2; i < count * 0.8; i++) {
            if (Math.random() > branches * 0.05 / (depth + 1)) continue;
            const x = pts[i * 2], y = pts[i * 2 + 1];
            const j = Math.min(count - 1, i + 2) * 2;
            const ang = Math.atan2(pts[j + 1] - y, pts[j] - x) + (Math.random() < 0.5 ? -1 : 1) * (0.35 + Math.random() * 0.6);
            const len = Math.hypot(x1 - x, y1 - y) * (0.2 + Math.random() * 0.35) / (depth + 1);
            grow(stormCrack(x, y, x + Math.cos(ang) * len, y + Math.sin(ang) * len, 0.3, 4), depth + 1);
        }
    };
    grow(stormCrack(x0, y0, x1, y1, 0.26, 6), 0);
    return lines;
}

function drawLightning(color) {
    const frequency = parseFloat(document.getElementById('lightFreq').value);
    const branches = parseInt(document.getElementById('lightBranches').value);
    const intensity = parseFloat(document.getElementById('lightIntensity').value);

    if (particles.length === 0 || !storm || storm.color !== color || storm.width !== width || storm.height !== height) {
        initStorm(color);
        particles = [storm]; // resetCanvas() empties particles, which forces a rebuild here
    }
    const now = performance.now();
    const dt = Math.min(0.1, (now - (storm.last ?? now)) / 1000);
    storm.last = now;
    const S = storm;
    const groundAt = x => S.ground[Math.max(0, Math.min(S.ground.length - 1, Math.round(x / 4)))];

    // New event: a ground strike, or a flicker hidden inside the clouds
    S.cooldown -= dt * frequency;
    if (S.cooldown <= 0) {
        S.cooldown = 0.6 + Math.random() * 2.5;
        const x = width * (0.1 + Math.random() * 0.8), y = height * (0.12 + Math.random() * 0.15);
        const strike = Math.random() < 0.65;
        const tx = x + (Math.random() - 0.5) * width * 0.3;
        const pulses = [0];
        for (let k = Math.random() * 3 | 0, t = 0; k > 0; k--) pulses.push(t += 0.06 + Math.random() * 0.12);
        S.events.push({
            x, y, born: now / 1000, pulses, strike,
            lines: strike ? stormBolt(x, y, tx, groundAt(tx) + 6, branches) : [],
            life: pulses[pulses.length - 1] + (strike ? 0.6 : 0.45),
            radius: (strike ? 0.35 : 0.25 + Math.random() * 0.2) * width
        });
    }

    // Brightness of each event: a sharp pulse per re-strike, decaying fast
    let flash = 0;
    for (let i = S.events.length - 1; i >= 0; i--) {
        const e = S.events[i], t = now / 1000 - e.born;
        if (t > e.life) { S.events.splice(i, 1); continue; }
        let b = 0;
        for (const p of e.pulses) if (t >= p) b = Math.max(b, Math.exp(-(t - p) * 14));
        e.b = b * intensity * (e.strike ? 1 : 0.6);
        flash = Math.max(flash, e.b);
    }

    // Sky, brightened by the flash
    const sky = ctx.createLinearGradient(0, 0, 0, height);
    sky.addColorStop(0, '#020308');
    sky.addColorStop(1, `rgba(${S.tint}, 0.05)`);
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, width, height);
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, width, height);
    if (flash > 0.01) {
        ctx.fillStyle = `rgba(${S.core}, ${Math.min(0.2, flash * 0.07)})`;
        ctx.fillRect(0, 0, width, height);
    }

    // Clouds drift slowly; each event lights the clouds around it
    S.drift = (S.drift + dt * 0.6) % S.dark.width;
    const sw = width / S.dark.width, sh = height * 0.7 / S.dark.height; // cloud texel -> screen px
    const tile = (img, alpha) => {
        ctx.globalAlpha = alpha;
        ctx.drawImage(img, -S.drift * sw, 0, width, height * 0.7);
        ctx.drawImage(img, width - S.drift * sw, 0, width, height * 0.7);
        ctx.globalAlpha = 1;
    };
    tile(S.dark, 1);
    const tctx = S.tmp.getContext('2d');
    for (const e of S.events) {
        if (e.b < 0.01) continue;
        tctx.globalCompositeOperation = 'source-over';
        tctx.clearRect(0, 0, S.tmp.width, S.tmp.height);
        const gx = e.x / sw, gy = e.y / sh, gr = e.radius / sw;
        const g = tctx.createRadialGradient(gx, gy, 0, gx, gy, gr);
        g.addColorStop(0, `rgba(255,255,255,${Math.min(1, e.b)})`);
        g.addColorStop(1, 'rgba(255,255,255,0)');
        tctx.fillStyle = g;
        tctx.fillRect(0, 0, S.tmp.width, S.tmp.height);
        tctx.globalCompositeOperation = 'source-in';
        const off = S.drift;
        tctx.drawImage(S.lit, -off, 0);
        tctx.drawImage(S.lit, S.tmp.width - off, 0);
        ctx.globalCompositeOperation = 'lighter';
        ctx.drawImage(S.tmp, 0, 0, width, height * 0.7);
        ctx.globalCompositeOperation = 'source-over';
    }
    if (flash > 0.01) tile(S.lit, Math.min(0.35, flash * 0.15)); // the whole deck glows a little

    // Bolts: wide soft glow, then a hot core; branches fade faster than the main channel
    ctx.globalCompositeOperation = 'lighter';
    ctx.lineJoin = 'miter';
    ctx.lineCap = 'round';
    for (const e of S.events) {
        if (!e.lines.length) continue;
        const age = now / 1000 - e.born, linger = Math.max(0, 1 - age / e.life) * 0.25;
        for (const l of e.lines) {
            const b = Math.max(e.b, linger * (l.depth === 0 ? 1 : 0)) / (1 + l.depth * 0.8);
            if (b < 0.01) continue;
            const w = 2.4 / (1 + l.depth);
            ctx.strokeStyle = `rgba(${S.tint}, ${0.05 * b})`; ctx.lineWidth = w * 14; ctx.stroke(l.path);
            ctx.strokeStyle = `rgba(${S.tint}, ${0.22 * b})`; ctx.lineWidth = w * 4; ctx.stroke(l.path);
            ctx.strokeStyle = `rgba(${S.core}, ${Math.min(1, b)})`; ctx.lineWidth = w; ctx.stroke(l.path);
        }
    }
    ctx.globalCompositeOperation = 'source-over';
    ctx.lineCap = 'butt';

    // Rain, lit up by the flash
    ctx.strokeStyle = `rgba(${S.core}, ${0.08 + flash * 0.25})`;
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (const r of S.rain) {
        r.y += r.v * dt;
        r.x -= r.v * dt * 0.15;
        if (r.y > height) { r.y -= height + 20; r.x = Math.random() * width * 1.2; }
        ctx.moveTo(r.x, r.y);
        ctx.lineTo(r.x + 3, r.y - 20);
    }
    ctx.stroke();

    // Ground silhouette, rim-lit during a flash
    ctx.beginPath();
    ctx.moveTo(0, height);
    for (let i = 0; i < S.ground.length; i++) ctx.lineTo(i * 4, S.ground[i]);
    ctx.lineTo(width, height);
    ctx.closePath();
    ctx.fillStyle = '#010102';
    ctx.fill();
    if (flash > 0.01) {
        ctx.strokeStyle = `rgba(${S.tint}, ${Math.min(0.6, flash * 0.4)})`;
        ctx.lineWidth = 1.5;
        ctx.stroke();
    }
}
