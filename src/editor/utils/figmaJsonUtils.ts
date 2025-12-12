/**
 * Figma JSON Parser for Pool Table Geometry
 * 
 * Parses Figma's JSON export format to extract table geometry (rails, pockets, play area).
 * This is a cleaner alternative to SVG parsing since Figma JSON provides structured data.
 */

// Re-export compatible interfaces from svgUtils
export interface RailDef {
    id: string;
    points: { x: number; y: number }[];
}

export interface PocketDef {
    id: string;
    outline: { x: number; y: number }[];
    center: { x: number; y: number };
    radius: number;
    sourceTag: string;
}

export interface ParsedTableData {
    rails: RailDef[];
    pockets: PocketDef[];
    playArea?: { x: number; y: number; width: number; height: number; corners: { x: number; y: number }[] };
}

// Figma JSON types - using loose typing to accept raw JSON imports
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type FigmaNode = Record<string, any>;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type FigmaDocument = Record<string, any>;

interface ScaleInfo {
    pixelsPerInch: number;
    offsetX: number;
    offsetY: number;
}

/**
 * Parse Figma JSON export to extract table geometry
 */
export function parseFigmaJSON(json: FigmaDocument | string): ParsedTableData {
    const doc: FigmaDocument = typeof json === 'string' ? JSON.parse(json) : json;

    const rails: RailDef[] = [];
    const pockets: PocketDef[] = [];
    let playAreaData: ParsedTableData['playArea'] | undefined;

    // Find all children (flatten if needed)
    const allNodes = flattenNodes(doc.children || []);

    // 1. Find play_area to establish coordinate system
    const playAreaNode = allNodes.find(n => n.name.toLowerCase().includes('play_area'));

    const scale: ScaleInfo = { pixelsPerInch: 7.68, offsetX: 0, offsetY: 0 }; // Default: 768px / 100in
    let playAreaCorners: { x: number; y: number }[] = [];

    if (playAreaNode) {
        const { width, height, x, y, rotation } = playAreaNode;

        // Calculate center accounting for rotation
        // relativeTransform gives us the actual position after transforms
        let cx = x + width / 2;
        let cy = y + height / 2;

        // If rotated 180 degrees, the transform matrix tells us the actual position
        if (playAreaNode.relativeTransform) {
            const [[a, , tx], [, d, ty]] = playAreaNode.relativeTransform;
            // For 180 degree rotation: a=-1, d=-1
            // The tx, ty give us the origin point after transform
            if (a < 0 && d < 0) {
                // Rotated 180: actual top-left is at (tx - width, ty - height)
                cx = tx - width / 2;
                cy = ty - height / 2;
            }
        }

        scale.pixelsPerInch = width / 100.0; // Standard table width = 100 inches
        scale.offsetX = cx;
        scale.offsetY = cy;

        // Calculate corners in world space
        const halfW = width / 2;
        const halfH = height / 2;
        const rotRad = (rotation || 0) * Math.PI / 180;

        const localCorners = [
            { x: -halfW, y: -halfH },
            { x: halfW, y: -halfH },
            { x: halfW, y: halfH },
            { x: -halfW, y: halfH },
        ];

        playAreaCorners = localCorners.map(c => {
            // Rotate around center
            const cos = Math.cos(rotRad);
            const sin = Math.sin(rotRad);
            const rx = c.x * cos - c.y * sin;
            const ry = c.x * sin + c.y * cos;
            // Transform to world inches (flip Y for physics)
            return { x: rx / scale.pixelsPerInch, y: -ry / scale.pixelsPerInch };
        });

        playAreaData = {
            x: 0,
            y: 0,
            width: width / scale.pixelsPerInch,
            height: height / scale.pixelsPerInch,
            corners: playAreaCorners,
        };

        // Seed rails with play_area edges
        rails.push(
            { id: 'play_area_north', points: [playAreaCorners[0], playAreaCorners[1]] },
            { id: 'play_area_east', points: [playAreaCorners[1], playAreaCorners[2]] },
            { id: 'play_area_south', points: [playAreaCorners[2], playAreaCorners[3]] },
            { id: 'play_area_west', points: [playAreaCorners[3], playAreaCorners[0]] },
        );

        console.log(`[figmaJsonUtils] Scale: PPI=${scale.pixelsPerInch.toFixed(3)}, Offset=(${scale.offsetX.toFixed(1)}, ${scale.offsetY.toFixed(1)})`);
    } else {
        console.warn('[figmaJsonUtils] No play_area node found!');
    }

    // 2. Parse cushions (rails)
    const cushionNodes = allNodes.filter(n => n.name.toLowerCase().includes('cushion'));
    console.log(`[figmaJsonUtils] Found ${cushionNodes.length} cushion nodes.`);

    cushionNodes.forEach((node, index) => {
        const id = node.name || `cushion_${index}`;

        // Use simple simple bounds (x, y, width, height) if available to generate clean rects
        // This is much more robust than parsing complex vector paths from Figma.
        const w = node.width;
        const h = node.height;

        if (typeof w === 'number' && typeof h === 'number') {
            // Generate 4 corners in LOCAL space (0,0 is top-left of the node)
            const localCorners = [
                { x: 0, y: 0 },
                { x: w, y: 0 },
                { x: w, y: h },
                { x: 0, y: h }
            ];

            // Transform to WORLD space
            let transformX = node.x;
            let transformY = node.y;
            let flipX = 1;
            let flipY = 1;
            const rotRad = (node.rotation || 0) * Math.PI / 180;

            if (node.relativeTransform) {
                const [[a, , tx], [, d, ty]] = node.relativeTransform;
                transformX = tx;
                transformY = ty;
                flipX = a < 0 ? -1 : 1;
                flipY = d < 0 ? -1 : 1;
            }

            const points = localCorners.map(p => {
                let lx = p.x * flipX;
                let ly = p.y * flipY;

                // Apply rotation if relativeTransform didn't already
                if (!node.relativeTransform && Math.abs(rotRad) > 0.001) {
                    const cos = Math.cos(rotRad);
                    const sin = Math.sin(rotRad);
                    const rx = lx * cos - ly * sin;
                    const ry = lx * sin + ly * cos;
                    lx = rx;
                    ly = ry;
                }

                const worldX = transformX + lx;
                const worldY = transformY + ly;
                return transformPoint(worldX, worldY, scale);
            });

            // Create the 4 segments of the rectangle
            const rectSegments: { from: { x: number; y: number }; to: { x: number; y: number } }[] = [];
            for (let i = 0; i < 4; i++) {
                rectSegments.push({ from: points[i], to: points[(i + 1) % 4] });
            }

            // Select the SINGLE segment closest to the center (Inner Face)
            let bestSegment = rectSegments[0];
            let minDst = Infinity;

            rectSegments.forEach(seg => {
                const midX = (seg.from.x + seg.to.x) * 0.5;
                const midY = (seg.from.y + seg.to.y) * 0.5;
                const dst = Math.hypot(midX, midY);
                if (dst < minDst) {
                    minDst = dst;
                    bestSegment = seg;
                }
            });

            rails.push({ id: `${id}_inner`, points: [bestSegment.from, bestSegment.to] });

        } else {
            // Fallback for non-rectangular cushion nodes (unlikely)
            const vertices = extractVertices(node, scale);
            if (vertices.length >= 2) {
                const segments: { from: { x: number; y: number }; to: { x: number; y: number }; dist: number }[] = [];
                for (let i = 0; i < vertices.length; i++) {
                    const from = vertices[i];
                    const to = vertices[(i + 1) % vertices.length];
                    const midX = (from.x + to.x) * 0.5;
                    const midY = (from.y + to.y) * 0.5;
                    segments.push({ from, to, dist: Math.hypot(midX, midY) });
                }

                // Fallback: simple closest-to-center heuristic
                let bestSeg = segments[0];
                let minD = Infinity;
                segments.forEach(s => { if (s.dist < minD) { minD = s.dist; bestSeg = s; } });
                rails.push({ id: `${id}_fallback`, points: [bestSeg.from, bestSeg.to] });
            }
        }
    });

    console.log(`[figmaJsonUtils] Parsed ${rails.length} rails total.`);

    // 3. Parse pockets
    const pocketNodes = allNodes.filter(n =>
        n.name.toLowerCase().includes('pocket') &&
        !n.name.toLowerCase().includes('felt')
    );
    console.log(`[figmaJsonUtils] Found ${pocketNodes.length} pocket nodes.`);

    pocketNodes.forEach((node, index) => {
        // Ensure unique ID by appending index, as Figma names are not unique
        const baseId = node.name || `pocket`;
        const id = `${baseId}_${index}`;

        if (node.type === 'ELLIPSE') {
            // Circle pocket - straightforward
            const cx = node.x + node.width / 2;
            const cy = node.y + node.height / 2;
            const radius = node.width / 2;

            const center = transformPoint(cx, cy, scale);
            const radiusInches = radius / scale.pixelsPerInch;

            // Generate outline points
            const SEGMENTS = 16;
            const outline: { x: number; y: number }[] = [];
            for (let i = 0; i < SEGMENTS; i++) {
                const theta = (i / SEGMENTS) * Math.PI * 2;
                const px = cx + Math.cos(theta) * radius;
                const py = cy + Math.sin(theta) * radius;
                outline.push(transformPoint(px, py, scale));
            }

            pockets.push({ id, outline, center, radius: radiusInches, sourceTag: 'ellipse' });
        } else if (node.type === 'VECTOR' && node.vectorNetwork) {
            // Vector pocket - use vertices
            const vertices = extractVertices(node, scale);
            if (vertices.length > 0) {
                const minX = Math.min(...vertices.map(v => v.x));
                const maxX = Math.max(...vertices.map(v => v.x));
                const minY = Math.min(...vertices.map(v => v.y));
                const maxY = Math.max(...vertices.map(v => v.y));

                const center = { x: (minX + maxX) / 2, y: (minY + maxY) / 2 };
                const radius = Math.max(maxX - minX, maxY - minY) / 2;

                pockets.push({ id, outline: vertices, center, radius, sourceTag: 'vector' });
            }
        }
    });

    // 4. Parse pocket felts (optional, for visual outline)
    const feltNodes = allNodes.filter(n => n.name.toLowerCase().includes('felt'));
    feltNodes.forEach((node, index) => {
        const id = node.name || `pocket_felt_${index}`;
        const vertices = extractVertices(node, scale);

        if (vertices.length > 0) {
            const minX = Math.min(...vertices.map(v => v.x));
            const maxX = Math.max(...vertices.map(v => v.x));
            const minY = Math.min(...vertices.map(v => v.y));
            const maxY = Math.max(...vertices.map(v => v.y));

            const center = { x: (minX + maxX) / 2, y: (minY + maxY) / 2 };
            const radius = Math.max(maxX - minX, maxY - minY) / 2;

            // Check if we already have a pocket near this center
            const existingPocket = pockets.find(p =>
                Math.hypot(p.center.x - center.x, p.center.y - center.y) < 3
            );

            if (!existingPocket) {
                pockets.push({ id, outline: vertices, center, radius, sourceTag: 'felt' });
            }
        }
    });

    console.log(`[figmaJsonUtils] Parsed ${pockets.length} pockets.`);

    return { rails, pockets, playArea: playAreaData };
}

