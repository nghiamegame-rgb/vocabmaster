# VocabMaster — Trạng thái dự án (bàn giao cho AI/agent phiên sau)

**Cập nhật lần cuối: 2026-11-25 ~00:10 (giờ Việt Nam).** File này mô tả tình hình *hiện tại* của dự án sau phiên làm việc dài ngày 24/11. Nếu nó mâu thuẫn với `docs/HANDOFF.md`, `docs/PROJECT_CONTEXT.md` hay `docs/QUIZ-FEEDBACK.md`, **file này và mã nguồn thật thắng** (các file kia có chỗ đã cũ, xem mục 11).

## 0. Người dùng và cách làm việc

- Chủ dự án tên **Nghĩa**, **không phải lập trình viên**, giao tiếp **tiếng Việt**. Giải thích ngắn, từng bước đơn giản, đưa lệnh chép-dán được. Tránh thuật ngữ nếu không cần.
- Web là SPA học tiếng Anh "VocabMaster" (thư mục `C:\web toiec`, tên package `web-toiec`). Mục tiêu học hiện tại là **VSTEP B1–B2** (chữ "TOEIC" chỉ còn ở dữ liệu cũ).
- Quy trình quen thuộc: AI (Claude Code hoặc Gemini) sửa mã **trên một nhánh** và push nhánh đó → người dùng tự **ghép nhánh vào `main` và push** bằng terminal → Vercel tự deploy `main`. Không tự merge/push/deploy `main` nếu người dùng chưa bảo.

## 1. Tóm tắt trong một phút

- Web đang chạy production trên **Vercel** (tự deploy từ nhánh `main` của repo GitHub `nghiamegame-rgb/vocabmaster`, repo private) và đồng bộ dữ liệu qua **Google Apps Script + Google Sheets**.
- Ngày 24/11 đã hoàn thành và ghép vào `main`: (1) 17 mục sửa lỗi theo báo cáo phân tích; (2) triển khai Vercel + Apps Script; (3) nâng cấp giao diện "Midnight Indigo & Glass Slate" kèm hiệu ứng; (4) Smart Quiz Multiple Choice tự đọc từ đúng và hiện ảnh; (5) chuyển khung ảnh vào trong thẻ câu hỏi; (6) Grammar → Ôn tập giữ trạng thái "Hiện ghi chú" khi sang câu tiếp.
- Không có việc dở dang về mã. Việc còn mở chủ yếu là việc người dùng tự làm (mục 9) và vài điều chưa được xác minh (mục 10).
- **Ngày 25/11:** nhánh `fix/listening-autofocus-sync-toast` (đã push nhánh, **chưa ghép vào `main`**, chưa deploy): nút "Tự mở bàn phím" ở Listening và chip thông báo đồng bộ trong thanh menu. Xem mục 3a.

## 2. Trạng thái git và triển khai

Đọc trực tiếp từ `.git` lúc 00:10 ngày 25/11:

| Mục | Giá trị |
|---|---|
| Nhánh hiện tại | `main` |
| `main` = `origin/main` | `99a25d6` (merge `fix/review-notes-persist`, 00:01 ngày 25/11) — **đã push** |
| Các merge trước đó trên `main` | `8bffdbd` (fix/quiz-image-slot, 23:24) · `e0028c8` (feat/quiz-feedback, 23:06) · `70c0cc4` (fix/audit-2026-11, 18:16) |
| Nhánh phụ | Các nhánh `fix/*` đã được ghép (thư mục `.git/refs/heads/fix` còn tồn tại); nhánh `feat/*` có thể đã bị đóng gói hoặc xóa. Có thể dọn, không bắt buộc |

