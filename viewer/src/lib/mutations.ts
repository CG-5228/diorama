import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from '@tanstack/react-router';
import { toast } from 'sonner';
import { api } from './api';
import { exportTarget, pendingExports } from './export-state';
import { plural, stripExtension } from './format';
import { assetsQuery, projectsQuery } from './queries';
import type { AssetFileMeta } from './types';

/** Disk changed under the catalog: refetch everything derived from it. */
function useRefreshCatalog() {
  const queryClient = useQueryClient();
  return () => Promise.all([
    queryClient.invalidateQueries({ queryKey: ['assets'] }),
    queryClient.invalidateQueries({ queryKey: ['projects'] }),
  ]);
}

export function useRestoreAssets() {
  const refresh = useRefreshCatalog();
  return useMutation({
    mutationFn: (entries: Array<{ project: string; trashId: string }>) => Promise.all(entries.map(api.restoreAsset)),
    onSuccess: async () => {
      await refresh();
      toast.success('Restaurado');
    },
    onError: (error) => toast.error('Não foi possível desfazer', { description: error.message }),
  });
}

/** Moves one or more exported assets (and optionally their sheets) to the trash, with an undo toast. */
export function useDeleteAssets() {
  const refresh = useRefreshCatalog();
  const restore = useRestoreAssets();
  return useMutation({
    mutationFn: async (input: { assets: AssetFileMeta[]; deleteSheet: boolean }) => {
      const results = [];
      for (const { project, subpath } of input.assets) {
        results.push(await api.deleteAsset({ project, subpath, deleteSheet: input.deleteSheet }));
      }
      return results;
    },
    onSuccess: async (results) => {
      await refresh();
      const files = results.reduce((sum, r) => sum + r.moved.length, 0);
      toast('Movido para a lixeira', {
        description: `${results.length === 1 ? results[0].subpath : `${results.length} assets`} · ${files} ${files === 1 ? 'arquivo' : 'arquivos'}`,
        duration: 9000,
        action: {
          label: 'Desfazer',
          onClick: () => restore.mutate(results.map(({ project, trashId }) => ({ project, trashId }))),
        },
      });
    },
    onError: (error) => toast.error('Não foi possível excluir', { description: error.message }),
  });
}

export function useDeleteProject() {
  const refresh = useRefreshCatalog();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const restore = useMutation({
    mutationFn: api.restoreProject,
    onSuccess: async ({ restored }) => {
      await refresh();
      toast.success('Projeto restaurado', { description: restored });
    },
    onError: (error) => toast.error('Não foi possível restaurar o projeto', { description: error.message }),
  });
  return useMutation({
    mutationFn: api.deleteProject,
    onSuccess: async ({ project, trashId }) => {
      await refresh();
      queryClient.removeQueries({ queryKey: ['atlas', project] });
      void navigate({ to: '/', replace: true });
      toast('Projeto movido para a lixeira', {
        description: project,
        duration: 12000,
        action: { label: 'Desfazer', onClick: () => restore.mutate({ project, trashId }) },
      });
    },
    onError: (error) => toast.error('Não foi possível apagar o projeto', { description: error.message }),
  });
}

/** Runs tools/cli.ts or tools/export.ts; the Novo dialog shows the output itself. */
export function useCli() {
  const refresh = useRefreshCatalog();
  return useMutation({
    mutationFn: api.cli,
    // Awaited, so callers that navigate right after a create see the new project in the catalog.
    onSuccess: async (result) => {
      if (result.ok) await refresh();
    },
  });
}

/**
 * Re-runs tools/export.ts for one asset. The callbacks live on the hook, not on mutate():
 * the menu that triggers this unmounts as soon as it closes, and mutate-level callbacks die with it.
 */
export function useReexport() {
  const refresh = useRefreshCatalog();
  return useMutation({
    mutationFn: ({ project, subpath }: { project: string; subpath: string }) =>
      api.cli({ command: 'export', project, subpath: stripExtension(subpath) }),
    onMutate: ({ subpath }) => toast.loading('Exportando…', { description: subpath }),
    onSuccess: async (result, { subpath }, toastId) => {
      if (!result.ok) {
        toast.error('Falha ao exportar', { id: toastId, description: result.output.split('\n').slice(-4).join('\n') });
        return;
      }
      await refresh();
      toast.success('Exportado de novo', { id: toastId, description: subpath });
    },
    onError: (error, _input, toastId) => toast.error('Falha ao exportar', { id: toastId, description: error.message }),
  });
}

/**
 * Exports sheets one at a time (each run starts a headless browser) behind a single toast that counts them.
 * It stops at the first failure: the ones before it are already on disk.
 */
export function useExportSheets() {
  const refresh = useRefreshCatalog();
  return useMutation({
    mutationFn: async ({ project, sheets }: { project: string; sheets: string[] }) => {
      const toastId = toast.loading('Exportando…');
      let done = 0;
      try {
        for (const sheet of sheets) {
          toast.loading(`Exportando ${done + 1} de ${sheets.length}`, { id: toastId, description: sheet });
          const result = await api.cli({ command: 'export', project, subpath: exportTarget(sheet) });
          if (!result.ok) throw new Error(`${sheet}\n${result.output.split('\n').slice(-4).join('\n')}`);
          done++;
        }
        toast.success(plural(done, 'asset exportado', 'assets exportados'), { id: toastId });
      } catch (error) {
        toast.error(done > 0 ? `Parou depois de ${done} de ${sheets.length}` : 'Falha ao exportar', {
          id: toastId,
          description: error instanceof Error ? error.message : String(error),
        });
      }
    },
    onSettled: refresh,
  });
}

/** The folder the project's gear items are generated into (`sheets/gear/`, by `gear-items`) and exported to (`assets/gear/`). */
const GEAR_ITEMS = 'gear/';

/**
 * Brings the exported gear items (the pickers' thumbnails) up to date: writes a file for every part that has none, and
 * exports the folder when something in it is missing or older than its sheet.
 */
export function useRefreshGearItems() {
  const queryClient = useQueryClient();
  const refresh = useRefreshCatalog();
  return useMutation({
    mutationFn: async ({ project }: { project: string }) => {
      const toastId = toast.loading('Atualizando itens…');
      try {
        const created = await api.cli({ command: 'gear-items', project });
        if (!created.ok) throw new Error(created.output);
        await refresh();
        const assets = (queryClient.getQueryData(assetsQuery.queryKey) ?? []).filter((a) => a.project === project && a.subpath.startsWith(GEAR_ITEMS));
        const meta = queryClient.getQueryData(projectsQuery.queryKey)?.find((p) => p.name === project);
        const pending = pendingExports(assets, meta && { ...meta, pendingSheets: meta.pendingSheets.filter((s) => s.startsWith(GEAR_ITEMS)) });
        const count = pending.stale.length + pending.missing.length;
        if (count === 0) {
          toast.success('Itens em dia', { id: toastId, description: plural(assets.length, 'item exportado', 'itens exportados') });
          return;
        }
        toast.loading('Exportando itens…', { id: toastId, description: plural(count, 'peça nova ou alterada', 'peças novas ou alteradas') });
        const exported = await api.cli({ command: 'export', project, subpath: GEAR_ITEMS });
        if (!exported.ok) throw new Error(exported.output.split('\n').slice(-4).join('\n'));
        toast.success('Itens atualizados', { id: toastId, description: plural(count, 'item exportado', 'itens exportados') });
      } catch (error) {
        toast.error('Não foi possível atualizar os itens', { id: toastId, description: error instanceof Error ? error.message : String(error) });
      }
    },
    onSettled: refresh,
  });
}
