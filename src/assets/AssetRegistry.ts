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
    sharkSally: () => new URL('./img/avatars/avatar_shark_sally.png', import.meta.url).href,
    theMachine: () => new URL('./img/avatars/avatar_the_machine.png', import.meta.url).href,
    rookieRick: () => new URL('./img/avatars/avatar_rookie_rick.png', import.meta.url).href,
    nervousNed: () => new URL('./img/avatars/avatar_ned.png', import.meta.url).href,
    casualCarl: () => new URL('./img/avatars/avatar_carl.png', import.meta.url).href,
    slowSam: () => new URL('./img/avatars/avatar_sam.png', import.meta.url).href,
    luckyLucy: () => new URL('./img/avatars/avatar_lucy.png', import.meta.url).href,
    steadySteve: () => new URL('./img/avatars/avatar_steve.png', import.meta.url).href,
    bankShotBetty: () => new URL('./img/avatars/avatar_betty.png', import.meta.url).href,
    angleAndy: () => new URL('./img/avatars/avatar_andy.png', import.meta.url).href,
    comboChris: () => new URL('./img/avatars/avatar_chris.png', import.meta.url).href,
    defensiveDan: () => new URL('./img/avatars/avatar_dan.png', import.meta.url).href,
    spinDoctorSid: () => new URL('./img/avatars/avatar_sid.png', import.meta.url).href,
    powerPete: () => new URL('./img/avatars/avatar_pete.png', import.meta.url).href,
    finesseFiona: () => new URL('./img/avatars/avatar_fiona.png', import.meta.url).href,
    trickshotTim: () => new URL('./img/avatars/avatar_tim.png', import.meta.url).href,
    precisionPaul: () => new URL('./img/avatars/avatar_paul.png', import.meta.url).href,
    viperVicky: () => new URL('./img/avatars/avatar_vicky.png', import.meta.url).href,
    masterMike: () => new URL('./img/avatars/avatar_mike.png', import.meta.url).href,
    legendLarry: () => new URL('./img/avatars/avatar_larry.png', import.meta.url).href,
  },

  /**
   * League Frames
   */
  frames: {
    bronze: () => new URL('./img/frames/frame_bronze.png', import.meta.url).href,
    silver: () => new URL('./img/frames/frame_silver.png', import.meta.url).href,
    gold: () => new URL('./img/frames/frame_gold.png', import.meta.url).href,
    platinum: () => new URL('./img/frames/frame_platinum.png', import.meta.url).href,
    diamond: () => new URL('./img/frames/frame_diamond.png', import.meta.url).href,
    master: () => new URL('./img/frames/frame_master.png', import.meta.url).href,
    elite: () => new URL('./img/frames/frame_elite.png', import.meta.url).href,
    emerald: () => new URL('./img/frames/frame_emerald.png', import.meta.url).href,
    crystal: () => new URL('./img/frames/frame_crystal.png', import.meta.url).href, // unlabeled blue variant
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
export type AssetKey<T extends AssetCategory> = keyof typeof AssetRegistry[T];

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
