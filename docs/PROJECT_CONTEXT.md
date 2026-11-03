# VocabMaster — ngữ cảnh dự án

**Cập nhật Vocabulary 2026-11-04:** giao thức cũ mô tả trong ảnh chụp bên dưới đã được thay ở working tree bởi protocol 1 (generation/revision/tombstone, snapshot Drive, proxy ACK đầy đủ, mặc định pause). [Quy trình phục hồi hiện tại](VOCABULARY-RECOVERY.md) và HANDOFF mục 13 là nguồn trạng thái mới; chưa triển khai production. Không áp dụng merge legacy/hard-sync/count verification trong các đoạn lịch sử cho code hiện tại.

Khảo sát ngày **2026-11-02** (Asia/Saigon), commit tham chiếu `4a4aff095591629029e9a2deb75ef7fd7cc8ccc6`. Tài liệu mô tả **working tree đang có thay đổi chưa commit**, không chỉ commit này. Danh sách thay đổi và kết quả kiểm tra nằm trong [HANDOFF.md](HANDOFF.md). Điểm vào bảo trì là [AGENTS.md](../AGENTS.md).

## 1. Mức độ xác minh

- **Mã nguồn:** các mô tả chức năng, giao diện, dữ liệu và sync bên dưới được đối chiếu với mã hiện có. Đường dẫn kèm component/hàm là nơi tra cứu.
- **Đã thực thi local:** 11 file test, lint và build; có test render React ra HTML tĩnh, mô phỏng hook/network/Apps Script. Chi tiết và giới hạn bằng chứng ở mục 8 và HANDOFF.
- **Chưa kiểm tra trong trình duyệt:** chưa mở phiên ứng dụng, chưa thao tác UI, nghe TTS, kiểm tra responsive hoặc LocalStorage thật. Bố cục mô tả bên dưới là từ JSX/CSS, không phải quan sát trực tiếp.
- **Chưa xác minh bên ngoài:** endpoint đang chạy, phiên bản Apps Script/Vercel đã triển khai, quyền truy cập, dữ liệu thật và đồng bộ nhiều thiết bị. Không gọi endpoint production trong khảo sát.

README hiện là mẫu React/Vite, không phải đặc tả sản phẩm. [GRAMMAR-VSTEP.md](../GRAMMAR-VSTEP.md) và [STRUCTURES-SYNC-SETUP.md](../STRUCTURES-SYNC-SETUP.md) cung cấp bối cảnh chuyên đề; cần đối chiếu mã. GRAMMAR-VSTEP hiện có đoạn đầu/cuối bị dở trong thay đổi sẵn có, đã giữ nguyên.

## 2. Sản phẩm và phạm vi VSTEP

VocabMaster hỗ trợ người học tiếng Anh dùng tiếng Việt tự xây thư viện từ/cụm từ, ôn bằng flashcard, nghe nhận diện hoặc gõ từ, tạo bài tập qua AI bên ngoài và lưu câu/cấu trúc để ôn. Mục tiêu người dùng là **VSTEP**, dù thư mục/package vẫn có tên `web toiec`/`web-toiec`.

| Phần | Trạng thái xác minh trong mã | Nơi tra cứu |
| --- | --- | --- |
| Grammar luyện mới | Câu hoàn chỉnh, phân tích ngữ pháp/đọc hiểu tiếng Việt; hướng tới VSTEP B1, có tiếp xúc B2/C1 | `Grammar.jsx` → `GrammarPractice`; `grammarPrompt.js::buildGrammarPrompt` |
| Vocabulary, Flashcard, Listening | Công cụ từ vựng dùng chung, có thể học từ VSTEP do người dùng nhập; không thấy bộ từ VSTEP tích hợp | `Vocabulary`, `Flashcard`, `ListeningReview` |
| Smart Quiz tiếng Việt → Anh | Prompt vẫn yêu cầu bối cảnh TOEIC | `Quiz.jsx::buildPrompt`, nhánh `vn` |
| Smart Quiz tiếng Anh | TOEIC Part 5 điền chỗ trống | `Quiz.jsx::buildPrompt`, nhánh `toeic` |
| Smart Quiz Grammar Structures | TOEIC Part 5 theo mẫu đã lưu, liên kết bằng ID | `structureQuiz.js::buildStructurePrompt` |
| Câu Grammar cũ | Giữ bản ghi A/B/C/D và lời giải TOEIC; hiển thị câu đã điền đáp án để đọc/ôn | `grammarSentence.js::getGrammarSentence`; `GrammarAnalysis` |
| Nhãn cũ | Dashboard còn mẹo TOEIC Listening; `index.html` còn meta mô tả TOEIC | `Dashboard`, `index.html` |

Chưa thấy module luyện thi VSTEP đầy đủ bốn kỹ năng, đề Reading theo passage, Writing/Speaking có chấm bài, thang điểm VSTEP hay đối chiếu đề thi chính thức trong cây nguồn đã đọc. Nhóm chủ đề Grammar là nhóm tự học, prompt cũng nói rõ không phải đề cương VSTEP chính thức. Đây là phạm vi triển khai hiện tại, không phải lộ trình đã được duyệt.

## 3. Kiến trúc và bản đồ file

Stack khai báo: React/React DOM 19, Vite 8, JavaScript/JSX ES modules, Tailwind CSS 4 qua plugin Vite, lucide-react. Lint dùng Oxlint. Không dùng router hay thư viện quản lý state ngoài React (`package.json`, `vite.config.js`, `.oxlintrc.json`).

