import { Fragment, memo, type ComponentType } from 'react';
import { BrickWallIcon, DoorOpenIcon, EraserIcon, MousePointer2Icon, PackageIcon, PaintBucketIcon, PaintbrushIcon, PersonStandingIcon, PipetteIcon } from 'lucide-react';
import { Kbd } from '@/components/ui/kbd';
import { Separator } from '@/components/ui/separator';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { TOOL_GROUPS, TOOL_KEYS, TOOL_LABELS, type Tool } from '@/lib/scenery/labels';

export const TOOL_ICONS: Record<Tool, ComponentType> = {
  floor: PaintbrushIcon,
  wall: BrickWallIcon,
  door: DoorOpenIcon,
  prop: PackageIcon,
  select: MousePointer2Icon,
  fill: PaintBucketIcon,
  erase: EraserIcon,
  pick: PipetteIcon,
  figure: PersonStandingIcon,
};

/** The tools down the left edge of the canvas, grouped as in the painting programs: move, paint, correct. */
export const ToolRail = memo(function ToolRail({ tool, onTool }: { tool: Tool; onTool: (tool: Tool) => void }) {
  return (
    <ToggleGroup
      type="single"
      orientation="vertical"
      size="lg"
      spacing={1}
      aria-label="Ferramentas"
      value={tool}
      onValueChange={(value) => value && onTool(value as Tool)}
      className="h-full w-12 shrink-0 justify-start rounded-none border-r p-1.5"
    >
      {TOOL_GROUPS.map((group, index) => (
        <Fragment key={group[0]}>
          {index > 0 && <Separator className="my-1" />}
          {group.map((name) => {
            const Icon = TOOL_ICONS[name];
            return (
              <Tooltip key={name}>
                <TooltipTrigger asChild>
                  <ToggleGroupItem value={name} aria-label={TOOL_LABELS[name]} className="aria-checked:bg-primary aria-checked:text-primary-foreground">
                    <Icon />
                  </ToggleGroupItem>
                </TooltipTrigger>
                <TooltipContent side="right">{TOOL_LABELS[name]} <Kbd>{TOOL_KEYS[name]}</Kbd></TooltipContent>
              </Tooltip>
            );
          })}
        </Fragment>
      ))}
    </ToggleGroup>
  );
});
