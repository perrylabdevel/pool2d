import { UIScene } from '../SceneController';
import { UIState } from '../UIStateMachine';
import { drawPanel, drawGlossyButton, Rect, UIColors } from '../components/UIComponents';
import { ColorTokens } from '../theme/ColorTokens';
import { LayoutConstants } from '../theme/LayoutConstants';
import { NavigationBar } from '../components/NavigationBar';
import { drawSceneBackground } from '../components/SceneBackground';
import { db } from '../../data/db';
import { UserProfile, UserStats } from '../../data/models';
import { AssetRegistry } from '../../assets/AssetRegistry';
import { AssetLoader } from '../../assets/AssetLoader';
import { DEFAULT_USER_NAME } from '../../config';

type ProfileButton = {
    id: 'customize' | 'reset';
    label: string;
    color: string;
    rect: Rect;
};

type AchievementDef = {
    title: string;
    desc: string;
    key: keyof UserStats;
    target: number;
};

export class ProfileScene implements UIScene {
    private canvas: HTMLCanvasElement | null = null;
    private buttons: ProfileButton[] = [];
    private hoveredButton: ProfileButton | null = null;
    private navigationBar: NavigationBar;
    private userProfile: UserProfile | null = null;
    private layout: {
        heroRect: Rect;
        statsRect: Rect;
        achievementsRect: Rect;
    } | null = null;

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

        this.loadData();
        this.onResize(this.canvas.width, this.canvas.height);

