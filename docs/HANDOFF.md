# Bàn giao workspace VocabMaster

Cập nhật lần cuối: **2026-11-02**, Asia/Saigon. HEAD tham chiếu: `4a4aff095591629029e9a2deb75ef7fd7cc8ccc6`.
Bàn giao ban đầu (khảo sát): tham chiếu dưới đây.
Bàn giao này: bổ sung tính năng **gạch chân nhiều màu** cho câu tiếng Anh trong module Grammar.

## 1. Phạm vi lần bàn giao

Chỉ khảo sát và viết Markdown để tiếp tục giữa Codex/Gemini/agent khác. Không phát triển/sửa lỗi, thay cấu hình/dependency/dữ liệu, commit, push, merge, deploy hoặc ghi dịch vụ ngoài. Tài liệu tổng quan nằm trong [PROJECT_CONTEXT.md](PROJECT_CONTEXT.md); hướng dẫn áp dụng nằm trong [AGENTS.md](../AGENTS.md).

Mô tả hiện tại dựa trên working tree chưa commit. Mã xác nhận Grammar đã luyện phân tích câu VSTEP B1; Vocabulary là công cụ dùng chung; cả Smart Quiz Vocabulary và Structures vẫn dùng prompt TOEIC. Không có bằng chứng đã chuyển toàn bộ sản phẩm sang VSTEP.

## 2. Trạng thái có sẵn trước lần này

Các file untracked/modified từ bàn giao trước vẫn được giữ nguyên:
`GRAMMAR-VSTEP.md`, `src/components/Grammar.jsx`, `src/components/grammar/GrammarPractice.jsx`,
`src/utils/grammarPrompt.js`, `src/utils/grammarBatch.js`, `src/utils/grammarImport.js`, `test/grammar-import.test.js`.

## 3. Tính năng gạch chân nhiều màu

### File mới

| File | Mục đích |
| --- | --- |
| `src/utils/sentenceUnderline.js` | Logic lõi: segment model, applyUnderline, normalize, buildSpans, selectionToRange |
| `src/components/grammar/UnderlineToolbar.jsx` | Thanh màu floating (4 màu + nút Bỏ), không lấy focus |
| `src/components/grammar/UnderlinedSentence.jsx` | Component render câu có gạch chân + xử lý mouse/touch selection |
| `test/sentence-underline.test.js` | 29 unit test logic lõi (node, không cần browser) |

### File đã sửa

| File | Thay đổi |
| --- | --- |
| `src/utils/grammarStorage.js` | Thêm `LS_GRAMMAR_UNDERLINES`, `getAllUnderlines`, `getUnderlinesForKey`, `saveUnderlinesForKey`, `migrateUnderlineKey` ở cuối file |
| `src/hooks/useGrammarStore.js` | Import thêm 3 hàm storage + `applyUnderline`/`textKey`; thêm `updateUnderlines(key, start, end, color)` action; `saveQuestion` tự `migrateUnderlineKey` sau lưu; export `updateUnderlines` |
| `src/components/grammar/GrammarAnalysis.jsx` | `GrammarSentenceCard` dùng `UnderlinedSentence` thay `<p>`; nhận props `underlineKey`/`onUnderlineChange` |
| `src/components/grammar/GrammarQuiz.jsx` | Tính `ulKey` (savedId hoặc textKey); truyền xuống `GrammarSentenceCard`; nhận `onUnderlineChange` |
| `src/components/grammar/GrammarSaved.jsx` | Dùng `UnderlinedSentence` cho câu trong card; nhận `onUnderlineChange` |
| `src/components/grammar/GrammarReview.jsx` | Truyền `underlineKey=q.savedId` và `onUnderlineChange` xuống `GrammarSentenceCard` |
| `src/components/Grammar.jsx` | Destructure `updateUnderlines` từ store; truyền `onUnderlineChange={updateUnderlines}` vào GrammarQuiz, GrammarSaved, GrammarReview |

### Cách nhận diện câu (sentence key)

