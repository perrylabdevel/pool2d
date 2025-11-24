export interface CurrencyBalances {
    coins: number;
    gold: number;
}

type Listener = (balances: CurrencyBalances) => void;

/**
 * Simple in-memory currency store so scenes share wallet values.
 * Can be replaced with a real backend/session store later.
 */
class CurrencyStore {
    private balances: CurrencyBalances = { coins: 2500, gold: 85 };
    private listeners: Listener[] = [];

    getBalances(): CurrencyBalances {
        return { ...this.balances };
    }

    setBalances(balances: CurrencyBalances) {
        this.balances = { ...balances };
        this.notify();
    }

    addCoins(amount: number) {
        this.balances.coins += amount;
        this.notify();
    }

    addGold(amount: number) {
        this.balances.gold += amount;
        this.notify();
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
}

export const currencyStore = new CurrencyStore();
