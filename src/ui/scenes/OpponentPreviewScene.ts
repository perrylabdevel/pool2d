/**
 * OpponentPreviewScene - Pre-match opponent preview
 * Shows opponent avatar, name, league, bio, and stats before starting a match
 */

import { UIScene } from '../SceneController';
import { uiStateMachine, UIState } from '../UIStateMachine';
import { drawRoundedRect, drawGlossyButton, Rect } from '../components/UIComponents';
import { ColorTokens } from '../theme/ColorTokens';
import { LayoutConstants } from '../theme/LayoutConstants';
import { NavigationBar } from '../components/NavigationBar';
import { drawSceneBackground } from '../components/SceneBackground';
import { AssetRegistry } from '../../assets/AssetRegistry';
import { AssetLoader } from '../../assets/AssetLoader';
import { OpponentDef } from '../../data/models';
import { db } from '../../data/db';
import { getLeagueById } from '../../game/leagues/LeagueSystem';
import { Game } from '../../game/Game';

interface PreviewButton {
    id: 'play' | 'change';
    label: string;
    color: string;
    rect: Rect;
}

export class OpponentPreviewScene implements UIScene {
    private canvas: HTMLCanvasElement | null = null;
    private buttons: PreviewButton[] = [];
    private hoveredButton: PreviewButton | null = null;
    private navigationBar: NavigationBar;
    private selectedOpponent: OpponentDef | null = null;
    private userLeagueId: string = 'bronze_1';
    private opponentAvatar: HTMLImageElement | null = null;
    private entryFee: number = 50;
    private prizePool: number = 100;

    constructor() {
        this.navigationBar = new NavigationBar({
            title: 'MATCH PREVIEW',
            showBack: true,
            backState: UIState.LOBBY,
            showProfile: true,
            showCurrencies: true,
            showSettings: false
        });
    }

    async mount(): Promise<void> {
        this.canvas = document.getElementById('ui-stage') as HTMLCanvasElement;
        if (!this.canvas) return;

        await this.loadData();
        this.setupLayout();

        this.canvas.addEventListener('mousemove', this.onMouseMove);
        this.canvas.addEventListener('click', this.onClick);

    }

    unmount(): void {
        if (!this.canvas) return;
        this.canvas.removeEventListener('mousemove', this.onMouseMove);
        this.canvas.removeEventListener('click', this.onClick);

        this.canvas.style.cursor = 'default';
        this.opponentAvatar = null;
    }

    private async loadData() {
        try {
            const user = await db.user.get(1);
            if (user) {
                this.userLeagueId = user.leagueId || 'bronze_1';
            }
        } catch (e) {
            console.error('Failed to load user data:', e);
        }

        // Get league info
        const league = getLeagueById(this.userLeagueId);
        if (league) {
            this.entryFee = league.entryFee;
            this.prizePool = league.prizePool;
        }

        // Get game instance and AI opponent
        const game = (window as any).poolGame;
        if (game && game.ai) {
            this.selectedOpponent = game.ai.getOpponentDef();
        } else {
            // Fallback
            this.selectRandomOpponent();
        }

        // Load opponent avatar
        if (this.selectedOpponent) {
            const avatarUrl = this.getAvatarUrl(this.selectedOpponent.avatarId);
            this.opponentAvatar = AssetLoader.loadImageSync(avatarUrl);
        }
    }

    private getAvatarUrl(avatarId: string): string {
        // Try to get from AssetRegistry directly if it matches a key
        // We cast to any because TS doesn't know for sure if the string key exists on the object
        const registry = AssetRegistry.avatars as any;
        if (avatarId in registry) {
            return registry[avatarId]();
        }

        // Legacy mappings
        const avatarMap: Record<string, () => string> = {
            'avatar_default': AssetRegistry.avatars.default,
            'avatar_player': AssetRegistry.avatars.player,
            'avatar_shark_sally': AssetRegistry.avatars.shark_sally,
            'avatar_sally': AssetRegistry.avatars.shark_sally,
            'avatar_the_machine': AssetRegistry.avatars.the_machine,
            'avatar_machine': AssetRegistry.avatars.the_machine,
            'avatar_rookie_rick': AssetRegistry.avatars.rookie_rick,
            'avatar_rick': AssetRegistry.avatars.rookie_rick,
            'avatar_ned': AssetRegistry.avatars.nervous_ned,
            'avatar_nervous_ned': AssetRegistry.avatars.nervous_ned,
        };
        const getter = avatarMap[avatarId];
        return getter ? getter() : AssetRegistry.avatars.default();
    }

    public onResize(_width: number, _height: number) {
        this.setupLayout();
    }

