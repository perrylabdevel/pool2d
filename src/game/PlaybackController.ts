import { PhysicsWorld } from '../physics/Physics';
import { MatchData, PhysicsSnapshot, CueState } from '../debug/PhysicsRecorder';

export class PlaybackController {
    public world: PhysicsWorld;
    private matchData: MatchData | null = null;

    // Playback state
    isPlaying: boolean = false;
    currentTime: number = 0;
    playbackSpeed: number = 1.0;
    duration: number = 0;

    // Visual state
    public currentCueState: CueState | null = null;

    // Navigation state
    currentShotIndex: number = -1;
    private lastEventTime: number = 0;

    // Events
    onTimeUpdate?: (time: number) => void;
    onStateChange?: (isPlaying: boolean) => void;
    onShotChange?: (shotIndex: number) => void;
    onComplete?: () => void;

    constructor(world: PhysicsWorld) {
        this.world = world;
    }

    loadMatch(data: MatchData) {
        console.log('📼 PlaybackController.loadMatch', { duration: data.duration, snapshots: data.snapshots.length });
        this.matchData = data;
        this.duration = data.duration;
        this.currentTime = 0;
        this.currentShotIndex = -1;
        this.playbackSpeed = 1.0;
        this.lastEventTime = 0;

        // Reset world to initial state
        this.seek(0);

        // Auto-start playback
        this.isPlaying = true;
        this.onStateChange?.(true);

        // Notify duration update for UI
        window.dispatchEvent(new CustomEvent('playback:durationUpdate', { detail: this.duration }));
    }

    getMatchData(): MatchData | null {
        return this.matchData;
    }

    play() {
        console.log('📼 PlaybackController.play', { hasData: !!this.matchData });
        if (!this.matchData) return;
        this.isPlaying = true;
        this.onStateChange?.(true);
        this.lastEventTime = this.currentTime;
    }

    pause() {
        this.isPlaying = false;
        this.onStateChange?.(false);
    }

    togglePlay() {
        if (this.isPlaying) this.pause();
        else this.play();
    }

    setSpeed(speed: number) {
        this.playbackSpeed = speed;
    }

    prevShot() {
        if (!this.matchData || !this.matchData.shots || this.matchData.shots.length === 0) {
            console.log('⏪ No shots to navigate');
            return;
        }

        // Find previous shot
        const shots = this.matchData.shots;
        let targetIndex = this.currentShotIndex - 1;

        // If at beginning of current shot, go to previous shot
        // Otherwise, restart current shot
        if (this.currentShotIndex >= 0) {
            const currentShot = shots[this.currentShotIndex];
            if (this.currentTime - currentShot.startTime < 0.5) {
                // Already near start of shot, go to previous
                targetIndex = this.currentShotIndex - 1;
            } else {
                // Go to start of current shot
                targetIndex = this.currentShotIndex;
            }
        }

        if (targetIndex < 0) {
            // Wrap to last shot
            targetIndex = shots.length - 1;
        }

        const shot = shots[targetIndex];
        this.seek(shot.startTime);
        this.currentShotIndex = targetIndex;

        console.log('⏪ Jumped to shot', this.currentShotIndex + 1, 'of', shots.length);
        this.onShotChange?.(this.currentShotIndex);
    }

    nextShot() {
        if (!this.matchData || !this.matchData.shots || this.matchData.shots.length === 0) {
            console.log('⏩ No shots to navigate');
            return;
        }

        const shots = this.matchData.shots;
        let targetIndex = this.currentShotIndex + 1;

        if (targetIndex >= shots.length) {
            // Wrap to first shot
            targetIndex = 0;
        }

        const shot = shots[targetIndex];
        this.seek(shot.startTime);
        this.currentShotIndex = targetIndex;
        console.log('⏩ Jumped to shot', this.currentShotIndex + 1, 'of', shots.length);

        this.onShotChange?.(this.currentShotIndex);
    }

    update(dt: number) {
        if (!this.isPlaying || !this.matchData) return;

        // Advance time
        const prevTime = this.currentTime;
        const newTime = this.currentTime + dt * this.playbackSpeed;

        if (newTime >= this.duration) {
            this.currentTime = this.duration;
            this.pause();
            this.seek(this.duration);
            this.onComplete?.();
            window.dispatchEvent(new CustomEvent('playback:ended'));
        } else {
            this.seek(newTime);
            // Play sounds only when playing forward normally
            if (this.playbackSpeed > 0) {
                this.playSounds(prevTime, newTime);
            }
        }
    }

    seek(time: number) {
        if (!this.matchData) return;

        // Clamp time
        this.currentTime = Math.max(0, Math.min(time, this.duration));

        // Reset event tracking on seek (don't play sounds during scrub)
        this.lastEventTime = this.currentTime;

        // Use global snapshots for interpolation
        if (this.matchData.snapshots && this.matchData.snapshots.length > 0) {
            this.applySnapshotInterpolation(this.matchData.snapshots, this.currentTime);
        }

        this.updateCurrentShotIndex(this.currentTime);
        this.onTimeUpdate?.(this.currentTime);
    }

    getCurrentCueState(): CueState | null {
        return this.currentCueState;
    }

    private playSounds(startTime: number, endTime: number) {
        if (!this.matchData) return;

        // Find sound events in the time window
        const events = this.matchData.events.filter(e =>
            e.type === 'sound' && e.time > startTime && e.time <= endTime
        );

        events.forEach(e => {
            if (e.data && e.data.name) {
                window.dispatchEvent(new CustomEvent('playback:sound', {
                    detail: { name: e.data.name, intensity: e.data.intensity }
                }));
            }
        });
    }

