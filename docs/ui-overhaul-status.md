# UI Overhaul Implementation Status

## ✅ Completed
- **Design System**: Implemented neon/arcade aesthetic with `design-tokens.css`.
- **Modal System**: Robust `ModalService` with swapping, back navigation, and click-outside-to-close.
- **Home Hub**: Main menu with mode selection, hero banner, and footer navigation.
- **Settings Modal**: General, Audio, Graphics, and Customization tabs.
- **In-Game Menu**: Pause/Resume functionality with Hub navigation.
- **Profile & Stats**: Persistence of game stats and visual profile modal.
- **Shop**: Cue skin selection with rarity tiers and equipping logic.
- **HUD**: Updated in-game UI (headers, avatars, chips) to match new design language.
- **Dock Bridge**: Legacy dev tools accessible via `Shift+L`.

## 🚧 In Progress / Future
- **Mode Details**: Expand mode cards to show specific stakes/rules before launching.
- **Animations**: Polish transition effects for modal entry/exit.
- **Sound**: Add SFX for UI interactions (button clicks, modal opens).

## Legacy Access
The physics tuning and debug panels are preserved for development use.
- Press **Shift+L** to toggle the legacy side dock.
- "Physics" tab removed from user-facing Settings to simplify the experience.
