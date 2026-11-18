// --- Animation 28: Star ---
// A sun up close: boiling granulation and drifting spots on a rotating sphere, darker toward the limb,
// wrapped in a corona whose streamers flow outward.
const STAR_FRAG = `
void main() {
    vec2 q = (gl_FragCoord.xy - 0.5 * uRes) / min(uRes.x, uRes.y);
    float t = uTime, R = 0.29 + 0.02 * sin(t * 0.05), r = length(q), px = 1.5 / min(uRes.x, uRes.y);
    float d = max(r - R, 0.0) / R, ang = atan(q.y, q.x);
    vec3 ring = vec3(cos(ang), sin(ang), 0.0);

    float streams = fbm(ring * 2.5 + vec3(0.0, 0.0, d * 1.3 - t * 0.06));
    float fine = fbm(ring * 9.0 + vec3(0.0, 0.0, d * 4.0 - t * 0.15 + 5.0));
    float flare = smoothstep(0.55, 0.85, fbm(ring * 4.0 + vec3(0.0, 0.0, t * 0.03 + 9.0)));
    float cor = (exp(-d * 3.2) * (0.15 + 2.2 * streams * streams * streams) + exp(-d * 9.0) * flare * 1.2 + exp(-d * 22.0) * 0.6) * (0.55 + 0.9 * fine);
    vec3 col = heat(cor * 0.75) + starfield(normalize(vec3(q, 1.5)), px * 0.6) * 0.7 * exp(-cor * 6.0);

    if (r < R) {
        vec3 n = vec3(q / R, sqrt(1.0 - r * r / (R * R)));
        float mu = n.z, rot = t * 0.02;
        n.xz = n.xz * cos(rot) + vec2(-n.z, n.x) * sin(rot);
        vec3 p = n * 3.0;
        float w = fbm(p + vec3(0.0, t * 0.04, 0.0));
        float g = fbm(p * 2.6 + w * 2.2 + vec3(t * 0.07, 0.0, 0.0)); // granulation, stirred by the larger cells
        float spot = smoothstep(0.6, 0.72, fbm(p * 0.6 + 9.0 - vec3(0.0, 0.0, t * 0.008)));
        float x = (0.34 + 0.5 * smoothstep(0.25, 0.75, g)) * (0.35 + 0.65 * sqrt(mu)) * (1.0 - 0.7 * spot);
        col = mix(col, heat(x), smoothstep(R, R - px, r));
    }
    gl_FragColor = vec4(1.0 - exp(-col * 1.4), 1.0);
}`;

function drawStar(color) {
    drawShader('star', STAR_FRAG, color, () => ({ uFire: fireOn('starColors') }));
}
