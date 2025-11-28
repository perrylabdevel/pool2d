/**
 * Centralized Asset Registry
 *
 * This file provides a single source of truth for all asset paths in the application.
 * Benefits:
 * - Type-safe asset references
 * - Easy to find and update asset paths
 * - Prevents typos and broken references
 * - Clear organization by feature/category
 *
 * Usage:
 * ```typescript
 * import { AssetRegistry } from '@/assets/AssetRegistry';
 * const img = new Image();
 * img.src = AssetRegistry.lobbyCards.practice();
 * ```
 */

export const AssetRegistry = {
  /**
   * Branding assets
   * Logo and other branding elements
   */
  branding: {
    logo: () => new URL('./img/logo.png', import.meta.url).href,
  },

  /**
   * Lobby scene card images
   * Used in the main lobby for different game options
   */
  lobbyCards: {
    practice: () => new URL('./img/lobby-cards/practice.png', import.meta.url).href,
    arcade: () => new URL('./img/lobby-cards/arcade.png', import.meta.url).href,
    playRanked: () => new URL('./img/lobby-cards/play-ranked.png', import.meta.url).href,
    shop: () => new URL('./img/lobby-cards/shop.png', import.meta.url).href,
    events: () => new URL('./img/lobby-cards/events.png', import.meta.url).href,
    miniGames: () => new URL('./img/lobby-cards/mini-games.png', import.meta.url).href,
    league: () => new URL('./img/lobby-cards/league.png', import.meta.url).href,
  },

  /**
   * Game mode card images
   * Used in the play modes selection scene
   */
  modeCards: {
    practice: () => new URL('./img/lobby-cards/practice.png', import.meta.url).href,
    // Add specific mode cards here as you create them:
    eightBall: () => new URL('./img/mode-cards/8ball.png', import.meta.url).href,
    timeAttack: () => new URL('./img/mode-cards/time-attack.png', import.meta.url).href,
  },

  /**
   * Event card images
   * Used in the events scene
   */
  eventCards: {
    // Using lobby images as placeholders - replace with specific event card images as you create them
    goldenSpin: () => new URL('./img/event-cards/spin.jpg', import.meta.url).href,
    // Add these when you create specific event card images:
    bullseye: () => new URL('./img/event-cards/bulls-eye.jpg', import.meta.url).href,
    winStreak: () => new URL('./img/event-cards/win-streak.jpg', import.meta.url).href,
  },

  /**
   * Avatar images
   */
  avatars: {
    default: () => new URL('./img/avatars/avatar_default.png', import.meta.url).href,
    player: () => new URL('./img/avatars/avatar_player.png', import.meta.url).href,
    shark_sally: () => new URL('./img/avatars/shark_sally.png', import.meta.url).href,
    the_machine: () => new URL('./img/avatars/the_machine.png', import.meta.url).href,
    rookie_rick: () => new URL('./img/avatars/rookie_rick.png', import.meta.url).href,
    nervous_ned: () => new URL('./img/avatars/nervous_ned.png', import.meta.url).href,
    casual_carl: () => new URL('./img/avatars/casual_carl.png', import.meta.url).href,
    slow_sam: () => new URL('./img/avatars/slow_sam.png', import.meta.url).href,
    lucky_lucy: () => new URL('./img/avatars/lucky_lucy.png', import.meta.url).href,
    steady_steve: () => new URL('./img/avatars/steady_steve.png', import.meta.url).href,
    bankshot_betty: () => new URL('./img/avatars/bankshot_betty.png', import.meta.url).href,
    angle_andy: () => new URL('./img/avatars/angle_andy.png', import.meta.url).href,
    combo_chris: () => new URL('./img/avatars/combo_chris.png', import.meta.url).href,
    defensive_dan: () => new URL('./img/avatars/defensive_dan.png', import.meta.url).href,
    spin_doctor_sid: () => new URL('./img/avatars/spin_doctor_sid.png', import.meta.url).href,
    power_pete: () => new URL('./img/avatars/power_pete.png', import.meta.url).href,
    finesse_fiona: () => new URL('./img/avatars/finesse_fiona.png', import.meta.url).href,
    trickshot_tim: () => new URL('./img/avatars/trickshot_tim.png', import.meta.url).href,
    precision_paul: () => new URL('./img/avatars/precision_paul.png', import.meta.url).href,
    viper_vicky: () => new URL('./img/avatars/viper_vicky.png', import.meta.url).href,
    master_mike: () => new URL('./img/avatars/master_mike.png', import.meta.url).href,
    legend_larry: () => new URL('./img/avatars/legend_larry.png', import.meta.url).href,
  },

  /**
   * League Frames
   */
  frames: {
    bronze: () => new URL('./img/frames/frame_bronze_new.png', import.meta.url).href,
    silver: () => new URL('./img/frames/frame_silver_new.png', import.meta.url).href,
    gold: () => new URL('./img/frames/frame_gold_new.png', import.meta.url).href,
    platinum: () => new URL('./img/frames/frame_platinum_new.png', import.meta.url).href,
    diamond: () => new URL('./img/frames/frame_diamond_new.png', import.meta.url).href,
    master: () => new URL('./img/frames/frame_master_new.png', import.meta.url).href,
    grandmaster: () => new URL('./img/frames/frame_grandmaster_new.png', import.meta.url).href,
    elite: () => new URL('./img/frames/frame_elite_new.png', import.meta.url).href,
    emerald: () => new URL('./img/frames/frame_emerald_new.png', import.meta.url).href,
    crystal: () => new URL('./img/frames/frame_crystal_new.png', import.meta.url).href,
  },

  /**
   * Economy assets (Chests, Coins, etc.)
   */
  economy: {
    chestCommon: () => new URL('./img/economy/chest_common.png', import.meta.url).href,
    chestRare: () => new URL('./img/economy/chest_rare.png', import.meta.url).href,
    chestEpic: () => new URL('./img/economy/chest_epic.png', import.meta.url).href,
  },
} as const;

/**
 * Type helpers for type-safe asset access
 */
export type AssetCategory = keyof typeof AssetRegistry;
export type AssetKey<T extends AssetCategory> = Extract<keyof typeof AssetRegistry[T], string>;

/**
 * Helper function to get all asset URLs from a category
 */
export function getAllAssetsFromCategory<T extends AssetCategory>(
  category: T
): string[] {
  const categoryObj = AssetRegistry[category];
  return Object.values(categoryObj).map(fn => fn());
}

/**
 * Helper to check if an asset exists in the registry
 */
export function hasAsset<T extends AssetCategory>(
  category: T,
  key: string
): key is AssetKey<T> {
  return key in AssetRegistry[category];
}
