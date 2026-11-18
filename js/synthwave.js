// --- Animation 10: Synthwave Grid ---
// Outrun sunset: gradient sky, striped sun with bloom, a glowing floor running to the horizon
// between fogged wireframe canyon walls, and the odd shooting star.
function synthNoise(x, z) { // smooth 2D value noise, 0..1
    const xi = Math.floor(x), zi = Math.floor(z);
    let fx = x - xi, fz = z - zi;
    fx = fx * fx * (3 - 2 * fx);
    fz = fz * fz * (3 - 2 * fz);
    const a = tunnelHash(xi, zi), b = tunnelHash(xi + 1, zi);
    const c = tunnelHash(xi, zi + 1), d = tunnelHash(xi + 1, zi + 1);
    return a + (b - a) * fx + (c - a) * fz + (a - b - c + d) * fx * fz;
}

function drawSynthwave(color) {
    const speed = parseFloat(document.getElementById('synthSpeed').value);
    const density = parseInt(document.getElementById('synthDensity').value);
    const mtnHeight = parseFloat(document.getElementById('synthMtnHeight').value);

    const rgb = hexToRgb(color);
    const haze = { r: 255, g: 60, b: 160 };
    const fillNear = { r: 6, g: 0, b: 14 }, fillFar = { r: 70, g: 14, b: 86 };
    const mix = (p, q, t) => ({ r: p.r + (q.r - p.r) * t, g: p.g + (q.g - p.g) * t, b: p.b + (q.b - p.b) * t });
    const rgba = (c, a) => `rgba(${c.r | 0}, ${c.g | 0}, ${c.b | 0}, ${a})`;

    const cx = width / 2, hy = height * 0.52;
    const f = height * 0.8, camH = 1.2;   // focal length (px), eye height above the floor
    const camZ = time * 3;
    const zFar = 40, pathW = 3.5;         // draw distance, valley half-width
    const proj = (x, y, z) => [cx + x / z * f, hy + (camH - y) / z * f];

    // Sky
    const sky = ctx.createLinearGradient(0, 0, 0, hy);
    sky.addColorStop(0, '#05010f');
    sky.addColorStop(0.5, '#1b0636');
    sky.addColorStop(0.8, '#4b0c5c');
    sky.addColorStop(1, '#b8237a');
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, width, hy);

    // Stars (stored as fractions of the sky so resizes keep them in place)
    if (particles.length === 0) {
        for (let i = 0; i < 220; i++) {
            particles.push({ x: Math.random(), y: Math.random() ** 1.5 * 0.8, s: Math.random() * 1.3 + 0.4, k: Math.random() * 5 + 1, p: Math.random() * 7 });
        }
    }
    ctx.fillStyle = '#fff';
    for (const p of particles) {
        ctx.globalAlpha = (1 - p.y / 0.8) * (0.55 + 0.45 * Math.sin(time * p.k + p.p));
        ctx.fillRect(p.x * width, p.y * hy, p.s, p.s);
    }
    ctx.globalAlpha = 1;

    // Shooting star, now and then
    const cyc = Math.floor(time / 9), ph = (time / 9 - cyc) / 0.15;
    if (ph < 1 && tunnelHash(cyc, 3) < 0.6) {
        const len = Math.min(width, height) * 0.5;
        const x = (0.3 + tunnelHash(cyc, 1) * 0.7) * width - ph * len;
        const y = tunnelHash(cyc, 2) * hy * 0.4 + ph * len * 0.4;
        const tail = ctx.createLinearGradient(x, y, x + 90, y - 36);
        tail.addColorStop(0, `rgba(255, 255, 255, ${Math.sin(ph * Math.PI)})`);
        tail.addColorStop(1, 'rgba(255, 255, 255, 0)');
        ctx.strokeStyle = tail;
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.lineTo(x + 90, y - 36);
        ctx.stroke();
    }

    // Sun: hot gradient, slits that widen toward the bottom and drift down
    const R = Math.min(width, height) * 0.24, sunY = hy - R * 0.35;
    ctx.save();
    ctx.beginPath();
    ctx.arc(cx, sunY, R, 0, Math.PI * 2);
    ctx.clip();
    const sun = ctx.createLinearGradient(0, sunY - R, 0, hy);
    sun.addColorStop(0, '#fff27a');
    sun.addColorStop(0.5, '#ff9a3c');
    sun.addColorStop(1, '#ff1f8f');
    ctx.fillStyle = sun;
    ctx.fillRect(cx - R, sunY - R, R * 2, R * 2);
    const gap = R * 0.13, top = sunY - R * 0.3, bottom = hy;
    ctx.fillStyle = sky;
    for (let y = top - gap + ((time * 0.6) % 1) * gap; y < bottom; y += gap) {
        const t = (y - top) / (bottom - top);
        if (t > 0) ctx.fillRect(cx - R, y, R * 2, gap * (0.06 + 0.7 * t));
    }
    ctx.restore();

    ctx.globalCompositeOperation = 'lighter';
    const glow = ctx.createRadialGradient(cx, sunY, R * 0.5, cx, sunY, R * 2.6);
    glow.addColorStop(0, 'rgba(255, 70, 140, 0.35)');
    glow.addColorStop(1, 'rgba(255, 70, 140, 0)');
    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, width, hy);
    ctx.globalCompositeOperation = 'source-over';

    // Ground
    const ground = ctx.createLinearGradient(0, hy, 0, height);
    ground.addColorStop(0, '#2a0838');
    ground.addColorStop(0.25, '#0c0216');
    ground.addColorStop(1, '#000');
    ctx.fillStyle = ground;
    ctx.fillRect(0, hy, width, height - hy);

    // Canyon walls: heightfield either side of the valley, painted far to near, outside in
    const cell = 1.25, rows = Math.ceil(zFar / cell), cols = 26;
    const row0 = Math.floor(camZ / cell) + 1;
    const grid = [];
    for (let j = 0; j <= rows; j++) {
        const wz = (row0 + j) * cell, z = wz - camZ;
        const sides = [-1, 1].map(s => {
            const pts = [];
            for (let c = 0; c <= cols; c++) {
                const x = s * (pathW + c * cell), r = c * cell;
                const n = synthNoise(x * 0.18, wz * 0.18) * 0.65 + synthNoise(x * 0.5, wz * 0.5) * 0.35;
                const h = mtnHeight * (1 - Math.exp(-r / 3)) * (0.5 + 7 * n * n * n);
                pts.push([...proj(x, h, Math.max(z, 0.05)), h]);
            }
            return pts;
        });
        grid.push({ z, sides });
    }
    ctx.lineJoin = 'round';
    for (let j = rows - 1; j >= 0; j--) {
        const near = grid[j], far = grid[j + 1];
        if (near.z < 0.3) continue;
        const fog = Math.min(1, ((near.z + far.z) / 2 / zFar) ** 1.2);
        const fill = rgba(mix(fillNear, fillFar, fog), 1);
        const line = mix(rgb, haze, fog);
        ctx.lineWidth = Math.max(0.6, Math.min(2, f * 0.006 / near.z));
        for (let s = 0; s < 2; s++) {
            const a = near.sides[s], b = far.sides[s];
            for (let c = cols - 1; c >= 0; c--) {
                const p1 = a[c], p2 = a[c + 1], p3 = b[c + 1], p4 = b[c];
                if (Math.max(p1[0], p2[0], p3[0], p4[0]) < 0 || Math.min(p1[0], p2[0], p3[0], p4[0]) > width) continue;
                if (Math.min(p1[1], p2[1], p3[1], p4[1]) > height) continue;
                ctx.beginPath();
                ctx.moveTo(p1[0], p1[1]);
                ctx.lineTo(p2[0], p2[1]);
                ctx.lineTo(p3[0], p3[1]);
                ctx.lineTo(p4[0], p4[1]);
                ctx.closePath();
                ctx.fillStyle = fill;
                ctx.fill();
                const peak = Math.min(1, Math.max(p1[2], p2[2], p3[2], p4[2]) / 4);
                ctx.strokeStyle = rgba(line, (1 - fog) ** 0.8 * (0.3 + 0.7 * peak));
                ctx.stroke();
            }
        }
    }

    // Floor grid with bloom: a wide faint pass under a crisp one
    ctx.globalCompositeOperation = 'lighter';
    ctx.lineCap = 'round';
    const fc = 16 / density;
    const zMin = camH * f / (height - hy) * 0.9;
    for (let k = Math.ceil((camZ + zMin) / fc); k * fc - camZ < zFar; k++) {
        const z = k * fc - camZ, fog = z / zFar;
        const [x1, y] = proj(-pathW, 0, z), [x2] = proj(pathW, 0, z);
        const c = mix(rgb, haze, fog), a = (1 - fog) ** 1.5, lw = Math.max(0.6, Math.min(3, f * 0.004 / z));
        ctx.beginPath();
        ctx.moveTo(x1, y);
        ctx.lineTo(x2, y);
        ctx.strokeStyle = rgba(c, a * 0.2);
        ctx.lineWidth = lw * 5;
        ctx.stroke();
        ctx.strokeStyle = rgba(c, a);
        ctx.lineWidth = lw;
        ctx.stroke();
    }
    const [, yNear] = proj(0, 0, zMin), [, yFar] = proj(0, 0, zFar);
    const fade = (a) => {
        const g = ctx.createLinearGradient(0, yNear, 0, yFar);
        g.addColorStop(0, rgba(rgb, a));
        g.addColorStop(1, rgba(haze, 0));
        return g;
    };
    const n = Math.round(pathW / fc);
    ctx.beginPath();
    for (let i = -n; i <= n; i++) {
        const x = i * pathW / n;
        ctx.moveTo(...proj(x, 0, zMin));
        ctx.lineTo(...proj(x, 0, zFar));
    }
    ctx.strokeStyle = fade(0.2);
    ctx.lineWidth = 8;
    ctx.stroke();
    ctx.strokeStyle = fade(1);
    ctx.lineWidth = 1.6;
    ctx.stroke();
    ctx.lineCap = 'butt';

    // Horizon haze
    const hz = ctx.createLinearGradient(0, hy - height * 0.08, 0, hy + height * 0.06);
    hz.addColorStop(0, rgba(haze, 0));
    hz.addColorStop(0.6, rgba(haze, 0.35));
    hz.addColorStop(1, rgba(haze, 0));
    ctx.fillStyle = hz;
    ctx.fillRect(0, hy - height * 0.08, width, height * 0.14);
    ctx.globalCompositeOperation = 'source-over';

    time += 0.02 * speed;
}