```text
index.html                       # root + src/main.jsx; metadata còn TOEIC
src/
  main.jsx                       # createRoot, StrictMode, index.css
  App.jsx                        # activeTab, vocabFilter, 2 store ở cấp App
  components/
    Navbar.jsx                   # 6 tab; nút Sync chỉ dành Vocabulary
    Dashboard.jsx                # số từ, L5, Quiz accuracy, phân bố L1–L5
    Vocabulary.jsx               # CRUD, lọc/tìm, chọn hàng loạt, JSON, phân trang
    Flashcard.jsx                # thẻ hai chiều và tự đánh giá
    ListeningReview.jsx          # nghe → chọn ảnh hoặc gõ từ
    Quiz.jsx                     # cấu hình → prompt → JSON → game → kết quả
    Grammar.jsx                  # subTab, phiên câu, batch prompt, store Grammar
    grammar/
      GrammarPractice.jsx        # tạo prompt và nhập JSON có kiểm tra
      GrammarQuiz.jsx            # đọc từng câu, mở phân tích, lưu, tổng kết
      GrammarAnalysis.jsx        # GrammarSentenceCard + GrammarAnalysis
      GrammarReadingNotes.jsx    # readingItems, biểu mẫu + Vocab / + Structure
      GrammarSaved.jsx           # thư viện câu, sao, ghi chú, tìm/lọc
      GrammarReview.jsx          # hàng đợi ôn và tự đánh giá
      GrammarStats.jsx           # sentenceActivity + thống kê TOEIC cũ
      GrammarStructures.jsx      # kho mẫu cấu trúc, CRUD/import/export
      GrammarCloudSettings.jsx   # URL dùng chung cho câu Grammar/Structures
  hooks/
    useVocabStore.js              # từ, stats, streak và sync Vocabulary
    useGrammarStore.js            # câu, review, stats, underlines local, pending/revision
    useStructuresStore.js         # mẫu, sự kiện ôn, tombstone và sync riêng scope
  utils/
    storage.js, cloud.js, annotation.js, audio.js, wordSelection.js
    grammarStorage.js, grammarCloud.js, grammarSyncMerge.js
    grammarPrompt.js, grammarSentence.js, grammarReadingItems.js
    grammarImport.js, grammarBatch.js
    structureStorage.js, structureCloud.js, structureQuiz.js
  config.js                      # WEBHOOK_URL Vocabulary; không chép giá trị ra docs
api/grammar-sync.js               # Vercel proxy server-side
google-apps-script.js             # backend tham chiếu Vocabulary
grammar-apps-script.js            # backend câu Grammar và Structures
test/                            # 11 script test local
```

Luồng state: `main.jsx` → `App`. `App` giữ `useVocabStore` và `useStructuresStore`, truyền state/action xuống qua props. Chỉ khi tab Grammar được render, `Grammar` mới mount `useGrammarStore`. Chuyển tab lớn unmount màn đang học, làm mất cấu hình/phiên tạm của màn; hai store cấp App còn sống. Chuyển subtab Grammar giữ batch ID/cấu hình ở `Grammar`, nhưng xóa session hiện tại (`setSession(null)`). Không có đường dẫn URL riêng hay khôi phục phiên học sau reload (`App`, `Grammar`).

## 4. Màn hình và luồng học

Bố cục từ mã: nền slate tối, thanh nav cố định phía trên, nội dung giữa trang rộng tối đa `max-w-7xl`, nhiều thẻ bo góc. Nhãn tab bị ẩn trên màn nhỏ, còn icon; các grid có breakpoint responsive. Màu/trạng thái sync hiển thị ở Navbar hoặc bên trong module tương ứng (`Navbar`, `App`, `src/index.css`).

### Dashboard và Vocabulary

- `Dashboard`: tổng từ, từ L5, độ chính xác và số câu Smart Quiz Vocabulary; thanh L1–L5 có thể bấm để sang Vocabulary kèm bộ lọc. Không tổng hợp tiến độ Grammar hoặc Structures.
- `Vocabulary`: thêm tiếng Anh, nghĩa Việt, annotation, URL ảnh, loại Word/Phrase/Family/Preposition; sửa/xóa từng thẻ, phát âm, tìm theo tiếng Anh/nghĩa/annotation, lọc loại và cấp. Phân trang 24 mục. Chọn tất cả áp dụng toàn bộ tập đang lọc, không chỉ trang hiện tại; đổi cấp hàng loạt reset streak (`Vocabulary::toggleSelectAll`, `handleBulkChangeLevel`; `useVocabStore::bulkUpdateLevel`).
- JSON: xuất toàn bộ `words`; nhập thêm từ chưa có theo tiếng Anh, không thay cả kho. Import UI đi qua `addWord`, có giới hạn phục hồi metadata nêu ở mục 9 (`Vocabulary::handleExport/handleImport`). Hàm hook `importWords` thay toàn bộ kho tồn tại nhưng App không nối nó với UI import.

### Flashcard và Listening

- `Flashcard`: chọn Anh → Việt hoặc Việt → Anh, lọc cấp/loại, lật thẻ rồi đánh dấu nhớ/cần ôn; mỗi đánh giá cập nhật Vocabulary. Ưu tiên cấp thấp rồi streak thấp, né tối đa 8 ID gần nhất nếu có thể. Không chọn trực tiếp bằng ngày đến hạn (`Flashcard::advanceToNext/handleNext`; `wordSelection.js::pickNextWord`).
- `ListeningReview`: cần ít nhất 4 từ trong tập lọc, tự phát âm từ mục tiêu, chọn một trong 4 thẻ ảnh hoặc gõ đúng từ; có nghe lại, gợi ý và bật/tắt nghĩa, bỏ qua. Gõ khớp sau trim/lowercase tự chấm đúng; chọn sai làm giảm cấp từ mục tiêu ngay. Nút tiếp/bỏ qua không chấm. Chỉ dùng tập đến hạn nếu còn đủ 4 từ; thiếu thì dùng tập lọc rộng hơn. Điểm phiên ở component, không cộng `stats` Dashboard (`handleTypingChange`, `handleCardClick`, `handleNext`, `filteredPool`).
- Audio: `audio.js::playAudio` ưu tiên giọng Web Speech en-US/en-GB, rate 0.9; dự phòng Google TTS. `ListeningReview::getImageUrl` và `QuizGame` dùng ảnh theo URL hoặc dịch vụ ảnh bên ngoài. Khả năng phát âm/tải ảnh thật chưa xác minh.

