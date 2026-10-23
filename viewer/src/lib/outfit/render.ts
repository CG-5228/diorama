import { drawCharacterFrame, outfitFromData, validateOutfit, type CharacterClip, type GearCatalog, type OutfitCharacterInfo, type OutfitData, type Skin } from '@core/rig';
import { directionName, facingYaw } from '@core/volume';
import type { TFn } from '../../i18n/core';
import { currentTranslator } from '../../i18n/store';

/** Directions of an exported sheet: row 0 faces the camera and each next one turns clockwise. */
export const DIRECTION_COUNT = 8;
export const directionLabel = (index: number) => directionName(index, DIRECTION_COUNT);

export interface BuiltSkin {
  skin: Skin | null;
  /** What `validateOutfit` found, or the error the engine threw while building. Empty when the skin is good. */
  problems: string[];
}

/** The outfit as a skin. An invalid outfit does not throw: it comes back with its problems, so the editor can show them. */
export function buildSkin(outfit: OutfitData, catalog: GearCatalog): BuiltSkin {
  const problems = validateOutfit(outfit, catalog);
  if (problems.length) return { skin: null, problems };
  try {
    return { skin: outfitFromData(outfit, catalog), problems: [] };
  } catch (error) {
    return { skin: null, problems: [error instanceof Error ? error.message : String(error)] };
  }
}

export const clipOf = (clip: CharacterClip) => ('clip' in clip ? clip.clip : clip);

/** Frames of a clip: its own, else the character's, else the engine's default of 8. */
export const framesOf = (character: OutfitCharacterInfo, clip: CharacterClip) => ('frames' in clip ? clip.frames : undefined) ?? character.frames ?? 8;

/**
 * Draws one frame of the character with this skin, as its export would, on a canvas of its logical size scaled by
 * `scale` (zoom times the device pixel ratio). Returns the error a part threw, if any: a part that breaks on one
 * pose must not take the page down.
 */
export function paintFrame(canvas: HTMLCanvasElement, character: OutfitCharacterInfo, skin: Skin, clipKey: string, frame: number, direction: number, scale: number, t: TFn = currentTranslator().t): string | null {
  const entry = character.clips[clipKey];
  if (!entry) return t('customize.preview.noClip', { clip: clipKey });
  const width = Math.round(character.width * scale);
  const height = Math.round(character.height * scale);
  if (canvas.width !== width || canvas.height !== height) {
    canvas.width = width;
    canvas.height = height;
  }
  const ctx = canvas.getContext('2d');
  if (!ctx) return t('errors.noCanvas');
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.clearRect(0, 0, width, height);
  ctx.setTransform(scale, 0, 0, scale, 0, 0);
  ctx.imageSmoothingEnabled = false;
  try {
    const view = { skeleton: character.skeleton, clip: clipOf(entry), skin, camera: character.camera, pivot: character.pivot, shadow: character.shadow };
    drawCharacterFrame(ctx, view, frame / framesOf(character, entry), facingYaw(direction, DIRECTION_COUNT));
    return null;
  } catch (error) {
    return error instanceof Error ? error.message : String(error);
  }
}
