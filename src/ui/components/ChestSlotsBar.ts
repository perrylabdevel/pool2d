/**
 * ChestSlotsBar - Miniclip-style chest slots display
 * 
 * Displays 4 chest slots horizontally at the bottom of the screen.
 * Shows chest images, unlock timers, and handles interactions.
 */

import { Rect, drawRoundedRect } from './UIComponents';
import { getChestSlots, updateChestSlot } from '../../data/db';
import { ChestSlotData } from '../../data/models';
import {
    ChestType,
    CHEST_DEFINITIONS,
    formatTimeRemaining
} from '../../game/economy/ChestSystem';
import { currencyStore } from '../CurrencyStore';
import { notificationService } from '../NotificationService';
import { ChestRenderer } from './ChestRenderer';

export const CHEST_BAR_HEIGHT = 108;

interface ChestSlotRect extends Rect {
    slotIndex: number;
}

export class ChestSlotsBar {
    private slots: ChestSlotData[] = [];
    private slotRects: ChestSlotRect[] = [];
    private hoveredSlot: number = -1;
    private lastUpdateTime: number = 0;
    private updateInterval: number = 1000; // Update every second for timers

    private isMobile: boolean = false;
    private currentCanvasWidth: number = 0;

    constructor() {
        // Preloading handled by ChestRenderer
    }

    async loadSlots(): Promise<void> {
        try {
            this.slots = await getChestSlots();
            console.log('📦 Loaded chest slots:', this.slots.length, this.slots);

            // If no slots in DB, create default empty slots for display
            if (this.slots.length === 0) {
                console.log('📦 No slots found, creating defaults...');
                this.slots = [
                    { slotIndex: 0, chestType: null, status: 'empty', unlockStartTime: null, unlockEndTime: null },
                    { slotIndex: 1, chestType: null, status: 'empty', unlockStartTime: null, unlockEndTime: null },
                    { slotIndex: 2, chestType: null, status: 'empty', unlockStartTime: null, unlockEndTime: null },
                    { slotIndex: 3, chestType: null, status: 'empty', unlockStartTime: null, unlockEndTime: null },
                ];
            }
        } catch (e) {
            console.error('Failed to load chest slots:', e);
            // Create default empty slots as fallback
            this.slots = [
                { slotIndex: 0, chestType: null, status: 'empty', unlockStartTime: null, unlockEndTime: null },
                { slotIndex: 1, chestType: null, status: 'empty', unlockStartTime: null, unlockEndTime: null },
                { slotIndex: 2, chestType: null, status: 'empty', unlockStartTime: null, unlockEndTime: null },
                { slotIndex: 3, chestType: null, status: 'empty', unlockStartTime: null, unlockEndTime: null },
            ];
        }
    }

    /**
     * Add a test chest to the first empty slot (for development/testing)
     */
    async addTestChest(type: ChestType = ChestType.COMMON): Promise<void> {
        const emptySlot = this.slots.find(s => s.status === 'empty');
        if (!emptySlot) {
            console.log('No empty slots for test chest');
            return;
        }

        await updateChestSlot(emptySlot.slotIndex, {
            chestType: type,
            status: 'locked',
            unlockStartTime: null,
            unlockEndTime: null
        });
        await this.loadSlots();
        console.log(`📦 Added test ${type} chest to slot ${emptySlot.slotIndex}`);
    }

    private isLandscapeMode: boolean = false;

    getHeight(): number {
        // Responsive height based on screen size and orientation
        if (this.isLandscapeMode) {
            return 56; // Very compact in landscape
        }
        return this.isMobile ? 72 : CHEST_BAR_HEIGHT;
    }

    setupLayout(canvasWidth: number, canvasHeight: number): void {
        this.currentCanvasWidth = canvasWidth;
        this.isMobile = canvasWidth < 600 || canvasHeight < 500;
        this.isLandscapeMode = canvasWidth > canvasHeight && canvasHeight < 500;

        const barHeight = this.getHeight();

        // In landscape, spread slots across the width like lobby cards
        if (this.isLandscapeMode) {
            const padding = 16;
            const contentWidth = canvasWidth - padding * 2;
            const numSlots = 4;
            const gap = 12;
            const slotWidth = (contentWidth - gap * (numSlots - 1)) / numSlots;
            const slotHeight = barHeight - 12; // Leave some padding top/bottom
            const y = canvasHeight - barHeight + (barHeight - slotHeight) / 2;

            this.slotRects = [];
            for (let i = 0; i < numSlots; i++) {
                this.slotRects.push({
                    slotIndex: i,
                    x: padding + i * (slotWidth + gap),
                    y: y,
                    width: slotWidth,
                    height: slotHeight
                });
            }
        } else {
            // Portrait/Desktop: centered slots with fixed sizes
            const slotWidth = this.isMobile ? 70 : 95;
            const slotHeight = this.isMobile ? 60 : 88;
            const gap = this.isMobile ? 8 : 12;

            const totalWidth = slotWidth * 4 + gap * 3;
            const startX = (canvasWidth - totalWidth) / 2;
            const y = canvasHeight - barHeight + (barHeight - slotHeight) / 2;

            this.slotRects = [];
            for (let i = 0; i < 4; i++) {
                this.slotRects.push({
                    slotIndex: i,
                    x: startX + i * (slotWidth + gap),
                    y: y,
                    width: slotWidth,
                    height: slotHeight
                });
            }
        }
    }

