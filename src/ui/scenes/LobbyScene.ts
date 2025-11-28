import { UIScene, sceneController } from '../SceneController';
import { uiStateMachine, UIState } from '../UIStateMachine';
import {
    Rect,
    drawRoundedRect
} from '../components/UIComponents';
import { ColorTokens, SemanticColors } from '../theme/ColorTokens';
import { NavigationBar } from '../components/NavigationBar';
import { ChestSlotsBar, CHEST_BAR_HEIGHT } from '../components/ChestSlotsBar';
import { Game, GameMode } from '../../game/Game';
import { GameState } from '../../game/GameStateMachine';
import { ConfirmScene } from './ConfirmScene';
import { drawSceneBackground } from '../components/SceneBackground';
import { AssetRegistry } from '../../assets/AssetRegistry';
import { AssetLoader } from '../../assets/AssetLoader';

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
    private chestSlotsBar: ChestSlotsBar;

    private cardImages: Record<string, HTMLImageElement> = {};

    constructor() {
        this.navigationBar = new NavigationBar({
            title: 'POOL 2D',
            showBack: false, // Lobby is the home, no back button
            showProfile: true,
            showCurrencies: true,
            showSettings: true
        });
        this.chestSlotsBar = new ChestSlotsBar();
    }
    private cardImageUrls: Record<string, string> = {
        play: AssetRegistry.lobbyCards.playRanked(),
        practice: AssetRegistry.lobbyCards.practice(),
        arcade: AssetRegistry.lobbyCards.arcade(),
        shop: AssetRegistry.lobbyCards.shop(),
        events: AssetRegistry.lobbyCards.events(),
        mini: AssetRegistry.lobbyCards.miniGames(),
        league: AssetRegistry.lobbyCards.league()
    };

    mount(): void {
        this.canvas = document.getElementById('ui-stage') as HTMLCanvasElement;
        if (!this.canvas) return;

        // Load all card images using AssetLoader
        for (const [id, url] of Object.entries(this.cardImageUrls)) {
            this.cardImages[id] = AssetLoader.loadImageSync(url);
        }

        // Load chest slots (async - will re-render when loaded)
        this.chestSlotsBar.loadSlots().then(() => {
            // Trigger re-layout after slots are loaded
            if (this.canvas) {
                this.setupLayout(this.canvas.width, this.canvas.height);
            }
        });

        // Expose for testing: window.chestBar.addTestChest('chest_common')
        (window as any).chestBar = this.chestSlotsBar;

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

        // Fix initial layout after canvas is properly sized
        // This ensures correct dimensions when lobby loads on startup
        requestAnimationFrame(() => {
            if (this.canvas) {
                this.setupLayout(this.canvas.width, this.canvas.height);
            }
        });
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

        // Setup chest slots bar at the bottom
        this.chestSlotsBar.setupLayout(width, height);

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
                    // Go to club selection before starting match
                    uiStateMachine.transitionTo(UIState.CLUB_SELECTION);
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
                id: 'league', text: 'Leagues', subtitle: 'Climb the Ranks', icon: '🏆', col: 2, row: 2, cols: 1, rows: 1, color: SemanticColors.lobby.cardMiniGames,
                action: () => uiStateMachine.transitionTo(UIState.LEAGUE)
            }
        ];

        // Calculate available height for cards (reserve space for chest bar at bottom)
        const availableHeight = height - topSpacing - padding * 2 - CHEST_BAR_HEIGHT;

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

        // Check chest slots bar
        if (this.chestSlotsBar.handleMouseMove(x, y)) {
            this.hoveredButton = null;
            this.canvas.style.cursor = this.chestSlotsBar.getCursor();
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

    private onClick = async (e: MouseEvent) => {
        if (!this.canvas) return;
        const rect = this.canvas.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;

        // Check navigation bar first
        if (this.navigationBar.handleClick(x, y)) {
            return;
        }

        // Check chest slots bar
        if (await this.chestSlotsBar.handleClick(x, y)) {
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

    update(dt: number): void {
        this.chestSlotsBar.update(dt);
    }

    render(ctx: CanvasRenderingContext2D): void {
        const width = ctx.canvas.width;
        const height = ctx.canvas.height;
        this.renderBackground(ctx, width, height);
        this.renderCards(ctx);
        this.chestSlotsBar.render(ctx, width);
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
        const { x, y, width, height } = rect;
        const radius = 12;
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

        // Draw card shape and clip to inner area
        // Save again for clipping (separate from outer save for transforms)
        ctx.save();
        drawRoundedRect(ctx, innerX, innerY, innerWidth, innerHeight, innerRadius);
        ctx.clip();

        // Draw card image if loaded with object-fit: cover behavior
        const cardImg = this.cardImages[btn.id];
        if (cardImg && cardImg.complete && cardImg.naturalWidth > 0) {
            // Calculate dimensions to cover the inner rect while maintaining aspect ratio
            const imgAspect = cardImg.naturalWidth / cardImg.naturalHeight;
            const rectAspect = innerWidth / innerHeight;

            let drawWidth, drawHeight, offsetX, offsetY;

            if (imgAspect > rectAspect) {
                // Image is wider than rect - fit height, crop width
                drawHeight = innerHeight;
                drawWidth = drawHeight * imgAspect;
                offsetX = innerX - (drawWidth - innerWidth) / 2;
                offsetY = innerY;
            } else {
                // Image is taller than rect - fit width, crop height
                drawWidth = innerWidth;
                drawHeight = drawWidth / imgAspect;
                offsetX = innerX;
                offsetY = innerY - (drawHeight - innerHeight) / 2;
            }

            ctx.drawImage(
                cardImg,
                offsetX,
                offsetY,
                drawWidth,
                drawHeight
            );

            // Add a gradient overlay (scrim) to make text readable at the bottom
            // while keeping the top vibrant
            const gradient = ctx.createLinearGradient(innerX, innerY, innerX, innerY + innerHeight);
            gradient.addColorStop(0, 'rgba(0, 0, 0, 0)');
            gradient.addColorStop(0.4, 'rgba(0, 0, 0, 0.1)');
            gradient.addColorStop(1, 'rgba(0, 0, 0, 0.85)');
            ctx.fillStyle = gradient;
            ctx.fillRect(innerX, innerY, innerWidth, innerHeight);

            // Restore from clip for text
            ctx.restore();

            // Draw Text
            ctx.textAlign = 'left';
            ctx.shadowColor = 'transparent';

            // Title
            ctx.font = '700 24px "Rajdhani", sans-serif';
            ctx.fillStyle = '#FFFFFF';
            ctx.shadowColor = 'rgba(0,0,0,0.5)';
            ctx.shadowBlur = 4;
            ctx.fillText(btn.text, innerX + 16, innerY + innerHeight - (btn.subtitle ? 38 : 20));

            // Subtitle
            if (btn.subtitle) {
                ctx.font = '500 16px "Rajdhani", sans-serif';
                ctx.fillStyle = '#DDDDDD';
                ctx.fillText(btn.subtitle, innerX + 16, innerY + innerHeight - 16);
            }
            ctx.shadowBlur = 0;
            ctx.shadowColor = 'transparent';
        } else {
            // Fallback to solid color
            ctx.fillStyle = ColorTokens.background.fallback;
            ctx.fill();
            ctx.restore();
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
