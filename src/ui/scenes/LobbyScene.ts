import { UIScene, sceneController } from '../SceneController';
import { Focusable } from '../input/FocusManager';
import { uiStateMachine, UIState } from '../UIStateMachine';
import {
    Rect,
    drawRoundedRect
} from '../components/UIComponents';
import { ColorTokens, SemanticColors } from '../theme/ColorTokens';
import { LayoutConstants, getDeviceType } from '../theme/LayoutConstants';
import { NavigationBar } from '../components/NavigationBar';
import { ChestSlotsBar } from '../components/ChestSlotsBar';
import { Game, GameMode } from '../../game/Game';
import { GameState } from '../../game/GameStateMachine';
import { ConfirmScene } from './ConfirmScene';
import { drawSceneBackground } from '../components/SceneBackground';
import { AssetRegistry } from '../../assets/AssetRegistry';
import { AssetLoader } from '../../assets/AssetLoader';

type ButtonVariant = 'nav';

interface LobbyButton extends Focusable {
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


        // ESC key handled globally by SceneController now
        // this.keyHandler = (e: KeyboardEvent) => {
        //     if (e.key === 'Escape') {
        //         uiStateMachine.transitionTo(UIState.IN_GAME);
        //     }
        // };
        // window.addEventListener('keydown', this.keyHandler);

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

        this.canvas.style.cursor = 'default';

