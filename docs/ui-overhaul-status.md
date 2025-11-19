# UI Overhaul Implementation Status

## ✅ Completed
- **Design System**: Implemented neon/arcade aesthetic with `design-tokens.css`.
- **Button Kit**: Standardized all buttons with `.btn-arcade` classes (Primary, Glass, Danger, Icon).
- **Modal System**: Robust `ModalService` with swapping, back navigation, and `confirm()` dialogs.
- **Notification System**: Replaced legacy banners with `NotificationService` (Toast messages for fouls/updates).
- **UI Sound Kit**: Synth-driven hover/click/modal/toast cues via `UISoundService`, with mixer controls and modern settings sliders for Master/Music/UI channels.
- **Home Hub**: Main menu with mode selection, hero banner, and footer navigation.
- **Settings Modal**: General, Audio, Graphics, and Customization tabs.
- **In-Game Menu**: Pause/Resume functionality with Hub navigation.
- **Profile & Stats**: Persistence of game stats and visual profile modal.
- **Shop**: Cue skin selection with rarity tiers and equipping logic.
- **HUD**: Updated in-game UI (headers, avatars, chips) to match new design language.
- **Dock Bridge**: Legacy dev tools accessible via `Shift+L`.

## 🚧 In Progress / Future
- **Pause-on-swipe bug**: Fixed. Canvas now retains focus during shots when dragging past edges, and game auto-pauses on window blur.

## Legacy Access
The physics tuning and debug panels are preserved for development use.
- Press **Shift+L** to toggle the legacy side dock.
- "Physics" tab removed from user-facing Settings to simplify the experience.
