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
