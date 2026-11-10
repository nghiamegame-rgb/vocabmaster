# Bàn giao workspace VocabMaster

**Mới nhất: 2026-11-04 — sửa incident Vocabulary sync, xem mục 13 và [runbook phục hồi](VOCABULARY-RECOVERY.md). Chưa deploy; không mở client production để thử.**

**Bổ sung mới nhất: 2026-11-04 — badge phân loại ngữ pháp trên Practice/Saved/Review, xem mục 12; Excel + Prompt ở mục 11.** Các mục cũ dưới đây giữ làm lịch sử bàn giao.

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

## 9. Thu gọn UI ghi chú dưới câu — 2026-11-03

- HEAD đầu việc `00bf997`, working tree sạch. Chỉ đổi trình bày trong `UnderlinedSentence.jsx` và `sentenceGeometry.js`, không đổi storage/schema/store/editor hoặc dữ liệu hiện có.
- Nhãn bỏ quote tiếng Anh/arrow, nền thường trực và viền trái; chỉ còn nội dung note 12px, line-height 16px, xám sáng, có hover/focus nhẹ. Giữ title/aria-label chỉ rõ phrase để truy cập và click sửa. Dùng width max-content với max 320px/100% container, đo cả width/height thực tế từ DOM, căn giữa theo rect dòng cuối của vùng chọn rồi clamp. Khoảng dưới chữ đo thực là 6px, gap giữa nhãn/hàng 6px; chỉ thêm hàng nếu có va chạm và chừa chiều cao đúng nhãn thực.
- Hiện/Ẩn ghi chú chuyển sang control area flex-wrap góc phải phía trên English, có khoảng riêng trong flow. Khi ẩn/bỏ note, padding annotation về 0. Editor vẫn 180–320px, grow theo nội dung và autosave; note display thu lại ngay khi text ngắn đi, kể cả editor còn mở. Không thay visibility mặc định Review/Practice/Saved hoặc assessment/analysis.
- Test đạt: notes **6**, underline **49**, Grammar sentence **7**; `sentence-notes-browser` và `underline-rendering` trên Edge headless đều đạt. Ca “educational materials” xác minh “giáo dục”/“vật chất” cùng hàng, rộng <100px, căn giữa, gap 5–7px, không header/card; hover/keyboard focus và label truy cập còn đúng. Cũng kiểm tra long text wrap không cắt, overlap chỉ dùng 2 hàng khi cần, hide trả spacing một dòng, kích thước cập nhật ngay, layout ổn định qua nhiều frame, control có hàng riêng, viewport 375/320px không tăng scroll ngang vì note.
- Đã xem screenshot acceptance desktop và 375px cùng ảnh note dài trên màn hẹp; browser fixtures/network được cô lập. Build thư mục tạm thành công; lint exit 0 còn cảnh báo có sẵn, không cảnh báo mới ở hai file đổi UI. Chưa kiểm tra touch/keyboard ảo trên thiết bị thật hoặc Safari/Firefox. Không cần cập nhật Apps Script; không commit, push, deploy.

## 10. Prompt theo hai kho dữ liệu — 2026-11-03

