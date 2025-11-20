Project TODO

- Rules UX polish
  - Build non-blocking HUD pocket selector + illegal-break choice dialog
  - Surface active rules preset in HUD header (text + icon indicator)
  - Extend called-shot flow beyond 8-ball (when `requireCalledShots` enabled)

- Docs & knowledge base
  - Keep `docs/rules/eight-ball-rules.md` aligned with current enforcement and planned UX
  - Fold `docs/ui-overhaul-plan.md` + `ui-overhaul-status.md` into a single living UI architecture doc
  - Convert `docs/pocket-animation-plan.md` into a tuning/how-to guide that references live CONFIG hooks
  - Add Audio pipeline summary + asset instructions to README “Audio & Accessibility” section (link to prompts)

- Branding & persistence
  - Rename storage keys/package metadata from `pool2d` to `RailRush` and migrate saved settings

- Audio polish
  - Extend Audio Mixer with per-event sample selection / EQ / reverb depth
  - Add stereo imaging and positional damping once ball positions feed the mixer
  - Add live preview visualization / waveform for each sound slot
