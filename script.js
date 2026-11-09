const canvas = document.getElementById('canvas');
const ctx = canvas.getContext('2d');
const ui = document.getElementById('ui');
const typeSelect = document.getElementById('typeSelect');
const colorPicker = document.getElementById('colorPicker');

let width, height;
let animationId;
let particles = [];
let matrixDrops = [];
let win11Progress = 0;
let win11Eta = 45;
let time = 0;
let idleTimer;
let isExplicitLaunch = false;
let bounceState = { x: 100, y: 100, vx: 3, vy: 3, color: '#00d2ff', text: 'DVD' };
let plasmaCanvas, plasmaCtx;

function isFullscreen() {
    return !!document.fullscreenElement || (window.innerWidth === screen.width && window.innerHeight === screen.height);
}

function resize() {
    width = canvas.width = window.innerWidth;
    height = canvas.height = window.innerHeight;
    resetCanvas();
    if (burn) return; // burn-in session keeps running through monitor/resolution changes

    if (isFullscreen() && !isExplicitLaunch) {
        ui.classList.add('hidden');
        document.body.style.cursor = 'none';
        clearTimeout(idleTimer);
    } else if (!isFullscreen() && !isExplicitLaunch) {
        ui.classList.remove('hidden');
        document.body.style.cursor = 'default';
        clearTimeout(idleTimer);
    }
}
window.addEventListener('resize', resize);

function hexToRgb(hex) {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result ? { r: parseInt(result[1], 16), g: parseInt(result[2], 16), b: parseInt(result[3], 16) } : { r: 255, g: 255, b: 255 };
}

function resetCanvas() {
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, width, height);
    ctx.shadowBlur = 0;
    particles = [];
    matrixDrops = [];
    win11Progress = 0;
    win11Eta = Math.floor(Math.random() * 31) + 30;
    time = 0;
    burnLastKey = null;
    const textEl = document.getElementById('bounceText');
    bounceState = { 
        x: width / 2, 
        y: height / 2, 
        vx: 3, 
        vy: 3, 
        color: colorPicker.value, 
        text: textEl ? textEl.value || 'DVD' : 'DVD'
    };
}

function updateSettingsVisibility() {
    document.querySelectorAll('.setting-group').forEach(el => el.classList.remove('active'));
    const type = typeSelect.value;
    document.getElementById('colorGroup').hidden = type === 'burnin'; // burn-in uses fixed colors
    const activeGroup = document.getElementById(`settings-${type}`);
    if (activeGroup) {
        activeGroup.classList.add('active');
    }
}

function updateValueLabels() {
    document.querySelectorAll('.val[data-for]').forEach(span => {
        const input = document.getElementById(span.dataset.for);
        if (input) span.textContent = input.value;
    });
}

function updateURL() {
    const url = new URL(window.location);
    url.search = '';
    url.searchParams.set('type', typeSelect.value);
    url.searchParams.set('color', colorPicker.value);
    
    const activeGroup = document.getElementById(`settings-${typeSelect.value}`);
    if (activeGroup) {
        activeGroup.querySelectorAll('input, select').forEach(input => {
            if (input.hasAttribute('data-volatile')) return; // explicit opt-ins aren't shared via URL
            url.searchParams.set(input.id, input.type === 'checkbox' ? input.checked : input.value);
        });
    }
    window.history.replaceState(null, '', url);
}

function loadFromURL() {
    const params = new URLSearchParams(window.location.search);
    
    if (params.has('type')) {
        const type = params.get('type');
        if (Array.from(typeSelect.options).some(opt => opt.value === type)) {
            typeSelect.value = type;
        }
    }
    if (params.has('color')) colorPicker.value = params.get('color');
    
    params.forEach((value, key) => {
        if (key !== 'type' && key !== 'color') {
            const input = document.getElementById(key);
            if (!input || input.hasAttribute('data-volatile')) return;
            if (input.type === 'checkbox') input.checked = value === 'true';
            else if (input.tagName === 'INPUT') input.value = value;
            else if (input.tagName === 'SELECT' && Array.from(input.options).some(o => o.value === value)) input.value = value;
        }
    });
}

typeSelect.addEventListener('change', () => {
    if (typeSelect.value !== 'burnin') burnPrevType = typeSelect.value;
    updateSettingsVisibility();
    resetCanvas();
    updateURL();
    updateValueLabels();
});
colorPicker.addEventListener('change', () => {
    resetCanvas();
    updateURL();
});
document.querySelectorAll('.setting-group input, .setting-group select').forEach(input => {
    input.addEventListener('change', updateURL);
    input.addEventListener('input', updateValueLabels);
});

// --- Card Grid Selection ---
function setActiveCard(value) {
    document.querySelectorAll('.card[data-value]').forEach(c => {
        c.classList.toggle('active', c.dataset.value === value);
    });
}

function selectType(value) {
    typeSelect.value = value;
    setActiveCard(value);
    typeSelect.dispatchEvent(new Event('change'));
}

document.getElementById('cardGrid').addEventListener('click', (e) => {
    const card = e.target.closest('.card[data-value]');
    if (card) selectType(card.dataset.value);
});

function resetIdleTimer(e) {
    if (burn) {
        if (burnShouldExit(e)) exitBurnin();
        return;
    }
    if (e && (meshHotkey(e) || meshTap(e))) return;
    if (isExplicitLaunch) return;
    if (isFullscreen() && e && e.type === 'mousemove') return;

    document.body.style.cursor = 'default';
    ui.classList.remove('hidden');
    clearTimeout(idleTimer);
    
    if (isFullscreen()) {
        idleTimer = setTimeout(() => {
            document.body.style.cursor = 'none';
            ui.classList.add('hidden');
        }, 2500);
    }
}
window.addEventListener('mousemove', resetIdleTimer);
window.addEventListener('keydown', resetIdleTimer);
window.addEventListener('click', resetIdleTimer);

// --- Animation 1: Constellation Orbs ---
function drawSlow(color) {
    const density = parseFloat(document.getElementById('slowCount').value);
    const speedMult = parseFloat(document.getElementById('slowSpeed').value);
    const linkDist = parseFloat(document.getElementById('slowLinkDist').value);
    const glow = parseFloat(document.getElementById('slowGlow').value);
    const targetCount = Math.floor(Math.min((width * height) / 15000, 80) * density);

    if (particles.length < targetCount) {
        for (let i = particles.length; i < targetCount; i++) {
            particles.push({
                x: Math.random() * width, 
                y: Math.random() * height,
                vx: (Math.random() - 0.5) * 1.5, 
                vy: (Math.random() - 0.5) * 1.5,
                r: Math.random() * 3 + 1.5
            });
        }
    } else if (particles.length > targetCount) {
        particles.length = targetCount;
    }

    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, width, height);

    const rgb = hexToRgb(color);

    if (glow > 0) {
        ctx.shadowColor = `rgb(${rgb.r}, ${rgb.g}, ${rgb.b})`;
        ctx.shadowBlur = glow;
    }

    particles.forEach(p => {
        p.x += p.vx * speedMult;
        p.y += p.vy * speedMult;

        if (p.x < 0 || p.x > width) p.vx *= -1;
        if (p.y < 0 || p.y > height) p.vy *= -1;

        ctx.fillStyle = `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.8)`;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fill();
    });

    ctx.shadowBlur = 0;
    ctx.lineWidth = 1;
    for (let i = 0; i < particles.length; i++) {
        for (let j = i + 1; j < particles.length; j++) {
            const dx = particles[i].x - particles[j].x;
            const dy = particles[i].y - particles[j].y;
            const dist = Math.sqrt(dx * dx + dy * dy);

            if (dist < linkDist) {
                ctx.strokeStyle = `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${1 - dist / linkDist})`;
                ctx.beginPath();
                ctx.moveTo(particles[i].x, particles[i].y);
                ctx.lineTo(particles[j].x, particles[j].y);
                ctx.stroke();
            }
        }
    }
}

