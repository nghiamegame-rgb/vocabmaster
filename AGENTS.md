# VocabMaster — hướng dẫn bảo trì

## Điểm vào cho agent
- Mục tiêu học tập của người dùng là **VSTEP**. Hiện Grammar luyện phân tích câu VSTEP B1; Smart Quiz (kể cả Structures) vẫn dùng prompt TOEIC. Không suy ra trạng thái chuyển đổi từ tên thư mục/package.
- Trước khi sửa, đọc [ngữ cảnh dự án](docs/PROJECT_CONTEXT.md), [bàn giao hiện tại](docs/HANDOFF.md), rồi kiểm tra `git status`/diff và mã thực tế. Tài liệu là ảnh chụp thời điểm khảo sát, không thay thế mã nguồn.
- Sau thay đổi ảnh hưởng kiến trúc, hành vi hoặc tiến độ công việc, cập nhật tài liệu liên quan. Chỉ ghi việc đã xác minh; đánh dấu suy luận và phần chưa kiểm tra.

## Kiến trúc đã xác minh
- React 19 + Vite 8, JavaScript/JSX, ES modules; Tailwind CSS 4, lucide-react.
- `src/main.jsx` bật StrictMode; `src/App.jsx` đổi tab bằng state, không dùng router.
- `src/hooks/useVocabStore.js` quản lý từ, thống kê, L1–L5 và sync; truyền qua props cho Dashboard, Vocabulary, Flashcard, ListeningReview, Quiz.
- `src/components/Grammar.jsx` dùng `useGrammarStore.js` riêng; các màn hình ở `src/components/grammar/`. `useStructuresStore.js` đặt ở App, dùng chung cho Grammar Structures và Smart Quiz. Thêm nhanh từ Grammar gọi `addWord` hoặc `addStructure`, không chuyển tiến độ.
- Smart Quiz (`Quiz.jsx`) và Grammar (`grammarPrompt.js`, `GrammarPractice.jsx`) tạo prompt, nhận JSON người dùng dán và kiểm tra dữ liệu; không gọi API AI trực tiếp.
- Grammar nhận schema v2 `sentence-analysis`; dữ liệu TOEIC cũ vẫn được đọc. `grammarImport.js` kiểm tra nhập, `grammarBatch.js` giữ ID bộ prompt và lịch sử tối đa 50 câu local; các file này hiện có thay đổi chưa commit tại lần bàn giao 2026-11-02.
- `src/utils/audio.js`: Web Speech API, dự phòng Google TTS. `wordSelection.js`: chọn từ cho Flashcard/Listening.
- Dấu gạch chân Grammar chỉ lưu local; `useGrammarStore` giữ state `underlines`, cập nhật sau lưu/đổi key và truyền props xuống ba màn hình. Không dùng ghi LocalStorage đơn thuần để làm mới React.
- Ghi chú theo đoạn chọn dùng `sentenceNotes.js`, khóa riêng `vocabmaster_grammar_sentence_notes`, state `sentenceNotes` trong store; không nhầm với `userNotes` của cả câu. Vị trí theo codepoint và snapshot câu/đoạn trích. Review ẩn ghi chú mỗi câu mới; layout đo DOM thật, nhãn/editor nằm ngoài vùng tính selection.

