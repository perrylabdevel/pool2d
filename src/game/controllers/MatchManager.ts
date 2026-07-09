/**
 * MatchManager
 * 
 * Handles match lifecycle, rewards, and result processing extracted from Game.ts.
 * Manages trophy calculations, chest awards, and match record saving.
 */

import { db } from '../../data/db';
import { MatchRecord } from '../../data/models';
import { getClampedTrophyChange, getLeagueForTrophies } from '../economy/TrophySystem';
import { getChestForLeague, CHEST_DEFINITIONS } from '../economy/ChestSystem';
import { getClubById } from '../clubs/ClubRegistry';
import { getChestSlots, updateChestSlot } from '../../data/db';
import { LeagueService } from '../leagues/LeagueService';

export interface MatchState {
  clubId: string | null;
  entryFee: number;
  ruleset: string;
  isInProgress: boolean;
}

export interface MatchResultData {
  isWin: boolean;
  earnings: number;
  trophyChange: number;
  opponentName: string;
  opponentId: string;
  chestAwarded: string | null;
  clubId: string | null;
}

export interface MatchEndParams {
  winnerId: number;
  humanPlayerId: number;
  aiPlayerId: number;
  aiPlayerName: string;
  aiOpponentId: string;
  clubId: string | null;
  entryFee: number;
}

/**
 * Create initial match state
 */
export function createInitialMatchState(): MatchState {
  return {
    clubId: null,
    entryFee: 0,
    ruleset: 'TOURNAMENT',
    isInProgress: false,
  };
}

/**
 * Start a new match
 */
export function startMatch(
  _state: MatchState,
  clubId: string,
  entryFee: number = 0,
  ruleset: string = 'TOURNAMENT'
): MatchState {
  return {
    clubId,
    entryFee,
    ruleset,
    isInProgress: true,
  };
}

/**
 * End match and reset state
 */
export function endMatch(state: MatchState): MatchState {
  return {
    ...state,
    isInProgress: false,
  };
}

/**
 * Reset match state
 */
export function resetMatchState(): MatchState {
  return createInitialMatchState();
}

/**
 * Calculate earnings for match result
 */
export function calculateEarnings(entryFee: number, isWin: boolean): number {
  return isWin ? entryFee * 2 : 0;
}

/**
 * Create match record for database
 */
export function createMatchRecord(
  params: MatchEndParams,
  isWin: boolean
): MatchRecord {
  return {
    timestamp: Date.now(),
    opponentId: params.aiOpponentId,
    opponentName: params.aiPlayerName,
    userScore: isWin ? 1 : 0,
    opponentScore: isWin ? 0 : 1,
    result: isWin ? 'win' : 'loss',
    earnings: calculateEarnings(params.entryFee, isWin),
    leagueId: params.clubId || 'club_basement',
  };
}

/**
 * Award a chest for winning a match
 * Returns the chest type awarded, or null if no slot available
 */
export async function awardChestForWin(clubId: string): Promise<string | null> {
  try {
    // Get tier from club difficulty (1-10 maps to chest tiers 1-5)
    const club = getClubById(clubId);
    let tier = 1;
    if (club) {
      // Map difficulty 1-10 to tier 1-5
      tier = Math.min(5, Math.ceil(club.difficulty / 2));
    }

    // Determine chest type based on league
    const chestType = getChestForLeague(tier);
    const chestDef = CHEST_DEFINITIONS[chestType];

    // Get current chest slots
    const slots = await getChestSlots();

    // Find first empty slot
    const emptySlot = slots.find(s => s.status === 'empty');
    if (!emptySlot) {
      console.log('📦 Chest earned but no empty slots! Player needs to open existing chests.');
      return null;
    }

    // Award chest to empty slot
    await updateChestSlot(emptySlot.slotIndex, {
      chestType: chestType,
      status: 'locked',
      unlockStartTime: null,
      unlockEndTime: null
    });

    console.log(`📦 ${chestDef.name} awarded to slot ${emptySlot.slotIndex}!`);
    return chestType;
  } catch (e) {
    console.error('Failed to award chest:', e);
    return null;
  }
}

/**
 * Process match end - save record, update stats, award rewards
 */
export async function processMatchEnd(
  params: MatchEndParams
): Promise<MatchResultData> {
  const isWin = params.winnerId === params.humanPlayerId;
  const record = createMatchRecord(params, isWin);

  let chestAwarded: string | null = null;
  let trophyChange = 0;

  try {
    // Save match record
    await db.matches.add(record);

    // Get current user for trophy calculation
    const currentUser = await db.user.get(1);
    const currentTrophies = currentUser?.trophies || 0;

    // Calculate trophy change based on club and result
    trophyChange = getClampedTrophyChange(
      params.clubId || 'club_basement',
      isWin,
      currentTrophies
    );

    // Update user stats and trophies
    await db.user.where('id').equals(1).modify(user => {
      user.stats.gamesPlayed++;
      user.stats.totalEarnings += record.earnings;

      // Update trophies
      user.trophies = Math.max(0, (user.trophies || 0) + trophyChange);

      // Update league based on new trophy count
      const newLeague = getLeagueForTrophies(user.trophies);
      user.leagueId = newLeague.id;

      if (isWin) {
        user.stats.wins++;
        user.stats.winStreak++;
        user.coins += record.earnings;
      } else {
        user.stats.losses++;
        user.stats.winStreak = 0; // Reset streak on loss
        user.coins += record.earnings;
      }
    });

    console.log('Match saved to DB:', record, `Trophies: ${trophyChange > 0 ? '+' : ''}${trophyChange}`);

    await LeagueService.updateUserScore(record.earnings);

    // Award chest for winning (Miniclip style)
    if (isWin) {
      chestAwarded = await awardChestForWin(params.clubId || 'club_basement');
    }

    // Sync currency store with database
    const user = await db.user.get(1);
    if (user) {
      const { currencyStore } = await import('../../ui/CurrencyStore');
      currencyStore.setBalances({
        coins: user.coins,
        gold: user.gold,
        chips: user.chips || 0,
        trophies: user.trophies || 0
      });
    }
  } catch (e) {
    console.error('Failed to save match:', e);
  }

  return {
    isWin,
    earnings: record.earnings,
    trophyChange,
    opponentName: params.aiPlayerName,
    opponentId: params.aiOpponentId,
    chestAwarded,
    clubId: params.clubId,
  };
}

/**
 * Get winner message based on match result
 */
export function getWinnerMessage(
  winnerId: number,
  humanPlayerId: number,
  isAIWinner: boolean,
  winnerName?: string
): string {
  if (isAIWinner) {
    return 'Better luck next time!';
  } else if (winnerId === humanPlayerId) {
    return 'VICTORY! You cleared the table!';
  } else {
    return `${winnerName || `Player ${winnerId}`} wins the match!`;
  }
}

/**
 * Check if match is in progress (for navigation guards)
 */
export function isMatchInProgress(state: MatchState): boolean {
  return state.isInProgress;
}
