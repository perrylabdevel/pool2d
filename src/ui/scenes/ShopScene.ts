import { UIScene } from '../SceneController';
import { uiStateMachine, UIState } from '../UIStateMachine';
import { drawPanel, drawGlossyButton, drawCurrencyPill, drawRoundedRect, Rect, UIColors } from '../components/UIComponents';
import { ColorTokens } from '../theme/ColorTokens';
import { LayoutConstants } from '../theme/LayoutConstants';
import { NavigationBar } from '../components/NavigationBar';
import { SettingsManager } from '../SettingsManager';
import { notificationService } from '../NotificationService';
import { drawSceneBackground } from '../components/SceneBackground';

type ShopButton = {
    id: 'back' | 'equip';
    label: string;
    color: string;
    rect: Rect;
};

type CueCard = {
    id: string;
    name: string;
    rarity: 'COMMON' | 'RARE' | 'EPIC' | 'LEGENDARY';
    stickColor: string;
    tipColor: string;
    accent: string;
    desc: string;
};

const CUES: CueCard[] = [
    { id: 'default', name: 'Standard Issue', rarity: 'COMMON', stickColor: '#8B4513', tipColor: '#4A90E2', accent: '#F0A35E', desc: 'Reliable and sturdy house cue.' },
    { id: 'midnight', name: 'Midnight Stealth', rarity: 'RARE', stickColor: '#0F111A', tipColor: '#FF3333', accent: '#2B7FFF', desc: 'Matte stealth finish for precision strikes.' },
    { id: 'royal', name: 'Royal Oak', rarity: 'RARE', stickColor: '#5D4037', tipColor: '#FFD700', accent: '#D3A863', desc: 'Polished oak with gold accents.' },
    { id: 'cyber', name: 'Cyber Pulse', rarity: 'EPIC', stickColor: '#00B4FF', tipColor: '#FFFFFF', accent: '#7C5CFF', desc: 'Neon-infused composite material.' },
    { id: 'viper', name: 'Viper Strike', rarity: 'EPIC', stickColor: '#66FF00', tipColor: '#000000', accent: '#7AFF33', desc: 'Toxic finish that glows under low light.' },
    { id: 'inferno', name: 'Dragon\'s Breath', rarity: 'LEGENDARY', stickColor: '#FF3333', tipColor: '#FFD700', accent: '#FF7A18', desc: 'Forged in fire. Handle stays hot.' }
];

type Chip = {
    id: string;
    name: string;
    color: string; // The base color (becomes alt in swap)
    rarity: 'COMMON' | 'RARE' | 'EPIC' | 'LEGENDARY';
    desc: string;
};

const CHIPS: Chip[] = [
    { id: 'chip_red', name: 'Red Swapped', color: '#d72638', rarity: 'COMMON', desc: 'Classic red with inverted style.' },
    { id: 'chip_green', name: 'Green Swapped', color: '#1fbf75', rarity: 'COMMON', desc: 'Casino green for the high rollers.' },
    { id: 'chip_black', name: 'Black Swapped', color: '#1f252b', rarity: 'RARE', desc: 'Sleek black and gold elegance.' },
    { id: 'chip_blue', name: 'Blue Swapped', color: '#2d7dd2', rarity: 'RARE', desc: 'Cool blue for calm plays.' },
    { id: 'chip_purple', name: 'Purple Swapped', color: '#7b2cbf', rarity: 'EPIC', desc: 'Royal purple finish.' }
];

type ShopTab = 'CUES' | 'CHIPS';

export class ShopScene implements UIScene {
    private canvas: HTMLCanvasElement | null = null;
    private buttons: ShopButton[] = [];
    private hoveredButton: ShopButton | null = null;
    private hoveredCardIndex: number = -1;
    private selectedCardIndex: number = 0;
    private cardRects: Rect[] = [];
    private settingsManager = new SettingsManager();
    private equippedCueId: string = CUES[0].id;
    private equippedChipId: string = CHIPS[0].id;
    private currentTab: ShopTab = 'CUES';
    private tabRects: { [key in ShopTab]: Rect } = {
        CUES: { x: 0, y: 0, width: 0, height: 0 },
        CHIPS: { x: 0, y: 0, width: 0, height: 0 }
    };
    private navigationBar: NavigationBar;

