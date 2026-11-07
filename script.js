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
function drawSynthwave(color) {
    const speed = parseFloat(document.getElementById('synthSpeed').value);
    const density = parseInt(document.getElementById('synthDensity').value);
    const mtnHeight = parseFloat(document.getElementById('synthMtnHeight').value);
    
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, width, height);
    
    const rgb = hexToRgb(color);
    const horizon = height * 0.5;
    
    // Stars
    if (particles.length === 0) {
        for (let i = 0; i < 150; i++) {
            particles.push({
                x: Math.random() * width,
                y: Math.random() * horizon,
                size: Math.random() * 1.5 + 0.5,
                blinkSpeed: Math.random() * 0.05 + 0.01
            });
        }
    }
    ctx.fillStyle = '#fff';
    particles.forEach(p => {
        let alpha = (Math.sin(time * p.blinkSpeed * 200) + 1) / 2 * 0.8 + 0.2;
        ctx.globalAlpha = alpha;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fill();
    });
    ctx.globalAlpha = 1;
    
    // Draw Sun
    ctx.shadowBlur = 40;
    ctx.shadowColor = `rgba(255, 80, 0, 0.8)`;
    let sunGradient = ctx.createLinearGradient(0, horizon - 150, 0, horizon);
    sunGradient.addColorStop(0, `rgba(255, 100, 0, 1)`);
    sunGradient.addColorStop(1, `rgba(255, 200, 0, 0)`);
    ctx.fillStyle = sunGradient;
    ctx.beginPath();
    ctx.arc(width / 2, horizon, 150, Math.PI, 0);
    ctx.fill();
    ctx.shadowBlur = 0;
    
    // Cut lines in sun
    let cycle = (time * 35 * speed) % 20;
    for(let i = 0; i < 150; i += 20) {
        let y = horizon - i + cycle;
        if (y < horizon) {
            let thickness = 2 + ((horizon - y) / 150) * 12;
            ctx.fillStyle = '#000';
            ctx.fillRect(width / 2 - 160, y - thickness/2, 320, thickness);
        }
    }
    
    // Grid Floor Base Background
    ctx.fillStyle = '#000';
    ctx.fillRect(0, horizon, width, height - horizon);
    
    // 3D Valley Mesh
    ctx.lineWidth = 1.5;
    
    let segmentsX = 30; 
    let segmentsZ = 40; 
    let pathWidth = 3; 
    let zSpeed = time * 3.5; 
    let zOffset = zSpeed % 1;
    let currentZInt = Math.floor(zSpeed);

    function getMountainHeight(x, z) {
        if (Math.abs(x) <= pathWidth) return 0;
        let dist = Math.abs(x) - pathWidth;
        let noise = Math.sin(x * 0.4 + z * 0.2) + (0.5 - Math.abs(Math.sin(x * 0.8 + z * 0.4))) * 2.5;
        return Math.max(0, (Math.pow(dist, 1.15) * 16 + noise * dist * 8) * mtnHeight);
    }

    function p3d(x, y, zIndex) {
        let maxZ = segmentsZ + 2;
        let pct = Math.max(0, 1 - (zIndex / maxZ));
        let scale = Math.pow(pct, 1.8) * 20;
        return {
            x: width / 2 + x * density * 1.25 * scale,
            y: horizon + 30 * scale - y * scale
        };
    }

    for (let iz = segmentsZ; iz > 0; iz--) {
        let z1 = iz - zOffset + 1; 
        let z2 = iz - zOffset; 
        
        let worldZ1 = currentZInt + iz;
        let worldZ2 = currentZInt + iz - 1;
        
        let alpha = Math.max(0, 1 - (iz / segmentsZ));
        ctx.strokeStyle = `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${alpha})`;
        ctx.fillStyle = '#000';
        
        for (let ix = -segmentsX; ix < segmentsX; ix++) {
            let h1 = getMountainHeight(ix, worldZ1);
            let h2 = getMountainHeight(ix + 1, worldZ1);
            let h3 = getMountainHeight(ix + 1, worldZ2);
            let h4 = getMountainHeight(ix, worldZ2);
            
            let p1 = p3d(ix, h1, z1);
            let p2 = p3d(ix + 1, h2, z1);
            let p3 = p3d(ix + 1, h3, z2);
            let p4 = p3d(ix, h4, z2);
            
            if (p1.y > height && p2.y > height && p3.y > height && p4.y > height) continue;
            if (p1.x > width + 200 && p4.x > width + 200) continue;
            if (p2.x < -200 && p3.x < -200) continue;
            if (p1.y < horizon - 300 && p2.y < horizon - 300 && p3.y < horizon - 300 && p4.y < horizon - 300) continue;
            
            ctx.beginPath();
            ctx.moveTo(p1.x, p1.y);
            ctx.lineTo(p2.x, p2.y);
            ctx.lineTo(p3.x, p3.y);
            ctx.lineTo(p4.x, p4.y);
            ctx.closePath();
            
            ctx.fill();
            ctx.stroke();
        }
    }
    
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
function drawRipples(color) {
    const freq = parseFloat(document.getElementById('rippleFreq').value);
    const rippleSpeed = parseFloat(document.getElementById('rippleSpeed').value);
    const maxSize = parseFloat(document.getElementById('rippleMaxSize').value);
    
    ctx.fillStyle = 'rgba(0, 0, 0, 0.1)';
    ctx.fillRect(0, 0, width, height);
    
    const rgb = hexToRgb(color);
    
    if (Math.random() < 0.05 * freq) {
        particles.push({
            x: Math.random() * width,
            y: Math.random() * height,
            radius: 0,
            maxRadius: Math.random() * maxSize + maxSize * 0.3,
            life: 1
        });
    }
    
    for (let i = particles.length - 1; i >= 0; i--) {
        let p = particles[i];
        p.radius += rippleSpeed;
        p.life -= 0.01;
        
        if (p.life <= 0) {
            particles.splice(i, 1);
            continue;
        }
        
        ctx.strokeStyle = `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${p.life})`;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.ellipse(p.x, p.y, p.radius, p.radius * 0.5, 0, 0, Math.PI * 2);
        ctx.stroke();
    }
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
    const rotSpeed = parseFloat(document.getElementById('galaxySpeed').value);
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
    const t = time * rotSpeed;
    const pattern = t * 0.05;                      // the arm pattern turns slowly
    const incl = 0.85 + Math.sin(t * 0.02) * 0.15; // and the viewing tilt gently wobbles
    const cosI = Math.cos(incl), sinI = Math.sin(incl);
    const roll = -0.35, cosR = Math.cos(roll), sinR = Math.sin(roll);
    const N = armCount;

    for (const b of galaxy.bodies) {
        const M = b.phase + t * 0.35 / (0.08 + b.a);  // differential rotation: inner orbits are faster
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
    time += 0.016;
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
function drawLightningBolt(x1, y1, x2, y2, depth, intensity, rgb) {
    let segments = 12;
    let dx = (x2 - x1) / segments;
    let dy = (y2 - y1) / segments;

    ctx.strokeStyle = `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${0.8 * intensity})`;
    ctx.lineWidth = Math.max(1, 3 - depth);
    ctx.shadowBlur = 15 - depth * 3;
    ctx.shadowColor = `rgb(${rgb.r}, ${rgb.g}, ${rgb.b})`;

    ctx.beginPath();
    ctx.moveTo(x1, y1);

    let px = x1, py = y1;
    for (let i = 1; i <= segments; i++) {
        let nx = x1 + dx * i + (Math.random() - 0.5) * (80 - depth * 20);
        let ny = y1 + dy * i;
        ctx.lineTo(nx, ny);

        if (depth < 3 && Math.random() < 0.25) {
            ctx.stroke();
            drawLightningBolt(
                nx, ny,
                nx + (Math.random() - 0.5) * 150,
                ny + Math.random() * 120 + 40,
                depth + 1, intensity * 0.5, rgb
            );
            ctx.beginPath();
            ctx.moveTo(nx, ny);
        }
        px = nx; py = ny;
    }
    ctx.stroke();
    ctx.shadowBlur = 0;
}

function drawLightning(color) {
    const frequency = parseFloat(document.getElementById('lightFreq').value);
    const maxBranches = parseInt(document.getElementById('lightBranches').value);
    const intensity = parseFloat(document.getElementById('lightIntensity').value);
    const rgb = hexToRgb(color);

    ctx.fillStyle = 'rgba(0, 0, 0, 0.12)';
    ctx.fillRect(0, 0, width, height);

    // Ambient cloud glow
    for (let i = 0; i < 4; i++) {
        let cx = (Math.sin(time * 0.3 + i * 1.8) * 0.4 + 0.5) * width;
        let cy = Math.sin(time * 0.2 + i * 2.5) * height * 0.1 + height * 0.12;
        let grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, 180);
        grad.addColorStop(0, `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.025)`);
        grad.addColorStop(1, 'rgba(0, 0, 0, 0)');
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.arc(cx, cy, 180, 0, Math.PI * 2);
        ctx.fill();
    }

    // Lightning strike
    if (Math.random() < 0.02 * frequency) {
        let startX = Math.random() * width;
        drawLightningBolt(
            startX, 0,
            startX + (Math.random() - 0.5) * 200, height * (0.5 + Math.random() * 0.5),
            0, intensity, rgb
        );

        // Flash effect
        ctx.fillStyle = `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${0.04 * intensity})`;
        ctx.fillRect(0, 0, width, height);
    }

    time += 0.01;
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