import type { PhysicsJson, PhysicsJsonPocket, PhysicsJsonRail } from './JsonLoader';
import type { RailPocketSet } from '../stores/SkinStore';

type EdgeKey = 'top' | 'bottom' | 'left' | 'right';

type RailTile = {
  canvas: HTMLCanvasElement;
  width: number;
  height: number;
};

type ComposeResult = {
  dataUrl: string;
  width: number;
  height: number;
};

export async function composeRailPocketOverlay(params: {
  physicsJson: PhysicsJson;
  railPocketSet: RailPocketSet;
}): Promise<ComposeResult | null> {
  const { physicsJson, railPocketSet } = params;
  const assets = railPocketSet.assets;

  // Check for new separated asset architecture
  // New modular architecture only requires pocket hole overlays (rails overlap at corners/sides)
  const hasNewAssets = assets.pocketCornerHole && assets.pocketSideHole;

  // Require: rail tile + pocket hole overlays
  if (!assets.railMiddleTile || !hasNewAssets) {
    return null;
  }

  const ppi = railPocketSet.ppi ?? physicsJson.meta?.pixelsPerInch ?? 7.68;
  const seamOverlapPx = railPocketSet.seamOverlapPx ?? 2;
  const railThicknessPx = Math.max(1, railPocketSet.railThicknessPx);
  const pocketHoleRefRadius = railPocketSet.pocketHoleRefRadius ?? 2.4;

  const halfW = physicsJson.playArea.width / 2;
  const halfH = physicsJson.playArea.height / 2;
  const halfWpx = halfW * ppi;
  const halfHpx = halfH * ppi;

  const cushionWidthPx = railPocketSet.cushionWidthPx ?? 12;

  const railImage = await loadImage(assets.railMiddleTile);
  const railScale = railThicknessPx / railImage.height;

  // Load new modular assets (optional)
  const cushionImage = assets.railCushion ? await loadImage(assets.railCushion) : null;
  const feltImage = assets.playAreaFelt ? await loadImage(assets.playAreaFelt) : null;

  // Load pocket hole overlays
  // Load pocket hole overlays
  const pocketCornerHoleImage = await loadImage(assets.pocketCornerHole!);
  const pocketSideHoleImage = await loadImage(assets.pocketSideHole!);
  const pocketCornerRimImage = assets.pocketCornerRim ? await loadImage(assets.pocketCornerRim) : null;
  const pocketSideRimImage = assets.pocketSideRim ? await loadImage(assets.pocketSideRim) : null;

  // For margin calculations
  const cornerImage = pocketCornerHoleImage;
  const sideImage = pocketSideHoleImage;

  const railTile = createScaledTile(railImage, railThicknessPx);
  const railTileVertical = rotateTile90(railTile);

  const cushionTile = cushionImage ? createScaledTile(cushionImage, cushionWidthPx) : null;
  const cushionTileVertical = cushionTile ? rotateTile90(cushionTile) : null;

  // Calculate margins based on rail scale
  const cornerHalfPx = Math.max(cornerImage.width, cornerImage.height) * railScale * 0.5;
  const sideHalfPx = Math.max(sideImage.width, sideImage.height) * railScale * 0.5;
  const margin = Math.ceil(Math.max(railThicknessPx + cushionWidthPx, cornerHalfPx, sideHalfPx));

  const width = Math.round(physicsJson.playArea.width * ppi + margin * 2);
  const height = Math.round(physicsJson.playArea.height * ppi + margin * 2);

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;

  const ctx = canvas.getContext('2d');
  if (!ctx) return null;
  ctx.imageSmoothingEnabled = true;

  const debugJawMask =
    typeof window !== 'undefined' &&
    typeof window.location?.search === 'string' &&
    window.location.search.includes('debugJawMask=1');

  const centerX = margin + halfWpx;
  const centerY = margin + halfHpx;

  // CORNER APPROACH:
  // Rails extend BEYOND the play area to fill corners completely.
  // The gap at pocket openings will be created by clipping using cushion jaw geometry.
  const totalExtension = (railThicknessPx + cushionWidthPx) / ppi;
  const cornerHalfInX = -totalExtension;
  const cornerHalfInY = -totalExtension;
  const seamLines = buildSeamLines(halfW, halfH, {
    cornerHalfInX,
    cornerHalfInY,
  });

  // 1. Draw Play Area Felt (Fills background + Jaws, clipped to table bounds)
  if (feltImage) {
    // Calculate outer bounds (Play Area + Cushion + Rail)
    // This ensures we don't bleed into the infinite margin
    const totalHalfW = halfWpx + cushionWidthPx + railThicknessPx;
    const totalHalfH = halfHpx + cushionWidthPx + railThicknessPx;

    const drawW = totalHalfW * 2;
    const drawH = totalHalfH * 2;

    // Draw centered
    drawPlayAreaFelt(ctx, feltImage, centerX - totalHalfW, centerY - totalHalfH, drawW, drawH);
  }

  // 2. Draw Rails (Wood)
  // Rails drawn as continuous strips - pocket overlays will cover junction areas
  drawTiledSpans(ctx, seamLines, {
    tile: railTile,
    tileVertical: railTileVertical,
    seamOverlapPx,
    centerX,
    centerY,
    halfWpx,
    halfHpx,
    ppi,
    offsetFromEdgePx: cushionWidthPx,
    thicknessPx: railThicknessPx,
  });

  // 3. Draw Cushions (Physics Geometry)
  if (cushionImage) {
    const cushionCanvas = drawRailCushionLayer(
      canvas.width,
      canvas.height,
      cushionImage,
      physicsJson.rails,
      physicsJson.pockets,
      centerX,
      centerY,
      ppi
    );
    ctx.drawImage(cushionCanvas, 0, 0);
  }

  if (debugJawMask) {
    drawJawMask(ctx, physicsJson.rails, physicsJson.pockets, centerX, centerY, ppi, {
      mode: 'overlay',
      color: 'magenta',
      alpha: 0.35,
    });
  }


  // 4. Draw pocket features (Holes + Rims)
  drawPocketFeatures(ctx, physicsJson.pockets, {
    pocketCornerHoleImage,
    pocketSideHoleImage,
    pocketCornerRimImage,
    pocketSideRimImage,
    centerX,
    centerY,
    halfW,
    halfH,
    ppi,
    pocketHoleRefRadius,
    railScale,
  });

  return {
    dataUrl: canvas.toDataURL('image/png'),
    width,
    height,
  };
}



