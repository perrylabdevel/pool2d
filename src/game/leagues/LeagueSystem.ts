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
