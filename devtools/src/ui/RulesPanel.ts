import { UIPanel } from '../../../src/ui/panels/UIPanel';
import { RemoteSettingsManager } from '../../RemoteSettingsManager';
import {
  RULES_PRESETS,
  getRulesDescription,
  validateRulesConfig,
  type RulesConfig,
} from '../../../src/rules/RulesConfig';

const PRESET_LABELS: Record<string, string> = {
  CASUAL: 'Casual',
  TOURNAMENT: 'Tournament',
  APA: 'APA',
  PRACTICE: 'Practice',
  HOUSE_8BALL: 'House 8-Ball',
  CUSTOM: 'Custom',
};

export class RulesPanel {
  private panel: HTMLElement;
  private panelController: UIPanel;
  private settingsManager: RemoteSettingsManager;
  private rulesConfig: RulesConfig;

  constructor(settingsManager: RemoteSettingsManager) {
    this.settingsManager = settingsManager;
    this.rulesConfig = settingsManager.getRulesConfig();
    this.panel = this.createPanel();

    const focusTarget = this.panel.querySelector<HTMLElement>('input, select, button');
    this.panelController = new UIPanel({
      id: 'rules-panel',
      element: this.panel,
      focusTarget,
    });

    this.settingsManager.addEventListener('state-updated', () => {
      this.rulesConfig = this.settingsManager.getRulesConfig();
      this.updateUI();
    });

    window.addEventListener('settings:rules-changed', () => {
      this.rulesConfig = this.settingsManager.getRulesConfig();
      this.updateUI();
    });

    this.panelController.addEventListener('panel:open', () => this.updateUI());

    this.bindEvents();
    this.updateUI();
  }

  getController(): UIPanel {
    return this.panelController;
  }

  private createPanel(): HTMLElement {
    let panel = document.getElementById('rules-panel');
    if (panel) {
      return panel;
    }

    const dock = document.getElementById('panel-dock');
    panel = document.createElement('div');
    panel.id = 'rules-panel';
    panel.className = 'panel-dock-card';

    panel.innerHTML = `
      <div class="panel-header">
        <h3>📜 8-Ball Rules</h3>
      </div>
      <div class="panel-content">
        <div class="settings-group">
          <h4 class="settings-group-title">Preset</h4>
          <div class="panel-input-row" style="display:flex; align-items:center; gap:8px;">
            <label for="rules-preset-select" style="min-width: 120px;">Ruleset</label>
            <select id="rules-preset-select">
              ${Object.keys(PRESET_LABELS).map((key) => `<option value="${key}">${PRESET_LABELS[key]}</option>`).join('')}
            </select>
          </div>
        </div>

        <div class="settings-group">
          <h4 class="settings-group-title">Core</h4>
          <label class="panel-toggle-row">
            <input type="checkbox" data-rule-key="enforceGroupAssignment" />
            <span>Enforce Groups (solids/stripes)</span>
          </label>
          <label class="panel-toggle-row">
            <input type="checkbox" data-rule-key="enforceEarly8BallLoss" />
            <span>Early 8-Ball Loss</span>
          </label>
        </div>

        <div class="settings-group">
          <h4 class="settings-group-title">Break</h4>
          <label class="panel-toggle-row">
            <input type="checkbox" data-rule-key="requireLegalBreak" />
            <span>Require Legal Break</span>
          </label>
          <label class="panel-toggle-row">
            <input type="checkbox" data-rule-key="allow8BallBreakWin" />
            <span>8-Ball Win on Break</span>
          </label>
          <label class="panel-toggle-row">
            <input type="checkbox" data-rule-key="scratch8BallOnBreakLoss" />
            <span>Scratch + 8 on Break = Loss</span>
          </label>
          <div class="panel-input-row" style="display:flex; align-items:center; gap:8px;">
            <label for="break-behavior-select" style="min-width: 140px;">8-Ball on Break</label>
            <select id="break-behavior-select" data-rule-key="breakEightBallBehavior">
              <option value="WIN">Win</option>
              <option value="SPOT_LOSE_TURN">Spot + Lose Turn</option>
              <option value="SPOT_CONTINUE">Spot + Continue</option>
            </select>
          </div>
          <div class="panel-input-row" style="display:flex; align-items:center; gap:8px;">
            <label for="break-scratch-select" style="min-width: 140px;">Break Scratch</label>
            <select id="break-scratch-select" data-rule-key="breakScratchPlacement">
              <option value="KITCHEN">Kitchen Only</option>
              <option value="ANYWHERE">Anywhere</option>
            </select>
          </div>
        </div>

        <div class="settings-group">
          <h4 class="settings-group-title">Shot Rules</h4>
          <label class="panel-toggle-row">
            <input type="checkbox" data-rule-key="requireRailContact" />
            <span>Require Rail Contact (no pocket)</span>
          </label>
          <label class="panel-toggle-row">
            <input type="checkbox" data-rule-key="requireCalled8Ball" />
            <span>Call 8-Ball</span>
          </label>
          <label class="panel-toggle-row">
            <input type="checkbox" data-rule-key="requireCalledShots" />
            <span>Call Every Shot</span>
          </label>
          <label class="panel-toggle-row">
            <input type="checkbox" data-rule-key="allowSlop" />
            <span>Allow Slop</span>
          </label>
        </div>

        <div class="settings-group">
          <h4 class="settings-group-title">Ball-in-Hand</h4>
          <label class="panel-toggle-row">
            <input type="checkbox" data-rule-key="ballInHandAnywhere" />
            <span>Ball in Hand Anywhere</span>
          </label>
          <label class="panel-toggle-row">
            <input type="checkbox" data-rule-key="bihDisallowTouchingBalls" />
            <span>Disallow Touching Balls</span>
          </label>
        </div>

        <div class="settings-group">
          <h4 class="settings-group-title">Advanced</h4>
          <label class="panel-toggle-row">
            <input type="checkbox" data-rule-key="enablePushOut" />
            <span>Enable Push Out</span>
          </label>
          <label class="panel-toggle-row">
            <input type="checkbox" data-rule-key="enableThreeFoulRule" />
            <span>Three-Foul Rule</span>
          </label>
          <div class="panel-input-row" style="display:flex; align-items:center; gap:8px;">
            <label for="shot-clock-input" style="min-width: 140px;">Shot Clock (sec)</label>
            <input id="shot-clock-input" type="number" min="0" step="5" style="max-width:120px;" />
          </div>
        </div>

        <div class="settings-group">
          <h4 class="settings-group-title">Fouls</h4>
          <label class="panel-toggle-row">
            <input type="checkbox" data-rule-key="scratchIsFoul" />
            <span>Scratch Is Foul</span>
          </label>
          <label class="panel-toggle-row">
            <input type="checkbox" data-rule-key="noContactIsFoul" />
            <span>No Contact Is Foul</span>
          </label>
          <label class="panel-toggle-row">
            <input type="checkbox" data-rule-key="wrongBallFirstIsFoul" />
            <span>Wrong Ball First Is Foul</span>
          </label>
        </div>
      </div>
    `;

    if (dock) {
      dock.appendChild(panel);
    } else {
      document.body.appendChild(panel);
    }

    return panel;
  }

