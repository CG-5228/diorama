/**
 * Malvek Corvoluz, the Soul Shepherd.
 *
 * A tall, gaunt necromancer who herds lost souls. His head is a bare skull wreathed
 * in soul fire, the same fire he holds in his left palm. He wears a long split coat
 * with a bone ribcage breastplate and skull pauldrons, and carries a scythe with a
 * caged soul lantern. Light comes from the soul fire (head, palm and lantern).
 *
 * Corner radii on rects are in pixels (>= 1).
 *
 * Shared by the static portrait and the animations: `drawNecromancer(ctx, t)` draws
 * the pose at loop time `t` in [0, 1). Every motion is a whole number of cycles per
 * loop, so frame 0 follows the last frame without a jump. The two assets are at the end
 * of this file (`portrait` and `idle`); their sheets are `sheets/characters/necromancer/`.
 */

import { createRng, defineAsset } from '@core';
import {
  Path,
  Polygon,
  Shape,
  Hatch,
  Grit,
  Stipple,
  alpha,
  lerpColor,
  scatterAlong,
  type Point,
} from '@core/draw';
import { PALETTES, RAMPS, STROKES, GLOWS, SHAPE_STYLES } from '../../theme';

const GROUND_Y = 214;
const BODY_X = 71;
const TAU = Math.PI * 2;

/** Logical size of one frame. */
export const NECROMANCER_SIZE = { width: 160, height: 224 };

function rotateAround(p: Point, pivot: Point, degrees: number): Point {
  const a = (degrees * Math.PI) / 180;
  const dx = p.x - pivot.x;
  const dy = p.y - pivot.y;
  return { x: pivot.x + dx * Math.cos(a) - dy * Math.sin(a), y: pivot.y + dx * Math.sin(a) + dy * Math.cos(a) };
}

/** Teardrop flame: round belly at (cx, cy), tip `2.6 * r` above it, leaning by `lean`. */
function flame(cx: number, cy: number, r: number, lean = 0): Shape {
  const tip = { x: cx + lean, y: cy - r * 2.6 };
  return Path.builder(tip)
    .bezierTo({ x: cx + lean * 0.4 + r * 0.25, y: cy - r * 1.5 }, { x: cx + r * 1.05, y: cy - r * 0.8 }, { x: cx + r, y: cy })
    .arcTo({ x: cx, y: cy }, r, 0, 180)
    .bezierTo({ x: cx - r * 1.05, y: cy - r * 0.8 }, { x: cx + lean * 0.4 - r * 0.6, y: cy - r * 1.6 }, tip)
    .close();
}

/** A lost soul: a flame with a lit core and two hollow eyes. `glow` scales the halo. */
function drawSoul(ctx: CanvasRenderingContext2D, cx: number, cy: number, r: number, lean = 0, glow = 1) {
  const body = flame(cx, cy, r, lean);
  body.draw(ctx, SHAPE_STYLES.soul.with({
    shadow: { ...GLOWS.soul, blur: GLOWS.soul.blur * glow },
    inside: (c) => {
      flame(cx + lean * 0.1, cy + r * 0.15, r * 0.55, lean * 0.5).fill(c, RAMPS.soul.lit);
    },
  }));
  const eye = Math.max(0.55, r * 0.17);
  Polygon.ellipse(eye, eye * 1.4, { cx: cx - r * 0.35, cy: cy - r * 0.1 }).fill(ctx, RAMPS.soul.dark);
  Polygon.ellipse(eye, eye * 1.4, { cx: cx + r * 0.35, cy: cy - r * 0.1 }).fill(ctx, RAMPS.soul.dark);
}

/**
 * Crown of soul fire around a point: tongues rising from an arc, leaning back (left),
 * fused into one continuous contour. `k` scales the whole crown (inner layers use k < 1).
 * At loop time `t` each tongue grows, shrinks and sways on its own phase.
 */
