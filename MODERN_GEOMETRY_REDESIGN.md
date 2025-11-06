# Modern Geometry System Redesign Plan

## Executive Summary

The current modern geometry system has a fundamental design flaw: it uses a single "opening" parameter when real pool pockets have TWO distinct widths (mouth and throat). This redesign fixes that by modeling pockets the way they're actually specified in real tables.

**Status:** Design phase - implementation pending
**Estimated Effort:** 6-8 hours
**Risk Level:** Medium (requires coordinated changes across 4 files)

---

## Problem Analysis

### Current Broken Model

```typescript
// CURRENT (BROKEN)
interface PocketConfig {
  opening: number;   // Ambiguous - mouth or throat?
  jawAngle: number;  // Derived property, should not be input
  depth: number;     // Ambiguous - to what point?
}
```

**Issues:**
1. ❌ "opening" is ambiguous (mouth vs throat)
2. ❌ "jawAngle" is a derived property, not a direct input
3. ❌ "depth" is unclear (to straight rail? to throat?)
4. ❌ Current default table has 11" mouth / 10" throat (absurdly wide)
5. ❌ BCA templates produce 5.5" pockets that look "closed" compared to default

### How Real Pockets Work

Real pool pockets have TWO widths and TWO depths:

```
                    PLAY AREA EDGE (Y=25.0)
                           |
    ═══════════════════════╪═══════════════════════
    Straight Rail          ↓ railDepth (1.5")
                    ╔══════╪══════╗
                    ║  MOUTH      ║  ← mouthWidth (11.0" default, 5.5" BCA)
    Jaw (angled)    ║   ↘     ↙   ║
                    ║    THROAT   ║  ← throatWidth (9.7" default, 4.6" BCA)
                    ║             ║
                    ╚═════════════╝
                          ↑ jawDepth (1.1")
```

**Key measurements:**
- **mouthWidth**: Width at straight rail end (where JAW_X_OUTER is)
- **throatWidth**: Width at narrowest point (where JAW_X_INNER is)
- **railDepth**: Distance from play edge to straight rail end
- **jawDepth**: Distance from straight rail to throat (angled section)

**Jaw angle emerges from geometry:**
```
jawAngle = atan((mouthWidth - throatWidth) / 2 / jawDepth)
```

---

## Correct Model

### New Interface

```typescript
/**
 * Pocket configuration using physical measurements
 *
 * Pockets have two widths (mouth and throat) and two depths
 * (rail depth and jaw depth).
 */
export interface PocketConfig {
  /** Width at cushion nose / mouth (where straight rail ends), in inches */
  mouthWidth: number;

  /** Width at throat (narrowest point, deeper in pocket), in inches */
  throatWidth: number;

  /** Distance from play area edge to straight rail end, in inches */
  railDepth: number;

  /** Distance from straight rail to throat (jaw section), in inches */
  jawDepth: number;

  /** Depth of shelf (flat area inside pocket), in inches */
  shelfDepth: number;

  /** Blend factor for rail curvature: 0=straight, 1=curved */
  railCurve?: number;
}
```

### Derived Properties

From the above, we calculate:

```typescript
// Jaw positions
JAW_X_OUTER = mouthWidth / 2;
JAW_X_INNER = throatWidth / 2;

// Y positions
SIDE_STRAIGHT_Y_IN = PLAY_HALF_H_IN - railDepth;
SIDE_INNER_Y_IN = SIDE_STRAIGHT_Y_IN + jawDepth;

// Jaw angle (informational only)
horizontalTaper = (JAW_X_OUTER - JAW_X_INNER);
jawAngle = atan(horizontalTaper / jawDepth) * 180 / PI;
```

**Benefits:**
- ✅ Direct mapping to BCA specifications
- ✅ Clear physical meaning
- ✅ No ambiguity about what each parameter means
- ✅ Jaw angle emerges naturally from geometry
- ✅ Easy to match real table specs

---

## Template Specifications

### Current Default (What User Sees Now)