    handleMouseMove(x: number, y: number): boolean {
        this.hoveredSlot = -1;
        for (const rect of this.slotRects) {
            if (x >= rect.x && x <= rect.x + rect.width &&
                y >= rect.y && y <= rect.y + rect.height) {
                this.hoveredSlot = rect.slotIndex;
                return true;
            }
        }
        return false;
    }

    getCursor(): string {
        return this.hoveredSlot >= 0 ? 'pointer' : 'default';
    }

    async handleClick(x: number, y: number): Promise<boolean> {
        for (const rect of this.slotRects) {
            if (x >= rect.x && x <= rect.x + rect.width &&
                y >= rect.y && y <= rect.y + rect.height) {
                await this.onSlotClick(rect.slotIndex);
                return true;
            }
        }
        return false;
    }

    private async onSlotClick(slotIndex: number): Promise<void> {
        const slot = this.slots[slotIndex];
        if (!slot) return;

        switch (slot.status) {
            case 'empty':
                notificationService.show('Win matches to earn chests!', 'info', 2000);
                break;

            case 'locked':
                // Check if another chest is unlocking
                const isAnyUnlocking = this.slots.some(s => s.status === 'unlocking');
                if (isAnyUnlocking) {
                    notificationService.show('Another chest is already unlocking!', 'warning', 2000);
                    return;
                }

                // Start unlocking
                const def = CHEST_DEFINITIONS[slot.chestType as ChestType];
                const now = Date.now();
                await updateChestSlot(slotIndex, {
                    status: 'unlocking',
                    unlockStartTime: now,
                    unlockEndTime: now + def.unlockTimeMs
                });
                await this.loadSlots();
                notificationService.show(`Started unlocking ${def.name}!`, 'success', 2000);
                break;

            case 'unlocking':
                // Offer to skip with gold
                const unlockingSlot = this.slots[slotIndex];
                if (!unlockingSlot.chestType) return;

                const skipCost = this.calculateSkipCost(unlockingSlot);
                if (skipCost <= 0) {
                    // Already ready
                    await updateChestSlot(slotIndex, { status: 'ready' });
                    await this.loadSlots();
                    return;
                }

                // For now, show info - could add a confirm dialog
                notificationService.show(`${skipCost} gold to unlock now`, 'info', 2000);
                // TODO: Add confirm dialog for skip
                break;

            case 'ready':
                // Open the chest
                await this.openChest(slotIndex);
                break;
        }
    }

    private calculateSkipCost(slot: ChestSlotData): number {
        if (!slot.chestType || slot.status !== 'unlocking' || !slot.unlockEndTime) return 0;

        const def = CHEST_DEFINITIONS[slot.chestType as ChestType];
        const remaining = Math.max(0, slot.unlockEndTime - Date.now());
        const ratio = remaining / def.unlockTimeMs;
        return Math.max(1, Math.ceil(def.skipCostGold * ratio));
    }

    private async openChest(slotIndex: number): Promise<void> {
        const slot = this.slots[slotIndex];
        if (!slot || slot.status !== 'ready' || !slot.chestType) return;

        const def = CHEST_DEFINITIONS[slot.chestType as ChestType];

        // Generate rewards
        const coins = Math.floor(Math.random() * (def.maxCoins - def.minCoins + 1)) + def.minCoins;
        const gold = Math.floor(Math.random() * (def.maxGold - def.minGold + 1)) + def.minGold;

        // Award rewards
        currencyStore.addCoins(coins);
        if (gold > 0) {
            currencyStore.addGold(gold);
        }

        // Clear the slot
        await updateChestSlot(slotIndex, {
            chestType: null,
            status: 'empty',
            unlockStartTime: null,
            unlockEndTime: null
        });
        await this.loadSlots();

        // Show reward notification
        let rewardText = `+${coins.toLocaleString()} coins`;
        if (gold > 0) {
            rewardText += ` +${gold} gold`;
        }
        notificationService.show(`🎁 ${def.name}: ${rewardText}`, 'success', 3000);
    }

    update(dt: number): void {
        // Periodically refresh slots to update timer displays
        this.lastUpdateTime += dt * 1000;
        if (this.lastUpdateTime >= this.updateInterval) {
            this.lastUpdateTime = 0;
            // Check if any unlocking chest has finished
            this.checkUnlockCompletion();
        }
    }

    private async checkUnlockCompletion(): Promise<void> {
        const now = Date.now();
        let needsReload = false;

        for (const slot of this.slots) {
            if (slot.status === 'unlocking' && slot.unlockEndTime && now >= slot.unlockEndTime) {
                await updateChestSlot(slot.slotIndex, { status: 'ready' });
                needsReload = true;
            }
        }

        if (needsReload) {
            await this.loadSlots();
            notificationService.show('A chest is ready to open!', 'success', 2000);
        }
    }

