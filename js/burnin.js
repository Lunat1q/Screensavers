// --- Burn-in Fix / Pixel Refresh ---
// Safety (WCAG 2.3.1): at most 3 full-screen changes per second unless the user opts into fast flashing.
const BURN_COLORS = ['#ff0000', '#00ff00', '#0000ff', '#ffffff', '#000000', '#00ffff', '#ff00ff', '#ffff00'];
const BURN_AUTO = ['white', 'cycle', 'bars', 'noise'];
const BURN_AUTO_MS = 3 * 60 * 1000;
const BURN_SPEED = { // ms per color (cycle), ms per noise frame, ms per bar sweep
    slow:   { cycle: 5000, noise: 1000, sweep: 20000 },
    medium: { cycle: 1000, noise: 334,  sweep: 8000 },
    fast:   { cycle: 100,  noise: 33,   sweep: 3000 }, // >3 flashes/s: only with burnFastFlash
};
const burnFastFlash = document.getElementById('burnFastFlash');
const burnSpeedSel = document.getElementById('burnSpeed');
const burnTimeEl = document.getElementById('burnTime');
const burnWarnDialog = document.getElementById('burnWarnDialog');
let burn = null;          // active session
let burnLastKey = null;   // what's on screen now; skip redraw while unchanged
let burnNoise = null;     // reused ImageData
let burnPrevType = 'matrix';

// Pure: what to show at elapsed time t (ms). key === null means "redraw every frame".
function burnFrame(pattern, speed, t) {
    if (pattern === 'auto') pattern = BURN_AUTO[Math.floor(t / BURN_AUTO_MS) % BURN_AUTO.length];
    const s = BURN_SPEED[speed];
    if (pattern === 'white') return { pattern, key: 'white' };
    if (pattern === 'cycle') {
        const i = Math.floor(t / s.cycle) % BURN_COLORS.length;
        return { pattern, key: 'c' + i, color: BURN_COLORS[i] };
    }
    if (pattern === 'noise') return { pattern, key: 'n' + Math.floor(t / s.noise) };
    const p = (t % (2 * s.sweep)) / s.sweep; // bars: 0..1 horizontal sweep, 1..2 vertical sweep
    return { pattern: 'bars', key: null, vertical: p >= 1, pos: p % 1 };
}

function syncBurnFlash() {
    const on = burnFastFlash.checked;
    burnSpeedSel.querySelector('option[value="fast"]').disabled = !on;
    if (!on && burnSpeedSel.value === 'fast') burnSpeedSel.value = 'medium';
    document.getElementById('burnFlashWarning').hidden = !on;
}
burnFastFlash.addEventListener('change', syncBurnFlash);

function burnWarningKind() {
    if (burnFastFlash.checked && burnSpeedSel.value === 'fast') return 'fast';
    return ['auto', 'cycle', 'noise'].includes(document.getElementById('burnPattern').value) ? 'normal' : null;
}
function burnAcked(kind) { try { return localStorage.getItem('burninWarned-' + kind) === '1'; } catch { return false; } }
function burnAck(kind) { try { localStorage.setItem('burninWarned-' + kind, '1'); } catch { /* storage blocked */ } }

async function acquireWakeLock() {
    if (!burn || !('wakeLock' in navigator)) return;
    const session = burn;
    try {
        const lock = await navigator.wakeLock.request('screen');
        if (burn === session) session.wakeLock = lock; else lock.release();
    } catch { /* denied or unsupported: OS power settings stay in charge */ }
}
// Browsers drop the wake lock when the tab is hidden; take it back on return.
document.addEventListener('visibilitychange', () => {
    if (burn && document.visibilityState === 'visible') acquireWakeLock();
});

