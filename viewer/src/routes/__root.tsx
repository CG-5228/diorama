import NiceModal from '@ebay/nice-modal-react';
import { createRootRouteWithContext, ErrorComponent, Link, Outlet, useRouter } from '@tanstack/react-router';
import type { QueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Toaster } from '@/components/ui/sonner';
import { TooltipProvider } from '@/components/ui/tooltip';
import { assetsQuery, projectsQuery } from '@/lib/queries';
import { isTyping, useWindowKeydown } from '@/lib/hotkeys';
import { AppHeader } from '@/components/app-header';
import { NovoModal } from '@/modals/novo-modal';
import { ShortcutsModal } from '@/modals/shortcuts-modal';

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  loader: ({ context: { queryClient } }) =>
    Promise.all([queryClient.ensureQueryData(projectsQuery), queryClient.ensureQueryData(assetsQuery)]),
  component: Shell,
  errorComponent: ({ error }) => {
    const router = useRouter();
    return (
      <div className="mx-auto flex max-w-lg flex-col items-start gap-3 px-5 py-[15vh]">
        <h1 className="text-base font-semibold">Não foi possível carregar o catálogo</h1>
        <ErrorComponent error={error} />
        <p className="text-muted-foreground">O servidor do viewer precisa estar rodando (<code>npm run view</code>).</p>
        <Button onClick={() => void router.invalidate()}>Tentar de novo</Button>
      </div>
    );
  },
  notFoundComponent: () => (
    <div className="mx-auto flex max-w-lg flex-col items-start gap-3 px-5 py-[15vh]">
      <h1 className="text-base font-semibold">Página não encontrada</h1>
      <Button variant="outline" asChild>
        <Link to="/">Voltar ao início</Link>
      </Button>
    </div>
  ),
});

function Shell() {
  useWindowKeydown((e) => {
    if (e.metaKey || e.ctrlKey || e.altKey || isTyping(e.target)) return;
    if (document.querySelector('[role="dialog"], [role="alertdialog"]')) return;
    if (e.key === 'n' || e.key === 'N') {
      e.preventDefault();
      void NiceModal.show(NovoModal, {});
    } else if (e.key === '?') {
      e.preventDefault();
      void NiceModal.show(ShortcutsModal);
    }
  });

  return (
    <TooltipProvider>
      {/* The one place modals are mounted: any component can open one with NiceModal.show(). */}
      <NiceModal.Provider>
        <div className="flex h-svh min-w-0 flex-col overflow-hidden">
          <AppHeader />
          <main className="flex min-h-0 flex-1 flex-col">
            <Outlet />
          </main>
        </div>
        <Toaster />
      </NiceModal.Provider>
    </TooltipProvider>
  );
}