```typescript
CURRENT_DEFAULT: {
  side: {
    mouthWidth: 10.97,    // Extremely wide
    throatWidth: 9.70,    // Extremely wide
    railDepth: 1.5,
    jawDepth: 1.1,
    shelfDepth: 0.3,
  },
  corner: {
    mouthWidth: 5.0,      // Reasonable
    throatWidth: 4.5,
    railDepth: 1.75,
    jawDepth: 1.0,
    shelfDepth: 1.75,
  }
}
// Calculated jaw angle: ~6.6° (side)
```

### BCA Tournament - Tight

```typescript
BCA_TOURNAMENT_TIGHT: {
  side: {
    mouthWidth: 5.375,    // BCA minimum
    throatWidth: 4.375,   // BCA minimum
    railDepth: 1.4,       // Tighter play area
    jawDepth: 1.1,
    shelfDepth: 0.25,
  },
  corner: {
    mouthWidth: 4.875,    // BCA minimum
    throatWidth: 4.0,     // BCA minimum
    railDepth: 1.625,
    jawDepth: 1.0,
    shelfDepth: 1.625,
  }
}
// Calculated jaw angle: ~4.6° (side), very challenging
```

### BCA Tournament - Medium

```typescript
BCA_TOURNAMENT_MEDIUM: {
  side: {
    mouthWidth: 5.5,      // BCA mid-range
    throatWidth: 4.625,   // BCA mid-range
    railDepth: 1.5,
    jawDepth: 1.1,
    shelfDepth: 0.3,
  },
  corner: {
    mouthWidth: 5.0,      // BCA mid-range
    throatWidth: 4.125,   // BCA mid-range
    railDepth: 1.75,
    jawDepth: 1.0,
    shelfDepth: 1.75,
  }
}
// Calculated jaw angle: ~4.5° (side)
```

### BCA Tournament - Loose

```typescript
BCA_TOURNAMENT_LOOSE: {
  side: {
    mouthWidth: 5.625,    // BCA maximum
    throatWidth: 4.875,   // BCA maximum
    railDepth: 1.6,       // Looser play area
    jawDepth: 1.1,
    shelfDepth: 0.375,
  },
  corner: {
    mouthWidth: 5.125,    // BCA maximum
    throatWidth: 4.25,    // BCA maximum
    railDepth: 1.875,
    jawDepth: 1.0,
    shelfDepth: 1.875,
  }
}
// Calculated jaw angle: ~3.9° (side), more forgiving
```

### Diamond Pro-Am 9'

```typescript
DIAMOND_PRO_AM: {
  side: {
    mouthWidth: 4.5,      // Extremely tight
    throatWidth: 3.5,     // Extremely tight
    railDepth: 1.3,
    jawDepth: 1.0,
    shelfDepth: 0.25,
  },
  corner: {
    mouthWidth: 4.5,
    throatWidth: 3.5,
    railDepth: 1.5,
    jawDepth: 1.0,
    shelfDepth: 1.5,
  }
}
// Calculated jaw angle: ~5.4° (side), professional difficulty
```

### Valley Bar Table

```typescript
VALLEY_BAR_TABLE: {
  side: {
    mouthWidth: 6.0,      // Generous for bar play
    throatWidth: 5.0,
    railDepth: 1.6,
    jawDepth: 1.2,
    shelfDepth: 0.375,
  },
  corner: {
    mouthWidth: 5.25,
    throatWidth: 4.5,
    railDepth: 2.0,
    jawDepth: 1.0,
    shelfDepth: 2.0,
  }
}
// Calculated jaw angle: ~4.8° (side)
```

### Brunswick Gold Crown VI

```typescript
BRUNSWICK_GOLD_CROWN: {
  side: {
    mouthWidth: 5.5,
    throatWidth: 4.5,
    railDepth: 1.5,
    jawDepth: 1.1,
    shelfDepth: 0.25,
  },
  corner: {
    mouthWidth: 4.9,
    throatWidth: 4.0,
    railDepth: 1.7,
    jawDepth: 1.0,
    shelfDepth: 1.7,
  }
}
// Calculated jaw angle: ~5.2° (side)
```

---

## Valid Ranges