- Working tree sạch lúc bắt đầu; đã đọc mã nguồn và flow sync/ID. Thay bộ gợi ý cố định + lịch sử 50 câu bằng `grammarCorpus.js`: trích riêng `words[].english`, câu đã lưu (v2/legacy) và câu nhập tạm trong lần mở Grammar. Saved/Review không phải hai kho riêng. Practice giữ các bộ đã nhập qua subtab trong state, không persist lịch sử học; rời module/reload mất câu chưa lưu và UI giải thích rõ. Key lịch sử cũ được giữ nguyên nhưng không còn đọc/ghi.
- Payload đúng `{vocab: [[english, count]], grammar: [sentence]}`. Count là số câu riêng biệt chứa mục, trên toàn kho không lọc chủ điểm; dedup NFKC, case, whitespace, smart quotes/hyphens và dấu kết câu. Regex ranh giới Unicode chống art/department; hỗ trợ cụm qua whitespace/comma/hyphen, giữ contraction, không khớp xuyên dấu kết câu. Legacy chỉ thay một `_____` bằng option có answer A/B/C/D và nội dung rõ ràng; không đọc distractors, dịch, ví dụ/notes. Bản ghi không khôi phục được hoặc thiếu tiếng Anh báo số lượng và khóa tạo/copy thay vì âm thầm bỏ.
- Khảo sát package/source không có thư viện lemmatizer. Chọn **exact matching bảo thủ**, không cắt hậu tố, không tự gộp purchase/purchased/purchasing, go/went hay educate/education/educational. Giới hạn được ghi trong UI và prompt. Không tuyên bố hỗ trợ đầy đủ hình thái; 0 không chứng minh không có dạng biến đổi. Không thêm dependency.
- Snapshot clone nằm ở Grammar, ID chỉ đổi khi tạo bộ mới/quay từ kết quả sang bộ mới. Copy/Xem cùng nội dung, cấu hình số câu/chủ đề vẫn theo lựa chọn. Nguồn thay đổi sau import/GET/thêm từ/bỏ lưu → stale, khóa copy đến khi tạo snapshot mới. UI hiển thị số mục/câu/ký tự, tình trạng cloud, kho trống và lỗi clipboard. Không cắt danh sách hay đoán giới hạn context của AI bên ngoài.
- Prompt yêu cầu ưu tiên count thấp/0, chỉ Vocabulary làm nguồn từ mục tiêu, cho phép từ thông dụng để tạo câu tự nhiên, tránh lặp câu/ý/tình huống trong kho và trong bộ mới. Dữ liệu là tham chiếu, count không phải mastery. Giữ VSTEP B1 và schema v2, không API AI mới. Không hứa loại trùng ngữ nghĩa hoàn toàn.
- Import dùng toàn corpus mới nhất, kiểm tra lại khi xác nhận. Nếu cloud vừa thêm câu trùng trong lúc panel đang mở, cập nhật danh sách và bỏ xác nhận cũ để người dùng xem lại. Trùng trong bộ chặn và giữ JSON để sửa; trùng một phần/toàn bộ với kho cần xác nhận, không tự cắt câu hợp lệ. `validateGrammarJSON` dùng chung normalization với import/corpus.
- Đã đạt: corpus **5**, import **7**, sentence **7**, reading-items **4**; auto-sync **18**, sync **19**, sentence-notes **6**, underline **49**. Browser mới `grammar-corpus-browser.test.js` chạy App thật trên Edge: copy=preview, subtab ổn định, config/topic, import trùng, cloud thêm duplicate giữa bước kiểm tra/xác nhận, count cập nhật sau import, clipboard lỗi, không đổi review/marks/notes và không ghi history cũ. Viewport desktop/375/320px không overflow ngang; đã xem ảnh desktop/mobile. Cả `underline-rendering` và `sentence-notes-browser` đạt. Network/mock và LocalStorage đều thuộc context riêng, không dùng dữ liệu học thật.
- Build vào thư mục tạm đạt; lint exit 0, còn cảnh báo có sẵn (không cảnh báo trong các file chức năng được sửa). Không có script typecheck trong dự án JavaScript. Không thay store/schema/sync/Apps Script/proxy/deployment; không commit/push.
- Giới hạn: chưa chạy AI bên ngoài để đánh giá chất lượng câu, chưa xác minh sync production, Safari/Firefox hoặc thiết bị touch thật. Không thêm kiểm tra gần trùng/ngữ nghĩa. Browser clipboard dùng stub để đối chiếu toàn chuỗi và mô phỏng lỗi quyền; không chứng minh quyền clipboard trên mọi trình duyệt. Kho cực lớn chưa benchmark tới giới hạn bộ nhớ trình duyệt.

Chạy test browser mới với `PLAYWRIGHT_MODULE`/Edge giống mục 7: `node test/grammar-corpus-browser.test.js`. Các test logic: `node --test test/grammar-corpus.test.js test/grammar-import.test.js test/grammar-sentence.test.js test/grammar-reading-items.test.js`.

## 11. Excel + Prompt cho AI bên ngoài — 2026-11-04

