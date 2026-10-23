import { toast } from 'sonner';
import { currentTranslator } from '../i18n/store';

export async function copyText(text: string, label: string) {
  const { t } = currentTranslator();
  try {
    await navigator.clipboard.writeText(text);
    toast.success(t('clipboard.copied', { label }), { description: text });
  } catch {
    toast.error(t('clipboard.failed'), { description: text });
  }
}