// --- Animation 2: Complex Harmonograph ---
function drawMesmerizing(color) {
    const speedMult = parseFloat(document.getElementById('mesmSpeed').value);
    const complexity = parseInt(document.getElementById('mesmComplexity').value);
    const trail = parseFloat(document.getElementById('mesmTrail').value);
    const lineW = parseFloat(document.getElementById('mesmLineWidth').value);

    ctx.fillStyle = `rgba(0, 0, 0, ${trail})`;
    ctx.fillRect(0, 0, width, height);
    
    const rgb = hexToRgb(color);
    ctx.strokeStyle = `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.8)`;
    ctx.lineWidth = lineW;
    
    ctx.save();
    ctx.translate(width / 2, height / 2);
    
    ctx.beginPath();
    for (let i = 0; i <= Math.PI * 2; i += 0.01) {
        let r = 350 * Math.sin(time * 2.1) + 150 * Math.cos(i * complexity + time * 1.5) + 80 * Math.sin(i * 13 - time);
        let x = Math.cos(i) * r;
        let y = Math.sin(i) * r;

        let rotX = x * Math.cos(time * 0.3) - y * Math.sin(time * 0.3);
        let rotY = x * Math.sin(time * 0.3) + y * Math.cos(time * 0.3);

        if (i === 0) ctx.moveTo(rotX, rotY);
        else ctx.lineTo(rotX, rotY);
    }
    ctx.stroke();
    ctx.restore();
    time += 0.004 * speedMult;
}

// --- Animation 3: Vector Flow Field ---
function drawFlow(color) {
    const density = parseFloat(document.getElementById('flowCount').value);
    const speedMult = parseFloat(document.getElementById('flowSpeed').value);
    const turbulence = parseFloat(document.getElementById('flowTurb').value);
    const trail = parseFloat(document.getElementById('flowTrail').value);
    const targetCount = Math.floor(900 * density);

    if (particles.length < targetCount) {
        for (let i = particles.length; i < targetCount; i++) {
            particles.push({
                x: Math.random() * width,
                y: Math.random() * height,
                vx: 0, vy: 0,
                size: Math.random() * 2 + 0.5
            });
        }
    } else if (particles.length > targetCount) {
        particles.length = targetCount;
    }

    ctx.fillStyle = `rgba(0, 0, 0, ${trail})`;
    ctx.fillRect(0, 0, width, height);
    
    const rgb = hexToRgb(color);

    particles.forEach(p => {
        let angle = (Math.sin(p.x * turbulence + time) + Math.cos(p.y * turbulence + time)) * Math.PI * 2;
        p.vx += Math.cos(angle) * 0.15 * speedMult;
        p.vy += Math.sin(angle) * 0.15 * speedMult;

        p.vx *= 0.96;
        p.vy *= 0.96;

        p.x += p.vx;
        p.y += p.vy;

        if (p.x < 0) p.x = width;
        if (p.x > width) p.x = 0;
        if (p.y < 0) p.y = height;
        if (p.y > height) p.y = 0;

        ctx.fillStyle = `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.7)`;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fill();
    });
    time += 0.005 * speedMult;
}

// --- Animation 4: Cosmic Warp ---
function drawCosmic(color) {
    const density = parseFloat(document.getElementById('cosmicCount').value);
    const warpSpeed = parseFloat(document.getElementById('cosmicSpeed').value);
    const sizeMult = parseFloat(document.getElementById('cosmicSize').value);
    const targetCount = Math.floor(400 * density);

    if (particles.length < targetCount) {
        for(let i = particles.length; i < targetCount; i++) {
            particles.push({
                x: (Math.random() - 0.5) * width * 2,
                y: (Math.random() - 0.5) * height * 2,
                z: Math.random() * 1000
            });
        }
    } else if (particles.length > targetCount) {
        particles.length = targetCount;
    }

    ctx.fillStyle = 'rgba(0, 0, 0, 0.25)';
    ctx.fillRect(0, 0, width, height);

    const rgb = hexToRgb(color);
    const cx = width / 2;
    const cy = height / 2;

    particles.forEach(p => {
        p.z -= warpSpeed;
        if (p.z <= 0) {
            p.x = (Math.random() - 0.5) * width * 2;
            p.y = (Math.random() - 0.5) * height * 2;
            p.z = 1000;
        }

        const x = cx + (p.x / p.z) * 800;
        const y = cy + (p.y / p.z) * 800;
        const size = Math.max(0.1, (1000 - p.z) / 250) * sizeMult;

        ctx.fillStyle = `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${1 - p.z / 1000})`;
        ctx.beginPath();
        ctx.arc(x, y, size, 0, Math.PI * 2);
        ctx.fill();
        
        const px = cx + (p.x / (p.z + 15)) * 800;
        const py = cy + (p.y / (p.z + 15)) * 800;
        ctx.strokeStyle = `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${(1 - p.z / 1000) * 0.4})`;
        ctx.lineWidth = size * 0.6;
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.lineTo(px, py);
        ctx.stroke();
    });
}

// --- Animation 5: Windows 11 Update ---
function drawWin11Update(color) {
    const speedMult = parseFloat(document.getElementById('win11Speed').value);

    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, width, height);
    
    const rgb = hexToRgb(color);
    
    ctx.fillStyle = '#fff';
    ctx.font = '24px "Segoe UI", sans-serif';
    ctx.textAlign = 'center';
    
    if (win11Progress < 98) {
        win11Progress += 0.001 * speedMult;
    }
    let progress = Math.floor(win11Progress);
    
    ctx.fillText(`Working on updates ${progress}%`, width / 2, height / 2 + 40);
    
    ctx.fillStyle = '#aaa';
    ctx.font = '16px "Segoe UI", sans-serif';
    ctx.fillText('Please keep your computer on.', width / 2, height / 2 + 80);
    
    let displayEta = Math.max(1, Math.ceil(win11Eta * (100 - win11Progress) / 100));
    ctx.fillText(`Estimated time remaining: ${displayEta} minute${displayEta > 1 ? 's' : ''}`, width / 2, height / 2 + 110);
    
    let spinnerRadius = 30;
    let cx = width / 2;
    let cy = height / 2 - 40;
    let numDots = 6;
    for (let i = 0; i < numDots; i++) {
        let angle = (time * 3) - (i * 0.4);
        let opacity = 1 - (i / numDots);
        let x = cx + Math.cos(angle) * spinnerRadius;
        let y = cy + Math.sin(angle) * spinnerRadius;
        
        ctx.fillStyle = `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${opacity})`;
        ctx.beginPath();
        ctx.arc(x, y, 4, 0, Math.PI * 2);
        ctx.fill();
    }
    time += 0.015 * speedMult;
}

