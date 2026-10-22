import { useEffect } from 'react';
import NiceModal from '@ebay/nice-modal-react';
import { createFileRoute, Link, notFound, Outlet, useLocation } from '@tanstack/react-router';
import { useSuspenseQuery } from '@tanstack/react-query';
import { PlusIcon, UploadIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { assetsQuery, projectsQuery } from '@/lib/queries';
import { formatBytes, plural } from '@/lib/format';
import { sectionOf } from '@/lib/sections';
import { NovoModal } from '@/modals/novo-modal';

export const Route = createFileRoute('/p/$project')({
  beforeLoad: async ({ params, context: { queryClient } }) => {
    const known = (await queryClient.ensureQueryData(projectsQuery)).some((p) => p.name === params.project);
    // A project created moments ago (by an agent, say) may not be in the cached list yet.
    const found = known || (await queryClient.fetchQuery({ ...projectsQuery, staleTime: 0 })).some((p) => p.name === params.project);
    if (!found) throw notFound();
  },
  component: ProjectLayout,
  notFoundComponent: () => (
    <div className="mx-auto flex max-w-lg flex-col items-start gap-3 px-5 py-[15vh]">
      <h1 className="text-base font-semibold">Projeto não encontrado</h1>
      <Button variant="outline" asChild>
        <Link to="/">Voltar ao início</Link>
      </Button>
    </div>
  ),
});

function ProjectLayout() {
  const { project } = Route.useParams();
  const { data: projects } = useSuspenseQuery(projectsQuery);
  const { data: assets } = useSuspenseQuery(assetsQuery);
  const meta = projects.find((p) => p.name === project);
  const pathname = useLocation({ select: (location) => location.pathname });
  const section = sectionOf(pathname);

  useEffect(() => {
    try {
      localStorage.setItem('diorama:lastProject', project);
    } catch {
      // Remembering the last project is a convenience only.
    }
  }, [project]);

  if (!meta) return null;
  const count = assets.filter((a) => a.project === project).length;

  return (
    <>
      <header className="flex items-center gap-4 border-b px-4 pt-1.5">
        <Tabs value={section} className="min-w-0 overflow-x-auto">
          <TabsList variant="line" aria-label="Seções do projeto">
            <TabsTrigger value="assets" asChild>
              <Link to="/p/$project" params={{ project }}>
                Assets <span className="text-muted-foreground tabular-nums">{count}</span>
              </Link>
            </TabsTrigger>
            <TabsTrigger value="playground" asChild>
              <Link to="/p/$project/playground" params={{ project }}>Playground</Link>
            </TabsTrigger>
            <TabsTrigger value="customize" asChild>
              <Link to="/p/$project/customize" params={{ project }}>Customizar</Link>
            </TabsTrigger>
            <TabsTrigger value="scenery" asChild>
              <Link to="/p/$project/scenery" params={{ project }}>Cenário</Link>
            </TabsTrigger>
          </TabsList>
        </Tabs>
        <span className="ml-auto text-xs whitespace-nowrap text-muted-foreground tabular-nums max-xl:hidden">
          {plural(count, 'asset', 'assets')} · {formatBytes(meta.totalSize)} · {plural(meta.sheetCount, 'sheet', 'sheets')}
        </span>
        <div className="flex shrink-0 items-center gap-2 pb-1.5 max-xl:ml-auto">
          <Button variant="outline" size="sm" onClick={() => void NiceModal.show(NovoModal, { tab: 'export', project })}>
            <UploadIcon data-icon="inline-start" />
            Exportar
          </Button>
          <Button size="sm" onClick={() => void NiceModal.show(NovoModal, { tab: 'new-asset', project })}>
            <PlusIcon data-icon="inline-start" />
            Novo asset
          </Button>
        </div>
      </header>
      <div className="flex min-h-0 flex-1 flex-col">
        <Outlet />
      </div>
    </>
  );
}
