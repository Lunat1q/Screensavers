// --- Animation 27: Mandelbulb ---
// The 3D cousin of the Mandelbrot set, sphere-traced with a distance estimate while the camera orbits
// and the power slowly breathes, so the surface keeps growing new buds.
const BULB_FRAG = `
uniform float uPower;
float de(vec3 p, out float trap) {
    vec3 z = p;
    float dr = 1.0, r = 0.0;
    trap = 1e9;
    for (int i = 0; i < 7; i++) {
        r = length(z);
        if (r > 2.0) break;
        float th = acos(z.z / r) * uPower + uTime * 0.05, ph = atan(z.y, z.x) * uPower;
        dr = pow(r, uPower - 1.0) * uPower * dr + 1.0;
        z = pow(r, uPower) * vec3(sin(th) * cos(ph), sin(th) * sin(ph), cos(th)) + p;
        trap = min(trap, dot(z, z));
    }
    return 0.5 * log(r) * r / dr;
}

void main() {
    vec2 q = (gl_FragCoord.xy - 0.5 * uRes) / uRes.y;
    float a = uTime * 0.08, el = 0.5 * sin(uTime * 0.05), dist = 3.0 + 0.9 * sin(uTime * 0.031), tr;
    vec3 ro = dist * vec3(cos(a) * cos(el), sin(a) * cos(el), sin(el));
    vec3 f = normalize(-ro), r = normalize(cross(f, vec3(0.0, 0.0, 1.0))), u = cross(r, f);
    vec3 rd = normalize(f * 1.2 + r * q.x + u * q.y);
    vec3 lo = uBase.brg, col = lo * 0.07 * (1.0 - length(q));
    float d = 0.0, steps = 0.0, glow = 0.0;
    bool hit = false;
    for (int i = 0; i < 110; i++) {
        float h = de(ro + rd * d, tr);
        if (h < 0.0008 * d) { hit = true; break; }
        glow += exp(-h * 16.0);
        d += h;
        steps += 1.0;
        if (d > 6.0) break;
    }
    if (hit) {
        vec3 p = ro + rd * d;
        vec2 e = vec2(1.0, -1.0) * 0.0006 * d;
        float x;
        vec3 n = normalize(e.xyy * de(p + e.xyy, x) + e.yyx * de(p + e.yyx, x) + e.yxy * de(p + e.yxy, x) + e.xxx * de(p + e.xxx, x));
        float m = smoothstep(0.35, 1.05, sqrt(tr)), ao = pow(1.0 - steps / 110.0, 2.5);
        vec3 alb = m < 0.5 ? mix(lo, uBase, m * 2.0) : mix(uBase, vec3(1.0), (m - 0.5) * 1.0);
        vec3 L = normalize(r * 0.6 + u * 0.7 - f * 0.5), hv = normalize(L - rd);
        col = alb * (0.12 + max(dot(n, L), 0.0)) * ao
            + (pow(max(dot(n, hv), 0.0), 40.0) * 0.5 + pow(1.0 - max(dot(n, -rd), 0.0), 3.0) * 0.35 * lo) * ao;
    }
    col += mix(lo, uBase, 0.5) * glow * 0.006;
    gl_FragColor = vec4(1.0 - exp(-col * 1.8), 1.0);
}`;

function drawBulb(color) {
    drawShader('bulb', BULB_FRAG, color, t => ({ uPower: num('bulbPower') + 0.8 * Math.sin(t * 0.045) }));
}
