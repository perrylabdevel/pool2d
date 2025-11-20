
import { UIScene } from '../SceneController';
import { uiStateMachine, UIState } from '../UIStateMachine';

export class InGameMenuScene implements UIScene {
    private buttons: any[] = [];
    private hoveredButton: any = null;

    constructor() {
        this.setupButtons();
    }

    private setupButtons() {
        this.buttons = [
            { id: 'resume', text: 'RESUME', x: 0, y: -50, width: 200, height: 50, color: '#4CAF50' },
            { id: 'settings', text: 'SETTINGS', x: 0, y: 20, width: 200, height: 50, color: '#2196F3' },
            { id: 'quit', text: 'QUIT TO MENU', x: 0, y: 90, width: 200, height: 50, color: '#F44336' }
        ];
    }

    mount(): void {
        console.log('InGameMenuScene mounted');
        const canvas = document.getElementById('ui-canvas') as HTMLCanvasElement;
        canvas.addEventListener('mousemove', this.onMouseMove);
        canvas.addEventListener('click', this.onClick);

        // Pause game logic if not already paused
        window.dispatchEvent(new CustomEvent('game:pause'));
    }

    unmount(): void {
        console.log('InGameMenuScene unmounted');
        const canvas = document.getElementById('ui-canvas') as HTMLCanvasElement;
        canvas.removeEventListener('mousemove', this.onMouseMove);
        canvas.removeEventListener('click', this.onClick);
    }

    private onMouseMove = (e: MouseEvent) => {
        const canvas = document.getElementById('ui-canvas') as HTMLCanvasElement;
        const rect = canvas.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;

        const cx = canvas.width / 2;
        const cy = canvas.height / 2;

        this.hoveredButton = null;
        for (const btn of this.buttons) {
            const bx = cx + btn.x - btn.width / 2;
            const by = cy + btn.y - btn.height / 2;

            if (x >= bx && x <= bx + btn.width && y >= by && y <= by + btn.height) {
                this.hoveredButton = btn;
                canvas.style.cursor = 'pointer';
                return;
            }
        }
        canvas.style.cursor = 'default';
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
                const game = (window as any).poolGame;
                if (game && game.hud) {
                    console.log('Open Settings requested');
                    // Trigger settings panel via event or direct access if possible
                    // For now, we just log as the settings panel is DOM based and might need a separate trigger
                    // or we can try to find the settings button and click it programmatically
                    const settingsBtn = document.getElementById('settings-btn');
                    if (settingsBtn) settingsBtn.click();
                }
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
        const cx = width / 2;
        const cy = height / 2;

        // Semi-transparent background
        ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
        ctx.fillRect(0, 0, width, height);

        // Title
        ctx.fillStyle = '#FFFFFF';
        ctx.font = 'bold 48px Arial';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('PAUSED', cx, cy - 150);

        // Buttons
        for (const btn of this.buttons) {
            const bx = cx + btn.x - btn.width / 2;
            const by = cy + btn.y - btn.height / 2;

            ctx.fillStyle = btn === this.hoveredButton ? '#FFFFFF' : btn.color;
            ctx.fillRect(bx, by, btn.width, btn.height);

            ctx.strokeStyle = '#000000';
            ctx.lineWidth = 2;
            ctx.strokeRect(bx, by, btn.width, btn.height);

            ctx.fillStyle = btn === this.hoveredButton ? btn.color : '#000000';
            ctx.font = 'bold 20px Arial';
            ctx.fillText(btn.text, cx + btn.x, cy + btn.y);
        }
    }
}
