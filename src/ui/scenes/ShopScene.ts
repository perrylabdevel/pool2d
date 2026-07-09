import { UIScene, sceneController } from '../SceneController';
import { uiStateMachine, UIState } from '../UIStateMachine';
import { drawGlossyButton, drawRoundedRect, drawChip, Rect } from '../components/UIComponents';
import { ColorTokens } from '../theme/ColorTokens';
import { LayoutConstants } from '../theme/LayoutConstants';
import { NavigationBar } from '../components/NavigationBar';
import { SettingsManager } from '../SettingsManager';
import { notificationService } from '../NotificationService';
import { drawSceneBackground } from '../components/SceneBackground';
import { CONFIG } from '../../config';
import { DEFAULT_CUES } from '../../data/cues';
import { CueOwnership, CueStats } from '../../data/models';
import { db } from '../../data/db';

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
    stats: CueStats;
    previewUrl?: string;
    skin?: CueSkin;
};

type CueSkin = {
    id: string;
    name: string;
    subtitle?: string;
    imageBase64: string;
    thumbnail?: string;
    tipOffsetPx: number;
    lengthScale: number;
    thicknessScale: number;
    ppi: number;
    power?: number;
    accuracy?: number;
    spin?: number;
    aim?: number;
};

const DEFAULT_CUE_CARDS: CueCard[] = DEFAULT_CUES.map((cue) => ({
    id: cue.id,
    name: cue.name,
    rarity: cue.rarity,
    stickColor: cue.stickColor,
    tipColor: cue.tipColor,
    accent: cue.accent,
    desc: cue.subtitle,
    stats: cue.stats
}));

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
    private cues: CueCard[] = [];
    private cuePreviewCache: Map<string, HTMLImageElement> = new Map();
    private equippedCueId: string = '';
    private equippedChipId: string = CHIPS[0].id;
    private currentTab: ShopTab = 'CUES';
    private tabRects: { [key in ShopTab]: Rect } = {
        CUES: { x: 0, y: 0, width: 0, height: 0 },
        CHIPS: { x: 0, y: 0, width: 0, height: 0 }
    };
    private navigationBar: NavigationBar;
    private scrollOffset = 0;
    private maxScroll = 0;
    private touchStartY: number | null = null;
    private contentRect: Rect | null = null;

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
        if (CONFIG.USE_JSON_GEOMETRY) {
            this.loadCueSkins().catch(err => console.warn('Failed to load cue skins:', err));
        } else {
            this.cues = DEFAULT_CUE_CARDS;
            void this.syncCueInventory();
            this.syncEquippedCue();
        }
        this.updateLayout(this.canvas.width, this.canvas.height);
        this.canvas.addEventListener('mousemove', this.onMouseMove);
        this.canvas.addEventListener('click', this.onClick);
        this.canvas.addEventListener('wheel', this.onWheel, { passive: true });
        this.canvas.addEventListener('touchstart', this.onTouchStart, { passive: true });
        this.canvas.addEventListener('touchmove', this.onTouchMove, { passive: true });

    }

    unmount(): void {
        if (!this.canvas) return;
        this.canvas.removeEventListener('mousemove', this.onMouseMove);
        this.canvas.removeEventListener('click', this.onClick);
        this.canvas.removeEventListener('wheel', this.onWheel);
        this.canvas.removeEventListener('touchstart', this.onTouchStart);
        this.canvas.removeEventListener('touchmove', this.onTouchMove);

        this.canvas.style.cursor = 'default';
    }

    private async loadCueSkins(): Promise<void> {
        const skins = await this.fetchCueSkins();
        if (!skins.length) {
            this.cues = [];
            await this.syncCueInventory();
            this.syncEquippedCue();
            this.updateLayout(this.canvas?.width, this.canvas?.height);
            return;
        }

        this.cues = skins.map((skin, index) => ({
            id: skin.id,
            name: skin.name || `Cue ${index + 1}`,
            rarity: 'EPIC',
            stickColor: '#8B4513',
            tipColor: '#f5f5f5',
            accent: '#4A90E2',
            desc: (skin.subtitle && skin.subtitle.trim().length > 0)
                ? skin.subtitle
                : this.resolveCueSubtitle(skin.name),
            stats: this.getSkinStats(skin, index),
            previewUrl: skin.imageBase64,
            skin,
        }));

        if (this.cues.length === 0) {
            this.cues = [];
        }

        await this.syncCueInventory();
        this.syncEquippedCue();
        this.updateLayout(this.canvas?.width, this.canvas?.height);
    }

    private resolveCueSubtitle(name?: string): string {
        if (name) {
            const match = DEFAULT_CUE_CARDS.find((cue) => cue.name.toLowerCase() === name.toLowerCase());
            if (match) return match.desc;
        }
        const title = this.formatCueName(name);
        if (title) {
            return `${title} crafted for confident runouts.`;
        }
        return 'Custom cue crafted for confident runouts.';
    }

    private getDefaultSkinStats(index: number): CueStats {
        const base = 55;
        const bump = (index % 4) * 5;
        return {
            power: base + bump,
            accuracy: base + 5,
            spin: base + bump - 5,
            aim: base
        };
    }

    private getSkinStats(skin: CueSkin, index: number): CueStats {
        const hasStats = [skin.power, skin.accuracy, skin.spin, skin.aim].every((value) => typeof value === 'number');
        if (hasStats) {
            return {
                power: skin.power as number,
                accuracy: skin.accuracy as number,
                spin: skin.spin as number,
                aim: skin.aim as number
            };
        }
        return this.getDefaultSkinStats(index);
    }

    private async syncCueInventory(): Promise<void> {
        if (!this.cues.length) return;
        try {
            const user = await db.user.get(1);
            const cueItems = await db.inventory.where('type').equals('cue').toArray();
            const existing = new Map(cueItems.map(item => [item.itemId, item]));
            const cueInventoryItems = await db.cueInventory.toArray();
            const cueInventoryMap = new Map(cueInventoryItems.map(item => [item.cueId, item]));

            const missing = this.cues.filter(cue => !existing.has(cue.id)).map(cue => ({
                itemId: cue.id,
                type: 'cue' as const,
                acquiredDate: Date.now(),
                isEquipped: false
            }));

            if (missing.length) {
                await db.inventory.bulkAdd(missing);
                missing.forEach(item => existing.set(item.itemId, item));
            }

            const preferredCueId = user?.equippedCueId;
            const activeCueId = this.cues.some(cue => cue.id === preferredCueId)
                ? preferredCueId
                : this.cues[0].id;

            if (user && user.equippedCueId !== activeCueId) {
                await db.user.update(1, { equippedCueId: activeCueId });
            }

            const updates: Promise<number>[] = [];
            for (const item of existing.values()) {
                if (!item.id) continue;
                const shouldEquip = item.itemId === activeCueId;
                if (item.isEquipped !== shouldEquip) {
                    updates.push(db.inventory.update(item.id, { isEquipped: shouldEquip }));
                }
            }
            if (updates.length) await Promise.all(updates);

            const cueInventoryAdds: CueOwnership[] = [];
            this.cues.forEach(cue => {
                if (!cueInventoryMap.has(cue.id)) {
                    cueInventoryAdds.push({
                        cueId: cue.id,
                        acquiredDate: Date.now(),
                        isEquipped: cue.id === activeCueId
                    });
                }
            });
            if (cueInventoryAdds.length) {
                await db.cueInventory.bulkAdd(cueInventoryAdds);
                cueInventoryAdds.forEach(item => cueInventoryMap.set(item.cueId, item));
            }

            const cueInventoryUpdates: Promise<number>[] = [];
            for (const item of cueInventoryMap.values()) {
                if (!item.id) continue;
                const shouldEquip = item.cueId === activeCueId;
                if (item.isEquipped !== shouldEquip) {
                    cueInventoryUpdates.push(db.cueInventory.update(item.id, { isEquipped: shouldEquip }));
                }
            }
            if (cueInventoryUpdates.length) await Promise.all(cueInventoryUpdates);
        } catch (e) {
            console.warn('Failed to sync cue inventory:', e);
        }
    }

    private async persistEquippedCue(cueId: string): Promise<void> {
        try {
            await db.user.update(1, { equippedCueId: cueId });
            const cueItems = await db.inventory.where('type').equals('cue').toArray();
            const updates: Promise<number>[] = [];
            cueItems.forEach(item => {
                if (!item.id) return;
                const shouldEquip = item.itemId === cueId;
                if (item.isEquipped !== shouldEquip) {
                    updates.push(db.inventory.update(item.id, { isEquipped: shouldEquip }));
                }
            });
            if (updates.length) await Promise.all(updates);

            const cueInventoryItems = await db.cueInventory.toArray();
            const cueInventoryUpdates: Promise<number>[] = [];
            cueInventoryItems.forEach(item => {
                if (!item.id) return;
                const shouldEquip = item.cueId === cueId;
                if (item.isEquipped !== shouldEquip) {
                    cueInventoryUpdates.push(db.cueInventory.update(item.id, { isEquipped: shouldEquip }));
                }
            });
            if (cueInventoryUpdates.length) await Promise.all(cueInventoryUpdates);
        } catch (e) {
            console.warn('Failed to persist equipped cue:', e);
        }
    }

    private formatCueName(name?: string): string | null {
        if (!name) return null;
        const cleaned = name
            .replace(/^cue[_\-\s]+/i, '')
            .replace(/[_\-]+/g, ' ')
            .trim();
        if (!cleaned) return null;
        return cleaned.replace(/\b\w/g, (char) => char.toUpperCase());
    }

    private fetchCueSkins(): Promise<CueSkin[]> {
        return new Promise((resolve, reject) => {
            const request = indexedDB.open('RailRush_CueEditor', 1);
            request.onupgradeneeded = () => {
                const db = request.result;
                if (!db.objectStoreNames.contains('skins')) {
                    db.createObjectStore('skins', { keyPath: 'id' });
                }
            };
            request.onerror = () => reject(request.error);
            request.onsuccess = () => {
                const db = request.result;
                if (!db.objectStoreNames.contains('skins')) {
                    resolve([]);
                    return;
                }
                const tx = db.transaction('skins', 'readonly');
                const store = tx.objectStore('skins');
                const getAllRequest = store.getAll();
                getAllRequest.onsuccess = () => resolve(getAllRequest.result as CueSkin[]);
                getAllRequest.onerror = () => reject(getAllRequest.error);
            };
        });
    }

    private updateLayout = (width?: number, height?: number) => {
        if (!this.canvas) return;
        const canvasWidth = width ?? this.canvas.width;
        const canvasHeight = height ?? this.canvas.height;

        // Setup navigation bar with height for landscape detection
        this.navigationBar.setupLayout(canvasWidth, canvasHeight);
        const navHeight = this.navigationBar.getHeight();


        // No footer buttons needed - cards are directly clickable
        this.buttons = [];

        const padding = canvasWidth * LayoutConstants.Spacing.PaddingScreen;
        const contentWidth = canvasWidth - padding * 2;
        const gap = LayoutConstants.Spacing.GapLarge;

        // Setup Tab Rects
        const tabWidth = LayoutConstants.Tabs.Width;
        const tabHeight = LayoutConstants.Tabs.Height;
        const tabY = navHeight + LayoutConstants.Tabs.OffsetY;
        const tabCenterX = canvasWidth / 2;
        const totalTabsWidth = tabWidth * 2 + LayoutConstants.Tabs.Gap;

        this.tabRects.CUES = { x: tabCenterX - totalTabsWidth / 2, y: tabY, width: tabWidth, height: tabHeight };
        this.tabRects.CHIPS = { x: tabCenterX - totalTabsWidth / 2 + tabWidth + LayoutConstants.Tabs.Gap, y: tabY, width: tabWidth, height: tabHeight };

        const items = this.currentTab === 'CUES' ? this.cues : CHIPS;

        // Responsive column count
        const columns = canvasWidth < 720 ? 1 : canvasWidth < 1080 ? 2 : 3;

        // Responsive card dimensions
        const cardHeight = 400; // Fixed height for consistency
        const cardWidth = (contentWidth - gap * (columns - 1)) / columns;
        const contentStartY = tabY + tabHeight + 20;

        // Cards positioned relative to content start (y=0)
        this.cardRects = items.map((_item, index) => {
            const col = index % columns;
            const row = Math.floor(index / columns);
            return {
                x: padding + col * (cardWidth + gap),
                y: row * (cardHeight + gap),
                width: cardWidth,
                height: cardHeight
            };
        });

        // Define scrollable content area
        this.contentRect = {
            x: 0,
            y: contentStartY,
            width: canvasWidth,
            height: canvasHeight - contentStartY
        };

        // Calculate total content height
        const rows = Math.ceil(items.length / columns);
        const totalContentHeight = rows * cardHeight + (rows - 1) * gap + 40; // Add bottom padding

        // Calculate max scroll
        this.maxScroll = Math.max(0, totalContentHeight - this.contentRect.height);
        this.scrollOffset = Math.min(this.scrollOffset, this.maxScroll);
    };

    public onResize(width: number, height: number) {
        this.updateLayout(width, height);
    }

    private onWheel = (e: WheelEvent) => {
        if (!this.contentRect) return;
        const delta = e.deltaY;
        this.scrollOffset = Math.max(0, Math.min(this.scrollOffset + delta, this.maxScroll));
    };

    private onTouchStart = (e: TouchEvent) => {
        if (e.touches.length > 0) {
            this.touchStartY = e.touches[0].clientY;
        }
    };

    private onTouchMove = (e: TouchEvent) => {
        if (!this.contentRect || this.touchStartY === null) return;
        const currentY = e.touches[0].clientY;
        const delta = this.touchStartY - currentY;
        this.touchStartY = currentY;
        this.scrollOffset = Math.max(0, Math.min(this.scrollOffset + delta, this.maxScroll));
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

        this.hoveredCardIndex = this.getCardIndexAt(x, y);

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

        // Check tabs (before cards since tabs are fixed)
        if (x >= this.tabRects.CUES.x && x <= this.tabRects.CUES.x + this.tabRects.CUES.width &&
            y >= this.tabRects.CUES.y && y <= this.tabRects.CUES.y + this.tabRects.CUES.height) {
            this.currentTab = 'CUES';
            this.selectedCardIndex = this.cues.findIndex(c => c.id === this.equippedCueId);
            if (this.selectedCardIndex === -1) this.selectedCardIndex = 0;
            this.scrollOffset = 0; // Reset scroll on tab change
            this.updateLayout(this.canvas.width, this.canvas.height);
            return;
        }
        if (x >= this.tabRects.CHIPS.x && x <= this.tabRects.CHIPS.x + this.tabRects.CHIPS.width &&
            y >= this.tabRects.CHIPS.y && y <= this.tabRects.CHIPS.y + this.tabRects.CHIPS.height) {
            this.currentTab = 'CHIPS';
            this.selectedCardIndex = CHIPS.findIndex(c => c.id === this.equippedChipId);
            if (this.selectedCardIndex === -1) this.selectedCardIndex = 0;
            this.scrollOffset = 0; // Reset scroll on tab change
            this.updateLayout(this.canvas.width, this.canvas.height);
            return;
        }

        // Check buttons
        if (this.hoveredButton) {
            this.handleButtonClick(this.hoveredButton.id);
            return;
        }

        // Check cards
        const clickedCardIndex = this.getCardIndexAt(x, y);
        if (clickedCardIndex !== -1) {
            this.selectedCardIndex = clickedCardIndex;

            if (this.currentTab === 'CUES') {
                const cue = this.cues[this.selectedCardIndex];
                if (cue) {
                    const scene = sceneController.getScene(UIState.CUE_DETAIL) as any;
                    if (scene && typeof scene.setCue === 'function') {
                        scene.setCue({
                            id: cue.id,
                            name: cue.name,
                            subtitle: cue.desc,
                            rarity: cue.rarity,
                            accent: cue.accent,
                            previewUrl: cue.previewUrl,
                            stats: cue.stats,
                            skin: cue.skin,
                            stickColor: cue.stickColor,
                            tipColor: cue.tipColor
                        });
                    }
                    uiStateMachine.transitionTo(UIState.CUE_DETAIL);
                }
            } else {
                const chip = CHIPS[this.selectedCardIndex];
                if (chip && chip.id !== this.equippedChipId) {
                    // TODO: Save chip selection to settings if needed
                    this.equippedChipId = chip.id;
                    notificationService.show(`${chip.name} selected!`, 'success', LayoutConstants.Animation.Notification.Toast);
                }
            }
        }
    };

    private getCardIndexAt(x: number, y: number): number {
        if (!this.contentRect) return -1;
        const withinContent = (
            x >= this.contentRect.x &&
            x <= this.contentRect.x + this.contentRect.width &&
            y >= this.contentRect.y &&
            y <= this.contentRect.y + this.contentRect.height
        );
        if (!withinContent) return -1;

        const contentY = y - this.contentRect.y + this.scrollOffset;
        for (let index = 0; index < this.cardRects.length; index += 1) {
            const { x: cx, y: cy, width: cw, height: ch } = this.cardRects[index];
            if (x >= cx && x <= cx + cw && contentY >= cy && contentY <= cy + ch) {
                return index;
            }
        }
        return -1;
    }

    private handleButtonClick(id: ShopButton['id']) {
        if (id === 'back') {
            uiStateMachine.transitionTo(UIState.LOBBY);
            return;
        }
        if (id === 'equip') {
            if (this.isSelectedCueEquipped()) return;
            const cue = this.cues[this.selectedCardIndex];
            if (cue.skin) {
                this.applyCueSkin(cue);
            } else {
                this.clearCueSkin();
                this.settingsManager.saveUIColors({
                    cueStickColor: cue.stickColor,
                    cueTipColor: cue.tipColor
                });
            }
            this.equippedCueId = cue.id;
            void this.persistEquippedCue(cue.id);
            notificationService.show(`${cue.name} ready to dominate!`, 'success', LayoutConstants.Animation.Notification.Toast);
        }
    }

    update(_dt: number): void { }

    render(ctx: CanvasRenderingContext2D): void {
        const width = ctx.canvas.width;
        const height = ctx.canvas.height;
        this.renderBackground(ctx, width, height);
        this.renderTabs(ctx);
        this.navigationBar.render(ctx, width);

        // Render scrollable content (cards)
        if (this.contentRect) {
            ctx.save();
            ctx.beginPath();
            ctx.rect(this.contentRect.x, this.contentRect.y, this.contentRect.width, this.contentRect.height);
            ctx.clip();

            // Translate for scroll
            ctx.translate(0, -this.scrollOffset);
            // Translate to content start Y
            ctx.translate(0, this.contentRect.y);

            this.renderCards(ctx);

            ctx.restore();

            // Scrollbar
            if (this.maxScroll > 0) {
                const scrollRatio = this.contentRect.height / (this.contentRect.height + this.maxScroll);
                const barHeight = Math.max(30, this.contentRect.height * scrollRatio);
                const barY = this.contentRect.y + (this.scrollOffset / this.maxScroll) * (this.contentRect.height - barHeight);

                ctx.fillStyle = 'rgba(255, 255, 255, 0.2)';
                ctx.beginPath();
                ctx.roundRect(width - 8, barY, 4, barHeight, 2);
                ctx.fill();
            }
        }

        this.renderFooter(ctx);
    }

    private renderBackground(ctx: CanvasRenderingContext2D, width: number, height: number) {
        drawSceneBackground(ctx, width, height, 'blue');
    }

    private renderTabs(ctx: CanvasRenderingContext2D) {
        const drawTab = (rect: Rect, label: string, isActive: boolean) => {
            ctx.save();
            drawRoundedRect(ctx, rect.x, rect.y, rect.width, rect.height, LayoutConstants.Radii.Medium);

            if (isActive) {
                ctx.fillStyle = ColorTokens.brand.primary;
                ctx.shadowColor = ColorTokens.brand.primary;
                ctx.shadowBlur = LayoutConstants.Shadows.Glow.blur;
            } else {
                ctx.fillStyle = ColorTokens.border.default;
                ctx.shadowBlur = 0;
            }
            ctx.fill();

            ctx.fillStyle = isActive ? ColorTokens.text.dark : ColorTokens.text.primary;
            ctx.font = `${LayoutConstants.Fonts.Weight.Bold} ${LayoutConstants.Fonts.Size.Small}px ${LayoutConstants.Fonts.Family.Game}`;
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
                const cue = this.cues[index];
                if (cue) this.drawCueCard(ctx, rect, cue, isSelected, isHovered);
            } else {
                const chip = CHIPS[index];
                if (chip) this.drawChipCard(ctx, rect, chip, isSelected, isHovered);
            }
        });
    }

    private getCuePreviewImage(url?: string): HTMLImageElement | null {
        if (!url) return null;
        const cached = this.cuePreviewCache.get(url);
        if (cached) {
            return cached.complete ? cached : null;
        }
        const img = new Image();
        img.src = url;
        this.cuePreviewCache.set(url, img);
        return null;
    }

    private applyCueSkin(cue: CueCard) {
        if (!cue.skin) return;
        try {
            localStorage.setItem('cue-editor-active-skin', cue.skin.id);
        } catch (e) {
            // ignore storage failures
        }
        window.dispatchEvent(new CustomEvent('cue-editor:apply-skin', {
            detail: {
                image: cue.skin.imageBase64,
                tipOffsetPx: cue.skin.tipOffsetPx,
                lengthScale: cue.skin.lengthScale,
                thicknessScale: cue.skin.thicknessScale,
                ppi: cue.skin.ppi
            }
        }));
    }

    private clearCueSkin() {
        try {
            localStorage.removeItem('cue-editor-active-skin');
        } catch (e) {
            // ignore storage failures
        }
        window.dispatchEvent(new CustomEvent('cue-editor:apply-skin', {
            detail: null
        }));
    }

    private getActiveCueSkinId(): string | null {
        try {
            return localStorage.getItem('cue-editor-active-skin');
        } catch (e) {
            return null;
        }
    }

    private drawChipCard(ctx: CanvasRenderingContext2D, rect: Rect, chip: Chip, isSelected: boolean, isHovered: boolean) {
        const { x, y, width, height } = rect;
        const radius = LayoutConstants.Radii.Large;
        const frameWidth = LayoutConstants.Cards.FrameWidth;
        const bevelWidth = LayoutConstants.Cards.BevelWidth;
        const borderWidth = LayoutConstants.Cards.BorderWidth;

        ctx.save();

        // Enhanced drop shadow
        if (isHovered || isSelected) {
            ctx.shadowColor = ColorTokens.effects.shadowHeavy;
            ctx.shadowBlur = LayoutConstants.Shadows.Large.blur;
            ctx.shadowOffsetY = LayoutConstants.Shadows.Large.offsetY;
        } else {
            ctx.shadowColor = ColorTokens.effects.shadowLight;
            ctx.shadowBlur = LayoutConstants.Shadows.Medium.blur;
            ctx.shadowOffsetY = LayoutConstants.Shadows.Medium.offsetY;
        }

        // Outer Frame - Metallic/Wood-grain effect
        drawRoundedRect(ctx, x, y, width, height, radius);
        const frameGradient = ctx.createLinearGradient(x, y, x, y + height);
        frameGradient.addColorStop(0, ColorTokens.card.frame.light);
        frameGradient.addColorStop(0.5, ColorTokens.card.frame.mid);
        frameGradient.addColorStop(1, ColorTokens.card.frame.dark);
        ctx.fillStyle = frameGradient;
        ctx.fill();

        // Add metallic shine to frame
        const shineGradient = ctx.createLinearGradient(x, y, x + width / 3, y);
        shineGradient.addColorStop(0, ColorTokens.effects.gloss.start);
        shineGradient.addColorStop(0.5, ColorTokens.effects.gloss.mid);
        shineGradient.addColorStop(1, ColorTokens.effects.gloss.none);
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
        bevelGradient.addColorStop(0, ColorTokens.card.bevel.top);
        bevelGradient.addColorStop(0.5, ColorTokens.card.bevel.mid);
        bevelGradient.addColorStop(1, ColorTokens.card.bevel.bottom);
        ctx.fillStyle = bevelGradient;
        ctx.fill();

        // Bevel highlight (top edge)
        drawRoundedRect(ctx, bevelX, bevelY, bevelFullWidth, bevelFullHeight, bevelRadius);
        ctx.strokeStyle = ColorTokens.border.emphasis;
        ctx.lineWidth = LayoutConstants.Lines.Thin;
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
        bgGradient.addColorStop(0, ColorTokens.background.panelSolid);
        bgGradient.addColorStop(1, ColorTokens.background.panel);
        ctx.fillStyle = bgGradient;
        ctx.fill();

        // Hover/Selection Glow
        if (isHovered || isSelected) {
            ctx.save();
            ctx.globalAlpha = isSelected ? LayoutConstants.Opacity.SelectedOverlay : LayoutConstants.Opacity.HoverOverlay;
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
        const chipSize = LayoutConstants.Chips.Medium;
        const chipX = x + width / 2;
        const chipY = y + height * 0.4;
        drawChip(ctx, chipX, chipY, chipSize, chip.color);

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
        ctx.shadowBlur = LayoutConstants.Shadows.Glow.blur;
        ctx.strokeStyle = rarityColor;
        ctx.lineWidth = 2;
        ctx.stroke();
        ctx.shadowBlur = 0;
        ctx.shadowColor = 'transparent';

        // Rarity text
        ctx.fillStyle = ColorTokens.text.primary;
        ctx.shadowColor = ColorTokens.effects.shadowText;
        ctx.shadowBlur = LayoutConstants.Shadows.Text.blur;
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
        ctx.shadowColor = ColorTokens.effects.shadowText;
        ctx.shadowBlur = LayoutConstants.Shadows.Small.blur;
        ctx.shadowOffsetX = LayoutConstants.Shadows.Text.offsetX;
        ctx.shadowOffsetY = LayoutConstants.Shadows.Text.offsetY;
        ctx.fillStyle = ColorTokens.text.primary;
        ctx.fillText(nameText, innerX + 20, textStartY);
        ctx.shadowBlur = 0;
        ctx.shadowOffsetX = 0;
        ctx.shadowOffsetY = 0;

        // Accent line under name
        ctx.fillStyle = chip.color;
        ctx.fillRect(innerX + 20, textStartY + 4, Math.min(nameWidth, maxNameWidth), 3);
        ctx.restore();

        // Description text with accent color and word wrapping
        ctx.font = `${LayoutConstants.Fonts.Weight.SemiBold} 11px ${LayoutConstants.Fonts.Family.Body}`;
        ctx.fillStyle = chip.color;
        ctx.textAlign = 'left';
        ctx.textBaseline = 'top';
        ctx.shadowColor = ColorTokens.effects.shadowText;
        ctx.shadowBlur = LayoutConstants.Shadows.Text.blur + 2;

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
            ctx.fillStyle = ColorTokens.background.overlayHeavy;
            ctx.fillRect(innerX, innerY + innerHeight - 36, innerWidth, 36);
            ctx.fillStyle = ColorTokens.action.success;
            ctx.font = '600 14px "Montserrat", Arial';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText('EQUIPPED', innerX + innerWidth / 2, innerY + innerHeight - 18);
        }

        // Inner border (decorative line inside the frame)
        drawRoundedRect(ctx, innerX, innerY, innerWidth, innerHeight, innerRadius);
        ctx.strokeStyle = ColorTokens.border.darkStrong;
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
        const chipHighlightGradient = ctx.createLinearGradient(
            innerX,
            innerY,
            innerX,
            innerY + innerHeight / 4
        );
        chipHighlightGradient.addColorStop(0, ColorTokens.border.subtle);
        chipHighlightGradient.addColorStop(1, ColorTokens.effects.gloss.none);
        ctx.strokeStyle = chipHighlightGradient;
        ctx.lineWidth = LayoutConstants.Lines.Thin;
        ctx.stroke();

        // Corner decorations (small accent lines at corners)
        const cornerSize = Math.min(LayoutConstants.Cards.CornerAccentSize, innerWidth * 0.05);
        const cornerInset = frameWidth + bevelWidth + 2;
        ctx.strokeStyle = ColorTokens.card.cornerAccent;
        ctx.lineWidth = LayoutConstants.Lines.Normal;

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
            ctx.strokeStyle = isSelected ? chip.color : ColorTokens.ui.teal;
            ctx.lineWidth = LayoutConstants.Lines.Heavy;
            ctx.shadowColor = isSelected ? `${chip.color}99` : ColorTokens.effects.glow;
            ctx.shadowBlur = LayoutConstants.Shadows.Medium.blur;
            ctx.stroke();
            ctx.shadowBlur = 0;
            ctx.shadowColor = 'transparent';
        }

        ctx.restore();
    }



    private drawCueCard(ctx: CanvasRenderingContext2D, rect: Rect, cue: CueCard, isSelected: boolean, isHovered: boolean) {
        const { x, y, width, height } = rect;
        const radius = LayoutConstants.Radii.Large;
        const frameWidth = LayoutConstants.Cards.FrameWidth;
        const bevelWidth = LayoutConstants.Cards.BevelWidth;
        const borderWidth = LayoutConstants.Cards.BorderWidth;

        ctx.save();

        // Enhanced drop shadow
        if (isHovered || isSelected) {
            ctx.shadowColor = ColorTokens.effects.shadowHeavy;
            ctx.shadowBlur = LayoutConstants.Shadows.Large.blur;
            ctx.shadowOffsetY = LayoutConstants.Shadows.Large.offsetY;
        } else {
            ctx.shadowColor = ColorTokens.effects.shadowLight;
            ctx.shadowBlur = LayoutConstants.Shadows.Medium.blur;
            ctx.shadowOffsetY = LayoutConstants.Shadows.Medium.offsetY;
        }

        // Outer Frame - Metallic/Wood-grain effect
        drawRoundedRect(ctx, x, y, width, height, radius);
        const frameGradient = ctx.createLinearGradient(x, y, x, y + height);
        frameGradient.addColorStop(0, ColorTokens.card.frame.light);
        frameGradient.addColorStop(0.5, ColorTokens.card.frame.mid);
        frameGradient.addColorStop(1, ColorTokens.card.frame.dark);
        ctx.fillStyle = frameGradient;
        ctx.fill();

        // Add metallic shine to frame
        const shineGradient = ctx.createLinearGradient(x, y, x + width / 3, y);
        shineGradient.addColorStop(0, ColorTokens.effects.gloss.start);
        shineGradient.addColorStop(0.5, ColorTokens.effects.gloss.mid);
        shineGradient.addColorStop(1, ColorTokens.effects.gloss.none);
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
        bevelGradient.addColorStop(0, ColorTokens.card.bevel.top);
        bevelGradient.addColorStop(0.5, ColorTokens.card.bevel.mid);
        bevelGradient.addColorStop(1, ColorTokens.card.bevel.bottom);
        ctx.fillStyle = bevelGradient;
        ctx.fill();

        // Bevel highlight (top edge)
        drawRoundedRect(ctx, bevelX, bevelY, bevelFullWidth, bevelFullHeight, bevelRadius);
        ctx.strokeStyle = ColorTokens.border.emphasis;
        ctx.lineWidth = LayoutConstants.Lines.Thin;
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
        bgGradient.addColorStop(0, ColorTokens.background.panelSolid);
        bgGradient.addColorStop(1, ColorTokens.background.panel);
        ctx.fillStyle = bgGradient;
        ctx.fill();

        // Accent glow background effect
        if (isHovered || isSelected) {
            ctx.save();
            ctx.globalAlpha = isSelected ? LayoutConstants.Opacity.SelectedOverlay : LayoutConstants.Opacity.HoverOverlay;
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

        ctx.globalAlpha = LayoutConstants.Opacity.DiagonalStripe;
        ctx.strokeStyle = cue.accent;
        ctx.lineWidth = LayoutConstants.Lines.Normal;
        for (let i = -innerHeight; i < innerWidth + innerHeight; i += 20) {
            ctx.beginPath();
            ctx.moveTo(innerX + i, innerY);
            ctx.lineTo(innerX + i + innerHeight, innerY + innerHeight);
            ctx.stroke();
        }
        ctx.restore();

        // Cue visualization: use cue-editor preview if available
        const previewImg = this.getCuePreviewImage(cue.previewUrl);
        if (previewImg) {
            const previewRect = {
                x: innerX + innerWidth * 0.1,
                y: innerY + innerHeight * 0.22,
                width: innerWidth * 0.8,
                height: innerHeight * 0.35
            };
            const scale = Math.min(previewRect.width / previewImg.width, previewRect.height / previewImg.height);
            const drawW = previewImg.width * scale;
            const drawH = previewImg.height * scale;
            const drawX = previewRect.x + (previewRect.width - drawW) / 2;
            const drawY = previewRect.y + (previewRect.height - drawH) / 2;

            ctx.save();
            ctx.shadowColor = ColorTokens.effects.shadowHeavy;
            ctx.shadowBlur = LayoutConstants.Shadows.Glow.blur;
            ctx.shadowOffsetX = 4;
            ctx.shadowOffsetY = 4;
            ctx.drawImage(previewImg, drawX, drawY, drawW, drawH);
            ctx.restore();
        } else {
            // DRAMATIC CUE VISUALIZATION - Large diagonal cue
            const cueLength = innerWidth * 0.75;
            const cueThickness = 12;
            const cueStartX = innerX + innerWidth * 0.15;
            const cueStartY = innerY + innerHeight * 0.35;
            const cueEndX = cueStartX + cueLength;
            const cueEndY = cueStartY - cueLength * 0.3;

            ctx.save();
            // Cue shadow
            ctx.shadowColor = ColorTokens.effects.shadowHeavy;
            ctx.shadowBlur = LayoutConstants.Shadows.Glow.blur;
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
            ctx.shadowBlur = LayoutConstants.Shadows.Medium.blur - 5;
            ctx.fillStyle = cue.tipColor;
            ctx.beginPath();
            ctx.arc(cueStartX, cueStartY, cueThickness * 0.7, 0, Math.PI * 2);
            ctx.fill();

            // Accent band on cue
            const bandX = cueStartX + cueLength * 0.65;
            const bandY = cueStartY - cueLength * 0.3 * 0.65;
            ctx.shadowColor = cue.accent;
            ctx.shadowBlur = LayoutConstants.Shadows.Small.blur + 2;
            ctx.strokeStyle = cue.accent;
            ctx.lineWidth = 4;
            ctx.beginPath();
            ctx.arc(bandX, bandY, cueThickness * 0.75, 0, Math.PI * 2);
            ctx.stroke();

            ctx.restore();
        }

        // RARITY BADGE - Top right corner with glow
        const rarityPadding = LayoutConstants.Spacing.Medium;
        const rarityHeight = LayoutConstants.CurrencyPill.Height;
        ctx.font = `${LayoutConstants.Fonts.Weight.Bold} 11px ${LayoutConstants.Fonts.Family.Game}`;
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
        ctx.shadowBlur = LayoutConstants.Shadows.Glow.blur;
        ctx.strokeStyle = rarityColor;
        ctx.lineWidth = 2;
        ctx.stroke();
        ctx.shadowBlur = 0;
        ctx.shadowColor = 'transparent';

        // Rarity text
        ctx.fillStyle = ColorTokens.text.primary;
        ctx.shadowColor = ColorTokens.effects.shadowText;
        ctx.shadowBlur = LayoutConstants.Shadows.Text.blur;
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
        ctx.shadowColor = ColorTokens.effects.shadowText;
        ctx.shadowBlur = LayoutConstants.Shadows.Small.blur;
        ctx.shadowOffsetX = LayoutConstants.Shadows.Text.offsetX;
        ctx.shadowOffsetY = LayoutConstants.Shadows.Text.offsetY;
        ctx.fillStyle = ColorTokens.text.primary;
        ctx.fillText(nameText, innerX + 20, textStartY);
        ctx.shadowBlur = 0;
        ctx.shadowOffsetX = 0;
        ctx.shadowOffsetY = 0;

        // Accent line under name
        ctx.fillStyle = cue.accent;
        ctx.fillRect(innerX + 20, textStartY + 4, Math.min(nameWidth, maxNameWidth), 3);
        ctx.restore();

        // Description text with accent color and word wrapping
        ctx.font = `${LayoutConstants.Fonts.Weight.SemiBold} 11px ${LayoutConstants.Fonts.Family.Body}`;
        ctx.fillStyle = cue.accent;
        ctx.textAlign = 'left';
        ctx.textBaseline = 'top';
        ctx.shadowColor = ColorTokens.effects.shadowText;
        ctx.shadowBlur = LayoutConstants.Shadows.Text.blur + 2;

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
            ctx.fillStyle = ColorTokens.background.overlayHeavy;
            ctx.fillRect(innerX, innerY + innerHeight - 36, innerWidth, 36);
            ctx.fillStyle = ColorTokens.action.success;
            ctx.font = '600 14px "Montserrat", Arial';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText('EQUIPPED', innerX + innerWidth / 2, innerY + innerHeight - 18);
        }

        // Inner border (decorative line inside the frame)
        drawRoundedRect(ctx, innerX, innerY, innerWidth, innerHeight, innerRadius);
        ctx.strokeStyle = ColorTokens.border.darkStrong;
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
        highlightGradient.addColorStop(0, ColorTokens.border.subtle);
        highlightGradient.addColorStop(1, ColorTokens.effects.gloss.none);
        ctx.strokeStyle = highlightGradient;
        ctx.lineWidth = LayoutConstants.Lines.Thin;
        ctx.stroke();

        // Corner decorations (small accent lines at corners)
        const cornerSize = Math.min(LayoutConstants.Cards.CornerAccentSize, innerWidth * 0.05);
        const cornerInset = frameWidth + bevelWidth + 2;
        ctx.strokeStyle = ColorTokens.card.cornerAccent;
        ctx.lineWidth = LayoutConstants.Lines.Normal;

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
            ctx.strokeStyle = isSelected ? cue.accent : ColorTokens.ui.teal;
            ctx.lineWidth = LayoutConstants.Lines.Heavy;
            ctx.shadowColor = isSelected ? `${cue.accent}99` : ColorTokens.effects.glow;
            ctx.shadowBlur = LayoutConstants.Shadows.Medium.blur;
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
        const activeSkinId = this.getActiveCueSkinId();
        if (activeSkinId) {
            const skinIndex = this.cues.findIndex(cue => cue.skin?.id === activeSkinId);
            if (skinIndex >= 0) {
                this.selectedCardIndex = skinIndex;
                this.equippedCueId = this.cues[skinIndex].id;
                return;
            }
        }

        if (this.cues.length > 0) {
            this.selectedCardIndex = 0;
            this.equippedCueId = this.cues[0].id;
        } else {
            this.selectedCardIndex = 0;
            this.equippedCueId = '';
        }
    }

    private isSelectedCueEquipped() {
        const cue = this.cues[this.selectedCardIndex];
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
