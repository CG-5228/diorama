/**
 * @core/volume - 3D vectors
 *
 * World axes of the 2.5D space: x to the right of the screen, y towards the camera
 * (down the screen), z up. Units are logical pixels at the camera's scale 1.
 */

/** A point or direction in the 2.5D world: x right, y towards the camera, z up. */
export interface Vec3 {
  x: number;
  y: number;
  z: number;
}

/** Builds a Vec3. */
export const vec3 = (x: number, y: number, z: number): Vec3 => ({ x, y, z });

/** World up (z). */
export const UP: Vec3 = { x: 0, y: 0, z: 1 };

export const add3 = (a: Vec3, b: Vec3): Vec3 => ({ x: a.x + b.x, y: a.y + b.y, z: a.z + b.z });
export const sub3 = (a: Vec3, b: Vec3): Vec3 => ({ x: a.x - b.x, y: a.y - b.y, z: a.z - b.z });
export const scale3 = (a: Vec3, s: number): Vec3 => ({ x: a.x * s, y: a.y * s, z: a.z * s });
export const dot3 = (a: Vec3, b: Vec3): number => a.x * b.x + a.y * b.y + a.z * b.z;
export const cross3 = (a: Vec3, b: Vec3): Vec3 => ({
  x: a.y * b.z - a.z * b.y,
  y: a.z * b.x - a.x * b.z,
  z: a.x * b.y - a.y * b.x,
});
export const len3 = (a: Vec3): number => Math.hypot(a.x, a.y, a.z);

/** Unit vector in the direction of `a` (zero vector stays zero). */
export const norm3 = (a: Vec3): Vec3 => {
  const l = len3(a);
  return l > 1e-9 ? scale3(a, 1 / l) : { x: 0, y: 0, z: 0 };
};

export const lerp3 = (a: Vec3, b: Vec3, t: number): Vec3 => ({
  x: a.x + (b.x - a.x) * t,
  y: a.y + (b.y - a.y) * t,
  z: a.z + (b.z - a.z) * t,
});

/** Weighted sum: `mix3([a, 1], [b, 2])` is a + 2b. */
export function mix3(...terms: [Vec3, number][]): Vec3 {
  let x = 0;
  let y = 0;
  let z = 0;
  for (const [p, s] of terms) {
    x += p.x * s;
    y += p.y * s;
    z += p.z * s;
  }
  return { x, y, z };
}
