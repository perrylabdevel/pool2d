# Geometry System Refactoring Plan

## Problem Statement

The current pocket geometry system is **difficult to use** and requires users to understand complex geometric relationships to achieve desired jaw shapes. Users frequently struggle to get the cushion jaws "exactly right."

### User Experience Issues

1. **❌ Indirect Control** - Users adjust "Straight Y" which mathematically derives "Jaw X" positions via tangent line calculations. If the derived position isn't right, they must manually override it.

2. **❌ Non-Intuitive Parameters** - Controls like "SIDE_FRAME_OFFSET_IN" and "JAW_REF_RADIUS_IN" affect *how jaws are calculated* rather than *what the jaw shape is*.

3. **❌ Cascade Effects** - Changing one value (e.g., Straight Y) affects multiple derived positions, requiring iterative trial-and-error adjustments.

4. **❌ Override Complexity** - The "Auto" system suggests the current approach is backwards: users should set what they want directly, not override a derivation.

5. **❌ Poor Mental Model** - No one thinks "I want my jaw radius to be 4.0 inches with a frame offset of 2.0 to derive the jaw position." They think "I want the pocket opening to be 4.5 inches wide with a 5-degree jaw angle."

---

## Current System Analysis

### How It Works Now

**Parameters (Side Pockets):**
```typescript
SIDE_FRAME_OFFSET_IN: 2.0       // Affects derivation formula
JAW_REF_RADIUS_IN: 4.0          // Affects derivation formula
SIDE_STRAIGHT_Y_IN: 23.5        // Where straight rail ends
SIDE_INNER_Y_IN: 24.6           // Where throat ends
SIDE_JAW_OUTER_OVERRIDE_IN: null  // Manual override (Auto)
SIDE_JAW_INNER_OVERRIDE_IN: null  // Manual override (Auto)
SIDE_THROAT_WIDTH_IN: null      // Manual override (Auto)
```

**Derivation Process:**
1. User sets `SIDE_STRAIGHT_Y_IN = 23.5`
2. System calculates tangent line from frame circle to this Y position
3. Derives `JAW_X_OUTER` and `JAW_X_INNER` using complex geometry:
   ```typescript
   const tOuter = (yTop - straightY) / xi;
   const xOuter = xi + f * tOuter;
   ```
4. User sees result, doesn't like it
5. User must set `SIDE_JAW_OUTER_OVERRIDE_IN` to manually fix it

**Why This is Problematic:**
- The intermediate calculation parameters (`FRAME_OFFSET_IN`, `JAW_REF_RADIUS_IN`) don't represent physical pocket dimensions
- Users must understand the tangent derivation formula to predict outcomes
- The "correct" jaw position depends on your desired angle, but angle isn't a direct input
- Overrides bypass the derivation entirely, suggesting the derivation isn't helpful

### What Users Actually Want to Control

