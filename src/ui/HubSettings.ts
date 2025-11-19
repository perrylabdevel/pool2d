import { modalService } from './ModalService';
import { SettingsManager } from './SettingsManager';

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
      
      const colors = this.settingsManager.getUIColors();
      
      const createColorPicker = (label: string, id: string, val: string, onChange: (v: string) => void) => {
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
      
      div.appendChild(createColorPicker('Table Cloth', 'table-color', colors.tableColor, (v) => this.settingsManager.saveUIColors({ tableColor: v })));
      div.appendChild(createColorPicker('Table Frame', 'frame-color', colors.frameColor, (v) => this.settingsManager.saveUIColors({ frameColor: v })));
      div.appendChild(createColorPicker('Rail Cushion', 'rail-color', colors.railColor, (v) => this.settingsManager.saveUIColors({ railColor: v })));
      div.appendChild(createColorPicker('Cue Stick', 'cue-stick-color', colors.cueStickColor, (v) => this.settingsManager.saveUIColors({ cueStickColor: v })));
      div.appendChild(createColorPicker('Active Player', 'active-player-color', colors.activePlayerColor, (v) => this.settingsManager.saveUIColors({ activePlayerColor: v })));

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
          
          const lbl = document.createElement('label');
          lbl.textContent = label;
          
          const input = document.createElement('input');
          input.type = 'checkbox';
          input.checked = checked;
          input.style.accentColor = 'var(--color-arcade-blue)';
          input.onchange = (e: any) => onChange(e.target.checked);
          
          row.appendChild(lbl);
          row.appendChild(input);
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
      const settings = this.settingsManager.getAudioSettings();
      
      const createSlider = (label: string, val: number, onChange: (v: number) => void) => {
          const row = document.createElement('div');
          row.style.marginBottom = '16px';
          row.innerHTML = `
            <div style="display:flex; justify-content:space-between; margin-bottom:8px;">
                <label>${label}</label>
                <span style="color: var(--color-arcade-blue); font-family: monospace;">${(val * 100).toFixed(0)}%</span>
            </div>
          `;
          const input = document.createElement('input');
          input.type = 'range';
          input.min = '0';
          input.max = '1';
          input.step = '0.05';
          input.value = val.toString();
          input.style.width = '100%';
          input.oninput = (e: any) => {
              const v = parseFloat(e.target.value);
              row.querySelector('span')!.textContent = `${(v * 100).toFixed(0)}%`;
              onChange(v);
          };
          row.appendChild(input);
          return row;
      };
      
      div.appendChild(createSlider('Master Volume', settings.master, (v) => this.settingsManager.saveAudioSettings({ master: v })));
      div.appendChild(createSlider('Music Volume', settings.music, (v) => this.settingsManager.saveAudioSettings({ music: v })));
      div.appendChild(createSlider('Sound Effects', settings.cueHits, (v) => this.settingsManager.saveAudioSettings({ cueHits: v, ballCollisions: v, pocketDrops: v, railHits: v })));
      
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
      closeBtn.style.background = 'var(--color-arcade-blue)';
      closeBtn.style.color = '#fff';
      closeBtn.style.border = 'none';
      closeBtn.style.padding = '10px 32px';
      closeBtn.style.borderRadius = '6px';
      closeBtn.style.cursor = 'pointer';
      closeBtn.style.fontWeight = 'bold';
      closeBtn.onclick = () => {
          modalService.close();
          onClose?.();
      };
      
      footer.appendChild(closeBtn);
      return footer;
  }
}
