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
