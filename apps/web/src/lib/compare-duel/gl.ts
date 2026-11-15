import {
  ART_PIXELS_PER_UNIT,
  BACKGROUND_FS,
  CAPSULE_FS,
  CAPSULE_VS,
  FULLSCREEN_VS,
  INSTANCE_FLOATS,
  PIXELATE_FS,
  RIBBON_FLOATS,
  RIBBON_FS,
  RIBBON_VS,
} from "@/constants/compare/duel-shaders";
import type { DuelEngine } from "@/lib/compare-duel/engine";
import { buildDuelFrame, createDuelFrame } from "@/lib/compare-duel/frame";
import type { DuelFrame, DuelTheme, Rgb } from "@/types/compare-duel";

interface Target {
  texture: WebGLTexture;
  framebuffer: WebGLFramebuffer;
  width: number;
  height: number;
  /** Device pixels per art pixel. */
  pixel: number;
}

interface Program<K extends string> {
  program: WebGLProgram;
  u: Record<K, WebGLUniformLocation | null>;
}

const VIEW_UNIFORMS = ["uView", "uRes"] as const;

type ViewUniform = (typeof VIEW_UNIFORMS)[number];
const STRIDE = INSTANCE_FLOATS * 4;

/** WebGL returns null for a lost context; treat it like any other setup failure. */
function must<T>(value: T | null): T {
  if (value === null) {
    throw new Error("duel: WebGL resource creation failed");
  }
  return value;
}

function compile(gl: WebGL2RenderingContext, type: number, source: string) {
  const shader = must(gl.createShader(type));
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    throw new Error(gl.getShaderInfoLog(shader) ?? "shader failed");
  }
  return shader;
}

function link<K extends string>(
  gl: WebGL2RenderingContext,
  vs: string,
  fs: string,
  names: readonly K[]
): Program<K> {
  const program = must(gl.createProgram());
  gl.attachShader(program, compile(gl, gl.VERTEX_SHADER, vs));
  gl.attachShader(program, compile(gl, gl.FRAGMENT_SHADER, fs));
  gl.linkProgram(program);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    throw new Error(gl.getProgramInfoLog(program) ?? "link failed");
  }
  const u = Object.fromEntries(
    names.map((name) => [name, gl.getUniformLocation(program, name)])
  );
  return { program, u: u as Record<K, WebGLUniformLocation | null> };
}

const rgb = (c: Rgb) => [c[0] / 255, c[1] / 255, c[2] / 255];

/**
 * Draws the duel as pixel art on the GPU: every limb, blade and spark is a hard-edged distance-field capsule
 * rendered into a small buffer, glow is ordered dithering, and the buffer is scaled up with no smoothing.
 */
export class DuelGl {
  private readonly gl: WebGL2RenderingContext;
  private readonly capsule: Program<ViewUniform | "uPx">;
  private readonly ribbon: Program<ViewUniform>;
  private readonly background: Program<
    ViewUniform | "uPixel" | "uTarget" | "uEdge" | "uBladeSeg" | "uBladeCol"
  >;
  private readonly pixelate: Program<
    "uScene" | "uDevicePixel" | "uCanvas" | "uTarget"
  >;
  private readonly capsuleVao: WebGLVertexArrayObject;
  private readonly ribbonVao: WebGLVertexArrayObject;
  private readonly emptyVao: WebGLVertexArrayObject;
  private readonly instances: WebGLBuffer;
  private readonly ribbonBuffer: WebGLBuffer;
  private readonly frame: DuelFrame = createDuelFrame();
  private target: Target | null = null;
  private width = 1;
  private height = 1;
  private dpr = 1;

  static create(canvas: HTMLCanvasElement): DuelGl | null {
    const gl = canvas.getContext("webgl2", {
      alpha: true,
      premultipliedAlpha: false,
      antialias: false,
      depth: false,
      stencil: false,
    });
    if (!gl) {
      return null;
    }
    try {
      return new DuelGl(gl);
    } catch (error) {
      console.warn("duel: WebGL2 setup failed", error);
      return null;
    }
  }

