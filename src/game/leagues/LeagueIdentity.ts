export const LEAGUE_TIER_IDS = [
    'bronze',
    'silver',
    'gold',
    'platinum',
    'diamond',
    'master',
    'grandmaster',
    'elite',
    'emerald',
    'crystal'
] as const;

export type LeagueTierId = typeof LEAGUE_TIER_IDS[number];

export function isLeagueTierId(id: string): id is LeagueTierId {
    return LEAGUE_TIER_IDS.includes(id as LeagueTierId);
}

export function getTierFromLeagueId(id?: string): LeagueTierId {
    if (!id) return 'bronze';

    const normalized = id.toLowerCase();
    const tier = normalized.split('_')[0];
    if (isLeagueTierId(tier)) return tier;

    for (const candidate of LEAGUE_TIER_IDS) {
        if (normalized.includes(candidate)) return candidate;
    }

    return 'bronze';
}

export function normalizeLeagueId(id?: string): LeagueTierId {
    return getTierFromLeagueId(id);
}
