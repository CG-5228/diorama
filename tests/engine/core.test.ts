import assert from 'node:assert/strict';
import { defineBar, defineBitmapFont, defineNineSlice, defineUiImage } from '../../core/ui.js';
import {
  Point,
  Shape,
  Polygon,
  Path,
  StrokeStyle,
  ShapeStyle,
  attach,
  scatterAlong,
  type Transformable,
} from '../../core/draw/index.js';

console.log('🧪 Starting @core/draw & Interface Assets Test Suite...\n');

// ----------------------------------------------------
// 1. Defending Against Point Aliasing (Bug B1)
// ----------------------------------------------------
{
  const p1 = { x: 10, y: 10 };
  const p2 = { x: 50, y: 50 };
  const line = Path.line(p1, p2);
  line.translate(10, 10);
  assert.equal(p1.x, 10, 'Path.line must not mutate caller start point');
  assert.equal(p2.x, 50, 'Path.line must not mutate caller end point');
  assert.equal(line.points[0].x, 20, 'Path points must be properly translated');

  const pts = [{ x: 0, y: 0 }, { x: 20, y: 0 }, { x: 10, y: 20 }];
  const poly = Polygon.fromPoints(pts);
  poly.translate(5, 5);
  assert.equal(pts[0].x, 0, 'Polygon.fromPoints must not mutate input array');
  assert.equal(poly.toPoints()[0].x, 5, 'Polygon points must be translated');

  // toPoints immutability check
  const polyPts = poly.toPoints();
  polyPts[0].x = 999;
  assert.notEqual(poly.toPoints()[0].x, 999, 'Mutating toPoints() array must not alter Shape state');
  console.log('✔ Bug B1 (Aliasing Prevention) passed.');
}

// ----------------------------------------------------
// 2. Path Measurements & Slicing
// ----------------------------------------------------
{
  const p = Path.line({ x: 0, y: 0 }, { x: 100, y: 0 });
  assert.equal(p.length, 100, 'Path length must equal distance');

  const mid = p.pointAt(0.5);
  assert.equal(mid.x, 50, 'pointAt(0.5) must be midpoint');
  assert.equal(mid.y, 0);

  const tan = p.tangentAt(0.5);
  assert.equal(tan.x, 1);
  assert.equal(tan.y, 0);

  const norm = p.normalAt(0.5);
  assert.equal(norm.x, 0);
  assert.equal(norm.y, 1);

  const sliced = p.slice(0.2, 0.8);
  assert.equal(sliced.length, 60);
  assert.equal(sliced.points[0].x, 20);

  const resampled = p.resample(5);
  assert.equal(resampled.points.length, 5);
  assert.equal(resampled.points[2].x, 50);

  console.log('✔ Path measurements & slicing passed.');
}

// ----------------------------------------------------
// 3. Path -> Shape (toShape) & Shape -> Path (contours, outline)
// ----------------------------------------------------
{
  const line = Path.line({ x: 0, y: 10 }, { x: 100, y: 10 });
  const ribbon = line.toShape({ width: 10, cap: 'butt' });
  const bounds = ribbon.bounds;
  assert.equal(bounds.minX, 0);
  assert.equal(bounds.maxX, 100);
  assert.equal(bounds.height, 10);

  const rect = Polygon.rect(40, 20, { cx: 50, cy: 50 });
  const contours = rect.contours();
  assert.equal(contours.length, 1);
  assert.equal(contours[0].closed, true);

  const outlineShape = rect.outline({ width: 4, position: 'outside' });
  assert.ok(outlineShape.bounds.width > 40, 'Outline shape must expand outside');

  console.log('✔ Path toShape and Shape outline passed.');
}

