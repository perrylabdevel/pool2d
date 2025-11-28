import { ClubDef } from '../../data/models';

export const CLUBS: ClubDef[] = [
    {
        id: 'club_basement',
        name: 'The Basement',
        description: 'Where it all begins. Low stakes, high hopes.',
        entryFee: 50,
        minLevel: 1,
        minTrophies: 0,
        difficulty: 1,
        tableId: 'table_standard'
    },
    {
        id: 'club_corner_pocket',
        name: 'Corner Pocket',
        description: 'A local favorite. Good for practice.',
        entryFee: 100,
        minLevel: 2,
        minTrophies: 20,
        difficulty: 2,
        tableId: 'table_standard'
    },
    {
        id: 'club_downtown',
        name: 'Downtown Billiards',
        description: 'The hustle starts here. Watch your wallet.',
        entryFee: 500,
        minLevel: 5,
        minTrophies: 50,
        difficulty: 3,
        tableId: 'table_standard'
    },
    {
        id: 'club_shark_tank',
        name: 'The Shark Tank',
        description: 'Only for those who can swim with the big fish.',
        entryFee: 2500,
        minLevel: 10,
        minTrophies: 100,
        difficulty: 4,
        tableId: 'table_standard'
    },
    {
        id: 'club_neon_nights',
        name: 'Neon Nights',
        description: 'Flashy lights and fast games.',
        entryFee: 10000,
        minLevel: 15,
        minTrophies: 200,
        difficulty: 5,
        tableId: 'table_standard'
    },
    {
        id: 'club_velvet_lounge',
        name: 'Velvet Lounge',
        description: 'Smooth jazz and smoother shots.',
        entryFee: 50000,
        minLevel: 20,
        minTrophies: 500,
        difficulty: 6,
        tableId: 'table_standard'
    },
    {
        id: 'club_high_rollers',
        name: 'High Rollers',
        description: 'Big money, big pressure.',
        entryFee: 250000,
        minLevel: 30,
        minTrophies: 1000,
        difficulty: 7,
        tableId: 'table_standard'
    },
    {
        id: 'club_penthouse',
        name: 'The Penthouse',
        description: 'Pool with a view. Exclusive access only.',
        entryFee: 1000000,
        minLevel: 40,
        minTrophies: 2000,
        difficulty: 8,
        tableId: 'table_standard'
    },
    {
        id: 'club_sapphire',
        name: 'Sapphire Club',
        description: 'Cool, calm, and incredibly expensive.',
        entryFee: 5000000,
        minLevel: 50,
        minTrophies: 5000,
        difficulty: 9,
        tableId: 'table_standard'
    },
    {
        id: 'club_royal_palace',
        name: 'Royal Palace',
        description: 'Fit for a king. Play like royalty.',
        entryFee: 25000000,
        minLevel: 60,
        minTrophies: 10000,
        difficulty: 10,
        tableId: 'table_standard'
    },
    {
        id: 'club_diamond_summit',
        name: 'Diamond Summit',
        description: 'The peak of the mountain. Rare air up here.',
        entryFee: 50000000,
        minLevel: 70,
        minTrophies: 20000,
        difficulty: 10,
        tableId: 'table_standard'
    },
    {
        id: 'club_legends_arena',
        name: 'Legends Arena',
        description: 'Where immortals play. The ultimate challenge.',
        entryFee: 100000000,
        minLevel: 80,
        minTrophies: 50000,
        difficulty: 10,
        tableId: 'table_standard'
    }
];

export function getClubById(id: string): ClubDef | undefined {
    return CLUBS.find(c => c.id === id);
}