  private constructor(gl: WebGL2RenderingContext) {
    this.gl = gl;
    this.capsule = link(gl, CAPSULE_VS, CAPSULE_FS, [...VIEW_UNIFORMS, "uPx"]);
    this.ribbon = link(gl, RIBBON_VS, RIBBON_FS, VIEW_UNIFORMS);
    this.background = link(gl, FULLSCREEN_VS, BACKGROUND_FS, [
      ...VIEW_UNIFORMS,
      "uPixel",
      "uTarget",
      "uEdge",
      "uBladeSeg",
      "uBladeCol",
    ]);
    this.pixelate = link(gl, FULLSCREEN_VS, PIXELATE_FS, [
      "uScene",
      "uDevicePixel",
      "uCanvas",
      "uTarget",
    ]);
    this.emptyVao = must(gl.createVertexArray());

    this.capsuleVao = must(gl.createVertexArray());
    gl.bindVertexArray(this.capsuleVao);
    const corners = must(gl.createBuffer());
    gl.bindBuffer(gl.ARRAY_BUFFER, corners);
    gl.bufferData(
      gl.ARRAY_BUFFER,
      new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]),
      gl.STATIC_DRAW
    );
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
    this.instances = must(gl.createBuffer());
    gl.bindBuffer(gl.ARRAY_BUFFER, this.instances);
    for (let loc = 1; loc <= 3; loc++) {
      gl.enableVertexAttribArray(loc);
      gl.vertexAttribDivisor(loc, 1);
      gl.vertexAttribPointer(loc, 4, gl.FLOAT, false, STRIDE, (loc - 1) * 16);
    }

    this.ribbonVao = must(gl.createVertexArray());
    gl.bindVertexArray(this.ribbonVao);
    this.ribbonBuffer = must(gl.createBuffer());
    gl.bindBuffer(gl.ARRAY_BUFFER, this.ribbonBuffer);
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, RIBBON_FLOATS * 4, 0);
    gl.enableVertexAttribArray(1);
    gl.vertexAttribPointer(1, 4, gl.FLOAT, false, RIBBON_FLOATS * 4, 8);
    gl.bindVertexArray(null);
  }

  resize(width: number, height: number, dpr: number) {
    this.width = width;
    this.height = height;
    this.dpr = dpr;
    this.gl.canvas.width = Math.max(1, Math.round(width * dpr));
    this.gl.canvas.height = Math.max(1, Math.round(height * dpr));
  }

  render(engine: DuelEngine, theme: DuelTheme) {
    const { gl, frame } = this;
    const target = this.ensureTarget(engine);
    const pixelCss = target.pixel / this.dpr;
    buildDuelFrame(frame, engine, pixelCss, theme);
    const { view } = frame;

    gl.bindFramebuffer(gl.FRAMEBUFFER, target.framebuffer);
    gl.viewport(0, 0, target.width, target.height);
    gl.disable(gl.BLEND);

    const bg = this.background;
    gl.useProgram(bg.program);
    this.setView(bg, target, pixelCss);
    gl.uniform1f(bg.u.uPixel, pixelCss);
    gl.uniform2f(bg.u.uTarget, target.width, target.height);
    gl.uniform3fv(bg.u.uEdge, rgb(theme.edge));
    gl.uniform4fv(bg.u.uBladeSeg, frame.bladeSeg);
    gl.uniform4fv(bg.u.uBladeCol, frame.bladeCol);
    gl.bindVertexArray(this.emptyVao);
    gl.drawArrays(gl.TRIANGLES, 0, 3);

    if (frame.ribbonCount) {
      gl.useProgram(this.ribbon.program);
      this.setView(this.ribbon, target, pixelCss);
      gl.bindVertexArray(this.ribbonVao);
      gl.bindBuffer(gl.ARRAY_BUFFER, this.ribbonBuffer);
      gl.bufferData(
        gl.ARRAY_BUFFER,
        frame.ribbon.subarray(0, frame.ribbonCount * RIBBON_FLOATS),
        gl.DYNAMIC_DRAW
      );
      gl.drawArrays(gl.TRIANGLES, 0, frame.ribbonCount);
    }

    // capsules are opaque and painted in the order the frame lists them
    gl.useProgram(this.capsule.program);
    this.setView(this.capsule, target, pixelCss);
    gl.uniform1f(this.capsule.u.uPx, frame.px);
    gl.bindVertexArray(this.capsuleVao);
    gl.bindBuffer(gl.ARRAY_BUFFER, this.instances);
    gl.bufferData(
      gl.ARRAY_BUFFER,
      frame.data.subarray(0, frame.count * INSTANCE_FLOATS),
      gl.DYNAMIC_DRAW
    );
    gl.drawArraysInstanced(gl.TRIANGLE_STRIP, 0, 4, frame.count);

    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.viewport(0, 0, gl.drawingBufferWidth, gl.drawingBufferHeight);
    const px = this.pixelate;
    gl.useProgram(px.program);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, target.texture);
    gl.uniform1i(px.u.uScene, 0);
    gl.uniform1f(px.u.uDevicePixel, target.pixel);
    gl.uniform2f(px.u.uCanvas, gl.drawingBufferWidth, gl.drawingBufferHeight);
    gl.uniform2f(px.u.uTarget, target.width, target.height);
    gl.bindVertexArray(this.emptyVao);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  }

  dispose() {
    this.gl.getExtension("WEBGL_lose_context")?.loseContext();
  }

  private setView(p: Program<ViewUniform>, target: Target, pixelCss: number) {
    const { gl, frame } = this;
    gl.uniform3f(
      p.u.uView,
      frame.view.floorY,
      frame.view.scale,
      this.width / 2
    );
    gl.uniform2f(p.u.uRes, target.width * pixelCss, target.height * pixelCss);
  }

  /** One art pixel is a whole number of device pixels, sized so a figure is about ART_PIXELS_PER_UNIT tall. */
  private ensureTarget(engine: DuelEngine): Target {
    const gl = this.gl;
    const pixel = Math.max(
      2,
      Math.round((engine.scale * this.dpr) / ART_PIXELS_PER_UNIT)
    );
    const width = Math.ceil(gl.drawingBufferWidth / pixel);
    const height = Math.ceil(gl.drawingBufferHeight / pixel);
    const current = this.target;
    if (
      current &&
      current.pixel === pixel &&
      current.width === width &&
      current.height === height
    ) {
      return current;
    }
    if (current) {
      gl.deleteFramebuffer(current.framebuffer);
      gl.deleteTexture(current.texture);
    }
    const texture = must(gl.createTexture());
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texImage2D(
      gl.TEXTURE_2D,
      0,
      gl.RGBA8,
      width,
      height,
      0,
      gl.RGBA,
      gl.UNSIGNED_BYTE,
      null
    );
    const framebuffer = must(gl.createFramebuffer());
    gl.bindFramebuffer(gl.FRAMEBUFFER, framebuffer);
    gl.framebufferTexture2D(
      gl.FRAMEBUFFER,
      gl.COLOR_ATTACHMENT0,
      gl.TEXTURE_2D,
      texture,
      0
    );
    this.target = { texture, framebuffer, width, height, pixel };
    return this.target;
  }
}
