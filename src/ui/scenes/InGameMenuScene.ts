
import { UIScene } from '../SceneController';
import { uiStateMachine, UIState } from '../UIStateMachine';
import { ColorTokens, SemanticColors } from '../theme/ColorTokens';
import { drawGlossyButton, drawRoundedRect, Rect } from '../components/UIComponents';

interface MenuButton {
    id: 'resume' | 'settings' | 'quit';
    text: string;
    icon: string;
    color: string;
    rect: Rect;
}

export class InGameMenuScene implements UIScene {
    private canvas: HTMLCanvasElement | null = null;
    private buttons: MenuButton[] = [];
    private hoveredButton: MenuButton | null = null;
    private keyHandler: ((e: KeyboardEvent) => void) | null = null;

    private setupButtons(width: number, height: number) {
        const buttonWidth = 280;
        const buttonHeight = 70;
        const gap = 20;
        const startX = (width - buttonWidth) / 2;
        const centerY = height / 2;
        const startY = centerY - (buttonHeight * 1.5 + gap);

        this.buttons = [
            {
                id: 'resume',
                text: 'Resume Game',
                icon: '▶',
                color: ColorTokens.action.success,
                rect: { x: startX, y: startY, width: buttonWidth, height: buttonHeight }
            },
            {
                id: 'settings',
                text: 'Settings',
                icon: '⚙',
                color: ColorTokens.action.info,
                rect: { x: startX, y: startY + buttonHeight + gap, width: buttonWidth, height: buttonHeight }
            },
            {
                id: 'quit',
                text: 'Quit to Menu',
                icon: '⏻',
                color: ColorTokens.action.danger,
                rect: { x: startX, y: startY + (buttonHeight + gap) * 2, width: buttonWidth, height: buttonHeight }
            }
        ];
    }

    mount(): void {
        this.canvas = document.getElementById('ui-stage') as HTMLCanvasElement;
        if (!this.canvas) return;

        this.setupButtons(this.canvas.width, this.canvas.height);
        this.canvas.addEventListener('mousemove', this.onMouseMove);
        this.canvas.addEventListener('click', this.onClick);
        window.addEventListener('resize', this.onResize);

        // ESC key to resume game
        this.keyHandler = (e: KeyboardEvent) => {
            if (e.key === 'Escape') {
                this.handleButtonClick('resume');
            }
        };
        window.addEventListener('keydown', this.keyHandler);

        // Pause game logic if not already paused
        window.dispatchEvent(new CustomEvent('game:pause'));
    }

    unmount(): void {
        if (!this.canvas) return;
        this.canvas.removeEventListener('mousemove', this.onMouseMove);
        this.canvas.removeEventListener('click', this.onClick);
        window.removeEventListener('resize', this.onResize);

        if (this.keyHandler) {
            window.removeEventListener('keydown', this.keyHandler);
            this.keyHandler = null;
        }

        this.canvas.style.cursor = 'default';
        this.canvas = null;
    }

    private onResize = () => {
        if (!this.canvas) return;
        this.setupButtons(this.canvas.width, this.canvas.height);
    };

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
                this.canvas.style.cursor = 'pointer';
                return;
            }
        }
        this.canvas.style.cursor = 'default';
    }

    private onClick = (_e: MouseEvent) => {
        if (this.hoveredButton) {
            this.handleButtonClick(this.hoveredButton.id);
        }
    }

    private handleButtonClick(id: string) {
        switch (id) {
            case 'resume':
                window.dispatchEvent(new CustomEvent('game:resume'));
                uiStateMachine.transitionTo(UIState.IN_GAME);
                break;
            case 'settings':
                // Store return state so SettingsScene knows where to go back
                (window as any).__settingsReturnState = UIState.IN_GAME_MENU;
                uiStateMachine.transitionTo(UIState.SETTINGS);
                break;
            case 'quit':
                window.dispatchEvent(new CustomEvent('game:resume')); // Resume to clean up state
                uiStateMachine.transitionTo(UIState.LOBBY);
                break;
        }
    }

    update(_dt: number): void {
    }

    render(ctx: CanvasRenderingContext2D): void {
        const width = ctx.canvas.width;
        const height = ctx.canvas.height;

        this.renderBackground(ctx, width, height);
        this.renderTitle(ctx, width, height);
        this.renderButtons(ctx);
        this.renderHint(ctx, width, height);
    }

    private renderBackground(ctx: CanvasRenderingContext2D, width: number, height: number) {
        // Same gradient as LobbyScene
        const gradient = ctx.createLinearGradient(0, 0, 0, height);
        gradient.addColorStop(0, SemanticColors.gradient.start);
        gradient.addColorStop(1, SemanticColors.gradient.end);
        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, width, height);

        // Semi-transparent overlay to dim game view
        ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
        ctx.fillRect(0, 0, width, height);
    }

    private renderTitle(ctx: CanvasRenderingContext2D, width: number, height: number) {
        ctx.save();
        ctx.fillStyle = ColorTokens.text.primary;
        ctx.font = 'bold 56px Arial';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.shadowColor = ColorTokens.effects.shadow;
        ctx.shadowBlur = 8;
        ctx.fillText('GAME PAUSED', width / 2, height / 2 - 180);
        ctx.restore();
    }

    private renderButtons(ctx: CanvasRenderingContext2D) {
        for (const btn of this.buttons) {
            const isHovered = btn === this.hoveredButton;
            drawGlossyButton(ctx, btn.rect, btn.text, btn.color, isHovered);
        }
    }

    private renderHint(ctx: CanvasRenderingContext2D, width: number, height: number) {
        ctx.save();
        ctx.fillStyle = ColorTokens.text.secondary;
        ctx.font = '14px Arial';
        ctx.textAlign = 'center';
        ctx.fillText('Press ESC to resume', width / 2, height / 2 + 180);
        ctx.restore();
    }
}
