import { UIScene, sceneController } from '../SceneController';
import { uiStateMachine, UIState } from '../UIStateMachine';
import {
    drawCurrencyPill,
    Rect,
    drawRoundedRect
} from '../components/UIComponents';
import { SettingsManager } from '../SettingsManager';
import { GameMode } from '../../game/Game';
import { ConfirmScene } from './ConfirmScene';

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
    private settingsManager = new SettingsManager();
    private keyHandler: ((e: KeyboardEvent) => void) | null = null;
    private cameFromGame: boolean = false;

    private cardImage: HTMLImageElement | null = null;
    /**
     * Sprite coordinates pulled from look.jpeg (2720x1568) to match each lobby card.
     * Values are {sx, sy, sw, sh} in source image space.
     */
    private cardSprites: Record<string, { sx: number; sy: number; sw: number; sh: number }> = {
        play: { sx: 60, sy: 40, sw: 900, sh: 500 },
        practice: { sx: 1900, sy: 40, sw: 760, sh: 520 },
        arcade: { sx: 1890, sy: 640, sw: 760, sh: 520 },
        shop: { sx: 60, sy: 580, sw: 830, sh: 480 },
        profile: { sx: 950, sy: 540, sw: 840, sh: 660 },
        mini: { sx: 1890, sy: 1120, sw: 760, sh: 360 }
    };

    mount(): void {
        // Track if we came from an active game
        this.cameFromGame = true;
        this.canvas = document.getElementById('ui-stage') as HTMLCanvasElement;
        if (!this.canvas) return;

        // Load card image
        this.cardImage = new Image();
        this.cardImage.src = 'src/assets/img/look.jpeg';
        // Force redraw when image loads
        this.cardImage.onload = () => {
            // We don't have a main loop that redraws constantly unless dirty, 
            // but the game loop calls render() every frame anyway via SceneController -> UIStateMachine
        };

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
        this.cardImage = null;
    }

    private onResize = () => {
        if (!this.canvas) return;
        this.setupLayout(this.canvas.width, this.canvas.height);
    };

    private setupLayout(width: number, height: number) {
        this.buttons = [];

        // Miniclip-style grid layout
        const padding = 24;
        const gap = 16;
        const topSpacing = 100; // Space for currency pills
        const contentWidth = Math.min(900, width - padding * 2);
        const startX = (width - contentWidth) / 2;

        // 3-column grid
        const totalCols = 3;
        const cardWidth = (contentWidth - gap * (totalCols - 1)) / totalCols;
        const baseCardHeight = 160;

        // Define cards with grid positions (Miniclip style - different sizes)
        const cards = [
            // Row 1: Large featured "Play" card (2x2) + Practice (1x1)
            {
                id: 'play', text: '1 vs 1', subtitle: 'Play Ranked', icon: '🎱', col: 0, row: 0, cols: 2, rows: 2, color: '#4CAF50',
                action: () => {
                    const game = (window as any).poolGame;
                    if (game) { game.mode = GameMode.EIGHT_BALL; game.restart(); }
                    uiStateMachine.transitionTo(UIState.IN_GAME);
                }
            },
            {
                id: 'practice', text: 'Practice', subtitle: 'Solo', icon: '🎯', col: 2, row: 0, cols: 1, rows: 1, color: '#4CAF50',
                action: () => {
                    const game = (window as any).poolGame;
                    if (game) { game.mode = GameMode.PRACTICE; game.restart(); }
                    uiStateMachine.transitionTo(UIState.IN_GAME);
                }
            },
            // Row 2: Arcade (continues from Play's 2nd row)
            {
                id: 'arcade', text: 'Arcade', subtitle: 'Game Modes', icon: '⚡', col: 2, row: 1, cols: 1, rows: 1, color: '#2196F3',
                action: () => uiStateMachine.transitionTo(UIState.PLAY_MODES)
            },
            // Row 3: Shop + Profile + Mini
            {
                id: 'shop', text: 'Shop', subtitle: 'Cues & Items', icon: '🎨', col: 0, row: 2, cols: 1, rows: 1, color: '#9C27B0',
                action: () => uiStateMachine.transitionTo(UIState.SHOP)
            },
            {
                id: 'profile', text: 'Profile', subtitle: 'Your Stats', icon: '👤', col: 1, row: 2, cols: 1, rows: 1, color: '#FF9800',
                action: () => uiStateMachine.transitionTo(UIState.PROFILE)
            },
            {
                id: 'mini', text: 'Mini Games', subtitle: 'Coming Soon', icon: '🎮', col: 2, row: 2, cols: 1, rows: 1, color: '#607D8B',
                action: () => { }
            }
        ];

        // Determine dynamic row heights based on sprite aspect ratios so cards match their art
        const rowCount = Math.max(...cards.map(c => c.row + c.rows));
        const rowHeights: number[] = new Array(rowCount).fill(baseCardHeight);

        // First pass: compute desired per-row height from art aspect ratios
        cards.forEach(card => {
            const w = cardWidth * card.cols + gap * (card.cols - 1);
            const sprite = this.cardSprites[card.id];
            const aspect = sprite ? sprite.sw / sprite.sh : w / (baseCardHeight * card.rows);
            const desiredHeight = w / aspect;
            const sharedRowHeight = (desiredHeight - gap * (card.rows - 1)) / card.rows;

            for (let i = card.row; i < card.row + card.rows; i++) {
                rowHeights[i] = Math.max(rowHeights[i], sharedRowHeight);
            }
        });

        // Precompute row offsets
        const rowOffsets: number[] = [];
        let accumY = topSpacing;
        rowHeights.forEach((h, idx) => {
            rowOffsets[idx] = accumY;
            accumY += h + gap;
        });

        // Create buttons from cards using computed sizes
        cards.forEach(card => {
            const x = startX + card.col * (cardWidth + gap);
            const y = rowOffsets[card.row];
            const w = cardWidth * card.cols + gap * (card.cols - 1);
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

    private onClick = () => {
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

    private isGameInProgress(): boolean {
        const game = (window as any).poolGame;
        if (!game) return false;

        // If we mounted this lobby scene, it means we came from a game
        // (either via ESC or via initial load, but better safe than sorry)
        // Once a play button is clicked and a new game starts, we can reset this flag
        return this.cameFromGame;
    }

    update(_dt: number): void { }

    render(ctx: CanvasRenderingContext2D): void {
        const width = ctx.canvas.width;
        const height = ctx.canvas.height;
        this.renderBackground(ctx, width, height);
        this.renderCurrencies(ctx, width);
        this.renderCards(ctx);
    }

    private renderBackground(ctx: CanvasRenderingContext2D, width: number, height: number) {
        // Simple clean gradient
        const gradient = ctx.createLinearGradient(0, 0, 0, height);
        gradient.addColorStop(0, '#0D1424');
        gradient.addColorStop(1, '#000B1A');
        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, width, height);
    }

    private renderCurrencies(ctx: CanvasRenderingContext2D, width: number) {
        const currencyY = 44;
        const pillWidth = 100;
        const gap = 16;
        const padding = 40; // Increased padding from 24 to 40
        drawCurrencyPill(ctx, width - padding - pillWidth - gap - pillWidth, currencyY, 2500, 'coins');
        drawCurrencyPill(ctx, width - padding - pillWidth, currencyY, 85, 'cash');
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

        // Draw Image Background if loaded
        if (this.cardImage && this.cardImage.complete && this.cardImage.naturalWidth > 0) {
            const sprite = this.cardSprites[btn.id];
            if (sprite) {
                ctx.drawImage(
                    this.cardImage,
                    sprite.sx,
                    sprite.sy,
                    sprite.sw,
                    sprite.sh,
                    rect.x,
                    rect.y,
                    rect.width,
                    rect.height
                );
            } else {
                ctx.drawImage(this.cardImage, rect.x, rect.y, rect.width, rect.height);
            }

            // Add a dark overlay to make text readable
            ctx.fillStyle = 'rgba(0, 0, 0, 0.4)';
            ctx.fillRect(rect.x, rect.y, rect.width, rect.height);
        } else {
            // Fallback to solid color
            ctx.fillStyle = 'rgba(13, 20, 36, 0.95)';
            ctx.fill();
        }

        // Border
        drawRoundedRect(ctx, rect.x, rect.y, rect.width, rect.height, 12);
        ctx.strokeStyle = isHovered ? '#00B4FF' : 'rgba(255,255,255,0.1)';
       ctx.lineWidth = isHovered ? 2 : 1;
       ctx.stroke();

        ctx.restore();
    }
}
