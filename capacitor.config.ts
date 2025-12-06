import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.railrush.game',
  appName: 'RailRush',
  webDir: 'dist',
  ios: {
    contentInset: 'always',
    preferredContentMode: 'mobile',
  },
  plugins: {
    Keyboard: {
      resize: 'none',
    },
  },
};

export default config;
