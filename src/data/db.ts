import Dexie, { Table } from 'dexie';
import { UserProfile, MatchRecord, InventoryItem, ChestSlotData } from './models';

export class PoolDatabase extends Dexie {
    user!: Table<UserProfile>;
    matches!: Table<MatchRecord>;
    inventory!: Table<InventoryItem>;
    chestSlots!: Table<ChestSlotData>;

    constructor() {
        super('Pool2D_DB');

        // Define tables and indexes
        this.version(1).stores({
            user: '++id, name', // Primary key and indexed props
            matches: '++id, timestamp, opponentId, result',
            inventory: '++id, itemId, type, [type+isEquipped]' // Compound index for finding equipped items
        });

        // Version 2: Add chest slots for Miniclip-style chest system
        this.version(2).stores({
            user: '++id, name',
            matches: '++id, timestamp, opponentId, result',
            inventory: '++id, itemId, type, [type+isEquipped]',
            chestSlots: '++id, slotIndex, status'
        });
    }
}

export const db = new PoolDatabase();

// Helper to initialize a new user if none exists
export async function initializeUserIfNeeded() {
    const count = await db.user.count();
    if (count === 0) {
        await db.user.add({
            name: 'sosumidude',
            level: 1,
            xp: 0,
            coins: 500, // Starting coins
            gold: 5,    // Starting gold
            leagueId: 'bronze_1',
            avatarId: 'player',
            equippedCueId: 'cue_standard',
            equippedTableId: 'table_standard',
            stats: {
                gamesPlayed: 0,
                wins: 0,
                losses: 0,
                winStreak: 0,
                ballsPotted: 0,
                tournamentsWon: 0,
                totalEarnings: 0
            }
        });
        console.log('🆕 New user profile created!');
    }

    // Initialize chest slots if they don't exist
    await initializeChestSlotsIfNeeded();
}

// Initialize 4 empty chest slots for Miniclip-style chest system
export async function initializeChestSlotsIfNeeded() {
    const count = await db.chestSlots.count();
    if (count === 0) {
        // Create 4 empty slots
        for (let i = 0; i < 4; i++) {
            await db.chestSlots.add({
                slotIndex: i,
                chestType: null,
                status: 'empty',
                unlockStartTime: null,
                unlockEndTime: null
            });
        }
        console.log('📦 Chest slots initialized (4 empty slots)');
    }
}

// Get all chest slots
export async function getChestSlots(): Promise<ChestSlotData[]> {
    return db.chestSlots.orderBy('slotIndex').toArray();
}

// Update a chest slot
export async function updateChestSlot(slotIndex: number, data: Partial<ChestSlotData>): Promise<void> {
    await db.chestSlots.where('slotIndex').equals(slotIndex).modify(data);
}