**Cảnh báo trung thực:**
- Mình **chưa xác minh** Vercel hiển thị "Ready" cho lần push `99a25d6`. Không có URL deploy để mở được từ phiên này (repo private, không có Vercel CLI). Phiên sau nên nhờ người dùng mở Vercel → Deployments và xác nhận, hoặc mở bản production để thử.
- Các file `docs/TRANG-THAI-DU-AN.md`, thay đổi trong `AGENTS.md` và `docs/HANDOFF.md` (con trỏ) được viết **sau** commit `99a25d6` nên **chưa commit**. Phiên sau (hoặc người dùng) cần `git add docs AGENTS.md` → `git commit` → `git push`. Việc này chỉ thêm tài liệu, không đổi mã chạy.
- Thư mục làm việc có thể hiện `src/components/Grammar.jsx` bị sửa "ảo" (BOM/xuống dòng, xem mục 7). Không phải thay đổi thật.

## 3. Những gì đã làm ngày 24/11 (theo thứ tự)

1. **Báo cáo phân tích web** → `docs/BAO-CAO-PHAN-TICH-WEB.md` (đã gắn quyết định của người dùng cho 3 mục còn lại).
2. **17 mục sửa lỗi** (nhánh `fix/audit-2026-11`, đã ghép): bảo mật proxy Grammar (secret bắt buộc), sheet `Review` cho tiến độ ôn, tombstone khi bỏ lưu câu, store Grammar mount ở `App`, `ErrorBoundary`, kiểm tra `answerIndex` của Smart Quiz, `WordInitialTile` thay ảnh Unsplash, v.v. Chi tiết: `docs/BAO-CAO-SUA-LOI.md` và HANDOFF mục 17.
3. **Triển khai**: Vercel (env `GRAMMAR_SYNC_SECRET`, `GRAMMAR_APPS_SCRIPT_URL`) và Apps Script Grammar (Script Property `GRAMMAR_SYNC_SECRET`, đã deploy "Version 7"); sheet `Review`/`ReviewBackup` tạo ra, `Meta!B1` = `migrated-to-Review-sheet`. Chi tiết quy trình ở HANDOFF mục 17.
4. **Theme + animation** (`feat/theme-animation`, do Gemini làm, mình đã duyệt diff): xem `docs/THEME-ANIMATION.md`.
5. **Smart Quiz đọc từ + hiện ảnh** (`feat/quiz-feedback`): xem mục 4.
6. **Chuyển khung ảnh quiz** vào trong thẻ câu hỏi (`fix/quiz-image-slot`): người dùng thấy ảnh nổi giữa màn hình che đáp án nên đổi.
7. **Giữ "Hiện ghi chú" khi sang câu** ở Grammar → Ôn tập (`fix/review-notes-persist`): xem mục 5.

## 3a. Việc ngày 25/11 — nhánh `fix/listening-autofocus-sync-toast`

Tách từ `main` `99a25d6`. Đã push **nhánh**; chưa ghép vào `main`, chưa deploy (người dùng tự ghép).

1. **Listening — nút "Tự mở bàn phím: Bật/Tắt"** (commit `f19518e`): nằm cạnh thanh thống kê đầu tab, icon `Keyboard`, `aria-pressed`, `title` giải thích.
   - Tắt: sang từ mới không gọi `focus()` (bàn phím điện thoại không tự bật); ô gõ vẫn hiện, chạm vào vẫn gõ được. Chuyển sang tắt thì `blur()` ô gõ; chuyển sang bật thì focus ngay.
   - Mặc định: màn cảm ứng (`matchMedia('(pointer: coarse)')`) **tắt**, máy tính **bật**; lựa chọn đã lưu thắng mặc định.
   - Lưu ở khóa riêng `vocabmaster_listening_autofocus` (`'on'`/`'off'`), bọc try/catch; **không** thuộc words/stats, không đồng bộ cloud, không vào backup. Logic thuần: `src/utils/listeningPrefs.js`.
   - Không đổi: tự phát âm, Replay, auto-submit, chấm điểm, L1–L5, bộ lọc, tự chuyển câu.
   - **Smart Quiz → Listening & Typing** (`Quiz.jsx`, effect "Reset dictation state") **cũng tự focus** ô `#dictation-input` sau 80 ms mỗi câu mới, không có nút tắt. Chưa sửa (người dùng chỉ yêu cầu kiểm tra).
