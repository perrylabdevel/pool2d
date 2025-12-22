---
name: notification-overhaul
description: Notification system overhaul and editor devtool
---

# Plan

Overhaul the notification system to prevent runaway queueing, add dedupe/priority rules, and introduce a Notification Editor devtool (table‑editor style) to design, preview, and push notification presets live/persisted.

## Requirements
- Prevent infinite notification queues; add limits, dedupe, and drop/merge policies.
- Support priority and channels (system, gameplay, UI) with interruption rules.
- Provide consistent animations with cancelation and safe teardown on scene changes.
- Build a Notification Editor devtool with preview, presets, and live/persist push.

## Scope
- In: notification engine rewrite, new notification config model, devtools editor, RemoteBridge integration, persistence.
- Out: production UI polish, unlock/economy integration, long‑term analytics.

## Files and entry points
- Notification system: `src/ui/NotificationService.ts`, `src/ui/UIStateMachine.ts`, `src/ui/HUD.ts`.
- Settings/persistence: `src/settings/StorageKeys.ts`, `src/ui/SettingsManager.ts`.
- Devtools: `devtools/notification-editor.html`, `devtools/notification-editor/*`.
- Remote bridge: `src/debug/RemoteBridge.ts`.

## Data model / API changes
- NotificationConfig:
  - `maxQueue`, `dedupeWindowMs`, `defaultDurations`, `soundEnabled`, `position`, `layout`, `stylePreset`.
- NotificationRequest:
  - `id`, `message`, `type`, `priority`, `channel`, `dedupeKey`, `duration`, `replaceMode`.
- WebSocket command: `notification-editor:push-config` with `{ config, mode: 'live' | 'persist' }`.
- Local storage key: `notification-editor-pending-config`.

## Action items
[ ] Audit all call sites of `notificationService.show(...)` and classify by channel/priority.
[ ] Redesign NotificationService: bounded queue, dedupe by key+window, max age, and drop/merge rules.
[ ] Add interruption logic: high‑priority can replace current; low‑priority can coalesce or drop.
[ ] Replace multi‑timeout animation with a single state machine + cancel token per banner.
[ ] Add config ingestion + live update path; default to current styling for parity.
[ ] Build Notification Editor devtool (upload/edit presets, preview, simulate queue, push live/persist).
[ ] Add RemoteBridge handling for `notification-editor:push-config` and pending config on restart.
[ ] Add debug logging toggles and a minimal “test spam” generator to validate limits.

## Testing and validation
- Manual: spam 20+ notifications; verify queue stops, dedupe works, and no lingering animations.
- Verify scene transitions clear active + queued notifications cleanly.
- Live/persist push from editor updates behavior immediately and survives restart.
- Check audio toggles obey notification channel and config settings.

## Risks and edge cases
- Race conditions between animation teardown and new notification show.
- Dedupe accidentally hiding critical system warnings.
- Remote config push causing incompatible layouts during active animations.

## Open questions
- Preferred visual style: full‑width banner vs. compact stack toasts?
- Do we want per‑channel positions (e.g., system center, gameplay top)?
- Should high‑priority errors always interrupt current notification?
