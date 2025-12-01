import { modalService } from './ModalService';
import { SettingsManager } from './SettingsManager';
import { uiStateMachine, UIState } from './UIStateMachine';

export class HubSettings {
  private settingsManager: SettingsManager;

  constructor(settingsManager: SettingsManager) {
    this.settingsManager = settingsManager;
  }

  open(onClose?: () => void) {
    const container = document.createElement('div');
    container.style.display = 'flex';
    container.style.flexDirection = 'column';
    container.style.height = '100%';
    container.style.gap = '16px';

    // Tabs
    const tabs = document.createElement('div');
    tabs.style.display = 'flex';
    tabs.style.gap = '8px';
    tabs.style.borderBottom = '1px solid rgba(255,255,255,0.1)';
    tabs.style.paddingBottom = '8px';

    const tabContent = document.createElement('div');
    tabContent.style.flex = '1';
    tabContent.style.overflowY = 'auto';
    tabContent.style.paddingRight = '8px'; // Space for scrollbar

    const createTab = (label: string, active: boolean, render: () => HTMLElement) => {
      const btn = document.createElement('button');
      btn.textContent = label;
      btn.className = active ? 'hub-tab-btn active' : 'hub-tab-btn';

      btn.style.background = 'transparent';
      btn.style.border = 'none';
      btn.style.color = active ? 'var(--color-arcade-blue)' : 'rgba(255,255,255,0.6)';
      btn.style.padding = '8px 16px';
      btn.style.cursor = 'pointer';
      btn.style.borderBottom = active ? '2px solid var(--color-arcade-blue)' : '2px solid transparent';
      btn.style.fontWeight = active ? 'bold' : 'normal';
      btn.style.transition = 'all 0.2s ease';

      btn.onclick = () => {
        // Switch tab logic
        Array.from(tabs.children).forEach((c: any) => {
          c.style.color = 'rgba(255,255,255,0.6)';
          c.style.borderBottomColor = 'transparent';
          c.style.fontWeight = 'normal';
        });
        btn.style.color = 'var(--color-arcade-blue)';
        btn.style.borderBottomColor = 'var(--color-arcade-blue)';
        btn.style.fontWeight = 'bold';

        tabContent.innerHTML = '';
        tabContent.appendChild(render());
      };

      tabs.appendChild(btn);

      if (active) {
        tabContent.appendChild(render());
      }
    };

    createTab('General', true, () => this.renderGeneralSettings());
    createTab('Audio', false, () => this.renderAudioSettings());
    createTab('Graphics', false, () => this.renderGraphicsSettings());
    createTab('Customization', false, () => this.renderCustomizationSettings());
    // Physics removed from here, accessible via Legacy Dock (Shift+D)

    container.appendChild(tabs);
    container.appendChild(tabContent);

    modalService.show({
      title: 'SETTINGS',
      content: container,
      className: 'settings-modal',
      footer: this.createFooter(onClose)
    });
  }

