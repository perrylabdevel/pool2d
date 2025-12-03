// Physics event recorder for debugging and sharing
// Records physics events with timestamps for analysis

import { Ball } from '../physics/Shapes';
import { PhysicsWorld } from '../physics/Physics';

export interface CueState {
  active: boolean;
  x: number;
  y: number;
  angle: number;
  power: number;
  isAiming: boolean;
  guideLineVisible: boolean;
}

export interface PhysicsSnapshot {
  frame: number;
  time: number; // seconds since recording started
  balls: {
    id: number;
    x: number;
    y: number;
    vx: number;
    vy: number;
    speed: number;
    pocketed: boolean;
    sleeping: boolean;
    // Rotation data for visual fidelity
    quaternion: [number, number, number, number];
  }[];
  cue?: CueState;
}

export interface PhysicsEvent {
  frame: number;
  time: number;
  type: 'collision' | 'pocket' | 'shot' | 'marker' | 'sound';
  description: string;
  data?: any;
}

export interface ShotRecord {
  index: number;
  startTime: number;
  endTime: number | null;
  events: PhysicsEvent[];
  snapshots: PhysicsSnapshot[];
}

export interface MatchData {
  id: string;
  timestamp: number;
  duration: number;
  shots: ShotRecord[];
  events: PhysicsEvent[]; // Global events
  snapshots: PhysicsSnapshot[]; // Global snapshots
}

export class PhysicsRecorder {
  private recording: boolean = false;
  private startTime: number = 0;
  private frameCount: number = 0;
  private snapshots: PhysicsSnapshot[] = [];
  private events: PhysicsEvent[] = [];
  private shots: ShotRecord[] = [];
  private currentShot: ShotRecord | null = null;
  private snapshotInterval: number = 2; // Record more frequently for smooth playback (60fps / 2 = 30fps effective)

  start() {
    this.recording = true;
    this.startTime = performance.now();
    this.frameCount = 0;
    this.snapshots = [];
    this.events = [];
    this.shots = [];
    this.currentShot = null;
    console.log('📹 Physics recording started');
  }

  stop() {
    if (this.currentShot) {
      this.currentShot.endTime = (performance.now() - this.startTime) / 1000;
    }
    this.recording = false;
    console.log('⏹️ Physics recording stopped');
    this.printSummary();

    // Dispatch event with match data for devtools
    window.dispatchEvent(new CustomEvent('match:recorded', {
      detail: {
        timestamp: Date.now(),
        data: this.getMatchData()
      }
    }));
  }

  isRecording(): boolean {
    return this.recording;
  }

  recordFrame(world: PhysicsWorld, cueState?: CueState) {
    if (!this.recording) return;

    this.frameCount++;

    // Record snapshot at intervals
    if (this.frameCount % this.snapshotInterval === 0) {
      this.recordSnapshot(world, cueState);
    }
  }

  private recordSnapshot(world: PhysicsWorld, cueState?: CueState) {
    const time = (performance.now() - this.startTime) / 1000;

    const snapshot: PhysicsSnapshot = {
      frame: this.frameCount,
      time: parseFloat(time.toFixed(3)),
      balls: world.balls.map(ball => ({
        id: ball.id,
        x: parseFloat(ball.x.toFixed(4)),
        y: parseFloat(ball.y.toFixed(4)),
        vx: parseFloat(ball.vx.toFixed(4)),
        vy: parseFloat(ball.vy.toFixed(4)),
        speed: parseFloat(ball.getSpeed().toFixed(4)),
        pocketed: ball.pocketed,
        sleeping: ball.sleeping,
        quaternion: [
          parseFloat(ball.rotX.toFixed(4)),
          parseFloat(ball.rotY.toFixed(4)),
          parseFloat(ball.rotZ.toFixed(4)),
          parseFloat(ball.rotW.toFixed(4))
        ]
      })),
      cue: cueState
    };

    this.snapshots.push(snapshot);
    if (this.currentShot) {
      this.currentShot.snapshots.push(snapshot);
    }
  }

  recordEvent(type: PhysicsEvent['type'], description: string, data?: any) {
    if (!this.recording) return;

    const time = (performance.now() - this.startTime) / 1000;

    const event: PhysicsEvent = {
      frame: this.frameCount,
      time: parseFloat(time.toFixed(3)),
      type,
      description,
      data
    };

    this.events.push(event);
    if (this.currentShot) {
      this.currentShot.events.push(event);
    }
  }

  recordSound(name: string, intensity: number) {
    this.recordEvent('sound', `Sound: ${name}`, { name, intensity });
  }

  recordShot(angle: number, power: number) {
    // Close previous shot if exists
    const time = (performance.now() - this.startTime) / 1000;
    if (this.currentShot) {
      this.currentShot.endTime = time;
    }

    // Start new shot
    this.currentShot = {
      index: this.shots.length + 1,
      startTime: time,
      endTime: null,
      events: [],
      snapshots: []
    };
    this.shots.push(this.currentShot);

    this.recordEvent('shot', `Shot taken: angle=${angle.toFixed(2)}rad, power=${power.toFixed(2)}`);
  }

