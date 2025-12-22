---
name: banner-editor
description: Visual Banner Editor devtool for designing and previewing in-game full-width swipe banners
---

# Banner Editor Plan

A devtool for designing, previewing, and managing in-game full-width banner notifications with horizontal swipe animations. Based on the notification style from commit d73c206.

## Overview

The Banner Editor allows designers to:
- Create and preview banner styles in real-time
- Control entry/exit animations with easing curves
- Use custom images as banner backgrounds
- Define banner types (success, error, warning, info, epic, custom)
- Export/import banner presets
- Push changes live to the running game

---

## Features

### 1. Banner Types & Presets

| Type | Use Case | Default Style |
|------|----------|---------------|
| `success` | Win, achievement, unlock | Green gradient, gold accents |
| `error` | Foul, scratch, loss | Red gradient, warning icon |
| `warning` | Low time, last ball | Orange/amber gradient |
| `info` | Turn change, rules hint | Blue gradient |
| `epic` | Tournament win, streak | Purple/gold with particles |
| `custom` | User-defined | Fully configurable |

**Preset System:**
- Save/load banner presets to IndexedDB
- Import/export as JSON files
- Built-in default presets for common scenarios

### 2. Visual Styling

**Frame & Background:**
- Solid color, gradient (linear/radial), or image background
- Customizable frame border (width, color, gradient)
- Corner radius control
- Drop shadow (offset, blur, color, spread)
- Inner glow / outer glow effects

**Image Backgrounds:**
- Upload custom PNG/JPG/WebP images
- 9-slice scaling support for flexible sizing
- Tiling options (none, repeat, stretch, cover, contain)
- Overlay tint with opacity control
- Built-in texture library (leather, metal, wood, fabric)

**Typography:**
- Font family selection (from game fonts)
- Font size, weight, letter-spacing
- Text color with gradient support
- Text shadow / stroke
- Text alignment (left, center, right)
- Max lines with ellipsis

**Iconography:**
- Icon position (left, right, above, none)
- Icon size and color
- Custom icon upload or emoji picker
- Icon animation (pulse, bounce, spin, none)

### 3. Animation System

**Entry Animations:**
| Animation | Description |
|-----------|-------------|
| `slide-down` | Slides in from top |
| `slide-up` | Slides in from bottom |
| `slide-left` | Slides in from right |
| `slide-right` | Slides in from left |
| `fade` | Opacity fade in |
| `scale` | Scale up from center |
| `bounce` | Elastic bounce entry |
| `flip` | 3D flip rotation |

**Exit Animations:**
- Mirror of entry animations
- Independent timing control
- Optional "hold" duration before exit

**Easing Curves:**
- Preset easings: ease, ease-in, ease-out, ease-in-out, linear
- Cubic-bezier editor with visual curve preview
- Spring physics option (tension, friction, mass)

**Timing Controls:**
- Entry duration (ms)
- Hold duration (ms) - time visible before exit
- Exit duration (ms)
- Stagger delay for queued banners

**Advanced Effects:**
- Shimmer/shine sweep animation
- Particle burst on entry
- Screen shake on epic banners
- Blur/focus background during display

### 4. Layout & Positioning

**Position Presets:**
- `top` - Anchored to top center
- `center` - Centered on screen
- `bottom` - Anchored to bottom center
- `custom` - Manual X/Y positioning

**Size Modes:**
- `normal` - Standard banner (600px max)
- `large` - Epic/important (800px max)
- `fullwidth` - Edge-to-edge
- `compact` - Toast-style small

**Responsive Behavior:**
- Mobile breakpoint scaling
- Safe area insets (notch, home indicator)
- Landscape vs portrait adjustments

### 5. Preview & Testing

**Live Preview Panel:**
- Real-time canvas rendering of banner
- Device frame mockups (iPhone, Android, Desktop)
- Light/dark background toggle
- Grid overlay for alignment

**Test Controls:**
- "Show Banner" button - trigger single preview
- "Spam Test" - rapid-fire 10 banners to test queue
- "Sequence Test" - show success→error→info chain
- Message text input for custom preview text

**Animation Timeline:**
- Visual timeline scrubber
- Frame-by-frame stepping
- Loop toggle for animation refinement

### 6. Integration

**WebSocket Bridge:**
- Connect to running game via relay server
- Push config changes live (instant preview in-game)
- Pull current config from game
- Connection status indicator

**Export Options:**
- Export as JSON preset file
- Export as TypeScript constant
- Copy to clipboard
- Save to game's localStorage

