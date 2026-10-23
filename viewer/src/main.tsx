import './styles/app.css';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { RouterProvider } from '@tanstack/react-router';
import { QueryClientProvider } from '@tanstack/react-query';
import { I18nProvider } from './i18n';
import { queryClient } from './lib/query-client';
import { router } from './router';

// The dev server tells us when an export, a source file or a delete changed the catalog.
if (import.meta.hot) {
  import.meta.hot.on('diorama:update', () => {
    void queryClient.invalidateQueries();
  });
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <I18nProvider>
      <QueryClientProvider client={queryClient}>
        <RouterProvider router={router} />
      </QueryClientProvider>
    </I18nProvider>
  </StrictMode>,
);
