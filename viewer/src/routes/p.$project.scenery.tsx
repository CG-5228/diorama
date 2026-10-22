import { createFileRoute } from '@tanstack/react-router';
import { SceneryPending } from '@/components/scenery/scenery-pending';
import { SceneryView } from '@/components/scenery/scenery-view';
import { scenerySearchSchema } from '@/lib/search';

export const Route = createFileRoute('/p/$project/scenery')({
  validateSearch: scenerySearchSchema,
  component: SceneryView,
  pendingComponent: SceneryPending,
});