  renderCustomizationSettings() {
    const div = document.createElement('div');
    div.style.padding = '8px 0';

    // Open full customization scene button
    const openFullBtn = document.createElement('button');
    openFullBtn.textContent = '🎨 Open Table Themes';
    openFullBtn.style.width = '100%';
    openFullBtn.style.padding = '14px';
    openFullBtn.style.marginBottom = '16px';
    openFullBtn.style.background = 'linear-gradient(135deg, #2ecc71, #27ae60)';
    openFullBtn.style.border = 'none';
    openFullBtn.style.borderRadius = '8px';
    openFullBtn.style.color = '#fff';
    openFullBtn.style.fontSize = '15px';
    openFullBtn.style.fontWeight = '600';
    openFullBtn.style.cursor = 'pointer';
    openFullBtn.onclick = () => {
      modalService.close();
      uiStateMachine.transitionTo(UIState.CUSTOMIZATION);
    };
    div.appendChild(openFullBtn);

    // Quick color pickers
    const quickLabel = document.createElement('div');
    quickLabel.textContent = 'Quick Colors';
    quickLabel.style.fontSize = '12px';
    quickLabel.style.color = 'rgba(255,255,255,0.5)';
    quickLabel.style.marginBottom = '8px';
    div.appendChild(quickLabel);

    const colors = this.settingsManager.getUIColors();

    const createColorPicker = (label: string, val: string, onChange: (v: string) => void) => {
      const row = document.createElement('div');
      row.style.display = 'flex';
      row.style.justifyContent = 'space-between';
      row.style.alignItems = 'center';
      row.style.marginBottom = '12px';
      row.style.padding = '8px';
      row.style.background = 'rgba(255,255,255,0.03)';
      row.style.borderRadius = '6px';

      const lbl = document.createElement('label');
      lbl.textContent = label;

      const input = document.createElement('input');
      input.type = 'color';
      input.value = val;
      input.style.background = 'transparent';
      input.style.border = 'none';
      input.style.width = '40px';
      input.style.height = '30px';
      input.style.cursor = 'pointer';

      input.oninput = (e: any) => onChange(e.target.value);

      row.appendChild(lbl);
      row.appendChild(input);
      return row;
    };

    div.appendChild(createColorPicker('Table Cloth', colors.tableColor, (v) => this.settingsManager.saveUIColors({ tableColor: v })));
    div.appendChild(createColorPicker('Table Frame', colors.frameColor, (v) => this.settingsManager.saveUIColors({ frameColor: v })));
    div.appendChild(createColorPicker('Rail Cushion', colors.railColor, (v) => this.settingsManager.saveUIColors({ railColor: v })));
    div.appendChild(createColorPicker('Cue Stick', colors.cueStickColor, (v) => this.settingsManager.saveUIColors({ cueStickColor: v })));
    div.appendChild(createColorPicker('Active Player', colors.activePlayerColor, (v) => this.settingsManager.saveUIColors({ activePlayerColor: v })));

    return div;
  }

  renderGeneralSettings() {
    const div = document.createElement('div');
    div.style.padding = '8px 0';
    div.innerHTML = `
        <p style="color: #888; margin-bottom: 16px;">Game Preferences</p>
      `;

    // Example toggle
    const settings = this.settingsManager.getGameSettings();

    const createToggle = (label: string, checked: boolean, onChange: (v: boolean) => void) => {
      const row = document.createElement('div');
      row.style.display = 'flex';
      row.style.justifyContent = 'space-between';
      row.style.alignItems = 'center';
      row.style.marginBottom = '12px';
      row.style.padding = '8px';
      row.style.background = 'rgba(255,255,255,0.03)';
      row.style.borderRadius = '6px';

      const lbl = document.createElement('span');
      lbl.textContent = label;

      const toggleWrapper = document.createElement('label');
      toggleWrapper.className = 'arcade-toggle';

      const input = document.createElement('input');
      input.type = 'checkbox';
      input.checked = checked;
      input.onchange = (e: any) => onChange(e.target.checked);

      const slider = document.createElement('span');
      slider.className = 'arcade-toggle-slider';

      toggleWrapper.appendChild(input);
      toggleWrapper.appendChild(slider);

      row.appendChild(lbl);
      row.appendChild(toggleWrapper);
      return row;
    };

    div.appendChild(createToggle('Show FPS', settings.showFPS, (v) => this.settingsManager.saveGameSettings({ showFPS: v })));
    div.appendChild(createToggle('Aim Assist', settings.aimAssist, (v) => this.settingsManager.saveGameSettings({ aimAssist: v })));
    div.appendChild(createToggle('Call 8-Ball', settings.call8Ball, (v) => this.settingsManager.saveGameSettings({ call8Ball: v })));

    return div;
  }

