/** What interface sheets say about themselves (`role: 'ui'`, core/ui.ts): insets, fill boxes and bitmap fonts. */

export interface Insets {
  left: number;
  top: number;
  right: number;
  bottom: number;
}

/** A box in logical pixels. */
export interface UiBox {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** A bitmap font (`meta.data.font`, ui kind 'font'): one glyph per frame, in `chars` order. */
export interface FontMeta {
  chars: string;
  cell: { w: number; h: number };
  baseline: number;
  lineHeight: number;
  spacing: number;
  advances: Record<string, number>;
}