// --- Animation 6: Digital Rain ---
function drawMatrix(color) {
    const speedMult = parseFloat(document.getElementById('matrixSpeed').value);
    const fontSize = parseInt(document.getElementById('matrixFontSize').value);
    const rgb = hexToRgb(color);
    const columns = Math.floor(width / fontSize) + 1;
    
    if (matrixDrops.length !== columns) {
        matrixDrops = [];
        for (let i = 0; i < columns; i++) {
            matrixDrops[i] = Math.random() * -100;
        }
    }
    
    ctx.fillStyle = 'rgba(0, 0, 0, 0.08)';
    ctx.fillRect(0, 0, width, height);
    
    ctx.fillStyle = `rgb(${rgb.r}, ${rgb.g}, ${rgb.b})`;
    ctx.font = fontSize + 'px monospace';
    ctx.textAlign = 'left';
    
    for (let i = 0; i < matrixDrops.length; i++) {
        const char = String.fromCharCode(0x30A0 + Math.random() * 96);
        const x = i * fontSize;
        const y = Math.floor(matrixDrops[i]) * fontSize;
        
        ctx.fillText(char, x, y);
        
        if (y > height && Math.random() > 0.98) {
            matrixDrops[i] = 0;
        }
        matrixDrops[i] += 0.4 * speedMult;
    }
}

// --- Animation 7: Neon Waves ---
function drawNeon(color) {
    const waveCount = parseInt(document.getElementById('neonCount').value);
    const speedMult = parseFloat(document.getElementById('neonSpeed').value);
    const amplitude = parseFloat(document.getElementById('neonAmp').value);
    const lineW = parseFloat(document.getElementById('neonWidth').value);

    ctx.fillStyle = 'rgba(0, 0, 0, 0.08)';
    ctx.fillRect(0, 0, width, height);
    
    const rgb = hexToRgb(color);
    
    for (let i = 0; i < waveCount; i++) {
        ctx.beginPath();
        for (let x = 0; x <= width; x += 10) {
            let y = height / 2 + 
                    Math.sin(x * 0.005 + time + i) * (height / 4) * amplitude + 
                    Math.sin(x * 0.002 - time * 0.8 + i * 1.5) * (height / 5) * amplitude;
            if (x === 0) ctx.moveTo(x, y);
            else ctx.lineTo(x, y);
        }
        ctx.strokeStyle = `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.5)`;
        ctx.lineWidth = lineW;
        ctx.stroke();
    }
    time += 0.015 * speedMult;
}

// --- Animation 8: Fireworks ---
function drawFireworks(color) {
    const frequency = parseFloat(document.getElementById('fwFreq').value);
    const sparkCount = parseInt(document.getElementById('fwSparks').value);
    const gravity = parseFloat(document.getElementById('fwGravity').value);

    ctx.fillStyle = 'rgba(0, 0, 0, 0.2)';
    ctx.fillRect(0, 0, width, height);

    if (Math.random() < 0.03 * frequency) {
        particles.push({
            x: Math.random() * width,
            y: height,
            vx: (Math.random() - 0.5) * 3,
            vy: -(Math.random() * 4 + 7),
            type: 'rocket',
            color: `hsl(${Math.random() * 360}, 100%, 60%)`,
            life: 1
        });
    }

    for (let i = particles.length - 1; i >= 0; i--) {
        let p = particles[i];
        p.x += p.vx;
        p.y += p.vy;
        p.vy += gravity;

        if (p.type === 'rocket') {
            ctx.fillStyle = p.color;
            ctx.beginPath();
            ctx.arc(p.x, p.y, 3, 0, Math.PI * 2);
            ctx.fill();

            if (p.vy >= -1) {
                particles.splice(i, 1);
                for (let j = 0; j < sparkCount; j++) {
                    let angle = Math.random() * Math.PI * 2;
                    let speed = Math.random() * 4 + 1;
                    particles.push({
                        x: p.x,
                        y: p.y,
                        vx: Math.cos(angle) * speed,
                        vy: Math.sin(angle) * speed,
                        type: 'spark',
                        color: p.color,
                        life: 1,
                        decay: Math.random() * 0.02 + 0.015
                    });
                }
            }
        } else {
            p.life -= p.decay;
            ctx.fillStyle = p.color;
            ctx.globalAlpha = Math.max(0, p.life);
            ctx.beginPath();
            ctx.arc(p.x, p.y, 1.5, 0, Math.PI * 2);
            ctx.fill();
            ctx.globalAlpha = 1;

            if (p.life <= 0) {
                particles.splice(i, 1);
            }
        }
    }
}

// --- Animation 9: Bouncing Text ---
function drawBouncing(color) {
    const speedMult = parseFloat(document.getElementById('bounceSpeed').value);
    const size = parseInt(document.getElementById('bounceSize').value);
    const trail = parseFloat(document.getElementById('bounceTrail').value);
    const textInput = document.getElementById('bounceText');
    
    if (trail > 0) {
        ctx.fillStyle = `rgba(0, 0, 0, ${1 - trail})`;
        ctx.fillRect(0, 0, width, height);
    } else {
        ctx.fillStyle = '#000';
        ctx.fillRect(0, 0, width, height);
    }
    
    let bs = bounceState;
    if (textInput && textInput.value !== bs.text) bs.text = textInput.value || 'DVD';
    bs.x += bs.vx * speedMult;
    bs.y += bs.vy * speedMult;
    
    ctx.font = `bold ${size}px sans-serif`;
    const metrics = ctx.measureText(bs.text);
    const textWidth = metrics.width;
    const textHeight = size;
    
    let hw = textWidth / 2;
    let hh = textHeight / 2;
    
    let bounced = false;
    if (bs.x - hw < 0 || bs.x + hw > width) {
        bs.vx *= -1;
        bounced = true;
        bs.x = Math.max(hw, Math.min(width - hw, bs.x));
    }
    if (bs.y - hh < 0 || bs.y + hh > height) {
        bs.vy *= -1;
        bounced = true;
        bs.y = Math.max(hh, Math.min(height - hh, bs.y));
    }
    
    if (bounced) {
        bs.color = `hsl(${Math.random() * 360}, 100%, 60%)`;
    }
    
    ctx.fillStyle = bs.color;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(bs.text, bs.x, bs.y);
}

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

// --- Animation 12: Water Ripples ---
// A heightfield wave simulation at 1/3 resolution. Each pixel refracts a moonlit night-sky
// backdrop by the local surface slope and adds a specular glint, so drops read as real water.
let rip = null;

function initRipples(color) {
    const cell = 3;
    const w = Math.ceil(width / cell) + 2, h = Math.ceil(height / cell) + 2; // +2: border ring stays flat
    const c = hexToRgb(color);
    const bg = new Float32Array(w * h * 3);
    const mx = w * 0.64, my = h * 0.18;
    for (let y = 0; y < h; y++) {
        const v = y / h;
        const sky = 0.07 + 0.36 * (1 - v) * (1 - v); // tinted glow near the horizon, deep water below
        for (let x = 0; x < w; x++) {
            const ex = (x - mx) / (w * 0.03), ey = (y - my) / (h * 0.3);
            const moon = Math.exp(-(ex * ex + ey * ey)) * 0.8 + Math.exp(-(ex * ex) / 30 - ey * ey) * 0.12;
            const i = (y * w + x) * 3;
            bg[i] = c.r * sky + (210 + c.r * 0.2) * moon;
            bg[i + 1] = c.g * sky + (215 + c.g * 0.2) * moon;
            bg[i + 2] = c.b * sky + (225 + c.b * 0.2) * moon;
        }
    }
    for (let k = 0; k < w * h / 1500; k++) { // reflected stars, so the distortion has detail to bend
        const i = ((Math.random() * h * 0.7 | 0) * w + (Math.random() * w | 0)) * 3;
        const s = 30 + Math.random() * Math.random() * 200;
        bg[i] += s; bg[i + 1] += s; bg[i + 2] += s;
    }
    const out = document.createElement('canvas');
    out.width = w - 2;
    out.height = h - 2;
    const octx = out.getContext('2d');
    const img = octx.createImageData(w - 2, h - 2);
    for (let i = 3; i < img.data.length; i += 4) img.data[i] = 255;
    rip = { color, width, height, w, h, bg, out, octx, img, cur: new Float32Array(w * h), prev: new Float32Array(w * h), acc: 0 };
}

