import type { PhysicsJson, PhysicsJsonPocket } from './JsonLoader';
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

  if (!assets.railMiddleTile || !assets.cornerPocket || !assets.sidePocket) {
    return null;
  }

  const ppi = railPocketSet.ppi ?? physicsJson.meta?.pixelsPerInch ?? 7.68;
  const seamOverlapPx = railPocketSet.seamOverlapPx ?? 2;
  const railThicknessPx = Math.max(1, railPocketSet.railThicknessPx);

  const halfW = physicsJson.playArea.width / 2;
  const halfH = physicsJson.playArea.height / 2;
  const halfWpx = halfW * ppi;
  const halfHpx = halfH * ppi;

  const railImage = await loadImage(assets.railMiddleTile);
  const cornerImage = await loadImage(assets.cornerPocket);
  const sideImage = await loadImage(assets.sidePocket);

  const railTile = createScaledTile(railImage, railThicknessPx);
  const railTileVertical = rotateTile90(railTile);
  const pocketScale = railThicknessPx / railImage.height;
  const seamAnchorPx = railImage.height;

  const cornerHalfPx = Math.max(cornerImage.width, cornerImage.height) * pocketScale * 0.5;
  const sideHalfPx = Math.max(sideImage.width, sideImage.height) * pocketScale * 0.5;
  const margin = Math.ceil(Math.max(railThicknessPx, cornerHalfPx, sideHalfPx));

  const width = Math.round(physicsJson.playArea.width * ppi + margin * 2);
  const height = Math.round(physicsJson.playArea.height * ppi + margin * 2);

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;

  const ctx = canvas.getContext('2d');
  if (!ctx) return null;
  ctx.imageSmoothingEnabled = true;

  const centerX = margin + halfWpx;
  const centerY = margin + halfHpx;

  const pocketIndex = classifyPockets(physicsJson.pockets, halfW, halfH);
  const cornerHalfInX = (cornerImage.width * pocketScale) / (2 * ppi);
  const cornerHalfInY = (cornerImage.height * pocketScale) / (2 * ppi);
  const sideHalfIn = (sideImage.width * pocketScale) / (2 * ppi);
  const seamLines = buildSeamLines(pocketIndex, halfW, halfH, {
    cornerHalfInX,
    cornerHalfInY,
    sideHalfIn,
  });

  drawRailSpans(ctx, seamLines, {
    railTile,
    railTileVertical,
    seamOverlapPx,
    centerX,
    centerY,
    halfWpx,
    halfHpx,
    ppi,
    railThicknessPx,
  });

  drawPockets(ctx, physicsJson.pockets, {
    cornerImage,
    sideImage,
    seamAnchorPx,
    centerX,
    centerY,
    halfW,
    halfH,
    ppi,
    pocketScale,
  });

  return {
    dataUrl: canvas.toDataURL('image/png'),
    width,
    height,
  };
}

function classifyPockets(pockets: PhysicsJsonPocket[], halfW: number, halfH: number): Record<EdgeKey, PhysicsJsonPocket[]> {
  const edges: Record<EdgeKey, PhysicsJsonPocket[]> = {
    top: [],
    bottom: [],
    left: [],
    right: [],
  };

  for (const pocket of pockets) {
    const x = pocket.center.x;
    const y = pocket.center.y;
    const isCorner = Math.abs(x) > halfW * 0.4 && Math.abs(y) > halfH * 0.4;
    const edgeH: EdgeKey = y >= 0 ? 'top' : 'bottom';
    const edgeV: EdgeKey = x >= 0 ? 'right' : 'left';

    if (isCorner) {
      edges[edgeH].push(pocket);
      edges[edgeV].push(pocket);
      continue;
    }

    if (Math.abs(y) >= Math.abs(x)) {
      edges[edgeH].push(pocket);
    } else {
      edges[edgeV].push(pocket);
    }
  }

  return edges;
}

