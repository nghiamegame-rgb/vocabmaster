# VocabMaster — hướng dẫn bảo trì

## Kiến trúc đã xác minh
- React 19 + Vite 8, JavaScript/JSX, ES modules; Tailwind CSS 4, lucide-react.
- `src/main.jsx` bật StrictMode; `src/App.jsx` đổi tab bằng state, không dùng router.
- `src/hooks/useVocabStore.js` quản lý từ, thống kê, L1–L5 và sync; truyền qua props cho Dashboard, Vocabulary, Flashcard, ListeningReview, Quiz.
- `src/components/Grammar.jsx` dùng `useGrammarStore.js` riêng; các màn hình ở `src/components/grammar/`. Cầu nối sang Vocabulary là callback `addWord`.
- Smart Quiz (`Quiz.jsx`) và Grammar (`grammarPrompt.js`, `GrammarPractice.jsx`) tạo prompt, nhận JSON người dùng dán và kiểm tra dữ liệu; không gọi API AI trực tiếp.
- `src/utils/audio.js`: Web Speech API, dự phòng Google TTS. `wordSelection.js`: chọn từ cho Flashcard/Listening.

## Dữ liệu và đồng bộ
- Vocabulary: `storage.js`, khóa `vocabmaster_words` và `vocabmaster_stats`.
- Word: `id`, `english`, `annotation`, `vietnamese`, `imageUrl`, `wordType`, `level`, `currentStreak`, `createdAt`, tùy chọn `lastReviewedDate`.
- Vocabulary lên cấp theo streak 2/4/8/15; sai giảm một cấp. Smart Quiz kiểm tra lại trước khi giảm cấp vì sai.
- `cloud.js` gọi webhook trong `src/config.js`; backend tham chiếu là `google-apps-script.js`, ghi lại toàn bộ danh sách vào sheet đầu tiên.
- Vocabulary tự tải cloud khi mount; merge ưu tiên cloud khi trùng id HOẶC english không phân biệt hoa thường, giữ từ chỉ có local. Push debounce 2 giây, POST `no-cors`, sau đó GET chỉ xác minh số lượng, chưa xác minh nội dung.
- Grammar dùng các khóa `vocabmaster_grammar_*` trong `grammarStorage.js`: saved, stats, review, cloud_url, revision, pending. Thống kê của cả hai module hiện chỉ lưu local.
- Câu Grammar lưu bằng `savedId`, kèm `hardMarked`, `userNotes`; review map theo `savedId`, tách khỏi thống kê phiên học.
- Grammar có L1–L5 độc lập; đúng tăng một cấp, sai giảm một cấp. Cả hai hệ dùng khoảng ôn 1/3/7/14/30 ngày nhưng cách cập nhật khác nhau.
- `grammarCloud.js` dùng URL lưu riêng, có thể là `/api/grammar-sync` hoặc Apps Script trực tiếp. `api/grammar-sync.js` là proxy Vercel, dùng env server `GRAMMAR_APPS_SCRIPT_URL`, `GRAMMAR_SYNC_SECRET`.
- `useGrammarStore.js`: push debounce 2,5 giây; pending giữ khi lỗi; xung đột revision thì merge và thử gửi lại một lần. Tải cloud qua nút Sync, chưa có fetch tự động khi mount.
- `grammar-apps-script.js`: validation, CAS, LockService, backup trước ghi, `confirmEmpty`; sheet SavedQuestions/Meta/Backup. Secret là tùy chọn; proxy chưa xác thực người dùng riêng.
- `grammarSyncMerge.js`: hợp nhất câu theo savedId, hardMarked dùng OR, ưu tiên notes local không rỗng; review lấy max level/counters/timestamps. Chưa có tombstone nên merge có thể khôi phục câu đã xóa, dấu sao đã bỏ hoặc cấp đã giảm.

## Quy tắc an toàn dữ liệu
- Giữ riêng hai store, khóa LocalStorage, webhook và tiến độ L1–L5; không chuyển trạng thái giữa hai hệ.
- `annotation` là ghi chú nhập tay, độc lập với `wordType`; chỉ hiển thị/tìm kiếm, không ghép vào phát âm, đáp án hoặc prompt bài tập. Giữ qua sửa, import/export và sync.
- `annotation.js` migrate khi chưa có annotation dạng string; giữ ghi chú cũ và cụm như `account (for)`.
- Không thay dữ liệu local bằng cloud rỗng/lỗi. Vocabulary hard-sync chỉ xóa cache sau khi nhận cloud hợp lệ và merge; giữ các guard chống push lúc fetch.
- Không coi POST opaque hoặc số lượng khớp là bằng chứng nội dung đã lưu; Vocabulary chưa có CAS/lock/backup.
- Bảo toàn id, ghi chú, dấu sao, streak, level, ngày ôn và pending khi thay đổi schema/sync. Kiểm tra trường hợp offline, thiết bị cũ và sửa trong lúc request đang chạy.
- Không đưa secret vào frontend. Apps Script trong repo chưa chắc giống bản đang chạy; triển khai riêng cần người dùng cho phép.
- Không gọi endpoint production để thử ghi/xóa, không xóa LocalStorage hoặc dữ liệu cloud trong quá trình kiểm tra.

## Quy ước làm việc
- Ưu tiên mã thực tế hơn README mẫu và comment có thể cũ; kiểm tra `git status`/diff trước khi sửa, giữ thay đổi có sẵn của người dùng.
- Sửa đúng phạm vi, tránh refactor không cần thiết; không đọc `node_modules`, `dist` hay file sinh không liên quan.
- Lệnh: `npm run dev`, `npm run build`, `npm run lint`. Vite config hiện chưa proxy `/api`; chạy Vite riêng không phục vụ function Vercel.
- Test hiện có chạy riêng: `node test/annotation.test.js`, `node test/vocab-sync.test.js`, `node test/word-selection.test.js`, `node test/grammar-sync.test.js`; chưa có `npm test`.
- Test annotation/vocab sao chép logic, Grammar mô phỏng backend; pass chưa chứng minh sync thật. Đối chiếu mã ứng dụng, chạy test liên quan và build/lint khi phù hợp.
- Không commit, push, merge hoặc deploy nếu chưa được người dùng cho phép. Giải thích kết quả ngắn gọn bằng tiếng Việt.
