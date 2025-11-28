# Hardcoded Values Audit

This document catalogs all hardcoded values found in the codebase that should be migrated to centralized constants.

## Summary

| Category | Count | Files Affected |
|----------|-------|----------------|
| Numeric Constants | 581+ | 60 files |
| Color Values | 362+ | 33 files |
| Font Strings | ~50 | 15 files |

## Centralized Constants Files

| File | Purpose |
|------|---------|
| `src/config.ts` | Physics, geometry, rendering config |
| `src/ui/theme/ColorTokens.ts` | All UI colors |
| `src/ui/theme/LayoutConstants.ts` | Dimensions, spacing, animations |

---

## Top Offender Files

### 1. `src/ui/scenes/ShopScene.ts` (35 numeric, 30 colors)

#### Layout Values → `LayoutConstants`
| Line | Current | Suggested Replacement |
|------|---------|----------------------|
| 116 | `cardWidth = 240` | `LayoutConstants.Cards.Width` |
| 117 | `cardHeight = 320` | `LayoutConstants.Cards.Height` |
| 118 | `gap = 28` | `LayoutConstants.Cards.Gap` |
| 120 | `tabWidth = 100` | `LayoutConstants.Tabs.Width` |
| 121 | `tabHeight = 40` | `LayoutConstants.Tabs.Height` |
| 122 | `tabY = navHeight + 30` | `navHeight + LayoutConstants.Tabs.OffsetY` |
| 333 | `frameWidth = 6` | `LayoutConstants.Cards.FrameWidth` |
| 334 | `bevelWidth = 3` | `LayoutConstants.Cards.BevelWidth` |
| 335 | `borderWidth = 2` | `LayoutConstants.Cards.BorderWidth` |
| 435 | `chipSize = 120` | `LayoutConstants.Chips.Medium` |
| 586 | `cornerSize = 20` | `LayoutConstants.Cards.CornerAccentSize` |

#### Shadow Values → `LayoutConstants.Shadows`
| Line | Current | Suggested Replacement |
|------|---------|----------------------|
| 342 | `shadowBlur = 28` | `LayoutConstants.Shadows.Large.blur` |
| 343 | `shadowOffsetY = 14` | `LayoutConstants.Shadows.Large.offsetY` |
| 346 | `shadowBlur = 20` | `LayoutConstants.Shadows.Medium.blur` |
| 347 | `shadowOffsetY = 10` | `LayoutConstants.Shadows.Medium.offsetY` |

#### Colors → `ColorTokens`
| Line | Current | Suggested Replacement |
|------|---------|----------------------|
| 298 | `'rgba(255, 255, 255, 0.1)'` | `ColorTokens.border.default` |
| 303 | `'#000000'` | `ColorTokens.text.dark` |
| 303 | `'#FFFFFF'` | `ColorTokens.text.primary` |
| 341 | `'rgba(0, 0, 0, 0.6)'` | `ColorTokens.effects.shadowHeavy` |
| 345 | `'rgba(0, 0, 0, 0.4)'` | `ColorTokens.effects.shadowLight` |
| 353 | `'#8B7355'` | `ColorTokens.card.frame.light` |
| 354 | `'#6B5745'` | `ColorTokens.card.frame.mid` |
| 355 | `'#4B3725'` | `ColorTokens.card.frame.dark` |
| 361 | `'rgba(255, 255, 255, 0.4)'` | `ColorTokens.effects.gloss.start` |
| 362 | `'rgba(255, 255, 255, 0.1)'` | `ColorTokens.effects.gloss.mid` |
| 363 | `'rgba(255, 255, 255, 0)'` | `ColorTokens.effects.gloss.none` |
| 381 | `'#3a3a3a'` | `ColorTokens.card.bevel.top` |
| 382 | `'#2a2a2a'` | `ColorTokens.card.bevel.mid` |
| 383 | `'#4a4a4a'` | `ColorTokens.card.bevel.bottom` |
| 389 | `'rgba(255, 255, 255, 0.15)'` | `ColorTokens.border.emphasis` |
| 548 | `'rgba(0, 0, 0, 0.7)'` | `ColorTokens.background.overlayHeavy` |
| 588 | `'rgba(255, 215, 0, 0.6)'` | `ColorTokens.card.cornerAccent` |

#### Notification Durations → `LayoutConstants.Animation`
| Line | Current | Suggested Replacement |
|------|---------|----------------------|
| 223 | `2400` | `LayoutConstants.Animation.Notification.Toast` |
| 230 | `2400` | `LayoutConstants.Animation.Notification.Toast` |
| 267 | `2400` | `LayoutConstants.Animation.Notification.Toast` |

---

### 2. `src/ui/scenes/GoldenSpinScene.ts` (21 numeric, 35 colors)

#### Layout Values → `LayoutConstants`
| Line | Current | Suggested Replacement |
|------|---------|----------------------|
| 36 | `wheelRadius = 220` | `LayoutConstants.Wheel.Radius` |