### Smart Quiz

`QuizConfig` chọn 5/10/15/20 câu, Easy/Medium/Hard, chế độ `vn`/`toeic`/`structure`. Với Vocabulary, chọn loại/cấp ưu tiên và trắc nghiệm hoặc nghe-gõ; cần ít nhất 4 từ. Structures chọn mẫu đã lưu, không cần bốn từ Vocabulary; UI dùng trắc nghiệm cho nhánh này. Copy prompt sang AI → dán JSON → `parseResponse` → `QuizGame` → `QuizResults`.

Vocabulary chọn đáp án/gõ từ rồi chấm. Lần sai đầu chỉ gắn cảnh báo và chèn câu kiểm tra lại; chưa giảm cấp. Kiểm tra lại đúng tăng streak và sửa lượt sai trong tally; sai lần nữa mới giảm một cấp. Vì có kiểm tra lại, tally không nhất thiết tương ứng số câu ban đầu. Khi kết thúc, `handleFinish` cộng thống kê Vocabulary; bỏ phiên giữa chừng không tổng kết. Nhánh Structures ghi một sự kiện đúng/sai vào store Structures ngay mỗi đáp án, không dùng cơ chế tha lỗi này và không cộng stats Vocabulary (`QuizGame::grade`, `Quiz::handleFinish`).

### Grammar VSTEP

Các subtab: **Luyện tập, Câu đã lưu, Ôn tập, Thống kê, Structures**, kèm panel Cloud.

Từ 2026-11-04, Practice/Saved/Review dùng chung `GrammarTopicBadge` ngay phía trên English, luôn hiện khi phân tích/notes đang ẩn. Nhãn từ **topic của từng bản ghi** qua `grammarTopic.js` và bảng tiếng Việt hiện có; không lấy `analysisTopic`, chủ đề bộ Mixed hay bộ lọc phiên để ghi đè. Mixed lưu thật → Tổng hợp; thiếu/không hợp lệ → Chưa phân loại màu trung tính. Không phân loại lại hoặc sửa dữ liệu. Chi tiết và kiểm tra ở HANDOFF mục 12.

1. Luyện tập: chọn số câu 5/10/15/20 và một trong 19 khóa chủ đề (gồm Tổng hợp); xem/copy prompt. Không có bộ chọn difficulty trong UI Grammar mới. Prompt yêu cầu khoảng 40% B1, 30% B1+/B2 vừa, 20% B2 khó, 10% tiếp xúc C1, dễ trước khó sau. Đây là chỉ dẫn cho AI, không phải mức độ đã được đo tự động (`buildGrammarPrompt`, `GrammarPractice`).
2. Dán JSON → kiểm tra → nếu hợp lệ, xem từng câu hoàn chỉnh; bấm Hiện phân tích để xem dịch và tối đa 6 giải thích nhanh, lưu ý đọc hiểu. Có nút trước/sau, số câu, lưu/bỏ lưu. Lượt xem chỉ tính một lần/câu trong phiên; bấm Kết thúc mới tổng kết số phân tích vào `sentenceActivity`. Luyện tập không có chọn đáp án hoặc tự chấm năng lực (`GrammarQuiz`, `GrammarSentenceCard`, `getQuickGrammarPoints`).
3. `readingItems` cho phép mở form chỉnh nội dung rồi `+ Vocab` hoặc `+ Structure` qua store đích. Giữ nghĩa/ghi chú tách khỏi tiếng Anh; chống thêm trùng theo text chuẩn hóa, không ghi đè mục hoặc tiến độ cũ (`GrammarReadingNotes::ReadingItem`; `grammarReadingItems.js::buildReadingDraft/saveReadingDraft`). Trường `structures` dạng mảng chuỗi của câu v2 là dữ liệu tùy chọn cũ, **không phải kho Structures** và không tự tạo bản ghi trong kho này.
4. Câu đã lưu: tìm câu/lời giải/ghi chú, lọc chủ đề hoặc sao khó; mở phân tích, ghi chú cá nhân, bỏ lưu, xem cấp và lịch ôn (`GrammarSaved`). Không thấy nút import/export toàn bộ kho câu Grammar trong UI hiện tại.
5. Ôn tập: chọn đến hạn/từng sai hoặc cần ôn/tất cả, lọc chủ đề/sao; trộn hàng đợi. Tự nhận diện rồi chọn Đã hiểu hoặc Cần ôn lại, có thể mở phân tích trước hoặc sau đánh giá. Mỗi câu chỉ đánh giá một lần trong phiên; không đánh giá thì giữ tiến độ. Sao đổi ngay, tổng kết phiên phản ánh đánh giá thực tế (`GrammarReview::start/assess`; `recordReview`).
6. Thống kê: số câu đã phân tích, lượt ôn, đã hiểu/cần ôn, phân bố L1–L5, hoạt động theo chủ đề và lịch sử. Lịch sử độ chính xác TOEIC cũ nằm trong khối mở rộng riêng; không trộn thành điểm VSTEP (`GrammarStats`, `recordGrammarSession`).