// ----------------------------------------------------
// 4. Stroke renderers ('ribbon', 'clean') & style deep merge
// ----------------------------------------------------
{
  // 'clean' is a native canvas stroke; 'ribbon' (the default) fills a calligraphic outline.
  const calls: string[] = [];
  const recorder = new Proxy({} as Record<string, unknown>, {
    get: (_target, key) => (typeof key === 'string' && ['save', 'restore', 'beginPath', 'moveTo', 'lineTo', 'closePath', 'stroke', 'fill', 'quadraticCurveTo'].includes(key) ? () => void calls.push(key) : undefined),
    set: () => true,
  }) as unknown as CanvasRenderingContext2D;
  const line = [{ x: 0, y: 0 }, { x: 40, y: 10 }];

  new StrokeStyle({ width: 2, color: '#222222', renderer: 'clean' }).render(recorder, line);
  assert.ok(calls.includes('stroke') && !calls.includes('fill'), "'clean' must stroke natively");
  calls.length = 0;
  new StrokeStyle({ width: 2, color: '#222222' }).render(recorder, line);
  assert.ok(calls.includes('fill') && !calls.includes('stroke'), "the default 'ribbon' renderer must fill its outline");
  assert.throws(() => new StrokeStyle({ renderer: 'sketch' as never }).render(recorder, line), /Unknown stroke renderer "sketch"/);

  // StrokeStyle.with keeps what it does not override.
  const stroke = new StrokeStyle({ color: '#ff0000', renderer: 'clean' });
  const modified = stroke.with({ width: 10 });
  assert.equal(modified.renderer, 'clean');
  assert.equal(modified.attrs.width, 10);
  assert.equal(modified.attrs.color, '#ff0000');

  // ShapeStyle deep merge test (Bug B6)
  const baseShapeStyle = new ShapeStyle({
    fill: '#111111',
    stroke: new StrokeStyle({ width: 4, color: '#222222', renderer: 'clean' }),
    shadow: { color: '#000000', x: 2, y: 2 },
  });

  const derivedShapeStyle = baseShapeStyle.with({
    stroke: { width: 8 },
  });

  const derivedStrokeOpts = derivedShapeStyle.stroke instanceof StrokeStyle
    ? derivedShapeStyle.stroke.attrs
    : derivedShapeStyle.stroke!;
  assert.equal(derivedStrokeOpts.width, 8);
  assert.equal(derivedStrokeOpts.color, '#222222', 'ShapeStyle.with must preserve base stroke color');
  assert.equal(derivedStrokeOpts.renderer, 'clean', 'ShapeStyle.with must preserve base stroke renderer');

  console.log('✔ Stroke renderers and deep merge passed.');
}

// ----------------------------------------------------
// 5. Placement (attach)
// ----------------------------------------------------
{
  const b1 = Polygon.rect(40, 40, { cx: 50, cy: 50 });
  const b2 = Polygon.circle(10, { cx: 0, cy: 0 });
  attach(b2, b1, { from: 'bottom', at: 'top' });
  assert.equal(b2.bounds.maxY, b1.bounds.minY);

  console.log('✔ Placement (attach) passed.');
}

// ----------------------------------------------------
// 6. Bidirectional Line ↔ Shape CSG (unionLine & cutLine)
// ----------------------------------------------------
{
  const base = Polygon.rect(60, 60, { cx: 50, cy: 50 });
  const cutPath = Path.line({ x: 20, y: 50 }, { x: 80, y: 50 });

  // Cut base shape with line
  const sliced = base.cutLine(cutPath, 6);
  assert.ok(sliced.regions.length >= 2 || sliced.bounds.height < 60, 'cutLine must split or reduce shape');

  // Unite an ear/spike line with base shape
  const hornPath = Path.line({ x: 50, y: 20 }, { x: 50, y: 0 });
  const withHorn = base.unionLine(hornPath, 8);
  assert.equal(withHorn.bounds.minY, 0, 'unionLine must expand the shape boundary to the tip of the line');

  console.log('✔ Bidirectional Line ↔ Shape CSG (unionLine & cutLine) passed.');
}

// ----------------------------------------------------
// 7. Boolean CSG with Direct Path Inputs
// ----------------------------------------------------
{
  const square = Polygon.rect(40, 40, { cx: 50, cy: 50 });
  const crossLine = Path.line({ x: 30, y: 50 }, { x: 70, y: 50 });

  const cutResult = square.subtract(crossLine, 4);
  assert.ok(cutResult.bounds.width >= 40);

  const united = square.union(crossLine, 10);
  assert.ok(united.bounds.width >= 40);

  console.log('✔ Boolean CSG with direct Path inputs passed.');
}