2. **Thanh menu — chip thông báo đồng bộ** (commit `576ed98`): bỏ khung nổi `fixed top-[72px]` giữa màn hình. Câu thông báo (giữ nguyên chữ và quy tắc hiện/ẩn, `push_error` ưu tiên) giờ là chip `text-xs` một dòng, `truncate`, ngay bên trái PushIndicator/nút Sync.
   - Hiện từ `md` (768 px). Dưới `md` cùng phần tử là `role="status" aria-live="polite"` dạng `sr-only`; nút Sync có `title` chứa câu thông báo.
   - **Sửa kèm lỗi có sẵn:** ở 640–1023 px hàng menu đã tràn ngang (768 px tràn ~200 px, nút Sync bị đẩy ra ngoài màn hình). Giờ chữ trên tab chỉ hiện từ `lg` (1024 px), chữ "VocabMaster" cạnh logo chỉ hiện từ `xl` (1280 px); tab có `shrink-0 whitespace-nowrap` nên không co/nhảy khi chip hiện. Ở 1024 px chip bị cắt chữ (rê chuột để xem đủ câu).
   - Không đổi trạng thái đồng bộ riêng của Grammar và khối lỗi chi tiết trong `App.jsx`.
3. **Test mới:** `listening-prefs.test.js`, `navbar-sync-chip.test.js` (Node); `listening-autofocus-browser.test.js`, `navbar-sync-chip-browser.test.js` (trình duyệt). Không phải sửa test cũ nào (`vocab-quota-browser` vẫn tìm thấy chữ "Vocabulary synced successfully!" trong chip).

## 4. Smart Quiz — phản hồi sau khi chọn đáp án

Chỉ áp dụng cho **Multiple Choice của từ vựng** (không áp dụng Listening & Typing, không áp dụng Structures).

- Khi bấm đáp án (đúng hay sai đều vậy) → màu xanh/đỏ như cũ **và** tự đọc to `q.wordEnglish` **và** hiện ảnh của từ (`wordObj.imageUrl`; không có ảnh/ảnh lỗi → `WordInitialTile` chữ cái đầu).
- Khung ảnh nằm ở **cột phải của thẻ câu hỏi**, giữ chỗ từ đầu câu (không làm layout nhảy), **không hiện đáp án trước khi trả lời**.
- Sang câu mới khi đồng thời: đã qua ≥ `FEEDBACK_MIN_MS` (1800 ms) **và** đọc xong **và** ảnh hiện ≥ `FEEDBACK_IMAGE_MS` (1000 ms); trần an toàn `FEEDBACK_MAX_MS` (4000 ms) nếu máy không báo đọc xong. Ba hằng số ở đầu `src/components/Quiz.jsx`.
- Logic thời gian là hàm thuần `evaluateFeedbackAdvance` trong `src/utils/quizFeedback.js` (có test Node).
- Ảnh được preload khi câu hỏi hiện ra; giọng đọc bị hủy khi sang câu/hết bài/đổi tab.
- Chấm điểm, cảnh báo sai lần đầu, lên/xuống cấp L1–L5 **không đổi**.
- `docs/QUIZ-FEEDBACK.md` còn mô tả ảnh là "khung nổi `position: fixed` giữa-dưới"; **điều đó đã cũ**, hiện là ô trong thẻ câu hỏi.

## 5. Grammar → Ôn tập — giữ trạng thái "Hiện ghi chú"

- `GrammarReview` giữ state `notesShown` (mặc định `false`, reset về `false` khi bắt đầu phiên ôn mới trong `start()`).
- Truyền xuống qua `hideNotesInitially={!notesShown}` và `onNotesShownChange={setNotesShown}` → `GrammarSentenceCard` (trong `GrammarAnalysis.jsx`) → `UnderlinedSentence`. Bấm "Hiện/Ẩn ghi chú" cập nhật cả state cục bộ lẫn state cha; sang câu tiếp thì giữ nguyên lựa chọn.
- **"Hiện phân tích" cố ý vẫn reset mỗi câu** (người dùng chưa yêu cầu giữ).
- Trạng thái chỉ sống trong phiên ôn, **không lưu qua lần mở sau** (không dùng localStorage).
- Test cũ `sentence-notes-browser.test.js` từng khẳng định "ghi chú ẩn sau Câu tiếp"; đã sửa theo hành vi mới. Test mới: `grammar-review-notes-persist-browser.test.js`.

