import type { CapacitorConfig } from '@capacitor/cli';

// appId phải là package Java hợp lệ (không dấu gạch ngang như appId Electron).
const config: CapacitorConfig = {
  appId: 'com.hanzi.gifgenerator',
  appName: 'Tạo GIF Chữ Hán',
  webDir: 'dist',
  android: { backgroundColor: '#0c0c0c' },
};

export default config;
