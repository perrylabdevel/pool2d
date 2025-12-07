# Styling Inconsistencies Audit

Generated: November 2024

## Executive Summary

| Category | Count | Status |
|----------|-------|--------|
| Hardcoded Colors | 664 instances | 🔴 High Priority |
| Hardcoded Shadow Values | 95+ instances | 🔴 High Priority |
| Font Family Variations | 7 different families | 🟡 Medium Priority |
| LineWidth Variations | 6 different values | 🟡 Medium Priority |
| Missing Imports | 3 files | 🟢 Low Priority |

---

## 1. Hardcoded Colors by File

Files still using hardcoded `rgba()` or `#hex` values instead of `ColorTokens`:

| File | Hardcoded Count | Priority |
|------|-----------------|----------|
| `GoldenSpinScene.ts` | 52 | 🔴 High |
| `LeagueScene.ts` | 30 | 🔴 High |
| `EventsScene.ts` | 29 | 🔴 High |
| `OpponentPreviewScene.ts` | 24 | 🟡 Medium |
| `LobbyScene.ts` | 24 | 🟡 Medium |
| `ClubSelectionScene.ts` | 24 | 🟡 Medium |
| `SettingsScene.ts` | 21 | 🟡 Medium |
| `ShopScene.ts` | 19 | 🟢 Mostly Done |
| `PlayModesScene.ts` | 16 | 🟢 Mostly Done |
| `MatchResultScene.ts` | 14 | 🟡 Medium |
| `ProfileScene.ts` | 12 | 🟡 Medium |

### Common Hardcoded Patterns to Replace

```typescript
// ❌ Hardcoded
ctx.fillStyle = '#FFFFFF';
ctx.shadowColor = 'rgba(0, 0, 0, 0.8)';
ctx.strokeStyle = 'rgba(255, 255, 255, 0.2)';

// ✅ Use Constants
ctx.fillStyle = ColorTokens.text.primary;
ctx.shadowColor = ColorTokens.effects.shadowText;
ctx.strokeStyle = ColorTokens.border.subtle;
```

---

## 2. Shadow Blur Value Inconsistencies

Current shadow blur values used across the codebase:

| Value | Count | Should Be |
|-------|-------|-----------|
| 0 | 41 | (reset - OK) |
| 4 | 14 | `LayoutConstants.Shadows.Text.blur` |
| 20 | 8 | `LayoutConstants.Shadows.Medium.blur` |
| 15 | 7 | (non-standard) |
| 8 | 4 | `LayoutConstants.Shadows.Small.blur` |
| 12 | 4 | `LayoutConstants.Shadows.Glow.blur` |
| 6 | 3 | (non-standard) |
| 30 | 3 | (non-standard) |
| 28 | 2 | `LayoutConstants.Shadows.Large.blur` |

### Files with Most Shadow Inconsistencies

- `EventsScene.ts` - Uses 28, 20, 12, 6, 4
- `PlayModesScene.ts` - Uses 28, 20, 12, 6, 4  
- `SettingsScene.ts` - Uses 4, 3
- `ClubSelectionScene.ts` - Uses 20, 4

### Recommended Shadow Scale

```typescript
// Already defined in LayoutConstants.Shadows
Small.blur: 8    // Subtle drop shadows
Medium.blur: 20  // Standard shadows
Large.blur: 28   // Hover/emphasis shadows
Glow.blur: 12    // Glowing effects
Text.blur: 4     // Text shadows
```

---

## 3. Font Family Inconsistencies

### Current Usage (Inconsistent)

| Font | Usage Count | Used In |
|------|-------------|---------|
| `"Rajdhani"` | High | Cards, titles, badges |
| `"Montserrat"` | Medium | Headings, equipped text |
| `"Arial"` | Medium | Fallback, settings |
| `"Impact"` | Low | Dramatic titles |
| `"Inter"` | Low | Profile, League loading |
| `"sans-serif"` | Low | Generic fallback |
| `"Nunito"` | Low | Body text |

### Recommended Font Stack (LayoutConstants.Fonts.Family)

```typescript
// Use these consistently:
Game: '"Rajdhani", sans-serif'     // For game UI, cards, badges
Heading: '"Montserrat", Arial'      // For headings, titles
Body: '"Nunito", Arial'             // For descriptions, paragraphs
Display: '"Orbitron", Arial'        // For dramatic display text
Default: 'Arial'                     // Fallback
Monospace: 'monospace'              // For debug/code
```

### Files Needing Font Standardization

| File | Issue |
|------|-------|
| `SettingsScene.ts` | Uses `'bold 16px Arial'` 4 times |
| `ConfirmScene.ts` | Uses `'bold 24px Arial'`, `'16px Arial'` |
| `InGameMenuScene.ts` | Uses `'bold 56px Arial'`, `'14px Arial'` |
| `LeagueScene.ts` | Uses `'24px Inter'` |
| `ProfileScene.ts` | Uses `'24px Inter'` |
| `OpponentPreviewScene.ts` | Uses `'24px sans-serif'` |
| `MatchResultScene.ts` | Uses `'32px sans-serif'` |

---

## 4. LineWidth Inconsistencies

Current lineWidth values used:

| Value | Count | Semantic Meaning |
|-------|-------|------------------|
| 1 | Many | Thin borders |
| 1.5 | Few | (non-standard) |
| 1.6 | 1 | (non-standard) |
| 2 | Many | Normal borders |
| 3 | Few | Thick borders |
| 4 | Few | Heavy/hover borders |

### Recommended LineWidth Scale (LayoutConstants.Lines)

