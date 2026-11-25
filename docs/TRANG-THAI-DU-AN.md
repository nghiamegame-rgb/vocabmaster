# VocabMaster — Trạng thái dự án (bàn giao cho AI/agent phiên sau)

**Cập nhật lần cuối: 2026-11-25 buổi tối (giờ Việt Nam).** File này mô tả tình hình *hiện tại* của dự án sau hai phiên làm việc dài (24/11 và đêm 24→25/11). Nếu nó mâu thuẫn với `docs/HANDOFF.md`, `docs/PROJECT_CONTEXT.md` hay `docs/QUIZ-FEEDBACK.md`, **file này và mã nguồn thật thắng** (các file kia có chỗ đã cũ, xem mục 11).

## 0. Người dùng và cách làm việc

- Chủ dự án tên **Nghĩa**, **không phải lập trình viên**, giao tiếp **tiếng Việt**. Giải thích ngắn, từng bước đơn giản, đưa lệnh chép-dán được. Tránh thuật ngữ nếu không cần.
- Web là SPA học tiếng Anh "VocabMaster" (thư mục `C:\web toiec`, tên package `web-toiec`). Mục tiêu học hiện tại là **VSTEP B1–B2** (chữ "TOEIC" chỉ còn ở dữ liệu cũ).
- Quy trình quen thuộc: AI (Claude Code hoặc Gemini) sửa mã **trên một nhánh** và push nhánh đó → người dùng tự **ghép nhánh vào `main` và push** bằng terminal → Vercel tự deploy `main`. Không tự merge/push/deploy `main` nếu người dùng chưa bảo.

## 1. Tóm tắt trong một phút

- Web đang chạy production trên **Vercel** (tự deploy từ nhánh `main` của repo GitHub `nghiamegame-rgb/vocabmaster`, repo private) và đồng bộ dữ liệu qua **Google Apps Script + Google Sheets**.
- Ngày 24/11 đã hoàn thành và ghép vào `main`: (1) 17 mục sửa lỗi theo báo cáo phân tích; (2) triển khai Vercel + Apps Script; (3) nâng cấp giao diện "Midnight Indigo & Glass Slate" kèm hiệu ứng; (4) Smart Quiz Multiple Choice tự đọc từ đúng và hiện ảnh; (5) chuyển khung ảnh vào trong thẻ câu hỏi; (6) Grammar → Ôn tập giữ trạng thái "Hiện ghi chú" khi sang câu tiếp.
- Không có việc dở dang về mã. Việc còn mở chủ yếu là việc người dùng tự làm (mục 9) và vài điều chưa được xác minh (mục 10).
- **Ngày 25/11 (đã ghép vào `main`, đã push, người dùng báo web chạy chuẩn):** nút "Tự mở bàn phím" ở Listening và chip thông báo đồng bộ trong thanh menu (mục 3a); phân tích quy mô/chi phí khi lên ~5.000 từ (mục 14).
- **Ngày 25/11 (tối), nhánh `feat/voice-picker` — chỉ có trên máy, CHƯA push, CHƯA ghép:** chọn giọng đọc, tốc độ và "Chế độ thi (giọng ngẫu nhiên)" cho Dictation + Listening. Xem mục 3c.
- **Ngày 25/11 (chiều), `feat/dictation` — đã ghép vào `main` (fast-forward `98b5ba3`, 20:50) và đã push (trạng thái Vercel chưa kiểm tra):** tab mới **Dictation** (luyện nghe chép chính tả), đồng bộ Google Sheet riêng (người dùng tự cài theo `docs/DICTATION-SETUP.md`), Listening thêm nguồn "Từ chép chính tả". Xem mục 3b.
- **Gợi ý bắt đầu ngày mai:** xem mục 15. Chưa có việc nào được người dùng giao sẵn.

## 2. Trạng thái git và triển khai

Đọc từ `git` tối 25/11: `main` = `origin/main` = `98b5ba3` (ghép fast-forward `feat/dictation` lúc 20:50). Nhánh đang làm việc: `feat/voice-picker` (tách từ `98b5ba3`).

