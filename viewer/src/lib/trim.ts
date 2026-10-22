import { queryOptions } from '@tanstack/react-query';
import type { AssetFileMeta } from './types';

/** An image cut out of a sheet: a data URL and its size in px. */
export interface Trimmed {
  src: string;
  width: number;
  height: number;
}

/** Alpha above this counts as drawn. */
const SOLID = 8;
/** The facings thumbnails are cut from, best first: a three-quarter view reads best. */
const PREFERRED_FACINGS = ['SE', 'S'];

/** The first frame of the preferred facing of a directions sheet, as a rectangle of the image. */
export function thumbCell(asset: AssetFileMeta) {
  const info = asset.atlasInfo;
  if (!info || info.frameWidth <= 0 || info.frameHeight <= 0) return null;
  const rows = info.mode === 'directions' ? info.directions : [];
  const row = Math.max(0, rows.indexOf(PREFERRED_FACINGS.find((name) => rows.includes(name)) ?? ''));
  return { x: 0, y: row * info.frameHeight, width: info.frameWidth, height: info.frameHeight };
}

const decode = (src: string) =>
  new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error(`Não foi possível ler ${src}.`));
    image.src = src;
  });

/** The part of a canvas that holds drawn pixels, cut out as its own image; null when nothing is drawn. */
export function trimCanvas(canvas: HTMLCanvasElement): Trimmed | null {
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) return null;
  const { width, height } = canvas;
  const { data } = ctx.getImageData(0, 0, width, height);
  let left = width, top = height, right = -1, bottom = -1;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (data[(y * width + x) * 4 + 3] <= SOLID) continue;
      if (x < left) left = x;
      if (x > right) right = x;
      if (y < top) top = y;
      bottom = y;
    }
  }
  if (right < 0) return null;
  const out = document.createElement('canvas');
  out.width = right - left + 1;
  out.height = bottom - top + 1;
  out.getContext('2d')?.drawImage(canvas, left, top, out.width, out.height, 0, 0, out.width, out.height);
  return { src: out.toDataURL(), width: out.width, height: out.height };
}

/** The cell cut to the smallest box that holds every drawn pixel, or null when it is empty. */
export async function trimCell(asset: AssetFileMeta): Promise<Trimmed | null> {
  const cell = thumbCell(asset);
  if (!cell) return null;
  const image = await decode(`${asset.url}?t=${asset.mtime}`);
  const canvas = document.createElement('canvas');
  canvas.width = cell.width;
  canvas.height = cell.height;
  canvas.getContext('2d')?.drawImage(image, cell.x, cell.y, cell.width, cell.height, 0, 0, cell.width, cell.height);
  return trimCanvas(canvas);
}

/** The trimmed thumbnail of a sheet. Cut once per export: its mtime is part of the key. */
export const trimmedQuery = (asset: AssetFileMeta) =>
  queryOptions({
    queryKey: ['trimmed', asset.project, asset.subpath, asset.mtime],
    queryFn: () => trimCell(asset),
    staleTime: Infinity,
    gcTime: 30 * 60_000,
  });
