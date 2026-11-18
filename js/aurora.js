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
