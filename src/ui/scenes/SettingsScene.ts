import { UIScene } from '../SceneController';
import { uiStateMachine, UIState } from '../UIStateMachine';
import { ColorTokens } from '../theme/ColorTokens';
import { drawGlossyButton, drawRoundedRect, Rect } from '../components/UIComponents';
import { SettingsManager } from '../SettingsManager';
import { NavigationBar } from '../components/NavigationBar';
import { drawSceneBackground } from '../components/SceneBackground';

type SettingsTab = 'gameplay' | 'colors' | 'audio';

interface TabButton {
    id: SettingsTab;
    text: string;
    rect: Rect;
}

interface ToggleControl {
    id: string;
    label: string;
    value: boolean;
    rect: Rect;
}

interface ColorControl {
    id: string;
    label: string;
    value: string;
    rect: Rect;
    colorRect: Rect;
}

interface SelectControl {
    id: string;
    label: string;
    value: string;
    options: string[];
    rect: Rect;
}

interface SliderControl {
    id: string;
    label: string;
    value: number; // 0 to 1
    min: number;
    max: number;
    step: number;
    rect: Rect;
}

interface ButtonControl {
    id: string;
    label: string;
    rect: Rect;
    color: string;
}

export class SettingsScene implements UIScene {
    private canvas: HTMLCanvasElement | null = null;
    private settingsManager: SettingsManager;

    private activeTab: SettingsTab = 'gameplay';
    private tabButtons: TabButton[] = [];
    private hoveredTab: TabButton | null = null;

    private toggleControls: ToggleControl[] = [];
    private colorControls: ColorControl[] = [];
    private selectControls: SelectControl[] = [];
    private sliderControls: SliderControl[] = [];
    private buttonControls: ButtonControl[] = [];

    private hoveredToggle: ToggleControl | null = null;
    private hoveredColor: ColorControl | null = null;
    private hoveredSelect: SelectControl | null = null;
    private hoveredSlider: SliderControl | null = null;
    private hoveredButton: ButtonControl | null = null;
    private activeSlider: SliderControl | null = null;

    private keyHandler: ((e: KeyboardEvent) => void) | null = null;
    private navigationBar: NavigationBar;

    constructor(settingsManager: SettingsManager) {
        this.settingsManager = settingsManager;
        this.navigationBar = new NavigationBar({
            title: 'SETTINGS',
            showBack: true,
            onBack: () => this.handleBack(),
            showProfile: true,
            showCurrencies: true,
            showSettings: false // Don't show settings button on settings page
        });
    }

    mount(): void {
        this.canvas = document.getElementById('ui-stage') as HTMLCanvasElement;
        if (!this.canvas) return;

        this.setupLayout(this.canvas.width);
        this.canvas.addEventListener('mousemove', this.onMouseMove);
        this.canvas.addEventListener('mousedown', this.onMouseDown);
        this.canvas.addEventListener('mouseup', this.onMouseUp);
        this.canvas.addEventListener('click', this.onClick);
        window.addEventListener('resize', this.onResize);

        this.keyHandler = (e: KeyboardEvent) => {
            if (e.key === 'Escape') {
                this.handleBack();
            }
        };
        window.addEventListener('keydown', this.keyHandler);
    }

    unmount(): void {
        if (!this.canvas) return;
        this.canvas.removeEventListener('mousemove', this.onMouseMove);
        this.canvas.removeEventListener('mousedown', this.onMouseDown);
        this.canvas.removeEventListener('mouseup', this.onMouseUp);
        this.canvas.removeEventListener('click', this.onClick);
        window.removeEventListener('resize', this.onResize);

        if (this.keyHandler) {
            window.removeEventListener('keydown', this.keyHandler);
            this.keyHandler = null;
        }

        this.canvas.style.cursor = 'default';
        this.canvas = null;
    }

