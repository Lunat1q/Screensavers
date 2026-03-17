const canvas = document.getElementById('canvas');
const ctx = canvas.getContext('2d');
const ui = document.getElementById('ui');
const typeSelect = document.getElementById('typeSelect');
const colorPicker = document.getElementById('colorPicker');

let width, height;
let animationId;
let particles = [];
let time = 0;
let idleTimer;
let isExplicitLaunch = false; // Flag to instantly hide controls on click

function resize() {
    width = canvas.width = window.innerWidth;
    height = canvas.height = window.innerHeight;
    resetCanvas();
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
    time = 0;
}
typeSelect.addEventListener('change', resetCanvas);
colorPicker.addEventListener('change', resetCanvas);

function resetIdleTimer() {
    if (isExplicitLaunch) return;

    document.body.style.cursor = 'default';
    ui.classList.remove('hidden');
    clearTimeout(idleTimer);
    
    if (document.fullscreenElement) {
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
    if (particles.length === 0) {
        const count = Math.min((width * height) / 15000, 80);
        for (let i = 0; i < count; i++) {
            particles.push({
                x: Math.random() * width, 
                y: Math.random() * height,
                vx: (Math.random() - 0.5) * 1.5, 
                vy: (Math.random() - 0.5) * 1.5,
                r: Math.random() * 3 + 1.5
            });
        }
    }

    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, width, height);

    const rgb = hexToRgb(color);

    particles.forEach(p => {
        p.x += p.vx;
        p.y += p.vy;

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
    ctx.fillStyle = 'rgba(0, 0, 0, 0.04)';
    ctx.fillRect(0, 0, width, height);
    
    const rgb = hexToRgb(color);
    ctx.strokeStyle = `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.8)`;
    ctx.lineWidth = 1.5;
    
    ctx.save();
    ctx.translate(width / 2, height / 2);
    
    ctx.beginPath();
    for (let i = 0; i <= Math.PI * 2; i += 0.01) {
        let r = 350 * Math.sin(time * 2.1) + 150 * Math.cos(i * 5 + time * 1.5) + 80 * Math.sin(i * 13 - time);
        let x = Math.cos(i) * r;
        let y = Math.sin(i) * r;

        let rotX = x * Math.cos(time * 0.3) - y * Math.sin(time * 0.3);
        let rotY = x * Math.sin(time * 0.3) + y * Math.cos(time * 0.3);

        if (i === 0) ctx.moveTo(rotX, rotY);
        else ctx.lineTo(rotX, rotY);
    }
    ctx.stroke();
    ctx.restore();
    time += 0.004;
}

// --- Animation 3: Vector Flow Field ---
function drawFlow(color) {
    if (particles.length === 0) {
        for (let i = 0; i < 900; i++) {
            particles.push({
                x: Math.random() * width,
                y: Math.random() * height,
                vx: 0, vy: 0,
                size: Math.random() * 2 + 0.5
            });
        }
    }

    ctx.fillStyle = 'rgba(0, 0, 0, 0.06)';
    ctx.fillRect(0, 0, width, height);
    
    const rgb = hexToRgb(color);

    particles.forEach(p => {
        let angle = (Math.sin(p.x * 0.003 + time) + Math.cos(p.y * 0.003 + time)) * Math.PI * 2;
        p.vx += Math.cos(angle) * 0.15;
        p.vy += Math.sin(angle) * 0.15;

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
    time += 0.005;
}

// --- Animation 4: Cosmic Warp ---
function drawCosmic(color) {
    if (particles.length === 0) {
        for(let i = 0; i < 400; i++) {
            particles.push({
                x: (Math.random() - 0.5) * width * 2,
                y: (Math.random() - 0.5) * height * 2,
                z: Math.random() * 1000
            });
        }
    }

    ctx.fillStyle = 'rgba(0, 0, 0, 0.25)';
    ctx.fillRect(0, 0, width, height);

    const rgb = hexToRgb(color);
    const cx = width / 2;
    const cy = height / 2;

    particles.forEach(p => {
        p.z -= 8; // speed of flight
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
    
    // Allow mouse movements to trigger the UI again after a brief delay
    setTimeout(() => isExplicitLaunch = false, 500);
});

document.addEventListener('fullscreenchange', () => {
    if (!document.fullscreenElement) {
        // Exiting fullscreen restores the UI permanently
        ui.classList.remove('hidden');
        document.body.style.cursor = 'default';
        clearTimeout(idleTimer);
    } else {
        // Normal fullscreen flow unless forced by the button
        if (!isExplicitLaunch) resetIdleTimer();
    }
});

// Init
resize();
animationId = requestAnimationFrame(loop);