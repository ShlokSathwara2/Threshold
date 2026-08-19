import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.threshold.app',
  appName: 'Threshold',
  webDir: 'out',
  server: {
    androidScheme: 'https',
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 150,
      launchAutoHide: true,
      androidScaleType: 'CENTER_CROP',
      showSpinner: false,
      splashFullScreen: true,
      splashImmersive: true,
      backgroundColor: '#05060d',
    },
    StatusBar: {
      style: 'DARK',
      backgroundColor: '#09090f',
      overlaysWebView: true,
    },
    LocalNotifications: {
      smallIcon: 'ic_launcher',
      iconColor: '#6366f1',
    },
  },
  android: {
    backgroundColor: '#09090f',
  },
};

export default config;