    private setupLayout(width: number) {
        // Setup navigation bar
        this.navigationBar.setupLayout(width);
        const navHeight = this.navigationBar.getHeight();

        const tabHeight = 50;
        const gap = 20;

        // Tab buttons
        const tabWidth = 180;
        const tabGap = 10;
        const totalTabWidth = tabWidth * 3 + tabGap * 2;
        const tabStartX = (width - totalTabWidth) / 2;
        const tabY = navHeight + 20;

        this.tabButtons = [
            { id: 'gameplay', text: 'Gameplay', rect: { x: tabStartX, y: tabY, width: tabWidth, height: tabHeight } },
            { id: 'colors', text: 'Colors', rect: { x: tabStartX + tabWidth + tabGap, y: tabY, width: tabWidth, height: tabHeight } },
            { id: 'audio', text: 'Audio', rect: { x: tabStartX + (tabWidth + tabGap) * 2, y: tabY, width: tabWidth, height: tabHeight } }
        ];

        // Content area
        const contentY = tabY + tabHeight + gap;

        // Setup controls based on active tab
        this.setupControls(width, contentY);
    }

    private setupControls(width: number, startY: number) {
        this.toggleControls = [];
        this.colorControls = [];
        this.selectControls = [];
        this.sliderControls = [];
        this.buttonControls = [];

        const controlWidth = 500;
        const controlHeight = 50;
        const gap = 15;
        const startX = (width - controlWidth) / 2;

        if (this.activeTab === 'gameplay') {
            const gameSettings = this.settingsManager.getGameSettings();
            let y = startY + 20;

            this.toggleControls = [
                { id: 'aimAssist', label: 'Aim Assist', value: gameSettings.aimAssist, rect: { x: startX, y, width: controlWidth, height: controlHeight } },
                { id: 'call8Ball', label: 'Call 8-Ball', value: gameSettings.call8Ball, rect: { x: startX, y: y += controlHeight + gap, width: controlWidth, height: controlHeight } },
                { id: 'showFPS', label: 'Show FPS/UPS', value: gameSettings.showFPS, rect: { x: startX, y: y += controlHeight + gap, width: controlWidth, height: controlHeight } }
            ];

            y += controlHeight + gap * 2;
            this.selectControls = [
                { id: 'aiDifficulty', label: 'AI Difficulty', value: gameSettings.aiDifficulty || 'MEDIUM', options: ['EASY', 'MEDIUM', 'HARD', 'EXPERT'], rect: { x: startX, y, width: controlWidth, height: controlHeight } }
            ];
        } else if (this.activeTab === 'colors') {
            const colors = this.settingsManager.getUIColors();
            let y = startY + 20;

            const colorSize = 40;
            const colorRectX = startX + controlWidth - colorSize - 10;

            this.colorControls = [
                { id: 'tableColor', label: 'Table Cloth', value: colors.tableColor, rect: { x: startX, y, width: controlWidth, height: controlHeight }, colorRect: { x: colorRectX, y: y + 5, width: colorSize, height: colorSize } },
                { id: 'frameColor', label: 'Table Frame', value: colors.frameColor, rect: { x: startX, y: y += controlHeight + gap, width: controlWidth, height: controlHeight }, colorRect: { x: colorRectX, y: y + 5, width: colorSize, height: colorSize } },
                { id: 'railColor', label: 'Rail Cushion', value: colors.railColor, rect: { x: startX, y: y += controlHeight + gap, width: controlWidth, height: controlHeight }, colorRect: { x: colorRectX, y: y + 5, width: colorSize, height: colorSize } },
                { id: 'railFillColor', label: 'Corner Fill', value: colors.railFillColor, rect: { x: startX, y: y += controlHeight + gap, width: controlWidth, height: controlHeight }, colorRect: { x: colorRectX, y: y + 5, width: colorSize, height: colorSize } },
                { id: 'activePlayerColor', label: 'Active Player', value: colors.activePlayerColor, rect: { x: startX, y: y += controlHeight + gap, width: controlWidth, height: controlHeight }, colorRect: { x: colorRectX, y: y + 5, width: colorSize, height: colorSize } },
                { id: 'turnIndicatorColor', label: 'Turn Indicator', value: colors.turnIndicatorColor, rect: { x: startX, y: y += controlHeight + gap, width: controlWidth, height: controlHeight }, colorRect: { x: colorRectX, y: y + 5, width: colorSize, height: colorSize } },
                { id: 'cueStickColor', label: 'Cue Stick', value: colors.cueStickColor, rect: { x: startX, y: y += controlHeight + gap, width: controlWidth, height: controlHeight }, colorRect: { x: colorRectX, y: y + 5, width: colorSize, height: colorSize } },
                { id: 'cueTipColor', label: 'Cue Tip', value: colors.cueTipColor, rect: { x: startX, y: y += controlHeight + gap, width: controlWidth, height: controlHeight }, colorRect: { x: colorRectX, y: y + 5, width: colorSize, height: colorSize } }
            ];
        } else if (this.activeTab === 'audio') {
            let y = startY + 20;
            const audioSettings = this.settingsManager.getAudioSettings();

            // Sliders
            this.sliderControls = [
                { id: 'master', label: 'Master Volume', value: audioSettings.master, min: 0, max: 1, step: 0.01, rect: { x: startX, y, width: controlWidth, height: controlHeight } },
                { id: 'music', label: 'Music Volume', value: audioSettings.music, min: 0, max: 1, step: 0.01, rect: { x: startX, y: y += controlHeight + gap, width: controlWidth, height: controlHeight } },
                { id: 'uiSounds', label: 'UI Sounds', value: audioSettings.uiSounds ?? 0.7, min: 0, max: 1, step: 0.01, rect: { x: startX, y: y += controlHeight + gap, width: controlWidth, height: controlHeight } },
                { id: 'background', label: 'Ambience', value: audioSettings.background, min: 0, max: 1, step: 0.01, rect: { x: startX, y: y += controlHeight + gap, width: controlWidth, height: controlHeight } },
                { id: 'sfx', label: 'Sound Effects', value: audioSettings.cueHits, min: 0, max: 1, step: 0.01, rect: { x: startX, y: y += controlHeight + gap, width: controlWidth, height: controlHeight } }
            ];

            // Toggles
            y += controlHeight + gap * 2;
            this.toggleControls = [
                { id: 'muteMaster', label: 'Mute Master', value: audioSettings.muteMaster || false, rect: { x: startX, y, width: controlWidth, height: controlHeight } },
                { id: 'muteMusic', label: 'Mute Music', value: audioSettings.muteMusic || false, rect: { x: startX, y: y += controlHeight + gap, width: controlWidth, height: controlHeight } },
                { id: 'muteUISounds', label: 'Mute UI Sounds', value: audioSettings.muteUISounds || false, rect: { x: startX, y: y += controlHeight + gap, width: controlWidth, height: controlHeight } },
                { id: 'muteBackground', label: 'Mute Ambience', value: audioSettings.muteBackground || false, rect: { x: startX, y: y += controlHeight + gap, width: controlWidth, height: controlHeight } }
            ];
        }

        // Add Reset Button to all tabs
        // Calculate Y position based on last control
        let lastY = startY;
        if (this.toggleControls.length > 0) lastY = Math.max(lastY, this.toggleControls[this.toggleControls.length - 1].rect.y);
        if (this.colorControls.length > 0) lastY = Math.max(lastY, this.colorControls[this.colorControls.length - 1].rect.y);
        if (this.selectControls.length > 0) lastY = Math.max(lastY, this.selectControls[this.selectControls.length - 1].rect.y);
        if (this.sliderControls.length > 0) lastY = Math.max(lastY, this.sliderControls[this.sliderControls.length - 1].rect.y);

        const buttonWidth = 120;
        const buttonHeight = 40;
        const buttonY = lastY + controlHeight + gap * 2;

        this.buttonControls = [
            {
                id: 'reset',
                label: 'Reset',
                rect: { x: startX, y: buttonY, width: buttonWidth, height: buttonHeight },
                color: ColorTokens.action.warning
            }
        ];
    }

