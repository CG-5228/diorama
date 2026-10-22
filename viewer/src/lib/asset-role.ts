import { groupLabel } from './outfit/labels';
import { basename, stripExtension } from './format';
import type { AssetFileMeta } from './types';

/** What an exported sheet is, as the viewer sorts it: its atlas says (`meta.data.role`), anything else is "other". */
export const roleIds = ['character', 'gear', 'scenery', 'prop', 'vfx', 'icon', 'ui', 'other'] as const;
export type RoleId = (typeof roleIds)[number];

export const roleLabels: Record<RoleId, string> = { character: 'Personagens', gear: 'Itens', scenery: 'Cenário', prop: 'Props', vfx: 'Efeitos', icon: 'Ícones', ui: 'Interface', other: 'Outros' };
export const roleSingular: Record<RoleId, string> = { character: 'Personagem', gear: 'Item', scenery: 'Cenário', prop: 'Prop', vfx: 'Efeito', icon: 'Ícone', ui: 'Interface', other: 'Outro' };

/** The roles a scenery kit's sheets carry: floor tiles, walls, fences, decals, and whole scenes. */
const SCENERY_ROLES = new Set(['tile', 'wall', 'fence', 'decal', 'scene']);

export function roleOf(asset: AssetFileMeta): RoleId {
  const role = asset.atlasInfo?.role;
  if (role === 'character' || role === 'gear' || role === 'prop' || role === 'vfx' || role === 'icon' || role === 'ui') return role;
  return role && SCENERY_ROLES.has(role) ? 'scenery' : 'other';
}

export const isRoleId = (value: string): value is RoleId => (roleIds as readonly string[]).includes(value);

/** The name shown for an asset: a gear item's own label ("Elmo"), otherwise its file name. */
export const assetTitle = (asset: AssetFileMeta) => asset.atlasInfo?.label ?? basename(stripExtension(asset.subpath));

/** The group of a gear item ("Cabeça"), or null for anything else. */
export const gearGroup = (asset: AssetFileMeta) => (roleOf(asset) === 'gear' && asset.atlasInfo?.group ? groupLabel(asset.atlasInfo.group) : null);

/** What more an asset is, for a badge: a gear item's group ("Cabeça"), an effect's, item's or interface piece's kind. */
export function roleDetail(asset: AssetFileMeta): string | null {
  const role = roleOf(asset);
  if (role === 'gear') return gearGroup(asset);
  if (role === 'vfx' || role === 'icon' || role === 'ui') return asset.atlasInfo?.kind ?? null;
  return null;
}
