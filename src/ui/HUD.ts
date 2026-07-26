// In-match HUD orchestration. Owns the floating chrome: player pods, the shot
// clock, the feedback layer, the end-of-match overlay, and the settings modal.
//
// The HUD is DOM, never canvas, and it is driven by explicit pushes from Game.
// It does not poll the physics world and it never writes to it.

import { SettingsManager } from './SettingsManager';
import { PlayerPod } from './PlayerPods';
import { FeedbackLayer } from './Toasts';
import { EndOverlay, MatchSummary } from './EndOverlay';
import { sound } from './Sound';
import { BALLS_SOLID, BALLS_STRIPE } from '../config';

/** Seconds a player gets to take their shot. */
export const SHOT_CLOCK_SECONDS = 45;

export type Group = 'none' | 'solids' | 'stripes';

export class HUD {
  settingsManager: SettingsManager;
  feedback: FeedbackLayer;
  endOverlay: EndOverlay;

  readonly pods: [PlayerPod, PlayerPod];

  private fpsElement: HTMLElement;
  private upsElement: HTMLElement;
  private modeElement: HTMLElement;
  private statsElement: HTMLElement;
  private hintBar: HTMLElement;
  private muteBtn: HTMLButtonElement;

  private currentPlayer = 1;
  private clockRemaining = SHOT_CLOCK_SECONDS;
  private clockRunning = false;

  showStats = true;

  /** Fired when the shot clock runs out for the active player. */
  onShotClockExpired?: () => void;

  constructor(playerNames: [string, string] = ['You', 'Rival']) {
    this.fpsElement = document.getElementById('fps')!;
    this.upsElement = document.getElementById('ups')!;
    this.modeElement = document.getElementById('mode-indicator')!;
    this.statsElement = document.getElementById('stats')!;
    this.hintBar = document.getElementById('hint-bar')!;
    this.muteBtn = document.getElementById('mute-btn') as HTMLButtonElement;

    this.pods = [
      new PlayerPod(document.getElementById('pod-left')!, playerNames[0], false),
      new PlayerPod(document.getElementById('pod-right')!, playerNames[1], true),
    ];

    this.feedback = new FeedbackLayer();
    this.endOverlay = new EndOverlay();

    this.settingsManager = new SettingsManager();
    this.setupControls();
    this.loadSettings();
    this.setTurn(1);
  }

  // -- controls --------------------------------------------------------------

  private setupControls() {
    const settingsModal = document.getElementById('settings-modal')!;

    document.getElementById('settings-btn')!.addEventListener('click', () => {
      settingsModal.classList.remove('hidden');
    });

    document.getElementById('settings-close')!.addEventListener('click', () => {
      settingsModal.classList.add('hidden');
    });

    settingsModal.addEventListener('click', (e) => {
      if (e.target === settingsModal) settingsModal.classList.add('hidden');
    });

    document.getElementById('restart-btn')!.addEventListener('click', () => {
      window.dispatchEvent(new CustomEvent('game:restart'));
    });

    document.getElementById('debug-toggle')!.addEventListener('click', () => {
      window.dispatchEvent(new CustomEvent('game:debug-toggle'));
    });

    this.muteBtn.addEventListener('click', () => {
      sound.resume();
      this.setMuted(sound.toggleMute());
    });

    const bind = (id: string, apply: (checked: boolean) => void) => {
      const input = document.getElementById(id) as HTMLInputElement | null;
      input?.addEventListener('change', (e) => apply((e.target as HTMLInputElement).checked));
    };

    bind('aim-assist-toggle', (checked) => {
      this.settingsManager.saveGameSettings({ aimAssist: checked });
      window.dispatchEvent(
        new CustomEvent('game:aim-assist-toggle', { detail: { enabled: checked } })
      );
    });

    bind('call-8-toggle', (checked) => {
      this.settingsManager.saveGameSettings({ call8Ball: checked });
    });

    bind('show-fps-toggle', (checked) => {
      this.showStats = checked;
      this.statsElement.classList.toggle('hidden', !checked);
      this.settingsManager.saveGameSettings({ showFPS: checked });
    });

    bind('sound-toggle', (checked) => {
      sound.resume();
      this.setMuted(!checked);
    });

    const colorBindings: Array<[string, keyof import('./SettingsManager').UIColors]> = [
      ['table-color', 'tableColor'],
      ['rail-color', 'railColor'],
      ['active-player-color', 'activePlayerColor'],
      ['turn-indicator-color', 'turnIndicatorColor'],
    ];

    for (const [id, key] of colorBindings) {
      const input = document.getElementById(id) as HTMLInputElement | null;
      input?.addEventListener('input', (e) => {
        this.settingsManager.saveUIColors({ [key]: (e.target as HTMLInputElement).value });
      });
    }

    document.getElementById('settings-reset-ui')!.addEventListener('click', () => {
      this.settingsManager.resetUIColors();
      this.loadSettings();
    });
  }

  private loadSettings() {
    const game = this.settingsManager.getGameSettings();
    const colors = this.settingsManager.getUIColors();

    const setChecked = (id: string, value: boolean) => {
      const input = document.getElementById(id) as HTMLInputElement | null;
      if (input) input.checked = value;
    };

    setChecked('aim-assist-toggle', game.aimAssist);
    setChecked('call-8-toggle', game.call8Ball);
    setChecked('show-fps-toggle', game.showFPS);
    setChecked('sound-toggle', !sound.isMuted());

    this.showStats = game.showFPS;
    this.statsElement.classList.toggle('hidden', !game.showFPS);
    this.setMuted(sound.isMuted());

    const setColor = (id: string, value: string) => {
      const input = document.getElementById(id) as HTMLInputElement | null;
      if (input) input.value = value;
    };

    setColor('table-color', colors.tableColor);
    setColor('rail-color', colors.railColor);
    setColor('active-player-color', colors.activePlayerColor);
    setColor('turn-indicator-color', colors.turnIndicatorColor);
  }