Bảng dưới là ảnh chụp cũ lúc ~01:15 ngày 25/11:

| Mục | Giá trị |
|---|---|
| Nhánh hiện tại | `main` |
| `main` = `origin/main` | `f4e19dd` — ghép kiểu **fast-forward** (không có merge commit) lúc 01:04 ngày 25/11 và đã push. Gồm 3 commit: `f19518e` (nút Tự mở bàn phím), `576ed98` (chip đồng bộ), `f4e19dd` (tài liệu) |
| Các merge trước đó trên `main` | `99a25d6` (fix/review-notes-persist, 00:01 ngày 25/11) · `8bffdbd` (fix/quiz-image-slot, 23:24) · `e0028c8` (feat/quiz-feedback, 23:06) · `70c0cc4` (fix/audit-2026-11, 18:16 ngày 24/11) |
| Nhánh phụ | Đã ghép vào `main` (theo reflog): `feat/quiz-feedback` (đã chứa `feat/theme-animation`), `fix/quiz-image-slot`, `fix/review-notes-persist`, `fix/listening-autofocus-sync-toast`, `fix/audit-2026-11` (đầu nhánh hiện `b78928a`; chưa đối chiếu có commit nào sau merge `70c0cc4` hay không). `feature/toeic-grammar` là nhánh cũ (merge ngày 02/11): bản local `a87d6be` khác bản `origin` `4a4aff0` — **đừng xóa hay force-push khi chưa kiểm tra**. Tham chiếu git nằm trong `.git/packed-refs` (file `refs/heads/main` loose có thể không tồn tại — bình thường). Các nhánh đã ghép có thể xóa, không bắt buộc |

**Cảnh báo trung thực:**
- Người dùng báo lúc ~01:10 ngày 25/11 rằng **web đã chạy chuẩn** sau khi deploy `f4e19dd` (không nói rõ đã thử riêng bàn phím/giọng đọc trên điện thoại hay chưa). Mình chưa tự xem được trang Vercel Deployments (repo private, không có Vercel CLI) nên không có bằng chứng độc lập về trạng thái "Ready".
- Tài liệu (`TRANG-THAI-DU-AN.md`, con trỏ trong `AGENTS.md`/`HANDOFF.md`) đã được commit trong `f4e19dd`. Bản chỉnh sửa tài liệu ngày 25/11 lúc ~01:15 (file này) **có thể chưa commit** — chạy `git status`; nếu `docs/TRANG-THAI-DU-AN.md` hiện "modified" thì `git add docs` → `git commit -m "Docs: cập nhật trạng thái dự án"` → `git push origin main`.
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

Tách từ `main` `99a25d6`. **Đã ghép vào `main` (fast-forward → `f4e19dd`) và push lúc 01:04 ngày 25/11**; Vercel đã deploy và người dùng báo web chạy chuẩn.

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

## 3b. Việc ngày 25/11 (chiều) — nhánh `feat/dictation` (đã ghép vào `main`)

Tách từ `main` `f4e19dd`; 3 commit mã + 1 commit tài liệu. Chi tiết kỹ thuật: [DICTATION.md](DICTATION.md).

