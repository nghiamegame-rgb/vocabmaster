# Smart Quiz — Đọc từ và hiện ảnh sau khi chọn đáp án (Multiple Choice)

Nhánh: `feat/quiz-feedback` (tách từ `feat/theme-animation`, chưa push, chưa deploy).

## 1. Hành vi mới

Áp dụng **riêng cho chế độ Multiple Choice của từ vựng** (`mode !== 'structure'`; chế độ Listening & Typing và Grammar Structures giữ nguyên như cũ):

1. **Tự động đọc to từ tiếng Anh đúng (`q.wordEnglish`)** ngay lúc bấm đáp án — áp dụng cả khi chọn đúng lẫn chọn sai, kể cả khi các nút đáp án hiển thị nghĩa tiếng Việt.
2. **Hiện khung ảnh nổi ở giữa-dưới màn hình** kèm chữ tiếng Anh (và ghi chú `annotation` nếu có), hiệu ứng hiện nhẹ (`fade + scale`, tôn trọng chế độ giảm chuyển động của máy):
   - Ảnh của từ được tải sẵn (preload) ngay khi câu hỏi xuất hiện. Nếu từ có ảnh và đã tải xong, ảnh hiện ngay lập tức; nếu từ không có ảnh, ảnh lỗi hoặc chưa tải kịp thì hiện ô chữ cái đầu (`WordInitialTile`), không chờ mạng.
   - Khung ảnh dùng `position: fixed` và `pointer-events: none` nên không làm câu hỏi/nút đáp án bị nhảy vị trí, không che câu hỏi và khung giải thích 💡, thấy ngay trên điện thoại 375 px không cần cuộn.
3. **Thời gian tự chuyển sang câu mới**: chỉ chuyển khi **đồng thời** thỏa 3 điều kiện:
   - Đã qua tối thiểu **1,8 giây** từ lúc bấm đáp án.
   - Giọng đọc đã đọc xong (`onEnd`).
   - Ảnh đã hiển thị đủ ít nhất **1 giây**.
   - **Trần an toàn 4 giây**: nếu quá 4 giây mà giọng đọc không báo kết thúc (máy không có giọng, trình duyệt chặn âm…), web vẫn tự sang câu mới để không bao giờ bị kẹt.
4. **Dọn dẹp gọn**: khi sang câu mới, hết bài, hoặc chuyển sang tab khác thì giọng đọc hiện tại được hủy ngay và mọi bộ đếm được xóa; bấm nhanh nhiều lần cũng chỉ đọc 1 lần. Cách chấm điểm, cảnh báo/hỏi lại khi sai lần đầu và lên/xuống cấp L1–L5 giữ nguyên 100%.

## 2. 3 hằng số thời gian và cách chỉnh

Mở file `src/components/Quiz.jsx`, ngay đầu phần `Constants` (dòng 19–21):

```js
const FEEDBACK_MIN_MS   = 1800; // Thời gian tối thiểu (ms) trước khi sang câu mới
const FEEDBACK_IMAGE_MS = 1000; // Thời gian tối thiểu (ms) ảnh phải hiện trên màn hình
const FEEDBACK_MAX_MS   = 4000; // Trần an toàn tối đa (ms) nếu giọng đọc không báo xong
```

Chỉ cần đổi các con số này (đơn vị mili-giây, ví dụ `2000` = 2 giây) rồi chạy lại `npm run build`.

## 3. Danh sách file đã sửa / thêm mới

| File | Thay đổi |
| --- | --- |
| `src/utils/quizFeedback.js` *(mới)* | Hàm thuần `evaluateFeedbackAdvance` tính thời gian sang câu mới và `getFeedbackNowMs`. |
| `src/components/Quiz.jsx` | Thêm 3 hằng số đầu file; trong `QuizGame`: preload ảnh, gọi `playWordAudio` ngay trong `handleSelect`, đồng bộ điều kiện chuyển câu, hủy đọc khi đổi câu/unmount, thêm khung ảnh nổi ở giữa-dưới màn hình. |
| `src/index.css` | Thêm `@keyframes vmFeedbackIn` và class `.vm-feedback-in` (chỉ dùng `transform`/`opacity`, 220 ms, tôn trọng `prefers-reduced-motion`). |
| `test/quiz-feedback.test.js` *(mới)* | 9 kiểm tra Node cho logic tính thời gian (mốc 1800 ms, ảnh 1000 ms, đọc xong sớm/muộn, trần 4000 ms, tùy chỉnh hằng số). |
| `test/quiz-feedback-browser.test.js` *(mới)* | Test trình duyệt (Edge headless, giả lập `speechSynthesis`/`Audio`): chọn đúng/sai đều đọc `q.wordEnglish`, preload ảnh + fallback `WordInitialTile`, không chuyển trước 1800 ms, chờ audio dài 2400 ms, trần 4000 ms khi không có `onEnd`, hủy đọc khi rời Quiz, kiểm tra không tràn ngang và không che giải thích ở 1280/375/320 px. |
| `docs/QUIZ-FEEDBACK.md` *(mới)* | Tài liệu này. |

Không động vào `api/`, `google-apps-script.js`, `grammar-apps-script.js`, `src/hooks/`, `src/utils/audio.js`, `package.json`, hay các test cũ.

## 4. Kết quả kiểm tra

- **Build (`npm run build`)**: Đạt (exit 0, bundle chính 506,96 kB).
- **Lint (`npm run lint`)**: Đạt (exit 0, 0 lỗi, giữ nguyên 34 cảnh báo sẵn có của dự án, không thêm cảnh báo mới).
- **Test Node (`npm test`)**: **31/31** file đạt (gồm 30 test cũ + `test/quiz-feedback.test.js`).
- **Test trình duyệt (Playwright + Edge headless)**: **10/10** file đạt:
  - 9 test cũ: `grammar-corpus-browser`, `grammar-export-browser`, `grammar-review-browser`, `grammar-topic-browser`, `sentence-notes-browser`, `underline-rendering`, `vocab-quota-browser`, `vocab-star-browser`, `vocab-sync-browser`.
  - 1 test mới: `quiz-feedback-browser`.
- **Ảnh chụp màn hình**: đã chụp và kiểm tra trực tiếp trạng thái ngay sau khi chọn đáp án ở **1280 px** và **375 px** (khung câu hỏi và giải thích 💡 rõ ràng, khung ảnh nổi gọn ở giữa-dưới, không tràn ngang).
- **Phần chưa kiểm tra**: chưa nghe phát âm TTS thật trên điện thoại vật lý (iOS Safari / Android Chrome) vì test trình duyệt giả lập `speechSynthesis`/`Audio` trong môi trường không có mạng ngoài.

## 5. Cách hoàn tác

Nếu muốn quay lại phiên bản trước khi thêm tính năng này (nhánh `feat/theme-animation`):

```bash
git checkout feat/theme-animation
```

Nếu muốn xóa hẳn nhánh thử nghiệm này sau khi đã quay lại `feat/theme-animation`:

```bash
git branch -D feat/quiz-feedback
```
