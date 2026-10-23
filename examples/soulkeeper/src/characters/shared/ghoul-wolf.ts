/**
 * Ghoul wolf skin: a lean undead wolf with slate fur over a pale chest and muzzle, a ragged mane,
 * bare vertebrae along the back, a torn left flank showing its ribs, and soul-fire eyes. Draws
 * any pose of the `quadruped()` skeleton.
 *
 * Channels read from `pose.extra`: `jaw` (0 closed, 1 a full gape of `GAPE` degrees, up to 1.4), `ears` (1 = flat),
 * `tilt` (degrees the muzzle is raised above the neck line: the howl), `hurt` (0..1: a hit flares
 * the eyes, cracks the jaw and flattens the ears), `flare` (eyes only: the howl) and `dim` (0..1:
 * the eyes burn down to embers in death). A skill with a `release` event draws soul-fire sound
 * rings from the muzzle after it. Trunk parts are built along the trunk's own axis, not world up,
 * so they follow a pitched or fallen body (hit, death, howl).
 *
 * Detail tiers: primary = mane and ears, vertebrae, tail (silhouette); secondary = pale chest
 * and muzzle, haunches, torn flank, dark maw; tertiary = fangs, inner ears, ribs, eye glow,
 * throat glow, sound rings.
 */

import { Path, Polygon, alpha, type Point } from '@core/draw';
import { partFrame, ringsAlong, type Pose, type Skin } from '@core/rig';
import { Blob, Decal, Frame3, Round, Solid, Tube, add3, dot3, lerp3, mix3, norm3, scale3, sub3, vec3, type Vec3 } from '@core/volume';
import { GLOWS, PALETTES, RAMPS, STROKES, VOLUMES } from '../../theme';

/** Fur thickness of each leg along its chain (0 = hip, 1 = paw). */
const HIND = (t: number) => (t < 0.35 ? 5.4 - 6 * t : t < 0.75 ? 3.4 - 2.4 * (t - 0.35) : 2.4 - 0.6 * (t - 0.75));
const FORE = (t: number) => (t < 0.4 ? 4 - 2.8 * t : 2.9 - 1.3 * t);

/**
 * Fur tuft: a short tapered spike from `root` along `dir`, bending towards `bend`. Tufts are
 * sorted behind the body (`bias`), so only their tips break the outline: a ragged silhouette
 * without dozens of inner lines.
 */
function tuft(root: Vec3, dir: Vec3, length: number, width: number, bend: Vec3): Tube {
  const mid = add3(root, add3(scale3(dir, length * 0.55), scale3(bend, length * 0.12)));
  return new Tube([root, mid, add3(root, add3(scale3(dir, length), scale3(bend, length * 0.35)))], { start: width, end: 0.25 });
}
const BEHIND = { bias: -40 };

/**
 * Degrees the lower jaw drops per unit of `extra.jaw`: 1 is a full gape (the bite's strike and
 * extreme, the howl's note is about 0.75). Wide on purpose: at sprite size the head is 15 logical
 * px long, and a bite only reads when the gap between the jaws is a dark wedge, not a slit.
 */
const GAPE = 62;

/** Fangs and teeth: paler than the bone of the vertebrae, so they catch the light against the dark mouth. */
const FANG = { ...VOLUMES.boneLimb, ramp: { lit: PALETTES.white, base: PALETTES.boneLit, dark: PALETTES.bone } };

/** Tip of the muzzle in the head frame (forward, side, up): the skin's nose and the `mouth` socket. */
const MUZZLE_TIP = [12, 0, -1.6] as const;

/**
 * The head's frame: it follows the neck line with a slight forward bias, then `extra.tilt`
 * degrees raise the muzzle (a howl). The skin and the `mouth` socket both use it, so they agree.
 */
export function wolfHead(pose: Pose): Frame3 {
  const j = pose.joints;
  const base = partFrame(j.head, norm3(add3(sub3(j.head, j.neck), scale3(pose.frame.forward, 3))));
  const tilt = ((pose.extra.tilt ?? 0) * Math.PI) / 180;
  return tilt ? partFrame(j.head, norm3(mix3([base.forward, Math.cos(tilt)], [base.up, Math.sin(tilt)]))) : base;
}

/** The `mouth` socket: the tip of the muzzle, where a howl or a spit leaves. */
export const wolfMouth = (pose: Pose): Vec3 => {
  const head = wolfHead(pose);
  return head.at(...MUZZLE_TIP);
};

