import type { PhysicsJson, PhysicsJsonPocket, PhysicsJsonRail } from './JsonLoader';

export type RadiusScaleRule = 'min' | 'avg' | 'constant';

export function isDerivedPlayAreaRailId(id: string | undefined | null): boolean {
  return typeof id === 'string' && id.startsWith('play_area_');
}

export function ensureDerivedPlayAreaRails(input: PhysicsJson): PhysicsJson {
  const next = structuredClone(input);
  const halfW = next.playArea.width / 2;
  const halfH = next.playArea.height / 2;

  const derived: PhysicsJsonRail[] = [
    {
      id: 'play_area_north',
      from: { x: -halfW, y: halfH },
      to: { x: halfW, y: halfH },
      normal: { x: 0, y: -1 },
    },
    {
      id: 'play_area_east',
      from: { x: halfW, y: halfH },
      to: { x: halfW, y: -halfH },
      normal: { x: -1, y: 0 },
    },
    {
      id: 'play_area_south',
      from: { x: halfW, y: -halfH },
      to: { x: -halfW, y: -halfH },
      normal: { x: 0, y: 1 },
    },
    {
      id: 'play_area_west',
      from: { x: -halfW, y: -halfH },
      to: { x: -halfW, y: halfH },
      normal: { x: 1, y: 0 },
    },
  ];

  next.rails = [...next.rails.filter((r) => !isDerivedPlayAreaRailId(r.id)), ...derived];
  return next;
}

export function getSemanticGeometryWarnings(json: PhysicsJson): string[] {
  const warnings: string[] = [];
  const maxWarnings = 20;

  const halfW = json.playArea.width / 2;
  const halfH = json.playArea.height / 2;
  // Cushions/frames can extend beyond the play area; allow a generous margin.
  const marginX = Math.max(halfW * 0.6, 25);
  const marginY = Math.max(halfH * 0.6, 25);
  const maxX = halfW + marginX;
  const maxY = halfH + marginY;

  const push = (msg: string) => {
    if (warnings.length < maxWarnings) warnings.push(msg);
  };

  const isFiniteNumber = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);
  const isFinitePoint = (p: any): p is { x: number; y: number } => !!p && isFiniteNumber(p.x) && isFiniteNumber(p.y);

  for (const p of json.pockets) {
    if (!isFinitePoint(p.center)) continue;
    if (Math.abs(p.center.x) > maxX || Math.abs(p.center.y) > maxY) {
      push(`Pocket ${p.id} center is far outside expected bounds.`);
    }
    if (Array.isArray(p.outline)) {
      const bad = p.outline.find((pt) => isFinitePoint(pt) && (Math.abs(pt.x) > maxX || Math.abs(pt.y) > maxY));
      if (bad) push(`Pocket ${p.id} has outline points far outside expected bounds.`);
    }
  }

  const editableRails = json.rails.filter((r) => !isDerivedPlayAreaRailId(r.id));
  if (editableRails.length < 6) push(`Only ${editableRails.length} non-play-area rails found (expected segmented cushion rails).`);

  for (const r of editableRails) {
    if (!isFinitePoint(r.from) || !isFinitePoint(r.to)) continue;
    const dx = r.to.x - r.from.x;
    const dy = r.to.y - r.from.y;
    if (Math.hypot(dx, dy) < 0.25) push(`Rail ${r.id} is extremely short.`);

    const pts = Array.isArray(r.outline) ? r.outline : [];
    if (pts.length > 0 && pts.length < 2) push(`Rail ${r.id} outline is too short.`);
    const bad = pts.find((pt) => isFinitePoint(pt) && (Math.abs(pt.x) > maxX || Math.abs(pt.y) > maxY));
    if (bad) push(`Rail ${r.id} has outline points far outside expected bounds.`);
  }

  if (warnings.length === maxWarnings) warnings.push('…more issues not shown');
  return warnings;
}