function buildSeamLines(
  halfW: number,
  halfH: number,
  offsets: { cornerHalfInX: number; cornerHalfInY: number }
): Record<EdgeKey, number[]> {
  const { cornerHalfInX, cornerHalfInY } = offsets;

  // Simplified: Rails are now continuous segments from corner to corner.
  // Side pockets are overlays, so we don't need gaps in the rail geometry.

  return {
    top: [-halfW + cornerHalfInX, halfW - cornerHalfInX],
    bottom: [-halfW + cornerHalfInX, halfW - cornerHalfInX],
    left: [halfH - cornerHalfInY, -halfH + cornerHalfInY],
    right: [halfH - cornerHalfInY, -halfH + cornerHalfInY],
  };
}

function drawJawMask(
  ctx: CanvasRenderingContext2D,
  rails: PhysicsJsonRail[],
  pockets: PhysicsJsonPocket[],
  centerX: number,
  centerY: number,
  ppi: number,
  options: { mode: 'cut' | 'overlay'; color?: string; alpha?: number }
) {
  ctx.save();
  if (options.mode === 'cut') {
    ctx.globalCompositeOperation = 'destination-out';
  }
  if (typeof options.alpha === 'number') {
    ctx.globalAlpha = options.alpha;
  }
  ctx.fillStyle = options.color ?? 'black';

  for (const rail of rails) {
    if (!rail.outline || rail.outline.length < 3) continue;

    // Find Nose (Longest Edge)
    let maxLen = 0;
    let noseIdx = -1;
    const len = rail.outline.length;
    for (let i = 0; i < len; i++) {
      const p1 = rail.outline[i];
      const p2 = rail.outline[(i + 1) % len];
      const dSq = distSq(p1, p2);
      if (dSq > maxLen) {
        maxLen = dSq;
        noseIdx = i;
      }
    }

    // Identify Jaws (Neighbors of Nose)
    // Jaw 1: Precedes NoseStart. (noseIdx - 1) -> NoseStart (noseIdx)
    // Jaw 2: Follows NoseEnd. NoseEnd (noseIdx+1) -> (noseIdx+2)

    const iNoseStart = noseIdx;
    const iNoseEnd = (noseIdx + 1) % len;

    const iJaw1Start = (iNoseStart - 1 + len) % len;
    const iJaw1End = iNoseStart;

    const iJaw2Start = iNoseEnd;
    const iJaw2End = (iNoseEnd + 1) % len;

    // Process Jaws
    const jaws = [
      { p1: rail.outline[iJaw1Start], p2: rail.outline[iJaw1End] },
      { p1: rail.outline[iJaw2Start], p2: rail.outline[iJaw2End] }
    ];

    for (const jaw of jaws) {
      const midX = (jaw.p1.x + jaw.p2.x) / 2;
      const midY = (jaw.p1.y + jaw.p2.y) / 2;

      const nearestPocket = findNearestPocket(pockets, midX, midY);
      if (!nearestPocket) continue;

      const dirX = nearestPocket.center.x - midX;
      const dirY = nearestPocket.center.y - midY;
      const lenDir = Math.sqrt(dirX * dirX + dirY * dirY);
      if (lenDir < 0.001) continue;

      const depthIn = Math.max(2, nearestPocket.radius * 2.5);
      const ExtX = (dirX / lenDir) * depthIn * ppi;
      const ExtY = (dirY / lenDir) * depthIn * ppi;

      // Draw Eraser Wedge
      // Logic: Jaw P1 -> Jaw P2 -> Extend Out -> Close
      const px1 = centerX + jaw.p1.x * ppi;
      const py1 = centerY - jaw.p1.y * ppi;

      const px2 = centerX + jaw.p2.x * ppi;
      const py2 = centerY - jaw.p2.y * ppi;

      // Extension uses NEGATIVE Y for Canvas Logic?
      // "ExtX, ExtY" are Delta X, Delta Y in Physics Space?
      // No, ExtX/Y derived from Nx/Ny.
      // If Nx is PHYSICS X.
      // Canvas X = Physics X.
      // Canvas Y = -Physics Y.
      // So we must flip Y component of Ext?

      // Let's preserve current space logic:
      // "finalNx, finalNy" were calculated using PHYSICS coordinates.
      // So they are PHYSICS VECTORS.
      // To apply to Canvas Points:
      // CanvasExtX = ExtX * ppi. (Already multiplied by ppi above).
      // CanvasExtY = -ExtY * ppi? 
      // Wait. "scale" is in PIXELS (5 * ppi). 
      // So ExtX, ExtY are PIXEL deltas in PHYSICS ORIENTATION.

      // Canvas X follows Physics X.
      // Canvas Y follows -Physics Y.
      // So correct Canvas Vector is { x: ExtX, y: -ExtY }.

      const CExtX = ExtX;
      const CExtY = -ExtY;

      ctx.beginPath();
      ctx.moveTo(px1, py1);
      ctx.lineTo(px2, py2);
      ctx.lineTo(px2 + CExtX, py2 + CExtY);
      ctx.lineTo(px1 + CExtX, py1 + CExtY);
      ctx.closePath();
      ctx.fill();
    }
  }

  ctx.restore();
}

