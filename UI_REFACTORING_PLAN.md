# UI Panel Refactoring Plan

## Problem Statement

The `index.html` file is **793 lines**, with **82% (655 lines)** being inline HTML for panels. This creates:

1. ❌ **Massive file size** - Hard to navigate and maintain
2. ❌ **Inconsistent architecture** - Some panels in TypeScript, some in HTML
3. ❌ **Poor maintainability** - Changes require editing large HTML blocks
4. ❌ **No component reusability** - Can't reuse panel structure patterns
5. ❌ **Version control noise** - HTML changes mixed with structure changes

## Current State Analysis

### File Breakdown

```
index.html (793 lines total)
├─ Head & Structure     (117 lines) - 15%
├─ Geometry Panel       (429 lines) - 54% ⚠️
├─ Render Layer Panel   (226 lines) - 28% ⚠️
└─ Footer & Scripts      (17 lines) -  2%

Panel HTML: 655 lines (82% of file!)
```

### Panel Architecture Inconsistency

| Panel | Location | HTML Generation | Lines | Status |
|-------|----------|----------------|-------|--------|
| **Game Settings** | GameSettingsPanel.ts | TypeScript ✅ | ~113 | Consistent |
| **Physics & Aim** | SettingsPanel.ts | TypeScript ✅ | ~108 | Consistent |
| **Geometry** | index.html | Inline HTML ❌ | 429 | **Needs refactor** |
| **Render Layers** | index.html | Inline HTML ❌ | 226 | **Needs refactor** |

### Existing TypeScript Panels (Good Examples)

#### GameSettingsPanel.ts Pattern
```typescript
export class GameSettingsPanel {
  private createPanel(): HTMLElement {
    const panel = document.createElement('div');
    panel.id = 'game-settings-panel';
    panel.className = 'panel-dock-card hidden';
    panel.innerHTML = `
      <div class="panel-header">
        <h3>🎮 Game & UI Settings</h3>
      </div>
      <div class="panel-content">
        <!-- Dynamic HTML generation -->
      </div>
    `;
    return panel;
  }

  private bindEvents(): void { /* ... */ }
  private syncFromSettings(): void { /* ... */ }
}
```

**Benefits:**
- ✅ Logic and presentation in one place
- ✅ Easy to modify and test
- ✅ Event binding colocated with HTML
- ✅ Settings sync logic together

## Phase 4: HTML Panel Extraction

### Goal
Move all panel HTML generation from `index.html` to TypeScript classes, achieving:
- Consistent architecture across all panels
- Reduced index.html from 793 → ~140 lines (-82%)
- Better maintainability and testability
- Clearer separation of concerns

---

## Task 1: Extract GeometryPanel HTML

### Current State
**File:** `index.html` lines 118-547 (429 lines)
**Logic:** `src/ui/GeometryPanel.ts` (330 lines)

**Problem:** HTML and logic are split between two files

### Target State
**File:** `src/ui/GeometryPanel.ts` (updated)
**HTML:** Generated programmatically like other panels

### Implementation Plan

#### Step 1: Add `createPanel()` Method
```typescript
export class GeometryPanel {
  private panel: HTMLElement;

  constructor(settingsManager: SettingsManager, onGeometryChange: () => void) {
    this.settingsManager = settingsManager;
    this.onGeometryChange = onGeometryChange;
    this.panel = this.createPanel(); // ← NEW

    // ... rest of constructor
  }

  private createPanel(): HTMLElement {
    let panel = document.getElementById('geometry-panel');
    if (panel) {
      return panel;
    }

    const dock = document.getElementById('panel-dock');
    panel = document.createElement('div');
    panel.id = 'geometry-panel';
    panel.className = 'panel-dock-card hidden';
    panel.innerHTML = `
      <div class="panel-header">
        <h3>📐 Pocket Geometry</h3>
      </div>
      <div class="panel-content">
        ${this.generateSidePocketsGroup()}
        ${this.generateCornerPocketsGroup()}
        ${this.generateFrameRailsGroup()}
        ${this.generateGlobalSettingsGroup()}
        ${this.generateActions()}
      </div>
    `;

    if (dock) {
      dock.prepend(panel);
    }
    return panel;
  }
}
```

#### Step 2: Create Helper Methods for Groups

