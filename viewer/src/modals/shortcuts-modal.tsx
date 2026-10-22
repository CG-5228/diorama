import NiceModal from '@ebay/nice-modal-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Kbd } from '@/components/ui/kbd';
import { useModalDialog } from '@/lib/use-modal-dialog';

const groups: Array<{ title: string; items: Array<[keys: string[], label: string]> }> = [
  {
    title: 'Lista',
    items: [
      [['/'], 'Buscar'],
      [['↑', '↓', '←', '→'], 'Mover a seleção'],
      [['↵'], 'Abrir preview'],
      [['⌫'], 'Excluir'],
      [['Esc'], 'Limpar seleção ou busca'],
      [['N'], 'Novo projeto, asset ou export'],
      [['⌘', 'K'], 'Trocar de projeto'],
    ],
  },
  {
    title: 'Preview',
    items: [
      [['Espaço'], 'Reproduzir / pausar'],
      [['←', '→'], 'Frame anterior / próximo'],
      [['↑', '↓', '1–8'], 'Trocar de direção'],
      [['[', ']'], 'Animação anterior / próxima'],
      [['+', '−', '0'], 'Zoom / ajustar'],
      [['B'], 'Alternar fundo'],
      [['P', 'G'], 'Pivô / bordas'],
    ],
  },
];

export const ShortcutsModal = NiceModal.create(() => {
  const { rootProps, contentProps } = useModalDialog();
  return (
    <Dialog {...rootProps}>
      <DialogContent {...contentProps} className="sm:max-w-xl" aria-describedby={undefined}>
        <DialogHeader>
          <DialogTitle>Atalhos de teclado</DialogTitle>
        </DialogHeader>
        <div className="grid grid-cols-2 gap-6">
          {groups.map((group) => (
            <section key={group.title} className="flex flex-col gap-2">
              <h3 className="text-xs font-medium text-muted-foreground uppercase">{group.title}</h3>
              <dl className="flex flex-col gap-1.5">
                {group.items.map(([keys, label]) => (
                  <div key={label} className="flex items-center gap-3">
                    <dt className="flex min-w-20 gap-1">{keys.map((key) => <Kbd key={key}>{key}</Kbd>)}</dt>
                    <dd className="text-muted-foreground">{label}</dd>
                  </div>
                ))}
              </dl>
            </section>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
});
