import type { ReactNode } from 'react';
import { EyeIcon, EyeOffIcon, GridIcon, KeyboardIcon, MinusIcon, RouteIcon, PanelRightCloseIcon, PanelRightOpenIcon, PlusIcon, Redo2Icon, SaveIcon, Undo2Icon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ButtonGroup, ButtonGroupText } from '@/components/ui/button-group';
import { Kbd, KbdGroup } from '@/components/ui/kbd';
import { Popover, PopoverContent, PopoverHeader, PopoverTitle, PopoverTrigger } from '@/components/ui/popover';
import { Toggle } from '@/components/ui/toggle';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import type { Layer } from '@/lib/scenery/edit';
import { LAYER_LABELS, TOOL_KEYS, TOOL_LABELS, type Tool } from '@/lib/scenery/labels';

const LAYERS: Layer[] = ['floor', 'walls', 'props'];
const ZOOMS = [1, 2, 3, 4];

interface Props {
  /** The scene menu: what is open comes first on the bar. */
  leading: ReactNode;
  visible: Record<Layer, boolean>;
  onVisible: (layer: Layer, on: boolean) => void;
  zoom: number;
  onZoom: (zoom: number) => void;
  grid: boolean;
  onGrid: (on: boolean) => void;
  /** Shows where characters can go (the scene's navigation) over the drawing. */
  navigation: boolean;
  onNavigation: (on: boolean) => void;
  canUndo: boolean;
  canRedo: boolean;
  onUndo: () => void;
  onRedo: () => void;
  onSave: () => void;
  panelOpen: boolean;
  onPanel: (open: boolean) => void;
}

const SHORTCUTS: { keys: string[]; what: string }[] = [
  { keys: ['⌘Z'], what: 'Desfazer' },
  { keys: ['⇧⌘Z'], what: 'Refazer' },
  { keys: ['R'], what: 'Girar o prop (⇧R, no outro sentido) ou virar o lado da porta' },
  { keys: ['⌫'], what: 'Excluir o que está selecionado (prop, parede, figura ou chão)' },
  { keys: ['⌘D'], what: 'Duplicar o prop selecionado' },
  { keys: ['←', '↑', '→', '↓'], what: 'Empurrar o prop, a parede ou a figura selecionados' },
  { keys: ['Esc'], what: 'Tirar a seleção' },
  { keys: ['G'], what: 'Mostrar ou esconder a grade' },
  { keys: ['Tab'], what: 'Mostrar ou esconder o painel de peças' },
  { keys: ['−', '+'], what: 'Zoom' },
  { keys: ['Espaço'], what: 'Segure e arraste para mover a vista' },
  { keys: ['⇧'], what: 'Com o pincel: linha reta desde o último ponto' },
  { keys: ['⌥'], what: 'Com qualquer ferramenta: conta-gotas' },
];

