export enum UIState {
    LOBBY = 'LOBBY',
    PLAY_MODES = 'PLAY_MODES',
    SHOP = 'SHOP',
    EVENTS = 'EVENTS',
    EVENT_GOLDEN_SPIN = 'EVENT_GOLDEN_SPIN',
    LEAGUE = 'LEAGUE',
    PROFILE = 'PROFILE',
    CLUB_SELECTION = 'CLUB_SELECTION',
    CONFIRM = 'CONFIRM',
    SETTINGS = 'SETTINGS',
    IN_GAME = 'IN_GAME',
    IN_GAME_MENU = 'IN_GAME_MENU',
    MATCH_RESULT = 'MATCH_RESULT',
    OPPONENT_PREVIEW = 'OPPONENT_PREVIEW'
}

export enum TransitionType {
    NONE,
    CROSS_FADE,
    SLIDE_LEFT,
    SLIDE_RIGHT
}

type StateChangeListener = (newState: UIState, previousState: UIState, transition: TransitionType) => void;

export class UIStateMachine {
    // Default to in-game so the table is the primary view,
    // and we can explicitly navigate to LOBBY when needed.
    private currentState: UIState = UIState.IN_GAME;
    private listeners: StateChangeListener[] = [];

    public get state(): UIState {
        return this.currentState;
    }

    public transitionTo(newState: UIState, transition?: TransitionType) {
        if (this.currentState === newState) return;

        const previousState = this.currentState;
        this.currentState = newState;

        // Determine transition type if not specified
        const finalTransition = transition ?? this.determineTransition(previousState, newState);

        console.log(`[UIStateMachine] Transition: ${previousState} -> ${newState} (${TransitionType[finalTransition]})`);
        this.notifyListeners(newState, previousState, finalTransition);

        // Dispatch global event for other systems
        window.dispatchEvent(new CustomEvent('ui:state:changed', {
            detail: { from: previousState, to: newState, transition: finalTransition }
        }));
    }

    private determineTransition(from: UIState, to: UIState): TransitionType {
        // Entering/exiting game - use fade
        if (from === UIState.IN_GAME || to === UIState.IN_GAME) {
            return TransitionType.CROSS_FADE;
        }

        // CONFIRM modal should appear immediately (no transition)
        if (to === UIState.CONFIRM || from === UIState.CONFIRM) {
            return TransitionType.CROSS_FADE;
        }

        // Navigation hierarchy for slides
        const hierarchy = [
            UIState.LOBBY,
            UIState.PLAY_MODES,
            UIState.SHOP,
            UIState.EVENTS,
            UIState.EVENT_GOLDEN_SPIN,
            UIState.SETTINGS,
            UIState.LEAGUE,
            UIState.PROFILE
        ];
        const fromIndex = hierarchy.indexOf(from);
        const toIndex = hierarchy.indexOf(to);

        if (fromIndex !== -1 && toIndex !== -1) {
            return toIndex > fromIndex ? TransitionType.SLIDE_LEFT : TransitionType.SLIDE_RIGHT;
        }

        // Default to cross fade
        return TransitionType.CROSS_FADE;
    }

    public onStateChange(listener: StateChangeListener) {
        this.listeners.push(listener);
    }

    private notifyListeners(newState: UIState, previousState: UIState, transition: TransitionType) {
        this.listeners.forEach(l => l(newState, previousState, transition));
    }
}

export const uiStateMachine = new UIStateMachine();
