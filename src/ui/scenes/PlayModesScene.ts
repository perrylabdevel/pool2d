
import { UIScene, sceneController, TransitionType } from '../SceneController';
import { uiStateMachine, UIState } from '../UIStateMachine';
import {
    drawGlossyButton,
    drawPanel,
    drawCurrencyPill,
    drawRoundedRect,
    UIColors,
    Rect
} from '../components/UIComponents';
import { ColorTokens } from '../theme/ColorTokens';
import { GameMode } from '../../game/Game';
import { NavigationBar } from '../components/NavigationBar';
import { drawSceneBackground } from '../components/SceneBackground';
import { AssetRegistry } from '../../assets/AssetRegistry';
import { AssetLoader } from '../../assets/AssetLoader';

interface PlayModeButton {
    id: string;
    text: string;
    rect: Rect;
    color: string;
    action: () => void;
    icon?: string;
}

interface ModeCard {
    id: string;
    title: string;
    subtitle: string;
    desc: string;
    icon: string;
    price: string | number;
    color: string;
    image?: HTMLImageElement;
    rect?: Rect;
}

export class PlayModesScene implements UIScene {
    private buttons: PlayModeButton[] = [];
    private modeCards: ModeCard[] = [];
    private hoveredButton: PlayModeButton | null = null;
    private hoveredCard: ModeCard | null = null;
    private keyHandler: ((e: KeyboardEvent) => void) | null = null;
    private navigationBar: NavigationBar;
    private cardImages: Record<string, HTMLImageElement> = {};

    constructor() {
        this.navigationBar = new NavigationBar({
            title: 'GAME MODES',
            showBack: true,
            backState: UIState.LOBBY,
            showProfile: true,
            showCurrencies: true,
            showSettings: true
        });
    }

    mount(): void {
        console.log('PlayModesScene mounted');
        const canvas = document.getElementById('ui-stage') as HTMLCanvasElement;

        // Load card images using AssetLoader
        this.cardImages['practice'] = AssetLoader.loadImageSync(AssetRegistry.modeCards.practice());
        // Add more mode cards as they're created in the registry

        canvas.addEventListener('mousemove', this.onMouseMove);
        canvas.addEventListener('click', this.onClick);
        window.addEventListener('resize', this.onResize);

        this.keyHandler = (e: KeyboardEvent) => {
            if (e.key === 'Escape') {
                uiStateMachine.transitionTo(UIState.LOBBY);
            }
        };
        window.addEventListener('keydown', this.keyHandler);

        this.setupLayout(canvas.width, canvas.height);
    }

    unmount(): void {
        console.log('PlayModesScene unmounted');
        const canvas = document.getElementById('ui-stage') as HTMLCanvasElement;
        canvas.removeEventListener('mousemove', this.onMouseMove);
        canvas.removeEventListener('click', this.onClick);
        window.removeEventListener('resize', this.onResize);

        if (this.keyHandler) {
            window.removeEventListener('keydown', this.keyHandler);
            this.keyHandler = null;
        }

        this.cardImages = {};
    }

    private onResize = () => {
        const canvas = document.getElementById('ui-stage') as HTMLCanvasElement;
        this.setupLayout(canvas.width, canvas.height);
    }

