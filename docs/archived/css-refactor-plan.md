Planned steps to split and de-bloat CSS (keep behaviour intact)

1) Map the current CSS
   - Inventory major sections/components in `styles/main.css` (panels, HUD, loading screen, overlays, playback/recording, responsive media queries).
   - Note duplicated blocks and obvious candidates for separation.

2) Define file structure
   - Create a small set of thematic files (examples): `base.css` (reset/vars), `layout.css` (grid/containers), `hud.css`, `panels.css`, `overlays.css`, `recording-playback.css`, `responsive.css`.
   - Keep names aligned with existing UI areas.

3) Extract incrementally
   - Move one logical section at a time into its new file.
   - Replace the section in `main.css` with an import (or remove it if the bundler concatenates via JS/Vite).
   - After each move, run the app and visually sanity-check key screens.

4) Deduplicate while moving
   - Remove repeated blocks (e.g., duplicate playback/touch media queries) during extraction so only one canonical definition lands in the new file.

5) Wire imports once
   - Update the single CSS entry point (e.g., `styles/main.css` or `src/main.ts` if importing there) to pull in the new files in order (base → layout → components → responsive).
   - Keep variable definitions before consumers.

6) Validate responsive/interaction states
   - Manually check panel open/close, drag, recording/playback overlays, HUD, and mobile/landscape breakpoints after the split.

7) Cleanup and docs
   - Remove emptied sections from `main.css`.
   - Add brief comments at the top of each new file describing contents.
   - Keep this plan for reference; optionally add a short summary to README or a `styles/STRUCTURE.md`.

