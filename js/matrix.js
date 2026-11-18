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