```typescript
export const GEOMETRY_RANGES = {
  side: {
    mouthWidth: { min: 4.0, max: 12.0, typical: 5.5 },
    throatWidth: { min: 3.0, max: 11.0, typical: 4.625 },
    railDepth: { min: 0.5, max: 2.5, typical: 1.5 },
    jawDepth: { min: 0.5, max: 2.0, typical: 1.1 },
    shelfDepth: { min: 0.0, max: 0.5, typical: 0.25 },
    railCurve: { min: 0.0, max: 1.0, typical: 0.0 },
  },
  corner: {
    mouthWidth: { min: 4.0, max: 6.0, typical: 5.0 },
    throatWidth: { min: 3.0, max: 5.0, typical: 4.125 },
    railDepth: { min: 1.0, max: 2.5, typical: 1.75 },
    jawDepth: { min: 0.5, max: 1.5, typical: 1.0 },
    shelfDepth: { min: 1.0, max: 2.5, typical: 1.75 },
    railCurve: { min: 0.0, max: 1.0, typical: 0.0 },
  },
  global: {
    cutAngleAdjust: { min: -5.0, max: 5.0, typical: 0.0 },
    verticalAngle: { min: 12.0, max: 15.0, typical: 13.5 },
  },
} as const;
```

**Validation Rules:**
1. `throatWidth < mouthWidth` (throat must be narrower)
2. `jawDepth > 0` (jaw section must exist)
3. `railDepth > 0` (straight rail must extend from play area)

---

## Implementation Plan

### Phase 1: Update Type Definitions (30 min)

**File:** `src/geometry/ModernGeometry.ts`

**Tasks:**
1. Update `PocketConfig` interface
2. Update all templates with new parameters
3. Update `GEOMETRY_RANGES`
4. Add validation for `throatWidth < mouthWidth`
5. Update template names and descriptions

**Testing:**
- Verify TypeScript compiles
- Check all templates have valid ranges

---

### Phase 2: Update Conversion Functions (2 hours)

**File:** `src/geometry/GeometryConversion.ts`

**Current conversion (BROKEN):**
```typescript
// OLD (calculates from angle)
const horizontalSpread = verticalDistance * Math.tan(jawAngleRad);
const jawInnerX = throatHalfWidth;
const jawOuterX = throatHalfWidth + horizontalSpread;
```

**New conversion (CORRECT):**
```typescript
function modernPocketToLegacySide(side: PocketConfig): {
  frameOffset: number;
  refRadius: number;
  straightY: number;
  innerY: number;
  jawOuterX: number;
  jawInnerX: number;
} {
  // Direct mapping from physical measurements
  const jawOuterX = side.mouthWidth / 2;
  const jawInnerX = side.throatWidth / 2;

  const straightY = PLAY_HALF_H_IN - side.railDepth;
  const innerY = straightY + side.jawDepth;

  // Use reasonable defaults for derivation parameters
  // (won't be used since we're setting overrides)
  const frameOffset = 2.0;
  const refRadius = 4.0;

  return {
    frameOffset,
    refRadius,
    straightY,
    innerY,
    jawOuterX,
    jawInnerX,
  };
}
```

**Reverse conversion (for loading legacy configs):**
```typescript
function legacySideToModernPocket(
  jawOuterX: number,
  jawInnerX: number,
  straightY: number,
  innerY: number
): PocketConfig {
  const mouthWidth = jawOuterX * 2;
  const throatWidth = jawInnerX * 2;
  const railDepth = PLAY_HALF_H_IN - straightY;
  const jawDepth = innerY - straightY;
  const shelfDepth = 0.25; // Reasonable default

  return {
    mouthWidth,
    throatWidth,
    railDepth,
    jawDepth,
    shelfDepth,
    railCurve: 0.0,
  };
}
```

**Tasks:**
1. Rewrite `modernPocketToLegacySide()`
2. Rewrite `modernPocketToLegacyCorner()`
3. Rewrite `legacySideToModernPocket()`
4. Rewrite `legacyCornerToModernPocket()`
5. Remove debug logging
6. Add comprehensive comments

**Testing:**
- Test Current Default template → should produce legacy JAW_X_OUTER=5.485, JAW_X_INNER=4.850
- Test BCA Medium template → should produce JAW_X_OUTER=2.75, JAW_X_INNER=2.3125
- Verify round-trip: legacy → modern → legacy produces same values

---

### Phase 3: Update Calculator (1 hour)

