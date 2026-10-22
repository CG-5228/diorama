import { useEffect, useState } from 'react';
import type { AssetFileMeta } from '../types';

/** Loads the sheet image of every asset once and hands them to the scene by url. */
export function useSheetImages(assets: AssetFileMeta[]) {
  const [images, setImages] = useState<Map<string, HTMLImageElement>>(new Map());
  useEffect(() => {
    let live = true;
    for (const asset of assets) {
      const src = `${asset.url}?t=${asset.mtime}`;
      const img = new Image();
      img.onload = () => live && setImages((prev) => new Map(prev).set(asset.url, img));
      img.src = src;
    }
    return () => {
      live = false;
    };
  }, [assets]);
  return images;
}
