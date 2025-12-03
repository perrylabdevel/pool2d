export interface Point {
    x: number;
    y: number;
}

export interface PoolTableConfig {
    id: string;
    name: string;
    width: number;
    height: number;
    feltColor: string;
    railColor: string;
    cushionColor: string;
    defaultBallRadius: number;
    rails: RailConfig[];
    pockets: PocketConfig[];
    spawnPoints: SpawnPointConfig[];
    regions: RegionConfig[];
    frame?: FrameConfig; // Optional frame object
    renderOrder?: string[]; // Array of types to determine draw order
}

export interface FrameConfig {
    id: string;
    points: Point[]; // Outer boundary of the table
    thickness: number;
    color: string;
}

export interface RailConfig {
    id: string;
    points: Point[]; // Polygon vertices
    type: 'cushion' | 'frame'; // Distinguish between playable cushion and visual frame
    bounciness?: number; // Optional physics override
    color?: string;
}

export interface PocketConfig {
    id: string;
    x: number;
    y: number;
    radius: number;
    type: 'corner' | 'side';
    label?: string;
    color?: string;
}

export interface SpawnPointConfig {
    id: string;
    x: number;
    y: number;
    label: string;
    color?: string;
}

export interface RegionConfig {
    id: string;
    points: Point[];
    type: string; // e.g., 'kitchen', 'rack'
    label?: string;
    color?: string;
}
