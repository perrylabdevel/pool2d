# UI Overhaul Implementation Status

## ✅ Completed
- **Design System**: Neon/arcade aesthetic with `design-tokens.css`.
- **Button Kit**: `.btn-arcade` classes (Primary, Glass, Danger, Icon).
- **Modal System**: Robust `ModalService` with swapping, back navigation, and `confirm()` dialogs.
- **Notification System**: `NotificationService` toast pipeline for fouls/updates.
- **UI Sound Kit**: Synth-driven hover/click/modal/toast cues via `UISoundService`, with mixer controls.
- **HUD Refresh**: Updated in-game UI (headers, avatars, chips) to match the new design language.
- **Dock Bridge**: Legacy dev tools accessible via `Shift+L`.
- **Canvas Infrastructure**: `UIStateMachine`, `SceneController`, and `#ui-stage` canvas layering built on top of the renderer.
- **Navigation Bar Component**: Reusable `NavigationBar` component matching in-game HUD styling:
  - Consistent 104px height across all scenes
  - Profile, settings, and currency pills accessible from every scene
  - Context-aware back button with proper state transitions
  - Integrated into all scenes (Lobby, Shop, Profile, PlayModes, Settings)
- **Scene Backgrounds**: Unified `SceneBackground` component with themed grid backgrounds:
  - 5 color themes (blue, red, yellow, purple, green) for visual variety
  - Subtle 60px grid overlay with radial center glow
  - Consistent aesthetic across all UI scenes
- **Canvas Scenes Complete**:
  - **LobbyScene**: Grid-based card layout with play modes, shop, profile access
  - **PlayModesScene**: Game mode selection (Practice, 8-Ball, Time Attack)
  - **ShopScene**: Cue workshop with card-based equipment browser and equip system
  - **ProfileScene**: Player stats, achievements, and rank display
  - **SettingsScene**: Tabbed settings (Gameplay, Colors, Audio) with all controls functional
  - **ConfirmScene**: Modal-style confirmation dialogs for destructive actions
  - **InGameMenuScene**: Pause menu with return to game, settings, and lobby options
  - **LeagueScene**: Full-screen standings list with dynamic headers, sticky section headers, and premium visual styling

## 🚧 In Progress
- **Settings Scene + Home Hub Sunset**: Legacy DOM hub still boots the game; once scenes cover all workflows, remove `homeHub.init()` from the default flow.

## 📋 Next Up
- Replace placeholder art with gradient/metallic canvas widgets that reuse design tokens.
- Add focus management + keyboard navigation to every canvas scene before shipping to players.
- Implement matchmaking/lobby system for multiplayer
- Add hero effects and animations to scene transitions
- Implement cue customization beyond color selection (patterns, materials, effects)
- Add more profile stats and achievement tracking
- Build out mini-games section

## Legacy Access
The physics tuning and debug panels are preserved for development use.
- Press **Shift+L** to toggle the legacy side dock.
- "Physics" tab removed from user-facing Settings to simplify the experience.
