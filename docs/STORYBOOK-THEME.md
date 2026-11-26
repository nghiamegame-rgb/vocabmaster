# Thiết kế giao diện Storybook (Giấy Kem Sáng) — Hành trình đến VSTEP

- **Nhánh git:** `feat/storybook-light-all` (tách từ `main` `3240dd8`).
- **Khôi phục giao diện cũ nếu cần:**
  - Bản nền sáng Giai đoạn 1 (Dashboard, Navbar, ErrorBoundary) nằm ở commit **`2398fcb`**.
  - Bản nền tối **Hoàng Hôn (Twilight / Blue Hour)** trước đó được giữ ở commit **`cbca927`** trên `main` (`feat/twilight-theme`).
- **Phạm vi:** Áp dụng đồng nhất bảng màu **giấy kem ấm & mực tối** của phong cách Storybook cho **toàn bộ trang web** (`Dashboard`, `Vocabulary`, `Flashcard`, `Smart Quiz`, `Listening`, `Grammar`, `Dictation`, `VoiceSettings`, `WordInitialTile`, `Navbar`, `ErrorBoundary`). Lớp cầu nối `.sb-legacy` và các quy tắc CSS nền tối cũ đã được gỡ bỏ hoàn toàn.

---

## 1. Bảng màu Giấy Kem Sáng & token (`src/index.css`)

| Token CSS | Giá trị | Vai trò chính |
| --- | --- | --- |
| `--sb-paper` / `--sb-paper-card` | `#f6efe2` / `#fbf7ee` | Nền trang giấy kem ấm & nền thẻ chính |
| `--sb-paper-warm` / `--sb-paper-deep` | `#f2e8d5` / `#ece1cc` | Nền panel, thanh nhóm, rãnh tiến độ, hover nhẹ |
| `--sb-input-bg` / `--sb-backdrop` | `#fffdf8` / `rgba(43, 42, 51, 0.45)` | Nền ô nhập liệu (`input`, `select`, `textarea`) & nền mờ modal |
| `--sb-ink` / `--sb-ink-soft` | `#2b2a33` / `#575361` | Chữ chính (tương phản cao trên nền giấy) & chữ phụ / nhãn |
| `--sb-ink-border` / `--sb-ink-faint` | `rgba(43, 42, 51, 0.28)` / `0.16` | Chỉ dùng cho viền/đường kẻ phân tách (không dùng `--sb-ink-faint` làm màu chữ) |
| `--sb-terracotta-strong` / `-hover` / `-text` / `-soft` | `#c44d2a` / `#ad3f1f` / `#a83b1c` / `#fae3d7` | Màu chủ đạo (nút chính `.vm-btn-primary`, tab đang chọn, loa, con trỏ đọc) |
| `--sb-plum` / `-hover` / `-text` / `-soft` | `#7a4e8c` / `#643c75` / `#5e386e` / `#ede1f2` | Điểm nhấn phụ (`.vm-btn-violet`, Grammar, chủ đề, từ đã lưu Dictation) |
| `--sb-forest-btn` / `-hover` / `-text` / `-soft` | `#2f6e4a` / `#255a3b` / `#225437` / `#ddeee2` | Trạng thái đúng, thành công, nút Nộp / Đã hiểu / Xuất Excel |
| `--sb-berry-btn` / `-hover` / `-text` / `-soft` | `#b8333f` / `#9e2732` / `#96222d` / `#f9dfe1` | Trạng thái sai, lỗi, nút Cần ôn lại / Xóa |
| `--sb-ochre` / `-text` / `-soft` | `#e0a82e` / `#7a5205` / `#f8ecd0` | Sao khó ⭐, đến hạn ôn, cảnh báo chú ý |
| `--sb-sky-strong` / `-text` / `-soft` | `#226b8c` / `#1c5874` / `#dceef6` | Trạng thái chờ, nhãn cấp độ ôn tập |
| `--sb-clay-text` / `-soft`, `--sb-lagoon-text` / `-soft` | `#96420e` / `#fae8d8`, `#175252` / `#d9f0ef` | Huy hiệu L2, L4, loại từ & thống kê phụ |
| `--sb-disabled-bg` / `-text` / `-border` | `#dfd5c0` / `#595462` / `rgba(43, 42, 51, 0.30)` | Trạng thái vô hiệu hóa (nút đã đánh giá, lựa chọn bị khóa) |

---

## 2. Quy tắc dùng token, viền, bóng & khả năng truy cập

- **Dùng token tập trung:** Component dùng biến CSS `var(--sb-*)` từ `src/index.css` (hoặc các class dùng chung `.vm-panel`, `.vm-card`, `.vm-btn-primary`, `.vm-btn-violet`, `.vm-input`, `.field`, `.sb-card`, `.sb-panel`, `.sb-btn-ink`), không viết cứng bảng màu tối (`bg-slate-*`, `text-white` trên nền sáng, `#070b14`, ...).
- **Viền mực & bóng nhãn dán:** `--sb-shadow-sm` (`2px 2px 0 var(--sb-ink)`), `--sb-shadow-md` (`4px 4px 0 var(--sb-ink)`), `--sb-shadow-lg` (`6px 6px 0 var(--sb-ink)`).
- **Vòng focus bàn phím & bôi chọn chữ:** `--sb-ring: #c44d2a` (`outline: 2px solid var(--sb-ring)`), `::selection` dùng nền `--sb-ochre-soft` với chữ `--sb-ink`.
- **Tương phản (WCAG AA):** Nút nền đậm dùng chữ trắng chỉ khi cặp nền/chữ đạt tương phản (`#c44d2a`, `#2f6e4a`, `#b8333f`, `#7a4e8c` với `#ffffff`); nhãn/pill nền nhạt (`*-soft`) luôn đi cùng chữ tối (`*-text`).

---

## 3. Chữ viết (tự host, không dùng CDN)

- **Tiêu đề (`.sb-font-display` / `.sb-heading`):** `'Fraunces Variable'`, fallback `Georgia, 'Times New Roman', serif`.
- **Thân bài:** `'Nunito Variable'`, fallback `system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif`.
- **Tự host:** `@fontsource-variable/fraunces` và `@fontsource-variable/nunito`, chỉ import subset `vietnamese` và `latin` trong `src/styles/fonts.css`.

---

## 4. Minh họa & Quy tắc bảo toàn hành vi

- **Nhân vật gốc:** **Cáo nhỏ lữ khách** (`FoxBody` trong `src/components/storybook/StorybookArt.jsx`) cùng bản đồ `JourneyMapSvg` 5 chặng L1–L5, `EmptyTrailScene`, `CompassBadge` trên nền giấy kem sáng.
- **Không đổi bố cục đo hình học & logic:** Giữ nguyên ô ảnh cột phải Smart Quiz (`#quiz-mc-image-slot`, `.vm-card`), vùng đo dòng gạch chân/ghi chú câu Grammar (`UnderlinedSentence.jsx` giữ `text-[12px] leading-4`, nền nghỉ trong suốt, không border), cơ chế tự focus Listening, dữ liệu, đồng bộ Google Sheets và phát âm.
- **Chuyển động:** Tôn trọng `prefers-reduced-motion`; trang trí dùng `aria-hidden="true"` + `pointer-events: none`.
