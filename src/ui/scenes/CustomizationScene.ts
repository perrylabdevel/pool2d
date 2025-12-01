/**
 * CustomizationScene - Table appearance customization UI with tabs
 */

import { UIScene } from '../SceneController';
import { uiStateMachine } from '../UIStateMachine';
import { ColorTokens } from '../theme/ColorTokens';
import { LayoutConstants } from '../theme/LayoutConstants';
import { drawRoundedRect, drawGlossyButton, Rect } from '../components/UIComponents';
import { SettingsManager } from '../SettingsManager';
import { NavigationBar } from '../components/NavigationBar';
import { drawSceneBackground } from '../components/SceneBackground';
import { TABLE_THEMES, TableAppearance } from '../../textures/TableAppearance';

type CustomTab = 'themes' | 'felt' | 'frame' | 'cornerfill' | 'pocket';

interface TabButton { id: CustomTab; text: string; rect: Rect; }
interface ThemeCard { id: string; name: string; appearance: TableAppearance; rect: Rect; }
interface ColorControl { id: string; label: string; key: string; rect: Rect; colorRect: Rect; }
interface SliderControl { id: string; label: string; key: string; min: number; max: number; step: number; rect: Rect; format?: (v: number) => string; }
interface SelectControl { id: string; label: string; key: string; options: string[]; rect: Rect; }

export class CustomizationScene implements UIScene {
  private canvas: HTMLCanvasElement | null = null;
  private settingsManager: SettingsManager;
  private navigationBar: NavigationBar;
  
  private activeTab: CustomTab = 'themes';
  private tabButtons: TabButton[] = [];
  private themeCards: ThemeCard[] = [];
  private colorControls: ColorControl[] = [];
  private sliderControls: SliderControl[] = [];
  private selectControls: SelectControl[] = [];
  
  private hoveredTab: TabButton | null = null;
  private hoveredTheme: ThemeCard | null = null;
  private hoveredColor: ColorControl | null = null;
  private hoveredSlider: SliderControl | null = null;
  private hoveredSelect: SelectControl | null = null;
  private activeSlider: SliderControl | null = null;

  constructor(settingsManager: SettingsManager) {
    this.settingsManager = settingsManager;
    this.navigationBar = new NavigationBar({
      title: 'TABLE CUSTOMIZATION',
      showBack: true,
      onBack: () => uiStateMachine.goBack(),
      showProfile: true,
      showCurrencies: true,
      showSettings: false,
    });
  }

  mount(): void {
    this.canvas = document.getElementById('ui-stage') as HTMLCanvasElement;
    if (!this.canvas) return;
    this.navigationBar.setupLayout(this.canvas.width);
    this.setupLayout(this.canvas.width);
    this.canvas.addEventListener('mousemove', this.onMouseMove);
    this.canvas.addEventListener('mousedown', this.onMouseDown);
    this.canvas.addEventListener('mouseup', this.onMouseUp);
    this.canvas.addEventListener('click', this.onClick);
    this.render();
  }

  unmount(): void {
    this.canvas?.removeEventListener('mousemove', this.onMouseMove);
    this.canvas?.removeEventListener('mousedown', this.onMouseDown);
    this.canvas?.removeEventListener('mouseup', this.onMouseUp);
    this.canvas?.removeEventListener('click', this.onClick);
  }

  update(_dt: number): void {}

  private setupLayout(width: number): void {
    const navHeight = this.navigationBar.getHeight();
    const tabHeight = 40;
    const tabWidth = 90;
    const tabGap = 6;
    const tabs: CustomTab[] = ['themes', 'felt', 'frame', 'cornerfill', 'pocket'];
    const totalTabW = tabs.length * tabWidth + (tabs.length - 1) * tabGap;
    const tabStartX = (width - totalTabW) / 2;
    const tabY = navHeight + 15;

    const tabLabels: Record<CustomTab, string> = {
      themes: 'Themes', felt: 'Felt', frame: 'Frame', cornerfill: 'Corner Fill', pocket: 'Pocket'
    };
    this.tabButtons = tabs.map((id, i) => ({
      id,
      text: tabLabels[id],
      rect: { x: tabStartX + i * (tabWidth + tabGap), y: tabY, width: tabWidth, height: tabHeight }
    }));

    this.setupTabContent(width, tabY + tabHeight + 20);
  }

