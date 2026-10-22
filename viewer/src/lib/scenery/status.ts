import { createStore } from '@tanstack/react-store';
import type { Cell } from './edit';

/**
 * What the canvas reports while it is used: the cell under the pointer (many times a second), how long the last
 * drawing took, the error it threw and whether a prop is being carried. It lives in a store, not in the painter's state: only the readouts that show
 * one of these re-render when it changes, and the painter does not re-render at every pointer move.
 */
export interface CanvasStatus {
  hover: Cell | null;
  ms: number | null;
  error: string | null;
  /** A prop is being carried: the popover over the selection steps aside until it lands. */
  dragging: boolean;
}

export const createCanvasStatus = () => createStore<CanvasStatus>({ hover: null, ms: null, error: null, dragging: false });
export type CanvasStatusStore = ReturnType<typeof createCanvasStatus>;
