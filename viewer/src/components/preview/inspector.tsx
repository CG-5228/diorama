import type { ReactNode } from 'react';
import { RotateCcwIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Field, FieldDescription, FieldLabel, FieldLegend, FieldSet, FieldTitle } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { Kbd } from '@/components/ui/kbd';
import { Slider } from '@/components/ui/slider';
import { Switch } from '@/components/ui/switch';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { copyText } from '@/lib/clipboard';
import { COMPASS, eventsOf, type Atlas } from '@/lib/atlas';
import { formatDate } from '@/lib/format';
import { projectFile } from '@/lib/project-paths';
import type { AssetFileMeta } from '@/lib/types';
import { ZOOMS, type Backdrop, type Player, type Zoom } from './use-player';

export function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <FieldSet className="gap-3 border-b p-4">
      <FieldLegend variant="label" className="mb-0 text-muted-foreground uppercase">{title}</FieldLegend>
      {children}
    </FieldSet>
  );
}

interface Props {
  player: Player;
  asset: AssetFileMeta;
  directionIndex: number;
  onDirection: (index: number) => void;
  onHighlight: (frame: string | null) => void;
  /** Sections that come before the playback ones: what the asset is (an effect's kind, reach and speed). */
  top?: ReactNode;
}

/** Whether every row is named by a compass point: the compass can pick them; sixteen facings, or numbered ones, are picked by a slider. */
const onCompass = (directions: string[]) => directions.every((name) => COMPASS.flat().includes(name));

export function Inspector({ player, asset, directionIndex, onDirection, onHighlight, top }: Props) {
  const { atlas, kind, directions, frames, fps, atlasFps, fpsOverride, setFpsOverride, index, seek } = player;
  const eventList = eventsOf(atlas);
  const sheetFrames = kind === 'sheet' && atlas ? Object.entries(atlas.frames) : [];

  return (
    <div className="h-full min-h-0 overflow-y-auto border-l bg-card/40">
      {top}
      {kind === 'animated' && frames.length > 1 && (
        <Section title="Reprodução">
          <Field>
            <FieldLabel htmlFor="preview-fps">FPS</FieldLabel>
            <div className="flex items-center gap-3">
              <Slider min={1} max={60} step={1} value={[Math.round(fps)]} aria-label="FPS" onValueChange={([value]) => setFpsOverride(value)} />
              <Input
                id="preview-fps"
                type="number"
                min={1}
                max={60}
                className="w-16 font-mono"
                value={Math.round(fps * 10) / 10}
                onChange={(e) => setFpsOverride(Math.max(1, Math.min(60, Number(e.target.value) || 1)))}
              />
              <Button variant="ghost" size="icon" aria-label="Voltar ao FPS do atlas" disabled={fpsOverride === null} onClick={() => setFpsOverride(null)}>
                <RotateCcwIcon />
              </Button>
            </div>
            {fpsOverride !== null && <FieldDescription>Atlas: {atlasFps} fps</FieldDescription>}
          </Field>
        </Section>
      )}

      {directions.length > 1 && !onCompass(directions) && (
        <Section title="Direção">
          <Slider min={0} max={directions.length - 1} step={1} value={[Math.min(directionIndex, directions.length - 1)]} aria-label="Direção" onValueChange={([value]) => onDirection(value)} />
          <FieldDescription>
            <span className="font-mono text-foreground">{directions[Math.min(directionIndex, directions.length - 1)]}</span> · {Math.min(directionIndex, directions.length - 1) + 1} de {directions.length}. <Kbd>↑</Kbd> <Kbd>↓</Kbd> giram.
          </FieldDescription>
        </Section>
      )}

      {directions.length > 1 && onCompass(directions) && (
        <Section title="Direção">
          <ToggleGroup
            type="single"
            variant="outline"
            aria-label="Direção"
            value={String(directionIndex)}
            onValueChange={(value) => value && onDirection(Number(value))}
            className="grid w-fit grid-cols-3 gap-1 self-center"
          >
            {COMPASS.flat().map((name, i) => {
              if (!name) return <span key={i} className="grid place-items-center text-muted-foreground tabular-nums">{directions[directionIndex]}</span>;
              const at = directions.indexOf(name);
              return (
                <ToggleGroupItem key={name} value={at < 0 ? `missing-${name}` : String(at)} disabled={at < 0} className="w-11 data-[state=on]:bg-primary data-[state=on]:text-primary-foreground" title={at < 0 ? `${name} não existe neste asset` : `${name} · ${at + 1}`}>
                  {name}
                </ToggleGroupItem>
              );
            })}
          </ToggleGroup>
          <FieldDescription>
            <Kbd>↑</Kbd> <Kbd>↓</Kbd> ou <Kbd>1</Kbd>–<Kbd>{directions.length}</Kbd>. A linha 1 olha para a câmera (S); cada linha gira no sentido horário.
          </FieldDescription>
        </Section>
      )}

      <Section title="Vista">
        <Field orientation="horizontal">
          <FieldTitle id="preview-zoom-label">Zoom</FieldTitle>
          <ToggleGroup type="single" variant="outline" size="sm" spacing={0} aria-labelledby="preview-zoom-label" value={String(player.zoom)} onValueChange={(value) => value && player.setZoom((value === 'fit' ? 'fit' : Number(value)) as Zoom)}>
            <ToggleGroupItem value="fit">Fit</ToggleGroupItem>
            {ZOOMS.map((z) => <ToggleGroupItem key={z} value={String(z)}>{z}×</ToggleGroupItem>)}
          </ToggleGroup>
        </Field>
        <Field orientation="horizontal">
          <FieldTitle id="preview-backdrop-label">Fundo</FieldTitle>
          <ToggleGroup type="single" variant="outline" size="sm" spacing={0} aria-labelledby="preview-backdrop-label" value={player.backdrop} onValueChange={(value) => value && player.setBackdrop(value as Backdrop)}>
            <ToggleGroupItem value="checker">Xadrez</ToggleGroupItem>
            <ToggleGroupItem value="dark">Escuro</ToggleGroupItem>
            <ToggleGroupItem value="light">Claro</ToggleGroupItem>
          </ToggleGroup>
        </Field>
        <Field orientation="horizontal">
          <Switch id="preview-pivot" checked={player.showPivot} disabled={!atlas?.meta.pivot} onCheckedChange={player.setShowPivot} />
          <FieldLabel htmlFor="preview-pivot">Pivô <Kbd>P</Kbd></FieldLabel>
        </Field>
        <Field orientation="horizontal">
          <Switch id="preview-bounds" checked={player.showBounds} onCheckedChange={player.setShowBounds} />
          <FieldLabel htmlFor="preview-bounds">Bordas do frame <Kbd>G</Kbd></FieldLabel>
        </Field>
      </Section>

      {kind === 'animated' && (
        <Section title={`Eventos${eventList.length ? ` · ${eventList.length}` : ''}`}>
          {eventList.length > 0 ? (
            <ul className="flex max-h-56 flex-col gap-0.5 overflow-auto">
              {eventList.map((event, i) => (
                <li key={`${event.frame}-${event.name}-${i}`}>
                  <Button variant={event.frame === index ? 'secondary' : 'ghost'} size="sm" className="w-full justify-start" onClick={() => seek(event.frame)}>
                    <span className="text-muted-foreground tabular-nums">{String(event.frame).padStart(2, '0')}</span>
                    {event.name}
                  </Button>
                </li>
              ))}
            </ul>
          ) : (
            <FieldDescription>Este clip não declara eventos.</FieldDescription>
          )}
        </Section>
      )}

      {sheetFrames.length > 0 && (
        <Section title={`Frames · ${sheetFrames.length}`}>
          <ul className="flex max-h-56 flex-col gap-0.5 overflow-auto">
            {sheetFrames.map(([name, rect]) => (
              <li key={name}>
                <Button
                  variant="ghost"
                  size="sm"
                  className="w-full justify-between"
                  onMouseEnter={() => onHighlight(name)}
                  onMouseLeave={() => onHighlight(null)}
                  onFocus={() => onHighlight(name)}
                  onBlur={() => onHighlight(null)}
                >
                  <span className="truncate">{name}</span>
                  <span className="text-muted-foreground tabular-nums">{rect.width}×{rect.height}</span>
                </Button>
              </li>
            ))}
          </ul>
        </Section>
      )}

      <Section title="Dados">
        <Info atlas={atlas} asset={asset} frameCount={frames.length} />
      </Section>
    </div>
  );
}

