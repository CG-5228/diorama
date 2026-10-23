import { en } from './en';
import { ptBR } from './pt-BR';

/**
 * The language machinery with no React and no DOM in it, so the pure code of `lib/` and the tests can use it:
 * `createTranslator('pt-BR')` is everything a screen says in that language. The hook, the provider and the stored
 * choice are in `./index.tsx` and `./store.ts`.
 */

export const LANGS = ['en', 'pt-BR'] as const;
export type Lang = (typeof LANGS)[number];
export const DEFAULT_LANG: Lang = 'en';
/** Each language in its own name: a name never changes with the language of the screen, so a reader who cannot read this one can still find theirs. */
export const LANG_NAMES: Record<Lang, string> = { en: 'English', 'pt-BR': 'Português (Brasil)' };

export const isLang = (value: unknown): value is Lang => typeof value === 'string' && (LANGS as readonly string[]).includes(value);

/** The dotted path of every string in the dictionary ("assets.toolbar.search"). */
type Paths<T, Prefix extends string = ''> = {
  [K in keyof T & string]: T[K] extends string ? `${Prefix}${K}` : Paths<T[K], `${Prefix}${K}.`>;
}[keyof T & string];
export type Key = Paths<typeof en>;
/** A plural is a key with both a `.one` and an `.other` string; it is asked for by what comes before them. */
type Before<K, Suffix extends string> = K extends `${infer Base}.${Suffix}` ? Base : never;
export type PluralKey = Extract<Before<Key, 'other'>, Before<Key, 'one'>>;
export type Vars = Readonly<Record<string, string | number>>;

export type TFn = (key: Key, vars?: Vars) => string;

export interface Translator {
  lang: Lang;
  /** A string of the dictionary, with every `{name}` replaced by `vars.name`. */
  t: TFn;
  /** The `.one` / `.other` form of a key (as `Intl.PluralRules` picks it for `count`); `{count}` is the number in the language's format. */
  plural: (key: PluralKey, count: number, vars?: Vars) => string;
  number: (value: number, options?: Intl.NumberFormatOptions) => string;
  /** A moment in time: the short date and the time. */
  date: (ms: number | Date) => string;
  /** How long ago (or from now) a moment is: "3 min ago", "now". */
  relative: (ms: number) => string;
  /** A file size: "812 B", "1.5 kB", "2.31 MB". */
  bytes: (size: number) => string;
  /** Items joined the way the language lists them: "a, b and c", or "a, b or c" with `'or'`. */
  list: (items: readonly string[], kind?: 'and' | 'or') => string;
}

interface Tree {
  readonly [name: string]: string | Tree;
}

function flatten(node: Tree, prefix = '', into = new Map<string, string>()): Map<string, string> {
  for (const [name, value] of Object.entries(node)) {
    if (typeof value === 'string') into.set(prefix + name, value);
    else flatten(value, `${prefix}${name}.`, into);
  }
  return into;
}

const STRINGS: Record<Lang, ReadonlyMap<string, string>> = { en: flatten(en), 'pt-BR': flatten(ptBR) };

/** `{name}` placeholders: a name with no value is left as written, so a mistake is visible and not blank. */
export function interpolate(template: string, vars?: Vars): string {
  if (!vars) return template;
  return template.replace(/\{(\w+)\}/g, (whole, name: string) => (name in vars ? String(vars[name]) : whole));
}

/** The placeholders a string has, in order of appearance. */
export const placeholdersOf = (template: string): string[] => [...template.matchAll(/\{(\w+)\}/g)].map((m) => m[1]);

/** Every key and its string in a language (what the tests read the dictionaries through). */
export const stringsOf = (lang: Lang): ReadonlyMap<string, string> => STRINGS[lang];

const UNITS: Array<[Intl.RelativeTimeFormatUnit, number]> = [
  ['year', 31_536_000],
  ['month', 2_592_000],
  ['day', 86_400],
  ['hour', 3_600],
  ['minute', 60],
];

function build(lang: Lang): Translator {
  const strings = STRINGS[lang];
  const fallback = STRINGS[DEFAULT_LANG];
  const t = (key: Key, vars?: Vars) => interpolate(strings.get(key) ?? fallback.get(key) ?? key, vars);

  const rules = new Intl.PluralRules(lang);
  const numbers = new Map<string, Intl.NumberFormat>();
  const number = (value: number, options?: Intl.NumberFormatOptions) => {
    const id = options ? JSON.stringify(options) : '';
    let format = numbers.get(id);
    if (!format) numbers.set(id, (format = new Intl.NumberFormat(lang, options)));
    return format.format(value);
  };
  const plural = (key: PluralKey, count: number, vars?: Vars) => {
    const form = `${key}.${rules.select(count)}` as Key;
    const chosen = strings.has(form) ? form : (`${key}.other` as Key);
    return t(chosen, { count: number(count), ...vars });
  };

  const dateFormat = new Intl.DateTimeFormat(lang, { dateStyle: 'short', timeStyle: 'medium' });
  const relativeFormat = new Intl.RelativeTimeFormat(lang, { numeric: 'auto', style: 'short' });
  const listFormats = {
    and: new Intl.ListFormat(lang, { style: 'long', type: 'conjunction' }),
    or: new Intl.ListFormat(lang, { style: 'long', type: 'disjunction' }),
  };
  const oneDecimal: Intl.NumberFormatOptions = { minimumFractionDigits: 1, maximumFractionDigits: 1 };

  return {
    lang,
    t,
    plural,
    number,
    date: (ms) => dateFormat.format(ms),
    relative: (ms) => {
      const seconds = Math.round((ms - Date.now()) / 1000);
      for (const [unit, size] of UNITS) {
        if (Math.abs(seconds) >= size) return relativeFormat.format(Math.round(seconds / size), unit);
      }
      return t('format.now');
    },
    bytes: (size) => {
      if (size < 1024) return `${number(size)} ${t('units.byte')}`;
      if (size < 1024 * 1024) return `${number(size / 1024, oneDecimal)} ${t('units.kilobyte')}`;
      return `${number(size / (1024 * 1024), { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${t('units.megabyte')}`;
    },
    list: (items, kind = 'and') => listFormats[kind].format(items),
  };
}

const translators = new Map<Lang, Translator>();
/** The translator of a language. It is made once, so its functions keep their identity and can sit in a dependency list. */
export function createTranslator(lang: Lang): Translator {
  let translator = translators.get(lang);
  if (!translator) translators.set(lang, (translator = build(lang)));
  return translator;
}