    private onResize = () => {
        if (!this.canvas) return;
        this.setupLayout(this.canvas.width);
    };

    private onMouseMove = (e: MouseEvent) => {
        if (!this.canvas) return;
        const rect = this.canvas.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;

        // Handle dragging slider
        if (this.activeSlider) {
            this.handleSliderDrag(this.activeSlider, x);
            return;
        }

        // Check navigation bar first
        if (this.navigationBar.handleMouseMove(x, y)) {
            this.hoveredTab = null;
            this.hoveredToggle = null;
            this.hoveredColor = null;
            this.hoveredSelect = null;
            this.hoveredSlider = null;
            this.hoveredButton = null;
            this.canvas.style.cursor = this.navigationBar.getCursor();
            return;
        }

        let cursor = 'default';

        // Check tabs
        this.hoveredTab = null;
        for (const tab of this.tabButtons) {
            if (this.isInside(x, y, tab.rect)) {
                this.hoveredTab = tab;
                cursor = 'pointer';
                break;
            }
        }

        // Check controls
        this.hoveredToggle = null;
        this.hoveredColor = null;
        this.hoveredSelect = null;
        this.hoveredSlider = null;
        this.hoveredButton = null;

        if (!this.hoveredTab) {
            for (const toggle of this.toggleControls) {
                if (this.isInside(x, y, toggle.rect)) {
                    this.hoveredToggle = toggle;
                    cursor = 'pointer';
                    break;
                }
            }

            for (const color of this.colorControls) {
                if (this.isInside(x, y, color.colorRect)) {
                    this.hoveredColor = color;
                    cursor = 'pointer';
                    break;
                }
            }

            for (const select of this.selectControls) {
                if (this.isInside(x, y, select.rect)) {
                    this.hoveredSelect = select;
                    cursor = 'pointer';
                    break;
                }
            }

            for (const slider of this.sliderControls) {
                if (this.isInside(x, y, slider.rect)) {
                    this.hoveredSlider = slider;
                    cursor = 'pointer';
                    break;
                }
            }

            for (const button of this.buttonControls) {
                if (this.isInside(x, y, button.rect)) {
                    this.hoveredButton = button;
                    cursor = 'pointer';
                    break;
                }
            }
        }

        this.canvas.style.cursor = cursor;
    };