    private setupLayout(width: number, height: number) {
        this.buttons = [];
        this.modeCards = [];

        // Setup navigation bar
        this.navigationBar.setupLayout(width);
        const navHeight = this.navigationBar.getHeight();

        // Cards Layout - responsive to available height
        const availableHeight = height - navHeight - 60; // 60px for top/bottom margins
        const cardHeight = Math.min(Math.floor(availableHeight * 0.85), 520); // 85% of available height, max 520px
        const cardWidth = Math.floor(cardHeight * 0.74); // Maintain aspect ratio (roughly 3:4)
        const gap = Math.max(24, Math.floor(width * 0.02)); // Responsive gap (2% of width, min 24px)

        // Define mode cards with billiard-themed colors
        const modes: ModeCard[] = [
            {
                id: 'practice',
                title: 'PRACTICE',
                subtitle: 'FREE PLAY',
                desc: 'Sharpen your skills without pressure',
                color: '#2a7a4e', // Pool table green
                icon: '🎯',
                price: 'Free',
                image: this.cardImages['practice']
            },
            {
                id: '8ball',
                title: '8 BALL',
                subtitle: 'CLASSIC',
                desc: 'Traditional 8-ball rules and gameplay',
                color: '#1a5490', // Classic blue
                icon: '🎱',
                price: 100
            },
            {
                id: 'time-attack',
                title: 'TIME ATTACK',
                subtitle: 'FAST PACED',
                desc: 'Clear the table before time runs out',
                color: '#d4651f', // Energetic orange
                icon: '⏱️',
                price: 'Free'
            },
        ];

        this.modeCards = modes;

        const totalWidth = modes.length * cardWidth + (modes.length - 1) * gap;
        const startX = (width - totalWidth) / 2;
        const startY = navHeight + (availableHeight - cardHeight) / 2 + 30;

        modes.forEach((mode, index) => {
            const x = startX + index * (cardWidth + gap);

            // Store card rect for hover detection
            mode.rect = { x, y: startY, width: cardWidth, height: cardHeight };

            // Create clickable button for entire card
            this.buttons.push({
                id: mode.id,
                text: mode.title,
                rect: { x, y: startY, width: cardWidth, height: cardHeight },
                color: mode.color,
                action: () => this.handleModeSelect(mode.id),
                icon: mode.icon
            });
        });
    }

    private handleModeSelect(id: string) {
        const game = (window as any).poolGame;
        if (!game) return;

        switch (id) {
            case 'practice':
                game.mode = GameMode.PRACTICE;
                break;
            case '8ball':
                game.mode = GameMode.EIGHT_BALL;
                break;
            case 'time-attack':
                game.mode = GameMode.TIME_ATTACK;
                break;
        }
        game.restart();
        uiStateMachine.transitionTo(UIState.IN_GAME);
    }

    private onMouseMove = (e: MouseEvent) => {
        const canvas = document.getElementById('ui-stage') as HTMLCanvasElement;
        const rect = canvas.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;

        // Check navigation bar first
        if (this.navigationBar.handleMouseMove(x, y)) {
            this.hoveredButton = null;
            this.hoveredCard = null;
            canvas.style.cursor = this.navigationBar.getCursor();
            return;
        }

        // Check card hover
        this.hoveredButton = null;
        this.hoveredCard = null;
        for (let i = 0; i < this.buttons.length; i++) {
            const btn = this.buttons[i];
            if (x >= btn.rect.x && x <= btn.rect.x + btn.rect.width &&
                y >= btn.rect.y && y <= btn.rect.y + btn.rect.height) {
                this.hoveredButton = btn;
                this.hoveredCard = this.modeCards[i];
                canvas.style.cursor = 'pointer';
                return;
            }
        }
        canvas.style.cursor = 'default';
    }

    private onClick = (e: MouseEvent) => {
        const canvas = document.getElementById('ui-stage') as HTMLCanvasElement;
        const rect = canvas.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;

        // Check navigation bar first
        if (this.navigationBar.handleClick(x, y)) {
            return;
        }

        if (this.hoveredButton) {
            this.hoveredButton.action();
        }
    }

    update(dt: number): void {
    }

    render(ctx: CanvasRenderingContext2D): void {
        const width = ctx.canvas.width;
        const height = ctx.canvas.height;

        // Background - use green theme for pool table feel
        drawSceneBackground(ctx, width, height, 'green');

        // Render Cards
        this.modeCards.forEach((card, index) => {
            const isHovered = card === this.hoveredCard;
            this.renderCard(ctx, card, isHovered);
        });

        // Render navigation bar on top
        this.navigationBar.render(ctx, width);
    }

