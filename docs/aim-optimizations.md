# Aim Line Optimization Ideas

This document tracks potential improvements to the aim assist system for better shot precision.

## Status
- ✅ Basic aim line with contact point prediction
- ✅ Ghost ball visualization
- ✅ Post-collision trajectory arrows
- ✅ Mouse sensitivity toggle (fine aim via Shift)
- ✅ Arrow key progressive micro-aim (normal/fine/ultra)
- ✅ Simulated first-contact preview with fallback extension
- 📋 Planned optimizations below

## Implemented Features

### Current System
- Dashed aim line from cue ball to contact point (src/render/Renderer.ts:343-358)
- Ghost ball at ball contact points (src/render/Renderer.ts:361-375)
- Trajectory arrows for post-collision paths (src/render/Renderer.ts:385-483)
- Aim line stops at first contact (ball or rail)

## Implemented Features (Recent)

### Mouse Sensitivity Toggle
**Status**: ✅ Implemented
**Key**: Shift (hold for fine aim mode)
**Effect**: Reduces mouse sensitivity to 20% (5x slower) for precise adjustments
**Visual**: Cyan "FINE AIM" indicator shown when active

### Progressive Arrow Key Micro-Aim
**Status**: ✅ Implemented
**Keys**: Arrow keys (←→) to rotate aim angle with progressive precision
**Increments**:
- **Normal**: 0.5° per press (quick adjustments)
- **Fine (+ Shift)**: 0.1° per press (detailed adjustments)
- **Ultra-Fine (+ Shift + Ctrl)**: 0.02° per press (pixel-perfect precision)

**Visual Feedback**:
- Normal mode: Shows available modifier keys
- Fine mode (Cyan): "FINE AIM" with "0.1°/press"
- Ultra-Fine mode (Magenta): "ULTRA FINE" with "0.02°/press"

### Simulated First-Contact Trajectory Preview
**Status**: ✅ Implemented
**Details**:
- Aim overlays now come from a short sandbox simulation that mirrors the real physics step-for-step.
- The preview records the exact first contact (ball or rail) and shares it with both the renderer and shot-capture reports.
- When the object ball barely moves (tap shots, grazes), the system synthesizes a short extension along the contact normal so the helper line remains visible.
- Power-mode locking reuses the cached simulation so dragging power no longer jitters the prediction.

## Planned Optimizations

### 1. Fine-Tuning Visual Feedback
**Priority**: High
**Complexity**: Low

- **Graduated line thickness**: Thicker near cue ball, thinner at end to show precision falloff
- **Color-coded power indicator**: Change aim line color based on power level
  - Green: 0-30% power (soft touch)
  - Yellow: 30-70% power (medium)
  - Red: 70-100% power (hard shot)
- **Contact point marker**: Bright circle/dot exactly where cue ball makes contact
  - Could pulse or glow for better visibility
- **Line opacity**: Adjust based on confidence/accuracy of prediction

### 2. Enhanced Prediction
**Priority**: Medium
**Complexity**: Medium-High

- **Multi-bounce prediction**: Show 2-3 rail bounces instead of just first contact
  - Each bounce shown with progressively more transparency
  - Stop prediction at first ball contact
- **Fade trajectory lines**: Make arrows fade with distance
  - Alpha decreases: `alpha = 1.0 - (distance / maxDistance) * 0.5`
- **Cut angle indicator**: Visual representation of cut thickness
  - Thin cut: small arc/wedge at ghost ball
  - Full hit: larger arc/wedge
  - Could show percentage: "75% hit" or "25% cut"
- **Probability cone**: Show slight spread for imperfect shots at high power

### 3. Aim Precision Tools
**Priority**: High
**Complexity**: Low-Medium

- **Grid overlay**: Optional fine grid for micro-adjustments
  - Key: 'G' to toggle
  - Radial or Cartesian grid centered on cue ball
  - 1-inch or 0.5-inch spacing
- **Angle readout**: Display exact angle in HUD during aim mode
  - Format: "Angle: 45.3°"
  - Position: Near power bar or top corner
