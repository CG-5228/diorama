import NiceModal from '@ebay/nice-modal-react';
import { ListIcon, TriangleAlertIcon, UploadIcon } from 'lucide-react';
import { Alert, AlertAction, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Spinner } from '@/components/ui/spinner';
import { useT } from '@/i18n';
import type { PendingExports } from '@/lib/export-state';
import { useExportSheets } from '@/lib/mutations';
import { PendingExportModal } from '@/modals/pending-export-modal';

/** Says how much of the project is not exported yet, and exports it in one go. Renders nothing when all is fresh. */
export function ExportBanner({ project, pending }: { project: string; pending: PendingExports }) {
  const exportSheets = useExportSheets();
  const { t, plural } = useT();
  const sheets = [...pending.missing, ...pending.stale.flatMap((asset) => (asset.sheet ? [asset.sheet] : []))];
  if (sheets.length === 0) return null;

  const summary = [
    pending.stale.length > 0 && plural('assets.banner.staleAssets', pending.stale.length),
    pending.missing.length > 0 && plural('assets.banner.missingSheets', pending.missing.length),
  ]
    .filter(Boolean)
    .join(' · ');

  const explanation =
    pending.stale.length === 0
      ? t('assets.banner.onlyMissing')
      : pending.missing.length === 0
        ? t('assets.banner.onlyStale')
        : t('assets.banner.both');

  return (
    <Alert className="has-data-[slot=alert-action]:pr-64">
      <TriangleAlertIcon />
      <AlertTitle>{summary}</AlertTitle>
      <AlertDescription>{explanation}</AlertDescription>
      <AlertAction className="flex gap-1.5">
        <Button variant="outline" size="xs" onClick={() => void NiceModal.show(PendingExportModal, { project })}>
          <ListIcon data-icon="inline-start" />
          {t('assets.banner.viewList')}
        </Button>
        <Button size="xs" disabled={exportSheets.isPending} onClick={() => exportSheets.mutate({ project, sheets })}>
          {exportSheets.isPending ? <Spinner data-icon="inline-start" /> : <UploadIcon data-icon="inline-start" />}
          {t('assets.banner.exportPending')}
        </Button>
      </AlertAction>
    </Alert>
  );
}
