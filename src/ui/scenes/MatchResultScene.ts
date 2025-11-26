/**
 * MatchResultScene - Post-game results screen
 * Shows win/loss, earnings, chest earned, and options to play again or return to lobby
 */

import { UIScene } from '../SceneController';
import { uiStateMachine, UIState } from '../UIStateMachine';
import { drawRoundedRect, drawGlossyButton, Rect } from '../components/UIComponents';
import { ColorTokens } from '../theme/ColorTokens';
import { LayoutConstants } from '../theme/LayoutConstants';
import { drawSceneBackground } from '../components/SceneBackground';
import { AssetRegistry } from '../../assets/AssetRegistry';
import { AssetLoader } from '../../assets/AssetLoader';
import { CHEST_DEFINITIONS, ChestType } from '../../game/economy/ChestSystem';
import { Game, GameMode } from '../../game/Game';

export interface MatchResultData {
    isWin: boolean;
    earnings: number;
    opponentName: string;
    opponentId: string;
    chestAwarded: string | null;
    leagueId: string;
}

interface ResultButton {
    id: 'play_again' | 'lobby';
    label: string;
    color: string;
    rect: Rect;
}

export class MatchResultScene implements UIScene {
    private canvas: HTMLCanvasElement | null = null;
    private buttons: ResultButton[] = [];
    private hoveredButton: ResultButton | null = null;
    private resultData: MatchResultData | null = null;
    private animationProgress: number = 0;
    private chestImage: HTMLImageElement | null = null;

    mount(): void {
        this.canvas = document.getElementById('ui-stage') as HTMLCanvasElement;
        if (!this.canvas) return;

        // Get match result data
        this.resultData = (window as any).__lastMatchResult || null;

        // Load assets
        if (this.resultData?.chestAwarded) {
            const chestUrl = this.getChestImageUrl(this.resultData.chestAwarded);
            if (chestUrl) {
                this.chestImage = AssetLoader.loadImageSync(chestUrl);
            }
        }

        this.animationProgress = 0;
        this.setupLayout();

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
        this.chestImage = null;
    }

    private getChestImageUrl(chestType: string): string | null {
        switch (chestType) {
            case ChestType.COMMON: return AssetRegistry.economy.chestCommon();
            case ChestType.RARE: return AssetRegistry.economy.chestRare();
            case ChestType.EPIC: return AssetRegistry.economy.chestEpic();
            default: return null;
        }
    }

    private onResize = () => {
        this.setupLayout();
    };

