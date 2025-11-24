import { ColorTokens } from '../theme/ColorTokens';
import { LayoutConstants } from '../theme/LayoutConstants';
import { drawCurrencyPill, Rect } from './UIComponents';
import { uiStateMachine, UIState } from '../UIStateMachine';
import { currencyStore } from '../CurrencyStore';
import { AssetRegistry } from '../../assets/AssetRegistry';
import { AssetLoader } from '../../assets/AssetLoader';

export interface NavigationBarConfig {
    title?: string;
    showBack?: boolean;
    showProfile?: boolean;
    showCurrencies?: boolean;
    showSettings?: boolean;
    backState?: UIState;
    onBack?: () => void;
    onProfile?: () => void;
    onSettings?: () => void;
    balancesProvider?: () => { coins: number; gold: number };
}

interface NavButton {
    id: 'back' | 'profile' | 'settings';
    rect: Rect;
    icon?: string;
}

export class NavigationBar {
    private config: NavigationBarConfig;
    private buttons: NavButton[] = [];
    private hoveredButton: NavButton | null = null;
    private height = 104; // Match HUD header: 12px header padding + (8px player padding + 64px avatar + 8px player padding) + 12px header padding
    private logoImage: HTMLImageElement;

    constructor(config: NavigationBarConfig) {
        this.config = {
            showBack: true,
            showProfile: true,
            showCurrencies: true,
            showSettings: true,
            balancesProvider: () => currencyStore.getBalances(),
            ...config
        };

        // Load logo image
        this.logoImage = AssetLoader.loadImageSync(AssetRegistry.branding.logo());
    }

    updateConfig(config: Partial<NavigationBarConfig>) {
        this.config = { ...this.config, ...config };
    }

    getHeight(): number {
        return this.height;
    }

    setupLayout(width: number) {
        this.buttons = [];
        const horizontalPadding = 0;
        const buttonHeight = this.height;
        const backWidth = 132; // 25% smaller than original 176
        const pillMetrics = this.getCurrencyPillMetrics(buttonHeight);
        const settingsWidth = Math.max(96, buttonHeight * 0.6);
        const profileSize = buttonHeight;

        // Back button (left)
        if (this.config.showBack) {
            this.buttons.push({
                id: 'back',
                rect: { x: horizontalPadding, y: 0, width: backWidth, height: buttonHeight },
            });
        }

        // Calculate right side layout from right to left
        // Order: Profile -> Settings -> Currencies
        let rightX = width - horizontalPadding;

        // 1. Profile (Far Right)
        if (this.config.showProfile) {
            rightX -= profileSize;
            this.buttons.push({
                id: 'profile',
                rect: { x: rightX, y: 0, width: profileSize, height: profileSize },
            });
        }

        // 2. Settings (Left of Profile)
        if (this.config.showSettings) {
            rightX -= settingsWidth;
            this.buttons.push({
                id: 'settings',
                rect: { x: rightX, y: 0, width: settingsWidth, height: buttonHeight },
            });
        }

        // 3. Currencies (Left of Settings)
        // We don't add buttons for currencies here, but renderCurrencies will use the same logic
        // to determine where to start drawing.
    }

    handleMouseMove(x: number, y: number): boolean {
        if (y > this.height) {
            this.hoveredButton = null;
            return false;
        }

        this.hoveredButton = null;
        for (const btn of this.buttons) {
            if (this.isInside(x, y, btn.rect)) {
                this.hoveredButton = btn;
                return true;
            }
        }
        return false;
    }

    handleClick(_x: number, y: number): boolean {
        if (!this.hoveredButton || y > this.height) return false;

        switch (this.hoveredButton.id) {
            case 'back':
                if (this.config.onBack) {
                    this.config.onBack();
                } else if (this.config.backState) {
                    uiStateMachine.transitionTo(this.config.backState);
                }
                return true;
            case 'profile':
                if (this.config.onProfile) {
                    this.config.onProfile();
                } else {
                    uiStateMachine.transitionTo(UIState.PROFILE);
                }
                return true;
            case 'settings':
                if (this.config.onSettings) {
                    this.config.onSettings();
                } else {
                    (window as Window & { __settingsReturnState?: UIState }).__settingsReturnState = uiStateMachine.state;
                    uiStateMachine.transitionTo(UIState.SETTINGS);
                }
                return true;
        }
        return false;
    }

    getCursor(): string {
        return this.hoveredButton ? 'pointer' : 'default';
    }

    render(ctx: CanvasRenderingContext2D, width: number) {
        const height = this.height;

        ctx.save();

        // First draw shadow (box-shadow: 0 4px 20px rgba(0, 0, 0, 0.5))
        ctx.shadowColor = 'rgba(0, 0, 0, 0.5)';
        ctx.shadowBlur = 20;
        ctx.shadowOffsetY = 4;

        // Match HUD header styling: linear-gradient(180deg, rgba(13, 20, 36, 0.95) 0%, rgba(0, 11, 26, 0.9) 100%)
        const gradient = ctx.createLinearGradient(0, 0, 0, height);
        gradient.addColorStop(0, 'rgba(13, 20, 36, 0.95)');
        gradient.addColorStop(1, 'rgba(0, 11, 26, 0.9)');
        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, width, height);

