import { useState } from 'react';
import NiceModal from '@ebay/nice-modal-react';
import { useNavigate } from '@tanstack/react-router';
import { useSuspenseQuery } from '@tanstack/react-query';
import { ChevronsUpDownIcon, FolderPlusIcon } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList, CommandSeparator } from '@/components/ui/command';
import { Kbd } from '@/components/ui/kbd';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { useWindowKeydown } from '@/lib/hotkeys';
import { projectsQuery } from '@/lib/queries';
import { SECTION_PATHS, type Section } from '@/lib/sections';
import { NovoModal } from '@/modals/novo-modal';

/** The project's initial on a small tile: what the switcher shows in place of a logo for each project. */
function ProjectTile({ name }: { name: string }) {
  return <span className="grid size-5 shrink-0 place-items-center rounded-sm bg-muted text-[0.625rem] font-medium uppercase">{name.charAt(0)}</span>;
}

/**
 * The project in use, and a searchable list to switch to another (⌘K): the way organisations are switched in most
 * web apps. Switching keeps the section the user is in (assets, playground, scenery...). The projects come from
 * `projects/` (yours) and `examples/` (the samples that ship with Diorama, marked with an "exemplo" badge).
 */
export function ProjectSwitcher({ project, section }: { project: string | undefined; section: Section }) {
  const { data: projects } = useSuspenseQuery(projectsQuery);
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);

  useWindowKeydown((e) => {
    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
      e.preventDefault();
      setOpen((now) => !now);
    }
  });

  const choose = (name: string) => {
    setOpen(false);
    if (name !== project) void navigate({ to: SECTION_PATHS[section], params: { project: name } });
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="sm" role="combobox" aria-expanded={open} aria-label="Trocar de projeto" className="max-w-64 gap-2">
          {project ? <ProjectTile name={project} /> : null}
          <span className="truncate">{project ?? 'Escolher projeto'}</span>
          <ChevronsUpDownIcon data-icon="inline-end" />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-72 gap-0 p-0">
        <Command>
          <CommandInput placeholder="Buscar projeto…" aria-label="Buscar projeto" />
          <CommandList>
            <CommandEmpty>Nenhum projeto encontrado.</CommandEmpty>
            <CommandGroup heading="Projetos">
              {projects.map((p) => (
                <CommandItem key={p.name} value={p.name} keywords={p.root === 'examples' ? ['exemplo', 'example'] : undefined} data-checked={p.name === project} onSelect={() => choose(p.name)}>
                  <ProjectTile name={p.name} />
                  <span className="truncate">{p.name}</span>
                  {p.root === 'examples' && <Badge variant="outline">exemplo</Badge>}
                  <span className="ml-auto text-muted-foreground tabular-nums">{p.assetCount}</span>
                </CommandItem>
              ))}
            </CommandGroup>
            <CommandSeparator />
            <CommandGroup>
              {/* Always listed: a search that finds nothing is often a project that does not exist yet. */}
              <CommandItem
                forceMount
                value="novo projeto criar"
                onSelect={() => {
                  setOpen(false);
                  void NiceModal.show(NovoModal, { tab: 'new-project' });
                }}
              >
                <FolderPlusIcon />
                Novo projeto
              </CommandItem>
            </CommandGroup>
          </CommandList>
        </Command>
        <div className="flex items-center gap-1 border-t px-2.5 py-1.5 text-muted-foreground">
          <Kbd>⌘K</Kbd> abre e fecha
        </div>
      </PopoverContent>
    </Popover>
  );
}
