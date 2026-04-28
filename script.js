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
        activeGroup.querySelectorAll('input').forEach(input => {
            url.searchParams.set(input.id, input.value);
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
            if (input && input.tagName === 'INPUT') input.value = value;
        }
    });
}

typeSelect.addEventListener('change', () => {
    updateSettingsVisibility();
    resetCanvas();
    updateURL();
    updateValueLabels();
});
colorPicker.addEventListener('change', () => {
    resetCanvas();
    updateURL();
});
document.querySelectorAll('.setting-group input').forEach(input => {
    input.addEventListener('change', updateURL);
    input.addEventListener('input', updateValueLabels);
});

// --- Card Grid Selection ---
function setActiveCard(value) {
    document.querySelectorAll('.card[data-value]').forEach(c => {
        c.classList.toggle('active', c.dataset.value === value);
    });
}

document.getElementById('cardGrid').addEventListener('click', (e) => {
    const card = e.target.closest('.card[data-value]');
    if (!card) return;
    typeSelect.value = card.dataset.value;
    setActiveCard(card.dataset.value);
    typeSelect.dispatchEvent(new Event('change'));
});

function resetIdleTimer(e) {
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
function drawTunnel(color) {
    const speed = parseFloat(document.getElementById('tunnelSpeed').value);
    const ringCount = parseInt(document.getElementById('tunnelRings').value);
    const sides = parseInt(document.getElementById('tunnelSides').value);
    
    ctx.fillStyle = 'rgba(0, 0, 0, 0.1)';
    ctx.fillRect(0, 0, width, height);
    
    const rgb = hexToRgb(color);
    const cx = width / 2;
    const cy = height / 2;
    
    ctx.strokeStyle = `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.8)`;
    ctx.lineWidth = 2;
    
    let zOffset = (time * speed * 50) % 100;
    
    for (let i = 0; i < ringCount; i++) {
        let z = i * 100 - zOffset;
        if (z <= 0) continue;
        
        let scale = 800 / z;
        let x = cx + Math.sin(time * speed + i * 0.1) * 50 * scale;
        let y = cy + Math.cos(time * speed * 0.8 + i * 0.1) * 50 * scale;
        
        let size = 200 * scale;
        
        ctx.save();
        ctx.translate(x, y);
        ctx.rotate(time * speed * 0.2 + z * 0.001);
        
        ctx.beginPath();
        for (let j = 0; j < sides; j++) {
            let angle = (j / sides) * Math.PI * 2;
            let px = Math.cos(angle) * size;
            let py = Math.sin(angle) * size;
            if (j === 0) ctx.moveTo(px, py);
            else ctx.lineTo(px, py);
        }
        ctx.closePath();
        ctx.stroke();
        ctx.restore();
    }
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
function drawGalaxy(color) {
    const starCount = parseInt(document.getElementById('galaxyStars').value);
    const rotSpeed = parseFloat(document.getElementById('galaxySpeed').value);
    const armCount = parseInt(document.getElementById('galaxyArms').value);
    const rgb = hexToRgb(color);

    ctx.fillStyle = 'rgba(0, 0, 0, 0.06)';
    ctx.fillRect(0, 0, width, height);

    const cx = width / 2;
    const cy = height / 2;
    const maxR = Math.min(width, height) * 0.4;

    if (particles.length === 0) {
        for (let i = 0; i < starCount; i++) {
            let arm = i % armCount;
            let dist = Math.pow(Math.random(), 0.6) * maxR;
            let spread = (Math.random() - 0.5) * (dist / maxR) * 1.2;
            particles.push({
                dist: dist,
                baseAngle: (arm / armCount) * Math.PI * 2 + dist * 0.004 + spread,
                size: Math.random() * 1.8 + 0.4,
                brightness: Math.random() * 0.7 + 0.3,
                hueOffset: Math.random() * 40 - 20
            });
        }
    }

    particles.forEach(p => {
        let angle = p.baseAngle + time * rotSpeed * 0.3 * (1 - p.dist / maxR * 0.6);
        let x = cx + Math.cos(angle) * p.dist;
        let y = cy + Math.sin(angle) * p.dist * 0.65; // slight elliptical tilt

        let alpha = p.brightness * (1 - p.dist / maxR * 0.4);
        let r = Math.min(255, rgb.r + p.hueOffset);
        let g = Math.min(255, rgb.g + p.hueOffset * 0.5);
        let b = Math.min(255, rgb.b - p.hueOffset * 0.3);
        ctx.fillStyle = `rgba(${Math.max(0,r)}, ${Math.max(0,g)}, ${Math.max(0,b)}, ${alpha})`;
        ctx.beginPath();
        ctx.arc(x, y, p.size, 0, Math.PI * 2);
        ctx.fill();
    });

    // Core glow
    let grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, maxR * 0.12);
    grad.addColorStop(0, `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.25)`);
    grad.addColorStop(1, 'rgba(0, 0, 0, 0)');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(cx, cy, maxR * 0.12, 0, Math.PI * 2);
    ctx.fill();

    time += 0.004;
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
    }

    animationId = requestAnimationFrame(loop);
}

// --- Launch Event ---
document.getElementById('startBtn').addEventListener('click', () => {
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
    
    setTimeout(() => isExplicitLaunch = false, 500);
});

document.addEventListener('fullscreenchange', () => {
    if (!isFullscreen()) {
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
setActiveCard(typeSelect.value);
updateSettingsVisibility();
updateValueLabels();
resize();
animationId = requestAnimationFrame(loop);