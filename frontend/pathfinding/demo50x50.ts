// demo50x50.ts
import {
    Point,
    rasterizePathsToGrid,
    buildTurnMapFromGrid,
    aStarWithTurns,
    gridToString,
  } from "./pathfinding";
  
  // Build a 50x50 test polyline layout (multiple corridors + branches).
  // We'll stitch several polylines together by listing their waypoints
  // sequentially—this creates a connected maze-like path network.
  
  const WIDTH = 50;
  const HEIGHT = 50;
  
  // Helper to push a rectilinear segment sequence (manhattan waypoints)
  const pushLine = (arr: Point[], pts: Point[]) => {
    if (arr.length > 0 && pts.length > 0) {
      const last = arr[arr.length - 1];
      if (last.x !== pts[0].x || last.y !== pts[0].y) {
        // If disjoint, just continue—this will connect via dilation if close,
        // or remain separate corridors otherwise.
      }
    }
    for (const p of pts) arr.push(p);
  };
  
  const polyline: Point[] = [];
  
  // Main horizontal spine
  pushLine(polyline, [
    { x: 2, y: 10 }, { x: 47, y: 10 }
  ]);
  
  // Vertical spine crossing center
  pushLine(polyline, [
    { x: 25, y: 10 }, { x: 25, y: 40 }
  ]);
  
  // Lower horizontal route
  pushLine(polyline, [
    { x: 5, y: 30 }, { x: 45, y: 30 }
  ]);
  
  // Upper-right branch
  pushLine(polyline, [
    { x: 35, y: 10 }, { x: 35, y: 5 }, { x: 45, y: 5 }
  ]);
  
  // Lower-left branch with a bend
  pushLine(polyline, [
    { x: 10, y: 30 }, { x: 10, y: 40 }, { x: 20, y: 40 }
  ]);
  
  // Mid maze-ish zigzag
  pushLine(polyline, [
    { x: 15, y: 20 }, { x: 30, y: 20 }, { x: 30, y: 25 }, { x: 20, y: 25 }, { x: 20, y: 15 }
  ]);
  
  // Another crossing near bottom
  pushLine(polyline, [
    { x: 40, y: 30 }, { x: 40, y: 45 }, { x: 10, y: 45 }
  ]);
  
  // Rasterize with tolerance = 2 (two cells “thick” around the paths)
  const grid = rasterizePathsToGrid(polyline, WIDTH, HEIGHT, 2);
  
  // Build turn map from the resulting open cells
  const turnMap = buildTurnMapFromGrid(grid);
  
  // Choose a start and goal that should be connected
  const start: Point = { x: 4, y: 10 };  // near left of main spine
  const goal: Point = { x: 42, y: 45 };  // near bottom-right corridor
  
  const { path, turns } = aStarWithTurns(grid, start, goal, turnMap);
  
  // Print summaries
  console.log("Grid (S=start, G=goal, *=path, .=open, #=wall):");
  console.log(gridToString(grid, path, start, goal));
  
  console.log(`Path length: ${path.length}`);
  console.log(`Turns found: ${turns.length}`);
  console.log("Turn coordinates:");
  console.log(turns.map(t => `(${t.x},${t.y})`).join(", "));
  