function rippleDrop(x, y, r, amp) {
    const { w, h, cur } = rip;
    for (let j = Math.max(1, Math.floor(y - r)); j <= Math.min(h - 2, Math.ceil(y + r)); j++) {
        for (let k = Math.max(1, Math.floor(x - r)); k <= Math.min(w - 2, Math.ceil(x + r)); k++) {
            const d = Math.hypot(k - x, j - y) / r;
            if (d < 1) cur[j * w + k] -= amp * (Math.cos(d * Math.PI) + 1) * 0.5;
        }
    }
}

function drawRipples(color) {
    const freq = parseFloat(document.getElementById('rippleFreq').value);
    const rippleSpeed = parseFloat(document.getElementById('rippleSpeed').value);
    const maxSize = parseFloat(document.getElementById('rippleMaxSize').value);

    if (particles.length === 0 || !rip || rip.color !== color || rip.width !== width || rip.height !== height) {
        initRipples(color);
        particles = [rip]; // resetCanvas() empties particles, which forces a rebuild here
    }
    const now = performance.now();
    const dt = Math.min(0.1, (now - (rip.last ?? now)) / 1000);
    rip.last = now;
    const { w, h, bg, img } = rip;

    // Rain: on average freq * 2.5 drops per second, now and then a big plop
    for (let n = freq * 2.5 * dt; Math.random() < n; n--) {
        const big = Math.random() < 0.08;
        const r = (1.5 + maxSize / 30 * (0.4 + Math.random() * 0.6)) * (big ? 1.8 : 1);
        rippleDrop(1 + Math.random() * (w - 2), 1 + Math.random() * (h - 2), r, (big ? 30 : 18) + r * 2);
    }

    // Wave equation: 30 * speed steps per second, whatever the refresh rate
    rip.acc += dt * 30 * rippleSpeed;
    const steps = Math.min(8, rip.acc | 0);
    rip.acc = rip.acc > 8 ? 0 : rip.acc - steps;
    for (let s = 0; s < steps; s++) {
        const cur = rip.cur, prev = rip.prev;
        for (let y = 1; y < h - 1; y++) {
            for (let i = y * w + 1, end = y * w + w - 1; i < end; i++) {
                prev[i] = ((cur[i - 1] + cur[i + 1] + cur[i - w] + cur[i + w]) * 0.5 - prev[i]) * 0.985;
            }
        }
        rip.cur = prev;
        rip.prev = cur;
    }

    // Shade: the slope bends the backdrop lookup and lights a glint from the upper left
    const cur = rip.cur, d = img.data;
    let o = 0;
    for (let y = 1; y < h - 1; y++) {
        for (let x = 1; x < w - 1; x++) {
            const i = y * w + x;
            const sx = cur[i - 1] - cur[i + 1], sy = cur[i - w] - cur[i + w];
            let bx = (x + sx * 3) | 0, by = (y + sy * 3) | 0;
            bx = bx < 0 ? 0 : bx >= w ? w - 1 : bx;
            by = by < 0 ? 0 : by >= h ? h - 1 : by;
            const b = (by * w + bx) * 3;
            const l = sx * 0.6 + sy * 0.8;
            const spec = l > 0 ? l * l * 3 : 0;
            const shade = 1 + l * 0.06;
            d[o] = bg[b] * shade + spec;
            d[o + 1] = bg[b + 1] * shade + spec;
            d[o + 2] = bg[b + 2] * shade + spec;
            o += 4;
        }
    }
    rip.octx.putImageData(img, 0, 0);
    ctx.imageSmoothingEnabled = true;
    ctx.drawImage(rip.out, 0, 0, (w - 2) * 3, (h - 2) * 3); // 3 = cell size, a few px past the edge is fine
}

// --- Animation 13: Aurora Borealis ---
function drawAurora(color) {
    const curtainCount = parseInt(document.getElementById('auroraCurtains').value);
    const speedMult = parseFloat(document.getElementById('auroraSpeed').value);
    const intensity = parseFloat(document.getElementById('auroraIntensity').value);

    ctx.fillStyle = 'rgba(0, 0, 0, 0.04)';
    ctx.fillRect(0, 0, width, height);

    const rgb = hexToRgb(color);

    // Stars background (once)
    if (particles.length === 0) {
        for (let i = 0; i < 120; i++) {
            particles.push({
                x: Math.random() * width,
                y: Math.random() * height,
                size: Math.random() * 1.2 + 0.3,
                twinkle: Math.random() * 0.03 + 0.005
            });
        }
    }
    ctx.fillStyle = '#fff';
    particles.forEach(p => {
        ctx.globalAlpha = (Math.sin(time * p.twinkle * 200) + 1) / 2 * 0.6 + 0.2;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fill();
    });
    ctx.globalAlpha = 1;

    for (let c = 0; c < curtainCount; c++) {
        let baseY = height * 0.15 + c * (height * 0.06);
        
        ctx.beginPath();
        for (let x = 0; x <= width; x += 4) {
            let y = baseY +
                Math.sin(x * 0.002 + time * speedMult * 0.8 + c * 2.3) * 60 +
                Math.sin(x * 0.005 - time * speedMult * 0.4 + c * 1.1) * 35 +
                Math.cos(x * 0.001 + time * speedMult * 0.6) * 25;
            if (x === 0) ctx.moveTo(x, y);
            else ctx.lineTo(x, y);
        }
        ctx.lineTo(width, height);
        ctx.lineTo(0, height);
        ctx.closePath();

        let hueShift = c * 25;
        let r = Math.min(255, rgb.r + hueShift * 0.3);
        let g = Math.min(255, rgb.g + hueShift * 0.5);
        let b = Math.min(255, rgb.b - hueShift * 0.2);

        let grad = ctx.createLinearGradient(0, baseY - 60, 0, height * 0.75);
        grad.addColorStop(0, `rgba(${r}, ${g}, ${b}, ${0.12 * intensity})`);
        grad.addColorStop(0.4, `rgba(${r * 0.6}, ${g * 0.8}, ${b}, ${0.06 * intensity})`);
        grad.addColorStop(1, 'rgba(0, 0, 0, 0)');
        ctx.fillStyle = grad;
        ctx.fill();
    }
    time += 0.008;
}

// --- Animation 14: Plasma ---
function drawPlasma(color) {
    const speed = parseFloat(document.getElementById('plasmaSpeed').value);
    const scale = parseFloat(document.getElementById('plasmaScale').value);
    const rgb = hexToRgb(color);

    if (!plasmaCanvas) {
        plasmaCanvas = document.createElement('canvas');
        plasmaCtx = plasmaCanvas.getContext('2d');
    }

    const res = 6;
    const pw = Math.ceil(width / res);
    const ph = Math.ceil(height / res);

    if (plasmaCanvas.width !== pw || plasmaCanvas.height !== ph) {
        plasmaCanvas.width = pw;
        plasmaCanvas.height = ph;
    }

    const imgData = plasmaCtx.createImageData(pw, ph);
    const data = imgData.data;
    const t = time * speed;

    for (let py = 0; py < ph; py++) {
        for (let px = 0; px < pw; px++) {
            let x = px * res;
            let y = py * res;
            let v = Math.sin(x * scale * 0.008 + t);
            v += Math.sin((y * scale * 0.008 + t) * 0.5);
            v += Math.sin((x + y) * scale * 0.004 + t) * 0.5;
            v += Math.sin(Math.sqrt(x * x + y * y) * scale * 0.004 + t);

            let val = (Math.sin(v * Math.PI) + 1) * 0.5;
            let val2 = (Math.cos(v * Math.PI * 0.7) + 1) * 0.5;

            let idx = (py * pw + px) * 4;
            data[idx] = Math.floor(rgb.r * val + (1 - val) * 15);
            data[idx + 1] = Math.floor(rgb.g * val2 * 0.8 + (1 - val2) * 30);
            data[idx + 2] = Math.floor(rgb.b * (1 - val * 0.4) + val * 25);
            data[idx + 3] = 255;
        }
    }

    plasmaCtx.putImageData(imgData, 0, 0);
    ctx.imageSmoothingEnabled = true;
    ctx.drawImage(plasmaCanvas, 0, 0, width, height);
    time += 0.015;
}

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