    render(ctx: CanvasRenderingContext2D, canvasWidth: number): void {
        // Background bar
        const barHeight = this.getHeight();
        const barY = ctx.canvas.height - barHeight;
        ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
        ctx.fillRect(0, barY, canvasWidth, barHeight);

        // Top border
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.2)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(0, barY);
        ctx.lineTo(canvasWidth, barY);
        ctx.stroke();

        // Render each slot
        for (const rect of this.slotRects) {
            this.renderSlot(ctx, rect);
        }
    }

    private renderSlot(ctx: CanvasRenderingContext2D, rect: ChestSlotRect): void {
        const slot = this.slots[rect.slotIndex];
        const isHovered = this.hoveredSlot === rect.slotIndex;
        const { x, y, width, height } = rect;
        const radius = 8;

        ctx.save();

        // Slot background
        drawRoundedRect(ctx, x, y, width, height, radius);

        if (!slot || slot.status === 'empty') {
            // Empty slot - dashed border
            ctx.fillStyle = 'rgba(255, 255, 255, 0.05)';
            ctx.fill();
            ctx.setLineDash([4, 4]);
            ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)';
            ctx.lineWidth = 2;
            ctx.stroke();
            ctx.setLineDash([]);

            // Plus icon
            ctx.fillStyle = 'rgba(255, 255, 255, 0.3)';
            ctx.font = '24px sans-serif';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText('+', x + width / 2, y + height / 2);
        } else {
            // Has a chest
            const chestType = slot.chestType as ChestType;
            const def = CHEST_DEFINITIONS[chestType];

            // Background glow based on rarity
            let glowColor = '#888888';
            if (chestType === ChestType.RARE) glowColor = '#4A90E2';
            else if (chestType === ChestType.EPIC) glowColor = '#9B59B6';
            else if (chestType === ChestType.LEGENDARY) glowColor = '#F39C12';

            // Glow effect
            if (slot.status === 'ready' || isHovered) {
                ctx.shadowColor = glowColor;
                ctx.shadowBlur = 15;
            }

            ctx.fillStyle = 'rgba(30, 30, 40, 0.9)';
            ctx.fill();
            ctx.strokeStyle = glowColor;
            ctx.lineWidth = 2;
            ctx.stroke();
            ctx.shadowBlur = 0;

            // Draw chest image using ChestRenderer
            // Image is 294x262, so aspect ratio is approx 1.12:1
            const imgWidth = width * 0.85;
            const imgHeight = imgWidth / 1.12;
            const imgX = x + (width - imgWidth) / 2;
            // Shift up slightly to leave room for timer ribbon at bottom
            const imgY = y + (height - imgHeight) / 2 - 5;

            // Map ChestType to renderer type
            let rendererType: 'bronze' | 'gold' | 'platinum' | 'diamond' = 'bronze';
            if (chestType === ChestType.RARE) rendererType = 'gold';
            else if (chestType === ChestType.EPIC) rendererType = 'platinum';
            else if (chestType === ChestType.LEGENDARY) rendererType = 'diamond';

            ChestRenderer.drawChest(ctx, imgX, imgY, imgWidth, imgHeight, rendererType);

            // Status indicator
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';

            if (slot.status === 'locked') {
                // Locked - show lock icon
                ctx.fillStyle = '#FFD700';
                ctx.font = 'bold 12px sans-serif';
                ctx.fillText('🔒 TAP', x + width / 2, y + height - 12);
            } else if (slot.status === 'unlocking') {
                // Unlocking - show timer
                const remaining = Math.max(0, (slot.unlockEndTime || 0) - Date.now());
                const timeText = formatTimeRemaining(remaining);

                // Timer background
                ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
                ctx.fillRect(x + 4, y + height - 22, width - 8, 18);

                // Timer text
                ctx.fillStyle = '#00BFFF';
                ctx.font = 'bold 11px sans-serif';
                ctx.fillText(timeText, x + width / 2, y + height - 12);

                // Progress bar
                const progress = 1 - remaining / (def.unlockTimeMs || 1);
                ctx.fillStyle = 'rgba(0, 191, 255, 0.5)';
                ctx.fillRect(x + 4, y + height - 4, (width - 8) * progress, 3);
            } else if (slot.status === 'ready') {
                // Ready - pulsing "OPEN" text
                const pulse = Math.sin(Date.now() / 200) * 0.3 + 0.7;
                ctx.globalAlpha = pulse;
                ctx.fillStyle = '#00FF00';
                ctx.font = 'bold 14px sans-serif';
                ctx.fillText('OPEN!', x + width / 2, y + height - 12);
                ctx.globalAlpha = 1;
            }
        }

        // Hover effect
        if (isHovered && slot && slot.status !== 'empty') {
            drawRoundedRect(ctx, x - 2, y - 2, width + 4, height + 4, radius + 2);
            ctx.strokeStyle = '#FFFFFF';
            ctx.lineWidth = 2;
            ctx.stroke();
        }

        ctx.restore();
    }
}

