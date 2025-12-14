/**
 * MatchResultScene - Post-game results screen
 * Shows win/loss, earnings, trophies, chest earned, and options to play again or return to lobby
 * Extends BaseScene for common mount/unmount/event handling
 */

import { BaseScene, Button } from './BaseScene';
import { uiStateMachine, UIState } from '../UIStateMachine';
import { drawRoundedRect } from '../components/UIComponents';
import { ColorTokens } from '../theme/ColorTokens';
import { LayoutConstants } from '../theme/LayoutConstants';
import { drawSceneBackground } from '../components/SceneBackground';
import { ChestRenderer } from '../components/ChestRenderer';
import { ChestType, CHEST_DEFINITIONS } from '../../game/economy/ChestSystem';

interface MatchResultData {
    isWin: boolean;
    earnings: number;
    trophyChange: number;
    opponentName: string;
    opponentId: string;
    chestAwarded: string | null;
    clubId: string | null;
}

interface ResultButton extends Button {
    label: string;
    primary?: boolean;
}

export class MatchResultScene extends BaseScene {
    private resultButtons: ResultButton[] = [];
    private resultData: MatchResultData | null = null;
    private animationProgress: number = 0;
    private animationStartTime: number = 0;

    protected onMount(): void {
        // Get match result data
        this.resultData = (window as unknown as { __lastMatchResult?: MatchResultData }).__lastMatchResult || null;
        console.log('MatchResultScene mounted with data:', this.resultData);

        this.animationProgress = 0;
        this.animationStartTime = Date.now();
    }

    protected setupLayout(width: number, height: number): void {
        this.clearButtons();
        this.resultButtons = [];

        const centerX = width / 2;
        const buttonWidth = 200;
        const buttonHeight = 50;
        const buttonGap = 20;
        const buttonY = height - 120;

        const lobbyBtn: ResultButton = {
            id: 'lobby',
            rect: { x: centerX - buttonWidth - buttonGap / 2, y: buttonY, width: buttonWidth, height: buttonHeight },
            label: 'LOBBY',
            action: () => uiStateMachine.transitionTo(UIState.LOBBY),
        };

        const playAgainBtn: ResultButton = {
            id: 'play-again',
            rect: { x: centerX + buttonGap / 2, y: buttonY, width: buttonWidth, height: buttonHeight },
            label: 'PLAY AGAIN',
            primary: true,
            action: () => uiStateMachine.transitionTo(UIState.CLUB_SELECTION),
        };

        this.resultButtons = [lobbyBtn, playAgainBtn];
        for (const btn of this.resultButtons) {
            this.registerButton(btn);
        }
    }

    update(_dt: number): void {
        // Animate in over 0.8 seconds
        const elapsed = Date.now() - this.animationStartTime;
        this.animationProgress = Math.min(1, elapsed / 800);
    }

    render(ctx: CanvasRenderingContext2D): void {
        const width = ctx.canvas.width;
        const height = ctx.canvas.height;
        const centerX = width / 2;

        // Background
        drawSceneBackground(ctx, width, height, this.resultData?.isWin ? 'green' : 'red');

        // Dim overlay
        ctx.fillStyle = ColorTokens.background.overlay;
        ctx.fillRect(0, 0, width, height);

        const progress = this.easeOutBack(this.animationProgress);

        // Result card
        const cardWidth = Math.min(450, width - 40);
        const cardHeight = 400;
        const cardX = centerX - cardWidth / 2;
        const cardY = (height - cardHeight) / 2 - 30;

        // Card background with scale animation
        ctx.save();
        ctx.translate(centerX, cardY + cardHeight / 2);
        ctx.scale(progress, progress);
        ctx.translate(-centerX, -(cardY + cardHeight / 2));

        // Card shadow
        ctx.shadowColor = ColorTokens.effects.shadow;
        ctx.shadowBlur = LayoutConstants.Shadows.Large.blur + 2;
        ctx.shadowOffsetY = 10;

        drawRoundedRect(ctx, cardX, cardY, cardWidth, cardHeight, LayoutConstants.Radii.XLarge);
        ctx.fillStyle = ColorTokens.background.panel;
        ctx.fill();

        ctx.shadowBlur = 0;
        ctx.shadowOffsetY = 0;

        // Border glow
        ctx.strokeStyle = this.resultData?.isWin ? ColorTokens.action.success : ColorTokens.action.danger;
        ctx.lineWidth = LayoutConstants.Lines.Thick;
        ctx.stroke();

        ctx.restore();

        // Content (fade in after card)
        const contentProgress = Math.max(0, (this.animationProgress - 0.3) / 0.7);
        if (contentProgress > 0) {
            ctx.globalAlpha = contentProgress;
            this.renderContent(ctx, centerX, cardY, cardWidth);
            ctx.globalAlpha = 1;
        }

        // Buttons
        if (this.animationProgress > 0.5) {
            const buttonProgress = Math.min(1, (this.animationProgress - 0.5) / 0.5);
            ctx.globalAlpha = buttonProgress;
            this.renderButtons(ctx);
            ctx.globalAlpha = 1;
        }
    }

