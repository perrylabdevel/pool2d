---
name: cue-skin-editor
description: Cue skin editor and in-game cue texture pipeline
---

# Plan

Implement a cue-skin pipeline and a dedicated editor that mirrors the table editor workflow (library, preview, push live/persist) so cue textures can be authored, aligned, and applied in-game with minimal friction.

## Requirements
- Support PNG cue skins with transparent background, applied to the in-game cue renderer.
- Provide a cue skin editor devtool with upload, preview, alignment controls, and a saved library.
- Allow live push to the running game and a persisted option that survives restart.
- Provide a safe fallback to the default procedural cue if a skin fails to load.

## Scope
- In: devtools cue editor UI + storage, WebSocket push plumbing, in-game cue skin load/apply, persistence keys.
- Out: shop economy, matchmaking unlocks, multi-cue progression, full UX polish.

## Files and entry points
- devtools (new): `devtools/cue-editor.html`, `devtools/cue-editor/CueEditorApp.ts`, preview/components, stores.
- Game integration: `src/debug/RemoteBridge.ts`, `src/render/components/CueRenderer.ts`.
- Settings/storage: `src/settings/StorageKeys.ts`, `src/ui/SettingsManager.ts` (if user-facing selection is needed).

## Data model / API changes
- Cue skin record: `{ id, name, imageBase64, tipOffsetPx, lengthScale, thicknessScale, ppi, updatedAt }`.
- WebSocket command: `cue-editor:push-config` with `{ skin, mode: 'live' | 'persist' }`.
- Local persistence: `cue-editor-pending-skin` (for restart) + IndexedDB library similar to `RailRush_TableEditor`.

## Action items
[ ] Define cue-skin alignment semantics (tip anchor position, length normalization, scale rules).
[ ] Build cue editor devtool UI (upload, preview, sliders for tip offset/scale, save/delete, live/persist push).
[ ] Add IndexedDB store for cue skins (mirroring `SkinStore` from table editor) and editor prefs.
[ ] Add RemoteBridge handling for `cue-editor:push-config` and pending-skin storage.
[ ] Update `CueRenderer` to load/apply cue textures from base64 or pending skin, with fallback.
[ ] Add clear/reset controls and guardrails for invalid/oversized textures.
[ ] Add devtool-to-game diagnostics (log cue dimensions, computed scale, and applied offsets).

## Testing and validation
- Manual: upload a skin, preview alignment, push live, verify cue aligns with ball tip.
- Restart app to confirm pending cue skin re-applies in persist mode.
- Verify cue renders correctly in aim/power modes and at extreme angles near rails.
- Confirm fallback works if image load fails or metadata is missing.

## Risks and edge cases
- Incorrect tip alignment due to inconsistent source art sizes.
- Very large base64 payloads causing slow loads or WebSocket limits.
- High-DPI scaling mismatch between cue texture and world scale.
- Rendering artifacts if cue is drawn while power bar animation is active.

## Open questions
- Should the editor normalize cue length to `CONFIG.CUE_LENGTH_IN` or to image PPI metadata?
- Do we want in-game selection UI now or keep this devtools-only for the first pass?
- What default tip anchor ratio should we assume for legacy cue skins?