## Dữ liệu và đồng bộ
- Vocabulary: `storage.js`, khóa `vocabmaster_words` và `vocabmaster_stats`.
- Word: `id`, `english`, `annotation`, `vietnamese`, `imageUrl`, `wordType`, `level`, `currentStreak`, `createdAt`, tùy chọn `lastReviewedDate`.
- Vocabulary lên cấp theo streak 2/4/8/15; sai giảm một cấp. Smart Quiz kiểm tra lại trước khi giảm cấp vì sai.
- `cloud.js` gọi webhook trong `src/config.js`; backend tham chiếu là `google-apps-script.js`, ghi lại toàn bộ danh sách vào sheet đầu tiên.
- Vocabulary tự tải cloud khi mount; merge ưu tiên cloud khi trùng id HOẶC english không phân biệt hoa thường, giữ từ chỉ có local. Push debounce 2 giây, POST `no-cors`, sau đó GET chỉ xác minh số lượng, chưa xác minh nội dung.
- Grammar dùng các khóa `vocabmaster_grammar_*` trong `grammarStorage.js`: saved, stats, review, cloud_url, revision, pending. Thống kê của cả hai module hiện chỉ lưu local.
- Câu Grammar lưu bằng `savedId`, kèm `hardMarked`, `userNotes`; review map theo `savedId`, tách khỏi thống kê phiên học.
- Grammar có L1–L5 độc lập; tự đánh giá đã hiểu tăng một cấp, cần ôn lại giảm một cấp. Vocabulary/Grammar dùng khoảng ôn 1/3/7/14/30 ngày nhưng cách cập nhật khác nhau. Structures có tiến độ thứ ba riêng, ngưỡng streak 2/4/8/15; sai đến hạn ôn ngay.
- `grammarCloud.js` dùng URL lưu riêng, có thể là `/api/grammar-sync` hoặc Apps Script trực tiếp. `api/grammar-sync.js` là proxy Vercel, dùng env server `GRAMMAR_APPS_SCRIPT_URL`, `GRAMMAR_SYNC_SECRET`.
- `useGrammarStore.js`: tự GET khi mount module/đổi endpoint và khi có sự kiện online; nút Sync để thử lại. Chỉ push sau GET hợp lệ, debounce 2,5 giây; pending giữ khi lỗi; xung đột revision thì merge và thử gửi lại một lần. Các sửa trong request được phát lại và response cũ bị bỏ qua.
- `grammar-apps-script.js`: validation, CAS, LockService, backup trước ghi, `confirmEmpty`; sheet SavedQuestions/Meta/Backup. Secret là tùy chọn; proxy chưa xác thực người dùng riêng.
- `grammarSyncMerge.js`: hợp nhất câu theo savedId, hardMarked dùng OR, ưu tiên notes local không rỗng; review lấy max level/counters/timestamps. Chưa có tombstone nên merge có thể khôi phục câu đã xóa, dấu sao đã bỏ hoặc cấp đã giảm.
- Structures: khóa `vocabmaster_grammar_structures`, gồm tombstone và reviewEvents; dùng cùng URL Grammar nhưng `scope=structures`/`action=saveStructures`, revision và backup riêng. GET rồi merge trước mỗi POST; tự sync khi App mount, online, focus và sau sửa 2,5 giây. Xem [thiết lập Structures](STRUCTURES-SYNC-SETUP.md).

## Quy tắc an toàn dữ liệu
- Giữ riêng ba store Vocabulary, câu Grammar, Structures, các khóa LocalStorage và tiến độ L1–L5. Vocabulary dùng webhook riêng; câu Grammar và Structures chung endpoint nhưng khác scope/revision; không chuyển trạng thái học giữa các kho.
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
- Test chạy riêng bằng `node test/<tên>.test.js`; danh sách/phạm vi ở [PROJECT_CONTEXT](docs/PROJECT_CONTEXT.md#8-chạy-và-kiểm-tra). Test `underline-rendering` cần Playwright và Edge (thiết lập trong HANDOFF). Chưa có `npm test`. Trên PowerShell dùng `npm.cmd` nếu chính sách chặn `npm.ps1`.
- Test annotation/vocab sao chép logic, Grammar mô phỏng backend; pass chưa chứng minh sync thật. Đối chiếu mã ứng dụng, chạy test liên quan và build/lint khi phù hợp.
- Không commit, push, merge hoặc deploy nếu chưa được người dùng cho phép. Giải thích kết quả ngắn gọn bằng tiếng Việt.
