import type { CapacitorConfig } from '@capacitor/cli';

/**
 * Capacitor wrapper config (M6 prep). The Vite build (base './') emits a self-contained web app
 * into `dist/`, which Capacitor packages into the native iOS/Android shells. See docs/capacitor.md
 * for the one-time platform setup and the sync/run loop.
 */
const config: CapacitorConfig = {
  appId: 'com.wardens.game',
  appName: 'WARDENS',
  webDir: 'dist',
  backgroundColor: '#efe8d6',
  android: {
    backgroundColor: '#efe8d6',
  },
  ios: {
    backgroundColor: '#efe8d6',
    contentInset: 'always',
  },
};

export default config;
