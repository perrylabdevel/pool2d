import { ColorTokens } from '../theme/ColorTokens';
import { drawRoundedRect, drawCurrencyPill, Rect } from './UIComponents';
import { uiStateMachine, UIState } from '../UIStateMachine';

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
}

interface NavButton {
    id: 'back' | 'profile' | 'settings';
    rect: Rect;
    icon: string;
}

export class NavigationBar {
    private config: NavigationBarConfig;
    private buttons: NavButton[] = [];
    private hoveredButton: NavButton | null = null;
    private height = 104; // Match HUD header: 12px header padding + (8px player padding + 64px avatar + 8px player padding) + 12px header padding

    constructor(config: NavigationBarConfig) {
        this.config = {
            showBack: true,
            showProfile: true,
            showCurrencies: true,
            showSettings: true,
            ...config
        };
    }

    updateConfig(config: Partial<NavigationBarConfig>) {
        this.config = { ...this.config, ...config };
    }

    getHeight(): number {
        return this.height;
    }

    setupLayout(width: number) {
        this.buttons = [];
        const padding = 20;
        const buttonSize = 44;
        const gap = 12;

        let x = padding;

        // Back button (left)
        if (this.config.showBack) {
            this.buttons.push({
                id: 'back',
                rect: { x, y: (this.height - buttonSize) / 2, width: buttonSize, height: buttonSize },
                icon: '←'
            });
            x += buttonSize + gap;
        }

        // Calculate right side layout from right to left
        let rightX = width - padding;

        // Currencies take up space on the right
        if (this.config.showCurrencies) {
            const pillWidth = 100;
            const plusOffset = 5;
            const plusRadius = 12;
            const pillTotalWidth = pillWidth + plusOffset + plusRadius * 2; // 129px per pill
            const pillGap = 16; // Gap between pills
            const currenciesWidth = pillTotalWidth * 2 + pillGap; // 129 + 16 + 129 = 274px
            rightX -= currenciesWidth;
            rightX -= gap * 2; // Extra spacing before buttons
        }

        // Settings button
        if (this.config.showSettings) {
            rightX -= buttonSize;
            this.buttons.push({
                id: 'settings',
                rect: { x: rightX, y: (this.height - buttonSize) / 2, width: buttonSize, height: buttonSize },
                icon: '⚙'
            });
            rightX -= gap;
        }

        // Profile button
        if (this.config.showProfile) {
            rightX -= buttonSize;
            this.buttons.push({
                id: 'profile',
                rect: { x: rightX, y: (this.height - buttonSize) / 2, width: buttonSize, height: buttonSize },
                icon: '👤'
            });
        }
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

    handleClick(x: number, y: number): boolean {
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
                    (window as any).__settingsReturnState = uiStateMachine.state;
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

        // Title (centered)
        if (this.config.title) {
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
            this.renderButton(ctx, btn, btn === this.hoveredButton);
        }

        // Currencies (if enabled)
        if (this.config.showCurrencies) {
            this.renderCurrencies(ctx, width);
        }
    }

    private renderButton(ctx: CanvasRenderingContext2D, btn: NavButton, isHovered: boolean) {
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
        ctx.fillText(btn.icon, rect.x + rect.width / 2, rect.y + rect.height / 2);

        ctx.restore();
    }

    private renderCurrencies(ctx: CanvasRenderingContext2D, width: number) {
        const currencyY = (this.height - 28) / 2; // Center vertically, pill height is 28px
        const pillWidth = 100; // Base pill width
        const plusOffset = 5; // Gap between pill and plus button
        const plusRadius = 12; // Plus button radius
        const pillTotalWidth = pillWidth + plusOffset + plusRadius * 2; // 100 + 5 + 24 = 129px
        const gap = 16; // Gap between the two pills
        const padding = 20;

        // Position from right, accounting for full pill + plus button width
        const cashX = width - padding - pillTotalWidth;
        const coinsX = cashX - gap - pillTotalWidth;

        drawCurrencyPill(ctx, coinsX, currencyY, 2500, 'coins');
        drawCurrencyPill(ctx, cashX, currencyY, 85, 'cash');
    }

    private isInside(x: number, y: number, rect: Rect): boolean {
        return x >= rect.x && x <= rect.x + rect.width && y >= rect.y && y <= rect.y + rect.height;
    }
}