    private setupLayout() {
        if (!this.canvas) return;
        const width = this.canvas.width;
        const height = this.canvas.height;

        const buttonWidth = 200;
        const buttonHeight = 56;
        const gap = 20;
        const centerX = width / 2;
        const buttonY = height * 0.75;

        this.buttons = [
            {
                id: 'play_again',
                label: 'Play Again',
                color: ColorTokens.action.success,
                rect: { x: centerX - buttonWidth - gap / 2, y: buttonY, width: buttonWidth, height: buttonHeight }
            },
            {
                id: 'lobby',
                label: 'Back to Lobby',
                color: ColorTokens.action.info,
                rect: { x: centerX + gap / 2, y: buttonY, width: buttonWidth, height: buttonHeight }
            }
        ];
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

    private onClick = (_e: MouseEvent) => {
        if (!this.hoveredButton) return;

        if (this.hoveredButton.id === 'play_again') {
            // Restart game and go to in-game
            const game = (window as any).poolGame as Game;
            if (game) {
                game.mode = GameMode.EIGHT_BALL;
                game.restart();
            }
            uiStateMachine.transitionTo(UIState.IN_GAME);
        } else if (this.hoveredButton.id === 'lobby') {
            uiStateMachine.transitionTo(UIState.LOBBY);
        }
    };

    update(dt: number): void {
        // Animate elements
        this.animationProgress = Math.min(1, this.animationProgress + dt * 2);
    }

    render(ctx: CanvasRenderingContext2D): void {
        const width = ctx.canvas.width;
        const height = ctx.canvas.height;

        // Background
        drawSceneBackground(ctx, width, height, this.resultData?.isWin ? 'green' : 'purple');

        // Semi-transparent overlay
        ctx.fillStyle = 'rgba(0, 0, 0, 0.4)';
        ctx.fillRect(0, 0, width, height);

        if (!this.resultData) {
            ctx.fillStyle = '#FFFFFF';
            ctx.font = '24px sans-serif';
            ctx.textAlign = 'center';
            ctx.fillText('Loading results...', width / 2, height / 2);
            return;
        }

        const centerX = width / 2;
        const easeOut = 1 - Math.pow(1 - this.animationProgress, 3);

        // Main result panel
        const panelWidth = Math.min(600, width * 0.85);
        const panelHeight = 420;
        const panelX = centerX - panelWidth / 2;
        const panelY = height * 0.15;

        // Draw panel background
        ctx.save();
        ctx.shadowColor = 'rgba(0, 0, 0, 0.5)';
        ctx.shadowBlur = 30;
        ctx.shadowOffsetY = 10;
        drawRoundedRect(ctx, panelX, panelY, panelWidth, panelHeight, 20);
        const panelGradient = ctx.createLinearGradient(panelX, panelY, panelX, panelY + panelHeight);
        panelGradient.addColorStop(0, 'rgba(40, 45, 60, 0.95)');
        panelGradient.addColorStop(1, 'rgba(25, 28, 38, 0.95)');
        ctx.fillStyle = panelGradient;
        ctx.fill();
        ctx.restore();

        // Panel border
        drawRoundedRect(ctx, panelX, panelY, panelWidth, panelHeight, 20);
        ctx.strokeStyle = this.resultData.isWin ? ColorTokens.action.success : ColorTokens.action.danger;
        ctx.lineWidth = 3;
        ctx.stroke();

        // Result title with animation
        const titleY = panelY + 60;
        ctx.save();
        ctx.globalAlpha = easeOut;
        ctx.fillStyle = this.resultData.isWin ? '#00FF88' : '#FF6B6B';
        ctx.font = `bold 56px ${LayoutConstants.Fonts.Family.Display}`;
        ctx.textAlign = 'center';
        ctx.shadowColor = this.resultData.isWin ? 'rgba(0, 255, 136, 0.5)' : 'rgba(255, 107, 107, 0.5)';
        ctx.shadowBlur = 20;
        ctx.fillText(this.resultData.isWin ? 'VICTORY!' : 'DEFEAT', centerX, titleY);
        ctx.restore();

        // Opponent info
        const opponentY = panelY + 100;
        ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';
        ctx.font = `18px ${LayoutConstants.Fonts.Family.Body}`;
        ctx.textAlign = 'center';
        ctx.fillText(`vs ${this.resultData.opponentName}`, centerX, opponentY);

        // Earnings section
        const earningsY = panelY + 170;
        this.renderEarningsSection(ctx, centerX, earningsY, panelWidth, easeOut);

        // Chest section (if won)
        if (this.resultData.isWin && this.resultData.chestAwarded) {
            const chestY = panelY + 280;
            this.renderChestSection(ctx, centerX, chestY, easeOut);
        }

        // Render buttons
        for (const btn of this.buttons) {
            drawGlossyButton(ctx, btn.rect, btn.label, btn.color, this.hoveredButton === btn);
        }
    }

    private renderEarningsSection(ctx: CanvasRenderingContext2D, centerX: number, y: number, panelWidth: number, progress: number) {
        if (!this.resultData) return;

        // Background box
        const boxWidth = panelWidth * 0.7;
        const boxHeight = 80;
        const boxX = centerX - boxWidth / 2;

        ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
        drawRoundedRect(ctx, boxX, y, boxWidth, boxHeight, 12);
        ctx.fill();

        // Coins icon and amount
        ctx.save();
        ctx.globalAlpha = progress;

        // Coins label
        ctx.fillStyle = 'rgba(255, 255, 255, 0.6)';
        ctx.font = `14px ${LayoutConstants.Fonts.Family.Body}`;
        ctx.textAlign = 'center';
        ctx.fillText('COINS EARNED', centerX, y + 25);

        // Coins amount with animation
        const displayedCoins = Math.floor(this.resultData.earnings * progress);
        ctx.fillStyle = ColorTokens.currency.coins;
        ctx.font = `bold 36px ${LayoutConstants.Fonts.Family.Heading}`;
        ctx.fillText(`+${displayedCoins.toLocaleString()}`, centerX, y + 60);

        ctx.restore();
    }

    private renderChestSection(ctx: CanvasRenderingContext2D, centerX: number, y: number, progress: number) {
        if (!this.resultData?.chestAwarded) return;

        const chestDef = CHEST_DEFINITIONS[this.resultData.chestAwarded as ChestType];
        if (!chestDef) return;

        ctx.save();
        ctx.globalAlpha = progress;

        // Chest label
        ctx.fillStyle = 'rgba(255, 255, 255, 0.6)';
        ctx.font = `14px ${LayoutConstants.Fonts.Family.Body}`;
        ctx.textAlign = 'center';
        ctx.fillText('CHEST EARNED', centerX, y);

        // Chest image
        const chestSize = 80;
        if (this.chestImage && this.chestImage.complete && this.chestImage.naturalWidth > 0) {
            // Add glow
            ctx.shadowColor = ColorTokens.action.warning;
            ctx.shadowBlur = 20;
            ctx.drawImage(this.chestImage, centerX - chestSize / 2, y + 10, chestSize, chestSize);
            ctx.shadowBlur = 0;
        }

        // Chest name
        ctx.fillStyle = ColorTokens.action.warning;
        ctx.font = `bold 18px ${LayoutConstants.Fonts.Family.Heading}`;
        ctx.fillText(chestDef.name, centerX, y + 110);

        ctx.restore();
    }
}