function fireCrown(center: Point, k: number, seed: string, t: number): Shape {
  const rng = createRng(seed);
  const tongues: Shape[] = [Polygon.ellipse(12 * k, 13 * k, { cx: center.x, cy: center.y + 1.5 * k })];
  const count = 9;
  for (let i = 0; i < count; i++) {
    // From the left cheek, over the crown, down to the right cheek.
    const theta = 162 + (i / (count - 1)) * 216;
    const rad = (theta * Math.PI) / 180;
    const base = { x: center.x + Math.cos(rad) * 9 * k, y: center.y + Math.sin(rad) * 9 * k };
    const middle = 1 - Math.abs(i - (count - 1) / 2) / ((count - 1) / 2);
    const phase = rng.float(0, TAU);
    const flicker = Math.sin(TAU * 2 * t + phase) * 0.5 + Math.sin(TAU * 3 * t + phase * 1.7) * 0.35;
    const r = (3.4 + middle * 5.2 + rng.float(-0.6, 0.6) + flicker * (0.6 + middle * 0.6)) * k;
    const lean = (Math.cos(rad) * 4 - 3.5 + rng.float(-1.5, 1.5) + Math.sin(TAU * t + phase) * 1.6) * k;
    tongues.push(flame(base.x, base.y, r, lean));
  }
  return tongues[0].union(tongues.slice(1)).displace({ amplitude: 0.8 * k, frequency: 0.12, seed: 5 });
}

/** Skull face: cranium with sockets and nose cut out, and a separate jaw. */
function skull(cx: number, cy: number, s: number) {
  const sockets = [
    { x: cx - 4 * s, y: cy + 2 * s },
    { x: cx + 4.4 * s, y: cy + 2 * s },
  ];
  const cranium = Polygon.ellipse(10 * s, 10.5 * s, { cx, cy })
    .union(Polygon.rect(15 * s, 7 * s, { cx: cx + 0.2 * s, cy: cy + 8 * s, radius: 2.5 * s }))
    .subtract([
      Polygon.ellipse(3.5 * s, 3 * s, { cx: sockets[0].x, cy: sockets[0].y }).rotate(14),
      Polygon.ellipse(3.5 * s, 3 * s, { cx: sockets[1].x, cy: sockets[1].y }).rotate(-14),
      Polygon.triangle(2.6 * s, 3.4 * s, { cx: cx + 0.2 * s, cy: cy + 7.2 * s }),
    ]);
  const jaw = Polygon.rect(12 * s, 5 * s, { cx: cx + 0.2 * s, cy: cy + 13.6 * s, radius: 2 * s });
  return { cranium, jaw, sockets };
}

/** A small bone: a shaft with knobbed ends. */
function bone(from: Point, to: Point, w: number): Shape {
  return Path.line(from, to).toShape({ width: w, cap: 'round' })
    .union([
      Polygon.circle(w * 0.75, { cx: from.x - w * 0.35, cy: from.y }),
      Polygon.circle(w * 0.75, { cx: from.x + w * 0.35, cy: from.y }),
      Polygon.circle(w * 0.75, { cx: to.x - w * 0.35, cy: to.y }),
      Polygon.circle(w * 0.75, { cx: to.x + w * 0.35, cy: to.y }),
    ]);
}

/** Bottom edge of cloth, torn by notches cut out with booleans. */
function tatter(shape: Shape, fromX: number, toX: number, hemY: number, seed: string): Shape {
  const rng = createRng(seed);
  const notches: Shape[] = [];
  for (let x = fromX; x < toX; x += rng.float(5, 8)) {
    notches.push(
      Polygon.triangle(rng.float(3.5, 6), rng.float(5, 12))
        .rotate(rng.float(-14, 14))
        .moveTo({ x, y: hemY + 1 }, 'bottom'),
    );
  }
  return shape.subtract(notches).roundCorners(0.8);
}

