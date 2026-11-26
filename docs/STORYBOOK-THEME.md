# Thiết kế giao diện Storybook (Hoàng Hôn / Twilight) — Hành trình đến VSTEP

- **Nhánh git:** `feat/twilight-theme` (tách từ `main` `2398fcb`).
- **Khôi phục giao diện cũ:** Giao diện giấy kem sáng cũ nằm ở commit **`2398fcb`** (trên `main`) nếu cần khôi phục.
- **Phạm vi:** Thay thế hoàn toàn bảng màu giấy kem sáng bằng bảng màu **Hoàng Hôn (Twilight / Blue Hour)** trên nền tảng Storybook hiện có (`src/index.css`, `Navbar.jsx`, `App.jsx`, `ErrorBoundary.jsx`, `Dashboard.jsx`, `src/components/storybook/StorybookArt.jsx`). Không thêm nút chuyển sáng/tối, giữ nguyên bố cục, tên class (`.sb-*`, `.vm-*`, `.sb-legacy`), và toàn bộ logic.

---

## 1. Bảng màu Hoàng Hôn & kết quả rà tương phản (WCAG AA)

| Token CSS | Giá trị | Vai trò | Tương phản đã kiểm |
| --- | --- | --- | --- |
| `--sb-bg-top` → `--sb-bg-bottom` | `#0f0b2e` → `#1a1446` | Nền trang gradient đứng | Nền chính toàn ứng dụng |
| `--sb-panel-bg` / `--sb-surface` / `--sb-surface-elevated` | `#1c164a` / `#221b5a` / `#2b246b` | Bề mặt panel, thẻ, nút/thẻ khi hover | Chữ dùng `--sb-text` / `--sb-text-muted` |
| `--sb-surface-deep` / `--sb-nav-bg` | `#140f3b` / `rgba(17, 12, 50, 0.90)` | Rãnh thanh tiến độ, khung bản đồ, thanh menu | Nền tối sâu, đọc rõ chữ sáng |
| `--sb-text` | `#f4efff` | Chữ chính | **15,12:1** trên `#1a1446`; **13,58:1** trên `#221b5a`; **11,89:1** trên `#2b246b` |
| `--sb-text-muted` | `#b9b2e6` | Chữ phụ, chú thích | **8,58:1** trên `#1a1446`; **7,70:1** trên `#221b5a`; **6,75:1** trên `#2b246b` |
| `--sb-border` / `--sb-border-strong` | `rgba(138, 111, 209, 0.46)` / `0.62` | Viền lavender (40–60%) | Phân tách thẻ/panel nhẹ nhàng |
| `--sb-primary` / **`--sb-primary-btn`** | `#5b6ee1` / **`#4c5ed1`** | Periwinkle chính (dải màu, nút đang chọn/hành động) | Chữ trắng `#ffffff` trên `#4c5ed1` đạt **5,48:1** (tinh chỉnh tối nhẹ từ `#5b6ee1` vốn chỉ ~4,41:1) |
| `--sb-secondary` / `-text` | `#8a6fd1` / `#dcd0ff` | Lavender phụ & nhãn | **10,57:1** (`#dcd0ff` trên `#221b5a`) |
| `--sb-warm` / `--sb-peach` / `-text` | `#e8809a` / `#f0a38b` / `#ffbfd0` | Điểm nhấn ấm hồng đào | **9,92:1** (`#ffbfd0` trên `#221b5a`) |
| `--sb-amber` / `-text` / `--sb-border-amber` | `#f2b45a` / `#f8ca82` / `rgba(242, 180, 90, 0.62)` | Vàng hổ phách (chọn, huy hiệu, cột mốc, focus ring) | **10,03:1** (`#f8ca82` trên `#221b5a`); **10,20:1** trên nền nav |
| `--sb-starlight` | `#cfe0ff` | Ánh sáng nhấn xanh trắng nhạt | **11,48:1** trên `#221b5a` |
| `--sb-success` / `-text` | `#34d399` / `#86efac` | Trạng thái đúng / thành công | **10,90:1** (`#86efac` trên `#221b5a`) |
| `--sb-danger` / `-text` | `#fb7185` / `#fda4af` | Trạng thái sai / lỗi | **8,09:1** (`#fda4af` trên `#221b5a`) |
| `--sb-lvl1`..`--sb-lvl5` (+ `-soft`, `-text`, `-border`) | `#fb7185`, `#f0a38b`, `#f2b45a`, `#5eead4`, `#34d399` | 5 chặng từ vựng L1–L5 | Chữ nhãn sáng đạt AA trên nền thẻ; chữ `#120d36` trên viên tròn L1–L5 đạt **6,87:1–12,49:1** |

---

