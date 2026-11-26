# Thiết kế giao diện Storybook — Hành trình đến VSTEP

- **Nhánh git:** `feat/storybook-theme-phase1` (tách từ `main`).
- **Phạm vi Giai đoạn 1:** (1) Nền tảng thiết kế trong `src/index.css` & `src/styles/fonts.css`, (2) Thanh menu `Navbar.jsx` + khung ứng dụng `App.jsx` & `ErrorBoundary.jsx` (kèm lớp cầu nối `.sb-legacy` cho 6 tab chưa chuyển), (3) Trang `Dashboard.jsx` ("Bản đồ hành trình") và minh họa SVG gốc trong `src/components/storybook/StorybookArt.jsx`.
- **Nguyên tắc bất biến:** Không đổi logic học, chấm điểm, đồng bộ cloud, dữ liệu, `id`/`aria-label`/nhãn tab, hay nội dung 6 tab chưa chuyển.

---

## 1. Bảng màu & độ tương phản (WCAG AA)

| Token CSS | Giá trị | Vai trò | Ghi chú tương phản |
| --- | --- | --- | --- |
| `--sb-paper` | `#f6efe2` | Nền trang giấy kem ấm | Nền chính toàn ứng dụng |
| `--sb-paper-card` | `#fbf7ee` | Nền thẻ, thanh menu, ghi chú | Đạt ≥ 4.5:1 với `--sb-ink` (>12:1) và `--sb-ink-soft` (>6.8:1) |
| `--sb-paper-warm` | `#f2e8d5` | Nền panel / khung bản đồ | Chữ dùng `--sb-ink` / `--sb-ink-soft` |
| `--sb-paper-deep` | `#ece1cc` | Nền phụ, trạng thái hover nhẹ | Chữ dùng `--sb-ink` |
| `--sb-ink` | `#2b2a33` | Mực chính, viền 2px, bóng cứng | Tương phản cao trên mọi nền giấy |
| `--sb-ink-soft` | `#575361` | Chữ phụ, chú thích | Đạt WCAG AA trên `--sb-paper` và `--sb-paper-card` |
| `--sb-terracotta` / `--sb-terracotta-strong` / `-text` | `#d9603b` / `#c44d2a` / `#a83b1c` | Nhấn chính (tab đang chọn, nút hành động, lông cáo) | Chữ trắng trên `#c44d2a` (≥ 4.6:1); chữ `#a83b1c` trên giấy sáng |
| `--sb-forest` / `-text` | `#3f7d58` / `#295a3d` | Chặng L5, thành công, ba lô cáo | Chữ `#295a3d` trên giấy sáng đạt WCAG AA |
| `--sb-sky` / `--sb-sky-strong` / `-text` | `#3a8fb7` / `#277296` / `#1f5d7a` | Chỉ số độ chính xác, thông tin | Chữ `#1f5d7a` trên giấy sáng đạt WCAG AA |
| `--sb-ochre` / `-text` | `#e0a82e` / `#7d5608` | Khăn quàng cáo, chặng L3, cảnh báo | Chữ `#7d5608` trên giấy sáng đạt WCAG AA (tránh dùng vàng làm chữ trực tiếp) |
| `--sb-plum` / `-text` | `#7a4e8c` / `#5e386e` | Điểm nhấn Tháp cấu trúc / Grammar | Chữ `#5e386e` trên giấy sáng đạt WCAG AA |
| `--sb-berry` / `-text` | `#c8434e` / `#9e2a35` | Chặng L1 (New), cảnh báo lỗi | Chữ `#9e2a35` trên giấy sáng đạt WCAG AA |
| `--sb-clay` / `-text` | `#d97736` / `#9e4812` | Chặng L2 (Familiar) | Chữ `#9e4812` trên giấy sáng đạt WCAG AA |
| `--sb-lagoon` | `#216e6e` | Chặng L4 (Proficient) | Đạt WCAG AA trên giấy sáng |

---

## 2. Chữ viết (tự host, không dùng CDN)

- **Tiêu đề (`.sb-font-display`):** `'Fraunces Variable'`, fallback `Georgia, 'Times New Roman', serif`.
- **Thân bài:** `'Nunito Variable'`, fallback `system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif`.
- **Tự host:** Cài từ npm `@fontsource-variable/fraunces` và `@fontsource-variable/nunito`. File `src/styles/fonts.css` chỉ khai báo `@font-face` cho **2 subset `vietnamese` và `latin`** để giữ bundle nhẹ và đảm bảo dấu tiếng Việt hiển thị chuẩn. Không gọi Google Fonts từ mạng ngoài.

---

## 3. Nét viền, đổ bóng & chất liệu giấy

- **Viền mực:** `2px solid var(--sb-ink)` (`#2b2a33`).
- **Bo góc hữu cơ nhẹ:** Ví dụ `18px 20px 17px 21px` cho `.sb-card` để có cảm giác cắt giấy thủ công nhưng vẫn gọn gàng.
- **Bóng đổ lệch cứng kiểu nhãn dán:**
  - Nhỏ: `2px 2px 0 var(--sb-ink)` (`.sb-sticker`, nút tab đang chọn, nút Sync).
  - Vừa: `3px 3px 0 var(--sb-ink)` (`.sb-btn-ink`, `.sb-paper-note`) và `4px 4px 0 var(--sb-ink)` (`.sb-card`, `.sb-panel`).
  - Lớn / Hover: `6px 6px 0 var(--sb-ink)`.
