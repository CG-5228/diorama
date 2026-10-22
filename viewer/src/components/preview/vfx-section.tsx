import { useMemo, useState } from 'react';
import { ArrowUpRightIcon } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Field, FieldDescription, FieldLabel } from '@/components/ui/field';
import { Switch } from '@/components/ui/switch';
import type { EffectMeta } from '@/lib/atlas';
import { roleOf } from '@/lib/asset-role';
import { basename, stripExtension } from '@/lib/format';
import type { AssetFileMeta } from '@/lib/types';
import { usePref } from '@/lib/use-pref';
import { Section } from './inspector';
import type { Player } from './use-player';

/** A projectile flying across the stage at its own speed: `speed` and `range` in exported px (at the sheet's scale), `heading` a screen angle. */
export interface Flight {
  speed: number;
  range: number;
  heading: number;
  /** The camera's tilt in degrees: the depth part of the flight shrinks by its sine, as a character's walk does. */
  tilt: number;
}

/** The camera tilt assumed for an effect sheet, which does not carry one. */
const TILT = 48;

/** What the preview of an effect adds to the player: its reach as a ring, and for a projectile its flight. */
export function useVfx(player: Player, directionIndex: number) {
  const { atlas } = player;
  const effect: EffectMeta | null = atlas?.meta.data?.role === 'vfx' ? (atlas.meta.data.effect ?? null) : null;
  const [ring, setRing] = usePref<boolean>('preview.vfx.ring', true);
  const [flying, setFlying] = useState(false);
  const scale = atlas?.meta.scale ?? 1;
  const speed = effect?.travel?.speed;
  const range = effect?.travel?.range;
  const heading = atlas?.meta.directionFacings?.[directionIndex] ?? Math.PI / 2;
  // Memoized by its numbers: the player renders at every frame of the effect, and a new object each time would restart the flight.
  const flight = useMemo<Flight | null>(() => (flying && speed !== undefined ? { speed: speed * scale, range: (range ?? 150) * scale, heading, tilt: TILT } : null), [flying, speed, range, scale, heading]);
  return { effect, ring, setRing, flying, setFlying, ringRadius: ring && effect ? effect.size * scale : null, flight };
}

export type Vfx = ReturnType<typeof useVfx>;

const KIND_LABELS: Record<string, string> = { projectile: 'Projétil', impact: 'Impacto', cast: 'Conjuração', aura: 'Aura', area: 'Área', burst: 'Explosão', trail: 'Rastro' };

/** What an effect sheet says about the effect: kind, layer, reach, speed, what follows it; and the toggles of the preview. */
export function VfxSection({ vfx, projectAssets, onSelect }: { vfx: Vfx; projectAssets: AssetFileMeta[]; onSelect: (asset: AssetFileMeta) => void }) {
  const { effect } = vfx;
  if (!effect) return null;
  const followed = effect.follows ? projectAssets.find((a) => roleOf(a) === 'vfx' && basename(stripExtension(a.subpath)) === effect.follows) : undefined;
  const rows: Array<[string, string | undefined]> = [
    ['Camada', effect.layer === 'ground' ? 'chão (sob tudo)' : 'ar (ordenado)'],
    ['Chão abaixo da origem', `${effect.height} u`],
    ['Alcance (raio)', `${effect.size} u`],
    ['Loop', effect.loop ? 'sim' : 'não'],
    ['Velocidade', effect.travel ? `${effect.travel.speed} u/s` : undefined],
    ['Distância máxima', effect.travel ? (effect.travel.range !== undefined ? `${effect.travel.range} u` : undefined) : undefined],
  ];
  return (
    <Section title="Efeito">
      <div className="flex flex-wrap items-center gap-2">
        <Badge>{KIND_LABELS[effect.kind] ?? effect.kind}</Badge>
        {effect.label && <span className="truncate font-medium">{effect.label}</span>}
      </div>
      <dl className="flex flex-col gap-1.5">
        {rows.filter((r): r is [string, string] => r[1] !== undefined).map(([key, value]) => (
          <div key={key} className="flex justify-between gap-3">
            <dt className="text-muted-foreground">{key}</dt>
            <dd className="text-right tabular-nums">{value}</dd>
          </div>
        ))}
      </dl>
      {effect.follows && (
        <Button variant="outline" size="sm" className="justify-between" disabled={!followed} onClick={() => followed && onSelect(followed)}>
          <span className="truncate">Depois: {effect.follows}</span>
          <ArrowUpRightIcon data-icon="inline-end" />
        </Button>
      )}
      <Field orientation="horizontal">
        <Switch id="preview-vfx-ring" checked={vfx.ring} onCheckedChange={vfx.setRing} />
        <FieldLabel htmlFor="preview-vfx-ring">Anel do alcance</FieldLabel>
      </Field>
      {effect.travel && (
        <Field orientation="horizontal">
          <Switch id="preview-vfx-flight" checked={vfx.flying} onCheckedChange={vfx.setFlying} />
          <FieldLabel htmlFor="preview-vfx-flight">Simular o voo</FieldLabel>
        </Field>
      )}
      {vfx.flying && effect.travel && <FieldDescription>Voa a {effect.travel.speed} u/s na direção escolhida; a profundidade encolhe pelo seno da inclinação.</FieldDescription>}
    </Section>
  );
}
