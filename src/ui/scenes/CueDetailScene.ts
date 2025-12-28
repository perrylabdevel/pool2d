import { UIScene } from '../SceneController';
import { uiStateMachine, UIState } from '../UIStateMachine';
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
        const navHeight = this.navigationBar.getHeight();
        const buttonWidth = Math.min(240, width * 0.4);
        const buttonHeight = 52;
        const buttonPadding = 18;
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

    update(_dt: number): void {}

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
        const contentY = navHeight + 20;
        const contentH = height - navHeight - 100;
        const panelX = width * 0.08;
        const panelW = width * 0.84;
        const panelH = contentH;

        ctx.save();
        drawRoundedRect(ctx, panelX, contentY, panelW, panelH, LayoutConstants.Radii.Large);
        ctx.fillStyle = ColorTokens.background.panelSolid;
        ctx.fill();
        ctx.strokeStyle = ColorTokens.border.default;
        ctx.lineWidth = LayoutConstants.Lines.Thin;
        ctx.stroke();
        ctx.restore();

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
        const barX = x + width * 0.18;
        const barW = width * 0.7;
        const lineH = 26;
        const cap = 100;
        const labels: Array<{ label: string; value: number }> = [
            { label: 'POWER', value: stats.power },
            { label: 'ACCURACY', value: stats.accuracy },
            { label: 'SPIN', value: stats.spin },
            { label: 'AIM', value: stats.aim },
        ];

        const statsPanelX = x + width * 0.06;
        const statsPanelY = startY - 30;
        const statsPanelW = width * 0.88;
        const statsPanelH = lineH * labels.length + 50;
        drawRoundedRect(ctx, statsPanelX, statsPanelY, statsPanelW, statsPanelH, 10);
        ctx.fillStyle = ColorTokens.background.overlay;
        ctx.fill();

        ctx.font = `${LayoutConstants.Fonts.Weight.Bold} 12px ${LayoutConstants.Fonts.Family.Body}`;
        ctx.textAlign = 'left';
        ctx.fillStyle = ColorTokens.text.muted;
        ctx.fillText('CAP: 100', statsPanelX + 16, statsPanelY + 12);
        labels.forEach((item, index) => {
            const rowY = startY + index * lineH;
            ctx.fillStyle = ColorTokens.text.secondary;
            ctx.fillText(item.label, x + 24, rowY);

            drawRoundedRect(ctx, barX, rowY - 10, barW, 8, 4);
            ctx.fillStyle = ColorTokens.background.overlay;
            ctx.fill();

            const clampedValue = Math.max(0, Math.min(cap, item.value));
            const fillW = Math.max(6, Math.min(barW, (clampedValue / cap) * barW));
            drawRoundedRect(ctx, barX, rowY - 10, fillW, 8, 4);
            ctx.fillStyle = this.getStatColor(clampedValue);
            ctx.fill();

            ctx.fillStyle = ColorTokens.text.primary;
            ctx.textAlign = 'right';
            ctx.fillText(`${clampedValue}`, barX + barW, rowY + 2);
            ctx.textAlign = 'left';
        });
    }

    private renderEquipButton(ctx: CanvasRenderingContext2D) {
        if (!this.button) return;
        const isEquipped = this.cue?.id && this.cue.id === this.equippedCueId;
        const label = isEquipped ? 'EQUIPPED' : 'EQUIP';
        const { x, y, width, height } = this.button.rect;

        drawRoundedRect(ctx, x, y, width, height, 10);
        ctx.fillStyle = isEquipped ? ColorTokens.ui.gray : ColorTokens.action.success;
        ctx.fill();

        ctx.strokeStyle = ColorTokens.border.emphasis;
        ctx.lineWidth = 1;
        ctx.stroke();

        ctx.fillStyle = ColorTokens.text.primary;
        ctx.font = `${LayoutConstants.Fonts.Weight.Bold} 14px ${LayoutConstants.Fonts.Family.Game}`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(label, x + width / 2, y + height / 2);
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
