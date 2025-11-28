import { ChestDef } from '../../data/models';

export const CHESTS: ChestDef[] = [
    {
        id: 'chest_bronze',
        type: 'bronze',
        minCoins: 100,
        maxCoins: 500,
        unlockTimeMs: 3 * 60 * 60 * 1000 // 3 hours
    },
    {
        id: 'chest_gold',
        type: 'gold',
        minCoins: 500,
        maxCoins: 2000,
        unlockTimeMs: 8 * 60 * 60 * 1000 // 8 hours
    },
    {
        id: 'chest_platinum',
        type: 'platinum',
        minCoins: 2000,
        maxCoins: 10000,
        unlockTimeMs: 12 * 60 * 60 * 1000 // 12 hours
    },
    {
        id: 'chest_diamond',
        type: 'diamond',
        minCoins: 10000,
        maxCoins: 50000,
        unlockTimeMs: 24 * 60 * 60 * 1000 // 24 hours
    }
];

export function getChestById(id: string): ChestDef | undefined {
    return CHESTS.find(c => c.id === id);
}
