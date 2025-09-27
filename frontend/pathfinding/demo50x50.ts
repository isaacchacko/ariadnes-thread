// demo50x50.ts
import {
  rasterizePathsToGrid,
  buildTurnMapFromGrid,
  aStarWithTurns,
  gridToString,
  Point,
  findNearestOpen,
} from "./pathfinding"; // works with tsx

// Helper function to convert string keys back to points
const unkey = (s: string): Point => {
  const [x, y] = s.split(",").map(Number);
  return { x, y };
};

// Build a 50x50 test polyline layout (multiple corridors + branches).
// NOTE: No tolerance — corridors are 1-cell wide, so waypoints must intersect exactly.

const WIDTH = 50;
const HEIGHT = 50;

// Helper to push a rectilinear segment sequence (manhattan waypoints)
const pushLine = (arr: Point[], pts: Point[]) => {
  for (const p of pts) arr.push(p);
};

const polyline: Point[] = [];

// Main horizontal spine
pushLine(polyline, [
  { x: 2, y: 10 }, { x: 47, y: 10 }
]);

// Vertical spine crossing center (shares {25,10})
pushLine(polyline, [
  { x: 25, y: 10 }, { x: 25, y: 40 }
]);

// Lower horizontal route (shares {40,30} with next)
pushLine(polyline, [
  { x: 5, y: 30 }, { x: 45, y: 30 }
]);

// Upper-right branch (shares {35,10} with main spine)
pushLine(polyline, [
  { x: 35, y: 10 }, { x: 35, y: 5 }, { x: 45, y: 5 }
]);

// Lower-left branch with a bend (shares {10,30})
pushLine(polyline, [
  { x: 10, y: 30 }, { x: 10, y: 40 }, { x: 20, y: 40 }
]);

// Mid maze-ish zigzag
pushLine(polyline, [
  { x: 15, y: 20 }, { x: 30, y: 20 }, { x: 30, y: 25 }, { x: 20, y: 25 }, { x: 20, y: 15 }
]);

// Another crossing near bottom: vertical down then left
pushLine(polyline, [
  { x: 40, y: 30 }, { x: 40, y: 45 }, { x: 10, y: 45 }
]);

// Rasterize WITHOUT tolerance (only exact Bresenham cells are open)
const grid = rasterizePathsToGrid(polyline, WIDTH, HEIGHT);

// Build turn map from the resulting open cells
const turnMap = buildTurnMapFromGrid(grid);

// Choose a start and goal (we'll snap them to the nearest open cell if needed)
let start: Point = { x: 4, y: 10 };   // near left of main spine
let goal: Point  = { x: 42, y: 45 };  // may be a wall (right of 40)—we'll snap it

const sOpen = findNearestOpen(start, grid);
const gOpen = findNearestOpen(goal, grid);

if (!sOpen || !gOpen) {
  console.error("Start or goal is not near an open cell. Adjust the coordinates.");
  process.exit(1);
}

start = sOpen;
goal = gOpen;

const { path, turns } = aStarWithTurns(grid, start, goal, turnMap);

// Get all turns in the grid
const allTurns = Array.from(turnMap.keys()).map(unkey);

// Print summaries
console.log("Grid (S=start, G=goal, T=turns taken on path, t=other turns, *=path, .=open, #=wall):");
console.log(gridToString(grid, path, start, goal, turns, allTurns));

console.log(`Path length: ${path.length}`);
console.log(`Turns found on path: ${turns.length}`);
console.log(`Total turns in grid: ${allTurns.length}`);
console.log("Turn coordinates on path:");
console.log(turns.map(t => `(${t.x},${t.y})`).join(", "));