export type GeometrySelection =
  | { kind: 'pocket'; pocketIndex: number }
  | { kind: 'pocket-outline'; pocketIndex: number; pointIndex: number }
  | { kind: 'pocket-radius'; pocketIndex: number }
  | { kind: 'rail'; railIndex: number }
  | { kind: 'rail-end'; railIndex: number; endpoint: 'from' | 'to' }
  | { kind: 'rail-outline'; railIndex: number; pointIndex: number };

export type GeometryEdit =
  | { type: 'move-pocket-center'; pocketIndex: number; x: number; y: number }
  | { type: 'move-pocket-outline'; pocketIndex: number; pointIndex: number; x: number; y: number }
  | { type: 'set-pocket-radius'; pocketIndex: number; radius: number; scaleOutline: boolean }
  | { type: 'move-rail'; railIndex: number; dx: number; dy: number }
  | { type: 'move-rail-end'; railIndex: number; endpoint: 'from' | 'to'; x: number; y: number }
  | { type: 'move-rail-outline'; railIndex: number; pointIndex: number; x: number; y: number };

function isFiniteNumber(v: unknown): v is number {
  return typeof v === 'number' && Number.isFinite(v);
}

function sanitizePoint(pt: any, fallback: { x: number; y: number }): { x: number; y: number } {
  const x = isFiniteNumber(pt?.x) ? pt.x : fallback.x;
  const y = isFiniteNumber(pt?.y) ? pt.y : fallback.y;
  return { x, y };
}

function sanitizeOutline(outline: any): { x: number; y: number }[] | undefined {
  if (!Array.isArray(outline)) return undefined;
  const pts = outline
    .map((p) => (p && typeof p === 'object' ? { x: (p as any).x, y: (p as any).y } : null))
    .filter((p): p is { x: number; y: number } => !!p && isFiniteNumber(p.x) && isFiniteNumber(p.y));
  if (pts.length < 2) return undefined;
  return pts;
}

export function sanitizePhysicsJson(input: any): { json: PhysicsJson; repairs: number } {
  let repairs = 0;

  const metaIn = input?.meta && typeof input.meta === 'object' ? input.meta : undefined;
  const playAreaIn = input?.playArea && typeof input.playArea === 'object' ? input.playArea : {};

  const playWidth = isFiniteNumber(playAreaIn.width) && playAreaIn.width > 0 ? playAreaIn.width : 100;
  const playHeight = isFiniteNumber(playAreaIn.height) && playAreaIn.height > 0 ? playAreaIn.height : 50;
  if (playWidth !== playAreaIn.width) repairs++;
  if (playHeight !== playAreaIn.height) repairs++;

  const pocketsIn = Array.isArray(input?.pockets) ? input.pockets : [];
  const railsIn = Array.isArray(input?.rails) ? input.rails : [];

  const pockets: PhysicsJsonPocket[] = pocketsIn.map((p: any, idx: number) => {
    const center = sanitizePoint(p?.center, { x: 0, y: 0 });
    const radius = isFiniteNumber(p?.radius) && p.radius > 0.05 ? p.radius : 2.5;
    if (!isFiniteNumber(p?.center?.x) || !isFiniteNumber(p?.center?.y)) repairs++;
    if (!(isFiniteNumber(p?.radius) && p.radius > 0.05)) repairs++;
    let outline = sanitizeOutline(p?.outline);
    if (p?.outline && !outline) repairs++;
    if (!outline) {
      // Keep pockets editable: regenerate a circular outline around center/radius.
      const steps = 20;
      outline = [];
      for (let i = 0; i < steps; i++) {
        const t = (i / steps) * Math.PI * 2;
        outline.push({ x: center.x + Math.cos(t) * radius, y: center.y + Math.sin(t) * radius });
      }
      outline.push({ ...outline[0] });
      repairs++;
    }

    return {
      id: typeof p?.id === 'string' ? p.id : `pocket_${idx}`,
      center,
      radius,
      outline,
    };
  });

  const rails: PhysicsJsonRail[] = railsIn.map((r: any, idx: number) => {
    const from = sanitizePoint(r?.from, { x: 0, y: 0 });
    const to = sanitizePoint(r?.to, { x: 0, y: 0 });
    const normal = sanitizePoint(r?.normal, { x: 0, y: 1 });
    if (!isFiniteNumber(r?.from?.x) || !isFiniteNumber(r?.from?.y)) repairs++;
    if (!isFiniteNumber(r?.to?.x) || !isFiniteNumber(r?.to?.y)) repairs++;
    if (!isFiniteNumber(r?.normal?.x) || !isFiniteNumber(r?.normal?.y)) repairs++;
    let outline = sanitizeOutline(r?.outline);
    if (r?.outline && !outline) repairs++;
    if (!outline && r?.outline !== undefined) {
      // Keep rails editable: if outline is present but invalid, keep a 2-point fallback.
      outline = [{ ...from }, { ...to }];
      repairs++;
    }

    return {
      id: typeof r?.id === 'string' ? r.id : `rail_${idx}`,
      from,
      to,
      normal,
      outline,
    };
  });

  const meta: PhysicsJson['meta'] | undefined = metaIn
    ? {
        pixelsPerInch: isFiniteNumber(metaIn.pixelsPerInch) ? metaIn.pixelsPerInch : undefined,
        source: typeof metaIn.source === 'string' ? metaIn.source : undefined,
        lastModified: isFiniteNumber(metaIn.lastModified) ? metaIn.lastModified : Date.now(),
        offset:
          metaIn.offset && typeof metaIn.offset === 'object'
            ? sanitizePoint(metaIn.offset, { x: 0, y: 0 })
            : undefined,
        pixelRects: metaIn.pixelRects,
      }
    : undefined;

  const json: PhysicsJson = {
    meta,
    playArea: { width: playWidth, height: playHeight },
    pockets,
    rails,
  };

  return { json, repairs };
}