    private onMouseDown = (e: MouseEvent) => {
        if (!this.canvas || !this.hoveredSlider) return;
        this.activeSlider = this.hoveredSlider;
        const rect = this.canvas.getBoundingClientRect();
        const x = e.clientX - rect.left;
        this.handleSliderDrag(this.activeSlider, x);
    };

    private onMouseUp = () => {
        this.activeSlider = null;
    };

    private onClick = (e: MouseEvent) => {
        if (!this.canvas) return;
        const rect = this.canvas.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;

        // Check navigation bar first
        if (this.navigationBar.handleClick(x, y)) {
            return;
        }

        if (this.hoveredTab) {
            this.activeTab = this.hoveredTab.id;
            this.setupControls(this.canvas!.width, this.tabButtons[0].rect.y + this.tabButtons[0].rect.height + 20);
            return;
        }

        if (this.hoveredToggle) {
            this.handleToggle(this.hoveredToggle);
            return;
        }

        if (this.hoveredColor) {
            this.handleColorPick(this.hoveredColor);
            return;
        }

        if (this.hoveredSelect) {
            this.handleSelectClick(this.hoveredSelect);
            return;
        }

        if (this.hoveredButton && this.hoveredButton.id === 'reset') {
            this.handleReset();
        }
    };

    private isInside(x: number, y: number, rect: Rect): boolean {
        return x >= rect.x && x <= rect.x + rect.width && y >= rect.y && y <= rect.y + rect.height;
    }

    private handleToggle(control: ToggleControl) {
        const newValue = !control.value;
        control.value = newValue;

        if (this.activeTab === 'gameplay') {
            switch (control.id) {
                case 'aimAssist':
                    this.settingsManager.saveGameSettings({ aimAssist: newValue });
                    window.dispatchEvent(new CustomEvent('game:aim-assist-toggle', { detail: { enabled: newValue } }));
                    break;
                case 'call8Ball':
                    this.settingsManager.saveGameSettings({ call8Ball: newValue });
                    break;
                case 'showFPS':
                    this.settingsManager.saveGameSettings({ showFPS: newValue });
                    break;
            }
        } else if (this.activeTab === 'audio') {
            const update: any = {};
            update[control.id] = newValue;
            this.settingsManager.saveAudioSettings(update);
        }
    }

