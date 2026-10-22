import { PauseIcon, PlayIcon, SkipBackIcon, SkipForwardIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import type { Player } from './use-player';

/** Play/pause, frame stepping and a clickable timeline that marks the frames with events. */
export function Transport({ player }: { player: Player }) {
  const { frames, index, playing, setPlaying, seek, events } = player;
  if (frames.length < 2) return null;
  return (
    <div className="flex items-center gap-3 border-t px-4 py-2.5">
      <div className="flex items-center gap-1">
        <Button variant="outline" size="icon" aria-label="Frame anterior (←)" onClick={() => seek(index - 1)}>
          <SkipBackIcon />
        </Button>
        <Button size="icon" aria-label={playing ? 'Pausar (espaço)' : 'Reproduzir (espaço)'} onClick={() => setPlaying(!playing)}>
          {playing ? <PauseIcon /> : <PlayIcon />}
        </Button>
        <Button variant="outline" size="icon" aria-label="Próximo frame (→)" onClick={() => seek(index + 1)}>
          <SkipForwardIcon />
        </Button>
      </div>
      <span className="min-w-16 text-sm tabular-nums">
        {String(index).padStart(2, '0')}
        <span className="text-muted-foreground"> / {frames.length - 1}</span>
      </span>
      <div role="group" aria-label="Frames" className="flex min-w-0 flex-1 gap-0.5">
        {frames.map((_, i) => {
          const names = events.get(i);
          return (
            <Button
              key={i}
              variant={i === index ? 'default' : 'secondary'}
              size="sm"
              title={names?.join(', ') ?? `Frame ${i}`}
              aria-label={`Frame ${i}${names ? `, evento ${names.join(', ')}` : ''}`}
              className={cn('relative h-6 min-w-1 flex-1 px-0 text-[0.625rem] tabular-nums')}
              onClick={() => seek(i)}
            >
              {frames.length <= 24 && i}
              {names && <span className="absolute -top-1 left-1/2 size-1.5 -translate-x-1/2 rounded-full bg-primary ring-2 ring-background" />}
            </Button>
          );
        })}
      </div>
    </div>
  );
}
