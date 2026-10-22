import { createFileRoute } from '@tanstack/react-router';
import { PlaygroundView } from '@/components/playground/playground-view';
import { scenerySearchSchema } from '@/lib/search';

export const Route = createFileRoute('/p/$project/playground')({
  validateSearch: scenerySearchSchema,
  component: PlaygroundView,
});