    private handleColorPick(control: ColorControl) {
        // Create a hidden color input
        const input = document.createElement('input');
        input.type = 'color';
        input.value = control.value;
        input.style.position = 'absolute';
        input.style.opacity = '0';
        input.style.pointerEvents = 'none';
        document.body.appendChild(input);

        input.addEventListener('change', () => {
            const newColor = input.value;
            control.value = newColor;

            const update: any = {};
            update[control.id] = newColor;
            this.settingsManager.saveUIColors(update);

            document.body.removeChild(input);
        });

        input.click();
    }

    private handleSelectClick(control: SelectControl) {
        // Cycle through options
        const currentIndex = control.options.indexOf(control.value);
        const nextIndex = (currentIndex + 1) % control.options.length;
        control.value = control.options[nextIndex];

        if (control.id === 'aiDifficulty') {
            this.settingsManager.saveGameSettings({ aiDifficulty: control.value as any });
            window.dispatchEvent(new CustomEvent('game:ai-difficulty-changed', { detail: { value: control.value } }));
        }
    }

    private handleSliderDrag(control: SliderControl, mouseX: number) {
        const rect = control.rect;
        const sliderWidth = 200; // Fixed width for the slider track
        const sliderX = rect.x + rect.width - sliderWidth - 20;

        let percent = (mouseX - sliderX) / sliderWidth;
        percent = Math.max(0, Math.min(1, percent));

        const newValue = control.min + percent * (control.max - control.min);
        control.value = newValue;

        if (this.activeTab === 'audio') {
            const update: any = {};
            if (control.id === 'sfx') {
                update.cueHits = newValue;
                update.ballCollisions = newValue;
                update.pocketDrops = newValue;
                update.railHits = newValue;
            } else {
                update[control.id] = newValue;
            }
            this.settingsManager.saveAudioSettings(update);
        }
    }

    private handleBack() {
        // Check if we came from IN_GAME_MENU
        const previousState = (window as any).__settingsReturnState;
        if (previousState === UIState.IN_GAME_MENU) {
            uiStateMachine.transitionTo(UIState.IN_GAME_MENU);
        } else {
            uiStateMachine.transitionTo(UIState.LOBBY);
        }
    }

    private handleReset() {
        if (this.activeTab === 'gameplay') {
            // Reset gameplay settings to defaults
            this.settingsManager.saveGameSettings({
                aimAssist: true,
                call8Ball: false,
                showFPS: true,
                aiDifficulty: 'MEDIUM'
            });
        } else if (this.activeTab === 'colors') {
            this.settingsManager.resetUIColors();
        } else if (this.activeTab === 'audio') {
            this.settingsManager.resetAudioSettings();
        }
        this.setupControls(this.canvas!.width, this.tabButtons[0].rect.y + this.tabButtons[0].rect.height + 20);
    }

    update(_dt: number): void {
    }

    render(ctx: CanvasRenderingContext2D): void {
        const width = ctx.canvas.width;
        const height = ctx.canvas.height;

        this.renderBackground(ctx, width, height);
        this.renderTabs(ctx);
        this.renderControls(ctx);
        this.navigationBar.render(ctx, width);
    }

    private renderBackground(ctx: CanvasRenderingContext2D, width: number, height: number) {
        drawSceneBackground(ctx, width, height, 'blue');
    }

    private drawStyledRect(ctx: CanvasRenderingContext2D, rect: Rect, radius: number, color: string) {
        ctx.fillStyle = color;
        drawRoundedRect(ctx, rect.x, rect.y, rect.width, rect.height, radius);
        ctx.fill();
    }

    private renderTabs(ctx: CanvasRenderingContext2D) {
        for (const tab of this.tabButtons) {
            const isActive = tab.id === this.activeTab;
            const isHovered = tab === this.hoveredTab;
            const color = isActive ? ColorTokens.action.info : ColorTokens.ui.gray;

            drawGlossyButton(ctx, tab.rect, tab.text, color, isHovered);
        }
    }

