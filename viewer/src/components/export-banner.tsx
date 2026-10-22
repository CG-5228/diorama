import NiceModal from '@ebay/nice-modal-react';
import { ListIcon, TriangleAlertIcon, UploadIcon } from 'lucide-react';
import { Alert, AlertAction, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Spinner } from '@/components/ui/spinner';
import { plural } from '@/lib/format';
import type { PendingExports } from '@/lib/export-state';
import { useExportSheets } from '@/lib/mutations';
import { PendingExportModal } from '@/modals/pending-export-modal';

/** Says how much of the project is not exported yet, and exports it in one go. Renders nothing when all is fresh. */
export function ExportBanner({ project, pending }: { project: string; pending: PendingExports }) {
  const exportSheets = useExportSheets();
  const sheets = [...pending.missing, ...pending.stale.flatMap((asset) => (asset.sheet ? [asset.sheet] : []))];
  if (sheets.length === 0) return null;

  const summary = [
    pending.stale.length > 0 && plural(pending.stale.length, 'asset desatualizado', 'assets desatualizados'),
    pending.missing.length > 0 && plural(pending.missing.length, 'sheet sem export', 'sheets sem export'),
  ]
    .filter(Boolean)
    .join(' · ');

  const explanation =
    pending.stale.length === 0
      ? 'Estes sheets em sheets/ ainda não viraram imagem.'
      : pending.missing.length === 0
        ? 'O código em sheets/ ou src/ mudou depois do último export.'
        : 'Sheets novos ou alterados depois do último export.';

  return (
    <Alert className="has-data-[slot=alert-action]:pr-64">
      <TriangleAlertIcon />
      <AlertTitle>{summary}</AlertTitle>
      <AlertDescription>{explanation}</AlertDescription>
      <AlertAction className="flex gap-1.5">
        <Button variant="outline" size="xs" onClick={() => void NiceModal.show(PendingExportModal, { project })}>
          <ListIcon data-icon="inline-start" />
          Ver lista
        </Button>
        <Button size="xs" disabled={exportSheets.isPending} onClick={() => exportSheets.mutate({ project, sheets })}>
          {exportSheets.isPending ? <Spinner data-icon="inline-start" /> : <UploadIcon data-icon="inline-start" />}
          Exportar pendentes
        </Button>
      </AlertAction>
    </Alert>
  );
}