// ----------------------------------------------------
// 8. StrokeStyle<P> Generic Typed Custom Parameters
// ----------------------------------------------------
{
  interface NeonParams {
    glowIntensity: number;
    flicker: boolean;
  }

  const baseNeon = new StrokeStyle<NeonParams>({ width: 3, glowIntensity: 10, flicker: false, color: '#00ffcc' });
  assert.equal(baseNeon.attrs.glowIntensity, 10);
  assert.equal(baseNeon.attrs.flicker, false);

  // Deriving with .with() preserves custom params and allows typed overrides
  const updatedNeon = baseNeon.with({ glowIntensity: 20 });
  assert.equal(updatedNeon.attrs.glowIntensity, 20);
  assert.equal(updatedNeon.attrs.flicker, false);
  assert.equal(updatedNeon.attrs.color, '#00ffcc');

  console.log('✔ StrokeStyle<P> typed custom parameters & derivation passed.');
}

// ----------------------------------------------------
// 9. BoundingBox Aliases & Path.toRibbon
// ----------------------------------------------------
{
  const rect = Polygon.rect(100, 50, { cx: 50, cy: 50 });
  const b = rect.bounds;
  assert.equal(b.left, b.minX);
  assert.equal(b.right, b.maxX);
  assert.equal(b.top, b.minY);
  assert.equal(b.bottom, b.maxY);

  const curve = Path.curve({ x: 0, y: 0 }, { x: 100, y: 0 }, 20);
  const ribbon1 = curve.toShape({ width: 10 });
  const ribbon2 = curve.toRibbon({ width: 10 });
  assert.equal(Math.round(ribbon1.bounds.width), Math.round(ribbon2.bounds.width));
  assert.equal(Math.round(ribbon1.bounds.height), Math.round(ribbon2.bounds.height));
  console.log('✔ BoundingBox aliases (left/right/top/bottom) & Path.toRibbon passed.');
}

// ----------------------------------------------------
// 10. Custom Named Anchors on Shape and Path
// ----------------------------------------------------
{
  const sword = Polygon.rect(20, 100, { cx: 50, cy: 50 });
  sword.setAnchor('hilt', { x: 50, y: 90 });
  sword.setAnchor('tip', { x: 50, y: 0 });
  assert.deepEqual(sword.anchor('hilt'), { x: 50, y: 90 });
  assert.deepEqual(sword.anchor('tip'), { x: 50, y: 0 });

  // Custom anchors translate with the shape
  sword.translate(10, 20);
  assert.deepEqual(sword.anchor('hilt'), { x: 60, y: 110 });

  // Custom anchors work with moveTo
  const pommel = Polygon.circle(10, { cx: 0, cy: 0 });
  attach(pommel, sword, { from: 'center', at: 'hilt' });
  assert.deepEqual(pommel.center, { x: 60, y: 110 });

  // Path custom anchors (including arc-length fraction t)
  const arc = Path.curve({ x: 0, y: 0 }, { x: 100, y: 0 }, 30);
  arc.setAnchor('peak', 0.5);
  const peakPt = arc.anchor('peak');
  assert.equal(Math.round(peakPt.x), 50);

  console.log('✔ Custom named anchors & placeable integration passed.');
}

// ----------------------------------------------------
// 11. Flip (Shape)
// ----------------------------------------------------
{
  const leftBladeHalf = Polygon.fromPoints([
    { x: 50, y: 10 },
    { x: 30, y: 60 },
    { x: 50, y: 90 },
  ]);

  // Pure flip: a new shape, the original untouched
  const flipped = leftBladeHalf.flip('x', 50);
  assert.equal(Math.round(flipped.bounds.minX), 50);
  assert.equal(Math.round(leftBladeHalf.bounds.maxX), 50);
  console.log('✔ Flip on Shape passed.');
}

// ----------------------------------------------------
// 12. ScatterAlong
// ----------------------------------------------------
{
  const spine = Path.curve({ x: 10, y: 50 }, { x: 110, y: 50 }, 30);
  const thorn = Polygon.triangle(8, 16);

  const thorns = scatterAlong(spine, thorn, {
    count: 5,
    align: true,
    offset: 4,
    scale: (t) => 0.5 + 0.5 * Math.sin(t * Math.PI),
  });

  assert.equal(thorns.length, 5);
  for (const t of thorns) {
    assert.ok(t instanceof Polygon);
  }
  console.log('✔ scatterAlong (procedural placement along path) passed.');
}

