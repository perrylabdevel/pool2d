import { UIScene } from '../SceneController';
import { uiStateMachine, UIState } from '../UIStateMachine';
import { drawGlossyButton, drawPanel, Rect, UIColors } from '../components/UIComponents';
import { ColorTokens, SemanticColors } from '../theme/ColorTokens';
import { LayoutConstants } from '../theme/LayoutConstants';

type ConfirmButton = {
    id: 'confirm' | 'cancel';
    label: string;
    color: string;
    rect: Rect;
};

export class ConfirmScene implements UIScene {
    private canvas: HTMLCanvasElement | null = null;
    private buttons: ConfirmButton[] = [];
    private hoveredButton: ConfirmButton | null = null;

    // Configuration
    private title: string = 'Confirm Action?';
    private message: string = 'Are you sure?';
    private confirmLabel: string = 'Confirm';
    private cancelLabel: string = 'Cancel';
    private returnState: UIState = UIState.LOBBY;
    private onConfirm: (() => void) | null = null;

    mount(): void {
        this.canvas = document.getElementById('ui-stage') as HTMLCanvasElement;
        if (!this.canvas) return;
        this.onResize(this.canvas.width, this.canvas.height);
        this.canvas.addEventListener('mousemove', this.onMouseMove);
        this.canvas.addEventListener('click', this.onClick);
    }

    unmount(): void {
        if (!this.canvas) return;
        this.canvas.removeEventListener('mousemove', this.onMouseMove);
        this.canvas.removeEventListener('click', this.onClick);

        this.canvas.style.cursor = 'default';
    }

    public onResize(width: number, height: number) {
        if (!this.canvas) return;

        const buttonWidth = 140;
        const buttonHeight = 50;
        const gap = 20;
        const totalWidth = buttonWidth * 2 + gap;
        const startX = (width - totalWidth) / 2;
        const startY = height / 2 + 40;

        this.buttons = [
            {
                id: 'cancel',
                label: this.cancelLabel,
                color: UIColors.danger,
                rect: { x: startX, y: startY, width: buttonWidth, height: buttonHeight }
            },
            {
                id: 'confirm',
                label: this.confirmLabel,
                color: UIColors.secondary,
                rect: { x: startX + buttonWidth + gap, y: startY, width: buttonWidth, height: buttonHeight }
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
            const { x: bx, y: by, width, height } = btn.rect;
            if (x >= bx && x <= bx + width && y >= by && y <= by + height) {
                this.hoveredButton = btn;
                break;
            }
        }
        this.canvas.style.cursor = this.hoveredButton ? 'pointer' : 'default';
    };

    private onClick = () => {
        if (!this.hoveredButton) return;

        if (this.hoveredButton.id === 'confirm') {
            if (this.onConfirm) {
                this.onConfirm();
            }
            // Don't transition here - let the onConfirm callback handle it
        } else {
            // Cancel - return to previous scene
            uiStateMachine.transitionTo(this.returnState);
        }
    };

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
        ctx.fillStyle = 'rgba(255, 255, 255, 0.8)'; // Slightly transparent white for subtitle
        ctx.font = `${LayoutConstants.Fonts.Size.Medium}px ${LayoutConstants.Fonts.Family.Default}`;
        ctx.fillText(this.message, width / 2, panelY + 85);

        // Buttons
        for (const btn of this.buttons) {
            const isHovered = btn === this.hoveredButton;
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
        if (options.onConfirm !== undefined) this.onConfirm = options.onConfirm;

        // Update button labels
        if (this.canvas) {
            this.onResize(this.canvas.width, this.canvas.height);
        }
    }
}
