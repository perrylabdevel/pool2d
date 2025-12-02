import { PhysicsWorld } from '../physics/Physics';
import { GameStateData, GameState } from '../game/GameStateMachine';

export interface BallState {
    id: number;
    x: number;
    y: number;
    vx: number;
    vy: number;
    rotX: number;
    rotY: number;
    rotZ: number;
    rotW: number;
    pocketed: boolean;
}

export interface FrameData {
    timestamp: number;
    balls: BallState[];
    gameState: {
        state: GameState;
        turnNumber: number;
        shotClock: number;
        currentPlayerId: number;
    };
}

export class GameRecorder {
    private frames: FrameData[] = [];
    private isRecording: boolean = false;
    private startTime: number = 0;

    start() {
        this.frames = [];
        this.isRecording = true;
        this.startTime = Date.now();
        console.log('GameRecorder: Started recording');
    }

    stop() {
        this.isRecording = false;
        console.log(`GameRecorder: Stopped recording. Captured ${this.frames.length} frames.`);
    }

    isActive(): boolean {
        return this.isRecording;
    }

    captureFrame(world: PhysicsWorld, state: GameStateData) {
        if (!this.isRecording) return;

        const balls: BallState[] = world.balls.map(b => ({
            id: b.id,
            x: b.x,
            y: b.y,
            vx: b.vx,
            vy: b.vy,
            rotX: b.rotX,
            rotY: b.rotY,
            rotZ: b.rotZ,
            rotW: b.rotW,
            pocketed: b.pocketed
        }));

        const frame: FrameData = {
            timestamp: Date.now() - this.startTime,
            balls,
            gameState: {
                state: state.currentState,
                turnNumber: state.turnNumber,
                shotClock: state.shotClock,
                currentPlayerId: state.currentPlayer.id
            }
        };

        this.frames.push(frame);
    }

    getRecording(): FrameData[] {
        return this.frames;
    }
}