/** Convex hull of screen points (monotone chain), for the dark inside of an open mouth. */
function hull(points: Point[]): Point[] {
  const p = points.slice().sort((a, b) => a.x - b.x || a.y - b.y);
  const cross = (o: Point, a: Point, b: Point) => (a.x - o.x) * (b.y - o.y) - (a.y - o.y) * (b.x - o.x);
  const half = (list: Point[]) => {
    const out: Point[] = [];
    for (const q of list) {
      while (out.length >= 2 && cross(out[out.length - 2], out[out.length - 1], q) <= 0) out.pop();
      out.push(q);
    }
    out.pop();
    return out;
  };
  return [...half(p), ...half(p.slice().reverse())];
}

export const ghoulWolf: Skin = (o, pose, kit) => {
  const j = pose.joints;
  const f = pose.frame;
  const hurt = pose.extra.hurt ?? 0;
  const flare = Math.max(hurt, pose.extra.flare ?? 0);
  // A hit cracks the jaw and flattens the ears; the clip's own jaw and ears win when they are wider.
  const jaw = Math.min(1.4, Math.max(pose.extra.jaw ?? 0, hurt * 0.4));
  const ears = Math.max(pose.extra.ears ?? 0, hurt * 0.75);
  const back = norm3(sub3(j.chest, j.pelvis));
  // The trunk's own frame: forward along pelvis -> chest, up across the back. Parts of the trunk
  // are built in it (not in world up) so they stay on the body when it pitches or lies down.
  const T = partFrame(j.waist, back, f.up);

  // ── Legs: haunch or shoulder mass, tapered leg, paw.
  for (const leg of kit.skeleton.legs) {
    const front = leg.knee === 'back';
    const c = pose.chains[leg.name];
    const paw = j[`${leg.name}.foot`];
    const mass = front
      ? Round.ellipsoid(partFrame(lerp3(c[0], c[1], 0.3), sub3(c[1], c[0]), f.forward), 3.6, 2.6, 3.4)
      : Round.ellipsoid(partFrame(lerp3(c[0], c[1], 0.38), sub3(c[1], c[0]), f.forward), 5.2, 3.3, 4.6);
    o.add(new Blob([new Tube(c, front ? FORE : HIND), mass, Round.ellipsoid(partFrame(add3(paw, f.dir(0.8, 0, 0.9)), f.forward), 2.2, 1.7, 1.3)]), VOLUMES.furLimb);
  }

  // ── Body from overlapping convex masses: rump, slim belly, deep ribcage and neck.
  const body = new Blob([
    Round.ellipsoid(partFrame(add3(j.pelvis, T.dir(0.5, 0, -0.5)), back, T.up), 7, 6.2, 6.2),
    Round.loft(ringsAlong([lerp3(j.pelvis, j.waist, 0.4), j.waist, lerp3(j.waist, j.chest, 0.5)], [[4.6, 4.8], [4, 4.1], [4.8, 5.4]], T.up)),
    Round.ellipsoid(partFrame(add3(j.chest, T.dir(-1.5, 0, -1.8)), back, T.up), 9, 7.6, 8.4),
    Round.loft(ringsAlong([add3(j.chest, T.dir(2, 0, 1)), j.neck, lerp3(j.neck, j.head, 0.6)], [[5.2, 6], [4.2, 5], [3.4, 4]], T.up)),
  ]);
  o.add(body, VOLUMES.fur);
  // Pale chest bib, sorted by depth so it hides when the wolf turns away.
  o.add(Round.ellipsoid(partFrame(add3(j.chest, T.dir(4.2, 0, -3.6)), mix3([T.forward, 0.4], [T.up, -1]), T.up), 4.6, 4.4, 3.4), VOLUMES.furPale, { bias: 1 });

  // Ragged mane: clumps sweeping back from the neck over the shoulders, sorted by depth (the near
  // ones lie over the body, the far ones behind it), and a ridge over the back behind the body.
  // The ruff is a ring around the neck, so its plane follows the neck as it rises (a howl).
  const [restChest, restNeck] = [kit.skeleton.trunk.find(t => t.name === 'chest')!.at, kit.skeleton.trunk.find(t => t.name === 'neck')!.at];
  const neckVec = sub3(j.neck, j.chest);
  const rise = Math.atan2(dot3(neckVec, T.up), dot3(neckVec, T.forward)) - Math.atan2(restNeck[2] - restChest[2], restNeck[0] - restChest[0]);
  const maneUp = norm3(mix3([T.up, Math.cos(rise)], [T.forward, -Math.sin(rise)]));
  for (let i = 0; i < 9; i++) {
    const a = -Math.PI * 0.05 + (i / 8) * Math.PI * 1.1;
    const radial = norm3(mix3([T.right, Math.cos(a)], [maneUp, Math.sin(a)]));
    const root = add3(lerp3(j.chest, j.neck, 0.45 + 0.3 * (i % 2)), scale3(radial, 4.6));
    o.add(tuft(root, norm3(mix3([radial, 0.32], [back, -1])), 5.4 + (i % 3) * 1.1, 3.4, radial), VOLUMES.mane);
  }
  for (let i = 0; i < 4; i++) {
    const p = lerp3(j.chest, j.waist, 0.2 + i * 0.22);
    o.add(tuft(add3(p, T.dir(0, (i % 2 ? 1 : -1) * 1.2, 6)), norm3(mix3([T.up, 1], [back, -0.8])), 3.6 - i * 0.4, 2, scale3(back, -0.5)), VOLUMES.fur, BEHIND);
  }

  // Bare vertebrae along the back: bone spikes leaning backwards, biggest over the shoulders.
  for (let i = 0; i < 5; i++) {
    const p = lerp3(j.pelvis, j.chest, 0.08 + i * 0.2);
    const h = 5.2 + 1.6 * Math.sin((i / 4) * Math.PI);
    const root = add3(p, T.dir(0, 0, h));
    const size = 1 + 0.5 * Math.sin(((i + 0.5) / 5) * Math.PI);
    o.add(new Tube([root, add3(root, mix3([T.up, 3 * size], [back, -2 * size]))], { start: 2 * size, end: 0.3 }), VOLUMES.boneLimb, { on: body });
  }

  // Torn left flank: a hollow showing three ribs (sorted by depth with the body's side).
  const flank = partFrame(add3(j.chest, T.dir(-5, 0, -1.6)), back, T.up);
  const tear = Polygon.fromPoints([
    { x: -5.6, y: -1.8 }, { x: -3.2, y: -3.8 }, { x: -0.8, y: -2.8 }, { x: 1.6, y: -4 }, { x: 5, y: -2.2 },
    { x: 5.4, y: 1.2 }, { x: 2.8, y: 3.4 }, { x: 0, y: 2.4 }, { x: -2.8, y: 3.6 }, { x: -5.4, y: 1.4 },
  ]);
  const hole = Decal.onFace(flank, 'left', vec3(0, -7, 0), tear.clone().scale(0.85));
  o.add(hole, { fill: PALETTES.hollow }, { on: body });
  // Ribs curve down and back across the hole: thick bone arcs with a lit top edge.
  for (const x of [-3, 0.2, 3.4]) {
    const rib = Path.spline([{ x: x - 1.2, y: -3.2 }, { x: x + 0.4, y: -0.2 }, { x: x - 0.4, y: 3 }]).toShape({ width: 1.5, cap: 'round', clean: false });
    o.add(Decal.onFace(flank, 'left', vec3(0, -7.05, 0), rib.clone().scale(0.85, 0.85, { x: 0, y: 0 })), { fill: PALETTES.bone, stroke: { width: 0.5, color: PALETTES.boneDark } }, { on: hole });
  }

  // Tail: bushy in the middle, thin at the tip, with a tufted end.
  const tail = pose.chains.tail;
  o.add(new Tube(tail, t => 2.4 + 2.6 * Math.sin(Math.PI * Math.min(1, t * 1.2)) - 1.6 * t), VOLUMES.furLimb);
  const tip = tail[tail.length - 1];
  const tailDir = norm3(sub3(tip, tail[tail.length - 3]));
  for (const s of [-1, 1]) o.add(tuft(tail[tail.length - 3], norm3(mix3([tailDir, 1], [f.right, s * 0.5])), 5, 1.8, f.up), VOLUMES.furLimb, BEHIND);

  // ── Head: skull and muzzle, pale lower jaw that opens with the bite, fangs, nose.
  const head = wolfHead(pose);
  const muzzle = [head.at(3.5, 0, -0.8), head.at(7.5, 0, -1.3), head.at(11, 0, -1.9)];
  const skull = new Blob([Round.ellipsoid(head, 5.6, 4.8, 4.6), Round.loft(ringsAlong(muzzle, [[3, 2.8], [2.3, 2.2], [1.6, 1.5]], head.up))]);
  o.add(skull, VOLUMES.fur);
  // Cheek tufts sweep back from the sides of the head.
  for (const s of [-1, 1]) o.add(tuft(head.at(0.5, s * 3.8, -1.6), norm3(mix3([head.right, s], [head.forward, -1.1], [head.up, -0.3])), 4.2, 2, head.up), VOLUMES.fur, BEHIND);
  const open = (jaw * GAPE * Math.PI) / 180;
  const jawDir = norm3(mix3([head.forward, Math.cos(open)], [head.up, -Math.sin(open)]));
  const jawUp = mix3([head.up, Math.cos(open)], [head.forward, Math.sin(open)]);
  const hinge = head.at(2.8, 0, -2.9);
  const jawPts = [hinge, add3(hinge, scale3(jawDir, 4.2)), add3(hinge, scale3(jawDir, 7.8))];
  // The dark inside of an open mouth: the hull of the two jaw edges, drawn under skull and jaw so
  // only the gap between them shows from the side, and an oval from the front.
  if (jaw > 0.08) {
    const corners = [
      ...[-1, 1].map(s => add3(hinge, scale3(head.right, s * 1.8))),
      ...[-1, 1].map(s => head.at(10.4, s * 1.1, -3.2)),
      ...[-1, 1].map(s => add3(add3(hinge, scale3(jawDir, 7.6)), add3(scale3(head.right, s * 0.9), scale3(jawUp, 0.7)))),
    ];
    // A soul-fire glow deep in the throat (the hull shrunk towards the hinge, with a hotter core)
    // makes the opening read at sprite size: a dark wedge with fire at the back, between pale fangs.
    const throat = corners.map(p => lerp3(hinge, p, 0.66));
    const core = corners.map(p => lerp3(hinge, p, 0.36));
    const glowAmount = Math.min(1, jaw * 1.3);
    o.custom(head.at(6, 0, -3), (ctx, cam) => {
      Polygon.fromPoints(hull(corners.map(p => cam.project(p)))).fill(ctx, RAMPS.hollow.dark);
      Polygon.fromPoints(hull(throat.map(p => cam.project(p)))).fill(ctx, alpha(RAMPS.soul.dark, 0.9 * glowAmount));
      Polygon.fromPoints(hull(core.map(p => cam.project(p)))).fill(ctx, alpha(RAMPS.soul.base, 0.75 * glowAmount));
    }, { bias: -2 });
  }
  o.add(Round.loft(ringsAlong(jawPts, [[2.6, 1.7], [2.1, 1.35], [1.4, 1.05]], head.up)), VOLUMES.furPale);
  // Fangs: the upper canines always show and lengthen as the mouth opens; the lower canines come in
  // with the gape (scaled by `bared`, so they do not pop). Two big pairs, no row of small teeth:
  // at this size more teeth turn the dark wedge of the mouth into noise.
  const bared = Math.max(0, Math.min(1, (jaw - 0.15) / 0.6));
  for (const s of [-1, 1]) {
    const root = head.at(9.8, s * 1.2, -2.6);
    o.add(new Tube([root, add3(root, mix3([head.up, -(1.5 + 1.9 * jaw)], [head.forward, 0.3]))], { start: 1.25, end: 0.2 }), FANG, { bias: 0.5 });
    if (bared > 0) {
      const low = add3(hinge, add3(scale3(jawDir, 6.9), scale3(head.right, s * 1)));
      o.add(new Tube([low, add3(low, scale3(jawUp, 2.3 * bared))], { start: 1.1, end: 0.2 }), FANG, { bias: 0.5 });
    }
  }
  o.add(Round.ellipsoid(partFrame(head.at(11.3, 0, -1.5), head.forward), 1, 1.1, 0.9), VOLUMES.hollow, { on: skull });

  // Ears: flat triangles standing on the skull with a dark inside, folding back when the wolf
  // attacks, howls or is hit. @core/draw shapes are y-down, so the triangle is flipped to point up.
  const earShape = Polygon.triangle(4.4, 7).flip('y', 0).translate(0, 7 / 3);
  const innerShape = Polygon.triangle(2.4, 4.4).flip('y', 0).translate(0, 4.4 / 3 + 0.4);
  for (const s of [-1, 1]) {
    const base = head.at(-1.8, s * 2.7, 3.3);
    const fold = (ears * 55 * Math.PI) / 180;
    const up = norm3(mix3([head.up, Math.cos(fold)], [head.forward, -Math.sin(fold)]));
    const thick = norm3(mix3([head.forward, Math.cos(fold)], [head.up, Math.sin(fold)]));
    const earFrame = new Frame3(base, head.right, up, thick);
    const ear = Solid.extrude(earFrame, earShape, 1);
    o.add(ear, VOLUMES.fur);
    o.add(new Decal(earFrame.at(0, 0, 1.02), head.right, scale3(up, -1), innerShape.clone().flip('y', 0), thick), { fill: PALETTES.hollow }, { on: ear });
  }

  // Soul-fire eyes on both sides of the face (only the ones facing the camera draw).
  // A saturated iris with a pale hot core: the focal accent of the creature. Hits and howls flare
  // them (larger, a wider glow, and on a hit the hot core swells); in death they sink to embers.
  const dying = Math.max(0, Math.min(1, pose.extra.dim ?? 0));
  const raised = (pose.extra.tilt ?? 0) > 8;
  const eye = (1 + 0.45 * flare) * (1 - 0.3 * dying);
  const glow = { ...GLOWS.soul, blur: GLOWS.soul.blur * (1 + 0.9 * flare) * (1 - 0.6 * dying) };
  for (const s of [-1, 1]) {
    const side = s > 0 ? 'right' : 'left';
    for (const [face, at, k] of [[side, vec3(2.8, s * 3.9, 1.1), 1.3], ['front', vec3(4.9, s * 2, 1.2), 1.1]] as const) {
      // The face-plane eyes are seen from the front: with a raised muzzle the camera looks down on the
      // forehead, so only draw them while that patch of skull really turns towards the camera.
      // With the muzzle raised (a howl) the lateral eye alone shows on the near side.
      if (face === 'front' && dot3(head.dir(0.77, s * 0.43, 0.28), kit.camera.viewDir) < (raised ? 0.6 : 0.35)) continue;
      if (face === 'front' && raised && kit.camera.faces(head.dir(0, s, 0))) continue;
      const iris = Decal.onFace(head, face, at, Polygon.ellipse(1.2 * k * eye, 0.85 * k * eye));
      o.add(iris, { fill: RAMPS.soul.base, shadow: glow }, { on: skull });
      o.add(Decal.onFace(head, face, add3(at, vec3(0.02, 0, 0.1)), Polygon.ellipse((0.5 + 0.3 * hurt) * k * eye, (0.4 + 0.25 * hurt) * k * eye)), { fill: RAMPS.soul.lit }, { on: iris });
    }
  }

  // The howl's sound: soul-fire rings leave the muzzle after the `release` event, broken arcs in
  // the plane across the head's direction, widening and fading as they climb away. Every arc is
  // sorted by its own depth, so the far side of a ring passes behind the head and the near side in front.
  const release = kit.clip.kind === 'skill' ? kit.clip.events.find(e => e.name === 'release') : undefined;
  if (release && kit.t >= release.t) {
    const s = (kit.t - release.t) / (1 - release.t);
    // The rings fly from where and along where the head pointed at the release, not with the head as it lowers.
    const fired = wolfHead(kit.poseAt(release.t));
    const tip = fired.at(...MUZZLE_TIP);
    for (let i = 0; i < 3; i++) {
      const age = 0.1 + s * 1.4 - i * 0.3;
      if (age <= 0 || age >= 1) continue;
      const centre = add3(add3(tip, scale3(fired.forward, 2 + 5 * age)), scale3(f.up, 2 * age));
      const radius = 2 + 10 * age;
      const fade = Math.min(1, age * 7) * Math.pow(1 - age, 0.9);
      const width = 2.1 * (1 - 0.45 * age);
      const onRing = (a: number) => add3(centre, add3(scale3(fired.right, Math.cos(a) * radius), scale3(fired.up, Math.sin(a) * radius)));
      for (let arc = 0; arc < 3; arc++) {
        const start = (arc / 3) * Math.PI * 2 + i * 0.9;
        const span = Math.PI * 0.62;
        o.custom(onRing(start + span / 2), (ctx, cam) => {
          const pts = Array.from({ length: 9 }, (_, n) => cam.project(onRing(start + (n / 8) * span)));
          ctx.save();
          ctx.shadowColor = GLOWS.soulFaint.color;
          ctx.shadowBlur = GLOWS.soulFaint.blur;
          Path.polyline(pts).stroke(ctx, STROKES.soulTrail.with({ width, color: alpha(RAMPS.soul.base, 0.95 * fade) }));
          Path.polyline(pts).stroke(ctx, STROKES.soulTrail.with({ width: width * 0.4, color: alpha(RAMPS.soul.lit, 0.9 * fade) }));
          ctx.restore();
        });
      }
    }
  }
};
