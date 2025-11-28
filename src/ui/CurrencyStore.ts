import { db } from '../data/db';

export interface CurrencyBalances {
    coins: number;
    gold: number;
    trophies: number;
}

type Listener = (balances: CurrencyBalances) => void;

/**
 * Currency store that syncs with the database.
 * Provides real-time currency updates across all UI scenes.
 */
class CurrencyStore {
    private balances: CurrencyBalances = { coins: 0, gold: 0, trophies: 0 };
    private listeners: Listener[] = [];
    private initialized: boolean = false;

    /**
     * Initialize the store by loading from database
     */
    async initialize(): Promise<void> {
        if (this.initialized) return;

        try {
            const user = await db.user.get(1);
            if (user) {
                this.balances = {
                    coins: user.coins,
                    gold: user.gold,
                    trophies: user.trophies || 0
                };

                // Auto-fix negative balance or force top-up if needed
                if (this.balances.coins < 0) {
                    this.balances.coins = 10000;
                    this.syncToDatabase();
                    console.log('💰 Fixed negative balance to 10,000');
                }

                console.log('💰 Currency loaded from DB:', this.balances);
            }
            this.initialized = true;
            this.notify();
        } catch (e) {
            console.error('Failed to load currency from DB:', e);
        }
    }

    getBalances(): CurrencyBalances {
        return { ...this.balances };
    }

    setBalances(balances: CurrencyBalances) {
        this.balances = { ...balances };
        this.notify();
        this.syncToDatabase();
    }

    addCoins(amount: number) {
        this.balances.coins += amount;
        this.notify();
        this.syncToDatabase();
    }

    addGold(amount: number) {
        this.balances.gold += amount;
        this.notify();
        this.syncToDatabase();
    }

    addTrophies(amount: number) {
        this.balances.trophies += amount;
        this.notify();
        this.syncToDatabase();
    }

    /**
     * Deduct coins if available, returns true if successful
     */
    spendCoins(amount: number): boolean {
        if (this.balances.coins < amount) return false;
        this.balances.coins -= amount;
        this.notify();
        this.syncToDatabase();
        return true;
    }

    /**
     * Deduct gold if available, returns true if successful
     */
    spendGold(amount: number): boolean {
        if (this.balances.gold < amount) return false;
        this.balances.gold -= amount;
        this.notify();
        this.syncToDatabase();
        return true;
    }

    subscribe(listener: Listener): () => void {
        this.listeners.push(listener);
        // Send initial state
        listener(this.getBalances());
        return () => {
            this.listeners = this.listeners.filter(l => l !== listener);
        };
    }

    private notify() {
        const snapshot = this.getBalances();
        this.listeners.forEach(l => l(snapshot));
    }

    private async syncToDatabase() {
        try {
            await db.user.where('id').equals(1).modify({
                coins: this.balances.coins,
                gold: this.balances.gold,
                trophies: this.balances.trophies
            });
        } catch (e) {
            console.error('Failed to sync currency to DB:', e);
        }
    }
}

export const currencyStore = new CurrencyStore();
