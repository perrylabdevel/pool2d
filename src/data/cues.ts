import { CueDef } from './models';

export const DEFAULT_CUES: CueDef[] = [
    {
        id: 'default',
        name: 'Standard Issue',
        subtitle: 'The house favorite — honest wood, honest wins.',
        rarity: 'COMMON',
        stickColor: '#8B4513',
        tipColor: '#4A90E2',
        accent: '#F0A35E',
        stats: {
            power: 40,
            accuracy: 55,
            spin: 35,
            aim: 50
        }
    },
    {
        id: 'midnight',
        name: 'Midnight Stealth',
        subtitle: 'Low-glare finish for silent runouts.',
        rarity: 'RARE',
        stickColor: '#0F111A',
        tipColor: '#FF3333',
        accent: '#2B7FFF',
        stats: {
            power: 55,
            accuracy: 65,
            spin: 45,
            aim: 60
        }
    },
    {
        id: 'royal',
        name: 'Royal Oak',
        subtitle: 'A classic grain with a regal finish.',
        rarity: 'RARE',
        stickColor: '#5D4037',
        tipColor: '#FFD700',
        accent: '#D3A863',
        stats: {
            power: 60,
            accuracy: 60,
            spin: 50,
            aim: 55
        }
    },
    {
        id: 'cyber',
        name: 'Cyber Pulse',
        subtitle: 'Neon circuitry tuned for crisp strikes.',
        rarity: 'EPIC',
        stickColor: '#00B4FF',
        tipColor: '#FFFFFF',
        accent: '#7C5CFF',
        stats: {
            power: 70,
            accuracy: 70,
            spin: 65,
            aim: 60
        }
    },
    {
        id: 'viper',
        name: 'Viper Strike',
        subtitle: 'Fast, toxic, and dangerously precise.',
        rarity: 'EPIC',
        stickColor: '#66FF00',
        tipColor: '#000000',
        accent: '#7AFF33',
        stats: {
            power: 75,
            accuracy: 65,
            spin: 70,
            aim: 60
        }
    },
    {
        id: 'inferno',
        name: 'Dragon\'s Breath',
        subtitle: 'Forged heat, fearless breaks.',
        rarity: 'LEGENDARY',
        stickColor: '#FF3333',
        tipColor: '#FFD700',
        accent: '#FF7A18',
        stats: {
            power: 85,
            accuracy: 75,
            spin: 80,
            aim: 70
        }
    }
];