// --- Animation 16: Julia Set ---
function drawJuliaSet(color) {
    const speed = parseFloat(document.getElementById('juliaSpeed').value);
    const zoom = parseFloat(document.getElementById('juliaZoom').value);
    const maxIter = parseInt(document.getElementById('juliaIter').value);
    const rgb = hexToRgb(color);

    if (!plasmaCanvas) {
        plasmaCanvas = document.createElement('canvas');
        plasmaCtx = plasmaCanvas.getContext('2d');
    }

    const res = 4;
    const pw = Math.ceil(width / res);
    const ph = Math.ceil(height / res);

    if (plasmaCanvas.width !== pw || plasmaCanvas.height !== ph) {
        plasmaCanvas.width = pw;
        plasmaCanvas.height = ph;
    }

    const imgData = plasmaCtx.createImageData(pw, ph);
    const data = imgData.data;

    // Animate c parameter in a smooth complex orbit
    const t = time * speed * 0.3;
    const cr = 0.7885 * Math.cos(t * 0.6 + Math.sin(t * 0.15) * 0.5);
    const ci = 0.7885 * Math.sin(t * 0.6 + Math.cos(t * 0.2) * 0.3);

    const invZoom = 1.5 / zoom;
    const aspect = pw / ph;

    for (let py = 0; py < ph; py++) {
        for (let px = 0; px < pw; px++) {
            let zr = (px / pw - 0.5) * 2 * aspect * invZoom;
            let zi = (py / ph - 0.5) * 2 * invZoom;

            let iter = 0;
            while (iter < maxIter) {
                let zr2 = zr * zr;
                let zi2 = zi * zi;
                if (zr2 + zi2 > 4) break;
                zi = 2 * zr * zi + ci;
                zr = zr2 - zi2 + cr;
                iter++;
            }

            let idx = (py * pw + px) * 4;
            if (iter === maxIter) {
                data[idx] = data[idx + 1] = data[idx + 2] = 0;
            } else {
                // Smooth coloring (continuous iteration count)
                let log_zn = Math.log(zr * zr + zi * zi) / 2;
                let nu = Math.log(log_zn / Math.LN2) / Math.LN2;
                let smoothIter = iter + 1 - nu;
                let s = smoothIter * 0.04;

                // Cosine palette (Inigo Quilez technique) blended with base color
                let cr2 = 0.5 + 0.5 * Math.cos(6.2832 * (s + 0.0));
                let cg = 0.5 + 0.5 * Math.cos(6.2832 * (s + 0.15));
                let cb = 0.5 + 0.5 * Math.cos(6.2832 * (s + 0.33));

                data[idx]     = Math.min(255, Math.floor(cr2 * rgb.r * 1.2));
                data[idx + 1] = Math.min(255, Math.floor(cg * rgb.g * 1.2));
                data[idx + 2] = Math.min(255, Math.floor(cb * rgb.b * 1.2));
            }
            data[idx + 3] = 255;
        }
    }

    plasmaCtx.putImageData(imgData, 0, 0);
    ctx.imageSmoothingEnabled = true;
    ctx.drawImage(plasmaCanvas, 0, 0, width, height);
    time += 0.008;
}

// --- Shared: fractal offscreen canvas helper ---
function ensureFractalCanvas() {
    if (!plasmaCanvas) {
        plasmaCanvas = document.createElement('canvas');
        plasmaCtx = plasmaCanvas.getContext('2d');
    }
    const res = 4;
    const pw = Math.ceil(width / res);
    const ph = Math.ceil(height / res);
    if (plasmaCanvas.width !== pw || plasmaCanvas.height !== ph) {
        plasmaCanvas.width = pw;
        plasmaCanvas.height = ph;
    }
    return { pw, ph, res };
}

function fractalCosinePalette(smoothIter, rgb) {
    let s = smoothIter * 0.04;
    let cr2 = 0.5 + 0.5 * Math.cos(6.2832 * (s + 0.0));
    let cg = 0.5 + 0.5 * Math.cos(6.2832 * (s + 0.15));
    let cb = 0.5 + 0.5 * Math.cos(6.2832 * (s + 0.33));
    return [
        Math.min(255, Math.floor(cr2 * rgb.r * 1.2)),
        Math.min(255, Math.floor(cg * rgb.g * 1.2)),
        Math.min(255, Math.floor(cb * rgb.b * 1.2))
    ];
}

// --- Animation 17: Mandelbrot (auto-zoom) ---
function drawMandelbrot(color) {
    const speed = parseFloat(document.getElementById('mbSpeed').value);
    const maxIter = parseInt(document.getElementById('mbIter').value);
    const zoomDepth = parseFloat(document.getElementById('mbZoomDepth').value);
    const rgb = hexToRgb(color);

    const { pw, ph } = ensureFractalCanvas();
    const imgData = plasmaCtx.createImageData(pw, ph);
    const data = imgData.data;

    // Zoom target: a visually rich point on the Mandelbrot boundary
    const targetR = -0.7435669;
    const targetI = 0.1314023;

    const t = time * speed * 0.15;
    const cycle = (Math.sin(t * 0.5) + 1) * 0.5; // 0..1 ping-pong
    const zoomLevel = Math.pow(2, 1 + cycle * zoomDepth);
    const viewSize = 2.0 / zoomLevel;
    const aspect = pw / ph;

    // Slowly rotate color palette
    const paletteShift = time * speed * 0.02;

    for (let py = 0; py < ph; py++) {
        for (let px = 0; px < pw; px++) {
            let cr = targetR + (px / pw - 0.5) * viewSize * aspect;
            let ci = targetI + (py / ph - 0.5) * viewSize;

            let zr = 0, zi = 0, iter = 0;
            while (iter < maxIter) {
                let zr2 = zr * zr, zi2 = zi * zi;
                if (zr2 + zi2 > 4) break;
                zi = 2 * zr * zi + ci;
                zr = zr2 - zi2 + cr;
                iter++;
            }

            let idx = (py * pw + px) * 4;
            if (iter === maxIter) {
                data[idx] = data[idx + 1] = data[idx + 2] = 0;
            } else {
                let log_zn = Math.log(zr * zr + zi * zi) / 2;
                let nu = Math.log(log_zn / Math.LN2) / Math.LN2;
                let smoothIter = iter + 1 - nu + paletteShift * 25;
                let c = fractalCosinePalette(smoothIter, rgb);
                data[idx] = c[0]; data[idx+1] = c[1]; data[idx+2] = c[2];
            }
            data[idx + 3] = 255;
        }
    }

    plasmaCtx.putImageData(imgData, 0, 0);
    ctx.imageSmoothingEnabled = true;
    ctx.drawImage(plasmaCanvas, 0, 0, width, height);
    time += 0.008;
}

