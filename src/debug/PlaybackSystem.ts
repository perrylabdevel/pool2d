import { Game } from '../game/Game';
import { FrameData } from './GameRecorder';

export class PlaybackSystem {
    private recording: FrameData[] = [];
    private isPlaying: boolean = false;
    private currentFrameIndex: number = 0;
    private game: Game;

    constructor(game: Game) {
        this.game = game;
    }

    loadRecording(recording: FrameData[]) {
        this.recording = recording;
        this.currentFrameIndex = 0;
        this.isPlaying = false;
        console.log(`PlaybackSystem: Loaded recording with ${recording.length} frames`);
    }

    play() {
        if (this.recording.length === 0) return;
        this.isPlaying = true;
    }

    pause() {
        this.isPlaying = false;
    }

    stop() {
        this.isPlaying = false;
        this.currentFrameIndex = 0;
    }

    isActive(): boolean {
        return this.recording.length > 0;
    }

    isPaused(): boolean {
        return !this.isPlaying;
    }

    seek(frameIndex: number) {
        if (this.recording.length === 0) return;
        this.currentFrameIndex = Math.max(0, Math.min(frameIndex, this.recording.length - 1));
        this.applyFrame(this.recording[this.currentFrameIndex]);
    }

    step(direction: number) {
        if (this.recording.length === 0) return;
        const newIndex = Math.max(0, Math.min(this.currentFrameIndex + direction, this.recording.length - 1));
        this.currentFrameIndex = newIndex;
        this.applyFrame(this.recording[this.currentFrameIndex]);
    }

    update() {
        if (!this.isPlaying || this.recording.length === 0) return;

        this.currentFrameIndex++;

        if (this.currentFrameIndex >= this.recording.length) {
            this.currentFrameIndex = this.recording.length - 1;
            this.pause();
            return;
        }

        this.applyFrame(this.recording[this.currentFrameIndex]);
    }

    private applyFrame(frame: FrameData) {
        const world = this.game.world;
        const stateMachine = this.game.stateMachine;

        // Apply Ball State
        frame.balls.forEach(ballState => {
            const ball = world.getBallById(ballState.id);
            if (ball) {
                ball.x = ballState.x;
                ball.y = ballState.y;
                ball.vx = ballState.vx;
                ball.vy = ballState.vy;
                ball.rotX = ballState.rotX;
                ball.rotY = ballState.rotY;
                ball.rotZ = ballState.rotZ;
                ball.rotW = ballState.rotW;
                ball.pocketed = ballState.pocketed;
            }
        });

        // Apply Game State
        if (stateMachine) {
            stateMachine.data.currentState = frame.gameState.state;
            stateMachine.data.turnNumber = frame.gameState.turnNumber;
            stateMachine.data.shotClock = frame.gameState.shotClock;
        }
    }

    getCurrentFrameIndex(): number {
        return this.currentFrameIndex;
    }

    getTotalFrames(): number {
        return this.recording.length;
    }
}
