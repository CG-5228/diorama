/**
 * @core/draw - ShapeStyle Class
 * 
 * Encapsulates combined fill, stroke, and clipping attributes for closed shapes.
 */

import type { ShapeStyleOptions, Texture, InsideCallback, Paint, ShadowOptions, StrokeOptions } from '../types.js';
import { StrokeStyle } from './stroke-style.js';

/** A style for shapes: fill, stroke, shadow, textures and an inner callback. */
export class ShapeStyle {
  public readonly attrs: Readonly<ShapeStyleOptions>;

  constructor(attrs: ShapeStyleOptions = {}) {
    this.attrs = Object.freeze({ ...attrs });
  }

  get fill(): Paint | undefined {
    return this.attrs.fill;
  }

  get celShade() {
    return this.attrs.celShade;
  }

  get texture(): Texture | Texture[] | undefined {
    return this.attrs.texture;
  }

  get stroke(): StrokeStyle | StrokeOptions | undefined {
    return this.attrs.stroke;
  }

  get shadow(): ShadowOptions | undefined {
    return this.attrs.shadow;
  }

  get strokePosition() {
    return this.attrs.strokePosition;
  }

  get inside(): InsideCallback | undefined {
    return this.attrs.inside;
  }

  /**
   * Derives a new ShapeStyle with specific attribute overrides.
   * Performs deep merge on composite attributes (stroke, shadow, celShade) to prevent losing preset configurations.
   */
  with(overrides: Partial<ShapeStyleOptions>): ShapeStyle {
    let mergedStroke = this.attrs.stroke;
    if (overrides.stroke !== undefined) {
      if (this.attrs.stroke instanceof StrokeStyle) {
        const overOpts = overrides.stroke instanceof StrokeStyle ? overrides.stroke.attrs : overrides.stroke;
        mergedStroke = this.attrs.stroke.with(overOpts);
      } else if (this.attrs.stroke && typeof this.attrs.stroke === 'object') {
        const overOpts = overrides.stroke instanceof StrokeStyle ? overrides.stroke.attrs : overrides.stroke;
        mergedStroke = { ...this.attrs.stroke, ...overOpts };
      } else {
        mergedStroke = overrides.stroke;
      }
    }

    const mergedShadow = overrides.shadow !== undefined && this.attrs.shadow
      ? { ...this.attrs.shadow, ...overrides.shadow }
      : (overrides.shadow ?? this.attrs.shadow);

    const mergedCelShade = overrides.celShade !== undefined && this.attrs.celShade
      ? { ...this.attrs.celShade, ...overrides.celShade }
      : (overrides.celShade ?? this.attrs.celShade);

    return new ShapeStyle({
      ...this.attrs,
      ...overrides,
      stroke: mergedStroke,
      shadow: mergedShadow,
      celShade: mergedCelShade,
    });
  }
}
