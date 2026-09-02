/**
 * THE CORE — the renderer.
 *
 * Eight programs against one canvas. In draw order: the axis and the untyped
 * wikilink mesh (`plain`), the 134,348-message sheath (`sheath`), the typed
 * argument graph (`edges`), the pages themselves (`nodes`), and then a
 * bright-pass, a separable blur and a composite that puts the glow back over
 * the top. A ninth path renders node ids to an offscreen target so the cursor
 * can ask the GPU what it is pointing at.
 *
 * ---- why the GPU is here ----------------------------------------------------
 *
 * Honestly: for the sheath and the compositing, and not much else. 134,000
 * additively-blended points that have to re-project every frame under a moving
 * camera is not a canvas-2D job, and neither is a two-pass bloom. The 519 nodes
 * and 2,398 edges would run fine on 2D and the room does not pretend otherwise
 * — `Fallback2D` draws exactly those when WebGL2 is missing, and loses only the
 * sheath and the glow.
 *
 * ---- how the room changes what is on screen ---------------------------------
 *
 * Never by rebuilding geometry. Every edge and every node carries its own index
 * as a vertex attribute and reads a one-byte lookup texture at that index to
 * find its state: hidden, dimmed, lit, or selected. Toggling a filter is a
 * `texSubImage2D` of two kilobytes; retessellating 67,000 vertices would be a
 * visible hitch on every click. The LUTs are the entire interaction surface
 * between React and the GPU.
 */

import { attrib, buffer, lut, program, quad, target } from './gl'
import type { Program, Target } from './gl'
import { holeRings } from './data'
import type { Layout, Sheath, Structure } from './data'
import type { Camera } from './camera'

/** What a node or edge is doing this frame. Written into the LUTs. */
export const STATE = { hidden: 0, dim: 1, on: 2, lit: 3 } as const

const FAMILIES = ['causal', 'structural', 'evidential', 'affinity', 'tension', 'other']

/* ==========================================================================
   SHADERS
   ========================================================================== */

const HEAD = `#version 300 es
precision highp float;
`

/**
 * Shared: fade anything outside the scrubbed window rather than cutting it.
 *
 * The window is in **measure units**, 0 → 1, read off a per-vertex attribute —
 * not off world height, which is what it used to be. Height was the measure
 * only while the measure was always the date and the shape was always the
 * column; on the sphere the measure is latitude and on the disc it is radius,
 * and a window read off `y` there fades a band of the wrong pages.
 */
const WINDOW = `
in float a_m;            // where this vertex sits on the axis, 0 -> 1
uniform vec2 u_window;   // lo, hi on the same axis
uniform float u_windowed;
float windowFade() {
  if (u_windowed < 0.5) return 1.0;
  float edge = 0.014;
  float lo = smoothstep(u_window.x - edge, u_window.x + edge, a_m);
  float hi = 1.0 - smoothstep(u_window.y - edge, u_window.y + edge, a_m);
  return mix(0.09, 1.0, min(lo, hi));
}
`

const PLAIN_VS = `${HEAD}
in vec3 a_pos;
uniform mat4 u_vp;
${WINDOW}
out float v_fade;
void main() {
  v_fade = windowFade();
  gl_Position = u_vp * vec4(a_pos, 1.0);
}`

const PLAIN_FS = `${HEAD}
in float v_fade;
uniform vec4 u_colour;
out vec4 frag;
void main() { frag = vec4(u_colour.rgb, u_colour.a * v_fade); }`

const SHEATH_VS = `${HEAD}
in vec3 a_pos;
in float a_dir;
uniform mat4 u_vp;
uniform float u_size;
uniform vec3 u_sent;
uniform vec3 u_recv;
${WINDOW}
out vec3 v_colour;
out float v_fade;
void main() {
  v_colour = a_dir > 0.5 ? u_sent : u_recv;
  v_fade = windowFade();
  vec4 clip = u_vp * vec4(a_pos, 1.0);
  gl_Position = clip;
  gl_PointSize = max(1.0, u_size * (300.0 / max(1.0, clip.w)));
}`

