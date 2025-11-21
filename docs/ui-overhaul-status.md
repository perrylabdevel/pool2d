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

## 🚧 In Progress
- **Canvas Lobby / Play Modes polish**: Core layout is in place, but needs hero effects, matchmaking cards, and better controller support.
- **Canvas Shop/Profile scenes**: Currently “Coming soon” placeholders; must port cue carousel, stats, and CTA stacks from the modal components.
- **Settings Scene + Home Hub Sunset**: Legacy DOM hub still boots the game; once scenes cover all workflows, remove `homeHub.init()` from the default flow.
- **Pause-on-swipe bug**: Addressed, but keep regression tests running whenever input suppression changes land.

## 📋 Next Up
- Replace placeholder art with gradient/metallic canvas widgets that reuse design tokens.
- Wire cue loadouts + profile data from `SettingsManager` into their respective scenes.
- Add focus management + keyboard navigation to every canvas scene before shipping to players.

## Legacy Access
The physics tuning and debug panels are preserved for development use.
- Press **Shift+L** to toggle the legacy side dock.
- "Physics" tab removed from user-facing Settings to simplify the experience.
