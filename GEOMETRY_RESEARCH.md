# Pool Table Geometry Research

## Real Table Specifications

### BCA (Billiard Congress of America) Tournament Standards

#### Pocket Opening Dimensions

**Corner Pockets:**
- Mouth: 4 7/8" (4.875") minimum to 5 1/8" (5.125") maximum
- Throat: 4" minimum to 4 1/4" (4.25") maximum
- Shelf depth: 1 5/8" (1.625") minimum to 1 7/8" (1.875") maximum
- Entrance angle: 142° (±1°) on each side

**Side Pockets:**
- Mouth: 5 3/8" (5.375") minimum to 5 5/8" (5.625") maximum
- Throat: 4 3/8" (4.375") minimum to 4 7/8" (4.875") maximum
- Shelf depth: 0" minimum to 3/8" (0.375") maximum
- Entrance angle: 103° (±2°) on each side

#### Additional Specifications

- **Vertical pocket angle:** 12° minimum to 15° maximum
- **Drop point slate radius:** 1/8" minimum to 1/4" maximum
- **Pocket facings:** Rubber, 1/16" to 1/4" thick (WPA prefers max 1/8")

---

### Brunswick Gold Crown VI Tournament Edition

**Specifications:**
- Corner pockets: 4.5" to 4.625"
- Side pockets: 5.0" to 5.125"
- 9-foot model: 64.8" x 114.6" overall, 50" x 100" play area
- 8-foot model: 58.8" x 102.6" overall, 44" x 88" play area

**Characteristics:**
- Tighter pockets than standard models
- Engineered to World Pool-Billiard Association specs
- Longer rails create more challenging play

---

### Valley Tables (Bar/Coin-Op)

**Typical Specifications:**
- Corner pocket mouth: 4 5/8" to 4 3/4" (4.625" - 4.75")
- Designed to "swallow" balls easily
- Slightly looser than tournament specs

**Common Models:**
- Valley Panther ZD-4 (4x8)
- Valley Cougar ZD-7 (3.5x7)

---

### Diamond Tables

**Pro-Am 9' Tournament Spec:**
- Corner: 4.5" ±0.125"
- Side: 4.0" ±0.125" (very tight for tournament play)
- Shallow shelf depth

**Smart Table 7' Bar Spec:**
- Corner: 5.0"
- Side: 4.75"
- Deeper pockets (more forgiving)

---

## Derived Jaw Angle Calculations

### Understanding the Geometry

The BCA "entrance angle" (142° corner, 103° side) is the **total pocket opening angle** measured at the cushion noses. To calculate the **jaw angle** (angle between jaw and straight rail), we need to consider:

1. **Mouth width** - Opening at cushion nose
2. **Throat width** - Narrowest opening
3. **Pocket depth** - Distance from mouth to throat

### Estimated Jaw Angles

Based on typical pool table geometry and the relationship between mouth, throat, and depth:

**Corner Pockets:**
- Jaw angle: **4° to 6°** (typical: 5°)
- Tighter tournament tables: 4° to 4.5°
- Looser bar tables: 5.5° to 6°

**Side Pockets:**
- Jaw angle: **5° to 7°** (typical: 6°)
- Tighter tournament tables: 5° to 5.5°
- Looser bar tables: 6.5° to 7°

### Calculation Example

For a corner pocket with:
- Mouth: 5.0"
- Throat: 4.125"
- Depth: 2.0"

```
Pocket taper = (Mouth - Throat) / 2 = (5.0 - 4.125) / 2 = 0.4375"
Jaw angle = atan(taper / depth) = atan(0.4375 / 2.0) = 12.3°
```

**Note:** This gives the angle of the pocket facing/liner, not the cushion rail angle. The cushion jaw angle is typically **much smaller** (3-7°) and represents the angle where the straight rail transitions into the pocket curve.

---

## Template Specifications

### Recommended Templates for Implementation

#### 1. BCA Tournament - Tight (Default)
```typescript
{
  name: "BCA Tournament - Tight",
  description: "Challenging tournament specification",
  corner: {
    opening: 4.5,      // inches
    jawAngle: 4.5,     // degrees
    depth: 1.75,       // inches
    shelfDepth: 1.625  // inches
  },
  side: {
    opening: 5.0,
    jawAngle: 5.5,
    depth: 0.25,
    shelfDepth: 0.25
  }
}
```

#### 2. BCA Tournament - Medium
```typescript
{
  name: "BCA Tournament - Medium",
  description: "Standard tournament specification",
  corner: {
    opening: 4.75,
    jawAngle: 5.0,
    depth: 1.75,
    shelfDepth: 1.75
  },
  side: {
    opening: 5.25,
    jawAngle: 6.0,
    depth: 0.3,
    shelfDepth: 0.3
  }
}
```

#### 3. BCA Tournament - Loose
```typescript
{
  name: "BCA Tournament - Loose",
  description: "Forgiving tournament specification",
  corner: {
    opening: 5.0,
    jawAngle: 5.5,
    depth: 1.875,
    shelfDepth: 1.875
  },
  side: {
    opening: 5.5,
    jawAngle: 6.5,
    depth: 0.375,
    shelfDepth: 0.375
  }
}
```

#### 4. Brunswick Gold Crown VI
```typescript
{
  name: "Brunswick Gold Crown VI",
  description: "Professional tournament table",
  corner: {
    opening: 4.5625,  // 4 9/16"
    jawAngle: 4.5,
    depth: 1.75,
    shelfDepth: 1.7
  },
  side: {
    opening: 5.0625,  // 5 1/16"
    jawAngle: 5.5,
    depth: 0.25,
    shelfDepth: 0.25
  }
}
```

#### 5. Valley Bar Table - Medium
```typescript
{
  name: "Valley Bar Table",
  description: "Typical coin-op bar table",
  corner: {
    opening: 4.6875,  // 4 11/16"
    jawAngle: 5.5,
    depth: 2.0,
    shelfDepth: 2.0
  },
  side: {
    opening: 5.375,   // 5 3/8"
    jawAngle: 6.5,
    depth: 0.375,
    shelfDepth: 0.375
  }
}
```

#### 6. Diamond Pro-Am 9'
```typescript
{
  name: "Diamond Pro-Am 9'",
  description: "Professional 9-ball specification",
  corner: {
    opening: 4.5,
    jawAngle: 4.0,    // Very tight
    depth: 1.5,
    shelfDepth: 1.5
  },
  side: {
    opening: 4.0,     // Extremely tight
    jawAngle: 5.0,
    depth: 0.25,
    shelfDepth: 0.25
  }
}
```

---

## Key Insights for Implementation

### 1. Jaw Angle vs. Entrance Angle
- **Entrance angle** (BCA spec): Total opening angle at pocket mouth (142°, 103°)
- **Jaw angle** (what we need): Angle between straight rail and jaw rail (3-7°)
- These are different measurements; jaw angle is much smaller

### 2. Pocket Tightness Factors
- **Opening width** - Primary difficulty factor
- **Jaw angle** - Secondary factor (steeper = harder)
- **Shelf depth** - Affects ball capture

### 3. Typical Ranges
- Corner openings: 4.5" (very tight) to 5.125" (loose)
- Side openings: 4.0" (very tight) to 5.625" (loose)
- Jaw angles: 3° (gentle) to 7° (steep)

### 4. Tournament vs. Bar Tables
- **Tournament:** Tighter pockets, shallower angles, consistent specs
- **Bar:** Looser pockets, more forgiving, wider tolerances

---

## Implementation Notes

### Jaw Angle Reasonable Ranges
```typescript
interface JawAngleRanges {
  corner: {
    min: 3.0,   // Very gentle (forgiving)
    max: 7.0,   // Very steep (challenging)
    typical: 5.0
  },
  side: {
    min: 4.0,
    max: 8.0,
    typical: 6.0
  }
}
```

### Opening Width Reasonable Ranges
```typescript
interface OpeningRanges {
  corner: {
    min: 4.0,   // Extremely tight
    max: 5.5,   // Very loose
    typical: 4.75
  },
  side: {
    min: 4.0,   // Extremely tight
    max: 6.0,   // Very loose
    typical: 5.25
  }
}
```

### Depth Reasonable Ranges
```typescript
interface DepthRanges {
  corner: {
    min: 1.0,
    max: 2.5,
    typical: 1.75
  },
  side: {
    min: 0.0,   // Minimal shelf
    max: 0.5,
    typical: 0.25
  }
}
```

---

## References

- BCA Equipment Specifications (2008)
- WPA Tournament Table Specifications
- Brunswick Gold Crown VI Technical Specs
- Valley Pool Table Documentation
- Dr. Dave Billiards Research (drdavepoolinfo.com)
- AzBilliards Forum Community Data