## 6. Kiến trúc nhanh (chi tiết ở AGENTS.md và PROJECT_CONTEXT)

- **Stack**: React 19, Vite 8, Tailwind CSS 4 (token trong `src/index.css`, khối `@theme`), lucide-react, oxlint, write-excel-file. JavaScript/JSX, không TypeScript, không router (đổi tab bằng state trong `src/App.jsx`).
- **Vercel Functions**: `api/vocab-sync.js`, `api/grammar-sync.js` (proxy tới Apps Script, giấu secret phía server). Frontend gọi đường dẫn tương đối `/api/vocab-sync`, `/api/grammar-sync`.
- **Apps Script** (mã trong repo, bản chạy thật có thể khác): `google-apps-script.js` (Vocabulary), `grammar-apps-script.js` (Grammar + Structures).
- **Ba kho dữ liệu tách biệt**, không chuyển trạng thái học giữa chúng:
  - *Vocabulary*: LocalStorage `vocabmaster_words/stats` + IndexedDB backup; sync kiểu generation/revision/tombstone, three-way merge.
  - *Câu Grammar*: khóa `vocabmaster_grammar_*`; sync CAS theo revision, tiến độ ôn ở sheet `Review`.
  - *Structures*: khóa `vocabmaster_grammar_structures`; event-sourced, chung endpoint Grammar nhưng khác scope/revision.
- **Smart Quiz / Grammar không gọi API AI**: tạo prompt, người dùng dán JSON AI trả về, app kiểm tra dữ liệu.
- **Theme**: bảng màu "Midnight Indigo & Glass Slate" (nền `#070b14`/`#0d1424`/`#131d33`/`#1b2844`, nhấn indigo `#6366f1` và violet `#8b5cf6`). Hiệu ứng chỉ bằng CSS (transform/opacity, 160–280 ms) và tôn trọng `prefers-reduced-motion`. Class tiện ích: `vm-page-enter`, `vm-btn`, `vm-card-interactive`, `vm-scale-in`, `vm-toast-enter`, `vm-feedback-in`, `vm-skeleton`, `progress-fill`.

## 7. Cạm bẫy đã gặp (đọc trước khi sửa)

- **PowerShell chặn `npm`**: dùng `npm.cmd` (ví dụ `npm.cmd run dev`, `npm.cmd test`, `npm.cmd run build`) hoặc mở cmd.exe. Không khuyên người dùng đổi chính sách thực thi. `git` chạy bình thường.
- **`Grammar.jsx` có BOM ở đầu trong bản đã commit.** Trên Windows (autocrlf) thư mục làm việc hay hiện file này "đã sửa" chỉ vì BOM/CRLF. Trước khi `git checkout`/merge nếu bị chặn: `git restore src/components/Grammar.jsx`. Đừng "sửa" BOM trong commit nếu không có lý do.
- **`npm run dev` (Vite thuần) không có `/api`** và LocalStorage trống theo từng origin → Smart Quiz ở `localhost` không có dữ liệu, sync báo lỗi vô hại. Muốn thấy dữ liệu thật phải xem bản Vercel (preview hoặc production). Trình duyệt tích hợp của Claude không mở được `localhost`.
- **Thanh menu gần kín chỗ**: ở 1024 px chỉ dư khoảng 150 px cho chip/PushIndicator. Thêm tab hay chữ vào navbar thì chạy lại `navbar-sync-chip-browser` (đo tràn ngang ở 1280/1024/768/640/375/320 px).
- **Listening tự focus ô gõ (khi bật) sẽ cuộn trang** tới ô gõ; test đo bố cục cần `scrollTo(0, 0)` trước.
- **`.vm-page-enter` dùng `transform`**, nên phần tử `position: fixed` bên trong sẽ neo theo nó chứ không theo cửa sổ. Đây là lý do overlay quiz bị lệch trên điện thoại và đã bỏ overlay.
- **Không đổi layout/DOM của khối gạch chân và ghi chú Grammar**: `sentenceGeometry.js`, `UnderlinedSentence.jsx`, `SentenceNoteEditor.jsx`, `UnderlineToolbar.jsx`, `GrammarReadingNotes.jsx` đo hình học DOM thật; chỉ sửa logic/state, không đổi cấu trúc.
- Ảnh Unsplash/dịch vụ ảnh ngoài đã bỏ; từ không có ảnh dùng `WordInitialTile`.
- `error.log` (101 byte) ở gốc repo là rác cũ, không quan trọng.