function roundKey(x: number, decimals = 2): string {
  const f = Math.pow(10, decimals);
  return String(Math.round(x * f) / f);
}

function mirrorAxesForTarget(source: { x: number; y: number }, target: { x: number; y: number }): { x: boolean; y: boolean } {
  return {
    x: Math.sign(source.y) !== Math.sign(target.y),
    y: Math.sign(source.x) !== Math.sign(target.x),
  };
}

export function resymmetrizePhysicsJson(input: PhysicsJson): PhysicsJson {
  const next = structuredClone(input);
  const halfW = next.playArea.width / 2;

  const isCornerPocket = (p: PhysicsJsonPocket) => Math.abs(p.center.x) > halfW * 0.25;
  const corners = next.pockets.map((p, i) => ({ p, i })).filter(({ p }) => isCornerPocket(p));
  const sides = next.pockets.map((p, i) => ({ p, i })).filter(({ p }) => !isCornerPocket(p));

  const nearestPocketIndex = (target: { x: number; y: number }, candidates: { p: PhysicsJsonPocket; i: number }[]) => {
    let best: { i: number; d: number } | null = null;
    for (const c of candidates) {
      const dx = c.p.center.x - target.x;
      const dy = c.p.center.y - target.y;
      const d = dx * dx + dy * dy;
      if (!best || d < best.d) best = { i: c.i, d };
    }
    return best?.i ?? null;
  };

  // Corner pockets: pick NE as canonical, mirror to other 3.
  if (corners.length >= 4) {
    const canonical = corners
      .map(({ p, i }) => ({ p, i, score: p.center.x + p.center.y }))
      .sort((a, b) => b.score - a.score)[0];
    const c = canonical.p;
    const absX = Math.abs(c.center.x);
    const absY = Math.abs(c.center.y);
    const targets = [
      { x: absX, y: absY },
      { x: -absX, y: absY },
      { x: absX, y: -absY },
      { x: -absX, y: -absY },
    ];

    for (const t of targets) {
      const idx = nearestPocketIndex(t, corners);
      if (idx === null) continue;
      const axes = mirrorAxesForTarget(c.center, t);
      const center = mirrorPoint({ x: absX, y: absY }, axes);
      next.pockets[idx].center = center;
      next.pockets[idx].radius = c.radius;
      if (c.outline) next.pockets[idx].outline = c.outline.map((pt) => mirrorPoint(pt, axes));
    }
  }

  // Side pockets: pick North as canonical, mirror across X axis to South.
  if (sides.length >= 2) {
    const canonical = sides
      .map(({ p, i }) => ({ p, i, score: p.center.y }))
      .sort((a, b) => b.score - a.score)[0];
    const north = canonical.p;
    const northCenter = { x: north.center.x, y: Math.abs(north.center.y) };
    const southCenter = { x: northCenter.x, y: -northCenter.y };
    const northIdx = nearestPocketIndex(northCenter, sides);
    const southIdx = nearestPocketIndex(southCenter, sides);
    if (northIdx !== null) {
      next.pockets[northIdx].center = northCenter;
      next.pockets[northIdx].radius = north.radius;
      if (north.outline) next.pockets[northIdx].outline = north.outline.map((pt) => ({ x: pt.x, y: Math.abs(pt.y) }));
    }
    if (southIdx !== null) {
      next.pockets[southIdx].center = southCenter;
      next.pockets[southIdx].radius = north.radius;
      if (north.outline) next.pockets[southIdx].outline = north.outline.map((pt) => ({ x: pt.x, y: -Math.abs(pt.y) }));
    }
  }

  // Rails: group by abs(midpoint) and mirror within each group.
  const railMid = (r: PhysicsJsonRail) => ({ x: (r.from.x + r.to.x) / 2, y: (r.from.y + r.to.y) / 2 });
  const groups = new Map<string, number[]>();
  next.rails.forEach((r, idx) => {
    if (isDerivedPlayAreaRailId(r.id)) return;
    const m = railMid(r);
    const key = `${roundKey(Math.abs(m.x))},${roundKey(Math.abs(m.y))}`;
    const arr = groups.get(key) ?? [];
    arr.push(idx);
    groups.set(key, arr);
  });

  for (const indices of groups.values()) {
    if (indices.length < 2) continue;
    const repIndex =
      indices
        .map((idx) => ({ idx, mid: railMid(next.rails[idx]) }))
        .sort((a, b) => (b.mid.x + b.mid.y) - (a.mid.x + a.mid.y))[0]?.idx ?? indices[0];

    const rep = next.rails[repIndex];
    const repMid = railMid(rep);

    for (const idx of indices) {
      if (idx === repIndex) continue;
      const r = next.rails[idx];
      const targetMid = railMid(r);
      const axes = mirrorAxesForTarget(repMid, targetMid);

      r.from = mirrorPoint(rep.from, axes);
      r.to = mirrorPoint(rep.to, axes);
      r.normal = mirrorPoint(rep.normal, axes);
      if (rep.outline) r.outline = rep.outline.map((pt) => mirrorPoint(pt, axes));
    }
  }

  next.meta = next.meta ?? {};
  next.meta.lastModified = Date.now();
  return ensureDerivedPlayAreaRails(next);
}

