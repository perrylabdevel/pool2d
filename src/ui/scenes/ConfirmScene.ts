import { BaseScene, Button } from './BaseScene';
import { uiStateMachine, UIState } from '../UIStateMachine';
import { drawGlossyButton, drawPanel, UIColors } from '../components/UIComponents';
import { ColorTokens, SemanticColors } from '../theme/ColorTokens';
import { LayoutConstants } from '../theme/LayoutConstants';

interface ConfirmButton extends Button {
    label: string;
    color: string;
}

/**
 * ConfirmScene - Modal confirmation dialog
 * Extends BaseScene for common mount/unmount/event handling
 */
export class ConfirmScene extends BaseScene {
    private confirmButtons: ConfirmButton[] = [];

    // Configuration
    private title: string = 'Confirm Action?';
    private message: string = 'Are you sure?';
    private confirmLabel: string = 'Confirm';
    private cancelLabel: string = 'Cancel';
    private returnState: UIState = UIState.LOBBY;
    private onConfirmCallback: (() => void) | null = null;

    protected setupLayout(width: number, height: number): void {
        this.clearButtons();
        this.confirmButtons = [];

        const buttonWidth = 140;
        const buttonHeight = 50;
        const gap = 20;
        const totalWidth = buttonWidth * 2 + gap;
        const startX = (width - totalWidth) / 2;
        const startY = height / 2 + 40;

        const cancelBtn: ConfirmButton = {
            id: 'cancel',
            label: this.cancelLabel,
            color: UIColors.danger,
            rect: { x: startX, y: startY, width: buttonWidth, height: buttonHeight },
            action: () => uiStateMachine.transitionTo(this.returnState)
        };

        const confirmBtn: ConfirmButton = {
            id: 'confirm',
            label: this.confirmLabel,
            color: UIColors.secondary,
            rect: { x: startX + buttonWidth + gap, y: startY, width: buttonWidth, height: buttonHeight },
            action: () => {
                if (this.onConfirmCallback) {
                    this.onConfirmCallback();
                }
            }
        };

        this.confirmButtons = [cancelBtn, confirmBtn];
        this.registerButton(cancelBtn);
        this.registerButton(confirmBtn);
    }

    update(_dt: number): void { }

    render(ctx: CanvasRenderingContext2D): void {
        const width = ctx.canvas.width;
        const height = ctx.canvas.height;
        this.renderBackground(ctx, width, height);
        this.renderModal(ctx, width, height);
    }

    private renderBackground(ctx: CanvasRenderingContext2D, width: number, height: number) {
        // Same background gradient as LobbyScene
        const gradient = ctx.createLinearGradient(0, 0, 0, height);
        gradient.addColorStop(0, SemanticColors.gradient.start);
        gradient.addColorStop(1, SemanticColors.gradient.end);
        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, width, height);

        // Dim overlay
        ctx.fillStyle = ColorTokens.effects.shadow;
        ctx.fillRect(0, 0, width, height);
    }

    private renderModal(ctx: CanvasRenderingContext2D, width: number, height: number) {
        ctx.save();

        // Modal panel
        const panelWidth = 400;
        const panelHeight = 200;
        const panelX = (width - panelWidth) / 2;
        const panelY = (height - panelHeight) / 2;

        drawPanel(ctx, { x: panelX, y: panelY, width: panelWidth, height: panelHeight });

        // Title
        ctx.fillStyle = ColorTokens.text.primary;
        ctx.font = `bold ${LayoutConstants.Fonts.Size.XLarge}px ${LayoutConstants.Fonts.Family.Default}`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(this.title, width / 2, panelY + 50);

        // Message
        ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
        ctx.font = `${LayoutConstants.Fonts.Size.Medium}px ${LayoutConstants.Fonts.Family.Default}`;
        ctx.fillText(this.message, width / 2, panelY + 85);

        // Buttons
        for (const btn of this.confirmButtons) {
            const isHovered = this.isButtonHovered(btn.id);
            drawGlossyButton(ctx, btn.rect, btn.label, btn.color, isHovered);
        }

        ctx.restore();
    }

    // Public API to configure the confirmation
    public configure(options: {
        title?: string;
        message?: string;
        confirmLabel?: string;
        cancelLabel?: string;
        returnState?: UIState;
        onConfirm?: () => void;
    }) {
        if (options.title !== undefined) this.title = options.title;
        if (options.message !== undefined) this.message = options.message;
        if (options.confirmLabel !== undefined) this.confirmLabel = options.confirmLabel;
        if (options.cancelLabel !== undefined) this.cancelLabel = options.cancelLabel;
        if (options.returnState !== undefined) this.returnState = options.returnState;
        if (options.onConfirm !== undefined) this.onConfirmCallback = options.onConfirm;

        // Update button labels
        if (this.canvas) {
            this.onResize(this.canvas.width, this.canvas.height);
        }
    }
}