  private setupTabContent(width: number, top: number): void {
    this.themeCards = [];
    this.colorControls = [];
    this.sliderControls = [];
    this.selectControls = [];

    const controlW = Math.min(400, width - 60);
    const controlH = 50;
    const gap = 12;
    const startX = (width - controlW) / 2;
    const colorSize = 36;

    if (this.activeTab === 'themes') {
      const cardW = 140, cardH = 90, cardGap = 14;
      const cols = Math.max(1, Math.floor((width - 60) / (cardW + cardGap)));
      const entries = Object.entries(TABLE_THEMES);
      this.themeCards = entries.map(([id, theme], i) => {
        const row = Math.floor(i / cols), col = i % cols;
        const rowW = Math.min(cols, entries.length - row * cols) * (cardW + cardGap) - cardGap;
        const rowStartX = (width - rowW) / 2;
        return {
          id, name: theme.name, appearance: theme.appearance,
          rect: { x: rowStartX + col * (cardW + cardGap), y: top + row * (cardH + cardGap), width: cardW, height: cardH }
        };
      });
    } else if (this.activeTab === 'felt') {
      let y = top;
      this.colorControls.push({ id: 'feltColor', label: 'Color', key: 'color', rect: { x: startX, y, width: controlW, height: controlH }, colorRect: { x: startX + controlW - colorSize - 12, y: y + 7, width: colorSize, height: colorSize } });
      y += controlH + gap;
      this.selectControls.push({ id: 'feltPattern', label: 'Pattern', key: 'pattern', options: ['solid', 'weave', 'worn'], rect: { x: startX, y, width: controlW, height: controlH } });
      y += controlH + gap;
      this.sliderControls.push({ id: 'feltRoughness', label: 'Roughness', key: 'roughness', min: 0, max: 1, step: 0.05, rect: { x: startX, y, width: controlW, height: controlH }, format: v => `${Math.round(v * 100)}%` });
      y += controlH + gap;
      this.sliderControls.push({ id: 'feltTileScale', label: 'Texture Scale', key: 'tileScale', min: 1, max: 8, step: 1, rect: { x: startX, y, width: controlW, height: controlH }, format: v => `${v}x` });
    } else if (this.activeTab === 'frame') {
      let y = top;
      this.colorControls.push({ id: 'frameColor', label: 'Color', key: 'color', rect: { x: startX, y, width: controlW, height: controlH }, colorRect: { x: startX + controlW - colorSize - 12, y: y + 7, width: colorSize, height: colorSize } });
      y += controlH + gap;
      this.selectControls.push({ id: 'frameMaterial', label: 'Material', key: 'material', options: ['oak', 'mahogany', 'ebony', 'walnut', 'metal', 'marble'], rect: { x: startX, y, width: controlW, height: controlH } });
      y += controlH + gap;
      this.sliderControls.push({ id: 'frameGrainAngle', label: 'Grain Angle', key: 'grainAngle', min: 0, max: 90, step: 5, rect: { x: startX, y, width: controlW, height: controlH }, format: v => `${v}°` });
      y += controlH + gap;
      this.sliderControls.push({ id: 'frameGlossiness', label: 'Glossiness', key: 'glossiness', min: 0, max: 1, step: 0.05, rect: { x: startX, y, width: controlW, height: controlH }, format: v => `${Math.round(v * 100)}%` });
    } else if (this.activeTab === 'cornerfill') {
      let y = top;
      this.colorControls.push({ id: 'cornerfillColor', label: 'Color', key: 'color', rect: { x: startX, y, width: controlW, height: controlH }, colorRect: { x: startX + controlW - colorSize - 12, y: y + 7, width: colorSize, height: colorSize } });
      y += controlH + gap;
      this.sliderControls.push({ id: 'cornerfillGlossiness', label: 'Glossiness', key: 'glossiness', min: 0, max: 1, step: 0.05, rect: { x: startX, y, width: controlW, height: controlH }, format: v => `${Math.round(v * 100)}%` });
    } else if (this.activeTab === 'pocket') {
      let y = top;
      this.colorControls.push({ id: 'pocketColor', label: 'Color', key: 'color', rect: { x: startX, y, width: controlW, height: controlH }, colorRect: { x: startX + controlW - colorSize - 12, y: y + 7, width: colorSize, height: colorSize } });
      y += controlH + gap;
      this.colorControls.push({ id: 'pocketRimColor', label: 'Rim Color', key: 'rimColor', rect: { x: startX, y, width: controlW, height: controlH }, colorRect: { x: startX + controlW - colorSize - 12, y: y + 7, width: colorSize, height: colorSize } });
      y += controlH + gap;
      this.selectControls.push({ id: 'pocketStyle', label: 'Style', key: 'style', options: ['leather', 'chrome', 'brass'], rect: { x: startX, y, width: controlW, height: controlH } });
    }
  }

