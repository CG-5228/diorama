import { createFileRoute } from '@tanstack/react-router';
import { CustomizePending } from '@/components/customize/customize-pending';
import { CustomizeView } from '@/components/customize/customize-view';
import { customizeSearchSchema } from '@/lib/search';

export const Route = createFileRoute('/p/$project/customize')({
  validateSearch: customizeSearchSchema,
  component: CustomizeView,
  pendingComponent: CustomizePending,
});