- **Chất liệu giấy & nền bản đồ:** Pseudo-element `.vm-app-shell::before` (`position: fixed; z-index: -1; pointer-events: none`) phủ lớp màu nước rất nhẹ ở các góc kết hợp SVG `feTurbulence` data-URI độ mờ thấp (`opacity` ~0.04) để tạo vân giấy mà không giảm độ rõ chữ.

---

## 4. Nhân vật gốc & Bản đồ khu vực ("Hành trình đến VSTEP")

- **Nhân vật gốc:** **Cáo nhỏ lữ khách** (`FoxTraveler` trong `src/components/storybook/StorybookArt.jsx`) — chú cáo lông đất nung, má kem, đeo ba lô xanh rừng, quàng khăn vàng nghệ, tay cầm cuộn bản đồ. Cáo đứng tại chặng có nhiều từ nhất (ưu tiên chặng cao hơn nếu bằng nhau; khi chưa có từ thì đứng ở L1).
- **Bản đồ khu vực (chỉ là chủ đề hình ảnh, giữ nguyên tên tab trên thanh menu):**
  - **Dashboard** → Bản đồ hành trình
  - **Vocabulary** → Làng từ vựng
  - **Flashcard** → Trạm thẻ
  - **Smart Quiz** → Thử thách
  - **Listening** → Đài nghe hải đăng
  - **Grammar** → Tháp cấu trúc
  - **Dictation** → Xưởng chép chính tả
  - **L1–L5** → 5 chặng trên con đường (`Trại khởi hành`, `Đồi làm quen`, `Rừng đang học`, `Cầu thành thạo`, `Đỉnh tinh thông`).

---

## 5. Quy tắc minh họa & chuyển động

- **Minh họa SVG:**
  - Thành phần trang trí (`EmptyTrailScene`, `CompassBadge`, họa tiết nền) gắn `aria-hidden="true"` và `pointer-events: none`.
  - Bản đồ có thông tin (`JourneyMapSvg`) gắn `role="img"` và `aria-label` tiếng Việt mô tả bản đồ 5 chặng, vẫn đặt `pointer-events: none` để không chặn thao tác chạm/chuột.
- **Chuyển động:**
  - Chỉ animate `transform`, `opacity` (và bóng nhấn nút/thẻ), thời lượng `160–280 ms`, đường cong `cubic-bezier(0.22, 1, 0.36, 1)`.
  - Tôn trọng `@media (prefers-reduced-motion: reduce)` để tắt hiệu ứng chuyển động.
  - Không đặt `position: fixed` bên trong phần tử có `.vm-page-enter` (vì `.vm-page-enter` dùng `transform`).

---

## 6. Class tiện ích mới & Lớp cầu nối `.sb-legacy`

- **Class Storybook mới (`src/index.css`):**
  - `.sb-font-display`, `.sb-card`, `.sb-card-interactive`, `.sb-panel`, `.sb-sticker`, `.sb-btn-ink`, `.sb-paper-note`.
  - `.sb-legacy`: lớp bọc tạm trong `App.jsx` cho 6 tab chưa chuyển (`Vocabulary`, `Flashcard`, `Smart Quiz`, `Listening`, `Grammar`, `Dictation`). Đặt lại nền tối (`#070b14`), chữ sáng (`#f8fafc`), các biến CSS `--bg-*`/`--text-*`/`--border-*` cũ trong khung bo góc viền mực. **Không** gắn `transform`, `filter`, `backdrop-filter`, `contain: paint`, hay `overflow: hidden` lên `.sb-legacy` để các popup `position: fixed` trong Grammar vẫn neo đúng theo cửa sổ trình duyệt.
- **Class `.vm-*` cũ giữ nguyên tên:** `.field`, `.vm-panel`, `.vm-card`, `.vm-card-interactive`, `.vm-btn`, `.vm-btn-primary`, `.vm-btn-violet`, `.vm-input`, `.vm-skeleton`, `.progress-fill`, `.perspective-1000`, `.preserve-3d`, `.backface-hidden`, `.rotate-y-180`, `.vm-flip-inner`, `.animate-fade-in`, `.animate-slide-in`, `.vm-page-enter`, `.vm-toast-enter`, `.vm-scale-in`, `.vm-feedback-in`, `.vm-pulse-soft`.

---

## 7. Lộ trình các giai đoạn sau

- **Giai đoạn 2:** Chuyển giao diện `Vocabulary` (Làng từ vựng) + `Flashcard` (Trạm thẻ), gỡ `.sb-legacy` khỏi 2 tab này.
- **Giai đoạn 3:** Chuyển giao diện `Quiz` (Thử thách) + `ListeningReview` (Đài nghe hải đăng) & phần dùng chung `listening/`, giữ nguyên khung ảnh quiz và đo vị trí.
- **Giai đoạn 4:** Chuyển giao diện `Grammar` (Tháp cấu trúc) và các tab con, giữ nguyên logic đo hình học gạch chân/ghi chú.
- **Giai đoạn 5:** Chuyển giao diện `Dictation` (Xưởng chép chính tả), gỡ hoàn toàn `.sb-legacy` và dọn các biến/class nền tối không còn dùng.