- Working tree sạch khi bắt đầu. Thêm panel **Xuất Excel + Prompt** trong Grammar Practice, giữ luồng prompt thuần hiện có. `grammarExport.js` tạo một snapshot của toàn bộ `words` + `savedQuestions` và cấu hình count/topic; **không** lấy câu nhập tạm. Câu tạm vẫn thuộc corpus kiểm tra trùng của importer, kể cả kiểm tra lại lúc xác nhận. Không sửa backend, giao thức sync, schema lưu hoặc tiến độ học.
- File `.xlsx` đúng hai sheet: `Vocabulary!A1 = English`, `Grammar!A1 = Sentence`; mỗi dòng chỉ một ô tiếng Anh. Không có bản dịch, annotation, notes, underline, ID, ngày, level, thống kê hoặc sheet metadata riêng. Dùng `write-excel-file ^4.1.1` (một dependency trực tiếp mới, phụ thuộc `fflate`), import động nhánh `universal` để tạo Blob local. Không gọi endpoint khi tạo/tải file. Sheet giữ Unicode/dấu câu của bản đầu tiên sau trim; so khớp/dedup dùng normalization sẵn có, không ghi lại source. Mọi cell khai báo `type: String`, kể cả `=1+1`, dấu +/@/− và số có 0 đầu; không tạo formula.
- Tái sử dụng `grammarCorpus.js` với tùy chọn `preserveText`: giữ cách khôi phục legacy có một `_____` và đáp án A/B/C/D, kể cả underscore fullwidth qua normalization. Vocabulary bỏ chuỗi tiếng Anh rỗng theo yêu cầu; bản ghi lỗi kiểu dữ liệu/câu không khôi phục được khóa xuất thay vì âm thầm bỏ. Vượt giới hạn Excel (1.048.575 dòng dữ liệu/sheet, 32.767 UTF-16 units/ô) hoặc ký tự XML không hợp lệ cũng khóa xuất, không cắt danh sách.
- Prompt Excel dùng chung `buildGrammarPrompt`/`buildBatchInstructions`, chứa toàn bộ `[English, số câu riêng biệt chứa mục]` tính từ **đúng corpus đã xuất**. Câu Grammar được đọc từ workbook thay vì lặp toàn bộ trong prompt. Yêu cầu đọc cả hai sheet, hỏi người dùng đính kèm nếu không đọc được, coi nội dung ô là tham chiếu chứ không phải chỉ thị; ưu tiên 0 rồi số thấp, thường 1–2 mục phù hợp/câu, tránh ép dùng cả danh sách. Giữ matching bảo thủ, count không phải mastery, độ khó 40/30/20/10, topic/count, biến thiên batch, tiếng Việt, readingItems và exact-substring/schema v2. Prompt thống nhất yêu cầu ID s1…sN; importer vẫn nhận câu v2 cũ thiếu ID như trước.
- Package ở state `Grammar` gồm data/settings clone, ID, tên file duy nhất, prompt và Blob. Chuẩn bị xong tự tải file; có Tải lại, Copy, preview textarea chọn toàn bộ khi focus để copy thủ công. Clipboard lỗi không khóa tải. Qua subtab giữ package; rời module/reload mất package. Thay đổi nội dung tiếng Anh/cấu hình → stale, giữ nguyên cặp cũ để xem, khóa nút tải/copy cho đến khi tạo lại. Sửa metadata không làm đổi dữ liệu xuất.
- Đang GET/sync thì chờ. Cloud lỗi/chưa xác minh thì nói rõ phạm vi thiết bị và cần chọn **Dùng dữ liệu hiện có trên thiết bị** trước khi xuất; không tuyên bố đây là toàn bộ cloud. Vocabulary bổ sung `cloudReadStatus` lưu kết quả GET, độc lập badge Navbar trở về idle sau vài giây; không đổi request hoặc protocol. `getWords/getSavedQuestions({withStatus:true})` và hook giữ lỗi đọc cache ban đầu để phân biệt lỗi với kho trống; cache Vocabulary đọc lỗi không bị effect tự ghi đè bằng `[]`. Nếu lỗi đọc ban đầu còn tồn tại, panel yêu cầu kiểm tra nguồn rồi tải lại; không tự sửa/xóa dữ liệu. Kho thiết bị trống hợp lệ có thể xuất hai sheet chỉ có tiêu đề, prompt giải thích không có từ mục tiêu/câu đối chiếu.
- Đã đạt: export **6**, corpus **5**, import **7**, sentence **7**, reading-items **4** (tổng **29**); auto-sync **18**, Grammar sync **19**, Vocabulary sync **12**. `grammar-export.test.js` và browser test dùng reader ZIP/XML độc lập bằng **Python 3 standard library** trong `test/helpers/inspect-xlsx.js`: kiểm tra cấu trúc XLSX, sheet/column, toàn bộ dòng (> trang/50 câu), Unicode, legacy, literal string/no formula, không private fields, counts, snapshot/config và cache lỗi. Không cần thêm dependency test Python.
- Browser `grammar-export-browser.test.js` chạy App thật/Edge: tải và đọc file thực, tên file khớp prompt, tải lại, clipboard lỗi/manual selection, đổi count/topic, import chưa lưu không vào Excel, lưu câu làm stale/cập nhật count, GET mới làm stale, kho trống/cache hỏng/không đọc được, giữ review/underlines/notes/words. Network được mock/chặn ngoài localhost, storage/context riêng. `grammar-corpus-browser` vẫn đạt luồng prompt/import hiện có. Viewport 1280/375/320px không overflow ngang; đã xem screenshot desktop và 320px của panel.
- Build vào thư mục tạm đạt; lint exit 0 chỉ còn cảnh báo có sẵn, không có cảnh báo ở code export mới; `git diff --check` đạt. Không commit/push/deploy; không truy cập dữ liệu học thật hoặc ghi production.
- Giới hạn: file đã được tạo và đọc ZIP/XML độc lập, chưa mở trong ứng dụng Excel desktop/Safari/Firefox hoặc thử touch thật; chưa dùng AI bên ngoài để đánh giá chất lượng output. Không tự phát hiện paraphrase/ngữ nghĩa; chưa benchmark kho cực lớn. Các giới hạn sync cũ vẫn giữ nguyên. Chạy browser mới với thiết lập Playwright/Edge tại mục 7: `node test/grammar-export-browser.test.js`; test file cần `python` trong PATH: `node test/grammar-export.test.js`.

