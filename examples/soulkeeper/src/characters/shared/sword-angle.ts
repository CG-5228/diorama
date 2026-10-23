/**
 * The sword's angle channels, shared by the clips of every character that wields the notched
 * sword (the guard's own clips, the humanoid hit and death in `humanoid-clips.ts`).
 *
 * The skin (`notchedSword` in the gear kit, through `held`) draws the blade from `extra.weaponYaw` and
 * `extra.weaponPitch` (radians, in the creature's frame: yaw turns from forward towards the
 * right, pitch lifts from the horizontal) and falls back to a default angle, forward-right and
 * down, when a clip sets neither. A clip that sets them must start and end on that default, or
 * the sword pops against the idle.
 */

/** The skin's default sword angle. */
export const REST_YAW = 0.5;
export const REST_PITCH = -0.875;

export const mix = (a: number, b: number, w: number) => a + (b - a) * w;

/** The sword channels for a blend `w` (0..1) from the default angle to `yaw` / `pitch`. */
export function swordMix(yaw: number, pitch: number, w: number): { weaponYaw: number; weaponPitch: number } {
  return { weaponYaw: mix(REST_YAW, yaw, w), weaponPitch: mix(REST_PITCH, pitch, w) };
}

/**
 * The sword channels for a blade at angle `alpha` in the vertical plane through the creature's
 * forward axis (0 forward, pi/2 straight up, negative down) with a sideways lean `s` (a sine, -1..1).
 * Driving `alpha` instead of yaw and pitch sweeps the blade over the top in a straight line, where
 * blending yaw and pitch would swing it around the side.
 */
export function bladeAngle(alpha: number, s: number): { weaponYaw: number; weaponPitch: number } {
  const cp = Math.sqrt(1 - s * s);
  return { weaponYaw: Math.atan2(s, cp * Math.cos(alpha)), weaponPitch: Math.asin(cp * Math.sin(alpha)) };
}

/** `bladeAngle` of the default sword direction. */
export const REST_ALPHA = Math.atan2(Math.sin(REST_PITCH), Math.cos(REST_YAW) * Math.cos(REST_PITCH));
export const REST_SIDE = Math.sin(REST_YAW) * Math.cos(REST_PITCH);
