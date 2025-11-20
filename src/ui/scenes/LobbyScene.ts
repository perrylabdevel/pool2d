
import { UIScene } from '../SceneController';
import { uiStateMachine, UIState } from '../UIStateMachine';

export class LobbyScene implements UIScene {
    private buttons: any[] = [];
    private hoveredButton: any = null;

    constructor() {
        this.setupButtons();
        this.bindInput();
    }

    private setupButtons() {
        // Define buttons relative to screen center or fixed positions
        // For now, simple center layout
        this.buttons = [
            { id: 'play', text: 'PLAY', x: 0, y: -50, width: 200, height: 60, color: '#FFD700' },
            { id: 'shop', text: 'SHOP', x: 0, y: 30, width: 200, height: 50, color: '#4CAF50' },
            { id: 'profile', text: 'PROFILE', x: 0, y: 100, width: 200, height: 50, color: '#2196F3' }
        ];
    }

    private bindInput() {
        // We need to listen to pointer events on the canvas
        // This should probably be handled centrally, but for now let's add listeners here
        // and remove them on unmount.
        // Actually, SceneController or UIRoot should probably delegate events.
        // For simplicity, I'll add listeners to the canvas element directly in mount/unmount.
    }

    mount(): void {
        console.log('LobbyScene mounted');
        const canvas = document.getElementById('ui-canvas') as HTMLCanvasElement;
        canvas.addEventListener('mousemove', this.onMouseMove);
        canvas.addEventListener('click', this.onClick);
    }

    unmount(): void {
        console.log('LobbyScene unmounted');
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

    private onClick = (e: MouseEvent) => {
        if (this.hoveredButton) {
            this.handleButtonClick(this.hoveredButton.id);
        }
    }

    private handleButtonClick(id: string) {
        switch (id) {
            case 'play':
                uiStateMachine.transitionTo(UIState.PLAY_MODES);
                break;
            case 'shop':
                uiStateMachine.transitionTo(UIState.SHOP);
                break;
            case 'profile':
                uiStateMachine.transitionTo(UIState.PROFILE);
                break;
        }
    }

    update(dt: number): void {
        // Animation updates
    }

    render(ctx: CanvasRenderingContext2D): void {
        const width = ctx.canvas.width;
        const height = ctx.canvas.height;
        const cx = width / 2;
        const cy = height / 2;

        // Background
        ctx.fillStyle = 'rgba(0, 0, 0, 0.8)';
        ctx.fillRect(0, 0, width, height);

        // Title
        ctx.fillStyle = '#FFFFFF';
        ctx.font = 'bold 48px Arial';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('RAIL RUSH', cx, cy - 150);

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