### Kho Structures

`GrammarStructures` lưu pattern tiếng Anh, nghĩa Việt, ví dụ, notes, topic; thêm/sửa/xóa có xác nhận, tìm và nhập/xuất JSON. Không có bài ôn riêng trong màn thư viện; trả lời Smart Quiz chế độ Structures cập nhật tiến độ. `useStructuresStore::importStructures` validate và thêm/merge theo ID, không replace kho. Export xuất mọi cấu trúc còn sống được truyền vào thư viện (không chỉ kết quả tìm kiếm), gồm lịch sử ôn; không xuất tombstone. Tham khảo hướng dẫn triển khai riêng trong STRUCTURES-SYNC-SETUP, nhưng không coi trạng thái triển khai trong tài liệu là bằng chứng production.

## 5. Dữ liệu và cơ chế học

| Kho | Key LocalStorage | Bản ghi chính |
| --- | --- | --- |
| Vocabulary | `vocabmaster_words` | `id`, `english`, `annotation`, `vietnamese`, `imageUrl`, `wordType`, `level`, `currentStreak`, `createdAt`, tùy chọn `lastReviewedDate` |
| Stats Vocabulary | `vocabmaster_stats` | `totalQuestions`, `correctAnswers` |
| Câu Grammar | `vocabmaster_grammar_saved` | câu v2 hoặc legacy + `savedId`, `savedAt`, `hardMarked`, `userNotes`; mới lưu có thể có `analysisTopic` |
| Tiến độ câu | `vocabmaster_grammar_review` | map `savedId` → `level`, `wrongCount`, `totalReviews`, `lastReviewAt`, `nextReviewAt` |
| Stats Grammar | `vocabmaster_grammar_stats` | stats trắc nghiệm cũ + `sentenceActivity` (analyzed/reviewed/understood/byTopic/sessions) |
| Điều phối Grammar | `vocabmaster_grammar_cloud_url`, `vocabmaster_grammar_revision`, `vocabmaster_grammar_pending` | endpoint, revision đã biết, cờ còn sửa local |
| Lịch sử prompt cũ | `vocabmaster_grammar_recent_sentences` | Từ 2026-11-03 không còn đọc/ghi; giữ nguyên key cũ, không xóa dữ liệu. Snapshot prompt mới chỉ ở state Grammar |
| Structures | `vocabmaster_grammar_structures` | `id`, `english`, `vietnamese`, `example`, `notes`, `topic`, timestamps, `level/currentStreak`, `wrongCount/totalReviews`, `reviewBase`, `reviewEvents`, tùy chọn `deletedAt` |

| Dấu gạch chân Grammar | `vocabmaster_grammar_underlines` | `{ [key]: [{start,end,color}] }`; key = savedId hoặc `text:` + sentence; local only. `useGrammarStore` giữ snapshot state và truyền props để cập nhật ngay cả khi phân tích đóng; xem `sentenceUnderline.js` |
| Ghi chú theo đoạn Grammar | `vocabmaster_grammar_sentence_notes` | map theo savedId hoặc text-key; mỗi note có UUID, sentenceKey, sentence snapshot, start/end codepoint, quote, text, timestamps. State `sentenceNotes` cập nhật ngay; không sync, không đổi `userNotes` |

Nguồn: `storage.js`, `grammarStorage.js`, `structureStorage.js`, `sentenceUnderline.js`, ba hook, `grammarBatch.js`. LocalStorage theo origin/trình duyệt; không thấy đăng nhập hoặc tài khoản người dùng trong app. Stats hai module, lịch sử prompt và dấu gạch chân chỉ local, không nằm trong payload cloud.

Ghi chú nhanh: chọn đoạn tiếng Anh → **Ghi chú** → gõ (lưu ngay); Xong/Escape/click ngoài đóng editor, xóa hết nội dung hoặc Xóa ghi chú để bỏ. Practice/Saved hiện nhãn mặc định; Review ẩn mỗi câu mới, có nút hiện/ẩn riêng với phân tích, tạo/sửa ghi chú sẽ hiện ghi chú câu hiện tại. Không tự lưu câu vào thư viện. `sentenceNotes.js::notesForSentence` kiểm tra snapshot và trích đoạn để không gắn nhầm khi câu đổi; `moveSentenceNotes` chuyển text-key khi lưu câu. `sentenceGeometry.js` đo Range và dòng thực tế, xếp nhãn thành hàng dưới dòng cuối của đoạn, chừa padding tương ứng; `SentenceNoteEditor` float trong viewport. Nội dung nhãn/editor không nằm trong container tiếng Anh tính offsets.

UI nhãn (2026-11-03): chỉ hiện note text 12px, không lặp quote/arrow hoặc khung nền thường trực; hover/focus cho biết có thể sửa. Nhãn rộng theo nội dung DOM thực đo (tối đa 320px/chiều rộng câu), căn giữa dưới đoạn và chia hàng chỉ khi va chạm; editor vẫn dùng 180–320px riêng. Hiện/Ẩn ghi chú ở hàng điều khiển góc phải phía trên câu, không đè lên tiếng Anh; khi ẩn không chừa chiều cao cho nhãn.

