/**
 * The camera, and the four-by-four matrices nobody wants to import a library
 * for.
 *
 * THE CORE is a column, so the camera is an orbit around a vertical axis rather
 * than a free six-degree-of-freedom rig: azimuth around it, elevation above it,
 * distance from it, and a target height that slides up and down the years. That
 * constraint is the whole reason the room stays legible — you cannot get lost
 * inside a structure you can only circle.
 *
 * Everything is damped toward a goal rather than set directly, which is what
 * makes a click on a node read as *flying* to it instead of cutting. The
 * damping is frame-rate independent (`1 - pow(k, dt)`), so a 144 Hz monitor and
 * a 30 Hz one arrive at the same time — the mistake that makes most hand-rolled
 * cameras feel wrong on a fast display.
 */

export type Mat4 = Float32Array

export const mat4 = (): Mat4 =>
  new Float32Array([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1])

export function perspective(out: Mat4, fovy: number, aspect: number, near: number, far: number) {
  const f = 1 / Math.tan(fovy / 2)
  out[0] = f / aspect
  out[1] = out[2] = out[3] = out[4] = 0
  out[5] = f
  out[6] = out[7] = out[8] = out[9] = 0
  out[10] = (far + near) / (near - far)
  out[11] = -1
  out[12] = out[13] = 0
  out[14] = (2 * far * near) / (near - far)
  out[15] = 0
  return out
}

export function lookAt(out: Mat4, eye: number[], centre: number[], up: number[]) {
  let z0 = eye[0] - centre[0]
  let z1 = eye[1] - centre[1]
  let z2 = eye[2] - centre[2]
  let len = Math.hypot(z0, z1, z2) || 1
  z0 /= len
  z1 /= len
  z2 /= len

  let x0 = up[1] * z2 - up[2] * z1
  let x1 = up[2] * z0 - up[0] * z2
  let x2 = up[0] * z1 - up[1] * z0
  len = Math.hypot(x0, x1, x2)
  if (!len) {
    x0 = 1
    x1 = x2 = 0
  } else {
    x0 /= len
    x1 /= len
    x2 /= len
  }

  const y0 = z1 * x2 - z2 * x1
  const y1 = z2 * x0 - z0 * x2
  const y2 = z0 * x1 - z1 * x0

  out[0] = x0
  out[1] = y0
  out[2] = z0
  out[3] = 0
  out[4] = x1
  out[5] = y1
  out[6] = z1
  out[7] = 0
  out[8] = x2
  out[9] = y2
  out[10] = z2
  out[11] = 0
  out[12] = -(x0 * eye[0] + x1 * eye[1] + x2 * eye[2])
  out[13] = -(y0 * eye[0] + y1 * eye[1] + y2 * eye[2])
  out[14] = -(z0 * eye[0] + z1 * eye[1] + z2 * eye[2])
  out[15] = 1
  return out
}

export function multiply(out: Mat4, a: Mat4, b: Mat4) {
  for (let c = 0; c < 4; c++) {
    const b0 = b[c * 4]
    const b1 = b[c * 4 + 1]
    const b2 = b[c * 4 + 2]
    const b3 = b[c * 4 + 3]
    out[c * 4] = b0 * a[0] + b1 * a[4] + b2 * a[8] + b3 * a[12]
    out[c * 4 + 1] = b0 * a[1] + b1 * a[5] + b2 * a[9] + b3 * a[13]
    out[c * 4 + 2] = b0 * a[2] + b1 * a[6] + b2 * a[10] + b3 * a[14]
    out[c * 4 + 3] = b0 * a[3] + b1 * a[7] + b2 * a[11] + b3 * a[15]
  }
  return out
}

const clamp = (n: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, n))

export class Camera {
  /** Where the camera is going. */
  goal = { azimuth: 0.7, elevation: 0.28, distance: 240, height: 0 }
  /** Where it actually is. */
  at = { azimuth: 0.7, elevation: 0.28, distance: 240, height: 0 }

  readonly view = mat4()
  readonly proj = mat4()
  readonly viewProj = mat4()
  readonly eye = [0, 0, 0]

  /** Set both goal and position — used on first frame and on a hard reset. */
  snap() {
    this.at = { ...this.goal }
  }

  orbit(dx: number, dy: number) {
    this.goal.azimuth += dx
    this.goal.elevation = clamp(this.goal.elevation + dy, -1.35, 1.35)
  }

  dolly(factor: number) {
    this.goal.distance = clamp(this.goal.distance * factor, 12, 1600)
  }

  pan(dy: number) {
    this.goal.height += dy
  }

  /** Fly to a point: keep the current angle, centre the height, close in. */
  focus(height: number, distance = 90) {
    this.goal.height = height
    this.goal.distance = clamp(distance, 12, 1600)
  }

  /**
   * Advance toward the goal. `motion === false` teleports instead of easing —
   * the destination is the same, the journey is what a reduced-motion reader
   * asked not to be shown.
   */
  step(dt: number, motion: boolean) {
    if (!motion) {
      this.at = { ...this.goal }
    } else {
      const k = 1 - Math.pow(0.0015, Math.min(dt, 0.1))
      this.at.azimuth += (this.goal.azimuth - this.at.azimuth) * k
      this.at.elevation += (this.goal.elevation - this.at.elevation) * k
      this.at.distance += (this.goal.distance - this.at.distance) * k
      this.at.height += (this.goal.height - this.at.height) * k
    }

    const { azimuth, elevation, distance, height } = this.at
    const cosE = Math.cos(elevation)
    this.eye[0] = Math.sin(azimuth) * cosE * distance
    this.eye[1] = height + Math.sin(elevation) * distance
    this.eye[2] = Math.cos(azimuth) * cosE * distance
    lookAt(this.view, this.eye, [0, height, 0], [0, 1, 0])
  }

  frame(aspect: number) {
    perspective(this.proj, 0.9, aspect, 0.5, 4000)
    multiply(this.viewProj, this.proj, this.view)
    return this.viewProj
  }
}
