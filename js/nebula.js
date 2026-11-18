// --- Animation 25: Nebula ---
// A slow flight through an emission nebula. Hot young stars sit scattered through the gas (one per grid cell,
// some cells empty); each blows a cavity around itself and lights the walls, brightest on the ionization
// fronts that face it. Oxygen glows blue-green close to a star, hydrogen red further out, and gas no star
// reaches stays dark, so dust lanes and globules silhouette against the glow behind them.
const NEBULA_FRAG = `
uniform float uDense;
const float C = 10.0; // star grid cell

// Ridged fBm: sharp creases where the noise crosses 0.5, so the gas forms thin sheets and filaments
float ridged(vec3 p) {
    float v = 0.0, a = 0.55;
    for (int i = 0; i < 5; i++) { float n = 1.0 - abs(2.0 * noise(p) - 1.0); v += a * n * n; p = p * 2.07 + 5.3; a *= 0.48; }
    return v;
}
float gas(vec3 w, float near) { return smoothstep(uDense, uDense + 0.3, ridged(w * 0.35)) * smoothstep(1.0, 3.0, near); }

void main() {
    vec2 q = (gl_FragCoord.xy - 0.5 * uRes) / uRes.y;
    float t = uTime, yaw = 0.5 * sin(t * 0.013), roll = t * 0.008;
    vec3 ro = vec3(1.5 * sin(t * 0.021), cos(t * 0.017), t * 0.3);
    vec3 rd = normalize(vec3(q, 1.0));
    rd.xy = rd.xy * cos(roll) + vec2(-rd.y, rd.x) * sin(roll);
    rd.xz = rd.xz * cos(yaw) + vec2(-rd.z, rd.x) * sin(yaw);

    vec3 oxy = mix(uBase.brg, vec3(0.1, 0.62, 0.95), uFire), hyd = mix(uBase, vec3(0.95, 0.16, 0.28), uFire);
    vec3 col = vec3(0.0);
    float trans = 1.0, d = 0.1 * fract(52.9829189 * fract(dot(gl_FragCoord.xy, vec2(0.06711056, 0.00583715)))); // jitter hides step banding
    for (int i = 0; i < 110; i++) {
        float st = 0.06 + 0.025 * d;
        vec3 p = ro + rd * d;
        // Light from the stars of the 8 nearest cells; each one's reach ends before it drops out of that set
        vec3 k0 = floor(p / C - 0.5), ldir = vec3(0.0);
        float L = 0.0, near = 1e3;
        for (int j = 0; j < 8; j++) {
            float fj = float(j);
            vec3 id = k0 + vec3(mod(fj, 2.0), mod(floor(fj * 0.5), 2.0), floor(fj * 0.25));
            float on = hash(id + 0.5);
            if (on < 0.3) continue;
            vec3 s = (id + 0.5 + 0.5 * (vec3(hash(id + 1.7), hash(id + 4.1), hash(id + 8.3)) - 0.5)) * C, v = s - p;
            float r = length(v), br = (on - 0.3) * 2.5 * smoothstep(7.5, 3.5, r), li = br / (0.3 + 0.06 * r * r);
            L += li; ldir += li * v / r; near = min(near, r);
            // The star itself: the exact integral of a 1/b^2 glow over this step, so it stays a sharp point that gas can hide
            vec3 vo = s - ro;
            float tc = dot(vo, rd), bq = sqrt(max(dot(vo, vo) - tc * tc, 1e-6));
            col += trans * br * 0.015 * (atan((d + st - tc) / bq) - atan((d - tc) / bq)) / bq * mix(vec3(0.7, 0.82, 1.0), vec3(1.0), hash(id + 2.9));
        }
        vec3 wv = vec3(noise(p * 0.15), noise(p * 0.15 + 31.0), noise(p * 0.15 + 67.0)) - 0.5;
        vec3 w = p + wv * 4.0;
        float voids = smoothstep(0.3, 0.6, noise(p * 0.05 + 13.0) + 0.3 * wv.z); // large empty gulfs between the clouds
        col += trans * st * L * L * 0.012 * voids * vec3(0.75, 0.85, 1.0); // starlight scattered by thin gas near a star
        float den = gas(w, near) * voids * smoothstep(0.5, 6.0, d) * exp(-d * 0.03); // thins out next to the camera and far away
        if (den > 0.01) {
            float rim = 0.0; // gas facing a star: an ionization front
            if (L > 0.02) { vec3 ld = normalize(ldir) * 0.3; rim = clamp((den - gas(w + ld, near - 0.3)) * 3.0, 0.0, 1.0); }
            float dust = smoothstep(0.0, 0.15, wv.x);
            vec3 c = mix(hyd, oxy, smoothstep(0.3, 1.6, L));
            vec3 e = den * ((0.06 + L * (0.12 + 1.6 * rim)) * (1.0 - 0.8 * dust) * c + L * rim * rim * 0.4 * vec3(1.0, 0.92, 0.85));
            col += trans * e * st * 1.6;
            trans *= exp(-den * (0.4 + 3.0 * dust) * st);
        }
        // Small stars all through the gas. They sit on planes every SP units of z (we fly roughly along z),
        // so each is found exactly where this step crosses its plane, and the gas in front still hides it.
        const float SP = 1.5, G = 1.0;
        float z0 = ro.z + rd.z * d, z1 = z0 + rd.z * st;
        for (int k = 0; k < 3; k++) {
            float zp = (floor(z0 / SP) + 1.0 + float(k)) * SP;
            if (zp > z1 || rd.z < 0.05) break;
            float tp = (zp - ro.z) / rd.z;
            vec2 xy = ro.xy + rd.xy * tp, id = floor(xy / G);
            vec3 h = vec3(id, zp);
            if (hash(h + 0.71) > 0.12) continue;
            vec2 sp = (id + 0.2 + 0.6 * vec2(hash(h), hash(h + 0.37))) * G;
            float rpx = max(0.7, 0.003 * uRes.y / tp), dpx = length(xy - sp) * rd.z * uRes.y / tp; // radius and distance, in pixels
            float br = (0.6 + 6.0 * pow(hash(h + 0.53), 6.0)) * exp(-tp * 0.02) * smoothstep(0.3, 2.0, tp);
            col += trans * br * exp(-dpx * dpx / (rpx * rpx)) * mix(vec3(1.0, 0.75, 0.5), vec3(0.75, 0.87, 1.0), hash(h + 0.19));
        }
        d += st;
        if (trans < 0.02) break;
    }
    float n = fbm(rd * 3.0 + 9.0); // faint glow of the galaxy behind
    col += trans * trans * (starfield(rd, 1.5 / uRes.y) + vec3(0.3, 0.22, 0.4) * 0.15 * n * n * n);
    gl_FragColor = vec4(1.0 - exp(-col * 1.8), 1.0);
}`;

function drawNebula(color) {
    drawShader('nebula', NEBULA_FRAG, color, () => ({ uDense: 0.74 - 0.035 * num('nebulaGas'), uFire: fireOn('nebulaColors') }));
}