/** Draws the necromancer at loop time `t` in [0, 1). `t = 0` is the rest pose. */
export function drawNecromancer(ctx: CanvasRenderingContext2D, t = 0) {
  const wave = (cycles: number, offset = 0) => Math.sin(TAU * cycles * t + offset);
  const HEAD = { x: BODY_X, y: 50 + wave(1, 1) * 0.6 };
  const rng = createRng('malvek-corvoluz');
  const detailInk = (opacity: number) => STROKES.detail.with({ color: alpha(PALETTES.ink, opacity) });

  // ---------------------------------------------------------------- geometry

  const groundShadow = Polygon.ellipse(46, 5, { cx: BODY_X + 8, cy: GROUND_Y });
  const mist = Polygon.lobes([
    { cx: 40, cy: 212, rx: 16, ry: 4.5 },
    { cx: 64, cy: 210, rx: 20, ry: 5.5 },
    { cx: 92, cy: 212, rx: 18, ry: 4.5 },
    { cx: 116, cy: 213, rx: 12, ry: 3.5 },
  ]);

  // Coat: a back panel between the legs, and two front tails split at the waist.
  const backTail = tatter(
    Path.builder({ x: 60, y: 118 })
      .bezierTo({ x: 54, y: 150 }, { x: 46, y: 184 }, { x: 40, y: 208 })
      .curveTo({ x: 104, y: 208 }, -3)
      .bezierTo({ x: 96, y: 184 }, { x: 88, y: 150 }, { x: 82, y: 118 })
      .close(2),
    42, 102, 208, 'back-hem',
  );
  const leftTail = tatter(
    Path.builder({ x: 61, y: 120 })
      .bezierTo({ x: 54, y: 150 }, { x: 48, y: 180 }, { x: 43, y: 204 })
      .lineTo({ x: 60, y: 206 })
      .bezierTo({ x: 62, y: 180 }, { x: 66, y: 150 }, { x: 69, y: 124 })
      .close(1.5),
    44, 60, 205, 'left-hem',
  );
  const rightTail = tatter(
    Path.builder({ x: 81, y: 120 })
      .bezierTo({ x: 88, y: 150 }, { x: 94, y: 180 }, { x: 100, y: 204 })
      .lineTo({ x: 83, y: 206 })
      .bezierTo({ x: 81, y: 180 }, { x: 77, y: 150 }, { x: 74, y: 124 })
      .close(1.5),
    83, 99, 205, 'right-hem',
  );

  // Long legs, bone greaves and boots.
  const leftLeg = Path.spline([{ x: 65, y: 122 }, { x: 64, y: 160 }, { x: 63, y: 204 }])
    .toShape({ width: (t) => 9 - t * 3, cap: 'round' });
  const rightLeg = Path.spline([{ x: 77, y: 122 }, { x: 79, y: 160 }, { x: 80, y: 204 }])
    .toShape({ width: (t) => 9 - t * 3, cap: 'round' });
  const leftGreave = Polygon.rect(7.5, 20, { cx: 63.4, cy: 190, radius: 3 }).taper({ axis: 'y', from: 1.1, to: 0.8 });
  const rightGreave = Polygon.rect(7.5, 20, { cx: 79.8, cy: 190, radius: 3 }).taper({ axis: 'y', from: 1.1, to: 0.8 });
  const leftBoot = Path.builder({ x: 59, y: 202 })
    .lineTo({ x: 67, y: 202 })
    .lineTo({ x: 67, y: 212 })
    .lineTo({ x: 54, y: 212 })
    .curveTo({ x: 59, y: 202 }, -2)
    .close(2);
  const rightBoot = leftBoot.flip('x', BODY_X).translate(2, 0);

  // High collar flaps behind the jaw.
  const collarLeft = Path.builder({ x: 64, y: 78 })
    .bezierTo({ x: 58, y: 72 }, { x: 54, y: 66 }, { x: 52, y: 58 })
    .lineTo({ x: 58, y: 60 })
    .bezierTo({ x: 62, y: 66 }, { x: 66, y: 70 }, { x: 70, y: 76 })
    .close(1.5);
  const collarRight = collarLeft.flip('x', BODY_X);
  const neck = [0, 1, 2].map((k) => Polygon.rect(5 - k * 0.3, 3.2, { cx: BODY_X, cy: 68.5 + k * 3.6, radius: 1.2 }));

  // Fitted torso, narrow at the waist.
  const torso = Path.builder({ x: 53, y: 77 })
    .curveTo({ x: 89, y: 77 }, -3)
    .bezierTo({ x: 88, y: 92 }, { x: 82, y: 104 }, { x: 82, y: 122 })
    .lineTo({ x: 60, y: 122 })
    .bezierTo({ x: 60, y: 104 }, { x: 54, y: 92 }, { x: 53, y: 77 })
    .close(3);

  // Ribcage breastplate: sternum and four pairs of ribs.
  const sternum = Polygon.capsule(3.6, 24, { cx: BODY_X, cy: 94 });
  const ribs: Shape[] = [];
  for (let i = 0; i < 4; i++) {
    const y = 85 + i * 5.2;
    const reach = 12 - i * 1.3;
    for (const side of [-1, 1]) {
      ribs.push(
        Path.curve({ x: BODY_X, y }, { x: BODY_X + side * reach, y: y + 5 }, side * -2.4)
          .toShape({ width: (t) => 2.6 - t * 1.2, cap: 'round' }),
      );
    }
  }

  const belt = Polygon.rect(24, 6, { cx: BODY_X, cy: 121, radius: 1.5 });
  const sashTail = Path.builder({ x: 72, y: 123 })
    .bezierTo({ x: 75, y: 134 }, { x: 72, y: 146 }, { x: 76, y: 158 })
    .lineTo({ x: 80, y: 155 })
    .bezierTo({ x: 77, y: 144 }, { x: 80, y: 132 }, { x: 77, y: 122 })
    .close(1);
  const buckle = skull(BODY_X, 119.6, 0.32);

  // Bones hanging from the belt on cords, and the grimoire on a chain.
  const cords = [
    Path.curve({ x: 63, y: 123 }, { x: 60, y: 134 }, -1),
    Path.curve({ x: 65, y: 123 }, { x: 66, y: 137 }, 1),
  ];
  const hangingBones = [
    bone({ x: 57.5, y: 134 }, { x: 61, y: 146 }, 1.6),
    bone({ x: 66, y: 137 }, { x: 64.5, y: 147 }, 1.4),
  ];
  const book = Polygon.rect(10, 13, { cx: 52, cy: 140, radius: 1.2 }).rotate(-14);
  const bookEye = Polygon.ellipse(2.6, 1.6, { cx: 52.6, cy: 139.4 }).rotate(-14);
  const chainPath = Path.curve({ x: 60.5, y: 123 }, { x: 54, y: 133.5 }, 2);
  const chainLinks = scatterAlong(chainPath, Polygon.ellipse(1.1, 0.8), { count: 5, align: true });

  // Skull pauldrons: iron shells with a skull and two bone spikes each.
  const pauldrons = [{ x: 53, y: 79 }, { x: 89, y: 79 }].map((p, i) => {
    const side = i === 0 ? -1 : 1;
    const shell = Polygon.ellipse(9, 6.5, { cx: p.x + side * 1, cy: p.y }).rotate(side * 12);
    const face = skull(p.x + side * 1.5, p.y - 2.2, 0.42);
    const spikes = [0, 1].map((k) => {
      const base = { x: p.x + side * (2 + k * 4), y: p.y - 4 + k * 1.5 };
      return Polygon.stem(base, 7 - k * 1.5, { baseWidth: 2.8, topWidth: 0.6, sway: side * 1.5 })
        .rotate(side * (28 + k * 22), base);
    });
    return { shell, face, spikes };
  });

  // Arms. Left forearm is raised with the palm up; right hand grips the scythe.
  const leftSleeve = Path.spline([{ x: 53, y: 82 }, { x: 46, y: 104 }, { x: 36, y: 94 }])
    .toShape({ width: (t) => 9.5 - t * 2.5, cap: 'round' });
  const leftCuff = Polygon.triangle(13, 8)
    .roundCorners(1.2)
    .rotate(140)
    .moveTo({ x: 35.5, y: 93 });
  const rightSleeve = Path.spline([{ x: 89, y: 82 }, { x: 99, y: 104 }, { x: 112, y: 116 }])
    .toShape({ width: (t) => 9.5 - t * 2.5, cap: 'round' });
  const rightCuff = Polygon.triangle(12, 7)
    .roundCorners(1.2)
    .rotate(-130)
    .moveTo({ x: 112, y: 115.5 });

  const palm = Polygon.ellipse(6, 3.4, { cx: 31, cy: 90.5 }).rotate(-15);
  const fingers = [0, 1, 2, 3].map((k) => {
    const base = { x: 26 + k * 2.4, y: 90 - k * 0.7 };
    return Polygon.stem(base, 6.5 - k * 0.5, { baseWidth: 2.3, topWidth: 1.1, sway: 1.3 })
      .rotate(-24 + k * 8, base);
  });
  const thumbBase = { x: 35.5, y: 89.5 };
  const thumb = Polygon.stem(thumbBase, 5, { baseWidth: 2.6, topWidth: 1.2, sway: -1.1 }).rotate(38, thumbBase);
  const leftHand = palm.union([...fingers, thumb]).roundCorners(0.6);
  const rightHand = Polygon.capsule(8.5, 7.5, { cx: 118.6, cy: 117 }).rotate(-20);

  // Scythe: long snath, blade sweeping back over the head, lantern on a hook.
  const snathLine = Path.spline([{ x: 112, y: 212 }, { x: 116, y: 150 }, { x: 121, y: 80 }, { x: 127, y: 14 }]);
  const snath = snathLine.toShape({ width: (t) => 4.2 - t * 1.2, cap: 'round' });
  const blade = Path.builder({ x: 130, y: 12 })
    .bezierTo({ x: 114, y: 2 }, { x: 92, y: 4 }, { x: 78, y: 28 })
    .bezierTo({ x: 94, y: 16 }, { x: 110, y: 16 }, { x: 127, y: 24 })
    .close(1);
  const bladeEdge = Path.bezier({ x: 79, y: 27 }, { x: 94, y: 15.4 }, { x: 110, y: 15.4 }, { x: 126, y: 23 });
  const tang = Polygon.rect(7, 5, { cx: 127.4, cy: 17, radius: 1.2 }).rotate(6);
  const snathBands = [70, 140].map((y) => {
    const p = snathLine.pointAt(1 - (y - 14) / (212 - 14));
    return Polygon.rect(6, 2.4, { cx: p.x, cy: p.y, radius: 1 }).rotate(5);
  });

  const hookStart = { x: 126, y: 32 };
  const hookEnd = { x: 138, y: 30 };
  const hook = Path.curve(hookStart, hookEnd, 2).toShape({ width: 1.6, cap: 'round' });
  const lanternTop = { x: hookEnd.x, y: hookEnd.y + 7 };
  // The lantern swings from the hook; its soul stays upright and lags the swing.
  const sway = wave(1) * 7;
  const lanternLinks = scatterAlong(Path.line(hookEnd, lanternTop), Polygon.ellipse(0.9, 1.4), { count: 4 })
    .map((link) => link.rotate(sway, hookEnd));
  const lanternBody = Polygon.rect(11, 15, { cx: lanternTop.x, cy: lanternTop.y + 11, radius: 2 }).rotate(sway, hookEnd);
  const lanternCap = Polygon.triangle(13, 5, { cx: lanternTop.x, cy: lanternTop.y + 2.2 }).roundCorners(1).rotate(sway, hookEnd);
  const lanternBase = Polygon.rect(13, 3, { cx: lanternTop.x, cy: lanternTop.y + 19, radius: 1 }).rotate(sway, hookEnd);
  const lanternSoul = rotateAround({ x: lanternTop.x, y: lanternTop.y + 13 }, hookEnd, sway);

  // Head.
  const fireOuter = fireCrown(HEAD, 1.15, 'fire-outer', t);
  const fireMid = fireCrown({ x: HEAD.x - 0.6, y: HEAD.y + 2.5 }, 0.85, 'fire-mid', t);
  const fireCore = fireCrown({ x: HEAD.x - 1, y: HEAD.y + 4 }, 0.6, 'fire-core', t);
  const head = skull(HEAD.x, HEAD.y, 0.95);

  // ---------------------------------------------------------------- drawing

  groundShadow.fill(ctx, GLOWS.ground);
  mist.clone().translate(wave(1) * 1.5, 0).fill(ctx, alpha(PALETTES.soul, 0.22));

  backTail.draw(ctx, SHAPE_STYLES.robeShadow.with({
    texture: new Stipple({ count: 90, minRadius: 0.3, maxRadius: 0.6, color: alpha(PALETTES.ink, 0.5), gradient: 'top-to-bottom', seed: 11 }),
  }));

  for (const leg of [leftLeg, rightLeg]) {
    leg.draw(ctx, SHAPE_STYLES.robeShadow.with({
      inside: (c) => {
        new Hatch({ angle: 80, spacing: 2.6, color: alpha(PALETTES.ink, 0.4), width: 0.5, seed: 9 }).render(c, leg);
      },
    }));
  }
  for (const greave of [leftGreave, rightGreave]) {
    greave.draw(ctx, SHAPE_STYLES.bone.with({
      inside: (c) => {
        const b = greave.bounds;
        for (const t of [0.3, 0.7]) {
          Polygon.rect(b.width + 2, 1.6, { cx: b.center.x, cy: b.top + b.height * t }).fill(c, PALETTES.sashDark);
        }
      },
    }));
  }
  leftBoot.draw(ctx, SHAPE_STYLES.robeShadow);
  rightBoot.draw(ctx, SHAPE_STYLES.robeShadow);

  for (const tail of [leftTail, rightTail]) {
    tail.draw(ctx, SHAPE_STYLES.robe.with({
      inside: (c) => {
        const b = tail.bounds;
        Path.curve({ x: b.center.x, y: b.top + 20 }, { x: b.center.x + (b.center.x < BODY_X ? -4 : 4), y: b.bottom - 4 }, 2)
          .stroke(c, detailInk(0.5));
        new Hatch({ angle: 65, spacing: 3, color: alpha(PALETTES.ink, 0.3), width: 0.5, seed: 4 })
          .spot(c, { x: b.left + 4, y: b.bottom - 14 }, { rx: 10, ry: 18 });
      },
    }));
  }

  // Scythe and lantern, behind the head fire and the right hand.
  tang.draw(ctx, SHAPE_STYLES.iron);
  blade.draw(ctx, SHAPE_STYLES.iron.with({
    stroke: STROKES.outline,
    inside: (c) => {
      bladeEdge.stroke(c, STROKES.detail.with({ color: RAMPS.iron.lit, width: 2.2 }));
      bladeEdge.offset(-0.4).stroke(c, STROKES.detail.with({ color: PALETTES.white, width: 0.8 }));
      new Grit({ count: 16, scratches: 4, size: 0.6, color: alpha(PALETTES.ink, 0.5), seed: 21 }).render(c, blade);
    },
  }));
  snath.draw(ctx, SHAPE_STYLES.wood.with({
    inside: (c) => {
      new Hatch({ angle: 84, spacing: 2.4, color: alpha(PALETTES.ink, 0.35), width: 0.5, lengthVariation: 0.6, seed: 2 }).render(c, snath);
    },
  }));
  for (const band of snathBands) band.draw(ctx, SHAPE_STYLES.iron);
  hook.draw(ctx, SHAPE_STYLES.iron);
  for (const link of lanternLinks) link.draw(ctx, SHAPE_STYLES.iron.with({ stroke: STROKES.detail.with({ width: 0.7 }) }));
  lanternBody.draw(ctx, {
    fill: alpha(PALETTES.soulDark, 0.85),
    shadow: GLOWS.soul,
    inside: () => {
      drawSoul(ctx, lanternSoul.x, lanternSoul.y, 3.6 + wave(2, 0.5) * 0.25, 0.6 - wave(1, 0.8) * 1.2);
    },
  });
  for (let k = -1; k <= 1; k++) {
    Path.line({ x: lanternTop.x + k * 3, y: lanternTop.y + 3.5 }, { x: lanternTop.x + k * 3, y: lanternTop.y + 18 })
      .rotate(sway, hookEnd)
      .stroke(ctx, STROKES.detail.with({ color: PALETTES.ironDark, width: 1 }));
  }
  lanternBody.stroke(ctx, STROKES.detail.with({ width: 1.4 }));
  lanternCap.draw(ctx, SHAPE_STYLES.iron);
  lanternBase.draw(ctx, SHAPE_STYLES.iron);

  // Soul fire behind the skull: outer flame, then hotter layers.
  fireOuter.draw(ctx, SHAPE_STYLES.soul.with({ shadow: { ...GLOWS.soul, blur: 14 } }));
  fireMid.fill(ctx, lerpColor(PALETTES.soul, PALETTES.soulLit, 0.55));
  fireCore.fill(ctx, lerpColor(PALETTES.soulLit, PALETTES.white, 0.4));

  collarLeft.draw(ctx, SHAPE_STYLES.robe);
  collarRight.draw(ctx, SHAPE_STYLES.robe);
  for (const v of neck) v.draw(ctx, SHAPE_STYLES.bone);

  torso.draw(ctx, SHAPE_STYLES.robe.with({
    inside: (c) => {
      // Dark undershirt behind the breastplate.
      Polygon.rect(22, 40, { cx: BODY_X, cy: 98, radius: 6 }).fill(c, PALETTES.robeDark);
      for (const rib of ribs) rib.draw(c, SHAPE_STYLES.bone);
      sternum.draw(c, SHAPE_STYLES.bone);
      new Grit({ count: 20, scratches: 2, size: 0.6, color: alpha(PALETTES.boneDark, 0.9), seed: 3 }).render(c, sternum);
      Path.curve({ x: 86, y: 84 }, { x: 81, y: 116 }, 2).stroke(c, STROKES.detail.with({ color: alpha(PALETTES.robeLit, 0.8) }));
    },
  }));

  belt.draw(ctx, SHAPE_STYLES.sash);
  sashTail.draw(ctx, SHAPE_STYLES.sash);
  buckle.cranium.draw(ctx, SHAPE_STYLES.bone.with({ stroke: STROKES.detail.with({ width: 0.7 }) }));
  buckle.jaw.draw(ctx, SHAPE_STYLES.bone.with({ stroke: STROKES.detail.with({ width: 0.7 }) }));

  for (const cord of cords) cord.stroke(ctx, STROKES.detail.with({ color: PALETTES.sashDark, width: 0.9 }));
  for (const b of hangingBones) b.draw(ctx, SHAPE_STYLES.bone.with({ stroke: STROKES.detail.with({ width: 0.8 }) }));
  for (const link of chainLinks) link.draw(ctx, SHAPE_STYLES.iron.with({ stroke: STROKES.detail.with({ width: 0.6 }) }));
  book.draw(ctx, SHAPE_STYLES.sash.with({ stroke: STROKES.detail.with({ width: 1.4 }) }));
  bookEye.draw(ctx, SHAPE_STYLES.bone.with({ stroke: STROKES.detail.with({ width: 0.6 }) }));
  Polygon.circle(0.8, { cx: 52.6, cy: 139.4 }).draw(ctx, { fill: RAMPS.soul.base, shadow: GLOWS.soulFaint });

  // Right arm over the snath, hand gripping it.
  rightSleeve.draw(ctx, SHAPE_STYLES.robe);
  rightCuff.draw(ctx, SHAPE_STYLES.robe.with({ stroke: STROKES.detail }));
  rightHand.draw(ctx, SHAPE_STYLES.flesh.with({
    inside: (c) => {
      for (let k = 0; k < 3; k++) {
        Path.line({ x: 115.6 + k * 2.4, y: 113.5 + k * 0.6 }, { x: 116.8 + k * 2.4, y: 119.5 + k * 0.6 })
          .stroke(c, STROKES.detail.with({ color: RAMPS.flesh.dark, width: 0.7 }));
      }
    },
  }));

  // Left arm, raised with the palm up.
  leftSleeve.draw(ctx, SHAPE_STYLES.robe);
  leftCuff.draw(ctx, SHAPE_STYLES.robe.with({ stroke: STROKES.detail }));
  leftHand.draw(ctx, SHAPE_STYLES.flesh.with({
    inside: (c) => {
      Path.curve({ x: 25.5, y: 91 }, { x: 35, y: 88.5 }, 1).stroke(c, STROKES.detail.with({ color: RAMPS.flesh.dark, width: 0.7 }));
    },
  }));

  // Pauldrons over the sleeves.
  for (const p of pauldrons) {
    for (const spike of p.spikes) spike.draw(ctx, SHAPE_STYLES.bone);
    p.shell.draw(ctx, SHAPE_STYLES.iron.with({ stroke: STROKES.outline.with({ width: 1.6 }) }));
    p.face.cranium.draw(ctx, SHAPE_STYLES.bone.with({ stroke: STROKES.detail.with({ width: 0.8 }) }));
    p.face.jaw.draw(ctx, SHAPE_STYLES.bone.with({ stroke: STROKES.detail.with({ width: 0.8 }) }));
  }

  // The skull, lit green by its own fire.
  head.jaw.draw(ctx, SHAPE_STYLES.bone.with({
    shadow: GLOWS.soulFaint,
    inside: (c) => {
      for (let k = -2; k <= 2; k++) {
        Path.line({ x: HEAD.x + k * 2.1, y: HEAD.y + 11.4 }, { x: HEAD.x + k * 2.1, y: HEAD.y + 14 })
          .stroke(c, STROKES.detail.with({ color: RAMPS.bone.dark, width: 0.6 }));
      }
    },
  }));
  head.cranium.draw(ctx, SHAPE_STYLES.bone.with({
    shadow: GLOWS.soulFaint,
    stroke: STROKES.outline.with({ width: 1.6 }),
    inside: (c) => {
      const rim = head.cranium.createGradient(c, {
        type: 'linear',
        direction: 'vertical',
        stops: [[0, alpha(PALETTES.soul, 0.45)], [0.45, alpha(PALETTES.soul, 0)]],
      });
      head.cranium.fill(c, rim);
      for (let k = -3; k <= 3; k++) {
        Path.line({ x: HEAD.x + 0.2 + k * 1.9, y: HEAD.y + 9.6 }, { x: HEAD.x + 0.2 + k * 1.9, y: HEAD.y + 11.8 })
          .stroke(c, STROKES.detail.with({ color: RAMPS.bone.dark, width: 0.6 }));
      }
      Path.curve({ x: HEAD.x + 6, y: HEAD.y - 7 }, { x: HEAD.x + 8.5, y: HEAD.y + 1 }, -1)
        .stroke(c, detailInk(0.4));
      Path.line({ x: HEAD.x - 2, y: HEAD.y - 9 }, { x: HEAD.x + 1, y: HEAD.y - 4 }, { wobble: { amplitude: 0.6, seed: 2 } })
        .stroke(c, detailInk(0.45));
    },
  }));
  // Empty sockets with burning pupils.
  for (const s of head.sockets) {
    Polygon.ellipse(3.2, 2.7, { cx: s.x, cy: s.y }).fill(ctx, PALETTES.ink);
    Polygon.circle(1.15, { cx: s.x + 0.3, cy: s.y + 0.3 }).draw(ctx, { fill: RAMPS.soul.lit, shadow: GLOWS.soul });
  }
  // Front licks of fire over the crown of the skull.
  const licks: [number, number, number, number][] = [
    [HEAD.x - 7.5, HEAD.y - 4, 2.6, -3],
    [HEAD.x - 1, HEAD.y - 8.5, 2.4, -2],
    [HEAD.x + 6, HEAD.y - 6, 2, -0.5],
    [HEAD.x + 10, HEAD.y + 2, 1.6, 0.5],
  ];
  for (const [n, [x, y, r, lean]] of licks.entries()) {
    flame(x, y, r * (1 + wave(2, n * 1.9) * 0.18), lean + wave(1, n) * 0.8).draw(ctx, { fill: alpha(PALETTES.soul, 0.6), shadow: GLOWS.soulFaint });
  }

  // Soul flame in the palm, with a faint trail.
  // It pulses twice per loop and bobs once above the palm.
  const pulse = wave(2);
  const palmY = 78 + wave(1, 0.4) * 1;
  Path.wave({ x: 30, y: palmY + 8 }, { x: 28 + wave(1) * 1.5, y: palmY - 16 }, 1.5, 2 + pulse * 0.6).stroke(ctx, STROKES.soulTrail);
  drawSoul(ctx, 30, palmY, 5.5 * (1 + pulse * 0.09), -1.5 + wave(1, 1.2) * 1, 1 + pulse * 0.45);

  // Embers rising from the head fire.
  // Each ember rises 12 px over one loop, shrinking and fading, then starts again.
  for (let i = 0; i < 7; i++) {
    const start = { x: HEAD.x + rng.float(-18, 8), y: HEAD.y - rng.float(24, 30) };
    const life = (t + i / 7) % 1;
    const drift = Math.sin(TAU * life + i) * 2;
    const size = 1 - life * 0.7;
    Polygon.diamond(rng.float(1.2, 2) * size, rng.float(2, 3) * size, { cx: start.x + drift - life * 3, cy: start.y - life * 12 })
      .draw(ctx, { fill: alpha(PALETTES.soulLit, 1 - life * 0.9), shadow: GLOWS.soulFaint });
  }

  // Wandering souls.
  const wisps: [Point, number, number][] = [
    [{ x: 16, y: 120 }, 3, 1.2],
    [{ x: 146, y: 112 }, 2.8, -1],
    [{ x: 18, y: 172 }, 2.4, 0.8],
    [{ x: 136, y: 178 }, 2, -0.6],
  ];
  for (const [n, [rest, r, restLean]] of wisps.entries()) {
    const p = { x: rest.x + wave(1, n * 1.6 + 1) * 1.2, y: rest.y + wave(1, n * 1.6) * 2.5 };
    const lean = restLean + wave(1, n * 1.6 + 0.8) * 1;
    Path.curve({ x: p.x - lean * 2, y: p.y + r * 4 }, { x: p.x, y: p.y + r }, lean * 2)
      .stroke(ctx, STROKES.soulTrail.with({ width: r * 0.45, color: alpha(lerpColor(PALETTES.soul, PALETTES.soulDark, 0.3), 0.6) }));
    drawSoul(ctx, p.x, p.y, r, lean);
  }
}

/**
 * Malvek Corvoluz, the Soul Shepherd: static portrait (rest pose of the idle loop).
 */
export const portrait = defineAsset({
  ...NECROMANCER_SIZE,
  scale: 2,
  render({ ctx }) {
    drawNecromancer(ctx, 0);
  },
});

/**
 * Malvek Corvoluz, idle loop: head fire flickers, palm flame pulses, the lantern
 * swings and the lost souls float. One second at 10 fps.
 */
export const idle = defineAsset({
  ...NECROMANCER_SIZE,
  scale: 2,
  frames: 12,
  fps: 10,
  animations: { idle: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11] },
  render({ ctx, frameIndex = 0, frameCount = 12 }) {
    drawNecromancer(ctx, frameIndex / frameCount);
  },
});