- **Vocabulary:** đúng đủ streak 2/4/8/15 để lên cấp L1→L5; sai giảm một cấp và reset streak. Mỗi lần chấm ghi `lastReviewedDate`. Đến hạn khi đã qua 1/3/7/14/30 ngày ứng với cấp hiện tại, hoặc chưa ôn (`updateWordLevel`, `isDueForReview`).
- **Câu Grammar:** mỗi tự đánh giá hiểu tăng ngay một cấp, cần ôn giảm một cấp, giới hạn 1–5; đặt `nextReviewAt` theo 1/3/7/14/30 ngày của cấp mới. Đánh giá cũng ghi hoạt động ôn, tách khỏi accuracy TOEIC (`recordReview`, `calcNextReviewAt`).
- **Structures:** cùng ngưỡng streak 2/4/8/15 nhưng dựa trên `reviewBase` cộng các event ID riêng, sắp theo thời gian rồi ID. Sai giảm cấp, reset streak, tăng wrongCount và **đến hạn ngay**; đúng đặt lịch theo cấp mới. Merge event là union rồi tính lại (`grammarSyncMerge.js::structureProgress`; `recordStructureResult`).

`annotation` chỉ là ghi chú hiển thị/tìm kiếm, độc lập `wordType`, không ghép vào phát âm/đáp án/prompt. `annotation.js::migrateWord` chỉ tách hậu tố viết tắt từ loại khi chưa có annotation dạng string, giữ cụm như `account (for)` và giữ dữ liệu khác.

## 6. AI và hợp đồng nhập

Không có gọi API mô hình trực tiếp, API key AI hay backend tạo bài. Người dùng chủ động copy prompt (có nội dung học của mình) vào ChatGPT/Gemini/Claude hoặc công cụ khác, rồi dán JSON. Fetch trong app dùng cho cloud; TTS/ảnh là phụ thuộc khác.

### Grammar v2

`buildGrammarPrompt` yêu cầu một mảng các object: `schemaVersion: 2`, `type: "sentence-analysis"`, `sentence`, `vietnameseSentence`, `topic`, `grammarPoints` không rỗng; mỗi point gồm `category`, `phrase`, `explanation`. Tùy chọn `id`, `structures: string[]`, `readingNotes: string[]`, `readingItems: object[]`. Prompt yêu cầu readingItems nhưng validator vẫn cho phép thiếu để tương thích câu v2 cũ. Mục đọc hiểu có category, text, explanation và tùy chọn meaning/usefulness/pattern.

- `grammarImport.js::parseGrammarInput`: nhận mảng thuần, một code fence, hoặc một mảng duy nhất kèm lời dẫn/kết. Không tự cứu JSON sai cú pháp hoặc chọn giữa nhiều khối.
- `prepareGrammarImport`: kiểm tra phiên bản/type, đủ số câu/chủ đề, không có blank/options/answer, point bắt buộc và trích đoạn nguyên văn. Chỉ tự khớp khác biệt hoa/thường, khoảng trắng, một số dấu nháy/gạch nối khi xác định duy nhất một đoạn; không viết lại câu, dịch hay lời giải (`matchGrammarSubstring`).
- Sai mục `readingItems` tùy chọn: hiện từng lỗi để người dùng chọn loại từng mục và xác nhận; lỗi phân tích bắt buộc chặn nhập. Trùng trong cùng bộ bị chặn, giữ JSON để sửa. Trùng kho Grammar chỉ tiếp tục sau xác nhận, không tự xóa câu; kiểm tra lại kho mới nhất cả khi bấm xác nhận (`completeGrammarImport`, `GrammarPractice`).
- `validateGrammarJSON` kiểm tra lại trước `normalizeQuestions`; cloud/backend dùng validator câu theo phiên bản nhưng không kiểm tra readingItems chi tiết tương đương frontend (`grammarSyncMerge.js::validateQuestion`, Apps Script `validateSentenceAnalysis`).
- Từ 2026-11-03, `grammarCorpus.js` lấy `words[].english` và câu trong `savedQuestions` + các bộ đã nhập trong lần mở Grammar hiện tại (state tạm). Review không phải nguồn thứ ba; bản sao/câu trùng được loại theo NFKC, hoa/thường, khoảng trắng, nháy/gạch nối tương đương và dấu kết câu. Legacy chỉ khôi phục một `_____` với đáp án A/B/C/D rõ ràng; thiếu dữ liệu báo số bản ghi lỗi và khóa tạo/copy, không đoán. Không lọc theo chủ đề đang chọn.
- Payload chỉ `{ vocab: [[english, số câu chứa mục]], grammar: [câu tiếng Anh] }`, giữ toàn danh sách, không giới hạn 50 câu/6.000 ký tự. Mỗi câu chỉ cộng một lần/mục; khớp ranh giới Unicode, hỗ trợ cụm từ qua khoảng trắng/dấu phẩy/gạch nối nhưng không qua dấu kết câu. **Không gộp inflection/động từ bất quy tắc hoặc họ từ**; số đếm bảo thủ, không thể suy ra không có biến thể từ số 0. Không dùng/thêm thư viện NLP, không lấy nghĩa/ghi chú/level/lịch sử/Structures vào payload.
- `grammarBatch.js` tạo ID và bản sao dữ liệu. Copy/Xem cùng snapshot; đổi số câu/chủ đề thay yêu cầu nhưng giữ snapshot, render/chuyển subtab không tạo bộ mới. Dữ liệu nguồn thay đổi thì báo stale và khóa Copy đến khi Tạo prompt mới. Rời module/reload mất câu tạm chưa lưu, giống giới hạn phiên hiện có; không ghi lịch sử mới. UI nói rõ kho trống, lỗi/đang tải cloud, số mục/câu/ký tự và lỗi clipboard. Không phát hiện paraphrase/ngữ nghĩa tự động; prompt chỉ yêu cầu AI tránh trùng, không bảo đảm tuyệt đối.

### Xuất Excel + Prompt (2026-11-04)