/**
 * Flatten nested node tree into a single array
 */
function flattenNodes(nodes: FigmaNode[]): FigmaNode[] {
    const result: FigmaNode[] = [];

    function traverse(node: FigmaNode) {
        result.push(node);
        if (node.children) {
            node.children.forEach(traverse);
        }
    }

    nodes.forEach(traverse);
    return result;
}

/**
 * Extract world-space vertices from a Figma node
 */
function extractVertices(node: FigmaNode, scale: ScaleInfo): { x: number; y: number }[] {
    const vertices: { x: number; y: number }[] = [];

    // Get node's position and rotation
    const nodeX = node.x;
    const nodeY = node.y;
    const rotRad = (node.rotation || 0) * Math.PI / 180;

    // Check for relativeTransform to get actual position
    let transformX = nodeX;
    let transformY = nodeY;
    let flipX = 1;
    let flipY = 1;

    if (node.relativeTransform) {
        const [[a, , tx], [, d, ty]] = node.relativeTransform;
        transformX = tx;
        transformY = ty;
        flipX = a < 0 ? -1 : 1;
        flipY = d < 0 ? -1 : 1;
    }

    if (node.vectorNetwork?.vertices) {
        // Use structured vertex data
        node.vectorNetwork.vertices.forEach((v: { x: number; y: number }) => {
            // Local coordinates within the node
            let lx = v.x * flipX;
            let ly = v.y * flipY;

            // Apply rotation if any
            if (Math.abs(rotRad) > 0.001) {
                const cos = Math.cos(rotRad);
                const sin = Math.sin(rotRad);
                const rx = lx * cos - ly * sin;
                const ry = lx * sin + ly * cos;
                lx = rx;
                ly = ry;
            }

            // Transform to world space
            const worldX = transformX + lx * flipX;
            const worldY = transformY + ly * flipY;

            vertices.push(transformPoint(worldX, worldY, scale));
        });
    }

    return vertices;
}

/**
 * Transform a point from Figma pixels to physics inches (centered on play_area, Y-up)
 */
function transformPoint(x: number, y: number, scale: ScaleInfo): { x: number; y: number } {
    const localX = x - scale.offsetX;
    const localY = y - scale.offsetY;
    return {
        x: localX / scale.pixelsPerInch,
        y: -localY / scale.pixelsPerInch, // Flip Y for physics
    };
}

// Convenience export matching svgUtils signature
export const parseJSON = parseFigmaJSON;
