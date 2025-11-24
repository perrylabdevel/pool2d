import { UIScene } from '../SceneController';
import { uiStateMachine, UIState } from '../UIStateMachine';
import { drawSceneBackground } from '../components/SceneBackground';
import { NavigationBar } from '../components/NavigationBar';
import { LayoutConstants } from '../theme/LayoutConstants';
import { ColorTokens } from '../theme/ColorTokens';
import { drawRoundedRect, Rect } from '../components/UIComponents';
import { currencyStore } from '../CurrencyStore';
import { AssetRegistry } from '../../assets/AssetRegistry';
import { AssetLoader } from '../../assets/AssetLoader';

interface EventCard {
    id: string;
    title: string;
    subtitle: string;
    icon: string;
    color: string;
    state?: UIState;
    comingSoon?: boolean;
    action?: () => void;
}

export class EventsScene implements UIScene {
    private canvas: HTMLCanvasElement | null = null;
    private navigationBar: NavigationBar;
    private cardImages: Record<string, HTMLImageElement> = {};
    private cards: EventCard[] = [
        {
            id: 'golden-spin',
            title: 'Golden Spin',
            subtitle: 'Win up to 1M!',
            icon: '🎰',
            color: ColorTokens.brand.primary,
            state: UIState.EVENT_GOLDEN_SPIN
        },
        {
            id: 'bullseye',
            title: 'Bullseye',
            subtitle: 'Hit the target',
            icon: '🎯',
            color: ColorTokens.action.danger,
            comingSoon: true
        },
        {
            id: 'win-streak',
            title: 'Win Streak',
            subtitle: 'Keep winning!',
            icon: '🔥',
            color: ColorTokens.action.warning,
            comingSoon: true
        }
    ];
    private cardRects: Map<string, Rect> = new Map();
    private hoveredCardId: string | null = null;
    private keyHandler: ((e: KeyboardEvent) => void) | null = null;

    constructor() {
        this.navigationBar = new NavigationBar({
            title: 'EVENTS',
            showBack: true,
            onBack: () => uiStateMachine.transitionTo(UIState.LOBBY),
            balancesProvider: () => currencyStore.getBalances()
        });
    }

    mount(): void {
        this.canvas = document.getElementById('ui-stage') as HTMLCanvasElement;
        if (!this.canvas) return;

        // Load event card images using AssetLoader
        this.cardImages['golden-spin'] = AssetLoader.loadImageSync(AssetRegistry.eventCards.goldenSpin());
        // Load additional event card images as they're added to the registry:
        // this.cardImages['bullseye'] = AssetLoader.loadImageSync(AssetRegistry.eventCards.bullseye());
        // this.cardImages['win-streak'] = AssetLoader.loadImageSync(AssetRegistry.eventCards.winStreak());

        this.setupLayout(this.canvas.width, this.canvas.height);
        this.canvas.addEventListener('mousemove', this.onMouseMove);
        this.canvas.addEventListener('click', this.onClick);
        window.addEventListener('resize', this.onResize);

        this.keyHandler = (e: KeyboardEvent) => {
            if (e.key === 'Escape') {
                uiStateMachine.transitionTo(UIState.LOBBY);
            }
        };
        window.addEventListener('keydown', this.keyHandler);
    }

    unmount(): void {
        if (!this.canvas) return;
        this.canvas.removeEventListener('mousemove', this.onMouseMove);
        this.canvas.removeEventListener('click', this.onClick);
        window.removeEventListener('resize', this.onResize);
        this.canvas.style.cursor = 'default';

        if (this.keyHandler) {
            window.removeEventListener('keydown', this.keyHandler);
            this.keyHandler = null;
        }

        this.cardImages = {};
    }

    private onResize = () => {
        if (!this.canvas) return;
        this.setupLayout(this.canvas.width, this.canvas.height);
    };

    private setupLayout(width: number, height: number) {
        this.navigationBar.setupLayout(width);
        const navHeight = this.navigationBar.getHeight();

        const padding = width * LayoutConstants.Spacing.PaddingScreen;
        const contentWidth = width - padding * 2;
        const gap = LayoutConstants.Spacing.GapLarge;

        // Responsive column count
        const columns = width < 720 ? 1 : width < 1080 ? 2 : 3;
        const rows = Math.ceil(this.cards.length / columns);

        // Cards responsive to available height
        const availableHeight = height - navHeight - padding * 2;
        const totalGapHeight = gap * (rows - 1);
        const availableCardHeight = (availableHeight - totalGapHeight) / rows;
        const cardHeight = Math.min(Math.floor(availableCardHeight * 0.95), 480); // 95% of available per row, max 480px
        const cardWidth = (contentWidth - gap * (columns - 1)) / columns;
        const startY = navHeight + padding;

        this.cardRects.clear();
        this.cards.forEach((card, index) => {
            const col = index % columns;
            const row = Math.floor(index / columns);
            const x = padding + (cardWidth + gap) * col;
            const y = startY + (cardHeight + gap) * row;

            this.cardRects.set(card.id, {
                x,
                y,
                width: cardWidth,
                height: cardHeight
            });
        });
    }