    private renderCard(ctx: CanvasRenderingContext2D, card: ModeCard, isHovered: boolean): void {
        if (!card.rect) return;

        const { x, y, width, height } = card.rect;
        const radius = 16;
        const frameWidth = 6; // Outer decorative frame
        const bevelWidth = 3; // Middle bevel layer
        const borderWidth = 2; // Inner border

        ctx.save();

        // Enhanced drop shadow
        if (isHovered) {
            ctx.shadowColor = 'rgba(0, 0, 0, 0.6)';
            ctx.shadowBlur = 28;
            ctx.shadowOffsetY = 14;
        } else {
            ctx.shadowColor = 'rgba(0, 0, 0, 0.4)';
            ctx.shadowBlur = 20;
            ctx.shadowOffsetY = 10;
        }

        // Outer Frame - Metallic/Wood-grain effect
        drawRoundedRect(ctx, x, y, width, height, radius);
        const frameGradient = ctx.createLinearGradient(x, y, x, y + height);
        frameGradient.addColorStop(0, '#8B7355'); // Lighter wood/bronze
        frameGradient.addColorStop(0.5, '#6B5745'); // Mid wood/bronze
        frameGradient.addColorStop(1, '#4B3725'); // Darker wood/bronze
        ctx.fillStyle = frameGradient;
        ctx.fill();

        // Add metallic shine to frame
        const shineGradient = ctx.createLinearGradient(x, y, x + width / 3, y);
        shineGradient.addColorStop(0, 'rgba(255, 255, 255, 0.4)');
        shineGradient.addColorStop(0.5, 'rgba(255, 255, 255, 0.1)');
        shineGradient.addColorStop(1, 'rgba(255, 255, 255, 0)');
        ctx.fillStyle = shineGradient;
        ctx.fill();

        // Reset shadow for inner elements
        ctx.shadowColor = 'transparent';
        ctx.shadowBlur = 0;
        ctx.shadowOffsetY = 0;

        // Middle Bevel Layer - Creates depth with inverted gradient
        const bevelX = x + frameWidth;
        const bevelY = y + frameWidth;
        const bevelFullWidth = width - frameWidth * 2;
        const bevelFullHeight = height - frameWidth * 2;
        const bevelRadius = radius - frameWidth;

        drawRoundedRect(ctx, bevelX, bevelY, bevelFullWidth, bevelFullHeight, bevelRadius);
        const bevelGradient = ctx.createLinearGradient(bevelX, bevelY, bevelX, bevelY + bevelFullHeight);
        bevelGradient.addColorStop(0, '#3a3a3a'); // Dark top for inset look
        bevelGradient.addColorStop(0.5, '#2a2a2a'); // Mid
        bevelGradient.addColorStop(1, '#4a4a4a'); // Lighter bottom
        ctx.fillStyle = bevelGradient;
        ctx.fill();

        // Bevel highlight (top edge)
        drawRoundedRect(ctx, bevelX, bevelY, bevelFullWidth, bevelFullHeight, bevelRadius);
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.15)';
        ctx.lineWidth = 1;
        ctx.stroke();

        // Inner content area (inset from bevel)
        const innerX = bevelX + bevelWidth;
        const innerY = bevelY + bevelWidth;
        const innerWidth = bevelFullWidth - bevelWidth * 2;
        const innerHeight = bevelFullHeight - bevelWidth * 2;
        const innerRadius = bevelRadius - bevelWidth;

        // Clip to inner area for content
        ctx.save();
        drawRoundedRect(ctx, innerX, innerY, innerWidth, innerHeight, innerRadius);
        ctx.clip();

