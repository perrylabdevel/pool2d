// Physics event recorder for debugging and sharing
// Records physics events with timestamps for analysis

import { Ball } from '../physics/Shapes';
import { PhysicsWorld } from '../physics/Physics';

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
  }[];
}

export interface PhysicsEvent {
  frame: number;
  time: number;
  type: 'collision' | 'pocket' | 'shot' | 'marker';
  description: string;
  data?: any;
}

export class PhysicsRecorder {
  private recording: boolean = false;
  private startTime: number = 0;
  private frameCount: number = 0;
  private snapshots: PhysicsSnapshot[] = [];
  private events: PhysicsEvent[] = [];
  private snapshotInterval: number = 10; // Record every N frames
  
  start() {
    this.recording = true;
    this.startTime = performance.now();
    this.frameCount = 0;
    this.snapshots = [];
    this.events = [];
    console.log('📹 Physics recording started');
  }
  
  stop() {
    this.recording = false;
    console.log('⏹️ Physics recording stopped');
    this.printSummary();
  }
  
  isRecording(): boolean {
    return this.recording;
  }
  
  recordFrame(world: PhysicsWorld) {
    if (!this.recording) return;
    
    this.frameCount++;
    
    // Record snapshot at intervals
    if (this.frameCount % this.snapshotInterval === 0) {
      this.recordSnapshot(world);
    }
  }
  
  private recordSnapshot(world: PhysicsWorld) {
    const time = (performance.now() - this.startTime) / 1000;
    
    const snapshot: PhysicsSnapshot = {
      frame: this.frameCount,
      time: parseFloat(time.toFixed(3)),
      balls: world.balls.map(ball => ({
        id: ball.id,
        x: parseFloat(ball.x.toFixed(2)),
        y: parseFloat(ball.y.toFixed(2)),
        vx: parseFloat(ball.vx.toFixed(2)),
        vy: parseFloat(ball.vy.toFixed(2)),
        speed: parseFloat(ball.getSpeed().toFixed(2)),
        pocketed: ball.pocketed,
        sleeping: ball.sleeping,
      }))
    };
    
    this.snapshots.push(snapshot);
  }
  
  recordEvent(type: PhysicsEvent['type'], description: string, data?: any) {
    if (!this.recording) return;
    
    const time = (performance.now() - this.startTime) / 1000;
    
    this.events.push({
      frame: this.frameCount,
      time: parseFloat(time.toFixed(3)),
      type,
      description,
      data
    });
    
    console.log(`[${type.toUpperCase()}] ${description}`, data || '');
  }
  
  recordShot(angle: number, power: number) {
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
  
  printSummary() {
    console.log('\n════════════════════════════════════════');
    console.log('📊 PHYSICS RECORDING SUMMARY');
    console.log('════════════════════════════════════════');
    console.log(`Duration: ${((performance.now() - this.startTime) / 1000).toFixed(2)}s`);
    console.log(`Total frames: ${this.frameCount}`);
    console.log(`Snapshots recorded: ${this.snapshots.length}`);
    console.log(`Events recorded: ${this.events.length}`);
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
    const data = {
      duration: (performance.now() - this.startTime) / 1000,
      frames: this.frameCount,
      snapshots: this.snapshots,
      events: this.events
    };
    
    return JSON.stringify(data, null, 2);
  }
  
  // Export as markdown report
  exportMarkdown(): string {
    const duration = ((performance.now() - this.startTime) / 1000).toFixed(2);
    
    let md = `# Physics Recording Report\n\n`;
    md += `**Duration:** ${duration}s  \n`;
    md += `**Frames:** ${this.frameCount}  \n`;
    md += `**Snapshots:** ${this.snapshots.length}  \n`;
    md += `**Events:** ${this.events.length}  \n\n`;
    
    // Events timeline
    md += `## Events Timeline\n\n`;
    this.events.forEach(event => {
      const icon = { shot: '🎱', collision: '💥', pocket: '⚫', marker: '📍' }[event.type] || '•';
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