/** The scene, undo, which layers are shown, zoom, grid, the piece panel, the shortcut list and save. The tools themselves are in the rail. A single line of a fixed height: the canvas below never moves. When the bar is narrow the layers and save lose their words, and what still does not fit scrolls. */
export function SceneToolbar(p: Props) {
  return (
    <div className="@container flex h-12 shrink-0 items-center gap-3 overflow-x-auto border-b px-3 [scrollbar-width:none]">
      <div className="shrink-0">{p.leading}</div>
      <ButtonGroup aria-label="Histórico" className="shrink-0">
        <Tooltip>
          <TooltipTrigger asChild>
            <Button variant="outline" size="icon-sm" aria-label="Desfazer" disabled={!p.canUndo} onClick={p.onUndo}><Undo2Icon /></Button>
          </TooltipTrigger>
          <TooltipContent>Desfazer <Kbd>⌘Z</Kbd></TooltipContent>
        </Tooltip>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button variant="outline" size="icon-sm" aria-label="Refazer" disabled={!p.canRedo} onClick={p.onRedo}><Redo2Icon /></Button>
          </TooltipTrigger>
          <TooltipContent>Refazer <Kbd>⇧⌘Z</Kbd></TooltipContent>
        </Tooltip>
      </ButtonGroup>

      <ToggleGroup
        type="multiple"
        variant="outline"
        size="sm"
        spacing={0}
        className="shrink-0"
        aria-label="Camadas visíveis"
        value={LAYERS.filter((layer) => p.visible[layer])}
        onValueChange={(next) => LAYERS.forEach((layer) => next.includes(layer) !== p.visible[layer] && p.onVisible(layer, next.includes(layer)))}
      >
        {LAYERS.map((layer) => (
          <ToggleGroupItem key={layer} value={layer} aria-label={`${p.visible[layer] ? 'Esconder' : 'Mostrar'} ${LAYER_LABELS[layer].toLowerCase()}`} title={LAYER_LABELS[layer]}>
            {p.visible[layer] ? <EyeIcon data-icon="inline-start" /> : <EyeOffIcon data-icon="inline-start" />}
            <span className="hidden @3xl:inline">{LAYER_LABELS[layer]}</span>
          </ToggleGroupItem>
        ))}
      </ToggleGroup>

      <div className="ml-auto flex shrink-0 items-center gap-2">
        <ButtonGroup aria-label="Zoom">
          <Button variant="outline" size="icon-sm" aria-label="Diminuir o zoom" disabled={p.zoom <= ZOOMS[0]} onClick={() => p.onZoom(p.zoom - 1)}><MinusIcon /></Button>
          <Tooltip>
            <TooltipTrigger asChild>
              <ButtonGroupText className="min-w-9 justify-center tabular-nums">{p.zoom}×</ButtonGroupText>
            </TooltipTrigger>
            <TooltipContent>Zoom · <Kbd>Ctrl</Kbd> + roda</TooltipContent>
          </Tooltip>
          <Button variant="outline" size="icon-sm" aria-label="Aumentar o zoom" disabled={p.zoom >= ZOOMS.at(-1)!} onClick={() => p.onZoom(p.zoom + 1)}><PlusIcon /></Button>
        </ButtonGroup>

        <Tooltip>
          <TooltipTrigger asChild>
            <Toggle variant="outline" pressed={p.grid} onPressedChange={p.onGrid} aria-label="Grade"><GridIcon /></Toggle>
          </TooltipTrigger>
          <TooltipContent>Grade <Kbd>G</Kbd></TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger asChild>
            <Toggle variant="outline" pressed={p.navigation} onPressedChange={p.onNavigation} aria-label="Navegação"><RouteIcon /></Toggle>
          </TooltipTrigger>
          <TooltipContent>Navegação: onde os personagens andam (vermelho bloqueia, âmbar é lento)</TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger asChild>
            <Toggle variant="outline" pressed={p.panelOpen} onPressedChange={p.onPanel} aria-label="Painel de peças">
              {p.panelOpen ? <PanelRightCloseIcon /> : <PanelRightOpenIcon />}
            </Toggle>
          </TooltipTrigger>
          <TooltipContent>Painel de peças <Kbd>Tab</Kbd></TooltipContent>
        </Tooltip>

        <Popover>
          <Tooltip>
            <TooltipTrigger asChild>
              <PopoverTrigger asChild>
                <Button variant="outline" size="icon-sm" aria-label="Atalhos"><KeyboardIcon /></Button>
              </PopoverTrigger>
            </TooltipTrigger>
            <TooltipContent>Atalhos</TooltipContent>
          </Tooltip>
          <PopoverContent align="end" className="max-h-(--radix-popover-content-available-height) w-80 overflow-y-auto">
            <PopoverHeader>
              <PopoverTitle>Atalhos do construtor</PopoverTitle>
            </PopoverHeader>
            <dl className="grid grid-cols-[auto_1fr] items-center gap-x-3 gap-y-1.5">
              {(Object.keys(TOOL_LABELS) as Tool[]).map((tool) => (
                <div key={tool} className="col-span-2 grid grid-cols-subgrid items-center">
                  <dt><Kbd>{TOOL_KEYS[tool]}</Kbd></dt>
                  <dd className="text-muted-foreground">{TOOL_LABELS[tool]}</dd>
                </div>
              ))}
              {SHORTCUTS.map(({ keys, what }) => (
                <div key={what} className="col-span-2 grid grid-cols-subgrid items-center">
                  <dt><KbdGroup>{keys.map((key) => <Kbd key={key}>{key}</Kbd>)}</KbdGroup></dt>
                  <dd className="text-muted-foreground">{what}</dd>
                </div>
              ))}
              <div className="col-span-2 grid grid-cols-subgrid items-center">
                <dt><Kbd>Botão direito</Kbd></dt>
                <dd className="text-muted-foreground">Apaga na camada do pincel</dd>
              </div>
            </dl>
          </PopoverContent>
        </Popover>

        <Button size="sm" aria-label="Salvar cena" title="Salvar cena" onClick={p.onSave}>
          <SaveIcon data-icon="inline-start" />
          <span className="hidden @2xl:inline">Salvar cena</span>
        </Button>
      </div>
    </div>
  );
}
