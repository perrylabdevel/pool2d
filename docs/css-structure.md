# CSS Structure

This project now composes global styling from focused CSS modules:

1. `styles/design-tokens.css` – color palette, gradients, spacing, typography tokens, and utility helpers.
2. `styles/base.css` – reset rules, shared button/icon styles, and global CSS variables consumed by components.
3. `styles/layout.css` – workspace grid, dock containers, canvas stack positioning, and the docking/launcher chrome.
4. `styles/hud.css` – HUD header, player cards, ball chips, foul banner, and related HUD controls.
5. `styles/panels.css` – docked panel cards, floating tool windows, sliders, panel launcher, and color-setting widgets.
6. `styles/overlays.css` – reference overlay image toggles and the recording playback overlay indicator.
7. `styles/recording-playback.css` – recording and playback panel chrome, button groups, timers, and scrubber rows.
8. `styles/responsive.css` – media queries for tablet/mobile/landscape/touch specific adjustments.
9. `styles/main.css` – single entry point that imports the above files (order: base → layout → components → overlays → responsive). Only this file should be linked by HTML/TS imports.

When adding new component styles, prefer creating a dedicated module in `styles/` and importing it from `main.css` to keep concerns isolated.
