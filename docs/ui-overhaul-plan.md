# RailRush UI Architecture & Roadmap

This document replaces the legacy “plan vs. status” split. It tracks the current UI stack (Home Hub, modal chrome, legacy dock bridge) and the remaining roadmap items.

## Current Foundation

- **Home Hub (`src/ui/HomeHub.ts`)**
  - Hero banner + mode grid, footer controls for Settings/Profile/Shop/Help
  - Auto-opens on launch; ESC or HUD menu button can bring it back via `homeHub.init()`
- **ModalService (`src/ui/ModalService.ts`)**
  - Handles overlay, animations, confirm dialogs, ESC-to-close, and sound hooks via `UISoundService`
- **In-Game Menu (`src/ui/InGameMenu.ts`)**
  - ESC shortcut for pause/resume, settings, and quitting back to the hub
- **Hub Settings / Profile / Shop**
  - `HubSettings`, `ProfileModal`, `ShopModal` share the chrome + design tokens
  - Cue shop ties into `SettingsManager.saveUIColors`
- **Notification + UI Sound Services**
  - `NotificationService` replaces toast banners; `UISoundService` handles hover/click/modal sounds with mixer-aware volume gating
- **DockBridge (`src/ui/DockBridge.ts`)**
  - Keeps legacy physics/geometry/render panels accessible via **Shift + L** without cluttering the new chrome
- **Design Tokens & Styles (`styles/design-tokens.css`, `styles/main.css`)**
  - Neon gradients, metallic borders, shimmer utilities, frosted glass helpers reused by all modals and HUD chips

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

1. **Pocket-call UX refresh**
   - Replace blocking HUD prompts with non-modal overlays + inline pocket selection tooltips
   - Highlight chosen pocket on the hub/HUD without freezing aim/power inputs
2. **Illegal-break resolution dialog**
   - After an illegal break, present accept/re-rack/re-break options via ModalService instead of auto BIH
3. **Hub content expansion**
   - Add rotating hero cards (events, drills) and integrate match history/profile stats
   - Surface active rules preset + AI difficulty on the hub and HUD header
4. **Dock sunset**
   - Port physics/geometry/render controls into modal tabs (Settings → Physics / Geometry / Display)
   - Remove DockBridge once QA signs off on feature parity
5. **Accessibility & Responsiveness**
   - Screen-reader labels for modal controls, better focus trapping on pause/hub overlays
   - Tablet/mobile responsive variants (full-height modals, stacked sections)

## Implementation References

| Area | Files |
| --- | --- |
| Modal stack & sounds | `src/ui/ModalService.ts`, `src/ui/UISoundService.ts` |
| Home Hub & footer actions | `src/ui/HomeHub.ts`, `src/ui/HubSettings.ts`, `src/ui/ShopModal.ts`, `src/ui/ProfileModal.ts`, `src/ui/HelpModal.ts` |
| Pause & in-game navigation | `src/ui/InGameMenu.ts`, `src/ui/HUD.ts` (HUD button opens hub) |
| Dock legacy panels | `src/ui/DockBridge.ts`, `src/ui/*Panel.ts`, `src/ui/panels/*` |
| Styling | `styles/design-tokens.css`, `styles/main.css` |

## QA & Accessibility Checklist

- Verify ESC closes modals before opening the pause menu (ModalService guards this)
- Ensure focus order cycles through modal content + footer actions only
- Confirm Home Hub reopens automatically after closing nested modals (Settings/Profile/Shop call `homeHub.init()` in their `onClose` callbacks)
- Test DockBridge toggle persistence (`localStorage:dock-collapsed`) and ensure renderer resize events keep canvases aligned
- Run `npm run dev` with reduced-motion OS setting to validate that shimmer/glow effects degrade gracefully
