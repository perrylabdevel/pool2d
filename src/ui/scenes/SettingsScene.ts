import { UIScene } from '../SceneController';
import { uiStateMachine, UIState } from '../UIStateMachine';
import { ColorTokens } from '../theme/ColorTokens';
import { LayoutConstants } from '../theme/LayoutConstants';
import { drawGlossyButton, drawRoundedRect, Rect } from '../components/UIComponents';
import { SettingsManager } from '../SettingsManager';
import { TableAppearance, TABLE_THEMES } from '../../textures/TableAppearance';
import { NavigationBar } from '../components/NavigationBar';
import { drawSceneBackground } from '../components/SceneBackground';

type TabId = 'gameplay' | 'colors' | 'audio' | 'table';
type SubTabId = 'themes' | 'felt' | 'frame' | 'cushion' | 'pocket' | 'lighting';

interface TabButton {
    id: TabId;
    text: string;
    rect: Rect;
}

interface SubTabButton {
    id: SubTabId;
    text: string;
    rect: Rect;
}

interface ThemeCard {
    id: string;
    name: string;
    appearance: TableAppearance;
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
    formatValue?: (value: number) => string;
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

    private activeTab: TabId = 'gameplay';
    private activeSubTab: SubTabId = 'themes';
    private tabButtons: TabButton[] = [];
    private subTabButtons: SubTabButton[] = [];
    private toggleControls: ToggleControl[] = [];
    private sliderControls: SliderControl[] = [];
    private colorControls: ColorControl[] = [];
    private selectControls: SelectControl[] = [];
    private buttonControls: ButtonControl[] = [];
    private themeCards: ThemeCard[] = [];

    private hoveredTab: TabButton | null = null;
    private hoveredSubTab: SubTabButton | null = null;
    private hoveredToggle: ToggleControl | null = null;
    private hoveredSlider: SliderControl | null = null;
    private hoveredColor: ColorControl | null = null;
    private hoveredSelect: SelectControl | null = null;
    private hoveredButton: ButtonControl | null = null;
    private hoveredTheme: ThemeCard | null = null;

    private activeSlider: SliderControl | null = null;
    private muteToggleMap: Record<string, ToggleControl> = {};
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

        const tabHeight = LayoutConstants.Dimensions.ControlHeight;
        const gap = LayoutConstants.Spacing.GapMedium;

        // Tab buttons
        const tabWidth = LayoutConstants.Dimensions.ButtonWidthMedium;
        const tabGap = LayoutConstants.Spacing.GapSmall;
        const totalTabWidth = tabWidth * 4 + tabGap * 3;
        const tabStartX = (width - totalTabWidth) / 2;
        const tabY = navHeight + 20;

