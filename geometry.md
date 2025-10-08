Totally get this — “left/right/up/down” gets messy fast unless you lock down a shared geometry language. Here’s a simple, bullet-proof way to make the agent understand cushions/rails/pockets every time:

# 1) Freeze the coordinate system (once and for all)

* **World units:** inches (realistic; easy to reason about).
* **Origin (0,0):** exact **center of the play area** (not the canvas).
* **Axes:** `+X` = **right**, `+Y` = **up** (i.e., toward the **head** cushion).
* **Table orientation names:**

  * `N` (North/top/head), `S` (South/bottom/foot), `W` (West/left), `E` (East/right).
* **Canvas mapping:** canvas Y is down by default; do a tiny adapter:

  * `canvas.x = scale*(world.x) + cx`
  * `canvas.y = -scale*(world.y) + cy`
    where `(cx, cy)` is the canvas center, `scale = pixels_per_inch`.

> This gives us clear “N/E/S/W” words and removes ambiguity between physics math (Y up) and Canvas drawing (Y down).

# 2) Name every major thing

* **Rails (4):** `N_rail`, `S_rail`, `W_rail`, `E_rail`
* **Pockets (6):** `NW_corner`, `NE_corner`, `SW_corner`, `SE_corner`, `W_middle`, `E_middle`
* **Rect of play area:** width `W_in`, height `H_in` (e.g., **100" x 50"** for a 9-ft table)

# 3) Use a tiny JSON schema for geometry

Hand this to the agent and **always refer to these names** instead of “left/right/up/down”.

```json
{
  "table": {
    "play_width_in": 100.0,
    "play_height_in": 50.0,
    "cushion_profile_in": 1.75,
    "pocket_capture_radius_in": 2.0
  },
  "rails": [
    { "id": "N_rail", "from": [-50.0, 25.0], "to": [50.0, 25.0], "normal": [0, -1] },
    { "id": "S_rail", "from": [-50.0,-25.0], "to": [50.0,-25.0], "normal": [0,  1] },
    { "id": "W_rail", "from": [-50.0,-25.0], "to": [-50.0,25.0], "normal": [1,  0] },
    { "id": "E_rail", "from": [ 50.0,-25.0], "to": [ 50.0,25.0], "normal": [-1, 0] }
  ],
  "pockets": [
    { "id": "NW_corner", "center": [-50.0, 25.0], "cut_normal_hint": [ 1,-1] },
    { "id": "NE_corner", "center": [ 50.0, 25.0], "cut_normal_hint": [-1,-1] },
    { "id": "SW_corner", "center": [-50.0,-25.0], "cut_normal_hint": [ 1, 1] },
    { "id": "SE_corner", "center": [ 50.0,-25.0], "cut_normal_hint": [-1, 1] },
    { "id": "W_middle", "center": [-50.0,  0.0], "cut_normal_hint": [ 1, 0] },
    { "id": "E_middle", "center": [ 50.0,  0.0], "cut_normal_hint": [-1, 0] }
  ]
}
```

* `from`/`to` are **world** coordinates (inches) along the inner **cushion line**.
* `normal` points **into the play area**.
* `cut_normal_hint` helps the agent angle corner-pocket lips correctly (inward 45° vibe).

# 4) Give the agent a “geometry contract” (drop-in prompt wedge)

Paste this under your main Windsurf prompt:

```text
### Geometry Contract (Authoritative)
- World coordinates are inches; origin (0,0) at play-area center; +X right, +Y up (toward N/head cushion).
- The table is a rectangle centered at origin: width=table.play_width_in, height=table.play_height_in.
- Rails are directed line segments on the **inner cushion line** with `normal` pointing inward.
- Pockets are named: NW_corner, NE_corner, SW_corner, SE_corner, W_middle, E_middle, with centers on the play-area corners/midpoints respectively.
- All rendering uses a mapping function world->canvas with Y inverted. Physics stays Y-up.
- Never say “left/right/top/bottom” in code comments for logic; always say N/E/S/W and reference IDs (N_rail, E_rail, etc.).
- Any new geometry must be expressed in this schema before code is written. Update JSON first, then consume it.
- Provide a DEBUG OVERLAY showing:
  - world axes (X to the right, Y up), labeled tick marks every 10 in;
  - rail lines with inward normals as short arrows;
  - pocket circles and their `cut_normal_hint` arrows;
  - named labels at endpoints (e.g., N_rail.from).
```

# 5) Minimal helpers (copy-paste to your code)

**Config & mapping:**

