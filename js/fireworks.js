// --- Animation 8: Fireworks ---
// Rockets climb, then burst as a sphere of sparks seen side-on. Air drag slows the sparks, so a shell
// opens fast, hangs and droops. Shells come in kinds: peony, ring, willow, chrysanthemum, strobe, crackle.
let fw = {};

function fwShell(x, y, hue, sat, n, u, own) {
    const kind = ['peony', 'peony', 'crackle', 'chrys', 'willow', 'ring', 'strobe'][Math.random() * 7 | 0];
    const gold = kind === 'willow' && !own;
    const v0 = (kind === 'willow' ? 270 : 300 + Math.random() * 220) * u;
    const hue2 = !own && Math.random() < 0.4 ? hue + 40 + Math.random() * 200 : hue; // some shells carry a second color inside
    const rot = Math.random() * Math.PI, squash = 0.25 + Math.random() * 0.6;
    particles.push({ type: 'flash', x, y, hue, sat, life: 0, ttl: 0.35 });
    for (let j = 0; j < n; j++) {
        const a = Math.random() * Math.PI * 2;
        let dx, dy, sp = 0.9 + Math.random() * 0.1, h = hue;
        if (kind === 'ring') { // a tilted circle
            const ex = Math.cos(a), ey = Math.sin(a) * squash;
            dx = ex * Math.cos(rot) - ey * Math.sin(rot);
            dy = ex * Math.sin(rot) + ey * Math.cos(rot);
        } else { // a point on a sphere, flattened: sparks bunch toward the rim as in a real shell
            const z = Math.random() * 2 - 1, r = Math.sqrt(1 - z * z);
            dx = r * Math.cos(a);
            dy = r * Math.sin(a);
            if (hue2 !== hue && j % 3 === 0) { sp *= 0.5; h = hue2; }
        }
        particles.push({
            type: 'spark', kind, x, y, vx: dx * v0 * sp, vy: dy * v0 * sp,
            hue: gold ? 42 : h, sat: gold ? 75 : kind === 'strobe' ? sat * 0.3 : sat,
            life: 0, ttl: (kind === 'willow' ? 2.6 : 1.4) * (0.75 + Math.random() * 0.5),
            drag: kind === 'willow' ? 1.1 : 1.7, ember: Math.random()
        });
    }
}

