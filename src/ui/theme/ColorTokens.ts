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
    successDark: '#388E3C',    // Darker green for gradients
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
    canvas: '#0a0a0a',         // Canvas/viewport background
    panel: 'rgba(13, 20, 36, 0.85)',      // Semi-transparent panel background
    panelSolid: 'rgba(40, 40, 50, 1)',    // Solid panel inner area
    overlay: 'rgba(0, 0, 0, 0.4)',        // Standard overlay
    overlayDark: 'rgba(0, 0, 0, 0.6)',    // Darker overlay
    overlayHeavy: 'rgba(0, 0, 0, 0.7)',   // Heavy overlay for badges
    fallback: 'rgba(13, 20, 36, 0.95)',   // Fallback when images don't load
    nav: {
      gradientStart: 'rgba(20, 30, 50, 0.8)',
      gradientEnd: 'rgba(10, 20, 40, 0.9)',
    },
  },

  // Border/Stroke Colors
  border: {
    default: 'rgba(255, 255, 255, 0.1)',   // Standard border
    emphasis: 'rgba(255, 255, 255, 0.15)', // Slightly more visible border
    subtle: 'rgba(255, 255, 255, 0.2)',    // Subtle white border
    hover: '#00B4FF',                       // Hover state border
    dark: 'rgba(0, 0, 0, 0.2)',            // Dark borders for light backgrounds
    darkStrong: 'rgba(0, 0, 0, 0.5)',      // Strong dark border
  },

  // Text Colors
  text: {
    primary: '#FFFFFF',        // Main text color
    secondary: '#AAA',         // Secondary/muted text
    muted: 'rgba(255, 255, 255, 0.5)', // Muted/hint text
    dark: '#000000',           // Dark text for light backgrounds
  },

  // Currency-specific Colors
  currency: {
    coins: '#FFD700',          // Gold coins
    cash: '#4CAF50',           // Green cash/gems
    cashChip: '#1fbf75',       // Cash chip color
  },

  // Card Frame Colors
  card: {
    frame: {
      light: '#8B7355',        // Lighter wood/bronze
      mid: '#6B5745',          // Mid wood/bronze  
      dark: '#4B3725',         // Darker wood/bronze
    },
    bevel: {
      top: '#3a3a3a',          // Dark top for inset look
      mid: '#2a2a2a',          // Mid bevel
      bottom: '#4a4a4a',       // Lighter bottom
    },
    cornerAccent: 'rgba(255, 215, 0, 0.6)', // Gold corner decorations
  },

  // Rarity Colors
  rarity: {
    common: '#888888',
    rare: '#4A90E2',
    epic: '#9C27B0',
    legendary: '#FFD700',
  },

  // Effect/Overlay Colors
  effects: {
    gloss: {
      start: 'rgba(255, 255, 255, 0.4)',   // Gloss gradient start
      mid: 'rgba(255, 255, 255, 0.1)',     // Gloss gradient mid
      end: 'rgba(255, 255, 255, 0.05)',    // Gloss gradient end
      none: 'rgba(255, 255, 255, 0)',      // Transparent end
    },
    innerHighlight: {
      start: 'rgba(255, 255, 255, 0.9)',
      mid: 'rgba(255, 255, 255, 0.1)',
      end: 'rgba(0, 0, 0, 0.4)',
    },
    shine: 'rgba(255, 255, 255, 0.3)',     // Shine/gloss overlay
    shadow: 'rgba(0, 0, 0, 0.5)',          // Drop shadows
    shadowLight: 'rgba(0, 0, 0, 0.4)',     // Lighter shadows
    shadowHeavy: 'rgba(0, 0, 0, 0.6)',     // Heavier shadows
    shadowButton: 'rgba(0, 0, 0, 0.4)',    // Button shadows
    shadowText: 'rgba(0, 0, 0, 0.8)',      // Text shadow
    shadowTextLight: 'rgba(0, 0, 0, 0.3)', // Light text shadow
    glow: 'rgba(0, 180, 255, 0.6)',        // Blue glow effect
  },

  // Metallic Rim Colors (for buttons)
  metallic: {
    light: '#ffffff',
    mid: '#888888',
    dark: '#444444',
  },

  // Coin/Trophy Colors
  coin: {
    lightGold: '#FFEC8B',
    gold: '#FFD700',
    goldenRod: '#DAA520',
    darkGold: '#B8860B',
    orangeGold: '#FFA500',
  },

  // Chip/Casino Colors  
  chip: {
    innerFaceLight: '#FFFFFF',
    innerFaceDark: '#F0F0F0',
    dashColor: 'rgba(255, 255, 255, 0.9)',
    innerShadow: 'rgba(0,0,0,0.2)',
    symbolColor: '#000000',
  },

  // Prize Wheel Colors
  wheel: {
    blue: '#4A90E2',
    teal: '#50E3C2',
    green: '#B8E986',
    purple: '#BD10E0',
    violet: '#9013FE',
    orange: '#F5A623',
    gray: '#4A4A4A',
    yellow: '#F8E71C',
    red: '#D0021B',
    black: '#000000',
    brown: '#8B572A',
    gold: '#FFD700',
  },

  // Cue Colors (defaults)
  cue: {
    defaultStick: '#8B4513',
    defaultTip: '#4A90E2',
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
