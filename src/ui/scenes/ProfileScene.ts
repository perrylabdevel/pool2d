import { UIScene } from '../SceneController';
import { uiStateMachine, UIState } from '../UIStateMachine';
import { drawPanel, drawGlossyButton, Rect, UIColors } from '../components/UIComponents';
import { ColorTokens } from '../theme/ColorTokens';
import { SettingsManager, type GameStats } from '../SettingsManager';
import { NavigationBar } from '../components/NavigationBar';
import { drawSceneBackground } from '../components/SceneBackground';

type ProfileButton = {
    id: 'customize' | 'reset';
    label: string;
    color: string;
    rect: Rect;
};

type AchievementDef = {
    title: string;
    desc: string;
    key: keyof GameStats;
    target: number;
};

export class ProfileScene implements UIScene {
    private canvas: HTMLCanvasElement | null = null;
    private buttons: ProfileButton[] = [];
    private hoveredButton: ProfileButton | null = null;
    private settingsManager = new SettingsManager();
    private navigationBar: NavigationBar;

    constructor() {
        this.navigationBar = new NavigationBar({
            title: 'PROFILE',
            showBack: true,
            backState: UIState.LOBBY,
            showProfile: false, // Don't show profile button on profile page
            showCurrencies: true,
            showSettings: true
        });
    }

