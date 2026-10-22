import { basename, dirname, stripExtension } from '../format';
import type { AssetFileMeta } from '../types';
import type { Armed, Library } from './library';

/** Everything the palette can offer, flattened so it can be searched, grouped and virtualized. */
export type EntryKind = 'character' | 'animated' | 'still';
export type KindFilter = 'all' | 'character' | 'object';

export interface Entry {
  key: string;
  kind: EntryKind;
  name: string;
  /** The folder the entry is listed under. */
  group: string;
  subtitle: string;
  cover: AssetFileMeta;
  armed: Armed;
}

export type Row =
  | { type: 'header'; key: string; label: string; count: number; collapsed: boolean }
  | { type: 'entry'; key: string; entry: Entry };

const ROOT = '(raiz)';

export function listEntries(library: Library): Entry[] {
  const characters = library.characters.map<Entry>((character) => {
    const first = character.idle ?? character.locomotion[0] ?? character.actions[0];
    return {
      key: `character:${character.id}`,
      kind: 'character',
      name: character.name,
      group: dirname(character.folder) || ROOT,
      subtitle: `${character.clips.length} ${character.clips.length === 1 ? 'animação' : 'animações'}`,
      cover: first.asset,
      armed: { key: `character:${character.id}`, type: 'character', character },
    };
  });
  const sprites = library.sprites.map<Entry>((sprite) => {
    const { atlas, frameCount, asset } = sprite.clip;
    const facings = atlas.meta.directions?.length ?? 0;
    return {
      key: `sprite:${sprite.id}`,
      kind: frameCount > 1 ? 'animated' : 'still',
      name: atlas.meta.data?.label ?? basename(stripExtension(asset.subpath)),
      group: dirname(asset.subpath) || ROOT,
      subtitle: [frameCount > 1 ? `${frameCount} frames` : 'estático', facings > 1 ? `${facings} direções` : ''].filter(Boolean).join(' · '),
      cover: asset,
      armed: { key: `sprite:${sprite.id}`, type: 'sprite', clip: sprite.clip, row: 0 },
    };
  });
  return [...characters, ...sprites];
}

/** Every word of the query must appear in "group/name". */
export function matches(entry: Entry, query: string): boolean {
  const haystack = `${entry.group}/${entry.name}`.toLowerCase();
  return query.toLowerCase().split(/\s+/).filter(Boolean).every((word) => haystack.includes(word));
}

const inFilter = (entry: Entry, filter: KindFilter) =>
  filter === 'all' || (filter === 'character' ? entry.kind === 'character' : entry.kind !== 'character');

interface RowOptions {
  query: string;
  filter: KindFilter;
  collapsed: ReadonlySet<string>;
  /** Entry keys, newest first. */
  recent: readonly string[];
}

/** Flat rows: a "Recentes" block, then one header per folder followed by its entries. */
export function buildRows(entries: Entry[], { query, filter, collapsed, recent }: RowOptions): Row[] {
  const searching = query.trim() !== '';
  const visible = entries.filter((e) => inFilter(e, filter) && matches(e, query));
  const rows: Row[] = [];

  if (!searching) {
    const recents = recent.map((key) => visible.find((e) => e.key === key)).filter((e): e is Entry => e !== undefined);
    if (recents.length > 0) {
      rows.push({ type: 'header', key: 'recent', label: 'Recentes', count: recents.length, collapsed: false });
      for (const entry of recents) rows.push({ type: 'entry', key: `recent|${entry.key}`, entry });
    }
  }

  const groups = new Map<string, Entry[]>();
  for (const entry of visible) groups.set(entry.group, [...(groups.get(entry.group) ?? []), entry]);
  for (const [group, members] of [...groups].sort(([a], [b]) => a.localeCompare(b, undefined, { numeric: true }))) {
    // A search opens every folder: collapsing only helps when browsing.
    const isCollapsed = !searching && collapsed.has(group);
    rows.push({ type: 'header', key: `group|${group}`, label: group, count: members.length, collapsed: isCollapsed });
    if (isCollapsed) continue;
    for (const entry of members.sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }))) {
      rows.push({ type: 'entry', key: entry.key, entry });
    }
  }
  return rows;
}

export const RECENT_LIMIT = 6;

/** Puts a key first, drops repeats and keeps the list short. */
export function pushRecent(recent: readonly string[], key: string): string[] {
  return [key, ...recent.filter((k) => k !== key)].slice(0, RECENT_LIMIT);
}
