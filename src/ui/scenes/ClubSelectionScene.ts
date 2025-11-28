import { UIScene } from '../SceneController';
import { UIState, uiStateMachine } from '../UIStateMachine';
import { Rect } from '../components/UIComponents';
import { ColorTokens } from '../theme/ColorTokens';
import { LayoutConstants } from '../theme/LayoutConstants';
import { NavigationBar } from '../components/NavigationBar';
import { drawSceneBackground } from '../components/SceneBackground';
import { db } from '../../data/db';
import { UserProfile } from '../../data/models';
import { CLUBS } from '../../game/clubs/ClubRegistry';
import { sceneController } from '../SceneController';
import { ConfirmScene } from './ConfirmScene';

export class ClubSelectionScene implements UIScene {
    private canvas: HTMLCanvasElement | null = null;
    private navigationBar: NavigationBar;
    private userProfile: UserProfile | null | undefined = null;

    private scrollOffset = 0;
    private maxScroll = 0;
    private touchStartX: number | null = null;
    private isDragging = false;

    private layout: {
        listRect: Rect;
    } | null = null;

    constructor() {
        this.navigationBar = new NavigationBar({
            title: 'SELECT CLUB',
            showBack: true,
            backState: UIState.LOBBY,
            showProfile: true,
            showCurrencies: true,
            showSettings: true
        });
    }

    mount(): void {
        console.log('ClubSelectionScene mounted');
        this.canvas = document.getElementById('ui-stage') as HTMLCanvasElement;
        if (!this.canvas) return;

        this.loadData();
        this.updateLayout();

        this.canvas.addEventListener('mousemove', this.onMouseMove);
        this.canvas.addEventListener('click', this.onClick);
        this.canvas.addEventListener('wheel', this.onWheel, { passive: true });
        this.canvas.addEventListener('touchstart', this.onTouchStart, { passive: true });
        this.canvas.addEventListener('touchmove', this.onTouchMove, { passive: true });
        this.canvas.addEventListener('touchend', this.onTouchEnd);
        window.addEventListener('resize', this.updateLayout);
    }

    unmount(): void {
        if (!this.canvas) return;
        this.canvas.removeEventListener('mousemove', this.onMouseMove);
        this.canvas.removeEventListener('click', this.onClick);
        this.canvas.removeEventListener('wheel', this.onWheel);
        this.canvas.removeEventListener('touchstart', this.onTouchStart);
        this.canvas.removeEventListener('touchmove', this.onTouchMove);
        this.canvas.removeEventListener('touchend', this.onTouchEnd);
        window.removeEventListener('resize', this.updateLayout);
        this.canvas.style.cursor = 'default';
    }

    private async loadData() {
        try {
            console.log('Loading user profile...');
            this.userProfile = await db.user.get(1);
            console.log('User profile loaded:', this.userProfile);
        } catch (e) {
            console.error('Failed to load user profile:', e);
        }
    }