## 2. Quy tắc dùng token, viền & bóng phát sáng

- **Dùng token tập trung:** Toàn bộ màu sắc khai báo trong `@theme` và `:root` của `src/index.css`. Component dùng `var(--sb-*)`, không viết cứng mã hex rải rác (chỉ giữ mã hex trong định nghĩa SVG nội tuyến của `StorybookArt.jsx`).
- **Bóng phát sáng (thay bóng cứng đen đặc):**
  - `--sb-glow-sm`: viền lavender 26% + ánh sáng periwinkle dịu.
  - `--sb-glow-md`: bóng thẻ/panel mặc định (lavender + periwinkle).
  - `--sb-glow-hover`: viền vàng hổ phách 45% + ánh sáng lan tỏa khi rê chuột.
  - `--sb-glow-amber`: dùng cho nút nổi bật, logo, tab đang chọn.
- **Vòng focus bàn phím:** `--sb-ring: #f2b45a` (vàng hổ phách), hiển thị rõ trên cả trang chính lẫn `.sb-legacy`.

---

## 3. Chữ viết (tự host, không dùng CDN)

- **Tiêu đề (`.sb-font-display`):** `'Fraunces Variable'`, fallback `Georgia, 'Times New Roman', serif`.
- **Thân bài:** `'Nunito Variable'`, fallback `system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif`.
- **Tự host:** `@fontsource-variable/fraunces` và `@fontsource-variable/nunito`, chỉ import subset `vietnamese` và `latin` trong `src/styles/fonts.css`.

---

## 4. Minh họa Hoàng Hôn & Bản đồ khu vực

- **Nhân vật gốc:** **Cáo nhỏ lữ khách** (`FoxBody` trong `src/components/storybook/StorybookArt.jsx`) — lông cam san hô `#e8734a`, khăn và khóa ba lô vàng hổ phách `#f2b45a`, cầm gậy đèn lồng phát sáng dịu.
- **Tranh nền hoàng hôn (`JourneyMapSvg`, `EmptyTrailScene`, `CompassBadge`):**
  - Bầu trời gradient chàm sâu (`#100b33`) → tím (`#2a1d63`) → hồng tím (`#6c3f7c`) → hồng đào (`#d87594`) → cam hổ phách ở đường chân trời (`#f2b45a`).
  - Sao lấp lánh `#cfe0ff` / `#f2b45a`, trăng lưỡi liềm, mây tím nhạt viền hồng đào `#f0a38b`, núi/đồi chàm-tím có viền sáng vàng ở cạnh trên, hải đăng bật đèn vàng ấm và 5 cột mốc L1–L5 rực sáng.
- **Quy tắc minh họa & chuyển động:** Không thêm animation mới; trang trí dùng `aria-hidden="true"` + `pointer-events: none`; giữ hỗ trợ `prefers-reduced-motion`.

---

## 5. Lớp cầu nối `.sb-legacy` & các class giữ nguyên

- **`.sb-legacy`:** Vẫn giữ để bọc 6 tab chưa chuyển (`Vocabulary`, `Flashcard`, `Smart Quiz`, `Listening`, `Grammar`, `Dictation`) trong `src/App.jsx`. Nay đặt lại nền chàm-tím (`#151040` + gradient lavender/periwinkle), viền lavender và bóng `--sb-glow-md` để hòa với nền hoàng hôn. **Không** gắn `transform`, `filter`, `backdrop-filter`, `contain: paint`, hay `overflow: hidden` lên `.sb-legacy`.
- **Class giữ nguyên tên:** `.sb-font-display`, `.sb-panel`, `.sb-card`, `.sb-card-interactive`, `.sb-sticker`, `.sb-btn-ink`, `.sb-paper-note`, và toàn bộ `.vm-*`, `.field`, `.progress-fill`, `.perspective-1000`, `.preserve-3d`, `.backface-hidden`, `.rotate-y-180`.

---

## 6. Lộ trình các giai đoạn sau

- **Giai đoạn 2:** Chuyển giao diện `Vocabulary` (Làng từ vựng) + `Flashcard` (Trạm thẻ), gỡ `.sb-legacy` khỏi 2 tab này.
- **Giai đoạn 3:** Chuyển giao diện `Quiz` (Thử thách) + `ListeningReview` (Đài nghe hải đăng), giữ nguyên khung ảnh quiz và đo vị trí.
- **Giai đoạn 4:** Chuyển giao diện `Grammar` (Tháp cấu trúc) và các tab con, giữ nguyên logic đo hình học gạch chân/ghi chú.
- **Giai đoạn 5:** Chuyển giao diện `Dictation` (Xưởng chép chính tả), gỡ hoàn toàn `.sb-legacy` và dọn các biến/class cũ.
