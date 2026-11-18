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
