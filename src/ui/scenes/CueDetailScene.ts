import { UIScene } from '../SceneController';
import { UIState } from '../UIStateMachine';
import { NavigationBar } from '../components/NavigationBar';
import { drawRoundedRect } from '../components/UIComponents';
import { ColorTokens } from '../theme/ColorTokens';
import { LayoutConstants } from '../theme/LayoutConstants';
import { drawSceneBackground } from '../components/SceneBackground';
import { SettingsManager } from '../SettingsManager';
import { notificationService } from '../NotificationService';
import { CueStats } from '../../data/models';
import { db } from '../../data/db';

type CueSkin = {
    id: string;
    name: string;
    subtitle?: string;
    imageBase64: string;
    tipOffsetPx: number;
    lengthScale: number;
    thicknessScale: number;
    ppi: number;
    power?: number;
    accuracy?: number;
    spin?: number;
    aim?: number;
};

export type CueDetailData = {
    id: string;
    name: string;
    subtitle: string;
    rarity: 'COMMON' | 'RARE' | 'EPIC' | 'LEGENDARY';
    accent: string;
    previewUrl?: string;
    stats: CueStats;
    skin?: CueSkin;
    stickColor: string;
    tipColor: string;
};

type Button = {
    id: 'equip';
    label: string;
    rect: { x: number; y: number; width: number; height: number };
};

export class CueDetailScene implements UIScene {
    private canvas: HTMLCanvasElement | null = null;
    private navigationBar: NavigationBar;
    private cue: CueDetailData | null = null;
    private settingsManager = new SettingsManager();
    private button: Button | null = null;
    private hovered = false;
    private equippedCueId: string | null = null;
    private previewCache: Map<string, HTMLImageElement> = new Map();

    constructor() {
        this.navigationBar = new NavigationBar({
            title: 'CUE',
            showBack: true,
            backState: UIState.SHOP,
            showProfile: true,
            showCurrencies: true,
            showSettings: true
        });
    }

    setCue(cue: CueDetailData) {
        this.cue = cue;
    }