## 8. Chạy và kiểm tra

- Lệnh: `npm.cmd run dev` · `npm.cmd run build` · `npm.cmd run lint` · `npm.cmd test`.
- **`npm test`** chạy **33 file test Node** (không cần trình duyệt, không có framework, qua `test/run-node-tests.js`). Lần cuối ghi nhận (25/11, nhánh `fix/listening-autofocus-sync-toast`): 33/33 đạt.
- **Test trình duyệt (Playwright + Edge headless) KHÔNG nằm trong `npm test`** — chạy riêng từng file `node test/<tên>.test.js`. Hiện có 13: `grammar-corpus-browser`, `grammar-export-browser`, `grammar-review-browser`, `grammar-topic-browser`, `sentence-notes-browser`, `underline-rendering`, `vocab-quota-browser`, `vocab-star-browser`, `vocab-sync-browser`, `quiz-feedback-browser`, `grammar-review-notes-persist-browser`, `listening-autofocus-browser`, `navbar-sync-chip-browser`. Lần cuối Claude Code chạy (25/11): 13/13 đạt. Cách thiết lập Playwright: HANDOFF (cài vào thư mục TEMP, không vào repo).
- **Lint**: 0 lỗi, 34 cảnh báo (mốc cơ sở; đừng làm tăng). **Build**: JS ~509 kB, CSS ~103 kB (Vite cảnh báo vượt 500 kB, đã biết).
- Test Grammar/annotation dùng mô phỏng; "pass" không chứng minh sync thật.
- Mình (Claude trong chat) không có shell trên máy người dùng nên **không tự chạy lại test**; kết quả test do Claude Code/Gemini báo, mình chỉ duyệt diff.

## 9. Việc còn mở (người dùng tự làm hoặc cần xác nhận)

1. Mở Vercel → Deployments, xác nhận lần deploy mới nhất của `main` ở trạng thái **Ready**; thử Smart Quiz và Grammar → Ôn tập trên bản thật.
2. Trên mọi thiết bị: đóng tab web cũ, tải lại cứng (Ctrl+F5) để khỏi chạy frontend cũ (thiết bị cũ có thể làm câu Grammar đã xóa hiện lại).
3. Xóa các dự án Apps Script thừa/rác (gồm backend Vocabulary cũ). Chỉ xóa sau khi chắc chắn không còn dùng.
4. Kiểm tra repo GitHub đang ở chế độ **Private**.
5. ~~Commit và push các file tài liệu mới (mục 2).~~ Đã commit trên nhánh `fix/listening-autofocus-sync-toast` (25/11); sẽ vào `main` khi ghép nhánh.
6. Ghép nhánh `fix/listening-autofocus-sync-toast` vào `main` và push; thử nút "Tự mở bàn phím" trên điện thoại thật.

## 10. Chưa xác minh / rủi ro đã chấp nhận