function buildCushionInclusionPath(
  rails: PhysicsJsonRail[],
  centerX: number,
  centerY: number,
  ppi: number,
  railExtension: number
): Path2D {
  const path = new Path2D();

  // For each cushion, create an expanded polygon that covers where the rail should be drawn.
  // The rail should only be drawn behind/around the cushions, not in the gaps between them.
  for (const rail of rails) {
    if (!rail.outline || rail.outline.length < 3) continue;

    // Find the centroid of the cushion
    let cx = 0, cy = 0;
    for (const pt of rail.outline) {
      cx += pt.x;
      cy += pt.y;
    }
    cx /= rail.outline.length;
    cy /= rail.outline.length;

    // Expand each vertex outward from centroid to cover the rail zone
    const expandedOutline: Array<{ x: number, y: number }> = [];
    for (const pt of rail.outline) {
      const dx = pt.x - cx;
      const dy = pt.y - cy;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist < 0.01) {
        expandedOutline.push(pt);
      } else {
        // Expand by railExtension (in inches)
        const scale = (dist + railExtension / ppi) / dist;
        expandedOutline.push({
          x: cx + dx * scale,
          y: cy + dy * scale
        });
      }
    }

    // Draw the expanded polygon
    path.moveTo(centerX + expandedOutline[0].x * ppi, centerY - expandedOutline[0].y * ppi);
    for (let i = 1; i < expandedOutline.length; i++) {
      path.lineTo(centerX + expandedOutline[i].x * ppi, centerY - expandedOutline[i].y * ppi);
    }
    path.closePath();
  }

  return path;
}

