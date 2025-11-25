import Dexie, { Table } from 'dexie';
import { UserProfile, MatchRecord, InventoryItem } from './models';

export class PoolDatabase extends Dexie {
    user!: Table<UserProfile>;
    matches!: Table<MatchRecord>;
    inventory!: Table<InventoryItem>;

    constructor() {
        super('Pool2D_DB');

        // Define tables and indexes
        this.version(1).stores({
            user: '++id, name', // Primary key and indexed props
            matches: '++id, timestamp, opponentId, result',
            inventory: '++id, itemId, type, [type+isEquipped]' // Compound index for finding equipped items
        });
    }
}

export const db = new PoolDatabase();

// Helper to initialize a new user if none exists
export async function initializeUserIfNeeded() {
    const count = await db.user.count();
    if (count === 0) {
        await db.user.add({
            name: 'Player 1',
            level: 1,
            xp: 0,
            coins: 500, // Starting coins
            gold: 5,    // Starting gold
            leagueId: 'bronze_1',
            avatarId: 'avatar_default',
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
}
