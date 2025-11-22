import { UIScene } from '../SceneController';
import { uiStateMachine, UIState } from '../UIStateMachine';
import { drawSceneBackground } from '../components/SceneBackground';
import { NavigationBar } from '../components/NavigationBar';
import { LayoutConstants } from '../theme/LayoutConstants';
import { ColorTokens } from '../theme/ColorTokens';
import { drawRoundedRect, Rect } from '../components/UIComponents';

interface EventCard {
    id: string;
    title: string;
    subtitle: string;
    icon: string;
    color: string;
    action: () => void;
}

export class EventsScene implements UIScene {
    private canvas: HTMLCanvasElement | null = null;
    private navigationBar: NavigationBar;
    private cards: EventCard[] = [
        {
            id: 'golden-spin',
            title: 'Golden Spin',
            subtitle: 'Win up to 1M!',
            icon: '🎰',
            color: ColorTokens.brand.primary,
            action: () => console.log('Golden Spin clicked')
        },
        {
            id: 'bullseye',
            title: 'Bullseye',
            subtitle: 'Hit the target',
            icon: '🎯',
            color: ColorTokens.action.danger,
            action: () => console.log('Bullseye clicked')
        },
        {
            id: 'win-streak',
            title: 'Win Streak',
            subtitle: 'Keep winning!',
            icon: '🔥',
            color: ColorTokens.action.warning,
            action: () => console.log('Win Streak clicked')
        }
    ];
    private cardRects: Map<string, Rect> = new Map();
    private hoveredCardId: string | null = null;

    constructor() {
        this.navigationBar = new NavigationBar({
            title: 'EVENTS',
            showBack: true,
            onBack: () => uiStateMachine.transitionTo(UIState.LOBBY)
        });
    }

    mount(): void {
        this.canvas = document.getElementById('ui-stage') as HTMLCanvasElement;
        if (!this.canvas) return;

        this.setupLayout(this.canvas.width, this.canvas.height);
        this.canvas.addEventListener('mousemove', this.onMouseMove);
        this.canvas.addEventListener('click', this.onClick);
        window.addEventListener('resize', this.onResize);
    }

    unmount(): void {
        if (!this.canvas) return;
        this.canvas.removeEventListener('mousemove', this.onMouseMove);
        this.canvas.removeEventListener('click', this.onClick);
        window.removeEventListener('resize', this.onResize);
        this.canvas.style.cursor = 'default';
    }

    private onResize = () => {
        if (!this.canvas) return;
        this.setupLayout(this.canvas.width, this.canvas.height);
    };

    private setupLayout(width: number, _height: number) {
        this.navigationBar.setupLayout(width);
        const navHeight = this.navigationBar.getHeight();

        const padding = width * LayoutConstants.Spacing.PaddingScreen;
        const contentWidth = width - padding * 2;
        const gap = LayoutConstants.Spacing.GapLarge;

        // 3 cards side by side
        const cardWidth = (contentWidth - gap * 2) / 3;
        const cardHeight = 400; // Portrait aspect ratio
        const startY = navHeight + 40;
        const startX = padding;

        this.cardRects.clear();
        this.cards.forEach((card, index) => {
            this.cardRects.set(card.id, {
                x: startX + (cardWidth + gap) * index,
                y: startY,
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
            if (x >= r.x && x <= r.x + r.width && y >= r.y && y <= r.y + r.height) {
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
            if (card) card.action();
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
        ctx.save();

        // Shadow
        ctx.shadowColor = 'rgba(0,0,0,0.5)';
        ctx.shadowBlur = isHovered ? 20 : 10;
        ctx.shadowOffsetY = isHovered ? 10 : 5;

        // Background
        drawRoundedRect(ctx, rect.x, rect.y, rect.width, rect.height, LayoutConstants.Radii.Large);
        ctx.fillStyle = ColorTokens.background.panel;
        ctx.fill();

        // Reset shadow
        ctx.shadowColor = 'transparent';

        // Border/Rim
        ctx.strokeStyle = isHovered ? card.color : ColorTokens.border.default;
        ctx.lineWidth = isHovered ? 3 : 1;
        ctx.stroke();

        // Content
        const centerX = rect.x + rect.width / 2;

        // Icon
        ctx.font = '64px Arial';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(card.icon, centerX, rect.y + 100);

        // Title
        ctx.fillStyle = card.color;
        ctx.font = `bold ${LayoutConstants.Fonts.Size.XLarge}px ${LayoutConstants.Fonts.Family.Heading}`;
        ctx.fillText(card.title.toUpperCase(), centerX, rect.y + 200);

        // Subtitle
        ctx.fillStyle = ColorTokens.text.secondary;
        ctx.font = `${LayoutConstants.Fonts.Size.Medium}px ${LayoutConstants.Fonts.Family.Body}`;
        ctx.fillText(card.subtitle, centerX, rect.y + 240);

        // "Play" Button (Fake)
        const btnWidth = 120;
        const btnHeight = 40;
        const btnX = centerX - btnWidth / 2;
        const btnY = rect.y + rect.height - 80;

        drawRoundedRect(ctx, btnX, btnY, btnWidth, btnHeight, LayoutConstants.Radii.Medium);
        ctx.fillStyle = isHovered ? card.color : 'rgba(255,255,255,0.1)';
        ctx.fill();

        ctx.fillStyle = isHovered ? '#000' : '#FFF';
        ctx.font = `bold ${LayoutConstants.Fonts.Size.Small}px ${LayoutConstants.Fonts.Family.Default}`;
        ctx.fillText('PLAY', centerX, btnY + btnHeight / 2);

        ctx.restore();
    }
}