const SHEATH_FS = `${HEAD}
in vec3 v_colour;
in float v_fade;
uniform float u_alpha;
out vec4 frag;
void main() {
  vec2 d = gl_PointCoord - 0.5;
  float r = dot(d, d);
  if (r > 0.25) discard;
  float soft = 1.0 - smoothstep(0.04, 0.25, r);
  frag = vec4(v_colour * soft, u_alpha * soft * v_fade);
}`

const EDGE_VS = `${HEAD}
in vec3 a_pos;
in float a_id;
in float a_t;
in float a_family;
uniform mat4 u_vp;
uniform sampler2D u_lut;
uniform vec3 u_family[6];
uniform float u_flow;
${WINDOW}
out vec3 v_colour;
out float v_alpha;
void main() {
  int state = int(texelFetch(u_lut, ivec2(int(a_id), 0), 0).r * 255.0 + 0.5);
  vec3 tint = u_family[int(a_family)];

  // Direction is drawn rather than arrowed: brightness runs from the page that
  // makes the claim to the page it is made about, and crawls along the curve.
  float ramp = 0.30 + 0.70 * a_t;
  float crawl = 0.72 + 0.28 * sin((a_t * 7.0 - u_flow) * 3.14159);

  if (state == 0) { v_alpha = 0.0; v_colour = tint; }
  else if (state == 1) { v_alpha = 0.055 * ramp; v_colour = tint; }
  else if (state == 2) { v_alpha = 0.30 * ramp * crawl; v_colour = tint; }
  else { v_alpha = 0.98 * ramp; v_colour = mix(tint, vec3(1.0), 0.55); }

  v_alpha *= windowFade();
  gl_Position = u_vp * vec4(a_pos, 1.0);
}`

const EDGE_FS = `${HEAD}
in vec3 v_colour;
in float v_alpha;
out vec4 frag;
void main() {
  if (v_alpha <= 0.001) discard;
  frag = vec4(v_colour * v_alpha, v_alpha);
}`

const NODE_VS = `${HEAD}
in vec3 a_pos;
in float a_id;
in float a_size;
in float a_domain;
uniform mat4 u_vp;
uniform sampler2D u_lut;
uniform vec3 u_domain[10];
${WINDOW}
out vec3 v_colour;
out float v_alpha;
out float v_ring;
void main() {
  int state = int(texelFetch(u_lut, ivec2(int(a_id), 0), 0).r * 255.0 + 0.5);
  vec3 tint = u_domain[int(a_domain)];
  float scale = 1.0;
  v_ring = 0.0;
  if (state == 0) { v_alpha = 0.0; }
  else if (state == 1) { v_alpha = 0.16; }
  else if (state == 2) { v_alpha = 0.92; }
  else { v_alpha = 1.0; scale = 1.9; v_ring = 1.0; tint = mix(tint, vec3(1.0), 0.45); }
  v_colour = tint;
  v_alpha *= windowFade();
  vec4 clip = u_vp * vec4(a_pos, 1.0);
  gl_Position = clip;
  gl_PointSize = max(2.0, a_size * scale * (620.0 / max(1.0, clip.w)));
}`

const NODE_FS = `${HEAD}
in vec3 v_colour;
in float v_alpha;
in float v_ring;
out vec4 frag;
void main() {
  vec2 d = gl_PointCoord - 0.5;
  float r = length(d);
  if (r > 0.5) discard;
  float core = 1.0 - smoothstep(0.12, 0.46, r);
  float halo = (1.0 - smoothstep(0.30, 0.5, r)) * 0.5;
  float ring = v_ring * smoothstep(0.34, 0.40, r) * (1.0 - smoothstep(0.44, 0.50, r));
  float a = clamp(core + halo + ring, 0.0, 1.0) * v_alpha;
  vec3 c = mix(v_colour, vec3(1.0), core * 0.6 + ring);
  frag = vec4(c * a, a);
}`