  private setMuted(muted: boolean) {
    sound.setMuted(muted);
    this.muteBtn.classList.toggle('off', muted);
    this.muteBtn.setAttribute('aria-label', muted ? 'Unmute' : 'Mute');
    const toggle = document.getElementById('sound-toggle') as HTMLInputElement | null;
    if (toggle) toggle.checked = !muted;
  }

  // -- stats -----------------------------------------------------------------

  updateFPS(fps: number) {
    this.fpsElement.textContent = `${Math.round(fps)} FPS`;
  }

  updateUPS(ups: number) {
    this.upsElement.textContent = `${Math.round(ups)} UPS`;
  }

  setMode(mode: string) {
    this.modeElement.textContent = mode;
  }

  setHintVisible(visible: boolean) {
    this.hintBar.classList.toggle('faded', !visible);
  }

  // -- turn state ------------------------------------------------------------

  setTurn(player: number, options: { announce?: boolean; name?: string } = {}) {
    this.currentPlayer = player;
    this.pods[0].setActive(player === 1);
    this.pods[1].setActive(player === 2);
    this.resetShotClock();

    if (options.announce) {
      const incoming = this.pods[player - 1];
      this.feedback.show(options.name ?? `Player ${player}`, {
        sub: 'to shoot',
        variant: 'info',
        from: incoming.isMirrored ? 'right' : 'left',
        hold: 900,
      });
      sound.blip();
    }
  }

  getCurrentPlayer(): number {
    return this.currentPlayer;
  }

  /** Push group assignment into both pods. */
  setGroups(player1Group: Group, player2Group: Group) {
    const label: Record<Group, string> = {
      none: 'Table open',
      solids: 'Solids',
      stripes: 'Stripes',
    };

    const ids: Record<Group, number[]> = {
      none: [],
      solids: [...BALLS_SOLID],
      stripes: [...BALLS_STRIPE],
    };

    this.pods[0].setGroupLabel(label[player1Group]);
    this.pods[0].setGroupBalls(ids[player1Group]);
    this.pods[1].setGroupLabel(label[player2Group]);
    this.pods[1].setGroupBalls(ids[player2Group]);
  }

  /** Dim the icons for balls already off the table. */
  setPotted(potted: ReadonlySet<number>) {
    this.pods[0].setPotted(potted);
    this.pods[1].setPotted(potted);
  }

  // -- shot clock ------------------------------------------------------------

  resetShotClock() {
    this.clockRemaining = SHOT_CLOCK_SECONDS;
    this.pods[this.currentPlayer - 1].setTimer(1);
  }

  setShotClockRunning(running: boolean) {
    this.clockRunning = running;
  }

  /** Called once per frame from the game loop. Presentation only. */
  tickShotClock(dt: number) {
    if (!this.clockRunning) return;

    const wasPositive = this.clockRemaining > 0;
    this.clockRemaining = Math.max(0, this.clockRemaining - dt);
    this.pods[this.currentPlayer - 1].setTimer(this.clockRemaining / SHOT_CLOCK_SECONDS);

    if (wasPositive && this.clockRemaining <= 0) {
      this.clockRunning = false;
      this.onShotClockExpired?.();
    }
  }

  // -- feedback --------------------------------------------------------------

  showFoul(message: string) {
    this.feedback.show('Foul', { sub: message, variant: 'foul', hold: 1600 });
    this.feedback.foulFlash();
    sound.foul();
  }

  showBallInHand() {
    this.feedback.show('Ball in hand', {
      sub: 'Drag the cue ball to place it',
      variant: 'info',
      hold: 1800,
    });
  }

  showBreak() {
    this.feedback.show('Break', { sub: 'Rack them up', variant: 'info', hold: 1100 });
  }

  showTableOpen() {
    this.feedback.show('Table open', { sub: 'Groups not yet assigned', variant: 'info' });
  }

  showGroupAssigned(player: number, group: Group) {
    if (group === 'none') return;
    this.feedback.show(group === 'solids' ? 'Solids' : 'Stripes', {
      sub: `Player ${player}`,
      variant: 'pot',
      hold: 1200,
    });
  }

  showCallPocket() {
    this.feedback.show('Call your pocket', { variant: 'info', hold: 1400 });
  }

  showPot(ballId: number, pocketScreen: { x: number; y: number }, player: number) {
    this.feedback.flyPottedBall(ballId, pocketScreen, this.pods[player - 1].getAvatarCenter());
  }

  showMatchEnd(summary: MatchSummary) {
    this.feedback.show(summary.headline, {
      variant: summary.won ? 'win' : 'neutral',
      hold: 1200,
    });
    if (summary.won) sound.fanfare();
    window.setTimeout(() => this.endOverlay.show(summary), 1500);
  }

  reset() {
    this.feedback.clear();
    this.endOverlay.hide();
    this.setGroups('none', 'none');
    this.setPotted(new Set());
    this.setTurn(1);
    this.resetShotClock();
  }
}
