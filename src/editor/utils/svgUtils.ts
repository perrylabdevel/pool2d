

import { CONFIG } from '../../config';

export interface SVGScaleInfo {
    pixelsPerInch: number;
    offsetX: number;
    offsetY: number;
    rotationRad?: number;
    rotationCx?: number;
    rotationCy?: number;
}

export interface RailDef {
    id: string;
    points: { x: number; y: number }[];
}

export interface PocketDef {
    id: string;
    outline: { x: number; y: number }[]; // Visual/Physics outline from path
    center: { x: number; y: number }; // Center for game logic
    radius: number; // Approximate radius
    sourceTag: string; // circle|path
}

export interface ParsedTableData {
    rails: RailDef[];
    pockets: PocketDef[];
    playArea?: { x: number; y: number; width: number; height: number; corners: { x: number; y: number }[] };
}

// ----------------------------------------------------------------------
// 1. Robust SVG Path Tokenizer & Parser
// ----------------------------------------------------------------------

class PathParser {
    tokens: string[];
    currentIdx: number = 0;

    // State for flatten logic
    cursor: { x: number; y: number } = { x: 0, y: 0 };
    startPoint: { x: number; y: number } = { x: 0, y: 0 }; // For 'Z' close path

    constructor(d: string) {
        this.tokens = this.tokenize(d);
    }

    // Split path string into Commands and Numbers, handling implicit separators
    private tokenize(d: string): string[] {
        const tokens: string[] = [];
        const regex = /([a-zA-Z])|([-+]?(?:\d*\.\d+|\d+)(?:[eE][-+]?\d+)?)/g;
        let match;
        while ((match = regex.exec(d)) !== null) {
            if (match[1]) tokens.push(match[1]);      // Command
            if (match[2]) tokens.push(match[2]);      // Number
        }
        return tokens;
    }

    private nextIsNumber(): boolean {
        if (this.currentIdx >= this.tokens.length) return false;
        const t = this.tokens[this.currentIdx];
        return !/^[a-zA-Z]$/.test(t);
    }

    private eatNumber(): number {
        if (this.currentIdx >= this.tokens.length) return 0;
        const val = parseFloat(this.tokens[this.currentIdx]);
        this.currentIdx++;
        return Number.isFinite(val) ? val : 0;
    }

    private eatCommand(): string | null {
        if (this.currentIdx >= this.tokens.length) return null;
        const t = this.tokens[this.currentIdx];
        if (/^[a-zA-Z]$/.test(t)) {
            this.currentIdx++;
            return t;
        }
        return null;
    }

