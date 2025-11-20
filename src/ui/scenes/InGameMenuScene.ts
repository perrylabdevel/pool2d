
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
        const canvas = document.getElementById('ui-stage') as HTMLCanvasElement;
        canvas.addEventListener('mousemove', this.onMouseMove);
        canvas.addEventListener('click', this.onClick);

        // Pause game logic if not already paused
        window.dispatchEvent(new CustomEvent('game:pause'));
    }

    unmount(): void {
        console.log('InGameMenuScene unmounted');
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

        // Background - deep navy gradient similar to lobby
        const bgGradient = ctx.createLinearGradient(0, 0, 0, height);
        bgGradient.addColorStop(0, '#000B1A');
        bgGradient.addColorStop(0.5, '#050B18');
        bgGradient.addColorStop(1, '#02040A');
        ctx.fillStyle = bgGradient;
        ctx.fillRect(0, 0, width, height);

        // Title
        ctx.save();
        ctx.fillStyle = '#FFFFFF';
        ctx.font = 'bold 48px Arial';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.shadowColor = 'rgba(0, 180, 255, 0.7)';
        ctx.shadowBlur = 16;
        ctx.fillText('PAUSED', cx, cy - 170);
        ctx.shadowBlur = 0;
        ctx.restore();

        // Central card panel
        const panelWidth = 420;
        const panelHeight = 260;
        const panelX = cx - panelWidth / 2;
        const panelY = cy - panelHeight / 2 - 10;
        const panelRadius = 16;

        const cardGradient = ctx.createLinearGradient(0, panelY, 0, panelY + panelHeight);
        cardGradient.addColorStop(0, 'rgba(255,255,255,0.06)');
        cardGradient.addColorStop(1, 'rgba(13,20,36,0.75)');

        const drawRoundedRect = (x: number, y: number, w: number, h: number, r: number) => {
            ctx.beginPath();
            ctx.moveTo(x + r, y);
            ctx.lineTo(x + w - r, y);
            ctx.quadraticCurveTo(x + w, y, x + w, y + r);
            ctx.lineTo(x + w, y + h - r);
            ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
            ctx.lineTo(x + r, y + h);
            ctx.quadraticCurveTo(x, y + h, x, y + h - r);
            ctx.lineTo(x, y + r);
            ctx.quadraticCurveTo(x, y, x + r, y);
            ctx.closePath();
        };

        ctx.save();
        drawRoundedRect(panelX, panelY, panelWidth, panelHeight, panelRadius);
        ctx.fillStyle = cardGradient;
        ctx.fill();
        ctx.strokeStyle = 'rgba(255,255,255,0.25)';
        ctx.lineWidth = 1.5;
        ctx.stroke();
        ctx.restore();

        // Buttons
        for (const btn of this.buttons) {
            const bx = cx + btn.x - btn.width / 2;
            const by = cy + btn.y - btn.height / 2;

            ctx.save();
            const btnRadius = 10;
            drawRoundedRect(bx, by, btn.width, btn.height, btnRadius);

            const baseGradient = ctx.createLinearGradient(bx, by, bx, by + btn.height);
            if (btn === this.hoveredButton) {
                baseGradient.addColorStop(0, 'rgba(255,255,255,0.25)');
                baseGradient.addColorStop(1, 'rgba(255,255,255,0.10)');
            } else {
                baseGradient.addColorStop(0, 'rgba(255,255,255,0.18)');
                baseGradient.addColorStop(1, 'rgba(255,255,255,0.06)');
            }
            ctx.fillStyle = baseGradient;
            ctx.fill();

            ctx.strokeStyle = btn.color;
            ctx.lineWidth = btn === this.hoveredButton ? 2.5 : 2;
            ctx.stroke();

            ctx.fillStyle = '#000000';
            ctx.font = 'bold 18px Arial';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(btn.text, cx + btn.x, cy + btn.y);
            ctx.restore();
        }
    }
}
