/**
 * Soul bar: the same bar (four frames, with its cap) in soul green, the fire of the ward, with a soul's flame in the plate.
 */

import { RAMPS } from '../theme';
import { defineBarLook } from './bars';

export const soulBar = defineBarLook({ measure: 'soul', fill: RAMPS.soul, gem: 'flame' });
