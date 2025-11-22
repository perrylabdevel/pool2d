/**
 * Central Color Token System
 *
 * This file defines all colors used throughout the application.
 * Benefits:
 * - Single source of truth for colors
 * - Easy theme switching
 * - Consistent naming and semantic meaning
 * - Better maintainability
 *
 * Usage:
 * ```typescript
 * import { ColorTokens } from '@/ui/theme/ColorTokens';
 * ctx.fillStyle = ColorTokens.brand.primary;
 * ```
 */

export const ColorTokens = {
  // Brand/Primary Colors
  brand: {
    primary: '#FFD700',        // Gold - main brand color
    primaryDark: '#B8860B',    // Darker gold for emphasis
    primaryLight: '#FFED4E',   // Lighter gold for highlights
  },

  // Semantic Action Colors
  action: {
    success: '#4CAF50',        // Green - positive actions, success states
    info: '#2196F3',           // Blue - informational, neutral actions
    warning: '#FF9800',        // Orange - warnings, attention needed
    danger: '#F44336',         // Red - errors, destructive actions
  },

  // UI Component Colors
  ui: {
    purple: '#9C27B0',         // Purple - shop, premium features
    teal: '#00B4FF',           // Teal - hover states, focus
    gray: '#607D8B',           // Gray - disabled, coming soon
  },

  // Background Colors
  background: {
    primary: '#0D1424',        // Dark navy - main background
    secondary: '#000B1A',      // Darker navy - gradient end
    tertiary: '#1a2b4a',       // Medium navy - alternate backgrounds
    panel: 'rgba(13, 20, 36, 0.85)',      // Semi-transparent panel background
    overlay: 'rgba(0, 0, 0, 0.4)',        // Standard overlay
    overlayDark: 'rgba(0, 0, 0, 0.6)',    // Darker overlay
    fallback: 'rgba(13, 20, 36, 0.95)',   // Fallback when images don't load
  },

  // Border/Stroke Colors
  border: {
    default: 'rgba(255, 255, 255, 0.1)',  // Standard border
    emphasis: 'rgba(255, 255, 255, 0.15)', // Slightly more visible border
    hover: '#00B4FF',                      // Hover state border
    dark: 'rgba(0, 0, 0, 0.2)',           // Dark borders for light backgrounds
  },

  // Text Colors
  text: {
    primary: '#FFFFFF',        // Main text color
    secondary: '#AAA',         // Secondary/muted text
    dark: '#000000',           // Dark text for light backgrounds
  },

  // Currency-specific Colors
  currency: {
    coins: '#FFD700',          // Gold coins
    cash: '#4CAF50',           // Green cash/gems
  },

  // Effect/Overlay Colors
  effects: {
    gloss: {
      start: 'rgba(255, 255, 255, 0.4)',   // Gloss gradient start
      end: 'rgba(255, 255, 255, 0.05)',    // Gloss gradient end
    },
    shadow: 'rgba(0, 0, 0, 0.5)',          // Drop shadows
    shadowButton: 'rgba(0, 0, 0, 0.4)',    // Button shadows
  },
};

/**
 * Semantic color aliases for specific use cases
 * These provide meaningful names for where colors are used in the UI
 */
export const SemanticColors = {
  // Lobby card colors
  lobby: {
    cardPlayRanked: ColorTokens.action.success,
    cardPractice: ColorTokens.action.success,
    cardArcade: ColorTokens.action.info,
    cardShop: ColorTokens.ui.purple,
    cardEvents: ColorTokens.action.danger,
    cardMiniGames: ColorTokens.ui.gray,
  },

  // Button states
  button: {
    hover: ColorTokens.border.hover,
    primary: ColorTokens.action.success,
    danger: ColorTokens.action.danger,
  },

  // Background gradients
  gradient: {
    start: ColorTokens.background.primary,
    end: ColorTokens.background.secondary,
  },
};

/**
 * Legacy UIColors object for backward compatibility
 * @deprecated Use ColorTokens instead
 */
export const UIColors = {
  primary: ColorTokens.brand.primary,
  primaryDark: ColorTokens.brand.primaryDark,
  secondary: ColorTokens.action.success,
  accent: ColorTokens.action.info,
  danger: ColorTokens.action.danger,
  text: ColorTokens.text.primary,
  textDark: ColorTokens.text.dark,
  panelBg: ColorTokens.background.panel,
  panelBorder: ColorTokens.border.emphasis,
};
