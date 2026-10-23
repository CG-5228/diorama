/**
 * The effect catalog of Soulkeeper: what characters play on their clip events, as the exporter and
 * the viewer's playground see it (`VFX`). `npm run vfx-items -- soulkeeper` writes one sheet per
 * entry into `sheets/vfx/<id>.ts`; characters cue them by id (`defineCharacter({ effects })`).
 *
 * Sizes are against the 80-unit character (`SPACE.scale.character`) and the 48-unit cell
 * (`SPACE.scale.cell`): a projectile is about a hand's size and flies at a hand's height (0.55 of
 * the character), a cast circle spans a cell, an area blast two and a bit. Soul green is the only
 * saturated colour: a saturated core, darker rims, a pale hot centre; the steel spark is the
 * blade's white, the dust is the stone's, the chips the bone's.
 *
 * Roles (the materials that play them are `defaultMaterials`): `glow` soul fire, `blade` the pale
 * steel of a spark, `bone` chips, `dust` clouds of earth and stone.
 *
 * Timing follows the kit's motion rules: an anticipation frame or two, the peak early, a fall-off;
 * loops close on `t = frame ÷ frames`; one-shots end on an empty frame. Events: `hit` on the frame
 * a game reacts to, `release` where a cast lets go.
 *
 * Adding an effect: write its piece in one of the files here, list it below, run
 * `npm run vfx-items -- soulkeeper` and export `vfx/`.
 */

import type { EffectCatalog, EffectInfo } from '@core/volume';
import { CAMERA, VOLUMES } from '../theme';
import { SPACE } from '../space';
import { BONE_DUST_FRAMES, SLASH_SPARK_FRAMES, SOUL_BURST_FRAMES, boneDust, slashSpark, soulBurst } from './impacts';
import { DEATH_SOULS_FRAMES, DUST_PUFF_FRAMES, deathSouls, dustPuff } from './bursts';
import { CAST_CIRCLE_FRAMES, CAST_CIRCLE_RADIUS, CAST_CIRCLE_RELEASE, SHOCKWAVE_FRAMES, SHOCKWAVE_RADIUS, castCircle, soulShockwave } from './ground';
import { soulBolt } from './projectiles';
import { SOUL_SPIT_FRAMES, SPIT_HEIGHT, SPIT_SPLASH_FRAMES, soulSpit, spitSplash } from './spit';
import { groundCell } from './fx';

/** A hand's height on the character, where a thrown thing leaves and flies (0.55 of the character). */
const HAND_HEIGHT = Math.round(SPACE.scale.character * 0.55);

