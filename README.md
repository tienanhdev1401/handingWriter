# 書 Tạo GIF Chữ Hán

Ứng dụng học chữ Hán chạy offline: tạo GIF thứ tự nét chuẩn và luyện từ vựng. Có bản Windows, Android (máy tính bảng, màn ngang) và web.

Dữ liệu nét lấy từ [Make Me a Hanzi](https://github.com/skishore/makemeahanzi), không dùng AI đoán nét.

## Tính năng

**Tạo GIF**
- Nhập chữ, xuất GIF động từng nét theo đúng thứ tự, tải lẻ hoặc gộp ZIP
- Tuỳ chỉnh màu, tốc độ, kích thước 256 / 512 / 1024, nền trong suốt

**Học tập**
- Sổ từ theo bộ (chủ đề). Gõ chữ hoặc từ, giản thể hay phồn thể, pinyin và nghĩa tự điền. Nạp sẵn HSK 1–3
- Lật thẻ với lặp lại ngắt quãng (Leitner), lọc Cần ôn / Mới
- Bắn chữ: chữ rơi, bấm chữ khớp nghĩa hoặc ngược lại
- Tập viết: vẽ từng nét lên chữ mờ, chấm theo dữ liệu nét chuẩn; chế độ Viết ẩn để viết theo trí nhớ
- Học theo một hoặc nhiều bộ cùng lúc; thống kê số từ, cần ôn, chuỗi ngày
- Đăng nhập (tuỳ chọn) để đồng bộ sổ từ giữa các thiết bị qua Firebase

Giao diện tiếng Việt / English, sáng / tối.

## Chạy

```bash
npm install
npm run dev            # web tại http://localhost:5173
npm run electron:dev   # cửa sổ Electron (cần dev server đang chạy)
```

## Build

```bash
npm run dist:win       # Windows installer → release/
npm run android:apk    # Android debug APK → android/app/build/outputs/apk/debug/
```

Android cần Android SDK (API 35) và JDK 21; đường dẫn JDK đặt trong `android/gradle.properties`.

## Đồng bộ (Firebase, tuỳ chọn)

Không cấu hình thì app chạy hoàn toàn offline và ẩn nút đăng nhập.

Để bật: tạo project Firebase, bật Authentication (Google, Email/Password) và Firestore, dán web config vào `src/firebase.config.ts`, đặt `google-services.json` của app Android vào `android/app/`, dán `firestore.rules` vào tab Rules rồi Publish. Mỗi người dùng chỉ đọc/ghi được dữ liệu của mình.

## Kiểm tra

```bash
npx tsc -b && npx oxlint src && npm run build
npx tsc --ignoreConfig src/learn/learn.check.ts --outDir node_modules/.tmp/chk --module commonjs --target es2023 --skipLibCheck --lib es2023,dom && node node_modules/.tmp/chk/learn.check.js
```

## Nguồn dữ liệu

- Nét và từ điển: [Make Me a Hanzi](https://github.com/skishore/makemeahanzi) — GPLv3
- Danh sách HSK: [complete-hsk-vocabulary](https://github.com/drkameleon/complete-hsk-vocabulary) — MIT

Mã nguồn: MIT.