**Direct Physical Properties:**
1. **Pocket opening width** - How wide is the throat? (e.g., 4.5")
2. **Jaw angle** - What angle do the jaws meet the straight rail? (e.g., 5°)
3. **Pocket depth** - How far does the pocket extend into the table?
4. **Rail curvature** - How curved vs straight are the rails near the pocket?

**Current System Forces Indirect Approach:**
- Want 4.5" opening? → Adjust `SIDE_THROAT_WIDTH_IN` to 4.5
- Want 5° jaw angle? → Adjust `SIDE_FRAME_OFFSET_IN`, `JAW_REF_RADIUS_IN`, and `SIDE_STRAIGHT_Y_IN` until derivation gives you 5°
- Want specific pocket depth? → No direct control, must adjust multiple parameters

---

## Proposed Solution: Direct Parametrization

### New Parameter Philosophy

**Design Principle:** *Users should set what they want directly, not set inputs to a derivation formula.*

### Option A: Angle-Based (Recommended)

**Concept:** Define pockets by their opening, depth, and jaw angles.

**New Side Pocket Parameters:**
```typescript
// Direct physical properties (what users want)
SIDE_POCKET_OPENING_WIDTH_IN: 4.5    // Throat width (direct)
SIDE_POCKET_DEPTH_IN: 2.0            // How far into table (direct)
SIDE_JAW_ANGLE_DEG: 5.0              // Jaw angle from straight rail (direct)
SIDE_RAIL_CURVE_BLEND: 0.0           // 0=straight transition, 1=curved

// Positioning (where pocket is on table)
SIDE_POCKET_CENTER_Y_IN: 25.0        // Y position of pocket center
```

**Calculation (New Flow):**
```typescript
// Given direct parameters, calculate rail points
function calculateSideJawPoints(params: SidePocketParams): JawPoints {
  const { openingWidth, depth, jawAngle, centerY } = params;

  // Throat half-width
  const throatHalfWidth = openingWidth / 2;

  // Jaw angle in radians
  const angleRad = jawAngle * (Math.PI / 180);

  // Calculate where straight rail ends based on jaw angle
  // tan(angle) = depth / horizontalDistance
  const horizontalFromCenter = depth / Math.tan(angleRad);
  const straightY = centerY - depth;
  const jawX = throatHalfWidth + horizontalFromCenter;

  return {
    throatLeft: { x: -throatHalfWidth, y: centerY },
    throatRight: { x: throatHalfWidth, y: centerY },
    jawLeft: { x: -jawX, y: straightY },
    jawRight: { x: jawX, y: straightY },
  };
}
```

**Benefits:**
- ✅ User wants 5° jaw angle → Sets `SIDE_JAW_ANGLE_DEG: 5.0`
- ✅ User wants 4.5" opening → Sets `SIDE_POCKET_OPENING_WIDTH_IN: 4.5`
- ✅ Immediate, predictable results
- ✅ No overrides needed
- ✅ No complex derivation formulas to understand

**Trade-offs:**
- ⚠️ Different parametrization from current system
- ⚠️ Existing saved geometries would need migration
- ⚠️ Different from some billiards manufacturing specs

### Option B: Template-Based

**Concept:** Provide pre-configured templates for common table types, with fine-tuning available.

**Templates:**
```typescript
enum PocketTemplate {
  VALLEY_48_TIGHT,      // Valley 4x8 table, tight pockets
  VALLEY_48_MEDIUM,     // Valley 4x8 table, medium pockets
  VALLEY_48_LOOSE,      // Valley 4x8 table, loose pockets
  DIAMOND_90_TOURNAMENT,// Diamond 9' tournament spec
  DIAMOND_90_BAR,       // Diamond 9' bar table spec
  CUSTOM,               // User-defined from scratch
}

interface PocketTemplateConfig {
  sideOpening: number;
  cornerOpening: number;
  sideJawAngle: number;
  cornerJawAngle: number;
  pocketDepth: number;
  description: string;
}

const TEMPLATES: Record<PocketTemplate, PocketTemplateConfig> = {
  [PocketTemplate.VALLEY_48_TIGHT]: {
    sideOpening: 4.25,
    cornerOpening: 4.5,
    sideJawAngle: 4.5,
    cornerJawAngle: 5.0,
    pocketDepth: 2.25,
    description: "Valley 4x8 tournament specification",
  },
  // ... more templates
};
```

**User Flow:**
1. Select template (e.g., "Valley 4x8 Tight")
2. Auto-populates all geometry parameters
3. User can fine-tune individual parameters if needed
4. Save as custom template

**Benefits:**
- ✅ Quick setup for standard tables
- ✅ Guarantees realistic/playable geometry
- ✅ Educational (users learn what "tournament tight" means)
- ✅ Can still customize after template selection

**Trade-offs:**
- ⚠️ Requires researching real table specs
- ⚠️ More UI work (template selector)
- ⚠️ Still need good custom controls for fine-tuning

### Option C: Hybrid (Best of Both)

**Combine templates with angle-based controls:**

1. **Start with template** (optional, skip for power users)
2. **Fine-tune with angle-based parameters** (Option A)
3. **Advanced mode** for those who want full geometric control

**Implementation:**
```typescript
interface GeometryConfig {
  // Template (optional starting point)
  template?: PocketTemplate;

  // Direct physical properties (Option A)
  sideOpening: number;
  cornerOpening: number;
  sideJawAngle: number;
  cornerJawAngle: number;
  pocketDepth: number;

  // Advanced (for power users, collapsed by default)
  advanced: {
    railCurveBlend: number;
    cutAngleAdjustment: number;
    shelfDepth: number;
  };
}
```

**UI Structure:**
```
┌─────────────────────────────────────┐
│ 📐 Pocket Geometry                  │
├─────────────────────────────────────┤
│                                     │
│ Template: [Valley 4x8 Medium  ▼]   │
│ ☑ Start from template               │
│                                     │
│ ━━━ Side Pockets ━━━                │
│ Opening Width:  [4.5"] ────────     │
│ Jaw Angle:      [5.0°] ────────     │
│ Pocket Depth:   [2.0"] ────────     │
│                                     │
│ ━━━ Corner Pockets ━━━              │
│ Opening Width:  [4.75"] ───────     │
│ Jaw Angle:      [5.5°] ────────     │
│ Pocket Depth:   [2.25"] ───────     │
│                                     │
│ ▸ Advanced Settings (collapsed)     │
│                                     │
└─────────────────────────────────────┘
```

---

## Implementation Plan

### Phase 1: Research & Design (1-2 days)

**Task 1.1: Gather Real Table Specifications**
Research standard pocket geometry for:
- Valley tables (4x8, 4.5x9)
- Diamond tables (7', 8', 9')
- Brunswick Gold Crown
- Bar vs. tournament specs

**Measurements needed:**
- Pocket opening widths
- Jaw angles
- Pocket depths
- Rail curvature characteristics

**Sources:**
- BCA (Billiard Congress of America) specs
- Manufacturer technical diagrams
- Pool hall measurements (if available)
- Community forums (AZBilliards, etc.)

**Task 1.2: Define New Parameter Set**
Create clean interface:
```typescript
interface ModernPocketGeometry {
  // Side pockets
  sideOpening: number;        // inches
  sideJawAngle: number;       // degrees
  sidePocketDepth: number;    // inches
  sideRailCurve: number;      // 0-1 blend

  // Corner pockets
  cornerOpening: number;      // inches
  cornerJawAngle: number;     // degrees
  cornerPocketDepth: number;  // inches
  cornerRailCurve: number;    // 0-1 blend

  // Global
  cutAngleAdjust: number;     // degrees
  shelfDepth: number;         // inches
}
```

### Phase 2: Conversion Functions (2-3 days)

**Task 2.1: Modern → Legacy Conversion**
```typescript
function modernToLegacy(modern: ModernPocketGeometry): LegacyGeometry {
  // Convert new angle-based parameters to old Straight X/Y system
  // This allows using old rendering code initially
}
```

**Task 2.2: Legacy → Modern Conversion**
```typescript
function legacyToModern(legacy: LegacyGeometry): ModernPocketGeometry {
  // Convert existing configurations to new system
  // Allows users to migrate saved geometries
}
```

**Task 2.3: Validation & Bounds**
```typescript
function validateModernGeometry(geom: ModernPocketGeometry): ValidationResult {
  // Ensure parameters produce valid, playable pockets
  // Check: opening width < table width, angles reasonable, etc.
}
```

### Phase 3: New Calculation Engine (3-4 days)

**Task 3.1: Rewrite `getTableGeometry()`**
Replace complex tangent derivations with direct calculations:
```typescript
function calculateJawPointsFromAngle(
  opening: number,
  jawAngle: number,
  depth: number,
  centerY: number
): { jawLeft: Vec2; jawRight: Vec2; throatLeft: Vec2; throatRight: Vec2 } {
  const angleRad = jawAngle * Math.PI / 180;
  const throatHalfWidth = opening / 2;

  // Distance from throat to jaw along rail
  const railLength = depth / Math.sin(angleRad);

  // Horizontal component of rail length
  const horizontalSpread = railLength * Math.cos(angleRad);

  // Calculate points
  const straightY = centerY - depth;
  const jawX = throatHalfWidth + horizontalSpread;

  return {
    throatLeft: { x: -throatHalfWidth, y: centerY },
    throatRight: { x: throatHalfWidth, y: centerY },
    jawLeft: { x: -jawX, y: straightY },
    jawRight: { x: jawX, y: straightY },
  };
}
```

**Task 3.2: Handle Rail Curves**
Implement curve blending for smoother jaws:
```typescript
function createJawCurve(
  jawPoint: Vec2,
  throatPoint: Vec2,
  curveBlend: number
): Vec2[] {
  if (curveBlend === 0) {
    return [jawPoint, throatPoint]; // Straight line
  }

  // Bezier curve from jaw to throat
  const controlPoint = {
    x: jawPoint.x + (throatPoint.x - jawPoint.x) * curveBlend,
    y: jawPoint.y + (throatPoint.y - jawPoint.y) * (1 - curveBlend),
  };

  return generateBezierPoints(jawPoint, controlPoint, throatPoint, 10);
}
```

**Task 3.3: Corner Pocket Calculations**
Similar approach for corner pockets:
```typescript
function calculateCornerJawPoints(
  opening: number,
  jawAngle: number,
  depth: number
): CornerJawPoints {
  // Similar math, but for corner geometry
}
```

### Phase 4: Update UI (2-3 days)

**Task 4.1: New Geometry Panel**
Replace current controls with intuitive sliders:

**Before (Current):**
```
Side Jaw Radius: [4.0]
Jaw Steepness: [2.0]
Straight Y: [23.5]
Inner Y (Throat): [24.6]
Jaw Outer X: [Auto] 🔘
Jaw Inner X: [Auto] 🔘
Throat Width: [Auto] 🔘
```

**After (Proposed):**
```
━━━ Side Pockets ━━━
Opening Width:  [4.5 inches] ──────
Jaw Angle:      [5.0 degrees] ─────
Pocket Depth:   [2.0 inches] ──────
Rail Curvature: [0.0 (straight)] ──

━━━ Corner Pockets ━━━
Opening Width:  [4.75 inches] ─────
Jaw Angle:      [5.5 degrees] ─────
Pocket Depth:   [2.25 inches] ─────
Rail Curvature: [0.0 (straight)] ──
```

**Task 4.2: Add Template Selector**
```html
<div class="settings-group">
  <h4>Quick Start Templates</h4>
  <select id="geometry-template">
    <option value="">Custom (no template)</option>
    <option value="valley_48_tight">Valley 4x8 - Tight</option>
    <option value="valley_48_medium">Valley 4x8 - Medium</option>
    <option value="valley_48_loose">Valley 4x8 - Loose</option>
    <option value="diamond_90_tour">Diamond 9' - Tournament</option>
    <option value="diamond_90_bar">Diamond 9' - Bar Table</option>
  </select>
  <button id="load-template">Load Template</button>
</div>
```

**Task 4.3: Advanced Settings (Collapsed)**
Keep advanced options available but hidden by default:
```html
<details>
  <summary>🔧 Advanced Settings</summary>
  <div>
    <!-- Old parameters for power users -->
    <!-- Frame offsets, reference radii, etc. -->
  </div>
</details>
```

### Phase 5: Migration & Testing (2-3 days)

**Task 5.1: Settings Migration**
```typescript
function migrateOldSettings(): void {
  const oldSettings = loadLegacySettings();
  const modernSettings = legacyToModern(oldSettings);
  saveSettings(modernSettings);
}
```

**Task 5.2: Visual Comparison Tool**
Create overlay to compare old vs new geometry:
```typescript
// Render both old and new geometry on same canvas
// Highlight differences
// Allow user to accept or reject migration
```

**Task 5.3: Validation Testing**
- ✅ All jaw angles calculate correctly
- ✅ Pocket openings match specified widths
- ✅ No overlapping geometry
- ✅ Physics still works correctly
- ✅ Balls can enter/exit pockets properly
- ✅ Templates match real table specs

### Phase 6: Documentation (1 day)

**Task 6.1: Update CONFIG.ts Comments**
```typescript
// Before:
SIDE_FRAME_OFFSET_IN: 2.0, // Frame offset for side pocket tangent calculation

// After:
SIDE_JAW_ANGLE_DEG: 5.0, // Angle between jaw and straight rail (degrees)
// Typical values: 3-7° (tighter angle = harder pocket)
```

**Task 6.2: User Guide**
Create simple guide:
```markdown
# Pocket Geometry Guide

## Quick Start
1. Choose a template from dropdown (e.g., "Valley 4x8 - Medium")
2. Click "Load Template"
3. Adjust as needed

## Understanding Parameters

### Opening Width
- Controls how wide the pocket entrance is
- Typical: 4.25-5.0 inches
- Tighter = harder pockets

### Jaw Angle
- Angle between jaw and straight rail
- Typical: 4-6 degrees
- Smaller angle = more forgiving pockets

### Pocket Depth
- How far back the pocket extends
- Typical: 2.0-2.5 inches
- Deeper = easier to capture balls
```

---

## Comparison: Before vs. After

### User Experience

**Before (Current System):**
```
User goal: "I want 5-degree jaw angles"

Steps:
1. Adjust SIDE_FRAME_OFFSET_IN: 2.0
2. Adjust JAW_REF_RADIUS_IN: 4.0
3. Adjust SIDE_STRAIGHT_Y_IN: 23.5
4. Check derived jaw position
5. Not right, try FRAME_OFFSET_IN: 2.2
6. Check again
7. Still not right, try STRAIGHT_Y_IN: 23.7
8. Check again
9. Close enough, but jaw inner is wrong
10. Set JAW_INNER_OVERRIDE_IN: 3.2
11. Still not perfect...
12. Give up or spend 30 minutes tweaking

Result: Frustration, trial-and-error
```

**After (New System):**
```
User goal: "I want 5-degree jaw angles"

Steps:
1. Set SIDE_JAW_ANGLE_DEG: 5.0
2. Done.

Result: Immediate, predictable
```

### Code Complexity

**Before:**
```typescript
// 90+ lines of complex tangent geometry derivations
function deriveSideJawXMagnitudes(...) {
  const f = frameOffset;
  const r = referenceRadius;
  const yTop = Y_N_PLAY + f;
  const under = r * r - f * f;
  const xi = Math.sqrt(under);
  const tOuter = (yTop - straightY) / xi;
  const xOuter = xi + f * tOuter;
  // ... more complex math
}
```

**After:**
```typescript
// 20 lines of straightforward trigonometry
function calculateJawPoints(opening, angle, depth) {
  const angleRad = angle * Math.PI / 180;
  const throatHalfWidth = opening / 2;
  const horizontalSpread = (depth / Math.tan(angleRad));
  const jawX = throatHalfWidth + horizontalSpread;
  // Done.
}
```

---

## Migration Strategy

### Backwards Compatibility

**Option 1: Dual System (Transition Period)**
- Keep old parameters in CONFIG but deprecated
- New UI uses modern parameters
- Conversion happens transparently
- Eventually remove old system

**Option 2: One-Time Migration**
- Detect old config format
- Show migration dialog
- Convert and save as new format
- No looking back

**Option 3: Parallel Systems**
- "Classic Mode" for power users who want old controls
- "Modern Mode" (default) with new angle-based controls
- Both systems coexist permanently

**Recommendation: Option 1 (Dual System)**
- Safest approach
- Users can verify new system matches old geometry
- Can roll back if issues found
- Eventually deprecate old system in v2.0

---

## Estimated Effort

| Phase | Tasks | Estimated Hours |
|-------|-------|----------------|
| Research & Design | 2 tasks | 8-12 hours |
| Conversion Functions | 3 tasks | 12-16 hours |
| New Calculation Engine | 3 tasks | 16-20 hours |
| Update UI | 3 tasks | 12-16 hours |
| Migration & Testing | 3 tasks | 12-16 hours |
| Documentation | 2 tasks | 4-6 hours |
| **Total** | **16 tasks** | **64-86 hours** |

**Breakdown:**
- Research: ~10 hours
- Core implementation: ~40 hours
- UI work: ~15 hours
- Testing & docs: ~15 hours

**Timeline:**
- 1-2 weeks solo (full-time)
- 2-4 weeks part-time

---

## Success Metrics

### Usability Goals
- [ ] User can achieve desired jaw angle in 1 adjustment (not 10)
- [ ] No "override" buttons needed for common use cases
- [ ] Parameter names make physical sense ("Jaw Angle" not "Frame Offset")
- [ ] Templates get users 90% to desired geometry instantly

### Technical Goals
- [ ] New calculations produce valid geometry
- [ ] Existing saved configs migrate successfully
- [ ] Physics simulation unaffected
- [ ] No performance regression
- [ ] Code is simpler and more maintainable

### Validation
- [ ] Jaw angles match spec (measure on screen)
- [ ] Pocket openings match spec (measure on screen)
- [ ] Balls enter/exit pockets correctly
- [ ] No weird edge cases (overlapping geometry, etc.)

---

## Open Questions

### Design Decisions
- ❓ Should we keep "Advanced Mode" with old parameters or fully deprecate?
- ❓ How many templates should we provide initially? (3? 5? 10?)
- ❓ Should jaw angle be degrees or percentage? (Degrees more intuitive)
- ❓ Do we need separate depth control or tie it to angle?

### Technical Decisions
- ❓ Migrate all at once or gradual cutover?
- ❓ Keep old derivation functions for reference?
- ❓ Should templates be hardcoded or JSON-loaded?
- ❓ How to visualize parameter changes in real-time?

### Research Needed
- ❓ What are actual tournament spec jaw angles?
- ❓ How much variation exists between table manufacturers?
- ❓ Do pro players care about specific geometry details?

---

## Risk Assessment

### Low Risk
- ✅ Math is simpler (basic trig vs complex derivations)
- ✅ Can test new system alongside old
- ✅ Migration is one-way, can keep old code as reference
- ✅ UI changes are additive (can keep advanced mode)

### Medium Risk
- ⚠️ Users might have saved geometries that don't convert perfectly
- ⚠️ Templates might not match all real tables exactly
- ⚠️ Some edge cases might require old derivation approach

### Mitigation Strategies
- Keep old calculation code as fallback
- Allow manual override for edge cases
- Extensive testing with various geometries
- Gradual rollout with user feedback

---

## Next Steps

1. ✅ **Review this plan** - Does the angle-based approach make sense?
2. 🎯 **Research real table specs** - Gather actual measurements
3. 📐 **Prototype new calculations** - Test math with sample values
4. 🎨 **Mock up new UI** - Validate UX improvement
5. 🔧 **Implement Phase 1** - Start with conversion functions
6. 🧪 **Build comparison tool** - Visualize old vs new side-by-side
7. 🚢 **Ship MVP** - Release with templates + basic controls
8. 📈 **Gather feedback** - Iterate based on user testing

---

## Appendix A: Real Table Specifications (To Research)

### Valley Tables
**Valley Panther ZD-4 (4x8):**
- Corner pocket: 4.5-5.0" opening
- Side pocket: 4.25-4.75" opening
- Jaw angles: TBD (need research)

**Valley Cougar ZD-7 (3.5x7):**
- Tighter spec than 4x8
- Corner: ~4.375" opening
- Side: ~4.125" opening

### Diamond Tables
**Diamond Pro-Am (9'):**
- Tournament spec
- Corner: 4.5" ±0.125"
- Side: 4.0" ±0.125"
- Shallow shelf depth

**Diamond Smart Table (7'):**
- Bar table spec (looser)
- Corner: 5.0"
- Side: 4.75"
- Deeper pockets

### Brunswick Gold Crown
**Gold Crown V (9'):**
- Corner: 4.625"
- Side: 4.375"
- Moderate jaw angles
- BCA regulation compliant

---

## Appendix B: Terminology Guide

**Jaw** - The angled rail section leading into the pocket
**Throat** - The narrowest opening of the pocket
**Shelf** - The flat bottom surface inside the pocket
**Face** - The front-facing surface of the cushion
**Nose** - The point where the cushion meets the pocket opening
**Cut angle** - Angle of the pocket facing (affects ball entry)
**Opening width** - Distance across the throat (playable area)

---

**Ready to start implementing this?** The biggest win will be replacing indirect derivations with direct angle-based controls. Users will finally be able to set what they want without fighting the system.
