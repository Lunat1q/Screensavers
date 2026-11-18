// --- Animation 20: Delaunay Mesh (port of github.com/Lunat1q/Meshy) ---
// Original ran at 30 fps; per-frame steps here are halved to keep the same feel at 60 fps.
const meshCirc = { count: 2, up: true, cx: 2, cy: 2, mx: false, my: false, mxUp: false, myUp: false };
let meshBorder = { key: '', pts: [] };

function meshPoint(x, y) {
    return {
        x, y,
        vx: (Math.random() * 2 - 1) * 0.25,
        vy: (Math.random() * 2 - 1) * 0.25,
        rand: [Math.random(), Math.random(), Math.random()] // fixed hue for 'random' mode
    };
}

// c = per-channel max (from the base color), like Meshy's R/G/B toggles
function meshColor(mode, p, c) {
    let r = 0, g = 0, b = 0;
    if (mode === 'random') {
        r = p.rand[0] * c.r; g = p.rand[1] * c.g; b = p.rand[2] * c.b;
    } else if (mode === 'circles') {
        const m = meshCirc, cX = width / m.cx, cY = height / m.cy;
        const step = Math.hypot(cX, cY) / m.count;
        const d = Math.hypot(p.x - cX, p.y - cY);
        const f = (d % step) / step, k = Math.floor(d / step) % 3;
        if (k === 0) { g = (1 - f) * c.g; r = f * c.r; }
        else if (k === 1) { r = (1 - f) * c.r; b = f * c.b; }
        else { b = (1 - f) * c.b; g = f * c.g; }
    } else { // gradient
        const xp = Math.abs(p.x - width / 2) / (width / 2);
        const yp = Math.abs(p.y - height / 2) / (height / 2);
        r = Math.sqrt(Math.max(0, xp * xp - yp * yp)) * c.r;
        g = (1 - xp) * c.g;
        b = yp * c.b;
    }
    return `rgb(${r | 0},${g | 0},${b | 0})`;
}

function meshAnimateCircles() {
    const m = meshCirc;
    m.count += m.up ? 0.017 : -0.017;
    if (m.up ? m.count >= 15 : m.count <= 0.5) {
        m.up = !m.up;
        m.mx = Math.random() > 0.5;
        m.my = Math.random() > 0.5;
        if (m.mx && Math.random() > 0.8) m.mxUp = !m.mxUp;
        if (m.my && Math.random() > 0.8) m.myUp = !m.myUp;
    }
    const MULT = 1.0002;
    if (m.mx) {
        m.cx = m.mxUp ? m.cx * MULT : m.cx / MULT;
        if (m.cx > 20) m.mxUp = false; else if (m.cx < 1.1) m.mxUp = true;
    }
    if (m.my) {
        m.cy = m.myUp ? m.cy * MULT : m.cy / MULT;
        if (m.cy > 20) m.myUp = false; else if (m.cy < 1.1) m.myUp = true;
    }
}

// Hotkeys (as in Meshy). They drive the same controls as the panel, so changes stick in the URL.
const meshHelp = document.getElementById('meshHelp');
const meshStatsEl = document.getElementById('meshStats');
const meshTip = document.getElementById('meshTip');
let meshPaused = false;
let meshFps = { frames: 0, at: 0 };

function meshSet(id, v) {
    const el = document.getElementById(id);
    if (el.type === 'checkbox') el.checked = v; else el.value = v;
    updateValueLabels();
    updateURL();
}
function meshNudge(id, delta) {
    const el = document.getElementById(id);
    meshSet(id, Math.min(+el.max, Math.max(+el.min, +el.value + delta)).toFixed(2));
}
const meshFlip = id => meshSet(id, !document.getElementById(id).checked);
function meshToggleChannel(i) { // R/G/B: flip that channel of the base color between 0 and max
    const hex = colorPicker.value.slice(1).match(/../g);
    hex[i] = hex[i] === '00' ? 'ff' : '00';
    colorPicker.value = '#' + hex.join('');
    updateURL();
}
const meshToggle = el => { el.hidden = !el.hidden; };