1. **Tab Dictation** (commit `054b013`): 3 mục Luyện nghe · Từ đã lưu · Thư viện bài; chip từ mở khi gõ đúng, lưu từ bằng bookmark, lưới câu, phím tắt (Enter, Ctrl+Enter, Shift+Enter, Ctrl+↑/↓, Ctrl+/), tốc độ 0.75/1/1.25×, nút "Tự mở bàn phím" dùng chung với Listening. Kho riêng `vocabmaster_dictation_*`, xoá = tombstone. Thanh menu có 7 tab: **chữ trên tab giờ chỉ hiện từ 1280 px** (trước là 1024 px) và lề tab hẹp hơn dưới 360 px để không tràn.
2. **Đồng bộ Google Sheet** (commit `18bd71c`): `dictation-apps-script.js` (dự án Apps Script + Sheet riêng, tab "Từ vựng", "Câu hoàn chỉnh", "Meta", "Sao lưu"), proxy `api/dictation-sync.js` (env `DICTATION_APPS_SCRIPT_URL`, `DICTATION_SYNC_SECRET`), trạng thái trong tab, xuất Excel 2 sheet, bản sao .json. **Người dùng chưa tạo Sheet/Apps Script/env** → trên web thật tab sẽ báo "Chưa cài đặt đồng bộ" tới khi làm theo `docs/DICTATION-SETUP.md`.
3. **Listening** (commit `743efbc`): chọn "Nguồn: Từ vựng chính | Từ chép chính tả"; nguồn mới ẩn bộ lọc Level/Type/Khó/Due, đọc từ đơn, gõ lại, "Chỉ từ hay sai"; chỉ cộng bộ đếm nghe trên từ Dictation, không đụng Vocabulary/L1–L5.
4. Bundle chính 509 → 529 kB (gzip 152 → 159 kB); tab Dictation và phần nghe từ Dictation là chunk tải lười riêng (35 kB + 5 kB).

## 3c. Việc ngày 25/11 (tối) — nhánh `feat/voice-picker`

Tách từ `main` `98b5ba3`. Chưa push, chưa ghép, chưa deploy. Chi tiết: [DICTATION.md](DICTATION.md) mục 10.

- Nút "Giọng đọc" (Dictation và Listening): danh sách giọng tiếng Anh của máy (tên + accent, Natural/Online lên đầu), "Nghe thử", thanh tốc độ 0.8–1.1 (mặc định 0.9), công tắc "Chế độ thi".
- Chế độ thi: mỗi câu/mỗi lượt nghe mới một giọng khác giọng trước; nghe lại giữ giọng; tốc độ lệch ±0.05; ưu tiên Mỹ/Anh/Úc/Canada/Ấn Độ, bỏ giọng "đồ chơi" của Apple. Không đổi pitch. Dùng Google dự phòng thì bỏ qua và có ghi chú.
- Lưu ở `vocabmaster_voice_prefs` (theo `voiceURI` + tên), chỉ trên máy, không đồng bộ.
- `playAudio` thêm tuỳ chọn `voice`; các chỗ gọi cũ (Flashcard, Vocabulary, Smart Quiz) không đổi.

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
- **Thanh menu gần kín chỗ**: từ 25/11 (nhánh `feat/dictation`) có 7 tab; chữ trên tab chỉ hiện từ `xl` (1280 px), dưới 360 px lề tab là `px-1`. Thêm tab hay chữ vào navbar thì chạy lại `navbar-sync-chip-browser` (đo tràn ngang ở 1280/1024/768/640/375/320 px).
- **Python cho test Excel**: `grammar-export` và `grammar-export-browser` gọi lệnh `python`. Ngày 25/11 lệnh `python` trên máy trỏ vào lối tắt Microsoft Store (chưa cài) nên hai test này hỏng vì môi trường; Python thật cài qua `uv` (`py` chạy được). Khi chạy test, thêm thư mục của `py -c "import sys,os;print(os.path.dirname(sys.executable))"` vào đầu PATH.
- **Listening tự focus ô gõ (khi bật) sẽ cuộn trang** tới ô gõ; test đo bố cục cần `scrollTo(0, 0)` trước.
- **Đọc giọng**: Dictation/Listening gọi `speakWithSettings` (`voiceSpeech.js`); chỗ khác gọi thẳng `playAudio` và phải giữ nguyên hành vi (giọng en-US mặc định, 0.9). `speechSynthesis` giả trong test cũ không có `addEventListener`; `audio.js` chỉ dùng `onvoiceschanged` (một chủ sở hữu) — muốn nghe thay đổi thì `subscribeVoices`.
- **`.vm-page-enter` dùng `transform`**, nên phần tử `position: fixed` bên trong sẽ neo theo nó chứ không theo cửa sổ. Đây là lý do overlay quiz bị lệch trên điện thoại và đã bỏ overlay.
- **Không đổi layout/DOM của khối gạch chân và ghi chú Grammar**: `sentenceGeometry.js`, `UnderlinedSentence.jsx`, `SentenceNoteEditor.jsx`, `UnderlineToolbar.jsx`, `GrammarReadingNotes.jsx` đo hình học DOM thật; chỉ sửa logic/state, không đổi cấu trúc.
- Ảnh Unsplash/dịch vụ ảnh ngoài đã bỏ; từ không có ảnh dùng `WordInitialTile`.
- `error.log` (101 byte) ở gốc repo là rác cũ, không quan trọng.

