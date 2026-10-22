/**
 * Health bar: back, fill, frame and cap (four frames). Blood-red fill over a dark well, a slate frame
 * with a bone plate and a drop of blood. Fill box x 16..124, y 4..14, grows to the right; the cap is the
 * fill's bright edge (3 px), which a game moves to where the fill ends.
 */

import { UI_RAMPS } from '../theme';
import { defineBarLook } from './bars';

export const healthBar = defineBarLook({ measure: 'health', fill: UI_RAMPS.blood, gem: 'drop' });