```typescript
Thin: 1      // Subtle borders, highlights
Normal: 2    // Standard strokes
Thick: 3     // Emphasis borders
Heavy: 4     // Hover states, strong emphasis
Rim: 3       // Button rims
Stroke: 2    // Default strokes
```

---

## 5. Missing Constant Imports

### Files Missing `LayoutConstants`

| File | Has ColorTokens | Has LayoutConstants |
|------|-----------------|---------------------|
| `ConfirmScene.ts` | ✅ | ❌ |
| `InGameMenuScene.ts` | ✅ | ❌ |
| `LobbyScene.ts` | ✅ | ❌ |

### Fix

```typescript
// Add to imports:
import { LayoutConstants } from '../theme/LayoutConstants';
```

---

## 6. Opacity Value Inconsistencies

Hardcoded opacity values found:

| Value | Usage | Should Be |
|-------|-------|-----------|
| 0.08 | Stripe patterns | `LayoutConstants.Opacity.DiagonalStripe` |
| 0.15 | Hover overlays | `LayoutConstants.Opacity.HoverOverlay` |
| 0.25 | Selected overlays | `LayoutConstants.Opacity.SelectedOverlay` |
| 0.4 | Disabled states | `LayoutConstants.Opacity.Disabled` |
| 0.5 | Muted elements | `LayoutConstants.Opacity.Muted` |

---

## 7. Radius Value Inconsistencies

Common hardcoded radius values:

| Value | Count | Should Be |
|-------|-------|-----------|
| 4 | Many | `LayoutConstants.Radii.Small` |
| 6 | Few | `LayoutConstants.Radii.Medium - 2` |
| 8 | Many | `LayoutConstants.Radii.Medium` |
| 12 | Few | `LayoutConstants.Radii.Large` |
| 16 | Few | `LayoutConstants.Radii.XLarge` |

---

## Migration Priority

### Phase 1: High Priority Files (Most Inconsistencies)
1. `GoldenSpinScene.ts` - 52 hardcoded colors (wheel rendering)
2. `LeagueScene.ts` - 30 hardcoded colors (league colors)
3. `EventsScene.ts` - 29 hardcoded colors (event cards)

### Phase 2: Medium Priority Files
4. `OpponentPreviewScene.ts` - 24 hardcoded
5. `LobbyScene.ts` - 24 hardcoded
6. `ClubSelectionScene.ts` - 24 hardcoded
7. `SettingsScene.ts` - 21 hardcoded
8. `MatchResultScene.ts` - 14 hardcoded
9. `ProfileScene.ts` - 12 hardcoded

### Phase 3: Cleanup
10. Add missing `LayoutConstants` imports
11. Standardize font families
12. Consolidate lineWidth values
13. Remove 1.5, 1.6 lineWidth anomalies

---

## Recommended ColorTokens Additions

Based on the audit, these tokens should be added if not present:

```typescript
// League colors (for LeagueScene)
league: {
  crystal: '#a3f0ff',
  emerald: '#2fa54a',
  elite: '#f26b1d',
  grandmaster: '#7f4cc5',
  master: '#d32f2f',
  diamond: '#66d4ff',
  platinum: '#7ac3ff',
  gold: '#d6a014',
  silver: '#8ea8c6',
  bronze: '#b06f2e',
},

// Event card colors
events: {
  blue: '#1a5490',
  green: '#2a7a4e',
  orange: '#d4651f',
},
```

---

## 8. Specific Hardcoded Color Violations

### `#FFFFFF` (White Text) - Should be `ColorTokens.text.primary`
```
EventsScene.ts:334, ClubSelectionScene.ts:258, ProfileScene.ts:229,
ProfileScene.ts:380, ProfileScene.ts:397, ProfileScene.ts:404,
ShopScene.ts:469, ShopScene.ts:503, GoldenSpinScene.ts:439,
GoldenSpinScene.ts:686, OpponentPreviewScene.ts:244,
OpponentPreviewScene.ts:314, LeagueScene.ts:215
```

### `#FFD700` (Gold) - Should be `ColorTokens.brand.primary`
```
GoldenSpinScene.ts:477, GoldenSpinScene.ts:514
```

### `#333`, `#444`, `#666` (Grays) - Need semantic tokens
```
ProfileScene.ts:321, ClubSelectionScene.ts:410, OpponentPreviewScene.ts:307
```

### `#0b101c` (Dark Navy) - Should be `ColorTokens.background.primary`
```
LeagueScene.ts:279
```

---

## 9. Gap/Spacing Inconsistencies

| Value | Files | Should Be |
|-------|-------|-----------|
| 15 | SettingsScene | `LayoutConstants.Spacing.GapSmall + 5` |
| 20 | Multiple | `LayoutConstants.Spacing.GapMedium` |
| 24 | LobbyScene | `LayoutConstants.Spacing.Large` |

---

## Verification Commands

```bash
# Count remaining hardcoded colors
grep -rn "rgba\|'#[0-9a-fA-F]" --include="*.ts" src/ui | wc -l

# Find files not using ColorTokens
grep -L "ColorTokens" src/ui/scenes/*.ts

# Find inconsistent shadow values
grep -rn "shadowBlur = [0-9]" --include="*.ts" src/ui
```

---

## Success Criteria

- [ ] All files import both `ColorTokens` and `LayoutConstants`
- [ ] Hardcoded color count < 50 (down from 664)
- [ ] Shadow values only use constants
- [ ] Font families standardized to `LayoutConstants.Fonts.Family`
- [ ] LineWidth values only 1, 2, 3, or 4
- [ ] All opacity values use `LayoutConstants.Opacity`