  private getAppearanceValue(tab: CustomTab, key: string): string | number {
    const app = this.settingsManager.getTableAppearance();
    // Map cornerfill tab to cushion property in TableAppearance
    const propKey = tab === 'cornerfill' ? 'cushion' : tab;
    if (propKey === 'themes') return '';
    const section = app[propKey as keyof TableAppearance] as unknown as Record<string, string | number>;
    return section?.[key] ?? '';
  }

  private setAppearanceValue(tab: CustomTab, key: string, value: string | number): void {
    const update: Partial<TableAppearance> = {};
    if (tab === 'felt') update.felt = { [key]: value } as Partial<TableAppearance['felt']> as TableAppearance['felt'];
    else if (tab === 'frame') update.frame = { [key]: value } as Partial<TableAppearance['frame']> as TableAppearance['frame'];
    else if (tab === 'cornerfill') update.cushion = { [key]: value } as Partial<TableAppearance['cushion']> as TableAppearance['cushion'];
    else if (tab === 'pocket') update.pocket = { [key]: value } as Partial<TableAppearance['pocket']> as TableAppearance['pocket'];
    this.settingsManager.saveTableAppearance(update);
  }

  private isInside(x: number, y: number, r: Rect): boolean {
    return x >= r.x && x <= r.x + r.width && y >= r.y && y <= r.y + r.height;
  }

  private onMouseMove = (e: MouseEvent): void => {
    const rect = this.canvas!.getBoundingClientRect();
    const x = e.clientX - rect.left, y = e.clientY - rect.top;

    if (this.activeSlider) {
      this.handleSliderDrag(this.activeSlider, x);
      this.render();
      return;
    }

    if (this.navigationBar.handleMouseMove(x, y)) {
      this.clearHovers();
      this.canvas!.style.cursor = this.navigationBar.getCursor();
      this.render();
      return;
    }

    this.clearHovers();
    let cursor = 'default';

    for (const tab of this.tabButtons) {
      if (this.isInside(x, y, tab.rect)) { this.hoveredTab = tab; cursor = 'pointer'; break; }
    }
    if (!this.hoveredTab) {
      for (const card of this.themeCards) {
        if (this.isInside(x, y, card.rect)) { this.hoveredTheme = card; cursor = 'pointer'; break; }
      }
      for (const ctrl of this.colorControls) {
        if (this.isInside(x, y, ctrl.colorRect)) { this.hoveredColor = ctrl; cursor = 'pointer'; break; }
      }
      for (const ctrl of this.sliderControls) {
        if (this.isInside(x, y, ctrl.rect)) { this.hoveredSlider = ctrl; cursor = 'pointer'; break; }
      }
      for (const ctrl of this.selectControls) {
        if (this.isInside(x, y, ctrl.rect)) { this.hoveredSelect = ctrl; cursor = 'pointer'; break; }
      }
    }

    this.canvas!.style.cursor = cursor;
    this.render();
  };

  private onMouseDown = (e: MouseEvent): void => {
    if (this.hoveredSlider) {
      this.activeSlider = this.hoveredSlider;
      const rect = this.canvas!.getBoundingClientRect();
      this.handleSliderDrag(this.activeSlider, e.clientX - rect.left);
      this.render();
    }
  };

  private onMouseUp = (): void => {
    this.activeSlider = null;
  };

  private handleSliderDrag(ctrl: SliderControl, mouseX: number): void {
    const sliderX = ctrl.rect.x + ctrl.rect.width - 160;
    const sliderW = 140;
    const pct = Math.max(0, Math.min(1, (mouseX - sliderX) / sliderW));
    const value = ctrl.min + pct * (ctrl.max - ctrl.min);
    const stepped = Math.round(value / ctrl.step) * ctrl.step;
    this.setAppearanceValue(this.activeTab, ctrl.key, stepped);
  }

  private clearHovers(): void {
    this.hoveredTab = null;
    this.hoveredTheme = null;
    this.hoveredColor = null;
    this.hoveredSlider = null;
    this.hoveredSelect = null;
  }

