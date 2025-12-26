export interface UserProfile {
    id?: number; // Auto-incremented by Dexie
    name: string;
    level: number;
    xp: number;
    coins: number;
    gold: number;
    chips: number;
    trophies: number;
    leagueId: string; // e.g., 'bronze'
    seasonEndTime?: number;
    avatarId: string;
    equippedCueId: string;
    equippedTableId: string;
    stats: UserStats;
}

export interface UserStats {
    gamesPlayed: number;
    wins: number;
    losses: number;
    winStreak: number;
    ballsPotted: number;
    tournamentsWon: number;
    totalEarnings: number;
}

export interface MatchRecord {
    id?: number;
    timestamp: number;
    opponentId: string;
    opponentName: string;
    userScore: number;
    opponentScore: number;
    result: 'win' | 'loss';
    earnings: number; // Coins earned
    leagueId: string; // League played in
}

export interface InventoryItem {
    id?: number;
    itemId: string;
    type: 'cue' | 'table' | 'avatar' | 'chat_pack';
    acquiredDate: number;
    isEquipped: boolean;
}

export interface OpponentDef {
    id: string;
    name: string;
    avatarId: string;
    leagueId: string;
    bio: string;
    stats: AIStats;
}

export interface AIStats {
    accuracy: number;      // 0-1: Base aiming error (1 = perfect)
    consistency: number;   // 0-1: Variance in power/spin
    aggression: number;    // 0-1: Tendency to take risky shots
    speed: number;         // 0-1: Thinking speed (1 = fast)
    spinPreference: number;// 0-1: Frequency of spin usage
    errorRate: number;     // 0-1: Chance of random major error
}

export interface LeagueDef {
    id: string;
    name: string;
    tier: number; // 1 = Bronze, 5 = Diamond
    entryFee: number;
    prizePool: number;
    minLevel: number;
    icon: string;
}

/**
 * Chest slot for Miniclip-style chest inventory
 */
export type ChestSlotStatus = 'empty' | 'locked' | 'unlocking' | 'ready';

export interface ChestSlotData {
    id?: number;             // Auto-incremented by Dexie
    slotIndex: number;       // 0-3
    chestType: string | null;
    status: ChestSlotStatus;
    unlockStartTime: number | null;
    unlockEndTime: number | null;
}

export interface LeagueStanding {
    id?: number;
    leagueId: string;
    playerId: string; // 'user' or AI opponent ID
    playerName: string;
    avatarId: string;
    score: number; // Total earnings this period
    rank: number;
    isUser: boolean;
}

export interface ClubDef {
    id: string;
    name: string;
    description: string;
    entryFee: number;
    minLevel: number;
    minTrophies: number;
    difficulty: number; // 1-10
    tableId: string; // e.g., 'standard', 'lux', 'neon'
}

// ChestDef removed - use ChestDefinition from game/economy/ChestSystem.ts instead
