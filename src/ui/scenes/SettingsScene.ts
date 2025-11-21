import { UIScene } from '../SceneController';
import { uiStateMachine, UIState } from '../UIStateMachine';
import { ColorTokens, SemanticColors } from '../theme/ColorTokens';
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

export class SettingsScene implements UIScene {
    private canvas: HTMLCanvasElement | null = null;
    private settingsManager: SettingsManager;

    private activeTab: SettingsTab = 'gameplay';
    private tabButtons: TabButton[] = [];
    private hoveredTab: TabButton | null = null;

    private toggleControls: ToggleControl[] = [];
    private colorControls: ColorControl[] = [];
    private selectControls: SelectControl[] = [];

    private hoveredToggle: ToggleControl | null = null;
    private hoveredColor: ColorControl | null = null;
    private hoveredSelect: SelectControl | null = null;

    private resetButton: Rect | null = null;
    private hoveredButton: 'reset' | null = null;

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

        this.setupLayout(this.canvas.width, this.canvas.height);
        this.canvas.addEventListener('mousemove', this.onMouseMove);
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
        this.canvas.removeEventListener('click', this.onClick);
        window.removeEventListener('resize', this.onResize);

        if (this.keyHandler) {
            window.removeEventListener('keydown', this.keyHandler);
            this.keyHandler = null;
        }

        this.canvas.style.cursor = 'default';
        this.canvas = null;
    }

    private setupLayout(width: number, height: number) {
        // Setup navigation bar
        this.navigationBar.setupLayout(width);
        const navHeight = this.navigationBar.getHeight();

        const padding = 40;
        const tabHeight = 50;
        const buttonHeight = 60;
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
        const contentHeight = height - contentY - padding - buttonHeight - gap;

        // Setup controls based on active tab
        this.setupControls(width, contentY, contentHeight);

        // Bottom reset button (back button handled by nav bar)
        const bottomY = height - padding - buttonHeight;
        const bottomButtonWidth = 200;
        this.resetButton = { x: width - padding - bottomButtonWidth, y: bottomY, width: bottomButtonWidth, height: buttonHeight };
    }

    private setupControls(width: number, startY: number, availableHeight: number) {
        this.toggleControls = [];
        this.colorControls = [];
        this.selectControls = [];

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
            // Audio settings placeholder
            let y = startY + 20;
            const audioSettings = this.settingsManager.getAudioSettings();

            this.toggleControls = [
                { id: 'muteMaster', label: 'Mute All', value: audioSettings.muteMaster || false, rect: { x: startX, y, width: controlWidth, height: controlHeight } },
                { id: 'muteMusic', label: 'Mute Music', value: audioSettings.muteMusic || false, rect: { x: startX, y: y += controlHeight + gap, width: controlWidth, height: controlHeight } },
                { id: 'muteUISounds', label: 'Mute UI Sounds', value: audioSettings.muteUISounds || false, rect: { x: startX, y: y += controlHeight + gap, width: controlWidth, height: controlHeight } }
            ];
        }
    }

    private onResize = () => {
        if (!this.canvas) return;
        this.setupLayout(this.canvas.width, this.canvas.height);
    };

    private onMouseMove = (e: MouseEvent) => {
        if (!this.canvas) return;
        const rect = this.canvas.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;

        // Check navigation bar first
        if (this.navigationBar.handleMouseMove(x, y)) {
            this.hoveredTab = null;
            this.hoveredToggle = null;
            this.hoveredColor = null;
            this.hoveredSelect = null;
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

            if (this.resetButton && this.isInside(x, y, this.resetButton)) {
                this.hoveredButton = 'reset';
                cursor = 'pointer';
            }
        }

        this.canvas.style.cursor = cursor;
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
            this.setupControls(this.canvas!.width, this.tabButtons[0].rect.y + this.tabButtons[0].rect.height + 20, 0);
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

        if (this.hoveredButton === 'reset') {
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
        this.setupControls(this.canvas!.width, this.tabButtons[0].rect.y + this.tabButtons[0].rect.height + 20, 0);
    }

    update(_dt: number): void {
    }

    render(ctx: CanvasRenderingContext2D): void {
        const width = ctx.canvas.width;
        const height = ctx.canvas.height;

        this.renderBackground(ctx, width, height);
        this.renderTabs(ctx);
        this.renderControls(ctx);
        this.renderBottomButtons(ctx);
        this.navigationBar.render(ctx, width);
    }

    private renderBackground(ctx: CanvasRenderingContext2D, width: number, height: number) {
        drawSceneBackground(ctx, width, height, 'blue');
    }

    private renderTabs(ctx: CanvasRenderingContext2D) {
        for (const tab of this.tabButtons) {
            const isActive = tab.id === this.activeTab;
            const isHovered = tab === this.hoveredTab;
            const color = isActive ? ColorTokens.action.info : ColorTokens.ui.gray;

            // Draw tab background
            drawRoundedRect(ctx, tab.rect, 8, isActive ? color : ColorTokens.background.tertiary);

            if (isHovered && !isActive) {
                ctx.save();
                ctx.fillStyle = 'rgba(255, 255, 255, 0.1)';
                ctx.beginPath();
                ctx.roundRect(tab.rect.x, tab.rect.y, tab.rect.width, tab.rect.height, 8);
                ctx.fill();
                ctx.restore();
            }

            // Draw tab text
            ctx.save();
            ctx.fillStyle = isActive ? ColorTokens.text.primary : ColorTokens.text.secondary;
            ctx.font = 'bold 18px Arial';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(tab.text, tab.rect.x + tab.rect.width / 2, tab.rect.y + tab.rect.height / 2);
            ctx.restore();
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
    }

    private renderToggle(ctx: CanvasRenderingContext2D, control: ToggleControl, isHovered: boolean) {
        const rect = control.rect;

        // Background
        drawRoundedRect(ctx, rect, 8, ColorTokens.background.tertiary);

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

        // Toggle switch
        const switchWidth = 60;
        const switchHeight = 30;
        const switchX = rect.x + rect.width - switchWidth - 20;
        const switchY = rect.y + (rect.height - switchHeight) / 2;
        const switchRadius = switchHeight / 2;

        // Switch background
        ctx.save();
        ctx.fillStyle = control.value ? ColorTokens.action.success : ColorTokens.ui.gray;
        ctx.beginPath();
        ctx.roundRect(switchX, switchY, switchWidth, switchHeight, switchRadius);
        ctx.fill();
        ctx.restore();

        // Switch knob
        const knobRadius = switchHeight / 2 - 4;
        const knobX = control.value ? switchX + switchWidth - switchRadius : switchX + switchRadius;
        const knobY = switchY + switchHeight / 2;

        ctx.save();
        ctx.fillStyle = ColorTokens.text.primary;
        ctx.beginPath();
        ctx.arc(knobX, knobY, knobRadius, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
    }

    private renderColor(ctx: CanvasRenderingContext2D, control: ColorControl, isHovered: boolean) {
        const rect = control.rect;

        // Background
        drawRoundedRect(ctx, rect, 8, ColorTokens.background.tertiary);

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
        drawRoundedRect(ctx, rect, 8, ColorTokens.background.tertiary);

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

    private renderBottomButtons(ctx: CanvasRenderingContext2D) {
        if (this.resetButton) {
            drawGlossyButton(ctx, this.resetButton, 'Reset Tab', ColorTokens.action.warning, this.hoveredButton === 'reset');
        }
    }
}