// --- Animation 18: Phoenix Fractal ---
function drawPhoenix(color) {
    const speed = parseFloat(document.getElementById('phxSpeed').value);
    const maxIter = parseInt(document.getElementById('phxIter').value);
    const distort = parseFloat(document.getElementById('phxDistort').value);
    const rgb = hexToRgb(color);

    const { pw, ph } = ensureFractalCanvas();
    const imgData = plasmaCtx.createImageData(pw, ph);
    const data = imgData.data;

    const t = time * speed * 0.3;
    const aspect = pw / ph;

    // Animated Phoenix parameters — p and c orbit slowly
    const cr = -0.5 + Math.sin(t * 0.2) * 0.15;
    const ci = Math.cos(t * 0.17) * 0.1;
    const pr = 0.5667 + Math.sin(t * 0.25) * distort * 0.15;
    const pi = Math.cos(t * 0.3) * distort * 0.1;

    // Animated view — gentle zoom + drift
    const zoomCycle = (Math.sin(t * 0.15) + 1) * 0.5;
    const zoom = Math.pow(2, 0.3 + zoomCycle * 2.5);
    const viewSize = 3.0 / zoom;
    const panX = Math.sin(t * 0.08) * 0.3;
    const panY = Math.cos(t * 0.06) * 0.2;
    const paletteShift = time * speed * 0.02;

    for (let py2 = 0; py2 < ph; py2++) {
        for (let px2 = 0; px2 < pw; px2++) {
            // Map pixel to complex plane
            let y0 = panY + (py2 / ph - 0.5) * viewSize;
            let x0 = panX + (px2 / pw - 0.5) * viewSize * aspect;

            // Phoenix iteration: z_{n+1} = z_n^2 + c + p * z_{n-1}
            let zr = x0, zi = y0;
            let prevR = 0, prevI = 0;
            let iter = 0;

            while (iter < maxIter) {
                let zr2 = zr * zr, zi2 = zi * zi;
                if (zr2 + zi2 > 4) break;

                let newR = zr2 - zi2 + cr + pr * prevR - pi * prevI;
                let newI = 2 * zr * zi + ci + pr * prevI + pi * prevR;

                prevR = zr;
                prevI = zi;
                zr = newR;
                zi = newI;
                iter++;
            }

            let idx = (py2 * pw + px2) * 4;
            if (iter === maxIter) {
                data[idx] = data[idx + 1] = data[idx + 2] = 0;
            } else {
                let log_zn = Math.log(zr * zr + zi * zi) / 2;
                let nu = Math.log(log_zn / Math.LN2) / Math.LN2;
                let smoothIter = iter + 1 - nu + paletteShift * 25;
                let c = fractalCosinePalette(smoothIter, rgb);
                data[idx] = c[0]; data[idx+1] = c[1]; data[idx+2] = c[2];
            }
            data[idx + 3] = 255;
        }
    }

    plasmaCtx.putImageData(imgData, 0, 0);
    ctx.imageSmoothingEnabled = true;
    ctx.drawImage(plasmaCanvas, 0, 0, width, height);
    time += 0.008;
}

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

// true = key consumed (so it doesn't wake the settings panel)
function meshHotkey(e) {
    if (typeSelect.value !== 'mesh' || e.type !== 'keydown' || e.ctrlKey || e.altKey || e.metaKey) return false;
    if (!ui.classList.contains('hidden') && e.target.closest && e.target.closest('input, select, textarea, button')) return false;
    const fn = MESH_KEYS[e.code];
    if (!fn) return false;
    e.preventDefault();
    fn();
    return true;
}

// Touch: tapping the mesh opens its controls instead of the settings panel (which has its own button there)
let meshTouchAt = -1e9;
window.addEventListener('touchstart', () => { meshTouchAt = performance.now(); }, { passive: true });
function meshTap(e) {
    if (typeSelect.value !== 'mesh' || e.type !== 'click' || performance.now() - meshTouchAt > 1000) return false;
    if (e.target.closest('#ui, #meshHelp')) return false;
    meshToggle(meshHelp);
    return true;
}

// On-screen buttons, held ones repeat (like Meshy's mobile panel)
let meshRepeat;
const meshStopRepeat = () => clearInterval(meshRepeat);
meshHelp.addEventListener('pointerdown', e => {
    const btn = e.target.closest('button[data-key]');
    if (!btn) return;
    e.preventDefault(); // keep focus off the button, so Space/Enter stay hotkeys
    const fn = MESH_KEYS[btn.dataset.key];
    fn();
    meshStopRepeat();
    if (MESH_REPEAT.has(btn.dataset.key)) meshRepeat = setInterval(fn, 80);
});
window.addEventListener('pointerup', meshStopRepeat);
window.addEventListener('pointercancel', meshStopRepeat);
meshHelp.addEventListener('click', e => e.stopPropagation()); // don't wake the settings panel