    mount(): void {
        this.canvas = document.getElementById('ui-stage') as HTMLCanvasElement;
        if (!this.canvas) return;
        this.loadEquippedCue();
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

    private async loadEquippedCue() {
        try {
            const user = await db.user.get(1);
            this.equippedCueId = user?.equippedCueId ?? null;
        } catch {
            this.equippedCueId = null;
        }
    }

    onResize(width: number, height: number): void {
        this.navigationBar.setupLayout(width, height);


        // Responsive button sizing
        const buttonWidth = Math.min(280, width * 0.5);
        const buttonHeight = 64;
        const buttonPadding = 24;

        this.button = {
            id: 'equip',
            label: 'EQUIP',
            rect: {
                x: (width - buttonWidth) / 2,
                y: height - buttonHeight - buttonPadding,
                width: buttonWidth,
                height: buttonHeight
            }
        };
    }

    update(_dt: number): void { }

    render(ctx: CanvasRenderingContext2D): void {
        const width = ctx.canvas.width;
        const height = ctx.canvas.height;
        drawSceneBackground(ctx, width, height, 'blue');
        this.navigationBar.render(ctx, width);

        if (!this.cue) {
            ctx.fillStyle = ColorTokens.text.primary;
            ctx.font = `${LayoutConstants.Fonts.Size.Large}px ${LayoutConstants.Fonts.Family.Body}`;
            ctx.textAlign = 'center';
            ctx.fillText('Select a cue in the shop.', width / 2, height / 2);
            return;
        }

        const navHeight = this.navigationBar.getHeight();
        const contentY = navHeight + 24;
        const bottomPadding = 110; // Space for button
        const contentH = height - contentY - bottomPadding;

        // Responsive panel width
        const isMobile = width < 768;
        const panelW = isMobile ? width * 0.92 : Math.min(600, width * 0.8);
        const panelX = (width - panelW) / 2;
        const panelH = contentH;

        // Draw Main Panel with Arcade Style
        this.renderArcadePanel(ctx, panelX, contentY, panelW, panelH);

        this.renderCueHeader(ctx, panelX, contentY, panelW);
        this.renderRarityBadge(ctx, panelX, contentY, panelW);
        this.renderCuePreview(ctx, panelX, contentY, panelW, panelH);
        this.renderStats(ctx, panelX, contentY, panelW, panelH);
        this.renderEquipButton(ctx);
    }

    private renderCueHeader(ctx: CanvasRenderingContext2D, x: number, y: number, width: number) {
        if (!this.cue) return;
        const titleY = y + 36;
        ctx.fillStyle = ColorTokens.text.primary;
        ctx.font = `900 26px ${LayoutConstants.Fonts.Family.Heading}`;
        ctx.textAlign = 'left';
        ctx.textBaseline = 'top';
        ctx.fillText(this.cue.name.toUpperCase(), x + 24, titleY);

        ctx.fillStyle = this.cue.accent;
        ctx.fillRect(x + 24, titleY + 30, Math.min(200, width * 0.3), 3);

        ctx.font = `${LayoutConstants.Fonts.Weight.SemiBold} 13px ${LayoutConstants.Fonts.Family.Body}`;
        ctx.fillStyle = ColorTokens.text.secondary;
        ctx.fillText(this.cue.subtitle, x + 24, titleY + 42);
    }

    private renderRarityBadge(ctx: CanvasRenderingContext2D, x: number, y: number, width: number) {
        if (!this.cue) return;
        const badgeText = this.cue.rarity;
        ctx.save();
        ctx.font = `${LayoutConstants.Fonts.Weight.Bold} 11px ${LayoutConstants.Fonts.Family.Game}`;
        const textW = ctx.measureText(badgeText).width;
        const badgeW = textW + 24;
        const badgeH = 28;
        const badgeX = x + width - badgeW - 20;
        const badgeY = y + 20;
        drawRoundedRect(ctx, badgeX, badgeY, badgeW, badgeH, 6);
        const rarityColor = this.getRarityColor(badgeText);
        const grad = ctx.createLinearGradient(badgeX, badgeY, badgeX, badgeY + badgeH);
        grad.addColorStop(0, rarityColor);
        grad.addColorStop(1, this.darkenColor(rarityColor, 35));
        ctx.fillStyle = grad;
        ctx.fill();
        ctx.strokeStyle = rarityColor;
        ctx.lineWidth = 1.5;
        ctx.shadowColor = rarityColor;
        ctx.shadowBlur = LayoutConstants.Shadows.Small.blur;
        ctx.stroke();
        ctx.shadowBlur = 0;
        ctx.shadowColor = 'transparent';

        ctx.fillStyle = ColorTokens.text.primary;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(badgeText, badgeX + badgeW / 2, badgeY + badgeH / 2);
        ctx.restore();
    }

    private renderCuePreview(ctx: CanvasRenderingContext2D, x: number, y: number, width: number, height: number) {
        if (!this.cue) return;
        const previewRect = {
            x: x + width * 0.1,
            y: y + height * 0.2,
            width: width * 0.8,
            height: height * 0.35
        };
        const img = this.getPreviewImage(this.cue.previewUrl);
        if (!img) {
            return;
        }
        const scale = Math.min(previewRect.width / img.width, previewRect.height / img.height);
        const drawW = img.width * scale;
        const drawH = img.height * scale;
        const drawX = previewRect.x + (previewRect.width - drawW) / 2;
        const drawY = previewRect.y + (previewRect.height - drawH) / 2;

        ctx.save();
        ctx.shadowColor = ColorTokens.effects.shadowHeavy;
        ctx.shadowBlur = LayoutConstants.Shadows.Glow.blur;
        ctx.shadowOffsetX = 3;
        ctx.shadowOffsetY = 3;
        ctx.drawImage(img, drawX, drawY, drawW, drawH);
        ctx.restore();
    }

    private renderStats(ctx: CanvasRenderingContext2D, x: number, y: number, width: number, height: number) {
        if (!this.cue) return;
        const stats = this.cue.stats;
        const startY = y + height * 0.6;
        const lineH = 28;
        const cap = 100;
        const labels: Array<{ label: string; value: number }> = [
            { label: 'POWER', value: stats.power },
            { label: 'ACCURACY', value: stats.accuracy },
            { label: 'SPIN', value: stats.spin },
            { label: 'AIM', value: stats.aim },
        ];

        const statsPanelX = x + width * 0.05;
        const statsPanelY = startY - 40;
        const statsPanelW = width * 0.9;
        const statsPanelH = lineH * labels.length + 60;

        // Render Inset Panel Background
        ctx.save();
        const radius = 12;
        drawRoundedRect(ctx, statsPanelX, statsPanelY, statsPanelW, statsPanelH, radius);

        // Inset gradient (darker at top)
        const insetGrad = ctx.createLinearGradient(statsPanelX, statsPanelY, statsPanelX, statsPanelY + statsPanelH);
        insetGrad.addColorStop(0, '#0a0a0a'); // Very dark at top
        insetGrad.addColorStop(1, '#1a1a1a'); // Slightly lighter at bottom
        ctx.fillStyle = insetGrad;
        ctx.fill();

        // Inner Shadow/Glow (top edge)
        ctx.strokeStyle = '#000000';
        ctx.lineWidth = 2;
        ctx.stroke();

        // Bottom Highlight (to accent the ledge)
        ctx.beginPath();
        ctx.moveTo(statsPanelX, statsPanelY + statsPanelH);
        ctx.lineTo(statsPanelX + statsPanelW, statsPanelY + statsPanelH);
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
        ctx.stroke();

        ctx.restore();

        // CAP text
        ctx.font = `${LayoutConstants.Fonts.Weight.Bold} 11px ${LayoutConstants.Fonts.Family.Game}`;
        ctx.textAlign = 'right';
        ctx.fillStyle = ColorTokens.text.muted;
        ctx.fillText('MAX 100', statsPanelX + statsPanelW - 20, statsPanelY + 20);

        const barX = statsPanelX + 100; // Fixed label width
        const barW = statsPanelW - 120 - 40; // Remaining width minus padding and value text space

        labels.forEach((item, index) => {
            const rowY = startY + index * lineH;

            // Label
            ctx.textAlign = 'left';
            ctx.fillStyle = ColorTokens.text.secondary;
            ctx.font = `${LayoutConstants.Fonts.Weight.Bold} 12px ${LayoutConstants.Fonts.Family.Game}`;
            ctx.fillText(item.label, statsPanelX + 20, rowY);

            // Bar Track (Background)
            drawRoundedRect(ctx, barX, rowY - 8, barW, 8, 4);
            ctx.fillStyle = 'rgba(255, 255, 255, 0.05)';
            ctx.fill();

            // Bar Track Inner Shadow
            ctx.strokeStyle = 'rgba(0, 0, 0, 0.5)';
            ctx.lineWidth = 1;
            ctx.stroke();

            // Bar Fill
            const clampedValue = Math.max(0, Math.min(cap, item.value));
            const fillW = Math.max(6, Math.min(barW, (clampedValue / cap) * barW));

            drawRoundedRect(ctx, barX, rowY - 8, fillW, 8, 4);
            // Gradient Fill for bar
            const barGrad = ctx.createLinearGradient(barX, rowY - 8, barX, rowY);
            const baseColor = this.getStatColor(clampedValue);
            barGrad.addColorStop(0, this.lightenColor(baseColor, 40));
            barGrad.addColorStop(0.5, baseColor);
            barGrad.addColorStop(1, this.darkenColor(baseColor, 20));
            ctx.fillStyle = barGrad;
            ctx.fill();

            // Bar Glint (Top)
            ctx.beginPath();
            ctx.moveTo(barX + 2, rowY - 6);
            ctx.lineTo(barX + fillW - 2, rowY - 6);
            ctx.strokeStyle = 'rgba(255, 255, 255, 0.4)';
            ctx.lineWidth = 1;
            ctx.stroke();

            // Value Text
            ctx.fillStyle = ColorTokens.text.primary;
            ctx.textAlign = 'right';
            ctx.font = `${LayoutConstants.Fonts.Weight.Bold} 14px ${LayoutConstants.Fonts.Family.Game}`;
            ctx.fillText(`${clampedValue}`, statsPanelX + statsPanelW - 20, rowY + 1);
        });
    }

    private lightenColor(hex: string, amount: number): string {
        const cleaned = hex.replace('#', '');
        const r = Math.min(255, parseInt(cleaned.substring(0, 2), 16) + amount);
        const g = Math.min(255, parseInt(cleaned.substring(2, 4), 16) + amount);
        const b = Math.min(255, parseInt(cleaned.substring(4, 6), 16) + amount);
        return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
    }

    private renderArcadePanel(ctx: CanvasRenderingContext2D, x: number, y: number, width: number, height: number) {
        const radius = 16;
        const frameWidth = 6;
        const bevelWidth = 3;
        const borderWidth = 2;

        ctx.save();

        // Outer Frame - Metallic/Wood-grain effect
        drawRoundedRect(ctx, x, y, width, height, radius);
        const frameGradient = ctx.createLinearGradient(x, y, x, y + height);
        frameGradient.addColorStop(0, ColorTokens.card.frame.light);
        frameGradient.addColorStop(0.5, ColorTokens.card.frame.mid);
        frameGradient.addColorStop(1, ColorTokens.card.frame.dark);
        ctx.fillStyle = frameGradient;
        ctx.fill();

        // Middle Bevel Layer
        const bevelX = x + frameWidth;
        const bevelY = y + frameWidth;
        const bevelW = width - frameWidth * 2;
        const bevelH = height - frameWidth * 2;
        const bevelRadius = radius - frameWidth;

        drawRoundedRect(ctx, bevelX, bevelY, bevelW, bevelH, bevelRadius);
        const bevelGradient = ctx.createLinearGradient(bevelX, bevelY, bevelX, bevelY + bevelH);
        bevelGradient.addColorStop(0, ColorTokens.card.bevel.top);
        bevelGradient.addColorStop(0.5, ColorTokens.card.bevel.mid);
        bevelGradient.addColorStop(1, ColorTokens.card.bevel.bottom);
        ctx.fillStyle = bevelGradient;
        ctx.fill();

        // Inner Content Area
        const innerX = bevelX + bevelWidth;
        const innerY = bevelY + bevelWidth;
        const innerW = bevelW - bevelWidth * 2;
        const innerH = bevelH - bevelWidth * 2;
        const innerRadius = bevelRadius - bevelWidth;

        drawRoundedRect(ctx, innerX, innerY, innerW, innerH, innerRadius);
        ctx.fillStyle = ColorTokens.background.panelSolid;
        ctx.fill();

        // Inner Border
        ctx.strokeStyle = ColorTokens.border.darkStrong;
        ctx.lineWidth = borderWidth;
        ctx.stroke();

        // Corner Accents
        const cornerSize = 12;
        const cornerInset = frameWidth + bevelWidth + 4;
        ctx.strokeStyle = ColorTokens.card.cornerAccent;
        ctx.lineWidth = 2;

        const corners = [
            { x: x + cornerInset, y: y + cornerInset }, // TL
            { x: x + width - cornerInset, y: y + cornerInset }, // TR
            { x: x + cornerInset, y: y + height - cornerInset }, // BL
            { x: x + width - cornerInset, y: y + height - cornerInset } // BR
        ];

        ctx.beginPath();
        // Top Left
        ctx.moveTo(corners[0].x, corners[0].y + cornerSize);
        ctx.lineTo(corners[0].x, corners[0].y);
        ctx.lineTo(corners[0].x + cornerSize, corners[0].y);
        // Top Right
        ctx.moveTo(corners[1].x - cornerSize, corners[1].y);
        ctx.lineTo(corners[1].x, corners[1].y);
        ctx.lineTo(corners[1].x, corners[1].y + cornerSize);
        // Bottom Left
        ctx.moveTo(corners[2].x, corners[2].y - cornerSize);
        ctx.lineTo(corners[2].x, corners[2].y);
        ctx.lineTo(corners[2].x + cornerSize, corners[2].y);
        // Bottom Right
        ctx.moveTo(corners[3].x - cornerSize, corners[3].y);
        ctx.lineTo(corners[3].x, corners[3].y);
        ctx.lineTo(corners[3].x, corners[3].y - cornerSize);
        ctx.stroke();

        ctx.restore();
    }

    private renderEquipButton(ctx: CanvasRenderingContext2D) {
        if (!this.button) return;
        const isEquipped = this.cue?.id && this.cue.id === this.equippedCueId;
        const label = isEquipped ? 'EQUIPPED' : 'EQUIP';
        const { x, y, width: w, height: h } = this.button.rect;

        const isHovered = this.hovered && !isEquipped;

        ctx.save();

        // Button Shadow
        if (isHovered) {
            ctx.shadowColor = ColorTokens.effects.shadowHeavy;
            ctx.shadowBlur = 12;
            ctx.shadowOffsetY = 4;
        } else {
            ctx.shadowColor = ColorTokens.effects.shadow;
            ctx.shadowBlur = 4;
            ctx.shadowOffsetY = 2;
        }

        // Use same arcade panel style for button but with action colors
        const radius = 12;
        const frameWidth = 4;

        // Outer Frame
        drawRoundedRect(ctx, x, y, w, h, radius);
        const frameGrad = ctx.createLinearGradient(x, y, x, y + h);
        frameGrad.addColorStop(0, '#5a5a5a');
        frameGrad.addColorStop(1, '#2a2a2a');
        ctx.fillStyle = frameGrad;
        ctx.fill();

        // Inner Bevel
        const innerX = x + frameWidth;
        const innerY = y + frameWidth;
        const innerW = w - frameWidth * 2;
        const innerH = h - frameWidth * 2;

        drawRoundedRect(ctx, innerX, innerY, innerW, innerH, radius - 2);

        if (isEquipped) {
            ctx.fillStyle = ColorTokens.ui.gray;
        } else {
            const btnGrad = ctx.createLinearGradient(innerX, innerY, innerX, innerY + innerH);
            btnGrad.addColorStop(0, isHovered ? '#4caf50' : '#388e3c');
            btnGrad.addColorStop(1, isHovered ? '#2e7d32' : '#1b5e20');
            ctx.fillStyle = btnGrad;
        }
        ctx.fill();

        // Inner Highlight
        ctx.strokeStyle = 'rgba(255,255,255,0.2)';
        ctx.lineWidth = 2;
        ctx.stroke();

        ctx.shadowColor = 'transparent';

        ctx.fillStyle = isEquipped ? ColorTokens.text.muted : ColorTokens.text.primary;
        ctx.font = `${LayoutConstants.Fonts.Weight.Black} 20px ${LayoutConstants.Fonts.Family.Game}`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.shadowColor = 'rgba(0,0,0,0.5)';
        ctx.shadowBlur = 2;
        ctx.fillText(label, x + w / 2, y + h / 2 + 1);

        ctx.restore();
    }

    private onMouseMove = (e: MouseEvent) => {
        if (!this.canvas || !this.button) return;
        const rect = this.canvas.getBoundingClientRect();
        const scaleX = this.canvas.width / rect.width;
        const scaleY = this.canvas.height / rect.height;
        const x = (e.clientX - rect.left) * scaleX;
        const y = (e.clientY - rect.top) * scaleY;

        if (this.navigationBar.handleMouseMove(x, y)) {
            this.canvas.style.cursor = this.navigationBar.getCursor();
            return;
        }

        const { x: bx, y: by, width, height } = this.button.rect;
        this.hovered = x >= bx && x <= bx + width && y >= by && y <= by + height;
        this.canvas.style.cursor = this.hovered ? 'pointer' : 'default';
    };

    private onClick = (e: MouseEvent) => {
        if (!this.canvas || !this.button || !this.cue) return;
        const rect = this.canvas.getBoundingClientRect();
        const scaleX = this.canvas.width / rect.width;
        const scaleY = this.canvas.height / rect.height;
        const x = (e.clientX - rect.left) * scaleX;
        const y = (e.clientY - rect.top) * scaleY;

        if (this.navigationBar.handleClick(x, y)) {
            return;
        }

        const { x: bx, y: by, width, height } = this.button.rect;
        if (x >= bx && x <= bx + width && y >= by && y <= by + height) {
            void this.equipCue();
        }
    };

    private async equipCue(): Promise<void> {
        if (!this.cue) return;
        const cueId = this.cue.id;
        if (cueId === this.equippedCueId) return;

        if (this.cue.skin) {
            this.applyCueSkin(this.cue.skin);
        } else {
            this.clearCueSkin();
            this.settingsManager.saveUIColors({
                cueStickColor: this.cue.stickColor,
                cueTipColor: this.cue.tipColor
            });
        }

        try {
            await db.user.update(1, { equippedCueId: cueId });
            const inventoryItems = await db.inventory.where('type').equals('cue').toArray();
            const updates: Promise<number>[] = [];
            inventoryItems.forEach(item => {
                if (!item.id) return;
                updates.push(db.inventory.update(item.id, { isEquipped: item.itemId === cueId }));
            });
            if (updates.length) await Promise.all(updates);

            const cueInventoryItems = await db.cueInventory.toArray();
            const cueUpdates: Promise<number>[] = [];
            cueInventoryItems.forEach(item => {
                if (!item.id) return;
                cueUpdates.push(db.cueInventory.update(item.id, { isEquipped: item.cueId === cueId }));
            });
            if (cueUpdates.length) await Promise.all(cueUpdates);
        } catch (e) {
            console.warn('Failed to equip cue:', e);
        }

        this.equippedCueId = cueId;
        notificationService.show(`${this.cue.name} equipped!`, 'success', LayoutConstants.Animation.Notification.Toast);
    }

    private applyCueSkin(skin: CueSkin) {
        try {
            localStorage.setItem('cue-editor-active-skin', skin.id);
        } catch {
            // ignore
        }
        window.dispatchEvent(new CustomEvent('cue-editor:apply-skin', {
            detail: {
                image: skin.imageBase64,
                tipOffsetPx: skin.tipOffsetPx,
                lengthScale: skin.lengthScale,
                thicknessScale: skin.thicknessScale,
                ppi: skin.ppi,
                power: skin.power,
                accuracy: skin.accuracy,
                spin: skin.spin,
                aim: skin.aim
            }
        }));
    }

    private clearCueSkin() {
        try {
            localStorage.removeItem('cue-editor-active-skin');
        } catch {
            // ignore
        }
        window.dispatchEvent(new CustomEvent('cue-editor:apply-skin', { detail: null }));
    }

    private getPreviewImage(url?: string): HTMLImageElement | null {
        if (!url) return null;
        const cached = this.previewCache.get(url);
        if (cached) {
            return cached.complete ? cached : null;
        }
        const img = new Image();
        img.src = url;
        this.previewCache.set(url, img);
        return null;
    }

    private getRarityColor(rarity: string): string {
        switch (rarity) {
            case 'COMMON':
                return ColorTokens.ui.gray;
            case 'RARE':
                return ColorTokens.ui.teal;
            case 'EPIC':
                return ColorTokens.ui.purple;
            case 'LEGENDARY':
            default:
                return ColorTokens.coin.gold;
        }
    }

    private getStatColor(value: number): string {
        if (value >= 80) return ColorTokens.coin.gold;
        if (value >= 65) return ColorTokens.ui.teal;
        if (value >= 50) return ColorTokens.action.warning;
        return ColorTokens.action.danger;
    }

    private darkenColor(hex: string, amount: number): string {
        const cleaned = hex.replace('#', '');
        const r = Math.max(0, Math.min(255, parseInt(cleaned.substring(0, 2), 16) - amount));
        const g = Math.max(0, Math.min(255, parseInt(cleaned.substring(2, 4), 16) - amount));
        const b = Math.max(0, Math.min(255, parseInt(cleaned.substring(4, 6), 16) - amount));
        return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
    }
}