```typescript
private generateSidePocketsGroup(): string {
  return `
    <div class="settings-group">
      <h4 class="settings-group-title">📍 Side Pockets</h4>
      ${this.sliderRow('live-side-radius', 'Jaw Radius', 1, 8, 0.1, 4)}
      ${this.sliderRow('live-side-steepness', 'Jaw Steepness', 0.5, 6, 0.1, 2)}
      <!-- ... all side pocket controls ... -->
    </div>
  `;
}

private sliderRow(id: string, label: string, min: number, max: number, step: number, value: number): string {
  return `
    <div class="slider-group">
      <label for="${id}">
        ${label}: <span id="${id}-val">${value}</span>
      </label>
      <input type="range" id="${id}" min="${min}" max="${max}" step="${step}" value="${value}" />
    </div>
  `;
}

private sliderRowWithAuto(id: string, label: string, min: number, max: number, step: number, value: number): string {
  return `
    <div class="slider-group input-group">
      <label for="${id}">
        ${label}: <span id="${id}-val">Auto</span>
      </label>
      <div class="input-row">
        <input type="range" id="${id}" min="${min}" max="${max}" step="${step}" value="${value}" />
        <button id="${id}-auto" class="panel-mini-btn" data-no-drag="true">Auto</button>
      </div>
    </div>
  `;
}
```

#### Step 3: Remove from index.html

Delete lines 118-547 from `index.html`, replace with:
```html
<!-- Geometry panel will be dynamically created by GeometryPanel.ts -->
```

### Files Modified
1. **src/ui/GeometryPanel.ts** - Add HTML generation (+150 lines)
2. **index.html** - Remove inline HTML (-429 lines)

### Testing Checklist
- [ ] Panel renders correctly
- [ ] All 31 sliders work
- [ ] Auto buttons work
- [ ] Settings persist
- [ ] Panel can open/close
- [ ] Keyboard shortcut (G) works

---

## Task 2: Extract RenderLayerPanel HTML

### Current State
**File:** `index.html` lines 549-775 (226 lines)
**Logic:** `src/ui/RenderLayerPanel.ts` (exists but minimal)

### Implementation Plan

Similar approach to GeometryPanel:

#### Step 1: Enhance RenderLayerPanel.ts

```typescript
export class RenderLayerPanel {
  private panel: HTMLElement;

  constructor(/* ... */) {
    this.panel = this.createPanel();
    this.setupEventListeners();
  }

  private createPanel(): HTMLElement {
    let panel = document.getElementById('render-layer-panel');
    if (panel) {
      return panel;
    }

    const dock = document.getElementById('panel-dock');
    panel = document.createElement('div');
    panel.id = 'render-layer-panel';
    panel.className = 'panel-dock-card hidden';
    panel.innerHTML = `
      <div class="panel-header">
        <h3>🧱 Render Layers</h3>
      </div>
      <div class="panel-content">
        ${this.generateVisibilityGroup()}
        ${this.generateRenderOrderGroup()}
        ${this.generateLightingGroup()}
        ${this.generateActions()}
      </div>
    `;

    if (dock) {
      dock.prepend(panel);
    }
    return panel;
  }

  private generateVisibilityGroup(): string { /* ... */ }
  private generateRenderOrderGroup(): string { /* ... */ }
  private generateLightingGroup(): string { /* ... */ }
}
```

#### Step 2: Remove from index.html

Delete lines 549-775, replace with comment.

### Files Modified
1. **src/ui/RenderLayerPanel.ts** - Add HTML generation (+100 lines)
2. **index.html** - Remove inline HTML (-226 lines)

---

## Task 3: Clean Up index.html

### Result After Extraction

**Before:** 793 lines
**After:** ~140 lines (-653 lines, -82%)

### Final index.html Structure

```html
<!doctype html>
<html lang="en">
  <head>
    <!-- Meta, title, styles -->
  </head>
  <body>
    <div id="loading-screen"><!-- ... --></div>
    <div id="app">
      <div id="workspace">
        <aside id="dock-left">
          <nav id="panel-launcher">
            <!-- Panel launcher buttons -->
          </nav>
        </aside>

        <main id="workspace-main">
          <div id="hud"><!-- HUD elements --></div>
          <div id="canvas-stage">
            <div id="canvas-container">
              <canvas id="game-canvas"></canvas>
              <canvas id="ui-canvas"></canvas>
              <canvas id="debug-canvas"></canvas>
              <img id="reference-overlay" />
            </div>
          </div>
        </main>

        <aside id="dock-right">
          <div id="panel-dock" aria-live="polite">
            <!-- Panels dynamically created by TypeScript -->
          </div>
        </aside>
      </div>
    </div>
    <script type="module" src="/src/main.ts"></script>
  </body>
</html>
```

