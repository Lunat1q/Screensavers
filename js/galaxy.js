// --- Animation 15: Galaxy Spiral ---
// Density-wave model: each star rides an N-fold distorted orbit whose orientation twists with radius.
// The arms are a slowly turning pattern that stars flow through (inner stars orbit faster), and stars
// brighten while crossing an arm, the way young blue stars light up real spiral arms.
let galaxy = null;

function makeGlowSprite(r, g, b, size = 64) {
    const c = document.createElement('canvas');
    c.width = c.height = size;
    const sctx = c.getContext('2d');
    const grad = sctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
    grad.addColorStop(0, `rgba(${r}, ${g}, ${b}, 1)`);
    grad.addColorStop(0.25, `rgba(${r}, ${g}, ${b}, 0.45)`);
    grad.addColorStop(1, `rgba(${r}, ${g}, ${b}, 0)`);
    sctx.fillStyle = grad;
    sctx.fillRect(0, 0, size, size);
    return c;
}

function gaussRand() {
    return (Math.random() + Math.random() + Math.random() + Math.random() - 2) * 0.87;
}

function initGalaxy(starCount, armCount, color) {
    const rgb = hexToRgb(color);
    const mix = (a, b, t) => Math.round(a + (b - a) * t);
    const tint = t => `rgb(${mix(255, rgb.r, t)}, ${mix(255, rgb.g, t)}, ${mix(255, rgb.b, t)})`;

    const bodies = [];
    const add = (kind, a, extra) => bodies.push({
        kind, a,
        phase: Math.random() * Math.PI * 2,
        e: 0.12 + Math.random() * 0.12,
        z: gaussRand() * (kind === 'bulge' ? 0.12 : 0.025),
        ...extra
    });

    for (let i = 0; i < starCount; i++) {
        const roll = Math.random();
        if (roll < 0.22) { // bulge: dense, warm, old stars
            add('bulge', Math.abs(gaussRand()) * 0.13, {
                size: Math.random() < 0.1 ? 2 : 1,
                bright: 0.4 + Math.random() * 0.6,
                fill: `rgb(255, ${200 + Math.random() * 40 | 0}, ${140 + Math.random() * 60 | 0})`
            });
        } else if (roll < 0.85) { // disk: exponential falloff, white with a hint of the base color
            add('disk', 0.05 - Math.log(1 - Math.random() * 0.95) * 0.33, {
                size: Math.random() < 0.15 ? 2 : 1,
                bright: 0.45 + Math.random() * 0.55,
                fill: tint(Math.random() * 0.4)
            });
        } else { // young stars: only shine inside the arms, strongly tinted
            add('young', 0.15 + Math.random() * 0.85, {
                size: 2 + Math.random() * 3,
                bright: 0.5 + Math.random() * 0.5,
                fill: Math.random() < 0.15 ? 'pink' : 'blue'
            });
        }
    }
    const extras = Math.max(60, starCount / 4 | 0);
    for (let i = 0; i < extras; i++) add('haze', 0.08 + Math.random() * 0.9, { size: 24 + Math.random() * 40 });
    for (let i = 0; i < extras; i++) add('dust', 0.1 + Math.random() * 0.75, { size: 14 + Math.random() * 26 });

    // Static background starfield, drawn once.
    const bg = document.createElement('canvas');
    bg.width = width;
    bg.height = height;
    const bgc = bg.getContext('2d');
    for (let i = 0; i < (width * height) / 2500; i++) {
        const s = Math.random() < 0.1 ? 2 : 1;
        bgc.globalAlpha = Math.random() * Math.random() * 0.7;
        bgc.fillStyle = Math.random() < 0.2 ? tint(0.5) : '#fff';
        bgc.fillRect(Math.random() * width, Math.random() * height, s, s);
    }

    galaxy = {
        starCount, armCount, color, bodies, bg,
        haze: makeGlowSprite(mix(rgb.r, 120, 0.3), mix(rgb.g, 140, 0.3), mix(rgb.b, 255, 0.3)),
        blue: makeGlowSprite(mix(rgb.r, 255, 0.35), mix(rgb.g, 255, 0.35), mix(rgb.b, 255, 0.35), 32),
        pink: makeGlowSprite(255, 110, 170, 32),
        dust: makeGlowSprite(0, 0, 0),
        core: makeGlowSprite(255, 225, 180, 128)
    };
}