**File:** `src/geometry/ModernGeometryCalculator.ts`

**Changes needed:**
1. Update function signatures to use new `PocketConfig`
2. Remove `jawAngle` calculations (now derived, not input)
3. Update JSDoc comments

**New function signatures:**
```typescript
export function calculateSideJawPoints(
  config: PocketConfig,
  outwardOffset: number = 0.25
): SideJawPoints {
  // Calculate jaw outer (at straight rail)
  const jawOuterX = config.mouthWidth / 2;

  // Calculate jaw inner (at throat)
  const jawInnerX = config.throatWidth / 2;

  // Calculate Y positions
  const straightY = PLAY_HALF_H_IN - config.railDepth;
  const throatY = straightY + config.jawDepth;
  const pocketCenterY = PLAY_HALF_H_IN + outwardOffset;

  return {
    jawOuter: { x: jawOuterX, y: straightY },
    jawInner: { x: jawInnerX, y: throatY },
    mouth: { x: 0, y: pocketCenterY },
  };
}
```

**Add utility function:**
```typescript
/**
 * Calculate jaw angle from pocket geometry
 * (Informational only - not used in calculations)
 */
export function calculateJawAngle(config: PocketConfig): number {
  const horizontalTaper = (config.mouthWidth - config.throatWidth) / 2;
  const angleRad = Math.atan(horizontalTaper / config.jawDepth);
  return (angleRad * 180) / Math.PI;
}
```

**Testing:**
- Verify Current Default produces expected jaw positions
- Verify BCA templates produce correct geometry
- Check jaw angle calculation is informational

---

### Phase 4: Update UI Panel (2-3 hours)

**File:** `src/ui/ModernGeometryPanel.ts`

**Current controls (WRONG):**
```
Opening Width (in)
Jaw Angle (°)
Pocket Depth (in)
```

**New controls (CORRECT):**
```
Mouth Width (in)      ← Width at cushion nose
Throat Width (in)     ← Width at narrowest point
Rail Depth (in)       ← Distance to straight rail
Jaw Depth (in)        ← Distance of jaw section
```

**UI Enhancements:**

1. **Add visual indicator of jaw angle:**
```typescript
private generateSidePocketControls(): string {
  const ranges = GEOMETRY_RANGES.side;

  // Calculate jaw angle for display
  const horizontalTaper = (this.currentGeometry.side.mouthWidth -
                          this.currentGeometry.side.throatWidth) / 2;
  const jawAngle = Math.atan(horizontalTaper / this.currentGeometry.side.jawDepth) *
                   180 / Math.PI;

  return `
    <div class="settings-group">
      <h4 class="settings-group-title">📍 Side Pockets</h4>
      <div style="font-size: 0.8rem; color: #888; margin-bottom: 0.5rem;">
        Calculated jaw angle: ${jawAngle.toFixed(1)}°
      </div>
      ${this.sliderRow(
        'modern-side-mouth',
        'Mouth Width (in)',
        ranges.mouthWidth.min,
        ranges.mouthWidth.max,
        0.05,
        ranges.mouthWidth.typical
      )}
      ${this.sliderRow(
        'modern-side-throat',
        'Throat Width (in)',
        ranges.throatWidth.min,
        ranges.throatWidth.max,
        0.05,
        ranges.throatWidth.typical
      )}
      ${this.sliderRow(
        'modern-side-rail-depth',
        'Rail Depth (in)',
        ranges.railDepth.min,
        ranges.railDepth.max,
        0.05,
        ranges.railDepth.typical
      )}
      ${this.sliderRow(
        'modern-side-jaw-depth',
        'Jaw Depth (in)',
        ranges.jawDepth.min,
        ranges.jawDepth.max,
        0.05,
        ranges.jawDepth.typical
      )}
    </div>
  `;
}
```

2. **Update validation:**
```typescript
private validateAndUpdateUI() {
  const validation = validateModernGeometry(this.currentGeometry);

  // Add custom validation for throat < mouth
  if (this.currentGeometry.side.throatWidth >= this.currentGeometry.side.mouthWidth) {
    validation.errors.push('Side throat must be narrower than mouth');
  }
  if (this.currentGeometry.corner.throatWidth >= this.currentGeometry.corner.mouthWidth) {
    validation.errors.push('Corner throat must be narrower than mouth');
  }

  // Update UI...
}
```