    private updateLayout = () => {
        if (!this.canvas) return;
        const width = this.canvas.width;
        const height = this.canvas.height;
        const navHeight = this.navigationBar.getHeight();

        // Calculate total width of all cards + gaps
        const cardWidth = 300;
        const gap = 20;
        const totalContentWidth = CLUBS.length * (cardWidth + gap) + gap;

        this.maxScroll = Math.max(0, totalContentWidth - width);

        this.layout = {
            listRect: {
                x: 0,
                y: navHeight,
                width: width,
                height: height - navHeight
            }
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

        // Check hover on cards (optional visual feedback)
        this.canvas.style.cursor = 'default';
    };

    private onClick = (e: MouseEvent) => {
        if (!this.canvas || this.isDragging) return;
        const rect = this.canvas.getBoundingClientRect();
        const scaleX = this.canvas.width / rect.width;
        const scaleY = this.canvas.height / rect.height;
        const x = (e.clientX - rect.left) * scaleX;
        const y = (e.clientY - rect.top) * scaleY;

        if (this.navigationBar.handleClick(x, y)) {
            return;
        }

        // Handle Card Clicks
        if (this.layout) {
            const cardWidth = 300;
            const cardHeight = 400;
            const gap = 20;
            const startY = this.layout.listRect.y + (this.layout.listRect.height - cardHeight) / 2;

            CLUBS.forEach((club, index) => {
                const cardX = gap + index * (cardWidth + gap) - this.scrollOffset;

                if (x >= cardX && x <= cardX + cardWidth &&
                    y >= startY && y <= startY + cardHeight) {

                    this.handleClubSelect(club);
                }
            });
        }
    };

    private handleClubSelect(club: any) {
        if (!this.userProfile) return;

        // Check requirements
        const isCoinsLocked = this.userProfile.coins < club.entryFee;
        const isTrophiesLocked = (this.userProfile.trophies || 0) < club.minTrophies;

        if (isCoinsLocked) {
            alert(`Not enough coins! Need ${club.entryFee.toLocaleString()}`);
            return;
        }

        if (isTrophiesLocked) {
            alert(`Locked! You need ${club.minTrophies} trophies to enter.`);
            return;
        }

        // Configure Confirmation Scene
        const confirmScene = sceneController.getScene(UIState.CONFIRM) as ConfirmScene;
        if (confirmScene) {
            confirmScene.configure({
                title: `Enter ${club.name}?`,
                message: `Entry Fee: ${club.entryFee.toLocaleString()} coins\nPrize: ${(club.entryFee * 2).toLocaleString()} coins`,
                confirmLabel: 'PLAY',
                cancelLabel: 'CANCEL',
                returnState: UIState.CLUB_SELECTION,
                onConfirm: () => {
                    console.log(`Selected club: ${club.name}`);
                    // Start Game with this club config
                    const game = (window as any).poolGame;
                    if (game && typeof game.startMatch === 'function') {
                        game.startMatch(club.id);
                    } else {
                        console.error('Game instance not found or startMatch not available');
                    }
                    uiStateMachine.transitionTo(UIState.IN_GAME);
                }
            });
            uiStateMachine.transitionTo(UIState.CONFIRM);
        } else {
            console.error('ConfirmScene not found');
        }
    }

    private onWheel = (e: WheelEvent) => {
        const delta = e.deltaY + e.deltaX; // Allow both scroll directions
        this.scrollOffset = Math.max(0, Math.min(this.scrollOffset + delta, this.maxScroll));
    };

    private onTouchStart = (e: TouchEvent) => {
        if (e.touches.length > 0) {
            this.touchStartX = e.touches[0].clientX;
            this.isDragging = false;
        }
    };

    private onTouchMove = (e: TouchEvent) => {
        if (this.touchStartX === null) return;
        const currentX = e.touches[0].clientX;
        const delta = this.touchStartX - currentX;

        if (Math.abs(delta) > 5) this.isDragging = true;

        this.touchStartX = currentX;
        this.scrollOffset = Math.max(0, Math.min(this.scrollOffset + delta, this.maxScroll));
    };

    private onTouchEnd = () => {
        this.touchStartX = null;
        setTimeout(() => this.isDragging = false, 50); // Small delay to prevent click after drag
    };

    update(_dt: number): void { }

    render(ctx: CanvasRenderingContext2D): void {
        const width = ctx.canvas.width;
        const height = ctx.canvas.height;

        drawSceneBackground(ctx, width, height, 'purple'); // Use a different tint for variety

        if (this.layout) {
            this.renderClubs(ctx);
        }

        this.navigationBar.render(ctx, width);
    }

    private renderClubs(ctx: CanvasRenderingContext2D) {
        if (!this.layout) return;

        if (!this.userProfile) {
            ctx.fillStyle = '#FFFFFF';
            ctx.font = '24px Arial';
            ctx.textAlign = 'center';
            ctx.fillText('Loading...', ctx.canvas.width / 2, ctx.canvas.height / 2);
            return;
        }

        const cardWidth = 300;
        const cardHeight = 450; // Increased height
        const gap = 20;
        const startY = this.layout.listRect.y + (this.layout.listRect.height - cardHeight) / 2;

        CLUBS.forEach((club, index) => {
            const cardX = gap + index * (cardWidth + gap) - this.scrollOffset;

            // Only render visible cards
            if (cardX + cardWidth > 0 && cardX < ctx.canvas.width) {
                const isCoinsLocked = this.userProfile!.coins < club.entryFee;
                const isTrophiesLocked = (this.userProfile!.trophies || 0) < club.minTrophies;
                const isLocked = isCoinsLocked || isTrophiesLocked;

                // Card Background
                ctx.save();

                // Shadow
                ctx.shadowColor = 'rgba(0,0,0,0.5)';
                ctx.shadowBlur = 15;
                ctx.shadowOffsetY = 10;

                // Base
                ctx.fillStyle = isLocked ? '#2a2a2a' : '#1e2532';
                ctx.beginPath();
                ctx.roundRect(cardX, startY, cardWidth, cardHeight, 16);
                ctx.fill();

                // Reset Shadow
                ctx.shadowColor = 'transparent';
                ctx.shadowBlur = 0;
                ctx.shadowOffsetY = 0;

                // Header / Image Area (Placeholder)
                const headerHeight = 180;
                const headerGrad = ctx.createLinearGradient(cardX, startY, cardX, startY + headerHeight);
                if (isLocked) {
                    headerGrad.addColorStop(0, '#444');
                    headerGrad.addColorStop(1, '#333');
                } else {
                    // Generate a color based on index for variety
                    const hue = (index * 30) % 360;
                    headerGrad.addColorStop(0, `hsl(${hue}, 60%, 40%)`);
                    headerGrad.addColorStop(1, `hsl(${hue}, 60%, 20%)`);
                }

                ctx.fillStyle = headerGrad;
                ctx.beginPath();
                ctx.roundRect(cardX, startY, cardWidth, headerHeight, [16, 16, 0, 0]);
                ctx.fill();

                // Club Name
                ctx.fillStyle = isLocked ? '#888' : '#FFFFFF';
                ctx.font = `700 24px ${LayoutConstants.Fonts.Family.Heading}`;
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';
                ctx.fillText(club.name, cardX + cardWidth / 2, startY + headerHeight + 40);

                // Entry Fee
                ctx.font = `600 16px ${LayoutConstants.Fonts.Family.Body}`;
                ctx.fillStyle = isLocked ? '#666' : ColorTokens.currency.coins;
                ctx.fillText('Entry Fee:', cardX + cardWidth / 2, startY + headerHeight + 80);

                ctx.font = `800 24px ${LayoutConstants.Fonts.Family.Heading}`;
                ctx.fillStyle = isLocked ? '#888' : ColorTokens.currency.coins;
                ctx.fillText(club.entryFee.toLocaleString(), cardX + cardWidth / 2, startY + headerHeight + 110);

                // Prize Pool
                ctx.font = `600 14px ${LayoutConstants.Fonts.Family.Body}`;
                ctx.fillStyle = isLocked ? '#555' : ColorTokens.text.secondary;
                ctx.fillText(`Prize: ${(club.entryFee * 2).toLocaleString()}`, cardX + cardWidth / 2, startY + headerHeight + 145);

                // Trophy Requirement
                ctx.font = `700 14px ${LayoutConstants.Fonts.Family.Body}`;
                const trophyReq = club.minTrophies || 0;
                const trophyLocked = (this.userProfile!.trophies || 0) < trophyReq;

                // Render trophy text at +175, which is 180+175 = 355.
                // Button starts at 450 - 48 - 20 = 382.
                // 355 < 382. No overlap!
                if (trophyReq > 0) {
                    ctx.fillStyle = trophyLocked ? '#FF4444' : '#FFD700';
                    ctx.fillText(`🏆 Requires ${trophyReq.toLocaleString()}`, cardX + cardWidth / 2, startY + headerHeight + 175);
                } else {
                    ctx.fillStyle = '#888888';
                    ctx.fillText(`🏆 No Trophy Requirement`, cardX + cardWidth / 2, startY + headerHeight + 175);
                }

                // Play Button (Visual)
                const btnH = 48;
                const btnW = cardWidth - 40;
                const btnX = cardX + 20;
                const btnY = startY + cardHeight - btnH - 20;

                ctx.beginPath();
                ctx.roundRect(btnX, btnY, btnW, btnH, 24);
                if (isLocked) {
                    ctx.fillStyle = '#444';
                } else {
                    ctx.fillStyle = '#00B4FF'; // Hardcoded blue for now as action.primary might be missing
                }
                ctx.fill();

                ctx.fillStyle = isLocked ? '#888' : '#FFFFFF';
                ctx.font = `700 18px ${LayoutConstants.Fonts.Family.Heading}`;
                ctx.fillText(isLocked ? 'LOCKED' : 'PLAY', btnX + btnW / 2, btnY + btnH / 2 + 1);

                ctx.restore();
            }
        });
    }
}
