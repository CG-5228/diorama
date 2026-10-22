import type { SceneNavigation } from '@core/volume';
import type { Geometry } from './render';

const BLOCKED = 'rgba(239, 68, 68, 0.38)';
const SLOW = 'rgba(245, 158, 11, ';
const USE = 'rgba(56, 189, 248, 0.2)';
const WALL = '#ff5a36';
const OPEN_DOOR = '#34d399';

/**
 * Draws what a character can and cannot do on the scene, over the cells (the context carries the drawing's scale, `geo`
 * its logical px): cells that cannot be entered in translucent red, slower ground in amber (the stronger, the costlier),
 * the cells a thing is used from in blue, the edges that cannot be crossed as thick lines with a dot on each wall post, and doors that let through as green ones.
 */
export function drawNavigation(ctx: CanvasRenderingContext2D, nav: SceneNavigation, geo: Pick<Geometry, 'origin' | 'cell'>, pixel: number) {
  const { w, h } = geo.cell;
  const x0 = geo.origin.x - w / 2;
  const y0 = geo.origin.y - h / 2;
  const cell = (col: number, row: number, fill: string) => {
    ctx.fillStyle = fill;
    ctx.fillRect(x0 + col * w, y0 + row * h, w, h);
  };
  for (let row = 0; row < nav.rows; row++) {
    for (let col = 0; col < nav.cols; col++) {
      const cost = nav.cost[row][col];
      if (cost <= 0) cell(col, row, BLOCKED);
      else if (cost > 1) cell(col, row, `${SLOW}${Math.min(0.55, 0.12 + 0.14 * (cost - 1))})`);
    }
  }
  for (const thing of nav.interactables) for (const use of thing.cells) cell(use.col, use.row, USE);

  const stroke = (color: string, width: number) => {
    ctx.strokeStyle = color;
    ctx.lineWidth = width;
    ctx.lineCap = 'round';
    ctx.stroke();
  };
  ctx.beginPath();
  for (let row = 0; row < nav.rows; row++) {
    for (let col = 0; col < nav.cols; col++) {
      const bits = nav.walls[row][col];
      const x = x0 + col * w;
      const y = y0 + row * h;
      if (bits & 1) (ctx.moveTo(x, y), ctx.lineTo(x + w, y));
      if (bits & 2) (ctx.moveTo(x + w, y), ctx.lineTo(x + w, y + h));
      if (bits & 4) (ctx.moveTo(x, y + h), ctx.lineTo(x + w, y + h));
      if (bits & 8) (ctx.moveTo(x, y), ctx.lineTo(x, y + h));
    }
  }
  stroke('rgba(0, 0, 0, 0.65)', pixel * 5);
  ctx.beginPath();
  for (let row = 0; row < nav.rows; row++) {
    for (let col = 0; col < nav.cols; col++) {
      const bits = nav.walls[row][col];
      const x = x0 + col * w;
      const y = y0 + row * h;
      if (bits & 1) (ctx.moveTo(x, y), ctx.lineTo(x + w, y));
      if (bits & 2) (ctx.moveTo(x + w, y), ctx.lineTo(x + w, y + h));
      if (bits & 4) (ctx.moveTo(x, y + h), ctx.lineTo(x + w, y + h));
      if (bits & 8) (ctx.moveTo(x, y), ctx.lineTo(x, y + h));
    }
  }
  stroke(WALL, pixel * 3);
  // The posts of the walls (piers, pillars) are solid even where no edge is closed: a character is kept clear of them.
  ctx.fillStyle = WALL;
  for (let row = 0; row < nav.posts.length; row++) {
    for (let col = 0; col < nav.posts[row].length; col++) {
      if (!nav.posts[row][col]) continue;
      ctx.beginPath();
      ctx.arc(x0 + col * w, y0 + row * h, pixel * 3, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  // A door that lets characters through is the one edge a wall run leaves open.
  for (const door of nav.doors) {
    if (!door.open) continue;
    const x = x0 + door.col * w;
    const y = y0 + door.row * h;
    ctx.beginPath();
    if (door.edge === 'N') (ctx.moveTo(x + 2 * pixel, y), ctx.lineTo(x + w - 2 * pixel, y));
    else (ctx.moveTo(x, y + 2 * pixel), ctx.lineTo(x, y + h - 2 * pixel));
    stroke(OPEN_DOOR, pixel * 3);
  }
}
