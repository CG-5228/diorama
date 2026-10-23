// Sizes, dates and counts are written in the language of the screen: see `useT()` (bytes, date, relative, number, plural).

export function stripExtension(path: string): string {
  return path.replace(/\.[^/.]+$/, '');
}

export function dirname(path: string): string {
  const i = path.lastIndexOf('/');
  return i < 0 ? '' : path.slice(0, i);
}

export function basename(path: string): string {
  return path.slice(path.lastIndexOf('/') + 1);
}