const PICK_VS = `${HEAD}
in vec3 a_pos;
in float a_id;
in float a_size;
uniform mat4 u_vp;
uniform sampler2D u_lut;
out vec3 v_id;
void main() {
  int state = int(texelFetch(u_lut, ivec2(int(a_id), 0), 0).r * 255.0 + 0.5);
  int id = state == 0 ? 0 : int(a_id) + 1;
  v_id = vec3(float(id & 255), float((id >> 8) & 255), float((id >> 16) & 255)) / 255.0;
  vec4 clip = u_vp * vec4(a_pos, 1.0);
  gl_Position = clip;
  // A generous target: a two-pixel dot is not something anyone can hit.
  gl_PointSize = max(9.0, a_size * 1.5 * (620.0 / max(1.0, clip.w)));
}`

const PICK_FS = `${HEAD}
in vec3 v_id;
out vec4 frag;
void main() {
  vec2 d = gl_PointCoord - 0.5;
  if (length(d) > 0.5) discard;
  frag = vec4(v_id, 1.0);
}`

const FULL_VS = `${HEAD}
in vec2 a_pos;
out vec2 v_uv;
void main() {
  v_uv = a_pos * 0.5 + 0.5;
  gl_Position = vec4(a_pos, 0.0, 1.0);
}`

const BRIGHT_FS = `${HEAD}
in vec2 v_uv;
uniform sampler2D u_src;
uniform float u_cut;
out vec4 frag;
void main() {
  vec3 c = texture(u_src, v_uv).rgb;
  float l = max(c.r, max(c.g, c.b));
  frag = vec4(c * smoothstep(u_cut, u_cut + 0.35, l), 1.0);
}`

const BLUR_FS = `${HEAD}
in vec2 v_uv;
uniform sampler2D u_src;
uniform vec2 u_step;
out vec4 frag;
void main() {
  vec3 sum = texture(u_src, v_uv).rgb * 0.227;
  sum += (texture(u_src, v_uv + u_step * 1.3846).rgb
        + texture(u_src, v_uv - u_step * 1.3846).rgb) * 0.316;
  sum += (texture(u_src, v_uv + u_step * 3.2308).rgb
        + texture(u_src, v_uv - u_step * 3.2308).rgb) * 0.070;
  frag = vec4(sum, 1.0);
}`

const COMPOSITE_FS = `${HEAD}
in vec2 v_uv;
uniform sampler2D u_scene;
uniform sampler2D u_bloom;
uniform float u_strength;
uniform vec3 u_void;
out vec4 frag;
void main() {
  vec3 scene = texture(u_scene, v_uv).rgb;
  vec3 bloom = texture(u_bloom, v_uv).rgb;
  vec3 c = scene + bloom * u_strength;
  // A faint vignette, so the column reads as an object in a room rather than a
  // texture pasted over the viewport.
  vec2 d = v_uv - 0.5;
  c *= 1.0 - dot(d, d) * 0.55;
  frag = vec4(u_void + c, 1.0);
}`

/* ==========================================================================
   THE SCENE
   ========================================================================== */

export type Palette = {
  void: [number, number, number]
  domains: [number, number, number][]
  families: [number, number, number][]
  sent: [number, number, number]
  recv: [number, number, number]
  axis: [number, number, number]
  link: [number, number, number]
}

export type Visible = {
  sheath: boolean
  typed: boolean
  untyped: boolean
  axis: boolean
  bloom: number
  sheathAlpha: number
  /** 0→1 of the message record to draw. Below 1 the room says so. */
  sheathFraction: number
  /** The scrub window, in measure units 0 → 1 — not in world coordinates. */
  window: [number, number] | null
}

export class Scene {
  private gl: WebGL2RenderingContext
  private progs: Record<string, Program>
  private bufs: Record<string, WebGLBuffer>
  private nodeLut: ReturnType<typeof lut>
  private edgeLut: ReturnType<typeof lut>
  private sceneT: Target
  private brightT: Target
  private blurT: Target
  private pickT: Target
  private counts: { sheath: number; edge: number; link: number; axis: number; node: number }
  private holes: { pos: Float32Array; m: Float32Array }
  private flow = 0

