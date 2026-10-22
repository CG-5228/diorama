import NiceModal from '@ebay/nice-modal-react';
import { useSuspenseQuery } from '@tanstack/react-query';
import { CopyIcon, MoreHorizontalIcon, PlusIcon, Trash2Icon, UploadIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuGroup, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { copyText } from '@/lib/clipboard';
import { projectDir } from '@/lib/project-paths';
import { projectsQuery } from '@/lib/queries';
import { DeleteProjectModal } from '@/modals/delete-project-modal';
import { NovoModal } from '@/modals/novo-modal';

/**
 * What can be done with the project in use: add an asset, export it, copy its path, delete it. The samples in
 * `examples/` ship with Diorama: they cannot be deleted from here.
 */
export function ProjectMenu({ project }: { project: string }) {
  const { data: projects } = useSuspenseQuery(projectsQuery);
  const meta = projects.find((p) => p.name === project);
  const root = meta?.root ?? 'projects';
  return (
    <DropdownMenu>
      <Tooltip>
        <TooltipTrigger asChild>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon-sm" aria-label={`Ações do projeto ${project}`}>
              <MoreHorizontalIcon />
            </Button>
          </DropdownMenuTrigger>
        </TooltipTrigger>
        <TooltipContent>Ações do projeto</TooltipContent>
      </Tooltip>
      <DropdownMenuContent align="start" className="w-56">
        <DropdownMenuGroup>
          <DropdownMenuItem onSelect={() => void NiceModal.show(NovoModal, { tab: 'new-asset', project })}>
            <PlusIcon />
            Novo asset
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={() => void NiceModal.show(NovoModal, { tab: 'export', project })}>
            <UploadIcon />
            Exportar projeto
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={() => void copyText(projectDir(root, project), 'Caminho do projeto')}>
            <CopyIcon />
            Copiar caminho
          </DropdownMenuItem>
        </DropdownMenuGroup>
        {root === 'projects' && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuGroup>
              <DropdownMenuItem variant="destructive" onSelect={() => void NiceModal.show(DeleteProjectModal, { project })}>
                <Trash2Icon />
                Apagar projeto…
              </DropdownMenuItem>
            </DropdownMenuGroup>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