  private bindEvents(): void {
    const presetSelect = this.panel.querySelector<HTMLSelectElement>('#rules-preset-select');
    presetSelect?.addEventListener('change', () => {
      const value = presetSelect.value;
      if (value !== 'CUSTOM' && RULES_PRESETS[value as keyof typeof RULES_PRESETS]) {
        const preset = RULES_PRESETS[value as keyof typeof RULES_PRESETS];
        this.rulesConfig = { ...preset };
        this.applyConfig();
      }
    });

    const breakBehaviorSelect = this.panel.querySelector<HTMLSelectElement>('#break-behavior-select');
    breakBehaviorSelect?.addEventListener('change', () => {
      this.updateRuleValue('breakEightBallBehavior', breakBehaviorSelect.value as RulesConfig['breakEightBallBehavior']);
    });

    const breakScratchSelect = this.panel.querySelector<HTMLSelectElement>('#break-scratch-select');
    breakScratchSelect?.addEventListener('change', () => {
      this.updateRuleValue('breakScratchPlacement', breakScratchSelect.value as RulesConfig['breakScratchPlacement']);
    });

    const shotClockInput = this.panel.querySelector<HTMLInputElement>('#shot-clock-input');
    shotClockInput?.addEventListener('change', () => {
      const value = Number(shotClockInput.value);
      this.updateRuleValue('shotClockSeconds', Number.isFinite(value) ? value : 0);
    });

    const ruleToggles = this.panel.querySelectorAll<HTMLInputElement>('input[type="checkbox"][data-rule-key]');
    ruleToggles.forEach((toggle) => {
      toggle.addEventListener('change', () => {
        const key = toggle.dataset.ruleKey as keyof RulesConfig;
        this.updateRuleValue(key, toggle.checked as any);
      });
    });
  }

  private updateRuleValue<K extends keyof RulesConfig>(key: K, value: RulesConfig[K]) {
    this.rulesConfig = { ...this.rulesConfig, [key]: value };
    this.applyConfig();
  }

  private applyConfig() {
    const config = { ...this.rulesConfig };
    validateRulesConfig(config);
    this.rulesConfig = config;
    this.settingsManager.saveRulesConfig(config);
    this.updateUI();
  }

  private updateUI() {
    const preset = getRulesDescription(this.rulesConfig);
    const presetSelect = this.panel.querySelector<HTMLSelectElement>('#rules-preset-select');
    if (presetSelect && document.activeElement !== presetSelect) {
      presetSelect.value = PRESET_LABELS[preset] ? preset : 'CUSTOM';
    }

    const breakBehaviorSelect = this.panel.querySelector<HTMLSelectElement>('#break-behavior-select');
    if (breakBehaviorSelect && document.activeElement !== breakBehaviorSelect) {
      breakBehaviorSelect.value = this.rulesConfig.breakEightBallBehavior ?? 'SPOT_LOSE_TURN';
    }

    const breakScratchSelect = this.panel.querySelector<HTMLSelectElement>('#break-scratch-select');
    if (breakScratchSelect && document.activeElement !== breakScratchSelect) {
      breakScratchSelect.value = this.rulesConfig.breakScratchPlacement ?? 'KITCHEN';
    }

    const shotClockInput = this.panel.querySelector<HTMLInputElement>('#shot-clock-input');
    if (shotClockInput && document.activeElement !== shotClockInput) {
      shotClockInput.value = String(this.rulesConfig.shotClockSeconds ?? 0);
    }

    const ruleToggles = this.panel.querySelectorAll<HTMLInputElement>('input[type="checkbox"][data-rule-key]');
    ruleToggles.forEach((toggle) => {
      const key = toggle.dataset.ruleKey as keyof RulesConfig;
      const next = Boolean(this.rulesConfig[key]);
      if (document.activeElement !== toggle) {
        toggle.checked = next;
      }
    });
  }
}
