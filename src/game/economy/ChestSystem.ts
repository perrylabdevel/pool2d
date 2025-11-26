/**
 * Chest System - Miniclip 8 Ball Pool Style
 * 
 * Chests are earned by winning matches, NOT purchased.
 * - Players have 4 chest slots
 * - Chests have unlock timers (can be skipped with gold)
 * - Only one chest can be unlocking at a time
 * - Chests contain random rewards (coins, gold, items)
 */

export interface ChestReward {
    coins: number;
    gold: number;
    items: string[]; // Item IDs
}

export enum ChestType {
    COMMON = 'chest_common',
    RARE = 'chest_rare',
    EPIC = 'chest_epic',
    LEGENDARY = 'chest_legendary'
}

export interface ChestDefinition {
    type: ChestType;
    name: string;
    unlockTimeMs: number;     // Time to unlock in milliseconds
    skipCostGold: number;     // Gold cost to skip timer
    minCoins: number;
    maxCoins: number;
    minGold: number;
    maxGold: number;
    itemChance: number;       // 0-1 probability of containing an item
}

// Chest definitions with unlock times matching Miniclip style
export const CHEST_DEFINITIONS: Record<ChestType, ChestDefinition> = {
    [ChestType.COMMON]: {
        type: ChestType.COMMON,
        name: 'Victory Chest',
        unlockTimeMs: 3 * 60 * 60 * 1000,  // 3 hours
        skipCostGold: 5,
        minCoins: 50,
        maxCoins: 150,
        minGold: 0,
        maxGold: 1,
        itemChance: 0.1
    },
    [ChestType.RARE]: {
        type: ChestType.RARE,
        name: 'Pro Chest',
        unlockTimeMs: 8 * 60 * 60 * 1000,  // 8 hours
        skipCostGold: 15,
        minCoins: 200,
        maxCoins: 500,
        minGold: 2,
        maxGold: 5,
        itemChance: 0.3
    },
    [ChestType.EPIC]: {
        type: ChestType.EPIC,
        name: 'Champion Chest',
        unlockTimeMs: 12 * 60 * 60 * 1000, // 12 hours
        skipCostGold: 30,
        minCoins: 1000,
        maxCoins: 2500,
        minGold: 10,
        maxGold: 25,
        itemChance: 0.6
    },
    [ChestType.LEGENDARY]: {
        type: ChestType.LEGENDARY,
        name: 'Legend Chest',
        unlockTimeMs: 24 * 60 * 60 * 1000, // 24 hours
        skipCostGold: 75,
        minCoins: 5000,
        maxCoins: 10000,
        minGold: 50,
        maxGold: 100,
        itemChance: 1.0
    }
};

export type ChestSlotStatus = 'empty' | 'locked' | 'unlocking' | 'ready';

export interface ChestSlot {
    id: number;              // Slot index (0-3)
    chestType: ChestType | null;
    status: ChestSlotStatus;
    unlockStartTime: number | null;  // Timestamp when unlocking started
    unlockEndTime: number | null;    // Timestamp when unlock completes
}

export const MAX_CHEST_SLOTS = 4;

/**
 * Create an empty chest slot
 */
export function createEmptySlot(id: number): ChestSlot {
    return {
        id,
        chestType: null,
        status: 'empty',
        unlockStartTime: null,
        unlockEndTime: null
    };
}

/**
 * Create initial chest slots array
 */
export function createInitialSlots(): ChestSlot[] {
    return Array.from({ length: MAX_CHEST_SLOTS }, (_, i) => createEmptySlot(i));
}

/**
 * Add a chest to the first available empty slot
 * Returns the slot index, or -1 if no slots available
 */
export function addChestToSlot(slots: ChestSlot[], chestType: ChestType): number {
    const emptyIndex = slots.findIndex(s => s.status === 'empty');
    if (emptyIndex === -1) return -1;

    slots[emptyIndex] = {
        id: emptyIndex,
        chestType,
        status: 'locked',
        unlockStartTime: null,
        unlockEndTime: null
    };

    return emptyIndex;
}

/**
 * Start unlocking a chest
 * Returns false if another chest is already unlocking or slot is not locked
 */
export function startUnlock(slots: ChestSlot[], slotId: number): boolean {
    // Check if another chest is already unlocking
    const alreadyUnlocking = slots.some(s => s.status === 'unlocking');
    if (alreadyUnlocking) return false;

    const slot = slots[slotId];
    if (!slot || slot.status !== 'locked' || !slot.chestType) return false;

    const def = CHEST_DEFINITIONS[slot.chestType];
    const now = Date.now();

    slots[slotId] = {
        ...slot,
        status: 'unlocking',
        unlockStartTime: now,
        unlockEndTime: now + def.unlockTimeMs
    };

    return true;
}