## 8. Chạy và kiểm tra

- Lệnh: `npm.cmd run dev` · `npm.cmd run build` · `npm.cmd run lint` · `npm.cmd test`.
- **`npm test`** chạy **39 file test Node** trên `feat/voice-picker` (37 trên `main`), không cần trình duyệt, không có framework, qua `test/run-node-tests.js`. Lần cuối ghi nhận (25/11 tối, `feat/voice-picker`, có Python trong PATH): 39/39 đạt.
- **Test trình duyệt (Playwright + Edge headless) KHÔNG nằm trong `npm test`** — chạy riêng từng file `node test/<tên>.test.js`. Hiện có 16 trên `feat/voice-picker`: `grammar-corpus-browser`, `grammar-export-browser`, `grammar-review-browser`, `grammar-topic-browser`, `sentence-notes-browser`, `underline-rendering`, `vocab-quota-browser`, `vocab-star-browser`, `vocab-sync-browser`, `quiz-feedback-browser`, `grammar-review-notes-persist-browser`, `listening-autofocus-browser`, `navbar-sync-chip-browser`, `dictation-browser`, `dictation-sync-browser`, `voice-settings-browser`. Lần cuối Claude Code chạy (25/11 tối): 16/16 đạt. Cách thiết lập Playwright: HANDOFF (cài vào thư mục TEMP, không vào repo).
- **Lint**: 0 lỗi, 34 cảnh báo (mốc cơ sở; đừng làm tăng). **Build** (`feat/voice-picker`): JS chính ~540 kB + chunk Dictation ~36 kB, CSS ~108 kB (Vite cảnh báo vượt 500 kB, đã biết).
- Test Grammar/annotation dùng mô phỏng; "pass" không chứng minh sync thật.
- Mình (Claude trong chat) không có shell trên máy người dùng nên **không tự chạy lại test**; kết quả test do Claude Code/Gemini báo, mình chỉ duyệt diff.

## 9. Việc còn mở (người dùng tự làm hoặc cần xác nhận)

1. ~~Xác nhận deploy mới nhất của `main`~~ — người dùng báo web chạy chuẩn (25/11 ~01:10). Vẫn nên thử riêng trên điện thoại: nút "Tự mở bàn phím" (mặc định phải là Tắt), giọng đọc quiz, Grammar → Ôn tập giữ ghi chú.
2. Trên mọi thiết bị: đóng tab web cũ, tải lại cứng (Ctrl+F5) để khỏi chạy frontend cũ (thiết bị cũ có thể làm câu Grammar đã xóa hiện lại).
3. Xóa các dự án Apps Script thừa/rác (gồm backend Vocabulary cũ). Chỉ xóa sau khi chắc chắn không còn dùng.
4. Kiểm tra repo GitHub đang ở chế độ **Private**.
5. ~~Commit và push các file tài liệu mới (mục 2).~~ Đã commit (`f4e19dd`) và vào `main` cùng lần ghép 25/11.
6. ~~Ghép nhánh `fix/listening-autofocus-sync-toast`~~ — đã ghép và push (25/11 01:04).
7. ~~Commit bản cập nhật tài liệu~~: các sửa đổi ~01:15 của file này đã được commit cùng tài liệu Dictation trên nhánh `feat/dictation` (sẽ vào `main` khi ghép).
8. Dictation: ~~ghép vào `main` và push~~ (xong 25/11). Còn: tự cài đồng bộ theo `docs/DICTATION-SETUP.md` (Sheet, Apps Script, Script Property, 2 biến Vercel, redeploy) — chưa biết đã làm chưa; thử trên điện thoại.
9. Giọng đọc: ghép `feat/voice-picker` vào `main`, push, rồi nghe thử giọng thật trên máy tính và điện thoại (đặc biệt Chế độ thi).