    // Convert SVG Path to flattened list of Absolute points
    parse(scale: SVGScaleInfo): { x: number; y: number }[] {
        const points: { x: number; y: number }[] = [];
        let lastCmd = '';

        while (this.currentIdx < this.tokens.length) {
            let cmd = this.eatCommand();
            if (!cmd) {
                if (lastCmd === 'M') cmd = 'L';
                else if (lastCmd === 'm') cmd = 'l';
                else cmd = lastCmd;
            }
            lastCmd = cmd;

            switch (cmd) {
                case 'M':
                    this.cursor.x = this.eatNumber();
                    this.cursor.y = this.eatNumber();
                    this.startPoint = { ...this.cursor };
                    points.push(this.transform(this.cursor.x, this.cursor.y, scale));
                    break;
                case 'm':
                    this.cursor.x += this.eatNumber();
                    this.cursor.y += this.eatNumber();
                    this.startPoint = { ...this.cursor };
                    points.push(this.transform(this.cursor.x, this.cursor.y, scale));
                    break;
                case 'L':
                    this.cursor.x = this.eatNumber();
                    this.cursor.y = this.eatNumber();
                    points.push(this.transform(this.cursor.x, this.cursor.y, scale));
                    break;
                case 'l':
                    this.cursor.x += this.eatNumber();
                    this.cursor.y += this.eatNumber();
                    points.push(this.transform(this.cursor.x, this.cursor.y, scale));
                    break;
                case 'H':
                    this.cursor.x = this.eatNumber();
                    points.push(this.transform(this.cursor.x, this.cursor.y, scale));
                    break;
                case 'h':
                    this.cursor.x += this.eatNumber();
                    points.push(this.transform(this.cursor.x, this.cursor.y, scale));
                    break;
                case 'V':
                    this.cursor.y = this.eatNumber();
                    points.push(this.transform(this.cursor.x, this.cursor.y, scale));
                    break;
                case 'v':
                    this.cursor.y += this.eatNumber();
                    points.push(this.transform(this.cursor.x, this.cursor.y, scale));
                    break;
                case 'Z':
                case 'z':
                    this.cursor = { ...this.startPoint };
                    break;
                case 'C':
                    {
                        const x1 = this.eatNumber();
                        const y1 = this.eatNumber();
                        const x2 = this.eatNumber();
                        const y2 = this.eatNumber();
                        const x = this.eatNumber();
                        const y = this.eatNumber();
                        this.addCubic(this.cursor.x, this.cursor.y, x1, y1, x2, y2, x, y, scale, points);
                        this.cursor = { x, y };
                    }
                    break;
                case 'c':
                    {
                        const x1 = this.cursor.x + this.eatNumber();
                        const y1 = this.cursor.y + this.eatNumber();
                        const x2 = this.cursor.x + this.eatNumber();
                        const y2 = this.cursor.y + this.eatNumber();
                        const x = this.cursor.x + this.eatNumber();
                        const y = this.cursor.y + this.eatNumber();
                        this.addCubic(this.cursor.x, this.cursor.y, x1, y1, x2, y2, x, y, scale, points);
                        this.cursor = { x, y };
                    }
                    break;
                // TODO: S, Q, T, A support if needed. For now we assume table.svg uses C/L/M.
                default:
                    console.warn(`[svgUtils] Unsupported command '${cmd}', skipping.`);
                    while (this.nextIsNumber()) { this.eatNumber(); }
                    break;
            }
        }
        return points;
    }

    // De Casteljau subdivision for smooth curves
    private addCubic(
        p0x: number, p0y: number,
        p1x: number, p1y: number,
        p2x: number, p2y: number,
        p3x: number, p3y: number,
        scale: SVGScaleInfo,
        results: { x: number, y: number }[]
    ) {
        const SEGMENTS = 8; // Resolution of curves
        for (let i = 1; i <= SEGMENTS; i++) {
            const t = i / SEGMENTS;
            const mt = 1 - t;
            const mt2 = mt * mt;
            const mt3 = mt * mt * mt;
            const t2 = t * t;
            const t3 = t * t * t;

            const x = mt3 * p0x + 3 * mt2 * t * p1x + 3 * mt * t2 * p2x + t3 * p3x;
            const y = mt3 * p0y + 3 * mt2 * t * p1y + 3 * mt * t2 * p2y + t3 * p3y;
            results.push(this.transform(x, y, scale));
        }
    }

    public transform(x: number, y: number, scale: SVGScaleInfo) {
        // 0. Optional rotation around pivot (match play_area transform)
        let rx = x;
        let ry = y;
        if (scale.rotationRad && Math.abs(scale.rotationRad) > 1e-6) {
            const cx = scale.rotationCx ?? 0;
            const cy = scale.rotationCy ?? 0;
            const dx = x - cx;
            const dy = y - cy;
            const cos = Math.cos(scale.rotationRad);
            const sin = Math.sin(scale.rotationRad);
            rx = cx + dx * cos - dy * sin;
            ry = cy + dx * sin + dy * cos;
        }

        // 1. Translate so play_area center is 0,0
        const localX = rx - scale.offsetX;
        const localY = ry - scale.offsetY;

        // 2. Scale to inches
        const inchX = localX / scale.pixelsPerInch;
        const inchY = localY / scale.pixelsPerInch;

        // 3. Flip Y because SVG is Y-Down, Physics/ThreeJS is Y-Up
        return { x: inchX, y: -inchY };
    }
}

// ----------------------------------------------------------------------
// 2. Helpers
// ----------------------------------------------------------------------
const rotatePoint = (x: number, y: number, cx: number, cy: number, angleRad: number) => {
    const dx = x - cx;
    const dy = y - cy;
    const cos = Math.cos(angleRad);
    const sin = Math.sin(angleRad);
    return {
        x: cx + dx * cos - dy * sin,
        y: cy + dx * sin + dy * cos,
    };
};