  constructor(
    gl: WebGL2RenderingContext,
    structure: Structure,
    layout: Layout,
    sheath: Sheath,
  ) {
    this.gl = gl
    const N = structure.nodes.length

    this.progs = {
      plain: program(
        gl, PLAIN_VS, PLAIN_FS,
        ['u_vp', 'u_colour', 'u_window', 'u_windowed'],
        ['a_pos', 'a_m'],
      ),
      sheath: program(
        gl, SHEATH_VS, SHEATH_FS,
        ['u_vp', 'u_size', 'u_sent', 'u_recv', 'u_alpha', 'u_window', 'u_windowed'],
        ['a_pos', 'a_dir', 'a_m'],
      ),
      edges: program(
        gl, EDGE_VS, EDGE_FS,
        ['u_vp', 'u_lut', 'u_flow', 'u_window', 'u_windowed',
         ...Array.from({ length: 6 }, (_, i) => `u_family[${i}]`)],
        ['a_pos', 'a_id', 'a_t', 'a_family', 'a_m'],
      ),
      nodes: program(
        gl, NODE_VS, NODE_FS,
        ['u_vp', 'u_lut', 'u_window', 'u_windowed',
         ...Array.from({ length: 10 }, (_, i) => `u_domain[${i}]`)],
        ['a_pos', 'a_id', 'a_size', 'a_domain', 'a_m'],
      ),
      pick: program(gl, PICK_VS, PICK_FS, ['u_vp', 'u_lut'], ['a_pos', 'a_id', 'a_size']),
      bright: program(gl, FULL_VS, BRIGHT_FS, ['u_src', 'u_cut'], ['a_pos']),
      blur: program(gl, FULL_VS, BLUR_FS, ['u_src', 'u_step'], ['a_pos']),
      composite: program(gl, FULL_VS, COMPOSITE_FS, ['u_scene', 'u_bloom', 'u_strength', 'u_void'], ['a_pos']),
    }

    /* ---- the sheath, which never changes shape --------------------------- */

    /**
     * The sheath goes into the buffer shuffled, and the shuffle is the whole
     * reason a slow machine can still read this room honestly.
     *
     * 134,348 additively blended points is a lot to ask of software GL or an
     * integrated part, so the renderer can draw only the first N of them. In
     * message order that would show 2015 and stop — a different corpus, drawn
     * without saying so. Shuffled deterministically first, the first N are an
     * unbiased sample of the whole eleven years, every gap still falls where it
     * falls, and the instrument can say "one in four" and mean it.
     *
     * It is built once and never rebuilt: the sheath is the message record
     * placed by date, so it belongs to one axis and one shape. Everywhere else
     * the room switches it off and says why, rather than floating 134,348 marks
     * against an axis they are not on.
     */
    const order = new Uint32Array(sheath.count)
    for (let i = 0; i < sheath.count; i++) order[i] = i
    let seed = 0x9e3779b9
    for (let i = sheath.count - 1; i > 0; i--) {
      seed = (Math.imul(seed ^ (seed >>> 15), 0x85ebca6b) + 0x165667b1) >>> 0
      const j = seed % (i + 1)
      const t = order[i]
      order[i] = order[j]
      order[j] = t
    }
    const sheathData = new Float32Array(sheath.count * 5)
    for (let k = 0; k < sheath.count; k++) {
      const i = order[k]
      sheathData[k * 5] = sheath.pos[i * 3]
      sheathData[k * 5 + 1] = sheath.pos[i * 3 + 1]
      sheathData[k * 5 + 2] = sheath.pos[i * 3 + 2]
      sheathData[k * 5 + 3] = sheath.dir[i]
      sheathData[k * 5 + 4] = sheath.t[i]
    }

    this.holes = holeRings(sheath)
    this.bufs = {
      sheath: buffer(gl, sheathData),
      quad: quad(gl),
      // Replaced wholesale by `setLayout`; allocated here so the field is never
      // half-populated and the draw path never has to test for it.
      node: buffer(gl, new Float32Array(0)),
      edge: buffer(gl, new Float32Array(0)),
      link: buffer(gl, new Float32Array(0)),
      axis: buffer(gl, new Float32Array(0)),
    }
    this.counts = { node: 0, edge: 0, link: 0, axis: 0, sheath: sheath.count }
    this.setLayout(structure, layout, false)

    this.nodeLut = lut(gl, Math.max(512, N))
    this.edgeLut = lut(gl, Math.max(4096, structure.typed.length))
    this.nodeLut.data.fill(STATE.on)
    this.edgeLut.data.fill(STATE.dim)
    this.nodeLut.upload()
    this.edgeLut.upload()

    this.sceneT = target(gl, 2, 2)
    this.brightT = target(gl, 2, 2)
    this.blurT = target(gl, 2, 2)
    this.pickT = target(gl, 2, 2)
  }

