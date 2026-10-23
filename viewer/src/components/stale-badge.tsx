import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { useT } from '@/i18n';

/** On an asset whose sheet (or the code it imports) changed after its last export. A character card says how many of its animations. */
export function StaleBadge({ count = 1 }: { count?: number }) {
  const { t, plural } = useT();
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Badge variant="outline" className="border-warning/40 bg-warning/10 text-warning dark:bg-warning/10">
          {count === 1 ? t('assets.stale.label') : plural('assets.stale.count', count)}
        </Badge>
      </TooltipTrigger>
      <TooltipContent>{t('assets.stale.hint')}</TooltipContent>
    </Tooltip>
  );
}
