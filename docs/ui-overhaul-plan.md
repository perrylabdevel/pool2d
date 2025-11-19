## UI Overhaul Plan – Miniclip-Style Menus

### 1. Research & Direction
- Capture references from Miniclip 8 Ball Pool (home lobby, mode popups, special offers) to understand their chrome gradients, neon glows, and motion cues.
- Extract a palette (electric blues/greens, warm gold accents, deep navy background) and an all-caps condensed heading font pairing to match their arcade aesthetic.

### 2. Design System Foundations
- Define CSS design tokens (e.g., `--menu-chrome-start`, `--menu-chrome-end`, glow intensities) inside `styles/design-tokens.css` so both modals and the docked panels can share the look.
- Build reusable utility classes for frosted backgrounds, radial glows, blur overlays, and metallic borders.

### 3. Layout Strategy During Transition
- Introduce the hub-style modal layer on top of the existing docked panels, but treat the dock purely as a temporary dev tool:
  - Route the dock through a lightweight `DockBridge` wrapper so it can be summoned (e.g., `Shift+D`) for debugging while the hub is in place.
  - Persist the last dock state only for the transition period; once the new hub is signed off, the bridge and legacy layout will be removed entirely.
  - Keep the hub as the default entry point so every new feature is built against the final experience even before the dock is fully retired.

### 4. Modal Shell & Navigation Patterns
- Create a `ModalService` (TypeScript) with stacking, focus trapping, and animated enter/exit similar to Miniclip’s popups (scale+slide).
- Standardize modal sections: header (title + currency/status), body (grid/carousel), footer (primary CTA + secondary).
- Implement a home hub layout: hero banner, mode cards, offer carousel, and a utility bar with profile/currency—mirroring Miniclip’s lobby feel.

### 5. Component Redesign
- **Panels/Modals**: Refactor the existing panels in `src/ui/panels` to optionally render inside the new chrome shell with gradient borders and inner shadows.
- **Buttons**: Introduce a button kit with glowing borders, icon slots, and lock states; ensure hover states mimic Miniclip’s energetic animations.
- **HUD Integration**: Update HUD overlays (`src/ui/HUD.ts`) so modal overlays don’t clash; chips adopt new chrome tokens for consistency.

### 6. Interaction & Motion
- Define keyframe sets for shimmer, pulsing CTAs, and parallax hover states; reuse them via utility classes.
- Add subtle particle or light-sweep effects on highlight cards to capture the arcade energy.
- Maintain performance safeguards (reduced effects on low-power devices).

### 7. Information Architecture & Dock Sunset
- Modal templates to cover core flows:
  1. **Play Modes**: grid of stakes/entry fees, CTA per tile.
  2. **Cue/Shop**: horizontal carousels with rarity badges.
  3. **Settings/Profile**: tabbed interior built entirely for the hub; dock compatibility is only needed via the temporary bridge for regression checks.
- Define clear acceptance criteria for each modal so we know when the dock can be permanently removed (e.g., all settings migrated, QA sign-off obtained).

### 8. Responsive Behaviour
- Desktop: hub modal centered at ~70% width, with dock toggle accessible near the header.
- Tablet: modal scales down, sections stack vertically; dock toggle stays in overflow menu.
- Mobile: full-screen modal with swipe-to-close, persistent bottom CTA tray; docking fallback becomes a simplified drawer.

### 9. Implementation Phases
1. Add tokens + global styles (CSS variables, utility classes).
2. Build modal shell + `ModalService`, wire up the temporary DockBridge toggle.
3. Recreate home hub / play modes in the new shell.
4. Migrate shop, settings, and other panels; keep dock accessible only through the bridge for verification.
5. Remove DockBridge once stakeholders confirm parity; follow with polish and QA passes.

### 10. Validation
- Stand up a playground route (or Storybook) for modal previews.
- Test keyboard navigation, screen-reader focus order, and dock/hub toggle persistence.
- Run performance checks (FPS + memory) to ensure glow effects remain lightweight.

By keeping the dock infrastructure intact and wrapping it with a toggleable hub overlay, we get the Miniclip-inspired cinematic experience without sacrificing the existing workflow-oriented docking system.***
