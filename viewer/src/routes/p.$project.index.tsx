import { createFileRoute, stripSearchParams } from '@tanstack/react-router';
import { assetsSearchDefaults, assetsSearchSchema } from '@/lib/search';
import { AssetsView } from '@/components/assets-view';
import { Skeleton } from '@/components/ui/skeleton';

export const Route = createFileRoute('/p/$project/')({
  validateSearch: assetsSearchSchema,
  search: { middlewares: [stripSearchParams(assetsSearchDefaults)] },
  component: AssetsView,
  pendingComponent: () => (
    <div className="grid grid-cols-[repeat(auto-fill,minmax(11rem,1fr))] gap-3 p-4">
      {Array.from({ length: 8 }, (_, i) => <Skeleton key={i} className="aspect-3/4" />)}
    </div>
  ),
});