**Storage Keys:**
- `RailRush_BannerEditor_Presets` - saved presets
- `RailRush_Notification_Config` - active game config

---

## Data Model

```typescript
interface BannerConfig {
  // Identity
  id: string;
  name: string;
  type: BannerType;

  // Layout
  position: 'top' | 'center' | 'bottom' | 'custom';
  customPosition?: { x: number; y: number };
  size: 'normal' | 'large' | 'fullwidth' | 'compact';
  width: number;      // max width in px
  height: number;     // height in px
  padding: number;    // inner padding

  // Background
  background: {
    type: 'solid' | 'gradient' | 'image';
    color?: string;
    gradient?: {
      type: 'linear' | 'radial';
      angle?: number;
      stops: Array<{ offset: number; color: string }>;
    };
    image?: {
      src: string;           // base64 or URL
      fit: 'cover' | 'contain' | 'stretch' | 'tile' | '9slice';
      sliceInsets?: { top: number; right: number; bottom: number; left: number };
      tint?: string;
      tintOpacity?: number;
    };
  };

  // Frame
  frame: {
    enabled: boolean;
    width: number;
    color: string;
    gradient?: { stops: Array<{ offset: number; color: string }> };
    radius: number;
  };

  // Shadow & Glow
  shadow: {
    enabled: boolean;
    offsetX: number;
    offsetY: number;
    blur: number;
    spread: number;
    color: string;
  };
  glow: {
    enabled: boolean;
    type: 'inner' | 'outer';
    blur: number;
    color: string;
  };

  // Typography
  text: {
    fontFamily: string;
    fontSize: number;
    fontWeight: number;
    color: string;
    gradient?: { stops: Array<{ offset: number; color: string }> };
    shadow?: { offsetX: number; offsetY: number; blur: number; color: string };
    stroke?: { width: number; color: string };
    align: 'left' | 'center' | 'right';
    letterSpacing: number;
    lineHeight: number;
    maxLines: number;
    transform: 'none' | 'uppercase' | 'lowercase' | 'capitalize';
  };

  // Icon
  icon: {
    enabled: boolean;
    position: 'left' | 'right' | 'above';
    src?: string;           // emoji, URL, or built-in key
    size: number;
    color?: string;
    animation: 'none' | 'pulse' | 'bounce' | 'spin';
  };

  // Animation
  animation: {
    entry: {
      type: AnimationType;
      duration: number;
      easing: string | { x1: number; y1: number; x2: number; y2: number };
      delay: number;
    };
    hold: number;
    exit: {
      type: AnimationType;
      duration: number;
      easing: string | { x1: number; y1: number; x2: number; y2: number };
    };
  };

  // Effects
  effects: {
    shimmer: boolean;
    shimmerSpeed: number;
    particles: boolean;
    particleConfig?: ParticleConfig;
    screenShake: boolean;
    shakeIntensity: number;
    backgroundBlur: boolean;
    blurAmount: number;
  };

  // Audio
  sound: {
    enabled: boolean;
    src: 'toast' | 'error' | 'epic' | 'custom' | 'none';
    customSrc?: string;
    volume: number;
  };
}

type BannerType = 'success' | 'error' | 'warning' | 'info' | 'epic' | 'custom';
type AnimationType = 'slide-down' | 'slide-up' | 'slide-left' | 'slide-right' 
                   | 'fade' | 'scale' | 'bounce' | 'flip' | 'none';
```

---

## File Structure

```
devtools/
├── banner-editor.html              # Entry point ✓
└── banner-editor/
    ├── main.ts                     # App bootstrap ✓
    ├── BannerEditorApp.ts          # Main orchestrator ✓
    ├── components/
    │   ├── PreviewCanvas.ts        # Live banner preview ✓
    │   ├── PresetBrowser.ts        # Preset list with save/load ✓
    │   ├── ImageUploader.ts        # Background image upload ✓
    │   ├── AnimationTimeline.ts    # Timeline scrubber (future)
    │   ├── EasingEditor.ts         # Bezier curve editor (future)
    │   └── ColorPicker.ts          # Color/gradient picker (future)
    ├── panels/
    │   ├── StylePanel.ts           # Background, frame, shadow, glow ✓
    │   ├── TextPanel.ts            # Typography + icon controls ✓
    │   ├── AnimationPanel.ts       # Entry/exit/timing/effects ✓
    │   └── ExportPanel.ts          # Export in header (BannerEditorApp)
    ├── stores/
    │   ├── BannerStore.ts          # Current config state ✓
    │   └── PresetStore.ts          # IndexedDB presets ✓
    ├── renderers/
    │   ├── BannerRenderer.ts       # Canvas drawing + animation + shimmer ✓
    │   └── AnimationEngine.ts      # (integrated in BannerRenderer)
    └── types.ts                    # TypeScript interfaces ✓
```