**Clean separation:**
- HTML provides structure only
- TypeScript handles all panel creation
- Easier to read and understand

---

## Benefits Summary

### Before Refactoring
```
index.html: 793 lines
├─ Structure: 138 lines (17%)
└─ Panel HTML: 655 lines (83%) ⚠️

Inconsistent:
- 2 panels in TypeScript
- 2 panels in HTML
```

### After Refactoring
```
index.html: ~140 lines (-82%)
├─ Structure: 140 lines (100%)
└─ Panel HTML: 0 lines (all in TypeScript) ✅

Consistent:
- All 4 panels in TypeScript
- Uniform architecture
```

### Concrete Benefits

1. ✅ **Maintainability**
   - Panel HTML colocated with logic
   - Easier to find and modify controls
   - Changes in one file, not scattered

2. ✅ **Consistency**
   - All panels follow same pattern
   - Predictable structure for developers
   - Easier to add new panels

3. ✅ **Testability**
   - Can test panel generation in isolation
   - Mock settings more easily
   - Better unit test coverage

4. ✅ **Version Control**
   - Cleaner diffs
   - HTML changes separate from structure
   - Easier code review

5. ✅ **Code Reusability**
   - Shared helper methods (sliderRow, etc.)
   - Can extract common patterns
   - DRY principles applied

---

## Implementation Order

### Phase 4.1: GeometryPanel (Priority: High)
**Effort:** Medium (429 lines to migrate)
**Risk:** Medium (complex controls with Auto buttons)
**Benefit:** High (largest reduction)

**Estimated time:** 3-4 hours

### Phase 4.2: RenderLayerPanel (Priority: Medium)
**Effort:** Low-Medium (226 lines to migrate)
**Risk:** Low (simpler controls)
**Benefit:** Medium (good cleanup)

**Estimated time:** 2-3 hours

### Phase 4.3: Documentation & Cleanup (Priority: Low)
**Effort:** Low
**Risk:** None
**Benefit:** High (clarity for future devs)

**Estimated time:** 1 hour

---

## Testing Strategy

### Per-Panel Testing
1. **Visual regression:** Compare before/after screenshots
2. **Functional testing:**
   - All controls work
   - Auto buttons toggle correctly
   - Settings persist
   - Panel open/close works
3. **Integration testing:**
   - Keyboard shortcuts work
   - Multiple panels can be open
   - Settings sync across app

### Full System Testing
1. Build succeeds
2. Dev server runs
3. All panels render
4. No console errors
5. Settings save/load works

---

## Rollback Plan

If issues arise:
1. Each task is in separate commit
2. Can revert individual panels
3. index.html changes are additive (just removals)
4. Low risk due to isolated changes

---

## Future Enhancements (Post-Phase 4)

### Potential Improvements
1. **Extract shared panel base class**
   - Common panel creation logic
   - Shared helper methods (sliderRow, etc.)
   - Consistent initialization

2. **Panel factory pattern**
   - Register panels centrally
   - Dynamic loading/unloading
   - Better memory management

3. **Component library**
   - Reusable UI components (Slider, Toggle, ColorPicker)
   - Consistent styling
   - Easier to maintain

4. **Better TypeScript typing**
   - Typed panel configurations
   - Compile-time safety for IDs
   - Autocomplete for settings

---

## Success Metrics

### Code Quality
- [ ] index.html < 150 lines
- [ ] All panels in TypeScript
- [ ] No inline HTML over 10 lines
- [ ] Consistent architecture

### Functionality
- [ ] All controls work
- [ ] No regressions
- [ ] Settings persist
- [ ] Build succeeds

### Developer Experience
- [ ] Easier to find panel code
- [ ] Easier to add new controls
- [ ] Better code organization
- [ ] Clearer patterns to follow

---

## Related Documents
- `REFACTORING_PROGRESS.md` - Overall refactoring status
- `UI_ORGANIZATION_PLAN.md` - Panel content organization
- `GeometryPanel.ts` - Example TypeScript panel
- `GameSettingsPanel.ts` - Reference implementation pattern