    private onMouseMove = (e: MouseEvent) => {
        if (!this.canvas) return;
        const rect = this.canvas.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;

        if (this.navigationBar.handleMouseMove(x, y)) {
            this.hoveredCardId = null;
            this.canvas.style.cursor = this.navigationBar.getCursor();
            return;
        }

        this.hoveredCardId = null;
        for (const [id, r] of this.cardRects) {
            const card = this.cards.find(c => c.id === id);
            const isLocked = card?.comingSoon;
            if (x >= r.x && x <= r.x + r.width && y >= r.y && y <= r.y + r.height && !isLocked) {
                this.hoveredCardId = id;
                break;
            }
        }
        this.canvas.style.cursor = this.hoveredCardId ? 'pointer' : 'default';
    };

    private onClick = (e: MouseEvent) => {
        if (!this.canvas) return;
        const rect = this.canvas.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;

        if (this.navigationBar.handleClick(x, y)) return;

        if (this.hoveredCardId) {
            const card = this.cards.find(c => c.id === this.hoveredCardId);
            if (card) {
                if (card.state) {
                    uiStateMachine.transitionTo(card.state);
                } else if (card.action) {
                    card.action();
                }
            }
        }
    };

    update(_dt: number): void { }

    render(ctx: CanvasRenderingContext2D): void {
        const width = ctx.canvas.width;
        const height = ctx.canvas.height;

        drawSceneBackground(ctx, width, height, 'purple'); // Different bg for events
        this.navigationBar.render(ctx, width);

        this.cards.forEach(card => {
            const rect = this.cardRects.get(card.id);
            if (rect) {
                this.renderCard(ctx, card, rect, this.hoveredCardId === card.id);
            }
        });
    }

