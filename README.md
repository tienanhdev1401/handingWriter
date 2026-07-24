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
| 🇻🇳 Giao diện tiếng Việt | Hoàn toàn bằng tiếng Việt |

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
│       └── graphics.txt          # Make Me a Hanzi dataset (~30MB, 9574 ký tự)
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
│   ├── pages/
│   │   └── Home.tsx              # Trang chính
│   ├── App.tsx
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
| Font | Inter + Noto Serif SC (Google Fonts) |

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

- Dữ liệu nét: [Make Me a Hanzi](https://github.com/skishore/makemeahanzi) — GPLv3
- Ứng dụng này: MIT
