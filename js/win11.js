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
