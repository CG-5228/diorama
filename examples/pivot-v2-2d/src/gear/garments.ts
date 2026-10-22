/**
 * Garments: belt and buckle, pouch, and the limb wear: greave, bracer, leg wraps; and what a long
 * coat adds: sleeves, a sash tail, a skull buckle, a grimoire on a chain and bone charms.
 *
 * Belts, pouches and wraps are bands and small masses that follow the trunk or the limb. Bands go
 * through `visibleArc`, so the back half never crosses the front.
 */

import { Polygon } from '@core/draw';
import { along, partFrame, ringsAlong, type Part } from '@core/rig';
import { Blob, Decal, Round, Solid, Tube, UP, add3, dot3, lerp3, norm3, scale3, sub3, vec3, visibleArc, type Vec3 } from '@core/volume';
import { halo, armOf, hipSide, legOf, role, tones, type NoOptions } from './util';

/** Options of `belt`. */
export interface BeltOptions {
  /** An iron buckle on the front of the belt. Default true. */
  buckle?: boolean;
}

/**
 * A leather belt around the waist with a buckle on the front. The buckle stays hidden while that
 * side turns away from the camera (a body lying face down has it on the floor). Rests on the
 * garment under it when the outfit gives one as the host (`on: '<tunic id>'`).
 * Slot: `pelvis`. Roles: `leather` (belt), `metal` (buckle). Returns the belt (nothing when no
 * part of it faces the camera).
 */
export const belt: Part<BeltOptions> = ({ object: o, kit, body, at, materials, host }, { buckle = true }) => {
  const { up, hipRight, hipForward } = body;
  const pelvis = at.frame.origin;
  const cam = kit.camera;
  const arc = visibleArc(cam, add3(pelvis, scale3(up, 2.3)), hipRight, hipForward, 6.6, 5.1);
  if (!arc.length) return;
  const strap = new Tube(arc, 1.7);
  o.add(strap, role(materials, 'leather'), host ? { on: host, bias: 2 } : { bias: 2 });
  if (buckle && dot3(hipForward, cam.viewDir) > -0.25) {
    o.add(Solid.box(partFrame(add3(pelvis, add3(scale3(hipForward, 5.5), scale3(up, 1.3))), hipForward, up), 0.8, 2.6, 2.1), role(materials, 'metal'), { on: strap });
  }
  return strap;
};

/** Options of `pouch`. */
export interface PouchOptions {
  /** Hip it hangs on: -1 left, 1 right (or the same as a string, from an editor's select). Default -1. */
  side?: -1 | 1 | '-1' | '1';
}

/**
 * A small leather pouch on a hip.
 * Slot: `pelvis`. Roles: `leather`.
 */
export const pouch: Part<PouchOptions> = ({ object: o, body, at, materials }, { side = -1 }) => {
  const { up, hipRight, hipForward } = body;
  const hip = hipSide(side, -1);
  const bag = Round.ellipsoid(partFrame(add3(at.frame.origin, add3(scale3(hipForward, 1.5), add3(scale3(hipRight, 7.2 * hip), scale3(up, -0.6)))), hipForward, up), 1.8, 1.3, 2);
  o.add(bag, role(materials, 'leather'));
  return bag;
};

/** Options of `greave`. */
export interface GreaveOptions {
  /** A round cop over the knee. Default true. */
  kneeCop?: boolean;
}

/**
 * A greave: three rings lofted down the shin, and a knee cop.
 * Slot: `shin` (side -1 left, 1 right). Roles: `metal`. Returns the shin plate.
 */
export const greave: Part<GreaveOptions> = (ctx, { kneeCop = true }) => {
  const { object: o, pose, at, materials } = ctx;
  const [, knee, ankle] = pose.chains[legOf(ctx, at.side).name];
  const metal = role(materials, 'metal');
  const shin = along([knee, ankle], [0.15, 0.5, 0.85]);
  const plateOnShin = Round.loft(ringsAlong(shin, [[2.9, 3.1], [2.6, 2.8], [2.2, 2.4]], pose.frame.forward));
  o.add(plateOnShin, metal);
  if (kneeCop) o.add(Round.ellipsoid(partFrame(add3(knee, pose.frame.dir(0.9, 0, 0.2)), pose.frame.forward), 2.3, 2.6, 2.4), metal);
  return plateOnShin;
};

/** Options of `bracer`. */
export interface BracerOptions {
  /** Rings of the bracer are this much wider than the bone (1 = as drawn). Default 1. */
  size?: number;
}

/**
 * An iron bracer: three rings lofted along the forearm.
 * Slot: `forearm` (side -1 left, 1 right). Roles: `metal`.
 */
export const bracer: Part<BracerOptions> = (ctx, { size = 1 }) => {
  const { object: o, pose, at, materials } = ctx;
  const [, el, ha] = pose.chains[armOf(ctx, at.side).name];
  const rings = [[2.5, 2.4], [2.4, 2.3], [2.1, 2]].map(([a, b]) => [a * size, b * size] as [number, number]);
  const band = Round.loft(ringsAlong(along([el, ha], [0.2, 0.55, 0.85]), rings, UP));
  o.add(band, role(materials, 'metal'));
  return band;
};

