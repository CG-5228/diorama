import { frameSocket } from '@diorama/runtime';
import { facingOf, type Actor, type ClipEvent } from './actor';

/** Short-lived things the events of a clip make appear: the skill's projectile, hit and landing rings. */
export type Effect =
  | { type: 'projectile'; x: number; y: number; vx: number; vy: number; age: number; life: number; behind: boolean }
  | { type: 'ring'; x: number; y: number; age: number; life: number; radius: number; tone: 'hit' | 'cast' | 'land' };

/** Logical px per second a projectile travels, and how far it goes; multiplied by the sheet's scale. */
const PROJECTILE_SPEED = 130;
const PROJECTILE_RANGE = 150;
/** Where a blow lands, in order of preference: the weapon's tip, the mouth, the hand. */
const HIT_SOCKETS = ['tip', 'mouth', 'hand'];

export interface SocketPoint {
  x: number;
  y: number;
  /** Positive: in front of the body, so the effect is drawn over the sprite. */
  depth: number;
}

/**
 * A socket in the scene, in actor units, for a frame of a clip: where the view draws that pixel of the frame, the cell's
 * origin (the actor less the pivot) plus the socket's [x, y] × scale (contract §5.8, the runtime's `frameSocket`).
 */
export function socketPoint(actor: Actor, clip: ClipEvent['clip'], row: number, frame: number, name: string): SocketPoint | null {
  const socket = frameSocket(clip, row, frame, name);
  if (!socket) return null;
  const pivot = clip.atlas.meta.pivot ?? { x: 0, y: 0 };
  return { x: actor.x - pivot.x + socket.x, y: actor.y - pivot.y + socket.y, depth: socket.depth };
}

/** Turns a clip event into what the player sees (contract §5.6). */
export function spawnFromEvent(event: ClipEvent, effects: Effect[]) {
  const { actor, clip, row, frame, name, siblings } = event;
  const heading = facingOf(clip.atlas, row);
  const scale = clip.atlas.meta.scale ?? 1;

  // An area skill (`aoe`) draws its own rings in the sheet: nothing is added on top of them.
  if ((name === 'cast' || name === 'release') && clip.tags.includes('aoe')) return;

  if (name === 'hit') {
    const socket = HIT_SOCKETS.map((n) => socketPoint(actor, clip, row, frame, n)).find((s) => s !== null);
    // Just past the tip of the weapon; without sockets, a fixed distance in front of the body.
    const at = socket
      ? { x: socket.x + Math.cos(heading) * 12, y: socket.y + Math.sin(heading) * 12 }
      : { x: actor.x + Math.cos(heading) * 46, y: actor.y + Math.sin(heading) * 46 - 40 };
    effects.push({ type: 'ring', ...at, age: 0, life: 0.3, radius: 30, tone: 'hit' });
  } else if (name === 'cast') {
    const at = socketPoint(actor, clip, row, frame, 'center') ?? { x: actor.x, y: actor.y - 60, depth: 1 };
    effects.push({ type: 'ring', x: at.x, y: at.y, age: 0, life: 0.4, radius: 26, tone: 'cast' });
  } else if (name === 'release') {
    // The projectile leaves the socket named by the `spawn:<socket>` event of the same frame.
    const socket = siblings.find((n) => n.startsWith('spawn:'))?.slice('spawn:'.length) ?? 'center';
    const at = socketPoint(actor, clip, row, frame, socket) ?? { x: actor.x, y: actor.y - 60, depth: 1 };
    const speed = PROJECTILE_SPEED * scale;
    effects.push({
      type: 'projectile', x: at.x, y: at.y, vx: Math.cos(heading) * speed, vy: Math.sin(heading) * speed,
      age: 0, life: PROJECTILE_RANGE / PROJECTILE_SPEED, behind: at.depth <= 0,
    });
  } else if (name === 'land') {
    effects.push({ type: 'ring', x: actor.x, y: actor.y, age: 0, life: 0.35, radius: 28, tone: 'land' });
  }
}

const clamp = (n: number, min: number, max: number) => Math.max(min, Math.min(max, n));

/**
 * Ages the effects. A projectile ends where its range runs out or where it leaves the scene, and a ring marks the spot,
 * so a shot fired toward the camera (or the edge) still shows where it went.
 */
export function stepEffects(effects: Effect[], dt: number, bounds?: { width: number; height: number }): Effect[] {
  const alive: Effect[] = [];
  for (const effect of effects) {
    effect.age += dt;
    if (effect.type === 'projectile') {
      effect.x += effect.vx * dt;
      effect.y += effect.vy * dt;
      const outside = bounds && (effect.x < 0 || effect.x > bounds.width || effect.y < 0 || effect.y > bounds.height);
      if (effect.age >= effect.life || outside) {
        const x = bounds ? clamp(effect.x, 0, bounds.width) : effect.x;
        const y = bounds ? clamp(effect.y, 0, bounds.height) : effect.y;
        alive.push({ type: 'ring', x, y, age: 0, life: 0.3, radius: 22, tone: 'hit' });
        continue;
      }
    }
    if (effect.age < effect.life) alive.push(effect);
  }
  return alive;
}
