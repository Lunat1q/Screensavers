// --- Animation 11: Cyber Tunnel ---
// Perspective flight through a wireframe tube. The path bends and the camera looks along its
// tangent (banking into turns); rings fade into fog, panels flicker and light packets race past.
function tunnelHash(a, b) { // stable pseudo-random 0..1 per (ring, lane)
    const s = Math.sin(a * 127.1 + b * 311.7) * 43758.5453;
    return s - Math.floor(s);
}

function drawTunnel(color) {
    const speed = parseFloat(document.getElementById('tunnelSpeed').value);
    const ringCount = parseInt(document.getElementById('tunnelRings').value);
    const sides = parseInt(document.getElementById('tunnelSides').value);
    const curve = parseFloat(document.getElementById('tunnelCurve').value);

    ctx.fillStyle = 'rgba(0, 0, 0, 0.5)'; // short trails read as motion blur
    ctx.fillRect(0, 0, width, height);

    const rgb = hexToRgb(color);
    const far = { r: rgb.b, g: rgb.r, b: rgb.g }; // channel rotation = 120° hue shift into the distance
    const cx = width / 2, cy = height / 2;
    const fov = Math.min(width, height) * 0.9;
    const gap = 0.6;                 // ring spacing (tunnel radius = 1)
    const depth = ringCount * gap;
    const camZ = time * speed * 0.7;

    const pathX = w => curve * (Math.sin(w * 0.21) * 1.6 + Math.sin(w * 0.087 + 1.3) * 2.4);
    const pathY = w => curve * (Math.cos(w * 0.17) * 1.2 + Math.sin(w * 0.061 + 0.4) * 1.8);
    const look = 7; // camera aims at the path point this far ahead
    const px0 = pathX(camZ), py0 = pathY(camZ);
    const sx = (pathX(camZ + look) - px0) / look, sy = (pathY(camZ + look) - py0) / look;
    const roll = time * speed * 0.08 - sx * 0.6;
    const cr = Math.cos(roll), sr = Math.sin(roll);

    // World point (w along path, angle a around it, radius r) -> screen.
    const project = (w, a, r) => {
        const z = w - camZ;
        const x = pathX(w) - px0 - sx * z + Math.cos(a + w * 0.05) * r;
        const y = pathY(w) - py0 - sy * z + Math.sin(a + w * 0.05) * r;
        return [cx + (x * cr - y * sr) / z * fov, cy + (x * sr + y * cr) / z * fov];
    };
    const tint = (t, a) => {
        const r = rgb.r + (far.r - rgb.r) * t, g = rgb.g + (far.g - rgb.g) * t, b = rgb.b + (far.b - rgb.b) * t;
        return `rgba(${r | 0}, ${g | 0}, ${b | 0}, ${a})`;
    };

    ctx.globalCompositeOperation = 'lighter';

    // Glow at the vanishing point
    const [vx, vy] = project(camZ + depth, 0, 0);
    const glowR = Math.min(width, height) * 0.35;
    const glow = ctx.createRadialGradient(vx, vy, 0, vx, vy, glowR);
    glow.addColorStop(0, tint(1, 0.18));
    glow.addColorStop(1, tint(1, 0));
    ctx.fillStyle = glow;
    ctx.fillRect(vx - glowR, vy - glowR, glowR * 2, glowR * 2);

    // Ring vertices, nearest first
    const i0 = Math.floor(camZ / gap) + 1;
    const rings = [];
    for (let n = 0; n <= ringCount; n++) {
        const i = i0 + n, w = i * gap, z = w - camZ;
        if (z < 0.08) continue;
        const pts = [];
        for (let k = 0; k < sides; k++) pts.push(project(w, (k / sides) * Math.PI * 2, 1));
        rings.push({ i, z, pts, fog: Math.pow(1 - z / depth, 1.6) });
    }

    // Far to near so close geometry lands on top
    for (let n = rings.length - 1; n >= 0; n--) {
        const ring = rings[n], next = rings[n + 1], p = ring.pts, t = ring.z / depth;
        const lw = Math.min(4, Math.max(0.5, fov * 0.012 / ring.z));

        if (next) {
            // Lit panels
            for (let k = 0; k < sides; k++) {
                const h = tunnelHash(ring.i, k);
                if (h < 0.9) continue;
                const k2 = (k + 1) % sides, q = next.pts;
                ctx.fillStyle = tint(t, ring.fog * 0.22 * (0.6 + 0.4 * Math.sin(time * 6 + h * 90)));
                ctx.beginPath();
                ctx.moveTo(p[k][0], p[k][1]); ctx.lineTo(p[k2][0], p[k2][1]);
                ctx.lineTo(q[k2][0], q[k2][1]); ctx.lineTo(q[k][0], q[k][1]);
                ctx.fill();
            }
            // Lanes along the tube
            ctx.strokeStyle = tint(t, ring.fog * 0.35);
            ctx.lineWidth = lw * 0.6;
            ctx.beginPath();
            for (let k = 0; k < sides; k++) {
                ctx.moveTo(p[k][0], p[k][1]);
                ctx.lineTo(next.pts[k][0], next.pts[k][1]);
            }
            ctx.stroke();
        }

        // Ring: wide faint pass for bloom, then the crisp line; every 5th ring is a bright gate
        const gate = ring.i % 5 === 0 ? 1.8 : 1;
        ctx.beginPath();
        p.forEach(([x, y], k) => k ? ctx.lineTo(x, y) : ctx.moveTo(x, y));
        ctx.closePath();
        ctx.strokeStyle = tint(t, ring.fog * 0.12 * gate);
        ctx.lineWidth = lw * 5 * gate;
        ctx.stroke();
        ctx.strokeStyle = tint(t, Math.min(1, ring.fog * 0.8 * gate));
        ctx.lineWidth = lw * gate;
        ctx.stroke();
    }

    // Light packets rushing toward the camera along the lanes
    ctx.lineCap = 'round';
    for (let k = 0; k < sides; k++) {
        const z = depth - ((time * speed * 1.6 + tunnelHash(k, 7) * depth) % depth);
        if (z < 0.3) continue;
        const a = (k / sides) * Math.PI * 2;
        const [x1, y1] = project(camZ + z, a, 0.98);
        const [x2, y2] = project(camZ + z + 0.9, a, 0.98);
        const fog = Math.pow(1 - z / depth, 1.2);
        ctx.strokeStyle = `rgba(255, 255, 255, ${fog * 0.9})`;
        ctx.lineWidth = Math.min(6, Math.max(1, fov * 0.02 / z));
        ctx.beginPath();
        ctx.moveTo(x1, y1);
        ctx.lineTo(x2, y2);
        ctx.stroke();
    }
    ctx.lineCap = 'butt';
    ctx.globalCompositeOperation = 'source-over';

    time += 0.02;
}
