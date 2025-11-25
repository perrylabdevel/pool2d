export interface ChestReward {
    coins: number;
    gold: number;
    items: string[]; // Item IDs
}

export enum ChestType {
    COMMON = 'chest_common',
    RARE = 'chest_rare',
    EPIC = 'chest_epic',
    LEGENDARY = 'chest_legendary'
}

export const CHEST_DEFINITIONS = {
    [ChestType.COMMON]: { minCoins: 50, maxCoins: 150, minGold: 0, maxGold: 1, itemChance: 0.1 },
    [ChestType.RARE]: { minCoins: 200, maxCoins: 500, minGold: 2, maxGold: 5, itemChance: 0.3 },
    [ChestType.EPIC]: { minCoins: 1000, maxCoins: 2500, minGold: 10, maxGold: 25, itemChance: 0.6 },
    [ChestType.LEGENDARY]: { minCoins: 5000, maxCoins: 10000, minGold: 50, maxGold: 100, itemChance: 1.0 }
};

export function openChest(type: ChestType): ChestReward {
    const def = CHEST_DEFINITIONS[type];
    const coins = Math.floor(Math.random() * (def.maxCoins - def.minCoins + 1)) + def.minCoins;
    const gold = Math.floor(Math.random() * (def.maxGold - def.minGold + 1)) + def.minGold;

    const items: string[] = [];
    if (Math.random() < def.itemChance) {
        // TODO: Implement item pool selection
        items.push('random_item_placeholder');
    }

    return { coins, gold, items };
}

export function getChestForLeague(leagueTier: number): ChestType {
    // Higher leagues give better chests
    const roll = Math.random();
    if (leagueTier >= 5) { // Diamond
        if (roll < 0.2) return ChestType.LEGENDARY;
        if (roll < 0.5) return ChestType.EPIC;
        return ChestType.RARE;
    }
    if (leagueTier >= 3) { // Gold/Platinum
        if (roll < 0.1) return ChestType.EPIC;
        if (roll < 0.4) return ChestType.RARE;
        return ChestType.COMMON;
    }
    // Bronze/Silver
    if (roll < 0.05) return ChestType.RARE;
    return ChestType.COMMON;
}
