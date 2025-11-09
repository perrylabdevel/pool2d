// Player management for tracking player data and statistics

export enum PlayerType {
  HUMAN,
  AI,
}

export enum BallGroup {
  SOLIDS,   // 1-7
  STRIPES,  // 9-15
}

export interface PlayerStats {
  shotsAttempted: number;
  shotsMade: number;      // Shots that pocketed at least one ball
  fouls: number;
  maxStreak: number;      // Longest streak of successful shots
  averagePositioning: number; // 0-100 score for cue ball positioning
}

export class Player {
  id: number;
  name: string;
  type: PlayerType;
  group: BallGroup | null; // solids, stripes, or null if not assigned
  stats: PlayerStats;
  private currentStreak: number = 0;

  constructor(id: number, name: string, type: PlayerType) {
    this.id = id;
    this.name = name;
    this.type = type;
    this.group = null;
    this.stats = {
      shotsAttempted: 0,
      shotsMade: 0,
      fouls: 0,
      maxStreak: 0,
      averagePositioning: 0,
    };
  }

  /**
   * Check if player is human
   */
  isHuman(): boolean {
    return this.type === PlayerType.HUMAN;
  }

  /**
   * Check if player is AI
   */
  isAI(): boolean {
    return this.type === PlayerType.AI;
  }

  /**
   * Assign ball group to player (solids or stripes)
   */
  assignGroup(group: BallGroup): void {
    this.group = group;
  }

  /**
   * Record a shot attempt and whether it was successful
   */
  recordShot(success: boolean): void {
    this.stats.shotsAttempted++;

    if (success) {
      this.stats.shotsMade++;
      this.currentStreak++;

      if (this.currentStreak > this.stats.maxStreak) {
        this.stats.maxStreak = this.currentStreak;
      }
    } else {
      this.currentStreak = 0;
    }
  }

  /**
   * Record a foul committed by the player
   */
  recordFoul(): void {
    this.stats.fouls++;
    this.currentStreak = 0;
  }

  /**
   * Get current shooting percentage
   */
  getShootingPercentage(): number {
    if (this.stats.shotsAttempted === 0) return 0;
    return (this.stats.shotsMade / this.stats.shotsAttempted) * 100;
  }

  /**
   * Reset stats for a new game
   */
  resetStats(): void {
    this.stats = {
      shotsAttempted: 0,
      shotsMade: 0,
      fouls: 0,
      maxStreak: 0,
      averagePositioning: 0,
    };
    this.currentStreak = 0;
  }

  /**
   * Reset player for a new game (clear group assignment and stats)
   */
  reset(): void {
    this.group = null;
    this.resetStats();
  }
}
