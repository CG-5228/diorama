/**
 * @internal Late-bound constructors that break circular imports between Shape, Path and boolean ops.
 * Registered once as a side effect of importing `@core/draw`.
 */

import type { Point } from '../types.js';
import type { Shape, CompoundShape } from '../shapes/shape.js';
import type { Path } from '../shapes/path.js';

export type PathCtor = new (points: Point[], closed?: boolean) => Path;
export type BooleanOp = 'unite' | 'subtract' | 'intersect';
export type BooleanRunner = (op: BooleanOp, a: Shape, b: Shape | Point[]) => CompoundShape;

let pathCtor: PathCtor | null = null;
let booleanRunner: BooleanRunner | null = null;

export function registerPathConstructor(ctor: PathCtor): void {
  pathCtor = ctor;
}

export function registerBooleanRunner(runner: BooleanRunner): void {
  booleanRunner = runner;
}

export function createPath(points: Point[], closed = false): Path {
  if (!pathCtor) throw new Error('Path is not registered. Import from @core/draw, not from internal modules.');
  return new pathCtor(points, closed);
}

export function runBoolean(op: BooleanOp, a: Shape, b: Shape | Point[]): CompoundShape {
  if (!booleanRunner) throw new Error('Boolean runner is not registered. Import from @core/draw, not from internal modules.');
  return booleanRunner(op, a, b);
}