    mount(): void {
        this.canvas = document.getElementById('ui-stage') as HTMLCanvasElement;
        if (!this.canvas) return;
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

    private updateLayout = () => {
        if (!this.canvas) return;
        const width = this.canvas.width;
        const height = this.canvas.height;
        const padding = Math.max(48, width * 0.04);

        // Setup navigation bar
        this.navigationBar.setupLayout(width);

        this.buttons = [
            {
                id: 'customize',
                label: 'Customize Avatar',
                color: UIColors.secondary,
                rect: { x: width - padding - 240, y: height - 126, width: 240, height: 56 }
            },
            {
                id: 'reset',
                label: 'Reset Stats',
                color: ColorTokens.action.danger,
                rect: { x: width - padding - 500, y: height - 126, width: 240, height: 56 }
            }
        ];
    };

    private onMouseMove = (e: MouseEvent) => {
        if (!this.canvas) return;
        const rect = this.canvas.getBoundingClientRect();
        const scaleX = this.canvas.width / rect.width;
        const scaleY = this.canvas.height / rect.height;
        const x = (e.clientX - rect.left) * scaleX;
        const y = (e.clientY - rect.top) * scaleY;

        // Check navigation bar first
        if (this.navigationBar.handleMouseMove(x, y)) {
            this.hoveredButton = null;
            this.canvas.style.cursor = this.navigationBar.getCursor();
            return;
        }

        this.hoveredButton = null;
        for (const button of this.buttons) {
            const { x: bx, y: by, width, height } = button.rect;
            if (x >= bx && x <= bx + width && y >= by && y <= by + height) {
                this.hoveredButton = button;
                break;
            }
        }
        this.canvas.style.cursor = this.hoveredButton ? 'pointer' : 'default';
    };

    private onClick = (e: MouseEvent) => {
        if (!this.canvas) return;
        const rect = this.canvas.getBoundingClientRect();
        const scaleX = this.canvas.width / rect.width;
        const scaleY = this.canvas.height / rect.height;
        const x = (e.clientX - rect.left) * scaleX;
        const y = (e.clientY - rect.top) * scaleY;

        // Check navigation bar first
        if (this.navigationBar.handleClick(x, y)) {
            return;
        }

        if (!this.hoveredButton) return;
        if (this.hoveredButton.id === 'customize') {
            console.log('[ProfileScene] Customize avatar placeholder');
        } else if (this.hoveredButton.id === 'reset') {
            // Dynamic import to avoid circular dependency if possible, or just rely on global/module
            // We need ModalService. Since it's a singleton, we can import it.
            import('../ModalService').then(({ modalService }) => {
                modalService.confirm({
                    title: 'RESET STATS',
                    message: 'Are you sure you want to reset all your game statistics? This cannot be undone.',
                    confirmText: 'YES, RESET',
                    onConfirm: () => {
                        this.settingsManager.resetGameStats();
                        // Force re-render or update stats
                        // The render loop pulls from settingsManager every frame, so it should update automatically
                    }
                });
            });
        }
    };

    update(_dt: number): void { }

    render(ctx: CanvasRenderingContext2D): void {
        const width = ctx.canvas.width;
        const height = ctx.canvas.height;
        this.renderBackground(ctx, width, height);
        const stats = this.settingsManager.getGameStats();
        const navHeight = this.navigationBar.getHeight();
        this.renderHero(ctx, width, navHeight, stats);
        this.renderStats(ctx, width, navHeight, stats);
        this.renderAchievements(ctx, width, height, navHeight, stats);
        this.renderButtons(ctx);
        this.navigationBar.render(ctx, width);
    }

    private renderBackground(ctx: CanvasRenderingContext2D, width: number, height: number) {
        drawSceneBackground(ctx, width, height, 'green');
    }

    private renderHero(ctx: CanvasRenderingContext2D, width: number, navHeight: number, stats: GameStats) {
        const panelRect: Rect = {
            x: width * 0.08,
            y: navHeight + 20,
            width: width * 0.84,
            height: 200
        };

        drawPanel(ctx, panelRect);

        ctx.save();
        const gradient = ctx.createLinearGradient(panelRect.x, panelRect.y, panelRect.x + panelRect.width, panelRect.y + panelRect.height);
        gradient.addColorStop(0, 'rgba(0, 173, 255, 0.35)'); // Cyan overlay
        gradient.addColorStop(1, 'rgba(90, 0, 150, 0.2)'); // Purple overlay
        ctx.fillStyle = gradient;
        ctx.fillRect(panelRect.x, panelRect.y, panelRect.width, panelRect.height);
        ctx.restore();

        // Avatar circle
        const avatarX = panelRect.x + 120;
        const avatarY = panelRect.y + panelRect.height / 2;
        ctx.save();
        ctx.beginPath();
        ctx.arc(avatarX, avatarY, 60, 0, Math.PI * 2);
        const avatarGrad = ctx.createLinearGradient(avatarX - 40, avatarY - 60, avatarX + 40, avatarY + 60);
        avatarGrad.addColorStop(0, '#1e2b47'); // Navy
        avatarGrad.addColorStop(1, '#04060f'); // Very dark
        ctx.fillStyle = avatarGrad;
        ctx.fill();
        ctx.lineWidth = 3;
        ctx.strokeStyle = ColorTokens.ui.teal;
        ctx.stroke();
        ctx.font = '700 32px "Montserrat", Arial';
        ctx.fillStyle = ColorTokens.text.primary;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('BR', avatarX, avatarY);
        ctx.restore();

        ctx.save();
        ctx.fillStyle = ColorTokens.text.primary;
        ctx.font = '600 40px "Orbitron", Arial';
        ctx.textAlign = 'left';
        ctx.textBaseline = 'top';
        ctx.fillText('Brian Rivera', panelRect.x + 220, panelRect.y + 40);

        ctx.font = '16px "Nunito", Arial';
        ctx.fillStyle = 'rgba(255,255,255,0.7)'; // Subtitle text
        ctx.fillText(
            `${stats.gamesPlayed} games • ${stats.winStreak} streak • ${stats.ballsPotted} pots`,
            panelRect.x + 220,
            panelRect.y + 90
        );

        ctx.font = '14px "Nunito", Arial';
        ctx.fillStyle = 'rgba(255,255,255,0.55)'; // Muted text
        ctx.fillText(`Overall rank: ${this.deriveRank(stats)}`, panelRect.x + 220, panelRect.y + 120);
        ctx.restore();
    }

    private renderStats(ctx: CanvasRenderingContext2D, width: number, navHeight: number, stats: GameStats) {
        const panelRect: Rect = {
            x: width * 0.08,
            y: navHeight + 250,
            width: width * 0.84,
            height: 150
        };
        drawPanel(ctx, panelRect);

        const statsData = this.getStatCards(stats);
        const cardWidth = (panelRect.width - 60) / statsData.length;
        statsData.forEach((card, index) => {
            const x = panelRect.x + 30 + index * cardWidth;
            const y = panelRect.y + 24;
            ctx.save();
            ctx.fillStyle = 'rgba(0,0,0,0.35)';
            ctx.fillRect(x, y, cardWidth - 20, 90);
            ctx.fillStyle = card.accent;
            ctx.fillRect(x, y, 4, 90);
            ctx.fillStyle = 'rgba(255,255,255,0.65)';
            ctx.font = '12px "Nunito", Arial';
            ctx.fillText(card.label.toUpperCase(), x + 16, y + 20);
            ctx.fillStyle = '#FFFFFF';
            ctx.font = '600 26px "Montserrat", Arial';
            ctx.fillText(card.value, x + 16, y + 60);
            ctx.restore();
        });
    }

    private renderAchievements(ctx: CanvasRenderingContext2D, width: number, height: number, navHeight: number, stats: GameStats) {
        const contentY = navHeight + 420;
        const panelHeight = height - contentY - 30;
        const panelRect: Rect = {
            x: width * 0.08,
            y: contentY,
            width: width * 0.84,
            height: Math.max(220, panelHeight)
        };
        drawPanel(ctx, panelRect);

        ctx.save();
        ctx.fillStyle = '#FFFFFF';
        ctx.font = '600 20px "Montserrat", Arial';
        ctx.fillText('Recent Achievements', panelRect.x + 30, panelRect.y + 40);

        const achievements = this.getAchievementProgress(stats);
        achievements.forEach((achievement, index) => {
            const rowY = panelRect.y + 80 + index * 70;
            ctx.fillStyle = '#FFFFFF';
            ctx.font = '15px "Nunito", Arial';
            ctx.fillText(achievement.title, panelRect.x + 30, rowY);

            ctx.fillStyle = 'rgba(255,255,255,0.65)';
            ctx.font = '13px "Nunito", Arial';
            ctx.fillText(`${achievement.desc} (${achievement.current}/${achievement.target})`, panelRect.x + 30, rowY + 22);

            const barX = panelRect.x + panelRect.width - 220;
            const barY = rowY - 10;
            const barWidth = 180;
            ctx.fillStyle = 'rgba(255,255,255,0.1)';
            ctx.fillRect(barX, barY, barWidth, 10);
            ctx.fillStyle = '#00C6FF';
            ctx.fillRect(barX, barY, barWidth * achievement.progress, 10);
        });
        ctx.restore();
    }

    private renderButtons(ctx: CanvasRenderingContext2D) {
        this.buttons.forEach((button) => {
            drawGlossyButton(ctx, button.rect, button.label, button.color, this.hoveredButton?.id === button.id);
        });
    }

    private getStatCards(stats: GameStats) {
        return [
            {
                label: 'Win Rate',
                value: this.formatWinRate(stats),
                accent: ColorTokens.action.success
            },
            {
                label: 'Current Streak',
                value: `${stats.winStreak} wins`,
                accent: ColorTokens.action.info
            },
            {
                label: 'Balls Potted',
                value: stats.ballsPotted.toString(),
                accent: ColorTokens.action.danger
            }
        ];
    }

    private getAchievementProgress(stats: GameStats) {
        const defs: AchievementDef[] = [
            { title: 'Rail Rush Veteran', desc: 'Clear 100 racks', key: 'gamesPlayed', target: 100 },
            { title: 'Precision Shooter', desc: 'Pocket 250 balls', key: 'ballsPotted', target: 250 },
            { title: 'Hot Streak', desc: 'Win 10 in a row', key: 'maxWinStreak', target: 10 }
        ];
        return defs.map((def) => {
            const current = (stats[def.key] as number) ?? 0;
            const progress = this.clamp(current / def.target, 0, 1);
            return {
                title: def.title,
                desc: def.desc,
                current,
                target: def.target,
                progress
            };
        });
    }

    private formatWinRate(stats: GameStats) {
        if (!stats.gamesPlayed) return '--';
        const rate = Math.round((stats.wins / stats.gamesPlayed) * 100);
        return `${rate}%`;
    }

    private deriveRank(stats: GameStats) {
        if (stats.wins >= 200) return 'Legend';
        if (stats.wins >= 120) return 'Vanguard';
        if (stats.wins >= 60) return 'Specialist';
        if (stats.wins >= 20) return 'Journeyman';
        return 'Rookie';
    }

    private clamp(value: number, min: number, max: number) {
        return Math.min(max, Math.max(min, value));
    }
}