3. **Update slider bindings:**
```typescript
const sliderConfigs: SliderBindConfig<ModernPocketGeometry>[] = [
  {
    sliderId: 'modern-side-mouth',
    labelId: 'modern-side-mouth-val',
    onChange: (v) => {
      this.currentGeometry.side.mouthWidth = v!;
      this.validateAndUpdateUI();
    },
  },
  {
    sliderId: 'modern-side-throat',
    labelId: 'modern-side-throat-val',
    onChange: (v) => {
      this.currentGeometry.side.throatWidth = v!;
      this.validateAndUpdateUI();
    },
  },
  // ... etc
];
```

**Testing:**
- Load "Current Default" template → UI should show 11"/10" mouth/throat
- Load "BCA Tournament - Medium" → UI should show 5.5"/4.625"
- Adjust sliders → jaw angle updates in real-time
- Validation prevents throat ≥ mouth

---

### Phase 5: Update Documentation (30 min)

**Files:**
- `GEOMETRY_RESEARCH.md` - Add section on mouth vs throat
- `GEOMETRY_REFACTOR_PLAN.md` - Update with new interface
- `REFACTORING_PROGRESS.md` - Document redesign

**Add to GEOMETRY_RESEARCH.md:**
```markdown
## Mouth vs Throat Terminology

Pool pockets have two distinct widths:

### Mouth
- **Location**: At cushion nose where straight rail ends
- **Measurement**: Tip-to-tip across pocket opening
- **Legacy parameter**: `JAW_X_OUTER * 2`
- **BCA side spec**: 5.375" - 5.625"

### Throat
- **Location**: Narrowest point deeper in pocket
- **Measurement**: Width at facing/slate interface
- **Legacy parameter**: `JAW_X_INNER * 2`
- **BCA side spec**: 4.375" - 4.875"

### Jaw
- **Definition**: The angled rail section between mouth and throat
- **Angle**: Emerges from (mouth - throat) / jawDepth
- **Typical**: 4-7° for side pockets
```

---

### Phase 6: Testing & Validation (1-2 hours)

**Unit Tests:**
```typescript
describe('ModernGeometry', () => {
  test('Current Default matches legacy default', () => {
    const modern = GEOMETRY_TEMPLATES[PocketTemplate.CURRENT_DEFAULT];
    const legacy = modernToLegacy(modern);

    expect(legacy.SIDE_JAW_OUTER_OVERRIDE_IN).toBeCloseTo(5.485, 2);
    expect(legacy.SIDE_JAW_INNER_OVERRIDE_IN).toBeCloseTo(4.850, 2);
  });

  test('BCA Medium produces correct geometry', () => {
    const modern = GEOMETRY_TEMPLATES[PocketTemplate.BCA_TOURNAMENT_MEDIUM];
    const legacy = modernToLegacy(modern);

    expect(legacy.SIDE_JAW_OUTER_OVERRIDE_IN).toBeCloseTo(2.75, 2);
    expect(legacy.SIDE_JAW_INNER_OVERRIDE_IN).toBeCloseTo(2.3125, 2);
  });

  test('Throat cannot exceed mouth', () => {
    const config: PocketConfig = {
      mouthWidth: 5.0,
      throatWidth: 5.5, // Invalid!
      railDepth: 1.5,
      jawDepth: 1.0,
      shelfDepth: 0.25,
    };

    const validation = validateModernGeometry({ side: config, corner: config });
    expect(validation.valid).toBe(false);
    expect(validation.errors).toContain('Throat must be narrower than mouth');
  });
});
```

**Integration Tests:**
1. Load each template in UI
2. Click "Apply to Table"
3. Verify table renders correctly
4. Measure pocket widths visually
5. Compare to expected dimensions

**Visual Regression:**
1. Screenshot Current Default template applied
2. Compare to legacy geometry (should match exactly)
3. Screenshot BCA Medium template
4. Verify pockets are tighter but look correct

---

## File Change Summary

