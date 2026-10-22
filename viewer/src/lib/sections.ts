/** The sections of a project, each at its own route: switching project keeps the section the user is in. */
export const SECTION_PATHS = {
  assets: '/p/$project',
  playground: '/p/$project/playground',
  customize: '/p/$project/customize',
  scenery: '/p/$project/scenery',
} as const;

export type Section = keyof typeof SECTION_PATHS;

export function sectionOf(pathname: string): Section {
  if (pathname.endsWith('/playground')) return 'playground';
  if (pathname.endsWith('/customize')) return 'customize';
  if (pathname.endsWith('/scenery')) return 'scenery';
  return 'assets';
}