        this.tabButtons = [
            { id: 'gameplay', text: 'Gameplay', rect: { x: tabStartX, y: tabY, width: tabWidth, height: tabHeight } },
            { id: 'colors', text: 'Colors', rect: { x: tabStartX + tabWidth + tabGap, y: tabY, width: tabWidth, height: tabHeight } },
            { id: 'audio', text: 'Audio', rect: { x: tabStartX + (tabWidth + tabGap) * 2, y: tabY, width: tabWidth, height: tabHeight } },
            { id: 'table', text: 'Table', rect: { x: tabStartX + (tabWidth + tabGap) * 3, y: tabY, width: tabWidth, height: tabHeight } }
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
        this.muteToggleMap = {};

        const controlWidth = LayoutConstants.Dimensions.ControlWidth;
        const controlHeight = LayoutConstants.Dimensions.ControlHeight;
        const gap = 15;
        const startX = (width - controlWidth) / 2;

        if (this.activeTab === 'gameplay') {
            const gameSettings = this.settingsManager.getGameSettings();
            const renderSettings = this.settingsManager.getRenderSettings();
            let y = startY + 20;

            this.toggleControls = [
                { id: 'aimAssist', label: 'Aim Assist', value: gameSettings.aimAssist, rect: { x: startX, y, width: controlWidth, height: controlHeight } },
                { id: 'call8Ball', label: 'Call 8-Ball', value: gameSettings.call8Ball, rect: { x: startX, y: y += controlHeight + gap, width: controlWidth, height: controlHeight } },
                { id: 'showFPS', label: 'Show FPS/UPS', value: gameSettings.showFPS, rect: { x: startX, y: y += controlHeight + gap, width: controlWidth, height: controlHeight } },
                { id: 'touchAimMode', label: 'Touch Aim Only (power via bar)', value: !!gameSettings.touchAimMode, rect: { x: startX, y: y += controlHeight + gap, width: controlWidth, height: controlHeight } }
            ];

            y += controlHeight + gap * 2;
            this.selectControls = [
                { id: 'aiDifficulty', label: 'AI Difficulty', value: gameSettings.aiDifficulty || 'MEDIUM', options: ['EASY', 'MEDIUM', 'HARD', 'EXPERT'], rect: { x: startX, y, width: controlWidth, height: controlHeight } },
                { id: 'dialSide', label: 'Aim Dial Side', value: gameSettings.sidebarDialSide || 'left', options: ['left', 'right'], rect: { x: startX, y: y += controlHeight + gap, width: controlWidth, height: controlHeight } }
            ];

            y += controlHeight + gap * 2;
            this.sliderControls = [
                {
                    id: 'tableScale',
                    label: 'Table Scale',
                    value: renderSettings.canvasScale ?? 1,
                    min: 0.6,
                    max: 1.6,
                    step: 0.05,
                    rect: { x: startX, y, width: controlWidth, height: controlHeight },
                    formatValue: (v) => `${v.toFixed(2)}x`
                },
                {
                    id: 'ballScale',
                    label: 'Ball Scale',
                    value: renderSettings.ballScale ?? 1,
                    min: 0.8,
                    max: 1.2,
                    step: 0.01,
                    rect: { x: startX, y: y += controlHeight + gap, width: controlWidth, height: controlHeight },
                    formatValue: (v) => `${v.toFixed(2)}x`
                }
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

            const makeMuteToggle = (sliderId: string, toggleId: string, value: boolean) => {
                const slider = this.sliderControls.find(s => s.id === sliderId);
                if (!slider) return;
                const rect = this.buildMuteToggleRect(slider);
                const toggle: ToggleControl = { id: toggleId, label: 'Mute', value, rect };
                this.muteToggleMap[sliderId] = toggle;
                this.toggleControls.push(toggle);
            };

            makeMuteToggle('master', 'muteMaster', audioSettings.muteMaster || false);
            makeMuteToggle('music', 'muteMusic', audioSettings.muteMusic || false);
            makeMuteToggle('uiSounds', 'muteUISounds', audioSettings.muteUISounds || false);
            makeMuteToggle('background', 'muteBackground', audioSettings.muteBackground || false);
        } else if (this.activeTab === 'table') {
            // Setup Sub-tabs
            const subTabs: SubTabId[] = ['themes', 'felt', 'frame', 'cushion', 'pocket'];
            const subTabWidth = 80;
            const subTabHeight = 30;
            const subTabGap = 5;
            const totalSubTabW = subTabs.length * subTabWidth + (subTabs.length - 1) * subTabGap;
            const subTabStartX = (width - totalSubTabW) / 2;
            const subTabY = startY + 10;

            const subTabLabels: Record<SubTabId, string> = {
                themes: 'Themes', felt: 'Felt', frame: 'Frame', cushion: 'Cushion', pocket: 'Pocket', lighting: 'Lighting'
            };

            this.subTabButtons = subTabs.map((id, i) => ({
                id,
                text: subTabLabels[id],
                rect: { x: subTabStartX + i * (subTabWidth + subTabGap), y: subTabY, width: subTabWidth, height: subTabHeight }
            }));

            let y = subTabY + subTabHeight + 20;
            const appearance = this.settingsManager.getTableAppearance();
            const renderSettings = this.settingsManager.getRenderSettings();

            if (this.activeSubTab === 'themes') {
                const cardW = 140, cardH = 90, cardGap = 14;
                const cols = Math.max(1, Math.floor((width - 60) / (cardW + cardGap)));
                const entries = Object.entries(TABLE_THEMES);
                this.themeCards = entries.map(([id, theme], i) => {
                    const row = Math.floor(i / cols), col = i % cols;
                    const rowW = Math.min(cols, entries.length - row * cols) * (cardW + cardGap) - cardGap;
                    const rowStartX = (width - rowW) / 2;
                    return {
                        id, name: theme.name, appearance: theme.appearance,
                        rect: { x: rowStartX + col * (cardW + cardGap), y: y + row * (cardH + cardGap), width: cardW, height: cardH }
                    };
                });
            } else if (this.activeSubTab === 'felt') {
                const colorSize = 36;
                this.colorControls.push({ id: 'feltColor', label: 'Color', value: appearance.felt.color, rect: { x: startX, y, width: controlWidth, height: controlHeight }, colorRect: { x: startX + controlWidth - colorSize - 12, y: y + 7, width: colorSize, height: colorSize } });
                y += controlHeight + gap;
                this.selectControls.push({ id: 'feltPattern', label: 'Pattern', value: appearance.felt.pattern, options: ['solid', 'weave', 'worn'], rect: { x: startX, y, width: controlWidth, height: controlHeight } });
                y += controlHeight + gap;
                this.sliderControls.push({ id: 'feltRoughness', label: 'Roughness', value: appearance.felt.roughness, min: 0, max: 1, step: 0.05, rect: { x: startX, y, width: controlWidth, height: controlHeight }, formatValue: v => `${Math.round(v * 100)}%` });
                y += controlHeight + gap;
                this.sliderControls.push({ id: 'feltTileScale', label: 'Texture Scale', value: appearance.felt.tileScale, min: 1, max: 8, step: 1, rect: { x: startX, y, width: controlWidth, height: controlHeight }, formatValue: v => `${v}x` });
            } else if (this.activeSubTab === 'frame') {
                const colorSize = 36;
                this.colorControls.push({ id: 'frameColor', label: 'Color', value: appearance.frame.color, rect: { x: startX, y, width: controlWidth, height: controlHeight }, colorRect: { x: startX + controlWidth - colorSize - 12, y: y + 7, width: colorSize, height: colorSize } });
                y += controlHeight + gap;
                this.selectControls.push({ id: 'frameMaterial', label: 'Material', value: appearance.frame.material, options: ['oak', 'mahogany', 'ebony', 'walnut', 'metal', 'marble'], rect: { x: startX, y, width: controlWidth, height: controlHeight } });
                y += controlHeight + gap;
                this.sliderControls.push({ id: 'frameGrainAngle', label: 'Grain Angle', value: appearance.frame.grainAngle, min: 0, max: 90, step: 5, rect: { x: startX, y, width: controlWidth, height: controlHeight }, formatValue: v => `${v}°` });
                y += controlHeight + gap;
                this.sliderControls.push({ id: 'frameGlossiness', label: 'Glossiness', value: appearance.frame.glossiness, min: 0, max: 1, step: 0.05, rect: { x: startX, y, width: controlWidth, height: controlHeight }, formatValue: v => `${Math.round(v * 100)}%` });
                y += controlHeight + gap;
                this.sliderControls.push({ id: 'railShadowIntensity', label: 'Rail Shadow', value: renderSettings.railShadowIntensity, min: 0, max: 1, step: 0.05, rect: { x: startX, y, width: controlWidth, height: controlHeight } });
                y += controlHeight + gap;
                this.sliderControls.push({ id: 'railHighlightIntensity', label: 'Rail Highlight', value: renderSettings.railHighlightIntensity, min: 0, max: 1, step: 0.05, rect: { x: startX, y, width: controlWidth, height: controlHeight } });
            } else if (this.activeSubTab === 'cushion') {
                const colorSize = 36;
                this.colorControls.push({ id: 'cushionColor', label: 'Color', value: appearance.cushion.color, rect: { x: startX, y, width: controlWidth, height: controlHeight }, colorRect: { x: startX + controlWidth - colorSize - 12, y: y + 7, width: colorSize, height: colorSize } });
                y += controlHeight + gap;
                this.sliderControls.push({ id: 'cushionGlossiness', label: 'Glossiness', value: appearance.cushion.glossiness, min: 0, max: 1, step: 0.05, rect: { x: startX, y, width: controlWidth, height: controlHeight }, formatValue: v => `${Math.round(v * 100)}%` });
            } else if (this.activeSubTab === 'pocket') {
                const colorSize = 36;
                this.colorControls.push({ id: 'pocketColor', label: 'Color', value: appearance.pocket.color, rect: { x: startX, y, width: controlWidth, height: controlHeight }, colorRect: { x: startX + controlWidth - colorSize - 12, y: y + 7, width: colorSize, height: colorSize } });
                y += controlHeight + gap;
                this.colorControls.push({ id: 'pocketRimColor', label: 'Rim Color', value: appearance.pocket.rimColor, rect: { x: startX, y, width: controlWidth, height: controlHeight }, colorRect: { x: startX + controlWidth - colorSize - 12, y: y + 7, width: colorSize, height: colorSize } });
                y += controlHeight + gap;
                this.selectControls.push({ id: 'pocketStyle', label: 'Style', value: appearance.pocket.style, options: ['leather', 'chrome', 'brass'], rect: { x: startX, y, width: controlWidth, height: controlHeight } });
                y += controlHeight + gap;
                this.sliderControls.push({ id: 'pocketShadowIntensity', label: 'Pocket Shadow', value: renderSettings.pocketShadowIntensity, min: 0, max: 1, step: 0.05, rect: { x: startX, y, width: controlWidth, height: controlHeight } });
                y += controlHeight + gap;
                this.sliderControls.push({ id: 'pocketHighlightIntensity', label: 'Pocket Highlight', value: renderSettings.pocketHighlightIntensity, min: 0, max: 1, step: 0.05, rect: { x: startX, y, width: controlWidth, height: controlHeight } });
            }
        }

        // Add Reset Button to all tabs
        // Calculate Y position based on last control
        let lastY = startY;
        if (this.toggleControls.length > 0) lastY = Math.max(lastY, this.toggleControls[this.toggleControls.length - 1].rect.y);
        if (this.colorControls.length > 0) lastY = Math.max(lastY, this.colorControls[this.colorControls.length - 1].rect.y);
        if (this.selectControls.length > 0) lastY = Math.max(lastY, this.selectControls[this.selectControls.length - 1].rect.y);
        if (this.sliderControls.length > 0) lastY = Math.max(lastY, this.sliderControls[this.sliderControls.length - 1].rect.y);

        const buttonWidth = LayoutConstants.Dimensions.ButtonWidthSmall;
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
            this.hoveredSubTab = null;
            this.hoveredToggle = null;
            this.hoveredSlider = null;
            this.hoveredColor = null;
            this.hoveredSelect = null;
            this.hoveredButton = null;
            this.hoveredTheme = null;
            this.canvas.style.cursor = this.navigationBar.getCursor();
            return;
        }

        let cursor = 'default';

        // Reset all hovered states
        this.hoveredTab = null;
        this.hoveredSubTab = null;
        this.hoveredToggle = null;
        this.hoveredSlider = null;
        this.hoveredColor = null;
        this.hoveredSelect = null;
        this.hoveredButton = null;
        this.hoveredTheme = null;

        // Check tabs
        for (const tab of this.tabButtons) {
            if (this.isInside(x, y, tab.rect)) {
                this.hoveredTab = tab;
                cursor = 'pointer';
                break;
            }
        }

        if (!this.hoveredTab && this.activeTab === 'table') {
            for (const subTab of this.subTabButtons) {
                if (this.isInside(x, y, subTab.rect)) {
                    this.hoveredSubTab = subTab;
                    cursor = 'pointer';
                    break;
                }
            }
        }

        if (!this.hoveredTab && !this.hoveredSubTab) {
            if (this.activeTab === 'table' && this.activeSubTab === 'themes') {
                for (const card of this.themeCards) {
                    if (this.isInside(x, y, card.rect)) {
                        this.hoveredTheme = card;
                        cursor = 'pointer';
                        break;
                    }
                }
            }

            // Check controls
            if (!this.hoveredTheme) {
                for (const toggle of this.toggleControls) {
                    if (this.isInside(x, y, toggle.rect)) {
                        this.hoveredToggle = toggle;
                        cursor = 'pointer';
                        break;
                    }
                }
            }
            // ... rest of controls
            if (!this.hoveredToggle && !this.hoveredTheme) {
                for (const slider of this.sliderControls) {
                    const muteToggle = this.muteToggleMap[slider.id];
                    if (muteToggle && this.isInside(x, y, muteToggle.rect)) {
                        continue;
                    }
                    if (this.isInside(x, y, slider.rect)) {
                        this.hoveredSlider = slider;
                        cursor = 'pointer';
                        break;
                    }
                }
            }
            if (!this.hoveredToggle && !this.hoveredSlider && !this.hoveredTheme) {
                for (const color of this.colorControls) {
                    if (this.isInside(x, y, color.colorRect)) {
                        this.hoveredColor = color;
                        cursor = 'pointer';
                        break;
                    }
                }
            }
            if (!this.hoveredToggle && !this.hoveredSlider && !this.hoveredColor && !this.hoveredTheme) {
                for (const select of this.selectControls) {
                    if (this.isInside(x, y, select.rect)) {
                        this.hoveredSelect = select;
                        cursor = 'pointer';
                        break;
                    }
                }
            }
            if (!this.hoveredToggle && !this.hoveredSlider && !this.hoveredColor && !this.hoveredSelect && !this.hoveredTheme) {
                for (const button of this.buttonControls) {
                    if (this.isInside(x, y, button.rect)) {
                        this.hoveredButton = button;
                        cursor = 'pointer';
                        break;
                    }
                }
            }
        }

        this.canvas.style.cursor = cursor;
    };

