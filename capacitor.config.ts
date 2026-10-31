import type { CapacitorConfig } from '@capacitor/cli';

// appId phải là package Java hợp lệ (không dấu gạch ngang như appId Electron).
const config: CapacitorConfig = {
  appId: 'com.hanzi.gifgenerator',
  appName: 'Tạo GIF Chữ Hán',
  webDir: 'dist',
  android: { backgroundColor: '#0c0c0c' },
  plugins: {
    // Đăng nhập Google native trên Android (web dùng popup của Firebase JS SDK)
    FirebaseAuthentication: { skipNativeAuth: false, providers: ['google.com'] },
  },
};

export default config;