function buildPocketExclusionPath(
  pockets: PhysicsJsonPocket[],
  centerX: number,
  centerY: number,
  ppi: number
): Path2D {
  const path = new Path2D();
  // Huge Outer Rect (Clockwise)
  path.rect(-10000, -10000, 20000, 20000);

  // Inner Circles (Counter-Clockwise) -> Holes
  for (const p of pockets) {
    const px = centerX + p.center.x * ppi;
    const py = centerY - p.center.y * ppi;
    // Use larger radius to cover the "gap" between cushion jaws where felt should show
    const clipRadius = p.radius * ppi * 2.0;
    path.arc(px, py, clipRadius, 0, Math.PI * 2, true);
  }
  return path;
}

function distSq(p1: { x: number, y: number }, p2: { x: number, y: number }) {
  const dx = p1.x - p2.x;
  const dy = p1.y - p2.y;
  return dx * dx + dy * dy;
}

function findNearestPocket(pockets: PhysicsJsonPocket[], x: number, y: number): PhysicsJsonPocket | null {
  let best: PhysicsJsonPocket | null = null;
  let bestDist = Infinity;
  for (const pocket of pockets) {
    const d = distSq(pocket.center, { x, y });
    if (d < bestDist) {
      bestDist = d;
      best = pocket;
    }
  }
  return best;
}

function drawPlayAreaFelt(
  ctx: CanvasRenderingContext2D,
  image: HTMLImageElement,
  x: number,
  y: number,
  width: number,
  height: number
) {
  const pattern = ctx.createPattern(image, 'repeat');
  if (!pattern) return;
  ctx.save();
  ctx.fillStyle = pattern;
  // Fill restricted bounds
  ctx.fillRect(x, y, width, height);
  ctx.restore();
}

function drawRailCushionOutlines(
  ctx: CanvasRenderingContext2D,
  rails: PhysicsJsonRail[],
  image: HTMLImageElement,
  centerX: number,
  centerY: number,
  ppi: number
) {
  const pattern = ctx.createPattern(image, 'repeat');
  if (!pattern) return;

  ctx.save();
  ctx.fillStyle = pattern;

  for (const rail of rails) {
    if (!rail.outline || rail.outline.length < 3) continue;

    ctx.beginPath();
    // Move to start
    const start = rail.outline[0];
    ctx.moveTo(centerX + start.x * ppi, centerY - start.y * ppi); // Note: Y flip might be needed? Physics usually Y-up. Canvas Y-down.

    for (let i = 1; i < rail.outline.length; i++) {
      const pt = rail.outline[i];
      ctx.lineTo(centerX + pt.x * ppi, centerY - pt.y * ppi);
    }
    ctx.closePath();
    ctx.fill();
  }
  ctx.restore();
}

function drawRailCushionLayer(
  width: number,
  height: number,
  image: HTMLImageElement,
  rails: PhysicsJsonRail[],
  pockets: PhysicsJsonPocket[],
  centerX: number,
  centerY: number,
  ppi: number
): HTMLCanvasElement {
  const cushionCanvas = document.createElement('canvas');
  cushionCanvas.width = width;
  cushionCanvas.height = height;
  const cushionCtx = cushionCanvas.getContext('2d');
  if (!cushionCtx) return cushionCanvas;

  drawRailCushionOutlines(cushionCtx, rails, image, centerX, centerY, ppi);
  drawJawMask(cushionCtx, rails, pockets, centerX, centerY, ppi, { mode: 'cut' });

  return cushionCanvas;
}

