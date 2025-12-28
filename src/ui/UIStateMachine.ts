export enum UIState {
    LOBBY = 'LOBBY',
    PLAY_MODES = 'PLAY_MODES',
    SHOP = 'SHOP',
    CUE_DETAIL = 'CUE_DETAIL',
    EVENTS = 'EVENTS',
    EVENT_GOLDEN_SPIN = 'EVENT_GOLDEN_SPIN',
    LEAGUE = 'LEAGUE',
    PROFILE = 'PROFILE',
    CLUB_SELECTION = 'CLUB_SELECTION',
    CONFIRM = 'CONFIRM',
    SETTINGS = 'SETTINGS',
    CUSTOMIZATION = 'CUSTOMIZATION',
    IN_GAME = 'IN_GAME',
    IN_GAME_MENU = 'IN_GAME_MENU',
    MATCH_RESULT = 'MATCH_RESULT',
    OPPONENT_PREVIEW = 'OPPONENT_PREVIEW',
    MATCHMAKING = 'MATCHMAKING'
}

export enum TransitionType {
    NONE,
    CROSS_FADE,
    SLIDE_LEFT,
    SLIDE_RIGHT
}

import { notificationService } from './NotificationService';

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

        // Navigation Guard: Prevent leaving IN_GAME or IN_GAME_MENU if match is in progress
        // Exceptions: 
        // 1. Going to MATCH_RESULT (natural flow)
        // 2. Going to IN_GAME_MENU (pause menu)
        // 3. Going to IN_GAME (resume)
        // 4. Going to SETTINGS (overlay)
        // 5. Going to CONFIRM (we are showing the confirmation itself)

        const isGameSourceState = this.currentState === UIState.IN_GAME || this.currentState === UIState.IN_GAME_MENU;
        const isSafeTargetState =
            newState === UIState.MATCH_RESULT ||
            newState === UIState.IN_GAME_MENU ||
            newState === UIState.IN_GAME ||
            newState === UIState.SETTINGS ||
            newState === UIState.CONFIRM;

        if (isGameSourceState && !isSafeTargetState) {

            const game = (window as any).poolGame;
            if (game && typeof game.isInProgress === 'function' && game.isInProgress()) {
                // Redirect to Confirm Scene
                // We need to access SceneController to configure the confirm scene, 
                // but we can't import it directly due to circular dependency.
                // We'll dispatch an event that SceneController or a mediator listens to,
                // OR we can rely on the fact that we are about to transition to CONFIRM state,
                // and the ConfirmScene can be configured by the caller? 
                // Actually, simpler: We can't easily configure the ConfirmScene from here without circular deps.

                // Alternative: Let the caller handle the check? No, we want a central guard.

                // Best approach for now: Use a custom event to request the confirmation UI,
                // and let the SceneController or a dedicated service handle the setup.
                // BUT, for simplicity in this codebase, we can try to access the scene via global or just
                // assume the ConfirmScene has a default "Are you sure?" state if not configured.

                // Better yet: Just transition to CONFIRM, and let the ConfirmScene's mount() 
                // check if it was configured. If not, it could show a default "Forfeit?" message.
                // To configure it, we can use a static helper or global service.

                // Let's use the ConfirmScene static helper pattern if it existed, but it doesn't.
                // We will dispatch an event 'ui:request-confirm-exit' which SceneController can listen to.
                window.dispatchEvent(new CustomEvent('ui:request-confirm-exit', {
                    detail: {
                        targetState: newState,
                        onConfirm: () => {
                            // Force the transition by bypassing this check (how? maybe a flag or just checking if we are coming from CONFIRM?)
                            // Actually, if we are in CONFIRM, the next transition is valid.
                            // But we need to transition TO the target state.
                            // The ConfirmScene will call transitionTo(targetState).
                            // But wait, if we call transitionTo(targetState) again, it will trigger this guard again!
                            // We need a way to "force" it.

                            // Hack: We can temporarily set a flag on the game or here.
                            this.forceTransition(newState, transition);
                        }
                    }
                }));
                return;
            }
        }

        this.performTransition(newState, transition);
    }

    public forceTransition(newState: UIState, transition?: TransitionType) {
        this.performTransition(newState, transition);
    }

    private performTransition(newState: UIState, transition?: TransitionType) {
        // Clear any pending notifications when changing scenes
        notificationService.clear();

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
            UIState.CUE_DETAIL,
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
    public goBack() {
        // Simple history/hierarchy based back navigation
        switch (this.currentState) {
            case UIState.PLAY_MODES:
            case UIState.SHOP:
            case UIState.CUE_DETAIL:
            case UIState.EVENTS:
            case UIState.LEAGUE:
            case UIState.PROFILE:
            case UIState.SETTINGS:
            case UIState.CLUB_SELECTION:
                this.transitionTo(UIState.LOBBY);
                break;
            case UIState.CUSTOMIZATION:
                this.transitionTo(UIState.SETTINGS);
                break;
            case UIState.EVENT_GOLDEN_SPIN:
                this.transitionTo(UIState.EVENTS);
                break;
            case UIState.MATCHMAKING:
                this.transitionTo(UIState.CLUB_SELECTION);
                break;
            case UIState.OPPONENT_PREVIEW:
                // Cannot go back from opponent preview usually, but maybe to matchmaking?
                break;
            case UIState.IN_GAME_MENU:
                this.transitionTo(UIState.IN_GAME);
                break;
            case UIState.LOBBY:
                // Esc in Lobby goes to game (existing behavior)
                this.transitionTo(UIState.IN_GAME);
                break;
        }
    }
}

export const uiStateMachine = new UIStateMachine();
