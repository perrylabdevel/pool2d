
import { UIScene } from '../SceneController';
import { uiStateMachine, UIState } from '../UIStateMachine';

export class ShopScene implements UIScene {
    private buttons: any[] = [];
    private hoveredButton: any = null;

    constructor() {
        this.setupButtons();
    }

    private setupButtons() {
        this.buttons = [
            { id: 'back', text: 'BACK', x: 0, y: 150, width: 120, height: 40, color: '#9E9E9E' }
        ];
    }

    mount(): void {
        console.log('ShopScene mounted');
        const canvas = document.getElementById('ui-canvas') as HTMLCanvasElement;
        canvas.addEventListener('mousemove', this.onMouseMove);
        canvas.addEventListener('click', this.onClick);
    }

    unmount(): void {
        console.log('ShopScene unmounted');
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
            case 'back':
                uiStateMachine.transitionTo(UIState.LOBBY);
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
        ctx.fillText('SHOP', cx, cy - 50);

        ctx.font = '20px Arial';
        ctx.fillText('Coming Soon', cx, cy);

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