- **Câu đã lưu** (trong library): dùng `savedId` (`gq_<timestamp>_<random>`) — ổn định và duy nhất.
- **Câu chưa lưu** (đang luyện tập): dùng `textKey(sentence)` = `"text:" + sentence.trim()`.
- Khi người dùng bấm "Lưu câu" → `saveQuestion` sinh `savedId` mới → `migrateUnderlineKey(sentence, savedId)` ngay sau đó chuyển marks từ text-key sang savedId-key.
- Ba màn hình Luyện tập/Câu đã lưu/Ôn tập đều resolve ra cùng savedId-key → marks hiển thị nhất quán.
- Hai câu có text khác nhau nhưng savedId trùng (không thể xảy ra do format `gq_<timestamp>_<random>`) sẽ không dùng chung marks.
- Câu cũ legacy dùng savedId bình thường; không có marks mặc định.

### Cách lưu trữ

- Key localStorage: `vocabmaster_grammar_underlines`
- Format: `{ [key: string]: [{start, end, color}] }`
- `start`/`end` là codepoint offset (không phải UTF-16) — đúng với emoji và ký tự bổ sung.
- `color` là một trong `'yellow'|'blue'|'green'|'pink'`.
- Lưu **synchronous** ngay khi thao tác, không cần chờ cloud hay unmount.
- **Không đồng bộ cloud** — local only. Lý do: schema cloud hiện tại không có trường underlines; thêm vào sẽ cần sửa Apps Script và proxy. Xem mục "Apps Script" bên dưới.
- Không ảnh hưởng `savedQuestions`, `reviewProgress`, `grammarStats` hay bất kỳ sync flow nào hiện có.

### Đồng bộ cloud

Hiện tại: **local only**. Underlines không được đưa vào payload Grammar sync.

Để bổ sung sync sau này:
1. Thêm trường `underlines: { [savedId]: Segment[] }` vào payload POST Grammar (`grammarCloud.js`).
2. Apps Script (`grammar-apps-script.js`): thêm cột/field trong sheet `Meta` để lưu underlines JSON; cần merge theo savedId (không phải OR/max — đây là replace-by-key để tránh khôi phục dấu đã xóa).
3. `grammarSyncMerge.js`: thêm `mergeUnderlines(local, cloud)` — local thắng (vì đã apply xong khi push), không cần tombstone vì null-color đã xóa sạch entry.
4. Triển khai Apps Script mới trước khi bật sync. Local autosave vẫn hoạt động trong thời gian này.

## 4. Kiểm tra trong lần này

| Kiểm tra | Kết quả | Giới hạn bằng chứng |
| --- | --- | --- |
| `node test/sentence-underline.test.js` | Exit 0, 29/29 passed | Logic lõi; không có DOM thật |
| `npm.cmd run build` | Exit 0, 1923 modules transformed | Build client; không test UI browser |
| `npm.cmd run lint` | Exit 0, 0 lỗi mới (1212 warnings pre-existing) | Không có warnings mới từ code thêm |
| 11 test cũ (grammar-sync, grammar-auto-sync, grammar-sentence, …) | Chưa chạy lại lần này | Không sửa logic của các test đó; build pass ngầm xác nhận import OK |

**Chưa kiểm tra trong browser:** selection trên mobile, toolbar positioning cạnh mép màn hình, wrap text nhiều dòng, copy-paste có chọn ngoài container. Đây là phần cần xác nhận thủ công khi mở app.

**Chưa làm:** sync cloud, cập nhật Apps Script, test trên thiết bị thật.

## 5. Điểm đọc tiếp theo nhiệm vụ sau

1. Bắt đầu từ `git status`/diff mới nhất.
2. Nếu bổ sung sync underlines: đọc `grammarCloud.js`, `grammarSyncMerge.js`, `grammar-apps-script.js`, sau đó thiết kế merge strategy (tombstone không cần thiết nếu replace-by-key).
3. Nếu sửa UI toolbar: đọc `UnderlineToolbar.jsx` và `UnderlinedSentence.jsx`; lưu ý `onMouseDown e.preventDefault()` là cần thiết để giữ selection.
4. Nếu muốn thêm màu: chỉ cần thêm entry vào `UNDERLINE_COLORS` trong `sentenceUnderline.js`.
