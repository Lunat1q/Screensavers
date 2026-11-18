// --- Animation 24: Black Hole ---
// A fragment shader bends every pixel's light ray through Schwarzschild gravity, live. Where a ray
// crosses the accretion disk it picks up glowing gas (Doppler-brightened on the approaching side);
// rays that escape sample a procedural star field, so the sky behind the hole is lensed too.
const HOLE_FRAG = `
uniform float uTilt, uDop;
const float RIN = 2.6, ROUT = 12.0; // disk edges, in horizon radii

// Gas density at (radius, angle) after orbiting for tau: inner rings turn faster (Kepler), shearing it into streaks
float gas(float r, float phi, float tau, float seed) {
    float a = phi - tau * 1.1 * pow(r, -1.5);
    return fbm(vec3(cos(a) * 2.2, sin(a) * 2.2, r * 1.5 + seed));
}

vec3 sky(vec3 d) {
    float a = uTime * 0.004, ca = cos(a), sa = sin(a);
    d.xz = vec2(d.x * ca - d.z * sa, d.x * sa + d.z * ca);
    vec3 c = starfield(d, 1.8 / min(uRes.x, uRes.y * 1.7));
    float n = fbm(d * 2.2 + 4.0);
    return c + vec3(0.25, 0.3, 0.5) * 0.12 * n * n * n;
}

void main() {
    vec2 q = (gl_FragCoord.xy - 0.5 * uRes) / min(uRes.x, uRes.y * 1.7);
    q = vec2(q.x * 0.99 - q.y * 0.14, q.x * 0.14 + q.y * 0.99); // slight camera roll
    float si = sin(uTilt), ci = cos(uTilt);
    vec3 pos = vec3(0.0, 30.0 * si, -30.0 * ci); // camera above the disk plane (y = 0), looking at the hole
    vec3 v = normalize(vec3(0.0, -si, ci) * 0.9 + vec3(q.x, 0.0, 0.0) + vec3(0.0, ci, si) * q.y);
    vec3 hv = cross(pos, v);
    float h2 = dot(hv, hv), trans = 1.0, glow = 0.0;
    vec3 col = vec3(0.0);
    bool escaped = false;

    const float P = 26.0; // two gas layers, each rewound every P seconds while the other covers for it
    float ta = fract(uTime / P), tb = fract(uTime / P + 0.5);

    for (int s = 0; s < 260; s++) {
        float r2 = dot(pos, pos);
        if (r2 < 1.0) break; // fell through the horizon
        if (r2 > 1300.0 && dot(pos, v) > 0.0) { escaped = true; break; }
        // Photon path in Schwarzschild space: acceleration = -1.5 h^2 pos / r^5
        float r = sqrt(r2), dt = 0.01 + 0.045 * r;
        v -= pos * (1.5 * h2 / (r2 * r2 * r)) * dt;
        vec3 np = pos + v * dt;
        if (pos.y * np.y < 0.0) { // crossed the disk plane
            vec3 hp = mix(pos, np, pos.y / (pos.y - np.y));
            float rr = length(hp.xz);
            if (rr > RIN && rr < ROUT) {
                float env = pow(RIN / rr, 1.3) * smoothstep(RIN, RIN + 0.5, rr) * (1.0 - smoothstep(ROUT - 5.0, ROUT, rr));
                float phi = atan(hp.z, hp.x);
                float g = mix(gas(rr, phi, ta * P, 0.0), gas(rr, phi, tb * P, 31.7), abs(2.0 * ta - 1.0));
                g = smoothstep(0.22, 0.72, g) * (0.6 + 0.4 * noise(vec3(rr * 6.0, 1.5, 9.0)));
                // Relativistic beaming from the orbital speed of the gas, plus gravitational dimming
                float beta = sqrt(0.5 / rr), cosv = dot(vec3(-hp.z, 0.0, hp.x) / rr, -normalize(v));
                float dop = sqrt(1.0 - beta * beta) / (1.0 - beta * cosv);
                float boost = mix(1.0, dop * dop * dop * sqrt(1.0 - 1.0 / rr), uDop);
                float a = clamp(env * (0.3 + g) * 2.2, 0.0, 1.0);
                col += trans * a * heat(env * (0.22 + g) * boost * 1.9);
                trans *= 1.0 - a;
                if (trans < 0.02) break;
            }
        }
        if (r > RIN && r < ROUT) glow += dt * exp(-abs(pos.y) * 1.6) * pow(RIN / r, 2.5) * (1.0 - smoothstep(ROUT - 5.0, ROUT, r));
        pos = np;
    }
    if (escaped) col += trans * sky(normalize(v));
    col += heat(0.45) * glow * 0.06; // thin haze hugging the disk
    gl_FragColor = vec4(1.0 - exp(-col * 1.4), 1.0);
}`;

function drawHole(color) {
    drawShader('hole', HOLE_FRAG, color, t => ({
        uTilt: (num('holeTilt') + 2.5 * Math.sin(t * 0.06)) * Math.PI / 180, // the camera bobs slowly
        uDop: num('holeDoppler'),
        uFire: fireOn('holeColors')
    }));
}
