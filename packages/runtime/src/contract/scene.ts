/** What a scene's sheet says about the scene (`role: 'scene'`, guide 05 of `@core/volume` §3): its grid, layout and navigation. */

/** Cell edge bits of `SceneNavigation.walls`. */
export const EDGE = { N: 1, E: 2, S: 4, W: 8 } as const;

/**
 * The project's space profile as its sheets repeat it (`meta.data.space` of scenery, scenes and effects): the projection,
 * the sizes in world units, and the cell and sizes on the screen (logical px).
 */
export interface SpaceData {
  projection: string;
  preset?: string;
  /** Where walls stand: 'center' of their cells or on the 'border' between them. */
  walls?: string;
  /** World units: a standing character's height, a cell's width, a wall's, a doorway's and a fence's height. */
  scale: { character: number; cell: number; wall: number; door: number; fence: number };
  /** The same on the screen (logical px), and a cell's size there. */
  screen: { cell: { w: number; h: number }; character: number; wall: number; door: number; fence: number };
}

/** The scene's grid: a cell's size on the screen (logical px) and on the floor (world units). */
export interface Grid {
  screen: { w: number; h: number };
  cell: { x: number; y: number };
}

/** A cell of the grid. */
export interface NavCell {
  col: number;
  row: number;
}

/** Where characters can go in a scene (`meta.data.navigation`). */
export interface SceneNavigation {
  cols: number;
  rows: number;
  /** Cost of entering each cell, `cost[row][col]`: 1 for plain ground, more for slow ground, 0 when it cannot be entered. */
  cost: number[][];
  /** Edges of each cell that cannot be crossed, `walls[row][col]`: N 1, E 2, S 4, W 8 (walls on borders, closed doors). */
  walls: number[][];
  /** Doors (on cell edges): the prop index in the scene, where, the state, and whether they let characters through now. */
  doors: { index: number; piece: string; col: number; row: number; edge: 'N' | 'W'; state?: string; open: boolean }[];
  /** Things to use: chests, levers, breakables, doors. `cells` are the cells a character uses them from. */
  interactables: { index: number; piece: string; kind: string; col: number; row: number; state?: string; cells: NavCell[] }[];
  /**
   * Walls on borders: the vertices where a blocking wall stands, `posts[row][col]` for the vertex at the top-left corner of
   * cell (col, row), (rows + 1) × (cols + 1): piers and lone pillars a body cannot walk through even where no edge is closed.
   */
  posts: boolean[][];
}

/** A thing of the scene's picture, in drawing order: its piece, the frame of its sheet, and where its pivot is (logical px). */
export interface SceneLayoutItem {
  piece: string;
  frame: number;
  row: number;
  dir: number;
  mask: number;
  variant: number;
  /** 'floor' and 'decal' are the ground; 'object' stands and is sorted with the characters. */
  pass: string;
  x: number;
  y: number;
  state?: string;
  edge?: 'N' | 'W';
  options?: Record<string, unknown>;
}
