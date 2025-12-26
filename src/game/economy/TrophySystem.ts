/**
 * Trophy System - Miniclip 8 Ball Pool Style
 * 
 * Trophies are earned/lost based on match results.
 * - Win: Gain trophies based on club difficulty
 * - Loss: Lose trophies (capped at 0)
 * - Higher stakes clubs = more trophies at risk
 * 
 * Trophies determine:
 * - Which clubs you can access (minTrophies requirement)
 * - Your league tier (Bronze → Crystal)
 */

import { getClubById } from '../clubs/ClubRegistry';
import { LeagueTierId } from '../leagues/LeagueIdentity';

/**
 * League tiers based on trophy count
 * Players are auto-assigned to a tier based on their total trophies
 */
export interface LeagueTier {
    id: LeagueTierId;
    name: string;
    minTrophies: number;
    icon: string;
    frameAsset: string; // For avatar frames
}

export const LEAGUE_TIERS: LeagueTier[] = [
    { id: 'bronze',      name: 'Bronze',      minTrophies: 0,     icon: '🏆', frameAsset: 'bronze' },
    { id: 'silver',      name: 'Silver',      minTrophies: 100,   icon: '🥈', frameAsset: 'silver' },
    { id: 'gold',        name: 'Gold',        minTrophies: 300,   icon: '🥇', frameAsset: 'gold' },
    { id: 'platinum',    name: 'Platinum',    minTrophies: 600,   icon: '💠', frameAsset: 'platinum' },
    { id: 'diamond',     name: 'Diamond',     minTrophies: 1000,  icon: '💎', frameAsset: 'diamond' },
    { id: 'master',      name: 'Master',      minTrophies: 2000,  icon: '👑', frameAsset: 'master' },
    { id: 'grandmaster', name: 'Grandmaster', minTrophies: 5000,  icon: '🎓', frameAsset: 'grandmaster' },
    { id: 'elite',       name: 'Elite',       minTrophies: 10000, icon: '🔥', frameAsset: 'elite' },
    { id: 'emerald',     name: 'Emerald',     minTrophies: 20000, icon: '❇️', frameAsset: 'emerald' },
    { id: 'crystal',     name: 'Crystal',     minTrophies: 50000, icon: '💠', frameAsset: 'crystal' },
];

/**
 * Get the league tier for a given trophy count
 */
export function getLeagueForTrophies(trophies: number): LeagueTier {
    for (let i = LEAGUE_TIERS.length - 1; i >= 0; i--) {
        if (trophies >= LEAGUE_TIERS[i].minTrophies) {
            return LEAGUE_TIERS[i];
        }
    }
    return LEAGUE_TIERS[0]; // Bronze as fallback
}

/**
 * Get the next league tier (for progress display)
 */
export function getNextLeagueTier(currentTrophies: number): LeagueTier | null {
    const currentTier = getLeagueForTrophies(currentTrophies);
    const currentIndex = LEAGUE_TIERS.findIndex(t => t.id === currentTier.id);
    
    if (currentIndex < LEAGUE_TIERS.length - 1) {
        return LEAGUE_TIERS[currentIndex + 1];
    }
    return null; // Already at max tier
}

/**
 * Calculate trophy change for a match result
 * 
 * @param clubId - The club where the match was played
 * @param isWin - Whether the player won
 * @returns Positive for gain, negative for loss
 */
export function getTrophyChange(clubId: string, isWin: boolean): number {
    const club = getClubById(clubId);
    if (!club) {
        console.warn(`TrophySystem: Unknown club ${clubId}, using default`);
        return isWin ? 5 : -2;
    }

    // Base trophy value scales with club difficulty (1-10)
    // Higher difficulty clubs = more trophies at stake
    const baseTrophy = club.difficulty * 5; // 5-50 trophies

    if (isWin) {
        return baseTrophy;
    } else {
        // Lose ~40% of what you'd win on a loss
        // This makes climbing possible but losses still sting
        return -Math.floor(baseTrophy * 0.4);
    }
}

/**
 * Calculate the actual trophy change, capping loss at current trophies
 * (Can't go below 0)
 */
export function getClampedTrophyChange(
    clubId: string, 
    isWin: boolean, 
    currentTrophies: number
): number {
    const change = getTrophyChange(clubId, isWin);
    
    if (change < 0) {
        // Cap loss so we don't go negative
        return Math.max(change, -currentTrophies);
    }
    
    return change;
}

/**
 * Check if a player can access a club based on trophies
 */
export function canAccessClub(clubId: string, playerTrophies: number): boolean {
    const club = getClubById(clubId);
    if (!club) return false;
    return playerTrophies >= club.minTrophies;
}

/**
 * Get progress towards next league (0-1)
 */
export function getLeagueProgress(currentTrophies: number): number {
    const currentTier = getLeagueForTrophies(currentTrophies);
    const nextTier = getNextLeagueTier(currentTrophies);
    
    if (!nextTier) {
        return 1; // Max tier reached
    }
    
    const tierRange = nextTier.minTrophies - currentTier.minTrophies;
    const progress = currentTrophies - currentTier.minTrophies;
    
    return Math.min(1, progress / tierRange);
}

/**
 * Format trophy count for display
 */
export function formatTrophies(count: number): string {
    if (count >= 10000) {
        return `${(count / 1000).toFixed(1)}K`;
    }
    return count.toLocaleString();
}
