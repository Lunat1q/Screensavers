// --- Animation 26: Ocean ---
// Open sea at sunset or under the moon. The surface is a sum of noise-bent swells (shorter waves travel slower, as on real
// water); each ray is marched down onto it, then reflects the sky by Fresnel, which makes the sun's glitter path.
const OCEAN_FRAG = `
uniform float uChop, uSunY, uGlow, uStars;
uniform vec3 uSun, uHor, uMid, uZen, uTint; // the look: sun (or moon), sky from horizon to zenith, water tint
#define SUN normalize(vec3(0.22, uSunY, 1.0))

// foot: size of a pixel on the water. Waves smaller than that are melted to their average height, or they shimmer.
float sea(vec2 p, float oct, float foot) {
    float h = 0.0, a = 0.55, k = 0.5;
    for (int i = 0; i < 7; i++) {
        if (float(i) >= oct) break;
        float keep = 1.0 - smoothstep(0.5, 1.5, k * foot);
        float fi = float(i), ang = 0.9 * sin(fi * 2.4);
        float ph = dot(p, vec2(sin(ang), cos(ang))) * k + uTime * 1.1 * sqrt(k) + 2.2 * noise(vec3(p * k * 0.35 + uTime * vec2(0.05, -0.03), fi * 5.0 + 3.5)); // the crest-bending field drifts sideways; morphing it through the noise's third axis made the march boil
        float w = 0.5 + 0.5 * sin(ph);
        h += a * mix(0.375, w * w, keep); // squared: round crests, long flat troughs
        a *= 0.42; k *= 1.85;
    }
    return h * uChop;
}

vec3 sky(vec3 d, float st) { // st: stars on or off (their reflections would only sparkle)
    float y = max(d.y, 0.0), s = max(dot(d, SUN), 0.0);
    vec3 c = mix(mix(uHor, uMid, smoothstep(0.0, 0.3, y)), uZen, smoothstep(0.1, 0.7, y));
    c += uSun * ((pow(s, 6.0) * 0.3 + pow(s, 80.0) * 0.6) * uGlow + smoothstep(0.9996, 0.9998, s) * 8.0);
    c += starfield(d, 0.7 / uRes.y) * 0.6 * uStars * st * smoothstep(0.0, 0.2, d.y);
    float cl = smoothstep(0.5, 0.8, fbm(vec3(d.xz / (d.y + 0.1) * vec2(0.5, 1.3) + uTime * 0.004, 3.0)));
    return mix(c, mix(uZen * 1.5, uSun * 1.3 * uGlow, pow(s, 3.0)), cl * 0.85 * smoothstep(0.0, 0.15, d.y)); // clouds lit from the sun's side
}

vec3 shade(vec3 ro, vec3 rd, float d, float foot) {
    vec3 p = ro + rd * d;
    float f = d * foot, e = 0.01 + f, h0 = sea(p.xz, 7.0, f);
    vec3 n = normalize(vec3(h0 - sea(p.xz + vec2(e, 0.0), 7.0, f), e, h0 - sea(p.xz + vec2(0.0, e), 7.0, f)));
    vec3 rf = reflect(rd, n); rf.y = abs(rf.y);
    float fr = 0.03 + 0.97 * pow(1.0 - max(dot(n, -rd), 0.0), 5.0);
    vec3 water = vec3(0.005, 0.03, 0.05) * uGlow + uTint * 0.22 * h0 / uChop * (0.3 + pow(max(dot(rd, SUN), 0.0), 3.0)); // light through the crests
    vec3 surf = mix(water, sky(rf, 0.0), fr);
    // haze: grazing rays run out of march steps at a random distance, so the far water flickered against a hard
    // edge. Fading it fully into the horizon colour over a thin band hides that and reads as open sea, not a pool.
    return mix(sky(normalize(vec3(rd.x, 0.0, rd.z)), 0.0), surf, exp(-d * 0.006) * smoothstep(0.0, 0.025, -rd.y));
}

void main() {
    vec2 q = (gl_FragCoord.xy - 0.5 * uRes) / uRes.y;
    float t = uTime, roll = 0.025 * sin(t * 0.27);
    q = q * cos(roll) + vec2(-q.y, q.x) * sin(roll);
    vec3 ro = vec3(0.0, 1.1 * uChop + 1.3 + 0.25 * sin(t * 0.4), t * 0.6);
    vec3 rd = normalize(vec3(q.x, q.y - 0.1 + 0.02 * sin(t * 0.31), 1.4));
    vec3 col = sky(rd, 1.0);
    if (rd.y < 0.0) {
        float d = (ro.y - 1.1 * uChop) / -rd.y; // start where the ray dips below the highest crest
        float foot = 1.0 / (uRes.y * sqrt(0.02 - rd.y)); // pixel size on the water per unit distance, stretched at grazing angles
        // Crest silhouettes: track how many pixels the ray clears the surface by. A dip that rises again is a crest the ray
        // skimmed past; the closest such near-miss is blended in by pixel coverage, or every crest edge is a hard stair-step.
        float pa = 1.0 / (1.4 * uRes.y), run = 1e9, runD = 0.0, miss = 1.0, missD = 0.0;
        for (int i = 0; i < 64; i++) {
            vec3 p = ro + rd * d;
            float dh = p.y - sea(p.xz, 4.0, d * foot);
            if (abs(dh) < 0.001 * d || d > 600.0) break;
            float c = dh / (pa * d);
            if (c < run) { run = c; runD = d; }
            else if (c > run + 1.0) { if (run < miss) { miss = run; missD = runD; } run = c; }
            d += dh / (0.9 * uChop - rd.y); // no further than the steepest wave allows: longer steps tunnel through crests and the whole picture boils
        }
        col = shade(ro, rd, d, foot);
        if (miss < 1.0) col = mix(col, shade(ro, rd, missD, foot), 0.5 - 0.5 * smoothstep(0.0, 1.0, miss));
    }
    gl_FragColor = vec4(1.0 - exp(-col * 1.5), 1.0);
}`;

function drawOcean(color) {
    const c = hexToRgb(color), b = [c.r / 255, c.g / 255, c.b / 255], brg = [b[2], b[0], b[1]];
    const look = {
        fire: { uSun: [1, 0.55, 0.2], uHor: [1, 0.44, 0.12], uMid: [0.8, 0.3, 0.42], uZen: [0.06, 0.1, 0.3], uTint: [0.05, 0.5, 0.45], uSunY: 0.07, uGlow: 1, uStars: 0 },
        night: { uSun: [0.8, 0.88, 1], uHor: [0.07, 0.1, 0.18], uMid: [0.025, 0.04, 0.09], uZen: [0.004, 0.008, 0.025], uTint: [0.1, 0.2, 0.35], uSunY: 0.19, uGlow: 0.3, uStars: 1 },
        base: { uSun: b, uHor: [b[0], b[1] * 0.8, b[2] * 0.6], uMid: b.map((v, i) => v * 0.5 + brg[i] * 0.25), uZen: brg.map(v => v * 0.25), uTint: brg, uSunY: 0.07, uGlow: 1, uStars: 0 }
    }[document.getElementById('oceanColors').value];
    drawShader('ocean', OCEAN_FRAG, color, () => ({ uChop: num('oceanChop'), ...look }));
}
