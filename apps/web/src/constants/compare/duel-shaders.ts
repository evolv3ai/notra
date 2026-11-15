// GLSL for the WebGL2 renderer. The scene is drawn into a small pixel-art buffer with hard edges and
// ordered dithering instead of soft gradients, then scaled up without smoothing.

/** Saber blades casting a pool of light on the floor. */
export const MAX_BLADE_LIGHTS = 4;

/** Floats per capsule instance: segment (4), shape (4), colour (4). */
export const INSTANCE_FLOATS = 12;
/** Floats per ribbon vertex: position (2), colour (3), density (1). */
export const RIBBON_FLOATS = 6;

/** Art pixels per figure unit at zoom 1, so a stick figure is about this many pixels tall. */
export const ART_PIXELS_PER_UNIT = 38;

const BAYER = /* glsl */ `
const float BAYER[16] = float[16](0.0, 8.0, 2.0, 10.0, 12.0, 4.0, 14.0, 6.0, 3.0, 11.0, 1.0, 9.0, 15.0, 7.0, 13.0, 5.0);

/** Ordered dither threshold for this pixel, in (0, 1). */
float bayer(vec2 frag) {
  ivec2 i = ivec2(mod(floor(frag), 4.0));
  return (BAYER[i.x + i.y * 4] + 0.5) / 16.0;
}

float segDist(vec2 p, vec2 a, vec2 b) {
  vec2 pa = p - a;
  vec2 ba = b - a;
  float h = clamp(dot(pa, ba) / max(dot(ba, ba), 1e-8), 0.0, 1.0);
  return length(pa - ba * h);
}
`;

/**
 * World to target pixels. uView is (floor y, css px per unit, screen centre x) and uRes the css size
 * the render target covers, which can be a little larger than the canvas so the art pixels divide it evenly.
 */
const VIEW = /* glsl */ `
uniform vec3 uView;
uniform vec2 uRes;

vec4 toClip(vec2 p) {
  vec2 px = vec2(uView.z + p.x * uView.y, uView.x - p.y * uView.y);
  return vec4(px.x / uRes.x * 2.0 - 1.0, 1.0 - px.y / uRes.y * 2.0, 0.0, 1.0);
}
`;

export const CAPSULE_VS = /* glsl */ `#version 300 es
layout(location = 0) in vec2 aCorner;
layout(location = 1) in vec4 aSeg;
layout(location = 2) in vec4 aShape;
layout(location = 3) in vec4 aColor;
${VIEW}
uniform float uPx;
out vec2 vP;
flat out vec4 vSeg;
flat out vec4 vShape;
flat out vec4 vColor;

void main() {
  vec2 a = aSeg.xy;
  vec2 b = aSeg.zw;
  vec2 d = b - a;
  float len = length(d);
  vec2 t = len > 1e-5 ? d / len : vec2(1.0, 0.0);
  vec2 n = vec2(-t.y, t.x);
  float ext = aShape.x + uPx * 2.0;
  vec2 p = a + t * (aCorner.x > 0.0 ? len + ext : -ext) + n * aCorner.y * ext;
  vP = p;
  vSeg = aSeg;
  vShape = aShape;
  vColor = aColor;
  gl_Position = toClip(p);
}
`;

/**
 * One shader for every capsule. aShape is (radius, ring width or falloff flag, density, mode):
 * mode 0 is a solid fill, 1 a dithered fill (thinning towards the edge when the flag is set), 2 a solid ring.
 */
export const CAPSULE_FS = /* glsl */ `#version 300 es
precision highp float;
in vec2 vP;
flat in vec4 vSeg;
flat in vec4 vShape;
flat in vec4 vColor;
uniform float uPx;
${BAYER}
out vec4 outColor;

void main() {
  float d = segDist(vP, vSeg.xy, vSeg.zw);
  float r = max(vShape.x, uPx * 0.5);
  if (d > r) discard;
  float mode = vShape.w;
  if (mode > 1.5) {
    if (d < r - max(vShape.y, uPx)) discard;
  } else if (mode > 0.5) {
    float density = vShape.z * (vShape.y > 0.0 ? 1.0 - d / r : 1.0);
    if (density < bayer(gl_FragCoord.xy)) discard;
  }
  outColor = vec4(vColor.rgb, 1.0);
}
`;

/** Filled triangles for swept blade trails, dithered so the smear stays pixel art. */
export const RIBBON_VS = /* glsl */ `#version 300 es
layout(location = 0) in vec2 aPos;
layout(location = 1) in vec4 aColor;
${VIEW}
out vec4 vColor;

void main() {
  vColor = aColor;
  gl_Position = toClip(aPos);
}
`;

export const RIBBON_FS = /* glsl */ `#version 300 es
precision highp float;
in vec4 vColor;
${BAYER}
out vec4 outColor;

void main() {
  if (vColor.a < bayer(gl_FragCoord.xy)) discard;
  outColor = vec4(vColor.rgb, 1.0);
}
`;

export const FULLSCREEN_VS = /* glsl */ `#version 300 es
void main() {
  vec2 p = vec2(float((gl_VertexID << 1) & 2), float(gl_VertexID & 2));
  gl_Position = vec4(p * 2.0 - 1.0, 0.0, 1.0);
}
`;

/** The room, a floor with a top edge and dithered pools of saber light on it. Sky and floor may be transparent. */
export const BACKGROUND_FS = /* glsl */ `#version 300 es
precision highp float;
${VIEW}
/** Css pixels per art pixel. */
uniform float uPixel;
uniform vec2 uTarget;
uniform vec3 uEdge;
uniform vec4 uBladeSeg[${MAX_BLADE_LIGHTS}];
uniform vec4 uBladeCol[${MAX_BLADE_LIGHTS}];
${BAYER}
out vec4 outColor;

void main() {
  vec2 px = vec2(gl_FragCoord.x, uTarget.y - gl_FragCoord.y) * uPixel;
  vec2 p = vec2((px.x - uView.z) / uView.y, (uView.x - px.y) / uView.y);
  if (p.y > 0.0) {
    outColor = vec4(0.0);
    return;
  }
  if (-p.y * uView.y < uPixel) {
    outColor = vec4(uEdge, 1.0);
    return;
  }
  vec4 c = vec4(0.0);
  float depth = -p.y * 3.0;
  for (int i = 0; i < ${MAX_BLADE_LIGHTS}; i++) {
    float d = segDist(vec2(p.x, 0.0), uBladeSeg[i].xy, uBladeSeg[i].zw);
    float density = uBladeCol[i].a * 0.6 / (1.0 + (d * d + depth * depth) * 9.0) - 0.08;
    if (density > bayer(gl_FragCoord.xy)) c = vec4(uBladeCol[i].rgb, 1.0);
  }
  outColor = c;
}
`;

/** Scales the art pixels up to the screen with no smoothing. */
export const PIXELATE_FS = /* glsl */ `#version 300 es
precision highp float;
uniform sampler2D uScene;
/** Device pixels per art pixel. */
uniform float uDevicePixel;
uniform vec2 uCanvas;
uniform vec2 uTarget;
out vec4 outColor;

void main() {
  vec2 fromTop = vec2(gl_FragCoord.x, uCanvas.y - gl_FragCoord.y);
  ivec2 t = ivec2(floor(fromTop / uDevicePixel));
  t.y = int(uTarget.y) - 1 - t.y;
  outColor = texelFetch(uScene, t, 0);
}
`;