    private renderCard(ctx: CanvasRenderingContext2D, card: EventCard, rect: Rect, isHovered: boolean) {
        const isDisabled = !!card.comingSoon;
        const { x, y, width, height } = rect;
        const radius = LayoutConstants.Radii.Large;
        const frameWidth = 6; // Outer decorative frame
        const bevelWidth = 3; // Middle bevel layer
        const borderWidth = 2; // Inner border

        ctx.save();

        // Enhanced drop shadow
        if (isHovered && !isDisabled) {
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

        // Background - use image if available, otherwise fallback to solid color
        const cardImg = this.cardImages[card.id];
        if (cardImg && cardImg.complete && cardImg.naturalWidth > 0) {
            // Draw card image with cover behavior
            const imgAspect = cardImg.naturalWidth / cardImg.naturalHeight;
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

            // Clip to inner area
            ctx.save();
            drawRoundedRect(ctx, innerX, innerY, innerWidth, innerHeight, innerRadius);
            ctx.clip();
            ctx.drawImage(cardImg, offsetX, offsetY, drawWidth, drawHeight);

            // Add gradient overlay for text readability
            const overlayGradient = ctx.createLinearGradient(innerX, innerY, innerX, innerY + innerHeight);
            overlayGradient.addColorStop(0, 'rgba(0, 0, 0, 0.1)');
            overlayGradient.addColorStop(0.5, 'rgba(0, 0, 0, 0.3)');
            overlayGradient.addColorStop(1, 'rgba(0, 0, 0, 0.85)');
            ctx.fillStyle = overlayGradient;
            ctx.fillRect(innerX, innerY, innerWidth, innerHeight);
            ctx.restore();
        } else {
            // Fallback to solid color panel
            drawRoundedRect(ctx, innerX, innerY, innerWidth, innerHeight, innerRadius);
            ctx.fillStyle = ColorTokens.background.panel;
            ctx.fill();
        }

        // Creative text layout - bottom-left aligned for dramatic effect
        const textPadding = 24;
        const textStartX = innerX + textPadding;

        // Large title at bottom with dramatic styling
        const titleFontSize = Math.min(48, innerWidth * 0.18);
        ctx.font = `900 ${titleFontSize}px "Rajdhani", "Impact", sans-serif`;
        ctx.textAlign = 'left';
        ctx.textBaseline = 'bottom';

        // Title with strong shadow for readability
        ctx.shadowColor = 'rgba(0, 0, 0, 0.9)';
        ctx.shadowBlur = 12;
        ctx.shadowOffsetX = 2;
        ctx.shadowOffsetY = 2;
        ctx.fillStyle = '#FFFFFF';
        ctx.fillText(card.title.toUpperCase(), textStartX, innerY + innerHeight - 70);
        ctx.shadowBlur = 0;
        ctx.shadowOffsetX = 0;
        ctx.shadowOffsetY = 0;
        ctx.shadowColor = 'transparent';

        // Accent underline
        const titleWidth = ctx.measureText(card.title.toUpperCase()).width;
        const underlineY = innerY + innerHeight - 66;
        ctx.fillStyle = card.color;
        ctx.fillRect(textStartX, underlineY, Math.min(titleWidth, innerWidth - textPadding * 2), 4);

        // Subtitle with color accent
        const subtitleFontSize = Math.min(18, innerWidth * 0.065);
        ctx.font = `700 ${subtitleFontSize}px "Rajdhani", sans-serif`;
        ctx.fillStyle = card.color;
        ctx.textAlign = 'left';
        ctx.textBaseline = 'bottom';
        ctx.shadowColor = 'rgba(0, 0, 0, 0.8)';
        ctx.shadowBlur = 6;
        ctx.fillText(card.subtitle.toUpperCase(), textStartX, innerY + innerHeight - 42);
        ctx.shadowBlur = 0;
        ctx.shadowColor = 'transparent';

        // Action button - positioned at top right
        const btnWidth = 120;
        const btnHeight = 40;
        const btnX = innerX + innerWidth - btnWidth - textPadding;
        const btnY = innerY + textPadding;

        drawRoundedRect(ctx, btnX, btnY, btnWidth, btnHeight, LayoutConstants.Radii.Medium);

        if (isDisabled) {
            ctx.fillStyle = 'rgba(255,255,255,0.08)';
        } else if (isHovered) {
            const btnGradient = ctx.createLinearGradient(btnX, btnY, btnX, btnY + btnHeight);
            btnGradient.addColorStop(0, card.color);
            btnGradient.addColorStop(1, adjustBrightness(card.color, -30));
            ctx.fillStyle = btnGradient;
        } else {
            ctx.fillStyle = 'rgba(255,255,255,0.15)';
        }
        ctx.fill();

        // Button border
        ctx.strokeStyle = isHovered && !isDisabled ? card.color : 'rgba(255,255,255,0.3)';
        ctx.lineWidth = 2;
        ctx.stroke();

        // Button text
        ctx.fillStyle = isDisabled ? 'rgba(255,255,255,0.5)' : isHovered ? '#FFF' : '#FFF';
        ctx.font = `bold ${LayoutConstants.Fonts.Size.Small}px ${LayoutConstants.Fonts.Family.Default}`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.shadowColor = 'rgba(0, 0, 0, 0.5)';
        ctx.shadowBlur = 4;
        ctx.fillText(isDisabled ? 'LOCKED' : 'PLAY', btnX + btnWidth / 2, btnY + btnHeight / 2);
        ctx.shadowBlur = 0;
        ctx.shadowColor = 'transparent';

        if (card.comingSoon) {
            const pillWidth = 130;
            const pillHeight = 32;
            const pillX = innerX + textPadding;
            const pillY = innerY + textPadding;

            drawRoundedRect(ctx, pillX, pillY, pillWidth, pillHeight, LayoutConstants.Radii.Small);

            // Badge gradient background
            const badgeGradient = ctx.createLinearGradient(pillX, pillY, pillX, pillY + pillHeight);
            badgeGradient.addColorStop(0, 'rgba(0, 0, 0, 0.7)');
            badgeGradient.addColorStop(1, 'rgba(0, 0, 0, 0.85)');
            ctx.fillStyle = badgeGradient;
            ctx.fill();

            // Badge border
            ctx.strokeStyle = card.color;
            ctx.lineWidth = 2;
            ctx.stroke();

            // Badge text
            ctx.fillStyle = card.color;
            ctx.font = `bold ${LayoutConstants.Fonts.Size.Small}px ${LayoutConstants.Fonts.Family.Default}`;
            ctx.textAlign = 'center';
            ctx.fillText('COMING SOON', pillX + pillWidth / 2, pillY + pillHeight / 2 + 1);
        }

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
        const cornerSize = Math.min(20, innerWidth * 0.05);
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
        if (isHovered && !isDisabled) {
            drawRoundedRect(ctx, x - 2, y - 2, width + 4, height + 4, radius + 2);
            ctx.strokeStyle = card.color;
            ctx.lineWidth = 4;
            ctx.shadowColor = `${card.color}99`; // Add alpha to card color
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