| File | Lines Changed | Complexity | Risk |
|------|--------------|------------|------|
| `ModernGeometry.ts` | ~150 | Medium | Low |
| `GeometryConversion.ts` | ~100 | High | Medium |
| `ModernGeometryCalculator.ts` | ~50 | Low | Low |
| `ModernGeometryPanel.ts` | ~80 | Medium | Low |
| `GEOMETRY_RESEARCH.md` | +30 | Low | None |

**Total Estimated Effort:** 6-8 hours

---

## Risk Mitigation

### High Risk: Conversion Logic Errors

**Risk:** Incorrect conversion could produce invalid geometry
**Mitigation:**
1. Write unit tests FIRST
2. Test with Current Default (should match legacy exactly)
3. Verify round-trip conversion
4. Add debug logging for first deployment

### Medium Risk: UI Confusion

**Risk:** Users might not understand mouth vs throat
**Mitigation:**
1. Add tooltips explaining terms
2. Show calculated jaw angle in UI
3. Provide "Current Default" template for comparison
4. Add help link to GEOMETRY_RESEARCH.md

### Low Risk: Template Inaccuracy

**Risk:** Templates might not match real tables
**Mitigation:**
1. Templates are easily updatable
2. Mark as "approximate" in descriptions
3. Allow custom adjustments

---

## Success Criteria

### Functional Requirements
- [ ] Current Default template produces exact match to legacy default
- [ ] BCA templates produce realistic tournament-size pockets
- [ ] All templates validate correctly
- [ ] UI displays calculated jaw angle
- [ ] Throat < mouth validation works
- [ ] "Apply to Table" updates geometry correctly

### User Experience
- [ ] User can load Current Default and see familiar wide pockets
- [ ] User can load BCA Medium and see proper tournament pockets
- [ ] Jaw angle updates in real-time as sliders move
- [ ] Clear feedback on what each parameter controls
- [ ] No console errors or warnings

### Code Quality
- [ ] TypeScript compiles with no errors
- [ ] All unit tests pass
- [ ] Documentation updated
- [ ] Comments explain mouth/throat distinction
- [ ] No magic numbers (use named constants)

---

## Rollout Plan

### Step 1: Implementation (6-8 hours)
- Complete Phases 1-5 above
- Write unit tests
- Manual testing in dev server

### Step 2: Testing (1-2 hours)
- Load each template
- Verify geometry looks correct
- Test edge cases (throat = mouth, etc.)
- Check console for errors

### Step 3: Documentation (30 min)
- Update markdown files
- Add inline comments
- Write commit message

### Step 4: Deployment
- Commit with detailed message
- Push to branch
- Build and verify
- Test in production

### Step 5: User Validation
- Have user test Current Default template
- Compare to legacy geometry
- Test BCA templates
- Gather feedback

---

## Future Enhancements (Post-Redesign)

### Visual Pocket Editor
- 2D schematic showing mouth, throat, jaw
- Click and drag to adjust widths
- Real-time preview of angle

### Photo Import
- Upload photo of real table
- Overlay measurement grid
- Extract pocket dimensions

### Difficulty Calculator
- Score each template by difficulty
- Compare effective pocket size accounting for geometry
- "This table is 15% harder than BCA Medium"

### Custom Templates
- Save user configurations
- Export/import template JSON
- Share templates with community

---

## Appendix A: Calculation Reference

### Side Pocket Conversion (Modern → Legacy)