const MESH_KEYS = {
    Space: () => meshNudge('meshCount', 100),
    Enter: () => meshNudge('meshCount', -100),
    NumpadEnter: () => meshNudge('meshCount', -100),
    KeyS: () => { meshFps = { frames: 0, at: performance.now() }; meshStatsEl.textContent = '…'; meshToggle(meshStatsEl); },
    KeyH: () => meshToggle(meshHelp),
    KeyA: () => { meshPaused = !meshPaused; },
    KeyL: () => meshFlip('meshLines'),
    KeyT: () => meshFlip('meshFill'),
    KeyP: () => meshFlip('meshDots'),
    KeyR: () => meshToggleChannel(0),
    KeyG: () => meshToggleChannel(1),
    KeyB: () => meshToggleChannel(2),
    Digit1: () => meshSet('meshMode', 'gradient'),
    Digit2: () => meshSet('meshMode', 'random'),
    Digit3: () => meshSet('meshMode', 'circles'),
    BracketLeft: () => meshNudge('meshTrail', -0.01), // longer trail
    BracketRight: () => meshNudge('meshTrail', 0.01), // shorter trail
    Equal: () => meshNudge('meshSpeed', 0.1),
    NumpadAdd: () => meshNudge('meshSpeed', 0.1),
    Minus: () => meshNudge('meshSpeed', -0.1),
    NumpadSubtract: () => meshNudge('meshSpeed', -0.1),
    ShowSettings: () => { meshHelp.hidden = true; resetIdleTimer(); }, // button only, no key has this code
};
const MESH_REPEAT = new Set(['Space', 'Enter', 'Equal', 'Minus', 'BracketLeft', 'BracketRight']);
// Scenes with hotkeys: key map, keys that repeat while their button is held, and the controls panel
const HOTKEYS = { mesh: { keys: MESH_KEYS, repeat: MESH_REPEAT, help: meshHelp } };

// true = key consumed (so it doesn't wake the settings panel)
function meshHotkey(e) {
    const hk = HOTKEYS[typeSelect.value];
    if (!hk || e.type !== 'keydown' || e.ctrlKey || e.altKey || e.metaKey) return false;
    if (!ui.classList.contains('hidden') && e.target.closest && e.target.closest('input, select, textarea, button')) return false;
    const fn = hk.keys[e.code];
    if (!fn) return false;
    e.preventDefault();
    fn();
    return true;
}

// Touch: tapping the mesh opens its controls instead of the settings panel (which has its own button there)
let meshTouchAt = -1e9;
window.addEventListener('touchstart', () => { meshTouchAt = performance.now(); }, { passive: true });
function meshTap(e) {
    const hk = HOTKEYS[typeSelect.value];
    if (!hk || e.type !== 'click' || performance.now() - meshTouchAt > 1000) return false;
    if (e.target.closest('#ui, .mesh-overlay')) return false;
    meshToggle(hk.help);
    return true;
}

// On-screen buttons, held ones repeat (like Meshy's mobile panel)
let meshRepeat;
const meshStopRepeat = () => clearInterval(meshRepeat);
document.addEventListener('pointerdown', e => {
    const btn = e.target.closest('.mesh-overlay button[data-key]');
    const hk = HOTKEYS[typeSelect.value];
    if (!btn || !hk) return;
    e.preventDefault(); // keep focus off the button, so Space/Enter stay hotkeys
    const fn = hk.keys[btn.dataset.key];
    fn();
    meshStopRepeat();
    if (hk.repeat.has(btn.dataset.key)) meshRepeat = setInterval(fn, 80);
});
window.addEventListener('pointerup', meshStopRepeat);
window.addEventListener('pointercancel', meshStopRepeat);
document.querySelectorAll('.mesh-overlay').forEach(el => el.addEventListener('click', e => e.stopPropagation())); // don't wake the settings panel

