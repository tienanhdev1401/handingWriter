# 🖌️ Tạo GIF Nét Chữ Hán

Ứng dụng web cho phép nhập chữ Hán và tự động tạo ảnh GIF động hiển thị **thứ tự nét đúng chuẩn**.

Dữ liệu nét lấy từ dataset chính thức [Make Me a Hanzi](https://github.com/skishore/makemeahanzi) — **không dùng AI để đoán thứ tự nét**.

![Preview](./docs/preview.gif)

---

## ✨ Tính năng

| Tính năng | Chi tiết |
|-----------|---------|
| 🎬 GIF động | Hiển thị từng nét theo đúng thứ tự chuẩn |
| 📦 Offline | Dữ liệu 9.574 ký tự được bundle sẵn (không cần Internet) |
| 🎨 Tùy chỉnh | Màu nét, màu phác thảo, tốc độ, kích thước |
| 📐 Nhiều kích thước | 256 / 512 / 1024 px |
| 💾 Tải về | Từng file GIF hoặc gộp tất cả vào ZIP |
| 🔁 Lặp vô hạn | Tùy chọn bật/tắt loop |
| 🪟 Nền trong suốt | Hỗ trợ GIF với nền alpha (1-bit transparency) |
| 🚀 Không chặn UI | Tạo GIF tuần tự, mỗi ký tự yield cho React render |
| 🌐 Đa ngôn ngữ | Tiếng Việt / English, giao diện sáng/tối |
| 📒 Sổ từ | Nhiều bộ từ theo chủ đề (vd. Đi mua sắm); gõ chữ đơn hoặc từ nhiều chữ, giản/phồn thể → pinyin + nghĩa tự điền (từ điển offline); sửa/chuyển bộ tại chỗ, xuất/nhập JSON, nạp HSK 1–3 thành bộ riêng |
| 🗂️ Học theo bộ | Lật thẻ, Bắn chữ, Tập viết chọn một hoặc kết hợp nhiều bộ để học |
| 🃏 Lật thẻ | Flashcard lật 3D, chấm Nhớ/Quên theo Leitner 5 hộp; lọc Tất cả / Cần ôn / Mới |
| 🎯 Bắn chữ | Chữ rơi, bấm chữ khớp nghĩa (hoặc ngược lại); 3 mạng, âm báo, kỷ lục |
| ✍️ Tập viết | Vẽ từng nét lên chữ mờ, chấm theo median chuẩn; sai 3 lần hiện gợi ý |
| 📈 Thống kê | Số từ, số cần ôn, chuỗi ngày học ngay trên thanh tab |
| ☁️ Đồng bộ | Đăng nhập Google / email (Firebase), sổ từ và tiến độ ôn đồng bộ giữa các thiết bị, tuỳ chọn |

---

## 🛠 Cài Đặt

### Yêu cầu
- Node.js ≥ 18
- npm ≥ 9

### Bước 1: Cài dependencies

```bash
npm install
```

### Bước 2: Chạy ứng dụng

```bash
npm run dev
```

Mở trình duyệt tại: **http://localhost:5173**

> **Lưu ý**: File `public/data/graphics.txt` (30MB) đã được tải sẵn và là nguồn dữ liệu thứ tự nét. Không được xóa file này.

---

## 📱 Android (APK)

Dự án Android nằm trong `android/` (Capacitor 7, WebView). Cần Android SDK (platform 35, build-tools 35) và **JDK 21** (`android/gradle.properties` trỏ sẵn tới JBR của Android Studio; đổi `org.gradle.java.home` nếu cài chỗ khác).

```bash
npm run android:apk        # build web → copy vào android/ → gradlew assembleDebug
# APK: android/app/build/outputs/apk/debug/app-debug.apk
```

- Tải GIF / ZIP / sổ từ trên Android mở **bảng Chia sẻ** (Lưu vào Files, Drive, Zalo…) vì WebView không hỗ trợ tải trực tiếp.
- `npm run android:open` mở dự án trong Android Studio để ký bản release hoặc chạy trên thiết bị thật.
- Phiên bản Android (`versionCode`/`versionName` trong `android/app/build.gradle`) cập nhật tay theo `package.json`.

---

## ☁️ Đăng nhập & đồng bộ (Firebase, tuỳ chọn)

Không cấu hình thì app chạy offline như cũ, nút tài khoản ẩn. Cấu hình xong thì sổ từ, bộ từ và tiến độ ôn đồng bộ giữa các thiết bị qua một document Firestore cho mỗi người dùng (gói Spark miễn phí thừa đủ cho dùng cá nhân).

### Tạo project (một lần, ~10 phút)

1. Vào https://console.firebase.google.com → **Add project** → đặt tên (vd. `hanzi-gif`) → tắt Google Analytics → **Create project**.
2. **Authentication** → **Get started** → tab **Sign-in method**:
   - Bật **Google** (chọn email hỗ trợ) → Save.
   - Bật **Email/Password** → Save. (Cần cho bản Windows đóng gói, vì popup Google không chạy trong Electron `app://`.)
3. **Firestore Database** → **Create database** → chọn vị trí gần (vd. `asia-southeast1`) → **Start in production mode** → Create.
   Sang tab **Rules**, dán nội dung file [`firestore.rules`](./firestore.rules) trong repo → **Publish**.
4. **Project settings** (bánh răng) → **Your apps** → **Add app** → biểu tượng **Web** `</>` → nickname tuỳ ý, không cần Hosting → **Register app**.
   Copy object `firebaseConfig` → dán đè vào [`src/firebase.config.ts`](./src/firebase.config.ts).
5. (Android) Vẫn trong **Your apps** → **Add app** → **Android**:
   - Package name: `com.hanzi.gifgenerator`
   - Debug signing certificate SHA-1: lấy bằng lệnh dưới (lấy bằng lệnh dưới)
     ```bash
     keytool -list -v -keystore %USERPROFILE%\.android\debug.keystore -alias androiddebugkey -storepass android -keypass android
     ```
   - **Register app** → **Download google-services.json** → thay file giữ chỗ tại `android/app/google-services.json`.
   - Authentication → Settings → **Authorized domains** không cần sửa cho Android.
6. Build lại: `npm run build` (web/Electron) và `npm run android:apk` (Android).

### Cách đồng bộ hoạt động

- Đăng nhập lần đầu trên một máy đã có dữ liệu: dữ liệu máy và dữ liệu trên mây **hợp nhất** (không ghi đè). Từ trùng giữ bản đã ôn nhiều hơn.
- Mỗi thay đổi đẩy lên sau 1,5 giây; thiết bị khác nhận ngay qua listener.
- Chấm tròn trên avatar: xám = chưa đồng bộ, vàng = đang, xanh = xong, đỏ = lỗi (bấm vào để xem).
- Dung lượng: ~200 byte/từ, trần 1 MiB/document ≈ 4.900 từ.

---

## 🏗 Build Production

```bash
npm run build
```

Output sẽ nằm trong thư mục `dist/`. Có thể serve bằng bất kỳ web server tĩnh nào (Nginx, Apache, `serve`, v.v.).

```bash
# Preview bản build
npm run preview
```

---

## 📁 Cấu Trúc Dự Án

```
handingWriter/
├── public/
│   └── data/
│       ├── graphics.txt          # Make Me a Hanzi dataset (~30MB, 9574 ký tự)
│       ├── dict.json             # Rút gọn từ Make Me a Hanzi dictionary.txt: pinyin + nghĩa (~430KB)
│       ├── t2s.json              # Phồn/dị thể → giản thể theo từng chữ, để tra khi khoá phồn thể không có sẵn
│       ├── words.json            # Từ ≥2 chữ (HSK, ~11k) khoá cả giản lẫn phồn: pinyin + nghĩa
│       └── hsk.json              # Chữ đơn HSK 1–3 (bản 2012) từ complete-hsk-vocabulary (MIT)
├── src/
│   ├── types/
│   │   ├── index.ts              # TypeScript interfaces cho toàn app
│   │   └── gifenc.d.ts           # Khai báo type cho thư viện gifenc
│   ├── services/
│   │   ├── hanzi.ts              # Load & cache dataset, lookup ký tự
│   │   └── gif.ts                # Encode frames → GIF Blob via gifenc
│   ├── utils/
│   │   └── canvas.ts             # Render engine: SVG path → Canvas, clip mask
│   ├── hooks/
│   │   └── useGifGenerator.ts    # Điều phối: state, progress, cancel, cleanup
│   ├── components/
│   │   ├── GifPreview.tsx        # Card hiển thị 1 GIF + download
│   │   └── OptionsPanel.tsx      # Bảng tùy chọn collapsible
│   ├── learn/                    # Học tập: store (localStorage), srs (Leitner), dict, judge (chấm nét), Notes, Flashcards, Shooter, Write
│   ├── pages/
│   │   ├── Home.tsx              # Trang tạo GIF
│   │   └── Learn.tsx             # Trang học tập (tab: sổ từ / lật thẻ / bắn chữ / tập viết)
│   ├── App.tsx                   # Điều hướng hash: #/gif | #/learn/*
│   ├── i18n.tsx / theme.ts / route.ts
│   ├── main.tsx
│   └── index.css
├── index.html
├── vite.config.ts
├── tailwind.config.js
├── tsconfig.json
└── package.json
```

---

## 🎨 Kiến Trúc Kỹ Thuật

### Luồng Tạo GIF

```
User Input
    ↓
extractChineseChars()     # Lọc & deduplicate ký tự CJK
    ↓
useGifGenerator.generate()  # Xử lý tuần tự từng ký tự
    ↓
getCharacterData(char)      # Đọc stroke data từ graphics.txt cache
    ↓
generateCharacterFrames()   # Tạo sequence của canvas frames
    |
    ├── renderFrame()         # Vẽ lên canvas: outline → done strokes → current stroke
    |       └── buildProgressClipPath()   # Tạo clip mask polygon dọc theo median
    |
    └── capture ImageData     # Snapshot từng frame
    ↓
encodeGif(frames)           # gifenc: quantize + applyPalette + writeFrame
    ↓
Blob URL → GifPreview card
```

### Render Engine Chi Tiết

**Coordinate Transform** (Make Me a Hanzi → Canvas):
- Make Me a Hanzi dùng hệ tọa độ: origin góc dưới-trái, y tăng lên trên
- Canvas dùng: origin góc trên-trái, y tăng xuống dưới
- Transform: `ctx.translate(0, size); ctx.scale(size/1024, -size/1024)`

**Progressive Stroke Reveal**:
- Mỗi ký tự có `strokes[]` (SVG path) và `medians[][]` (center path points)
- Để animate nét vẽ từng phần, dùng **clip mask** hình đa giác dọc median:
  1. Tính vector pháp tuyến tại mỗi điểm median
  2. Tạo polygon bao quanh phần median từ 0% → progress%
  3. `ctx.clip()` với polygon đó, rồi fill toàn bộ stroke path
  4. Chỉ phần trong clip mới hiện ra → tạo hiệu ứng "nét đang vẽ"

### Tech Stack

| Layer | Công nghệ |
|-------|-----------|
| Framework | React 19 + TypeScript (strict) |
| Build tool | Vite 8 |
| Styling | TailwindCSS 3 + Custom CSS |
| GIF encoder | gifenc (pure JS, no Worker) |
| ZIP | jszip |
| Dữ liệu nét | Make Me a Hanzi `graphics.txt` |
| Font | Be Vietnam Pro + Noto Serif SC (Google Fonts) |

---

## 🚫 Những Gì Không Được Dùng

- ❌ Không dùng AI/LLM để tạo thứ tự nét
- ❌ Không dùng screen recording / capture cửa sổ trình duyệt
- ❌ Không cần Internet khi dùng (offline hoàn toàn)
- ❌ Không dùng Hanzi Writer (chúng ta tự render từ SVG path)

---

## 📊 Giới Hạn Kỹ Thuật

| Giới hạn | Giá trị |
|----------|---------|
| Số ký tự tối đa mỗi lần | 200 |
| Kích thước GIF | 256 / 512 / 1024 px |
| Ký tự được hỗ trợ | ~9.574 (theo dataset Make Me a Hanzi) |
| Định dạng xuất | GIF (animated) |
| Nền trong suốt | Có (1-bit alpha, GIF standard) |

---

## 📝 Kế Hoạch Tiếp Theo

- [ ] Đóng gói thành file `.exe` bằng Electron (Windows + macOS)
- [ ] Thêm tùy chọn xuất WebP động (apng)
- [ ] Preview animation trực tiếp trước khi export GIF
- [ ] Batch processing từ file text

---

## 📄 License & Nguồn Dữ Liệu

- Dữ liệu nét + từ điển: [Make Me a Hanzi](https://github.com/skishore/makemeahanzi) — GPLv3 (graphics.txt, dictionary.txt)
- Danh sách HSK: [complete-hsk-vocabulary](https://github.com/drkameleon/complete-hsk-vocabulary) — MIT
- Ứng dụng này: MIT