function drawTiledSpans(
  ctx: CanvasRenderingContext2D,
  seamLines: Record<EdgeKey, number[]>,
  params: {
    tile: RailTile;
    tileVertical: RailTile;
    seamOverlapPx: number;
    centerX: number;
    centerY: number;
    halfWpx: number;
    halfHpx: number;
    ppi: number;
    offsetFromEdgePx: number;
    thicknessPx: number;
  }
): void {
  const {
    tile,
    tileVertical,
    seamOverlapPx,
    centerX,
    centerY,
    halfWpx,
    halfHpx,
    ppi,
    offsetFromEdgePx,
    thicknessPx,
  } = params;

  // Calculate Y/X positions based on offset from PLAY AREA EDGE.
  // Top Edge Y = centerY - halfHpx
  // Top Rail Y = Top Edge Y - offsetFromEdgePx - thicknessPx

  const horizontalEdges: Array<{ key: 'top' | 'bottom'; y: number }> = [
    { key: 'top', y: centerY - halfHpx - offsetFromEdgePx - thicknessPx },
    { key: 'bottom', y: centerY + halfHpx + offsetFromEdgePx },
  ];

  for (const edge of horizontalEdges) {
    const seams = seamLines[edge.key].slice().sort((a, b) => a - b);
    for (let i = 0; i < seams.length - 1; i++) {
      // ... (existing seam logic)
      const start = seams[i];
      const end = seams[i + 1];
      const startPx = centerX + Math.min(start, end) * ppi + seamOverlapPx;
      const lengthPx = Math.max(0, Math.abs(end - start) * ppi - seamOverlapPx * 2);
      if (lengthPx <= 1) continue;
      drawTiledHorizontal(ctx, tile, startPx, edge.y, lengthPx);
    }
  }

  const verticalEdges: Array<{ key: 'left' | 'right'; x: number }> = [
    { key: 'left', x: centerX - halfWpx - offsetFromEdgePx - thicknessPx },
    { key: 'right', x: centerX + halfWpx + offsetFromEdgePx },
  ];

  for (const edge of verticalEdges) {
    const seams = seamLines[edge.key].slice().sort((a, b) => b - a);
    for (let i = 0; i < seams.length - 1; i++) {
      const start = seams[i];
      const end = seams[i + 1];
      const startPx = centerY - Math.max(start, end) * ppi + seamOverlapPx;
      const lengthPx = Math.max(0, Math.abs(end - start) * ppi - seamOverlapPx * 2);
      if (lengthPx <= 1) continue;
      drawTiledVertical(ctx, tileVertical, edge.x, startPx, lengthPx);
    }
  }
}


/**
 * Draw pocket hole overlays, scaled independently by pocket.radius.
 * These are drawn on top of the rail corners to create the hole cutouts.
 */
function drawPocketFeatures(
  ctx: CanvasRenderingContext2D,
  pockets: PhysicsJsonPocket[],
  params: {
    pocketCornerHoleImage: HTMLImageElement;
    pocketSideHoleImage: HTMLImageElement;
    pocketCornerRimImage: HTMLImageElement | null;
    pocketSideRimImage: HTMLImageElement | null;
    centerX: number;
    centerY: number;
    halfW: number;
    halfH: number;
    ppi: number;
    pocketHoleRefRadius: number;
    railScale: number;
  }
): void {
  const {
    pocketCornerHoleImage, pocketSideHoleImage,
    pocketCornerRimImage, pocketSideRimImage,
    centerX, centerY, halfW, halfH, ppi, pocketHoleRefRadius
  } = params;

  for (const pocket of pockets) {
    const x = pocket.center.x;
    const y = pocket.center.y;
    const isCorner = Math.abs(x) > halfW * 0.4 && Math.abs(y) > halfH * 0.4;
    const targetRadius = (pocket as any).visualRadius ?? pocket.radius;

    // Use Hole Image for sizing reference (Rim should match hole size specs)
    const refImage = isCorner ? pocketCornerHoleImage : pocketSideHoleImage;

    // Heuristic: Image Width represents 2.5x the physical hole diameter (to account for shadows/padding)
    const paddingFactor = 2.5;
    const holeScale = (2 * targetRadius * ppi * paddingFactor) / refImage.width;

    const px = centerX + x * ppi;
    const py = centerY - y * ppi;
    const rotation = isCorner ? getCornerRotationDeg(x, y) : getSideRotationDeg(x, y);

    // 1. Draw Hole Shadow (Void) - Bottom Layer
    if (isCorner) {
      drawRotatedImage(ctx, pocketCornerHoleImage, px, py, rotation, holeScale);
    } else {
      drawRotatedImage(ctx, pocketSideHoleImage, px, py, rotation, holeScale);
    }

    // 2. Draw Rim (Liner) - Top Layer
    // We use the SAME scale/rotation logic assuming assets match.
    // Check if rim exists
    const rimImage = isCorner ? pocketCornerRimImage : pocketSideRimImage;
    if (rimImage) {
      drawRotatedImage(ctx, rimImage, px, py, rotation, holeScale);
    }
  }
}