Grammar Practice có thêm panel xuất local, giữ luồng prompt thuần phía trên. `grammarExport.js` dùng `grammarCorpus.js` (preserveText) lấy toàn bộ Vocabulary tiếng Anh không rỗng và **chỉ câu Grammar đã lưu**, hỗ trợ legacy. File `.xlsx` có đúng hai sheet một cột: Vocabulary/English, Grammar/Sentence; literal text, không nghĩa/ghi chú/metadata học tập. Dependency `write-excel-file ^4.1.1` tải động khi tạo Blob. Không dùng file này để backup/restore.

Snapshot package giữ cả data/settings, tên file theo batch ID, Blob và prompt trong state Grammar. Prompt chứa toàn bộ English/count từ chính corpus trong file, yêu cầu AI đọc hai sheet, trả schema v2 trực tiếp, hỏi workbook nếu không truy cập được. Quy tắc độ khó/topic/count, giải thích Việt và exact-substring dùng chung builder; ID s1…sN được yêu cầu thống nhất trong prompt, validator vẫn tương thích ID tùy chọn của câu cũ. Thay nguồn/cấu hình làm package lỗi thời, khóa nút tải/copy cho đến khi tạo lại; giữ qua subtab, mất khi rời module/reload. Câu nhập tạm chỉ dùng cho importer chống trùng, không vào file/count xuất.

Đang tải/sync thì khóa chuẩn bị; cloud chưa xác minh cho phép người dùng chọn rõ xuất dữ liệu hiện có trên thiết bị, có thể thiếu cloud. `useVocabStore.cloudReadStatus` giữ kết quả GET độc lập badge sync thoáng qua. Getter storage có `withStatus` để hook giữ lỗi đọc ban đầu; panel chặn lỗi này thay vì nhận là kho trống. Effect Vocabulary không ghi `[]` lên cache đọc lỗi. Kho trống hợp lệ xuất hai sheet chỉ có header. Dữ liệu lỗi/không khôi phục được hoặc vượt giới hạn Excel/XML chặn toàn bộ file, không tự cắt. Xem HANDOFF mục 11 để biết kiểm tra và giới hạn.

Validation kiểm tra cấu trúc và trích dẫn; không chứng minh câu AI đúng ngữ pháp, bản dịch đúng, độ khó đúng hoặc giải thích đủ tốt.

### Smart Quiz

`Quiz.jsx::parseResponse` chấp nhận fence/lời dẫn và chuẩn hóa `answerIndex` hoặc `correctIndex`. Nhánh Vocabulary kiểm tra tương đối nông (options tối thiểu 2, mặc định index 0 khi thiếu), không chặt như prompt 4 đáp án. Nhánh Structures thêm `validateStructureQuestions`: đúng số câu, ID trong bộ chọn/còn tồn tại, đúng một `[_____]`, bốn đáp án khác nhau, index 0–3, explanation/trapPoint, phân bố ID cân bằng. Không đổi tiến độ khi mới nhập/copy; tiến độ chỉ thay khi trả lời.

## 7. Lưu trữ cloud, backup và xung đột

### Vocabulary — protocol 1 (2026-11-04, chưa deploy)

`useVocabStore` dùng `vocabSync.js`: persist base + words trong `vocabmaster_vocab_sync_v1`, giữ cache `vocabmaster_words` tương thích và các backup `vocabmaster_vocab_backup_*`. Client mặc định pause; GET vẫn đọc được. Legacy/chưa có base hoặc generation đổi: backup rồi adopt nguyên remote, không union/upload cache cũ. Cùng generation dùng three-way merge; xóa thắng, additions offline giữ lại, conflict cùng record lưu archive và báo để người dùng chọn lại. Lỗi/quota không cho coi là kho rỗng hay đồng bộ thành công.

`cloud.js` gọi `/api/vocab-sync`; proxy dùng env server `VOCAB_APPS_SCRIPT_URL`, `VOCAB_SYNC_SECRET`, `VOCAB_WRITES_ENABLED`. Backend `google-apps-script.js` yêu cầu protocol 1, server generation, CAS revision, requestId, tombstone và confirmEmpty cho xóa cuối. ACK so toàn bộ nội dung và revision/requestId. Legacy/unversioned và generation cũ luôn bị từ chối. Không còn no-cors/count verification/hard-clear.

ScriptLock bao GET/POST/pause/restore. Snapshot JSON bất biến trên Drive là bản chuẩn, Script Property `VOCAB_HEAD` là commit pointer; sheet đầu tiên là mirror 10 cột. Tạo/đọc lại file trước mirror/flush/HEAD, giữ file cũ làm backup. Restore editor-only yêu cầu snapshot người dùng xác nhận bằng SHA-256, paused, tạo generation UUID mới/revision 0. Không tự seed từ Sheet/cache; không restore bằng sửa mirror. Client/proxy/backend đều mặc định khóa ghi. Xem [runbook đầy đủ](VOCABULARY-RECOVERY.md) trước triển khai, nhất là cập nhật mọi deployment cũ và drain execution legacy. Grammar/Structures không dùng protocol này.
### Câu Grammar — CAS và pending

`grammarStorage.js::getGrammarCloudUrl` mặc định `/api/grammar-sync`; URL tùy chỉnh lưu local và **dùng chung cho Structures**. Chuỗi rỗng trở về default, không tắt cloud bằng cách xóa URL. Badge configured chỉ nói có URL, không chứng minh kết nối thành công.

`useGrammarStore::syncFromCloud` tự GET khi mount module, đổi URL hoặc có sự kiện online; có nút Sync trong Cloud/thử lại. Chỉ ready để push sau GET hợp lệ. Merge giữ dữ liệu local hữu ích cả khi thiếu cờ pending cũ. Edit persist đồng bộ ngay, pending lưu bền; debounce 2,5 giây gửi `action: save`, `expectedRevision`, `savedQuestions`, `reviewProgress`. ACK phải có revision tăng đúng 1 và written khớp. Conflict → fetch/merge → thử POST lại một lần. Thay đổi trong request được replay, version check giữ pending cho sửa mới, session/endpoint check bỏ response cũ. Rời tab lớn unmount hook; mount lại tiếp tục từ cache/pending.

