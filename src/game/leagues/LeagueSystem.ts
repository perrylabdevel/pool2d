import { LeagueDef } from '../../data/models';

export const LEAGUES: LeagueDef[] = [
    { id: 'bronze_1', name: 'Bronze I', tier: 1, entryFee: 50, prizePool: 100, minLevel: 1, icon: '🏆' },
    { id: 'bronze_2', name: 'Bronze II', tier: 1, entryFee: 100, prizePool: 200, minLevel: 2, icon: '🏆' },
    { id: 'bronze_3', name: 'Bronze III', tier: 1, entryFee: 250, prizePool: 500, minLevel: 3, icon: '🏆' },

    { id: 'silver_1', name: 'Silver I', tier: 2, entryFee: 500, prizePool: 1000, minLevel: 5, icon: '🥈' },
    { id: 'silver_2', name: 'Silver II', tier: 2, entryFee: 1000, prizePool: 2000, minLevel: 7, icon: '🥈' },
    { id: 'silver_3', name: 'Silver III', tier: 2, entryFee: 2500, prizePool: 5000, minLevel: 10, icon: '🥈' },

    { id: 'gold_1', name: 'Gold I', tier: 3, entryFee: 5000, prizePool: 10000, minLevel: 15, icon: '🥇' },
    { id: 'gold_2', name: 'Gold II', tier: 3, entryFee: 10000, prizePool: 20000, minLevel: 20, icon: '🥇' },
    { id: 'gold_3', name: 'Gold III', tier: 3, entryFee: 25000, prizePool: 50000, minLevel: 25, icon: '🥇' },

    { id: 'platinum_1', name: 'Platinum I', tier: 4, entryFee: 50000, prizePool: 100000, minLevel: 30, icon: '💠' },
    { id: 'platinum_2', name: 'Platinum II', tier: 4, entryFee: 100000, prizePool: 200000, minLevel: 35, icon: '💠' },
    { id: 'platinum_3', name: 'Platinum III', tier: 4, entryFee: 250000, prizePool: 500000, minLevel: 40, icon: '💠' },

    { id: 'diamond_1', name: 'Diamond I', tier: 5, entryFee: 500000, prizePool: 1000000, minLevel: 50, icon: '💎' },
    { id: 'diamond_2', name: 'Diamond II', tier: 5, entryFee: 1000000, prizePool: 2000000, minLevel: 60, icon: '💎' },
    { id: 'diamond_3', name: 'Diamond III', tier: 5, entryFee: 5000000, prizePool: 10000000, minLevel: 70, icon: '💎' },

    { id: 'master_1', name: 'Master I', tier: 6, entryFee: 10000000, prizePool: 20000000, minLevel: 80, icon: '👑' },
    { id: 'master_2', name: 'Master II', tier: 6, entryFee: 25000000, prizePool: 50000000, minLevel: 90, icon: '👑' },
    { id: 'master_3', name: 'Master III', tier: 6, entryFee: 50000000, prizePool: 100000000, minLevel: 100, icon: '👑' },

    { id: 'grandmaster_1', name: 'Grandmaster I', tier: 7, entryFee: 75000000, prizePool: 150000000, minLevel: 105, icon: '🎓' },
    { id: 'grandmaster_2', name: 'Grandmaster II', tier: 7, entryFee: 90000000, prizePool: 180000000, minLevel: 108, icon: '🎓' },
    { id: 'grandmaster_3', name: 'Grandmaster III', tier: 7, entryFee: 100000000, prizePool: 200000000, minLevel: 110, icon: '🎓' },

    { id: 'elite_1', name: 'Elite I', tier: 8, entryFee: 100000000, prizePool: 200000000, minLevel: 110, icon: '🔥' },
    { id: 'elite_2', name: 'Elite II', tier: 8, entryFee: 250000000, prizePool: 500000000, minLevel: 120, icon: '🔥' },
    { id: 'elite_3', name: 'Elite III', tier: 8, entryFee: 500000000, prizePool: 1000000000, minLevel: 130, icon: '🔥' },

    { id: 'emerald_1', name: 'Emerald I', tier: 9, entryFee: 1000000000, prizePool: 2000000000, minLevel: 140, icon: '❇️' },
    { id: 'emerald_2', name: 'Emerald II', tier: 9, entryFee: 2500000000, prizePool: 5000000000, minLevel: 150, icon: '❇️' },
    { id: 'emerald_3', name: 'Emerald III', tier: 9, entryFee: 5000000000, prizePool: 10000000000, minLevel: 160, icon: '❇️' },

    { id: 'crystal_1', name: 'Crystal I', tier: 10, entryFee: 10000000000, prizePool: 20000000000, minLevel: 170, icon: '💠' },
    { id: 'crystal_2', name: 'Crystal II', tier: 10, entryFee: 25000000000, prizePool: 50000000000, minLevel: 180, icon: '💠' },
    { id: 'crystal_3', name: 'Crystal III', tier: 10, entryFee: 50000000000, prizePool: 100000000000, minLevel: 190, icon: '💠' },
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