        // If card has image, draw it with cover behavior
        if (card.image && card.image.complete && card.image.naturalWidth > 0) {
            const imgAspect = card.image.naturalWidth / card.image.naturalHeight;
            const cardAspect = innerWidth / innerHeight;

            let drawWidth, drawHeight, offsetX, offsetY;

            if (imgAspect > cardAspect) {
                drawHeight = innerHeight;
                drawWidth = drawHeight * imgAspect;
                offsetX = innerX - (drawWidth - innerWidth) / 2;
                offsetY = innerY;
            } else {
                drawWidth = innerWidth;
                drawHeight = drawWidth / imgAspect;
                offsetX = innerX;
                offsetY = innerY - (drawHeight - innerHeight) / 2;
            }

            ctx.drawImage(card.image, offsetX, offsetY, drawWidth, drawHeight);
        } else {
            // Fallback gradient background
            const gradient = ctx.createLinearGradient(innerX, innerY, innerX, innerY + innerHeight);
            gradient.addColorStop(0, card.color);
            gradient.addColorStop(0.6, adjustBrightness(card.color, -30));
            gradient.addColorStop(1, adjustBrightness(card.color, -50));
            ctx.fillStyle = gradient;
            ctx.fillRect(innerX, innerY, innerWidth, innerHeight);

            // Add subtle felt-like texture overlay
            ctx.save();
            ctx.globalAlpha = 0.08;
            for (let i = 0; i < innerHeight; i += 6) {
                ctx.strokeStyle = i % 12 === 0 ? '#fff' : '#000';
                ctx.lineWidth = 1;
                ctx.beginPath();
                ctx.moveTo(innerX, innerY + i);
                ctx.lineTo(innerX + innerWidth, innerY + i);
                ctx.stroke();
            }
            ctx.restore();
        }

        // Dark gradient overlay for text readability
        const overlayGradient = ctx.createLinearGradient(innerX, innerY, innerX, innerY + innerHeight);
        overlayGradient.addColorStop(0, 'rgba(0, 0, 0, 0.1)');
        overlayGradient.addColorStop(0.4, 'rgba(0, 0, 0, 0.3)');
        overlayGradient.addColorStop(1, 'rgba(0, 0, 0, 0.85)');
        ctx.fillStyle = overlayGradient;
        ctx.fillRect(innerX, innerY, innerWidth, innerHeight);

        // Restore from clip for text/UI elements
        ctx.restore();

        // Price badge - Top right corner
        const pricePadding = 16;
        const priceHeight = Math.min(36, innerHeight * 0.11);

        if (card.price === 'Free') {
            // Free badge in top right
            const freeBadgeWidth = Math.min(80, innerWidth * 0.35);
            const freeBadgeX = innerX + innerWidth - freeBadgeWidth - pricePadding;
            const freeBadgeY = innerY + pricePadding;

            const freeGradient = ctx.createLinearGradient(freeBadgeX, freeBadgeY, freeBadgeX, freeBadgeY + priceHeight);
            freeGradient.addColorStop(0, ColorTokens.action.success);
            freeGradient.addColorStop(1, adjustBrightness(ColorTokens.action.success, -30));

            drawRoundedRect(ctx, freeBadgeX, freeBadgeY, freeBadgeWidth, priceHeight, priceHeight / 2);
            ctx.fillStyle = freeGradient;
            ctx.fill();

            // Badge glow
            ctx.shadowColor = ColorTokens.action.success;
            ctx.shadowBlur = 12;
            ctx.strokeStyle = ColorTokens.action.success;
            ctx.lineWidth = 2;
            ctx.stroke();
            ctx.shadowBlur = 0;
            ctx.shadowColor = 'transparent';

            const freeFontSize = Math.min(16, innerHeight * 0.05);
            ctx.font = `700 ${freeFontSize}px "Rajdhani", sans-serif`;
            ctx.fillStyle = '#FFFFFF';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.shadowColor = 'rgba(0, 0, 0, 0.8)';
            ctx.shadowBlur = 4;
            ctx.fillText('FREE', freeBadgeX + freeBadgeWidth / 2, freeBadgeY + priceHeight / 2);
            ctx.shadowBlur = 0;
            ctx.shadowColor = 'transparent';
        } else {
            // Coin price badge in top right
            const coinRadius = Math.min(12, innerHeight * 0.04);
            const priceFontSize = Math.min(16, innerHeight * 0.05);
            ctx.font = `700 ${priceFontSize}px "Rajdhani", sans-serif`;
            const priceText = card.price.toString();
            const priceTextWidth = ctx.measureText(priceText).width;
            const priceBadgeWidth = priceTextWidth + coinRadius * 3 + 16;
            const priceBadgeX = innerX + innerWidth - priceBadgeWidth - pricePadding;
            const priceBadgeY = innerY + pricePadding;

            // Badge background
            drawRoundedRect(ctx, priceBadgeX, priceBadgeY, priceBadgeWidth, priceHeight, priceHeight / 2);
            const badgeGrad = ctx.createLinearGradient(priceBadgeX, priceBadgeY, priceBadgeX, priceBadgeY + priceHeight);
            badgeGrad.addColorStop(0, 'rgba(255, 215, 0, 0.3)');
            badgeGrad.addColorStop(1, 'rgba(184, 134, 11, 0.5)');
            ctx.fillStyle = badgeGrad;
            ctx.fill();

            // Badge border
            ctx.strokeStyle = ColorTokens.currency.coins;
            ctx.lineWidth = 2;
            ctx.stroke();

            // Coin icon
            const coinX = priceBadgeX + coinRadius + 8;
            const coinY = priceBadgeY + priceHeight / 2;
            const coinGradient = ctx.createRadialGradient(coinX, coinY, 0, coinX, coinY, coinRadius);
            coinGradient.addColorStop(0, '#FFE66D');
            coinGradient.addColorStop(0.6, ColorTokens.currency.coins);
            coinGradient.addColorStop(1, '#B8860B');

            ctx.beginPath();
            ctx.arc(coinX, coinY, coinRadius, 0, Math.PI * 2);
            ctx.fillStyle = coinGradient;
            ctx.fill();

            // Coin border
            ctx.strokeStyle = 'rgba(255, 255, 255, 0.4)';
            ctx.lineWidth = 1.5;
            ctx.stroke();

            // Price text
            ctx.fillStyle = '#FFD700';
            ctx.textAlign = 'left';
            ctx.textBaseline = 'middle';
            ctx.shadowColor = 'rgba(0, 0, 0, 0.8)';
            ctx.shadowBlur = 4;
            ctx.fillText(priceText, coinX + coinRadius + 8, coinY);
            ctx.shadowBlur = 0;
            ctx.shadowColor = 'transparent';
        }