export function createBlankPhysicsJsonFromPixels(options: {
  innerPx: { width: number; height: number };
  outerPx: { width: number; height: number };
  fullPx: { width: number; height: number };
  playWidthIn?: number;
  pixelsPerInch?: number;
}): PhysicsJson {
  const playWidthIn = options.playWidthIn ?? 100;
  const pixelsPerInch = options.pixelsPerInch ?? options.innerPx.width / playWidthIn;
  const playHeightIn = options.innerPx.height / pixelsPerInch;

  const halfW = playWidthIn / 2;
  const halfH = playHeightIn / 2;

  const makeCircleOutline = (center: { x: number; y: number }, radius: number, steps = 24) => {
    const pts: { x: number; y: number }[] = [];
    for (let i = 0; i < steps; i++) {
      const t = (i / steps) * Math.PI * 2;
      pts.push({ x: center.x + Math.cos(t) * radius, y: center.y + Math.sin(t) * radius });
    }
    pts.push({ ...pts[0] });
    return pts;
  };

  const pocketRadius = 2.9296875;
  const pockets: PhysicsJsonPocket[] = [
    { id: 'pocket_NW', center: { x: -halfW, y: halfH }, radius: pocketRadius },
    { id: 'pocket_NE', center: { x: halfW, y: halfH }, radius: pocketRadius },
    { id: 'pocket_SE', center: { x: halfW, y: -halfH }, radius: pocketRadius },
    { id: 'pocket_SW', center: { x: -halfW, y: -halfH }, radius: pocketRadius },
    { id: 'pocket_N', center: { x: 0, y: halfH }, radius: pocketRadius },
    { id: 'pocket_S', center: { x: 0, y: -halfH }, radius: pocketRadius },
  ].map((p) => ({ ...p, outline: makeCircleOutline(p.center, p.radius, 20) }));

  const cushionThicknessIn = (options.outerPx.width - options.innerPx.width) / 2 / pixelsPerInch;
  const railInset = cushionThicknessIn;
  const rails: PhysicsJsonRail[] = [
    {
      id: 'rail_W',
      from: { x: -halfW - railInset, y: halfH + railInset },
      to: { x: -halfW - railInset, y: -halfH - railInset },
      normal: { x: 1, y: 0 },
      outline: [
        { x: -halfW, y: halfH },
        { x: -halfW - railInset, y: halfH + railInset },
        { x: -halfW - railInset, y: -halfH - railInset },
        { x: -halfW, y: -halfH },
        { x: -halfW, y: halfH },
      ],
    },
    {
      id: 'rail_E',
      from: { x: halfW + railInset, y: -halfH - railInset },
      to: { x: halfW + railInset, y: halfH + railInset },
      normal: { x: -1, y: 0 },
      outline: [
        { x: halfW, y: -halfH },
        { x: halfW + railInset, y: -halfH - railInset },
        { x: halfW + railInset, y: halfH + railInset },
        { x: halfW, y: halfH },
        { x: halfW, y: -halfH },
      ],
    },
    {
      id: 'rail_N',
      from: { x: -halfW - railInset, y: halfH + railInset },
      to: { x: halfW + railInset, y: halfH + railInset },
      normal: { x: 0, y: -1 },
      outline: [
        { x: -halfW, y: halfH },
        { x: -halfW - railInset, y: halfH + railInset },
        { x: halfW + railInset, y: halfH + railInset },
        { x: halfW, y: halfH },
        { x: -halfW, y: halfH },
      ],
    },
    {
      id: 'rail_S',
      from: { x: halfW + railInset, y: -halfH - railInset },
      to: { x: -halfW - railInset, y: -halfH - railInset },
      normal: { x: 0, y: 1 },
      outline: [
        { x: halfW, y: -halfH },
        { x: halfW + railInset, y: -halfH - railInset },
        { x: -halfW - railInset, y: -halfH - railInset },
        { x: -halfW, y: -halfH },
        { x: halfW, y: -halfH },
      ],
    },
  ];

  return {
    meta: {
      source: 'table-editor:blank-generator',
      pixelsPerInch,
      pixelRects: {
        inner: options.innerPx,
        outer: options.outerPx,
        full: options.fullPx,
      },
      lastModified: Date.now(),
    } as any,
    playArea: {
      width: playWidthIn,
      height: playHeightIn,
    },
    pockets,
    rails,
  };
}

