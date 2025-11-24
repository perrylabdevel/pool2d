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
  },

  /**
   * Game mode card images
   * Used in the play modes selection scene
   */
  modeCards: {
    practice: () => new URL('./img/lobby-cards/practice.png', import.meta.url).href,
    // Add specific mode cards here as you create them:
    // eightBall: () => new URL('./img/mode-cards/8ball.png', import.meta.url).href,
    // timeAttack: () => new URL('./img/mode-cards/time-attack.png', import.meta.url).href,
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

  // Add more asset categories as your project grows:
  // shopItems: { ... },
  // cues: { ... },
  // backgrounds: { ... },
  // icons: { ... },
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
