import Dexie, { Table } from 'dexie';
import { UserProfile, MatchRecord, InventoryItem, ChestSlotData, LeagueStanding, CueOwnership } from './models';
import { DEFAULT_USER_NAME } from '../config';

export class PoolDatabase extends Dexie {
    user!: Table<UserProfile>;
    matches!: Table<MatchRecord>;
    inventory!: Table<InventoryItem>;
    cueInventory!: Table<CueOwnership>;
    chestSlots!: Table<ChestSlotData>;
    standings!: Table<LeagueStanding>;

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

        // Version 3: Add league standings
        this.version(3).stores({
            user: '++id, name',
            matches: '++id, timestamp, opponentId, result',
            inventory: '++id, itemId, type, [type+isEquipped]',
            chestSlots: '++id, slotIndex, status',
            standings: '++id, leagueId, playerId, score'
        });

        // Version 4: Normalize league IDs to tier-only (e.g. bronze, silver)
        this.version(4).stores({
            user: '++id, name',
            matches: '++id, timestamp, opponentId, result',
            inventory: '++id, itemId, type, [type+isEquipped]',
            chestSlots: '++id, slotIndex, status',
            standings: '++id, leagueId, playerId, score'
        }).upgrade(async tx => {
            const userTable = tx.table('user');
            const standingsTable = tx.table('standings');

            const users = await userTable.toArray();
            await Promise.all(users.map(user => {
                const normalized = normalizeLeagueId(user.leagueId);
                if (normalized === user.leagueId) return Promise.resolve(0);
                return userTable.update(user.id, { leagueId: normalized });
            }));

            const standings = await standingsTable.toArray();
            await Promise.all(standings.map(standing => {
                const normalized = normalizeLeagueId(standing.leagueId);
                if (normalized === standing.leagueId) return Promise.resolve(0);
                return standingsTable.update(standing.id, { leagueId: normalized });
            }));
        });

        // Version 5: Add chips currency to user profile
        this.version(5).stores({
            user: '++id, name',
            matches: '++id, timestamp, opponentId, result',
            inventory: '++id, itemId, type, [type+isEquipped]',
            chestSlots: '++id, slotIndex, status',
            standings: '++id, leagueId, playerId, score'
        }).upgrade(async tx => {
            const userTable = tx.table('user');
            const users = await userTable.toArray();
            await Promise.all(users.map(user => {
                if (typeof user.chips === 'number') return Promise.resolve(0);
                return userTable.update(user.id, { chips: 0 });
            }));
        });

        // Version 6: Add cue inventory table
        this.version(6).stores({
            user: '++id, name',
            matches: '++id, timestamp, opponentId, result',
            inventory: '++id, itemId, type, [type+isEquipped]',
            cueInventory: '++id, cueId, isEquipped',
            chestSlots: '++id, slotIndex, status',
            standings: '++id, leagueId, playerId, score'
        }).upgrade(async tx => {
            const cueInventoryTable = tx.table('cueInventory');
            const inventoryTable = tx.table('inventory');
            const userTable = tx.table('user');

            const cueItems = await inventoryTable.where('type').equals('cue').toArray();
            const existingCueIds = new Set<string>();
            cueItems.forEach(item => {
                if (item.itemId) existingCueIds.add(item.itemId);
            });

            if (cueItems.length) {
                await cueInventoryTable.bulkAdd(
                    cueItems.map(item => ({
                        cueId: item.itemId,
                        acquiredDate: item.acquiredDate,
                        isEquipped: item.isEquipped
                    }))
                );
            } else {
                const user = await userTable.get(1);
                if (user?.equippedCueId && !existingCueIds.has(user.equippedCueId)) {
                    await cueInventoryTable.add({
                        cueId: user.equippedCueId,
                        acquiredDate: Date.now(),
                        isEquipped: true
                    });
                }
            }
        });
    }
}

export const db = new PoolDatabase();

function normalizeLeagueId(leagueId?: string): string {
    if (!leagueId) return 'bronze';
    const normalized = leagueId.toLowerCase();
    return normalized.split('_')[0] || 'bronze';
}

// Helper to initialize a new user if none exists
export async function initializeUserIfNeeded() {
    const count = await db.user.count();
    if (count === 0) {
        await db.user.add({
            name: DEFAULT_USER_NAME,
            level: 1,
            xp: 0,
            coins: 10000, // Starting coins (Updated to 10k)
            gold: 5,    // Starting gold
            chips: 0,
            leagueId: 'bronze',
            seasonEndTime: Date.now() + 7 * 24 * 60 * 60 * 1000, // 7 days
            trophies: 0,
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
    } else {
        // Migrate existing users with old default names to the new default
        const user = await db.user.get(1);
        if (user && (user.name === 'Player' || user.name === 'Player 1')) {
            await db.user.update(1, { name: DEFAULT_USER_NAME });
            
            // Also update the cached name in league standings
            await db.standings.where('playerId').equals('user').modify({ playerName: DEFAULT_USER_NAME });
            
            console.log('📝 Updated user name to', DEFAULT_USER_NAME);
        }
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