  renderAudioSettings() {
    const div = document.createElement('div');
    div.style.padding = '8px 0';
    div.style.display = 'flex';
    div.style.flexDirection = 'column';
    div.style.gap = '16px';
    const settings = this.settingsManager.getAudioSettings();

    const createSliderBlock = (label: string, value: number, onChange: (v: number) => void) => {
      const block = document.createElement('div');
      block.style.background = 'rgba(255,255,255,0.03)';
      block.style.padding = '12px 16px';
      block.style.borderRadius = '8px';
      block.style.border = '1px solid rgba(255,255,255,0.06)';
      block.style.boxShadow = 'inset 0 0 12px rgba(0,0,0,0.2)';

      const sliderLabel = document.createElement('div');
      sliderLabel.style.display = 'flex';
      sliderLabel.style.justifyContent = 'space-between';
      sliderLabel.style.alignItems = 'center';
      sliderLabel.style.marginBottom = '8px';
      sliderLabel.innerHTML = `
            <span class="u-font-heading" style="font-size: 14px; letter-spacing: 0.5px; text-transform: uppercase;">${label}</span>
            <span style="color: var(--color-arcade-blue); font-family: monospace;">${Math.round(value * 100)}%</span>
          `;

      const slider = document.createElement('input');
      slider.type = 'range';
      slider.className = 'arcade-slider';
      slider.min = '0';
      slider.max = '1';
      slider.step = '0.01';
      slider.value = value.toString();
      slider.style.width = '100%';
      slider.oninput = (e: any) => {
        const v = parseFloat(e.target.value);
        sliderLabel.querySelector('span:last-child')!.textContent = `${Math.round(v * 100)}%`;
        onChange(v);
      };

      block.appendChild(sliderLabel);
      block.appendChild(slider);
      return block;
    };

    const createToggle = (label: string, initialMuted: boolean, onToggle: (nextMuted: boolean) => void) => {
      const container = document.createElement('div');
      container.style.display = 'flex';
      container.style.alignItems = 'center';
      container.style.justifyContent = 'flex-end';
      container.style.gap = '8px';

      const lbl = document.createElement('span');
      lbl.style.fontSize = '12px';
      lbl.style.color = 'rgba(255,255,255,0.6)';
      lbl.textContent = 'MUTE';

      const toggleWrapper = document.createElement('label');
      toggleWrapper.className = 'arcade-toggle';
      toggleWrapper.setAttribute('aria-label', label);

      const input = document.createElement('input');
      input.type = 'checkbox';
      input.checked = initialMuted;
      input.onchange = (e: any) => {
        onToggle(e.target.checked);
      };

      const slider = document.createElement('span');
      slider.className = 'arcade-toggle-slider';

      toggleWrapper.appendChild(input);
      toggleWrapper.appendChild(slider);

      container.appendChild(lbl);
      container.appendChild(toggleWrapper);
      return container;
    };

    const masterRow = document.createElement('div');
    masterRow.style.display = 'grid';
    masterRow.style.gridTemplateColumns = '1fr minmax(120px, auto)';
    masterRow.style.gap = '12px';
    masterRow.appendChild(createSliderBlock('Master Volume', settings.master, (v) => this.settingsManager.saveAudioSettings({ master: v })));
    masterRow.appendChild(createToggle('Master', !!settings.muteMaster, (next) => this.settingsManager.saveAudioSettings({ muteMaster: next })));
    div.appendChild(masterRow);

    const uiRow = document.createElement('div');
    uiRow.style.display = 'grid';
    uiRow.style.gridTemplateColumns = '1fr minmax(120px, auto)';
    uiRow.style.gap = '12px';
    uiRow.appendChild(createSliderBlock('UI Sounds', settings.uiSounds ?? 0.7, (v) => this.settingsManager.saveAudioSettings({ uiSounds: v })));
    uiRow.appendChild(createToggle('UI Sounds', !!settings.muteUISounds, (next) => this.settingsManager.saveAudioSettings({ muteUISounds: next })));
    div.appendChild(uiRow);

    const musicRow = document.createElement('div');
    musicRow.style.display = 'grid';
    musicRow.style.gridTemplateColumns = '1fr minmax(120px, auto)';
    musicRow.style.gap = '12px';
    musicRow.appendChild(createSliderBlock('Music Volume', settings.music, (v) => this.settingsManager.saveAudioSettings({ music: v })));
    musicRow.appendChild(createToggle('Music', !!settings.muteMusic, (next) => this.settingsManager.saveAudioSettings({ muteMusic: next })));
    div.appendChild(musicRow);

    const ambienceRow = document.createElement('div');
    ambienceRow.style.display = 'grid';
    ambienceRow.style.gridTemplateColumns = '1fr minmax(120px, auto)';
    ambienceRow.style.gap = '12px';
    ambienceRow.appendChild(createSliderBlock('Ambience', settings.background, (v) => this.settingsManager.saveAudioSettings({ background: v })));
    ambienceRow.appendChild(createToggle('Ambience', !!settings.muteBackground, (next) => this.settingsManager.saveAudioSettings({ muteBackground: next })));
    div.appendChild(ambienceRow);

    const sfxBlock = createSliderBlock('All Effects', settings.cueHits, (v) => this.settingsManager.saveAudioSettings({ cueHits: v, ballCollisions: v, pocketDrops: v, railHits: v }));
    div.appendChild(sfxBlock);

    return div;
  }

