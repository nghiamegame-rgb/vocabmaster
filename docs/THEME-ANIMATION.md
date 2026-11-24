# Nâng cấp Theme & Animation — VocabMaster

- **Nhánh git:** `feat/theme-animation` (tách từ `main`, chưa push, chưa deploy).
- **Phạm vi:** chỉ chỉnh giao diện (CSS trong `src/index.css` và `className` Tailwind trong các component UI). **Không đổi logic, state, hook, dữ liệu lưu trữ, nhãn hiển thị, `id`/`aria-label`, hay thêm thư viện mới.**

---

## 1. Bảng màu đã chọn và lý do

Đã cân nhắc 3 bảng màu nền tối và chọn **Bảng 1 — Midnight Indigo & Glass Slate**:

| Phương án | Đặc điểm chính | Lý do chọn / loại |
| --- | --- | --- |
| **1. Midnight Indigo & Glass Slate (ĐÃ CHỌN)** | Nền sâu `#070b14` có ánh sáng môi trường nhẹ, 3 tầng bề mặt kính tối (`#0d1424` → `#131d33` → `#1b2844`), nhấn Indigo `#6366f1` và Violet `#8b5cf6` cho Grammar | Giữ nhận diện quen thuộc của VocabMaster, tạo chiều sâu hiện đại và tách bạch rõ với màu Đúng (xanh lá), Sai (đỏ hồng), Từ khó ⭐ (vàng hổ phách) |
| 2. Deep Forest & Emerald | Nền xanh rêu đậm `#07110e`, nhấn ngọc lục bảo | Dễ lẫn màu nhấn chính với trạng thái "Đúng / Đã hiểu" trong bài luyện |
| 3. Warm Charcoal & Amber | Nền than ấm `#11100e`, nhấn hổ phách | Dễ lẫn màu nhấn chính với thẻ "Từ khó ⭐" và khung cảnh báo |

**Thông số tương phản & nhất quán (khai báo tập trung trong `src/index.css`):**
- Chữ chính `#f8fafc`, chữ phụ `#cbd5e1`, chữ mờ nâng lên `#94a3b8` (thay nhiều chỗ `text-slate-500`/`600` cũ bị tối) để đạt chuẩn đọc **WCAG AA** trên nền tối.
- Viền phân tầng nhẹ (`rgba(148,163,184,0.14)` → `0.22` → `0.34`), bóng đổ mềm (`--shadow-card`, `--shadow-card-hover`).
- Giữ nguyên font `Inter` với `display=swap` (không tải thêm họ chữ mới).
- Bổ sung viền `focus-visible` rõ nét (`2px solid rgba(129,140,248,0.78)`) cho bàn phím, gỡ bỏ các chỗ `focus:outline-none` làm mờ tiêu điểm.

---

## 2. Danh sách Animation theo màn hình

Toàn bộ animation dùng **CSS thuần**, chỉ animate `transform` và `opacity` (không animate `width`/`height`/`top`/`left`), thời lượng **160–280 ms**, đường cong mượt `cubic-bezier(0.22, 1, 0.36, 1)`, và **tự tắt** khi người dùng bật `prefers-reduced-motion: reduce`.

| Màn hình | Hiệu ứng đã áp dụng |
| --- | --- |
| **Toàn ứng dụng (`App`, `ErrorBoundary`)** | Nền ánh sáng môi trường cố định (pseudo-element `::before`), hiệu ứng vào màn hình nhẹ `vm-page-enter` (fade + trượt lên 8 px, 240 ms) |
| **Navbar & Toast** | Thanh điều hướng kính mờ `backdrop-blur-xl`; nút tab & nút Sync phản hồi hover/active (`vm-btn`); badge trạng thái lưu `vm-scale-in`; toast đồng bộ trượt xuống từ trên (`vm-toast-enter`, 220 ms); biểu tượng đang đồng bộ nhịp nhẹ (`vm-pulse-soft`) |
| **Dashboard** | Thẻ chỉ số và thanh cấp độ `MasteryBar` nổi nhẹ khi rê chuột (`vm-card-interactive`); thanh tiến độ lộ diện bằng `scaleX` + vệt sáng lướt GPU (`::after`), không animate `width` |
| **Vocabulary** | Thẻ từ vựng `WordCard` nổi nhẹ khi hover, nút Speak/Sửa/Xóa/Sao và bộ lọc pill có phản hồi nhấn (`vm-btn`); menu đổi cấp hàng loạt mở mượt (`vm-scale-in`) |
| **Flashcard** | Lật thẻ 3D mượt hơn (`vm-flip-inner`, 280 ms), chữ "Click to flip" nhịp nhẹ (`vm-pulse-soft`), màn hình hoàn thành phiên `vm-scale-in` |
| **ListeningReview** | Thẻ ảnh phản hồi hover/chọn và hiệu ứng đúng/sai (`vm-scale-in`); thay `animate-pulse` tải ảnh bằng skeleton sáng lướt GPU (`vm-skeleton`) |
| **Smart Quiz** | Các thẻ cấu hình, nút chọn đáp án A/B/C/D, thanh tiến độ và màn tổng kết `QuizResults` dùng hiệu ứng đồng bộ (`vm-btn`, `vm-scale-in`, `progress-fill`) |
| **Grammar & tab con** | Tab con, bộ cấu hình, nút thao tác, thẻ thống kê và thẻ Structures có hiệu ứng hover/active nhất quán. **Riêng các khung chứa câu có gạch chân/ghi chú chỉ đổi màu nền/viền, không dùng `transform`/`animation`** để không làm lệch đo tọa độ DOM |