        // Reset shadow for subsequent drawing
        ctx.shadowColor = 'transparent';
        ctx.shadowBlur = 0;
        ctx.shadowOffsetY = 0;

        // Bottom border matching HUD: 1px solid rgba(255, 255, 255, 0.1)
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(0, height);
        ctx.lineTo(width, height);
        ctx.stroke();

        ctx.restore();

        // Logo (centered) - replaces title text
        if (this.logoImage && this.logoImage.complete && this.logoImage.naturalWidth > 0) {
            ctx.save();

            // Logo dimensions - scaled to fit nicely in the nav bar
            const logoMaxHeight = height * 0.65; // 65% of nav bar height
            const logoAspect = this.logoImage.naturalWidth / this.logoImage.naturalHeight;
            const logoHeight = logoMaxHeight;
            const logoWidth = logoHeight * logoAspect;
            const logoX = (width / 2) - (logoWidth / 2);
            const logoY = (height / 2) - (logoHeight / 2);

            // Subtle shadow for logo
            ctx.shadowColor = 'rgba(0, 0, 0, 0.5)';
            ctx.shadowBlur = 12;
            ctx.shadowOffsetY = 4;

            ctx.drawImage(this.logoImage, logoX, logoY, logoWidth, logoHeight);
            ctx.restore();
        } else if (this.config.title) {
            // Fallback to text if logo hasn't loaded yet
            ctx.save();
            ctx.fillStyle = ColorTokens.text.primary;
            ctx.font = 'bold 28px Arial';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.shadowColor = ColorTokens.effects.shadow;
            ctx.shadowBlur = 8;
            ctx.fillText(this.config.title, width / 2, height / 2);
            ctx.restore();
        }

        // Buttons
        for (const btn of this.buttons) {
            const hovered = btn === this.hoveredButton;
            if (btn.id === 'back') {
                this.renderBackButton(ctx, btn, hovered);
            } else if (btn.id === 'profile') {
                this.renderProfileButton(ctx, btn, hovered);
            } else if (btn.id === 'settings') {
                this.renderSettingsButton(ctx, btn, hovered);
            } else {
                this.renderStandardButton(ctx, btn, hovered);
            }
        }