    private updateWorldState(time: number) {
        // Deprecated in favor of direct seek logic using global snapshots
        // But kept if needed for specific shot logic later
        this.seek(time);
    }

    private applySnapshotInterpolation(snapshots: PhysicsSnapshot[], time: number) {
        if (snapshots.length === 0) return;

        // Binary search for the two snapshots surrounding 'time'
        let low = 0;
        let high = snapshots.length - 1;

        if (time <= snapshots[0].time) {
            this.applyState(snapshots[0]);
            return;
        }
        if (time >= snapshots[high].time) {
            this.applyState(snapshots[high]);
            return;
        }

        while (low <= high) {
            const mid = Math.floor((low + high) / 2);
            if (snapshots[mid].time < time) {
                low = mid + 1;
            } else {
                high = mid - 1;
            }
        }

        // Now 'high' is the index before 'time', and 'low' is the index after 'time'
        const prev = snapshots[high];
        const next = snapshots[low];

        if (!prev || !next) {
            this.applyState(prev || next || snapshots[0]);
            return;
        }

        // Interpolate
        const total = next.time - prev.time;
        const alpha = total > 0.0001 ? (time - prev.time) / total : 0;

        this.interpolateState(prev, next, alpha);
    }

    private applyState(snapshot: PhysicsSnapshot) {
        // Sync world balls to snapshot
        snapshot.balls.forEach(snapBall => {
            const ball = this.world.getBallById(snapBall.id);
            if (!ball) {
                return;
            }

            // Keep renderer interpolation coherent by syncing "previous" state before overriding positions.
            ball.saveState();
            ball.x = snapBall.x;
            ball.y = snapBall.y;
            ball.vx = snapBall.vx;
            ball.vy = snapBall.vy;
            ball.pocketed = snapBall.pocketed;
            ball.sleeping = snapBall.sleeping;

            if (snapBall.quaternion) {
                ball.rotX = snapBall.quaternion[0];
                ball.rotY = snapBall.quaternion[1];
                ball.rotZ = snapBall.quaternion[2];
                ball.rotW = snapBall.quaternion[3];
            }
        });

        // Apply cue state
        this.currentCueState = snapshot.cue || null;
    }

    private interpolateState(prev: PhysicsSnapshot, next: PhysicsSnapshot, alpha: number) {
        prev.balls.forEach(prevBall => {
            const nextBall = next.balls.find(b => b.id === prevBall.id);
            if (!nextBall) return;

            const ball = this.world.getBallById(prevBall.id);
            if (!ball) return;

            // Preserve previous frame values before writing interpolated state.
            ball.saveState();

            // Lerp position
            ball.x = prevBall.x + (nextBall.x - prevBall.x) * alpha;
            ball.y = prevBall.y + (nextBall.y - prevBall.y) * alpha;

            // Lerp velocity (visual only)
            ball.vx = prevBall.vx + (nextBall.vx - prevBall.vx) * alpha;
            ball.vy = prevBall.vy + (nextBall.vy - prevBall.vy) * alpha;

            // Discrete states
            ball.pocketed = alpha > 0.9 ? nextBall.pocketed : prevBall.pocketed;
            ball.sleeping = alpha > 0.9 ? nextBall.sleeping : prevBall.sleeping;

            // Slerp rotation
            if (prevBall.quaternion && nextBall.quaternion) {
                const q1 = prevBall.quaternion;
                const q2 = nextBall.quaternion;

                const rx = q1[0] + (q2[0] - q1[0]) * alpha;
                const ry = q1[1] + (q2[1] - q1[1]) * alpha;
                const rz = q1[2] + (q2[2] - q1[2]) * alpha;
                const rw = q1[3] + (q2[3] - q1[3]) * alpha;

                const len = Math.sqrt(rx * rx + ry * ry + rz * rz + rw * rw);
                if (len > 0) {
                    ball.rotX = rx / len;
                    ball.rotY = ry / len;
                    ball.rotZ = rz / len;
                    ball.rotW = rw / len;
                }
            }
        });

        // Interpolate cue state
        if (prev.cue && next.cue) {
            // Helper for angle interpolation
            const lerpAngle = (a: number, b: number, t: number) => {
                const diff = b - a;
                const adjusted = diff - Math.PI * 2 * Math.floor((diff + Math.PI) / (Math.PI * 2));
                return a + adjusted * t;
            };

            this.currentCueState = {
                active: prev.cue.active,
                x: prev.cue.x + (next.cue.x - prev.cue.x) * alpha,
                y: prev.cue.y + (next.cue.y - prev.cue.y) * alpha,
                angle: lerpAngle(prev.cue.angle, next.cue.angle, alpha),
                power: prev.cue.power + (next.cue.power - prev.cue.power) * alpha,
                isAiming: prev.cue.isAiming,
                guideLineVisible: prev.cue.guideLineVisible
            };
        } else {
            this.currentCueState = prev.cue || next.cue || null;
        }
    }

    private updateCurrentShotIndex(time: number) {
        if (!this.matchData) return;

        let newIndex = -1;
        for (let i = 0; i < this.matchData.shots.length; i++) {
            const shot = this.matchData.shots[i];
            const endTime = shot.endTime ?? this.duration;
            if (time >= shot.startTime && time <= endTime) {
                newIndex = i;
                break;
            }
        }

        if (newIndex !== this.currentShotIndex) {
            this.currentShotIndex = newIndex;
            this.onShotChange?.(newIndex);
        }
    }

    // nextShot/prevShot defined earlier with full navigation logic
}