```js
// config.js
export const TABLE = { W: 100, H: 50 };
export const SCALE = 6;           // pixels per inch (choose per device)
export const CANVAS_CENTER = { x: 640, y: 360 }; // set at runtime after resize

export function worldToCanvas(p) {
  return {
    x: CANVAS_CENTER.x + SCALE * p.x,
    y: CANVAS_CENTER.y - SCALE * p.y // flip Y for canvas
  };
}
export function canvasToWorld(p) {
  return {
    x: (p.x - CANVAS_CENTER.x) / SCALE,
    y: -(p.y - CANVAS_CENTER.y) / SCALE
  };
}
```

**Axis + labels debug draw:**

```js
export function drawAxes(ctx) {
  // origin
  const o = worldToCanvas({x:0,y:0});
  ctx.beginPath(); ctx.arc(o.x, o.y, 3, 0, Math.PI*2); ctx.fill();

  // +X
  const x1 = worldToCanvas({x: TABLE.W/2, y: 0});
  ctx.beginPath(); ctx.moveTo(o.x,o.y); ctx.lineTo(x1.x,x1.y); ctx.stroke();
  ctx.fillText("+X (E)", x1.x-30, x1.y-6);

  // +Y
  const y1 = worldToCanvas({x: 0, y: TABLE.H/2});
  ctx.beginPath(); ctx.moveTo(o.x,o.y); ctx.lineTo(y1.x,y1.y); ctx.stroke();
  ctx.fillText("+Y (N)", y1.x+6, y1.y+10);

  // ticks every 10"
  for (let x=-TABLE.W/2; x<=TABLE.W/2; x+=10) {
    const a = worldToCanvas({x, y:-1});
    const b = worldToCanvas({x, y: 1});
    ctx.beginPath(); ctx.moveTo(a.x,a.y); ctx.lineTo(b.x,b.y); ctx.stroke();
  }
  for (let y=-TABLE.H/2; y<=TABLE.H/2; y+=10) {
    const a = worldToCanvas({x:-1, y});
    const b = worldToCanvas({x: 1, y});
    ctx.beginPath(); ctx.moveTo(a.x,a.y); ctx.lineTo(b.x,b.y); ctx.stroke();
  }
}
```

**Rails + normals debug draw:**

```js
export function drawRail(ctx, rail) {
  const A = worldToCanvas({x: rail.from[0], y: rail.from[1]});
  const B = worldToCanvas({x: rail.to[0],   y: rail.to[1]});
  ctx.beginPath(); ctx.moveTo(A.x,A.y); ctx.lineTo(B.x,B.y); ctx.stroke();

  // midpoint normal arrow
  const mid = { x: (rail.from[0]+rail.to[0])/2, y: (rail.from[1]+rail.to[1])/2 };
  const m = worldToCanvas(mid);
  const n = { x: rail.normal[0], y: rail.normal[1] };
  const tip = worldToCanvas({ x: mid.x + 4*n.x, y: mid.y + 4*n.y }); // 4 inches long
  ctx.beginPath(); ctx.moveTo(m.x,m.y); ctx.lineTo(tip.x,tip.y); ctx.stroke();
}
```

**Pockets + cut hint:**

```js
export function drawPocket(ctx, p, radiusIn) {
  const c = worldToCanvas({x: p.center[0], y: p.center[1]});
  ctx.beginPath(); ctx.arc(c.x, c.y, radiusIn*SCALE, 0, Math.PI*2); ctx.stroke();

  const mid = { x: p.center[0], y: p.center[1] };
  const n = { x: p.cut_normal_hint[0], y: p.cut_normal_hint[1] };
  const tip = worldToCanvas({ x: mid.x + 6*n.x, y: mid.y + 6*n.y }); // 6 inches arrow
  const base = worldToCanvas(mid);
  ctx.beginPath(); ctx.moveTo(base.x,base.y); ctx.lineTo(tip.x,tip.y); ctx.stroke();
}
```

# 6) How you talk to the agent from now on

* “Place the cue ball 4 inches south of table center” → **use world words**:
  `position = { x: 0, y: -4 }`
* “Bounce off the **E_rail**” (not “right cushion”).
* “Draw a 2-inch inward normal arrow on **N_rail** midpoint.”
* “Align **NW_corner** pocket lips 45° toward the table using `cut_normal_hint: [1,-1]`.”

# 7) Quick validation checklist (for humans & agent)

* Do the **axes overlay** and **rail normals** match expectations?
* Do labeled pocket centers sit on corners/midpoints in **world inches**?
* When you click at a point on screen, does the hovered **world coordinate** match the inverted-Y math?
* Do collisions reflect across each rail’s stated **normal**?

---

If you want, I can bundle this into a tiny starter repo (index.html + config + debug overlay) so you can see the axes, rails, and pocket arrows immediately. Then you/the agent can iterate the cushions’ bevels knowing everyone’s speaking the same geometry language.
