
import { uiStateMachine, UIState, TransitionType } from './UIStateMachine';
import { uiRoot } from './UIRoot';
import { LobbyScene } from './scenes/LobbyScene';
import { PlayModesScene } from './scenes/PlayModesScene';
import { ShopScene } from './scenes/ShopScene';
import { EventsScene } from './scenes/EventsScene';
import { GoldenSpinScene } from './scenes/GoldenSpinScene';
import { ProfileScene } from './scenes/ProfileScene';
import { ConfirmScene } from './scenes/ConfirmScene';
import { InGameMenuScene } from './scenes/InGameMenuScene';
import { SettingsScene } from './scenes/SettingsScene';
import { CustomizationScene } from './scenes/CustomizationScene';
import { LeagueScene } from './scenes/LeagueScene';
import { MatchResultScene } from './scenes/MatchResultScene';
import { OpponentPreviewScene } from './scenes/OpponentPreviewScene';
import { uiSoundService } from './UISoundService';
import { FocusManager } from './input/FocusManager';

import { ClubSelectionScene } from './scenes/ClubSelectionScene';

import { MatchmakingScene } from './scenes/MatchmakingScene';

export interface UIScene {
    mount(): void;
    unmount(): void;
    update(dt: number): void;
    render(ctx: CanvasRenderingContext2D): void;
}

// Re-export TransitionType for backward compatibility
export { TransitionType };

export class SceneController {
    private currentScene: UIScene | null = null;
    private nextScene: UIScene | null = null;
    private canvas: HTMLCanvasElement;
    private ctx: CanvasRenderingContext2D;
    private scenes: Map<UIState, UIScene> = new Map();

    private isTransitioning = false;
    private transitionProgress = 0;
    private transitionDuration = 0.3; // seconds
    private transitionType: TransitionType = TransitionType.CROSS_FADE;

    public focusManager: FocusManager;

