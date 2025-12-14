# Table Editor DevTool Plan

> **Status:** Planning  
> **Location:** `devtools/table-editor/`  
> **Entry:** `devtools/table-editor.html`

---

## Overview

A standalone devtool window for managing pool table configurations in JSON mode. This tool provides visual editing, skin management, and real-time preview capabilities independent of the main game.

### Goals
- **Visual table editor** with live preview
- **Skin/texture management** (upload, organize, preview)
- **JSON geometry editing** with visual feedback
- **Clone of in-game table** for accurate preview
- **Export/import** table configurations
- **No dependency on main game running**

---

## Architecture

```
devtools/
├── table-editor.html          # Standalone entry point
├── table-editor/
│   ├── main.ts                # Editor bootstrap
│   ├── TableEditorApp.ts      # Main application class
│   ├── components/
│   │   ├── TablePreview.ts    # Three.js table clone
│   │   ├── SkinManager.ts     # Skin upload/management
│   │   ├── GeometryEditor.ts  # JSON geometry visual editor
│   │   ├── TextureEditor.ts   # Felt/rail/frame colors
│   │   ├── PocketEditor.ts    # Pocket positions/sizes
│   │   └── ExportPanel.ts     # Export/import functionality
│   ├── stores/
│   │   ├── TableStore.ts      # Table state management
│   │   └── SkinStore.ts       # Skin/texture state
│   └── utils/
│       ├── JsonLoader.ts      # Load/parse table JSON
│       └── SkinProcessor.ts   # Image processing utilities
```

---

## Features

### 1. Table Preview Panel (Primary View)

**Clone of In-Game Table Renderer**
- Uses same `TableRenderer`, `BallRenderer` from main game
- Orthographic top-down view matching game camera
- Real-time updates as settings change
- Optional: Add orbit controls for 3D inspection

**Preview Controls**
- Zoom in/out (mouse wheel)
- Pan (middle mouse drag)
- Reset view button
- Toggle ball visibility
- Toggle rail/pocket highlights
- Measurement overlay toggle

**Ball Placement**
- Drag balls to test positions
- Quick presets: rack, break, random scatter
- Clear all balls button

---

### 2. Skin Manager

**Upload & Storage**
```typescript
interface TableSkin {
  id: string;
  name: string;
  createdAt: Date;
  textures: {
    felt?: string;      // Base64 or blob URL
    frame?: string;
    rails?: string;
    pockets?: string;
  };
  colors: {
    felt: string;
    frame: string;
    rails: string;
  };
  geometry: ModernGeometry;  // Full geometry config
}
```

**Features**
- Upload skin images (drag & drop)
- Name and organize skins
- Preview skins on table
- Delete/duplicate skins
- Export skin as JSON bundle
- Import skin from JSON

**Storage**
- IndexedDB for large textures
- localStorage for metadata
- Export as `.railrush-skin` file (zip of JSON + images)

---

### 3. Geometry Editor (JSON Mode Only)

**Visual Pocket Editor**
- Drag pocket positions
- Resize pocket radii (visual handles)
- Adjust jaw angles with rotation handles
- Shelf depth slider per pocket

**Visual Rail Editor**
- Drag rail endpoints
- Adjust rail curves
- Cushion thickness controls

**JSON View**
- Side panel showing live JSON
- Edit JSON directly → updates preview
- Syntax highlighting
- Validation errors inline

**Presets**
- Load from `ModernGeometry` presets (Tournament, Home, Bar, etc.)
- Save current as new preset
- Compare two presets side-by-side

---

### 4. Texture/Color Editor

**Felt**
- Color picker
- Texture overlay (upload pattern)
- Weave pattern generator (procedural)
- Roughness/bump controls

**Frame**
- Wood grain presets
- Color tint
- Glossiness

**Rails**
- Match frame or custom color
- Highlight color/intensity

**Pockets**
- Pocket liner color
- Gradient settings
- Groove depth visual

---

### 5. Export/Import Panel

**Export Formats**
- `.railrush-table` - Full table config (geometry + appearance + textures)
- `.railrush-geometry` - Geometry only (JSON)
- `.railrush-skin` - Appearance only (colors + textures)
- PNG screenshot of current preview

**Import**
- Drag & drop any export format
- Import from URL
- Import from game's current settings (via WebSocket if connected)

**Sync with Game**
- Connect to running game via WebSocket
- Push current editor config to game
- Pull game's current config into editor

---

## UI Layout

