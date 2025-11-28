import { UIScene } from '../SceneController';
import { UIState, uiStateMachine } from '../UIStateMachine';
import { Rect, drawGlossyButton } from '../components/UIComponents';
import { ColorTokens } from '../theme/ColorTokens';
import { LayoutConstants } from '../theme/LayoutConstants';
import { NavigationBar } from '../components/NavigationBar';
import { drawSceneBackground } from '../components/SceneBackground';
import { db } from '../../data/db';
import { UserProfile } from '../../data/models';
import { CLUBS } from '../../game/clubs/ClubRegistry';
import { sceneController } from '../SceneController';
import { ConfirmScene } from './ConfirmScene';
import { currencyStore } from '../CurrencyStore';
import { notificationService } from '../NotificationService';

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

                    // Deduct entry fee
                    const success = currencyStore.spendCoins(club.entryFee);
                    if (!success) {
                        notificationService.show('Not enough coins!', 'error', 2000);
                        return;
                    }

                    notificationService.show(`-${club.entryFee.toLocaleString()} coins`, 'info', 1500);

                    // Start Game with this club config
                    const game = (window as any).poolGame;
                    if (game && typeof game.startMatch === 'function') {
                        // Store entry fee for prize calculation on win
                        game.currentEntryFee = club.entryFee;
                        game.startMatch(club.id);
                    } else {
                        console.error('Game instance not found or startMatch not available');
                        // Refund if game didn't start
                        currencyStore.addCoins(club.entryFee);
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
        const cardHeight = 450;
        const gap = 20;
        const startY = this.layout.listRect.y + (this.layout.listRect.height - cardHeight) / 2;

        CLUBS.forEach((club, index) => {
            const cardX = gap + index * (cardWidth + gap) - this.scrollOffset;

            // Only render visible cards
            if (cardX + cardWidth > 0 && cardX < ctx.canvas.width) {
                const isCoinsLocked = this.userProfile!.coins < club.entryFee;
                const isTrophiesLocked = (this.userProfile!.trophies || 0) < club.minTrophies;
                const isLocked = isCoinsLocked || isTrophiesLocked;

                // --- Arcade Card Style ---
                const radius = 16;
                const frameWidth = 8;
                const bevelWidth = 4;
                const borderWidth = 2;

                ctx.save();

                // Shadow
                ctx.shadowColor = 'rgba(0,0,0,0.5)';
                ctx.shadowBlur = 20;
                ctx.shadowOffsetY = 10;

                // Outer Frame - Metallic/Wood-grain effect
                // Use darker colors for locked state
                const frameColorStart = isLocked ? '#444444' : '#8B7355';
                const frameColorMid = isLocked ? '#333333' : '#6B5745';
                const frameColorEnd = isLocked ? '#222222' : '#4B3725';

                ctx.beginPath();
                ctx.roundRect(cardX, startY, cardWidth, cardHeight, radius);
                const frameGradient = ctx.createLinearGradient(cardX, startY, cardX, startY + cardHeight);
                frameGradient.addColorStop(0, frameColorStart);
                frameGradient.addColorStop(0.5, frameColorMid);
                frameGradient.addColorStop(1, frameColorEnd);
                ctx.fillStyle = frameGradient;
                ctx.fill();

                // Metallic shine on frame
                if (!isLocked) {
                    const shineGradient = ctx.createLinearGradient(cardX, startY, cardX + cardWidth / 3, startY);
                    shineGradient.addColorStop(0, 'rgba(255, 255, 255, 0.4)');
                    shineGradient.addColorStop(0.5, 'rgba(255, 255, 255, 0.1)');
                    shineGradient.addColorStop(1, 'rgba(255, 255, 255, 0)');
                    ctx.fillStyle = shineGradient;
                    ctx.fill();
                }

                // Reset Shadow
                ctx.shadowColor = 'transparent';
                ctx.shadowBlur = 0;
                ctx.shadowOffsetY = 0;

                // Middle Bevel Layer
                const bevelX = cardX + frameWidth;
                const bevelY = startY + frameWidth;
                const bevelFullWidth = cardWidth - frameWidth * 2;
                const bevelFullHeight = cardHeight - frameWidth * 2;
                const bevelRadius = radius - frameWidth;

                ctx.beginPath();
                ctx.roundRect(bevelX, bevelY, bevelFullWidth, bevelFullHeight, bevelRadius);
                const bevelGradient = ctx.createLinearGradient(bevelX, bevelY, bevelX, bevelY + bevelFullHeight);
                bevelGradient.addColorStop(0, '#3a3a3a');
                bevelGradient.addColorStop(0.5, '#2a2a2a');
                bevelGradient.addColorStop(1, '#4a4a4a');
                ctx.fillStyle = bevelGradient;
                ctx.fill();

                // Bevel highlight
                ctx.strokeStyle = 'rgba(255, 255, 255, 0.15)';
                ctx.lineWidth = 1;
                ctx.stroke();

                // Inner Content Area
                const innerX = bevelX + bevelWidth;
                const innerY = bevelY + bevelWidth;
                const innerWidth = bevelFullWidth - bevelWidth * 2;
                const innerHeight = bevelFullHeight - bevelWidth * 2;
                const innerRadius = bevelRadius - bevelWidth;

                // Clip to inner area
                ctx.save();
                ctx.beginPath();
                ctx.roundRect(innerX, innerY, innerWidth, innerHeight, innerRadius);
                ctx.clip();

                // Background for content (Dark)
                ctx.fillStyle = '#1a1a1a';
                ctx.fill();

                // Header Gradient (Top half)
                const headerHeight = 160;
                const headerGrad = ctx.createLinearGradient(innerX, innerY, innerX, innerY + headerHeight);
                if (isLocked) {
                    headerGrad.addColorStop(0, '#333');
                    headerGrad.addColorStop(1, '#222');
                } else {
                    const hue = (index * 30) % 360;
                    headerGrad.addColorStop(0, `hsl(${hue}, 60%, 30%)`);
                    headerGrad.addColorStop(1, `hsl(${hue}, 60%, 15%)`);
                }
                ctx.fillStyle = headerGrad;
                ctx.fillRect(innerX, innerY, innerWidth, headerHeight);

                // Club Name
                ctx.fillStyle = isLocked ? '#888' : '#FFFFFF';
                ctx.font = `700 28px "Rajdhani", ${LayoutConstants.Fonts.Family.Heading}`;
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';
                ctx.shadowColor = 'rgba(0,0,0,0.5)';
                ctx.shadowBlur = 4;
                ctx.fillText(club.name, innerX + innerWidth / 2, innerY + headerHeight / 2);
                ctx.shadowBlur = 0;

                // Content Text
                const contentStartY = innerY + headerHeight + 20;

                // Entry Fee
                ctx.font = `600 16px ${LayoutConstants.Fonts.Family.Body}`;
                ctx.fillStyle = isLocked ? '#666' : '#AAAAAA';
                ctx.fillText('ENTRY FEE', innerX + innerWidth / 2, contentStartY);

                ctx.font = `800 24px ${LayoutConstants.Fonts.Family.Heading}`;
                ctx.fillStyle = isLocked ? '#888' : ColorTokens.currency.coins;
                ctx.fillText(club.entryFee.toLocaleString(), innerX + innerWidth / 2, contentStartY + 30);

                // Prize Pool
                ctx.font = `600 14px ${LayoutConstants.Fonts.Family.Body}`;
                ctx.fillStyle = isLocked ? '#555' : '#AAAAAA';
                ctx.fillText(`PRIZE: ${(club.entryFee * 2).toLocaleString()}`, innerX + innerWidth / 2, contentStartY + 60);

                // Trophy Requirement
                ctx.font = `700 14px ${LayoutConstants.Fonts.Family.Body}`;
                const trophyReq = club.minTrophies || 0;
                const trophyLocked = (this.userProfile!.trophies || 0) < trophyReq;

                if (trophyReq > 0) {
                    ctx.fillStyle = trophyLocked ? '#FF4444' : '#FFD700';
                    ctx.fillText(`🏆 ${trophyReq.toLocaleString()} REQUIRED`, innerX + innerWidth / 2, contentStartY + 90);
                } else {
                    ctx.fillStyle = '#666666';
                    ctx.fillText(`🏆 NO REQUIREMENT`, innerX + innerWidth / 2, contentStartY + 90);
                }

                ctx.restore(); // End Clip

                // Play Button (Inside the card, at bottom)
                const btnH = 48;
                const btnW = innerWidth - 40;
                const btnX = innerX + 20;
                const btnY = innerY + innerHeight - btnH - 20;

                const btnRect = { x: btnX, y: btnY, width: btnW, height: btnH };
                const btnLabel = isLocked ? 'LOCKED' : 'PLAY';
                const btnColor = isLocked ? '#333333' : '#00FF88'; // Use green for play to match arcade theme

                // Use drawGlossyButton for consistent look
                drawGlossyButton(ctx, btnRect, btnLabel, btnColor, false); // No hover state tracked for individual list items yet


                // Corner Decorations (Gold Accents)
                if (!isLocked) {
                    const cornerSize = 15;
                    const cornerInset = frameWidth + bevelWidth + 4;
                    ctx.strokeStyle = 'rgba(255, 215, 0, 0.8)'; // Gold
                    ctx.lineWidth = 2;

                    // Top-left
                    ctx.beginPath();
                    ctx.moveTo(cardX + cornerInset + cornerSize, startY + cornerInset);
                    ctx.lineTo(cardX + cornerInset, startY + cornerInset);
                    ctx.lineTo(cardX + cornerInset, startY + cornerInset + cornerSize);
                    ctx.stroke();

                    // Top-right
                    ctx.beginPath();
                    ctx.moveTo(cardX + cardWidth - cornerInset - cornerSize, startY + cornerInset);
                    ctx.lineTo(cardX + cardWidth - cornerInset, startY + cornerInset);
                    ctx.lineTo(cardX + cardWidth - cornerInset, startY + cornerInset + cornerSize);
                    ctx.stroke();

                    // Bottom-left
                    ctx.beginPath();
                    ctx.moveTo(cardX + cornerInset, startY + cardHeight - cornerInset - cornerSize);
                    ctx.lineTo(cardX + cornerInset, startY + cardHeight - cornerInset);
                    ctx.lineTo(cardX + cornerInset + cornerSize, startY + cardHeight - cornerInset);
                    ctx.stroke();

                    // Bottom-right
                    ctx.beginPath();
                    ctx.moveTo(cardX + cardWidth - cornerInset, startY + cardHeight - cornerInset - cornerSize);
                    ctx.lineTo(cardX + cardWidth - cornerInset, startY + cardHeight - cornerInset);
                    ctx.lineTo(cardX + cardWidth - cornerInset - cornerSize, startY + cardHeight - cornerInset);
                    ctx.stroke();
                }

                ctx.restore();
            }
        });
    }
}