    constructor() {
        // Use dedicated UI stage canvas for scenes so gameplay overlays
        // on the HUD/UI canvas are not affected.
        this.canvas = uiRoot.getUIStageCanvas();
        const context = this.canvas.getContext('2d');
        if (!context) {
            throw new Error('Failed to get 2D context for UI canvas');
        }
        this.ctx = context;

        this.focusManager = new FocusManager();

        this.setupResizeListener();
        this.bindStateChanges();

        // Global Esc handler
        window.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                // If focus manager handles it, let it? 
                // But FocusManager currently only handles Arrow/Enter.
                // Let's defer to UIStateMachine's back logic.
                uiStateMachine.goBack();
            }
        });

        // Handle exit confirmation requests
        window.addEventListener('ui:request-confirm-exit', (e) => {
            const detail = (e as CustomEvent).detail;
            const confirmScene = this.getScene(UIState.CONFIRM) as ConfirmScene;
            if (confirmScene) {
                confirmScene.configure({
                    title: 'Forfeit Match?',
                    message: 'You will lose the match and your entry fee.',
                    confirmLabel: 'LEAVE',
                    cancelLabel: 'STAY',
                    returnState: UIState.IN_GAME, // If cancelled, go back to game (or stay in game)
                    onConfirm: () => {
                        // End the game properly?
                        const game = (window as any).poolGame;
                        if (game) {
                            // Maybe trigger forfeit logic?
                            // For now, just force the transition.
                            // The game loop will stop updating when scene changes.
                        }

                        if (detail.onConfirm) {
                            detail.onConfirm();
                        }
                    }
                });
                // We use forceTransition internally in UIStateMachine to bypass the guard,
                // but here we just need to show the confirm scene.
                // Since we are in IN_GAME, transitionTo(CONFIRM) is allowed by the guard.
                uiStateMachine.transitionTo(UIState.CONFIRM);
            }
        });

        // Register Scenes (SettingsScene will be registered later via initializeSettingsScene)
        this.registerScene(UIState.LOBBY, new LobbyScene());
        this.registerScene(UIState.PLAY_MODES, new PlayModesScene());
        this.registerScene(UIState.SHOP, new ShopScene());
        this.registerScene(UIState.EVENTS, new EventsScene());
        this.registerScene(UIState.EVENT_GOLDEN_SPIN, new GoldenSpinScene());
        this.registerScene(UIState.PROFILE, new ProfileScene());
        this.registerScene(UIState.LEAGUE, new LeagueScene());
        this.registerScene(UIState.CONFIRM, new ConfirmScene());
        this.registerScene(UIState.IN_GAME_MENU, new InGameMenuScene());
        this.registerScene(UIState.MATCH_RESULT, new MatchResultScene());
        this.registerScene(UIState.OPPONENT_PREVIEW, new OpponentPreviewScene());
        this.registerScene(UIState.CLUB_SELECTION, new ClubSelectionScene());
        this.registerScene(UIState.MATCHMAKING, new MatchmakingScene());

        // Start the render loop
        this.loop = this.loop.bind(this);
        requestAnimationFrame(this.loop);

        // Initial State
        this.switchScene(uiStateMachine.state, true);
    }

    public initializeSettingsScene(settingsManager: any) {
        this.registerScene(UIState.SETTINGS, new SettingsScene(settingsManager));
        this.registerScene(UIState.CUSTOMIZATION, new CustomizationScene(settingsManager));
    }

    public registerScene(state: UIState, scene: UIScene) {
        this.scenes.set(state, scene);
    }

    public getScene(state: UIState): UIScene | undefined {
        return this.scenes.get(state);
    }

    private bindStateChanges() {
        uiStateMachine.onStateChange((newState, _prevState, transition) => {
            const lobbyScene = this.scenes.get(UIState.LOBBY) as LobbyScene | undefined;
            if (lobbyScene && typeof lobbyScene.setCameFromGame === 'function') {
                lobbyScene.setCameFromGame(_prevState === UIState.IN_GAME);
            }
            // Show CONFIRM scene immediately without transition
            const immediate = newState === UIState.CONFIRM || _prevState === UIState.CONFIRM;
            this.switchScene(newState, immediate, transition);
        });
    }

    public switchScene(state: UIState, immediate = false, transition: TransitionType = TransitionType.CROSS_FADE) {
        const nextScene = this.scenes.get(state);

        if (!immediate && this.isTransitioning) {
            // Clean up any previously primed next scene before starting a new transition
            if (this.nextScene && this.nextScene !== nextScene) {
                this.nextScene.unmount();
            }
            this.nextScene = null;
            this.isTransitioning = false;
            this.transitionProgress = 0;
        }

        if (immediate) {
            if (this.currentScene) this.currentScene.unmount();
            this.focusManager.clear();
            this.currentScene = nextScene || null;
            if (this.currentScene) {
                this.currentScene.mount();
                this.canvas.style.display = 'block';
                this.canvas.style.pointerEvents = 'auto';
            } else {
                // No active scene (e.g. pure in-game)
                this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
                this.canvas.style.display = 'none';
                this.canvas.style.pointerEvents = 'none';
            }
            return;
        }

        if (nextScene && nextScene !== this.currentScene) {
            this.nextScene = nextScene;
            this.nextScene.mount();
            this.isTransitioning = true;
            this.transitionProgress = 0;
            this.transitionType = transition; // Use the requested transition
            this.canvas.style.display = 'block';
            this.canvas.style.pointerEvents = 'auto';

            // Play sound
            uiSoundService.play('modal-open');
        } else if (!nextScene) {
            // Transition to nothing (e.g. in-game)
            if (this.currentScene) this.currentScene.unmount();
            this.focusManager.clear();
            this.currentScene = null;
            this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
            this.canvas.style.display = 'none';
            this.canvas.style.pointerEvents = 'none';
        }
    }

    private setupResizeListener() {
        const resize = () => {
            const parent = this.canvas.parentElement as HTMLElement | null;
            const rect = parent?.getBoundingClientRect();
            const width = Math.max(1, rect?.width ?? window.innerWidth);
            const height = Math.max(1, rect?.height ?? window.innerHeight);
            this.canvas.width = width;
            this.canvas.height = height;
            this.canvas.style.width = `${width}px`;
            this.canvas.style.height = `${height}px`;
        };
        window.addEventListener('resize', resize);

        // Initial sizing - wait for layout to settle
        resize();
        requestAnimationFrame(() => {
            resize();
        });
    }

    private lastTime = 0;
    private loop(timestamp: number) {
        const dt = (timestamp - this.lastTime) / 1000;
        this.lastTime = timestamp;

        if (this.isTransitioning && this.nextScene) {
            // Only clear when we are actively rendering a scene/transition
            this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
            this.transitionProgress += dt / this.transitionDuration;

            if (this.transitionProgress >= 1) {
                // Finish transition
                this.isTransitioning = false;
                if (this.currentScene) this.currentScene.unmount();
                // Do NOT clear focus here, as the next scene has already mounted and set up its focus
                this.currentScene = this.nextScene;
                this.nextScene = null;
                if (this.currentScene) {
                    this.currentScene.update(dt);
                    this.currentScene.render(this.ctx);
                }
            } else {
                // Render Transition
                this.renderTransition(this.ctx);
            }
        } else if (this.currentScene) {
            // Only clear when an active scene is present
            this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
            this.currentScene.update(dt);
            this.currentScene.render(this.ctx);
        }

        requestAnimationFrame(this.loop);
    }

    private renderTransition(ctx: CanvasRenderingContext2D) {
        const alpha = Math.max(0, Math.min(1, this.transitionProgress));
        const width = this.canvas.width;

        if (this.transitionType === TransitionType.CROSS_FADE) {
            // Draw current scene (fading out)
            if (this.currentScene) {
                ctx.save();
                ctx.globalAlpha = 1 - alpha;
                this.currentScene.render(ctx);
                ctx.restore();
            }

            // Draw next scene (fading in)
            if (this.nextScene) {
                ctx.save();
                ctx.globalAlpha = alpha;
                this.nextScene.render(ctx);
                ctx.restore();
            }
        } else if (this.transitionType === TransitionType.SLIDE_LEFT) {
            // Slide current out to left, next in from right
            const offset = width * alpha;

            if (this.currentScene) {
                ctx.save();
                ctx.translate(-offset, 0);
                this.currentScene.render(ctx);
                ctx.restore();
            }

            if (this.nextScene) {
                ctx.save();
                ctx.translate(width - offset, 0);
                this.nextScene.render(ctx);
                ctx.restore();
            }
        } else if (this.transitionType === TransitionType.SLIDE_RIGHT) {
            // Slide current out to right, next in from left
            const offset = width * alpha;

            if (this.currentScene) {
                ctx.save();
                ctx.translate(offset, 0);
                this.currentScene.render(ctx);
                ctx.restore();
            }

            if (this.nextScene) {
                ctx.save();
                ctx.translate(-(width - offset), 0);
                this.nextScene.render(ctx);
                ctx.restore();
            }
        }
    }
}

export const sceneController = new SceneController();