        // DRAMATIC TEXT LAYOUT - Bottom left like EventsScene
        const textPadding = 24;
        const textStartX = innerX + textPadding;
        const textStartY = innerY + innerHeight - 70;

        // Large title at bottom with dramatic styling
        const titleFontSize = Math.min(40, innerWidth * 0.18);
        ctx.font = `900 ${titleFontSize}px "Rajdhani", "Impact", sans-serif`;
        ctx.textAlign = 'left';
        ctx.textBaseline = 'bottom';

        // Title with strong shadow for readability
        ctx.shadowColor = 'rgba(0, 0, 0, 0.9)';
        ctx.shadowBlur = 12;
        ctx.shadowOffsetX = 2;
        ctx.shadowOffsetY = 2;
        ctx.fillStyle = '#FFFFFF';
        ctx.fillText(card.title, textStartX, textStartY);
        ctx.shadowBlur = 0;
        ctx.shadowOffsetX = 0;
        ctx.shadowOffsetY = 0;
        ctx.shadowColor = 'transparent';

        // Accent underline
        const titleWidth = ctx.measureText(card.title).width;
        const underlineY = textStartY - titleFontSize + 4;
        ctx.fillStyle = card.color;
        ctx.fillRect(textStartX, textStartY + 4, Math.min(titleWidth, innerWidth - textPadding * 2), 4);

        // Subtitle with color accent
        const subtitleFontSize = Math.min(16, innerWidth * 0.065);
        ctx.font = `700 ${subtitleFontSize}px "Rajdhani", sans-serif`;
        ctx.fillStyle = card.color;
        ctx.textAlign = 'left';
        ctx.textBaseline = 'bottom';
        ctx.shadowColor = 'rgba(0, 0, 0, 0.8)';
        ctx.shadowBlur = 6;
        ctx.fillText(card.subtitle, textStartX, textStartY + 26);
        ctx.shadowBlur = 0;
        ctx.shadowColor = 'transparent';

