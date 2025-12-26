import { LeagueDef } from '../../data/models';

// Re-export trophy-based league tier system
// These are now the authoritative source for player ranking
export { 
    LEAGUE_TIERS, 
    getLeagueForTrophies, 
    getNextLeagueTier,
    getLeagueProgress,
    type LeagueTier 
} from '../economy/TrophySystem';

/**
 * Tier-only league definitions for standings display
 * Note: Player's current league is determined by TrophySystem.getLeagueForTrophies()
 */
export const LEAGUES: LeagueDef[] = [
    { id: 'bronze', name: 'Bronze', tier: 1, entryFee: 50, prizePool: 100, minLevel: 1, icon: '🏆' },
    { id: 'silver', name: 'Silver', tier: 2, entryFee: 500, prizePool: 1000, minLevel: 5, icon: '🥈' },
    { id: 'gold', name: 'Gold', tier: 3, entryFee: 5000, prizePool: 10000, minLevel: 15, icon: '🥇' },
    { id: 'platinum', name: 'Platinum', tier: 4, entryFee: 50000, prizePool: 100000, minLevel: 30, icon: '💠' },
    { id: 'diamond', name: 'Diamond', tier: 5, entryFee: 500000, prizePool: 1000000, minLevel: 50, icon: '💎' },
    { id: 'master', name: 'Master', tier: 6, entryFee: 10000000, prizePool: 20000000, minLevel: 80, icon: '👑' },
    { id: 'grandmaster', name: 'Grandmaster', tier: 7, entryFee: 75000000, prizePool: 150000000, minLevel: 105, icon: '🎓' },
    { id: 'elite', name: 'Elite', tier: 8, entryFee: 100000000, prizePool: 200000000, minLevel: 110, icon: '🔥' },
    { id: 'emerald', name: 'Emerald', tier: 9, entryFee: 1000000000, prizePool: 2000000000, minLevel: 140, icon: '❇️' },
    { id: 'crystal', name: 'Crystal', tier: 10, entryFee: 10000000000, prizePool: 20000000000, minLevel: 170, icon: '💠' },
];

export function getLeagueById(id: string): LeagueDef | undefined {
    return LEAGUES.find(l => l.id === id);
}

export function getNextLeague(currentId: string): LeagueDef | undefined {
    const index = LEAGUES.findIndex(l => l.id === currentId);
    if (index >= 0 && index < LEAGUES.length - 1) {
        return LEAGUES[index + 1];
    }
    return undefined;
}

export function canAffordEntry(coins: number, leagueId: string): boolean {
    const league = getLeagueById(leagueId);
    return league ? coins >= league.entryFee : false;
}