`mergeSavedQuestions` union theo savedId, hardMarked OR, ưu tiên notes local không rỗng, savedAt sớm nhất; `mergeReviewProgress` lấy max level/counters/timestamps. Các sửa được replay trong request hiện tại có thể sống qua conflict, **nhưng chưa có tombstone/nhật ký sửa xuyên thiết bị cho câu Grammar**: merge sau này vẫn có thể khôi phục câu đã xóa, sao đã bỏ, ghi chú đã xóa hoặc cấp cao cũ. CAS tránh ghi revision cũ, không giải quyết triệt để ý nghĩa merge. Đẩy rỗng chỉ khi xóa câu cuối rõ ràng sau hydration mới đặt `confirmEmpty`.

`grammar-apps-script.js`: `doGet/doPost` có ScriptLock, validate v2/legacy, revision ở `Meta!A1`, review JSON ở `Meta!B1`, metadata C1:D1; câu lưu JSON từng hàng cột A trong `SavedQuestions`. `createBackup` giữ snapshot trước lần ghi gần nhất ở `Backup` rồi ghi câu/review và tăng revision. Không coi backup này là lịch sử nhiều phiên hay transaction tự rollback như Structures; nhánh Grammar không có journal tương đương Structures.

### Structures — chung endpoint, riêng giao thức

`useStructuresStore` mount ở App, tự sync khi mount/online/focus; sửa local debounce 2,5 giây. Mỗi vòng GET `scope=structures` → validate protocol `structuresSchema: 1` → `mergeStructures` → nếu khác thì POST `action: saveStructures` với revision riêng. Conflict fetch/merge và retry một lần. Lỗi/ACK không đúng giao thức giữ local và báo chưa sync. Sửa trong POST còn pending và được gửi vòng khác.

Merge theo ID: nội dung ưu tiên `updatedAt` mới hơn, tie-break nhất quán; tombstone lấy max, event union rồi tính lại tiến độ. Phụ thuộc đồng hồ thiết bị cho thứ tự edit/event. Tombstone được giữ để thiết bị cũ không khôi phục cấu trúc đã xóa; muốn tạo lại cần ID mới (`mergeStructures`, `structureProgress`). Không suy rộng quy tắc này sang câu Grammar.

Backend dùng sheet `Structures`, `StructuresBackup`, revision `Meta!E1`, journal `Meta!F1`; ScriptLock chung với Grammar. Validate cả snapshot đã merge, không cho mất ID/event/tombstone ngay cả khi CAS đúng. Có backup, rollback lỗi ghi thông thường và chặn đọc/ghi khi journal cho thấy lần ghi bị gián đoạn (`readStructures`, `saveStructuresPayload`). Giới hạn 5.000 bản ghi, 45.000 ký tự JSON/mục Structures; không tự cắt lịch sử. Quy trình khôi phục thủ công nằm trong STRUCTURES-SYNC-SETUP, không thực hiện khi khảo sát.

### Proxy và triển khai

`api/grammar-sync.js::handler` chuyển tiếp GET/POST/OPTIONS, thêm secret từ env **server** `GRAMMAR_SYNC_SECRET`, upstream từ `GRAMMAR_APPS_SCRIPT_URL`; chuyển tiếp scope Structures. Apps Script `checkAuth` dùng Script Property secret nếu có; không đặt secret thì bỏ yêu cầu này. Proxy chưa có xác thực người dùng riêng và đặt CORS `*`; secret upstream không đồng nghĩa app có phân quyền người dùng.

Vite config chỉ có React/Tailwind, không có proxy `/api`. `npm run dev` và `preview` riêng không chạy Vercel function. Backend cũ có thể chưa hiểu v2/Structures; mã repo không chứng minh bản đang deploy. Triển khai Apps Script/Vercel là bước riêng cần người dùng cho phép, không nằm trong khảo sát này.

## 8. Chạy và kiểm tra

Scripts thực tế (`package.json`): `npm run dev`, `npm run build`, `npm run lint`, `npm run preview`. Không có `npm test`. Dependency đã có trong workspace; không cài hoặc đổi dependency trong khảo sát. Môi trường thực thi kiểm tra: Node `v24.21.0`, npm `11.19.0`; đây là phiên bản quan sát, không phải yêu cầu tối thiểu đã chứng minh. Trên PowerShell có thể dùng `npm.cmd`.