## 12. Hiện phân loại câu trước khi mở phân tích — 2026-11-04

- Working tree sạch lúc bắt đầu. Xác minh Saved lấy nhãn từ **`q.topic`**, dịch qua `TOPIC_LABELS/getTopicLabel`; `analysisTopic` và cấu hình phiên chỉ lọc lời giải, không phải nguồn badge. Thêm `grammarTopic.js::getSentenceTopicLabel` + `GrammarTopicBadge.jsx` dùng chung cho Saved và `GrammarSentenceCard` (Practice/Review). `topic` hợp lệ giữ nhãn Việt hiện có, kể cả **Mixed → Tổng hợp**; thiếu/không đúng khóa/không phải string → **Chưa phân loại** màu slate, không rơi về analysisTopic và không suy luận từ câu. Tìm kiếm/chọn chủ đề và dòng chủ đề legacy cũng dùng nhãn an toàn, tránh lỗi với topic object hoặc tên thuộc prototype.
- Badge nằm trong card phía trên English, bên trái, kiểu tím như Saved; hàng flex-wrap/max-width cho màn hẹp, tách khỏi vùng English/selection và hàng nút ghi chú. Badge luôn hiện, không phụ thuộc phân tích/notes; nhận question hiện tại nên đổi ngay khi trước/sau/chọn số câu. Không sửa prompt, importer, schema, store, sync, records, note/underline/autosave, review assessment hoặc visibility.
- Đạt: `grammar-topic` **2**, Grammar sentence **7**, notes **6**, underline utility **49**; browser mới `grammar-topic-browser` kiểm tra import chưa lưu trong Mixed batch, topic từng câu/Mixed thật, trước/sau/số câu, lưu rồi so nhãn ba màn, Review legacy/thiếu/lỗi, note toggle/underline và giữ dữ liệu. Edge 1280/375/320px không overflow, badge ở trên English và không đè nút notes; đã xem ảnh desktop Practice và 320px Review. Browser `underline-rendering` và `sentence-notes-browser` chạy lại để kiểm tra thao tác chọn đoạn/autosave. Build thư mục tạm/lint/diff-check đạt; còn cảnh báo lint có sẵn. Test dùng context/storage/network giả lập, không truy cập dữ liệu thật/production.
- Chạy mới: `node test/grammar-topic.test.js`; `node test/grammar-topic-browser.test.js` với thiết lập Playwright/Edge ở mục 7. Chưa kiểm tra Safari/Firefox hoặc thao tác touch trên điện thoại thật. Không commit/push/deploy.

