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
let isExplicitLaunch = false; // Flag to instantly hide controls on click
let bounceState = { x: 100, y: 100, vx: 3, vy: 3, color: '#00d2ff', text: 'DVD' };

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
    particles = [];
    matrixDrops = [];
    win11Progress = 0;
    win11Eta = Math.floor(Math.random() * 31) + 30; // 30 to 60 minutes
    time = 0;
    bounceState = { 
        x: width / 2, 
        y: height / 2, 
        vx: 3, 
        vy: 3, 
        color: colorPicker.value, 
        text: 'DVD' 
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

function updateURL() {
    const url = new URL(window.location);
    url.search = ''; // Clear existing parameters
    url.searchParams.set('type', typeSelect.value);
    url.searchParams.set('color', colorPicker.value);
    
    const activeGroup = document.getElementById(`settings-${typeSelect.value}`);
    if (activeGroup) {
        activeGroup.querySelectorAll('input').forEach(input => {
            url.searchParams.set(input.id, input.value);
        });
    }
    // Updates the URL seamlessly without reloading or adding to back-button history
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
});
colorPicker.addEventListener('change', () => {
    resetCanvas();
    updateURL();
});
document.querySelectorAll('.setting-group input').forEach(input => {
    // Using 'change' instead of 'input' to avoid browser History API rate-limiting on slider drag
    input.addEventListener('change', updateURL);
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

    ctx.lineWidth = 1;
    for (let i = 0; i < particles.length; i++) {
        for (let j = i + 1; j < particles.length; j++) {
            const dx = particles[i].x - particles[j].x;
            const dy = particles[i].y - particles[j].y;
            const dist = Math.sqrt(dx * dx + dy * dy);

            if (dist < 180) {
                ctx.strokeStyle = `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${1 - dist / 180})`;
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

    ctx.fillStyle = 'rgba(0, 0, 0, 0.04)';
    ctx.fillRect(0, 0, width, height);
    
    const rgb = hexToRgb(color);
    ctx.strokeStyle = `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.8)`;
    ctx.lineWidth = 1.5;
    
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

    ctx.fillStyle = 'rgba(0, 0, 0, 0.06)';
    ctx.fillRect(0, 0, width, height);
    
    const rgb = hexToRgb(color);

    particles.forEach(p => {
        let angle = (Math.sin(p.x * 0.003 + time) + Math.cos(p.y * 0.003 + time)) * Math.PI * 2;
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
        p.z -= warpSpeed; // speed of flight
        if (p.z <= 0) {
            p.x = (Math.random() - 0.5) * width * 2;
            p.y = (Math.random() - 0.5) * height * 2;
            p.z = 1000;
        }

        const x = cx + (p.x / p.z) * 800;
        const y = cy + (p.y / p.z) * 800;
        const size = Math.max(0.1, (1000 - p.z) / 250);

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
        win11Progress += 0.001 * speedMult; // Slower increment modified by setting
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
    const rgb = hexToRgb(color);
    const fontSize = 20;
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

    ctx.fillStyle = 'rgba(0, 0, 0, 0.08)';
    ctx.fillRect(0, 0, width, height);
    
    const rgb = hexToRgb(color);
    
    for (let i = 0; i < waveCount; i++) {
        ctx.beginPath();
        for (let x = 0; x <= width; x += 10) {
            let y = height / 2 + 
                    Math.sin(x * 0.005 + time + i) * (height / 4) + 
                    Math.sin(x * 0.002 - time * 0.8 + i * 1.5) * (height / 5);
            if (x === 0) ctx.moveTo(x, y);
            else ctx.lineTo(x, y);
        }
        ctx.strokeStyle = `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.5)`;
        ctx.lineWidth = 4;
        ctx.stroke();
    }
    time += 0.015 * speedMult;
}

// --- Animation 8: Fireworks ---
function drawFireworks(color) {
    const frequency = parseFloat(document.getElementById('fwFreq').value);
    const gravity = 0.05;

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
                for (let j = 0; j < 60; j++) {
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
    
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, width, height);
    
    let bs = bounceState;
    bs.x += bs.vx * speedMult;
    bs.y += bs.vy * speedMult;
    
    ctx.font = `bold ${size}px sans-serif`;
    const metrics = ctx.measureText(bs.text);
    const textWidth = metrics.width;
    const textHeight = size; // rough approximation
    
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
        if (Math.abs(x) <= pathWidth) return 0; // Flat road in the middle
        let dist = Math.abs(x) - pathWidth;
        let noise = Math.sin(x * 0.4 + z * 0.2) + (0.5 - Math.abs(Math.sin(x * 0.8 + z * 0.4))) * 2.5;
        return Math.max(0, Math.pow(dist, 1.15) * 16 + noise * dist * 8);
    }

    function p3d(x, y, zIndex) {
        let maxZ = segmentsZ + 2;
        let pct = Math.max(0, 1 - (zIndex / maxZ));
        let scale = Math.pow(pct, 1.8) * 20; // Perspective acceleration
        return {
            x: width / 2 + x * density * 1.25 * scale,
            y: horizon + 30 * scale - y * scale
        };
    }

    // Draw Back-to-Front for proper overlap
    for (let iz = segmentsZ; iz > 0; iz--) {
        let z1 = iz - zOffset + 1; 
        let z2 = iz - zOffset; 
        
        let worldZ1 = currentZInt + iz;
        let worldZ2 = currentZInt + iz - 1;
        
        let alpha = Math.max(0, 1 - (iz / segmentsZ));
        ctx.strokeStyle = `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${alpha})`;
        ctx.fillStyle = '#000'; // Block out the sun and stars behind mountains
        
        for (let ix = -segmentsX; ix < segmentsX; ix++) {
            let h1 = getMountainHeight(ix, worldZ1);
            let h2 = getMountainHeight(ix + 1, worldZ1);
            let h3 = getMountainHeight(ix + 1, worldZ2);
            let h4 = getMountainHeight(ix, worldZ2);
            
            let p1 = p3d(ix, h1, z1);
            let p2 = p3d(ix + 1, h2, z1);
            let p3 = p3d(ix + 1, h3, z2);
            let p4 = p3d(ix, h4, z2);
            
            // Cull off-screen quads to preserve performance
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
    
    ctx.fillStyle = 'rgba(0, 0, 0, 0.1)';
    ctx.fillRect(0, 0, width, height);
    
    const rgb = hexToRgb(color);
    const cx = width / 2;
    const cy = height / 2;
    
    ctx.strokeStyle = `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.8)`;
    ctx.lineWidth = 2;
    
    let zOffset = (time * speed * 50) % 100;
    
    for (let i = 0; i < 25; i++) {
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
        for (let j = 0; j < 6; j++) {
            let angle = (j / 6) * Math.PI * 2;
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
    
    ctx.fillStyle = 'rgba(0, 0, 0, 0.1)';
    ctx.fillRect(0, 0, width, height);
    
    const rgb = hexToRgb(color);
    
    if (Math.random() < 0.05 * freq) {
        particles.push({
            x: Math.random() * width,
            y: Math.random() * height,
            radius: 0,
            maxRadius: Math.random() * 100 + 50,
            life: 1
        });
    }
    
    for (let i = particles.length - 1; i >= 0; i--) {
        let p = particles[i];
        p.radius += 2;
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
    }

    animationId = requestAnimationFrame(loop);
}

// --- Launch Event ---
document.getElementById('startBtn').addEventListener('click', () => {
    isExplicitLaunch = true;
    
    // Instantly hide UI
    ui.classList.add('hidden');
    document.body.style.cursor = 'none';
    clearTimeout(idleTimer);

    if (!document.fullscreenElement) {
        document.documentElement.requestFullscreen().catch(err => {
            console.error(`Error attempting to enable fullscreen: ${err.message}`);
        });
    }
    resetCanvas();
    
    // Allow clicks and keypresses to trigger the UI again after a brief delay
    setTimeout(() => isExplicitLaunch = false, 500);
});

document.addEventListener('fullscreenchange', () => {
    if (!isFullscreen()) {
        // Exiting fullscreen restores the UI permanently
        ui.classList.remove('hidden');
        document.body.style.cursor = 'default';
        clearTimeout(idleTimer);
    } else {
        // Normal fullscreen flow unless forced by the button
        if (!isExplicitLaunch) {
            ui.classList.add('hidden');
            document.body.style.cursor = 'none';
            clearTimeout(idleTimer);
        }
    }
});

// Init
loadFromURL();
updateSettingsVisibility();
resize();
animationId = requestAnimationFrame(loop);