        // Currencies (if enabled)
        if (this.config.showCurrencies) {
            this.renderCurrencies(ctx, width);
        }
    }

    private renderStandardButton(ctx: CanvasRenderingContext2D, btn: NavButton, isHovered: boolean) {
        const rect = btn.rect;

        ctx.save();

        // Button background with subtle fill
        if (isHovered) {
            const gradient = ctx.createRadialGradient(
                rect.x + rect.width / 2,
                rect.y + rect.height / 2,
                0,
                rect.x + rect.width / 2,
                rect.y + rect.height / 2,
                rect.width / 2
            );
            gradient.addColorStop(0, 'rgba(33, 150, 243, 0.15)');
            gradient.addColorStop(1, 'rgba(33, 150, 243, 0.05)');
            ctx.fillStyle = gradient;
            ctx.beginPath();
            ctx.roundRect(rect.x, rect.y, rect.width, rect.height, 8);
            ctx.fill();
        }

        // Button border
        ctx.strokeStyle = isHovered ? ColorTokens.action.info : 'rgba(255, 255, 255, 0.15)';
        ctx.lineWidth = isHovered ? 2 : 1;
        ctx.beginPath();
        ctx.roundRect(rect.x, rect.y, rect.width, rect.height, 8);
        ctx.stroke();

        // Icon with consistent sizing
        ctx.fillStyle = isHovered ? ColorTokens.action.info : ColorTokens.text.secondary;
        ctx.font = '20px Arial';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        if (btn.icon) {
            ctx.fillText(btn.icon, rect.x + rect.width / 2, rect.y + rect.height / 2);
        }

        ctx.restore();
    }

    private renderSettingsButton(ctx: CanvasRenderingContext2D, btn: NavButton, isHovered: boolean) {
        const { x, y, width, height } = btn.rect;
        ctx.save();
        ctx.fillStyle = isHovered ? 'rgba(0, 0, 0, 0.45)' : 'rgba(0, 0, 0, 0.35)';
        ctx.fillRect(x, y, width, height);

        ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
        ctx.font = `${LayoutConstants.Fonts.Weight.Bold} ${Math.max(32, height * 0.5)}px ${LayoutConstants.Fonts.Family.Display}`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('⚙', x + width / 2, y + height / 2 + 2);

        ctx.fillStyle = 'rgba(255, 255, 255, 0.12)';
        ctx.fillRect(x, y + 6, 1, height - 12);
        ctx.fillRect(x + width - 1, y + 6, 1, height - 12);
        ctx.restore();
    }

    private renderCurrencies(ctx: CanvasRenderingContext2D, width: number) {
        const metrics = this.getCurrencyPillMetrics(this.height);
        const currencyY = (this.height - metrics.height) / 2;
        const gap = 24;
        
        // Calculate starting position from right, matching setupLayout logic
        let rightX = width; // - horizontalPadding (0)
        const buttonHeight = this.height;

        if (this.config.showProfile) {
            const profileSize = buttonHeight;
            rightX -= profileSize;
        }

        if (this.config.showSettings) {
            const settingsWidth = Math.max(96, buttonHeight * 0.6);
            rightX -= settingsWidth;
        }
        
        // Apply some padding from the buttons
        rightX -= 24;

        // Position from right of the available space
        // Order: [Coins] [Gap] [Cash] [rightX]
        const cashX = rightX - metrics.totalWidth;
        const coinsX = cashX - gap - metrics.totalWidth;

        const balances = this.config.balancesProvider ? this.config.balancesProvider() : { coins: 0, gold: 0 };

        const baseOptions = {
            width: metrics.width,
            height: metrics.height,
            plusButton: false,
            theme: 'nav' as const,
        };

        drawCurrencyPill(ctx, coinsX, currencyY, balances.coins, 'coins', {
            ...baseOptions,
            dividerLeft: false,
            dividerRight: false,
        });
        drawCurrencyPill(ctx, cashX, currencyY, balances.gold, 'cash', {
            ...baseOptions,
            dividerLeft: false,
            dividerRight: false,
        });
    }

    private renderBackButton(ctx: CanvasRenderingContext2D, btn: NavButton, isHovered: boolean) {
        const { x, y, width, height } = btn.rect;

        ctx.save();

        // Flat background - solid color, full height rectangle
        ctx.fillStyle = isHovered ? '#d32f2f' : '#b71c1c';
        ctx.fillRect(x, y, width, height);

        // Subtle right border for definition
        ctx.strokeStyle = isHovered ? 'rgba(255, 255, 255, 0.2)' : 'rgba(0, 0, 0, 0.2)';
        ctx.lineWidth = 1;
        ctx.fillRect(x + width - 1, y, 1, height);

        // Stylized arrow using a more interesting font
        const iconSize = Math.max(36, height * 0.45);
        ctx.fillStyle = '#FFFFFF';
        ctx.font = `${iconSize}px "Georgia", serif`; // Serif font for more elegant arrow
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.shadowColor = 'rgba(0, 0, 0, 0.4)';
        ctx.shadowBlur = 3;
        ctx.fillText('←', x + width / 2, y + height / 2);

        ctx.shadowBlur = 0;
        ctx.shadowColor = 'transparent';

        ctx.restore();
    }

    private renderProfileButton(ctx: CanvasRenderingContext2D, btn: NavButton, isHovered: boolean) {
        const { x, y, width, height } = btn.rect;
        ctx.save();
        ctx.fillStyle = isHovered ? 'rgba(0, 0, 0, 0.45)' : 'rgba(0, 0, 0, 0.35)';
        ctx.fillRect(x, y, width, height);

        ctx.fillStyle = 'rgba(255, 255, 255, 0.12)';
        ctx.fillRect(x, y + 6, 1, height - 12);
        ctx.fillRect(x + width - 1, y + 6, 1, height - 12);

        const overlay = ctx.createLinearGradient(x, y, x, y + height);
        overlay.addColorStop(0, 'rgba(255, 255, 255, 0.12)');
        overlay.addColorStop(0.3, 'rgba(255, 255, 255, 0.04)');
        overlay.addColorStop(1, 'rgba(255, 255, 255, 0)');
        ctx.fillStyle = overlay;
        ctx.fillRect(x, y, width, height / 2);

        const centerX = x + width / 2;
        const headRadius = height * 0.18;
        const bodyRadius = height * 0.3;
        ctx.fillStyle = 'rgba(255, 255, 255, 0.85)';
        ctx.beginPath();
        ctx.arc(centerX, y + height * 0.38, headRadius, 0, Math.PI * 2);
        ctx.fill();

        ctx.beginPath();
        ctx.moveTo(centerX - bodyRadius, y + height * 0.7);
        ctx.quadraticCurveTo(centerX, y + height * 0.5, centerX + bodyRadius, y + height * 0.7);
        ctx.lineTo(centerX + bodyRadius, y + height * 0.95);
        ctx.lineTo(centerX - bodyRadius, y + height * 0.95);
        ctx.closePath();
        ctx.fill();

        ctx.restore();
    }

    private getCurrencyPillMetrics(buttonHeight: number) {
        const height = 42;
        const width = 150;
        const plusButtonSpace = 0; // removed plus button
        return { height, width, totalWidth: width + plusButtonSpace };
    }

    private isInside(x: number, y: number, rect: Rect): boolean {
        return x >= rect.x && x <= rect.x + rect.width && y >= rect.y && y <= rect.y + rect.height;
    }
}