function startBurnin() {
    const val = id => document.getElementById(id).value;
    const mins = Number(val('burnDuration'));
    const now = performance.now();
    burn = {
        start: now,
        end: mins > 0 ? now + mins * 60000 : 0,
        pattern: val('burnPattern'),
        speed: val('burnSpeed') === 'fast' && !burnFastFlash.checked ? 'medium' : val('burnSpeed'),
        endAction: val('burnEnd'),
        exit: val('burnExit'),
        moveAt: 0,
        shownSec: -1,
        wakeLock: null,
    };
    burnTimeEl.hidden = !document.getElementById('burnShowTime').checked;
    acquireWakeLock();
}

function stopBurnin() {
    if (!burn) return;
    if (burn.wakeLock) burn.wakeLock.release().catch(() => {});
    burn = null;
    burnLastKey = null;
    burnNoise = null;
    burnTimeEl.hidden = true;
}

function exitBurnin() {
    stopBurnin();
    ui.classList.remove('hidden');
    document.body.style.cursor = 'default';
    if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
}

function burnShouldExit(e) {
    if (burn.exit === 'esc') return e.type === 'keydown' && e.key === 'Escape';
    if (performance.now() - burn.start < 1000) return false; // ignore events from entering fullscreen
    return e.type !== 'mousemove' || Math.abs(e.movementX) + Math.abs(e.movementY) > 2;
}

function formatHMS(ms) {
    const s = Math.max(0, Math.ceil(ms / 1000));
    return `${Math.floor(s / 3600)}:${String(Math.floor(s / 60) % 60).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
}

function drawBurnNoise() {
    // ponytail: one noise pixel per CSS pixel; on HiDPI each covers dpr^2 physical pixels, fine for exercising them.
    if (!burnNoise || burnNoise.width !== width || burnNoise.height !== height) burnNoise = ctx.createImageData(width, height);
    const px = new Uint32Array(burnNoise.data.buffer);
    let s = (Math.random() * 0xffffffff) | 1;
    for (let i = 0; i < px.length; i++) { // xorshift32: much faster than Math.random per pixel
        s ^= s << 13; s ^= s >>> 17; s ^= s << 5;
        px[i] = s | 0xff000000; // opaque alpha (little-endian RGBA)
    }
    ctx.putImageData(burnNoise, 0, 0);
}

function drawBurnin() {
    if (!burn) { // no background preview: patterns only run after Launch (and the warning)
        if (burnLastKey !== 'idle') {
            ctx.fillStyle = '#000';
            ctx.fillRect(0, 0, width, height);
            burnLastKey = 'idle';
        }
        return;
    }

    const now = performance.now();
    if (burn.end && now >= burn.end) {
        const action = burn.endAction;
        stopBurnin();
        if (action === 'return') selectType(burnPrevType); // 'off' stays on the idle black screen
        return;
    }

    if (!burnTimeEl.hidden) {
        const sec = Math.floor(now / 1000);
        if (sec !== burn.shownSec) {
            burn.shownSec = sec;
            burnTimeEl.textContent = burn.end ? `${formatHMS(burn.end - now)} left` : `${formatHMS(now - burn.start)} elapsed`;
        }
        if (now >= burn.moveAt) { // a static overlay would cause retention itself
            burnTimeEl.style.left = `${Math.random() * Math.max(0, width - 130)}px`;
            burnTimeEl.style.top = `${Math.random() * Math.max(0, height - 24)}px`;
            burn.moveAt = now + 30000;
        }
    }

    const f = burnFrame(burn.pattern, burn.speed, now - burn.start);
    if (f.key !== null && f.key === burnLastKey) return;
    burnLastKey = f.key;

    if (f.pattern === 'noise') return drawBurnNoise();
    ctx.fillStyle = f.pattern === 'white' ? '#fff' : f.pattern === 'cycle' ? f.color : '#000';
    ctx.fillRect(0, 0, width, height);
    if (f.pattern === 'bars') {
        ctx.fillStyle = '#fff';
        if (f.vertical) {
            const bh = height / 5;
            ctx.fillRect(0, -bh + f.pos * (height + bh), width, bh);
        } else {
            const bw = width / 5;
            ctx.fillRect(-bw + f.pos * (width + bw), 0, bw, height);
        }
    }
}
