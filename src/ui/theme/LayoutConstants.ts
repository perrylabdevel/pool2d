/**
 * Central Layout Constants
 * 
 * Defines standard dimensions, spacing, and typography for the UI.
 * Use these instead of hardcoded numbers to ensure consistency.
 */

export const LayoutConstants = {
    // Spacing & Gaps
    Spacing: {
        Small: 8,
        Medium: 16,
        Large: 24,
        XLarge: 32,
        GapSmall: 10,
        GapMedium: 20,
        GapLarge: 30,
        PaddingScreen: 0.08, // 8% of screen width
    },

    // Dimensions
    Dimensions: {
        ButtonHeight: 48,
        ButtonWidthSmall: 120,
        ButtonWidthMedium: 180,
        ButtonWidthLarge: 240,
        ControlHeight: 50,
        ControlWidth: 500,
        IconSizeSmall: 16,
        IconSizeMedium: 24,
        IconSizeLarge: 32,
        SliderTrackHeight: 24,
        SliderKnobSize: 24,
        ToggleSwitchWidth: 60,
        ToggleSwitchHeight: 30,
        AvatarSize: 120,
    },

    // Corner Radii
    Radii: {
        Small: 4,
        Medium: 8,
        Large: 12,
        Round: 999, // Fully rounded (capsule)
    },

    // Typography
    Fonts: {
        Family: {
            Default: 'Arial',
            Heading: '"Montserrat", Arial',
            Display: '"Orbitron", Arial',
            Monospace: 'monospace',
            Body: '"Nunito", Arial',
        },
        Size: {
            Small: 14,
            Medium: 16,
            Large: 18,
            XLarge: 24,
            XXLarge: 32,
            Hero: 40,
        },
        Weight: {
            Regular: '400',
            SemiBold: '600',
            Bold: '700',
        }
    }
};