/**
 * Check and update unlocking status
 * Returns the slot index if a chest just finished unlocking
 */
export function updateUnlockProgress(slots: ChestSlot[]): number | null {
    const now = Date.now();

    for (let i = 0; i < slots.length; i++) {
        const slot = slots[i];
        if (slot.status === 'unlocking' && slot.unlockEndTime && now >= slot.unlockEndTime) {
            slots[i] = {
                ...slot,
                status: 'ready'
            };
            return i;
        }
    }

    return null;
}

/**
 * Get remaining unlock time in milliseconds
 */
export function getUnlockTimeRemaining(slot: ChestSlot): number {
    if (slot.status !== 'unlocking' || !slot.unlockEndTime) return 0;
    return Math.max(0, slot.unlockEndTime - Date.now());
}

/**
 * Calculate gold cost to skip remaining time
 * Scales based on time remaining (not full cost if mostly done)
 */
export function getSkipCost(slot: ChestSlot): number {
    if (!slot.chestType || slot.status !== 'unlocking') return 0;

    const def = CHEST_DEFINITIONS[slot.chestType];
    const remaining = getUnlockTimeRemaining(slot);
    const ratio = remaining / def.unlockTimeMs;

    // Minimum 1 gold if there's any time remaining
    return Math.max(1, Math.ceil(def.skipCostGold * ratio));
}

/**
 * Skip unlock timer with gold (instant unlock)
 */
export function skipUnlock(slots: ChestSlot[], slotId: number): boolean {
    const slot = slots[slotId];
    if (!slot || slot.status !== 'unlocking') return false;

    slots[slotId] = {
        ...slot,
        status: 'ready',
        unlockEndTime: Date.now()
    };

    return true;
}

/**
 * Open a ready chest and get rewards
 */
export function openChest(slots: ChestSlot[], slotId: number): ChestReward | null {
    const slot = slots[slotId];
    if (!slot || slot.status !== 'ready' || !slot.chestType) return null;

    const def = CHEST_DEFINITIONS[slot.chestType];
    const reward = generateReward(def);

    // Clear the slot
    slots[slotId] = createEmptySlot(slotId);

    return reward;
}

/**
 * Generate random rewards for a chest
 */
function generateReward(def: ChestDefinition): ChestReward {
    const coins = Math.floor(Math.random() * (def.maxCoins - def.minCoins + 1)) + def.minCoins;
    const gold = Math.floor(Math.random() * (def.maxGold - def.minGold + 1)) + def.minGold;

    const items: string[] = [];
    if (Math.random() < def.itemChance) {
        // TODO: Implement proper item pool selection based on chest type
        items.push('random_item_placeholder');
    }

    return { coins, gold, items };
}

/**
 * Determine what chest type to award based on league tier
 * Higher leagues give better chests
 */
export function getChestForLeague(leagueTier: number): ChestType {
    const roll = Math.random();

    if (leagueTier >= 5) { // Diamond
        if (roll < 0.15) return ChestType.LEGENDARY;
        if (roll < 0.45) return ChestType.EPIC;
        return ChestType.RARE;
    }

    if (leagueTier >= 4) { // Platinum
        if (roll < 0.05) return ChestType.LEGENDARY;
        if (roll < 0.25) return ChestType.EPIC;
        if (roll < 0.65) return ChestType.RARE;
        return ChestType.COMMON;
    }

    if (leagueTier >= 3) { // Gold
        if (roll < 0.10) return ChestType.EPIC;
        if (roll < 0.40) return ChestType.RARE;
        return ChestType.COMMON;
    }

    if (leagueTier >= 2) { // Silver
        if (roll < 0.20) return ChestType.RARE;
        return ChestType.COMMON;
    }

    // Bronze
    if (roll < 0.05) return ChestType.RARE;
    return ChestType.COMMON;
}

/**
 * Check if player can receive a new chest (has empty slots)
 */
export function hasEmptySlot(slots: ChestSlot[]): boolean {
    return slots.some(s => s.status === 'empty');
}

/**
 * Get count of empty slots
 */
export function getEmptySlotCount(slots: ChestSlot[]): number {
    return slots.filter(s => s.status === 'empty').length;
}

/**
 * Format time remaining as human-readable string
 */
export function formatTimeRemaining(ms: number): string {
    if (ms <= 0) return 'Ready!';

    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);

    if (hours > 0) {
        const remainingMinutes = minutes % 60;
        return `${hours}h ${remainingMinutes}m`;
    }

    if (minutes > 0) {
        const remainingSeconds = seconds % 60;
        return `${minutes}m ${remainingSeconds}s`;
    }

    return `${seconds}s`;
}
