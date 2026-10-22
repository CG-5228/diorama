import { useMemo, useRef, useState } from 'react';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Kbd } from '@/components/ui/kbd';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { roleOf } from '@/lib/asset-role';
import { basename, plural, stripExtension } from '@/lib/format';
import { clipsOf } from '@/lib/groups';
import { isTyping, useWindowKeydown } from '@/lib/hotkeys';
import type { AssetFileMeta } from '@/lib/types';
import { IconPreview } from './icon-preview';
import { Inspector } from './inspector';
import { PreviewHeader, PreviewShell, usePeers } from './preview-shell';
import { Stage } from './stage';
import { Transport } from './transport';
import { UiPreview } from './ui-preview';
import { usePlayer, type Backdrop } from './use-player';
import { VfxSection, useVfx } from './vfx-section';

interface Props {
  asset: AssetFileMeta;
  /** Every asset of the project: the other animations of a character are found here. */
  projectAssets: AssetFileMeta[];
  /** The assets in the order the list shows them, for stepping through the list. */
  visibleAssets: AssetFileMeta[];
  onClose: () => void;
  onSelect: (asset: AssetFileMeta) => void;
}

export function PreviewDialog({ asset, projectAssets, visibleAssets, onClose, onSelect }: Props) {
  const contentRef = useRef<HTMLDivElement>(null);
  // The facing direction survives switching between the animations of one character.
  const [directionIndex, setDirectionIndex] = useState(0);
  const clips = useMemo(() => clipsOf(projectAssets, asset), [projectAssets, asset]);

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent
        ref={contentRef}
        showCloseButton={false}
        tabIndex={-1}
        aria-describedby={undefined}
        className="flex h-[92vh] w-[94vw] max-w-none flex-col gap-0 overflow-hidden p-0 sm:max-w-none"
        // Keep focus on the dialog itself so no toolbar button shows a focus ring on open.
        onOpenAutoFocus={(e) => {
          e.preventDefault();
          contentRef.current?.focus();
        }}
      >
        <PreviewBody
          key={`${asset.project}/${asset.subpath}/${asset.mtime}`}
          asset={asset}
          clips={clips}
          projectAssets={projectAssets}
          visibleAssets={visibleAssets}
          directionIndex={directionIndex}
          onDirection={setDirectionIndex}
          onSelect={onSelect}
        />
      </DialogContent>
    </Dialog>
  );
}

interface BodyProps {
  asset: AssetFileMeta;
  /** Every asset of the project: the other animations of a character, the icons of an inventory and the effect an effect follows are found here. */
  projectAssets: AssetFileMeta[];
  clips: AssetFileMeta[];
  visibleAssets: AssetFileMeta[];
  directionIndex: number;
  onDirection: (index: number) => void;
  onSelect: (asset: AssetFileMeta) => void;
}

/** What the preview shows depends on what the asset is: an item icon in an inventory, an interface piece stretched or filled, anything else played frame by frame. */
function PreviewBody(props: BodyProps) {
  const { asset, clips, visibleAssets, projectAssets, onSelect } = props;
  const peers = usePeers(asset, clips, visibleAssets, onSelect);
  const role = roleOf(asset);
  if (role === 'icon') {
    return (
      <PreviewShell asset={asset} peers={peers} hints={<span>clique num espaço para abrir o item</span>}>
        <IconPreview asset={asset} projectAssets={projectAssets} onSelect={onSelect} />
      </PreviewShell>
    );
  }
  if (role === 'ui') {
    return (
      <PreviewShell asset={asset} peers={peers} hints={<span><Kbd>B</Kbd> fundo</span>}>
        <UiPreview asset={asset} />
      </PreviewShell>
    );
  }
  return <PlayerBody {...props} peers={peers} />;
}

