import type { CSSProperties } from 'react';

/** Inline style with custom properties, which React's CSSProperties type does not know about. */
export const cssVars = (vars: Record<`--${string}`, string | number>): CSSProperties => vars as CSSProperties;
