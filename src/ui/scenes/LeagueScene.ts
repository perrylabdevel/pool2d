import { UIScene } from '../SceneController';
import { UIState } from '../UIStateMachine';
import { drawPanel, Rect } from '../components/UIComponents';
import { ColorTokens } from '../theme/ColorTokens';
import { LayoutConstants } from '../theme/LayoutConstants';
import { NavigationBar } from '../components/NavigationBar';
import { drawSceneBackground } from '../components/SceneBackground';
import { db } from '../../data/db';
import { getLeagueById } from '../../game/leagues/LeagueSystem';
import { UserProfile } from '../../data/models';
import { AssetRegistry } from '../../assets/AssetRegistry';
import { AssetLoader } from '../../assets/AssetLoader';

export class LeagueScene implements UIScene {
    private canvas: HTMLCanvasElement | null = null;
    private navigationBar: NavigationBar;
    private userProfile: UserProfile | null | undefined = null;
    private layout: {
        headerRect: Rect;
        standingsRect: Rect;
    } | null = null;

    constructor() {
        this.navigationBar = new NavigationBar({
            title: 'LEAGUE',
            showBack: true,
            backState: UIState.LOBBY,
            showProfile: true,
            showCurrencies: true,
            showSettings: true
        });
    }

    mount(): void {
        this.canvas = document.getElementById('ui-stage') as HTMLCanvasElement;
        if (!this.canvas) return;

        this.loadData();
        this.updateLayout();

        this.canvas.addEventListener('mousemove', this.onMouseMove);
        this.canvas.addEventListener('click', this.onClick);
        window.addEventListener('resize', this.updateLayout);
    }

    unmount(): void {
        if (!this.canvas) return;
        this.canvas.removeEventListener('mousemove', this.onMouseMove);
        this.canvas.removeEventListener('click', this.onClick);
        window.removeEventListener('resize', this.updateLayout);
        this.canvas.style.cursor = 'default';
    }

    private async loadData() {
        try {
            this.userProfile = await db.user.get(1);
        } catch (e) {
            console.error('Failed to load user profile for league:', e);
        }
    }

    private updateLayout = () => {
        if (!this.canvas) return;
        const width = this.canvas.width;
        const height = this.canvas.height;
        const gap = LayoutConstants.Spacing.GapMedium;
        const paddingX = width * LayoutConstants.Spacing.PaddingScreen;
        const contentWidth = width - paddingX * 2;
        const navHeight = this.navigationBar.getHeight();

        const headerRect: Rect = {
            x: paddingX,
            y: navHeight + gap,
            width: contentWidth,
            height: 150
        };

        const standingsRect: Rect = {
            x: paddingX,
            y: headerRect.y + headerRect.height + gap,
            width: contentWidth,
            height: height - (headerRect.y + headerRect.height) - gap * 2
        };

        this.layout = {
            headerRect,
            standingsRect
        };

        this.navigationBar.setupLayout(width);
    };

    private onMouseMove = (e: MouseEvent) => {
        if (!this.canvas) return;
        const rect = this.canvas.getBoundingClientRect();
        const scaleX = this.canvas.width / rect.width;
        const scaleY = this.canvas.height / rect.height;
        const x = (e.clientX - rect.left) * scaleX;
        const y = (e.clientY - rect.top) * scaleY;

        if (this.navigationBar.handleMouseMove(x, y)) {
            this.canvas.style.cursor = this.navigationBar.getCursor();
            return;
        }
        this.canvas.style.cursor = 'default';
    };

    private onClick = (e: MouseEvent) => {
        if (!this.canvas) return;
        const rect = this.canvas.getBoundingClientRect();
        const scaleX = this.canvas.width / rect.width;
        const scaleY = this.canvas.height / rect.height;
        const x = (e.clientX - rect.left) * scaleX;
        const y = (e.clientY - rect.top) * scaleY;

        if (this.navigationBar.handleClick(x, y)) {
            return;
        }
    };

    update(_dt: number): void { }

    render(ctx: CanvasRenderingContext2D): void {
        const width = ctx.canvas.width;
        const height = ctx.canvas.height;
        this.renderBackground(ctx, width, height);

        if (this.layout && this.userProfile) {
            this.renderHeader(ctx, this.layout.headerRect);
            this.renderStandings(ctx, this.layout.standingsRect);
        } else if (!this.userProfile) {
            // Loading state
            ctx.fillStyle = '#FFFFFF';
            ctx.font = '24px Inter';
            ctx.textAlign = 'center';
            ctx.fillText('Loading League Data...', width / 2, height / 2);
        }

        this.navigationBar.render(ctx, width);
    }

    private renderBackground(ctx: CanvasRenderingContext2D, width: number, height: number) {
        drawSceneBackground(ctx, width, height, 'blue');
    }