function PlayerBody({ asset, clips, projectAssets, peers, directionIndex, onDirection, onSelect }: BodyProps & { peers: ReturnType<typeof usePeers> }) {
  const player = usePlayer(asset, directionIndex);
  const [highlight, setHighlight] = useState<string | null>(null);
  const { directions, frames } = player;
  // An effect shows its reach and, for a projectile, flies at its own speed.
  const vfx = useVfx(player, directionIndex);
  const { go } = peers;

  useWindowKeydown((e) => {
    if (e.metaKey || e.ctrlKey || e.altKey || isTyping(e.target)) return;
    const turn = (offset: number) => directions.length > 1 && onDirection((directionIndex + offset + directions.length) % directions.length);
    switch (e.key) {
      case ' ': player.setPlaying(!player.playing); break;
      case 'ArrowRight': player.seek(player.index + 1); break;
      case 'ArrowLeft': player.seek(player.index - 1); break;
      case 'ArrowUp': turn(-1); break;
      case 'ArrowDown': turn(1); break;
      case '[': go(-1); break;
      case ']': go(1); break;
      case 'p': case 'P': player.setShowPivot(!player.showPivot); break;
      case 'g': case 'G': player.setShowBounds(!player.showBounds); break;
      case 'b': case 'B': player.setBackdrop((({ checker: 'dark', dark: 'light', light: 'checker' }) as Record<Backdrop, Backdrop>)[player.backdrop]); break;
      case '+': case '=': player.stepZoom(1); break;
      case '-': player.stepZoom(-1); break;
      case '0': player.setZoom('fit'); break;
      default: {
        const n = Number(e.key);
        if (n >= 1 && n <= directions.length) onDirection(n - 1);
        else return;
      }
    }
    e.preventDefault();
  });

  return (
    <>
      <PreviewHeader asset={asset} peers={peers} />

      {clips.length > 1 && (
        <div className="flex items-center gap-3 border-b px-4 py-1.5">
          <span className="text-xs text-muted-foreground">Animações</span>
          <Tabs value={asset.subpath} onValueChange={(subpath) => { const next = clips.find((c) => c.subpath === subpath); if (next) onSelect(next); }}>
            <TabsList variant="line">
              {clips.map((clip) => (
                <TabsTrigger key={clip.subpath} value={clip.subpath}>
                  {basename(stripExtension(clip.subpath))}
                  {clip.atlasInfo && <span className="text-muted-foreground tabular-nums">{clip.atlasInfo.frameCount}f</span>}
                </TabsTrigger>
              ))}
            </TabsList>
          </Tabs>
        </div>
      )}

      <div className="grid min-h-0 flex-1 grid-cols-[minmax(0,1fr)_20rem]">
        <section className="flex min-h-0 min-w-0 flex-col">
          <Stage player={player} asset={asset} highlight={highlight} ring={vfx.ringRadius} flight={vfx.flight} />
          <Transport player={player} />
        </section>
        <Inspector
          player={player}
          asset={asset}
          directionIndex={directionIndex}
          onDirection={onDirection}
          onHighlight={setHighlight}
          top={vfx.effect && <VfxSection vfx={vfx} projectAssets={projectAssets} onSelect={onSelect} />}
        />
      </div>

      <footer className="flex items-center gap-4 border-t px-4 py-1.5 text-xs text-muted-foreground">
        <span><Kbd>Espaço</Kbd> reproduzir</span>
        <span><Kbd>←</Kbd> <Kbd>→</Kbd> frame</span>
        {directions.length > 1 && <span><Kbd>↑</Kbd> <Kbd>↓</Kbd> direção</span>}
        <span><Kbd>[</Kbd> <Kbd>]</Kbd> {clips.length > 1 ? 'animação' : 'asset'}</span>
        <span><Kbd>B</Kbd> fundo</span>
        <span><Kbd>+</Kbd> <Kbd>−</Kbd> <Kbd>0</Kbd> zoom</span>
        <span className="ml-auto tabular-nums">{plural(frames.length, 'frame', 'frames')}</span>
      </footer>
    </>
  );
}
