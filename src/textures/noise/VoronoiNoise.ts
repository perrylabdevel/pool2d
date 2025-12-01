export class VoronoiNoise {
    /**
     * Generate Voronoi (cellular) noise
     * @param x - X coordinate
     * @param y - Y coordinate
     * @param cellSize - Size of each cell (larger = bigger cells)
     * @returns Distance to nearest cell center [0, 1]
     */
    static noise2D(x: number, y: number, cellSize: number = 1): number {
        const cellX = Math.floor(x / cellSize);
        const cellY = Math.floor(y / cellSize);

        let minDist = Infinity;

        // Check 3x3 neighborhood of cells
        for (let dy = -1; dy <= 1; dy++) {
            for (let dx = -1; dx <= 1; dx++) {
                const nx = cellX + dx;
                const ny = cellY + dy;

                // Get point in this cell (seeded by cell coords)
                const point = this.cellPoint(nx, ny, cellSize);

                // Distance to this point
                const dist = Math.sqrt(
                    (x - point.x) ** 2 + (y - point.y) ** 2
                );

                minDist = Math.min(minDist, dist);
            }
        }

        // Normalize (cellSize is max possible distance)
        return minDist / cellSize;
    }

    private static cellPoint(cx: number, cy: number, cellSize: number) {
        // Pseudo-random point in cell
        const hash = this.hash2D(cx, cy);
        const px = (cx + hash % 1000 / 1000) * cellSize;
        const py = (cy + (hash / 1000) % 1000 / 1000) * cellSize;
        return { x: px, y: py };
    }

    private static hash2D(x: number, y: number): number {
        // Simple hash function
        return ((x * 73856093) ^ (y * 19349663)) >>> 0;
    }
}