  private onClick = (e: MouseEvent): void => {
    const rect = this.canvas!.getBoundingClientRect();
    const x = e.clientX - rect.left, y = e.clientY - rect.top;

    if (this.navigationBar.handleClick(x, y)) return;

    if (this.hoveredTab) {
      this.activeTab = this.hoveredTab.id;
      this.setupTabContent(this.canvas!.width, this.tabButtons[0].rect.y + this.tabButtons[0].rect.height + 20);
      this.render();
      return;
    }

    if (this.hoveredTheme) {
      try { this.settingsManager.applyTheme(this.hoveredTheme.id); } catch (err) { console.error(err); }
      this.render();
      return;
    }

    if (this.hoveredColor) {
      const colorCtrl = this.hoveredColor; // Capture reference before it gets cleared
      const currentTab = this.activeTab;
      const input = document.createElement('input');
      input.type = 'color';
      input.value = String(this.getAppearanceValue(currentTab, colorCtrl.key));
      input.style.position = 'absolute';
      input.style.opacity = '0';
      document.body.appendChild(input);
      input.addEventListener('input', () => {
        this.setAppearanceValue(currentTab, colorCtrl.key, input.value);
        this.render();
      });
      input.addEventListener('change', () => { document.body.removeChild(input); });
      input.click();
      return;
    }

    if (this.hoveredSelect) {
      const ctrl = this.hoveredSelect;
      const currentVal = String(this.getAppearanceValue(this.activeTab, ctrl.key));
      const idx = ctrl.options.indexOf(currentVal);
      const nextIdx = (idx + 1) % ctrl.options.length;
      this.setAppearanceValue(this.activeTab, ctrl.key, ctrl.options[nextIdx]);
      this.render();
    }
  };

  private isThemeSelected(app: TableAppearance): boolean {
    const cur = this.settingsManager.getTableAppearance();
    return cur.felt.color === app.felt.color && cur.frame.color === app.frame.color;
  }

  render(): void {
    const ctx = this.canvas?.getContext('2d');
    if (!ctx || !this.canvas) return;

    drawSceneBackground(ctx, this.canvas.width, this.canvas.height);
    this.navigationBar.render(ctx, this.canvas.width);
    this.renderTabs(ctx);

    if (this.activeTab === 'themes') this.renderThemes(ctx);
    else this.renderControls(ctx);
  }

  private renderTabs(ctx: CanvasRenderingContext2D): void {
    for (const tab of this.tabButtons) {
      const isActive = tab.id === this.activeTab;
      const isHovered = tab === this.hoveredTab;
      const color = isActive ? ColorTokens.action.info : ColorTokens.ui.gray;
      drawGlossyButton(ctx, tab.rect, tab.text, color, isHovered);
    }
  }

