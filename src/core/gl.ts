/**
 * The thinnest WebGL2 layer that will carry THE CORE.
 *
 * This repository has four runtime dependencies and no graphics library, and
 * that is not an accident to be worked around. What the room actually needs is
 * narrow and known: compile a program, fill a buffer, describe an attribute,
 * write a lookup texture, render to an offscreen target. Six functions. A
 * library would bring a scene graph, a material system and a loader for formats
 * nothing here uses, and it would be the largest thing in the bundle.
 *
 * So this is the whole abstraction. Everything above it — `scene.ts` — writes
 * GL calls directly, which is also the reason the shaders are legible: there is
 * no layer in between rewriting them.
 */

/** A shader that failed to compile is a bug, not a runtime condition. */
function compile(gl: WebGL2RenderingContext, kind: number, src: string) {
  const shader = gl.createShader(kind)!
  gl.shaderSource(shader, src)
  gl.compileShader(shader)
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    const log = gl.getShaderInfoLog(shader)
    const numbered = src
      .split('\n')
      .map((l, i) => `${String(i + 1).padStart(3)} ${l}`)
      .join('\n')
    gl.deleteShader(shader)
    throw new Error(`${kind === gl.VERTEX_SHADER ? 'vertex' : 'fragment'} shader:\n${log}\n${numbered}`)
  }
  return shader
}

export type Program = {
  program: WebGLProgram
  /** Uniform locations, resolved once. Missing names read `null` and are no-ops. */
  u: Record<string, WebGLUniformLocation | null>
  /** Attribute locations, resolved once. `-1` where the compiler removed one. */
  a: Record<string, number>
}

export function program(
  gl: WebGL2RenderingContext,
  vert: string,
  frag: string,
  uniforms: string[],
  attribs: string[],
): Program {
  const p = gl.createProgram()!
  const vs = compile(gl, gl.VERTEX_SHADER, vert)
  const fs = compile(gl, gl.FRAGMENT_SHADER, frag)
  gl.attachShader(p, vs)
  gl.attachShader(p, fs)
  gl.linkProgram(p)
  if (!gl.getProgramParameter(p, gl.LINK_STATUS)) {
    const log = gl.getProgramInfoLog(p)
    throw new Error(`link: ${log}`)
  }
  gl.deleteShader(vs)
  gl.deleteShader(fs)

  const u: Record<string, WebGLUniformLocation | null> = {}
  for (const name of uniforms) u[name] = gl.getUniformLocation(p, name)
  const a: Record<string, number> = {}
  for (const name of attribs) a[name] = gl.getAttribLocation(p, name)
  return { program: p, u, a }
}

export function buffer(
  gl: WebGL2RenderingContext,
  data: AllowSharedBufferSource,
  usage = gl.STATIC_DRAW,
) {
  const b = gl.createBuffer()!
  gl.bindBuffer(gl.ARRAY_BUFFER, b)
  gl.bufferData(gl.ARRAY_BUFFER, data, usage)
  return b
}

/** Bind one float attribute out of an interleaved buffer. Sizes are in floats. */
export function attrib(
  gl: WebGL2RenderingContext,
  buf: WebGLBuffer,
  loc: number,
  size: number,
  stride: number,
  offset: number,
) {
  if (loc < 0) return
  gl.bindBuffer(gl.ARRAY_BUFFER, buf)
  gl.enableVertexAttribArray(loc)
  gl.vertexAttribPointer(loc, size, gl.FLOAT, false, stride * 4, offset * 4)
}

/**
 * A 1-D lookup texture, one byte per element.
 *
 * This is how the room filters and highlights without rebuilding geometry. Every
 * edge and every node carries its own index as a vertex attribute; the shader
 * reads this texture at that index to find out whether it is hidden, dimmed,
 * lit or selected. Changing what is on screen becomes a `texSubImage2D` of a few
 * kilobytes instead of retessellating 57,000 vertices, which is the difference
 * between a filter that feels instant and one that hitches.
 */
export function lut(gl: WebGL2RenderingContext, width: number) {
  const tex = gl.createTexture()!
  const data = new Uint8Array(width)
  gl.bindTexture(gl.TEXTURE_2D, tex)
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.R8, width, 1, 0, gl.RED, gl.UNSIGNED_BYTE, data)
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST)
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST)
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE)
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE)
  return {
    tex,
    data,
    width,
    upload() {
      gl.bindTexture(gl.TEXTURE_2D, tex)
      gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, width, 1, gl.RED, gl.UNSIGNED_BYTE, data)
    },
  }
}

export type Target = {
  fbo: WebGLFramebuffer
  tex: WebGLTexture
  w: number
  h: number
  resize(w: number, h: number): void
}

/** An offscreen colour target. Used for the bloom chain and for picking. */
export function target(gl: WebGL2RenderingContext, w: number, h: number, float = false): Target {
  const tex = gl.createTexture()!
  const fbo = gl.createFramebuffer()!
  const internal = float ? gl.RGBA16F : gl.RGBA8
  const type = float ? gl.HALF_FLOAT : gl.UNSIGNED_BYTE

  const alloc = (width: number, height: number) => {
    gl.bindTexture(gl.TEXTURE_2D, tex)
    gl.texImage2D(gl.TEXTURE_2D, 0, internal, width, height, 0, gl.RGBA, type, null)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE)
    gl.bindFramebuffer(gl.FRAMEBUFFER, fbo)
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tex, 0)
    gl.bindFramebuffer(gl.FRAMEBUFFER, null)
  }
  alloc(w, h)

  const t: Target = {
    fbo,
    tex,
    w,
    h,
    resize(width, height) {
      if (t.w === width && t.h === height) return
      t.w = width
      t.h = height
      alloc(width, height)
    },
  }
  return t
}

/** A unit quad, for every full-screen pass. */
export function quad(gl: WebGL2RenderingContext) {
  return buffer(gl, new Float32Array([-1, -1, 3, -1, -1, 3]))
}
