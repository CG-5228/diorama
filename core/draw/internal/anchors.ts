/**
 * @internal Storage for custom named anchors shared by Shape and Path.
 * Anchors are plain points owned by the set: they follow in-place transforms (translate, rotate,
 * scale, moveTo) and `clone()`, but are intentionally dropped by operations that build new geometry
 * (booleans, offsets, deformations).
 */

import type { Point, AnchorName } from '../types.js';
import type { PointVisitor } from './points.js';

export const BUILTIN_ANCHORS: readonly AnchorName[] = [
  'center', 'top', 'bottom', 'left', 'right', 'topLeft', 'topRight', 'bottomLeft', 'bottomRight',
];

export class AnchorSet {
  private readonly points = new Map<string, Point>();

  set(name: string, at: Point): void {
    if ((BUILTIN_ANCHORS as readonly string[]).includes(name)) {
      throw new Error(`setAnchor: "${name}" is a built-in anchor name. Pick another name (built-ins: ${BUILTIN_ANCHORS.join(', ')}).`);
    }
    this.points.set(name, { x: at.x, y: at.y });
  }

  get(name: string): Point | undefined {
    const p = this.points.get(name);
    return p ? { x: p.x, y: p.y } : undefined;
  }

  names(): string[] {
    return [...this.points.keys()];
  }

  /** Applies an in-place transform to every stored point. */
  visit(visitor: PointVisitor): void {
    for (const p of this.points.values()) visitor(p);
  }

  /** Copies every anchor of `source` into this set, optionally mapping each point (e.g. mirroring). */
  adopt(source: AnchorSet | undefined, map?: (p: Point) => Point): void {
    if (!source) return;
    for (const [name, p] of source.points) this.points.set(name, map ? map({ x: p.x, y: p.y }) : { x: p.x, y: p.y });
  }

  get size(): number {
    return this.points.size;
  }
}