    private renderHeader(ctx: CanvasRenderingContext2D, rect: Rect) {
        drawPanel(ctx, rect);

        const leagueId = this.userProfile?.leagueId || 'bronze_1';
        const leagueDef = getLeagueById(leagueId);

        // Draw League Icon/Frame
        const frameUrl = leagueId.includes('gold') ? AssetRegistry.frames.gold() :
            leagueId.includes('silver') ? AssetRegistry.frames.silver() :
                AssetRegistry.frames.bronze();

        const frameImg = AssetLoader.getCached(frameUrl);
        if (frameImg) {
            ctx.drawImage(frameImg, rect.x + 20, rect.y + 20, 100, 100);
        } else {
            AssetLoader.loadImage(frameUrl); // Trigger load
            // Fallback circle
            ctx.beginPath();
            ctx.arc(rect.x + 70, rect.y + 70, 40, 0, Math.PI * 2);
            ctx.fillStyle = '#444';
            ctx.fill();
        }

        const textX = rect.x + 140;

        ctx.fillStyle = '#FFFFFF';
        ctx.font = `700 32px ${LayoutConstants.Fonts.Family.Heading}`;
        ctx.textAlign = 'left';
        ctx.textBaseline = 'top';
        ctx.fillText(leagueDef?.name.toUpperCase() || 'UNKNOWN LEAGUE', textX, rect.y + 30);

        ctx.font = `16px ${LayoutConstants.Fonts.Family.Body}`;
        ctx.fillStyle = 'rgba(255,255,255,0.7)';
        ctx.fillText(`Prize Pool: ${leagueDef?.prizePool.toLocaleString()} Coins`, textX, rect.y + 80);
        ctx.fillText(`Ends in: 2d 14h`, textX, rect.y + 105);
    }

    private renderStandings(ctx: CanvasRenderingContext2D, rect: Rect) {
        drawPanel(ctx, rect);

        ctx.fillStyle = '#FFFFFF';
        ctx.font = `600 20px ${LayoutConstants.Fonts.Family.Heading}`;
        ctx.textAlign = 'left';
        ctx.fillText('Standings', rect.x + 30, rect.y + 40);

        // Placeholder standings data
        const standings = [
            { rank: 1, name: 'Shark Sally', score: 12500, isUser: false, avatar: AssetRegistry.avatars.sharkSally() },
            { rank: 2, name: 'The Machine', score: 11200, isUser: false, avatar: AssetRegistry.avatars.theMachine() },
            { rank: 3, name: this.userProfile?.name || 'Player', score: this.userProfile?.stats.totalEarnings || 0, isUser: true, avatar: AssetRegistry.avatars.player() },
            { rank: 4, name: 'Rookie Rick', score: 4500, isUser: false, avatar: AssetRegistry.avatars.rookieRick() },
            { rank: 5, name: 'Steady Steve', score: 3200, isUser: false, avatar: AssetRegistry.avatars.default() },
        ];

        const rowHeight = 70; // Increased height for avatars
        const startY = rect.y + 80;

        standings.forEach((entry, index) => {
            const y = startY + index * rowHeight;

            // Highlight user row
            if (entry.isUser) {
                ctx.fillStyle = 'rgba(255, 255, 255, 0.1)';
                ctx.fillRect(rect.x + 10, y - 10, rect.width - 20, rowHeight - 5);
            }

            // Rank
            ctx.fillStyle = entry.rank <= 3 ? ColorTokens.action.warning : '#FFFFFF';
            ctx.font = `700 24px ${LayoutConstants.Fonts.Family.Heading}`;
            ctx.textAlign = 'center';
            ctx.fillText(`#${entry.rank}`, rect.x + 40, y + 30);

            // Avatar
            const avatarSize = 50;
            const avatarX = rect.x + 80;
            const avatarY = y + 5;
            const avatarImg = AssetLoader.getCached(entry.avatar);

            ctx.save();
            ctx.beginPath();
            ctx.arc(avatarX + avatarSize / 2, avatarY + avatarSize / 2, avatarSize / 2, 0, Math.PI * 2);
            ctx.clip();
            if (avatarImg) {
                ctx.drawImage(avatarImg, avatarX, avatarY, avatarSize, avatarSize);
            } else {
                AssetLoader.loadImage(entry.avatar);
                ctx.fillStyle = '#666';
                ctx.fillRect(avatarX, avatarY, avatarSize, avatarSize);
            }
            ctx.restore();

            // Name
            ctx.fillStyle = '#FFFFFF';
            ctx.font = `600 18px ${LayoutConstants.Fonts.Family.Body}`;
            ctx.textAlign = 'left';
            ctx.fillText(entry.name, rect.x + 150, y + 30);

            // Score
            ctx.fillStyle = ColorTokens.action.success;
            ctx.textAlign = 'right';
            ctx.fillText(entry.score.toLocaleString(), rect.x + rect.width - 40, y + 30);
        });
    }
}
