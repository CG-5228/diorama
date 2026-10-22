import { useModal } from '@ebay/nice-modal-react';

/**
 * Binds a shadcn Dialog / AlertDialog to a nice-modal instance.
 * The modal is unmounted after its exit animation, so every `show()` starts from a fresh state.
 */
export function useModalDialog() {
  const modal = useModal();
  return {
    modal,
    rootProps: {
      open: modal.visible,
      onOpenChange: (open: boolean) => {
        if (!open) modal.hide();
      },
    },
    contentProps: {
      onCloseAutoFocus: () => modal.remove(),
    },
  };
}
