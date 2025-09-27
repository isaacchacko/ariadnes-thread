// pathfinding.ts

export type Point = { x: number; y: number };
export type Grid = number[][]; // 0 = open, 1 = wall

const key = (p: Point) => `${p.x},${p.y}`;
const unkey = (s: string): Point => {
  const [x, y] = s.split(",").map(Number);
  return { x, y };
};

export const equal = (a: Point, b: Point) => a.x === b.x && a.y === b.y;

const neighbors4 = (p: Point): Point[] => [
  { x: p.x + 1, y: p.y },
  { x: p.x - 1, y: p.y },
  { x: p.x, y: p.y + 1 },
  { x: p.x, y: p.y - 1 },
];

// Cardinal direction vector (normalized to -1/0/1)
const dir = (a: Point, b: Point): Point => ({
  x: Math.sign(b.x - a.x),
  y: Math.sign(b.y - a.y),
});

// Bresenham line between integer grid points (inclusive)
const bresenham = (a: Point, b: Point): Point[] => {
  const points: Point[] = [];
  let x0 = a.x, y0 = a.y;
  const x1 = b.x, y1 = b.y;
  const dx = Math.abs(x1 - x0);
  const sx = x0 < x1 ? 1 : -1;
  const dy = -Math.abs(y1 - y0);
  const sy = y0 < y1 ? 1 : -1;
  let err = dx + dy;

  while (true) {
    points.push({ x: x0, y: y0 });
    if (x0 === x1 && y0 === y1) break;
    const e2 = 2 * err;
    if (e2 >= dy) { err += dy; x0 += sx; }
    if (e2 <= dx) { err += dx; y0 += sy; }
  }
  return points;
};

// Turn/chokepoint detection helpers
const isCollinear = (a: Point, b: Point, c: Point) => {
  const ab = dir(a, b);
  const bc = dir(b, c);
  return ab.x === bc.x && ab.y === bc.y;
};

/**
 * 1) Build a dictionary (Map) of 'turns':
 *    Given a list of open coordinates (actual open cells),
 *    mark nodes that are:
 *    - fork/chokepoint if degree != 2, OR
 *    - true 90° bend if degree == 2 but neighbors are not collinear.
 *    The value lists the neighbor coordinates (possible outgoing directions).
 */
export function buildTurnMap(openCoords: Point[]): Map<string, Point[]> {
  const open = new Set(openCoords.map(key));
  const turnMap = new Map<string, Point[]>();

  for (const s of open) {
    const p = unkey(s);
    const nbrs = neighbors4(p).filter(q => open.has(key(q)));
    if (nbrs.length === 0) continue;

    let isTurn = false;
    if (nbrs.length !== 2) {
      isTurn = true; // dead-end, T, or cross
    } else {
      const [n1, n2] = nbrs;
      isTurn = !isCollinear(n1, p, n2);
    }
    if (isTurn) turnMap.set(s, nbrs);
  }
  return turnMap;
}

/**
 * Utility: build turn map directly from a grid (0=open, 1=wall).
 */
export function buildTurnMapFromGrid(grid: Grid): Map<string, Point[]> {
  const openCells: Point[] = [];
  for (let y = 0; y < grid.length; y++) {
    for (let x = 0; x < grid[0].length; x++) {
      if (grid[y][x] === 0) openCells.push({ x, y });
    }
  }
  return buildTurnMap(openCells);
}

/**
 * 2) Rasterize a polyline (list of cartesian coordinates) into a 2D grid (width×height),
 *    WITHOUT any tolerance/dilation. Only exact Bresenham cells are open.
 *    Everything else is a wall (1).
 */
export function rasterizePathsToGrid(
  polyline: Point[],
  width: number,
  height: number
): Grid {
  const rawOpen = new Set<string>();
  for (let i = 0; i < polyline.length - 1; i++) {
    const a = polyline[i], b = polyline[i + 1];
    for (const p of bresenham(a, b)) {
      if (p.x >= 0 && p.x < width && p.y >= 0 && p.y < height) {
        rawOpen.add(key(p));
      }
    }
  }

  // Build grid (1 = wall by default, 0 = open for path cells only)
  const grid: Grid = Array.from({ length: height }, () => Array.from({ length: width }, () => 1));
  for (const s of rawOpen) {
    const { x, y } = unkey(s);
    grid[y][x] = 0; // open
  }
  return grid;
}

/**
 * Helper: snap a point to the nearest open cell (BFS) or return null if none.
 */
