import type { ComponentType, ReactNode } from 'react';
import NiceModal from '@ebay/nice-modal-react';
import { CopyIcon, ExternalLinkIcon, EyeIcon, FileJsonIcon, MoreHorizontalIcon, RefreshCwIcon, Trash2Icon } from 'lucide-react';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuGroup, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuShortcut, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  ContextMenu, ContextMenuContent, ContextMenuGroup, ContextMenuItem, ContextMenuSeparator, ContextMenuShortcut, ContextMenuTrigger,
} from '@/components/ui/context-menu';
import { Button } from '@/components/ui/button';
import { copyText } from '@/lib/clipboard';
import { useReexport } from '@/lib/mutations';
import { stripExtension } from '@/lib/format';
import { projectFile, projectUrl } from '@/lib/project-paths';
import type { AssetGroup } from '@/lib/groups';
import type { AssetFileMeta } from '@/lib/types';
import { DeleteAssetsModal } from '@/modals/delete-assets-modal';

interface ItemProps {
  variant?: 'default' | 'destructive';
  disabled?: boolean;
  onSelect?: () => void;
  children?: ReactNode;
}

/** The dropdown and the right-click menu share their items; only the primitives differ. */
interface MenuParts {
  Group: ComponentType<{ children?: ReactNode }>;
  Item: ComponentType<ItemProps>;
  Separator: ComponentType;
  Shortcut: ComponentType<{ children?: ReactNode }>;
}

const dropdownParts: MenuParts = {
  Group: DropdownMenuGroup, Item: DropdownMenuItem, Separator: DropdownMenuSeparator, Shortcut: DropdownMenuShortcut,
};
const contextParts: MenuParts = {
  Group: ContextMenuGroup, Item: ContextMenuItem, Separator: ContextMenuSeparator, Shortcut: ContextMenuShortcut,
};

const askDelete = (assets: AssetFileMeta[]) => void NiceModal.show(DeleteAssetsModal, { assets });

interface AssetProps {
  asset: AssetFileMeta;
  onPreview?: (asset: AssetFileMeta) => void;
}

function AssetItems({ asset, onPreview, parts: { Group, Item, Separator, Shortcut } }: AssetProps & { parts: MenuParts }) {
  const reexport = useReexport();
  const sheetPath = asset.sheet ? projectFile(asset.root, asset.project, `sheets/${asset.sheet}`) : null;
  return (
    <>
      <Group>
        {onPreview && (
          <Item onSelect={() => onPreview(asset)}>
            <EyeIcon />
            Preview
            <Shortcut>↵</Shortcut>
          </Item>
        )}
        <Item disabled={!asset.sheet} onSelect={() => reexport.mutate(asset)}>
          <RefreshCwIcon />
          Exportar de novo
        </Item>
      </Group>
      <Separator />
      <Group>
        <Item disabled={!sheetPath} onSelect={() => sheetPath && void copyText(sheetPath, 'Caminho do .ts')}>
          <CopyIcon />
          Copiar caminho do .ts
        </Item>
        <Item onSelect={() => void copyText(projectFile(asset.root, asset.project, `assets/${asset.subpath}`), 'Caminho do arquivo')}>
          <CopyIcon />
          Copiar caminho do arquivo exportado
        </Item>
        <Item disabled={!asset.atlas} onSelect={() => window.open(projectUrl(asset.root, asset.project, `assets/${asset.atlas}`), '_blank', 'noopener')}>
          <FileJsonIcon />
          Abrir atlas JSON
        </Item>
        <Item onSelect={() => window.open(`${asset.url}?t=${asset.mtime}`, '_blank', 'noopener')}>
          <ExternalLinkIcon />
          Abrir imagem em nova aba
        </Item>
      </Group>
      <Separator />
      <Group>
        <Item variant="destructive" onSelect={() => askDelete([asset])}>
          <Trash2Icon />
          Excluir…
          <Shortcut>⌫</Shortcut>
        </Item>
      </Group>
    </>
  );
}

export function AssetMenuButton({ asset, onPreview }: AssetProps) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label={`Ações de ${stripExtension(asset.subpath)}`}
          onClick={(e) => e.stopPropagation()}
          onKeyDown={(e) => e.stopPropagation()}
        >
          <MoreHorizontalIcon />
        </Button>
      </DropdownMenuTrigger>
      {/* The menu is portaled, but React still bubbles its clicks to the card that renders it. */}
      <DropdownMenuContent align="end" className="w-64" onClick={(e) => e.stopPropagation()} onCloseAutoFocus={(e) => e.preventDefault()}>
        <AssetItems asset={asset} onPreview={onPreview} parts={dropdownParts} />
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/** Right-click menu around a card or row, with the same actions as the ⋯ button. */
export function AssetContextMenu({ asset, onPreview, children }: AssetProps & { children: ReactNode }) {
  return (
    <ContextMenu>
      <ContextMenuTrigger asChild>{children}</ContextMenuTrigger>
      <ContextMenuContent className="w-64" onCloseAutoFocus={(e) => e.preventDefault()}>
        <AssetItems asset={asset} onPreview={onPreview} parts={contextParts} />
      </ContextMenuContent>
    </ContextMenu>
  );
}

interface GroupProps {
  group: AssetGroup;
  onOpen: (asset: AssetFileMeta) => void;
}

function GroupItems({ group, onOpen, parts: { Group, Item, Separator, Shortcut } }: GroupProps & { parts: MenuParts }) {
  const reexport = useReexport();
  const [first] = group.assets;
  return (
    <>
      <Group>
        <Item onSelect={() => onOpen(first)}>
          <EyeIcon />
          Abrir
          <Shortcut>↵</Shortcut>
        </Item>
        <Item onSelect={() => group.assets.filter((a) => a.sheet).forEach((a) => reexport.mutate(a))}>
          <RefreshCwIcon />
          Exportar todas as animações
        </Item>
      </Group>
      <Separator />
      <Group>
        <Item onSelect={() => void copyText(projectFile(first.root, first.project, `assets/${group.folder}/`), 'Caminho da pasta')}>
          <CopyIcon />
          Copiar caminho da pasta
        </Item>
      </Group>
      <Separator />
      <Group>
        <Item variant="destructive" onSelect={() => askDelete(group.assets)}>
          <Trash2Icon />
          Excluir {group.assets.length} animações…
        </Item>
      </Group>
    </>
  );
}

export function GroupMenuButton({ group, onOpen }: GroupProps) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon-sm" aria-label={`Ações de ${group.name}`} onClick={(e) => e.stopPropagation()} onKeyDown={(e) => e.stopPropagation()}>
          <MoreHorizontalIcon />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-64" onClick={(e) => e.stopPropagation()} onCloseAutoFocus={(e) => e.preventDefault()}>
        <GroupItems group={group} onOpen={onOpen} parts={dropdownParts} />
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export function GroupContextMenu({ group, onOpen, children }: GroupProps & { children: ReactNode }) {
  return (
    <ContextMenu>
      <ContextMenuTrigger asChild>{children}</ContextMenuTrigger>
      <ContextMenuContent className="w-64" onCloseAutoFocus={(e) => e.preventDefault()}>
        <GroupItems group={group} onOpen={onOpen} parts={contextParts} />
      </ContextMenuContent>
    </ContextMenu>
  );
}