## 13. Incident Vocabulary: chống hồi sinh cache cũ — 2026-11-04

- Working tree sạch lúc bắt đầu. Đọc AGENTS/context/handoff, hook/storage/cloud/config/backend cùng helpers Grammar/Structures. Root cause đã xác minh: union local-only lúc startup/hard-sync tự POST lại full list; backend legacy không CAS/epoch/deletion; count-only verification, không push empty. Không gọi production.
- `vocabSync.js` là state machine thật được hook dùng: base+words persist, backup đầu phiên và riêng mỗi phiên, archive conflict/legacy, three-way merge với deletion wins. Legacy/khác generation chỉ adopt sau backup, không auto seed. Offline cùng generation giữ additions/sửa khác record; conflict cùng record giữ cloud và lưu bản local để chọn lại. Pause hủy timer/abort/bỏ response cũ, kiểm lại ngay trước POST; online/focus/manual retry. Default paused, UI pause/export riêng Vocabulary. UUID thay Date.now cho word ID tránh trùng khi import nhanh. Grammar/Structures không đổi.
- Proxy mới `api/vocab-sync.js`, endpoint config cùng origin. Server env `VOCAB_APPS_SCRIPT_URL`, `VOCAB_SYNC_SECRET`, `VOCAB_WRITES_ENABLED`; thiếu true thì chặn POST. ACK kiểm requestId/generation/revision+1 và toàn bộ nội dung, bỏ opaque/count-only. Backend luôn reject legacy; ScriptLock/CAS/tombstone invariants/confirmEmpty.
- Backend dùng snapshot JSON Drive bất biến, HEAD Script Property là commit point, Sheet đầu tiên là mirror. Backup file cũ giữ nguyên; lỗi trước commit không mất canonical state, mirror repair riêng khi paused. Restore editor-only yêu cầu file sạch/hash đã xác nhận + pause, tạo generation mới/revision 0. Quyết định này tránh coi multi-cell Sheet rewrite là transaction; đổi quyền Drive và cách restore được nêu rõ trong runbook. Không tự seed từ Sheet/cache.
- Triển khai bắt buộc: giữ tất cả tab đóng → backup mixed + clean → cập nhật/disable **mọi URL Apps Script cũ**, pause và drain execution legacy → deploy proxy/client vẫn khóa → restore file người dùng xác nhận/advance generation → mở từng client mới để adopt/backup → staging stale-device đạt → resume backend rồi proxy rồi từng client. Abort không thu hồi request đã đến server; code legacy đang chạy không tuân lock mới. Chi tiết/các hàm/property nằm trong runbook.
- Chưa có snapshot sạch được cung cấp/xác minh. Cần JSON Word đầy đủ hoặc bản Sheet/CSV/XLSX sạch đủ cột + xác nhận người dùng; không suy đoán TOEIC theo tuổi/vị trí/nghĩa, không dựng từ ảnh. Không dùng Excel + Prompt làm backup phục hồi.
- Test mới `test/vocab-sync.test.js` thay test sao chép merge cũ: 16 ca chạy engine thật, Apps Script thật trong VM với Drive/Sheets/Lock giả, proxy giả. Bao gồm 614 legacy, generation cũ/pending, stale/legacy write reject, tombstone/final deletion, offline/concurrent edits, conflict archive, GET/ACK/network lỗi, edits during POST, pause queue, recovery race, commit failure, hash confirmation, storage quota và proxy containment. Lock giả kiểm đường xử lý tuần tự; không chứng minh độ trễ/quota/atomicity dịch vụ thực.
- Regression đã đạt: annotation 44, word-selection 12, Vocabulary SSR 6, Grammar auto-sync 18, Grammar sync 19, Structures 8, Structures backend 5, Grammar export 6, notes 6, underline 49. Node test runner báo 53 subtests/file wrappers; một số script tự đếm bên trong. Build thư mục tạm đạt, lint exit 0 còn cảnh báo có sẵn; không sửa Grammar/Structures. Browser test mới và kiểm tra cuối được ghi tiếp bên dưới.
- Giới hạn: proxy chưa có user authentication riêng; backup Drive/local tích lũy và cần quản lý quota. Pending tab khác/generation cũ ở archive phải chọn lại thủ công; không có UI giải quyết conflict tự động. Không coi mock ACK là chứng minh deployment, quyền Drive, redirect/CORS hoặc sync điện thoại thật. Không commit/push/deploy, không sửa Sheet hoặc dữ liệu browser thật.