// ----------------------------------------------------
// 13. Non-Destructive Deformations (warp, twist, inflate)
// ----------------------------------------------------
{
  const block = Polygon.rect(60, 60, { cx: 50, cy: 50 });

  // Warp
  const warped = block.warp((p, uv) => ({ x: p.x + uv.y * 10, y: p.y }));
  assert.notEqual(warped.bounds.maxX, block.bounds.maxX);

  // Twist
  const twisted = block.twist({ angle: 45, axis: 'y' });
  assert.ok(twisted.toPoints().length > block.toPoints().length, 'Twist should densify vertices');

  // Inflate (swell / pinch)
  const swollen = block.inflate({ amount: 12, center: { x: 50, y: 50 }, radius: 40 });
  assert.ok(swollen.bounds.width > block.bounds.width, 'Inflate should expand perimeter');

  console.log('✔ Deformations (warp, twist, inflate) passed.');
}

// ----------------------------------------------------
// 14. Ergonomics: Array Booleans, PathBuilder toShape & StrokeStyle in unionLine
// ----------------------------------------------------
{
  // PathBuilder.toShape directly
  const ribbonShape = Path.builder({ x: 0, y: 10 })
    .curveTo({ x: 100, y: 10 }, 20)
    .toShape({ width: 12 });
  assert.ok(ribbonShape instanceof Shape);
  assert.ok(ribbonShape.bounds.width >= 99);

  // path.toShape with scalar width and StrokeStyle
  const line = Path.line({ x: 0, y: 0 }, { x: 50, y: 0 });
  const scalarShape = line.toShape(6);
  assert.equal(Math.round(scalarShape.bounds.height), 6);

  const stroke = new StrokeStyle({ width: 8 });
  const strokeShape = line.toShape(stroke);
  assert.equal(Math.round(strokeShape.bounds.height), 8);

  // Array union on a shape: shape.union([s2, s3])
  const s1 = Polygon.rect(20, 20, { cx: 10, cy: 10 });
  const s2 = Polygon.rect(20, 20, { cx: 25, cy: 10 });
  const s3 = Polygon.rect(20, 20, { cx: 40, cy: 10 });
  const chained = s1.union([s2, s3]);
  assert.ok(chained.bounds.width >= 49);

  // Array subtract: shape.subtract([cut1, cut2])
  const baseBox = Polygon.rect(60, 60, { cx: 50, cy: 50 });
  const cut1 = Polygon.rect(10, 10, { cx: 30, cy: 50 });
  const cut2 = Polygon.rect(10, 10, { cx: 70, cy: 50 });
  const punched = baseBox.subtract([cut1, cut2]);
  assert.ok(punched.regions.length >= 1);

  // unionLine & cutLine with StrokeStyle
  const seamPath = Path.line({ x: 50, y: 10 }, { x: 50, y: 90 });
  const welded = baseBox.unionLine(seamPath, stroke);
  assert.ok(welded instanceof Shape);

  const sliced = baseBox.cutLine(seamPath, stroke);
  assert.ok(sliced instanceof Shape);

  console.log('✔ Array Booleans, PathBuilder toShape & StrokeStyle in unionLine passed.');
}

// ----------------------------------------------------
// 15. Side convention: a positive bow (and a positive offset) moves along normalAt,
// which is the right-hand side of the direction of travel on screen (y grows downward).
{
  const curve = Path.curve({ x: 0, y: 0 }, { x: 100, y: 0 }, 10);
  const apex = curve.pointAt(0.5);
  assert.ok(Math.abs(apex.x - 50) < 0.5, `apex x must be 50, got ${apex.x}`);
  assert.ok(Math.abs(apex.y - 10) < 0.5, `positive bow must bulge to y=+10, got ${apex.y}`);

  const chord = Path.line({ x: 0, y: 0 }, { x: 100, y: 0 });
  const normal = chord.normalAt(0.5);
  assert.ok(Math.abs(normal.x) < 1e-9 && Math.abs(normal.y - 1) < 1e-9, 'normalAt on a rightward line must be (0, 1)');

  console.log('✔ Path side convention (bow and normalAt) passed.');
}