function getCornerRotationDeg(x: number, y: number): number {
  if (x <= 0 && y >= 0) return 0;
  if (x >= 0 && y >= 0) return 90;
  if (x >= 0 && y <= 0) return 180;
  return 270;
}

function getSideRotationDeg(x: number, y: number): number {
  if (Math.abs(y) >= Math.abs(x)) {
    return y >= 0 ? 0 : 180;
  }
  return x >= 0 ? 270 : 90;
}

function drawRotatedImage(
  ctx: CanvasRenderingContext2D,
  image: HTMLImageElement,
  cx: number,
  cy: number,
  deg: number,
  scale: number
): void {
  const rad = (deg * Math.PI) / 180;
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(rad);
  ctx.scale(scale, scale);
  ctx.drawImage(image, -image.width / 2, -image.height / 2);
  ctx.restore();
}

function drawAnchoredRotatedImage(
  ctx: CanvasRenderingContext2D,
  image: HTMLImageElement,
  anchorX: number,
  anchorY: number,
  cx: number,
  cy: number,
  deg: number,
  scale: number
): void {
  const rad = (deg * Math.PI) / 180;
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(rad);
  ctx.scale(scale, scale);
  ctx.drawImage(image, -anchorX, -anchorY);
  ctx.restore();
}

function drawTiledHorizontal(ctx: CanvasRenderingContext2D, tile: RailTile, x: number, y: number, lengthPx: number): void {
  let offset = 0;
  while (offset < lengthPx) {
    const remaining = lengthPx - offset;
    const drawWidth = Math.min(tile.width, remaining);
    const sourceWidth = Math.round((drawWidth / tile.width) * tile.canvas.width);
    ctx.drawImage(tile.canvas, 0, 0, sourceWidth, tile.canvas.height, x + offset, y, drawWidth, tile.height);
    offset += drawWidth;
  }
}

function drawTiledVertical(ctx: CanvasRenderingContext2D, tile: RailTile, x: number, y: number, lengthPx: number): void {
  let offset = 0;
  while (offset < lengthPx) {
    const remaining = lengthPx - offset;
    const drawHeight = Math.min(tile.height, remaining);
    const sourceHeight = Math.round((drawHeight / tile.height) * tile.canvas.height);
    ctx.drawImage(tile.canvas, 0, 0, tile.canvas.width, sourceHeight, x, y + offset, tile.width, drawHeight);
    offset += drawHeight;
  }
}

function createScaledTile(img: HTMLImageElement, heightPx: number): RailTile {
  const scale = heightPx / img.height;
  const width = Math.round(img.width * scale);
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = heightPx;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    ctx.drawImage(img, 0, 0, width, heightPx);
  }
  return { canvas, width, height: heightPx };
}

function rotateTile90(tile: RailTile): RailTile {
  const canvas = document.createElement('canvas');
  canvas.width = tile.height;
  canvas.height = tile.width;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    ctx.translate(canvas.width / 2, canvas.height / 2);
    ctx.rotate(-Math.PI / 2); // Clockwise 90°
    ctx.drawImage(tile.canvas, -tile.width / 2, -tile.height / 2);
  }
  return { canvas, width: canvas.width, height: canvas.height };
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Failed to load image'));
    img.src = src;
  });
}
