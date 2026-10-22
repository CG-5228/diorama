import type { AssetFileMeta, ProjectMeta } from './types';

/** Checkouts and copies touch many files at once; a second of slack keeps them from all looking out of date. */
const TOLERANCE_MS = 1000;

/** The sheet, or a file of `src/` it imports, changed after this asset was exported. */
export const isStale = (asset: AssetFileMeta) => asset.sourceMtime !== null && asset.sourceMtime > asset.mtime + TOLERANCE_MS;

export interface PendingExports {
  /** Exported, but the sheet or the code it imports is newer than the image. */
  stale: AssetFileMeta[];
  /** Sheets (relative to sheets/, with `.ts`) that have no exported image. */
  missing: string[];
}

export function pendingExports(assets: AssetFileMeta[], project: ProjectMeta | undefined): PendingExports {
  return { stale: assets.filter(isStale), missing: project?.pendingSheets ?? [] };
}

/** What `tools/export.ts` takes to export one sheet: its path under sheets/ without the extension. */
export const exportTarget = (sheet: string) => sheet.replace(/\.[^/.]+$/, '');