function Info({ atlas, asset, frameCount }: { atlas: Atlas | undefined; asset: AssetFileMeta; frameCount: number }) {
  const meta = atlas?.meta;
  const exportedPath = projectFile(asset.root, asset.project, `assets/${asset.subpath}`);
  const sheetPath = asset.sheet ? projectFile(asset.root, asset.project, `sheets/${asset.sheet}`) : null;
  const rows: Array<[string, string | undefined]> = [
    ['Sheet', meta?.width && meta.height ? `${meta.width}×${meta.height}` : asset.width && asset.height ? `${asset.width}×${asset.height}` : undefined],
    ['Frame', meta?.frameWidth ? `${meta.frameWidth}×${meta.frameHeight}` : undefined],
    ['Frames', meta?.frameCount ? `${meta.frameCount}${meta.directions?.length ? ` × ${meta.directions.length} direções` : ''}` : frameCount > 1 ? String(frameCount) : undefined],
    ['Escala', meta?.scale ? `${meta.scale}×` : undefined],
    ['FPS', meta?.fps ? String(meta.fps) : undefined],
    ['Duração', meta?.data?.seconds ? `${meta.data.seconds.toFixed(2)} s` : undefined],
    ['Pivô', meta?.pivot ? `${meta.pivot.x}, ${meta.pivot.y}` : undefined],
    ['Velocidade', meta?.data?.groundSpeed ? `${meta.data.groundSpeed.toFixed(1)} u/s` : undefined],
    ['Esqueleto', meta?.data?.skeleton],
    ['Clip', meta?.data?.clip],
    ['Loop', meta?.data?.loop === undefined ? undefined : meta.data.loop ? 'sim' : 'não'],
    ['Modificado', formatDate(asset.mtime)],
  ];
  return (
    <>
      <dl className="flex flex-col gap-1.5">
        {rows.filter((r): r is [string, string] => r[1] !== undefined).map(([key, value]) => (
          <div key={key} className="flex justify-between gap-3">
            <dt className="text-muted-foreground">{key}</dt>
            <dd className="text-right tabular-nums">{value}</dd>
          </div>
        ))}
      </dl>
      <div className="flex flex-col gap-1">
        <Button variant="outline" size="sm" className="justify-start font-mono" onClick={() => void copyText(exportedPath, 'Caminho do arquivo')}>
          <span className="truncate">{exportedPath}</span>
        </Button>
        {sheetPath && (
          <Button variant="outline" size="sm" className="justify-start font-mono" onClick={() => void copyText(sheetPath, 'Caminho do .ts')}>
            <span className="truncate">{sheetPath}</span>
          </Button>
        )}
      </div>
    </>
  );
}