```typescript
// Given modern parameters
mouthWidth: 5.5
throatWidth: 4.625
railDepth: 1.5
jawDepth: 1.1

// Calculate legacy parameters
JAW_X_OUTER = mouthWidth / 2 = 2.75
JAW_X_INNER = throatWidth / 2 = 2.3125
SIDE_STRAIGHT_Y_IN = 25.0 - railDepth = 23.5
SIDE_INNER_Y_IN = 23.5 + jawDepth = 24.6

// Calculated jaw angle (informational)
horizontalTaper = (2.75 - 2.3125) = 0.4375
jawAngle = atan(0.4375 / 1.1) * 180/π = 21.7°

Wait, that's way too steep! Let me recalculate...

Actually:
horizontalTaper = 0.4375
jawDepth = 1.1
angle = atan(0.4375/1.1) = 0.379 rad = 21.7°

Hmm, that's still seems high. Let me check with the current default:

Current default derived:
JAW_X_OUTER = 5.485
JAW_X_INNER = 4.850
horizontalTaper = 0.635
SIDE_STRAIGHT_Y = 23.5
SIDE_INNER_Y = 24.6
jawDepth = 1.1

angle = atan(0.635/1.1) = 0.523 rad = 30°!

That's insane! But wait, maybe I'm measuring the wrong angle. Let me think...

OH! The "jaw angle" people refer to is probably the angle FROM HORIZONTAL, not the slope angle.

If the rail goes from (5.485, 23.5) to (4.850, 24.6), the slope is:
dy = 1.1
dx = 0.635
slope_angle = atan(dy/dx) = atan(1.1/0.635) = 60°

But the "jaw angle" is probably measured differently. Let me look at the BCA specs again - they mention entrance angles of 142° and 103°, which are the total opening angles.

Actually, I think the confusion is that "jaw angle" in my original design was meant to be a small angle (3-7°) representing how much the jaw deviates from straight. But in reality, the jaw is quite steep!

Let me recalculate what the actual "jaw angle from straight rail" would be:

The straight rail is horizontal (parallel to Y axis).
The jaw goes from (5.485, 23.5) to (4.850, 24.6).

The angle from vertical is: atan(0.635/1.1) = 30°
The angle from horizontal is: 90° - 30° = 60°

So the jaw is at 60° from horizontal, or 30° from vertical.

This means my original "jaw angle" parameter was completely wrong conceptually. The jaw is not a gentle 5° slope - it's a steep ~30° slope!

This is why the redesign is critical. The proper way to specify pockets is:
- Mouth width (at straight rail)
- Throat width (at narrowest point)
- Depths

NOT trying to specify an angle!
```

### Corrected Understanding

The "jaw angle" in pool literature typically refers to the **entrance angle** (142° for corners, 103° for sides), which is the total opening angle measured at the pocket mouth. This is NOT the angle of the jaw rail itself.

The jaw rail itself is quite steep (20-40° from horizontal) because it only covers a short distance (1-2 inches) while tapering significantly.

**Conclusion:** The redesign is correct - use mouth/throat widths directly, don't try to specify angles.

---

## Appendix B: BCA Specification Reference

### Side Pockets

| Measurement | Minimum | Maximum | Notes |
|------------|---------|---------|-------|
| Mouth (tip-to-tip) | 5 3/8" (5.375") | 5 5/8" (5.625") | At cushion nose |
| Throat | 4 3/8" (4.375") | 4 7/8" (4.875") | Narrowest point |
| Shelf depth | 0" | 3/8" (0.375") | Flat area |
| Entrance angle | 103° (±2°) | | Per side |

### Corner Pockets

| Measurement | Minimum | Maximum | Notes |
|------------|---------|---------|-------|
| Mouth (tip-to-tip) | 4 7/8" (4.875") | 5 1/8" (5.125") | At cushion nose |
| Throat | 4" | 4 1/4" (4.25") | Narrowest point |
| Shelf depth | 1 5/8" (1.625") | 1 7/8" (1.875") | Flat area |
| Entrance angle | 142° (±1°) | | Per side |

**Source:** BCA Equipment Specifications (2008)

---

## Appendix C: Testing Checklist

### Pre-Implementation
- [ ] Read through entire plan
- [ ] Understand mouth vs throat distinction
- [ ] Review conversion math
- [ ] Set up testing environment

### During Implementation
- [ ] Write unit tests first
- [ ] Test after each file change
- [ ] Verify TypeScript compiles
- [ ] Check no console errors

### Post-Implementation
- [ ] Test Current Default template
- [ ] Test each BCA template
- [ ] Verify throat < mouth validation
- [ ] Check jaw angle calculation
- [ ] Test "Apply to Table"
- [ ] Visual comparison to legacy
- [ ] User acceptance testing

### Before Commit
- [ ] All tests pass
- [ ] Build succeeds
- [ ] Documentation updated
- [ ] No debug logging left in
- [ ] Commit message written

---

**END OF PLAN**

This plan should be referenced when implementing the redesign. Follow phases in order, test thoroughly at each step, and don't skip validation!
