# UI Panel Organization Plan

## Analysis Summary

### ✅ Well-Organized Panels
These panels already have good grouping:

1. **Physics & Aim Assist Panel** (6 groups, 15 controls)
   - ✅ Ball Physics (3)
   - ✅ Shot Power (2)
   - ✅ Friction (2)
   - ✅ Physics Engine (2)
   - ✅ Aim Assist Visuals (4)
   - ✅ Display (2)

2. **Game Settings Panel** (3 groups, 13 controls)
   - ✅ Gameplay (3 toggles)
   - ✅ UI Colors (6 colors)
   - ✅ Settings Management (4 buttons)

3. **Render Layer Panel** (3 groups, 22 controls)
   - ✅ Visibility (9 toggles)
   - ✅ Render Order (7 number inputs)
   - ✅ Lighting (7 sliders)

### ❌ Poorly Organized Panels

1. **Geometry Panel** (0 groups, 31 controls) ⚠️ **NEEDS WORK**
   - All 31 controls in one flat list
   - Mixes side pockets, corner pockets, frame, rails, and global settings
   - Hard to find specific controls
   - No logical grouping

---

## Proposed Solution: **Option A (Group by Type)**

After analyzing all panels, **Option A (Group by Pocket Type)** is the better choice because:

### ✅ Reasons to Choose Option A:
1. **Matches existing panel patterns** - Other panels group by "what" not "how"
   - Physics panel groups by physics type (ball, friction, engine)
   - Render panel groups by render type (visibility, order, lighting)
   - Game panel groups by feature type (gameplay, colors, settings)

2. **User mental model** - Users think "I want to adjust the side pocket" not "I want to adjust capture radii"

3. **Clear separation** - Side vs Corner is immediately obvious, prevents confusion

4. **Easier discovery** - If user wants to change something about corner pockets, everything is in one section

5. **Logical hierarchy** - Type → Property is more intuitive than Property → Type

### ❌ Why Not Option B:
- Groups by property (capture, shape, coordinates) would scatter related controls
- Example: Side pocket capture and corner pocket capture would be together but far from their jaw settings
- Harder to understand what affects what
- Violates principle of proximity (related things should be near each other)

---

## Implementation Plan

### **Geometry Panel Reorganization**

```
📐 Pocket Geometry

📍 Side Pockets (11 controls)
  ├─ Jaw Radius
  ├─ Jaw Steepness (Frame Offset)
  ├─ Pocket Offset (Outward)
  ├─ [Group: Rail Positions]
  │   ├─ Straight Y
  │   └─ Inner Y (throat)
  ├─ [Group: Jaw Overrides] (with Auto buttons)
  │   ├─ Jaw Outer X
  │   ├─ Jaw Inner X
  │   └─ Throat Width
  ├─ Capture Radius
  ├─ Visual Radius
  └─ Cut Angle

📐 Corner Pockets (10 controls)
  ├─ Frame Offset
  ├─ Jaw Radius
  ├─ [Group: Rail Positions]
  │   ├─ Straight X
  │   └─ Target Y
  ├─ [Group: Jaw Overrides] (with Auto buttons)
  │   ├─ Jaw X
  │   ├─ Jaw Y
  │   └─ Throat Width
  ├─ Capture Radius
  ├─ Visual Radius
  └─ Cut Angle

🔧 Frame & Rails (4 controls)
  ├─ Frame Width
  ├─ Frame Corner Radius
  ├─ Rail Thickness (Inner)
  └─ Rail Thickness (Outer)

⚙️ Global Settings (2 controls)
  ├─ Pocket Shelf Depth
  └─ Jaw Curve Blend
```

### Control Count:
- **Side Pockets:** 11 controls
- **Corner Pockets:** 10 controls
- **Frame & Rails:** 4 controls
- **Global Settings:** 2 controls
- **Total:** 27 controls (4 moved to sub-groups)

### Benefits:
1. ✅ **Reduces visual clutter** - 31 items → 4 groups
2. ✅ **Logical grouping** - Related controls together
3. ✅ **Easier scanning** - Group titles provide clear signposts
4. ✅ **Maintains all functionality** - No controls removed
5. ✅ **Consistent with other panels** - Follows established patterns

---

## Technical Implementation

### Files to Modify:
1. **index.html** (lines 118-535) - Add `<div class="settings-group">` wrappers
2. **GeometryPanel.ts** - No changes needed (controls already bound correctly)

### Estimated Changes:
- Add 4 group wrappers in HTML
- Add 4 group titles
- Reorder 31 controls into logical groups
- **No JavaScript changes required** ✅

### Testing Required:
- ✅ All sliders still work
- ✅ Auto buttons still work
- ✅ Value displays still update
- ✅ Settings persist correctly

---

## Next Steps

1. ✅ **Get user approval on Option A approach**
2. 🔄 **Implement Geometry Panel reorganization**
3. ✅ **Test all controls**
4. 🔄 **Commit and push**

---

## Future Enhancements (Optional)

### Potential Improvements:
- Add collapsible groups (accordion-style)
- Add "Expert Mode" toggle to show/hide advanced controls
- Add tooltips explaining what each control does
- Add visual preview of what control affects

### Other Panel Ideas:
- Debug panel reorganization (if it exists)
- Add search/filter for finding controls quickly