---

## 3. Danh sách file đã sửa (và file giữ nguyên)

**20 file mã nguồn đã sửa:**
- CSS & khung ứng dụng: `src/index.css`, `src/App.jsx`, `src/components/ErrorBoundary.jsx`
- Màn hình chính: `src/components/Navbar.jsx`, `src/components/Dashboard.jsx`, `src/components/Vocabulary.jsx`, `src/components/Flashcard.jsx`, `src/components/WordInitialTile.jsx`, `src/components/ListeningReview.jsx`, `src/components/Quiz.jsx`, `src/components/Grammar.jsx`
- Tab con Grammar: `src/components/grammar/GrammarPractice.jsx`, `src/components/grammar/GrammarQuiz.jsx`, `src/components/grammar/GrammarAnalysis.jsx`, `src/components/grammar/GrammarReview.jsx`, `src/components/grammar/GrammarSaved.jsx`, `src/components/grammar/GrammarStats.jsx`, `src/components/grammar/GrammarStructures.jsx`, `src/components/grammar/GrammarCloudSettings.jsx`, `src/components/grammar/GrammarExportPanel.jsx`

**Giữ nguyên 100% (không chỉnh sửa):**
- 4 file đo vị trí câu Grammar: `UnderlinedSentence.jsx`, `SentenceNoteEditor.jsx`, `UnderlineToolbar.jsx`, `GrammarReadingNotes.jsx`
- `GrammarTopicBadge.jsx` (giữ nguyên class được test kiểm tra)
- Toàn bộ `api/`, `google-apps-script.js`, `grammar-apps-script.js`, `src/hooks/`, `src/utils/`, `test/`, `package.json`, `package-lock.json`

---

## 4. Kết quả kiểm tra trước và sau khi sửa

| Hạng mục | Trước khi sửa (`main`) | Sau khi sửa (`feat/theme-animation`) | Ghi chú |
| --- | --- | --- | --- |
| `npm run build` (JS chính) | `503.88 kB` (gzip `149.82 kB`) | `504.22 kB` (gzip `150.88 kB`) | Tăng `+0.34 kB`, không thêm thư viện |
| `npm run build` (CSS chính) | `80.19 kB` (gzip `11.82 kB`) | `102.08 kB` (gzip `15.16 kB`) | Thêm token màu, bề mặt và keyframes |
| `npm run lint` | 0 lỗi, 34 cảnh báo | 0 lỗi, 34 cảnh báo | Không phát sinh cảnh báo/lỗi mới |
| `npm test` (test Node) | `30/30` đạt | `30/30` đạt | Đủ `navbar-a11y`, `vstep-labels`, `vocabulary-render`, `dead-code`, `word-initial-tile`… |
| Chụp ảnh & kiểm tra tràn ngang (Edge headless) | `1280 px`, `375 px`, `320 px`: 0 tràn ngang | `1280 px`, `375 px`, `320 px`: 0 tràn ngang | Đã so ảnh trước/sau tất cả 6 tab chính |
| Test trình duyệt (Playwright + Edge) | — | **6/6 đã chạy đều đạt:** `underline-rendering`, `sentence-notes-browser`, `grammar-review-browser`, `vocab-star-browser`, `vocab-sync-browser`, `grammar-topic-browser` | Xác nhận gạch chân/ghi chú đo DOM không lệch và nút ôn Grammar đổi màu xám tức thì |

**Phần chưa kiểm tra / giới hạn:**
- Chưa mở thử trên điện thoại cảm ứng thật, Safari hoặc Firefox (chỉ kiểm tra trên Microsoft Edge headless qua Playwright ở 1280/375/320 px).
- 3 test trình duyệt còn lại (`grammar-corpus-browser.test.js`, `grammar-export-browser.test.js`, `vocab-quota-browser.test.js`) chưa chạy lại trong phiên này; logic liên quan đã qua đầy đủ bộ `npm test` (30/30).
- File `docs/BAO-CAO-PHAN-TICH-WEB.md` có thay đổi sẵn của bạn từ trước được giữ nguyên, không đưa vào commit của nhánh này.

---

## 5. Cách hoàn tác

Nếu muốn quay về giao diện cũ trên nhánh `main`:

```bash
git checkout main
```

Nếu muốn xóa hẳn nhánh thử nghiệm sau khi đã chuyển về `main`:

```bash
git branch -D feat/theme-animation
```