export function scalePhysicsJson(options: {
  json: PhysicsJson;
  newPlayWidth: number;
  newPlayHeight: number;
  radiusRule: RadiusScaleRule;
}): PhysicsJson {
  const next = structuredClone(options.json);
  const oldW = next.playArea.width;
  const oldH = next.playArea.height;
  const scaleX = options.newPlayWidth / oldW;
  const scaleY = options.newPlayHeight / oldH;

  const scaleRadius = (r: number) => {
    if (options.radiusRule === 'constant') return r;
    if (options.radiusRule === 'avg') return r * (scaleX + scaleY) / 2;
    return r * Math.min(scaleX, scaleY);
  };

  next.playArea.width = options.newPlayWidth;
  next.playArea.height = options.newPlayHeight;

  next.pockets.forEach((p) => {
    p.center.x *= scaleX;
    p.center.y *= scaleY;
    p.radius = scaleRadius(p.radius);
    if (p.outline) {
      p.outline = p.outline.map((pt) => ({ x: pt.x * scaleX, y: pt.y * scaleY }));
    }
  });

  next.rails.forEach((r) => {
    r.from.x *= scaleX;
    r.from.y *= scaleY;
    r.to.x *= scaleX;
    r.to.y *= scaleY;
    r.normal.x *= scaleX;
    r.normal.y *= scaleY;
    if (r.outline) {
      r.outline = r.outline.map((pt) => ({ x: pt.x * scaleX, y: pt.y * scaleY }));
    }
  });

  if (next.meta) {
    (next.meta as any).lastModified = Date.now();
  }

  return ensureDerivedPlayAreaRails(next);
}

