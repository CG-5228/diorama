import { createContext, Fragment, use, type ReactNode } from 'react';
import { useSelector } from '@tanstack/react-store';
import { Kbd } from '@/components/ui/kbd';
import { createTranslator, DEFAULT_LANG, interpolate, type Key, type Translator, type Vars } from './core';
import { langStore } from './store';

export { createTranslator, DEFAULT_LANG, isLang, LANG_NAMES, LANGS, type Key, type Lang, type PluralKey, type TFn, type Translator, type Vars } from './core';
export { currentTranslator, LANG_STORAGE_KEY, langStore, setLang } from './store';

const I18nContext = createContext<Translator>(createTranslator(DEFAULT_LANG));

/** Gives every component the translator of the language in use; the whole tree re-renders when the language changes. */
export function I18nProvider({ children }: { children: ReactNode }) {
  const lang = useSelector(langStore);
  return <I18nContext value={createTranslator(lang)}>{children}</I18nContext>;
}

/** `{ t, plural, number, date, relative, bytes, list, lang }` for the language in use. */
export const useT = (): Translator => use(I18nContext);

const TAGS: Record<string, (text: string) => ReactNode> = {
  code: (text) => <code>{text}</code>,
  b: (text) => <strong>{text}</strong>,
  kbd: (text) => <Kbd>{text}</Kbd>,
  mono: (text) => <span className="font-mono text-foreground">{text}</span>,
};

/**
 * A string with a little markup in it, for the sentences that carry a `<code>`, a `<kbd>` or a piece of the screen:
 * `<name>text</name>` in the dictionary becomes the element `TAGS[name]` makes from `text` (`code`, `b`, `kbd` or `mono`),
 * and `{name}` becomes `nodes[name]` when that is given (an element) or `vars[name]` (a string).
 */
export function Rich({ id, vars, nodes }: { id: Key; vars?: Vars; nodes?: Record<string, ReactNode> }) {
  const { t } = useT();
  const template = t(id);
  const parts: ReactNode[] = [];
  const text = (chunk: string) => interpolate(chunk, vars);
  let last = 0;
  for (const match of template.matchAll(/<(\w+)>([^<]*)<\/\1>|\{(\w+)\}/g)) {
    const [whole, tag, inner, slot] = match;
    if (slot !== undefined && !(nodes && slot in nodes)) continue;
    if (match.index > last) parts.push(text(template.slice(last, match.index)));
    parts.push(tag !== undefined ? (TAGS[tag]?.(text(inner)) ?? text(inner)) : nodes![slot]);
    last = match.index + whole.length;
  }
  if (last < template.length) parts.push(text(template.slice(last)));
  return parts.map((part, i) => <Fragment key={i}>{part}</Fragment>);
}
