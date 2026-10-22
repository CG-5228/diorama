import NiceModal from '@ebay/nice-modal-react';
import { createFileRoute, redirect } from '@tanstack/react-router';
import { FolderPlusIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from '@/components/ui/empty';
import { projectsQuery } from '@/lib/queries';
import { NovoModal } from '@/modals/novo-modal';

export const Route = createFileRoute('/')({
  beforeLoad: async ({ context: { queryClient } }) => {
    const projects = await queryClient.ensureQueryData(projectsQuery);
    const last = (() => {
      try {
        return localStorage.getItem('diorama:lastProject');
      } catch {
        return null;
      }
    })();
    const target = projects.find((p) => p.name === last) ?? projects[0];
    if (target) throw redirect({ to: '/p/$project', params: { project: target.name }, replace: true });
  },
  component: NoProjects,
});

function NoProjects() {
  return (
    <Empty className="h-full">
      <EmptyHeader>
        <EmptyMedia variant="icon"><FolderPlusIcon /></EmptyMedia>
        <EmptyTitle>Nenhum projeto ainda</EmptyTitle>
        <EmptyDescription>
          Um projeto agrupa os assets de um jogo: código em <code>src/</code>, um arquivo por imagem exportada em <code>sheets/</code> e os arquivos exportados em <code>assets/</code>.
        </EmptyDescription>
      </EmptyHeader>
      <EmptyContent>
        <Button onClick={() => void NiceModal.show(NovoModal, { tab: 'new-project' })}>Criar projeto</Button>
      </EmptyContent>
    </Empty>
  );
}
