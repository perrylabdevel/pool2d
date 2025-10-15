# Spacebar Instant Shoot Mode

## Overview
The spacebar instant shoot mode allows players to quickly freeze their aim and transition to power adjustment in a single action. This enables faster shot execution while maintaining precise aim control.

## Feature Description

### Activation
- **Press and Hold Spacebar**: Immediately freezes the current aim angle and enters power mode
- The aim line locks in place and cannot be changed while spacebar is held
- Power starts at minimum (`CONFIG.CUE_POWER_MIN`)

### Power Adjustment (Multiple Methods)

**Method 1: Vertical Mouse Movement** (Recommended for trackpads!)
- **Move mouse up/down anywhere on screen** while holding spacebar
- Power adjusts instantly based on vertical position
- Moving down = more power
- Moving up = less power
- Perfect for trackpad users - no need to aim for power bar!

**Method 2: Arrow Keys**
- **Arrow Up (↑)**: Increase power by 0.5 per press
- **Arrow Down (↓)**: Decrease power by 0.5 per press
- Good for precise power adjustments

Power is clamped between `CONFIG.CUE_POWER_MIN` (0.5) and `CONFIG.CUE_POWER_MAX` (25.0)
Starting point when spacebar is pressed: Mid-range (~12.5)

### Shooting
- **Release Spacebar**: Automatically shoots with the current power level
- If power is below minimum, the shot is cancelled

### Visual Feedback
- **Mode Indicator**: Shows "SHOOT" in green
- **Status**: "Release Space" hint
- **Aim Status**: "LOCKED AIM" in yellow
- **Instructions**: "↑ ↓ for power"
- **Power Bar**: Fills as you adjust power with arrow keys

## Workflow Comparison

### Traditional Aim → Power → Shoot
1. Aim with mouse/arrow keys
2. Press **A** to enter power mode (locks angle)
3. Drag power bar or use arrow keys to set power
4. Click or press key to shoot

**Steps**: 4 actions + multiple key presses

### Spacebar Instant Shoot
1. Aim with mouse/arrow keys
2. **Hold Spacebar** (freezes aim + enters power mode)
3. **Move mouse up/down** to adjust power (or use ↑↓ keys)
4. **Release Spacebar** to shoot

**Steps**: 2 actions (hold + release) + fluid mouse movement
**Perfect for trackpads**: No need to target the power bar!

## Use Cases

### Quick Shots
When you know the approximate power needed:
1. Aim at target
2. Hold spacebar
3. Flick mouse down for more power (or up for less)
4. Release to shoot

**Time Saved**: ~2-3 seconds per shot
**Feel**: Like drawing a bow - pull back (mouse down) for more power!

### Precision Shots
For shots requiring exact aim and power:
1. Use progressive aim precision (Shift, Shift+Ctrl)
2. Dial in perfect angle with arrow keys
3. Hold spacebar to freeze aim
4. Fine-tune power with ↑↓
5. Release to execute

### Combo with Fine Aim
The spacebar mode works seamlessly with fine aim:
1. Hold **Shift** for fine mouse sensitivity
2. Use **Shift + ←→** for 0.1° adjustments
3. Hold **Spacebar** when angle is perfect
4. Adjust power
5. Release to shoot

## Implementation Details

### State Management
```typescript
isSpacebarHeld: boolean = false;
spacebarLockedAngle: number = 0;
currentPower: number = 0;
```

### Angle Locking
When spacebar is pressed:
```typescript
this.spacebarLockedAngle = this.input.getAimAngle(this.cueBall);
this.currentPower = CONFIG.CUE_POWER_MIN;
```

### Power Control
```typescript
if (e.key === 'ArrowUp') {
  this.currentPower = Math.min(CONFIG.CUE_POWER_MAX, this.currentPower + 0.5);
}
```

### Shot Execution
When spacebar is released:
```typescript
if (this.currentPower >= CONFIG.CUE_POWER_MIN) {
  this.shoot(this.spacebarLockedAngle, this.currentPower);
}
```

