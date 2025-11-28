import { db } from '../../data/db';
import { LeagueStanding, UserProfile } from '../../data/models';
import { OPPONENTS } from '../../ai/OpponentRegistry';
import { AssetRegistry } from '../../assets/AssetRegistry';
import { getLeagueById } from './LeagueSystem';

export class LeagueService {
    private static readonly LEAGUE_SIZE = 20;
    private static readonly SEASON_LENGTH_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

    /**
     * Initializes the league for the current user if no standings exist.
     * Populates with the user and 19 AI opponents.
     */
    static async initializeLeagueIfNeeded(user: UserProfile): Promise<void> {
        const leagueId = user.leagueId;
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
        const leagueTier = leagueId.split('_')[0];
        const eligibleOpponents = OPPONENTS.filter(opp => opp.leagueId.startsWith(leagueTier));

        // If not enough specific tier opponents, fill with others but prioritize tier
        let pool = [...eligibleOpponents];
        if (pool.length < this.LEAGUE_SIZE - 1) {
            const others = OPPONENTS.filter(opp => !opp.leagueId.startsWith(leagueTier));
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

        const standing = await db.standings
            .where({ leagueId: user.leagueId, playerId: 'user' })
            .first();

        if (standing && standing.id) {
            await db.standings.update(standing.id, {
                score: standing.score + amount
            });
            await this.updateRanks(user.leagueId);
        } else {
            // Should have been initialized, but just in case
            await this.initializeLeagueIfNeeded(user);
            // Retry once
            await this.updateUserScore(amount);
        }
    }

    /**
     * Simulates progress for AI opponents to make the league feel alive.
     * Should be called periodically (e.g. on scene load).
     */
    static async simulateAIProgress(leagueId: string): Promise<void> {
        const standings = await db.standings.where('leagueId').equals(leagueId).toArray();
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
        await this.updateRanks(leagueId);
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
        return db.standings.where('leagueId').equals(leagueId).sortBy('rank');
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