function mirrorPoint(pt: { x: number; y: number }, axes: { x: boolean; y: boolean }) {
  return {
    x: axes.y ? -pt.x : pt.x,
    y: axes.x ? -pt.y : pt.y,
  };
}

function distanceSq(a: { x: number; y: number }, b: { x: number; y: number }) {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  return dx * dx + dy * dy;
}

function findNearestPocketIndex(json: PhysicsJson, target: { x: number; y: number }, exclude?: number): number | null {
  let best: { idx: number; d: number } | null = null;
  for (let i = 0; i < json.pockets.length; i++) {
    if (exclude === i) continue;
    const d = distanceSq(json.pockets[i].center, target);
    if (!best || d < best.d) best = { idx: i, d };
  }
  if (!best) return null;
  return best.d <= 4 ? best.idx : null; // ~2 inches tolerance
}

function railMidpoint(rail: PhysicsJsonRail) {
  return { x: (rail.from.x + rail.to.x) / 2, y: (rail.from.y + rail.to.y) / 2 };
}

function findNearestRailIndex(json: PhysicsJson, targetMid: { x: number; y: number }, exclude?: number): number | null {
  let best: { idx: number; d: number } | null = null;
  for (let i = 0; i < json.rails.length; i++) {
    if (exclude === i) continue;
    if (isDerivedPlayAreaRailId(json.rails[i]?.id)) continue;
    const d = distanceSq(railMidpoint(json.rails[i]), targetMid);
    if (!best || d < best.d) best = { idx: i, d };
  }
  if (!best) return null;
  return best.d <= 25 ? best.idx : null; // ~5 inches tolerance
}

function pickPointIndexForMirroredOutline(options: {
  outline: { x: number; y: number }[];
  originalPointIndex: number;
  target: { x: number; y: number };
}) {
  const forward = options.originalPointIndex;
  const reversed = options.outline.length - 1 - options.originalPointIndex;
  const dF = options.outline[forward] ? distanceSq(options.outline[forward], options.target) : Number.POSITIVE_INFINITY;
  const dR = options.outline[reversed] ? distanceSq(options.outline[reversed], options.target) : Number.POSITIVE_INFINITY;
  return dR < dF ? reversed : forward;
}