  /**
   * Swap in a new arrangement — a different measure, a different shape, or both.
   *
   * Filtering and highlighting never touch geometry: that is what the lookup
   * textures are for, and a filter is a two-kilobyte `texSubImage2D`. Changing
   * the *measure* or the *shape* is the one thing that genuinely moves every
   * vertex, so it genuinely rebuilds the buffers — four of them, about 1.6 MB,
   * once per change. The programs, the lookup textures and the sheath survive
   * it, which is the difference between this and throwing the scene away: no
   * shader is recompiled and 134,348 marks are not re-uploaded to draw a word
   * count.
   *
   * `withHoles` appends the rings the message export does not cover. They are a
   * fact about the message record and belong to the date axis, so the room
   * passes false everywhere else rather than ruling a word count with them.
   */
  setLayout(structure: Structure, layout: Layout, withHoles: boolean) {
    const gl = this.gl
    const N = structure.nodes.length
    const familyOf = new Map(FAMILIES.map((f, i) => [f, i]))
    const domainAt = new Map(structure.domains.map((d, i) => [d.id, i]))

    /* ---- node geometry: pos, id, size, domain, axis position ------------- */
    const nodeData = new Float32Array(N * 7)
    for (let i = 0; i < N; i++) {
      const n = structure.nodes[i]
      nodeData[i * 7] = layout.pos[i * 3]
      nodeData[i * 7 + 1] = layout.pos[i * 3 + 1]
      nodeData[i * 7 + 2] = layout.pos[i * 3 + 2]
      nodeData[i * 7 + 3] = i
      // Area by word count, so a 113,514-word page is not four hundred times
      // the dot of a 250-word one. This is the one channel that stays put when
      // the axis changes: a dot's size is always the length of its page.
      nodeData[i * 7 + 4] = 1.5 + Math.sqrt(n.w) / 24
      nodeData[i * 7 + 5] = domainAt.get(n.d) ?? 0
      nodeData[i * 7 + 6] = layout.m[i]
    }

    /* ---- edge geometry: pos, id, t, family, axis position ---------------- */
    const EV = layout.edgeVerts
    const edgeData = new Float32Array(EV * 7)
    for (let v = 0; v < EV; v++) {
      const e = layout.edgeId[v]
      edgeData[v * 7] = layout.edgePos[v * 3]
      edgeData[v * 7 + 1] = layout.edgePos[v * 3 + 1]
      edgeData[v * 7 + 2] = layout.edgePos[v * 3 + 2]
      edgeData[v * 7 + 3] = e
      edgeData[v * 7 + 4] = layout.edgeT[v]
      edgeData[v * 7 + 5] = familyOf.get(structure.types[structure.typed[e][2]].family) ?? 5
      edgeData[v * 7 + 6] = layout.edgeM[v]
    }

    /* ---- the untyped mesh ------------------------------------------------ */
    const LV = layout.linkVerts
    const linkData = new Float32Array(LV * 4)
    for (let v = 0; v < LV; v++) {
      linkData[v * 4] = layout.linkPos[v * 3]
      linkData[v * 4 + 1] = layout.linkPos[v * 3 + 1]
      linkData[v * 4 + 2] = layout.linkPos[v * 3 + 2]
      linkData[v * 4 + 3] = layout.linkM[v]
    }

    /* ---- the ruling, plus the holes where they mean something ------------ */
    const holeVerts = withHoles ? this.holes.m.length : 0
    const AV = layout.axisVerts + holeVerts
    const axisData = new Float32Array(AV * 4)
    for (let v = 0; v < layout.axisVerts; v++) {
      axisData[v * 4] = layout.axisPos[v * 3]
      axisData[v * 4 + 1] = layout.axisPos[v * 3 + 1]
      axisData[v * 4 + 2] = layout.axisPos[v * 3 + 2]
      axisData[v * 4 + 3] = layout.axisM[v]
    }
    for (let k = 0; k < holeVerts; k++) {
      const v = layout.axisVerts + k
      axisData[v * 4] = this.holes.pos[k * 3]
      axisData[v * 4 + 1] = this.holes.pos[k * 3 + 1]
      axisData[v * 4 + 2] = this.holes.pos[k * 3 + 2]
      axisData[v * 4 + 3] = this.holes.m[k]
    }

    for (const key of ['node', 'edge', 'link', 'axis'] as const)
      if (this.bufs[key]) gl.deleteBuffer(this.bufs[key])
    this.bufs.node = buffer(gl, nodeData)
    this.bufs.edge = buffer(gl, edgeData)
    this.bufs.link = buffer(gl, linkData)
    this.bufs.axis = buffer(gl, axisData)
    this.counts.node = N
    this.counts.edge = EV
    this.counts.link = LV
    this.counts.axis = AV
  }