window.addEventListener('contextmenu', e => {
    if (typeSelect.value !== 'mesh' || e.target.closest('#ui')) return;
    e.preventDefault();
    if (!e.target.closest('#meshHelp')) meshToggle(meshHelp); // long-press on a button must not close the panel
});
typeSelect.addEventListener('change', () => {
    if (typeSelect.value !== 'mesh') meshHelp.hidden = meshStatsEl.hidden = meshTip.hidden = true;
});
function showMeshTip() {
    meshTip.textContent = matchMedia('(pointer: coarse)').matches ? 'Tap the mesh for controls' : 'Right-click or press H for hotkeys';
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

// --- Animation 23: Silk ---
// A Peter de Jong attractor drawn as a density map: every frame a few hundred thousand orbit points
// are binned into a buffer that fades slowly, while the four map parameters drift so the shape flows.
let silk = null;

function drawSilk(color) {
    const speed = parseFloat(document.getElementById('silkSpeed').value);
    const points = parseFloat(document.getElementById('silkPoints').value) * 100000;
    const q = Math.ceil(height / 600); // buffer of at most 600 rows keeps the per-pixel passes cheap
    const bw = Math.ceil(width / q), bh = Math.ceil(height / q);

    if (particles.length === 0 || !silk || silk.bw !== bw || silk.bh !== bh) {
        const cv = document.createElement('canvas');
        cv.width = bw; cv.height = bh;
        const cx = cv.getContext('2d'), img = cx.createImageData(bw, bh);
        silk = { bw, bh, cv, cx, img, px: new Uint32Array(img.data.buffer), dens: new Float32Array(bw * bh), tint: new Float32Array(bw * bh), t: Math.random() * 100, max: 1 };
        particles = [silk];
    }
    const S = silk, dt = frameDt(S), { dens, tint, px } = S;
    S.t += dt * speed * 0.02;
    const t = S.t;
    const a = 1.9 + 0.9 * Math.sin(t * 1.0), b = -2.0 + 0.8 * Math.sin(t * 0.73 + 1.3);
    const c = 2.0 + 0.8 * Math.sin(t * 0.61 + 2.9), d = -1.9 + 0.9 * Math.sin(t * 0.47 + 4.1);

    const decay = Math.pow(0.94, dt * 60);
    let max = 0;
    for (let i = 0; i < dens.length; i++) {
        tint[i] *= decay;
        if ((dens[i] *= decay) > max) max = dens[i];
    }

    const sy = Math.min(bw, bh) / 4.3, sx = sy * Math.min(1.6, bw / bh), ox = bw / 2, oy = bh / 2;
    let x = 0, y = 0;
    const count = points * Math.max(0.2, dt * 60); // same work per second at any refresh rate
    for (let i = 0; i < count; i++) {
        if (i % 2000 === 0) { x = Math.random() * 4 - 2; y = Math.random() * 4 - 2; }
        const say = Math.sin(a * y);
        const nx = say - Math.cos(b * x), ny = Math.sin(c * x) - Math.cos(d * y);
        x = nx; y = ny;
        if (i % 2000 < 20) continue; // let a fresh orbit settle onto the attractor first
        const p = (oy + y * sy | 0) * bw + (ox + x * sx | 0);
        dens[p]++;
        tint[p] += say * 0.5 + 0.5;
    }

    S.max += (max - S.max) * 0.1; // smoothed, or the exposure flickers
    const gain = 250 / (S.max + 1), inv = 1 / Math.log1p(250);
    const lo = duoRamp(color, 0), hi = duoRamp(color, 0.5);
    for (let i = 0; i < dens.length; i++) {
        const dn = dens[i];
        if (dn < 0.02) { px[i] = 0xff000000; continue; }
        const v = Math.min(1, Math.log1p(dn * gain) * inv), m = tint[i] / dn, w = v * v * v * 200;
        const r = (lo[0] + (hi[0] - lo[0]) * m) * v + w, g = (lo[1] + (hi[1] - lo[1]) * m) * v + w, bl = (lo[2] + (hi[2] - lo[2]) * m) * v + w;
        px[i] = 0xff000000 | (bl > 255 ? 255 : bl) << 16 | (g > 255 ? 255 : g) << 8 | (r > 255 ? 255 : r);
    }
    S.cx.putImageData(S.img, 0, 0);
    ctx.imageSmoothingEnabled = true;
    ctx.drawImage(S.cv, 0, 0, bw * q, bh * q);
}

// --- Animation 24: Black Hole ---
// A fragment shader bends every pixel's light ray through Schwarzschild gravity, live. Where a ray
// crosses the accretion disk it picks up glowing gas (Doppler-brightened on the approaching side);
// rays that escape sample a procedural star field, so the sky behind the hole is lensed too.
let hole = null;
const HOLE_FRAG = `
precision highp float;
uniform vec2 uRes;
uniform float uTime, uTilt, uDop, uFire;
uniform vec3 uBase;
const float RIN = 2.6, ROUT = 12.0; // disk edges, in horizon radii

float hash(vec3 p) { p = fract(p * 0.3183099 + 0.1); p *= 17.0; return fract(p.x * p.y * p.z * (p.x + p.y + p.z)); }
float noise(vec3 x) {
    vec3 i = floor(x), f = fract(x); f = f * f * (3.0 - 2.0 * f);
    return mix(mix(mix(hash(i), hash(i + vec3(1, 0, 0)), f.x), mix(hash(i + vec3(0, 1, 0)), hash(i + vec3(1, 1, 0)), f.x), f.y),
               mix(mix(hash(i + vec3(0, 0, 1)), hash(i + vec3(1, 0, 1)), f.x), mix(hash(i + vec3(0, 1, 1)), hash(i + vec3(1, 1, 1)), f.x), f.y), f.z);
}
float fbm(vec3 p) { float v = 0.0, a = 0.5; for (int i = 0; i < 5; i++) { v += a * noise(p); p = p * 2.03 + 7.1; a *= 0.5; } return v; }

// Gas density at (radius, angle) after orbiting for tau: inner rings turn faster (Kepler), shearing it into streaks
float gas(float r, float phi, float tau, float seed) {
    float a = phi - tau * 1.1 * pow(r, -1.5);
    return fbm(vec3(cos(a) * 2.2, sin(a) * 2.2, r * 1.5 + seed));
}

vec3 heat(float x) {
    vec3 fire = vec3(3.0 * x, 2.1 * x * x, 1.7 * x * x * x);
    vec3 tint = uBase * min(2.0 * x, 1.5) + (1.0 - uBase) * pow(max(0.0, 2.0 * x - 1.0), 1.5);
    return mix(tint, fire, uFire);
}

vec3 stars(vec3 d, float S, float rad) {
    vec3 p = d * S, id = floor(p);
    vec3 at = id + 0.2 + 0.6 * vec3(hash(id), hash(id + 11.1), hash(id + 23.7));
    float b = pow(hash(id + 5.5), 5.0) * 2.5 + 0.05;
    return smoothstep(rad, 0.0, length(p - at)) * b * mix(vec3(1.0, 0.8, 0.6), vec3(0.7, 0.85, 1.0), hash(id + 3.3));
}

vec3 sky(vec3 d) {
    float a = uTime * 0.004, ca = cos(a), sa = sin(a);
    d.xz = vec2(d.x * ca - d.z * sa, d.x * sa + d.z * ca);
    float px = 1.8 / min(uRes.x, uRes.y * 1.7); // about a pixel and a half, as an angle
    vec3 c = stars(d, 70.0, 70.0 * px) + stars(d, 150.0, 150.0 * px);
    float n = fbm(d * 2.2 + 4.0);
    return c + vec3(0.25, 0.3, 0.5) * 0.12 * n * n * n;
}

void main() {
    vec2 q = (gl_FragCoord.xy - 0.5 * uRes) / min(uRes.x, uRes.y * 1.7);
    q = vec2(q.x * 0.99 - q.y * 0.14, q.x * 0.14 + q.y * 0.99); // slight camera roll
    float si = sin(uTilt), ci = cos(uTilt);
    vec3 pos = vec3(0.0, 30.0 * si, -30.0 * ci); // camera above the disk plane (y = 0), looking at the hole
    vec3 v = normalize(vec3(0.0, -si, ci) * 0.9 + vec3(q.x, 0.0, 0.0) + vec3(0.0, ci, si) * q.y);
    vec3 hv = cross(pos, v);
    float h2 = dot(hv, hv), trans = 1.0, glow = 0.0;
    vec3 col = vec3(0.0);
    bool escaped = false;

    const float P = 26.0; // two gas layers, each rewound every P seconds while the other covers for it
    float ta = fract(uTime / P), tb = fract(uTime / P + 0.5);

    for (int s = 0; s < 260; s++) {
        float r2 = dot(pos, pos);
        if (r2 < 1.0) break; // fell through the horizon
        if (r2 > 1300.0 && dot(pos, v) > 0.0) { escaped = true; break; }
        // Photon path in Schwarzschild space: acceleration = -1.5 h^2 pos / r^5
        float r = sqrt(r2), dt = 0.01 + 0.045 * r;
        v -= pos * (1.5 * h2 / (r2 * r2 * r)) * dt;
        vec3 np = pos + v * dt;
        if (pos.y * np.y < 0.0) { // crossed the disk plane
            vec3 hp = mix(pos, np, pos.y / (pos.y - np.y));
            float rr = length(hp.xz);
            if (rr > RIN && rr < ROUT) {
                float env = pow(RIN / rr, 1.3) * smoothstep(RIN, RIN + 0.5, rr) * (1.0 - smoothstep(ROUT - 5.0, ROUT, rr));
                float phi = atan(hp.z, hp.x);
                float g = mix(gas(rr, phi, ta * P, 0.0), gas(rr, phi, tb * P, 31.7), abs(2.0 * ta - 1.0));
                g = smoothstep(0.22, 0.72, g) * (0.6 + 0.4 * noise(vec3(rr * 6.0, 1.5, 9.0)));
                // Relativistic beaming from the orbital speed of the gas, plus gravitational dimming
                float beta = sqrt(0.5 / rr), cosv = dot(vec3(-hp.z, 0.0, hp.x) / rr, -normalize(v));
                float dop = sqrt(1.0 - beta * beta) / (1.0 - beta * cosv);
                float boost = mix(1.0, dop * dop * dop * sqrt(1.0 - 1.0 / rr), uDop);
                float a = clamp(env * (0.3 + g) * 2.2, 0.0, 1.0);
                col += trans * a * heat(env * (0.22 + g) * boost * 1.9);
                trans *= 1.0 - a;
                if (trans < 0.02) break;
            }
        }
        if (r > RIN && r < ROUT) glow += dt * exp(-abs(pos.y) * 1.6) * pow(RIN / r, 2.5) * (1.0 - smoothstep(ROUT - 5.0, ROUT, r));
        pos = np;
    }
    if (escaped) col += trans * sky(normalize(v));
    col += heat(0.45) * glow * 0.06; // thin haze hugging the disk
    gl_FragColor = vec4(1.0 - exp(-col * 1.4), 1.0);
}`;

function initHole() {
    const cv = document.createElement('canvas'), gl = cv.getContext('webgl');
    hole = { cv, gl, t: Math.random() * 1000, u: {} };
    if (!gl) return;
    const pr = gl.createProgram();
    [[gl.VERTEX_SHADER, 'attribute vec2 p; void main() { gl_Position = vec4(p, 0.0, 1.0); }'], [gl.FRAGMENT_SHADER, HOLE_FRAG]].forEach(([type, src]) => {
        const s = gl.createShader(type);
        gl.shaderSource(s, src);
        gl.compileShader(s);
        if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) console.error(gl.getShaderInfoLog(s));
        gl.attachShader(pr, s);
    });
    gl.bindAttribLocation(pr, 0, 'p');
    gl.linkProgram(pr);
    gl.useProgram(pr);
    gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW); // one triangle covering the screen
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
    for (const n of ['uRes', 'uTime', 'uTilt', 'uDop', 'uFire', 'uBase']) hole.u[n] = gl.getUniformLocation(pr, n);
}