---

## Action Items

### Phase 1: Foundation
- [x] Create `devtools/banner-editor.html` entry point
- [x] Set up basic app structure with panels layout
- [x] Implement `BannerStore` with reactive state
- [x] Build `PreviewCanvas` with basic banner rendering
- [x] Add `WebSocketBridge` from notification-editor pattern *(embedded in BannerEditorApp)*

### Phase 2: Styling Controls
- [x] Implement `StylePanel` (background, frame, shadow)
- [~] Build `ColorPicker` with gradient support *(basic color inputs, no visual gradient editor)*
- [x] Add `ImageUploader` with preview *(drag/drop, tint overlay)*
- [x] Implement `TextPanel` (font, color, alignment)
- [~] Add `IconPanel` (emoji picker, custom upload) *(icon controls in TextPanel, basic emoji input)*

### Phase 3: Animation System
- [x] Implement `AnimationEngine` with all entry/exit types *(slide, fade, scale, bounce, flip)*
- [x] Build `AnimationPanel` with timing controls
- [x] Add easing selector *(linear, ease-in, ease-out, ease-in-out, ease-out-back)*
- [ ] Create `EasingEditor` (cubic-bezier visual editor) *(future enhancement)*
- [ ] Add `AnimationTimeline` scrubber component *(future enhancement)*
- [x] Implement shimmer effect *(particles and shake are future enhancements)*

### Phase 4: Presets & Persistence
- [x] Set up IndexedDB via `PresetStore`
- [x] Implement `PresetStore` (save/load/delete)
- [x] Build `PresetBrowser` (list view with built-in + custom presets)
- [x] Add import/export JSON functionality
- [x] Create default preset library *(Victory, Defeat, Epic, Warning, Info)*

### Phase 5: Integration
- [x] Wire WebSocket push to game
- [x] Update `NotificationService` to consume `BannerConfig`
- [x] Add `RemoteBridge` handlers for banner-editor
- [ ] Test live preview sync
- [x] Add to `vite.config.ts` build inputs

---

## UI Layout Sketch

```
┌─────────────────────────────────────────────────────────────────────┐
│  Banner Editor                                    [Connect] [Export] │
├──────────────────────┬──────────────────────────────────────────────┤
│                      │                                               │
│  PRESETS             │              LIVE PREVIEW                     │
│  ┌────────────────┐  │  ┌─────────────────────────────────────────┐  │
│  │ ▸ Success      │  │  │                                         │  │
│  │ ▸ Error        │  │  │        ┌───────────────────────┐        │  │
│  │ ▸ Warning      │  │  │        │  🏆  VICTORY!         │        │  │
│  │ ▸ Info         │  │  │        │                       │        │  │
│  │ ▸ Epic         │  │  │        └───────────────────────┘        │  │
│  │ ▸ Custom...    │  │  │                                         │  │
│  └────────────────┘  │  └─────────────────────────────────────────┘  │
│                      │  [ Show ] [ Spam Test ] [ Sequence ]          │
│  [+ New Preset]      │  ──────────●──────────────────────── 0:00.00  │
├──────────────────────┴──────────────────────────────────────────────┤
│  STYLE   TEXT   ICON   ANIMATION   EFFECTS   SOUND                  │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  Background:  ● Solid  ○ Gradient  ○ Image                          │
│  Color:       [████████] #1a5c1a                                    │
│  Frame:       [✓] Enabled   Width: [4]px   Radius: [12]px           │
│  Shadow:      [✓] Enabled   Blur: [12]px   Color: [████]            │
│                                                                      │
└─────────────────────────────────────────────────────────────────────┘
```

---

## Testing & Validation

- [x] Preview renders identically to in-game banner
- [x] All animation types play correctly *(slide, fade, scale, bounce, flip)*
- [x] Image backgrounds load and scale properly *(with tint overlay)*
- [x] Presets save/load/delete without data loss *(IndexedDB)*
- [x] WebSocket push updates game immediately
- [x] Export/import produces valid JSON
- [ ] Mobile preview scales correctly *(future)*

---

## Open Questions

- Should we support animated GIF/WebP backgrounds?
- Add audio waveform preview for custom sounds?
- Include a "record animation" feature for fine-tuning?