## 10. Chưa xác minh / rủi ro đã chấp nhận

- **Chưa xác minh (giọng đọc, 25/11 tối)**: giọng thật trên Windows/Edge/Chrome/điện thoại (test dùng danh sách giọng giả); chất lượng giọng Natural/Online khi mất mạng; Safari/iOS; câu dài với giọng Google của Chrome có thể bị ngắt (hiện tượng đã biết của Chrome, chưa thử).
- **Chưa xác minh (Dictation, 25/11 chiều)**: đồng bộ với Apps Script/Vercel/Sheet **thật** (chỉ test bằng Apps Script chạy trong VM + route giả); giọng đọc thật và tốc độ 0.75/1.25× trên điện thoại; Safari/Firefox; phím tắt trên Mac (Ctrl+↑ có thể trùng Mission Control).
- **Chưa xác minh (25/11)**: bàn phím **thật** trên điện thoại khi bật/tắt "Tự mở bàn phím" (chỉ test Edge headless giả lập cảm ứng; iOS Safari thường không tự bật bàn phím khi `focus()` không do người dùng chạm, Android Chrome thường có — đây là suy luận, chưa thử); chip đồng bộ trên máy thật/Safari/Firefox.
- **Chưa xác minh**: trạng thái "Ready" của Vercel Deployments (chỉ có lời người dùng nói web chạy chuẩn); giọng đọc **thật** trên điện thoại (iOS Safari, Android Chrome) — chỉ test với `speechSynthesis`/`Audio` giả; Safari/Firefox/màn cảm ứng thật; mã Apps Script trong repo có khớp bản đang chạy hay không.
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

- Ghép nhánh bằng merge commit: hoàn tác bằng `git revert -m 1 <hash merge>` rồi `git push origin main` (Vercel tự deploy lại). Hash các merge ở mục 2.
- **Ngoại lệ — lần ghép 25/11 là fast-forward, không có merge commit** nên `-m 1` không dùng được. Hoàn tác phần mã bằng `git revert --no-edit 576ed98 f19518e` rồi `git push origin main` (giữ nguyên commit tài liệu `f4e19dd`).
- Chỉ thay đổi giao diện/logic; **dữ liệu trong Google Sheet không bị ảnh hưởng** bởi việc revert mã giao diện.
- Với thay đổi backend Grammar (sheet `Review`): **không** đưa Apps Script về bản cũ sau khi đã chuyển (xem HANDOFF mục 17).

## 13. Ý tưởng có thể làm tiếp (người dùng CHƯA yêu cầu)

- Lưu lựa chọn "Hiện ghi chú" qua các phiên bằng localStorage; cân nhắc giữ luôn "Hiện phân tích".
- Nếu người dùng không thích vị trí ảnh trong thẻ quiz: thử đặt ở vị trí khác (đã bỏ overlay nổi vì che đáp án).
- Giảm kích thước bundle (~507 kB) bằng code-splitting nếu muốn hết cảnh báo Vite.
- Thêm đăng nhập/xác thực người dùng cho proxy nếu sau này chia sẻ web cho người khác.
- Thêm test trình duyệt vào quy trình chạy một lệnh (hiện phải chạy từng file).
- Cho Smart Quiz → Listening & Typing dùng chung nút "Tự mở bàn phím" (hiện vẫn tự focus ô gõ mỗi câu, xem mục 3a).
- Cảnh báo trong app khi dữ liệu gần chạm giới hạn ở mục 14; cơ chế dọn snapshot Vocabulary cũ trên Drive.

## 14. Quy mô và chi phí khi dữ liệu lớn (phân tích 25/11, người dùng hỏi về ~5.000 từ vựng + ngữ pháp)

