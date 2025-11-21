
import { UIScene, sceneController, TransitionType } from '../SceneController';
import { uiStateMachine, UIState } from '../UIStateMachine';
import {
    drawGlossyButton,
    drawPanel,
    drawCurrencyPill,
    UIColors,
    Rect
} from '../components/UIComponents';
import { ColorTokens } from '../theme/ColorTokens';
import { GameMode } from '../../game/Game';
import { NavigationBar } from '../components/NavigationBar';
import { drawSceneBackground } from '../components/SceneBackground';

interface PlayModeButton {
    id: string;
    text: string;
    rect: Rect;
    color: string;
    action: () => void;
    icon?: string;
}

export class PlayModesScene implements UIScene {
    private buttons: PlayModeButton[] = [];
    private hoveredButton: PlayModeButton | null = null;
    private keyHandler: ((e: KeyboardEvent) => void) | null = null;
    private navigationBar: NavigationBar;

    constructor() {
        this.navigationBar = new NavigationBar({
            title: 'GAME MODES',
            showBack: true,
            backState: UIState.LOBBY,
            showProfile: true,
            showCurrencies: true,
            showSettings: true
        });
    }

    mount(): void {
        console.log('PlayModesScene mounted');
        const canvas = document.getElementById('ui-stage') as HTMLCanvasElement;
        canvas.addEventListener('mousemove', this.onMouseMove);
        canvas.addEventListener('click', this.onClick);
        window.addEventListener('resize', this.onResize);

        this.keyHandler = (e: KeyboardEvent) => {
            if (e.key === 'Escape') {
                uiStateMachine.transitionTo(UIState.LOBBY);
            }
        };
        window.addEventListener('keydown', this.keyHandler);

        this.setupLayout(canvas.width, canvas.height);
    }

    unmount(): void {
        console.log('PlayModesScene unmounted');
        const canvas = document.getElementById('ui-stage') as HTMLCanvasElement;
        canvas.removeEventListener('mousemove', this.onMouseMove);
        canvas.removeEventListener('click', this.onClick);
        window.removeEventListener('resize', this.onResize);

        if (this.keyHandler) {
            window.removeEventListener('keydown', this.keyHandler);
            this.keyHandler = null;
        }
    }

    private onResize = () => {
        const canvas = document.getElementById('ui-stage') as HTMLCanvasElement;
        this.setupLayout(canvas.width, canvas.height);
    }

    private setupLayout(width: number, height: number) {
        this.buttons = [];

        // Setup navigation bar
        this.navigationBar.setupLayout(width);
        const navHeight = this.navigationBar.getHeight();

        // Cards Layout
        const cardWidth = 220;
        const cardHeight = 300;
        const gap = 30;
        const modes = [
            { id: 'practice', title: 'PRACTICE', desc: 'Sharpen your skills', color: ColorTokens.action.success, icon: '🎯' },
            { id: '8ball', title: '8 BALL', desc: 'Classic Rules', color: ColorTokens.action.info, icon: '🎱' },
            { id: 'time-attack', title: 'TIME ATTACK', desc: 'Race against time', color: ColorTokens.action.warning, icon: '⏱️' },
        ];

        const totalWidth = modes.length * cardWidth + (modes.length - 1) * gap;
        let startX = (width - totalWidth) / 2;
        const availableHeight = height - navHeight - 40; // 40px for spacing
        const startY = navHeight + (availableHeight - cardHeight) / 2 + 20;

        modes.forEach((mode, index) => {
            const x = startX + index * (cardWidth + gap);

            // We will render the card background manually in render(), 
            // but we need a button for the "PLAY" action inside the card.

            // Card "Play" Button
            this.buttons.push({
                id: mode.id,
                text: 'PLAY',
                rect: {
                    x: x + 20,
                    y: startY + cardHeight - 70,
                    width: cardWidth - 40,
                    height: 50
                },
                color: mode.color,
                action: () => this.handleModeSelect(mode.id),
                icon: mode.icon // Pass icon to button if we want, or just use it for card header
            });
        });
    }

