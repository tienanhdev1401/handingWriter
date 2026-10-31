// Mẫu cấu hình Firebase. Sao chép thành `firebase.config.ts` rồi dán object từ
// Firebase Console > Project settings > Your apps > Web app. Để trống → app chạy offline, ẩn nút đăng nhập.
export const firebaseConfig = {
  apiKey: '',
  authDomain: '',
  projectId: '',
  storageBucket: '',
  messagingSenderId: '',
  appId: '',
};

export const isFirebaseConfigured = firebaseConfig.apiKey !== '' && firebaseConfig.projectId !== '';