        // Description below subtitle
        const descFontSize = Math.min(12, innerWidth * 0.05);
        ctx.font = `600 ${descFontSize}px "Nunito", Arial`;
        ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
        ctx.shadowColor = 'rgba(0, 0, 0, 0.8)';
        ctx.shadowBlur = 4;
        ctx.fillText(card.desc, textStartX, textStartY + 42);
        ctx.shadowBlur = 0;
        ctx.shadowColor = 'transparent';

        // Inner border (decorative line inside the frame)
        drawRoundedRect(ctx, innerX, innerY, innerWidth, innerHeight, innerRadius);
        ctx.strokeStyle = 'rgba(0, 0, 0, 0.5)';
        ctx.lineWidth = borderWidth;
        ctx.stroke();

        // Inner highlight (creates depth)
        const innerHighlightInset = borderWidth / 2;
        drawRoundedRect(
            ctx,
            innerX + innerHighlightInset,
            innerY + innerHighlightInset,
            innerWidth - innerHighlightInset * 2,
            innerHeight - innerHighlightInset * 2,
            innerRadius - innerHighlightInset
        );
        const highlightGradient = ctx.createLinearGradient(
            innerX,
            innerY,
            innerX,
            innerY + innerHeight / 4
        );
        highlightGradient.addColorStop(0, 'rgba(255, 255, 255, 0.2)');
        highlightGradient.addColorStop(1, 'rgba(255, 255, 255, 0)');
        ctx.strokeStyle = highlightGradient;
        ctx.lineWidth = 1;
        ctx.stroke();

        // Corner decorations (small accent lines at corners)
        const cornerSize = Math.min(20, innerWidth * 0.08);
        const cornerInset = frameWidth + bevelWidth + 2;
        ctx.strokeStyle = 'rgba(255, 215, 0, 0.6)'; // Gold accents
        ctx.lineWidth = 2;

        // Top-left corner
        ctx.beginPath();
        ctx.moveTo(x + cornerInset + cornerSize, y + cornerInset);
        ctx.lineTo(x + cornerInset, y + cornerInset);
        ctx.lineTo(x + cornerInset, y + cornerInset + cornerSize);
        ctx.stroke();

        // Top-right corner
        ctx.beginPath();
        ctx.moveTo(x + width - cornerInset - cornerSize, y + cornerInset);
        ctx.lineTo(x + width - cornerInset, y + cornerInset);
        ctx.lineTo(x + width - cornerInset, y + cornerInset + cornerSize);
        ctx.stroke();

        // Bottom-left corner
        ctx.beginPath();
        ctx.moveTo(x + cornerInset, y + height - cornerInset - cornerSize);
        ctx.lineTo(x + cornerInset, y + height - cornerInset);
        ctx.lineTo(x + cornerInset + cornerSize, y + height - cornerInset);
        ctx.stroke();

        // Bottom-right corner
        ctx.beginPath();
        ctx.moveTo(x + width - cornerInset, y + height - cornerInset - cornerSize);
        ctx.lineTo(x + width - cornerInset, y + height - cornerInset);
        ctx.lineTo(x + width - cornerInset - cornerSize, y + height - cornerInset);
        ctx.stroke();

        // Hover glow effect (outer glow)
        if (isHovered) {
            drawRoundedRect(ctx, x - 2, y - 2, width + 4, height + 4, radius + 2);
            ctx.strokeStyle = '#00B4FF';
            ctx.lineWidth = 4;
            ctx.shadowColor = 'rgba(0, 180, 255, 0.6)';
            ctx.shadowBlur = 20;
            ctx.stroke();
            ctx.shadowBlur = 0;
            ctx.shadowColor = 'transparent';
        }

        ctx.restore();
    }
}

// Helper function to adjust color brightness
function adjustBrightness(color: string, amount: number): string {
    // Convert hex to RGB
    const hex = color.replace('#', '');
    const r = Math.max(0, Math.min(255, parseInt(hex.substring(0, 2), 16) + amount));
    const g = Math.max(0, Math.min(255, parseInt(hex.substring(2, 4), 16) + amount));
    const b = Math.max(0, Math.min(255, parseInt(hex.substring(4, 6), 16) + amount));

    return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
}
