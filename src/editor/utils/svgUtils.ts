import { PoolTableConfig, RailConfig, PocketConfig, SpawnPointConfig } from '../model/PoolTableConfig';

export const exportToSVG = (config: PoolTableConfig): string => {
    const { width, height, rails, pockets, spawnPoints, frame } = config;
    const halfWidth = width / 2;
    const halfHeight = height / 2;

    // ViewBox centered at 0,0 is tricky for some editors, but standard for our game coords.
    // Let's use a viewBox that covers the table area.
    // Our coords are -w/2 to w/2.
    // SVG viewBox min-x, min-y, width, height
    // min-x = -halfWidth - padding, min-y = -halfHeight - padding
    const padding = 100; // Extra space for frame etc
    const viewBox = `${-halfWidth - padding} ${-halfHeight - padding} ${width + padding * 2} ${height + padding * 2}`;

    let svg = `<?xml version="1.0" encoding="UTF-8" standalone="no"?>\n`;
    svg += `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${viewBox}" width="${width + padding * 2}" height="${height + padding * 2}">\n`;
    svg += `  <defs>\n`;
    svg += `    <style>\n`;
    svg += `      .rail { fill: #2c3e50; stroke: none; }\n`;
    svg += `      .pocket { fill: #000000; stroke: none; }\n`;
    svg += `      .spawn { fill: #ffffff; stroke: #000000; stroke-width: 2; }\n`;
    svg += `      .frame { fill: #8b4513; stroke: none; }\n`;
    svg += `      .felt { fill: #27ae60; stroke: none; }\n`;
    svg += `    </style>\n`;
    svg += `  </defs>\n`;

    // Draw Frame (if exists)
    if (frame) {
        const d = frame.points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ') + ' Z';
        svg += `  <g id="frame">\n`;
        svg += `    <path id="${frame.id}" d="${d}" class="frame" />\n`;
        svg += `  </g>\n`;
    }

    // Draw Felt (Rect)
    svg += `  <g id="felt">\n`;
    svg += `    <rect x="${-halfWidth}" y="${-halfHeight}" width="${width}" height="${height}" class="felt" />\n`;
    svg += `  </g>\n`;

    // Draw Rails
    svg += `  <g id="rails">\n`;
    rails.forEach(rail => {
        const d = rail.points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ') + ' Z';
        svg += `    <path id="${rail.id}" d="${d}" class="rail" />\n`;
    });
    svg += `  </g>\n`;

    // Draw Pockets
    svg += `  <g id="pockets">\n`;
    pockets.forEach(pocket => {
        svg += `    <circle id="${pocket.id}" cx="${pocket.x}" cy="${pocket.y}" r="${pocket.radius}" class="pocket" />\n`;
    });
    svg += `  </g>\n`;

    // Draw Spawns
    svg += `  <g id="spawns">\n`;
    spawnPoints.forEach(spawn => {
        svg += `    <circle id="${spawn.id}" cx="${spawn.x}" cy="${spawn.y}" r="10" class="spawn" />\n`;
    });
    svg += `  </g>\n`;

    svg += `</svg>`;
    return svg;
};

export const parseSVG = (svgString: string): Partial<PoolTableConfig> => {
    const parser = new DOMParser();
    const doc = parser.parseFromString(svgString, 'image/svg+xml');

    const rails: RailConfig[] = [];
    const pockets: PocketConfig[] = [];
    // We might not import spawns/frame yet, or we can add them.

    // Helper to parse path data 'd' into points
    // This is a naive parser for M and L commands.
    // For robust parsing, we'd need a library or use browser SVG API if possible.
    // Since we are in browser, we can try to use SVGPathElement interface if we mount it?
    // But we can't easily mount it.
    // Let's try a regex for "M x y L x y ... Z" or just coordinate pairs.
    const parsePointsFromPath = (d: string): { x: number, y: number }[] => {
        // Remove commands and split by whitespace/commas
        const clean = d.replace(/[a-zA-Z]/g, ' ').trim();
        const nums = clean.split(/[\s,]+/).map(parseFloat);
        const points: { x: number, y: number }[] = [];
        for (let i = 0; i < nums.length; i += 2) {
            if (!isNaN(nums[i]) && !isNaN(nums[i + 1])) {
                points.push({ x: nums[i], y: nums[i + 1] });
            }
        }
        return points;
    };

    // Find Rails (paths in #rails group or just paths with class 'rail')
    const railPaths = doc.querySelectorAll('g#rails path, path.rail');
    railPaths.forEach((path, index) => {
        const d = path.getAttribute('d');
        if (d) {
            const points = parsePointsFromPath(d);
            if (points.length > 2) {
                rails.push({
                    id: path.id || `rail-imported-${index}`,
                    type: 'cushion', // Default
                    points
                });
            }
        }
    });

    // Find Pockets (circles in #pockets group or class 'pocket')
    const pocketCircles = doc.querySelectorAll('g#pockets circle, circle.pocket');
    pocketCircles.forEach((circle, index) => {
        const cx = parseFloat(circle.getAttribute('cx') || '0');
        const cy = parseFloat(circle.getAttribute('cy') || '0');
        const r = parseFloat(circle.getAttribute('r') || '20');
        pockets.push({
            id: circle.id || `pocket-imported-${index}`,
            type: 'corner', // Default, maybe infer from position?
            x: cx,
            y: cy,
            radius: r
        });
    });

    const result: Partial<PoolTableConfig> = {};
    if (rails.length > 0) result.rails = rails;
    if (pockets.length > 0) result.pockets = pockets;

    return result;
};
