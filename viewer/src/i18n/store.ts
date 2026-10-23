import { createStore } from '@tanstack/react-store';
import { createTranslator, DEFAULT_LANG, isLang, type Lang, type Translator } from './core';

/** Where the choice of language is remembered, per browser. */
export const LANG_STORAGE_KEY = 'diorama.lang';

/** The language remembered in this browser, or the default when there is none (or storage is blocked, or it holds something else). */
export function readStoredLang(): Lang {
  try {
    const stored = localStorage.getItem(LANG_STORAGE_KEY);
    return isLang(stored) ? stored : DEFAULT_LANG;
  } catch {
    // Storage can be blocked; the default applies.
    return DEFAULT_LANG;
  }
}

function applyToDocument(lang: Lang) {
  if (typeof document !== 'undefined') document.documentElement.lang = lang;
}

/** The language of the interface. It is read once at load, so the first render is already in the right language. */
export const langStore = createStore<Lang>(readStoredLang());
applyToDocument(langStore.state);

export function setLang(lang: Lang) {
  langStore.setState(() => lang);
  applyToDocument(lang);
  try {
    localStorage.setItem(LANG_STORAGE_KEY, lang);
  } catch {
    // Not remembered; the language still applies for this session.
  }
}

/** The translator for the language in use right now: for code outside React (a thrown error, a toast from a callback). Components use `useT()`. */
export const currentTranslator = (): Translator => createTranslator(langStore.state);