function drawGalaxy(color) {
    const starCount = parseInt(document.getElementById('galaxyStars').value);
    const rotSpeed = parseFloat(document.getElementById('galaxySpeed').value) / 10; // slider 1 = old 0.1, 30 = old 3
    const armCount = parseInt(document.getElementById('galaxyArms').value);

    if (particles.length === 0 || !galaxy || galaxy.starCount !== starCount || galaxy.armCount !== armCount ||
        galaxy.color !== color || galaxy.bg.width !== width || galaxy.bg.height !== height) {
        initGalaxy(starCount, armCount, color);
        particles = galaxy.bodies; // resetCanvas() empties particles, which forces a rebuild here
    }

    ctx.globalAlpha = 1;
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, width, height);
    ctx.drawImage(galaxy.bg, 0, 0);

    const cx = width / 2;
    const cy = height / 2;
    const R = Math.min(width, height) * 0.46;
    // Advance by real elapsed time (not per frame) so speed is the same on 60 Hz and 165 Hz displays,
    // and accumulate so moving the slider changes speed smoothly instead of jumping the phase.
    const now = performance.now();
    const dt = Math.min(0.1, (now - (galaxy.last ?? now)) / 1000);
    galaxy.last = now;
    galaxy.t = (galaxy.t || 0) + dt * 0.96 * rotSpeed; // 0.96/s = the old 0.016 per frame at 60 fps
    const t = galaxy.t;
    const pattern = t * 0.05;                      // the arm pattern turns slowly
    const incl = 0.85 + Math.sin(t * 0.02) * 0.15; // and the viewing tilt gently wobbles
    const cosI = Math.cos(incl), sinI = Math.sin(incl);
    const roll = -0.35, cosR = Math.cos(roll), sinR = Math.sin(roll);
    const N = armCount;

    for (const b of galaxy.bodies) {
        const M = b.phase + t * 0.35 / (0.2 + b.a);   // differential rotation: inner orbits are faster, but no core whirl
        const th = M - (b.kind === 'bulge' ? 0 : 0.8 / N) * Math.sin(N * M); // stars slow down (pile up) on arm crests
        const twist = 2.6 * Math.log(1 + b.a * 8);    // log-spiral arm winding
        const r = b.a * (1 + b.e * Math.cos(N * th)) * R;
        const ang = th - twist + pattern;   // winding opposes rotation: arms trail, like real spirals
        const gx = Math.cos(ang) * r;
        const gy = Math.sin(ang) * r * cosI + b.z * R * sinI;
        b.x = cx + gx * cosR - gy * sinR;
        b.y = cy + gx * sinR + gy * cosR;
        b.arm = (Math.cos(N * th) + 1) / 2;           // 1 on an arm crest, 0 between arms
    }

    // Glowing gas along the arms.
    ctx.globalCompositeOperation = 'lighter';
    for (const b of galaxy.bodies) {
        if (b.kind !== 'haze') continue;
        ctx.globalAlpha = 0.02 + Math.pow(b.arm, 3) * 0.2 * (1 - b.a * 0.5);
        ctx.drawImage(galaxy.haze, b.x - b.size / 2, b.y - b.size / 2, b.size, b.size);
    }

    // Bulge glow, flattened by the tilt, plus a bright nucleus.
    const coreSize = R * 0.7;
    const coreH = coreSize * (cosI + 0.2);
    ctx.globalAlpha = 0.55;
    ctx.drawImage(galaxy.core, cx - coreSize / 2, cy - coreH / 2, coreSize, coreH);
    ctx.globalAlpha = 0.9;
    ctx.drawImage(galaxy.core, cx - coreSize / 8, cy - coreSize / 8, coreSize / 4, coreSize / 4);

    // Dust lanes darken the arm crests.
    ctx.globalCompositeOperation = 'source-over';
    for (const b of galaxy.bodies) {
        if (b.kind !== 'dust') continue;
        ctx.globalAlpha = Math.pow(b.arm, 6) * 0.35;
        ctx.drawImage(galaxy.dust, b.x - b.size / 2, b.y - b.size / 2, b.size, b.size);
    }

    // Stars.
    ctx.globalCompositeOperation = 'lighter';
    for (const b of galaxy.bodies) {
        if (b.kind === 'haze' || b.kind === 'dust') continue;
        if (b.kind === 'young') {
            const a = Math.pow(b.arm, 4) * b.bright;
            if (a < 0.02) continue;
            ctx.globalAlpha = a;
            const s = b.size * (0.6 + b.arm * 0.6) * 2;
            ctx.drawImage(b.fill === 'pink' ? galaxy.pink : galaxy.blue, b.x - s / 2, b.y - s / 2, s, s);
        } else {
            ctx.globalAlpha = Math.min(1, b.bright * (b.kind === 'disk' ? 0.4 + b.arm * 0.9 : 1));
            ctx.fillStyle = b.fill;
            ctx.fillRect(b.x, b.y, b.size, b.size);
        }
    }

    ctx.globalCompositeOperation = 'source-over';
    ctx.globalAlpha = 1;
}