export function applyGeometryEdit(options: {
  json: PhysicsJson;
  edit: GeometryEdit;
  mirrorEnabled: boolean;
}): PhysicsJson {
  const next = structuredClone(options.json);

  const applySingle = (edit: GeometryEdit) => {
    if (edit.type === 'move-pocket-center') {
      const pocket = next.pockets[edit.pocketIndex];
      if (!pocket) return;
      const dx = edit.x - pocket.center.x;
      const dy = edit.y - pocket.center.y;
      pocket.center.x = edit.x;
      pocket.center.y = edit.y;
      if (pocket.outline) pocket.outline = pocket.outline.map((pt) => ({ x: pt.x + dx, y: pt.y + dy }));
    }

    if (edit.type === 'move-pocket-outline') {
      const pocket = next.pockets[edit.pocketIndex];
      if (!pocket?.outline?.[edit.pointIndex]) return;
      pocket.outline[edit.pointIndex] = { x: edit.x, y: edit.y };
    }

    if (edit.type === 'set-pocket-radius') {
      const pocket = next.pockets[edit.pocketIndex];
      if (!pocket) return;
      const oldRadius = pocket.radius;
      pocket.radius = edit.radius;
      if (edit.scaleOutline && pocket.outline && oldRadius > 1e-6) {
        const scale = edit.radius / oldRadius;
        pocket.outline = pocket.outline.map((pt) => ({
          x: pocket.center.x + (pt.x - pocket.center.x) * scale,
          y: pocket.center.y + (pt.y - pocket.center.y) * scale,
        }));
      }
    }

    if (edit.type === 'move-rail') {
      const rail = next.rails[edit.railIndex];
      if (!rail) return;
      if (isDerivedPlayAreaRailId(rail.id)) return;
      rail.from = { x: rail.from.x + edit.dx, y: rail.from.y + edit.dy };
      rail.to = { x: rail.to.x + edit.dx, y: rail.to.y + edit.dy };
      if (rail.outline) {
        rail.outline = rail.outline.map((pt) => ({ x: pt.x + edit.dx, y: pt.y + edit.dy }));
      }
    }

    if (edit.type === 'move-rail-end') {
      const rail = next.rails[edit.railIndex];
      if (!rail) return;
      if (isDerivedPlayAreaRailId(rail.id)) return;
      rail[edit.endpoint] = { x: edit.x, y: edit.y };
    }

    if (edit.type === 'move-rail-outline') {
      const rail = next.rails[edit.railIndex];
      if (!rail?.outline?.[edit.pointIndex]) return;
      if (isDerivedPlayAreaRailId(rail.id)) return;
      rail.outline[edit.pointIndex] = { x: edit.x, y: edit.y };
    }
  };

  applySingle(options.edit);

  if (options.mirrorEnabled) {
    const axesList = [
      { x: true, y: false },
      { x: false, y: true },
      { x: true, y: true },
    ];

    for (const axes of axesList) {
      if (options.edit.type === 'move-pocket-center') {
        const sourcePocket = next.pockets[options.edit.pocketIndex];
        if (!sourcePocket) continue;
        const mirroredCenter = mirrorPoint(sourcePocket.center, axes);
        const otherIndex = findNearestPocketIndex(next, mirroredCenter, options.edit.pocketIndex);
        if (otherIndex === null) continue;

        const otherPocket = next.pockets[otherIndex];
        const dx = mirroredCenter.x - otherPocket.center.x;
        const dy = mirroredCenter.y - otherPocket.center.y;
        otherPocket.center = mirroredCenter;
        if (otherPocket.outline) otherPocket.outline = otherPocket.outline.map((pt) => ({ x: pt.x + dx, y: pt.y + dy }));
      }

      if (options.edit.type === 'move-pocket-outline') {
        const sourcePocket = next.pockets[options.edit.pocketIndex];
        if (!sourcePocket?.outline?.[options.edit.pointIndex]) continue;
        const mirroredPoint = mirrorPoint(sourcePocket.outline[options.edit.pointIndex], axes);

        const mirroredPocketCenter = mirrorPoint(sourcePocket.center, axes);
        const otherIndex = findNearestPocketIndex(next, mirroredPocketCenter, options.edit.pocketIndex);
        if (otherIndex === null) continue;

        const otherPocket = next.pockets[otherIndex];
        if (!otherPocket.outline) continue;
        const targetIndex = pickPointIndexForMirroredOutline({
          outline: otherPocket.outline,
          originalPointIndex: options.edit.pointIndex,
          target: mirroredPoint,
        });
        if (!otherPocket.outline[targetIndex]) continue;
        otherPocket.outline[targetIndex] = mirroredPoint;
      }

      if (options.edit.type === 'set-pocket-radius') {
        const sourcePocket = next.pockets[options.edit.pocketIndex];
        if (!sourcePocket) continue;
        const mirroredCenter = mirrorPoint(sourcePocket.center, axes);
        const otherIndex = findNearestPocketIndex(next, mirroredCenter, options.edit.pocketIndex);
        if (otherIndex === null) continue;
        const otherPocket = next.pockets[otherIndex];
        const oldRadius = otherPocket.radius;
        otherPocket.radius = sourcePocket.radius;
        if (options.edit.scaleOutline && otherPocket.outline && oldRadius > 1e-6) {
          const scale = otherPocket.radius / oldRadius;
          otherPocket.outline = otherPocket.outline.map((pt) => ({
            x: otherPocket.center.x + (pt.x - otherPocket.center.x) * scale,
            y: otherPocket.center.y + (pt.y - otherPocket.center.y) * scale,
          }));
        }
      }

      if (options.edit.type === 'move-rail-end') {
        const sourceRail = next.rails[options.edit.railIndex];
        if (!sourceRail) continue;
        if (isDerivedPlayAreaRailId(sourceRail.id)) continue;
        const mid = railMidpoint(sourceRail);
        const otherIndex = findNearestRailIndex(next, mirrorPoint(mid, axes), options.edit.railIndex);
        if (otherIndex === null) continue;
        const otherRail = next.rails[otherIndex];

        const sourceEndpoint = sourceRail[options.edit.endpoint];
        const targetEndpoint = mirrorPoint(sourceEndpoint, axes);

        const currentFrom = mirrorPoint(sourceRail.from, axes);
        const currentTo = mirrorPoint(sourceRail.to, axes);
        const dSame = distanceSq(otherRail.from, currentFrom) + distanceSq(otherRail.to, currentTo);
        const dSwap = distanceSq(otherRail.from, currentTo) + distanceSq(otherRail.to, currentFrom);

        const endpointOnOther = dSwap < dSame ? (options.edit.endpoint === 'from' ? 'to' : 'from') : options.edit.endpoint;
        (otherRail as any)[endpointOnOther] = targetEndpoint;

        otherRail.normal = mirrorPoint(sourceRail.normal, axes);
      }

      if (options.edit.type === 'move-rail') {
        const sourceRail = next.rails[options.edit.railIndex];
        if (!sourceRail) continue;
        if (isDerivedPlayAreaRailId(sourceRail.id)) continue;
        const mid = railMidpoint(sourceRail);
        const otherIndex = findNearestRailIndex(next, mirrorPoint(mid, axes), options.edit.railIndex);
        if (otherIndex === null) continue;

        const dx = axes.y ? -options.edit.dx : options.edit.dx;
        const dy = axes.x ? -options.edit.dy : options.edit.dy;

        const otherRail = next.rails[otherIndex];
        otherRail.from = { x: otherRail.from.x + dx, y: otherRail.from.y + dy };
        otherRail.to = { x: otherRail.to.x + dx, y: otherRail.to.y + dy };
        if (otherRail.outline) {
          otherRail.outline = otherRail.outline.map((pt) => ({ x: pt.x + dx, y: pt.y + dy }));
        }
      }

      if (options.edit.type === 'move-rail-outline') {
        const sourceRail = next.rails[options.edit.railIndex];
        if (!sourceRail?.outline?.[options.edit.pointIndex]) continue;
        if (isDerivedPlayAreaRailId(sourceRail.id)) continue;
        const sourcePoint = sourceRail.outline[options.edit.pointIndex];
        const mid = railMidpoint(sourceRail);
        const otherIndex = findNearestRailIndex(next, mirrorPoint(mid, axes), options.edit.railIndex);
        if (otherIndex === null) continue;
        const otherRail = next.rails[otherIndex];
        if (!otherRail.outline) continue;

        const targetPoint = mirrorPoint(sourcePoint, axes);
        const targetIndex = pickPointIndexForMirroredOutline({
          outline: otherRail.outline,
          originalPointIndex: options.edit.pointIndex,
          target: targetPoint,
        });
        if (!otherRail.outline[targetIndex]) continue;
        otherRail.outline[targetIndex] = targetPoint;
      }
    }
  }

  if (next.meta) (next.meta as any).lastModified = Date.now();
  return ensureDerivedPlayAreaRails(next);
}