    private selectRandomOpponent() {
        // Fallback default opponent
        this.selectedOpponent = {
            id: 'bot_rookie',
            name: 'Rookie Rick',
            avatarId: 'avatar_rookie_rick',
            leagueId: 'bronze_1',
            bio: 'Ready to learn!',
            stats: {
                accuracy: 0.4,
                consistency: 0.5,
                aggression: 0.3,
                speed: 0.5,
                spinControl: 0.2
            },
            difficulty: 0.3
        };
    }

    private setupLayout() {
        if (!this.canvas) return;
        const width = this.canvas.width;
        const height = this.canvas.height;

        this.navigationBar.setupLayout(width);

        const buttonWidth = 180;
        const buttonHeight = 56;
        const gap = 20;
        const centerX = width / 2;
        const buttonY = height * 0.82;

        this.buttons = [
            {
                id: 'play',
                label: 'START MATCH',
                color: ColorTokens.action.success,
                rect: { x: centerX - buttonWidth / 2, y: buttonY, width: buttonWidth, height: buttonHeight }
            }
        ];
    }

    private onMouseMove = (e: MouseEvent) => {
        if (!this.canvas) return;
        const rect = this.canvas.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;

        if (this.navigationBar.handleMouseMove(x, y)) {
            this.hoveredButton = null;
            this.canvas.style.cursor = this.navigationBar.getCursor();
            return;
        }

        this.hoveredButton = null;
        for (const btn of this.buttons) {
            if (x >= btn.rect.x && x <= btn.rect.x + btn.rect.width &&
                y >= btn.rect.y && y <= btn.rect.y + btn.rect.height) {
                this.hoveredButton = btn;
                break;
            }
        }
        this.canvas.style.cursor = this.hoveredButton ? 'pointer' : 'default';
    };

    private onClick = async (e: MouseEvent) => {
        if (!this.canvas) return;
        const rect = this.canvas.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;

        if (this.navigationBar.handleClick(x, y)) return;

        if (!this.hoveredButton) return;

        if (this.hoveredButton.id === 'play') {
            // Game is already set up by ClubSelectionScene, just transition
            uiStateMachine.transitionTo(UIState.IN_GAME);
        }
    };

    update(_dt: number): void { }