function drawFireworks(color) {
    const freq = num('fwFreq'), n = num('fwSparks'), u = height / 900, g = num('fwGravity') * 3600 * u;
    const own = document.getElementById('fwColors').value === 'base';
    const c = hexToRgb(color), mx = Math.max(c.r, c.g, c.b), span = mx - Math.min(c.r, c.g, c.b);
    const baseHue = !span ? 0 : 60 * ((mx === c.r ? (c.g - c.b) / span + 6 : mx === c.g ? (c.b - c.r) / span + 2 : (c.r - c.g) / span + 4) % 6);
    const sat = own && !span ? 0 : 100; // a gray base color gives white fireworks
    const dt = frameDt(fw);

    ctx.globalCompositeOperation = 'source-over';
    fw.fade = (fw.fade || 0) + dt; // fade at 30 Hz: see drawAttractor
    if (fw.fade >= 1 / 30) {
        ctx.fillStyle = `rgba(0, 0, 0, ${1 - Math.pow(0.84, fw.fade * 60)})`;
        ctx.fillRect(0, 0, width, height);
        fw.fade = 0;
    }

    if (Math.random() < 1.8 * freq * dt) {
        const volley = Math.random() < 0.12 ? 3 + (Math.random() * 3 | 0) : 1;
        for (let k = 0; k < volley; k++) {
            const H = height * (0.5 + Math.random() * 0.35), T = 1.3 + Math.random() * 0.7; // climbs H in T seconds, stopping at the top
            particles.push({
                type: 'rocket', x: width * (0.12 + Math.random() * 0.76), y: height, vx: (Math.random() - 0.5) * 90 * u, vy: -2 * H / T, acc: 2 * H / (T * T),
                hue: own ? baseHue + (Math.random() - 0.5) * 40 : Math.random() * 360, life: -k * 0.18, ttl: T, ember: 0
            });
        }
    }

    const kill = i => { particles[i] = particles[particles.length - 1]; particles.pop(); }; // order doesn't matter: everything is additive
    ctx.globalCompositeOperation = 'lighter';
    ctx.lineCap = 'round';
    ctx.lineWidth = Math.max(1, 1.8 * u);
    const dot = Math.max(1, 1.5 * u);
    for (let i = particles.length - 1; i >= 0; i--) {
        const p = particles[i];
        p.life += dt;
        if (p.life < 0) continue; // a volley rocket waiting for its turn
        const t = p.life / p.ttl;

        if (p.type === 'flash') { // the burst lights up the air around it
            if (t >= 1) { kill(i); continue; }
            const R = 340 * u, gr = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, R);
            gr.addColorStop(0, `hsla(${p.hue}, ${p.sat}%, 85%, ${0.45 * (1 - t) * (1 - t)})`);
            gr.addColorStop(1, 'rgba(0, 0, 0, 0)');
            ctx.fillStyle = gr;
            ctx.fillRect(p.x - R, p.y - R, R * 2, R * 2);
            continue;
        }
        if (p.type === 'ember') { // glowing dust left behind by rockets and trailing sparks
            if (t >= 1) { kill(i); continue; }
            p.y += 14 * u * dt;
            ctx.fillStyle = `hsla(${p.hue}, ${p.sat}%, 65%, ${0.7 * (1 - t)})`;
            ctx.fillRect(p.x, p.y, dot, dot);
            continue;
        }

        const ox = p.x, oy = p.y;
        if (p.type === 'rocket') {
            if (t >= 1) {
                kill(i);
                fwShell(p.x, p.y, p.hue, sat, n, u, own);
                continue;
            }
            p.vy += p.acc * dt;
            p.x += (p.vx + Math.sin(p.life * 23) * 25 * u) * dt;
            p.y += p.vy * dt;
            ctx.strokeStyle = 'rgba(255, 225, 170, 0.9)';
        } else {
            if (t >= 1) {
                if (p.kind === 'crackle') {
                    for (let j = 0; j < 4; j++) {
                        const a = Math.random() * Math.PI * 2, v = (60 + Math.random() * 110) * u;
                        particles.push({ type: 'spark', kind: 'pop', x: p.x, y: p.y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, hue: 45, sat: sat * 0.6, life: 0, ttl: 0.2 + Math.random() * 0.25, drag: 3, ember: 0 });
                    }
                }
                kill(i);
                continue;
            }
            const k = Math.exp(-p.drag * dt);
            p.vx *= k;
            p.vy = p.vy * k + g * dt;
            p.x += p.vx * dt;
            p.y += p.vy * dt;
            let alpha = Math.min(1, (1 - t) * 2.5);
            if (p.kind === 'strobe' && t > 0.25 && Math.random() < 0.6) alpha *= 0.08;
            // white-hot at the burst, cooling to its color
            ctx.strokeStyle = `hsla(${p.hue}, ${p.sat}%, ${p.kind === 'pop' ? 85 : 60 + 35 * Math.max(0, 1 - t * 6)}%, ${alpha})`;
        }
        ctx.beginPath();
        ctx.moveTo(ox, oy);
        ctx.lineTo(p.x, p.y);
        ctx.stroke();

        const rate = p.type === 'rocket' ? 70 : p.kind === 'willow' ? 16 : p.kind === 'chrys' ? 22 : 0;
        if (rate && t < 0.85) {
            for (p.ember += rate * dt; p.ember >= 1; p.ember--) {
                const j = p.type === 'rocket' ? 5 * u : 0;
                particles.push({
                    type: 'ember', x: p.x + (Math.random() - 0.5) * j, y: p.y + (Math.random() - 0.5) * j,
                    hue: p.type === 'rocket' ? 38 : p.hue, sat: p.type === 'rocket' ? 80 : p.sat, life: 0, ttl: p.kind === 'willow' ? 0.9 : 0.5
                });
            }
        }
    }
    ctx.globalCompositeOperation = 'source-over';
}