const EFFECTS: EffectInfo[] = [
  {
    id: 'soul-bolt', label: 'Soul bolt', kind: 'projectile', piece: soulBolt, roles: ['glow'],
    // A skull of soul fire trailing a tail: 6 frames round a loop (0.5 s), 16 facings so the heading reads.
    frames: 6, fps: 12, loop: true, directions: 16,
    size: 40, height: HAND_HEIGHT,
    travel: { speed: 260, range: 320 }, follows: 'soul-burst',
    cell: { width: 88, height: 98, pivot: { x: 44, y: 46 } },
  },
  {
    id: 'soul-burst', label: 'Soul burst', kind: 'impact', piece: soulBurst, roles: ['glow'],
    // Where a bolt ends, at its height: a flash, the peak on frame 1 (`hit`), then flames lifting and sparks falling; ends empty.
    frames: SOUL_BURST_FRAMES, fps: 16, size: 36, height: HAND_HEIGHT,
    events: [{ frame: 1, name: 'hit' }],
    cell: { width: 108, height: 116, pivot: { x: 54, y: 56 } },
  },
  {
    id: 'soul-spit', label: 'Soul spit', kind: 'projectile', piece: soulSpit, roles: ['glow'],
    // The bone spider's spit, for a mouth that sits low: a glob of soul fire with a short tail, about half the bolt, at the
    // mouth's height at its release (SPIT_HEIGHT), so its pool of light and its depth are right. Flies like the bolt, a shorter way.
    frames: SOUL_SPIT_FRAMES, fps: 12, loop: true, directions: 16,
    size: 22, height: SPIT_HEIGHT,
    travel: { speed: 260, range: 200 }, follows: 'spit-splash',
    cell: { width: 52, height: 48, pivot: { x: 26, y: 24 } },
  },
  {
    id: 'spit-splash', label: 'Soul splash', kind: 'impact', piece: spitSplash, roles: ['glow'],
    // Where a spit ends, low: a flash, a crown of droplets and short flames, a ring and a pool of light on the floor under it, the
    // peak on frame 1 (`hit`); 6 frames at 16 fps; ends empty.
    frames: SPIT_SPLASH_FRAMES, fps: 16, size: 16, height: SPIT_HEIGHT,
    events: [{ frame: 1, name: 'hit' }],
    cell: { width: 56, height: 48, pivot: { x: 28, y: 30 } },
  },
  {
    id: 'slash-spark', label: 'Blade spark', kind: 'impact', piece: slashSpark, roles: ['blade', 'glow'],
    // A crescent of white steel and a glint of soul fire at the point of the blow: 5 frames at 20 fps; ends empty.
    frames: SLASH_SPARK_FRAMES, fps: 20, size: 26,
    events: [{ frame: 1, name: 'hit' }],
    cell: { width: 72, height: 72, pivot: { x: 36, y: 36 } },
  },
  {
    id: 'bone-dust', label: 'Bone dust', kind: 'impact', piece: boneDust, roles: ['dust', 'bone'],
    // Dust and bone chips for a bite or a blunt blow: 6 frames at 14 fps; ends empty.
    frames: BONE_DUST_FRAMES, fps: 14, size: 28,
    events: [{ frame: 1, name: 'hit' }],
    cell: { width: 80, height: 76, pivot: { x: 40, y: 40 } },
  },
  {
    id: 'cast-circle', label: 'Casting circle', kind: 'cast', piece: castCircle, roles: ['glow'],
    // A rune circle about a cell in radius that draws itself and pulses; `release` is where the cast lets go. 10 frames at 20 fps
    // (0.5 s): cued on a skill's `start`, its release lands with the clip's own. Ends empty.
    frames: CAST_CIRCLE_FRAMES, fps: 20, layer: 'ground', size: CAST_CIRCLE_RADIUS + 8,
    events: [{ frame: CAST_CIRCLE_RELEASE, name: 'release' }],
    cell: groundCell(CAST_CIRCLE_RADIUS + 8, 46),
  },
  {
    id: 'soul-shockwave', label: 'Soul shockwave', kind: 'area', piece: soulShockwave, roles: ['glow'],
    // The area blast: a band of soul fire running out two and a quarter cells; `hit` on the frame it starts to spread. 8 frames at 16 fps; ends empty.
    frames: SHOCKWAVE_FRAMES, fps: 16, layer: 'ground', size: SHOCKWAVE_RADIUS,
    events: [{ frame: 1, name: 'hit' }],
    cell: groundCell(SHOCKWAVE_RADIUS, 20),
  },
  {
    id: 'death-souls', label: 'Freed souls', kind: 'burst', piece: deathSouls, roles: ['glow'],
    // Lost souls rising from a fallen body, played on a death clip's `end` at its `center`: 10 frames at 12 fps; ends empty.
    frames: DEATH_SOULS_FRAMES, fps: 12, size: 52, height: 10,
    cell: { width: 112, height: 112, pivot: { x: 56, y: 76 } },
  },
  {
    id: 'dust-puff', label: 'Dust cloud', kind: 'burst', piece: dustPuff, roles: ['dust'],
    // A small cloud at the feet for a landing or a heavy step: 6 frames at 14 fps; ends empty.
    frames: DUST_PUFF_FRAMES, fps: 14, size: 22,
    cell: { width: 80, height: 72, pivot: { x: 40, y: 40 } },
  },
];

export const VFX: EffectCatalog = {
  effects: EFFECTS,
  materials: VOLUMES,
  defaultMaterials: {
    glow: 'soul',
    blade: 'blade',
    bone: 'bone',
    dust: 'stone',
  },
  camera: CAMERA,
  space: SPACE,
};
