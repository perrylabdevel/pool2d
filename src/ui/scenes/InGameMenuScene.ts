import { BaseScene, Button } from './BaseScene';
import { uiStateMachine, UIState } from '../UIStateMachine';
import { ColorTokens, SemanticColors } from '../theme/ColorTokens';
import { LayoutConstants } from '../theme/LayoutConstants';
import { drawGlossyButton } from '../components/UIComponents';

interface MenuButton extends Button {
    text: string;
    icon: string;
    color: string;
}

/**
 * InGameMenuScene - Pause menu overlay
 * Extends BaseScene for common mount/unmount/event handling
 */
export class InGameMenuScene extends BaseScene {
    private menuButtons: MenuButton[] = [];
    private keyHandler: ((e: KeyboardEvent) => void) | null = null;

    protected setupLayout(width: number, height: number): void {
        this.clearButtons();
        this.menuButtons = [];

        const buttonWidth = 280;
        const buttonHeight = 70;
        const gap = 20;
        const startX = (width - buttonWidth) / 2;
        const centerY = height / 2;
        const startY = centerY - (buttonHeight * 1.5 + gap);

        const resumeBtn: MenuButton = {
            id: 'resume',
            text: 'Resume Game',
            icon: '▶',
            color: ColorTokens.action.success,
            rect: { x: startX, y: startY, width: buttonWidth, height: buttonHeight },
            action: () => this.handleButtonClick('resume')
        };

        const settingsBtn: MenuButton = {
            id: 'settings',
            text: 'Settings',
            icon: '⚙',
            color: ColorTokens.action.info,
            rect: { x: startX, y: startY + buttonHeight + gap, width: buttonWidth, height: buttonHeight },
            action: () => this.handleButtonClick('settings')
        };

        const quitBtn: MenuButton = {
            id: 'quit',
            text: 'Quit to Menu',
            icon: '⏻',
            color: ColorTokens.action.danger,
            rect: { x: startX, y: startY + (buttonHeight + gap) * 2, width: buttonWidth, height: buttonHeight },
            action: () => this.handleButtonClick('quit')
        };

        this.menuButtons = [resumeBtn, settingsBtn, quitBtn];
        for (const btn of this.menuButtons) {
            this.registerButton(btn);
        }
    }

    protected onMount(): void {
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

    protected onUnmount(): void {
        if (this.keyHandler) {
            window.removeEventListener('keydown', this.keyHandler);
            this.keyHandler = null;
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

    update(_dt: number): void { }

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
        ctx.font = `bold ${LayoutConstants.Fonts.Size.Hero + 16}px ${LayoutConstants.Fonts.Family.Default}`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.shadowColor = ColorTokens.effects.shadow;
        ctx.shadowBlur = 8;
        ctx.fillText('GAME PAUSED', width / 2, height / 2 - 180);
        ctx.restore();
    }

    private renderButtons(ctx: CanvasRenderingContext2D) {
        for (const btn of this.menuButtons) {
            const isHovered = this.isButtonHovered(btn.id);
            drawGlossyButton(ctx, btn.rect, btn.text, btn.color, isHovered);
        }
    }

    private renderHint(ctx: CanvasRenderingContext2D, width: number, height: number) {
        ctx.save();
        ctx.fillStyle = ColorTokens.text.secondary;
        ctx.font = `${LayoutConstants.Fonts.Size.Small}px ${LayoutConstants.Fonts.Family.Default}`;
        ctx.textAlign = 'center';
        ctx.fillText('Press ESC to resume', width / 2, height / 2 + 180);
        ctx.restore();
    }
}
