
import { UIScene } from '../SceneController';
import { uiStateMachine, UIState } from '../UIStateMachine';

export class PlayModesScene implements UIScene {
    private buttons: any[] = [];
    private hoveredButton: any = null;

    constructor() {
        this.setupButtons();
    }

    private setupButtons() {
        this.buttons = [
            { id: 'practice', text: 'PRACTICE', x: -150, y: 0, width: 140, height: 100, color: '#FFD700' },
            { id: '8ball', text: '8 BALL', x: 0, y: 0, width: 140, height: 100, color: '#2196F3' },
            { id: 'time-attack', text: 'TIME ATTACK', x: 150, y: 0, width: 140, height: 100, color: '#4CAF50' },
            { id: 'back', text: 'BACK', x: 0, y: 150, width: 120, height: 40, color: '#9E9E9E' }
        ];
    }

    mount(): void {
        console.log('PlayModesScene mounted');
        const canvas = document.getElementById('ui-stage') as HTMLCanvasElement;
        canvas.addEventListener('mousemove', this.onMouseMove);
        canvas.addEventListener('click', this.onClick);
    }

    unmount(): void {
        console.log('PlayModesScene unmounted');
        const canvas = document.getElementById('ui-stage') as HTMLCanvasElement;
        canvas.removeEventListener('mousemove', this.onMouseMove);
        canvas.removeEventListener('click', this.onClick);
    }

    private onMouseMove = (e: MouseEvent) => {
        const canvas = document.getElementById('ui-stage') as HTMLCanvasElement;
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

    private onClick = (e: MouseEvent) => {
        if (this.hoveredButton) {
            this.handleButtonClick(this.hoveredButton.id);
        }
    }

    private handleButtonClick(id: string) {
        const game = (window as any).poolGame;

        switch (id) {
            case 'back':
                uiStateMachine.transitionTo(UIState.LOBBY);
                break;
            case 'practice':
                if (game) {
                    game.mode = 0; // PRACTICE
                    game.restart();
                }
                uiStateMachine.transitionTo(UIState.IN_GAME);
                break;
            case '8ball':
                if (game) {
                    game.mode = 1; // EIGHT_BALL
                    game.restart();
                }
                uiStateMachine.transitionTo(UIState.IN_GAME);
                break;
            case 'time-attack':
                if (game) {
                    game.mode = 2; // TIME_ATTACK
                    game.restart();
                }
                uiStateMachine.transitionTo(UIState.IN_GAME);
                break;
        }
    }

    update(dt: number): void {
    }

    render(ctx: CanvasRenderingContext2D): void {
        const width = ctx.canvas.width;
        const height = ctx.canvas.height;
        const cx = width / 2;
        const cy = height / 2;

        // Background
        ctx.fillStyle = 'rgba(0, 0, 0, 0.9)';
        ctx.fillRect(0, 0, width, height);

        // Title
        ctx.fillStyle = '#FFFFFF';
        ctx.font = 'bold 36px Arial';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('SELECT MODE', cx, cy - 150);

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
            ctx.font = 'bold 16px Arial';
            ctx.fillText(btn.text, cx + btn.x, cy + btn.y);
        }
    }
}