function buildSeamLines(
  edgeMap: Record<EdgeKey, PhysicsJsonPocket[]>,
  halfW: number,
  halfH: number,
  offsets: { cornerHalfInX: number; cornerHalfInY: number; sideHalfIn: number }
): Record<EdgeKey, number[]> {
  const { cornerHalfInX, cornerHalfInY, sideHalfIn } = offsets;
  const top = edgeMap.top
    .filter((p) => Math.abs(p.center.x) < halfW * 0.3)
    .flatMap((p) => [p.center.x - sideHalfIn, p.center.x + sideHalfIn]);
  const bottom = edgeMap.bottom
    .filter((p) => Math.abs(p.center.x) < halfW * 0.3)
    .flatMap((p) => [p.center.x - sideHalfIn, p.center.x + sideHalfIn]);
  const left = edgeMap.left
    .filter((p) => Math.abs(p.center.y) < halfH * 0.3)
    .flatMap((p) => [p.center.y - sideHalfIn, p.center.y + sideHalfIn]);
  const right = edgeMap.right
    .filter((p) => Math.abs(p.center.y) < halfH * 0.3)
    .flatMap((p) => [p.center.y - sideHalfIn, p.center.y + sideHalfIn]);

  return {
    top: [-halfW + cornerHalfInX, ...top, halfW - cornerHalfInX],
    bottom: [-halfW + cornerHalfInX, ...bottom, halfW - cornerHalfInX],
    left: [halfH - cornerHalfInY, ...left, -halfH + cornerHalfInY],
    right: [halfH - cornerHalfInY, ...right, -halfH + cornerHalfInY],
  };
}

function drawRailSpans(
  ctx: CanvasRenderingContext2D,
  seamLines: Record<EdgeKey, number[]>,
  params: {
    railTile: RailTile;
    railTileVertical: RailTile;
    seamOverlapPx: number;
    centerX: number;
    centerY: number;
    halfWpx: number;
    halfHpx: number;
    ppi: number;
    railThicknessPx: number;
  }
): void {
  const {
    railTile,
    railTileVertical,
    seamOverlapPx,
    centerX,
    centerY,
    halfWpx,
    halfHpx,
    ppi,
    railThicknessPx,
  } = params;

  const horizontalEdges: Array<{ key: 'top' | 'bottom'; y: number }> = [
    { key: 'top', y: centerY - halfHpx - railThicknessPx },
    { key: 'bottom', y: centerY + halfHpx },
  ];

  for (const edge of horizontalEdges) {
    const seams = seamLines[edge.key].slice().sort((a, b) => a - b);
    for (let i = 0; i < seams.length - 1; i++) {
      const start = seams[i];
      const end = seams[i + 1];
      const startPx = centerX + Math.min(start, end) * ppi + seamOverlapPx;
      const lengthPx = Math.max(0, Math.abs(end - start) * ppi - seamOverlapPx * 2);
      if (lengthPx <= 1) continue;
      drawTiledHorizontal(ctx, railTile, startPx, edge.y, lengthPx);
    }
  }

  const verticalEdges: Array<{ key: 'left' | 'right'; x: number }> = [
    { key: 'left', x: centerX - halfWpx - railThicknessPx },
    { key: 'right', x: centerX + halfWpx },
  ];

  for (const edge of verticalEdges) {
    const seams = seamLines[edge.key].slice().sort((a, b) => b - a);
    for (let i = 0; i < seams.length - 1; i++) {
      const start = seams[i];
      const end = seams[i + 1];
      const startPx = centerY - Math.max(start, end) * ppi + seamOverlapPx;
      const lengthPx = Math.max(0, Math.abs(end - start) * ppi - seamOverlapPx * 2);
      if (lengthPx <= 1) continue;
      drawTiledVertical(ctx, railTileVertical, edge.x, startPx, lengthPx);
    }
  }
}

function drawPockets(
  ctx: CanvasRenderingContext2D,
  pockets: PhysicsJsonPocket[],
  params: {
    cornerImage: HTMLImageElement;
    sideImage: HTMLImageElement;
    seamAnchorPx: number;
    centerX: number;
    centerY: number;
    halfW: number;
    halfH: number;
    ppi: number;
    pocketScale: number;
  }
): void {
  const { cornerImage, sideImage, seamAnchorPx, centerX, centerY, halfW, halfH, ppi, pocketScale } = params;

  for (const pocket of pockets) {
    const x = pocket.center.x;
    const y = pocket.center.y;
    const isCorner = Math.abs(x) > halfW * 0.4 && Math.abs(y) > halfH * 0.4;
    const edgeX = x >= 0 ? halfW : -halfW;
    const edgeY = y >= 0 ? halfH : -halfH;
    const px = centerX + (isCorner || Math.abs(y) < Math.abs(x) ? edgeX : x) * ppi;
    const py = centerY - (isCorner || Math.abs(y) >= Math.abs(x) ? edgeY : y) * ppi;

    if (isCorner) {
      const rotation = getCornerRotationDeg(x, y);
      drawAnchoredRotatedImage(ctx, cornerImage, seamAnchorPx, seamAnchorPx, px, py, rotation, pocketScale);
      continue;
    }

    const rotation = getSideRotationDeg(x, y);
    drawAnchoredRotatedImage(ctx, sideImage, sideImage.width / 2, seamAnchorPx, px, py, rotation, pocketScale);
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
    ctx.rotate(Math.PI / 2);
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
