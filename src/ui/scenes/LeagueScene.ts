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
import { OPPONENTS } from '../../ai/OpponentRegistry';
import { LeagueService } from '../../game/leagues/LeagueService';

export class LeagueScene implements UIScene {
    private canvas: HTMLCanvasElement | null = null;
    private navigationBar: NavigationBar;
    private userProfile: UserProfile | null | undefined = null;
    private standingsCache: Record<string, Array<{ rank: number; name: string; score: number; isUser: boolean; avatar: string }>> = {};
    private scrollOffset = 0;
    private maxScroll = 0;
    private touchStartY: number | null = null;
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
        this.canvas.addEventListener('wheel', this.onWheel, { passive: true });
        this.canvas.addEventListener('touchstart', this.onTouchStart, { passive: true });
        this.canvas.addEventListener('touchmove', this.onTouchMove, { passive: true });
        window.addEventListener('resize', this.updateLayout);
    }

    unmount(): void {
        if (!this.canvas) return;
        this.canvas.removeEventListener('mousemove', this.onMouseMove);
        this.canvas.removeEventListener('click', this.onClick);
        this.canvas.removeEventListener('wheel', this.onWheel);
        this.canvas.removeEventListener('touchstart', this.onTouchStart);
        this.canvas.removeEventListener('touchmove', this.onTouchMove);
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
            y: headerRect.y + headerRect.height + gap + 10, // Add explicit top padding
            width: contentWidth,
            height: height - (headerRect.y + headerRect.height) - gap * 2 - 10
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

    private onWheel = (e: WheelEvent) => {
        if (!this.layout) return;
        const delta = e.deltaY;
        this.scrollOffset = Math.max(0, Math.min(this.scrollOffset + delta, this.maxScroll));
    };

    private onTouchStart = (e: TouchEvent) => {
        if (e.touches.length > 0) {
            this.touchStartY = e.touches[0].clientY;
        }
    };

    private onTouchMove = (e: TouchEvent) => {
        if (!this.layout || this.touchStartY === null) return;
        const currentY = e.touches[0].clientY;
        const delta = this.touchStartY - currentY;
        this.touchStartY = currentY;
        this.scrollOffset = Math.max(0, Math.min(this.scrollOffset + delta, this.maxScroll));
    };

    update(_dt: number): void { }

    private loadedSections: any[] | null = null;
    private isLoading = false;

    render(ctx: CanvasRenderingContext2D): void {
        const width = ctx.canvas.width;
        const height = ctx.canvas.height;
        this.renderBackground(ctx, width, height);

        if (this.userProfile && !this.loadedSections && !this.isLoading) {
            this.isLoading = true;
            this.getLeagueSections().then(sections => {
                this.loadedSections = sections;
                this.isLoading = false;

                // Recalculate max scroll once loaded
                const sectionHeaderH = 48;
                const rowH = 56;
                let totalHeight = 40;
                sections.forEach(section => {
                    totalHeight += sectionHeaderH + section.standings.length * rowH + 20;
                });
                if (this.layout) {
                    this.maxScroll = Math.max(0, totalHeight - this.layout.standingsRect.height);
                }
            });
        }

        if (this.layout && this.loadedSections) {
            const sections = this.loadedSections;
            const sectionHeaderH = 48;
            const rowH = 56;

            // Determine Active Section for Header
            let activeSection = sections[0];
            let currentH = 40; // Start after title

            for (const section of sections) {
                const sectionH = sectionHeaderH + section.standings.length * rowH + 20;
                if (this.scrollOffset < currentH + sectionH - sectionHeaderH) { // Switch when header pushes up
                    activeSection = section;
                    break;
                }
                currentH += sectionH;
            }

            // Render Header (Fixed)
            this.renderHeader(ctx, this.layout.headerRect, activeSection);

            // Render Standings (Scrollable)
            // Clip to standings rect
            ctx.save();
            ctx.beginPath();
            ctx.rect(this.layout.standingsRect.x, this.layout.standingsRect.y, this.layout.standingsRect.width, this.layout.standingsRect.height);
            ctx.clip();

            this.renderStandings(ctx, this.layout.standingsRect, sections);

            ctx.restore();
        } else {
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

    private renderHeader(ctx: CanvasRenderingContext2D, rect: Rect, section: any) {
        // Main Panel Background (Glass/Premium feel)
        ctx.save();

        // Drop shadow for the main header panel
        ctx.shadowColor = 'rgba(0, 0, 0, 0.5)';
        ctx.shadowBlur = 15;
        ctx.shadowOffsetY = 8;

        drawPanel(ctx, rect);

        // Reset shadow
        ctx.shadowColor = 'transparent';
        ctx.shadowBlur = 0;
        ctx.shadowOffsetY = 0;

        const colors = section.colors;
        const leagueDef = getLeagueById(section.id + '_1') || getLeagueById('bronze_1'); // Fallback

        // League Badge / Icon Area
        const badgeSize = 100;
        const badgeX = rect.x + 30;
        const badgeY = rect.y + (rect.height - badgeSize) / 2;

        // Badge Glow
        const glowGradient = ctx.createRadialGradient(
            badgeX + badgeSize / 2, badgeY + badgeSize / 2, 0,
            badgeX + badgeSize / 2, badgeY + badgeSize / 2, badgeSize
        );
        glowGradient.addColorStop(0, colors.primary);
        glowGradient.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = glowGradient;
        ctx.globalAlpha = 0.3;
        ctx.fillRect(badgeX - 20, badgeY - 20, badgeSize + 40, badgeSize + 40);
        ctx.globalAlpha = 1.0;

        // Badge Circle
        ctx.beginPath();
        ctx.arc(badgeX + badgeSize / 2, badgeY + badgeSize / 2, badgeSize / 2, 0, Math.PI * 2);
        const badgeGrad = ctx.createLinearGradient(badgeX, badgeY, badgeX + badgeSize, badgeY + badgeSize);
        badgeGrad.addColorStop(0, colors.primary);
        badgeGrad.addColorStop(1, colors.accent);
        ctx.fillStyle = badgeGrad;
        ctx.fill();

        // Badge Inner Border
        ctx.strokeStyle = 'rgba(255,255,255,0.3)';
        ctx.lineWidth = 3;
        ctx.stroke();

        // League Initial/Icon
        ctx.fillStyle = '#0b101c';
        ctx.font = `700 48px ${LayoutConstants.Fonts.Family.Heading}`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(section.id.charAt(0).toUpperCase(), badgeX + badgeSize / 2, badgeY + badgeSize / 2 + 2);

        // Text Content
        const textX = badgeX + badgeSize + 30;
        const textCenterY = rect.y + rect.height / 2;

        // League Name Logic
        // Always show generic name (e.g. BRONZE LEAGUE) to avoid confusion
        const displayName = section.title;

        ctx.fillStyle = '#FFFFFF';
        ctx.font = `800 36px ${LayoutConstants.Fonts.Family.Heading}`;
        ctx.textAlign = 'left';
        ctx.textBaseline = 'bottom';
        ctx.shadowColor = 'rgba(0,0,0,0.5)';
        ctx.shadowBlur = 4;
        ctx.fillText(displayName, textX, textCenterY - 4);
        ctx.shadowBlur = 0;

        // Prize Pool & Timer
        ctx.font = `600 16px ${LayoutConstants.Fonts.Family.Body}`;
        ctx.fillStyle = ColorTokens.text.secondary;
        ctx.textBaseline = 'top';
        ctx.fillText(`Prize Pool: `, textX, textCenterY + 8);

        const prizeX = textX + ctx.measureText('Prize Pool: ').width;
        ctx.fillStyle = ColorTokens.currency.coins;
        // Use prize pool from the section's base league definition (e.g. silver_1)
        // or just a generic value for visual consistency if needed.
        // Let's use the leagueDef we fetched.
        ctx.fillText(`${leagueDef?.prizePool.toLocaleString()} Coins`, prizeX, textCenterY + 8);

        // Timer Pill
        const timerText = 'Ends in: 2d 14h';
        const timerWidth = ctx.measureText(timerText).width + 24;
        const timerX = rect.x + rect.width - timerWidth - 30;
        const timerY = textCenterY - 14;

        ctx.beginPath();
        ctx.roundRect(timerX, timerY, timerWidth, 28, 14);
        ctx.fillStyle = 'rgba(0,0,0,0.3)';
        ctx.fill();
        ctx.strokeStyle = 'rgba(255,255,255,0.1)';
        ctx.lineWidth = 1;
        ctx.stroke();

        ctx.fillStyle = '#FFFFFF';
        ctx.font = `600 14px ${LayoutConstants.Fonts.Family.Body}`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(timerText, timerX + timerWidth / 2, timerY + 14);

        ctx.restore();
    }



    private async getLeagueSections() {
        const userLeagueId = this.userProfile?.leagueId || 'bronze_1';
        const userTier = userLeagueId.split('_')[0];

        // Order must match LeagueSystem.ts tiers
        const bases = ['bronze', 'silver', 'gold', 'platinum', 'diamond', 'master', 'grandmaster', 'elite', 'emerald', 'crystal'];

        const sections = await Promise.all(bases.map(async tier => {
            // If this is the user's tier, use their specific league ID (e.g. 'bronze_1')
            // Otherwise, default to the first division of that tier (e.g. 'silver_1')
            const isUserTier = tier === userTier;
            const queryId = isUserTier ? userLeagueId : `${tier}_1`;

            return {
                id: tier,
                title: `${tier.toUpperCase()} LEAGUE`,
                colors: this.getLeagueColors(tier),
                standings: await this.ensureMockStandings(queryId, isUserTier),
            };
        }));

        return sections;
    }

    private async ensureMockStandings(leagueId: string, includeUser: boolean) {
        // Use cached if available and fresh enough? 
        // For now, we'll fetch from DB every time to ensure sync, 
        // but we can cache in memory for this session.

        // Initialize if it's the user's league
        if (includeUser && this.userProfile) {
            await LeagueService.initializeLeagueIfNeeded(this.userProfile);
            // Simulate some progress
            await LeagueService.simulateAIProgress(leagueId);
        }

        const standings = await LeagueService.getStandings(leagueId);

        // If empty (e.g. non-user league not initialized), return mock data for display only
        if (standings.length === 0) {
            return this.generateVisualMock(leagueId);
        }

        // Map to format expected by render
        return standings.map(s => ({
            rank: s.rank,
            name: s.playerName,
            score: s.score,
            isUser: s.isUser,
            avatar: this.getAvatarUrl(s.avatarId)
        }));
    }

    // Fallback for leagues the user isn't in, just to show something pretty
    private generateVisualMock(leagueId: string) {
        if (this.standingsCache[leagueId]) return this.standingsCache[leagueId];

        const leagueTier = leagueId.split('_')[0];
        const leagueOpponents = OPPONENTS.filter(opp => opp.leagueId.startsWith(leagueTier));

        if (leagueOpponents.length === 0) return [];

        const standings = [];
        const baseScore = 150000 - ['bronze', 'silver', 'gold', 'platinum', 'diamond', 'master', 'grandmaster', 'elite', 'emerald', 'crystal'].indexOf(leagueTier) * 15000;

        let score = baseScore;
        for (let i = 0; i < 10; i++) {
            const opp = leagueOpponents[i % leagueOpponents.length];
            standings.push({
                rank: i + 1,
                name: opp.name,
                score: Math.floor(score),
                isUser: false,
                avatar: this.getAvatarUrl(opp.avatarId)
            });
            score -= Math.random() * 2000;
        }
        this.standingsCache[leagueId] = standings;
        return standings;
    }

    private getAvatarUrl(avatarId: string): string {
        const key = avatarId.replace(/^avatar_/, '');
        const registry = AssetRegistry.avatars as any;
        if (registry[key] && typeof registry[key] === 'function') {
            return registry[key]();
        }
        return AssetRegistry.avatars.default();
    }

    private getLeagueColors(leagueId: string): { primary: string; accent: string } {
        const id = leagueId.toLowerCase();
        if (id.includes('crystal')) return { primary: '#a3f0ff', accent: '#e0fbff' };
        if (id.includes('emerald')) return { primary: '#2fa54a', accent: '#7ae28c' };
        if (id.includes('elite')) return { primary: '#f26b1d', accent: '#ffb16c' };
        if (id.includes('grandmaster')) return { primary: '#7f4cc5', accent: '#c3a3f5' }; // Purple (Amethyst)
        if (id.includes('master')) return { primary: '#d32f2f', accent: '#ffcdd2' }; // Red (Ruby)
        if (id.includes('diamond')) return { primary: '#66d4ff', accent: '#b6f2ff' };
        if (id.includes('platinum')) return { primary: '#7ac3ff', accent: '#d7f1ff' };
        if (id.includes('gold')) return { primary: '#d6a014', accent: '#f9e59a' };
        if (id.includes('silver')) return { primary: '#8ea8c6', accent: '#d6e0eb' };
        return { primary: '#b06f2e', accent: '#f3c594' }; // bronze/default
    }

    private renderStandings(ctx: CanvasRenderingContext2D, rect: Rect, sections: any[]) {
        // Main container background
        drawPanel(ctx, rect);

        // Title
        ctx.fillStyle = '#FFFFFF';
        ctx.font = `700 24px ${LayoutConstants.Fonts.Family.Heading}`;
        ctx.textAlign = 'left';
        ctx.fillText('Standings', rect.x + 30, rect.y + 40 - this.scrollOffset);

        const sectionHeaderH = 48;
        const rowH = 56;
        const avatarSize = 36;

        // Content area (below title)
        const contentY = rect.y + 60;

        // 1. Render all rows first
        let currentY = contentY - this.scrollOffset;

        sections.forEach((section) => {
            const sectionStartY = currentY;
            const sectionH = sectionHeaderH + section.standings.length * rowH + 20;

            // Optimization: Only render if potentially visible in the viewport
            if (sectionStartY + sectionH > rect.y && sectionStartY < rect.y + rect.height) {
                // Rows start after header
                let rowY = sectionStartY + sectionHeaderH;

                section.standings.forEach((entry: any, index: number) => {
                    if (rowY + rowH > rect.y && rowY < rect.y + rect.height) {
                        const rowX = rect.x + 12;
                        const rowW = rect.width - 24;

                        // Row Background
                        if (entry.isUser) {
                            ctx.fillStyle = 'rgba(255, 215, 0, 0.15)';
                            ctx.fillRect(rowX, rowY, rowW, rowH);
                            ctx.fillStyle = ColorTokens.action.warning;
                            ctx.fillRect(rowX, rowY, 4, rowH);
                        } else if (index % 2 === 0) {
                            ctx.fillStyle = 'rgba(255, 255, 255, 0.03)';
                            ctx.fillRect(rowX, rowY, rowW, rowH);
                        }

                        // Rank
                        const rankColor = entry.rank <= 3 ? ColorTokens.action.warning : '#FFFFFF';
                        ctx.fillStyle = rankColor;
                        ctx.font = `700 18px ${LayoutConstants.Fonts.Family.Heading}`;
                        ctx.textAlign = 'center';
                        ctx.textBaseline = 'middle';
                        ctx.fillText(`#${entry.rank}`, rowX + 30, rowY + rowH / 2);

                        // Avatar
                        const avatarX = rowX + 60;
                        const avatarY = rowY + (rowH - avatarSize) / 2;

                        ctx.save();
                        ctx.beginPath();
                        ctx.arc(avatarX + avatarSize / 2, avatarY + avatarSize / 2, avatarSize / 2, 0, Math.PI * 2);
                        ctx.clip();

                        const avatarImg = AssetLoader.getCached(entry.avatar);
                        if (avatarImg) {
                            ctx.drawImage(avatarImg, avatarX, avatarY, avatarSize, avatarSize);
                        } else {
                            AssetLoader.loadImage(entry.avatar);
                            ctx.fillStyle = '#444';
                            ctx.fillRect(avatarX, avatarY, avatarSize, avatarSize);
                        }
                        ctx.restore();

                        // Avatar Border
                        ctx.beginPath();
                        ctx.arc(avatarX + avatarSize / 2, avatarY + avatarSize / 2, avatarSize / 2, 0, Math.PI * 2);
                        ctx.strokeStyle = entry.isUser ? ColorTokens.action.warning : 'rgba(255,255,255,0.2)';
                        ctx.lineWidth = 2;
                        ctx.stroke();

                        // Name
                        ctx.fillStyle = entry.isUser ? '#FFFFFF' : ColorTokens.text.primary;
                        ctx.font = `600 16px ${LayoutConstants.Fonts.Family.Body}`;
                        ctx.textAlign = 'left';
                        ctx.fillText(entry.name, avatarX + avatarSize + 16, rowY + rowH / 2 + 1);

                        // Score
                        ctx.fillStyle = ColorTokens.action.success;
                        ctx.font = `700 15px ${LayoutConstants.Fonts.Family.Body}`;
                        ctx.textAlign = 'right';
                        ctx.fillText(entry.score.toLocaleString(), rowX + rowW - 20, rowY + rowH / 2 + 1);

                        // Separator
                        ctx.fillStyle = 'rgba(255,255,255,0.05)';
                        ctx.fillRect(rowX + 10, rowY + rowH - 1, rowW - 20, 1);
                    }
                    rowY += rowH;
                });
            }
            currentY += sectionH;
        });

        // 2. Render Sticky Headers
        currentY = contentY - this.scrollOffset;

        sections.forEach((section) => {
            const sectionH = sectionHeaderH + section.standings.length * rowH + 20;
            const sectionTop = currentY;
            const sectionBottom = sectionTop + sectionH;

            // Check if this section is visible or active
            if (sectionBottom > rect.y) {
                // Calculate sticky position
                let headerY = sectionTop;

                // Sticky: clamp to top of visible area (rect.y)
                if (headerY < rect.y) {
                    headerY = rect.y;
                }

                // Push: if bottom of section is passing the header height, push header up
                const pushPoint = sectionBottom - sectionHeaderH;
                if (headerY > pushPoint) {
                    headerY = pushPoint;
                }

                // Only draw if within bounds (and visible)
                if (headerY < rect.y + rect.height) {
                    // Skip drawing sticky header if it's at the very top (active section)
                    // because the Main Header Card already shows this info.
                    if (headerY <= rect.y) {
                        // Do nothing, let the main header be the only header
                    } else {
                        // Draw Header
                        const grad = ctx.createLinearGradient(rect.x, headerY, rect.x + rect.width, headerY + sectionHeaderH);
                        grad.addColorStop(0, section.colors.primary);
                        grad.addColorStop(1, section.colors.accent);

                        ctx.fillStyle = grad;
                        ctx.beginPath();
                        ctx.roundRect(rect.x + 12, headerY, rect.width - 24, sectionHeaderH, [8, 8, 0, 0]);
                        ctx.fill();

                        // Shadow for sticky header
                        if (headerY === rect.y) {
                            ctx.fillStyle = 'rgba(0,0,0,0.3)';
                            ctx.fillRect(rect.x + 12, headerY + sectionHeaderH, rect.width - 24, 4);
                        }

                        // Header Text
                        ctx.fillStyle = '#0b101c';
                        ctx.font = `800 16px ${LayoutConstants.Fonts.Family.Heading}`;
                        ctx.textAlign = 'left';
                        ctx.textBaseline = 'middle';
                        ctx.fillText(section.title, rect.x + 30, headerY + sectionHeaderH / 2 + 1);
                    }
                }
            }

            currentY += sectionH;
        });
    }
}
