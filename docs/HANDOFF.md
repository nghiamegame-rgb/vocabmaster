# Bàn giao workspace VocabMaster

Cập nhật lần cuối: **2026-11-02**, Asia/Saigon. HEAD trước lần bổ sung màu trắng: `2cda47c75a09d21d9b6ee85b3a048e045fc4d233`.
Bàn giao ban đầu (khảo sát): tham chiếu dưới đây.
Bàn giao này: bổ sung tính năng **gạch chân nhiều màu** cho câu tiếng Anh trong module Grammar.

## 1. Phạm vi khảo sát ban đầu

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
| `src/components/grammar/UnderlineToolbar.jsx` | Thanh màu floating (5 màu + nút Bỏ), không lấy focus |
| `src/components/grammar/UnderlinedSentence.jsx` | Component render câu có gạch chân + xử lý mouse/touch selection |
| `test/sentence-underline.test.js` | 49 kiểm tra logic, storage giả lập và render HTML tĩnh (node, không cần browser) |

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
- `color` là một trong `'yellow'|'blue'|'green'|'pink'|'white'`.
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

## 4. Kiểm tra lần triển khai gạch chân ban đầu (theo bàn giao trước)

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

## 6. Bổ sung màu trắng — 2026-11-02

- Thêm `white: #FFFFFF`, nhãn tooltip/accessibility **“Trắng — Đánh dấu chung”**, sau bốn màu cũ và trước nút Bỏ; nút có viền nhẹ. Đây là dấu chung cho cấu trúc/cụm từ/giới từ hoặc nội dung người dùng chọn, không gán lại ý nghĩa bốn màu cũ.
- Dùng bộ màu chung nên validation, render và lưu local theo câu ở Luyện tập/Câu đã lưu/Ôn tập nhận màu trắng qua luồng hiện có. Giữ độ dày 2,5px, offset 4px, hành vi selection/chồng lấn/xóa và màu chữ câu. Không đổi schema, migrate dữ liệu, sửa cloud hoặc Apps Script.
- `node test/sentence-underline.test.js`: **49/49 đạt**, có kiểm tra white validation/overlap/xóa, lưu rồi đọc lại, chuyển text-key sang savedId, giữ dấu bốn màu cũ và dữ liệu review, thứ tự/nhãn nút và CSS render thực tế.
- `node test/grammar-sentence.test.js`: **7/7 đạt**. `npm.cmd run lint`: exit 0, còn cảnh báo ở các file không sửa trong lần này. Build bằng `npm.cmd run build -- --outDir <thư-mục-tạm-mới>`: exit 0; không ghi đè `dist` có sẵn.
- Chưa kiểm tra tương tác trình duyệt/mobile hoặc sync thật. Các hạn chế cũ về cập nhật giao diện ngay sau đổi dấu, tọa độ toolbar khi cuộn và merge dấu lúc chuyển key chưa sửa trong phạm vi thêm màu. Không commit, push hoặc deploy.

## 7. Sửa render dấu gạch chân chậm — 2026-11-02

- HEAD trước sửa: `96e77d0` (đã có màu trắng), working tree sạch khi bắt đầu. Nguyên nhân xác minh: `updateUnderlines` chỉ lưu LocalStorage; `GrammarSentenceCard`/`GrammarSaved` đọc dấu lúc render, nhưng không nhận state mới. Đóng toolbar chỉ render component con với props cũ; mở phân tích vô tình khiến cha đọc lại dấu. Hàng đợi câu Review không phải nơi giữ dữ liệu dấu.
- Sửa: `useGrammarStore` hydrate state `underlines` từ storage, công bố snapshot mới sau mỗi lần ghi và sau chuyển text-key → savedId. `Grammar` truyền map xuống Practice/Saved/Review và component câu; renderer đọc props thay vì tự đọc storage. Giữ nguyên selection/toolbar, năm màu, schema local, overlap, lưu ngay, assessment/analysis state; không thêm polling/timer/remount hoặc cloud sync. Các vấn đề cũ khác về vị trí toolbar khi cuộn và merge dấu không thuộc lần sửa này.
- Regression mới `test/underline-rendering.test.js` chạy **App thật trong Edge headless**, DOM Range/Selection thật và click toolbar. Trước sửa: test thất bại ngay ở lần thêm màu đầu (DOM không có dấu). Sau sửa: đạt thêm/đổi màu một phần/xóa một phần khi phân tích vẫn đóng ở cả ba màn; đi tab khác rồi quay lại, reload/mở lại; giữ assessment đã có, giữ phân tích đang mở, chuyển text-key → savedId và giữ dấu câu khác. Assertion DOM ngay sau click không retry/polling; cloud được giả lập offline để render từ network không che lỗi.
- Kiểm tra đạt: underline utility/storage/SSR **49/49**, Grammar sentence **7/7**, Grammar auto-sync **18/18**, Grammar sync **19/19**, browser regression; build vào thư mục tạm thành công, lint exit 0 còn cảnh báo có sẵn. Harness auto-sync bổ sung dependency storage thật và xử lý BOM khi nạp hook vào VM. Không sửa dependency/config dự án, không ghi endpoint production, không commit/push/deploy.
- Giới hạn: chưa thử mobile/touch hoặc thao tác kéo chọn thủ công trên nhiều thiết bị; test browser tạo selection bằng DOM rồi click nút thật. Không kiểm tra đồng bộ production.

