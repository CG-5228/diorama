import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { plural } from '@/lib/format';

/** On an asset whose sheet (or the code it imports) changed after its last export. A character card says how many of its animations. */
export function StaleBadge({ count = 1 }: { count?: number }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Badge variant="outline" className="border-warning/40 bg-warning/10 text-warning dark:bg-warning/10">
          {count === 1 ? 'Desatualizado' : plural(count, 'desatualizada', 'desatualizadas')}
        </Badge>
      </TooltipTrigger>
      <TooltipContent>O código em sheets/ ou src/ mudou depois do último export.</TooltipContent>
    </Tooltip>
  );
}
