/**
 * @core/volume - Local frames and facings
 *
 * Objects are built in their own frame (forward, side, up) and turned with a yaw, so the
 * same build code renders every direction of an asset.
 */

import { add3, mix3, scale3, vec3, UP, type Vec3 } from './vec3.js';

/**
 * A local frame: an origin plus forward, right and up axes. Build an object in local
 * coordinates with `at(forward, side, up)`; the frame's yaw turns the whole object.
 */
export class Frame3 {
  readonly origin: Vec3;
  readonly forward: Vec3;
  readonly right: Vec3;
  readonly up: Vec3;

  constructor(origin: Vec3, forward: Vec3, right: Vec3, up: Vec3 = UP) {
    this.origin = origin;
    this.forward = forward;
    this.right = right;
    this.up = up;
  }

  /**
   * Upright frame at `origin` facing `yaw` radians: 0 faces +x (screen right),
   * π/2 faces +y (towards the camera). `right` is the object's own right hand.
   */
  static facing(origin: Vec3, yaw: number): Frame3 {
    const c = Math.cos(yaw);
    const s = Math.sin(yaw);
    return new Frame3(origin, vec3(c, s, 0), vec3(-s, c, 0), UP);
  }

  /** World point at local coordinates (forward, side to the right, up). */
  at(forward: number, side: number, up: number): Vec3 {
    return add3(this.origin, this.dir(forward, side, up));
  }

  /** World direction (not translated) from local components. */
  dir(forward: number, side: number, up: number): Vec3 {
    return mix3([this.forward, forward], [this.right, side], [this.up, up]);
  }

  /** The same axes moved to a local point of this frame. */
  moved(forward: number, side: number, up: number): Frame3 {
    return new Frame3(this.at(forward, side, up), this.forward, this.right, this.up);
  }

  /** The frame turned by `degrees` around its up axis (positive turns forward towards right). */
  turned(degrees: number): Frame3 {
    const a = (degrees * Math.PI) / 180;
    const f = mix3([this.forward, Math.cos(a)], [this.right, Math.sin(a)]);
    const r = mix3([this.right, Math.cos(a)], [this.forward, -Math.sin(a)]);
    return new Frame3(this.origin, f, r, this.up);
  }

  /** The frame tipped about its side axis by `degrees` (positive lifts forward towards up): a lid on a back hinge, a leaning part. */
  pitched(degrees: number): Frame3 {
    const a = (degrees * Math.PI) / 180;
    const f = mix3([this.forward, Math.cos(a)], [this.up, Math.sin(a)]);
    const u = mix3([this.up, Math.cos(a)], [this.forward, -Math.sin(a)]);
    return new Frame3(this.origin, f, this.right, u);
  }

  /** The frame rolled about its forward axis by `degrees` (positive lifts the right side). */
  rolled(degrees: number): Frame3 {
    const a = (degrees * Math.PI) / 180;
    const r = mix3([this.right, Math.cos(a)], [this.up, Math.sin(a)]);
    const u = mix3([this.up, Math.cos(a)], [this.right, -Math.sin(a)]);
    return new Frame3(this.origin, this.forward, r, u);
  }

  /**
   * A frame for `Solid.extrude` whose profile plane stands upright, so a profile drawn with x
   * along one horizontal axis and y up is extruded along the other horizontal axis:
   * - 'front': profile x = the object's right, y = up, extruded along forward (a gable, a
   *   headstone, a shield seen from the front);
   * - 'side': profile x = forward, y = up, extruded along the object's right (an arched lid,
   *   a roof, a bench seen from the side).
   * The origin stays where it is; move it first to start the extrusion at an edge.
   */
  profile(plane: 'front' | 'side'): Frame3 {
    return plane === 'front'
      ? new Frame3(this.origin, this.right, this.up, this.forward)
      : new Frame3(this.origin, this.forward, this.up, this.right);
  }

  /** The frame with its axes scaled (non-uniform scaling of everything built in it). */
  scaled(forward: number, side = forward, up = forward): Frame3 {
    return new Frame3(this.origin, scale3(this.forward, forward), scale3(this.right, side), scale3(this.up, up));
  }
}

/** Screen directions in export order, for 1, 4 or 8 facings: starts facing the camera (S) and turns clockwise on screen. */
export const DIRECTION_NAMES: Record<number, string[]> = {
  1: ['S'],
  4: ['S', 'W', 'N', 'E'],
  8: ['S', 'SW', 'W', 'NW', 'N', 'NE', 'E', 'SE'],
};

/**
 * Yaw (radians) of direction `index` out of `count`, in export order: index 0 faces the
 * camera (S, yaw π/2) and each next index turns clockwise on screen.
 */
export function facingYaw(index: number, count: number): number {
  return Math.PI / 2 + (index * 2 * Math.PI) / count;
}

/** Name of direction `index` out of `count` ("S", "SW", ...), or "D<index>" for other counts. */
export function directionName(index: number, count: number): string {
  return DIRECTION_NAMES[count]?.[index] ?? `D${index}`;
}