export function findNearestOpen(start: Point, grid: Grid): Point | null {
  const H = grid.length, W = grid[0].length;
  const inb = (x: number, y: number) => x >= 0 && y >= 0 && x < W && y < H;

  if (inb(start.x, start.y) && grid[start.y][start.x] === 0) return start;

  const q: Point[] = [start];
  const seen = new Set<string>([key(start)]);
  const steps = [{x:1,y:0},{x:-1,y:0},{x:0,y:1},{x:0,y:-1}];

  while (q.length) {
    const p = q.shift()!;
    for (const d of steps) {
      const nx = p.x + d.x, ny = p.y + d.y;
      if (!inb(nx, ny)) continue;
      const k = `${nx},${ny}`;
      if (seen.has(k)) continue;
      seen.add(k);
      if (grid[ny][nx] === 0) return { x: nx, y: ny };
      q.push({ x: nx, y: ny });
    }
  }
  return null;
}

/**
 * 3) A* search on a 2D grid (4-connected), returning:
 *    - path: shortest list of Points from start→goal (inclusive), or [] if none
 *    - turns: list of Points along that path where direction changes (or that are listed in turnMap)
 *
 *    Heuristic: Manhattan
 *    Cost: uniform (1 per move)
 */
export function aStarWithTurns(
  grid: Grid,
  start: Point,
  goal: Point,
  turnMap: Map<string, Point[]>
): { path: Point[]; turns: Point[] } {
  // Early out if start/goal are not open
  const H = grid.length, W = grid[0].length;
  const inb = (p: Point) => p.x >= 0 && p.y >= 0 && p.x < W && p.y < H;
  if (!inb(start) || !inb(goal) || grid[start.y][start.x] !== 0 || grid[goal.y][goal.x] !== 0) {
    return { path: [], turns: [] };
  }

  const h = (p: Point) => Math.abs(p.x - goal.x) + Math.abs(p.y - goal.y);

  const openSet = new Set<string>([key(start)]);
  const cameFrom = new Map<string, string>();

  const gScore = new Map<string, number>();
  const fScore = new Map<string, number>();
  gScore.set(key(start), 0);
  fScore.set(key(start), h(start));

  const popMin = (): string | null => {
    let best: string | null = null;
    let bestF = Infinity;
    for (const s of openSet) {
      const f = fScore.get(s) ?? Infinity;
      if (f < bestF) { bestF = f; best = s; }
    }
    if (best) openSet.delete(best);
    return best;
  };

  const isOpen = (p: Point) =>
    p.x >= 0 && p.x < W && p.y >= 0 && p.y < H && grid[p.y][p.x] === 0;

  while (openSet.size > 0) {
    const currentKey = popMin();
    if (!currentKey) break;
    const current = unkey(currentKey);

    if (equal(current, goal)) {
      // Reconstruct path
      const path: Point[] = [];
      let cur = currentKey;
      while (cur) {
        path.push(unkey(cur));
        cur = cameFrom.get(cur) ?? "";
        if (!cur) break;
      }
      path.reverse();

      // Compute turns
      const turnSet = new Set<string>();
      // (A) geometric turns
      for (let i = 1; i < path.length - 1; i++) {
        const a = path[i - 1], b = path[i], c = path[i + 1];
        if (!isCollinear(a, b, c)) turnSet.add(key(b));
      }
      // (B) chokepoints from turnMap that lie on the path
      for (const p of path) {
        const k = key(p);
        if (turnMap.has(k)) turnSet.add(k);
      }

      const turns = Array.from(turnSet).map(unkey);
      return { path, turns };
    }

    for (const n of neighbors4(current)) {
      if (!isOpen(n)) continue;
      const nk = key(n);
      const tentative = (gScore.get(currentKey) ?? Infinity) + 1;
      if (tentative < (gScore.get(nk) ?? Infinity)) {
        cameFrom.set(nk, currentKey);
        gScore.set(nk, tentative);
        fScore.set(nk, tentative + h(n));
        if (![...openSet].includes(nk)) openSet.add(nk);
      }
    }
  }

  return { path: [], turns: [] };
}

// --------- Extras (handy for debugging) ----------

export function gridToString(grid: Grid, path: Point[] = [], start?: Point, goal?: Point, turns: Point[] = [], allTurns: Point[] = []): string {
  const H = grid.length, W = grid[0].length;
  const pathSet = new Set(path.map(key));
  const turnSet = new Set(turns.map(key));
  const allTurnSet = new Set(allTurns.map(key));
  const sKey = start ? key(start) : null;
  const gKey = goal ? key(goal) : null;

  let out = "";
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const k = `${x},${y}`;
      if (sKey === k) out += "S";
      else if (gKey === k) out += "G";
      else if (turnSet.has(k)) out += "T";  // T for turns taken on path
      else if (allTurnSet.has(k)) out += "t";  // t for other turns in grid
      else if (pathSet.has(k)) out += "*";
      else out += grid[y][x] === 0 ? "." : "#";
    }
    out += "\n";
  }
  return out;
}

export function extractOpenCells(grid: Grid): Point[] {
  const out: Point[] = [];
  for (let y = 0; y < grid.length; y++) {
    for (let x = 0; x < grid[0].length; x++) {
      if (grid[y][x] === 0) out.push({ x, y });
    }
  }
  return out;
}