**Chi phí:** web dùng Vercel **Hobby (miễn phí)**. Hobby không tự tính tiền khi vượt hạn mức; dịch vụ bị tạm dừng tới khi mức dùng trong cửa sổ 30 ngày giảm xuống (https://vercel.com/docs/accounts/plans/hobby). Chỉ mất tiền nếu người dùng tự nâng lên Pro. Hobby chỉ cho dùng cá nhân, phi thương mại (https://vercel.com/docs/plans/hobby-plan).

**Mức dùng ngày 25/11** (ảnh chụp Vercel, 30 ngày, đã gồm nhiều deploy/test): Fast Origin Transfer 630 MB / 10 GB (cao nhất, ~6%); Function Invocations 8,6K / 1M; Fluid Active CPU 10 phút 33 giây / 4 giờ; Fast Data Transfer 498 MB / 100 GB; CDN Requests 9,3K / 1M; Deployment Storage 21 MB / 10 GB.

**Giới hạn kỹ thuật (không phải tiền) cần nhớ khi dữ liệu lớn — đọc từ mã, kích thước thật chưa đo:**
1. **Grammar: `MAX_QUESTIONS = 5000`** trong `grammar-apps-script.js` — backend từ chối ghi khi `savedQuestions` vượt 5.000 (chưa kiểm tra tombstone câu đã xóa có tính vào không). Muốn lớn hơn phải sửa hằng số và triển khai lại Apps Script (việc cần người dùng cho phép).
2. **Vocabulary: tối đa 20.000 mục** (từ + tombstone) trong `google-apps-script.js`; 5.000 từ là ổn.
3. **Vercel Functions giới hạn body 4,5 MB cho cả request lẫn response** (https://vercel.com/docs/errors/FUNCTION_PAYLOAD_TOO_LARGE). App gửi/nhận cả kho dữ liệu trong một lượt qua `/api/vocab-sync` và `/api/grammar-sync`. Ước tính (chưa đo): 5.000 từ ≈ 1,5–2,5 MB (OK); câu Grammar có phân tích dài hơn mỗi mục nên có thể chạm 4,5 MB trước khi đủ 5.000 câu. Chạm giới hạn thì đồng bộ báo lỗi (không tính tiền); cách chữa là đổi thiết kế (chia nhỏ/nén).
4. **Fast Origin Transfer** là hạn mức nên theo dõi đầu tiên: mỗi lần đồng bộ tải cả kho nên tăng gần tỉ lệ với kích thước dữ liệu (suy luận, chưa đo).
5. **Google Drive**: backend Vocabulary tạo thêm một file `Vocabulary-<generation>-r<revision>.json` mỗi lần lưu và **không xóa file cũ** (chú thích đầu `google-apps-script.js`). Với dữ liệu vài MB và lưu nhiều lần mỗi ngày có thể chiếm vài GB/năm trong 15 GB Drive miễn phí. Chưa gấp; cần cơ chế dọn bản cũ (việc riêng, phải giữ bản mới nhất và các bản archive/conflict).

**Cách đo thật:** xem dung lượng một file `Vocabulary-*.json` trong Drive rồi chia cho số từ; đếm số hàng sheet `SavedQuestions` (= số câu Grammar đã lưu); theo dõi Fast Origin Transfer ở Vercel → Usage.

## 15. Gợi ý bắt đầu ngày mai (người dùng CHƯA giao việc nào)

Theo thứ tự hợp lý, chỉ làm khi người dùng đồng ý:
1. Hỏi người dùng đã thử trên điện thoại chưa: nút "Tự mở bàn phím" (mặc định Tắt trên điện thoại), giọng đọc quiz, ghi chú Ôn tập; có gì khó chịu thì sửa trước.
2. Smart Quiz → Listening & Typing vẫn tự bật bàn phím mỗi câu: đề xuất dùng chung nút tắt với Listening (nhánh riêng, prompt cho Claude Code).
3. Nếu người dùng thấy dữ liệu đang lớn lên nhanh: đo kích thước thật (mục 14), rồi cân nhắc cảnh báo gần giới hạn / nâng `MAX_QUESTIONS` / dọn snapshot Drive.
4. Dọn các việc tay còn mở ở mục 9 (Apps Script rác, repo Private, Ctrl+F5 mọi thiết bị).
