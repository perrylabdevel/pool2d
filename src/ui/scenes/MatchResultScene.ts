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
import { ChestRenderer } from '../components/ChestRenderer';

// ... (imports)

export class MatchResultScene implements UIScene {
    private canvas: HTMLCanvasElement | null = null;
    private buttons: ResultButton[] = [];
    private hoveredButton: ResultButton | null = null;
    private resultData: MatchResultData | null = null;
    private animationProgress: number = 0;

    mount(): void {
        this.canvas = document.getElementById('ui-stage') as HTMLCanvasElement;
        if (!this.canvas) return;

        // Get match result data
        this.resultData = (window as any).__lastMatchResult || null;

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
    }

    // ... (rest of methods)

    private renderChestSection(ctx: CanvasRenderingContext2D, centerX: number, y: number, progress: number) {
        if (!this.resultData?.chestAwarded) return;

        const chestType = this.resultData.chestAwarded as ChestType;
        const chestDef = CHEST_DEFINITIONS[chestType];
        if (!chestDef) return;

        ctx.save();
        ctx.globalAlpha = progress;

        // Chest label
        ctx.fillStyle = 'rgba(255, 255, 255, 0.6)';
        ctx.font = `14px ${LayoutConstants.Fonts.Family.Body}`;
        ctx.textAlign = 'center';
        ctx.fillText('CHEST EARNED', centerX, y);

        // Chest image using ChestRenderer
        const chestSize = 80;
        const chestX = centerX - chestSize / 2;
        const chestY = y + 10;

        // Map ChestType to renderer type
        let rendererType: 'bronze' | 'gold' | 'platinum' | 'diamond' = 'bronze';
        if (chestType === ChestType.RARE) rendererType = 'gold';
        else if (chestType === ChestType.EPIC) rendererType = 'platinum';
        else if (chestType === ChestType.LEGENDARY) rendererType = 'diamond';

        // Add glow
        ctx.shadowColor = ColorTokens.action.warning;
        ctx.shadowBlur = 20;

        ChestRenderer.drawChest(ctx, chestX, chestY, chestSize, rendererType);

        ctx.shadowBlur = 0;

        // Chest name
        ctx.fillStyle = ColorTokens.action.warning;
        ctx.font = `bold 18px ${LayoutConstants.Fonts.Family.Heading}`;
        ctx.fillText(chestDef.name, centerX, y + 110);

        ctx.restore();
    }
}