        this.canvas.addEventListener('mousemove', this.onMouseMove);
        this.canvas.addEventListener('click', this.onClick);
    }

    unmount(): void {
        if (!this.canvas) return;
        this.canvas.removeEventListener('mousemove', this.onMouseMove);
        this.canvas.removeEventListener('click', this.onClick);

        this.canvas.style.cursor = 'default';
    }

    private async loadData() {
        try {
            this.userProfile = await db.user.get(1) || null;
        } catch (e) {
            console.error('Failed to load user profile:', e);
        }
    }

    public onResize(width: number, height: number) {
        if (!this.canvas) return;
        const gap = LayoutConstants.Spacing.GapMedium;
        const paddingX = width * LayoutConstants.Spacing.PaddingScreen;
        const contentWidth = width - paddingX * 2;
        const navHeight = this.navigationBar.getHeight();
        const heroHeight = 200;
        const statsHeight = 150;

        const heroRect: Rect = {
            x: paddingX,
            y: navHeight + gap,
            width: contentWidth,
            height: heroHeight
        };

        const statsRect: Rect = {
            x: paddingX,
            y: heroRect.y + heroRect.height + gap,
            width: contentWidth,
            height: statsHeight
        };

        const achievementsRect: Rect = {
            x: paddingX,
            y: statsRect.y + statsRect.height + gap,
            width: contentWidth,
            height: Math.max(220, height - (statsRect.y + statsRect.height) - gap * 2)
        };

        this.layout = {
            heroRect,
            statsRect,
            achievementsRect
        };

        // Setup navigation bar
        this.navigationBar.setupLayout(width);

        const btnGap = 12;
        const buttonWidth = LayoutConstants.Dimensions.ButtonWidthMedium;
        const buttonHeight = LayoutConstants.Dimensions.ButtonHeight;
        const buttonY = heroRect.y + heroRect.height - buttonHeight - 16;
        const buttonPaddingRight = 16;
        const buttonRight = heroRect.x + heroRect.width - buttonPaddingRight;
        this.buttons = [
            {
                id: 'customize',
                label: 'Customize Avatar',
                color: UIColors.secondary,
                rect: { x: buttonRight - buttonWidth, y: buttonY, width: buttonWidth, height: buttonHeight }
            },
            {
                id: 'reset',
                label: 'Reset Stats',
                color: ColorTokens.action.danger,
                rect: { x: buttonRight - buttonWidth * 2 - btnGap, y: buttonY, width: buttonWidth, height: buttonHeight }
            }
        ];
    }

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
                    onConfirm: async () => {
                        // Reset logic here - ideally call a db reset method
                        // For now, just reset stats in DB
                        if (this.userProfile) {
                            this.userProfile.stats = {
                                gamesPlayed: 0,
                                wins: 0,
                                losses: 0,
                                winStreak: 0,
                                ballsPotted: 0,
                                tournamentsWon: 0,
                                totalEarnings: 0
                            };
                            await db.user.put(this.userProfile);
                        }
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

        const stats = this.userProfile?.stats;
        const navHeight = this.navigationBar.getHeight();

        if (stats) {
            this.renderHero(ctx, width, navHeight, stats);
            this.renderStats(ctx, width, navHeight, stats);
            this.renderAchievements(ctx, width, height, navHeight, stats);
            this.renderButtons(ctx);
        } else {
            // Loading state
            ctx.fillStyle = ColorTokens.text.primary;
            ctx.font = `${LayoutConstants.Fonts.Size.XLarge}px ${LayoutConstants.Fonts.Family.Body}`;
            ctx.textAlign = 'center';
            ctx.fillText('Loading Profile...', width / 2, height / 2);
        }

        this.navigationBar.render(ctx, width);
    }

    private renderBackground(ctx: CanvasRenderingContext2D, width: number, height: number) {
        drawSceneBackground(ctx, width, height, 'green');
    }

    private renderHero(ctx: CanvasRenderingContext2D, width: number, navHeight: number, stats: UserStats) {
        const panelRect = this.layout?.heroRect ?? {
            x: width * 0.08,
            y: navHeight + 20,
            width: width * 0.84,
            height: 200
        };

        drawPanel(ctx, panelRect);

        // Avatar block (square to match other panels)
        const avatarSize = LayoutConstants.Dimensions.AvatarSize;
        const avatarRect: Rect = {
            x: panelRect.x + 30,
            y: panelRect.y + (panelRect.height - avatarSize) / 2,
            width: avatarSize,
            height: avatarSize
        };

        // Render Frame Overlay
        // Use user's actual league frame or default to bronze
        const leagueId = this.userProfile?.leagueId || 'bronze_1';
        const frameUrl = this.getFrameForLeague(leagueId);
        const frameImg = AssetLoader.getCached(frameUrl);

        // Frame dimensions (Square container, but frame image might not be square)
        // Use object-fit: contain logic
        let frameW = avatarRect.width;
        let frameH = avatarRect.height;
        let frameX = avatarRect.x;
        let frameY = avatarRect.y;

        if (frameImg && frameImg.complete && frameImg.naturalWidth > 0) {
            const frameAspect = frameImg.naturalWidth / frameImg.naturalHeight;
            const maxSize = avatarRect.width; // Assume square container

            if (frameAspect > 1) {
                // Wider than tall
                frameW = maxSize;
                frameH = maxSize / frameAspect;
            } else {
                // Taller than wide
                frameH = maxSize;
                frameW = maxSize * frameAspect;
            }

            // Re-center based on new dimensions
            frameX = avatarRect.x + (avatarRect.width - frameW) / 2;
            frameY = avatarRect.y + (avatarRect.height - frameH) / 2;
        }

        // Render Avatar Photo
        const avatarUrl = AssetRegistry.avatars.player();
        const avatarImg = AssetLoader.getCached(avatarUrl);

        // Calculated bounds from chroma green area:
        // Top: 10%, Left: 10.7%, Width: 78.5%, Height: 74%
        const photoX = frameX + (frameW * 0.107);
        const photoY = frameY + (frameH * 0.100);
        const photoW = frameW * 0.785;
        const photoH = frameH * 0.740;
        const radius = frameW * 0.14; // Squircle radius

        ctx.save();
        ctx.beginPath();
        ctx.roundRect(photoX, photoY, photoW, photoH, radius);
        ctx.clip();

        if (avatarImg) {
            // Simulate object-fit: cover
            const imgRatio = avatarImg.naturalWidth / avatarImg.naturalHeight;
            const targetRatio = photoW / photoH;
            let sx = 0, sy = 0, sw = avatarImg.naturalWidth, sh = avatarImg.naturalHeight;
            if (imgRatio > targetRatio) { sw = sh * targetRatio; sx = (avatarImg.naturalWidth - sw) / 2; }
            else { sh = sw / targetRatio; sy = (avatarImg.naturalHeight - sh) / 2; }

            ctx.drawImage(avatarImg, sx, sy, sw, sh, photoX, photoY, photoW, photoH);
        } else {
            AssetLoader.loadImage(avatarUrl);
            ctx.fillStyle = ColorTokens.metallic.dark;
            ctx.fillRect(photoX, photoY, photoW, photoH);
            ctx.font = `700 ${LayoutConstants.Fonts.Size.XXLarge}px ${LayoutConstants.Fonts.Family.Heading}`;
            ctx.fillStyle = ColorTokens.text.primary;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText('BR', photoX + photoW / 2, photoY + photoH / 2);
        }
        ctx.restore();

        if (frameImg) {
            ctx.drawImage(frameImg, frameX, frameY, frameW, frameH);
        } else {
            AssetLoader.loadImage(frameUrl);
        }

        ctx.save();
        ctx.fillStyle = ColorTokens.text.primary;
        ctx.font = `600 ${LayoutConstants.Fonts.Size.Hero}px ${LayoutConstants.Fonts.Family.Display}`;
        ctx.textAlign = 'left';
        ctx.textBaseline = 'top';
        ctx.fillText(this.userProfile?.name || DEFAULT_USER_NAME, avatarRect.x + avatarRect.width + 24, panelRect.y + 32);

        ctx.font = `${LayoutConstants.Fonts.Size.Medium}px ${LayoutConstants.Fonts.Family.Body}`;
        ctx.fillStyle = ColorTokens.text.secondary;
        ctx.fillText(
            `${stats.gamesPlayed} games • ${stats.winStreak} streak • ${stats.ballsPotted} pots`,
            avatarRect.x + avatarRect.width + 24,
            panelRect.y + 80
        );

        ctx.font = `${LayoutConstants.Fonts.Size.Small}px ${LayoutConstants.Fonts.Family.Body}`;
        ctx.fillStyle = ColorTokens.text.muted;
        ctx.fillText(`Overall rank: ${this.deriveRank(stats)}`, avatarRect.x + avatarRect.width + 24, panelRect.y + 108);
        ctx.restore();
    }

    private renderStats(ctx: CanvasRenderingContext2D, width: number, navHeight: number, stats: UserStats) {
        const panelRect = this.layout?.statsRect ?? {
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
            ctx.fillStyle = ColorTokens.background.overlay;
            ctx.fillRect(x, y, cardWidth - 20, 90);
            ctx.fillStyle = card.accent;
            ctx.fillRect(x, y, 4, 90);
            ctx.fillStyle = ColorTokens.text.secondary;
            ctx.font = `12px ${LayoutConstants.Fonts.Family.Body}`;
            ctx.fillText(card.label.toUpperCase(), x + 16, y + 20);
            ctx.fillStyle = ColorTokens.text.primary;
            ctx.font = `600 26px ${LayoutConstants.Fonts.Family.Heading}`;
            ctx.fillText(card.value, x + 16, y + 60);
            ctx.restore();
        });
    }

    private renderAchievements(ctx: CanvasRenderingContext2D, width: number, height: number, navHeight: number, stats: UserStats) {
        const panelRect = this.layout?.achievementsRect ?? {
            x: width * 0.08,
            y: navHeight + 420,
            width: width * 0.84,
            height: Math.max(220, height - (navHeight + 420) - 30)
        };
        drawPanel(ctx, panelRect);

        ctx.save();
        ctx.fillStyle = ColorTokens.text.primary;
        ctx.font = `${LayoutConstants.Fonts.Weight.SemiBold} 20px ${LayoutConstants.Fonts.Family.Heading}`;
        ctx.fillText('Recent Achievements', panelRect.x + 30, panelRect.y + 40);

        const achievements = this.getAchievementProgress(stats);
        achievements.forEach((achievement, index) => {
            const rowY = panelRect.y + 80 + index * 70;
            ctx.fillStyle = ColorTokens.text.primary;
            ctx.font = `15px ${LayoutConstants.Fonts.Family.Body}`;
            ctx.fillText(achievement.title, panelRect.x + 30, rowY);

            ctx.fillStyle = ColorTokens.text.secondary;
            ctx.font = `13px ${LayoutConstants.Fonts.Family.Body}`;
            ctx.fillText(`${achievement.desc} (${achievement.current}/${achievement.target})`, panelRect.x + 30, rowY + 22);

            const barX = panelRect.x + panelRect.width - 220;
            const barY = rowY - 10;
            const barWidth = 180;
            ctx.fillStyle = ColorTokens.border.default;
            ctx.fillRect(barX, barY, barWidth, 10);
            ctx.fillStyle = ColorTokens.ui.teal;
            ctx.fillRect(barX, barY, barWidth * achievement.progress, 10);
        });
        ctx.restore();
    }

    private renderButtons(ctx: CanvasRenderingContext2D) {
        this.buttons.forEach((button) => {
            drawGlossyButton(ctx, button.rect, button.label, button.color, this.hoveredButton?.id === button.id);
        });
    }

    private getStatCards(stats: UserStats) {
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

    private getAchievementProgress(stats: UserStats) {
        const defs: AchievementDef[] = [
            { title: 'Rail Rush Veteran', desc: 'Clear 100 racks', key: 'gamesPlayed', target: 100 },
            { title: 'Precision Shooter', desc: 'Pocket 250 balls', key: 'ballsPotted', target: 250 },
            { title: 'Hot Streak', desc: 'Win 10 in a row', key: 'winStreak', target: 10 }
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

    private formatWinRate(stats: UserStats) {
        if (!stats.gamesPlayed) return '--';
        const rate = Math.round((stats.wins / stats.gamesPlayed) * 100);
        return `${rate}%`;
    }

    private deriveRank(stats: UserStats) {
        if (stats.wins >= 200) return 'Legend';
        if (stats.wins >= 120) return 'Vanguard';
        if (stats.wins >= 60) return 'Specialist';
        if (stats.wins >= 20) return 'Journeyman';
        return 'Rookie';
    }

    private clamp(value: number, min: number, max: number) {
        return Math.min(max, Math.max(min, value));
    }

    private getFrameForLeague(leagueId?: string): string {
        const id = (leagueId || '').toLowerCase();
        if (id.includes('diamond')) return AssetRegistry.frames.diamond();
        if (id.includes('platinum')) return AssetRegistry.frames.platinum();
        if (id.includes('gold')) return AssetRegistry.frames.gold();
        if (id.includes('silver')) return AssetRegistry.frames.silver();
        if (id.includes('grandmaster')) return AssetRegistry.frames.grandmaster();
        if (id.includes('master')) return AssetRegistry.frames.master();
        if (id.includes('elite')) return AssetRegistry.frames.elite();
        if (id.includes('emerald')) return AssetRegistry.frames.emerald();
        if (id.includes('crystal')) return AssetRegistry.frames.crystal();
        return AssetRegistry.frames.bronze();
    }
}
