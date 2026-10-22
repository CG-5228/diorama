/**
 * A small gear kit built with the real engine, to develop the customizer before a project ships its own
 * `src/gear/catalog.ts`. It is only reachable with `?fixture` in the customize tab. Delete it with that flag
 * once the projects' catalogs are in use.
 */

import { Camera, Round, type VolumeStyle } from '@core/volume';
import { humanoid, idle, locomotion, mannequinSkin, slash, type GearCatalog, type OutfitCharacterInfo, type Part } from '@core/rig';
import type { GearKit } from './catalog';

const tones = (lit: string, base: string, dark: string): VolumeStyle => ({ ramp: { lit, base, dark } });

const MATERIALS: Record<string, VolumeStyle> = {
  iron: tones('#8a8799', '#535064', '#2b2935'),
  bronze: tones('#e8c07a', '#b5803f', '#6b4720'),
  sash: tones('#a8435a', '#7c2a3e', '#4a1626'),
  robe: tones('#54407a', '#33284d', '#1c1530'),
  bone: tones('#f2ead4', '#cdbf9d', '#8a7b61'),
  flesh: tones('#d9d4e6', '#a49fbc', '#655f80'),
};

const helm: Part<{ size?: number; visor?: boolean }> = ({ object, at, materials }, { size = 1, visor = true }) => {
  const dome = Round.ellipsoid(at.frame.moved(0, 0, 2.2), 5.6 * size, 5 * size, 5 * size);
  object.add(dome, materials.metal);
  if (visor) object.add(Round.ellipsoid(at.frame.moved(3.6 * size, 0, 0.6), 2.2 * size, 4 * size, 1.6 * size), materials.metalAccent ?? materials.metal, { on: dome });
  return dome;
};

const crest: Part<{ shape?: string }> = ({ object, at, materials, host }, { shape = 'ridge' }) => {
  const up = shape === 'ridge' ? 3.2 : 1.6;
  const volume = Round.ellipsoid(at.frame.moved(-0.5, 0, 6.8), shape === 'ridge' ? 4.6 : 2.4, 1.2, up);
  object.add(volume, materials.cloth, host ? { on: host } : undefined);
  return volume;
};

const pauldron: Part<{ size?: number }> = ({ object, at, materials }, { size = 1 }) => {
  const volume = Round.ellipsoid(at.frame.moved(0, at.side * 3.2, 1.2), 3.4 * size, 3.2 * size, 2.6 * size);
  object.add(volume, materials.metal);
  return volume;
};

const cape: Part<Record<string, never>> = ({ object, at, materials }) => {
  const volume = Round.ellipsoid(at.frame.moved(-2, 0, -9), 1.4, 6, 12);
  object.add(volume, materials.cloth);
  return volume;
};

const CATALOG: GearCatalog = {
  materials: MATERIALS,
  bases: [
    { id: 'bone', label: 'Osso', skin: mannequinSkin(MATERIALS.bone), roles: ['bone'] },
    { id: 'flesh', label: 'Carne', skin: mannequinSkin(MATERIALS.flesh), roles: ['flesh'] },
  ],
  parts: [
    {
      id: 'helm', label: 'Elmo', group: 'head', part: helm, slots: ['head'], roles: ['metal', 'metalAccent'],
      options: [
        { key: 'size', label: 'Tamanho', type: 'number', default: 1, min: 0.7, max: 1.4, step: 0.05 },
        { key: 'visor', label: 'Viseira', type: 'boolean', default: true },
      ],
    },
    {
      id: 'crest', label: 'Crista', group: 'head', part: crest, slots: ['head'], roles: ['cloth'], requires: 'helm',
      options: [{ key: 'shape', label: 'Forma', type: 'select', default: 'ridge', choices: [{ value: 'ridge', label: 'Crista' }, { value: 'knob', label: 'Botão' }] }],
    },
    {
      id: 'pauldron', label: 'Ombreira', group: 'shoulders', part: pauldron, slots: ['shoulder'], roles: ['metal'],
      options: [{ key: 'size', label: 'Tamanho', type: 'number', default: 1, min: 0.6, max: 1.6, step: 0.05 }],
    },
    { id: 'cape', label: 'Capa', group: 'garments', part: cape, slots: ['back'], roles: ['cloth'] },
  ],
};

const skeleton = humanoid();

const GUARD: OutfitCharacterInfo = {
  id: 'fixture-guard',
  label: 'Guarda (fixture)',
  skeleton,
  clips: {
    idle: { clip: idle(skeleton, { seconds: 1.6 }), frames: 16 },
    walk: { clip: locomotion(skeleton, 'walk'), frames: 12 },
    slash: { clip: slash(skeleton), frames: 12 },
  },
  camera: new Camera({ tilt: 48, heightBoost: 1.2, light: { azimuth: 140, elevation: 45, ambient: 0.35 }, contour: { width: 1.25, color: '#0d0b12' } }),
  width: 108,
  height: 162,
  pivot: { x: 54, y: 124 },
  shadow: 'rgba(13, 11, 18, 0.35)',
  outfit: {
    base: 'bone',
    materials: { metal: 'iron', metalAccent: 'bronze', cloth: 'sash', bone: 'bone' },
    pieces: [
      { part: 'helm', slot: 'head', id: 'helm' },
      { part: 'pauldron', slot: 'shoulder', side: 1 },
      { part: 'pauldron', slot: 'shoulder', side: -1 },
    ],
  },
};

export const FIXTURE_KIT: GearKit = { catalog: CATALOG, characters: [GUARD] };
