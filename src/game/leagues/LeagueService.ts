import { db } from '../../data/db';
import { LeagueStanding, UserProfile } from '../../data/models';
import { OPPONENTS } from '../../ai/OpponentRegistry';
import { getLeagueById, LEAGUES } from './LeagueSystem';
import { getTierFromLeagueId } from './LeagueIdentity';

export class LeagueService {
    private static readonly LEAGUE_SIZE = 20;
    private static readonly SEASON_LENGTH_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

    /**
     * Initializes the league for the current user if no standings exist.
     * Populates with the user and 19 AI opponents.
     */
    static async initializeLeagueIfNeeded(user: UserProfile): Promise<void> {
        const leagueId = getTierFromLeagueId(user.leagueId);
        if (leagueId !== user.leagueId) {
            await db.user.update(1, { leagueId });
        }
        const count = await db.standings.where('leagueId').equals(leagueId).count();

        if (count > 0) return;

        console.log(`Initializing league ${leagueId} for user...`);

        const standings: LeagueStanding[] = [];

        // 1. Add User
        standings.push({
            leagueId,
            playerId: 'user',
            playerName: user.name,
            avatarId: user.avatarId,
            score: 0,
            rank: 0,
            isUser: true
        });

        // 2. Add AI Opponents
        // Filter opponents by league tier (bronze, silver, etc.)
        const leagueTier = leagueId;
        const eligibleOpponents = OPPONENTS.filter(opp => getTierFromLeagueId(opp.leagueId) === leagueTier);

        // If not enough specific tier opponents, fill with others but prioritize tier
        let pool = [...eligibleOpponents];
        if (pool.length < this.LEAGUE_SIZE - 1) {
            const others = OPPONENTS.filter(opp => getTierFromLeagueId(opp.leagueId) !== leagueTier);
            pool = [...pool, ...others];
        }

        // Shuffle and pick 19
        pool = this.shuffle(pool).slice(0, this.LEAGUE_SIZE - 1);

        pool.forEach(opp => {
            standings.push({
                leagueId,
                playerId: opp.id,
                playerName: opp.name,
                avatarId: opp.avatarId,
                score: Math.floor(Math.random() * 1000), // Start with some random score
                rank: 0,
                isUser: false
            });
        });

        // Bulk add
        await db.standings.bulkAdd(standings);
        await this.updateRanks(leagueId);
    }

    /**
     * Updates the user's score in the current league.
     */
    static async updateUserScore(amount: number): Promise<void> {
        const user = await db.user.get(1);
        if (!user) return;

        const leagueId = getTierFromLeagueId(user.leagueId);
        if (leagueId !== user.leagueId) {
            await db.user.update(1, { leagueId });
        }

        const standing = await db.standings
            .where({ leagueId, playerId: 'user' })
            .first();

        if (standing && standing.id) {
            await db.standings.update(standing.id, {
                score: standing.score + amount
            });
            await this.updateRanks(leagueId);
        } else {
            // Should have been initialized, but just in case
            await this.initializeLeagueIfNeeded({ ...user, leagueId });
            // Retry once
            await this.updateUserScore(amount);
        }
    }

    /**
     * Simulates progress for AI opponents to make the league feel alive.
     * Should be called periodically (e.g. on scene load).
     */
    static async simulateAIProgress(leagueId: string): Promise<void> {
        const normalizedLeagueId = getTierFromLeagueId(leagueId);
        const standings = await db.standings.where('leagueId').equals(normalizedLeagueId).toArray();
        const aiStandings = standings.filter(s => !s.isUser);

        if (aiStandings.length === 0) return;

        // Randomly update a few AI scores
        const updates: Promise<number>[] = [];
        const numUpdates = Math.floor(Math.random() * 5) + 1; // Update 1-5 opponents

        for (let i = 0; i < numUpdates; i++) {
            const ai = aiStandings[Math.floor(Math.random() * aiStandings.length)];
            if (ai && ai.id) {
                // Score gain based on league tier roughly
                const gain = Math.floor(Math.random() * 500) + 50;
                updates.push(db.standings.update(ai.id, { score: ai.score + gain }));
            }
        }

        await Promise.all(updates);
        await this.updateRanks(normalizedLeagueId);
    }