## Interaction with Other Modes

### Spacebar + Normal Aim Mode
- ✅ Works: Freezes current aim, enters power mode
- Aim line remains visible but frozen

### Spacebar + Power Mode (Press A first)
- ✅ Works: Overrides existing power mode
- Uses spacebar-locked angle instead of A-locked angle

### Spacebar + Fine Aim (Shift held)
- ✅ Works: Freezes fine-aimed angle
- Perfect for precision shots

### Spacebar + Arrow Keys (←→)
- 🚫 Disabled: Left/Right arrows don't work during spacebar hold
- ✅ Enabled: Up/Down arrows adjust power

## Configuration

### Power Adjustment Speed
Currently hardcoded to 0.5 per press. Could be made configurable:

```typescript
// In config.ts
SPACEBAR_POWER_INCREMENT: 0.5,  // Power change per arrow key press
SPACEBAR_POWER_INCREMENT_FINE: 0.1,  // If Shift is held (future)
```

### Auto-Shoot Timer (Future Enhancement)
Could add optional auto-shoot after holding spacebar for X seconds:

```typescript
SPACEBAR_AUTO_SHOOT_DELAY: 2000,  // ms, 0 = disabled
```

## Future Enhancements

### 1. Visual Power Ramp
Show a smooth power increase animation when holding ↑:
- Hold arrow key = continuous power increase
- Current: Discrete steps only

### 2. Power Presets
Quick power selection with number keys:
- **1** = 25% power
- **2** = 50% power
- **3** = 75% power
- **4** = 100% power

### 3. Muscle Memory Mode
Remember last N shots' power levels and suggest similar power:
- Shows ghost marker on power bar
- "Last shot: 18.5"

### 4. Shot Preview
While spacebar is held, show:
- Predicted ball path (faded)
- Estimated resting position
- Probability cone

### 5. Cancel Shot
Add **Escape** key to cancel spacebar mode:
- Returns to aim mode without shooting
- Useful if you change your mind

## Keyboard Shortcuts Summary

### In Spacebar Mode
| Key | Action |
|-----|--------|
| Hold Space | Enter instant shoot mode |
| ↑ | Increase power (+0.5) |
| ↓ | Decrease power (-0.5) |
| Release Space | Shoot with current power |

### Compatible Modifiers
| Modifier | Effect |
|----------|--------|
| Shift | (No effect in spacebar mode) |
| Ctrl | (No effect in spacebar mode) |
| A | (Overridden by spacebar mode) |

## Testing Checklist

- [x] Spacebar freezes aim at current angle
- [x] Aim stays locked even when mouse moves
- [x] Arrow up increases power
- [x] Arrow down decreases power
- [x] Mouse can adjust power by hovering over power bar
- [x] Releasing spacebar shoots the ball in correct direction
- [x] Visual indicators show "SHOOT" mode
- [x] Power bar fills correctly
- [x] Works in both 2D and 3D renderers
- [x] Left/right arrows disabled during spacebar hold
- [x] Compatible with fine aim mode
- [x] Manual angle properly locked to prevent direction changes

## User Feedback

### Advantages
- ⚡ Faster shot execution
- 🎯 Maintains aim precision
- 🎮 More intuitive for gaming-style play
- 🔄 Less mode switching (one key instead of two)

### Potential Issues
- Learning curve for new control scheme
- May accidentally shoot if spacebar is released early
- Power adjustment speed might need tuning

## Tips for Players

1. **Practice the Timing**: Get comfortable with the hold → adjust → release rhythm
2. **Start Simple**: Use spacebar for easy shots to build muscle memory
3. **Combine Techniques**: Use fine aim to dial in angle, then spacebar for quick execution
4. **Power Memory**: After a few shots, you'll learn common power levels (corner pocket = ~15, bank shot = ~8, etc.)
5. **Escape Hatch**: Remember the traditional A key method is still available if needed
