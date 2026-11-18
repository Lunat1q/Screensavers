// --- Shared: full-screen fragment shaders ---
// One hidden WebGL canvas and one program per mode; each frame is drawn there and copied to the 2D canvas.
const GLSL_LIB = `
precision highp float;
uniform vec2 uRes;
uniform float uTime, uFire;
uniform vec3 uBase;

float hash(vec3 p) { p = fract(p * 0.3183099 + 0.1); p *= 17.0; return fract(p.x * p.y * p.z * (p.x + p.y + p.z)); }
float noise(vec3 x) {
    vec3 i = floor(x), f = fract(x); f = f * f * (3.0 - 2.0 * f);
    return mix(mix(mix(hash(i), hash(i + vec3(1, 0, 0)), f.x), mix(hash(i + vec3(0, 1, 0)), hash(i + vec3(1, 1, 0)), f.x), f.y),
               mix(mix(hash(i + vec3(0, 0, 1)), hash(i + vec3(1, 0, 1)), f.x), mix(hash(i + vec3(0, 1, 1)), hash(i + vec3(1, 1, 1)), f.x), f.y), f.z);
}
float fbm(vec3 p) { float v = 0.0, a = 0.5; for (int i = 0; i < 5; i++) { v += a * noise(p); p = p * 2.03 + 7.1; a *= 0.5; } return v; }

// Glow ramp: black-body fire, or the base color running up to white
vec3 heat(float x) {
    vec3 fire = vec3(3.0 * x, 2.1 * x * x, 1.7 * x * x * x);
    vec3 tint = uBase * min(2.0 * x, 1.5) + (1.0 - uBase) * pow(max(0.0, 2.0 * x - 1.0), 1.5);
    return mix(tint, fire, uFire);
}

vec3 stars(vec3 d, float S, float rad) {
    vec3 p = d * S, id = floor(p);
    vec3 at = id + 0.2 + 0.6 * vec3(hash(id), hash(id + 11.1), hash(id + 23.7));
    float b = pow(hash(id + 5.5), 5.0) * 2.5 + 0.05;
    return smoothstep(rad, 0.0, length(p - at)) * b * mix(vec3(1.0, 0.8, 0.6), vec3(0.7, 0.85, 1.0), hash(id + 3.3));
}
// px: about a pixel and a half, as an angle
vec3 starfield(vec3 d, float px) { return stars(d, 70.0, 70.0 * px) + stars(d, 150.0, 150.0 * px); }
`;
const num = id => parseFloat(document.getElementById(id).value);
let glx = null;

// Runs `frag` for mode `key`, which owns the sliders <key>Speed and <key>Detail (resolution %).
// uniforms(t) returns the mode's own uniforms as numbers or arrays; uRes, uTime and uBase are always set.
function drawShader(key, frag, color, uniforms) {
    if (!glx) { // ponytail: no WebGL context-loss recovery; reload the page if the GPU resets
        const cv = document.createElement('canvas'), gl = cv.getContext('webgl');
        glx = { cv, gl, progs: {} };
        if (gl) {
            gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
            gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW); // one triangle covering the screen
            gl.enableVertexAttribArray(0);
            gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
        }
    }
    const { cv, gl } = glx;
    if (!gl) {
        ctx.fillStyle = '#000';
        ctx.fillRect(0, 0, width, height);
        ctx.fillStyle = '#888';
        ctx.font = '20px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('This screensaver needs WebGL, which this browser has turned off.', width / 2, height / 2);
        ctx.textAlign = 'start';
        return;
    }
    let P = glx.progs[key];
    if (!P) {
        const pr = gl.createProgram();
        [[gl.VERTEX_SHADER, 'attribute vec2 p; void main() { gl_Position = vec4(p, 0.0, 1.0); }'], [gl.FRAGMENT_SHADER, GLSL_LIB + frag]].forEach(([type, src]) => {
            const s = gl.createShader(type);
            gl.shaderSource(s, src);
            gl.compileShader(s);
            if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) console.error(key, gl.getShaderInfoLog(s));
            gl.attachShader(pr, s);
        });
        gl.bindAttribLocation(pr, 0, 'p');
        gl.linkProgram(pr);
        P = glx.progs[key] = { pr, u: {}, t: Math.random() * 1000 };
    }
    gl.useProgram(P.pr);
    const scale = num(key + 'Detail') / 100;
    const w = Math.round(width * scale), h = Math.round(height * scale);
    if (cv.width !== w || cv.height !== h) { cv.width = w; cv.height = h; }
    gl.viewport(0, 0, w, h);
    P.t += frameDt(P) * num(key + 'Speed');

    const c = hexToRgb(color);
    const all = { uRes: [w, h], uTime: P.t, uBase: [c.r / 255, c.g / 255, c.b / 255], ...uniforms(P.t) };
    for (const n in all) {
        const v = [all[n]].flat();
        gl['uniform' + v.length + 'f'](P.u[n] ??= gl.getUniformLocation(P.pr, n), ...v);
    }
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    ctx.imageSmoothingEnabled = true;
    ctx.drawImage(cv, 0, 0, width, height);
}
const fireOn = id => document.getElementById(id).value === 'base' ? 0 : 1; // "Colors" selects: natural palette or Base Color
