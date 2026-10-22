import { memo } from 'react';
import { heightsOf, type SceneryCatalog, type SpaceHeight } from '@core/volume';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { pieceOf, type EraseLayer } from '@/lib/scenery/edit';
import { ERASE_LABELS, GROUP_LABELS, TOOL_HINTS, TOOL_LABELS, type Tool } from '@/lib/scenery/labels';
import { canFlip } from '@/lib/scenery/edit';
import { FacingControl, HeightSelect, SideControl, StateSelect, VariantSelect } from './prop-fields';
import { PieceThumb } from './piece-thumb';
import { TOOL_ICONS } from './tool-rail';
import type { Brush } from './scene-canvas';

const ERASE_LAYERS: EraseLayer[] = ['all', 'floor', 'walls', 'props'];

interface Props {
  catalog: SceneryCatalog;
  tool: Tool;
  brush: Brush;
  eraseLayer: EraseLayer;
  onEraseLayer: (layer: EraseLayer) => void;
  propDir: number;
  propVariant: number | undefined;
  onPropDir: (dir: number) => void;
  onPropVariant: (variant: number | undefined) => void;
  /** The resting state a prop or door is placed in; undefined for the piece's first. */
  placeState: string | undefined;
  onPlaceState: (state: string | undefined) => void;
  /** Doors are put turned to their other side. */
  doorFlip: boolean;
  onDoorFlip: (flip: boolean) => void;
  /** The height walls are painted at; undefined for the piece's default. */
  wallHeight: SpaceHeight | undefined;
  onWallHeight: (height: SpaceHeight | undefined) => void;
}

/**
 * The bar under the toolbar: what the tool in use is armed with (the piece, its facing and variant, the eraser's layer)
 * and how to use it. One line of a fixed height whatever the tool: the canvas below must not move when the tool changes,
 * or the cell under the pointer changes with it. A narrow panel scrolls the controls and cuts the hint (in full in its tooltip).
 */
export const ToolOptions = memo(function ToolOptions({ catalog, tool, brush, eraseLayer, onEraseLayer, propDir, propVariant, onPropDir, onPropVariant, placeState, onPlaceState, doorFlip, onDoorFlip, wallHeight, onWallHeight }: Props) {
  const Icon = TOOL_ICONS[tool];
  const id = tool === 'floor' || tool === 'fill' ? brush.floor : tool === 'wall' ? brush.wall : tool === 'door' ? brush.door : tool === 'prop' ? brush.prop : null;
  const info = id ? pieceOf(catalog, id) : undefined;
  const facings = tool === 'prop' ? (info?.directions ?? 1) : 1;
  const variants = tool === 'prop' ? (info?.variants ?? 1) : 1;
  // A piece with resting states is put down in the one chosen here (a door open or shut, an urn whole or broken).
  const states = (tool === 'prop' || tool === 'door') && info?.states && info.states.length > 1 ? info.states : [];
  // A wall or fence that comes in several heights: the brush paints at the one chosen here.
  const heights = tool === 'wall' && info?.heights && info.heights.length > 1 ? info.heights : [];

  return (
    <div className="flex h-12 shrink-0 items-center gap-4 overflow-x-auto border-b bg-muted/20 px-3 [scrollbar-width:none]">
      <div className="flex shrink-0 items-center gap-4">
      <span className="flex items-center gap-1.5 font-medium whitespace-nowrap">
        <Icon />
        {TOOL_LABELS[tool]}
      </span>

      {(tool === 'floor' || tool === 'wall' || tool === 'door' || tool === 'prop' || tool === 'fill') &&
        (info ? (
          <span className="flex items-center gap-2">
            <PieceThumb catalog={catalog} info={info} size="sm" />
            <span className="flex max-w-48 flex-col leading-tight">
              <span className="truncate">{info.label}</span>
              <span className="truncate text-muted-foreground">{GROUP_LABELS[info.group]}</span>
            </span>
          </span>
        ) : (
          <span className="whitespace-nowrap text-muted-foreground">Escolha uma peça no painel.</span>
        ))}

      {facings > 1 && <FacingControl count={facings} value={propDir} onTurn={(by) => onPropDir((((propDir + by) % facings) + facings) % facings)} />}
      {tool === 'door' && info && canFlip(info) && <SideControl flipped={doorFlip} onFlip={() => onDoorFlip(!doorFlip)} />}
      {states.length > 0 && <StateSelect states={states} value={placeState} onChange={onPlaceState} className="w-36" />}
      {variants > 1 && info && <VariantSelect count={variants} labels={info.variantLabels} value={propVariant} onChange={onPropVariant} className="w-36" />}

      {heights.length > 0 && info && <HeightSelect heights={heights} units={heightsOf(info, catalog)} value={wallHeight} onChange={onWallHeight} className="w-44" />}

      {tool === 'erase' && (
        <ToggleGroup type="single" variant="outline" size="sm" spacing={0} aria-label="Camada da borracha" value={eraseLayer} onValueChange={(value) => value && onEraseLayer(value as EraseLayer)}>
          {ERASE_LAYERS.map((layer) => <ToggleGroupItem key={layer} value={layer}>{ERASE_LABELS[layer]}</ToggleGroupItem>)}
        </ToggleGroup>
      )}

      </div>

      <Tooltip>
        <TooltipTrigger asChild>
          <span className="min-w-8 flex-1 truncate text-right text-muted-foreground">{TOOL_HINTS[tool]}</span>
        </TooltipTrigger>
        <TooltipContent className="max-w-sm">{TOOL_HINTS[tool]}</TooltipContent>
      </Tooltip>
    </div>
  );
});