    constructor() {
        this.syncEquippedCue();
        this.navigationBar = new NavigationBar({
            title: 'SHOP',
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
        this.syncEquippedCue();
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

        // Setup navigation bar
        this.navigationBar.setupLayout(width);
        const navHeight = this.navigationBar.getHeight();

        const horizontalPadding = Math.max(40, width * 0.05);

        // No footer buttons needed - cards are directly clickable
        this.buttons = [];

        const cardWidth = 240;
        const cardHeight = 320;
        const gap = 28;
        // Setup Tab Rects
        const tabWidth = 100;
        const tabHeight = 40;
        const tabY = navHeight + 30;
        const tabCenterX = width / 2;
        const totalTabsWidth = tabWidth * 2 + 10; // 10px gap between 2 tabs

        this.tabRects.CUES = { x: tabCenterX - totalTabsWidth / 2, y: tabY, width: tabWidth, height: tabHeight };
        this.tabRects.CHIPS = { x: tabCenterX - totalTabsWidth / 2 + tabWidth + 10, y: tabY, width: tabWidth, height: tabHeight };

        const items = this.currentTab === 'CUES' ? CUES : CHIPS;
        const columns = Math.max(1, Math.floor((width - horizontalPadding * 2) / (cardWidth + gap)));
        const startX = (width - Math.min(columns, items.length) * cardWidth - Math.max(0, Math.min(columns, items.length) - 1) * gap) / 2;
        const startY = navHeight + 100;

        this.cardRects = items.map((_item, index) => {
            const col = index % columns;
            const row = Math.floor(index / columns);
            return {
                x: startX + col * (cardWidth + gap),
                y: startY + row * (cardHeight + gap),
                width: cardWidth,
                height: cardHeight
            };
        });
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
            this.hoveredCardIndex = -1;
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

        this.hoveredCardIndex = -1;
        this.cardRects.forEach((cardRect, index) => {
            const { x: cx, y: cy, width: cw, height: ch } = cardRect;
            if (x >= cx && x <= cx + cw && y >= cy && y <= cy + ch) {
                this.hoveredCardIndex = index;
            }
        });

        // Check tabs
        if (x >= this.tabRects.CUES.x && x <= this.tabRects.CUES.x + this.tabRects.CUES.width &&
            y >= this.tabRects.CUES.y && y <= this.tabRects.CUES.y + this.tabRects.CUES.height) {
            this.canvas.style.cursor = 'pointer';
            return;
        }
        if (x >= this.tabRects.CHIPS.x && x <= this.tabRects.CHIPS.x + this.tabRects.CHIPS.width &&
            y >= this.tabRects.CHIPS.y && y <= this.tabRects.CHIPS.y + this.tabRects.CHIPS.height) {
            this.canvas.style.cursor = 'pointer';
            return;
        }

        const isPointer = Boolean(this.hoveredButton || this.hoveredCardIndex !== -1);
        this.canvas.style.cursor = isPointer ? 'pointer' : 'default';
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

        if (this.hoveredButton) {
            this.handleButtonClick(this.hoveredButton.id);
            return;
        }
        if (this.hoveredCardIndex !== -1) {
            this.selectedCardIndex = this.hoveredCardIndex;

            if (this.currentTab === 'CUES') {
                const cue = CUES[this.selectedCardIndex];
                if (cue && cue.id !== this.equippedCueId) {
                    this.settingsManager.saveUIColors({
                        cueStickColor: cue.stickColor,
                        cueTipColor: cue.tipColor
                    });
                    this.equippedCueId = cue.id;
                    notificationService.show(`${cue.name} ready to dominate!`, 'success', 2400);
                }
            } else {
                const chip = CHIPS[this.selectedCardIndex];
                if (chip && chip.id !== this.equippedChipId) {
                    // TODO: Save chip selection to settings if needed
                    this.equippedChipId = chip.id;
                    notificationService.show(`${chip.name} selected!`, 'success', 2400);
                }
            }
        }

        // Check tabs
        if (x >= this.tabRects.CUES.x && x <= this.tabRects.CUES.x + this.tabRects.CUES.width &&
            y >= this.tabRects.CUES.y && y <= this.tabRects.CUES.y + this.tabRects.CUES.height) {
            this.currentTab = 'CUES';
            this.selectedCardIndex = CUES.findIndex(c => c.id === this.equippedCueId);
            if (this.selectedCardIndex === -1) this.selectedCardIndex = 0;
            this.updateLayout();
            return;
        }
        if (x >= this.tabRects.CHIPS.x && x <= this.tabRects.CHIPS.x + this.tabRects.CHIPS.width &&
            y >= this.tabRects.CHIPS.y && y <= this.tabRects.CHIPS.y + this.tabRects.CHIPS.height) {
            this.currentTab = 'CHIPS';
            this.selectedCardIndex = CHIPS.findIndex(c => c.id === this.equippedChipId);
            if (this.selectedCardIndex === -1) this.selectedCardIndex = 0;
            this.updateLayout();
            return;
        }
    };

    private handleButtonClick(id: ShopButton['id']) {
        if (id === 'back') {
            uiStateMachine.transitionTo(UIState.LOBBY);
            return;
        }
        if (id === 'equip') {
            if (this.isSelectedCueEquipped()) return;
            const cue = CUES[this.selectedCardIndex];
            this.settingsManager.saveUIColors({
                cueStickColor: cue.stickColor,
                cueTipColor: cue.tipColor
            });
            this.equippedCueId = cue.id;
            notificationService.show(`${cue.name} ready to dominate!`, 'success', 2400);
        }
    }

    update(_dt: number): void { }

    render(ctx: CanvasRenderingContext2D): void {
        const width = ctx.canvas.width;
        const height = ctx.canvas.height;
        this.renderBackground(ctx, width, height);
        // Header is handled by NavigationBar
        this.renderTabs(ctx);
        this.renderCards(ctx);
        this.renderFooter(ctx);
        this.navigationBar.render(ctx, width);
    }

    private renderBackground(ctx: CanvasRenderingContext2D, width: number, height: number) {
        drawSceneBackground(ctx, width, height, 'blue');
    }

    private renderTabs(ctx: CanvasRenderingContext2D) {
        const drawTab = (rect: Rect, label: string, isActive: boolean) => {
            ctx.save();
            drawRoundedRect(ctx, rect.x, rect.y, rect.width, rect.height, 8);

            if (isActive) {
                ctx.fillStyle = ColorTokens.brand.primary;
                ctx.shadowColor = ColorTokens.brand.primary;
                ctx.shadowBlur = 10;
            } else {
                ctx.fillStyle = 'rgba(255, 255, 255, 0.1)';
                ctx.shadowBlur = 0;
            }
            ctx.fill();

            ctx.fillStyle = isActive ? '#000000' : '#FFFFFF';
            ctx.font = '700 14px "Rajdhani", sans-serif';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(label, rect.x + rect.width / 2, rect.y + rect.height / 2);
            ctx.restore();
        };

        drawTab(this.tabRects.CUES, 'CUES', this.currentTab === 'CUES');
        drawTab(this.tabRects.CHIPS, 'CHIPS', this.currentTab === 'CHIPS');
    }

    private renderCards(ctx: CanvasRenderingContext2D) {
        this.cardRects.forEach((rect, index) => {
            const isSelected = index === this.selectedCardIndex;
            const isHovered = index === this.hoveredCardIndex;

            if (this.currentTab === 'CUES') {
                const cue = CUES[index];
                if (cue) this.drawCueCard(ctx, rect, cue, isSelected, isHovered);
            } else {
                const chip = CHIPS[index];
                if (chip) this.drawChipCard(ctx, rect, chip, isSelected, isHovered);
            }
        });
    }

    private drawChipCard(ctx: CanvasRenderingContext2D, rect: Rect, chip: Chip, isSelected: boolean, isHovered: boolean) {
        const { x, y, width, height } = rect;
        const radius = LayoutConstants.Radii.Large;
        const frameWidth = 6; // Outer decorative frame
        const bevelWidth = 3; // Middle bevel layer
        const borderWidth = 2; // Inner border

        ctx.save();

        // Enhanced drop shadow
        if (isHovered || isSelected) {
            ctx.shadowColor = 'rgba(0, 0, 0, 0.6)';
            ctx.shadowBlur = 28;
            ctx.shadowOffsetY = 14;
        } else {
            ctx.shadowColor = 'rgba(0, 0, 0, 0.4)';
            ctx.shadowBlur = 20;
            ctx.shadowOffsetY = 10;
        }

        // Outer Frame - Metallic/Wood-grain effect
        drawRoundedRect(ctx, x, y, width, height, radius);
        const frameGradient = ctx.createLinearGradient(x, y, x, y + height);
        frameGradient.addColorStop(0, '#8B7355'); // Lighter wood/bronze
        frameGradient.addColorStop(0.5, '#6B5745'); // Mid wood/bronze
        frameGradient.addColorStop(1, '#4B3725'); // Darker wood/bronze
        ctx.fillStyle = frameGradient;
        ctx.fill();

        // Add metallic shine to frame
        const shineGradient = ctx.createLinearGradient(x, y, x + width / 3, y);
        shineGradient.addColorStop(0, 'rgba(255, 255, 255, 0.4)');
        shineGradient.addColorStop(0.5, 'rgba(255, 255, 255, 0.1)');
        shineGradient.addColorStop(1, 'rgba(255, 255, 255, 0)');
        ctx.fillStyle = shineGradient;
        ctx.fill();

        // Reset shadow for inner elements
        ctx.shadowColor = 'transparent';
        ctx.shadowBlur = 0;
        ctx.shadowOffsetY = 0;

        // Middle Bevel Layer - Creates depth with inverted gradient
        const bevelX = x + frameWidth;
        const bevelY = y + frameWidth;
        const bevelFullWidth = width - frameWidth * 2;
        const bevelFullHeight = height - frameWidth * 2;
        const bevelRadius = radius - frameWidth;

        drawRoundedRect(ctx, bevelX, bevelY, bevelFullWidth, bevelFullHeight, bevelRadius);
        const bevelGradient = ctx.createLinearGradient(bevelX, bevelY, bevelX, bevelY + bevelFullHeight);
        bevelGradient.addColorStop(0, '#3a3a3a'); // Dark top for inset look
        bevelGradient.addColorStop(0.5, '#2a2a2a'); // Mid
        bevelGradient.addColorStop(1, '#4a4a4a'); // Lighter bottom
        ctx.fillStyle = bevelGradient;
        ctx.fill();

        // Bevel highlight (top edge)
        drawRoundedRect(ctx, bevelX, bevelY, bevelFullWidth, bevelFullHeight, bevelRadius);
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.15)';
        ctx.lineWidth = 1;
        ctx.stroke();

        // Inner content area (inset from bevel)
        const innerX = bevelX + bevelWidth;
        const innerY = bevelY + bevelWidth;
        const innerWidth = bevelFullWidth - bevelWidth * 2;
        const innerHeight = bevelFullHeight - bevelWidth * 2;
        const innerRadius = bevelRadius - bevelWidth;

        // Background with radial gradient
        drawRoundedRect(ctx, innerX, innerY, innerWidth, innerHeight, innerRadius);
        const bgGradient = ctx.createRadialGradient(
            innerX + innerWidth / 2,
            innerY + innerHeight * 0.3,
            0,
            innerX + innerWidth / 2,
            innerY + innerHeight * 0.3,
            innerWidth * 0.8
        );
        bgGradient.addColorStop(0, 'rgba(40, 40, 50, 1)');
        bgGradient.addColorStop(1, ColorTokens.background.panel);
        ctx.fillStyle = bgGradient;
        ctx.fill();

        // Hover/Selection Glow
        if (isHovered || isSelected) {
            ctx.save();
            ctx.globalAlpha = isSelected ? 0.25 : 0.15;
            const glowGrad = ctx.createRadialGradient(
                innerX + innerWidth / 2,
                innerY + innerHeight * 0.4,
                0,
                innerX + innerWidth / 2,
                innerY + innerHeight * 0.4,
                innerWidth
            );
            glowGrad.addColorStop(0, chip.color); // Use chip color for glow
            glowGrad.addColorStop(0.6, 'transparent');
            ctx.fillStyle = glowGrad;
            ctx.fillRect(innerX, innerY, innerWidth, innerHeight);
            ctx.restore();
        }

        // Draw the Chip
        const chipSize = 120;
        const chipX = x + width / 2;
        const chipY = y + height * 0.4;
        this.drawChip(ctx, chipX, chipY, chipSize, chip.color);

        // RARITY BADGE - Top right corner with glow
        const rarityPadding = 16;
        const rarityHeight = 28;
        ctx.font = '700 11px "Rajdhani", "Montserrat", Arial';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        const rarityWidth = ctx.measureText(chip.rarity).width + 32;
        const rarityX = innerX + innerWidth - rarityWidth - rarityPadding;
        const rarityY = innerY + rarityPadding;

        // Rarity badge background with gradient
        drawRoundedRect(ctx, rarityX, rarityY, rarityWidth, rarityHeight, 6);
        const rarityColor = this.getRarityColor(chip.rarity);
        const rarityGradient = ctx.createLinearGradient(rarityX, rarityY, rarityX, rarityY + rarityHeight);
        rarityGradient.addColorStop(0, rarityColor);
        rarityGradient.addColorStop(1, adjustBrightness(rarityColor, -40));
        ctx.fillStyle = rarityGradient;
        ctx.fill();

        // Rarity badge glow
        ctx.shadowColor = rarityColor;
        ctx.shadowBlur = 12;
        ctx.strokeStyle = rarityColor;
        ctx.lineWidth = 2;
        ctx.stroke();
        ctx.shadowBlur = 0;
        ctx.shadowColor = 'transparent';

        // Rarity text
        ctx.fillStyle = '#FFFFFF';
        ctx.shadowColor = 'rgba(0, 0, 0, 0.8)';
        ctx.shadowBlur = 4;
        ctx.fillText(chip.rarity, rarityX + rarityWidth / 2, rarityY + rarityHeight / 2);
        ctx.shadowBlur = 0;
        ctx.shadowColor = 'transparent';

        // TEXT CONTENT - Bottom section with dramatic styling
        const textStartY = innerY + innerHeight - 90;

        // Chip Name - Large and bold with size adjustment
        ctx.save();
        ctx.textAlign = 'left';
        ctx.textBaseline = 'alphabetic';

        // Dynamically adjust font size to fit
        let nameFontSize = 22;
        ctx.font = `900 ${nameFontSize}px "Rajdhani", "Montserrat", Arial`;
        let nameText = chip.name.toUpperCase();
        let nameWidth = ctx.measureText(nameText).width;
        const maxNameWidth = innerWidth - 40;

        // Reduce font size if text is too wide
        while (nameWidth > maxNameWidth && nameFontSize > 16) {
            nameFontSize -= 1;
            ctx.font = `900 ${nameFontSize}px "Rajdhani", "Montserrat", Arial`;
            nameWidth = ctx.measureText(nameText).width;
        }

        // Name with strong shadow
        ctx.shadowColor = 'rgba(0, 0, 0, 0.9)';
        ctx.shadowBlur = 8;
        ctx.shadowOffsetX = 2;
        ctx.shadowOffsetY = 2;
        ctx.fillStyle = '#FFFFFF';
        ctx.fillText(nameText, innerX + 20, textStartY);
        ctx.shadowBlur = 0;
        ctx.shadowOffsetX = 0;
        ctx.shadowOffsetY = 0;

        // Accent line under name
        ctx.fillStyle = chip.color;
        ctx.fillRect(innerX + 20, textStartY + 4, Math.min(nameWidth, maxNameWidth), 3);
        ctx.restore();

        // Description text with accent color and word wrapping
        ctx.font = '600 11px "Nunito", Arial';
        ctx.fillStyle = chip.color;
        ctx.textAlign = 'left';
        ctx.textBaseline = 'top';
        ctx.shadowColor = 'rgba(0, 0, 0, 0.8)';
        ctx.shadowBlur = 6;

        // Word wrap the description
        const maxDescWidth = innerWidth - 40;
        const words = chip.desc.toUpperCase().split(' ');
        let line = '';
        let descY = textStartY + 16;
        const lineHeight = 14;

        for (let i = 0; i < words.length; i++) {
            const testLine = line + words[i] + ' ';
            const metrics = ctx.measureText(testLine);

            if (metrics.width > maxDescWidth && i > 0) {
                ctx.fillText(line, innerX + 20, descY);
                line = words[i] + ' ';
                descY += lineHeight;
            } else {
                line = testLine;
            }
        }
        ctx.fillText(line, innerX + 20, descY);

        ctx.shadowBlur = 0;
        ctx.shadowColor = 'transparent';

        // Equipped Badge
        if (chip.id === this.equippedChipId) {
            ctx.fillStyle = 'rgba(0, 0, 0, 0.7)'; // Dark overlay for equipped badge
            ctx.fillRect(innerX, innerY + innerHeight - 36, innerWidth, 36);
            ctx.fillStyle = ColorTokens.action.success;
            ctx.font = '600 14px "Montserrat", Arial';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText('EQUIPPED', innerX + innerWidth / 2, innerY + innerHeight - 18);
        }

        // Inner border (decorative line inside the frame)
        drawRoundedRect(ctx, innerX, innerY, innerWidth, innerHeight, innerRadius);
        ctx.strokeStyle = 'rgba(0, 0, 0, 0.5)';
        ctx.lineWidth = borderWidth;
        ctx.stroke();

        // Inner highlight (creates depth)
        const innerHighlightInset = borderWidth / 2;
        drawRoundedRect(
            ctx,
            innerX + innerHighlightInset,
            innerY + innerHighlightInset,
            innerWidth - innerHighlightInset * 2,
            innerHeight - innerHighlightInset * 2,
            innerRadius - innerHighlightInset
        );
        const highlightGradient = ctx.createLinearGradient(
            innerX,
            innerY,
            innerX,
            innerY + innerHeight / 4
        );
        highlightGradient.addColorStop(0, 'rgba(255, 255, 255, 0.2)');
        highlightGradient.addColorStop(1, 'rgba(255, 255, 255, 0)');
        ctx.strokeStyle = highlightGradient;
        ctx.lineWidth = 1;
        ctx.stroke();

        // Corner decorations (small accent lines at corners)
        const cornerSize = Math.min(20, innerWidth * 0.05);
        const cornerInset = frameWidth + bevelWidth + 2;
        ctx.strokeStyle = 'rgba(255, 215, 0, 0.6)'; // Gold accents
        ctx.lineWidth = 2;

        // Top-left corner
        ctx.beginPath();
        ctx.moveTo(x + cornerInset + cornerSize, y + cornerInset);
        ctx.lineTo(x + cornerInset, y + cornerInset);
        ctx.lineTo(x + cornerInset, y + cornerInset + cornerSize);
        ctx.stroke();

        // Top-right corner
        ctx.beginPath();
        ctx.moveTo(x + width - cornerInset - cornerSize, y + cornerInset);
        ctx.lineTo(x + width - cornerInset, y + cornerInset);
        ctx.lineTo(x + width - cornerInset, y + cornerInset + cornerSize);
        ctx.stroke();

        // Bottom-left corner
        ctx.beginPath();
        ctx.moveTo(x + cornerInset, y + height - cornerInset - cornerSize);
        ctx.lineTo(x + cornerInset, y + height - cornerInset);
        ctx.lineTo(x + cornerInset + cornerSize, y + height - cornerInset);
        ctx.stroke();

        // Bottom-right corner
        ctx.beginPath();
        ctx.moveTo(x + width - cornerInset, y + height - cornerInset - cornerSize);
        ctx.lineTo(x + width - cornerInset, y + height - cornerInset);
        ctx.lineTo(x + width - cornerInset - cornerSize, y + height - cornerInset);
        ctx.stroke();

        // Hover/Selected glow effect (outer glow)
        if (isHovered || isSelected) {
            drawRoundedRect(ctx, x - 2, y - 2, width + 4, height + 4, radius + 2);
            ctx.strokeStyle = isSelected ? chip.color : '#00B4FF';
            ctx.lineWidth = 4;
            ctx.shadowColor = isSelected ? `${chip.color}99` : 'rgba(0, 180, 255, 0.6)';
            ctx.shadowBlur = 20;
            ctx.stroke();
            ctx.shadowBlur = 0;
            ctx.shadowColor = 'transparent';
        }

        ctx.restore();
    }

    private drawChip(ctx: CanvasRenderingContext2D, x: number, y: number, size: number, color: string) {
        const radius = size / 2;

        // Colors derived from CSS .swap class
        const mainColor = '#ffffff';
        const altColor = color;

        ctx.save();
        ctx.translate(x, y);

        // 1. Base Background & Conic Gradient with Depth
        const segments = 12; // Reduced segments for chunkier, more premium look
        const segmentAngle = (Math.PI * 2) / segments;
        const offsetAngle = -15 * (Math.PI / 180);

        ctx.rotate(offsetAngle);

        // Draw base cylinder/edge depth (Shadow)
        ctx.beginPath();
        ctx.arc(0, 4, radius, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(0,0,0,0.2)';
        ctx.fill();

        for (let i = 0; i < segments; i++) {
            const start = i * segmentAngle;
            const mid = start + (segmentAngle / 2);
            const end = start + segmentAngle;

            // Alt color segment (Colored)
            ctx.beginPath();
            ctx.moveTo(0, 0);
            ctx.arc(0, 0, radius, start, mid);
            ctx.fillStyle = altColor;
            ctx.fill();

            // Add bevel highlight to colored segment
            ctx.beginPath();
            ctx.arc(0, 0, radius - 2, start, mid);
            ctx.strokeStyle = 'rgba(255,255,255,0.15)';
            ctx.lineWidth = 1;
            ctx.stroke();

            // Main color segment (White)
            ctx.beginPath();
            ctx.moveTo(0, 0);
            ctx.arc(0, 0, radius, mid, end);
            ctx.fillStyle = mainColor;
            ctx.fill();
        }

        // Reset rotation for overlays
        ctx.rotate(-offsetAngle);

        // 2. Radial Gradients Overlays (Lighting)
        // Top-left highlight
        const grad1 = ctx.createRadialGradient(-radius * 0.3, -radius * 0.3, 0, -radius * 0.3, -radius * 0.3, radius);
        grad1.addColorStop(0, 'rgba(255,255,255,0.25)');
        grad1.addColorStop(0.5, 'transparent');
        ctx.fillStyle = grad1;
        ctx.beginPath();
        ctx.arc(0, 0, radius, 0, Math.PI * 2);
        ctx.fill();

        // Bottom-right shadow
        const grad2 = ctx.createRadialGradient(radius * 0.3, radius * 0.3, 0, radius * 0.3, radius * 0.3, radius);
        grad2.addColorStop(0, 'rgba(0,0,0,0.05)');
        grad2.addColorStop(0.6, 'rgba(0,0,0,0.25)');
        ctx.fillStyle = grad2;
        ctx.beginPath();
        ctx.arc(0, 0, radius, 0, Math.PI * 2);
        ctx.fill();

        // 3. Inner Shadows (Box Shadow inset)
        const drawInsetRing = (r: number, width: number, color: string) => {
            ctx.beginPath();
            ctx.arc(0, 0, r, 0, Math.PI * 2);
            ctx.arc(0, 0, r - width, 0, Math.PI * 2, true);
            ctx.fillStyle = color;
            ctx.fill();
        };

        // Multiple rings for complex edge detail
        drawInsetRing(radius, 4, 'rgba(0,0,0,0.1)');
        drawInsetRing(radius - 4, 2, 'rgba(255,255,255,0.3)'); // Highlight ring

        // 4. Inner Disk
        const innerRadius = radius * 0.6;

        // Shadow under the inner disk
        ctx.beginPath();
        ctx.arc(0, 2, innerRadius, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(0,0,0,0.2)';
        ctx.fill();

        // Inner disk background
        const innerGrad = ctx.createRadialGradient(
            -innerRadius * 0.2, -innerRadius * 0.2, 0,
            0, 0, innerRadius
        );
        innerGrad.addColorStop(0, altColor);
        innerGrad.addColorStop(1, this.mixColor(altColor, '#000000', 0.8)); // Darker edge

        ctx.beginPath();
        ctx.arc(0, 0, innerRadius, 0, Math.PI * 2);
        ctx.fillStyle = innerGrad;
        ctx.fill();

        // Inner Pattern (Dashed Ring)
        ctx.beginPath();
        ctx.arc(0, 0, innerRadius * 0.8, 0, Math.PI * 2);
        ctx.strokeStyle = 'rgba(255,255,255,0.2)';
        ctx.lineWidth = 2;
        ctx.setLineDash([4, 4]);
        ctx.stroke();
        ctx.setLineDash([]);

        // Center indentation
        ctx.beginPath();
        ctx.arc(0, 0, innerRadius * 0.4, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(0,0,0,0.1)';
        ctx.fill();

        // Specular highlight on inner disk
        ctx.beginPath();
        ctx.ellipse(-innerRadius * 0.3, -innerRadius * 0.3, innerRadius * 0.15, innerRadius * 0.1, Math.PI / 4, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(255,255,255,0.4)';
        ctx.fill();

        // 5. Edge Notch Texture (The mask effect) - Refined
        const maskInner = radius * 0.75;
        ctx.save();
        ctx.beginPath();
        ctx.arc(0, 0, radius, 0, Math.PI * 2);
        ctx.arc(0, 0, maskInner, 0, Math.PI * 2, true);
        ctx.clip();

        const notchSegments = 24;
        const notchAngle = (Math.PI * 2) / notchSegments;

        for (let i = 0; i < notchSegments; i++) {
            const angle = i * notchAngle;
            // Draw small notches
            ctx.beginPath();
            ctx.moveTo(0, 0);
            ctx.arc(0, 0, radius * 1.1, angle, angle + notchAngle * 0.2);
            ctx.fillStyle = 'rgba(0,0,0,0.15)';
            ctx.fill();
        }
        ctx.restore();

        ctx.restore();
    }

    private hexToRgba(hex: string, alpha: number): string {
        const r = parseInt(hex.slice(1, 3), 16);
        const g = parseInt(hex.slice(3, 5), 16);
        const b = parseInt(hex.slice(5, 7), 16);
        return `rgba(${r}, ${g}, ${b}, ${alpha})`;
    }

    private mixColor(color1: string, color2: string, weight: number): string {
        // Simple linear interpolation
        const c1 = {
            r: parseInt(color1.slice(1, 3), 16),
            g: parseInt(color1.slice(3, 5), 16),
            b: parseInt(color1.slice(5, 7), 16)
        };
        const c2 = {
            r: parseInt(color2.slice(1, 3), 16),
            g: parseInt(color2.slice(3, 5), 16),
            b: parseInt(color2.slice(5, 7), 16)
        };

        const r = Math.round(c1.r * weight + c2.r * (1 - weight));
        const g = Math.round(c1.g * weight + c2.g * (1 - weight));
        const b = Math.round(c1.b * weight + c2.b * (1 - weight));

        return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
    }

    private drawCueCard(ctx: CanvasRenderingContext2D, rect: Rect, cue: CueCard, isSelected: boolean, isHovered: boolean) {
        const { x, y, width, height } = rect;
        const radius = LayoutConstants.Radii.Large;
        const frameWidth = 6; // Outer decorative frame
        const bevelWidth = 3; // Middle bevel layer
        const borderWidth = 2; // Inner border

        ctx.save();

        // Enhanced drop shadow
        if (isHovered || isSelected) {
            ctx.shadowColor = 'rgba(0, 0, 0, 0.6)';
            ctx.shadowBlur = 28;
            ctx.shadowOffsetY = 14;
        } else {
            ctx.shadowColor = 'rgba(0, 0, 0, 0.4)';
            ctx.shadowBlur = 20;
            ctx.shadowOffsetY = 10;
        }

        // Outer Frame - Metallic/Wood-grain effect
        drawRoundedRect(ctx, x, y, width, height, radius);
        const frameGradient = ctx.createLinearGradient(x, y, x, y + height);
        frameGradient.addColorStop(0, '#8B7355'); // Lighter wood/bronze
        frameGradient.addColorStop(0.5, '#6B5745'); // Mid wood/bronze
        frameGradient.addColorStop(1, '#4B3725'); // Darker wood/bronze
        ctx.fillStyle = frameGradient;
        ctx.fill();

        // Add metallic shine to frame
        const shineGradient = ctx.createLinearGradient(x, y, x + width / 3, y);
        shineGradient.addColorStop(0, 'rgba(255, 255, 255, 0.4)');
        shineGradient.addColorStop(0.5, 'rgba(255, 255, 255, 0.1)');
        shineGradient.addColorStop(1, 'rgba(255, 255, 255, 0)');
        ctx.fillStyle = shineGradient;
        ctx.fill();

        // Reset shadow for inner elements
        ctx.shadowColor = 'transparent';
        ctx.shadowBlur = 0;
        ctx.shadowOffsetY = 0;

        // Middle Bevel Layer - Creates depth with inverted gradient
        const bevelX = x + frameWidth;
        const bevelY = y + frameWidth;
        const bevelFullWidth = width - frameWidth * 2;
        const bevelFullHeight = height - frameWidth * 2;
        const bevelRadius = radius - frameWidth;

        drawRoundedRect(ctx, bevelX, bevelY, bevelFullWidth, bevelFullHeight, bevelRadius);
        const bevelGradient = ctx.createLinearGradient(bevelX, bevelY, bevelX, bevelY + bevelFullHeight);
        bevelGradient.addColorStop(0, '#3a3a3a'); // Dark top for inset look
        bevelGradient.addColorStop(0.5, '#2a2a2a'); // Mid
        bevelGradient.addColorStop(1, '#4a4a4a'); // Lighter bottom
        ctx.fillStyle = bevelGradient;
        ctx.fill();

        // Bevel highlight (top edge)
        drawRoundedRect(ctx, bevelX, bevelY, bevelFullWidth, bevelFullHeight, bevelRadius);
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.15)';
        ctx.lineWidth = 1;
        ctx.stroke();

        // Inner content area (inset from bevel)
        const innerX = bevelX + bevelWidth;
        const innerY = bevelY + bevelWidth;
        const innerWidth = bevelFullWidth - bevelWidth * 2;
        const innerHeight = bevelFullHeight - bevelWidth * 2;
        const innerRadius = bevelRadius - bevelWidth;

        // Background with radial gradient
        drawRoundedRect(ctx, innerX, innerY, innerWidth, innerHeight, innerRadius);
        const bgGradient = ctx.createRadialGradient(
            innerX + innerWidth / 2,
            innerY + innerHeight * 0.3,
            0,
            innerX + innerWidth / 2,
            innerY + innerHeight * 0.3,
            innerWidth * 0.8
        );
        bgGradient.addColorStop(0, 'rgba(40, 40, 50, 1)');
        bgGradient.addColorStop(1, ColorTokens.background.panel);
        ctx.fillStyle = bgGradient;
        ctx.fill();

        // Accent glow background effect
        if (isHovered || isSelected) {
            ctx.save();
            ctx.globalAlpha = isSelected ? 0.25 : 0.15;
            const glowGrad = ctx.createRadialGradient(
                innerX + innerWidth / 2,
                innerY + innerHeight * 0.4,
                0,
                innerX + innerWidth / 2,
                innerY + innerHeight * 0.4,
                innerWidth
            );
            glowGrad.addColorStop(0, cue.accent);
            glowGrad.addColorStop(0.6, 'transparent');
            ctx.fillStyle = glowGrad;
            ctx.fillRect(innerX, innerY, innerWidth, innerHeight);
            ctx.restore();
        }

        // Diagonal accent stripe pattern
        ctx.save();
        drawRoundedRect(ctx, innerX, innerY, innerWidth, innerHeight, innerRadius);
        ctx.clip();

        ctx.globalAlpha = 0.08;
        ctx.strokeStyle = cue.accent;
        ctx.lineWidth = 2;
        for (let i = -innerHeight; i < innerWidth + innerHeight; i += 20) {
            ctx.beginPath();
            ctx.moveTo(innerX + i, innerY);
            ctx.lineTo(innerX + i + innerHeight, innerY + innerHeight);
            ctx.stroke();
        }
        ctx.restore();

        // DRAMATIC CUE VISUALIZATION - Large diagonal cue
        const cueLength = innerWidth * 0.75;
        const cueThickness = 12;
        const cueStartX = innerX + innerWidth * 0.15;
        const cueStartY = innerY + innerHeight * 0.35;
        const cueEndX = cueStartX + cueLength;
        const cueEndY = cueStartY - cueLength * 0.3;

        ctx.save();
        // Cue shadow
        ctx.shadowColor = 'rgba(0, 0, 0, 0.6)';
        ctx.shadowBlur = 12;
        ctx.shadowOffsetX = 4;
        ctx.shadowOffsetY = 4;

        // Cue stick with gradient
        ctx.lineCap = 'round';
        ctx.lineWidth = cueThickness;
        const cueGradient = ctx.createLinearGradient(cueStartX, cueStartY, cueEndX, cueEndY);
        cueGradient.addColorStop(0, adjustBrightness(cue.stickColor, -30));
        cueGradient.addColorStop(0.5, cue.stickColor);
        cueGradient.addColorStop(1, adjustBrightness(cue.stickColor, 20));
        ctx.strokeStyle = cueGradient;
        ctx.beginPath();
        ctx.moveTo(cueStartX, cueStartY);
        ctx.lineTo(cueEndX, cueEndY);
        ctx.stroke();

        // Cue tip with glow
        ctx.shadowColor = cue.tipColor;
        ctx.shadowBlur = 15;
        ctx.fillStyle = cue.tipColor;
        ctx.beginPath();
        ctx.arc(cueStartX, cueStartY, cueThickness * 0.7, 0, Math.PI * 2);
        ctx.fill();

        // Accent band on cue
        const bandX = cueStartX + cueLength * 0.65;
        const bandY = cueStartY - cueLength * 0.3 * 0.65;
        ctx.shadowColor = cue.accent;
        ctx.shadowBlur = 10;
        ctx.strokeStyle = cue.accent;
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.arc(bandX, bandY, cueThickness * 0.75, 0, Math.PI * 2);
        ctx.stroke();

        ctx.restore();

        // RARITY BADGE - Top right corner with glow
        const rarityPadding = 16;
        const rarityHeight = 28;
        ctx.font = '700 11px "Rajdhani", "Montserrat", Arial';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        const rarityWidth = ctx.measureText(cue.rarity).width + 32;
        const rarityX = innerX + innerWidth - rarityWidth - rarityPadding;
        const rarityY = innerY + rarityPadding;

        // Rarity badge background with gradient
        drawRoundedRect(ctx, rarityX, rarityY, rarityWidth, rarityHeight, 6);
        const rarityColor = this.getRarityColor(cue.rarity);
        const rarityGradient = ctx.createLinearGradient(rarityX, rarityY, rarityX, rarityY + rarityHeight);
        rarityGradient.addColorStop(0, rarityColor);
        rarityGradient.addColorStop(1, adjustBrightness(rarityColor, -40));
        ctx.fillStyle = rarityGradient;
        ctx.fill();

        // Rarity badge glow
        ctx.shadowColor = rarityColor;
        ctx.shadowBlur = 12;
        ctx.strokeStyle = rarityColor;
        ctx.lineWidth = 2;
        ctx.stroke();
        ctx.shadowBlur = 0;
        ctx.shadowColor = 'transparent';

        // Rarity text
        ctx.fillStyle = '#FFFFFF';
        ctx.shadowColor = 'rgba(0, 0, 0, 0.8)';
        ctx.shadowBlur = 4;
        ctx.fillText(cue.rarity, rarityX + rarityWidth / 2, rarityY + rarityHeight / 2);
        ctx.shadowBlur = 0;
        ctx.shadowColor = 'transparent';

        // TEXT CONTENT - Bottom section with dramatic styling
        const textStartY = innerY + innerHeight - 90;

        // Cue name - Large and bold with size adjustment if needed
        ctx.save();
        ctx.textAlign = 'left';
        ctx.textBaseline = 'alphabetic';

        // Dynamically adjust font size to fit
        let nameFontSize = 22;
        ctx.font = `900 ${nameFontSize}px "Rajdhani", "Montserrat", Arial`;
        let nameText = cue.name.toUpperCase();
        let nameWidth = ctx.measureText(nameText).width;
        const maxNameWidth = innerWidth - 40;

        // Reduce font size if text is too wide
        while (nameWidth > maxNameWidth && nameFontSize > 16) {
            nameFontSize -= 1;
            ctx.font = `900 ${nameFontSize}px "Rajdhani", "Montserrat", Arial`;
            nameWidth = ctx.measureText(nameText).width;
        }

        // Name with strong shadow
        ctx.shadowColor = 'rgba(0, 0, 0, 0.9)';
        ctx.shadowBlur = 8;
        ctx.shadowOffsetX = 2;
        ctx.shadowOffsetY = 2;
        ctx.fillStyle = '#FFFFFF';
        ctx.fillText(nameText, innerX + 20, textStartY);
        ctx.shadowBlur = 0;
        ctx.shadowOffsetX = 0;
        ctx.shadowOffsetY = 0;

        // Accent line under name
        ctx.fillStyle = cue.accent;
        ctx.fillRect(innerX + 20, textStartY + 4, Math.min(nameWidth, maxNameWidth), 3);
        ctx.restore();

        // Description text with accent color and word wrapping
        ctx.font = '600 11px "Nunito", Arial';
        ctx.fillStyle = cue.accent;
        ctx.textAlign = 'left';
        ctx.textBaseline = 'top';
        ctx.shadowColor = 'rgba(0, 0, 0, 0.8)';
        ctx.shadowBlur = 6;

        // Word wrap the description
        const maxDescWidth = innerWidth - 40;
        const words = cue.desc.toUpperCase().split(' ');
        let line = '';
        let descY = textStartY + 16;
        const lineHeight = 14;

        for (let i = 0; i < words.length; i++) {
            const testLine = line + words[i] + ' ';
            const metrics = ctx.measureText(testLine);

            if (metrics.width > maxDescWidth && i > 0) {
                ctx.fillText(line, innerX + 20, descY);
                line = words[i] + ' ';
                descY += lineHeight;
            } else {
                line = testLine;
            }
        }
        ctx.fillText(line, innerX + 20, descY);

        ctx.shadowBlur = 0;
        ctx.shadowColor = 'transparent';

        // Equipped badge
        if (cue.id === this.equippedCueId) {
            ctx.fillStyle = 'rgba(0, 0, 0, 0.7)'; // Dark overlay for equipped badge
            ctx.fillRect(innerX, innerY + innerHeight - 36, innerWidth, 36);
            ctx.fillStyle = ColorTokens.action.success;
            ctx.font = '600 14px "Montserrat", Arial';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText('EQUIPPED', innerX + innerWidth / 2, innerY + innerHeight - 18);
        }

        // Inner border (decorative line inside the frame)
        drawRoundedRect(ctx, innerX, innerY, innerWidth, innerHeight, innerRadius);
        ctx.strokeStyle = 'rgba(0, 0, 0, 0.5)';
        ctx.lineWidth = borderWidth;
        ctx.stroke();

        // Inner highlight (creates depth)
        const innerHighlightInset = borderWidth / 2;
        drawRoundedRect(
            ctx,
            innerX + innerHighlightInset,
            innerY + innerHighlightInset,
            innerWidth - innerHighlightInset * 2,
            innerHeight - innerHighlightInset * 2,
            innerRadius - innerHighlightInset
        );
        const highlightGradient = ctx.createLinearGradient(
            innerX,
            innerY,
            innerX,
            innerY + innerHeight / 4
        );
        highlightGradient.addColorStop(0, 'rgba(255, 255, 255, 0.2)');
        highlightGradient.addColorStop(1, 'rgba(255, 255, 255, 0)');
        ctx.strokeStyle = highlightGradient;
        ctx.lineWidth = 1;
        ctx.stroke();

        // Corner decorations (small accent lines at corners)
        const cornerSize = Math.min(20, innerWidth * 0.05);
        const cornerInset = frameWidth + bevelWidth + 2;
        ctx.strokeStyle = 'rgba(255, 215, 0, 0.6)'; // Gold accents
        ctx.lineWidth = 2;

        // Top-left corner
        ctx.beginPath();
        ctx.moveTo(x + cornerInset + cornerSize, y + cornerInset);
        ctx.lineTo(x + cornerInset, y + cornerInset);
        ctx.lineTo(x + cornerInset, y + cornerInset + cornerSize);
        ctx.stroke();

        // Top-right corner
        ctx.beginPath();
        ctx.moveTo(x + width - cornerInset - cornerSize, y + cornerInset);
        ctx.lineTo(x + width - cornerInset, y + cornerInset);
        ctx.lineTo(x + width - cornerInset, y + cornerInset + cornerSize);
        ctx.stroke();

        // Bottom-left corner
        ctx.beginPath();
        ctx.moveTo(x + cornerInset, y + height - cornerInset - cornerSize);
        ctx.lineTo(x + cornerInset, y + height - cornerInset);
        ctx.lineTo(x + cornerInset + cornerSize, y + height - cornerInset);
        ctx.stroke();

        // Bottom-right corner
        ctx.beginPath();
        ctx.moveTo(x + width - cornerInset, y + height - cornerInset - cornerSize);
        ctx.lineTo(x + width - cornerInset, y + height - cornerInset);
        ctx.lineTo(x + width - cornerInset - cornerSize, y + height - cornerInset);
        ctx.stroke();

        // Hover/Selected glow effect (outer glow)
        if (isHovered || isSelected) {
            drawRoundedRect(ctx, x - 2, y - 2, width + 4, height + 4, radius + 2);
            ctx.strokeStyle = isSelected ? cue.accent : '#00B4FF';
            ctx.lineWidth = 4;
            ctx.shadowColor = isSelected ? `${cue.accent}99` : 'rgba(0, 180, 255, 0.6)';
            ctx.shadowBlur = 20;
            ctx.stroke();
            ctx.shadowBlur = 0;
            ctx.shadowColor = 'transparent';
        }

        ctx.restore();
    }

    private renderFooter(ctx: CanvasRenderingContext2D) {
        // No footer buttons - cards are directly clickable
        this.buttons.forEach((button) => {
            drawGlossyButton(ctx, button.rect, button.label, button.color, this.hoveredButton?.id === button.id);
        });
    }

    private getRarityColor(rarity: CueCard['rarity']) {
        switch (rarity) {
            case 'COMMON':
                return ColorTokens.ui.gray;
            case 'RARE':
                return ColorTokens.ui.teal;
            case 'EPIC':
                return ColorTokens.ui.purple;
            case 'LEGENDARY':
            default:
                return ColorTokens.text.primary;
        }
    }

    private syncEquippedCue() {
        const colors = this.settingsManager.getUIColors();
        const index = CUES.findIndex(
            (cue) =>
                cue.stickColor.toLowerCase() === colors.cueStickColor.toLowerCase() &&
                cue.tipColor.toLowerCase() === colors.cueTipColor.toLowerCase()
        );
        if (index >= 0) {
            this.selectedCardIndex = index;
            this.equippedCueId = CUES[index].id;
        } else {
            this.selectedCardIndex = 0;
            this.equippedCueId = CUES[0].id;
        }
    }

    private isSelectedCueEquipped() {
        const cue = CUES[this.selectedCardIndex];
        return cue ? cue.id === this.equippedCueId : false;
    }
}

// Helper function to adjust color brightness
function adjustBrightness(color: string, amount: number): string {
    // Convert hex to RGB
    const hex = color.replace('#', '');
    const r = Math.max(0, Math.min(255, parseInt(hex.substring(0, 2), 16) + amount));
    const g = Math.max(0, Math.min(255, parseInt(hex.substring(2, 4), 16) + amount));
    const b = Math.max(0, Math.min(255, parseInt(hex.substring(4, 6), 16) + amount));

    return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
}


