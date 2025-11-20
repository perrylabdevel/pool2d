
export enum UIState {
    LOBBY = 'LOBBY',
    PLAY_MODES = 'PLAY_MODES',
    SHOP = 'SHOP',
    PROFILE = 'PROFILE',
    IN_GAME = 'IN_GAME',
    IN_GAME_MENU = 'IN_GAME_MENU'
}

type StateChangeListener = (newState: UIState, previousState: UIState) => void;

export class UIStateMachine {
    private currentState: UIState = UIState.LOBBY;
    private listeners: StateChangeListener[] = [];

    public get state(): UIState {
        return this.currentState;
    }

    public transitionTo(newState: UIState) {
        if (this.currentState === newState) return;

        const previousState = this.currentState;
        this.currentState = newState;

        console.log(`[UIStateMachine] Transition: ${previousState} -> ${newState}`);
        this.notifyListeners(newState, previousState);

        // Dispatch global event for other systems
        window.dispatchEvent(new CustomEvent('ui:state:changed', {
            detail: { from: previousState, to: newState }
        }));
    }

    public onStateChange(listener: StateChangeListener) {
        this.listeners.push(listener);
    }

    private notifyListeners(newState: UIState, previousState: UIState) {
        this.listeners.forEach(l => l(newState, previousState));
    }
}

export const uiStateMachine = new UIStateMachine();