    /**
     * Recalculates ranks based on score.
     */
    private static async updateRanks(leagueId: string): Promise<void> {
        const standings = await db.standings.where('leagueId').equals(leagueId).toArray();

        // Sort descending by score
        standings.sort((a, b) => b.score - a.score);

        // Update ranks in DB
        const updates: Promise<number>[] = [];
        standings.forEach((s, index) => {
            if (s.id && s.rank !== index + 1) {
                updates.push(db.standings.update(s.id, { rank: index + 1 }));
            }
        });

        await Promise.all(updates);
    }

    /**
     * Returns the current standings for a league.
     */
    static async getStandings(leagueId: string): Promise<LeagueStanding[]> {
        const normalizedLeagueId = getTierFromLeagueId(leagueId);
        return db.standings.where('leagueId').equals(normalizedLeagueId).sortBy('rank');
    }

    /**
     * Checks if the season has ended and processes results.
     */
    static async checkSeasonEnd(user: UserProfile): Promise<{
        ended: boolean;
        promoted?: boolean;
        relegated?: boolean;
        reward?: number;
        newLeagueId?: string;
    }> {
        const leagueId = getTierFromLeagueId(user.leagueId);
        if (leagueId !== user.leagueId) {
            await db.user.update(1, { leagueId });
        }

        if (!user.seasonEndTime) {
            // Fix missing seasonEndTime
            await db.user.update(1, { seasonEndTime: Date.now() + this.SEASON_LENGTH_MS });
            return { ended: false };
        }

        if (Date.now() < user.seasonEndTime) {
            return { ended: false };
        }

        console.log('Season ended! Processing results...');

        // 1. Get Final Standings
        const standings = await this.getStandings(leagueId);
        const userStanding = standings.find(s => s.isUser);
        const rank = userStanding ? userStanding.rank : 20;

        // 2. Determine Outcome
        let newLeagueId = leagueId;
        let promoted = false;
        let relegated = false;
        let reward = 0;

        const currentLeague = getLeagueById(leagueId);
        if (!currentLeague) return { ended: false }; // Should not happen

        // Promotion: Top 3
        if (rank <= 3) {
            const nextLeague = this.getNextLeague(leagueId);
            if (nextLeague) {
                newLeagueId = nextLeague.id as typeof leagueId;
                promoted = true;
            }
            // Rewards
            if (rank === 1) reward = currentLeague.prizePool;
            else if (rank === 2) reward = Math.floor(currentLeague.prizePool * 0.5);
            else if (rank === 3) reward = Math.floor(currentLeague.prizePool * 0.25);
        }
        // Relegation: Bottom 3 (Rank 18-20)
        else if (rank >= 18) {
            const prevLeague = this.getPreviousLeague(leagueId);
            if (prevLeague) {
                newLeagueId = prevLeague.id as typeof leagueId;
                relegated = true;
            }
        }

        // 3. Apply Changes
        await db.transaction('rw', db.user, db.standings, async () => {
            // Update User
            await db.user.update(1, {
                leagueId: newLeagueId,
                seasonEndTime: Date.now() + this.SEASON_LENGTH_MS,
                coins: user.coins + reward
            });

            // Clear Old Standings
            await db.standings.where('leagueId').equals(leagueId).delete();
        });

        // 4. Initialize New League
        const updatedUser = await db.user.get(1);
        if (updatedUser) {
            await this.initializeLeagueIfNeeded(updatedUser);
        }

        if (updatedUser) {
            const { currencyStore } = await import('../../ui/CurrencyStore');
            currencyStore.setBalances({
                coins: updatedUser.coins,
                gold: updatedUser.gold,
                chips: updatedUser.chips || 0,
                trophies: updatedUser.trophies || 0
            });
        }

        return {
            ended: true,
            promoted,
            relegated,
            reward,
            newLeagueId
        };
    }

    private static getNextLeague(currentId: string) {
        const index = LEAGUES.findIndex(l => l.id === currentId);
        if (index >= 0 && index < LEAGUES.length - 1) return LEAGUES[index + 1];
        return null;
    }

    private static getPreviousLeague(currentId: string) {
        const index = LEAGUES.findIndex(l => l.id === currentId);
        if (index > 0) return LEAGUES[index - 1];
        return null;
    }

    // Helper: Fisher-Yates shuffle
    private static shuffle<T>(array: T[]): T[] {
        let currentIndex = array.length, randomIndex;
        while (currentIndex != 0) {
            randomIndex = Math.floor(Math.random() * currentIndex);
            currentIndex--;
            [array[currentIndex], array[randomIndex]] = [array[randomIndex], array[currentIndex]];
        }
        return array;
    }
}
