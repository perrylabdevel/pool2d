import { UIScene, sceneController } from '../SceneController';
import { uiStateMachine, UIState } from '../UIStateMachine';
import {
    Rect,
    drawRoundedRect
} from '../components/UIComponents';
import { ColorTokens, SemanticColors } from '../theme/ColorTokens';
import { NavigationBar } from '../components/NavigationBar';
import { Game, GameMode } from '../../game/Game';
import { GameState } from '../../game/GameStateMachine';
import { ConfirmScene } from './ConfirmScene';
import { drawSceneBackground } from '../components/SceneBackground';

type ButtonVariant = 'nav';

interface LobbyButton {
    id: string;
    text: string;
    subtitle?: string;
    icon?: string;
    rect: Rect;
    color: string;
    action: () => void;
    variant: ButtonVariant;
}

export class LobbyScene implements UIScene {
    private canvas: HTMLCanvasElement | null = null;
    private buttons: LobbyButton[] = [];
    private hoveredButton: LobbyButton | null = null;
    private keyHandler: ((e: KeyboardEvent) => void) | null = null;
    private cameFromGame: boolean = false;
    private navigationBar: NavigationBar;

    private cardImages: Record<string, HTMLImageElement> = {};

    constructor() {
        this.navigationBar = new NavigationBar({
            title: 'POOL 2D',
            showBack: false, // Lobby is the home, no back button
            showProfile: true,
            showCurrencies: true,
            showSettings: true
        });
    }
    private cardImageUrls: Record<string, string> = {
        play: new URL('../../assets/img/lobby-cards/play-ranked.png', import.meta.url).href,
        practice: new URL('../../assets/img/lobby-cards/practice.png', import.meta.url).href,
        arcade: new URL('../../assets/img/lobby-cards/arcade.png', import.meta.url).href,
        shop: new URL('../../assets/img/lobby-cards/shop.png', import.meta.url).href,
        events: new URL('../../assets/img/lobby-cards/events.png', import.meta.url).href,
        mini: new URL('../../assets/img/lobby-cards/mini-games.png', import.meta.url).href
    };

