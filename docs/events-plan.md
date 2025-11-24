# Events Implementation Plan

## Current State
- Lobby card routes to `UIState.EVENTS`, which renders `EventsScene` with three placeholder cards and console log click handlers only.
- No event detail scenes exist; UIStateMachine/SceneController do not know about individual events.
- EventsScene lacks keyboard handling (e.g., Escape to return), and the layout is fixed to three 400px-tall cards with no responsive stacking.
- Currency and rewards are not connected to player data; NavigationBar shows static placeholder balances.

## Goals
- Stand up an Events hub that routes into individual event scenes.
- Ship Golden Spin as the first playable event with a canvas-based wheel, spin animation, and reward reveal.
- Establish data contracts for events (ids, labels, prize tables, CTA, navigation) to make future events easy to slot in.

## Architecture & Navigation
- **UI State**: Add `UIState.EVENT_GOLDEN_SPIN` (and similar per-event states later). Keep `UIState.EVENTS` as the hub.
- **Scenes**:
  - `EventsScene`: hub cards (data-driven), back to Lobby, triggers state transitions into specific events.
  - `GoldenSpinScene`: owns wheel rendering, spin logic, rewards, CTA, and local balances until a shared wallet exists.
- **Data**:
  - Event catalog: `{ id, title, subtitle, icon, color, state, badge/cta }` used by the hub.
  - Golden Spin prizes: weighted slices `{ label, amount, type: 'coins'|'gold', weight, color }`.
- **Input**: Pointer + ESC/back support. SceneController already handles transitions and canvas sizing.

## Golden Spin Experience
- **Layout**: Navigation bar (back to Events), hero wheel centered, pointer at top, CTA row with spin button + cost, reward toast panel, and mini balance pills.
- **Wheel**: 10–12 slices alternating warm gold/orange hues; labels like `+500 COINS`, `+5 GOLD`, `JACKPOT`. Pointer is static; the wheel rotates underneath.
- **Spin Mechanics**:
  - Weighted random prize pick; target rotation is N full spins + slice center alignment.
  - Easing curve (ease-out cubic) for deceleration; 3–4s total duration.
  - Lock inputs while spinning; show result label and update local balances on settle.
  - Optional cooldown state to prevent spam (short debounce).
- **Rewards**:
  - Local balances stored in-scene (e.g., coins/gold). Later hook into a shared wallet/store when available.
  - Reward recap text: “You won 5,000 coins!” and a history of the last few spins (in-memory).

## Implementation Steps
1) Wire an event catalog in `EventsScene` (card data → UIState transitions) and add ESC/back handling.
2) Extend `UIStateMachine` + `SceneController` with `EVENT_GOLDEN_SPIN`; register the new scene.
3) Build `GoldenSpinScene`:
   - Canvas wheel renderer (segments, pointer, center hub), hoverable Spin CTA, reward toast, and balance display.
   - Spin state machine (idle → spinning → reveal) with weighted prize selection and easing animation.
   - Update local balances and append to a short reward history.
4) Hook Events hub actions to Golden Spin, ensure transitions work from Lobby → Events → Golden Spin → back.
5) Smoke test manually: window resize, hover/click states, multiple spins, back navigation, and spin lockout while animating.