/** Options of `legWraps`. */
export interface LegWrapsOptions {
  /** Number of wraps down the shin, from the knee (at most 3). Default 2. */
  count?: number;
}

/**
 * Leather wraps around the shin: thin bands that follow the surface (only the half facing the camera).
 * Slot: `shin` (side -1 left, 1 right). Roles: `leather`.
 */
export const legWraps: Part<LegWrapsOptions> = (ctx, { count = 2 }) => {
  const { object: o, pose, kit, at, materials } = ctx;
  const [, knee, ankle] = pose.chains[legOf(ctx, at.side).name];
  const leather = role(materials, 'leather');
  for (const p of along([knee, ankle], [0.15, 0.5, 0.85]).slice(0, Math.max(0, Math.min(3, count)))) {
    const ring = partFrame(p, sub3(ankle, knee), pose.frame.forward);
    const arc = visibleArc(kit.camera, p, ring.right, ring.up, 1.9, 1.9);
    if (arc.length) o.add(new Tube(arc, 0.8), leather);
  }
};

/**
 * A coat sleeve over the whole arm: a shoulder mass, the upper arm, an elbow knob, the forearm and a
 * flared cuff that ends just past the wrist, as one mass, with a thin trim round the cuff's edge when
 * the outfit has a `clothAccent`. The hand comes out of the cuff (draw a `boneHand` or a grip after
 * it). Mirrored by side.
 * Slot: `shoulder` (side -1 left, 1 right). Roles: `cloth`, `clothAccent` (optional: the cuff trim).
 * Returns the sleeve.
 */
export const coatSleeve: Part<NoOptions> = ctx => {
  const { object: o, pose, body, at, materials } = ctx;
  const [sh, el, ha] = pose.chains[armOf(ctx, at.side).name];
  const d = norm3(sub3(ha, el));
  const cloth = role(materials, 'cloth');
  const wrist = add3(ha, scale3(d, 0.6));
  const sleeve = new Blob([
    Round.ellipsoid(partFrame(sh, body.forward, body.up), 3.3, 3.3, 3.3),
    new Tube([sh, el], { start: 5.4, end: 4.4 }),
    Round.ellipsoid(partFrame(el, pose.frame.forward), 2.6, 2.6, 2.6),
    new Tube([el, lerp3(el, wrist, 0.7)], { start: 4.4, end: 3.9 }),
  ]);
  o.add(sleeve, cloth);
  const cuff = Round.loft(ringsAlong([lerp3(el, ha, 0.72), lerp3(el, ha, 0.9), wrist], [[2.1, 2.1], [2.6, 2.6], [3.5, 3.3]], UP));
  o.add(cuff, cloth, { on: sleeve });
  // The trim: the half of the cuff's rim that faces the camera.
  const trim = materials.clothAccent;
  if (trim) {
    const ring = partFrame(wrist, d, UP);
    const arc = visibleArc(ctx.kit.camera, wrist, ring.right, ring.up, 3.5, 3.3);
    if (arc.length) o.add(new Tube(arc, 0.9), trim, { on: cuff });
  }
  return sleeve;
};

/** Options of `sashTail`. */
export interface SashTailOptions {
  /** Which side of the buckle it hangs on: -1 left, 1 right (or the same as a string, from an editor's select). Default -1. */
  side?: -1 | 1 | '-1' | '1';
  /** Length of the hanging end. Default 17. */
  length?: number;
}

/**
 * The loose end of a sash: a ribbon that hangs from the belt in front, bowing a little and ending
 * a hand's breadth above the hem. Only drawn while the front of the body turns to the camera, and
 * shorter once the body lies down. Rests on the belt (give it as the host).
 * Slot: `pelvis`. Roles: `clothAccent`.
 */
export const sashTail: Part<SashTailOptions> = ({ object: o, kit, body, at, materials, host }, { side = -1, length = 17 }) => {
  const { up, hipRight, hipForward, lie } = body;
  if (!kit.camera.faces(hipForward)) return;
  const hip = hipSide(side, -1);
  const start = add3(at.frame.origin, add3(scale3(up, 2), add3(scale3(hipForward, 5.9), scale3(hipRight, 2.3 * hip))));
  const hang = norm3(add3(scale3(up, -1), scale3(hipForward, 0.1)));
  const len = length * (1 - 0.5 * lie);
  const clamp = (p: Vec3) => (p.z < 1 ? vec3(p.x, p.y, 1) : p);
  const pts = [start, add3(start, add3(scale3(hang, len * 0.5), add3(scale3(hipForward, 0.9), scale3(hipRight, 0.9 * hip)))), add3(start, add3(scale3(hang, len), scale3(hipRight, -0.4 * hip)))].map(clamp);
  o.add(new Tube(pts, { start: 3.2, end: 2.4 }), role(materials, 'clothAccent'), host ? { on: host } : {});
};

