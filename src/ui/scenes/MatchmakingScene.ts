import { UIScene } from '../SceneController';
import { uiStateMachine, UIState } from '../UIStateMachine';
import { drawRoundedRect } from '../components/UIComponents';
import { ColorTokens } from '../theme/ColorTokens';
import { LayoutConstants } from '../theme/LayoutConstants';
import { drawSceneBackground } from '../components/SceneBackground';
import { AssetRegistry } from '../../assets/AssetRegistry';
import { AssetLoader } from '../../assets/AssetLoader';
import { db } from '../../data/db';

export class MatchmakingScene implements UIScene {
    private canvas: HTMLCanvasElement | null = null;
    private userAvatar: HTMLImageElement | null = null;

    private searchTime: number = 0;
    private minSearchTime: number = 2.5; // Seconds to show the screen
    private dots: string = '';
    private dotTimer: number = 0;

    constructor() { }

    async mount(): Promise<void> {
        this.canvas = document.getElementById('ui-stage') as HTMLCanvasElement;
        this.searchTime = 0;
        this.dots = '';
        this.dotTimer = 0;

        await this.loadUserData();

        window.addEventListener('resize', this.onResize);
    }

    unmount(): void {
        window.removeEventListener('resize', this.onResize);
        this.canvas = null;
    }

    private async loadUserData() {
        try {
            await db.user.get(1);
            // In a real app we'd load the specific avatar, for now use default or player
            // If we had the avatar ID we'd use it.
            // For now, let's just assume a default player avatar for the user
            this.userAvatar = AssetLoader.loadImageSync(AssetRegistry.avatars.player());
        } catch (e) {
            console.error('Failed to load user data', e);
        }
    }

    private onResize = () => {
        // Handle resize if needed
    };

    update(dt: number): void {
        this.searchTime += dt;
        this.dotTimer += dt;

        if (this.dotTimer > 0.5) {
            this.dotTimer = 0;
            this.dots = this.dots.length >= 3 ? '' : this.dots + '.';
        }

        if (this.searchTime >= this.minSearchTime) {
            uiStateMachine.transitionTo(UIState.OPPONENT_PREVIEW);
        }
    }

    render(ctx: CanvasRenderingContext2D): void {
        if (!this.canvas) return;
        const width = this.canvas.width;
        const height = this.canvas.height;
        const centerX = width / 2;
        const centerY = height / 2;

        drawSceneBackground(ctx, width, height, 'blue');

        // Draw "Searching" container
        const cardWidth = Math.min(600, width * 0.9);
        const cardHeight = 300;
        const cardX = centerX - cardWidth / 2;
        const cardY = centerY - cardHeight / 2;

        // Card Background
        ctx.save();
        ctx.shadowColor = ColorTokens.effects.shadow;
        ctx.shadowBlur = 30;
        ctx.shadowOffsetY = 10;
        drawRoundedRect(ctx, cardX, cardY, cardWidth, cardHeight, LayoutConstants.Radii.Large);
        const grad = ctx.createLinearGradient(cardX, cardY, cardX, cardY + cardHeight);
        grad.addColorStop(0, ColorTokens.background.panelSolid);
        grad.addColorStop(1, ColorTokens.background.panel);
        ctx.fillStyle = grad;
        ctx.fill();
        ctx.restore();

        // Border
        drawRoundedRect(ctx, cardX, cardY, cardWidth, cardHeight, LayoutConstants.Radii.Large);
        ctx.strokeStyle = ColorTokens.border.subtle;
        ctx.lineWidth = 2;
        ctx.stroke();

        // Title
        ctx.fillStyle = ColorTokens.text.primary;
        ctx.font = `bold 32px ${LayoutConstants.Fonts.Family.Display}`;
        ctx.textAlign = 'center';
        ctx.fillText(`SEARCHING FOR OPPONENT${this.dots}`, centerX, cardY + 60);

        // User Avatar (Left Side)
        const avatarSize = 100;
        const userX = centerX - 120;
        const avatarY = centerY + 10;

        this.renderAvatar(ctx, this.userAvatar, userX, avatarY, avatarSize, 'YOU');

        // VS / Loading Icon (Center)
        ctx.fillStyle = ColorTokens.text.muted;
        ctx.font = `bold 24px ${LayoutConstants.Fonts.Family.Body}`;
        ctx.fillText('VS', centerX, avatarY + 10);

        // Spinner / Question Mark (Right Side)
        const oppX = centerX + 120;
        this.renderSearchingPlaceholder(ctx, oppX, avatarY, avatarSize);

        // Hint text
        ctx.fillStyle = ColorTokens.text.secondary;
        ctx.font = `italic 16px ${LayoutConstants.Fonts.Family.Body}`;
        ctx.fillText('Finding a worthy opponent...', centerX, cardY + cardHeight - 30);
    }

    private renderAvatar(ctx: CanvasRenderingContext2D, img: HTMLImageElement | null, x: number, y: number, size: number, label: string) {
        ctx.save();

        // Label
        ctx.fillStyle = ColorTokens.text.secondary;
        ctx.font = `bold 14px ${LayoutConstants.Fonts.Family.Body}`;
        ctx.textAlign = 'center';
        ctx.fillText(label, x, y - size / 2 - 15);

        // Avatar Circle
        ctx.shadowColor = ColorTokens.effects.shadowLight;
        ctx.shadowBlur = 10;
        ctx.beginPath();
        ctx.arc(x, y, size / 2, 0, Math.PI * 2);
        ctx.fillStyle = ColorTokens.background.tertiary;
        ctx.fill();

        // Clip
        ctx.beginPath();
        ctx.arc(x, y, size / 2, 0, Math.PI * 2);
        ctx.clip();

        if (img && img.complete) {
            ctx.drawImage(img, x - size / 2, y - size / 2, size, size);
        }

        ctx.restore();

        // Border ring
        ctx.beginPath();
        ctx.arc(x, y, size / 2, 0, Math.PI * 2);
        ctx.strokeStyle = ColorTokens.border.emphasis;
        ctx.lineWidth = 3;
        ctx.stroke();
    }

    private renderSearchingPlaceholder(ctx: CanvasRenderingContext2D, x: number, y: number, size: number) {
        ctx.save();

        // Label
        ctx.fillStyle = ColorTokens.text.secondary;
        ctx.font = `bold 14px ${LayoutConstants.Fonts.Family.Body}`;
        ctx.textAlign = 'center';
        ctx.fillText('OPPONENT', x, y - size / 2 - 15);

        // Circle
        ctx.beginPath();
        ctx.arc(x, y, size / 2, 0, Math.PI * 2);
        ctx.fillStyle = ColorTokens.background.tertiary;
        ctx.fill();

        // Animated Spinner Ring
        ctx.beginPath();
        const angle = (Date.now() / 1000) * Math.PI * 2; // Rotation
        ctx.arc(x, y, size / 2 - 5, angle, angle + Math.PI * 1.5);
        ctx.strokeStyle = ColorTokens.brand.primary;
        ctx.lineWidth = 4;
        ctx.stroke();

        // Question Mark
        ctx.fillStyle = ColorTokens.text.muted;
        ctx.font = `bold 40px ${LayoutConstants.Fonts.Family.Body}`;
        ctx.textBaseline = 'middle';
        ctx.fillText('?', x, y);

        ctx.restore();
    }
}