    mount(): void {
        this.canvas = document.getElementById('ui-stage') as HTMLCanvasElement;
        if (!this.canvas) return;

        // Load all card images
        for (const [id, url] of Object.entries(this.cardImageUrls)) {
            const img = new Image();
            img.src = url;
            this.cardImages[id] = img;
        }

        this.setupLayout(this.canvas.width, this.canvas.height);
        this.canvas.addEventListener('mousemove', this.onMouseMove);
        this.canvas.addEventListener('click', this.onClick);
        window.addEventListener('resize', this.onResize);

        // ESC key to return to game
        this.keyHandler = (e: KeyboardEvent) => {
            if (e.key === 'Escape') {
                uiStateMachine.transitionTo(UIState.IN_GAME);
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
        this.buttons = [];

        // Setup navigation bar
        this.navigationBar.setupLayout(width);
        const navHeight = this.navigationBar.getHeight();

        // Miniclip-style grid layout with weighted columns for landscape/portrait cards
        const padding = 24;
        const gap = 16;
        const topSpacing = navHeight + 20; // Space for navigation bar + margin
        const contentWidth = Math.min(1000, width - padding * 2);
        const startX = (width - contentWidth) / 2;

        // Use weighted column widths
        // Landscape cards (365x200) need more width than portrait cards (365x400)
        // Weights: landscape=2.5, portrait=1.5 (approximating their aspect ratios)
        const landscapeWeight = 2.5;
        const portraitWeight = 1.5;
        const totalWeight = landscapeWeight * 2 + portraitWeight; // 2 landscape cols + 1 portrait col
        const totalGapWidth = gap * 2; // 2 gaps between 3 columns
        const availableWidth = contentWidth - totalGapWidth;

        const landscapeWidth = (availableWidth * landscapeWeight) / totalWeight;
        const portraitWidth = (availableWidth * portraitWeight) / totalWeight;

        // Column positions
        const col0X = startX;
        const col1X = col0X + landscapeWidth + gap;
        const col2X = col1X + landscapeWidth + gap;

        // Define cards with grid positions (Miniclip style - different sizes)
        const cards = [
            // Row 1: Large featured "Play" card (2x2) + Practice (1x1)
            {
                id: 'play', text: '1 vs 1', subtitle: 'Play Ranked', icon: '🎱', col: 0, row: 0, cols: 2, rows: 2, color: SemanticColors.lobby.cardPlayRanked,
                action: () => {
                    const game = (window as any).poolGame;
                    if (game) { game.mode = GameMode.EIGHT_BALL; game.restart(); }
                    uiStateMachine.transitionTo(UIState.IN_GAME);
                }
            },
            {
                id: 'practice', text: 'Practice', subtitle: 'Solo', icon: '🎯', col: 2, row: 0, cols: 1, rows: 1, color: SemanticColors.lobby.cardPractice,
                action: () => {
                    const game = (window as any).poolGame;
                    if (game) { game.mode = GameMode.PRACTICE; game.restart(); }
                    uiStateMachine.transitionTo(UIState.IN_GAME);
                }
            },
            // Row 2: Arcade (continues from Play's 2nd row)
            {
                id: 'arcade', text: 'Arcade', subtitle: 'Game Modes', icon: '⚡', col: 2, row: 1, cols: 1, rows: 1, color: SemanticColors.lobby.cardArcade,
                action: () => uiStateMachine.transitionTo(UIState.PLAY_MODES)
            },
            // Row 3: Shop + Profile + Mini
            {
                id: 'shop', text: 'Shop', subtitle: 'Cues & Items', icon: '🎨', col: 0, row: 2, cols: 1, rows: 1, color: SemanticColors.lobby.cardShop,
                action: () => uiStateMachine.transitionTo(UIState.SHOP)
            },
            {
                id: 'events', text: 'Events', subtitle: 'Win Big!', icon: '🏆', col: 1, row: 2, cols: 1, rows: 1, color: SemanticColors.lobby.cardEvents,
                action: () => uiStateMachine.transitionTo(UIState.EVENTS)
            },
            {
                id: 'mini', text: 'Mini Games', subtitle: 'Coming Soon', icon: '🎮', col: 2, row: 2, cols: 1, rows: 1, color: SemanticColors.lobby.cardMiniGames,
                action: () => { }
            }
        ];

        // Calculate available height for cards
        const availableHeight = height - topSpacing - padding * 2;

        // Determine row heights - use simpler fixed approach to ensure everything fits
        const rowCount = 3; // We have 3 rows total
        const totalGaps = gap * (rowCount - 1);
        const availableCardHeight = availableHeight - totalGaps;

        // Allocate row heights: row 0 & 1 share the "play" card space (2/3), row 2 gets 1/3
        const playCardHeight = (availableCardHeight * 2) / 3;
        const bottomRowHeight = (availableCardHeight * 1) / 3;

        const rowHeights = [
            playCardHeight / 2 - gap / 2,  // Row 0
            playCardHeight / 2 - gap / 2,  // Row 1
            bottomRowHeight                 // Row 2
        ];

        // Precompute row offsets
        const rowOffsets: number[] = [];
        let accumY = topSpacing;
        rowHeights.forEach((h, idx) => {
            rowOffsets[idx] = accumY;
            accumY += h + gap;
        });

        // Create buttons from cards using computed sizes
        cards.forEach(card => {
            // Determine X position based on column
            let x: number;
            if (card.col === 0) x = col0X;
            else if (card.col === 1) x = col1X;
            else x = col2X;

            const y = rowOffsets[card.row];

            // Determine width based on columns spanned
            let w: number;
            if (card.cols === 2) {
                // Spanning 2 landscape columns
                w = landscapeWidth * 2 + gap;
            } else if (card.col === 2) {
                // Portrait column
                w = portraitWidth;
            } else {
                // Single landscape column
                w = landscapeWidth;
            }

            // Calculate height
            let h = gap * (card.rows - 1);
            for (let i = card.row; i < card.row + card.rows; i++) {
                h += rowHeights[i];
            }

            this.buttons.push({
                id: card.id,
                text: card.text,
                subtitle: card.subtitle,
                icon: card.icon,
                rect: { x, y, width: w, height: h },
                color: card.color,
                action: card.action,
                variant: 'nav'
            });
        });
    }

    private onMouseMove = (e: MouseEvent) => {
        if (!this.canvas) return;
        const rect = this.canvas.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;

        // Check navigation bar first
        if (this.navigationBar.handleMouseMove(x, y)) {
            this.hoveredButton = null;
            this.canvas.style.cursor = this.navigationBar.getCursor();
            return;
        }

        this.hoveredButton = null;
        for (const btn of this.buttons) {
            if (x >= btn.rect.x && x <= btn.rect.x + btn.rect.width &&
                y >= btn.rect.y && y <= btn.rect.y + btn.rect.height) {
                this.hoveredButton = btn;
                break;
            }
        }
        this.canvas.style.cursor = this.hoveredButton ? 'pointer' : 'default';
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

        if (this.hoveredButton) {
            // Check if this is a play button and if there's a game in progress
            const isPlayButton = ['play', 'practice'].includes(this.hoveredButton.id);

            if (isPlayButton && this.isGameInProgress()) {
                // Configure and show ConfirmScene
                const confirmScene = sceneController.getScene(UIState.CONFIRM) as ConfirmScene;
                if (confirmScene) {
                    const action = this.hoveredButton.action;
                    confirmScene.configure({
                        title: 'Start New Game?',
                        message: 'Current progress will be lost',
                        confirmLabel: 'Start New Game',
                        cancelLabel: 'Cancel',
                        returnState: UIState.LOBBY,
                        onConfirm: () => {
                            this.cameFromGame = false;
                            action();
                        }
                    });
                    uiStateMachine.transitionTo(UIState.CONFIRM);
                }
                return;
            }
            this.hoveredButton.action();
        }
    };

    public setCameFromGame(fromGame: boolean) {
        // Persist knowledge that we have an active game session behind menus
        this.cameFromGame = fromGame || this.cameFromGame;
    }

    private getActiveGame(): Game | null {
        const game = (window as any).poolGame as Game | undefined;
        return game ?? null;
    }

    private isGameInProgress(): boolean {
        if (!this.cameFromGame) return false;
        const game = this.getActiveGame();
        if (!game) return false;

        const stateMachine = game.stateMachine;
        const isGameOver = stateMachine ? stateMachine.state === GameState.GAME_OVER : false;
        if (isGameOver) return false;

        const hasShotStarted = Boolean(game.hasStartedRack);
        const ballsMoving = Boolean(
            game.world?.balls?.some(b => Math.abs(b.vx) > 0.05 || Math.abs(b.vy) > 0.05)
        );

        return hasShotStarted || ballsMoving;
    }

    update(_dt: number): void { }

    render(ctx: CanvasRenderingContext2D): void {
        const width = ctx.canvas.width;
        const height = ctx.canvas.height;
        this.renderBackground(ctx, width, height);
        this.renderCards(ctx);
        this.navigationBar.render(ctx, width);
    }

    private renderBackground(ctx: CanvasRenderingContext2D, width: number, height: number) {
        drawSceneBackground(ctx, width, height, 'blue');
    }

    private renderCards(ctx: CanvasRenderingContext2D) {
        for (const btn of this.buttons) {
            const isHovered = btn === this.hoveredButton;
            this.renderCard(ctx, btn, isHovered);
        }
    }

    private renderCard(ctx: CanvasRenderingContext2D, btn: LobbyButton, isHovered: boolean) {
        const { rect } = btn;
        ctx.save();

        // Draw card shape
        drawRoundedRect(ctx, rect.x, rect.y, rect.width, rect.height, 12);
        ctx.clip();

        // Draw card image if loaded with object-fit: cover behavior
        const cardImg = this.cardImages[btn.id];
        if (cardImg && cardImg.complete && cardImg.naturalWidth > 0) {
            // Calculate dimensions to cover the rect while maintaining aspect ratio
            const imgAspect = cardImg.naturalWidth / cardImg.naturalHeight;
            const rectAspect = rect.width / rect.height;

            let drawWidth, drawHeight, offsetX, offsetY;

            if (imgAspect > rectAspect) {
                // Image is wider than rect - fit height, crop width
                drawHeight = rect.height;
                drawWidth = drawHeight * imgAspect;
                offsetX = rect.x - (drawWidth - rect.width) / 2;
                offsetY = rect.y;
            } else {
                // Image is taller than rect - fit width, crop height
                drawWidth = rect.width;
                drawHeight = drawWidth / imgAspect;
                offsetX = rect.x;
                offsetY = rect.y - (drawHeight - rect.height) / 2;
            }

            ctx.drawImage(
                cardImg,
                offsetX,
                offsetY,
                drawWidth,
                drawHeight
            );

            // Add a dark overlay to make text readable
            ctx.fillStyle = ColorTokens.background.overlay;
            ctx.fillRect(rect.x, rect.y, rect.width, rect.height);
        } else {
            // Fallback to solid color
            ctx.fillStyle = ColorTokens.background.fallback;
            ctx.fill();
        }

        // Border
        drawRoundedRect(ctx, rect.x, rect.y, rect.width, rect.height, 12);
        ctx.strokeStyle = isHovered ? ColorTokens.border.hover : ColorTokens.border.default;
        ctx.lineWidth = isHovered ? 2 : 1;
        ctx.stroke();

        ctx.restore();
    }
}
