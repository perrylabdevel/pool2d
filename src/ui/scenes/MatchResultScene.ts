/**
 * MatchResultScene - Post-game results screen
 * Shows win/loss, earnings, trophies, chest earned, and options to play again or return to lobby
 */

import { UIScene } from '../SceneController';
import { uiStateMachine, UIState } from '../UIStateMachine';
import { drawRoundedRect, Rect } from '../components/UIComponents';
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

interface ResultButton extends Rect {
    label: string;
    action: () => void;
    primary?: boolean;
}

export class MatchResultScene implements UIScene {
    private canvas: HTMLCanvasElement | null = null;
    private buttons: ResultButton[] = [];
    private hoveredButton: ResultButton | null = null;
    private resultData: MatchResultData | null = null;
    private animationProgress: number = 0;
    private animationStartTime: number = 0;

    mount(): void {
        this.canvas = document.getElementById('ui-stage') as HTMLCanvasElement;
        if (!this.canvas) return;

        // Get match result data
        this.resultData = (window as unknown as { __lastMatchResult?: MatchResultData }).__lastMatchResult || null;
        console.log('MatchResultScene mounted with data:', this.resultData);

        this.animationProgress = 0;
        this.animationStartTime = Date.now();
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
    }

    private setupLayout = () => {
        if (!this.canvas) return;
        const width = this.canvas.width;
        const height = this.canvas.height;
        const centerX = width / 2;

        const buttonWidth = 200;
        const buttonHeight = 50;
        const buttonGap = 20;
        const buttonY = height - 120;

        this.buttons = [
            {
                x: centerX - buttonWidth - buttonGap / 2,
                y: buttonY,
                width: buttonWidth,
                height: buttonHeight,
                label: 'LOBBY',
                action: () => uiStateMachine.transitionTo(UIState.LOBBY),
            },
            {
                x: centerX + buttonGap / 2,
                y: buttonY,
                width: buttonWidth,
                height: buttonHeight,
                label: 'PLAY AGAIN',
                primary: true,
                action: () => uiStateMachine.transitionTo(UIState.CLUB_SELECTION),
            },
        ];
    };

    private onResize = () => {
        this.setupLayout();
    };

    private onMouseMove = (e: MouseEvent) => {
        if (!this.canvas) return;
        const rect = this.canvas.getBoundingClientRect();
        const scaleX = this.canvas.width / rect.width;
        const scaleY = this.canvas.height / rect.height;
        const x = (e.clientX - rect.left) * scaleX;
        const y = (e.clientY - rect.top) * scaleY;

        this.hoveredButton = null;
        for (const btn of this.buttons) {
            if (x >= btn.x && x <= btn.x + btn.width &&
                y >= btn.y && y <= btn.y + btn.height) {
                this.hoveredButton = btn;
                break;
            }
        }
        this.canvas.style.cursor = this.hoveredButton ? 'pointer' : 'default';
    };

    private onClick = (e: MouseEvent) => {
        if (!this.canvas) return;
        const rect = this.canvas.getBoundingClientRect();
        const scaleX = this.canvas.width / rect.width;
        const scaleY = this.canvas.height / rect.height;
        const x = (e.clientX - rect.left) * scaleX;
        const y = (e.clientY - rect.top) * scaleY;

        for (const btn of this.buttons) {
            if (x >= btn.x && x <= btn.x + btn.width &&
                y >= btn.y && y <= btn.y + btn.height) {
                btn.action();
                return;
            }
        }
    };

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
        const chestSize = 70;
        const chestX = centerX - chestSize / 2;
        const chestY = y + 10;

        // Map ChestType to renderer type
        let rendererType: 'bronze' | 'gold' | 'platinum' | 'diamond' = 'bronze';
        if (chestType === ChestType.RARE) rendererType = 'gold';
        else if (chestType === ChestType.EPIC) rendererType = 'platinum';
        else if (chestType === ChestType.LEGENDARY) rendererType = 'diamond';

        // Add glow
        ctx.shadowColor = ColorTokens.action.warning;
        ctx.shadowBlur = LayoutConstants.Shadows.Medium.blur - 5;

        ChestRenderer.drawChest(ctx, chestX, chestY, chestSize, rendererType);

        ctx.shadowBlur = 0;

        // Chest name
        ctx.fillStyle = ColorTokens.action.warning;
        ctx.font = `bold 16px ${LayoutConstants.Fonts.Family.Heading}`;
        ctx.fillText(chestDef.name, centerX, y + 95);

        ctx.restore();
    }

    private renderButtons(ctx: CanvasRenderingContext2D) {
        for (const btn of this.buttons) {
            const isHovered = this.hoveredButton === btn;
            
            // Button background
            drawRoundedRect(ctx, btn.x, btn.y, btn.width, btn.height, 25);
            
            if (btn.primary) {
                const grad = ctx.createLinearGradient(btn.x, btn.y, btn.x, btn.y + btn.height);
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
            ctx.fillText(btn.label, btn.x + btn.width / 2, btn.y + btn.height / 2);
        }
    }

    private easeOutBack(x: number): number {
        const c1 = 1.70158;
        const c3 = c1 + 1;
        return 1 + c3 * Math.pow(x - 1, 3) + c1 * Math.pow(x - 1, 2);
    }
}