    private onMouseDown = (e: MouseEvent) => {
        if (!this.canvas || !this.hoveredSlider) return;
        if (this.hoveredToggle && this.hoveredToggle.id.startsWith('mute')) return;
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
            // Reset sub-tab when switching main tabs if needed, or keep state
            this.setupControls(this.canvas!.width, this.tabButtons[0].rect.y + this.tabButtons[0].rect.height + 20);
            return;
        }

        if (this.activeTab === 'table') {
            if (this.hoveredSubTab) {
                this.activeSubTab = this.hoveredSubTab.id;
                this.setupControls(this.canvas!.width, this.tabButtons[0].rect.y + this.tabButtons[0].rect.height + 20);
                return;
            }
            if (this.activeSubTab === 'themes' && this.hoveredTheme) {
                try {
                    this.settingsManager.applyTheme(this.hoveredTheme.id);
                    // Refresh controls to reflect new theme
                    this.setupControls(this.canvas!.width, this.tabButtons[0].rect.y + this.tabButtons[0].rect.height + 20);
                } catch (err) { console.error(err); }
                return;
            }
        }

        if (this.hoveredToggle) {
            const control = this.hoveredToggle;
            this.handleToggle(control);
            return;
        }

        if (this.hoveredButton) {
            if (this.hoveredButton.id === 'reset') {
                this.handleReset();
            }
            return;
        }

