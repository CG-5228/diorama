import NiceModal from '@ebay/nice-modal-react';
import { Link, useLocation, useParams } from '@tanstack/react-router';
import { useIsFetching, useQueryClient } from '@tanstack/react-query';
import { KeyboardIcon, PlusIcon, RefreshCwIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Kbd } from '@/components/ui/kbd';
import { Separator } from '@/components/ui/separator';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { sectionOf } from '@/lib/sections';
import { NovoModal } from '@/modals/novo-modal';
import { ShortcutsModal } from '@/modals/shortcuts-modal';
import { ProjectMenu } from './project-menu';
import { ProjectSwitcher } from './project-switcher';

/** The bar over every page: the app, the project in use (searchable, to switch), what can be done with it, and the actions that are not about one project. */
export function AppHeader() {
  const { project } = useParams({ strict: false });
  const section = useLocation({ select: (location) => sectionOf(location.pathname) });
  const queryClient = useQueryClient();
  const fetching = useIsFetching() > 0;

  return (
    <header className="flex h-12 shrink-0 items-center gap-1 border-b px-3">
      <Link to="/" className="flex items-center gap-2 rounded-md px-1 py-1 outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50" aria-label="Diorama, início">
        <span className="grid size-7 place-items-center rounded-lg bg-primary text-sm font-semibold text-primary-foreground">D</span>
        <span className="font-medium">Diorama</span>
      </Link>
      <Separator orientation="vertical" className="mx-2 h-4" />
      <ProjectSwitcher project={project} section={section} />
      {project && <ProjectMenu project={project} />}

      <div className="ml-auto flex items-center gap-1">
        <Button variant="outline" size="sm" onClick={() => void NiceModal.show(NovoModal, {})}>
          <PlusIcon data-icon="inline-start" />
          Novo
          <Kbd>N</Kbd>
        </Button>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button variant="ghost" size="icon-sm" aria-label="Atualizar catálogo" onClick={() => void queryClient.invalidateQueries()}>
              <RefreshCwIcon className={fetching ? 'animate-spin' : undefined} />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Atualizar catálogo</TooltipContent>
        </Tooltip>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button variant="ghost" size="icon-sm" aria-label="Atalhos" onClick={() => void NiceModal.show(ShortcutsModal)}>
              <KeyboardIcon />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Atalhos <Kbd>?</Kbd></TooltipContent>
        </Tooltip>
      </div>
    </header>
  );
}