    private renderControls(ctx: CanvasRenderingContext2D) {
        // Render toggles
        for (const toggle of this.toggleControls) {
            this.renderToggle(ctx, toggle, toggle === this.hoveredToggle);
        }

        // Render colors
        for (const color of this.colorControls) {
            this.renderColor(ctx, color, color === this.hoveredColor);
        }

        // Render selects
        for (const select of this.selectControls) {
            this.renderSelect(ctx, select, select === this.hoveredSelect);
        }

        // Render sliders
        for (const slider of this.sliderControls) {
            this.renderSlider(ctx, slider, slider === this.hoveredSlider || slider === this.activeSlider);
        }

        // Render buttons
        for (const button of this.buttonControls) {
            drawGlossyButton(ctx, button.rect, button.label, button.color, button === this.hoveredButton);
        }
    }

    private renderToggle(ctx: CanvasRenderingContext2D, control: ToggleControl, isHovered: boolean) {
        const rect = control.rect;

        // Background
        this.drawStyledRect(ctx, rect, 8, ColorTokens.background.tertiary);

        if (isHovered) {
            ctx.save();
            ctx.fillStyle = 'rgba(255, 255, 255, 0.05)';
            ctx.beginPath();
            ctx.roundRect(rect.x, rect.y, rect.width, rect.height, 8);
            ctx.fill();
            ctx.restore();
        }

        // Label
        ctx.save();
        ctx.fillStyle = ColorTokens.text.primary;
        ctx.font = '18px Arial';
        ctx.textAlign = 'left';
        ctx.textBaseline = 'middle';
        ctx.fillText(control.label, rect.x + 20, rect.y + rect.height / 2);
        ctx.restore();

        // Toggle switch (Rectangular Track)
        const switchWidth = 60;
        const switchHeight = 30;
        const switchX = rect.x + rect.width - switchWidth - 20;
        const switchY = rect.y + (rect.height - switchHeight) / 2;

        // Track
        ctx.save();
        ctx.fillStyle = control.value ? ColorTokens.action.success : ColorTokens.ui.gray;
        ctx.beginPath();
        ctx.roundRect(switchX, switchY, switchWidth, switchHeight, 4);
        ctx.fill();
        ctx.restore();

        // Knob (Rectangular)
        const knobWidth = 24;
        const knobHeight = 24;
        const knobMargin = 3;

        // Calculate knob position
        // If off: left side + margin
        // If on: right side - width - margin
        const knobX = control.value
            ? switchX + switchWidth - knobWidth - knobMargin
            : switchX + knobMargin;

        const knobY = switchY + (switchHeight - knobHeight) / 2;

        // Knob Shadow
        ctx.save();
        ctx.shadowColor = 'rgba(0, 0, 0, 0.4)';
        ctx.shadowBlur = 3;
        ctx.shadowOffsetY = 1;

        ctx.fillStyle = ColorTokens.text.primary;
        ctx.beginPath();
        ctx.roundRect(knobX, knobY, knobWidth, knobHeight, 4);
        ctx.fill();
        ctx.restore();
    }

    private renderColor(ctx: CanvasRenderingContext2D, control: ColorControl, isHovered: boolean) {
        const rect = control.rect;

        // Background
        this.drawStyledRect(ctx, rect, 8, ColorTokens.background.tertiary);

        // Label
        ctx.save();
        ctx.fillStyle = ColorTokens.text.primary;
        ctx.font = '18px Arial';
        ctx.textAlign = 'left';
        ctx.textBaseline = 'middle';
        ctx.fillText(control.label, rect.x + 20, rect.y + rect.height / 2);
        ctx.restore();

        // Color swatch
        const colorRect = control.colorRect;
        ctx.save();
        ctx.fillStyle = control.value;
        ctx.beginPath();
        ctx.roundRect(colorRect.x, colorRect.y, colorRect.width, colorRect.height, 8);
        ctx.fill();

        // Border
        ctx.strokeStyle = isHovered ? ColorTokens.text.primary : ColorTokens.text.secondary;
        ctx.lineWidth = isHovered ? 3 : 2;
        ctx.stroke();
        ctx.restore();
    }

