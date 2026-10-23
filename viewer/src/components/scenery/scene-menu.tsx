import type { SceneData, SceneryCatalog } from '@core/volume';
import { ChevronDownIcon, MapIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { useT } from '@/i18n';
import type { SavedScene } from '@/lib/scenery/catalog';
import { SceneSettings } from './scene-settings';

interface Props {
  catalog: SceneryCatalog;
  scene: SceneData;
  saved: SavedScene[];
  /** The saved scene the current one came from, if any. */
  loaded: string | null;
  /** There are changes that are not saved. */
  unsaved: boolean;
  onEdit: (update: (scene: SceneData) => SceneData) => void;
  onLoad: (scene: SceneData, name: string | null) => void;
}

/** The scene in use, named on the toolbar; its menu opens another, starts a blank one, and sets its size and materials. */
export function SceneMenu({ catalog, scene, saved, loaded, unsaved, onEdit, onLoad }: Props) {
  const { t } = useT();
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" className="max-w-56 gap-2" aria-label={t('scenery.menu.label')}>
          <MapIcon data-icon="inline-start" />
          <span className="truncate">{loaded ?? t('scenery.unnamed')}</span>
          {unsaved && <span aria-label={t('scenery.menu.unsavedChanges')} className="size-1.5 shrink-0 rounded-full bg-primary" />}
          <ChevronDownIcon data-icon="inline-end" />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="max-h-(--radix-popover-content-available-height) w-80 gap-0 overflow-y-auto p-3">
        <SceneSettings catalog={catalog} scene={scene} saved={saved} loaded={loaded} onEdit={onEdit} onLoad={onLoad} />
      </PopoverContent>
    </Popover>
  );
}