        if (this.hoveredSelect) {
            this.handleSelectClick(this.hoveredSelect);
            return;
        }

        if (this.hoveredColor) {
            const control = this.hoveredColor;
            const input = document.createElement('input');
            input.type = 'color';
            input.value = control.value;
            input.style.position = 'absolute';
            input.style.opacity = '0';
            document.body.appendChild(input);

            input.addEventListener('input', () => {
                control.value = input.value;
                if (this.activeTab === 'colors') {
                    const update: any = {};
                    update[control.id] = input.value;
                    this.settingsManager.saveUIColors(update);
                } else if (this.activeTab === 'table') {
                    const appearance = this.settingsManager.getTableAppearance();
                    if (control.id === 'feltColor') this.settingsManager.saveTableAppearance({ felt: { ...appearance.felt, color: input.value } });
                    else if (control.id === 'frameColor') this.settingsManager.saveTableAppearance({ frame: { ...appearance.frame, color: input.value } });
                    else if (control.id === 'cushionColor') this.settingsManager.saveTableAppearance({ cushion: { ...appearance.cushion, color: input.value } });
                    else if (control.id === 'pocketColor') this.settingsManager.saveTableAppearance({ pocket: { ...appearance.pocket, color: input.value } });
                    else if (control.id === 'pocketRimColor') this.settingsManager.saveTableAppearance({ pocket: { ...appearance.pocket, rimColor: input.value } });
                }
            });

            input.addEventListener('change', () => {
                document.body.removeChild(input);
            });

            input.click();
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
                case 'touchAimMode':
                    this.settingsManager.saveGameSettings({ touchAimMode: newValue });
                    break;
            }
        } else if (this.activeTab === 'audio') {
            const update: any = {};
            update[control.id] = newValue;
            this.settingsManager.saveAudioSettings(update);
        }
    }



    private handleSelectClick(control: SelectControl) {
        // Cycle through options
        const currentIndex = control.options.indexOf(control.value);
        const nextIndex = (currentIndex + 1) % control.options.length;
        control.value = control.options[nextIndex];

        if (control.id === 'aiDifficulty') {
            this.settingsManager.saveGameSettings({ aiDifficulty: control.value as any });
            window.dispatchEvent(new CustomEvent('game:ai-difficulty-changed', { detail: { value: control.value } }));
        } else if (control.id === 'dialSide') {
            this.settingsManager.saveGameSettings({ sidebarDialSide: control.value as 'left' | 'right' });
        } else if (this.activeTab === 'table') {
            const appearance = this.settingsManager.getTableAppearance();
            if (control.id === 'feltPattern') {
                this.settingsManager.saveTableAppearance({ felt: { ...appearance.felt, pattern: control.value as any } });
            } else if (control.id === 'frameMaterial') {
                this.settingsManager.saveTableAppearance({ frame: { ...appearance.frame, material: control.value as any } });
            } else if (control.id === 'pocketStyle') {
                this.settingsManager.saveTableAppearance({ pocket: { ...appearance.pocket, style: control.value as any } });
            }
        }
    }

    private handleSliderDrag(control: SliderControl, mouseX: number) {
        const { sliderX, sliderWidth } = this.getSliderLayout(control, !!this.muteToggleMap[control.id]);

        let percent = (mouseX - sliderX) / sliderWidth;
        percent = Math.max(0, Math.min(1, percent));

        let newValue = control.min + percent * (control.max - control.min);
        if (control.step > 0) {
            newValue = control.min + Math.round((newValue - control.min) / control.step) * control.step;
        }
        newValue = Math.max(control.min, Math.min(control.max, newValue));
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
        } else if (this.activeTab === 'gameplay') {
            if (control.id === 'ballScale' || control.id === 'tableScale') {
                const update: any = {};
                if (control.id === 'ballScale') update.ballScale = newValue;
                if (control.id === 'tableScale') update.canvasScale = newValue;
                this.settingsManager.saveRenderSettings(update);
            }
        } else if (this.activeTab === 'table') {
            if (['railShadowIntensity', 'railHighlightIntensity', 'pocketShadowIntensity', 'pocketHighlightIntensity'].includes(control.id)) {
                const update: any = {};
                update[control.id] = newValue;
                this.settingsManager.saveRenderSettings(update);
            } else {
                // Table Appearance Updates
                const appearance = this.settingsManager.getTableAppearance();
                if (control.id.startsWith('felt')) {
                    const key = control.id.replace('felt', '');
                    const prop = key.charAt(0).toLowerCase() + key.slice(1);
                    this.settingsManager.saveTableAppearance({ felt: { ...appearance.felt, [prop]: newValue } });
                } else if (control.id.startsWith('frame')) {
                    const key = control.id.replace('frame', '');
                    const prop = key.charAt(0).toLowerCase() + key.slice(1);
                    this.settingsManager.saveTableAppearance({ frame: { ...appearance.frame, [prop]: newValue } });
                } else if (control.id.startsWith('cushion')) {
                    const key = control.id.replace('cushion', '');
                    const prop = key.charAt(0).toLowerCase() + key.slice(1);
                    this.settingsManager.saveTableAppearance({ cushion: { ...appearance.cushion, [prop]: newValue } });
                }
            }
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
            this.settingsManager.saveRenderSettings({
                canvasScale: 1,
                ballScale: 1
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

        if (this.activeTab === 'table') {
            this.renderSubTabs(ctx);
            if (this.activeSubTab === 'themes') {
                this.renderThemes(ctx);
            } else {
                this.renderControls(ctx);
            }
        } else {
            this.renderControls(ctx);
        }
        this.navigationBar.render(ctx, width);
    }

    private renderSubTabs(ctx: CanvasRenderingContext2D) {
        for (const tab of this.subTabButtons) {
            const isActive = tab.id === this.activeSubTab;
            const isHovered = tab === this.hoveredSubTab;
            const color = isActive ? ColorTokens.action.info : ColorTokens.ui.gray;
            drawGlossyButton(ctx, tab.rect, tab.text, color, isHovered);
        }
    }

    private isThemeSelected(app: TableAppearance): boolean {
        const cur = this.settingsManager.getTableAppearance();
        return cur.felt.color === app.felt.color && cur.frame.color === app.frame.color;
    }

    private renderThemes(ctx: CanvasRenderingContext2D) {
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
    private renderBackground(ctx: CanvasRenderingContext2D, width: number, height: number) {
        drawSceneBackground(ctx, width, height, 'blue');
    }
    private drawControlBackground(ctx: CanvasRenderingContext2D, rect: Rect) {
        const r = LayoutConstants.Radii.Medium;

        // 1. Darker Background (Recessed)
        ctx.fillStyle = ColorTokens.background.overlay;
        drawRoundedRect(ctx, rect.x, rect.y, rect.width, rect.height, r);
        ctx.fill();

        // 2. Inset Shadow (Top)
        ctx.save();
        ctx.clip();
        const shadowGrad = ctx.createLinearGradient(rect.x, rect.y, rect.x, rect.y + 15);
        shadowGrad.addColorStop(0, ColorTokens.background.overlayDark);
        shadowGrad.addColorStop(1, ColorTokens.effects.gloss.none);
        ctx.fillStyle = shadowGrad;
        ctx.fillRect(rect.x, rect.y, rect.width, 15);
        ctx.restore();

        // 3. Bottom Highlight (subtle light from below)
        ctx.save();
        ctx.clip();
        const highlightGrad = ctx.createLinearGradient(rect.x, rect.y + rect.height - 10, rect.x, rect.y + rect.height);
        highlightGrad.addColorStop(0, ColorTokens.effects.gloss.none);
        highlightGrad.addColorStop(1, ColorTokens.effects.gloss.end);
        ctx.fillStyle = highlightGrad;
        ctx.fillRect(rect.x, rect.y + rect.height - 10, rect.width, 10);
        ctx.restore();

        // 4. Border (Subtle Metallic)
        ctx.strokeStyle = ColorTokens.border.default;
        ctx.lineWidth = LayoutConstants.Lines.Thin;
        drawRoundedRect(ctx, rect.x, rect.y, rect.width, rect.height, r);
        ctx.stroke();
    }

    private renderTabs(ctx: CanvasRenderingContext2D) {
        for (const tab of this.tabButtons) {
            const isActive = tab.id === this.activeTab;
            const isHovered = tab === this.hoveredTab;
            const color = isActive ? ColorTokens.action.info : ColorTokens.ui.gray;

            drawGlossyButton(ctx, tab.rect, tab.text, color, isHovered);
        }
    }

    private renderToggle(ctx: CanvasRenderingContext2D, control: ToggleControl, isHovered: boolean) {
        const rect = control.rect;

        // Background
        this.drawControlBackground(ctx, rect);

        if (isHovered) {
            ctx.save();
            ctx.fillStyle = ColorTokens.effects.gloss.end;
            ctx.beginPath();
            ctx.roundRect(rect.x, rect.y, rect.width, rect.height, LayoutConstants.Radii.Medium);
            ctx.fill();
            ctx.restore();
        }

        // Label (HUD Style)
        ctx.save();
        ctx.fillStyle = ColorTokens.text.primary;
        ctx.font = `bold ${LayoutConstants.Fonts.Size.Medium}px ${LayoutConstants.Fonts.Family.Default}`;
        ctx.textAlign = 'left';
        ctx.textBaseline = 'middle';
        ctx.shadowColor = ColorTokens.effects.shadowText;
        ctx.shadowBlur = LayoutConstants.Shadows.Text.blur;
        ctx.fillText(control.label.toUpperCase(), rect.x + 20, rect.y + rect.height / 2);
        ctx.restore();

        // Toggle switch (Rectangular Track)
        const switchWidth = LayoutConstants.Dimensions.ToggleSwitchWidth;
        const switchHeight = LayoutConstants.Dimensions.ToggleSwitchHeight;
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
        ctx.shadowColor = ColorTokens.effects.shadowLight;
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
        this.drawControlBackground(ctx, rect);

        if (isHovered) {
            ctx.save();
            ctx.fillStyle = ColorTokens.effects.gloss.end;
            ctx.beginPath();
            ctx.roundRect(rect.x, rect.y, rect.width, rect.height, LayoutConstants.Radii.Medium);
            ctx.fill();
            ctx.restore();
        }

        // Label (HUD Style)
        ctx.save();
        ctx.fillStyle = ColorTokens.text.primary;
        ctx.font = `bold ${LayoutConstants.Fonts.Size.Medium}px ${LayoutConstants.Fonts.Family.Default}`;
        ctx.textAlign = 'left';
        ctx.textBaseline = 'middle';
        ctx.shadowColor = ColorTokens.effects.shadowText;
        ctx.shadowBlur = LayoutConstants.Shadows.Text.blur;
        ctx.fillText(control.label.toUpperCase(), rect.x + 20, rect.y + rect.height / 2);
        ctx.restore();

        // Color swatch (Framed & Glossy)
        const colorRect = control.colorRect;
        const cr = 6;

        ctx.save();

        // Shadow
        ctx.shadowColor = ColorTokens.effects.shadow;
        ctx.shadowBlur = LayoutConstants.Shadows.Text.blur;
        ctx.shadowOffsetY = LayoutConstants.Shadows.Text.offsetY;

        // Fill
        ctx.fillStyle = control.value;
        ctx.beginPath();
        ctx.roundRect(colorRect.x, colorRect.y, colorRect.width, colorRect.height, cr);
        ctx.fill();

        // Reset shadow
        ctx.shadowColor = 'transparent';

        // Gloss
        ctx.fillStyle = ColorTokens.border.subtle;
        ctx.beginPath();
        ctx.roundRect(colorRect.x, colorRect.y, colorRect.width, colorRect.height / 2, cr);
        ctx.fill();

        // Rim
        ctx.strokeStyle = isHovered ? ColorTokens.text.primary : ColorTokens.text.muted;
        ctx.lineWidth = isHovered ? 3 : 2;
        ctx.beginPath();
        ctx.roundRect(colorRect.x, colorRect.y, colorRect.width, colorRect.height, cr);
        ctx.stroke();

        ctx.restore();
    }

    private renderSelect(ctx: CanvasRenderingContext2D, control: SelectControl, isHovered: boolean) {
        const rect = control.rect;

        // Background
        this.drawControlBackground(ctx, rect);

        if (isHovered) {
            ctx.save();
            ctx.fillStyle = ColorTokens.effects.gloss.end;
            ctx.beginPath();
            ctx.roundRect(rect.x, rect.y, rect.width, rect.height, LayoutConstants.Radii.Medium);
            ctx.fill();
            ctx.restore();
        }

        // Label (HUD Style)
        ctx.save();
        ctx.fillStyle = ColorTokens.text.primary;
        ctx.font = `bold ${LayoutConstants.Fonts.Size.Medium}px ${LayoutConstants.Fonts.Family.Default}`;
        ctx.textAlign = 'left';
        ctx.textBaseline = 'middle';
        ctx.shadowColor = ColorTokens.effects.shadowText;
        ctx.shadowBlur = LayoutConstants.Shadows.Text.blur;
        ctx.fillText(control.label.toUpperCase(), rect.x + 20, rect.y + rect.height / 2);
        ctx.restore();

        // Value as Mini Glossy Button
        const btnWidth = 140;
        const btnHeight = 32;
        const btnX = rect.x + rect.width - btnWidth - 10;
        const btnY = rect.y + (rect.height - btnHeight) / 2;

        drawGlossyButton(ctx, { x: btnX, y: btnY, width: btnWidth, height: btnHeight }, `${control.value} ▼`, ColorTokens.action.info, isHovered);
    }

    private renderSlider(ctx: CanvasRenderingContext2D, control: SliderControl, isHovered: boolean, muteToggle?: ToggleControl) {
        const rect = control.rect;
        const muteHovered = muteToggle ? muteToggle === this.hoveredToggle : false;
        const { sliderX, sliderY, sliderWidth, sliderHeight, gap } = this.getSliderLayout(control, !!muteToggle);

        // Background
        this.drawControlBackground(ctx, rect);

        if (isHovered) {
            ctx.save();
            ctx.fillStyle = ColorTokens.effects.gloss.end;
            ctx.beginPath();
            ctx.roundRect(rect.x, rect.y, rect.width, rect.height, LayoutConstants.Radii.Medium);
            ctx.fill();
            ctx.restore();
        }

        // Label (HUD Style)
        ctx.save();
        ctx.fillStyle = ColorTokens.text.primary;
        ctx.font = `bold ${LayoutConstants.Fonts.Size.Medium}px ${LayoutConstants.Fonts.Family.Default}`;
        ctx.textAlign = 'left';
        ctx.textBaseline = 'middle';
        ctx.shadowColor = ColorTokens.effects.shadowText;
        ctx.shadowBlur = LayoutConstants.Shadows.Text.blur;
        ctx.fillText(control.label.toUpperCase(), rect.x + 20, rect.y + rect.height / 2);
        ctx.restore();

        // Slider Track
        ctx.save();
        ctx.fillStyle = ColorTokens.border.subtle;
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
        const knobWidth = LayoutConstants.Dimensions.SliderKnobSize;
        const knobHeight = LayoutConstants.Dimensions.SliderKnobSize;
        const knobX = sliderX + sliderWidth * percent - knobWidth / 2;
        const knobY = sliderY + sliderHeight / 2 - knobHeight / 2;

        // Knob Shadow
        ctx.shadowColor = ColorTokens.effects.shadowLight;
        ctx.shadowBlur = LayoutConstants.Shadows.Text.blur;
        ctx.shadowOffsetY = LayoutConstants.Shadows.Text.offsetY;

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

        if (muteToggle) {
            this.renderMuteToggle(ctx, muteToggle, muteHovered);
        }

        // Value Text
        ctx.save();
        ctx.fillStyle = ColorTokens.text.secondary;
        ctx.font = `${LayoutConstants.Fonts.Size.Small}px ${LayoutConstants.Fonts.Family.Monospace}`;
        ctx.textAlign = 'right';
        ctx.textBaseline = 'middle';
        const valueX = muteToggle ? muteToggle.rect.x - gap : sliderX - 10;
        const renderValue = control.formatValue ? control.formatValue(control.value) : `${Math.round(control.value * 100)}%`;
        ctx.fillText(renderValue, valueX, rect.y + rect.height / 2);
        ctx.restore();
    }

    private renderMuteToggle(ctx: CanvasRenderingContext2D, control: ToggleControl, isHovered: boolean) {
        const rect = control.rect;
        const padding = 6;
        const iconSize = LayoutConstants.Dimensions.IconSizeSmall;
        const iconColor = control.value ? ColorTokens.action.warning : ColorTokens.text.primary;
        const switchWidth = 44;
        const switchHeight = 20;
        const switchX = rect.x + padding;
        const switchY = rect.y + (rect.height - switchHeight) / 2;
        const iconX = rect.x + rect.width - iconSize - padding;
        const iconY = rect.y + (rect.height - iconSize) / 2;

        // Light frame to sit above the slider track
        ctx.save();
        ctx.fillStyle = ColorTokens.background.overlay;
        ctx.beginPath();
        ctx.roundRect(rect.x, rect.y, rect.width, rect.height, LayoutConstants.Radii.Medium);
        ctx.fill();

        if (isHovered) {
            ctx.strokeStyle = ColorTokens.action.info;
            ctx.lineWidth = LayoutConstants.Lines.Normal;
            ctx.stroke();
        }
        ctx.restore();

        // Toggle switch
        ctx.save();
        ctx.fillStyle = control.value ? ColorTokens.action.warning : ColorTokens.ui.gray;
        ctx.beginPath();
        ctx.roundRect(switchX, switchY, switchWidth, switchHeight, 4);
        ctx.fill();

        const knobSize = 16;
        const knobMargin = 2;
        const knobX = control.value ? switchX + switchWidth - knobSize - knobMargin : switchX + knobMargin;
        const knobY = switchY + (switchHeight - knobSize) / 2;

        ctx.shadowColor = 'rgba(0, 0, 0, 0.4)';
        ctx.shadowBlur = 3;
        ctx.shadowOffsetY = 1;

        ctx.fillStyle = ColorTokens.text.primary;
        ctx.beginPath();
        ctx.roundRect(knobX, knobY, knobSize, knobSize, 3);
        ctx.fill();

        ctx.restore();

        // Speaker icon to the right
        ctx.save();
        ctx.translate(iconX, iconY);
        const scale = iconSize / 16;
        ctx.scale(scale, scale);
        ctx.fillStyle = iconColor;
        ctx.strokeStyle = iconColor;
        ctx.lineWidth = LayoutConstants.Lines.Normal;

        // Speaker body
        ctx.beginPath();
        ctx.moveTo(2, 6);
        ctx.lineTo(6, 6);
        ctx.lineTo(10, 3);
        ctx.lineTo(10, 13);
        ctx.lineTo(6, 10);
        ctx.lineTo(2, 10);
        ctx.closePath();
        ctx.fill();

        if (control.value) {
            // Muted slash
            ctx.beginPath();
            ctx.moveTo(11, 4);
            ctx.lineTo(16, 12);
            ctx.stroke();
            ctx.beginPath();
            ctx.moveTo(16, 4);
            ctx.lineTo(11, 12);
            ctx.stroke();
        } else {
            // Sound waves
            ctx.beginPath();
            ctx.arc(12, 8, 3, -Math.PI / 4, Math.PI / 4);
            ctx.stroke();
            ctx.beginPath();
            ctx.arc(14, 8, 5, -Math.PI / 6, Math.PI / 6);
            ctx.stroke();
        }
        ctx.restore();
    }

    private getMuteToggleSize() {
        return { width: 72, height: 32 };
    }

    private getSliderLayout(control: SliderControl, hasMute: boolean) {
        const sliderWidth = 200;
        const sliderHeight = LayoutConstants.Dimensions.SliderTrackHeight;
        const muteSize = hasMute ? this.getMuteToggleSize() : { width: 0, height: 0 };
        const gap = hasMute ? 12 : 0;
        const sliderX = control.rect.x + control.rect.width - sliderWidth - 20 - muteSize.width - gap;
        const sliderY = control.rect.y + (control.rect.height - sliderHeight) / 2;
        return { sliderX, sliderY, sliderWidth, sliderHeight, gap, muteSize };
    }

    private buildMuteToggleRect(slider: SliderControl): Rect {
        const { sliderX, sliderWidth, gap, muteSize } = this.getSliderLayout(slider, true);
        const x = sliderX + sliderWidth + gap;
        const y = slider.rect.y + (slider.rect.height - muteSize.height) / 2;
        return { x, y, width: muteSize.width, height: muteSize.height };
    }

    private renderControls(ctx: CanvasRenderingContext2D) {
        // Render toggles
        for (const toggle of this.toggleControls) {
            // Audio mute toggles are rendered inline with sliders
            if (this.activeTab === 'audio' && toggle.id.startsWith('mute')) continue;
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
            const muteToggle = this.muteToggleMap[slider.id];
            this.renderSlider(ctx, slider, slider === this.hoveredSlider, muteToggle);
        }

        // Render buttons
        for (const button of this.buttonControls) {
            this.renderButton(ctx, button, button === this.hoveredButton);
        }
    }

    private renderButton(ctx: CanvasRenderingContext2D, button: ButtonControl, isHovered: boolean) {
        const rect = button.rect;

        // Use drawGlossyButton for consistent styling
        drawGlossyButton(ctx, rect, button.label, button.color, isHovered);
    }
}
