// --- Maze ---
// Port of github.com/Lunat1q/MazeX: a depth-first backtracker carves the maze one cell at a time. Walls glow
// for a while after the carver passes, then the longest route from the entrance is traced in gold to a chest.
// Each frame is redrawn from scratch, every cell faded by its age on MazeX's curve. (MazeX darkened the canvas
// a little each tick instead, but in 8-bit color that stalls a few levels above black and leaves ghost walls.)
const mazeHelp = document.getElementById('mazeHelp');
const mazeStatsEl = document.getElementById('mazeStats');
const MAZE_DIRS = [[1, 0, 'r', 'l'], [-1, 0, 'l', 'r'], [0, 1, 'b', 't'], [0, -1, 't', 'b']]; // dx, dy, wall here, wall there
let maze = null;
let mazeOld = null; // the solved maze, fading out over the new one
let mazePaused = false;
let mazeGlowLast = 0.3;

HOTKEYS.maze = { // MazeX's hotkeys
    keys: {
        KeyK: () => meshNudge('mazeCell', 5),
        KeyL: () => meshNudge('mazeCell', -5),
        KeyG: () => { const g = num('mazeGlow'); if (g) mazeGlowLast = g; meshSet('mazeGlow', g ? 0 : mazeGlowLast); },
        BracketLeft: () => meshNudge('mazeFade', -0.01), // longer carver trail
        BracketRight: () => meshNudge('mazeFade', 0.01), // shorter carver trail
        KeyO: () => meshNudge('mazeTrail', 1),
        KeyP: () => meshNudge('mazeTrail', -1),
        Equal: () => meshNudge('mazeSpeed', 5),
        NumpadAdd: () => meshNudge('mazeSpeed', 5),
        Minus: () => meshNudge('mazeSpeed', -5),
        NumpadSubtract: () => meshNudge('mazeSpeed', -5),
        KeyA: () => { mazePaused = !mazePaused; },
        KeyS: () => { mazeStatsEl.textContent = '…'; meshToggle(mazeStatsEl); },
        KeyH: () => meshToggle(mazeHelp),
        ShowSettings: () => { mazeHelp.hidden = true; resetIdleTimer(); }, // button only
    },
    repeat: new Set(['Equal', 'Minus', 'BracketLeft', 'BracketRight', 'KeyO', 'KeyP']),
    help: mazeHelp,
};

function initMaze(size) {
    const cx = Math.max(1, Math.floor(width / size)), cy = Math.max(1, Math.floor(height / size));
    const cells = [];
    for (let x = 0; x < cx; x++) for (let y = 0; y < cy; y++) cells.push({ x, y, t: true, r: true, b: true, l: true, seen: 0, lit: 0, dist: 0 });
    const at = (x, y) => x >= 0 && x < cx && y >= 0 && y < cy && cells[x * cy + y];
    const start = at(cx >> 1, cy >> 1);
    start.seen = performance.now();
    start.dist = 1;
    maze = { size, width, height, cx, cy, ox: Math.floor((width - cx * size) / 2), oy: Math.floor((height - cy * size) / 2), cells, at, start, finish: start, stack: [start], visited: 1, acc: 0, path: null, solvedAt: 0, endedAt: 0, last: performance.now(), fps: { frames: 0, at: 0 } };
}

function stepMaze(now) {
    const m = maze, cur = m.stack[m.stack.length - 1];
    cur.lit = now; // the carver leaves a fading trail
    const open = MAZE_DIRS.map(([dx, dy, a, b]) => { const n = m.at(cur.x + dx, cur.y + dy); return n && !n.seen && [n, a, b]; }).filter(Boolean);
    if (!open.length) { // dead end: back up, relighting the cell we return to
        m.stack.pop();
        m.stack[m.stack.length - 1].seen = now;
        return;
    }
    const [n, a, b] = open[Math.random() * open.length | 0];
    cur[a] = n[b] = false;
    n.seen = now;
    n.dist = cur.dist + 1;
    m.stack.push(n);
    m.visited++;
    if (n.dist > m.finish.dist) m.finish = n;
}