        if (this.keyHandler) {
            // window.removeEventListener('keydown', this.keyHandler);
            this.keyHandler = null;
        }
        this.cardImages = {};
    }

    public onResize(width: number, height: number) {
        if (!this.canvas) return;
        this.setupLayout(width, height);
    }

    private setupLayout(width: number, height: number) {
        sceneController.focusManager.clear();
        this.buttons = [];

        // Setup navigation bar (pass height for landscape detection)
        this.navigationBar.setupLayout(width, height);
        const navHeight = this.navigationBar.getHeight();

        // Setup chest slots bar at the bottom
        this.chestSlotsBar.setupLayout(width, height);

        // Detect device type and orientation for responsive layout
        const deviceType = getDeviceType(width, height);
        const isMobile = deviceType === 'mobile';
        const isTablet = deviceType === 'tablet';
        const isLandscape = width > height && height < 500; // Phone in landscape

        // Responsive padding and gap - more compact in landscape
        const padding = isLandscape ? 8 : (isMobile ? 12 : (isTablet ? 16 : 24));
        const gap = isLandscape ? 6 : (isMobile ? 10 : (isTablet ? 12 : 16));
        // Ensure content starts well below the nav bar, not under it
        const topSpacing = navHeight + (isLandscape ? 8 : (isMobile ? 12 : 20));

        // Calculate available height for cards
        // Use the responsive chest bar height from the component
        const chestBarHeight = this.chestSlotsBar.getHeight();
        const availableHeight = height - topSpacing - padding * 2 - chestBarHeight;

        // Define cards with their actions (layout computed below based on device)
        const cardDefs = [
            {
                id: 'play', text: '1 vs 1', subtitle: 'Play Ranked', icon: '🎱', color: SemanticColors.lobby.cardPlayRanked,
                action: () => uiStateMachine.transitionTo(UIState.CLUB_SELECTION),
                priority: 1
            },
            {
                id: 'practice', text: 'Practice', subtitle: 'Solo', icon: '🎯', color: SemanticColors.lobby.cardPractice,
                action: () => {
                    const game = (window as any).poolGame;
                    if (game) { game.mode = GameMode.PRACTICE; game.restart(); }
                    uiStateMachine.transitionTo(UIState.IN_GAME);
                },
                priority: 2
            },
            {
                id: 'arcade', text: 'Arcade', subtitle: 'Game Modes', icon: '⚡', color: SemanticColors.lobby.cardArcade,
                action: () => uiStateMachine.transitionTo(UIState.PLAY_MODES),
                priority: 3
            },
            {
                id: 'shop', text: 'Shop', subtitle: 'Cues & Items', icon: '🎨', color: SemanticColors.lobby.cardShop,
                action: () => uiStateMachine.transitionTo(UIState.SHOP),
                priority: 4
            },
            {
                id: 'events', text: 'Events', subtitle: 'Win Big!', icon: '🏆', color: SemanticColors.lobby.cardEvents,
                action: () => uiStateMachine.transitionTo(UIState.EVENTS),
                priority: 5
            },
            {
                id: 'league', text: 'Leagues', subtitle: 'Climb the Ranks', icon: '🏆', color: SemanticColors.lobby.cardMiniGames,
                action: () => uiStateMachine.transitionTo(UIState.LEAGUE),
                priority: 6
            }
        ];

        if (isMobile) {
            if (isLandscape) {
                // Landscape mobile: horizontal layout with smaller cards
                this.setupLandscapeLayout(width, height, padding, gap, topSpacing, availableHeight, cardDefs);
            } else {
                // Portrait mobile: 2-column grid layout
                this.setupMobileLayout(width, height, padding, gap, topSpacing, availableHeight, cardDefs);
            }
        } else if (isTablet) {
            // Tablet: 2-column with featured card
            this.setupTabletLayout(width, height, padding, gap, topSpacing, availableHeight, cardDefs);
        } else {
            // Desktop: Original 3-column Miniclip-style layout
            this.setupDesktopLayout(width, height, padding, gap, topSpacing, availableHeight, cardDefs);
        }
    }

    private setupLandscapeLayout(width: number, _height: number, _padding: number, _gap: number, topSpacing: number, availableHeight: number, cardDefs: Array<{ id: string; text: string; subtitle: string; icon: string; color: string; action: () => void }>) {
        // In landscape, spread cards across full width and height
        const sidePadding = 16;
        const contentWidth = width - sidePadding * 2;
        const numCards = cardDefs.length;
        const cardGap = 12;
        const cardWidth = (contentWidth - cardGap * (numCards - 1)) / numCards;
        // Use full available height, not capped at 80px
        const cardHeight = availableHeight;

        cardDefs.forEach((card, index) => {
            const cardX = sidePadding + index * (cardWidth + cardGap);

            this.buttons.push({
                id: card.id,
                text: card.text,
                subtitle: '', // Hide subtitle in landscape to save space
                icon: card.icon,
                rect: { x: cardX, y: topSpacing, width: cardWidth, height: cardHeight },
                color: card.color,
                action: card.action,
                variant: 'nav'
            });
        });
    }

    private setupMobileLayout(width: number, _height: number, padding: number, gap: number, topSpacing: number, availableHeight: number, cardDefs: Array<{ id: string; text: string; subtitle: string; icon: string; color: string; action: () => void }>) {
        const contentWidth = width - padding * 2;
        const startX = padding;
        const numCols = 2; // Always 2-column on mobile

        // Grid layout calculations
        const colWidth = (contentWidth - gap) / numCols;

        // Cards: 1 play card (full width) + remaining in 2-col grid
        // With 6 cards total: Play + 5 others = Play row + 3 rows (last row has 1 card)
        const otherCards = cardDefs.filter(c => c.id !== 'play');
        const numRows = Math.ceil(otherCards.length / numCols);

        // Calculate heights to fill available space
        const totalGaps = gap * numRows; // gap between play and first row, + gaps between rows
        const heightForCards = availableHeight - totalGaps;

        // Play card gets ~25% of height, rest split among other rows
        const playCardHeight = Math.max(80, Math.min(heightForCards * 0.22, 130));
        const remainingHeight = heightForCards - playCardHeight;
        const rowHeight = Math.max(70, remainingHeight / numRows);

        cardDefs.forEach((card, index) => {
            if (card.id === 'play') {
                // Play card: full width, first position
                this.buttons.push({
                    id: card.id,
                    text: card.text,
                    subtitle: card.subtitle,
                    icon: card.icon,
                    rect: { x: startX, y: topSpacing, width: contentWidth, height: playCardHeight },
                    color: card.color,
                    action: card.action,
                    variant: 'nav'
                });
            } else {
                // Other cards: 2-column grid below play card
                const adjustedIndex = index - 1; // Skip play card
                const col = adjustedIndex % numCols;
                const row = Math.floor(adjustedIndex / numCols);
                const cardY = topSpacing + playCardHeight + gap + row * (rowHeight + gap);

                // Check if this is the last row and it's a single item
                const isLastRow = row === numRows - 1;
                const itemsInLastRow = otherCards.length % numCols;
                const isSingleItemLastRow = isLastRow && itemsInLastRow === 1;

                // If single item in last row, make it full width
                const cardWidth = isSingleItemLastRow ? contentWidth : colWidth;
                const cardX = isSingleItemLastRow ? startX : (startX + col * (colWidth + gap));

                this.buttons.push({
                    id: card.id,
                    text: card.text,
                    subtitle: card.subtitle,
                    icon: card.icon,
                    rect: { x: cardX, y: cardY, width: cardWidth, height: rowHeight },
                    color: card.color,
                    action: card.action,
                    variant: 'nav'
                });
            }
        });
    }

    private setupTabletLayout(width: number, _height: number, padding: number, gap: number, topSpacing: number, availableHeight: number, cardDefs: Array<{ id: string; text: string; subtitle: string; icon: string; color: string; action: () => void }>) {
        const contentWidth = Math.min(800, width - padding * 2);
        const startX = (width - contentWidth) / 2;

        // 2-column layout with featured Play card
        const colWidth = (contentWidth - gap) / 2;

        // Row heights: featured row is taller
        const featuredRowHeight = availableHeight * 0.4;
        const regularRowHeight = (availableHeight - featuredRowHeight - gap * 2) / 2;

        // Play card takes left side of first row (large)
        // Practice and Arcade take right side stacked
        // Bottom row: Shop, Events, League in 3 columns

        const layouts = [
            { id: 'play', x: startX, y: topSpacing, w: colWidth, h: featuredRowHeight },
            { id: 'practice', x: startX + colWidth + gap, y: topSpacing, w: colWidth, h: featuredRowHeight / 2 - gap / 2 },
            { id: 'arcade', x: startX + colWidth + gap, y: topSpacing + featuredRowHeight / 2 + gap / 2, w: colWidth, h: featuredRowHeight / 2 - gap / 2 },
            { id: 'shop', x: startX, y: topSpacing + featuredRowHeight + gap, w: contentWidth / 3 - gap * 2 / 3, h: regularRowHeight },
            { id: 'events', x: startX + contentWidth / 3 + gap / 3, y: topSpacing + featuredRowHeight + gap, w: contentWidth / 3 - gap * 2 / 3, h: regularRowHeight },
            { id: 'league', x: startX + contentWidth * 2 / 3 + gap * 2 / 3, y: topSpacing + featuredRowHeight + gap, w: contentWidth / 3 - gap * 2 / 3, h: regularRowHeight },
        ];

        cardDefs.forEach(card => {
            const layout = layouts.find(l => l.id === card.id);
            if (layout) {
                this.buttons.push({
                    id: card.id,
                    text: card.text,
                    subtitle: card.subtitle,
                    icon: card.icon,
                    rect: { x: layout.x, y: layout.y, width: layout.w, height: layout.h },
                    color: card.color,
                    action: card.action,
                    variant: 'nav'
                });
            }
        });
    }

    private setupDesktopLayout(width: number, _height: number, padding: number, gap: number, topSpacing: number, availableHeight: number, cardDefs: Array<{ id: string; text: string; subtitle: string; icon: string; color: string; action: () => void }>) {
        // Original Miniclip-style grid layout with weighted columns
        const contentWidth = Math.min(1000, width - padding * 2);
        const startX = (width - contentWidth) / 2;

        // Use weighted column widths
        const landscapeWeight = 2.5;
        const portraitWeight = 1.5;
        const totalWeight = landscapeWeight * 2 + portraitWeight;
        const totalGapWidth = gap * 2;
        const availableWidth = contentWidth - totalGapWidth;

        const landscapeWidth = (availableWidth * landscapeWeight) / totalWeight;
        const portraitWidth = (availableWidth * portraitWeight) / totalWeight;

        // Column positions
        const col0X = startX;
        const col1X = col0X + landscapeWidth + gap;
        const col2X = col1X + landscapeWidth + gap;

        // Grid position mapping
        const gridPositions = [
            { id: 'play', col: 0, row: 0, cols: 2, rows: 2 },
            { id: 'practice', col: 2, row: 0, cols: 1, rows: 1 },
            { id: 'arcade', col: 2, row: 1, cols: 1, rows: 1 },
            { id: 'shop', col: 0, row: 2, cols: 1, rows: 1 },
            { id: 'events', col: 1, row: 2, cols: 1, rows: 1 },
            { id: 'league', col: 2, row: 2, cols: 1, rows: 1 },
        ];

        // Row heights
        const rowCount = 3;
        const totalGaps = gap * (rowCount - 1);
        const availableCardHeight = availableHeight - totalGaps;
        const playCardHeight = (availableCardHeight * 2) / 3;
        const bottomRowHeight = (availableCardHeight * 1) / 3;

        const rowHeights = [
            playCardHeight / 2 - gap / 2,
            playCardHeight / 2 - gap / 2,
            bottomRowHeight
        ];

        // Row offsets
        const rowOffsets: number[] = [];
        let accumY = topSpacing;
        rowHeights.forEach((h) => {
            rowOffsets.push(accumY);
            accumY += h + gap;
        });

        // Create buttons
        cardDefs.forEach(card => {
            const pos = gridPositions.find(p => p.id === card.id);
            if (!pos) return;

            let x: number;
            if (pos.col === 0) x = col0X;
            else if (pos.col === 1) x = col1X;
            else x = col2X;

            const y = rowOffsets[pos.row];

            let w: number;
            if (pos.cols === 2) {
                w = landscapeWidth * 2 + gap;
            } else if (pos.col === 2) {
                w = portraitWidth;
            } else {
                w = landscapeWidth;
            }

            let h = gap * (pos.rows - 1);
            for (let i = pos.row; i < pos.row + pos.rows; i++) {
                h += rowHeights[i];
            }

            // Navigation Logic
            let up, down, left, right;
            if (card.id === 'play') {
                right = 'practice';
                down = 'shop';
            } else if (card.id === 'practice') {
                left = 'play';
                down = 'arcade';
            } else if (card.id === 'arcade') {
                left = 'play';
                up = 'practice';
                down = 'league';
            } else if (card.id === 'shop') {
                up = 'play';
                right = 'events';
            } else if (card.id === 'events') {
                left = 'shop';
                up = 'play';
                right = 'league';
            } else if (card.id === 'league') {
                left = 'events';
                up = 'arcade';
            }

            const btn: LobbyButton = {
                id: card.id,
                text: card.text,
                subtitle: card.subtitle,
                icon: card.icon,
                rect: { x, y, width: w, height: h },
                color: card.color,
                action: card.action,
                variant: 'nav',
                up, down, left, right,
                onAction: card.action,
                onFocus: () => { /* Optional: Scroll into view if needed */ }
            };

            this.buttons.push(btn);
            sceneController.focusManager.register(btn);
        });

        // Set initial focus if none
        if (!sceneController.focusManager.getCurrentFocus()) {
            sceneController.focusManager.focus('play');
        }
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
            ctx.shadowColor = ColorTokens.effects.shadowHeavy;
            ctx.shadowBlur = LayoutConstants.Shadows.Large.blur;
            ctx.shadowOffsetY = LayoutConstants.Shadows.Large.offsetY;
        } else {
            ctx.shadowColor = ColorTokens.effects.shadowLight;
            ctx.shadowBlur = LayoutConstants.Shadows.Medium.blur;
            ctx.shadowOffsetY = LayoutConstants.Shadows.Medium.offsetY;
        }

        // Outer Frame - Metallic/Wood-grain effect
        drawRoundedRect(ctx, x, y, width, height, radius);
        const frameGradient = ctx.createLinearGradient(x, y, x, y + height);
        frameGradient.addColorStop(0, ColorTokens.card.frame.light);
        frameGradient.addColorStop(0.5, ColorTokens.card.frame.mid);
        frameGradient.addColorStop(1, ColorTokens.card.frame.dark);
        ctx.fillStyle = frameGradient;
        ctx.fill();

        // Add metallic shine to frame
        const shineGradient = ctx.createLinearGradient(x, y, x + width / 3, y);
        shineGradient.addColorStop(0, ColorTokens.effects.gloss.start);
        shineGradient.addColorStop(0.5, ColorTokens.effects.gloss.mid);
        shineGradient.addColorStop(1, ColorTokens.effects.gloss.none);
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
        bevelGradient.addColorStop(0, ColorTokens.card.bevel.top);
        bevelGradient.addColorStop(0.5, ColorTokens.card.bevel.mid);
        bevelGradient.addColorStop(1, ColorTokens.card.bevel.bottom);
        ctx.fillStyle = bevelGradient;
        ctx.fill();

        // Bevel highlight (top edge)
        drawRoundedRect(ctx, bevelX, bevelY, bevelFullWidth, bevelFullHeight, bevelRadius);
        ctx.strokeStyle = ColorTokens.border.emphasis;
        ctx.lineWidth = LayoutConstants.Lines.Thin;
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
            gradient.addColorStop(0, ColorTokens.effects.gloss.none);
            gradient.addColorStop(0.4, 'rgba(0, 0, 0, 0.1)');
            gradient.addColorStop(1, ColorTokens.background.overlayHeavy);
            ctx.fillStyle = gradient;
            ctx.fillRect(innerX, innerY, innerWidth, innerHeight);

            // Restore from clip for text
            ctx.restore();

            // Draw Text
            ctx.textAlign = 'left';
            ctx.shadowColor = 'transparent';

            // Title
            ctx.font = `${LayoutConstants.Fonts.Weight.Bold} ${LayoutConstants.Fonts.Size.XLarge}px ${LayoutConstants.Fonts.Family.Game}`;
            ctx.fillStyle = ColorTokens.text.primary;
            ctx.shadowColor = ColorTokens.effects.shadow;
            ctx.shadowBlur = LayoutConstants.Shadows.Text.blur;
            ctx.fillText(btn.text, innerX + 16, innerY + innerHeight - (btn.subtitle ? 38 : 20));

            // Subtitle
            if (btn.subtitle) {
                ctx.font = `500 ${LayoutConstants.Fonts.Size.Medium}px ${LayoutConstants.Fonts.Family.Game}`;
                ctx.fillStyle = ColorTokens.text.secondary;
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
        ctx.strokeStyle = ColorTokens.border.darkStrong;
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
        highlightGradient.addColorStop(0, ColorTokens.border.subtle);
        highlightGradient.addColorStop(1, ColorTokens.effects.gloss.none);
        ctx.strokeStyle = highlightGradient;
        ctx.lineWidth = LayoutConstants.Lines.Thin;
        ctx.stroke();

        // Corner decorations (small accent lines at corners)
        const cornerSize = Math.min(LayoutConstants.Cards.CornerAccentSize, innerWidth * 0.05);
        const cornerInset = frameWidth + bevelWidth + 2;
        ctx.strokeStyle = ColorTokens.card.cornerAccent;
        ctx.lineWidth = LayoutConstants.Lines.Normal;

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
        const isFocused = sceneController.focusManager.getCurrentFocus() === btn.id;
        if (isHovered || isFocused) {
            drawRoundedRect(ctx, x - 2, y - 2, width + 4, height + 4, radius + 2);
            ctx.strokeStyle = ColorTokens.ui.teal;
            ctx.lineWidth = LayoutConstants.Lines.Heavy;
            ctx.shadowColor = ColorTokens.effects.glowTeal;
            ctx.shadowBlur = LayoutConstants.Shadows.Medium.blur;
            ctx.stroke();
            ctx.shadowBlur = 0;
            ctx.shadowColor = 'transparent';
        }

        ctx.restore();
    }
}
