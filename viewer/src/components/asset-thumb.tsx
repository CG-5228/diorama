import { useEffect, useState } from 'react';
import { cssVars } from '@/lib/css';
import { basename, stripExtension } from '@/lib/format';
import type { AssetFileMeta, AtlasInfo } from '@/lib/types';
import { Badge } from '@/components/ui/badge';
import { roleOf } from '@/lib/asset-role';
import { TrimmedImage } from './trimmed-image';

/** The atlas describes a strip or direction sheet whose frames can be cropped out one by one. */
function spriteOf(asset: AssetFileMeta): AtlasInfo | null {
  const info = asset.atlasInfo;
  const animated = info && (info.mode === 'strip' || info.mode === 'directions');
  return animated && info.frameWidth > 0 && info.frameHeight > 0 && info.width > 0 ? info : null;
}

const sheetUrl = (asset: AssetFileMeta) => `${asset.url}?t=${asset.mtime}`;

function Frame({ asset, frame = 0 }: { asset: AssetFileMeta; frame?: number }) {
  const sprite = spriteOf(asset);
  if (!sprite) {
    return <img src={sheetUrl(asset)} alt="" loading="lazy" draggable={false} className="pixelated max-h-[88%] max-w-[88%] object-contain" />;
  }
  const cols = Math.max(1, Math.round(sprite.width / sprite.frameWidth));
  const rows = Math.max(1, Math.round(sprite.height / sprite.frameHeight));
  return (
    <div
      className="pixelated aspect-(--ar) w-[min(88cqw,calc(88cqh*var(--ar)))] bg-no-repeat [background-image:var(--sheet)] [background-position:var(--pos)] [background-size:var(--size)]"
      style={cssVars({
        '--ar': sprite.frameWidth / sprite.frameHeight,
        '--sheet': `url(${sheetUrl(asset)})`,
        '--size': `${cols * 100}% ${rows * 100}%`,
        // The first row faces the camera, so only frames in that row are played.
        '--pos': `${cols > 1 ? (frame / (cols - 1)) * 100 : 0}% 0%`,
      })}
    />
  );
}

function ThumbBox({ children }: { children: React.ReactNode }) {
  return <div className="checker relative grid aspect-4/3 place-items-center overflow-hidden [container-type:size]">{children}</div>;
}

/** The first frame of an asset, played while hovered. */
export function AssetThumb({ asset, hovering = false }: { asset: AssetFileMeta; hovering?: boolean }) {
  const sprite = spriteOf(asset);
  const [frame, setFrame] = useState(0);

  useEffect(() => {
    if (!hovering || !sprite || sprite.frameCount < 2) {
      setFrame(0);
      return;
    }
    const id = setInterval(() => setFrame((f) => (f + 1) % sprite.frameCount), 1000 / Math.max(1, sprite.fps));
    return () => clearInterval(id);
  }, [hovering, sprite]);

  // A gear item is a small piece in a big cell: show the piece, not the cell.
  if (roleOf(asset) === 'gear') {
    return (
      <ThumbBox>
        <TrimmedImage asset={asset} className="max-h-[80%] max-w-[80%]" />
      </ThumbBox>
    );
  }
  return (
    <ThumbBox>
      <Frame asset={asset} frame={frame} />
    </ThumbBox>
  );
}

/** A character: on hover its animations play one after the other, each one complete. */
export function GroupThumb({ clips, hovering = false }: { clips: AssetFileMeta[]; hovering?: boolean }) {
  const [at, setAt] = useState({ clip: 0, frame: 0 });
  const current = clips[at.clip];
  const info = spriteOf(current);

  useEffect(() => {
    if (!hovering) return;
    // Other animations' sheets are fetched on the first hover, not on page load.
    for (const clip of clips) new Image().src = sheetUrl(clip);
  }, [hovering, clips]);

  useEffect(() => {
    if (!hovering) {
      setAt({ clip: 0, frame: 0 });
      return;
    }
    const frames = info?.frameCount ?? 1;
    const id = setInterval(
      () => setAt((s) => (s.frame + 1 < frames ? { ...s, frame: s.frame + 1 } : { clip: (s.clip + 1) % clips.length, frame: 0 })),
      1000 / Math.max(1, info?.fps ?? 8),
    );
    return () => clearInterval(id);
  }, [hovering, at.clip, clips, info]);

  return (
    <ThumbBox>
      <Frame asset={current} frame={at.frame} />
      {hovering && (
        <Badge variant="secondary" className="absolute bottom-1.5 left-1.5">
          {basename(stripExtension(current.subpath))}
        </Badge>
      )}
    </ThumbBox>
  );
}