Chạy browser regression trên máy có Edge, dùng Playwright cài riêng ở thư mục tạm:

```powershell
$underlineTestTools = Join-Path $env:TEMP 'vocabmaster-underline-test-tools'
npm.cmd install --prefix $underlineTestTools --no-package-lock --ignore-scripts --no-audit --no-fund playwright
$env:PLAYWRIGHT_MODULE = ([System.Uri](Join-Path $underlineTestTools 'node_modules/playwright/index.mjs')).AbsoluteUri
node test/underline-rendering.test.js
```

Có thể dùng Playwright đã cài sẵn thay cho `PLAYWRIGHT_MODULE`; `PLAYWRIGHT_EXECUTABLE_PATH` cho phép chọn browser Chromium khác. Test mở context mới với fixture, chặn request ra ngoài localhost; không dùng/xóa dữ liệu trình duyệt thật.

## 8. Ghi chú nhanh theo đoạn chọn — 2026-11-02

- HEAD đầu việc `91cc544`, working tree sạch. Thêm **Ghi chú** trên toolbar selection; editor focus ngay, rộng theo đoạn đo thực tế (180–320px, giới hạn viewport), cao theo nội dung, lưu khi gõ. Xong/Escape/click ngoài đóng; draft rỗng không tạo record, xóa hết nội dung/xóa ghi chú sẽ xóa record. Nhãn plain text nhỏ dưới đoạn, click để sửa. Giữ nguyên năm màu, xóa màu và hành vi gạch chân.
- File chính: `sentenceNotes.js` (validation/edit/persistence/chuyển key), `sentenceGeometry.js` (đo line/Range, pack hàng), `SentenceNoteEditor.jsx`, `UnderlinedSentence.jsx`, toolbar và props từ `useGrammarStore` qua ba màn Grammar. Khóa mới `vocabmaster_grammar_sentence_notes`, map key → `{id,sentenceKey,sentence,start,end,quote,text,createdAt,updatedAt}[]`. ID UUID không dùng AI id, offsets Unicode codepoint; chỉ dùng khi snapshot câu và quote khớp. Callback đọc dữ liệu local mới nhất rồi ghi và phát state, không chờ blur/unmount và không thêm pending cloud.
- Cùng identity với underline: savedId cho câu lưu, `text:` + sentence.trim() cho câu chưa lưu. Khi lưu câu, chuyển note sang savedId giữ ID/nội dung; tạo note không tự lưu câu. Notes độc lập hoàn toàn với underlines và `userNotes` cũ.
- Layout đo văn bản bằng DOM Range, không ước lượng từ số chữ. English spans chia theo dòng đo được; note neo ở dòng cuối của vùng chọn, xếp nhiều hàng nếu đụng nhau và chừa chiều cao trong câu. ResizeObserver/font/resize đo lại với so sánh snapshot để tránh render loop. Nhãn/editor là sibling ngoài paragraph tiếng Anh nên không tham gia offsets; editor/toolbar dùng portal và tọa độ viewport, theo scroll/resize.
- Review ẩn note mỗi câu mới; nút Hiện/Ẩn ghi chú độc lập phân tích. Tạo/sửa sẽ hiện note câu hiện tại; Practice/Saved hiện mặc định. Không đổi đánh giá, tiến độ, ghi chú cả câu hoặc khôi phục phiên Practice tạm.
- Đã đạt: `sentence-notes` **5 test**, underline **49**, auto-sync **18**, Grammar sentence **7**, reading-items **4**, Grammar sync **19**; cả `underline-rendering` và `sentence-notes-browser` đạt trên Edge headless. Browser note test gồm DOM selection qua underline/Unicode/cụm lặp, typing liên tiếp, tạo/sửa/clear/delete/Escape/outside, nhãn chồng/wrap, editor đang resize/scroll, ẩn/hiện Review, giữ assessment, cùng AI id không dùng chung note, lưu câu/chuyển tab/kết thúc phiên/reload/reopen, chặn anchor cũ khi câu đổi. Kiểm tra bbox không chồng nhãn/chữ và nhãn nằm trong chiều cao đã chừa. Đã xem ảnh desktop và viewport 375px; thêm kiểm tra 320px.
- Build thư mục tạm đạt, lint exit 0 chỉ còn cảnh báo có sẵn (không cảnh báo mới ở code note). Tests dùng dữ liệu/browser context riêng, chặn mọi request ngoài localhost và giả lập cloud offline. Chạy browser note bằng `node test/sentence-notes-browser.test.js` với thiết lập Playwright/Edge ở mục 7; không sửa dependency dự án.
- Giới hạn kiểm tra: chưa thao tác kéo chọn/touch/bàn phím ảo trên điện thoại thật, chưa kiểm tra Safari/Firefox hoặc hiệu năng câu cực dài. Nội dung ghi chú chỉ local theo trình duyệt/origin hiện tại; **không có cloud sync, không cần cập nhật Apps Script**. Không commit, push hoặc deploy.