#### Wheel Prize Colors → `ColorTokens.wheel`
| Line | Current | Suggested Replacement |
|------|---------|----------------------|
| 41 | `'#4A90E2'` | `ColorTokens.wheel.blue` |
| 42 | `'#50E3C2'` | `ColorTokens.wheel.teal` |
| 43 | `'#B8E986'` | `ColorTokens.wheel.green` |
| 44 | `'#BD10E0'` | `ColorTokens.wheel.purple` |
| 45 | `'#9013FE'` | `ColorTokens.wheel.violet` |
| 46 | `'#F5A623'` | `ColorTokens.wheel.orange` |
| 47 | `'#4A4A4A'` | `ColorTokens.wheel.gray` |
| 48 | `'#F8E71C'` | `ColorTokens.wheel.yellow` |
| 49 | `'#D0021B'` | `ColorTokens.wheel.red` |
| 50 | `'#000000'` | `ColorTokens.wheel.black` |
| 51 | `'#8B572A'` | `ColorTokens.wheel.brown` |
| 52 | `'#FFD700'` | `ColorTokens.wheel.gold` |

---

### 3. `src/render/Renderer.ts` (46 numeric, 21 colors)

#### Layout Values → `LayoutConstants` or `CONFIG`
| Line | Current | Suggested Replacement |
|------|---------|----------------------|
| 59 | `externalMargin = 40` | `LayoutConstants.Spacing.ExternalMargin` |
| 64 | `internalPadding = Math.max(40, ...)` | `LayoutConstants.Spacing.InternalPadding` |
| 141 | `120` (felt texture count) | `CONFIG.FELT_TEXTURE_DENSITY` (new) |
| 144 | `0.4, 0.4` (texture size) | `CONFIG.FELT_TEXTURE_SIZE` (new) |

#### Colors → `ColorTokens`
| Line | Current | Suggested Replacement |
|------|---------|----------------------|
| 88 | `'#0a0a0a'` | `ColorTokens.background.canvas` |

---

### 4. `src/ui/components/UIComponents.ts` (20 numeric, 23 colors)

#### Shadow Values → `LayoutConstants.Shadows`
| Line | Current | Suggested Replacement |
|------|---------|----------------------|
| 47 | `shadowBlur = 8` | `LayoutConstants.Shadows.Small.blur` |
| 48 | `shadowOffsetY = 6` | `LayoutConstants.Shadows.Small.offsetY` |

#### Border/Line Values → `LayoutConstants.Lines`
| Line | Current | Suggested Replacement |
|------|---------|----------------------|
| 59 | `rimWidth = 3` | `LayoutConstants.Lines.Rim` |
| 102 | `lineWidth = 2` | `LayoutConstants.Lines.Normal` |
| 122 | `lineWidth = 3` | `LayoutConstants.Lines.Thick` |

#### Colors → `ColorTokens`
| Line | Current | Suggested Replacement |
|------|---------|----------------------|
| 46 | `'rgba(0, 0, 0, 0.6)'` | `ColorTokens.effects.shadowHeavy` |
| 61 | `'#ffffff'` | `ColorTokens.metallic.light` |
| 62 | `'#888888'` | `ColorTokens.metallic.mid` |
| 63 | `'#444444'` | `ColorTokens.metallic.dark` |
| 97 | `'rgba(255, 255, 255, 0.9)'` | `ColorTokens.effects.innerHighlight.start` |
| 98 | `'rgba(255, 255, 255, 0.1)'` | `ColorTokens.effects.innerHighlight.mid` |
| 99 | `'rgba(0, 0, 0, 0.4)'` | `ColorTokens.effects.innerHighlight.end` |
| 108 | `'rgba(255, 255, 255, 0.5)'` | `ColorTokens.effects.gloss.start` |
| 109 | `'rgba(255, 255, 255, 0.05)'` | `ColorTokens.effects.gloss.end` |
| 123 | `'rgba(0, 0, 0, 0.8)'` | `ColorTokens.effects.shadowText` |
| 185 | `'rgba(20, 30, 50, 0.8)'` | `ColorTokens.background.nav.gradientStart` |
| 186 | `'rgba(10, 20, 40, 0.9)'` | `ColorTokens.background.nav.gradientEnd` |
| 193 | `'rgba(255, 255, 255, 0.15)'` | `ColorTokens.border.emphasis` |
| 201 | `'rgba(255, 255, 255, 0.1)'` | `ColorTokens.border.default` |
| 275 | `'#4CAF50'` | `ColorTokens.action.success` |
| 276 | `'#388E3C'` | `ColorTokens.action.successDark` |
| 431 | `'#FFEC8B'` | `ColorTokens.coin.lightGold` |
| 432 | `'#DAA520'` | `ColorTokens.coin.goldenRod` |
| 433 | `'#B8860B'` | `ColorTokens.coin.darkGold` |
| 443 | `'#FFD700'` | `ColorTokens.coin.gold` |
| 444 | `'#FFA500'` | `ColorTokens.coin.orangeGold` |

---