  renderGraphicsSettings() {
    const div = document.createElement('div');
    div.style.padding = '8px 0';
    const settings = this.settingsManager.getRenderSettings();

    const createSlider = (label: string, val: number, min: number, max: number, step: number, onChange: (v: number) => void) => {
      const row = document.createElement('div');
      row.style.marginBottom = '16px';
      row.innerHTML = `
            <div style="display:flex; justify-content:space-between; margin-bottom:8px;">
                <label>${label}</label>
                <span style="color: var(--color-arcade-blue); font-family: monospace;">${val}</span>
            </div>
          `;
      const input = document.createElement('input');
      input.type = 'range';
      input.className = 'arcade-slider';
      input.min = min.toString();
      input.max = max.toString();
      input.step = step.toString();
      input.value = val.toString();
      input.style.width = '100%';
      input.oninput = (e: any) => {
        const v = parseFloat(e.target.value);
        row.querySelector('span')!.textContent = v.toString();
        onChange(v);
      };
      row.appendChild(input);
      return row;
    };

    div.appendChild(createSlider('Resolution Scale', settings.canvasScale, 0.5, 2.0, 0.1, (v) => this.settingsManager.saveRenderSettings({ canvasScale: v })));
    div.appendChild(createSlider('Ball Scale', settings.ballScale, 0.8, 1.2, 0.01, (v) => this.settingsManager.saveRenderSettings({ ballScale: v })));
    div.appendChild(createSlider('Ambient Light', settings.ambientIntensity, 0, 2, 0.1, (v) => this.settingsManager.saveRenderSettings({ ambientIntensity: v })));

    return div;
  }

  renderPhysicsSettings() {
    const div = document.createElement('div');
    div.style.padding = '16px';
    div.style.textAlign = 'center';
    div.style.background = 'rgba(255,255,255,0.03)';
    div.style.borderRadius = '8px';
    div.style.border = '1px dashed rgba(255,255,255,0.1)';

    div.innerHTML = `
         <div style="font-size: 48px; margin-bottom: 16px;">🛠️</div>
         <h3 style="margin: 0 0 8px 0;">Advanced Physics</h3>
         <p style="color: #aaa; margin-bottom: 16px;">
           Detailed physics tuning is available in the Developer Dock.
         </p>
         <p class="u-font-heading" style="color: var(--color-arcade-gold);">
           PRESS <span style="border: 1px solid rgba(255,255,255,0.2); padding: 2px 6px; border-radius: 4px;">SHIFT + D</span> TO OPEN
         </p>
       `;
    return div;
  }

  createFooter(onClose?: () => void) {
    const footer = document.createElement('div');
    footer.style.display = 'flex';
    footer.style.justifyContent = 'flex-end';

    const closeBtn = document.createElement('button');
    closeBtn.textContent = 'Done';
    closeBtn.className = 'btn-arcade btn-arcade-primary';
    closeBtn.style.padding = '10px 32px'; // keep custom padding if needed
    closeBtn.onclick = () => {
      modalService.close();
      onClose?.();
    };

    footer.appendChild(closeBtn);
    return footer;
  }
}