- Kiểm tra cuối: **20/20** ca Vocabulary đạt (thêm CAS conflict thực tế giữa hai client, response mất sau commit, cache hỏng, cloud adapter thật). Browser `vocab-sync-browser.test.js` chạy App/StrictMode trong Edge với network/storage cô lập: cache 614 nhận snapshot sạch không POST, backup tải được chứa mục cũ, xóa cuối, pause trước debounce, pending qua reload, POST lỗi, generation đổi khi có pending, giữ nguyên khóa Grammar/Structures/notes/underlines/stats. Khối control sync vừa 375px; phát hiện form Vocabulary cũ tràn ngang, chưa sửa form trong phạm vi này. Navbar thu spacing mobile/toast wrap để trạng thái lỗi sync lâu dài không đẩy nút Sync ra khỏi màn hình.
- `grammar-export-browser.test.js` cập nhật mock Vocabulary sang protocol 1/cùng origin, không còn giả định webhook absolute/GET data legacy. Build cuối vào thư mục tạm đạt; lint exit 0, không cảnh báo ở code Vocabulary mới (Apps Script entry points có chú thích lint vì được runtime/editor gọi). `git diff --check` đạt. Chạy browser như HANDOFF mục 7 với PLAYWRIGHT_MODULE và Edge. Chưa test Apps Script/Drive/Vercel thật, touch/Safari/Firefox; staging là bước bắt buộc trước resume trong runbook.
- Browser regression `grammar-export-browser.test.js` đã đạt: XLSX tải/đọc thật, loading/offline/empty/corrupt stores, snapshot/copy, bảo toàn dữ liệu và desktop/375/320px. Không truy cập production. PROJECT_CONTEXT mục 7 đã thay mô tả Vocabulary bằng protocol hiện tại; các đoạn khảo sát lịch sử khác vẫn cần đối chiếu HANDOFF/runbook.

## 6. Cập nhật 2026-11-09: Grammar prompt nhắm B1–B2 (thay chính sách B1-only trước đó)