### 5. `src/render/components/CueRenderer.ts` (24 numeric, 12 colors)

#### Cue Values → `LayoutConstants.Cue` or `CONFIG`
| Line | Current | Suggested Replacement |
|------|---------|----------------------|
| 62 | `ball.radius + 2` | `ball.radius + LayoutConstants.Cue.PullbackBase` |
| 62 | `* 3` (power pullback) | `* LayoutConstants.Cue.PullbackMax` |
| 78 | `cueThicknessInches = 1.0` | `LayoutConstants.Cue.ThicknessInches` |
| 82 | `tipLengthInches = 0.4` | `LayoutConstants.Cue.TipLengthInches` |
| 99 | `Math.max(4, ...)` | `Math.max(LayoutConstants.Cue.MinThicknessPixels, ...)` |

#### Colors → `ColorTokens`
| Line | Current | Suggested Replacement |
|------|---------|----------------------|
| 17 | `'rgba(255, 255, 255, 0.15)'` | `ColorTokens.border.emphasis` |
| 95 | `'#8B4513'` | `ColorTokens.cue.defaultStick` |
| 96 | `'#4A90E2'` | `ColorTokens.cue.defaultTip` |

---

### 6. `src/ui/NotificationService.ts` (16 numeric, 18 colors)

#### Animation Durations → `LayoutConstants.Animation.Notification`
| Line | Current | Suggested Replacement |
|------|---------|----------------------|
| 72 | `enterDuration = 600` | `LayoutConstants.Animation.Notification.Enter` |
| 73 | `activeDuration = 3000` | `LayoutConstants.Animation.Notification.Active` |
| 74 | `exitDuration = 400` | `LayoutConstants.Animation.Notification.Exit` |

---

### 7. `src/render/components/TableRenderer.ts` (45 numeric, 9 colors)

Most values in this file are physics/geometry related and should stay in `CONFIG` or be derived from geometry. However, some rendering constants could be consolidated.

---

## Files by Priority

### High Priority (>30 hardcoded values)
1. `ShopScene.ts` - 65 total
2. `Renderer.ts` - 67 total
3. `GoldenSpinScene.ts` - 56 total
4. `TableRenderer.ts` - 54 total
5. `UIComponents.ts` - 43 total

### Medium Priority (15-30 values)
6. `CueRenderer.ts` - 36 total
7. `LeagueScene.ts` - 40 total
8. `PlayModesScene.ts` - 37 total
9. `SettingsScene.ts` - 23 total
10. `NotificationService.ts` - 34 total

### Lower Priority (<15 values)
- Various scene files with similar patterns

---

## Migration Checklist

- [x] `ShopScene.ts` - Replace card dimensions, colors, shadows (65→11)
- [x] `GoldenSpinScene.ts` - Replace wheel colors, radius (52→7)
- [x] `Renderer.ts` - Replace canvas background, margins
- [x] `UIComponents.ts` - Replace button shadows, metallic colors
- [x] `CueRenderer.ts` - Replace cue dimensions, colors
- [x] `NotificationService.ts` - Replace animation durations
- [x] `PlayModesScene.ts` - Replace card frame, shadows, badges (38→4)
- [x] `EventsScene.ts` - Replace card frame, buttons, badges (29→5)
- [x] `LeagueScene.ts` - Replace header, standings styling (30→10)
- [x] `LobbyScene.ts` - Replace frame, bevel, shadows, hover (24→1)
- [x] `OpponentPreviewScene.ts` - Replace card, avatar, stats styling (24→10)
- [x] `ClubSelectionScene.ts` - Replace frame, text, buttons (24→0) ✅ COMPLETE
- [x] `MatchResultScene.ts` - Replace card, buttons, stats (14→2)
- [x] `ProfileScene.ts` - Replace loading, stats, achievements (12→0) ✅ COMPLETE
- [x] `SettingsScene.ts` - Replace control backgrounds, shadows (21→1)
- [x] `ConfirmScene.ts` - Minimal (1 remaining)
- [x] `InGameMenuScene.ts` - Minimal (1 remaining)

---

## How to Use Constants

### Before (hardcoded)
```typescript
const cardWidth = 240;
const cardHeight = 320;
ctx.shadowBlur = 28;
ctx.fillStyle = '#8B7355';
```

### After (centralized)
```typescript
import { LayoutConstants } from '@/ui/theme/LayoutConstants';
import { ColorTokens } from '@/ui/theme/ColorTokens';

const cardWidth = LayoutConstants.Cards.Width;
const cardHeight = LayoutConstants.Cards.Height;
ctx.shadowBlur = LayoutConstants.Shadows.Large.blur;
ctx.fillStyle = ColorTokens.card.frame.light;
```

---

## Notes

1. **Don't over-centralize**: Some values are genuinely one-off and don't need to be in constants
2. **Semantic naming**: Use descriptive names that indicate purpose, not just the value
3. **Gradual migration**: Migrate file-by-file, testing as you go
4. **Type safety**: TypeScript will catch any mistyped constant paths