  get nodeStates() {
    return this.nodeLut.data
  }
  get edgeStates() {
    return this.edgeLut.data
  }
  pushStates() {
    this.nodeLut.upload()
    this.edgeLut.upload()
  }

  /**
   * What is under the pointer — or, with a radius, nearest to it.
   *
   * The nodes are drawn again into a small offscreen target with their index as
   * their colour, and the pixels around the pointer are read back. It costs a
   * draw call and a stall, so the room only asks when the pointer has actually
   * moved, or when a tap has landed.
   *
   * `radius` is in device pixels and exists for fingers. The obvious fix — a
   * bigger `gl_PointSize` in the pick shader — is the wrong one: this pass runs
   * with no depth test, so fattening every point makes overlaps resolve by draw
   * order, which is to say arbitrarily. Reading a block and taking the hit
   * *nearest the centre* means a finger selects the node closest to it, every
   * time, and a mouse still selects exactly what it is on top of.
   */
  pick(camera: Camera, x: number, y: number, w: number, h: number, radius = 0): number {
    const gl = this.gl
    this.pickT.resize(w, h)
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.pickT.fbo)
    gl.viewport(0, 0, w, h)
    gl.disable(gl.BLEND)
    gl.clearColor(0, 0, 0, 1)
    gl.clear(gl.COLOR_BUFFER_BIT)

    const p = this.progs.pick
    gl.useProgram(p.program)
    gl.uniformMatrix4fv(p.u.u_vp, false, camera.viewProj)
    gl.activeTexture(gl.TEXTURE0)
    gl.bindTexture(gl.TEXTURE_2D, this.nodeLut.tex)
    gl.uniform1i(p.u.u_lut, 0)
    attrib(gl, this.bufs.node, p.a.a_pos, 3, 7, 0)
    attrib(gl, this.bufs.node, p.a.a_id, 1, 7, 3)
    attrib(gl, this.bufs.node, p.a.a_size, 1, 7, 4)
    gl.drawArrays(gl.POINTS, 0, this.counts.node)