    private handleModeSelect(id: string) {
        const game = (window as any).poolGame;
        if (!game) return;

        switch (id) {
            case 'practice':
                game.mode = GameMode.PRACTICE;
                break;
            case '8ball':
                game.mode = GameMode.EIGHT_BALL;
                break;
            case 'time-attack':
                game.mode = GameMode.TIME_ATTACK;
                break;
        }
        game.restart();
        uiStateMachine.transitionTo(UIState.IN_GAME);
    }

    private onMouseMove = (e: MouseEvent) => {
        const canvas = document.getElementById('ui-stage') as HTMLCanvasElement;
        const rect = canvas.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;

        // Check navigation bar first
        if (this.navigationBar.handleMouseMove(x, y)) {
            this.hoveredButton = null;
            canvas.style.cursor = this.navigationBar.getCursor();
            return;
        }

        this.hoveredButton = null;
        for (const btn of this.buttons) {
            if (x >= btn.rect.x && x <= btn.rect.x + btn.rect.width &&
                y >= btn.rect.y && y <= btn.rect.y + btn.rect.height) {
                this.hoveredButton = btn;
                canvas.style.cursor = 'pointer';
                return;
            }
        }
        canvas.style.cursor = 'default';
    }

    private onClick = (e: MouseEvent) => {
        const canvas = document.getElementById('ui-stage') as HTMLCanvasElement;
        const rect = canvas.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;

        // Check navigation bar first
        if (this.navigationBar.handleClick(x, y)) {
            return;
        }

        if (this.hoveredButton) {
            this.hoveredButton.action();
        }
    }

    update(dt: number): void {
    }

    render(ctx: CanvasRenderingContext2D): void {
        const width = ctx.canvas.width;
        const height = ctx.canvas.height;

        // Background
        drawSceneBackground(ctx, width, height, 'purple');

        const navHeight = this.navigationBar.getHeight();

        // Render Cards (Static for now, matching buttons layout)
        const cardWidth = 220;
        const cardHeight = 300;
        const gap = 30;
        const modes = [
            { title: 'PRACTICE', desc: 'Sharpen your skills', icon: '🎯', price: 'Free' },
            { title: '8 BALL', desc: 'Classic Rules', icon: '🎱', price: '100' },
            { title: 'TIME ATTACK', desc: 'Race against time', icon: '⏱️', price: 'Free' },
        ];

        const totalWidth = modes.length * cardWidth + (modes.length - 1) * gap;
        let startX = (width - totalWidth) / 2;
        const availableHeight = height - navHeight - 40; // 40px for spacing
        const startY = navHeight + (availableHeight - cardHeight) / 2 + 20;

        modes.forEach((mode, index) => {
            const x = startX + index * (cardWidth + gap);

            // Card Background
            drawPanel(ctx, { x, y: startY, width: cardWidth, height: cardHeight });

            // Header Icon
            ctx.font = '48px Arial';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(mode.icon, x + cardWidth / 2, startY + 60);

            // Title
            ctx.fillStyle = ColorTokens.text.primary;
            ctx.font = 'bold 20px Arial';
            ctx.fillText(mode.title, x + cardWidth / 2, startY + 120);

            // Desc
            ctx.fillStyle = ColorTokens.text.secondary;
            ctx.font = '14px Arial';
            ctx.fillText(mode.desc, x + cardWidth / 2, startY + 150);

            // Price
            if (mode.price !== 'Free') {
                drawCurrencyPill(ctx, x + cardWidth / 2 - 50, startY + 180, parseInt(mode.price), 'coins');
            } else {
                ctx.fillStyle = ColorTokens.action.success;
                ctx.font = 'bold 16px Arial';
                ctx.fillText('FREE', x + cardWidth / 2, startY + 190);
            }
        });

        // Render Buttons (Play buttons only, back button handled by nav bar)
        for (const btn of this.buttons) {
            const isHovered = btn === this.hoveredButton;
            drawGlossyButton(ctx, btn.rect, btn.text, btn.color, isHovered);
        }

        // Render navigation bar on top
        this.navigationBar.render(ctx, width);
    }
}
