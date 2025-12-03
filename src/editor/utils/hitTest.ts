import { PoolTableConfig, Point } from '../model/PoolTableConfig';

export interface HitResult {
    type: 'object' | 'handle';
    objectId: string;
    handleIndex?: number;
}

export function hitTest(
    config: PoolTableConfig,
    x: number,
    y: number,
    zoom: number
): string | null {
    const threshold = 10 / zoom; // Hit tolerance in world units

    // Check Spawn Points
    for (const spawn of config.spawnPoints) {
        const dist = Math.hypot(spawn.x - x, spawn.y - y);
        if (dist < 5 + threshold) { // 5 is visual radius
            return spawn.id;
        }
    }

    // Check Pockets
    for (const pocket of config.pockets) {
        const dist = Math.hypot(pocket.x - x, pocket.y - y);
        if (dist < pocket.radius) {
            return pocket.id;
        }
    }

    // Check Rails (Polygon point in polygon or distance to edge)
    for (const rail of config.rails) {
        if (isPointInPolygon({ x, y }, rail.points)) {
            return rail.id;
        }
        // Also check distance to edges for easier selection
        if (distanceToPolygonEdges({ x, y }, rail.points) < threshold) {
            return rail.id;
        }
    }

    // Check Regions
    for (const region of config.regions) {
        if (isPointInPolygon({ x, y }, region.points)) {
            return region.id;
        }
    }

    return null;
}

export function hitTestHandle(
    config: PoolTableConfig,
    selection: string[],
    x: number,
    y: number,
    zoom: number
): { objectId: string; handleIndex: number } | null {
    const handleRadius = 5 / zoom;

    // Check Rails
    for (const rail of config.rails) {
        if (selection.includes(rail.id)) {
            for (let i = 0; i < rail.points.length; i++) {
                const p = rail.points[i];
                if (Math.hypot(p.x - x, p.y - y) < handleRadius) {
                    return { objectId: rail.id, handleIndex: i };
                }
            }
        }
    }

    // Future: Check Pocket resize handles, etc.

    return null;
}

function isPointInPolygon(p: Point, vertices: Point[]): boolean {
    let inside = false;
    for (let i = 0, j = vertices.length - 1; i < vertices.length; j = i++) {
        const xi = vertices[i].x, yi = vertices[i].y;
        const xj = vertices[j].x, yj = vertices[j].y;
        const intersect = ((yi > p.y) !== (yj > p.y)) &&
            (p.x < (xj - xi) * (p.y - yi) / (yj - yi) + xi);
        if (intersect) inside = !inside;
    }
    return inside;
}

function distanceToPolygonEdges(p: Point, vertices: Point[]): number {
    let minDistance = Infinity;
    for (let i = 0; i < vertices.length; i++) {
        const p1 = vertices[i];
        const p2 = vertices[(i + 1) % vertices.length];
        const dist = distanceToSegment(p, p1, p2);
        if (dist < minDistance) {
            minDistance = dist;
        }
    }
    return minDistance;
}

function distanceToSegment(p: Point, v: Point, w: Point): number {
    const l2 = (v.x - w.x) ** 2 + (v.y - w.y) ** 2;
    if (l2 === 0) return Math.hypot(p.x - v.x, p.y - v.y);
    let t = ((p.x - v.x) * (w.x - v.x) + (p.y - v.y) * (w.y - v.y)) / l2;
    t = Math.max(0, Math.min(1, t));
    return Math.hypot(p.x - (v.x + t * (w.x - v.x)), p.y - (v.y + t * (w.y - v.y)));
}
