/**
 * Color Utilities for Diorama
 * 
 * Deterministic color manipulation (opacity/alpha, lightening, darkening, interpolation)
 * allowing coding agents to derive tonal variations and transparent states from theme tokens (src/theme.ts)
 * without violating the "No Hardcoded Styling" rule.
 */

export interface RGBA {
  r: number;
  g: number;
  b: number;
  a: number;
}

/**
 * Parses hex (#rgb, #rrggbb, #rrggbbaa) or rgb/rgba strings into { r, g, b, a }.
 */
export function parseColor(color: string): RGBA {
  const c = color.trim().toLowerCase();
  if (c.startsWith('#')) {
    const hex = c.slice(1);
    if (hex.length === 3) {
      return {
        r: parseInt(hex[0] + hex[0], 16),
        g: parseInt(hex[1] + hex[1], 16),
        b: parseInt(hex[2] + hex[2], 16),
        a: 1,
      };
    }
    if (hex.length === 4) {
      return {
        r: parseInt(hex[0] + hex[0], 16),
        g: parseInt(hex[1] + hex[1], 16),
        b: parseInt(hex[2] + hex[2], 16),
        a: parseInt(hex[3] + hex[3], 16) / 255,
      };
    }
    if (hex.length === 6) {
      return {
        r: parseInt(hex.slice(0, 2), 16),
        g: parseInt(hex.slice(2, 4), 16),
        b: parseInt(hex.slice(4, 6), 16),
        a: 1,
      };
    }
    if (hex.length === 8) {
      return {
        r: parseInt(hex.slice(0, 2), 16),
        g: parseInt(hex.slice(2, 4), 16),
        b: parseInt(hex.slice(4, 6), 16),
        a: parseInt(hex.slice(6, 8), 16) / 255,
      };
    }
  }

  const rgbMatch = c.match(/rgba?\(\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)(?:\s*,\s*([\d.]+))?\s*\)/);
  if (rgbMatch) {
    return {
      r: Math.round(Number(rgbMatch[1])),
      g: Math.round(Number(rgbMatch[2])),
      b: Math.round(Number(rgbMatch[3])),
      a: rgbMatch[4] !== undefined ? Number(rgbMatch[4]) : 1,
    };
  }

  // Fallback for named colors or unrecognized values
  return { r: 0, g: 0, b: 0, a: 1 };
}

/**
 * Derives an RGBA color string with the specified opacity (0.0 to 1.0).
 * 
 * @example
 * alpha(PALETTE.accent, 0.4) // 'rgba(230, 80, 40, 0.4)'
 */
export function alpha(color: string, opacity: number): string {
  const { r, g, b } = parseColor(color);
  const a = Math.max(0, Math.min(1, opacity));
  return `rgba(${r}, ${g}, ${b}, ${a})`;
}

/**
 * Linearly interpolates between two colors (hex or rgb/rgba).
 * `t` is clamped between 0 and 1.
 */
export function lerpColor(colorA: string, colorB: string, t: number): string {
  const a = parseColor(colorA);
  const b = parseColor(colorB);
  const clampedT = Math.max(0, Math.min(1, t));
  const r = Math.round(a.r + (b.r - a.r) * clampedT);
  const g = Math.round(a.g + (b.g - a.g) * clampedT);
  const bl = Math.round(a.b + (b.b - a.b) * clampedT);
  const alphaVal = a.a + (b.a - a.a) * clampedT;
  return alphaVal < 1 ? `rgba(${r}, ${g}, ${bl}, ${alphaVal.toFixed(3)})` : `rgb(${r}, ${g}, ${bl})`;
}