```
┌─────────────────────────────────────────────────────────────────┐
│  RailRush Table Editor                    [Connect] [Export ▾]  │
├──────────────────────┬──────────────────────────────────────────┤
│                      │                                          │
│   Skin Library       │                                          │
│   ┌─────┐ ┌─────┐    │           Table Preview                  │
│   │     │ │     │    │           (Three.js Canvas)              │
│   │ Sk1 │ │ Sk2 │    │                                          │
│   └─────┘ └─────┘    │                                          │
│   ┌─────┐ ┌─────┐    │                                          │
│   │     │ │  +  │    │                                          │
│   │ Sk3 │ │ Add │    │                                          │
│   └─────┘ └─────┘    │                                          │
│                      │                                          │
├──────────────────────┼──────────────────────────────────────────┤
│                      │                                          │
│   Properties Panel   │           JSON Editor                    │
│   ┌────────────────┐ │           (Monaco/CodeMirror)            │
│   │ Geometry Tab   │ │                                          │
│   │ Appearance Tab │ │                                          │
│   │ Pockets Tab    │ │                                          │
│   │ Rails Tab      │ │                                          │
│   └────────────────┘ │                                          │
│                      │                                          │
└──────────────────────┴──────────────────────────────────────────┘
```

**Responsive**
- Collapsible side panels
- Full-screen preview mode
- Keyboard shortcuts (S: save, E: export, R: reset, etc.)

---

## Technical Implementation

### Phase 1: Foundation (MVP)
1. Create `devtools/table-editor.html` entry point
2. Set up Vite config for separate entry
3. Create `TablePreview` component using existing `TableRenderer`
4. Basic geometry sliders (reuse `ModernGeometryPanel` logic)
5. Load/display current `physics.json`

### Phase 2: Skin Management
1. Create `SkinStore` with IndexedDB backend
2. Implement skin upload (drag & drop images)
3. Skin list UI with thumbnails
4. Apply skin to preview
5. Export/import skin bundles

### Phase 3: Visual Editing
1. Pocket drag handles in preview
2. Rail adjustment handles
3. Live JSON sync (edit JSON ↔ preview)
4. Undo/redo system

### Phase 4: Game Integration
1. WebSocket connection to running game
2. Push/pull settings
3. Live sync mode (changes in editor → instant game update)

---

## File Formats

### `.railrush-table` (Full Bundle)
```json
{
  "version": "1.0",
  "type": "table",
  "name": "My Custom Table",
  "geometry": { /* ModernGeometry */ },
  "appearance": {
    "feltColor": "#1a5f2a",
    "frameColor": "#4a2810",
    "railColor": "#3d2108"
  },
  "textures": {
    "felt": "data:image/png;base64,...",
    "frame": "data:image/png;base64,..."
  }
}
```

### `.railrush-geometry` (Geometry Only)
```json
{
  "version": "1.0",
  "type": "geometry",
  "name": "Tournament 9ft",
  "geometry": { /* ModernGeometry */ }
}
```

---

## Dependencies

**Existing (Reuse)**
- `TableRenderer`, `BallRenderer` from `src/render/`
- `ModernGeometry` types from `src/geometry/`
- `design-tokens.css` for styling
- Three.js (already in project)

**New**
- Monaco Editor or CodeMirror (optional, for JSON editing)
- IndexedDB wrapper (Dexie already in project)
- JSZip (for bundle export, if not using JSON with embedded base64)

---

## Open Questions

1. **Offline-first or connected?**
   - Should editor work fully offline with local storage?
   - Or require connection to game for preview accuracy?

2. **Texture resolution**
   - Max texture size for skins?
   - Auto-resize on upload?

3. **Physics JSON source**
   - Ship a default `physics.json` with editor?
   - Or require loading from game files?

4. **Sharing**
   - Cloud storage for sharing skins?
   - Or just export files?

---

## Timeline Estimate

| Phase | Effort | Deliverable |
|-------|--------|-------------|
| Phase 1: Foundation | 4-6 hours | Working preview + basic controls |
| Phase 2: Skins | 4-6 hours | Upload, manage, apply skins |
| Phase 3: Visual Editing | 6-8 hours | Drag handles, live JSON |
| Phase 4: Game Integration | 3-4 hours | WebSocket sync |

**Total:** ~17-24 hours

---

## Next Steps

1. [ ] Create `devtools/table-editor.html` entry
2. [ ] Add Vite config for table-editor entry
3. [ ] Create `TableEditorApp.ts` shell
4. [ ] Port `TableRenderer` for standalone use
5. [ ] Implement basic geometry controls
