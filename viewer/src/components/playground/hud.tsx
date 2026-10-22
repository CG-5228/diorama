import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Kbd } from '@/components/ui/kbd';
import type { HudInfo } from '@/lib/playground/actor';

const stateLabel: Record<HudInfo['state'], string> = { idle: 'parado', moving: 'movendo', action: 'ação', hold: 'travado (hold)' };

/** What the controlled character is playing: the clip, its frame and the last event it fired; with a scene, the last thing a piece of it did, and what E would use. */
export function Hud({ info, onUse }: { info: HudInfo | null; onUse: () => void }) {
  if (!info) return null;
  return (
    <Card size="sm" className="pointer-events-none absolute bottom-3 left-3 w-56 gap-1 bg-card/60">
      <CardContent>
        <dl className="flex flex-col gap-1">
          <div className="flex items-center justify-between gap-2">
            <dt className="text-muted-foreground">Clip</dt>
            <dd className="flex items-center gap-1.5">
              <span className="font-medium">{info.clip}</span>
              <Badge variant="outline">{info.kind}</Badge>
            </dd>
          </div>
          <div className="flex items-center justify-between gap-2">
            <dt className="text-muted-foreground">Estado</dt>
            <dd>{stateLabel[info.state]} · {info.direction}</dd>
          </div>
          <div className="flex items-center justify-between gap-2">
            <dt className="text-muted-foreground">Frame</dt>
            <dd className="font-mono tabular-nums">f{info.frame} / f{info.frames - 1}</dd>
          </div>
          <div className="flex items-center justify-between gap-2">
            <dt className="text-muted-foreground">Evento</dt>
            <dd className="truncate font-mono">{info.event ?? '—'}</dd>
          </div>
          {info.world && (
            <div className="flex items-center justify-between gap-2">
              <dt className="text-muted-foreground">Cenário</dt>
              <dd className="truncate font-mono">{info.scene ?? '—'}</dd>
            </div>
          )}
        </dl>
        {info.use && (
          <Button size="sm" className="pointer-events-auto mt-2 w-full" onClick={onUse}>
            {info.use} <Kbd>E</Kbd>
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