    render(ctx: CanvasRenderingContext2D): void {
        const width = ctx.canvas.width;
        const height = ctx.canvas.height;

        drawSceneBackground(ctx, width, height, 'blue');

        if (!this.selectedOpponent) {
            ctx.fillStyle = ColorTokens.text.primary;
            ctx.font = `${LayoutConstants.Fonts.Size.XLarge}px ${LayoutConstants.Fonts.Family.Body}`;
            ctx.textAlign = 'center';
            ctx.fillText('Loading opponent...', width / 2, height / 2);
            this.navigationBar.render(ctx, width);
            return;
        }

        const centerX = width / 2;
        const navHeight = this.navigationBar.getHeight();

        // Main card
        const cardWidth = Math.min(500, width * 0.85);
        const cardHeight = 450;
        const cardX = centerX - cardWidth / 2;
        const cardY = navHeight + 30;

        // Draw card background
        ctx.save();
        ctx.shadowColor = ColorTokens.effects.shadow;
        ctx.shadowBlur = 30;
        ctx.shadowOffsetY = 10;
        drawRoundedRect(ctx, cardX, cardY, cardWidth, cardHeight, LayoutConstants.Radii.XLarge);
        const cardGradient = ctx.createLinearGradient(cardX, cardY, cardX, cardY + cardHeight);
        cardGradient.addColorStop(0, ColorTokens.background.panelSolid);
        cardGradient.addColorStop(1, ColorTokens.background.panel);
        ctx.fillStyle = cardGradient;
        ctx.fill();
        ctx.restore();

        // Card border
        drawRoundedRect(ctx, cardX, cardY, cardWidth, cardHeight, LayoutConstants.Radii.XLarge);
        ctx.strokeStyle = ColorTokens.border.subtle;
        ctx.lineWidth = LayoutConstants.Lines.Normal;
        ctx.stroke();

        // VS label
        ctx.fillStyle = ColorTokens.text.muted;
        ctx.font = `16px ${LayoutConstants.Fonts.Family.Body}`;
        ctx.textAlign = 'center';
        ctx.fillText('YOUR OPPONENT', centerX, cardY + 30);

        // Avatar
        const avatarSize = 120;
        const avatarX = centerX - avatarSize / 2;
        const avatarY = cardY + 50;

        ctx.save();
        ctx.shadowColor = ColorTokens.effects.shadowLight;
        ctx.shadowBlur = 15;
        ctx.beginPath();
        ctx.arc(centerX, avatarY + avatarSize / 2, avatarSize / 2 + 4, 0, Math.PI * 2);
        ctx.fillStyle = ColorTokens.border.default;
        ctx.fill();

        // Clip for circular avatar
        ctx.beginPath();
        ctx.arc(centerX, avatarY + avatarSize / 2, avatarSize / 2, 0, Math.PI * 2);
        ctx.clip();

        if (this.opponentAvatar && this.opponentAvatar.complete && this.opponentAvatar.naturalWidth > 0) {
            ctx.drawImage(this.opponentAvatar, avatarX, avatarY, avatarSize, avatarSize);
        } else {
            ctx.fillStyle = ColorTokens.metallic.dark;
            ctx.fillRect(avatarX, avatarY, avatarSize, avatarSize);
        }
        ctx.restore();

        // Opponent name
        const nameY = avatarY + avatarSize + 30;
        ctx.fillStyle = ColorTokens.text.primary;
        ctx.font = `bold 32px ${LayoutConstants.Fonts.Family.Display}`;
        ctx.textAlign = 'center';
        ctx.fillText(this.selectedOpponent.name, centerX, nameY);

        // League badge
        const league = getLeagueById(this.selectedOpponent.leagueId);
        if (league) {
            ctx.fillStyle = this.getLeagueColor(league.tier);
            ctx.font = `bold 14px ${LayoutConstants.Fonts.Family.Body}`;
            ctx.fillText(league.name.toUpperCase(), centerX, nameY + 25);
        }

        // Bio
        ctx.fillStyle = ColorTokens.text.secondary;
        ctx.font = `italic ${LayoutConstants.Fonts.Size.Medium}px ${LayoutConstants.Fonts.Family.Body}`;
        ctx.fillText(`"${this.selectedOpponent.bio}"`, centerX, nameY + 60);

        // Stats bars
        const statsY = nameY + 100;
        this.renderStatsBars(ctx, cardX + 40, statsY, cardWidth - 80);

        // Entry fee / Prize pool info
        const infoY = cardY + cardHeight - 40;
        ctx.fillStyle = ColorTokens.text.muted;
        ctx.font = `14px ${LayoutConstants.Fonts.Family.Body}`;
        ctx.textAlign = 'center';
        ctx.fillText(`Entry Fee: ${this.entryFee.toLocaleString()} coins  •  Prize Pool: ${this.prizePool.toLocaleString()} coins`, centerX, infoY);

        // Render buttons
        for (const btn of this.buttons) {
            drawGlossyButton(ctx, btn.rect, btn.label, btn.color, this.hoveredButton === btn);
        }

        this.navigationBar.render(ctx, width);
    }

    private renderStatsBars(ctx: CanvasRenderingContext2D, x: number, y: number, width: number) {
        if (!this.selectedOpponent) return;

        const stats = this.selectedOpponent.stats;
        const barHeight = 12;
        const gap = 28;
        const labelWidth = 100;

        const statsList = [
            { label: 'Accuracy', value: stats.accuracy, color: '#4CAF50' },
            { label: 'Power', value: stats.aggression, color: '#FF5722' },
            { label: 'Defense', value: 1 - stats.aggression + stats.consistency * 0.5, color: '#2196F3' },
            { label: 'Speed', value: stats.speed, color: '#FFC107' },
        ];

        statsList.forEach((stat, index) => {
            const statY = y + index * gap;

            // Label
            ctx.fillStyle = ColorTokens.text.secondary;
            ctx.font = `${LayoutConstants.Fonts.Size.Small}px ${LayoutConstants.Fonts.Family.Body}`;
            ctx.textAlign = 'left';
            ctx.fillText(stat.label, x, statY + barHeight - 2);

            // Background bar
            const barX = x + labelWidth;
            const barWidth = width - labelWidth;
            ctx.fillStyle = ColorTokens.border.default;
            drawRoundedRect(ctx, barX, statY, barWidth, barHeight, barHeight / 2);
            ctx.fill();

            // Filled bar
            const fillWidth = barWidth * Math.min(1, stat.value);
            if (fillWidth > 0) {
                ctx.fillStyle = stat.color;
                drawRoundedRect(ctx, barX, statY, fillWidth, barHeight, barHeight / 2);
                ctx.fill();
            }
        });
    }

    private getLeagueColor(tier: number): string {
        switch (tier) {
            case 1: return '#CD7F32'; // Bronze
            case 2: return '#C0C0C0'; // Silver
            case 3: return '#FFD700'; // Gold
            case 4: return '#E5E4E2'; // Platinum
            case 5: return '#B9F2FF'; // Diamond
            default: return '#FFFFFF';
        }
    }
}

