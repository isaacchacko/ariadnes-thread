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

// Dilate a set of points by Chebyshev radius r (square neighborhood)
const dilateChebyshev = (openSet: Set<string>, width: number, height: number, r: number): Set<string> => {
  if (r <= 0) return new Set(openSet);
  const out = new Set<string>();
  for (const s of openSet) {
    const { x, y } = unkey(s);
    for (let dx = -r; dx <= r; dx++) {
      for (let dy = -r; dy <= r; dy++) {
        const nx = x + dx, ny = y + dy;
        if (nx >= 0 && nx < width && ny >= 0 && ny < height) out.add(key({ x: nx, y: ny }));
      }
    }
  }
  return out;
};

// Turn/chokepoint detection helpers
const isCollinear = (a: Point, b: Point, c: Point) => {
  const ab = dir(a, b);
  const bc = dir(b, c);
  return ab.x === bc.x && ab.y === bc.y;
};

/**
 * 1) Build a dictionary (Map) of 'turns':
 *    Given a list of open coordinates (NOT just waypoints—actual open cells),
 *    we compute, for every node, the 4-neighborhood degree. We mark a node as:
 *    - a fork/chokepoint if degree != 2, OR
 *    - a true 90° bend if degree == 2 but neighbors are not collinear.
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
      // Exactly two neighbors: check if they form a straight line through p
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
 *    then "thicken" paths by tolerance=2 on each side via Chebyshev dilation.
 *    Everything not in the dilated set becomes a wall (1).
 * 
 *    Notes:
 *    - We connect successive points in the given list with Bresenham segments.
 *    - If you have multiple separate polylines, call this function with the concatenated
 *      points and insert a sentinel to break? Simpler approach: call multiple times and OR
 *      the open sets, or pass all polylines joined and they’ll connect—your choice.
 */
export function rasterizePathsToGrid(
  polyline: Point[],
  width: number,
  height: number,
  tolerance: number = 2
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
  const dilated = dilateChebyshev(rawOpen, width, height, Math.max(0, tolerance));
  // Build grid
  const grid: Grid = Array.from({ length: height }, () => Array.from({ length: width }, () => 1));
  for (const s of dilated) {
    const { x, y } = unkey(s);
    grid[y][x] = 0; // open
  }
  return grid;
}

/**
 * 3) A* search on a 2D grid (4-connected), returning:
 *    - path: shortest list of Points from start→goal (inclusive), or [] if none
 *    - turns: list of Points along that path where direction changes (or that are listed in turnMap)
 *
 *    Heuristic: Manhattan distance
 *    Cost: uniform (1 per move)
 *
 *    We also compute "turns" in two ways:
 *      (A) geometric turns (where direction vector changes),
 *      (B) chokepoints that appear in the provided turnMap.
 */
export function aStarWithTurns(
  grid: Grid,
  start: Point,
  goal: Point,
  turnMap: Map<string, Point[]>
): { path: Point[]; turns: Point[] } {
  const h = (p: Point) => Math.abs(p.x - goal.x) + Math.abs(p.y - goal.y);
  const height = grid.length, width = grid[0].length;

  const openSet = new Set<string>([key(start)]);
  const cameFrom = new Map<string, string>();

  const gScore = new Map<string, number>();
  const fScore = new Map<string, number>();
  gScore.set(key(start), 0);
  fScore.set(key(start), h(start));

  // Simple binary-heap substitute: pick min fScore by scan (OK for 50x50).
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
    p.x >= 0 && p.x < width && p.y >= 0 && p.y < height && grid[p.y][p.x] === 0;

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

export function gridToString(grid: Grid, path: Point[] = [], start?: Point, goal?: Point): string {
  const H = grid.length, W = grid[0].length;
  const pathSet = new Set(path.map(key));
  const sKey = start ? key(start) : null;
  const gKey = goal ? key(goal) : null;

  let out = "";
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const k = `${x},${y}`;
      if (sKey === k) out += "S";
      else if (gKey === k) out += "G";
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
