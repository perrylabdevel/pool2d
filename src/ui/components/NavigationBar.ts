import { ColorTokens } from '../theme/ColorTokens';
import { LayoutConstants, getDeviceType } from '../theme/LayoutConstants';
import { drawCurrencyPill, Rect } from './UIComponents';
import { uiStateMachine, UIState } from '../UIStateMachine';
import { currencyStore } from '../CurrencyStore';
import { AssetRegistry } from '../../assets/AssetRegistry';
import { getTierFromLeagueId } from '../../game/leagues/LeagueIdentity';
import { AssetLoader } from '../../assets/AssetLoader';
import { db } from '../../data/db';

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
    balancesProvider?: () => { coins: number; gold: number; chips?: number; trophies?: number };
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
    private profileAvatarUrl: string | null = null;
    private profileFrameUrl: string | null = null;
    private profileLoadStarted = false;
    private deviceType: 'mobile' | 'tablet' | 'desktop' = 'desktop';

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
        this.ensureProfileVisualsLoaded();
    }

    updateConfig(config: Partial<NavigationBarConfig>) {
        this.config = { ...this.config, ...config };
    }

    private isLandscapeMode: boolean = false;

    getHeight(): number {
        // Return responsive height based on device type and orientation
        if (this.isLandscapeMode) {
            return 44; // Very compact in landscape
        }
        if (this.deviceType === 'mobile') {
            return 60;
        } else if (this.deviceType === 'tablet') {
            return 80;
        }
        return this.height;
    }

    setupLayout(width: number, height?: number) {
        this.buttons = [];
        this.deviceType = getDeviceType(width, height);

        // Detect landscape mode for phones
        this.isLandscapeMode = height !== undefined && height < 500 && width > height;

        const isMobile = this.deviceType === 'mobile';
        const isTablet = this.deviceType === 'tablet';
        const isLandscape = this.isLandscapeMode;

        const horizontalPadding = 0;
        const buttonHeight = this.getHeight();
        const backWidth = isLandscape ? 60 : (isMobile ? 80 : (isTablet ? 100 : 132));
        const settingsWidth = isLandscape ? 40 : (isMobile ? 44 : (isTablet ? 64 : Math.max(96, buttonHeight * 0.6)));
        const profileSize = isLandscape ? 44 : (isMobile ? 52 : (isTablet ? 72 : buttonHeight));

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
        if (y > this.getHeight()) {
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
        if (!this.hoveredButton || y > this.getHeight()) return false;

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
        const height = this.getHeight(); // Use responsive height, not fixed

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

        // Logo removed - takes up too much space on small devices

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

        // Divider on right side (between settings and profile)
        ctx.fillStyle = 'rgba(255, 255, 255, 0.15)';
        ctx.fillRect(x + width - 1, y + 12, 1, height - 24);
        ctx.restore();
    }

    private renderCurrencies(ctx: CanvasRenderingContext2D, width: number) {
        const navHeight = this.getHeight();
        const isMobile = this.deviceType === 'mobile';
        const isTablet = this.deviceType === 'tablet';
        const metrics = this.getCurrencyPillMetrics(navHeight);
        const currencyY = (navHeight - metrics.height) / 2;
        const pillGap = isMobile ? 4 : (isTablet ? 6 : 10);

        // Calculate position: pills should hug the left side of settings button
        // Find where settings button starts (from right edge)
        let settingsLeftEdge = width;

        if (this.config.showProfile) {
            const profileSize = isMobile ? 52 : (isTablet ? 72 : navHeight);
            settingsLeftEdge -= profileSize;
        }

        if (this.config.showSettings) {
            const settingsWidth = isMobile ? 44 : (isTablet ? 64 : Math.max(96, navHeight * 0.6));
            settingsLeftEdge -= settingsWidth;
        }

        const paddingFromSettings = isMobile ? 6 : 10;
        const leftPadding = isMobile ? 8 : 16; // Minimum padding from left edge

        // On mobile, show only 2 currencies (coins + trophies) to save space
        // On tablet/desktop, show all 3
        const showCash = !isMobile;

        const balances = this.config.balancesProvider ? this.config.balancesProvider() : { coins: 0, gold: 0, chips: 0, trophies: 0 };

        const baseOptions = {
            width: metrics.width,
            height: metrics.height,
            plusButton: false,
            theme: 'nav' as const,
        };

        if (showCash) {
            // Desktop/Tablet: Show all 3 currencies
            // Position pills from right to left
            const trophiesX = settingsLeftEdge - paddingFromSettings - metrics.totalWidth;
            const cashX = trophiesX - pillGap - metrics.totalWidth;
            const coinsX = cashX - pillGap - metrics.totalWidth;

            // Clamp to ensure coins doesn't go off left edge
            const clampedCoinsX = Math.max(leftPadding, coinsX);

            drawCurrencyPill(ctx, clampedCoinsX, currencyY, balances.coins, 'coins', {
                ...baseOptions,
                dividerLeft: false,
                dividerRight: true,
            });
            drawCurrencyPill(ctx, cashX, currencyY, balances.gold, 'cash', {
                ...baseOptions,
                dividerLeft: false,
                dividerRight: true,
            });
            drawCurrencyPill(ctx, trophiesX, currencyY, balances.trophies ?? 0, 'trophies', {
                ...baseOptions,
                dividerLeft: false,
                dividerRight: false,
            });
        } else {
            // Mobile: Show only coins and trophies
            const trophiesX = settingsLeftEdge - paddingFromSettings - metrics.totalWidth;
            const coinsX = trophiesX - pillGap - metrics.totalWidth;

            // Clamp to ensure coins doesn't go off left edge
            const clampedCoinsX = Math.max(leftPadding, coinsX);

            drawCurrencyPill(ctx, clampedCoinsX, currencyY, balances.coins, 'coins', {
                ...baseOptions,
                dividerLeft: false,
                dividerRight: true,
            });
            drawCurrencyPill(ctx, trophiesX, currencyY, balances.trophies ?? 0, 'trophies', {
                ...baseOptions,
                dividerLeft: false,
                dividerRight: false,
            });
        }

        // Draw divider between trophies and settings
        const dividerX = settingsLeftEdge;
        this.drawVerticalDivider(ctx, dividerX, navHeight);
    }

    private drawVerticalDivider(ctx: CanvasRenderingContext2D, x: number, height: number) {
        const padding = 12;
        ctx.save();
        ctx.fillStyle = 'rgba(255, 255, 255, 0.15)';
        ctx.fillRect(x, padding, 1, height - padding * 2);
        ctx.restore();
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
        this.ensureProfileVisualsLoaded();

        ctx.save();
        ctx.fillStyle = isHovered ? 'rgba(0, 0, 0, 0.5)' : 'rgba(0, 0, 0, 0.35)';
        ctx.fillRect(x, y, width, height);

        const avatarUrl = this.profileAvatarUrl || this.getAvatarUrl();
        const frameUrl = this.profileFrameUrl || this.getFrameForLeague();
        const avatarImg = AssetLoader.getCached(avatarUrl) || AssetLoader.loadImageSync(avatarUrl);
        const frameImg = AssetLoader.getCached(frameUrl) || AssetLoader.loadImageSync(frameUrl);

        // Frame dimensions (Square container, but frame image might not be square)
        // Use object-fit: contain logic
        let frameW = height * 0.95;
        let frameH = height * 0.95;
        let frameX = x + (width - frameW) / 2;
        let frameY = y + (height - frameH) / 2;

        if (frameImg && frameImg.complete && frameImg.naturalWidth > 0) {
            const frameAspect = frameImg.naturalWidth / frameImg.naturalHeight;
            // Fit within the square box (height * 0.95)
            const maxSize = height * 0.95;

            if (frameAspect > 1) {
                // Wider than tall
                frameW = maxSize;
                frameH = maxSize / frameAspect;
            } else {
                // Taller than wide
                frameH = maxSize;
                frameW = maxSize * frameAspect;
            }

            // Re-center based on new dimensions
            frameX = x + (width - frameW) / 2;
            frameY = y + (height - frameH) / 2;
        }

        // Avatar Photo positioning (relative to frame)
        // Calculated from chroma green area:
        // Top: 10%, Left: 10.7%, Width: 78.5%, Height: 74%
        const photoX = frameX + (frameW * 0.107);
        const photoY = frameY + (frameH * 0.100);
        const photoW = frameW * 0.785;
        const photoH = frameH * 0.740;

        // Border radius relative to size (squircle shape)
        const radius = frameW * 0.18;

        if (avatarImg && avatarImg.complete && avatarImg.naturalWidth > 0) {
            ctx.save();
            ctx.beginPath();
            // Rounded rect clip
            ctx.roundRect(photoX, photoY, photoW, photoH, radius);
            ctx.clip();

            // Simulate object-fit: cover
            const imgRatio = avatarImg.naturalWidth / avatarImg.naturalHeight;
            const targetRatio = photoW / photoH;

            let sx = 0;
            let sy = 0;
            let sw = avatarImg.naturalWidth;
            let sh = avatarImg.naturalHeight;

            if (imgRatio > targetRatio) {
                // Image is wider than target: crop width
                sw = sh * targetRatio;
                sx = (avatarImg.naturalWidth - sw) / 2;
            } else {
                // Image is taller than target: crop height
                sh = sw / targetRatio;
                sy = (avatarImg.naturalHeight - sh) / 2;
            }

            ctx.drawImage(avatarImg, sx, sy, sw, sh, photoX, photoY, photoW, photoH);
            ctx.restore();
        } else {
            // Fallback gradient block
            const gradient = ctx.createLinearGradient(photoX, photoY, photoX, photoY + photoH);
            gradient.addColorStop(0, 'rgba(255, 255, 255, 0.08)');
            gradient.addColorStop(1, 'rgba(255, 255, 255, 0.02)');
            ctx.fillStyle = gradient;
            ctx.beginPath();
            ctx.roundRect(photoX, photoY, photoW, photoH, radius);
            ctx.fill();
        }

        // Frame overlay
        if (frameImg && frameImg.complete && frameImg.naturalWidth > 0) {
            ctx.drawImage(frameImg, frameX, frameY, frameW, frameH);
        }

        ctx.restore();
    }

    private getCurrencyPillMetrics(navHeight: number) {
        // Scale pill size based on nav height
        const isMobile = navHeight <= 60;
        const isTablet = navHeight <= 80 && !isMobile;

        const height = isMobile ? 28 : (isTablet ? 36 : 42);
        const width = isMobile ? 72 : (isTablet ? 120 : 150);
        const plusButtonSpace = 0; // removed plus button
        return { height, width, totalWidth: width + plusButtonSpace };
    }

    private isInside(x: number, y: number, rect: Rect): boolean {
        return x >= rect.x && x <= rect.x + rect.width && y >= rect.y && y <= rect.y + rect.height;
    }

    private ensureProfileVisualsLoaded() {
        if (this.profileLoadStarted) return;
        this.profileLoadStarted = true;
        db.user.get(1).then((user) => {
            this.profileAvatarUrl = this.getAvatarUrl(user?.avatarId);
            this.profileFrameUrl = this.getFrameForLeague(user?.leagueId);
        }).catch(() => {
            this.profileAvatarUrl = this.getAvatarUrl();
            this.profileFrameUrl = this.getFrameForLeague();
        });
    }

    private getFrameForLeague(leagueId?: string): string {
        const tier = getTierFromLeagueId(leagueId);
        if (tier === 'diamond') return AssetRegistry.frames.diamond();
        if (tier === 'platinum') return AssetRegistry.frames.platinum();
        if (tier === 'gold') return AssetRegistry.frames.gold();
        if (tier === 'silver') return AssetRegistry.frames.silver();
        if (tier === 'grandmaster') return AssetRegistry.frames.grandmaster();
        if (tier === 'master') return AssetRegistry.frames.master();
        if (tier === 'elite') return AssetRegistry.frames.elite();
        if (tier === 'emerald') return AssetRegistry.frames.emerald();
        if (tier === 'crystal') return AssetRegistry.frames.crystal();
        return AssetRegistry.frames.bronze();
    }

    private getAvatarUrl(avatarId?: string): string {
        const normalized = this.normalizeAvatarKey(avatarId);
        const fn = (AssetRegistry.avatars as Record<string, () => string>)[normalized] || AssetRegistry.avatars.player;
        return fn();
    }

    private normalizeAvatarKey(avatarId?: string): string {
        if (!avatarId) return 'player';
        // Just strip the 'avatar_' prefix if present, keep snake_case format
        return avatarId.replace(/^avatar_/, '');
    }
}
