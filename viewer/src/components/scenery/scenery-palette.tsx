import { memo, useMemo, useState } from 'react';
import type { ScenePieceInfo, SceneryCatalog } from '@core/volume';
import { SearchIcon } from 'lucide-react';
import { Field, FieldTitle } from '@/components/ui/field';
import { InputGroup, InputGroupAddon, InputGroupInput } from '@/components/ui/input-group';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { footprintOf, pieceOf } from '@/lib/scenery/edit';
import { GROUP_LABELS, GROUP_ORDER, brushOf, type Tool } from '@/lib/scenery/labels';
import { cn } from '@/lib/utils';
import { PieceThumb } from './piece-thumb';
import type { Brush } from './scene-canvas';

interface Props {
  catalog: SceneryCatalog;
  /** The piece armed for each painting tool. */
  brush: Brush;
  tool: Tool;
  onChoose: (info: ScenePieceInfo) => void;
  onTool: (tool: Tool) => void;
}

const hintOf = (info: ScenePieceInfo) => {
  const [w, d] = footprintOf(info);
  return [w * d > 1 ? `${w}×${d} células` : '', (info.directions ?? 1) > 1 ? `${info.directions} direções` : '', (info.variants ?? 1) > 1 ? `${info.variants} variações` : ''].filter(Boolean).join(' · ');
};

const SLOTS = [
  { tool: 'floor', label: 'Chão', brush: 'floor' },
  { tool: 'wall', label: 'Parede', brush: 'wall' },
  { tool: 'door', label: 'Porta', brush: 'door' },
  { tool: 'prop', label: 'Prop', brush: 'prop' },
] as const;

/** The brushes at a glance: what each painting tool is armed with (doors only for a kit that has them). Choosing one is picking its tool. */
function BrushStrip({ catalog, brush, tool, onTool }: Pick<Props, 'catalog' | 'brush' | 'tool' | 'onTool'>) {
  const slots = SLOTS.filter((slot) => slot.tool !== 'door' || catalog.pieces.some((p) => p.group === 'door'));
  return (
    <ToggleGroup
      type="single"
      variant="outline"
      spacing={2}
      aria-label="Pincéis"
      value={slots.some((slot) => slot.tool === tool) ? tool : ''}
      onValueChange={(value) => value && onTool(value as Tool)}
      className="grid w-full"
      style={{ gridTemplateColumns: `repeat(${slots.length}, minmax(0, 1fr))` }}
    >
      {slots.map((slot) => {
        const info = brush[slot.brush] ? pieceOf(catalog, brush[slot.brush]!) : undefined;
        return (
          <ToggleGroupItem key={slot.tool} value={slot.tool} aria-label={`Pincel de ${slot.label.toLowerCase()}`} className="h-auto min-w-0 flex-col items-stretch gap-1 p-1.5 aria-checked:border-primary aria-checked:bg-primary/10">
            <span className="text-left text-[0.625rem] text-muted-foreground uppercase">{slot.label}</span>
            {info ? <PieceThumb catalog={catalog} info={info} size="slot" /> : <span className="h-10 rounded-sm bg-muted" />}
            <span className="truncate text-left font-normal">{info?.label ?? 'Nenhum'}</span>
          </ToggleGroupItem>
        );
      })}
    </ToggleGroup>
  );
}

/** One piece of the grid. A tooltip trigger around a toggle takes over its `data-state`, so the armed look reads `aria-checked`. Memoized: choosing a piece re-renders only the cards whose look changed. */
const PieceCard = memo(function PieceCard({ catalog, info, current }: { catalog: SceneryCatalog; info: ScenePieceInfo; current: boolean }) {
  const hint = hintOf(info);
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <ToggleGroupItem
          value={info.id}
          aria-label={info.label}
          className={cn('h-auto min-w-0 flex-col gap-1 p-1 aria-checked:border-primary/50', current && 'aria-checked:border-primary aria-checked:bg-primary/15')}
        >
          <PieceThumb catalog={catalog} info={info} size="card" />
          <span className="line-clamp-2 w-full text-center leading-tight font-normal">{info.label}</span>
        </ToggleGroupItem>
      </TooltipTrigger>
      <TooltipContent side="left">
        {info.label}
        {hint && <span className="block text-background/70">{hint}</span>}
      </TooltipContent>
    </Tooltip>
  );
});

/** The brushes and every piece of the kit by group, drawn by the engine. Choosing one arms it for its tool. */
export const SceneryPalette = memo(function SceneryPalette({ catalog, brush, tool, onChoose, onTool }: Props) {
  const [query, setQuery] = useState('');
  const groups = useMemo(() => {
    const words = query.toLowerCase().split(/\s+/).filter(Boolean);
    return GROUP_ORDER.map((group) => ({
      group,
      pieces: catalog.pieces.filter((p) => p.group === group && words.every((w) => `${p.label} ${p.id} ${GROUP_LABELS[group]}`.toLowerCase().includes(w))),
    })).filter((g) => g.pieces.length > 0);
  }, [catalog, query]);
  const toolNow = tool === 'fill' ? 'floor' : tool;

  return (
    <div className="flex flex-col gap-4">
      <BrushStrip catalog={catalog} brush={brush} tool={tool} onTool={onTool} />
      <InputGroup>
        <InputGroupAddon><SearchIcon /></InputGroupAddon>
        <InputGroupInput aria-label="Buscar peça" placeholder="Buscar peça" value={query} onChange={(e) => setQuery(e.target.value)} />
      </InputGroup>
      {groups.length === 0 && <p className="text-muted-foreground">Nenhuma peça encontrada.</p>}
      {groups.map(({ group, pieces }) => {
        const key = brushOf(group);
        const armed = brush[key] ?? '';
        return (
          <Field key={group} className="min-w-0">
            <FieldTitle>{GROUP_LABELS[group]} <span className="font-normal text-muted-foreground tabular-nums">{pieces.length}</span></FieldTitle>
            <ToggleGroup
              type="single"
              variant="outline"
              spacing={2}
              aria-label={GROUP_LABELS[group]}
              value={armed}
              onValueChange={(id) => {
                const info = pieces.find((p) => p.id === id);
                if (info) onChoose(info);
              }}
              className="grid w-full grid-cols-3 items-stretch"
            >
              {pieces.map((info) => <PieceCard key={info.id} catalog={catalog} info={info} current={toolNow === key} />)}
            </ToggleGroup>
          </Field>
        );
      })}
    </div>
  );
});