| Lệnh | Nội dung/bằng chứng |
| --- | --- |
| `node test/annotation.test.js` | annotation/migration; sao chép logic, không bảo đảm luôn khớp source |
| `node test/vocab-sync.test.js` | merge/verify-count Vocabulary; sao chép logic |
| `node test/word-selection.test.js` | chọn từ Flashcard/Listening |
| `node test/vocabulary-render.test.js` | SSR component thật, phân trang/bộ lọc; không UI tương tác |
| `node test/grammar-sync.test.js` | CAS/merge/sao qua mô phỏng; không backend live |
| `node test/grammar-auto-sync.test.js` | hook/cloud/proxy qua harness, startup/offline/conflict/response cũ |
| `node test/grammar-sentence.test.js` | validator v2/legacy, Apps Script trong VM và SSR màn Grammar |
| `node test/grammar-reading-items.test.js` | validation, draft và thêm nhanh đúng kho |
| `node test/grammar-import.test.js` | parser nhiều định dạng, quote normalization, xác nhận bỏ mục/trùng, batch/history |
| `node test/structures.test.js` | store/merge/event/tombstone, prompt/validator/client/proxy bằng mô phỏng |
| `node test/structures-backend.test.js` | mã Apps Script thật trong VM với Sheets/Lock giả, CAS/rollback/backup |
| `node test/sentence-underline.test.js` | logic năm màu, persistence giả lập, render HTML tĩnh |
| `node test/underline-rendering.test.js` | App/React DOM thật trong Edge headless: chọn đoạn, click màu/xóa, cập nhật ngay, giữ assessment/analysis và reload; cần Playwright, cloud bị chặn; thiết lập trong HANDOFF |
| `node test/sentence-notes.test.js` | dữ liệu note, Unicode/vùng trùng/chồng, sửa/xóa, chuyển key, dữ liệu lỗi và xếp hàng nhãn |
| `node test/sentence-notes-browser.test.js` | App/Edge thật, typing/autosave/ẩn-hiện, geometry viewport 1100/375/320px, giữ underline/progress, chuyển key và reopen/reload; thiết lập Playwright như underline-rendering |
| `node test/grammar-export.test.js` | XLSX thật, 2 sheet/1 cột/literal text/no private fields, Unicode/legacy/frequency/snapshot/empty/error; cần Python 3 standard library trong PATH cho reader ZIP/XML độc lập |
| `node test/grammar-export-browser.test.js` | App/Edge tải XLSX thật, clipboard/manual fallback, stale/config/import/save/GET, cache trống/hỏng/không đọc được và viewport 1280/375/320px; cần Playwright/Edge + Python 3, network/storage cô lập |

Lần khảo sát: **cả 11 file exit 0**. `npm.cmd run lint` exit 0 nhưng còn cảnh báo unused, hook deps, set-state-in-effect, purity/refs…; không sửa vì chỉ bàn giao. Build exit 0 bằng `npm.cmd run build -- --outDir <thư-mục-tạm-mới>` để giữ `dist` hiện có; Vite báo outDir ngoài project không tự dọn và thông tin thời gian plugin. Không chạy dev server/browser.

Phụ thuộc ngoài lúc sử dụng: Google Sheets + Apps Script cho sync, Vercel/server có function nếu dùng proxy, Web Speech/Google TTS, URL ảnh và dịch vụ ảnh dự phòng, Google Fonts, AI chat do người dùng tự dùng. Build/test local không xác minh các dịch vụ này; không có service worker/offline app shell trong nguồn đã đọc. LocalStorage không thay thế bản sao lưu độc lập.

## 9. Giới hạn và lưu ý khi sửa

Các điểm dưới đây được thấy trong mã; tác động production chưa thử:

- Không nhập nhằng ba hệ L1–L5 và hai kiểu quiz. Dashboard accuracy chỉ từ Smart Quiz Vocabulary; Grammar hiểu/cần ôn là tự đánh giá, không phải điểm thi.
- `Vocabulary::handleImport` gọi `addWord` nên **sinh lại ID và không phục hồi `lastReviewedDate`**; level/streak/createdAt/annotation được nhận nhưng đây không phải restore nguyên snapshot. Validation import khá nông, kiểm tra trùng dựa trên kho trước nhập; hook `addWord` dùng `Date.now()` cho ID. Rủi ro ID trùng khi thêm rất nhanh và trùng ngay trong cùng file cần kiểm tra nếu sửa import, không coi test hiện tại đã phủ hết.
- Vocabulary push đang chạy có guard bỏ lượt gọi mới; chưa thấy hàng đợi pending bền như Grammar hoặc cơ chế chắc chắn gửi tiếp mọi sửa trong lúc verify. Cần kiểm tra race/offline khi làm việc sync, tránh coi debounce là bảo đảm lưu.
- Merge Vocabulary cloud-first có thể mất sửa local cho cùng từ; Grammar max/OR có thể đảo ý định xóa/giảm cấp. Giữ guard cloud rỗng/lỗi; không thử ghi/xóa production để kiểm chứng.
- Storage getter thường fallback khi parse lỗi nhưng nhiều nơi không validate toàn bộ shape; setter LocalStorage có thể throw khi hết quota/bị chặn. Chỉ lịch sử prompt mới có fallback bộ nhớ rõ ràng. Không coi cache hỏng là cho phép xóa dữ liệu gốc.
- Câu v2 và legacy cùng tồn tại. `analysisTopic` chỉ hỗ trợ hiển thị lọc phân tích, `topic` vẫn là chủ đề chính; không migrate ngầm/xóa options/answer của câu cũ.
- Quick explanation rút gọn để hiển thị, không viết lại source; `readingItems` cũ không hợp lệ có thể bị ẩn bởi `GrammarReadingNotes`, không có kiểm chứng ngữ nghĩa AI.
- Chuyển tab/rời phiên có thể mất JSON đang dán hoặc tổng kết chưa kết thúc; dữ liệu đã lưu/đã tự đánh giá persist theo store, không đồng nhất với session tạm.
- Apps Script trong repo là bản tham chiếu. `testGrammarBackend` trong file backend có thao tác sheet; không chạy trên spreadsheet thật trong quá trình kiểm tra local. Lệnh test Node nêu trên dùng mô phỏng.
- TTS, ảnh dự phòng, clipboard và font phụ thuộc trình duyệt/mạng; chưa xác minh hoạt động hiện tại. Không mô tả Listening từ vựng là bài Listening VSTEP hoàn chỉnh.

Khi nhận nhiệm vụ mới, dùng [HANDOFF.md](HANDOFF.md) để biết trạng thái working tree, đọc source tương ứng rồi mới quyết định thay đổi. Không có backlog/lộ trình được suy ra từ tài liệu này.
