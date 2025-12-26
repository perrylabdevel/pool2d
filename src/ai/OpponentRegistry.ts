import { OpponentDef } from '../data/models';

export const OPPONENTS: OpponentDef[] = [
    // --- BRONZE LEAGUE ---
    {
        id: 'rookie_rick',
        name: 'Rookie Rick',
        avatarId: 'rookie_rick',
        leagueId: 'bronze_1',
        bio: 'Just started playing last week. Still figuring out which end of the cue to hold.',
        stats: { accuracy: 0.4, consistency: 0.3, aggression: 0.8, speed: 0.4, spinPreference: 0.0, errorRate: 0.25 }
    },
    {
        id: 'nervous_ned',
        name: 'Nervous Ned',
        avatarId: 'nervous_ned',
        leagueId: 'bronze_1',
        bio: 'Shakes a lot when the pressure is on. Easy to beat if you keep him waiting.',
        stats: { accuracy: 0.45, consistency: 0.2, aggression: 0.2, speed: 0.3, spinPreference: 0.0, errorRate: 0.2 }
    },
    {
        id: 'casual_carl',
        name: 'Casual Carl',
        avatarId: 'casual_carl',
        leagueId: 'bronze_2',
        bio: 'Plays for fun on weekends. Not great, but hits the ball hard.',
        stats: { accuracy: 0.5, consistency: 0.4, aggression: 0.9, speed: 0.7, spinPreference: 0.1, errorRate: 0.15 }
    },
    {
        id: 'slow_sam',
        name: 'Slow Sam',
        avatarId: 'slow_sam',
        leagueId: 'bronze_2',
        bio: 'Takes forever to shoot. Tries to calculate angles but usually gets them wrong.',
        stats: { accuracy: 0.55, consistency: 0.5, aggression: 0.3, speed: 0.1, spinPreference: 0.1, errorRate: 0.1 }
    },
    {
        id: 'lucky_lucy',
        name: 'Lucky Lucy',
        avatarId: 'lucky_lucy',
        leagueId: 'bronze_3',
        bio: 'Somehow makes shots that shouldn\'t go in. Don\'t underestimate her luck.',
        stats: { accuracy: 0.5, consistency: 0.3, aggression: 0.7, speed: 0.6, spinPreference: 0.2, errorRate: 0.15 }
    },

    // --- SILVER LEAGUE ---
    {
        id: 'steady_steve',
        name: 'Steady Steve',
        avatarId: 'steady_steve',
        leagueId: 'silver_1',
        bio: 'Reliable but predictable. Won\'t make many mistakes, but won\'t wow you either.',
        stats: { accuracy: 0.65, consistency: 0.7, aggression: 0.4, speed: 0.5, spinPreference: 0.2, errorRate: 0.08 }
    },
    {
        id: 'bank_shot_betty',
        name: 'Bank Shot Betty',
        avatarId: 'bankshot_betty',
        leagueId: 'silver_1',
        bio: 'Loves banking shots off the rails. Sometimes it works beautifully.',
        stats: { accuracy: 0.6, consistency: 0.6, aggression: 0.6, speed: 0.6, spinPreference: 0.3, errorRate: 0.1 }
    },
    {
        id: 'angle_andy',
        name: 'Angle Andy',
        avatarId: 'angle_andy',
        leagueId: 'silver_2',
        bio: 'Math teacher by day, pool player by night. Knows his geometry.',
        stats: { accuracy: 0.7, consistency: 0.65, aggression: 0.5, speed: 0.4, spinPreference: 0.2, errorRate: 0.05 }
    },
    {
        id: 'combo_chris',
        name: 'Combo Chris',
        avatarId: 'combo_chris',
        leagueId: 'silver_2',
        bio: 'Always looking for the combination shot. High risk, high reward.',
        stats: { accuracy: 0.65, consistency: 0.5, aggression: 0.8, speed: 0.6, spinPreference: 0.3, errorRate: 0.12 }
    },
    {
        id: 'defensive_dan',
        name: 'Defensive Dan',
        avatarId: 'defensive_dan',
        leagueId: 'silver_3',
        bio: 'Will safety you to death. Hates taking risks.',
        stats: { accuracy: 0.7, consistency: 0.8, aggression: 0.1, speed: 0.3, spinPreference: 0.4, errorRate: 0.05 }
    },

    // --- GOLD LEAGUE ---
    {
        id: 'spin_doctor_sid',
        name: 'Spin Doctor Sid',
        avatarId: 'spin_doctor_sid',
        leagueId: 'gold_1',
        bio: 'Master of english. Can make the cue ball dance.',
        stats: { accuracy: 0.75, consistency: 0.7, aggression: 0.6, speed: 0.5, spinPreference: 0.9, errorRate: 0.08 }
    },
    {
        id: 'power_pete',
        name: 'Power Pete',
        avatarId: 'power_pete',
        leagueId: 'gold_1',
        bio: 'Breaks like a cannon. Overpowers shots but has great potting ability.',
        stats: { accuracy: 0.75, consistency: 0.6, aggression: 0.9, speed: 0.8, spinPreference: 0.5, errorRate: 0.1 }
    },
    {
        id: 'finesse_fiona',
        name: 'Finesse Fiona',
        avatarId: 'finesse_fiona',
        leagueId: 'gold_2',
        bio: 'Soft touch. Perfect speed control on every shot.',
        stats: { accuracy: 0.8, consistency: 0.9, aggression: 0.4, speed: 0.5, spinPreference: 0.6, errorRate: 0.03 }
    },
    {
        id: 'shark_sally',
        name: 'Shark Sally',
        avatarId: 'shark_sally',
        leagueId: 'gold_3',
        bio: 'Will hustle you for everything you have. Ruthless efficiency.',
        stats: { accuracy: 0.85, consistency: 0.85, aggression: 0.7, speed: 0.7, spinPreference: 0.7, errorRate: 0.02 }
    },

    // --- PLATINUM LEAGUE ---
    {
        id: 'trickshot_tim',
        name: 'Trickshot Tim',
        avatarId: 'trickshot_tim',
        leagueId: 'platinum_1',
        bio: 'Internet famous for his trick shots. Can escape any snooker.',
        stats: { accuracy: 0.88, consistency: 0.8, aggression: 0.8, speed: 0.6, spinPreference: 0.95, errorRate: 0.05 }
    },
    {
        id: 'precision_paul',
        name: 'Precision Paul',
        avatarId: 'precision_paul',
        leagueId: 'platinum_2',
        bio: 'Never misses a straight shot. Positioning is his only weakness.',
        stats: { accuracy: 0.95, consistency: 0.9, aggression: 0.5, speed: 0.5, spinPreference: 0.4, errorRate: 0.01 }
    },
    {
        id: 'viper_vicky',
        name: 'Viper Vicky',
        avatarId: 'viper_vicky',
        leagueId: 'platinum_3',
        bio: 'Strikes fast and deadly. Don\'t blink.',
        stats: { accuracy: 0.9, consistency: 0.85, aggression: 0.85, speed: 0.95, spinPreference: 0.7, errorRate: 0.04 }
    },

    // --- DIAMOND LEAGUE ---
    {
        id: 'master_mike',
        name: 'Master Mike',
        avatarId: 'master_mike',
        leagueId: 'diamond_1',
        bio: 'Former world champion. Has seen it all.',
        stats: { accuracy: 0.95, consistency: 0.95, aggression: 0.6, speed: 0.6, spinPreference: 0.8, errorRate: 0.01 }
    },
    {
        id: 'legend_larry',
        name: 'Legend Larry',
        avatarId: 'legend_larry',
        leagueId: 'diamond_2',
        bio: 'A living legend. The table is his canvas.',
        stats: { accuracy: 0.98, consistency: 0.98, aggression: 0.7, speed: 0.7, spinPreference: 0.9, errorRate: 0.0 }
    },
    {
        id: 'the_machine',
        name: 'The Machine',
        avatarId: 'the_machine',
        leagueId: 'diamond_3',
        bio: 'Is it even human? Flawless execution. Zero emotion.',
        stats: { accuracy: 1.0, consistency: 1.0, aggression: 0.8, speed: 1.0, spinPreference: 1.0, errorRate: 0.0 }
    }
];

export function getOpponentById(id: string): OpponentDef | undefined {
    return OPPONENTS.find(o => o.id === id);
}

export function getOpponentsByLeague(leagueId: string): OpponentDef[] {
    // Simple tier matching (e.g. 'bronze' matches 'bronze_1', 'bronze_2')
    const tier = leagueId.split('_')[0].toLowerCase();
    return OPPONENTS.filter(o => o.leagueId.toLowerCase().startsWith(tier));
}