  private renderThemes(ctx: CanvasRenderingContext2D): void {
    for (const card of this.themeCards) {
      const hovered = card === this.hoveredTheme;
      const selected = this.isThemeSelected(card.appearance);

      ctx.fillStyle = selected ? 'rgba(46,204,113,0.2)' : hovered ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.4)';
      drawRoundedRect(ctx, card.rect.x, card.rect.y, card.rect.width, card.rect.height, 10);
      ctx.fill();

      ctx.strokeStyle = selected ? ColorTokens.action.success : 'rgba(255,255,255,0.15)';
      ctx.lineWidth = selected ? 2 : 1;
      drawRoundedRect(ctx, card.rect.x, card.rect.y, card.rect.width, card.rect.height, 10);
      ctx.stroke();

      // Mini table preview
      const px = card.rect.x + 10, py = card.rect.y + 8, pw = card.rect.width - 20, ph = 36;
      ctx.fillStyle = card.appearance.frame.color;
      drawRoundedRect(ctx, px, py, pw, ph, 4);
      ctx.fill();
      ctx.fillStyle = card.appearance.felt.color;
      drawRoundedRect(ctx, px + 5, py + 5, pw - 10, ph - 10, 2);
      ctx.fill();

      ctx.font = `600 12px ${LayoutConstants.Fonts.Family.Default}`;
      ctx.textAlign = 'center';
      ctx.fillStyle = '#fff';
      ctx.fillText(card.name, card.rect.x + card.rect.width / 2, card.rect.y + 62);

      if (selected) {
        ctx.fillStyle = ColorTokens.action.success;
        ctx.font = `bold 14px ${LayoutConstants.Fonts.Family.Default}`;
        ctx.fillText('✓', card.rect.x + card.rect.width - 14, card.rect.y + 16);
      }
    }
  }

  private renderControls(ctx: CanvasRenderingContext2D): void {
    for (const ctrl of this.colorControls) this.renderColorControl(ctx, ctrl);
    for (const ctrl of this.sliderControls) this.renderSliderControl(ctx, ctrl);
    for (const ctrl of this.selectControls) this.renderSelectControl(ctx, ctrl);
  }

  private drawControlBg(ctx: CanvasRenderingContext2D, r: Rect, hovered: boolean): void {
    ctx.fillStyle = ColorTokens.background.overlay;
    drawRoundedRect(ctx, r.x, r.y, r.width, r.height, 8);
    ctx.fill();
    if (hovered) {
      ctx.fillStyle = 'rgba(255,255,255,0.05)';
      drawRoundedRect(ctx, r.x, r.y, r.width, r.height, 8);
      ctx.fill();
    }
    ctx.strokeStyle = ColorTokens.border.default;
    ctx.lineWidth = 1;
    drawRoundedRect(ctx, r.x, r.y, r.width, r.height, 8);
    ctx.stroke();
  }

  private renderColorControl(ctx: CanvasRenderingContext2D, ctrl: ColorControl): void {
    const hovered = ctrl === this.hoveredColor;
    this.drawControlBg(ctx, ctrl.rect, hovered);

    ctx.font = `bold 14px ${LayoutConstants.Fonts.Family.Default}`;
    ctx.fillStyle = ColorTokens.text.primary;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText(ctrl.label.toUpperCase(), ctrl.rect.x + 16, ctrl.rect.y + ctrl.rect.height / 2);

    const val = String(this.getAppearanceValue(this.activeTab, ctrl.key));
    ctx.fillStyle = val;
    drawRoundedRect(ctx, ctrl.colorRect.x, ctrl.colorRect.y, ctrl.colorRect.width, ctrl.colorRect.height, 6);
    ctx.fill();
    ctx.strokeStyle = hovered ? '#fff' : 'rgba(255,255,255,0.3)';
    ctx.lineWidth = hovered ? 2 : 1;
    drawRoundedRect(ctx, ctrl.colorRect.x, ctrl.colorRect.y, ctrl.colorRect.width, ctrl.colorRect.height, 6);
    ctx.stroke();
  }

  private renderSliderControl(ctx: CanvasRenderingContext2D, ctrl: SliderControl): void {
    const hovered = ctrl === this.hoveredSlider || ctrl === this.activeSlider;
    this.drawControlBg(ctx, ctrl.rect, hovered);

    ctx.font = `bold 14px ${LayoutConstants.Fonts.Family.Default}`;
    ctx.fillStyle = ColorTokens.text.primary;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText(ctrl.label.toUpperCase(), ctrl.rect.x + 16, ctrl.rect.y + ctrl.rect.height / 2);

    const sliderX = ctrl.rect.x + ctrl.rect.width - 160;
    const sliderY = ctrl.rect.y + ctrl.rect.height / 2 - 4;
    const sliderW = 140, sliderH = 8;

    ctx.fillStyle = 'rgba(255,255,255,0.15)';
    drawRoundedRect(ctx, sliderX, sliderY, sliderW, sliderH, 4);
    ctx.fill();

    const val = Number(this.getAppearanceValue(this.activeTab, ctrl.key));
    const pct = (val - ctrl.min) / (ctrl.max - ctrl.min);
    ctx.fillStyle = ColorTokens.action.info;
    drawRoundedRect(ctx, sliderX, sliderY, sliderW * pct, sliderH, 4);
    ctx.fill();

    const knobX = sliderX + sliderW * pct;
    ctx.beginPath();
    ctx.arc(knobX, sliderY + sliderH / 2, hovered ? 10 : 8, 0, Math.PI * 2);
    ctx.fillStyle = '#fff';
    ctx.fill();

    const displayVal = ctrl.format ? ctrl.format(val) : val.toFixed(2);
    ctx.font = `12px ${LayoutConstants.Fonts.Family.Default}`;
    ctx.fillStyle = ColorTokens.text.secondary;
    ctx.textAlign = 'right';
    ctx.fillText(displayVal, sliderX - 10, ctrl.rect.y + ctrl.rect.height / 2);
  }

  private renderSelectControl(ctx: CanvasRenderingContext2D, ctrl: SelectControl): void {
    const hovered = ctrl === this.hoveredSelect;
    this.drawControlBg(ctx, ctrl.rect, hovered);

    ctx.font = `bold 14px ${LayoutConstants.Fonts.Family.Default}`;
    ctx.fillStyle = ColorTokens.text.primary;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText(ctrl.label.toUpperCase(), ctrl.rect.x + 16, ctrl.rect.y + ctrl.rect.height / 2);

    const val = String(this.getAppearanceValue(this.activeTab, ctrl.key));
    const btnW = 120, btnH = 32;
    const btnX = ctrl.rect.x + ctrl.rect.width - btnW - 12;
    const btnY = ctrl.rect.y + (ctrl.rect.height - btnH) / 2;
    drawGlossyButton(ctx, { x: btnX, y: btnY, width: btnW, height: btnH }, `${val} ▼`, ColorTokens.action.info, hovered);
  }
}