function drawHole(color) {
    if (!hole) initHole(); // ponytail: no WebGL context-loss recovery; reload the page if the GPU resets
    const { cv, gl, u } = hole;
    if (!gl) {
        ctx.fillStyle = '#000';
        ctx.fillRect(0, 0, width, height);
        ctx.fillStyle = '#888';
        ctx.font = '20px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('Black Hole needs WebGL, which this browser has turned off.', width / 2, height / 2);
        ctx.textAlign = 'start';
        return;
    }
    const scale = parseFloat(document.getElementById('holeDetail').value) / 100;
    const w = Math.round(width * scale), h = Math.round(height * scale);
    if (cv.width !== w || cv.height !== h) { cv.width = w; cv.height = h; gl.viewport(0, 0, w, h); }
    hole.t += frameDt(hole) * parseFloat(document.getElementById('holeSpeed').value);

    const c = hexToRgb(color), tilt = parseFloat(document.getElementById('holeTilt').value);
    gl.uniform2f(u.uRes, w, h);
    gl.uniform1f(u.uTime, hole.t);
    gl.uniform1f(u.uTilt, (tilt + 2.5 * Math.sin(hole.t * 0.06)) * Math.PI / 180); // the camera bobs slowly
    gl.uniform1f(u.uDop, parseFloat(document.getElementById('holeDoppler').value));
    gl.uniform1f(u.uFire, document.getElementById('holeColors').value === 'fire' ? 1 : 0);
    gl.uniform3f(u.uBase, c.r / 255, c.g / 255, c.b / 255);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    ctx.imageSmoothingEnabled = true;
    ctx.drawImage(cv, 0, 0, width, height);
}

// --- Main Animation Loop ---
function loop() {
    const type = typeSelect.value;
    const color = colorPicker.value;

    if (type === 'solid') {
        ctx.fillStyle = color;
        ctx.fillRect(0, 0, width, height);
    } else if (type === 'slow') {
        drawSlow(color);
    } else if (type === 'mesmerizing') {
        drawMesmerizing(color);
    } else if (type === 'flow') {
        drawFlow(color);
    } else if (type === 'cosmic') {
        drawCosmic(color);
    } else if (type === 'win11') {
        drawWin11Update(color);
    } else if (type === 'matrix') {
        drawMatrix(color);
    } else if (type === 'neon') {
        drawNeon(color);
    } else if (type === 'fireworks') {
        drawFireworks(color);
    } else if (type === 'bouncing') {
        drawBouncing(color);
    } else if (type === 'synthwave') {
        drawSynthwave(color);
    } else if (type === 'tunnel') {
        drawTunnel(color);
    } else if (type === 'ripples') {
        drawRipples(color);
    } else if (type === 'aurora') {
        drawAurora(color);
    } else if (type === 'plasma') {
        drawPlasma(color);
    } else if (type === 'galaxy') {
        drawGalaxy(color);
    } else if (type === 'julia') {
        drawJuliaSet(color);
    } else if (type === 'mandelbrot') {
        drawMandelbrot(color);
    } else if (type === 'phoenix') {
        drawPhoenix(color);
    } else if (type === 'lightning') {
        drawLightning(color);
    } else if (type === 'pipes') {
        drawPipes(color);
    } else if (type === 'attractor') {
        drawAttractor(color);
    } else if (type === 'silk') {
        drawSilk(color);
    } else if (type === 'blackhole') {
        drawHole(color);
    } else if (type === 'mesh') {
        drawMesh(color);
    } else if (type === 'burnin') {
        drawBurnin();
    }

    animationId = requestAnimationFrame(loop);
}

// --- Launch Event ---
function launch() {
    isExplicitLaunch = true;
    
    ui.classList.add('hidden');
    document.body.style.cursor = 'none';
    clearTimeout(idleTimer);

    if (!document.fullscreenElement) {
        document.documentElement.requestFullscreen().catch(err => {
            console.error(`Error attempting to enable fullscreen: ${err.message}`);
        });
    }
    resetCanvas();
    if (document.activeElement) document.activeElement.blur(); // else Space/Enter re-press the Launch button
    if (typeSelect.value === 'burnin') startBurnin();
    if (typeSelect.value === 'mesh') showMeshTip();

    setTimeout(() => isExplicitLaunch = false, 500);
}

document.getElementById('startBtn').addEventListener('click', () => {
    const kind = typeSelect.value === 'burnin' ? burnWarningKind() : null;
    if (!kind || burnAcked(kind)) return launch();
    document.getElementById('burnWarnText').textContent = kind === 'fast'
        ? 'Fast speed flashes the entire screen more than 3 times per second. This can trigger seizures in people with photosensitive epilepsy. Do not continue if you, or anyone who may see this screen, is sensitive to flashing light. Exit any time with Esc.'
        : 'This pattern changes the full-screen color (at most 3 times per second). Changing colors and static can affect people with photosensitive epilepsy. Exit any time with Esc.';
    burnWarnDialog.dataset.kind = kind;
    burnWarnDialog.showModal();
});
document.getElementById('burnWarnCancel').addEventListener('click', () => burnWarnDialog.close());
document.getElementById('burnWarnStart').addEventListener('click', () => {
    burnWarnDialog.close();
    burnAck(burnWarnDialog.dataset.kind);
    launch(); // still inside the click, so fullscreen is allowed
});

document.addEventListener('fullscreenchange', () => {
    if (!isFullscreen()) {
        stopBurnin();
        ui.classList.remove('hidden');
        document.body.style.cursor = 'default';
        clearTimeout(idleTimer);
    } else {
        if (!isExplicitLaunch) {
            ui.classList.add('hidden');
            document.body.style.cursor = 'none';
            clearTimeout(idleTimer);
        }
    }
});

// Init
loadFromURL();
syncBurnFlash();
setActiveCard(typeSelect.value);
updateSettingsVisibility();
updateValueLabels();
resize();
animationId = requestAnimationFrame(loop);