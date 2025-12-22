export type BannerType = 'success' | 'error' | 'warning' | 'info' | 'epic' | 'custom';
export type AnimationType = 'slide-down' | 'slide-up' | 'slide-left' | 'slide-right' 
                          | 'fade' | 'scale' | 'bounce' | 'flip' | 'none';

export interface BannerConfig {
  // Identity
  id: string;
  name: string;
  type: BannerType;

  // Layout
  position: 'top' | 'center' | 'bottom' | 'custom';
  customPosition?: { x: number; y: number };
  size: 'normal' | 'large' | 'fullwidth' | 'compact';
  width: number;      // max width in px
  height: number;     // height in px
  padding: number;    // inner padding

  // Background
  background: {
    type: 'solid' | 'gradient' | 'image';
    color?: string;
    gradient?: {
      type: 'linear' | 'radial';
      angle?: number;
      stops: Array<{ offset: number; color: string }>;
    };
    image?: {
      src: string;           // base64 or URL
      fit: 'cover' | 'contain' | 'stretch' | 'tile' | '9slice';
      sliceInsets?: { top: number; right: number; bottom: number; left: number };
      tint?: string;
      tintOpacity?: number;
    };
  };

  // Frame
  frame: {
    enabled: boolean;
    width: number;
    color: string;
    gradient?: { stops: Array<{ offset: number; color: string }> };
    radius: number;
  };

  // Shadow & Glow
  shadow: {
    enabled: boolean;
    offsetX: number;
    offsetY: number;
    blur: number;
    spread: number;
    color: string;
  };
  glow: {
    enabled: boolean;
    type: 'inner' | 'outer';
    blur: number;
    color: string;
  };

  // Typography
  text: {
    content: string; // Default preview text
    fontFamily: string;
    fontSize: number;
    fontWeight: number;
    color: string;
    gradient?: { stops: Array<{ offset: number; color: string }> };
    shadow?: { offsetX: number; offsetY: number; blur: number; color: string };
    stroke?: { width: number; color: string };
    align: 'left' | 'center' | 'right';
    letterSpacing: number;
    lineHeight: number;
    maxLines: number;
    transform: 'none' | 'uppercase' | 'lowercase' | 'capitalize';
  };

  // Icon
  icon: {
    enabled: boolean;
    position: 'left' | 'right' | 'above';
    src?: string;           // emoji, URL, or built-in key
    size: number;
    color?: string;
    animation: 'none' | 'pulse' | 'bounce' | 'spin';
  };

  // Animation
  animation: {
    entry: {
      type: AnimationType;
      duration: number;
      easing: string;
      delay: number;
    };
    hold: number;
    exit: {
      type: AnimationType;
      duration: number;
      easing: string;
    };
  };

  // Effects
  effects: {
    shimmer: boolean;
    shimmerSpeed: number;
    particles: boolean;
    screenShake: boolean;
    shakeIntensity: number;
    backgroundBlur: boolean;
    blurAmount: number;
  };

  // Audio
  sound: {
    enabled: boolean;
    src: 'toast' | 'error' | 'epic' | 'custom' | 'none';
    customSrc?: string;
    volume: number;
  };
}

export const DEFAULT_BANNER_CONFIG: BannerConfig = {
  id: 'default',
  name: 'New Banner',
  type: 'success',
  position: 'center', // Full-width banners are vertically centered
  size: 'fullwidth',
  width: 0, // Full width (ignored, uses canvas width)
  height: 240, // Tall banner for full-width style
  padding: 16,
  background: {
    type: 'gradient',
    color: '#004488',
    gradient: {
      type: 'linear',
      angle: 0,
      stops: [
        { offset: 0, color: '#00448800' },
        { offset: 0.2, color: '#004488CC' },
        { offset: 0.8, color: '#004488CC' },
        { offset: 1, color: '#00448800' }
      ]
    }
  },
  frame: {
    enabled: false,
    width: 0,
    color: '#000000',
    radius: 0
  },
  shadow: {
    enabled: false,
    offsetX: 0,
    offsetY: 0,
    blur: 0,
    spread: 0,
    color: 'rgba(0,0,0,0)'
  },
  glow: {
    enabled: false,
    type: 'outer',
    blur: 10,
    color: '#89b4fa'
  },
  text: {
    content: 'VICTORY!',
    fontFamily: 'Rajdhani',
    fontSize: 48, // Large text for full-width style
    fontWeight: 700,
    color: '#ffffff',
    align: 'left',
    letterSpacing: 0,
    lineHeight: 1.4,
    maxLines: 2,
    transform: 'uppercase'
  },
  icon: {
    enabled: true,
    position: 'left',
    src: '',  // Empty = use type-specific icon
    size: 80, // Large icon for full-width style
    color: '#ffffff',
    animation: 'none'
  },
  animation: {
    entry: {
      type: 'slide-right', // Slide in from left
      duration: 400,
      easing: 'ease-out-back',
      delay: 0
    },
    hold: 3000,
    exit: {
      type: 'slide-left', // Slide out to left
      duration: 300,
      easing: 'ease-in'
    }
  },
  effects: {
    shimmer: false,
    shimmerSpeed: 1,
    particles: false,
    screenShake: false,
    shakeIntensity: 0.5,
    backgroundBlur: false,
    blurAmount: 4
  },
  sound: {
    enabled: false,
    src: 'none',
    volume: 1.0
  }
};