// Helper to find all elements matching a loose ID within the document or subtree
function findElementsLoose(root: Element | Document, idKeyword: string): Element[] {
    const results: Element[] = [];
    const scope: Document | Element | null =
        root instanceof Document ? root : root ?? null;
    if (!scope) return results;

    // Include the root itself when it matches (querySelectorAll won't check the root node)
    if (!(root instanceof Document) && (root as Element).id?.includes(idKeyword)) {
        results.push(root as Element);
    }

    const matches = Array.from(scope.querySelectorAll(`[id*="${idKeyword}"]`));
    matches.forEach((el) => results.push(el as Element));
    return results;
}

const getElementCenter = (el: Element): { x: number, y: number } | null => {
    // Basic heuristic: check for cx/cy (circle) or x/y/width/height (rect)
    // or parse path? For pockets (circles), cx/cy is best.
    const cx = parseFloat(el.getAttribute('cx') || '');
    const cy = parseFloat(el.getAttribute('cy') || '');
    if (Number.isFinite(cx) && Number.isFinite(cy)) return { x: cx, y: cy };

    // Fallback: Bounds of path? (Expensive, maybe unneeded for pockets if they are circles in SVG)
    return null;
}

// ----------------------------------------------------------------------
// 3. Main Export
// ----------------------------------------------------------------------