    private renderSelect(ctx: CanvasRenderingContext2D, control: SelectControl, isHovered: boolean) {
        const rect = control.rect;

        // Background
        this.drawStyledRect(ctx, rect, 8, ColorTokens.background.tertiary);

        if (isHovered) {
            ctx.save();
            ctx.fillStyle = 'rgba(255, 255, 255, 0.05)';
            ctx.beginPath();
            ctx.roundRect(rect.x, rect.y, rect.width, rect.height, 8);
            ctx.fill();
            ctx.restore();
        }

        // Label
        ctx.save();
        ctx.fillStyle = ColorTokens.text.primary;
        ctx.font = '18px Arial';
        ctx.textAlign = 'left';
        ctx.textBaseline = 'middle';
        ctx.fillText(control.label, rect.x + 20, rect.y + rect.height / 2);
        ctx.restore();

        // Value with arrow
        ctx.save();
        ctx.fillStyle = ColorTokens.action.info;
        ctx.font = 'bold 18px Arial';
        ctx.textAlign = 'right';
        ctx.textBaseline = 'middle';
        ctx.fillText(`${control.value} ▼`, rect.x + rect.width - 20, rect.y + rect.height / 2);
        ctx.restore();
    }

    private renderSlider(ctx: CanvasRenderingContext2D, control: SliderControl, isHovered: boolean) {
        const rect = control.rect;

        // Background
        this.drawStyledRect(ctx, rect, 8, ColorTokens.background.tertiary);

        if (isHovered) {
            ctx.save();
            ctx.fillStyle = 'rgba(255, 255, 255, 0.05)';
            ctx.beginPath();
            ctx.roundRect(rect.x, rect.y, rect.width, rect.height, 8);
            ctx.fill();
            ctx.restore();
        }

        // Label
        ctx.save();
        ctx.fillStyle = ColorTokens.text.primary;
        ctx.font = '18px Arial';
        ctx.textAlign = 'left';
        ctx.textBaseline = 'middle';
        ctx.fillText(control.label, rect.x + 20, rect.y + rect.height / 2);
        ctx.restore();

        // Slider Track
        const sliderWidth = 200;
        const sliderHeight = 24;
        const sliderX = rect.x + rect.width - sliderWidth - 20;
        const sliderY = rect.y + (rect.height - sliderHeight) / 2;

        ctx.save();
        ctx.fillStyle = 'rgba(255, 255, 255, 0.2)';
        ctx.beginPath();
        ctx.roundRect(sliderX, sliderY, sliderWidth, sliderHeight, 3);
        ctx.fill();

        // Filled portion
        const percent = (control.value - control.min) / (control.max - control.min);
        ctx.fillStyle = ColorTokens.action.info;
        ctx.beginPath();
        ctx.roundRect(sliderX, sliderY, sliderWidth * percent, sliderHeight, 3);
        ctx.fill();

        // Knob (Rectangular)
        const knobWidth = 24;
        const knobHeight = 24;
        const knobX = sliderX + sliderWidth * percent - knobWidth / 2;
        const knobY = sliderY + sliderHeight / 2 - knobHeight / 2;

        // Knob Shadow
        ctx.shadowColor = 'rgba(0, 0, 0, 0.4)';
        ctx.shadowBlur = 4;
        ctx.shadowOffsetY = 2;

        ctx.fillStyle = ColorTokens.text.primary;
        ctx.beginPath();
        ctx.roundRect(knobX, knobY, knobWidth, knobHeight, 4);
        ctx.fill();

        // Reset shadow
        ctx.shadowColor = 'transparent';
        ctx.shadowBlur = 0;
        ctx.shadowOffsetY = 0;

        if (isHovered) {
            ctx.strokeStyle = ColorTokens.action.info;
            ctx.lineWidth = 2;
            ctx.stroke();
        }
        ctx.restore();

        // Value Text
        ctx.save();
        ctx.fillStyle = ColorTokens.text.secondary;
        ctx.font = '14px monospace';
        ctx.textAlign = 'right';
        ctx.textBaseline = 'middle';
        ctx.fillText(`${Math.round(control.value * 100)}%`, sliderX - 10, rect.y + rect.height / 2);
        ctx.restore();
    }


}