- Chính sách hiện tại trong `grammarPrompt.js::buildGrammarPrompt` (đường chung cho Copy Prompt, xem trước, Excel + Prompt qua `grammarExport.js::prepareGrammarExport`): khoảng 70% B1 / 30% B2 (`Math.round(count*0.7)` B1: 5→4/1, 10→7/3, 15→11/4, 20→14/6), dễ trước khó sau, cấm cố ý C1. Cho phép cấu trúc B2 thông dụng (bị động, rút gọn, điều kiện loại 2/3, đảo ngữ/câu chẻ thông thường…); các loại trừ cứng của bản B1-only đã gỡ, chỉ giữ hạn chế thực tế với câu quá cầu kỳ/lồng sâu. Self-check cuối khớp.
- `grammarBatch.js::buildBatchInstructions` (cập nhật 2026-11-09, chính sách lặp): ưu tiên ngữ pháp B1–B2 phổ biến, hữu ích; tính quen thuộc/hữu ích đứng trước tính mới. Cho phép lặp có chủ đích (đổi mục đích giao tiếp, cách dùng, cấu trúc hoặc ngữ cảnh), không bắt mỗi câu có mẫu mới, không đặt quota mẫu chưa gặp. Ưu ái nhẹ mẫu thiếu/ít gặp chỉ trong nhóm mẫu phổ biến B1–B2; cấm săn mẫu hiếm/văn chương/cầu kỳ hay nâng độ khó để tránh trùng. Không khẳng định tần suất thống kê trong đề VSTEP. Câu tham chiếu chỉ để kiểm tra trùng/độ phủ, không chứng minh đã thành thạo, không làm mẫu độ khó. Mục tự kiểm tra số 5 khớp. Chưa đánh giá câu AI sinh thật.
- Giữ nguyên JSON schema v2, topic key, logic chọn/đếm Vocabulary, export, import legacy, dữ liệu đã lưu/cloud/underline.
- Gói Excel đã chuẩn bị trong phiên mở trước cập nhật mã vẫn mang prompt cũ (cơ chế stale chỉ theo dữ liệu/cấu hình); bấm Tạo lại. Reload là dùng prompt mới.
- Kiểm tra: `node test/grammar-b1-prompt.test.js` (tên file giữ lại; đã viết lại cho B1–B2: 5/10/15/20 × mọi topic + Excel, tỉ lệ, không còn cụm B1-only/C1), `grammar-import/reading-items/export/sentence/corpus` pass; lint 0 lỗi; build pass. Chỉ kiểm chữ trong prompt, chưa đánh giá câu AI sinh thật; chưa chạy test Playwright.
- Cập nhật 2026-11-09 (chính sách từ vựng): từ trong Vocabulary vẫn là mục tiêu ôn bình thường (logic chọn/đếm, ưu tiên count 0 rồi thấp không đổi), kể cả từ học thuật/chuyên ngành. Từ ngoài danh sách do AI chọn phải quen thuộc, hữu dụng (khoảng A2–B1), chọn cách nói quen thuộc hơn khi cùng nghĩa, không thay từ kỹ thuật bằng từ đồng nghĩa sai, ngữ cảnh quá khó thì chọn ngữ cảnh đơn giản hơn; ngữ pháp B2 không kéo theo từ khó. `readingItems` không được thêm từ lạ chỉ để có nội dung (mảng rỗng vẫn được). Nằm trong `buildBatchInstructions` (khối SUPPORTING VOCABULARY), dòng readingItems và mục tự kiểm tra số 6 của `buildGrammarPrompt`. Chỉ kiểm chữ trong prompt, chưa đánh giá câu AI sinh thật.

## 14. Đánh dấu sao từ khó (⭐) cho Vocabulary và bộ lọc luyện tập — 2026-11-11

- **Trạng thái dữ liệu (`hardMarked`):** mỗi bản ghi Vocabulary có thể mang `hardMarked: true` khi người dùng đánh dấu từ khó; khi bỏ đánh dấu hoặc với từ cũ/legacy thì lược bỏ thuộc tính `hardMarked` để giữ nguyên dạng chuẩn (`canonical`) của bản ghi chưa đánh dấu, không tạo diff giả khi đồng bộ.
- **Độc lập với tiến độ học:** `useVocabStore::toggleWordHard` chỉ bật/tắt `hardMarked`, không chạm `level`, `currentStreak`, `lastReviewedDate` hay `vocabmaster_stats`. Sửa từ (`updateWord`), chấm đúng/sai (`updateWordLevel`) và đổi cấp hàng loạt (`bulkUpdateLevel`) đều giữ nguyên `hardMarked`. Xuất/nhập JSON (`Vocabulary::handleExport/handleImport` qua `addWord`) bảo toàn `hardMarked: true`. Xuất Excel tối giản trong Grammar (`Vocabulary/English`, `Grammar/Sentence`) và `grammarCorpus.js` giữ nguyên một cột tiếng Anh, không xuất sao hay metadata.
- **UI Vocabulary (`Vocabulary.jsx`):** thêm nút ngôi sao trên mỗi `WordCard` (`#star-<id>`, `aria-label`/`title` `"Đánh dấu từ khó"` / `"Bỏ đánh dấu từ khó"`, `aria-pressed`), viền vàng nhạt khi được đánh dấu, hoạt động độc lập không mở form sửa/chọn thẻ/phát âm. Thêm nút lọc **`Khó ⭐`** (`#filter-hard-only`) giao chặt (intersection) với bộ lọc cấp L1–L5, loại từ và ô tìm kiếm; số đếm trên mọi pill và phân trang khớp tập lọc thực tế, có trạng thái trống tiếng Việt rõ ràng.
- **Bộ lọc luyện tập tùy chọn (`Chỉ từ khó ⭐`, mặc định tắt):**
  - **Flashcard (`Flashcard.jsx`):** nút `#flashcard-hard-toggle` giao chặt với cấp và loại từ; bộ đếm trên mọi nút lọc và `in pool` khớp nhau; dọn timer chuyển thẻ khi đổi bộ lọc/unmount và khóa bấm đúp trong 200ms lật thẻ. Không tự động lùi về từ không sao khi tập lọc rỗng.
  - **Listening (`ListeningReview.jsx`):** công tắc `#lr-hard-toggle` giao chặt với Level, Type và Due for Review; bỏ cơ chế âm thầm lùi về toàn bộ kho khi `< 4` từ khớp (cả với `dueOnly` và `hardOnly`), hiển thị cảnh báo rõ số từ khớp hiện tại. Đổi bộ lọc hoặc bấm Skip/Next hủy timer tự chuyển vòng và dừng audio, không chấm hay cộng lượt cho câu bị bỏ dở; khóa nộp đúp bằng ref.
  - **Smart Quiz (`Quiz.jsx`):** nút `#quiz-hard-toggle` (trong nhánh Vocabulary) giao chặt với `Level Priority` và `Vocabulary Type`; bỏ fallback âm thầm về toàn bộ `words` trong `buildPool`. Khi `< 4` từ khớp, khóa `Copy AI Prompt` và giải thích rõ. Ghi chú rõ bộ lọc áp dụng khi tạo AI Prompt mới; khi `Chỉ từ khó ⭐` đang bật, `handleStart` kiểm tra các câu trong JSON dán vào phải thuộc tập từ khớp bộ lọc (chặn chạy nhầm đề không sao đã tạo từ trước với thông báo tiếng Việt rõ ràng). Khóa nộp đáp án trùng trong `QuizGame`.
