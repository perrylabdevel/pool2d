# Progressive Aim Precision System

## Overview
The progressive aim precision system allows players to dial in shots with increasing fidelity as they get closer to the perfect angle. The system provides three levels of precision, each with smaller increment steps.

## Precision Levels

### Level 1: Normal (Quick Adjustments)
- **Activation**: Arrow keys (← →) without modifiers
- **Increment**: 0.5° per key press
- **Use Case**: Rough positioning, fast angle changes
- **Visual**: Shows available modifier options
  - "← → arrows (0.5°)"
  - "+ Shift (0.1°)"
  - "+ Shift+Ctrl (0.02°)"

### Level 2: Fine (Detailed Adjustments)
- **Activation**: Hold **Shift** + Arrow keys (← →)
- **Increment**: 0.1° per key press (5x more precise)
- **Use Case**: Precise angle refinement for medium-difficulty shots
- **Visual**: Cyan "FINE AIM" indicator
  - "FINE AIM"
  - "0.1°/press"
- **Mouse Effect**: Also reduces mouse sensitivity to 20% when Shift is held

### Level 3: Ultra-Fine (Pixel-Perfect Precision)
- **Activation**: Hold **Shift + Ctrl** + Arrow keys (← →)
- **Increment**: 0.02° per key press (25x more precise than normal)
- **Use Case**: Extremely tight shots, threading needles, perfect pocket angle
- **Visual**: Magenta "ULTRA FINE" indicator
  - "ULTRA FINE"
  - "0.02°/press"

## Configuration

All precision values are configurable in `src/config.ts`:

```typescript
// Aim assistance
AIM_MOUSE_SENSITIVITY_NORMAL: 1.0,
AIM_MOUSE_SENSITIVITY_FINE: 0.2,        // 5x slower for precise aim
AIM_ARROW_KEY_INCREMENT_BASE: 0.5,      // Degrees per arrow key press
AIM_ARROW_KEY_INCREMENT_FINE: 0.1,      // Fine degrees when holding Shift
AIM_ARROW_KEY_INCREMENT_ULTRA: 0.02,    // Ultra-fine when holding Shift + Ctrl
AIM_FINE_MODE_KEY: 'Shift',
```

## Implementation Details

### Key Tracking
- **Game.ts**: Tracks Ctrl key state (`isCtrlPressed`)
- **InputManager.ts**: Tracks Shift key state (`isFineAimMode`) and combines with Ctrl for ultra-fine (`isUltraFineMode`)

### Increment Selection Logic
```typescript
if (e.shiftKey && e.ctrlKey) {
  increment = CONFIG.AIM_ARROW_KEY_INCREMENT_ULTRA;  // 0.02°
} else if (e.shiftKey) {
  increment = CONFIG.AIM_ARROW_KEY_INCREMENT_FINE;   // 0.1°
} else {
  increment = CONFIG.AIM_ARROW_KEY_INCREMENT_BASE;   // 0.5°
}
```

### Visual Feedback
The renderer displays the current mode and increment value next to the power bar, with color coding:
- **Gray**: Normal mode hints
- **Cyan**: Fine mode active
- **Magenta**: Ultra-fine mode active

## Workflow Example

1. **Initial Positioning**: Use mouse for rough aiming
2. **Coarse Adjustment**: Press arrow keys (0.5°) to get close to target
3. **Fine Tuning**: Hold Shift + arrow keys (0.1°) for precise alignment
4. **Perfect Shot**: Hold Shift + Ctrl + arrow keys (0.02°) for pixel-perfect angle
5. **Lock and Shoot**: Press 'A' to enter power mode, adjust power, shoot

## Benefits

1. **Speed**: Quick positioning with large increments
2. **Precision**: Small increments for tight shots
3. **Muscle Memory**: Consistent key combinations across all shots
4. **Visual Feedback**: Always know what precision level you're using
5. **Flexibility**: Can mix mouse aiming with keyboard fine-tuning

## Comparison to Other Systems

### Traditional (Fixed Increment)
- ❌ Too coarse: 1° might be too big for tight shots
- ❌ Too fine: 0.05° makes positioning slow

### Progressive (This System)
- ✅ Fast positioning with 0.5°
- ✅ Fine control with 0.1°
- ✅ Pixel-perfect with 0.02°
- ✅ User chooses precision level

## Future Enhancements

### Auto-Scaling Based on Distance
Could automatically reduce increment as aim line gets closer to target ball:
```typescript
const distanceToTarget = Math.abs(aimAngle - perfectAngle);
if (distanceToTarget < 5°) {
  increment *= 0.5;  // Halve increment when close
}
```

### Visual Distance Indicator
Show how far from "perfect" the current angle is:
- Green zone: Within 0.1° of optimal
- Yellow zone: Within 0.5°
- Red zone: More than 0.5° off

### Haptic Feedback (Future)
When aim line crosses a pocket entrance, provide subtle visual pulse or audio cue.