- **Distance to target**: Show distance to object ball
  - Format: "Distance: 32.5 in"
  - Helps judge power needed
- **Aim magnification**: Zoom in around cue ball during aim mode
  - Subtle zoom: 1.2x - 1.5x scale
  - Smooth transition in/out
  - Toggle with 'Z' key

### 4. Advanced Aim Assist
**Priority**: Low
**Complexity**: Medium

- **Snap to ball centers**: Hold key to snap to direct shots
  - Key: 'Tab' (hold)
  - Snaps when within 2° of ball center
  - Visual indicator when snap is active
- **Pocket guides**: Show lines from object balls to pockets
  - Toggle with 'P' key
  - Only show for nearest 3 balls
  - Faint lines (low opacity)
- **English preview**: When spin is added (future feature)
  - Show curve in cue ball path
  - Adjust ghost ball position for throw effect

### 5. Configuration Additions
**File**: src/config.ts

```typescript
// Aim assistance
AIM_MOUSE_SENSITIVITY_NORMAL: 1.0,
AIM_MOUSE_SENSITIVITY_FINE: 0.2,      // 5x slower for precise aim
AIM_ARROW_KEY_INCREMENT: 0.5,          // Degrees per arrow key press
AIM_FINE_MODE_KEY: 'Shift',            // Hold for fine aim
AIM_SNAP_TO_BALL_THRESHOLD: 2.0,      // Degrees within to snap
AIM_GRID_SPACING: 1.0,                 // Inches between grid lines
AIM_ZOOM_SCALE: 1.3,                   // Magnification in zoom mode

// Visual enhancements
SHOW_CUT_ANGLE_INDICATOR: true,
SHOW_DISTANCE_READOUT: true,
SHOW_ANGLE_READOUT: true,
AIM_LINE_COLOR_BY_POWER: true,
CONTACT_POINT_MARKER_SIZE: 0.4,        // Inches radius

// Prediction
PREDICT_BOUNCES: 2,                    // Number of rail bounces to show
TRAJECTORY_FADE_DISTANCE: 30,          // Inches over which to fade
```

## Implementation Notes

### Mouse Sensitivity Toggle
- Capture Shift key state in input handler
- Apply sensitivity multiplier to mouse delta before updating angle
- Show indicator in HUD when fine mode is active

### Arrow Key Micro-Aim
- Listen for arrow key events when in aim mode
- Convert degree increment to radians: `angleAdjust = (increment * Math.PI) / 180`
- Update cue angle: `angle += angleAdjust` (right arrow = clockwise)
- Prevent key repeat from being too fast (debounce or rate limit)

### Graduated Line Thickness
- Draw aim line in segments with varying `lineWidth`
- Near cue ball: `lineWidth = 0.15`
- At contact point: `lineWidth = 0.05`
- Use `ctx.lineWidth = startWidth + (endWidth - startWidth) * (i / segments)`

### Color-Coded Power
- Calculate power percentage: `powerPct = power / CONFIG.CUE_POWER_MAX`
- Interpolate between colors:
  - 0-0.3: green → yellow
  - 0.3-0.7: yellow
  - 0.7-1.0: yellow → red
- Use HSL color space for smooth transitions

### Multi-Bounce Prediction
- Extend Predictor class with `predictMultipleBounces()`
- After first rail hit, cast new ray from contact point in reflection direction
- Recursively predict up to N bounces
- Store each bounce segment for rendering
- Draw with decreasing opacity: `alpha = 0.6 / (bounceIndex + 1)`

## Testing Checklist

- [ ] Fine aim mode reduces sensitivity noticeably
- [ ] Arrow keys work smoothly without lag
- [ ] Angle adjustments are precise (0.5° increments)
- [ ] Visual indicators show when fine mode is active
- [ ] All aim features work in both 2D and 3D modes
- [ ] Performance remains smooth (60 FPS) with all features enabled
- [ ] Settings persist across sessions

## Future Considerations

- **Training mode**: Show "perfect angle" for pot shots
- **Shot history**: Overlay previous shot attempts
- **Difficulty levels**: Reduce aim assist for challenge mode
- **VR support**: Aim with head/hand tracking
