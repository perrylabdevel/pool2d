# RailRush UI Architecture & Roadmap

This document replaces the legacy “plan vs. status” split. It tracks the current UI stack (Home Hub, modal chrome, legacy dock bridge) and the remaining roadmap items.

## Current Foundation

- **UI State & Scene Stack (`src/ui/UIStateMachine.ts`, `src/ui/SceneController.ts`)**
  - HUD buttons and keyboard shortcuts transition between `LOBBY`, `PLAY_MODES`, `SHOP`, `PROFILE`, `IN_GAME`, and `IN_GAME_MENU`.
  - `SceneController` renders each state on the dedicated `#ui-stage` canvas with cross-fades/slide transitions so gameplay overlays stay isolated on `#ui-canvas`.
- **Home Hub (`src/ui/HomeHub.ts`)**
  - Legacy DOM/modal hub kept alive for bootstrapping and dev shortcuts (`homeHub.init()` still fires on start), but the goal is to replace it fully with the canvas Lobby scene.
- **ModalService (`src/ui/ModalService.ts`)**
  - Handles overlay, animations, confirm dialogs, ESC-to-close, and sound hooks via `UISoundService`. Still powers legacy modals until their scene equivalents exist.
- **In-Game Menu (`src/ui/scenes/InGameMenuScene.ts`)**
  - ESC shortcut for pause/resume, settings, and quitting back to the lobby scene. The modal version is deprecated.
- **Hub Settings / Profile / Shop**
  - `HubSettings`, `ProfileModal`, `ShopModal` remain the source of truth for profile data and cue inventory.
  - Cue shop ties into `SettingsManager.saveUIColors`; canvas scenes will consume the same APIs once complete.
- **Notification + UI Sound Services**
  - `NotificationService` replaces toast banners; `UISoundService` handles hover/click/modal sounds with mixer-aware volume gating.
- **DockBridge (`src/ui/DockBridge.ts`)**
  - Keeps legacy physics/geometry/render panels accessible via **Shift + L** without cluttering the new chrome.
- **Design Tokens & Styles (`styles/design-tokens.css`, `styles/main.css`)**
  - Neon gradients, metallic borders, shimmer utilities, frosted glass helpers reused by all modals, HUD chips, and (soon) canvas scenes via custom draw helpers.

## Completed Deliverables

- Home Hub hero + mode cards
- ModalService + confirm dialog helpers
- ESC pause/in-game menu
- Audio Mixer UI + Quiet Room sliders
- Cue shop + profile modal
- Notification + UI sound kits
- DockBridge wrapper w/ persisted collapsed state
- HUD refresh (ball chips rendered via `Renderer3D.generateBallIcons`, foul toasts, pocket-call prompts)

## Legacy Dock & Tooling

- Dock panels still power tuning workflows (physics, geometry, render layers, settings IO)
- DockBridge starts hidden; Shift+L toggles both docks plus launcher bar
- Dock keeps focusable hotkeys (S/G/J etc.) for regression testing; plan is to sunset once modal replacements cover every workflow

## Roadmap

1. **Canvas scene parity**
   - Flesh out Shop/Profile/Settings scenes so they match the modal feature set (inventory carousel, stats, focus order, CTA buttons).
   - Remove the stop-gap “Coming soon” artwork and consume shared typography/gradient helpers.
2. **Pocket-call UX refresh**
   - Replace blocking HUD prompts with non-modal overlays + inline pocket selection tooltips
   - Highlight chosen pocket on the hub/HUD without freezing aim/power inputs
3. **Illegal-break resolution dialog**
   - After an illegal break, present accept/re-rack/re-break options via ModalService instead of auto BIH
4. **Hub content expansion**
   - Add rotating hero cards (events, drills) and integrate match history/profile stats
   - Surface active rules preset + AI difficulty on the lobby scene and HUD header
5. **Dock sunset**
   - Port physics/geometry/render controls into modal tabs (Settings → Physics / Geometry / Display)
   - Remove DockBridge once QA signs off on feature parity
6. **Accessibility & Responsiveness**
   - Screen-reader labels for modal + canvas controls, better focus trapping on pause/hub overlays
   - Tablet/mobile responsive variants (full-height modals, stacked sections, touch hitboxes)

## Implementation References

| Area | Files |
| --- | --- |
| Modal stack & sounds | `src/ui/ModalService.ts`, `src/ui/UISoundService.ts` |
| Home Hub & footer actions | `src/ui/HomeHub.ts`, `src/ui/HubSettings.ts`, `src/ui/ShopModal.ts`, `src/ui/ProfileModal.ts`, `src/ui/HelpModal.ts` |
| Pause & in-game navigation | `src/ui/InGameMenu.ts`, `src/ui/HUD.ts` (HUD button opens hub) |
| Dock legacy panels | `src/ui/DockBridge.ts`, `src/ui/*Panel.ts`, `src/ui/panels/*` |
| Styling | `styles/design-tokens.css`, `styles/main.css` |

## QA & Accessibility Checklist

- Verify ESC prefers closing the active modal/scene before transitioning to `IN_GAME_MENU`.
- Ensure focus order cycles through modal content + footer actions and, for canvas scenes, through the virtual focus tree (keyboard navigation hooks live inside each scene).
- Confirm HUD buttons and ESC emit the expected `ui:state:changed` events, and that gameplay input is suppressed whenever state ≠ `IN_GAME`.
- Test DockBridge toggle persistence (`localStorage:dock-collapsed`) and ensure renderer resize events keep canvases aligned.
- Run `npm run dev` with reduced-motion OS setting to validate that shimmer/glow effects degrade gracefully.