window.addEventListener('contextmenu', e => {
    const hk = HOTKEYS[typeSelect.value];
    if (!hk || e.target.closest('#ui')) return;
    e.preventDefault();
    if (!e.target.closest('.mesh-overlay')) meshToggle(hk.help); // long-press on a button must not close the panel
});
typeSelect.addEventListener('change', () => {
    document.querySelectorAll('.mesh-overlay').forEach(el => { el.hidden = true; });
});
function showMeshTip() {
    meshTip.textContent = matchMedia('(pointer: coarse)').matches ? 'Tap the screen for controls' : 'Right-click or press H for hotkeys';
    meshTip.hidden = true;
    void meshTip.offsetWidth; // restart the fade animation
    meshTip.hidden = false;
}
meshTip.addEventListener('animationend', () => { meshTip.hidden = true; });

function drawMesh(color) {
    const count = parseInt(document.getElementById('meshCount').value);
    const speed = parseFloat(document.getElementById('meshSpeed').value);
    const trail = parseFloat(document.getElementById('meshTrail').value);
    const mode = document.getElementById('meshMode').value;
    const lines = document.getElementById('meshLines').checked;
    const fill = document.getElementById('meshFill').checked;
    const dots = document.getElementById('meshDots').checked;
    let c = hexToRgb(color);
    if (!c.r && !c.g && !c.b) c = { r: 255, g: 255, b: 255 }; // black caps would draw nothing

    if (particles.length < count) {
        for (let i = particles.length; i < count; i++) particles.push(meshPoint(Math.random() * width, Math.random() * height));
    } else if (particles.length > count) {
        particles.length = count;
    }

    // Static points along the edges so the mesh always covers the whole screen
    const side = Math.max(4, Math.floor(Math.sqrt(count) / 2));
    const key = `${side}x${width}x${height}`;
    if (meshBorder.key !== key) {
        const pts = [];
        for (let i = 0; i < side; i++) {
            const x = width / (side - 1) * i;
            pts.push(meshPoint(x, 0), meshPoint(x, height));
        }
        for (let i = 1; i < side - 1; i++) {
            const y = height / (side - 1) * i;
            pts.push(meshPoint(0, y), meshPoint(width, y));
        }
        meshBorder = { key, pts };
    }

    if (!meshStatsEl.hidden) {
        const now = performance.now();
        meshFps.frames++;
        if (now - meshFps.at >= 500) {
            meshStatsEl.textContent = `Points: ${count}   FPS: ${(meshFps.frames * 1000 / (now - meshFps.at)).toFixed(0)}`;
            meshFps = { frames: 0, at: now };
        }
    }

    for (const p of meshPaused ? [] : particles) {
        p.x += p.vx * speed;
        p.y += p.vy * speed;
        if (p.x < 0 || p.x > width) { p.vx = -p.vx; p.x = Math.max(0, Math.min(width, p.x)); }
        if (p.y < 0 || p.y > height) { p.vy = -p.vy; p.y = Math.max(0, Math.min(height, p.y)); }
    }

    const all = meshBorder.pts.concat(particles);
    const coords = new Float64Array(all.length * 2);
    all.forEach((p, i) => { coords[2 * i] = p.x; coords[2 * i + 1] = p.y; });
    const tris = new Delaunator(coords).triangles;
    const cols = all.map(p => meshColor(mode, p, c));
    if (mode === 'circles' && !meshPaused) meshAnimateCircles();

    ctx.fillStyle = `rgba(0, 0, 0, ${trail})`;
    ctx.fillRect(0, 0, width, height);

    ctx.lineWidth = 0.5;
    for (let t = 0; t < tris.length; t += 3) {
        const a = all[tris[t]], b = all[tris[t + 1]], d = all[tris[t + 2]];
        ctx.beginPath();
        ctx.moveTo(a.x, a.y);
        ctx.lineTo(b.x, b.y);
        ctx.lineTo(d.x, d.y);
        ctx.closePath();
        if (lines) { ctx.strokeStyle = cols[tris[t]]; ctx.stroke(); }
        if (fill) { ctx.fillStyle = cols[tris[t]]; ctx.fill(); }
    }

    if (dots) {
        const off = meshBorder.pts.length;
        particles.forEach((p, i) => {
            ctx.fillStyle = cols[off + i];
            ctx.beginPath();
            ctx.arc(p.x, p.y, 2.5, 0, Math.PI * 2);
            ctx.fill();
        });
    }
}