- **Chưa xác minh (25/11)**: bàn phím **thật** trên điện thoại khi bật/tắt "Tự mở bàn phím" (chỉ test Edge headless giả lập cảm ứng; iOS Safari thường không tự bật bàn phím khi `focus()` không do người dùng chạm, Android Chrome thường có — đây là suy luận, chưa thử); chip đồng bộ trên máy thật/Safari/Firefox.
- **Chưa xác minh**: Vercel Ready cho `99a25d6`; giọng đọc **thật** trên điện thoại (iOS Safari, Android Chrome) — chỉ test với `speechSynthesis`/`Audio` giả; Safari/Firefox/màn cảm ứng thật; mã Apps Script trong repo có khớp bản đang chạy hay không.
- **Rủi ro đã chấp nhận**: proxy `/api/*` chưa xác thực từng người dùng nên ai biết URL đều đọc/ghi được (secret chỉ chặn gọi thẳng Apps Script). Người dùng biết và chấp nhận; nếu muốn siết thêm cần thiết kế đăng nhập, là việc riêng.
- Đừng gọi endpoint production để thử ghi/xóa, đừng xóa LocalStorage hay dữ liệu cloud khi kiểm tra.

## 11. Tài liệu trong repo và độ tin cậy

| File | Nội dung | Độ mới |
|---|---|---|
| `AGENTS.md` | Quy tắc bảo trì, kiến trúc, an toàn dữ liệu | Phần lớn đúng; dòng nói Vocabulary protocol "chưa triển khai production" **có thể đã cũ** (ngày 24/11 đã triển khai Vercel/Apps Script; chưa đối chiếu riêng backend Vocabulary) |
| `docs/PROJECT_CONTEXT.md` | Bản đồ file, luồng học, test | Dựa trên ảnh chụp trước ngày 24/11; có chỗ ghi "chưa deploy" đã cũ; **chưa nói** tới quiz feedback, theme, review-notes |
| `docs/HANDOFF.md` | Nhật ký bàn giao theo mục (mới nhất ở trên cùng: mục 17) | Đầu file ghi "chưa push/deploy" — **đã cũ** |
| `docs/BAO-CAO-PHAN-TICH-WEB.md`, `docs/BAO-CAO-SUA-LOI.md` | Báo cáo phân tích và 17 mục sửa | Chính xác cho thời điểm 24/11 chiều |
| `docs/THEME-ANIMATION.md` | Theme/animation do Gemini | Đúng |
| `docs/QUIZ-FEEDBACK.md` | Quiz feedback do Gemini | Đúng trừ vị trí ảnh (mục 4) |
| `docs/VOCABULARY-RECOVERY.md`, `STRUCTURES-SYNC-SETUP.md`, `GRAMMAR-VSTEP.md` | Runbook phục hồi, thiết lập, prompt VSTEP | Dùng khi cần |

Khi cập nhật tài liệu: chỉ ghi điều đã xác minh, đánh dấu phần suy luận và chưa kiểm tra (đúng quy ước của `AGENTS.md`).

## 12. Hoàn tác khi có sự cố

- Mỗi lần ghép nhánh là một merge commit; hoàn tác bằng `git revert -m 1 <hash merge>` rồi `git push origin main` (Vercel tự deploy lại). Hash các merge ở mục 2.
- Chỉ thay đổi giao diện/logic; **dữ liệu trong Google Sheet không bị ảnh hưởng** bởi việc revert mã giao diện.
- Với thay đổi backend Grammar (sheet `Review`): **không** đưa Apps Script về bản cũ sau khi đã chuyển (xem HANDOFF mục 17).

## 13. Ý tưởng có thể làm tiếp (người dùng CHƯA yêu cầu)

- Lưu lựa chọn "Hiện ghi chú" qua các phiên bằng localStorage; cân nhắc giữ luôn "Hiện phân tích".
- Nếu người dùng không thích vị trí ảnh trong thẻ quiz: thử đặt ở vị trí khác (đã bỏ overlay nổi vì che đáp án).
- Giảm kích thước bundle (~507 kB) bằng code-splitting nếu muốn hết cảnh báo Vite.
- Thêm đăng nhập/xác thực người dùng cho proxy nếu sau này chia sẻ web cho người khác.
- Thêm test trình duyệt vào quy trình chạy một lệnh (hiện phải chạy từng file).