  recordCollision(ball1: Ball, ball2: Ball) {
    this.recordEvent('collision', `Ball ${ball1.id} ↔ Ball ${ball2.id}`, {
      ball1: { id: ball1.id, speed: ball1.getSpeed().toFixed(2) },
      ball2: { id: ball2.id, speed: ball2.getSpeed().toFixed(2) }
    });
  }

  recordPocket(ball: Ball) {
    this.recordEvent('pocket', `Ball ${ball.id} pocketed at (${ball.x.toFixed(1)}, ${ball.y.toFixed(1)})`);
  }

  addMarker(label: string) {
    this.recordEvent('marker', label);
  }

  getMatchData(): MatchData {
    // Ensure current shot is closed
    if (this.currentShot && this.currentShot.endTime === null) {
      this.currentShot.endTime = (performance.now() - this.startTime) / 1000;
    }

    return {
      id: `match_${Date.now()}`,
      timestamp: Date.now(),
      duration: (performance.now() - this.startTime) / 1000,
      shots: this.shots,
      events: this.events,
      snapshots: this.snapshots
    };
  }

  printSummary() {
    console.log('\n════════════════════════════════════════');
    console.log('📊 PHYSICS RECORDING SUMMARY');
    console.log('════════════════════════════════════════');
    console.log(`Duration: ${((performance.now() - this.startTime) / 1000).toFixed(2)}s`);
    console.log(`Total frames: ${this.frameCount}`);
    console.log(`Snapshots recorded: ${this.snapshots.length}`);
    console.log(`Events recorded: ${this.events.length}`);
    console.log(`Shots recorded: ${this.shots.length}`);
    console.log('');

    // Event summary by type
    const eventCounts = this.events.reduce((acc, e) => {
      acc[e.type] = (acc[e.type] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    console.log('Event breakdown:');
    Object.entries(eventCounts).forEach(([type, count]) => {
      console.log(`  ${type}: ${count}`);
    });

    console.log('\n════════════════════════════════════════\n');
  }

  // Export recording as shareable JSON
  exportJSON(): string {
    return JSON.stringify(this.getMatchData(), null, 2);
  }

  // Export as markdown report
  exportMarkdown(): string {
    const duration = ((performance.now() - this.startTime) / 1000).toFixed(2);

    let md = `# Physics Recording Report\n\n`;
    md += `**Duration:** ${duration}s  \n`;
    md += `**Frames:** ${this.frameCount}  \n`;
    md += `**Snapshots:** ${this.snapshots.length}  \n`;
    md += `**Events:** ${this.events.length}  \n`;
    md += `**Shots:** ${this.shots.length}  \n\n`;

    // Events timeline
    md += `## Events Timeline\n\n`;
    this.events.forEach(event => {
      const icon = { shot: '🎱', collision: '💥', pocket: '⚫', marker: '📍', sound: '🔊' }[event.type] || '•';
      md += `- **[${event.time}s]** ${icon} ${event.description}\n`;
    });
    md += '\n';

    // Final state
    if (this.snapshots.length > 0) {
      const final = this.snapshots[this.snapshots.length - 1];
      md += `## Final State (frame ${final.frame})\n\n`;
      md += `| Ball | Position | Velocity | Speed | Status |\n`;
      md += `|------|----------|----------|-------|--------|\n`;
      final.balls.forEach(ball => {
        const status = ball.pocketed ? '⚫ Pocketed' : ball.sleeping ? '💤 Sleeping' : '🎱 Active';
        md += `| ${ball.id} | (${ball.x}, ${ball.y}) | (${ball.vx}, ${ball.vy}) | ${ball.speed} | ${status} |\n`;
      });
    }

    return md;
  }

  // Export report for easy copying
  copyToClipboard() {
    const md = this.exportMarkdown();

    console.log('\n' + '='.repeat(80));
    console.log('📋 COPY THE TEXT BELOW (click and drag to select):');
    console.log('='.repeat(80) + '\n');
    console.log(md);
    console.log('\n' + '='.repeat(80));
    console.log('📋 Copy everything between the lines above');
    console.log('='.repeat(80) + '\n');

    // Try clipboard API but don't fail if it doesn't work
    if (navigator.clipboard && document.hasFocus()) {
      navigator.clipboard.writeText(md).then(() => {
        console.log('✅ Also copied to clipboard automatically!');
      }).catch(() => {
        console.log('ℹ️  Select and copy the text above');
      });
    }
  }
}

// Singleton instance
export const physicsRecorder = new PhysicsRecorder();

// Global helper functions for easy access from console
if (typeof window !== 'undefined') {
  (window as any).startRecording = () => physicsRecorder.start();
  (window as any).stopRecording = () => physicsRecorder.stop();
  (window as any).exportRecording = () => physicsRecorder.copyToClipboard();
  (window as any).marker = (label: string) => physicsRecorder.addMarker(label);

  console.log('📹 Physics Recorder ready! Use these commands:');
  console.log('  startRecording()  - Begin recording');
  console.log('  stopRecording()   - Stop and show summary');
  console.log('  exportRecording() - Copy markdown report to clipboard');
  console.log('  marker("label")   - Add a marker/note to the recording');
}
