// --- Main Animation Loop ---
function drawSolid(color) {
    ctx.fillStyle = color;
    ctx.fillRect(0, 0, width, height);
}

const DRAW = {
    solid: drawSolid, slow: drawSlow, mesmerizing: drawMesmerizing, flow: drawFlow, cosmic: drawCosmic,
    win11: drawWin11Update, matrix: drawMatrix, neon: drawNeon, fireworks: drawFireworks, bouncing: drawBouncing,
    synthwave: drawSynthwave, tunnel: drawTunnel, ripples: drawRipples, aurora: drawAurora, plasma: drawPlasma,
    galaxy: drawGalaxy, julia: drawJuliaSet, mandelbrot: drawMandelbrot, phoenix: drawPhoenix, lightning: drawLightning,
    pipes: drawPipes, attractor: drawAttractor, silk: drawSilk, blackhole: drawHole, nebula: drawNebula,
    ocean: drawOcean, mandelbulb: drawBulb, star: drawStar, mesh: drawMesh, maze: drawMaze, burnin: drawBurnin,
};

function loop() {
    DRAW[typeSelect.value]?.(colorPicker.value);
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
    if (HOTKEYS[typeSelect.value]) showMeshTip();

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
