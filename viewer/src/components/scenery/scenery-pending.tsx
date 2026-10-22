import { Skeleton } from '@/components/ui/skeleton';

/** Shown while the kit and the engine load. Kept apart from the view: the router keeps it in the route's own chunk, and the view (with the engine) must stay in a lazy one. */
export function SceneryPending() {
  return (
    <div className="flex min-h-0 flex-1">
      <div className="flex w-72 flex-col gap-3 border-r p-3">
        <Skeleton className="h-8" />
        <Skeleton className="h-16" />
        <Skeleton className="h-16" />
        <Skeleton className="h-16" />
      </div>
      <Skeleton className="m-4 flex-1" />
    </div>
  );
}
