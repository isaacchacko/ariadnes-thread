// app/types/session.ts
export type Waypoint = {
    id: string;
    tMs: number;
    headingDeg: number;
    photoUri?: string;
    label?: string; // <-- add this
};

export type Edge = {
    fromId: string;
    toId: string;
    weight: number;
    turnDeg?: number;
};

export type Session = {
    id: string;
    startedAt: number;
    durationMs: number;
    nodes: Waypoint[];
    edges: Edge[];
    stats: {
        nNodes: number;
        elapsedMs: number;
        estDistanceM?: number;
    };
};