    // GL's origin is bottom-left; the pointer's is top-left.
    const cx = x
    const cy = h - y
    const r = Math.max(0, Math.round(radius))
    const x0 = Math.max(0, cx - r)
    const y0 = Math.max(0, cy - r)
    const x1 = Math.min(w - 1, cx + r)
    const y1 = Math.min(h - 1, cy + r)
    const bw = x1 - x0 + 1
    const bh = y1 - y0 + 1
    let best = -1
    if (bw > 0 && bh > 0) {
      const px = new Uint8Array(bw * bh * 4)
      gl.readPixels(x0, y0, bw, bh, gl.RGBA, gl.UNSIGNED_BYTE, px)
      let nearest = Infinity
      for (let j = 0; j < bh; j++) {
        const dy = y0 + j - cy
        for (let i = 0; i < bw; i++) {
          const o = (j * bw + i) * 4
          const id = px[o] | (px[o + 1] << 8) | (px[o + 2] << 16)
          if (!id) continue
          const dx = x0 + i - cx
          const d = dx * dx + dy * dy
          if (d < nearest) {
            nearest = d
            best = id - 1
          }
        }
      }
    }
    gl.bindFramebuffer(gl.FRAMEBUFFER, null)
    return best
  }

  draw(camera: Camera, w: number, h: number, palette: Palette, vis: Visible, dt: number) {
    const gl = this.gl
    this.flow = (this.flow + dt * 0.55) % 2
    const vp = camera.viewProj
    const win = vis.window ?? [0, 0]
    const windowed = vis.window ? 1 : 0

    this.sceneT.resize(w, h)
    const bw = Math.max(2, w >> 2)
    const bh = Math.max(2, h >> 2)
    this.brightT.resize(bw, bh)
    this.blurT.resize(bw, bh)

    gl.bindFramebuffer(gl.FRAMEBUFFER, this.sceneT.fbo)
    gl.viewport(0, 0, w, h)
    gl.clearColor(0, 0, 0, 1)
    gl.clear(gl.COLOR_BUFFER_BIT)
    gl.disable(gl.DEPTH_TEST)
    gl.enable(gl.BLEND)
    // Additive everywhere: this is an exposure, not a painting. Things in front
    // of other things add to them.
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE)

    const setWindow = (p: Program) => {
      gl.uniform2f(p.u.u_window, win[0], win[1])
      gl.uniform1f(p.u.u_windowed, windowed)
    }

    // ---- axis and the untyped mesh
    {
      const p = this.progs.plain
      gl.useProgram(p.program)
      gl.uniformMatrix4fv(p.u.u_vp, false, vp)
      setWindow(p)
      if (vis.untyped) {
        gl.uniform4f(p.u.u_colour, ...palette.link, 0.055)
        attrib(gl, this.bufs.link, p.a.a_pos, 3, 4, 0)
        attrib(gl, this.bufs.link, p.a.a_m, 1, 4, 3)
        gl.drawArrays(gl.LINES, 0, this.counts.link)
      }
      if (vis.axis) {
        gl.uniform4f(p.u.u_colour, ...palette.axis, 0.4)
        attrib(gl, this.bufs.axis, p.a.a_pos, 3, 4, 0)
        attrib(gl, this.bufs.axis, p.a.a_m, 1, 4, 3)
        gl.drawArrays(gl.LINES, 0, this.counts.axis)
      }
    }

    // ---- the sheath
    if (vis.sheath) {
      const p = this.progs.sheath
      gl.useProgram(p.program)
      gl.uniformMatrix4fv(p.u.u_vp, false, vp)
      setWindow(p)
      gl.uniform1f(p.u.u_size, 0.9)
      gl.uniform3f(p.u.u_sent, ...palette.sent)
      gl.uniform3f(p.u.u_recv, ...palette.recv)
      gl.uniform1f(p.u.u_alpha, vis.sheathAlpha)
      attrib(gl, this.bufs.sheath, p.a.a_pos, 3, 5, 0)
      attrib(gl, this.bufs.sheath, p.a.a_dir, 1, 5, 3)
      attrib(gl, this.bufs.sheath, p.a.a_m, 1, 5, 4)
      // Fewer points at a proportionally higher alpha, so a sampled sheath has
      // roughly the brightness of a whole one rather than fading out.
      const n = Math.max(1, Math.round(this.counts.sheath * vis.sheathFraction))
      gl.uniform1f(p.u.u_alpha, vis.sheathAlpha / Math.max(0.25, vis.sheathFraction) ** 0.55)
      gl.drawArrays(gl.POINTS, 0, n)
    }

    // ---- the typed graph
    if (vis.typed) {
      const p = this.progs.edges
      gl.useProgram(p.program)
      gl.uniformMatrix4fv(p.u.u_vp, false, vp)
      setWindow(p)
      gl.uniform1f(p.u.u_flow, this.flow)
      palette.families.forEach((c, i) => gl.uniform3f(p.u[`u_family[${i}]`], ...c))
      gl.activeTexture(gl.TEXTURE0)
      gl.bindTexture(gl.TEXTURE_2D, this.edgeLut.tex)
      gl.uniform1i(p.u.u_lut, 0)
      attrib(gl, this.bufs.edge, p.a.a_pos, 3, 7, 0)
      attrib(gl, this.bufs.edge, p.a.a_id, 1, 7, 3)
      attrib(gl, this.bufs.edge, p.a.a_t, 1, 7, 4)
      attrib(gl, this.bufs.edge, p.a.a_family, 1, 7, 5)
      attrib(gl, this.bufs.edge, p.a.a_m, 1, 7, 6)
      gl.drawArrays(gl.LINES, 0, this.counts.edge)
    }

    // ---- the pages
    {
      const p = this.progs.nodes
      gl.useProgram(p.program)
      gl.uniformMatrix4fv(p.u.u_vp, false, vp)
      setWindow(p)
      palette.domains.forEach((c, i) => gl.uniform3f(p.u[`u_domain[${i}]`], ...c))
      gl.activeTexture(gl.TEXTURE0)
      gl.bindTexture(gl.TEXTURE_2D, this.nodeLut.tex)
      gl.uniform1i(p.u.u_lut, 0)
      attrib(gl, this.bufs.node, p.a.a_pos, 3, 7, 0)
      attrib(gl, this.bufs.node, p.a.a_id, 1, 7, 3)
      attrib(gl, this.bufs.node, p.a.a_size, 1, 7, 4)
      attrib(gl, this.bufs.node, p.a.a_domain, 1, 7, 5)
      attrib(gl, this.bufs.node, p.a.a_m, 1, 7, 6)
      gl.drawArrays(gl.POINTS, 0, this.counts.node)
    }

    /* ---- bloom ----------------------------------------------------------- */
    gl.disable(gl.BLEND)
    const full = (p: Program) => {
      attrib(gl, this.bufs.quad, p.a.a_pos, 2, 2, 0)
      gl.drawArrays(gl.TRIANGLES, 0, 3)
    }

    if (vis.bloom > 0.001) {
      gl.bindFramebuffer(gl.FRAMEBUFFER, this.brightT.fbo)
      gl.viewport(0, 0, bw, bh)
      let p = this.progs.bright
      gl.useProgram(p.program)
      gl.activeTexture(gl.TEXTURE0)
      gl.bindTexture(gl.TEXTURE_2D, this.sceneT.tex)
      gl.uniform1i(p.u.u_src, 0)
      gl.uniform1f(p.u.u_cut, 0.22)
      full(p)

      p = this.progs.blur
      gl.useProgram(p.program)
      for (const [src, dst, step] of [
        [this.brightT, this.blurT, [1 / bw, 0]],
        [this.blurT, this.brightT, [0, 1 / bh]],
      ] as const) {
        gl.bindFramebuffer(gl.FRAMEBUFFER, dst.fbo)
        gl.viewport(0, 0, bw, bh)
        gl.activeTexture(gl.TEXTURE0)
        gl.bindTexture(gl.TEXTURE_2D, src.tex)
        gl.uniform1i(p.u.u_src, 0)
        gl.uniform2f(p.u.u_step, step[0], step[1])
        full(p)
      }
    }

    gl.bindFramebuffer(gl.FRAMEBUFFER, null)
    gl.viewport(0, 0, w, h)
    const p = this.progs.composite
    gl.useProgram(p.program)
    gl.activeTexture(gl.TEXTURE0)
    gl.bindTexture(gl.TEXTURE_2D, this.sceneT.tex)
    gl.uniform1i(p.u.u_scene, 0)
    gl.activeTexture(gl.TEXTURE1)
    gl.bindTexture(gl.TEXTURE_2D, vis.bloom > 0.001 ? this.brightT.tex : this.sceneT.tex)
    gl.uniform1i(p.u.u_bloom, 1)
    gl.uniform1f(p.u.u_strength, vis.bloom)
    gl.uniform3f(p.u.u_void, ...palette.void)
    full(p)
  }
}