function solveMaze(now) { // walk back from the farthest cell, always to the open neighbour one step closer
    const m = maze;
    let c = m.finish;
    m.path = [c];
    while (c !== m.start) {
        const from = c;
        c = MAZE_DIRS.map(([dx, dy, a]) => !from[a] && m.at(from.x + dx, from.y + dy)).find(n => n && n.dist === from.dist - 1);
        m.path.push(c);
    }
    m.solvedAt = now;
}

const mazeFade = (age, fade) => age <= 0 ? 1 : Math.pow(1 - fade, age / 25); // MazeX: `fade` darker per 25 ms tick

// Walls are drawn as whole-pixel rectangles that never overlap: each wall stops short of its ends, and every
// corner is its own square, as bright as the brightest wall meeting there. Antialiased strokes overlapped at
// the corners, and those pixels flickered as neighbouring walls moved between brightness steps.
let mazeLayer = null;

function mazeWalls(m, now, o, lctx) {
    const s = m.size, cx = m.cx, cy = m.cy, ended = m.endedAt ? mazeFade(now - m.endedAt, o.fade) : 1;
    const h = Math.max(1, Math.round(s * 0.05)), w = 2 * h; // half / full wall thickness
    const STEPS = 32, steps = Array.from({ length: STEPS + 1 }, () => new Path2D()); // grouped by brightness
    const corner = new Float32Array((cx + 1) * (cy + 1));
    const A = (x, y) => { const c = m.at(x, y); return c ? c.a : 0; };
    const add = (a, x, y, rw, rh) => steps[Math.ceil(a * STEPS)].rect(x, y, rw, rh);
    const bump = (x, y, a) => { const i = y * (cx + 1) + x; if (a > corner[i]) corner[i] = a; };
    for (const c of m.cells) c.a = c.seen ? mazeFade(now - c.seen - o.trailMs, o.fade) * ended : 0;
    for (let y = 0; y <= cy; y++) for (let x = 0; x < cx; x++) { // horizontal walls
        const c = m.at(x, y), a = Math.max(A(x, y - 1), A(x, y));
        if ((c ? !c.t : false) || a <= 0.02) continue;
        add(a, x * s + h, y * s - h, s - w, w);
        bump(x, y, a); bump(x + 1, y, a);
    }
    for (let y = 0; y < cy; y++) for (let x = 0; x <= cx; x++) { // vertical walls
        const c = m.at(x, y), a = Math.max(A(x - 1, y), A(x, y));
        if ((c ? !c.l : false) || a <= 0.02) continue;
        add(a, x * s - h, y * s + h, w, s - w);
        bump(x, y, a); bump(x, y + 1, a);
    }
    for (let y = 0; y <= cy; y++) for (let x = 0; x <= cx; x++) {
        const a = corner[y * (cx + 1) + x];
        if (a > 0.02) add(a, x * s - h, y * s - h, w, w);
    }
    lctx.save();
    lctx.translate(m.ox, m.oy);
    lctx.fillStyle = o.color;
    for (let i = 1; i <= STEPS; i++) { lctx.globalAlpha = i / STEPS; lctx.fill(steps[i]); }
    lctx.restore();
}

