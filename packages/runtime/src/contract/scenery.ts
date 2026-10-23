/** What a scenery piece's sheet says about the piece (guide 05 of `@core/volume`): its states, its clips and how it counts for navigation. */

import type { AtlasEvent } from './atlas.js';

/** A clip of a piece: a transition from one state to another (a door opening), or a loop (a flame). */
export interface PieceClipData {
  frames: number;
  fps?: number;
  loop?: boolean;
  from?: string;
  to?: string;
  events?: AtlasEvent[];
  /** Its sheet: a sibling of the piece's sheet (`crypt-door--opening`), or a path from the assets root when it has a `/`. */
  sheet?: string;
}

/** How a piece counts for navigation (`nav` of its catalog entry). */
export interface PieceNavData {
  blocks?: boolean;
  cost?: number;
  passableIn?: string[];
  interact?: string;
  interactIn?: string[];
}

/** The clip a piece's clip sheet plays (`meta.data.clip` of `<piece>--<clip>`). */
export interface PieceClipSheet {
  name: string;
  frames: number;
  fps: number;
  loop: boolean;
  from?: string;
  to?: string;
  events: AtlasEvent[];
}

/** A frame of a piece's sheet: the neighbour mask and the variant it is drawn for. */
export interface PieceTile {
  frame: number;
  mask: number;
  variant: number;
}

/** A row of a wall or fence that comes in several heights: its height's name, in world units and screen px. */
export interface PieceHeight {
  row: number;
  name?: string | number;
  world: number;
  screen: number;
}

/** A row of a piece's clip sheet: the facing and the variant it shows. */
export interface PieceRow {
  row: number;
  dir: number;
  variant: number;
}
