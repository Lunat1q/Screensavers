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
let isExplicitLaunch = false;
let bounceState = { x: 100, y: 100, vx: 3, vy: 3, color: '#00d2ff', text: 'DVD' };
let plasmaCanvas, plasmaCtx;

function isFullscreen() {
    return !!document.fullscreenElement || (window.innerWidth === screen.width && window.innerHeight === screen.height);
}

function resize() {
    width = canvas.width = window.innerWidth;
    height = canvas.height = window.innerHeight;
    resetCanvas();
    if (burn) return; // burn-in session keeps running through monitor/resolution changes

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
    ctx.shadowBlur = 0;
    particles = [];
    matrixDrops = [];
    win11Progress = 0;
    win11Eta = Math.floor(Math.random() * 31) + 30;
    time = 0;
    burnLastKey = null;
    const textEl = document.getElementById('bounceText');
    bounceState = { 
        x: width / 2, 
        y: height / 2, 
        vx: 3, 
        vy: 3, 
        color: colorPicker.value, 
        text: textEl ? textEl.value || 'DVD' : 'DVD'
    };
}

function updateSettingsVisibility() {
    document.querySelectorAll('.setting-group').forEach(el => el.classList.remove('active'));
    const type = typeSelect.value;
    document.getElementById('modeTitle').textContent = typeSelect.selectedOptions[0].text;
    document.getElementById('colorGroup').hidden = type === 'burnin'; // burn-in uses fixed colors
    const activeGroup = document.getElementById(`settings-${type}`);
    if (activeGroup) {
        activeGroup.classList.add('active');
    }
}

function updateValueLabels() {
    document.querySelectorAll('.val[data-for]').forEach(span => {
        const input = document.getElementById(span.dataset.for);
        if (input) span.textContent = input.value;
    });
}

function updateURL() {
    const url = new URL(window.location);
    url.search = '';
    url.searchParams.set('type', typeSelect.value);
    url.searchParams.set('color', colorPicker.value);
    
    const activeGroup = document.getElementById(`settings-${typeSelect.value}`);
    if (activeGroup) {
        activeGroup.querySelectorAll('input, select').forEach(input => {
            if (input.hasAttribute('data-volatile')) return; // explicit opt-ins aren't shared via URL
            url.searchParams.set(input.id, input.type === 'checkbox' ? input.checked : input.value);
        });
    }
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
            if (!input || input.hasAttribute('data-volatile')) return;
            if (input.type === 'checkbox') input.checked = value === 'true';
            else if (input.tagName === 'INPUT') input.value = value;
            else if (input.tagName === 'SELECT' && Array.from(input.options).some(o => o.value === value)) input.value = value;
        }
    });
}

typeSelect.addEventListener('change', () => {
    if (typeSelect.value !== 'burnin') burnPrevType = typeSelect.value;
    updateSettingsVisibility();
    resetCanvas();
    updateURL();
    updateValueLabels();
});
colorPicker.addEventListener('change', () => {
    resetCanvas();
    updateURL();
});
document.querySelectorAll('.setting-group input, .setting-group select').forEach(input => {
    input.addEventListener('change', updateURL);
    input.addEventListener('input', updateValueLabels);
});

// --- Card Grid Selection ---
function setActiveCard(value) {
    document.querySelectorAll('.card[data-value]').forEach(c => {
        c.classList.toggle('active', c.dataset.value === value);
    });
}

function selectType(value) {
    typeSelect.value = value;
    setActiveCard(value);
    typeSelect.dispatchEvent(new Event('change'));
}

document.getElementById('cardGrid').addEventListener('click', (e) => {
    const card = e.target.closest('.card[data-value]');
    if (card) selectType(card.dataset.value);
});

function resetIdleTimer(e) {
    if (burn) {
        if (burnShouldExit(e)) exitBurnin();
        return;
    }
    if (e && (meshHotkey(e) || meshTap(e))) return;
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
