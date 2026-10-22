import { createRouter } from '@tanstack/react-router';
import { queryClient } from './lib/query-client';
import { routeTree } from './routeTree.gen';

export const router = createRouter({
  routeTree,
  basepath: '/viewer',
  context: { queryClient },
  // Query owns the cache; the router only preloads what the next route needs.
  defaultPreload: 'intent',
  defaultPreloadStaleTime: 0,
});

declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router;
  }
}
