/**
 * Central Layout Constants
 * 
 * Defines standard dimensions, spacing, and typography for the UI.
 * Use these instead of hardcoded numbers to ensure consistency.
 * 
 * @example
 * ```typescript
 * import { LayoutConstants } from '@/ui/theme/LayoutConstants';
 * const cardWidth = LayoutConstants.Cards.Width;
 * ```
 */

export const LayoutConstants = {
    // Spacing & Gaps
    Spacing: {
        Tiny: 4,
        Small: 8,
        Medium: 16,
        Large: 24,
        XLarge: 32,
        XXLarge: 48,
        GapSmall: 10,
        GapMedium: 20,
        GapLarge: 30,
        PaddingScreen: 0.08, // 8% of screen width
        HorizontalPaddingMin: 40, // Minimum horizontal padding
        ExternalMargin: 40, // Canvas external margin
        InternalPadding: 40, // Canvas internal padding
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

    // Card/Panel Dimensions
    Cards: {
        Width: 240,
        Height: 320,
        Gap: 28,
        FrameWidth: 6,      // Outer decorative frame
        BevelWidth: 3,      // Middle bevel layer
        BorderWidth: 2,     // Inner border
        CornerAccentSize: 20, // Corner decoration size
    },

    // Tab Dimensions
    Tabs: {
        Width: 100,
        Height: 40,
        Gap: 10,
        OffsetY: 30,
    },

    // Currency Pill
    CurrencyPill: {
        Width: 100,
        Height: 28,
        Radius: 8,
        PlusRadius: 12,
        PlusSpacing: 5,
    },

    // Chip/Icon Sizes
    Chips: {
        Small: 80,
        Medium: 120,
        Large: 160,
        DashCount: 8,
    },

    // Wheel/Spinner
    Wheel: {
        Radius: 220,
        TickerHeight: 30,
    },

    // Corner Radii
    Radii: {
        Tiny: 2,
        Small: 4,
        Medium: 8,
        Large: 12,
        XLarge: 16,
        Round: 999, // Fully rounded (capsule)
    },

    // Shadows
    Shadows: {
        Small: {
            blur: 8,
            offsetY: 4,
        },
        Medium: {
            blur: 20,
            offsetY: 10,
        },
        Large: {
            blur: 28,
            offsetY: 14,
        },
        Glow: {
            blur: 12,
        },
        Text: {
            blur: 4,
            offsetX: 2,
            offsetY: 2,
        },
    },

    // Animation Durations (milliseconds)
    Animation: {
        Instant: 100,
        Fast: 200,
        Normal: 300,
        Slow: 500,
        Notification: {
            Enter: 600,
            Active: 3000,
            Exit: 400,
            Toast: 2400,
        },
        Spin: {
            MinDuration: 3000,
            MaxDuration: 5000,
        },
        Pocket: {
            DropDuration: 300,
            RollDuration: 500,
        },
    },

    // Line Widths
    Lines: {
        Thin: 1,
        Normal: 2,
        Thick: 3,
        Heavy: 4,
        Rim: 3,
        Stroke: 2,
    },

    // Cue Stick Rendering
    Cue: {
        ThicknessInches: 1.0,
        TipLengthInches: 0.4,
        MinThicknessPixels: 4,
        PullbackBase: 2,
        PullbackMax: 3,
    },

    // Typography
    Fonts: {
        Family: {
            Default: 'Arial',
            Heading: '"Montserrat", Arial',
            Display: '"Orbitron", Arial',
            Game: '"Rajdhani", sans-serif',
            Monospace: 'monospace',
            Body: '"Nunito", Arial',
        },
        Size: {
            Tiny: 10,
            Small: 14,
            Medium: 16,
            Large: 18,
            XLarge: 24,
            XXLarge: 32,
            Hero: 40,
            Title: 48,
        },
        Weight: {
            Regular: '400',
            SemiBold: '600',
            Bold: '700',
            Black: '900',
        }
    },

    // Z-Index Layers
    ZIndex: {
        Background: 0,
        Content: 100,
        Modal: 1000,
        Notification: 9000,
        Tooltip: 10000,
    },

    // Opacity Levels
    Opacity: {
        Disabled: 0.4,
        Muted: 0.5,
        Subtle: 0.7,
        Full: 1.0,
        HoverOverlay: 0.15,
        SelectedOverlay: 0.25,
        DiagonalStripe: 0.08,
    },
};
