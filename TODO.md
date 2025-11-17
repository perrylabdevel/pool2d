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
  - Keep EIGHT_BALL_RULES.md in sync with enforcement

- Audio polish
  - Extend Audio Mixer with per-event sample selection / EQ / reverb depth
  - Allow separate ADSR envelopes (attack/decay/sustain/release) per sound
  - Add live preview visualization / waveform for each sound slot