// ----------------------------------------------------
// 16. Transformable: one generic helper moves Shape and Path alike.
{
  const nudge = <T extends Transformable>(item: T): T => item.translate(10, 0);

  const shape = nudge(Polygon.rect(10, 10, { cx: 0, cy: 0 }));
  const path = nudge(Path.line({ x: 0, y: 0 }, { x: 10, y: 0 }));

  assert.ok(Math.abs(shape.center.x - 10) < 1e-6, 'Shape must accept Transformable helpers');
  assert.ok(Math.abs(path.center.x - 15) < 1e-6, 'Path must accept Transformable helpers');

  console.log('✔ Transformable surface (Shape, Path) passed.');
}

// ----------------------------------------------------
// 17. Pivots: the rotation option turns free points around the origin; rotate(deg, pivot) turns a part in place.
{
  const base = { x: 100, y: 200 };

  const byOption = Polygon.stem(base, 40, { rotation: 180 });
  assert.ok(byOption.bounds.y < 0, 'rotation option must pivot on the origin (the stem leaves the canvas)');

  const inPlace = Polygon.stem(base, 40).rotate(180, base);
  assert.ok(Math.abs(inPlace.bounds.y - 200) < 1e-6, `rotate(180, base) must keep the stem at its base, got y=${inPlace.bounds.y}`);
  assert.ok(Math.abs(inPlace.bounds.y + inPlace.bounds.height - 240) < 1e-6, 'the turned stem must hang down from the base');

  console.log('✔ Pivot semantics (rotation option vs rotate with pivot) passed.');
}

// ----------------------------------------------------
// 18. Interface assets: nine-slice states, bar layers, bitmap font advances.
{
  const drawn: string[] = [];
  const ctx = {} as CanvasRenderingContext2D;
  const button = defineNineSlice({ kind: 'button', width: 48, height: 20, insets: { left: 6, top: 6, right: 6, bottom: 6 }, states: ['normal', 'hover', 'pressed', 'disabled'], draw: (_c, _b, state) => void drawn.push(state) });
  assert.equal(button.directions, 4, 'one row per state');
  assert.deepEqual((button.data as any).nineSlice, { left: 6, top: 6, right: 6, bottom: 6 });
  assert.throws(() => defineNineSlice({ kind: 'panel', width: 10, height: 10, insets: { left: 5, top: 2, right: 5, bottom: 2 }, draw: () => {} }), /no middle/);
  const bar = defineBar({ measure: 'health', width: 80, height: 10, insets: { left: 4, top: 3, right: 4, bottom: 3 }, fillBox: { x: 3, y: 3, w: 74, h: 4 }, draw: (_c, _b, layer) => void drawn.push(layer) });
  assert.equal(bar.frames, 3);
  assert.deepEqual((bar.data as any).layers, ['back', 'fill', 'frame']);
  const capped = defineBar({ measure: 'soul', width: 80, height: 10, insets: { left: 4, top: 3, right: 4, bottom: 3 }, fillBox: { x: 3, y: 3, w: 74, h: 4 }, cap: { width: 3 }, draw: () => {} });
  assert.equal(capped.frames, 4, 'a cap adds a fourth frame');
  assert.deepEqual([(capped.data as any).layers, (capped.data as any).cap], [['back', 'fill', 'frame', 'cap'], { width: 3 }]);
  const font = defineBitmapFont({ chars: '01+', cell: { w: 8, h: 12 }, baseline: 10, draw: (_c, ch) => (ch === '1' ? 4 : 7) });
  assert.equal(font.frames, 3);
  assert.equal((font.data as any).font.chars, '01+', 'the atlas carries the font (advances are measured while the glyphs are drawn)');
  assert.equal((defineUiImage({ kind: 'cursor', width: 16, height: 16, pivot: { x: 1, y: 1 }, draw: () => {} }).data as any).kind, 'cursor');
  assert.throws(() => defineBitmapFont({ chars: '00', cell: { w: 4, h: 4 }, baseline: 3, draw: () => 4 }), /twice/);
  void ctx;
  console.log('✔ Interface assets (nine-slice, bars, bitmap fonts) passed.');
}

console.log('\n🎉 ALL CORE TESTS PASSED SUCCESSFULLY!\n');
