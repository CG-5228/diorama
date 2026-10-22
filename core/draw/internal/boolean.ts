/** CSG Boolean Geometry backed by Paper.js. */
import paper from 'paper';
import type { Point } from '../types.js';
import { Shape, CompoundShape, type PolygonRegion } from '../shapes/shape.js';
import { registerBooleanRunner } from './registry.js';

type InputShape = Shape | Point[];

function ensurePaperSetup(): void {
  if (!paper.project) paper.setup(new paper.Size(1000, 1000));
}

function getRegions(shape: InputShape): PolygonRegion[] {
  return Array.isArray(shape) ? [{ outer: shape, holes: [] }] : shape.regions;
}

function createPaperPath(points: Point[]): paper.Path {
  const path = new paper.Path();
  for (const point of points) path.add(new paper.Point(point.x, point.y));
  path.closePath();
  return path;
}

function toPaperItem(shape: InputShape): paper.Path | paper.CompoundPath {
  ensurePaperSetup();
  const regions = getRegions(shape);
  if (regions.length === 1 && regions[0].holes.length === 0) return createPaperPath(regions[0].outer);

  const compound = new paper.CompoundPath({});
  for (const region of regions) {
    compound.addChild(createPaperPath(region.outer));
    for (const hole of region.holes) if (hole.length >= 3) compound.addChild(createPaperPath(hole));
  }
  compound.fillRule = 'evenodd';
  return compound;
}

function extractShapeFromPaper(item: paper.Item | null, flatness?: number): CompoundShape {
  if (!item) return new CompoundShape([]);
  const bounds = item.bounds;
  const maxDim = Math.max(bounds?.width ?? 0, bounds?.height ?? 0);
  const resolvedFlatness = flatness ?? Math.max(0.2, Math.min(1.5, maxDim * 0.005));
  const rings: Point[][] = [];
  const collect = (candidate: paper.Item): void => {
    if (candidate.children?.length) {
      for (const child of candidate.children) collect(child);
    } else if (candidate instanceof paper.Path) {
      candidate.flatten(resolvedFlatness);
      const points = candidate.segments.map(segment => ({ x: segment.point.x, y: segment.point.y }));
      if (points.length >= 3) rings.push(points);
    }
  };
  collect(item);

  const nodes = rings.map((points, index) => ({ index, points, area: polygonArea(points), parent: -1, depth: 0 }));
  for (const node of nodes) {
    let nearestArea = Infinity;
    for (const candidate of nodes) {
      if (candidate.index === node.index || candidate.area <= node.area) continue;
      if (pointInPolygon(node.points[0], candidate.points) && candidate.area < nearestArea) {
        node.parent = candidate.index;
        nearestArea = candidate.area;
      }
    }
  }
  const depthOf = (index: number): number => nodes[index].parent < 0 ? 0 : depthOf(nodes[index].parent) + 1;
  for (const node of nodes) node.depth = depthOf(node.index);

  const regions: PolygonRegion[] = [];
  const byOuter = new Map<number, PolygonRegion>();
  for (const node of nodes.filter(entry => entry.depth % 2 === 0)) {
    const region: PolygonRegion = { outer: node.points, holes: [] };
    regions.push(region);
    byOuter.set(node.index, region);
  }
  for (const node of nodes.filter(entry => entry.depth % 2 === 1)) {
    let outerIndex = node.parent;
    while (outerIndex >= 0 && nodes[outerIndex].depth % 2 !== 0) outerIndex = nodes[outerIndex].parent;
    byOuter.get(outerIndex)?.holes.push(node.points);
  }
  return new CompoundShape(regions);
}

function polygonArea(points: Point[]): number {
  let area = 0;
  for (let i = 0; i < points.length; i++) {
    const next = (i + 1) % points.length;
    area += points[i].x * points[next].y - points[next].x * points[i].y;
  }
  return Math.abs(area) / 2;
}

function pointInPolygon(point: Point, polygon: Point[]): boolean {
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const a = polygon[i];
    const b = polygon[j];
    const crosses = (a.y > point.y) !== (b.y > point.y)
      && point.x < ((b.x - a.x) * (point.y - a.y)) / (b.y - a.y) + a.x;
    if (crosses) inside = !inside;
  }
  return inside;
}

function performBoolean(op: 'unite' | 'subtract' | 'intersect', a: InputShape, b: InputShape): CompoundShape {
  ensurePaperSetup();
  const itemA = toPaperItem(a);
  const itemB = toPaperItem(b);
  let result: paper.Item | null = null;
  try {
    result = op === 'unite' ? itemA.unite(itemB) : op === 'subtract' ? itemA.subtract(itemB) : itemA.intersect(itemB);
    return extractShapeFromPaper(result);
  } finally {
    result?.remove();
    itemA.remove();
    itemB.remove();
  }
}

export function union(a: InputShape, b: InputShape): CompoundShape { return performBoolean('unite', a, b); }
export function subtract(base: InputShape, cut: InputShape): CompoundShape { return performBoolean('subtract', base, cut); }
export function intersect(a: InputShape, b: InputShape): CompoundShape { return performBoolean('intersect', a, b); }

registerBooleanRunner((op, a, b) => performBoolean(op, a, b));
