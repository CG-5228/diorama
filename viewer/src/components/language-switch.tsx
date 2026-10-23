import { GlobeIcon } from 'lucide-react';
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { isLang, LANG_NAMES, LANGS, setLang, useT } from '@/i18n';

/**
 * The language of the interface, in the header: each language is named in itself, and the choice is remembered. On a narrow
 * header only the globe stays (Radix ignores a `className` on `SelectValue`, so the trigger hides it); a screen reader still gets the name.
 */
export function LanguageSwitch() {
  const { t, lang } = useT();
  return (
    <Select value={lang} onValueChange={(value) => isLang(value) && setLang(value)}>
      <SelectTrigger
        size="sm"
        aria-label={t('language.label')}
        className="w-auto border-transparent bg-transparent max-md:*:data-[slot=select-value]:sr-only dark:bg-transparent"
      >
        <GlobeIcon aria-hidden />
        <SelectValue />
      </SelectTrigger>
      <SelectContent align="end" position="popper">
        <SelectGroup>
          {LANGS.map((id) => (
            <SelectItem key={id} value={id} lang={id}>{LANG_NAMES[id]}</SelectItem>
          ))}
        </SelectGroup>
      </SelectContent>
    </Select>
  );
}
