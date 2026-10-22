import { basename, dirname } from './format';
import type { AssetFileMeta } from './types';

/** The animations that make up one character (or any animated thing) living in the same folder. */
export interface AssetGroup {
  id: string;
  name: string;
  folder: string;
  assets: AssetFileMeta[];
}

export type AssetEntry = { type: 'asset'; asset: AssetFileMeta } | { type: 'group'; group: AssetGroup };

/** Effects, item icons and interface pieces live in folders of their own (`vfx/`, `icons/`, `ui/`) but are not clips of one thing: each is shown alone. */
const STANDS_ALONE = new Set(['vfx', 'icon', 'ui']);

const isAnimation = ({ atlasInfo }: AssetFileMeta) =>
  atlasInfo !== null && !STANDS_ALONE.has(atlasInfo.role ?? '') && (atlasInfo.mode === 'strip' || atlasInfo.mode === 'directions') && atlasInfo.frameCount > 1;

/** Idle first, then alphabetical: the order animations are shown in. */
function byClip(a: AssetFileMeta, b: AssetFileMeta) {
  const rank = (asset: AssetFileMeta) => (basename(asset.subpath).startsWith('idle') ? 0 : 1);
  return rank(a) - rank(b) || a.subpath.localeCompare(b.subpath, undefined, { numeric: true });
}

function animationsByFolder(assets: AssetFileMeta[]): Map<string, AssetFileMeta[]> {
  const byFolder = new Map<string, AssetFileMeta[]>();
  for (const asset of assets) {
    const folder = dirname(asset.subpath);
    if (folder && isAnimation(asset)) byFolder.set(folder, [...(byFolder.get(folder) ?? []), asset]);
  }
  for (const [folder, members] of byFolder) {
    if (members.length < 2) byFolder.delete(folder);
    else members.sort(byClip);
  }
  return byFolder;
}

/** The other animations of the same character, or just the asset itself when it stands alone. */
export function clipsOf(allAssets: AssetFileMeta[], asset: AssetFileMeta): AssetFileMeta[] {
  return animationsByFolder(allAssets).get(dirname(asset.subpath)) ?? [asset];
}

/**
 * Collapses sibling animations into one entry, placed where the first of them was.
 * `all` is the whole project: filters may hide some clips, but the group must stay complete.
 */
export function groupAnimations(visible: AssetFileMeta[], all: AssetFileMeta[]): AssetEntry[] {
  const groups = animationsByFolder(all);
  const placed = new Set<string>();
  const entries: AssetEntry[] = [];
  for (const asset of visible) {
    const folder = dirname(asset.subpath);
    const members = groups.get(folder);
    if (!members || !isAnimation(asset)) {
      entries.push({ type: 'asset', asset });
    } else if (!placed.has(folder)) {
      placed.add(folder);
      entries.push({ type: 'group', group: { id: folder, name: basename(folder), folder, assets: members } });
    }
  }
  return entries;
}

export const entryKey = (entry: AssetEntry) => (entry.type === 'asset' ? entry.asset.subpath : `group:${entry.group.id}`);

/** What opens when an entry is clicked: the asset itself, or the first animation of a group. */
export const entryCover = (entry: AssetEntry): AssetFileMeta => (entry.type === 'asset' ? entry.asset : entry.group.assets[0]);
