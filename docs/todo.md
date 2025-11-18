Project TODO

- Rules UI Panel
  - Preset selector (Casual/Tournament/APA/Practice/House)
  - Toggles: legal break, rail contact, slop, BIH anywhere, BIH disallow touching, early-8 loss, 8-with-foul loss
  - Options: 8-on-break behavior (WIN/SPOT+LOSE/SPOT+CONTINUE), break-scratch placement (KITCHEN/ANYWHERE)
  - Shot clock input (0 = off)

- Rules enforcement follow-ups
  - Legal break exact rule (4 balls contact cushions OR pocketed) instead of simplified check
  - BIH placement: enforce non-touching vs. other balls during drag
  - Kitchen-only placement mode when specified (break scratch)
  - Called-shots UI (per-table overrides later)

- Docs
  - Expand README with Rules panel instructions once implemented
  - Keep docs/rules/eight-ball-rules.md in sync with enforcement

- Branding cleanup
  - Rename technical identifiers (storage keys, filenames, package name, etc.) from pool2d to RailRush and migrate persisted settings

- Audio polish
  - Extend Audio Mixer with per-event sample selection / EQ / reverb depth
  - Add stereo imaging and positional damping once ball positions feed the mixer
  - Add live preview visualization / waveform for each sound slot