/**
 * A small skull as a belt buckle: cranium, jaw, two sockets and a nose, bone on the front of the
 * belt. Drawn only while the front of the body turns to the camera. Rests on the belt.
 * Slot: `pelvis`. Roles: `bone`, `hollow`.
 */
export const skullBuckle: Part<NoOptions> = ({ object: o, kit, body, at, materials, host }) => {
  const { up, hipForward } = body;
  if (dot3(hipForward, kit.camera.viewDir) < -0.25) return;
  const bone = role(materials, 'bone');
  const hollow = tones(materials, 'hollow');
  const c = add3(at.frame.origin, add3(scale3(hipForward, 6.1), scale3(up, 2.4)));
  const f = partFrame(c, hipForward, up);
  const jaw = Round.ellipsoid(f.moved(0.1, 0, -1.7), 1.2, 1.5, 0.8);
  o.add(jaw, bone, host ? { on: host } : {});
  const cranium = Round.ellipsoid(f, 1.6, 2, 2.1);
  o.add(cranium, bone, { on: jaw });
  for (const s of [-1, 1]) o.add(Decal.onFace(f, 'front', vec3(1.55, s * 0.82, 0.2), Polygon.ellipse(0.55, 0.6)), { fill: hollow.dark }, { on: cranium });
  o.add(Decal.onFace(f, 'front', vec3(1.62, 0, -0.75), Polygon.triangle(0.4, 0.55)), { fill: hollow.dark }, { on: cranium });
  return cranium;
};

/** Options of `grimoire`. */
export interface GrimoireOptions {
  /** Hip it hangs on: -1 left, 1 right (or the same as a string, from an editor's select). Default -1. */
  side?: -1 | 1 | '-1' | '1';
}

/**
 * A red grimoire hanging at the hip on a chain: a cover with a dark spine band, a clasp and a small
 * glowing eye, turned forward and a little outwards. The chain runs from the belt to the top of the
 * book in a sag, with links. It hangs from the belt: by the trunk axis standing, falling to the
 * floor beside the hip once the body lies. The eye and the clasp are decals, drawn only while the
 * cover turns to the camera.
 * Slot: `pelvis`. Roles: `clothAccent` (cover), `metal` (chain, clasp), `bone` (the eye's socket), `glow`.
 */
export const grimoire: Part<GrimoireOptions> = ({ object: o, kit, body, at, materials }, { side = -1 }) => {
  const { up, hipRight, hipForward, lie } = body;
  const hip = hipSide(side, -1);
  const cam = kit.camera;
  const cover = role(materials, 'clothAccent');
  const metal = role(materials, 'metal');
  const glow = role(materials, 'glow');
  const anchor = add3(at.frame.origin, add3(scale3(up, 2.1), add3(scale3(hipRight, 6.7 * hip), scale3(hipForward, 1.4))));
  const hang = norm3(lerp3(scale3(up, -1), vec3(0, 0, -1), lie));
  let centre = add3(anchor, add3(scale3(hang, 9.2), add3(scale3(hipRight, 2.2 * hip), scale3(hipForward, 0.8))));
  if (centre.z < 3.4) centre = vec3(centre.x, centre.y, 3.4);
  const out = norm3(add3(scale3(hipForward, 0.9), scale3(hipRight, 0.45 * hip)));
  const f = partFrame(add3(centre, scale3(hang, 3.4)), out, scale3(hang, -1));
  const book = Solid.box(f, 1.9, 5.2, 6.8);
  o.add(book, cover);
  // Chain: from the belt to the top of the book, with a sag and a few links.
  const top = add3(centre, scale3(hang, -3.4));
  const sag = scale3(hipForward, 0.9);
  const chain = [0, 0.33, 0.66, 1].map(w => add3(lerp3(anchor, top, w), scale3(sag, Math.sin(Math.PI * w))));
  o.add(new Tube(chain, 0.7), metal, { on: book });
  chain.slice(0, 3).forEach((p, i) => {
    const link = norm3(sub3(chain[i + 1], p));
    o.add(Round.ellipsoid(partFrame(lerp3(p, chain[i + 1], 0.5), link, i % 2 ? UP : hipRight), 1.15, 0.55, 0.6), metal, { on: book });
  });
  if (cam.faces(out)) {
    const face = f.moved(0, 0, 0);
    const onCover = (at3: Vec3, shape: Polygon) => Decal.onFace(face, 'front', at3, shape);
    o.add(onCover(vec3(1, 1.9 * -hip, 0), Polygon.rect(0.8, 6.6)), { fill: tones(materials, 'clothAccent').dark }, { on: book });
    o.add(onCover(vec3(1, 0, 3.7), Polygon.ellipse(1.5, 0.95)), { fill: tones(materials, 'bone').base }, { on: book });
    o.add(onCover(vec3(1.02, 0, 3.7), Polygon.circle(0.48)), { fill: glow.ramp.base, shadow: halo(glow, 5, 0.5) }, { on: book });
    o.add(onCover(vec3(1, 2.1 * hip, 3.4), Polygon.rect(0.9, 2.2)), { fill: tones(materials, 'metal').lit }, { on: book });
  }
  return book;
};
