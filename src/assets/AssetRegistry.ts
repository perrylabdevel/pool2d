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
    logo: () => '/assets/images/logo.png',
  },

  /**
   * Lobby scene card images
   * Used in the main lobby for different game options
   */
  lobbyCards: {
    practice: () => '/assets/images/lobby-cards/practice.png',
    arcade: () => '/assets/images/lobby-cards/arcade.png',
    playRanked: () => '/assets/images/lobby-cards/play-ranked.png',
    shop: () => '/assets/images/lobby-cards/shop.png',
    events: () => '/assets/images/lobby-cards/events.png',
    miniGames: () => '/assets/images/lobby-cards/mini-games.png',
    league: () => '/assets/images/lobby-cards/league.png',
  },

  /**
   * Game mode card images
   * Used in the play modes selection scene
   */
  modeCards: {
    practice: () => '/assets/images/lobby-cards/practice.png',
    // Add specific mode cards here as you create them:
    eightBall: () => '/assets/images/mode-cards/8ball.png',
    timeAttack: () => '/assets/images/mode-cards/time-attack.png',
  },

  /**
   * Event card images
   * Used in the events scene
   */
  eventCards: {
    // Using lobby images as placeholders - replace with specific event card images as you create them
    goldenSpin: () => '/assets/images/event-cards/spin.jpg',
    // Add these when you create specific event card images:
    bullseye: () => '/assets/images/event-cards/bulls-eye.jpg',
    winStreak: () => '/assets/images/event-cards/win-streak.jpg',
  },

  /**
   * Avatar images
   */
  avatars: {
    default: () => '/assets/images/avatars/avatar_default.png',
    player: () => '/assets/images/avatars/avatar_player.png',
    shark_sally: () => '/assets/images/avatars/shark_sally.png',
    the_machine: () => '/assets/images/avatars/the_machine.png',
    rookie_rick: () => '/assets/images/avatars/rookie_rick.png',
    nervous_ned: () => '/assets/images/avatars/nervous_ned.png',
    casual_carl: () => '/assets/images/avatars/casual_carl.png',
    slow_sam: () => '/assets/images/avatars/slow_sam.png',
    lucky_lucy: () => '/assets/images/avatars/lucky_lucy.png',
    steady_steve: () => '/assets/images/avatars/steady_steve.png',
    bankshot_betty: () => '/assets/images/avatars/bankshot_betty.png',
    angle_andy: () => '/assets/images/avatars/angle_andy.png',
    combo_chris: () => '/assets/images/avatars/combo_chris.png',
    defensive_dan: () => '/assets/images/avatars/defensive_dan.png',
    spin_doctor_sid: () => '/assets/images/avatars/spin_doctor_sid.png',
    power_pete: () => '/assets/images/avatars/power_pete.png',
    finesse_fiona: () => '/assets/images/avatars/finesse_fiona.png',
    trickshot_tim: () => '/assets/images/avatars/trickshot_tim.png',
    precision_paul: () => '/assets/images/avatars/precision_paul.png',
    viper_vicky: () => '/assets/images/avatars/viper_vicky.png',
    master_mike: () => '/assets/images/avatars/master_mike.png',
    legend_larry: () => '/assets/images/avatars/legend_larry.png',
  },

  /**
   * League Frames
   */
  frames: {
    bronze: () => '/assets/images/frames/frame_bronze_new.png',
    silver: () => '/assets/images/frames/frame_silver_new.png',
    gold: () => '/assets/images/frames/frame_gold_new.png',
    platinum: () => '/assets/images/frames/frame_platinum_new.png',
    diamond: () => '/assets/images/frames/frame_diamond_new.png',
    master: () => '/assets/images/frames/frame_master_new.png',
    grandmaster: () => '/assets/images/frames/frame_grandmaster_new.png',
    elite: () => '/assets/images/frames/frame_elite_new.png',
    emerald: () => '/assets/images/frames/frame_emerald_new.png',
    crystal: () => '/assets/images/frames/frame_crystal_new.png',
  },

  /**
   * Economy assets (Chests, Coins, etc.)
   */
  economy: {
    chestCommon: () => '/assets/images/economy/chest_common.png',
    chestRare: () => '/assets/images/economy/chest_rare.png',
    chestEpic: () => '/assets/images/economy/chest_epic.png',
  },

  /**
   * Chest Assets
   */
  chests: {
    spriteSheet: () => '/assets/images/chests/chests_sprite_sheet.png',
    bronze: () => '/assets/images/chests/chest_bronze.png',
    gold: () => '/assets/images/chests/chest_gold.png',
    platinum: () => '/assets/images/chests/chest_platinum.png',
    diamond: () => '/assets/images/chests/chest_diamond.png',
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
