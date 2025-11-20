
import { UIScene } from '../SceneController';
import { uiStateMachine, UIState } from '../UIStateMachine';

export class LobbyScene implements UIScene {
    private buttons: any[] = [];
    private hoveredButton: any = null;
    private keyHandler: ((e: KeyboardEvent) => void) | null = null;

  constructor() {
    this.setupButtons();
    this.bindInput();
  }

  private setupButtons() {
    // Define logical button set; positions will be evenly distributed vertically.
    const baseButtons = [
      { id: 'resume', text: 'BACK TO TABLE' },
      { id: 'play', text: 'PLAY MODES' },
      { id: 'shop', text: 'SHOP' },
      { id: 'profile', text: 'PROFILE' },
    ];

    const count = baseButtons.length;
    const gap = 68; // vertical spacing between button centers
    const startY = -((count - 1) * gap) / 2;

    this.buttons = baseButtons.map((btn, index) => ({
      id: btn.id,
      text: btn.text,
      x: 0,
      y: startY + index * gap,
      width: 260,
      height: 52,
      color: '#FFD700', // accent color is applied via primary-style gradient
    }));
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
        const canvas = document.getElementById('ui-stage') as HTMLCanvasElement;
        canvas.addEventListener('mousemove', this.onMouseMove);
        canvas.addEventListener('click', this.onClick);

        this.keyHandler = (e: KeyboardEvent) => {
            if (e.key === 'Escape') {
                uiStateMachine.transitionTo(UIState.IN_GAME);
            }
        };
        window.addEventListener('keydown', this.keyHandler);
    }

    unmount(): void {
        console.log('LobbyScene unmounted');
        const canvas = document.getElementById('ui-stage') as HTMLCanvasElement;
        canvas.removeEventListener('mousemove', this.onMouseMove);
        canvas.removeEventListener('click', this.onClick);
        if (this.keyHandler) {
            window.removeEventListener('keydown', this.keyHandler);
            this.keyHandler = null;
        }
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
        switch (id) {
            case 'resume':
                uiStateMachine.transitionTo(UIState.IN_GAME);
                break;
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

        // Background - subtle deep navy gradient
        const bgGradient = ctx.createLinearGradient(0, 0, 0, height);
        bgGradient.addColorStop(0, '#000B1A');
        bgGradient.addColorStop(0.5, '#050B18');
        bgGradient.addColorStop(1, '#02040A');
        ctx.fillStyle = bgGradient;
        ctx.fillRect(0, 0, width, height);

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

        // Buttons (four stacked options, styled like primary CTA buttons)
        for (const btn of this.buttons) {
            const bx = cx + btn.x - btn.width / 2;
            const by = cy + btn.y - btn.height / 2;

            ctx.save();
            const btnRadius = 10;
            drawRoundedRect(bx, by, btn.width, btn.height, btnRadius);

            const baseGradient = ctx.createLinearGradient(bx, by, bx, by + btn.height);
            if (btn === this.hoveredButton) {
                // Hover: slightly brighter gold, similar to .btn-arcade-primary:hover
                baseGradient.addColorStop(0, '#FFE55C');
                baseGradient.addColorStop(1, '#DAA520');
            } else {
                // Default: primary gold gradient like the DONE button
                baseGradient.addColorStop(0, '#FFD700');
                baseGradient.addColorStop(1, '#B8860B');
            }
            ctx.fillStyle = baseGradient;
            ctx.fill();

            // Primary-style border
            ctx.strokeStyle = '#FFD700';
            ctx.lineWidth = 1.5;
            ctx.stroke();

            // Light shadow for depth
            ctx.shadowColor = 'rgba(0, 0, 0, 0.5)';
            ctx.shadowBlur = 6;

            // Button label
            ctx.fillStyle = '#000000';
            ctx.font = 'bold 16px Arial';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(btn.text, cx + btn.x, cy + btn.y);
            ctx.restore();
        }
    }
}
