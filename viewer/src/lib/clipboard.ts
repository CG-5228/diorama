import { toast } from 'sonner';

export async function copyText(text: string, label: string) {
  try {
    await navigator.clipboard.writeText(text);
    toast.success(`${label} copiado`, { description: text });
  } catch {
    toast.error('Não foi possível copiar', { description: text });
  }
}
