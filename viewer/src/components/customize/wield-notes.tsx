import { SwordsIcon } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import type { WieldReport } from '@/lib/outfit/wield';

/** What is wrong between what the character holds and the clips made for it, after each edit; nothing at all when everything suits. */
export function WieldNotes({ report }: { report: WieldReport }) {
  if (report.notes.length === 0) return null;
  return (
    <Alert>
      <SwordsIcon />
      <AlertTitle>Armas e golpes</AlertTitle>
      <AlertDescription>
        <ul className="flex flex-col gap-1.5">
          {report.notes.map((note) => <li key={note}>{note}</li>)}
        </ul>
      </AlertDescription>
    </Alert>
  );
}
