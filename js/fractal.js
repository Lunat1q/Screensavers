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