- **Đồng bộ & backend (`vocabSync.js`, `google-apps-script.js`):**
  - `validateSnapshot` (client) và `vocabValidate` (Apps Script) kiểm tra `hardMarked` nếu có phải là boolean.
  - `reconcile(base, local, remote)` hợp nhất trực giao giữa `hardMarked` và các trường còn lại (`withoutStar`): một thiết bị bật/tắt sao trong khi thiết bị kia cập nhật tiến độ L1–L5/streak hoặc sửa nghĩa/ghi chú sẽ giữ cả hai thay đổi mà không tạo xung đột giả; xóa từ (`tombstones`) vẫn thắng tuyệt đối và lưu bản local vào `conflicts`.
  - `VocabSync.sync()` tự xóa thông báo lỗi mạng tạm thời (`"Vocabulary chưa đồng bộ: ..."`) đã lưu trong state khi lần sync kế tiếp thành công, trong khi vẫn giữ thông báo archive/xung đột cần người dùng xem lại.
  - **Tương thích triển khai:** Apps Script hiện tại lưu toàn bộ JSON snapshot lên Drive (`VOCAB_HEAD`) và chỉ kiểm các trường đã liệt kê nên bản triển khai hiện hành đã giữ `hardMarked: true` trong snapshot Drive; cập nhật `google-apps-script.js` bổ sung kiểm kiểu boolean chặt ở server khi người dùng triển khai lại sau.
- **Kiểm tra:** `node test/vocab-sync.test.js` (**22/22 đạt**), `node test/vocabulary-render.test.js` (**8/8 đạt**), `node test/word-selection.test.js` (**12/12 đạt**), `node test/grammar-export.test.js` (**6/6 đạt**), `node test/grammar-corpus.test.js` (**5/5 đạt**); browser Playwright/Edge `node test/vocab-star-browser.test.js` và `node test/vocab-sync-browser.test.js` đạt toàn bộ (kể cả kiểm tra không tràn ngang ở 1280px, 375px và 320px trên cả 4 tab Vocabulary, Flashcard, Listening, Smart Quiz). `npm.cmd run lint` (0 lỗi, không thêm cảnh báo mới) và `npm.cmd run build -- --outDir <thư-mục-tạm>` đạt. Chưa kiểm tra đồng bộ trực tiếp giữa hai thiết bị thật trên cloud production. Không commit, push hoặc deploy.