export const parseSVG = (svgString: string): ParsedTableData => {
    const parser = new DOMParser();
    const doc = parser.parseFromString(svgString, 'image/svg+xml');

    // 1. Calculate Scale
    let scale: SVGScaleInfo = { pixelsPerInch: 10, offsetX: 0, offsetY: 0, rotationRad: 0, rotationCx: 0, rotationCy: 0 };

    const playArea = doc.querySelector('[id*="play_area"]');
    let playAreaCorners: { x: number; y: number }[] = [];
    if (playArea) {
        const w = parseFloat(playArea.getAttribute('width') || '0');
        const h = parseFloat(playArea.getAttribute('height') || '0');
        let x = parseFloat(playArea.getAttribute('x') || '0');
        let y = parseFloat(playArea.getAttribute('y') || '0');
        const transform = playArea.getAttribute('transform') || '';

        // FIX: Handle Rotate transform on play_area to get correct center
        // Assumption: rotate(180 center_x center_y) is common.
        // We really just want the VISUAL CENTER of this rect.
        // If rotated 180, center remains the same relative to the rotation pivot?
        // Center of rect = x + w/2, y + h/2.

        let cx = x + w / 2;
        let cy = y + h / 2;

        // Handle rotate(angle cx cy) on the play_area to place the center correctly.
        // The current asset uses rotate(180 831 426), which flips the rect around a pivot
        // far from its own center, so we must rotate the center point as well.
        const rotateMatch = transform.match(/rotate\(\s*([+-]?\d*\.?\d+(?:[eE][+-]?\d+)?)\s*(?:([+-]?\d*\.?\d+(?:[eE][+-]?\d+)?)\s+([+-]?\d*\.?\d+(?:[eE][+-]?\d+)?)\s*)?\)/);
        let rotationPivotX = cx;
        let rotationPivotY = cy;
        let rotationRad = 0;
        let rotatedCenter = { x: cx, y: cy };
        if (rotateMatch) {
            const angleDeg = parseFloat(rotateMatch[1]);
            if (Number.isFinite(angleDeg)) {
                rotationRad = angleDeg * Math.PI / 180;
                const pivotXRaw = rotateMatch[2] !== undefined ? parseFloat(rotateMatch[2]) : cx;
                const pivotYRaw = rotateMatch[3] !== undefined ? parseFloat(rotateMatch[3]) : cy;
                rotatedCenter = rotatePoint(cx, cy, pivotXRaw, pivotYRaw, rotationRad);
                // Keep original SVG pivot for rotation (so corners match true visual pose)
                rotationPivotX = pivotXRaw;
                rotationPivotY = pivotYRaw;
            }
        }

        // Naive transform check: if rotated 180 around a point, find that point?
        // Actually, if we just want to center the physics world on the visual center of the play area:
        // We should use the geometrical center of the 'play_area' shape.
        // For a rect, it's just the center. Rotation around its own center doesn't change the center.
        // Rotation around an arbitrary point DOES.

        // Let's assume the play_area RECT defines the playable bounds.
        // We use its center as (0,0).
        // If the SVG has 'rotate(180 831 426)', it rotates around 831,426 (Top-Left of rect).
        // 180 deg rotation around Top-Left:
        // New Center = TopLeft + (TopLeft - OldCenter) = 2*TopLeft - OldCenter.
        // This seems complex to guess. 
        // BETTER APPROACH: Just use the center of the 'play_area' rect attributes.
        // The user likely aligned the play_area rect with the table.
        // If it's rotated, it might be upside down, but the CENTER is likely still the reference.

        if (w > 0) {
            scale.pixelsPerInch = w / 100.0; // 100 inches standard width
            scale.offsetX = rotatedCenter.x;
            scale.offsetY = rotatedCenter.y;
            // Do not rotate individual elements; only rotate corners for bounds.
            scale.rotationRad = 0;
            scale.rotationCx = 0;
            scale.rotationCy = 0;
            console.log(`[svgUtils] Scale found: PPI=${scale.pixelsPerInch}, Offset=(${scale.offsetX}, ${scale.offsetY})`);

            // Capture play_area corners (after rotation) for a canonical boundary reference
            const cornersPx = [
                { x, y },
                { x: x + w, y },
                { x: x + w, y: y + h },
                { x, y: y + h },
            ].map(pt => rotateMatch ? rotatePoint(pt.x, pt.y, rotationPivotX, rotationPivotY, rotationRad) : pt);

            playAreaCorners = cornersPx.map(pt => applyTransform(pt.x, pt.y, scale));
        } else {
            console.warn('[svgUtils] play_area width is 0 or missing!');
        }
    } else {
        console.warn('[svgUtils] No element with id containing "play_area" found!');
    }

    // 2. Parse Rails (Cushions)
    // Look for 'cushion' keyword. 
    // They might be <path> or <g>. If <g>, flatten all paths inside.
    const rails: RailDef[] = [];
    // Seed rails with play_area rectangle to disambiguate boundary
    if (playAreaCorners.length === 4) {
        rails.push(
            { id: 'play_area_north', points: [playAreaCorners[0], playAreaCorners[1]] },
            { id: 'play_area_east', points: [playAreaCorners[1], playAreaCorners[2]] },
            { id: 'play_area_south', points: [playAreaCorners[2], playAreaCorners[3]] },
            { id: 'play_area_west', points: [playAreaCorners[3], playAreaCorners[0]] },
        );
    }
    const cushionNodes = findElementsLoose(doc, 'cushion');
    console.log(`[svgUtils] Found ${cushionNodes.length} cushion nodes.`);

    cushionNodes.forEach((node, index) => {
        const id = node.id || `cushion_${index}`;
        let paths: Element[] = [];

        if (node.tagName === 'path') paths.push(node);
        else if (node.tagName === 'g') {
            paths = Array.from(node.querySelectorAll('path'));
        }

        // For each path, pick only the segments closest to table center (inner rail face)
        paths.forEach(p => {
            const d = p.getAttribute('d') || '';
            const pathParser = new PathParser(d);
            const parsed = pathParser.parse(scale);
            if (parsed.some(pt => isNaN(pt.x) || isNaN(pt.y))) {
                console.error(`[svgUtils] NaN detected in cushion ${id} path!`);
            }
            const segments: { from: { x: number; y: number }; to: { x: number; y: number }; dist: number }[] = [];
            for (let i = 0; i < parsed.length; i++) {
                const from = parsed[i];
                const to = parsed[(i + 1) % parsed.length];
                const midX = (from.x + to.x) * 0.5;
                const midY = (from.y + to.y) * 0.5;
                segments.push({ from, to, dist: Math.hypot(midX, midY) });
            }
            if (!segments.length) return;
            const minDist = Math.min(...segments.map(s => s.dist));
            const TOLERANCE_IN = 0.5; // accept near-inner faces
            segments
                .filter(s => s.dist <= minDist + TOLERANCE_IN)
                .forEach((seg, segIdx) => {
                    rails.push({ id: `${id}_seg${segIdx}`, points: [seg.from, seg.to] });
                });
        });
    });
    console.log(`[svgUtils] Parsed ${rails.length} rails.`);

    // 3. Parse Pockets
    const pockets: PocketDef[] = [];
    const pocketNodes = findElementsLoose(doc, 'pocket');
    console.log(`[svgUtils] Found ${pocketNodes.length} pocket nodes.`);

    pocketNodes.forEach((node, index) => {
        const id = node.id || `pocket_${index} `;
        let points: { x: number, y: number }[] = [];
        let center = { x: 0, y: 0 };
        let radius = 2.25; // Default
        let sourceTag = node.tagName;

        // Prefer circle center for pivot/radius; if a circle exists, ignore path for center/radius and outline.
        const circleEl = node.tagName === 'circle' ? node : (node.querySelector?.('circle') as Element | null);
        if (circleEl) {
            const cx = parseFloat(circleEl.getAttribute('cx') || '0');
            const cy = parseFloat(circleEl.getAttribute('cy') || '0');
            const r = parseFloat(circleEl.getAttribute('r') || '0');
            const pp = new PathParser('');
            center = pp.transform(cx, cy, scale);
            radius = r / scale.pixelsPerInch;
            sourceTag = 'circle';

            const SEGMENTS = 16;
            for (let i = 0; i < SEGMENTS; i++) {
                const theta = (i / SEGMENTS) * Math.PI * 2;
                const px = cx + Math.cos(theta) * r;
                const py = cy + Math.sin(theta) * r;
                points.push(pp.transform(px, py, scale));
            }
        } else if (node.tagName === 'path') {
            // Fallback: path-only pocket (e.g., felt), use its outline for center/radius
            const d = node.getAttribute('d') || '';
            const pp = new PathParser(d);
            const outline = pp.parse(scale);
            if (outline.length) {
                points = outline;
                let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
                outline.forEach(p => {
                    minX = Math.min(minX, p.x); maxX = Math.max(maxX, p.x);
                    minY = Math.min(minY, p.y); maxY = Math.max(maxY, p.y);
                });
                center = { x: (minX + maxX) / 2, y: (minY + maxY) / 2 };
                radius = Math.max(maxX - minX, maxY - minY) / 2;
                sourceTag = 'path';
            }
        }

        if (points.length > 0) {
            pockets.push({ id, outline: points, center, radius, sourceTag });
        }
    });

    const playAreaData = playArea && playAreaCorners.length === 4
        ? (() => {
            const xs = playAreaCorners.map(p => p.x);
            const ys = playAreaCorners.map(p => p.y);
            const minX = Math.min(...xs);
            const maxX = Math.max(...xs);
            const minY = Math.min(...ys);
            const maxY = Math.max(...ys);
            return {
                x: scale.offsetX,
                y: scale.offsetY,
                width: maxX - minX,
                height: maxY - minY,
                corners: playAreaCorners,
            };
        })()
        : undefined;

    return { rails, pockets, playArea: playAreaData };
};

export const flattenPath = (d: string, scale: SVGScaleInfo) => {
    return new PathParser(d).parse(scale);
}
// Apply the same transform logic used by PathParser (rotation -> translate -> scale -> flip Y)
const applyTransform = (x: number, y: number, scale: SVGScaleInfo) => {
    let rx = x;
    let ry = y;
    if (scale.rotationRad && Math.abs(scale.rotationRad) > 1e-6) {
        const cx = scale.rotationCx ?? 0;
        const cy = scale.rotationCy ?? 0;
        const dx = x - cx;
        const dy = y - cy;
        const cos = Math.cos(scale.rotationRad);
        const sin = Math.sin(scale.rotationRad);
        rx = cx + dx * cos - dy * sin;
        ry = cy + dx * sin + dy * cos;
    }
    const localX = rx - scale.offsetX;
    const localY = ry - scale.offsetY;
    return { x: localX / scale.pixelsPerInch, y: -localY / scale.pixelsPerInch };
};