    private renderContent(ctx: CanvasRenderingContext2D, centerX: number, cardY: number, _cardWidth: number) {
        const data = this.resultData;
        if (!data) return;

        let y = cardY + 50;

        // Result title
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.font = `bold 42px ${LayoutConstants.Fonts.Family.Heading}`;
        ctx.fillStyle = data.isWin ? ColorTokens.action.success : ColorTokens.action.danger;
        ctx.fillText(data.isWin ? 'VICTORY!' : 'DEFEAT', centerX, y);

        y += 50;

        // Opponent name
        ctx.font = `${LayoutConstants.Fonts.Size.Large}px ${LayoutConstants.Fonts.Family.Body}`;
        ctx.fillStyle = ColorTokens.text.muted;
        ctx.fillText(`vs ${data.opponentName}`, centerX, y);

        y += 50;

        // Stats row
        const statsY = y;
        const statWidth = 120;
        const statsStartX = centerX - statWidth;

        // Trophies
        this.renderStat(ctx, statsStartX, statsY, '🏆',
            data.trophyChange >= 0 ? `+${data.trophyChange}` : `${data.trophyChange}`,
            data.trophyChange >= 0 ? ColorTokens.brand.primary : ColorTokens.action.danger
        );

        // Coins
        this.renderStat(ctx, statsStartX + statWidth * 2, statsY, '💰',
            data.earnings > 0 ? `+${data.earnings.toLocaleString()}` : '0',
            data.earnings > 0 ? ColorTokens.action.success : ColorTokens.metallic.mid
        );

        y += 80;

        // Chest section
        if (data.chestAwarded) {
            this.renderChestSection(ctx, centerX, y, 1);
        }
    }

    private renderStat(ctx: CanvasRenderingContext2D, x: number, y: number, icon: string, value: string, color: string) {
        ctx.textAlign = 'center';

        // Icon
        ctx.font = `${LayoutConstants.Fonts.Size.XXLarge}px ${LayoutConstants.Fonts.Family.Body}`;
        ctx.fillText(icon, x, y);

        // Value
        ctx.font = `bold 24px ${LayoutConstants.Fonts.Family.Heading}`;
        ctx.fillStyle = color;
        ctx.fillText(value, x, y + 40);
    }

    private renderChestSection(ctx: CanvasRenderingContext2D, centerX: number, y: number, progress: number) {
        if (!this.resultData?.chestAwarded) return;

        const chestType = this.resultData.chestAwarded as ChestType;
        const chestDef = CHEST_DEFINITIONS[chestType];
        if (!chestDef) return;

        ctx.save();
        ctx.globalAlpha = progress;

        // Chest label
        ctx.fillStyle = ColorTokens.text.muted;
        ctx.font = `14px ${LayoutConstants.Fonts.Family.Body}`;
        ctx.textAlign = 'center';
        ctx.fillText('CHEST EARNED', centerX, y);

        // Chest image using ChestRenderer
        // Image is 294x262, so aspect ratio is approx 1.12:1
        const chestWidth = 100;
        const chestHeight = chestWidth / 1.12;
        const chestX = centerX - chestWidth / 2;
        const chestY = y + 10;

        // Map ChestType to renderer type
        let rendererType: 'bronze' | 'gold' | 'platinum' | 'diamond' = 'bronze';
        if (chestType === ChestType.RARE) rendererType = 'gold';
        else if (chestType === ChestType.EPIC) rendererType = 'platinum';
        else if (chestType === ChestType.LEGENDARY) rendererType = 'diamond';

        // Add glow
        ctx.shadowColor = ColorTokens.action.warning;
        ctx.shadowBlur = LayoutConstants.Shadows.Medium.blur - 5;

        ChestRenderer.drawChest(ctx, chestX, chestY, chestWidth, chestHeight, rendererType);

        ctx.shadowBlur = 0;

        // Chest name
        ctx.fillStyle = ColorTokens.action.warning;
        ctx.font = `bold 16px ${LayoutConstants.Fonts.Family.Heading}`;
        ctx.fillText(chestDef.name, centerX, y + 95);

        ctx.restore();
    }

    private renderButtons(ctx: CanvasRenderingContext2D) {
        for (const btn of this.resultButtons) {
            const isHovered = this.isButtonHovered(btn.id);
            const { x, y, width, height } = btn.rect;

            // Button background
            drawRoundedRect(ctx, x, y, width, height, 25);

            if (btn.primary) {
                const grad = ctx.createLinearGradient(x, y, x, y + height);
                grad.addColorStop(0, isHovered ? ColorTokens.action.success : '#00CC66');
                grad.addColorStop(1, isHovered ? '#00CC66' : '#009944');
                ctx.fillStyle = grad;
            } else {
                ctx.fillStyle = isHovered ? ColorTokens.border.subtle : ColorTokens.border.default;
            }
            ctx.fill();

            // Border
            ctx.strokeStyle = btn.primary ? ColorTokens.action.success : ColorTokens.effects.shine;
            ctx.lineWidth = LayoutConstants.Lines.Normal;
            ctx.stroke();

            // Label
            ctx.fillStyle = btn.primary ? ColorTokens.text.dark : ColorTokens.text.primary;
            ctx.font = `bold 18px ${LayoutConstants.Fonts.Family.Heading}`;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(btn.label, x + width / 2, y + height / 2);
        }
    }

    private easeOutBack(x: number): number {
        const c1 = 1.70158;
        const c3 = c1 + 1;
        return 1 + c3 * Math.pow(x - 1, 3) + c1 * Math.pow(x - 1, 2);
    }
}

