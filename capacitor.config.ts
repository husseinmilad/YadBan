import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'ir.yadban.app',
  appName: 'یادبان',
  webDir: 'dist',
  android: {
    allowMixedContent: false,
    backgroundColor: '#0F766E',
  },
};

export default config;