function mazeExtras(m, now, o, top) { // under the walls: the carver's fading trail; on top: carver, solution, chest, door
    const s = m.size, ended = m.endedAt ? mazeFade(now - m.endedAt, o.fade) : 1, head = m.path ? null : m.stack[m.stack.length - 1];
    ctx.save();
    ctx.translate(m.ox, m.oy);
    ctx.fillStyle = '#1F51FF';
    if (!top) {
        for (const c of m.cells) {
            const lit = c.lit && c !== head && mazeFade(now - c.lit, o.fade) * ended;
            if (lit > 0.02) { ctx.globalAlpha = lit; ctx.fillRect(c.x * s, c.y * s, s, s); }
        }
        return ctx.restore();
    }
    if (head) ctx.fillRect(head.x * s, head.y * s, s, s); // the carver
    ctx.globalAlpha = ended;
    if (m.path) {
        ctx.strokeStyle = 'gold';
        ctx.lineCap = 'round';
        ctx.lineWidth = Math.max(2, s * 0.2);
        ctx.beginPath();
        m.path.forEach(c => ctx.lineTo(c.x * s + s / 2, c.y * s + s / 2));
        ctx.stroke();
        const f = m.finish, cw = s * 0.6, ch = s * 0.3, x = f.x * s + s * 0.2, y = f.y * s + s * 0.4; // treasure chest
        ctx.fillStyle = 'saddlebrown'; ctx.fillRect(x, y, cw, ch);
        ctx.fillStyle = 'peru'; ctx.fillRect(x, y - ch * 0.2, cw, ch * 0.2);
        ctx.fillStyle = 'gold'; ctx.fillRect(x + cw * 0.44, y + ch * 0.4, cw * 0.12, ch * 0.35);
    }
    ctx.globalAlpha = mazeFade(now - m.start.seen - o.trailMs, o.fade) * ended;
    if (ctx.globalAlpha > 0.02) { // entrance door
        const x = m.start.x * s + s * 0.2, y = m.start.y * s + s * 0.1;
        ctx.fillStyle = 'dimgray'; ctx.fillRect(x, y, s * 0.6, s * 0.8);
        ctx.fillStyle = 'gold'; ctx.beginPath(); ctx.arc(x + s * 0.45, y + s * 0.4, Math.max(1, s * 0.07), 0, Math.PI * 2); ctx.fill();
    }
    ctx.restore();
}

function drawMaze(color) {
    const size = num('mazeCell'), speed = num('mazeSpeed');
    const o = { trailMs: num('mazeTrail') * 1000, fade: num('mazeFade'), glow: num('mazeGlow'), glowPower: num('mazeGlowPower'), color, rgb: hexToRgb(color) };
    if (!maze || maze.size !== size || maze.width !== width || maze.height !== height) initMaze(size);
    const now = performance.now(), dt = Math.min(now - maze.last, 100);
    maze.last = now;
    if (maze.path && now - maze.solvedAt > 10000) { // shown long enough: start over, letting this one fade out
        maze.endedAt = now;
        mazeOld = maze;
        initMaze(size);
    }

    const m = maze;
    if (m.path) {
        for (const c of m.path) c.seen = now; // keep the solution's walls lit
    } else if (!mazePaused) {
        for (m.acc += dt * speed / 1000; m.acc >= 1 && !m.path; m.acc--) {
            if (m.visited === m.cells.length) solveMaze(now); else stepMaze(now);
        }
    }

    if (mazeOld && mazeFade(now - mazeOld.endedAt, o.fade) < 0.02) mazeOld = null;
    const mazes = mazeOld ? [mazeOld, m] : [m];
    if (!mazeLayer) mazeLayer = document.createElement('canvas');
    if (mazeLayer.width !== width || mazeLayer.height !== height) { mazeLayer.width = width; mazeLayer.height = height; }
    const lctx = mazeLayer.getContext('2d');
    lctx.clearRect(0, 0, width, height);
    mazes.forEach(z => mazeWalls(z, now, o, lctx));

    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, width, height);
    mazes.forEach(z => mazeExtras(z, now, o, false));
    if (o.glow && o.glowPower) { // glow: blurred copies of the walls, so it fades exactly with them
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        ctx.filter = `blur(${m.size * o.glow}px)`;
        for (let p = o.glowPower; p > 0; p--) { ctx.globalAlpha = Math.min(1, p); ctx.drawImage(mazeLayer, 0, 0); }
        ctx.restore();
    }
    ctx.drawImage(mazeLayer, 0, 0);
    mazes.forEach(z => mazeExtras(z, now, o, true));

    if (!mazeStatsEl.hidden && ++m.fps.frames && now - m.fps.at >= 500) {
        mazeStatsEl.textContent = `Size: ${m.cx}×${m.cy}   Length: ${m.visited}   Progress: ${(m.visited / m.cells.length * 100).toFixed(1)}%   FPS: ${(m.fps.frames * 1000 / (now - m.fps.at)).toFixed(0)}`;
        m.fps = { frames: 0, at: now };
    }
}
