# VocabMaster — Trạng thái dự án (bàn giao cho AI/agent phiên sau)

**Cập nhật lần cuối: 2026-11-26 ~01:50 (giờ Việt Nam).** File này mô tả tình hình *hiện tại* của dự án sau các phiên làm việc dài (24/11, đêm 24→25/11 và 25/11 chiều–đêm). Nếu nó mâu thuẫn với `docs/HANDOFF.md`, `docs/PROJECT_CONTEXT.md` hay `docs/QUIZ-FEEDBACK.md`, **file này và mã nguồn thật thắng** (các file kia có chỗ đã cũ, xem mục 11).

## 0. Người dùng và cách làm việc

- Chủ dự án tên **Nghĩa**, **không phải lập trình viên**, giao tiếp **tiếng Việt**. Giải thích ngắn, từng bước đơn giản, đưa lệnh chép-dán được. Tránh thuật ngữ nếu không cần.
- Web là SPA học tiếng Anh "VocabMaster" (thư mục `C:\web toiec`, tên package `web-toiec`). Mục tiêu học hiện tại là **VSTEP B1–B2** (chữ "TOEIC" chỉ còn ở dữ liệu cũ).
- Quy trình quen thuộc: AI (Claude Code hoặc Gemini) sửa mã **trên một nhánh** và push nhánh đó → người dùng tự **ghép nhánh vào `main` và push** bằng terminal → Vercel tự deploy `main`. Không tự merge/push/deploy `main` nếu người dùng chưa bảo.
- Với việc lớn, Claude (trong chat) viết **prompt cho Claude Code** (chia 2–3 giai đoạn, nhánh riêng `feat/...`, có mục "KHÔNG ĐƯỢC ĐỤNG"); người dùng gửi cho Claude Code rồi dán báo cáo lại; Claude (chat) kiểm tra bản chạy thật bằng trình duyệt tích hợp. Skill `vocabmaster-deploy` có sẵn cho việc triển khai Vercel/Apps Script.
- Người dùng cho phép Claude thao tác Vercel/Google Sheet/Apps Script thay mình bằng trình duyệt (đã đăng nhập sẵn), **trừ việc gõ secret/mật khẩu: người dùng tự dán** (đã làm với secret Dictation). Người dùng muốn ghi chú tiến độ nằm trong các file `.md` của thư mục dự án để AI/agent phiên sau đọc tiếp.

## 1. Tóm tắt trong một phút

- Web đang chạy production trên **Vercel** (tự deploy từ nhánh `main` của repo GitHub `nghiamegame-rgb/vocabmaster`, repo private) và đồng bộ dữ liệu qua **Google Apps Script + Google Sheets**.
- Ngày 24/11 đã hoàn thành và ghép vào `main`: (1) 17 mục sửa lỗi theo báo cáo phân tích; (2) triển khai Vercel + Apps Script; (3) nâng cấp giao diện "Midnight Indigo & Glass Slate" kèm hiệu ứng; (4) Smart Quiz Multiple Choice tự đọc từ đúng và hiện ảnh; (5) chuyển khung ảnh vào trong thẻ câu hỏi; (6) Grammar → Ôn tập giữ trạng thái "Hiện ghi chú" khi sang câu tiếp.
- Không có việc dở dang về mã. Việc còn mở chủ yếu là việc người dùng tự làm (mục 9) và vài điều chưa được xác minh (mục 10).
- **Ngày 25/11 (đã ghép vào `main`, đã push, người dùng báo web chạy chuẩn):** nút "Tự mở bàn phím" ở Listening và chip thông báo đồng bộ trong thanh menu (mục 3a); phân tích quy mô/chi phí khi lên ~5.000 từ (mục 14).
- **Ngày 25/11 (chiều → đêm): toàn bộ phần Dictation đã ghép vào `main`, đã push và đang chạy trên production (kiểm tra 26/11 ~01:45).** Bốn nhánh `feat/dictation`, `feat/voice-picker`, `feat/export-sentences-only`, `feat/dictation-word-listening` → `main` = `origin/main` = `652765f`. Vercel: bản Production mới nhất là `652765f` ("Dictation: nút Sao chép prompt cho AI"), trạng thái **Ready** (mục 2). Gồm: tab **Dictation** (mục 3b), chọn giọng đọc + Chế độ thi (3c), file Excel chỉ chứa câu tiếng Anh (16), luyện nghe từ đã lưu trong Dictation + nút sao chép prompt cho AI (17).
- **Dictation đã được cài đặt đồng bộ Google Sheet thật (25/11 tối)** theo `docs/DICTATION-SETUP.md`: Sheet "VocabMaster - Dictation", Apps Script "VocabMaster - Dictation Backend" (Web app, deployment "Dictation v1"), Script Property `DICTATION_SYNC_SECRET`, 2 biến Vercel `DICTATION_APPS_SCRIPT_URL` + `DICTATION_SYNC_SECRET` (Production, loại Secret). Production hiện dòng "Đã đồng bộ với Google Sheet." và Sheet đã nhận bản ghi thật. Chi tiết và bằng chứng: mục 18. **Secret và URL Web app không ghi trong tài liệu.**
- **Gợi ý bắt đầu ngày mai:** xem mục 15. Chưa có việc nào được người dùng giao sẵn.

## 2. Trạng thái git và triển khai

**Hiện tại (đọc từ `.git/logs/HEAD` và trang Vercel, 26/11 ~01:45):** `main` = `origin/main` = `652765f`, nhánh đang đứng là `main`. Chuỗi trên `main` hôm 25/11: `f4e19dd` → `98b5ba3` (FF `feat/dictation`, 20:50: commit `054b013`, `18bd71c`, `743efbc`, `6c5b7c0`, `98b5ba3`) → `d549392` (FF `feat/voice-picker`: `2ba7806`, `d549392`) → `ab94f57` (**merge commit** `feat/export-sentences-only`: `173b6a5`, `b656550`; 21:39) → `652765f` (FF `feat/dictation-word-listening`, ~22:18: `ac2a019`, `652765f`). Cả bốn nhánh Dictation đã vào `main`, có thể xóa (không bắt buộc).

**Vercel (Deployments, đọc 26/11 ~01:45 bằng trình duyệt tích hợp đã đăng nhập):** các bản **Production** từ nhánh `main` đều **Ready**: `652765f`, `ab94f57`, `98b5ba3`, `f4e19dd`, `99a25d6`, … Domain production: `vocabmaster-kappa.vercel.app`. Bản Preview cho từng nhánh `feat/*` cũng có. Dự án Vercel: `1thanhvien/vocabmaster`.

Bảng dưới là **ảnh chụp cũ lúc ~01:15 ngày 25/11 (chỉ để tham khảo lịch sử; hash `main` đã đổi, xem đoạn trên)**:

| Mục | Giá trị |
|---|---|
| Nhánh hiện tại | `main` |
| `main` = `origin/main` | `f4e19dd` — ghép kiểu **fast-forward** (không có merge commit) lúc 01:04 ngày 25/11 và đã push. Gồm 3 commit: `f19518e` (nút Tự mở bàn phím), `576ed98` (chip đồng bộ), `f4e19dd` (tài liệu) |
| Các merge trước đó trên `main` | `99a25d6` (fix/review-notes-persist, 00:01 ngày 25/11) · `8bffdbd` (fix/quiz-image-slot, 23:24) · `e0028c8` (feat/quiz-feedback, 23:06) · `70c0cc4` (fix/audit-2026-11, 18:16 ngày 24/11) |
| Nhánh phụ | Đã ghép vào `main` (theo reflog): `feat/quiz-feedback` (đã chứa `feat/theme-animation`), `fix/quiz-image-slot`, `fix/review-notes-persist`, `fix/listening-autofocus-sync-toast`, `fix/audit-2026-11` (đầu nhánh hiện `b78928a`; chưa đối chiếu có commit nào sau merge `70c0cc4` hay không). `feature/toeic-grammar` là nhánh cũ (merge ngày 02/11): bản local `a87d6be` khác bản `origin` `4a4aff0` — **đừng xóa hay force-push khi chưa kiểm tra**. Tham chiếu git nằm trong `.git/packed-refs` (file `refs/heads/main` loose có thể không tồn tại — bình thường). Các nhánh đã ghép có thể xóa, không bắt buộc |

**Cảnh báo trung thực:**
- Trạng thái "Ready" của Vercel **đã được kiểm tra độc lập ngày 26/11** (xem đoạn trên). Người dùng cũng báo web chạy ổn sau mỗi lần ghép (ảnh chụp màn hình tab Dictation, Từ đã lưu, Thư viện bài trên production). Chưa có ai báo đã thử riêng trên **điện thoại thật** (mục 10).
- Tài liệu: các commit tài liệu của Claude Code đã vào `main` (tới `652765f`). **Bản cập nhật tài liệu 26/11 (Claude chat ghi thẳng vào file, gồm file này, `docs/HANDOFF.md`, `docs/DICTATION.md`, `docs/DICTATION-SETUP.md`) có thể chưa commit** — chạy `git status`; nếu các file đó hiện "modified" thì `git add docs` → `git commit -m "Docs: cập nhật trạng thái dự án 26/11"` → `git push origin main`. Nên commit trước khi ghép nhánh mới, vì nhánh của Claude Code cũng sửa `TRANG-THAI-DU-AN.md` và Git sẽ chặn ghép nếu file đang sửa dở chưa commit.
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
2. **Đồng bộ Google Sheet** (commit `18bd71c`): `dictation-apps-script.js` (dự án Apps Script + Sheet riêng, tab "Từ vựng", "Câu hoàn chỉnh", "Meta", "Sao lưu"), proxy `api/dictation-sync.js` (env `DICTATION_APPS_SCRIPT_URL`, `DICTATION_SYNC_SECRET`), trạng thái trong tab, xuất Excel 2 sheet, bản sao .json. **Đã cài đặt thật ngày 25/11 tối** (mục 18); trên production dòng trạng thái hiện "Đã đồng bộ với Google Sheet.". Nếu một bản deploy thiếu 2 biến Vercel thì tab báo "Chưa cài đặt đồng bộ".
3. **Listening** (commit `743efbc`): chọn "Nguồn: Từ vựng chính | Từ chép chính tả"; nguồn mới ẩn bộ lọc Level/Type/Khó/Due, đọc từ đơn, gõ lại, "Chỉ từ hay sai"; chỉ cộng bộ đếm nghe trên từ Dictation, không đụng Vocabulary/L1–L5.
4. Bundle chính 509 → 529 kB (gzip 152 → 159 kB); tab Dictation và phần nghe từ Dictation là chunk tải lười riêng (35 kB + 5 kB).

## 3c. Việc ngày 25/11 (tối) — nhánh `feat/voice-picker` (đã vào `main`)

Tách từ `main` `98b5ba3`. **Đã ghép vào `main` (fast-forward `d549392`) và deploy cùng `ab94f57`.** Chi tiết: [DICTATION.md](DICTATION.md) mục 10.

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
- **Phần lõi Listening dùng chung** (`src/components/listening/`): đổi `useListeningGame`/`ListeningParts` là đổi cả Listening Review lẫn Dictation → Từ đã lưu; chạy `listening-autofocus-browser`, `voice-settings-browser`, `vocab-star-browser`, `dictation-word-practice-browser`. Vòng chơi phân biệt bằng `round.key`, không có thì bằng id từ đúng (Listening giữ cách cũ).
- **Đọc giọng**: Dictation/Listening gọi `speakWithSettings` (`voiceSpeech.js`); chỗ khác gọi thẳng `playAudio` và phải giữ nguyên hành vi (giọng en-US mặc định, 0.9). `speechSynthesis` giả trong test cũ không có `addEventListener`; `audio.js` chỉ dùng `onvoiceschanged` (một chủ sở hữu) — muốn nghe thay đổi thì `subscribeVoices`.
- **`.vm-page-enter` dùng `transform`**, nên phần tử `position: fixed` bên trong sẽ neo theo nó chứ không theo cửa sổ. Đây là lý do overlay quiz bị lệch trên điện thoại và đã bỏ overlay.
- **Không đổi layout/DOM của khối gạch chân và ghi chú Grammar**: `sentenceGeometry.js`, `UnderlinedSentence.jsx`, `SentenceNoteEditor.jsx`, `UnderlineToolbar.jsx`, `GrammarReadingNotes.jsx` đo hình học DOM thật; chỉ sửa logic/state, không đổi cấu trúc.
- Ảnh Unsplash/dịch vụ ảnh ngoài đã bỏ; từ không có ảnh dùng `WordInitialTile`.
- `error.log` (101 byte) ở gốc repo là rác cũ, không quan trọng.

## 8. Chạy và kiểm tra

- Lệnh: `npm.cmd run dev` · `npm.cmd run build` · `npm.cmd run lint` · `npm.cmd test`.
- **`npm test`** chạy **file test Node** không cần trình duyệt, không có framework, qua `test/run-node-tests.js` (40 trên `main`; xem mục 17 cho nhánh đang làm). Cần Python trong PATH.
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
8. Dictation: ~~ghép vào `main` và push~~ (xong 25/11) và ~~cài đồng bộ Sheet/Apps Script/Vercel~~ (xong 25/11 tối, mục 18). Còn: thử trên **điện thoại thật** (đồng bộ giữa thiết bị, lưu từ, phím).
9. Giọng đọc: ~~ghép và push~~ (xong 25/11). Còn: nghe thử giọng thật trên điện thoại (đặc biệt Chế độ thi); trên máy tính người dùng đã thấy danh sách giọng (Google US/UK, Microsoft David/Mark/Zira).
10. ~~Ghép `feat/dictation-word-listening` vào `main`, push~~ (xong, `652765f`). Còn: thử luyện nghe từ đã lưu và nút "Sao chép prompt cho AI" trên điện thoại.
11. Commit và push các sửa tài liệu 26/11 nếu `git status` còn báo modified (mục 2).
12. Google Drive: lần thao tác đầu ngày 25/11 có thể tạo nhầm một Google Sheet trống "Bảng tính không có tiêu đề"; 26/11 tìm bằng connector Drive không thấy file nào (chưa chắc tuyệt đối). Nếu người dùng thấy trong Drive thì xóa file trống đó, **không** xóa "VocabMaster - Dictation".

## 10. Chưa xác minh / rủi ro đã chấp nhận

- **Chưa xác minh (giọng đọc, 25/11 tối)**: giọng thật trên Windows/Edge/Chrome/điện thoại (test dùng danh sách giọng giả); chất lượng giọng Natural/Online khi mất mạng; Safari/iOS; câu dài với giọng Google của Chrome có thể bị ngắt (hiện tượng đã biết của Chrome, chưa thử).
- **Dictation (đồng bộ thật)**: ghi/đọc Sheet **đã chạy thật** (mục 18, bằng chứng `Meta!B1` = revision 187). **Chưa xác minh**: đồng bộ giữa hai thiết bị thật (điện thoại ↔ máy tính); giọng đọc và tốc độ 0.75/1.25× trên điện thoại; Safari/Firefox; phím tắt trên Mac (Ctrl+↑ có thể trùng Mission Control).
- **Chưa xác minh (25/11)**: bàn phím **thật** trên điện thoại khi bật/tắt "Tự mở bàn phím" (chỉ test Edge headless giả lập cảm ứng; iOS Safari thường không tự bật bàn phím khi `focus()` không do người dùng chạm, Android Chrome thường có — đây là suy luận, chưa thử); chip đồng bộ trên máy thật/Safari/Firefox.
- **Chưa xác minh**: giọng đọc **thật** trên điện thoại (iOS Safari, Android Chrome) — test chỉ dùng `speechSynthesis`/`Audio` giả; Safari/Firefox/màn cảm ứng thật; mã Apps Script **Grammar/Vocabulary** trong repo có khớp bản đang chạy hay không (riêng Dictation đã đối chiếu SHA-256, mục 18). Trạng thái "Ready" của Vercel đã kiểm tra 26/11 (mục 2).
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
| `docs/DICTATION.md` | Thiết kế kỹ thuật tab Dictation (dữ liệu, chấm, đồng bộ, giọng đọc, luyện nghe từ, prompt AI) | Đúng tới `652765f` |
| `docs/DICTATION-SETUP.md` | Cài đồng bộ Dictation (Sheet, Apps Script, secret, Vercel) + đổi secret/cập nhật mã | Đúng; việc cài đã làm xong 25/11 |
| `docs/VOCABULARY-RECOVERY.md`, `STRUCTURES-SYNC-SETUP.md`, `GRAMMAR-VSTEP.md` | Runbook phục hồi, thiết lập, prompt VSTEP | Dùng khi cần |

Khi cập nhật tài liệu: chỉ ghi điều đã xác minh, đánh dấu phần suy luận và chưa kiểm tra (đúng quy ước của `AGENTS.md`).

## 12. Hoàn tác khi có sự cố

- Ghép nhánh bằng merge commit: hoàn tác bằng `git revert -m 1 <hash merge>` rồi `git push origin main` (Vercel tự deploy lại). Hash các merge ở mục 2.
- **Ngoại lệ — lần ghép 25/11 là fast-forward, không có merge commit** nên `-m 1` không dùng được. Hoàn tác phần mã bằng `git revert --no-edit 576ed98 f19518e` rồi `git push origin main` (giữ nguyên commit tài liệu `f4e19dd`).
- **Hoàn tác phần Dictation (25/11):** `ab94f57` là merge commit → `git revert -m 1 ab94f57` (bỏ cả export Excel mới); các phần còn lại vào bằng fast-forward → revert từng commit mã (ví dụ `git revert --no-edit 652765f ac2a019` cho luyện nghe từ đã lưu + nút prompt), rồi `git push origin main`. Revert mã **không** xóa dữ liệu trong Google Sheet Dictation.
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
5. Dictation: hỏi người dùng đã thử trên điện thoại chưa (đồng bộ bài, luyện nghe từ đã lưu, Chế độ thi) và giọng đọc có dễ nghe không; nếu muốn thêm giọng Úc/Canada thì phải xem danh sách giọng của thiết bị đó (hiện máy tính chỉ có giọng Mỹ và Anh). Bộ câu luyện: người dùng xuất Excel (một cột câu) → nút "Sao chép prompt cho AI" → chatbot khác viết thêm câu mức VSTEP ≤ 5 điểm (≈ A2–B1) → dán vào "Nạp bài mới".

## 16. Ngày 25/11 (đêm) — nhánh `feat/export-sentences-only`

Tách từ `main` `98b5ba3` (độc lập với `feat/voice-picker`). **Đã ghép vào `main` (merge commit `ab94f57`) và deploy.**

- Dictation → Thư viện bài → "Xuất Excel (.xlsx)": file chỉ còn **một sheet "Câu tiếng Anh", một cột, mỗi dòng một câu tiếng Anh** (bỏ câu đã xoá và câu trùng) để đưa chatbot đọc. Không có câu thì không tải file. Bản sao .json và tab trên Google Sheet không đổi.
- Kiểm tra trên nhánh này: `npm test` 38/38 (thêm `dictation-export`, cần Python), trình duyệt 16/16 (thêm `dictation-export-browser`), lint 34/0, build đạt.
- Chưa mở file bằng Excel/Google Sheets thật.
- Đã xong: người dùng ghép và push (25/11 21:39). Việc còn lại: xác nhận bằng file thật (WPS/Excel) sau khi đổi — ảnh file người dùng gửi ngày 25/11 là của bản cũ (2 sheet); bản mới (một sheet, một cột) chưa có xác nhận.

## 17. Ngày 25/11 (đêm) — nhánh `feat/dictation-word-listening`

Tách từ `main` `ab94f57`. **Đã ghép vào `main` (fast-forward `652765f`, ~22:18) và deploy; trên production có "Luyện nghe/Danh sách" trong Từ đã lưu và nút "Sao chép prompt cho AI" (kiểm tra 26/11).**

- **Phần A:** Dictation → Từ đã lưu mở thẳng "Luyện nghe" (giống Listening Review, ô chỉ có chữ, lọc theo Tên bài / hay nghe sai / chưa luyện); danh sách cũ ở tab "Danh sách". Listening Review không đổi hành vi. Chi tiết: [DICTATION.md](DICTATION.md) mục 11.
- **Phần B:** Thư viện bài có nút "Sao chép prompt cho AI" (nội dung ở `src/utils/dictationAiPrompt.js`).
- Kiểm tra sau phần B (mới nhất): `npm test` 42/42, trình duyệt 19/19, lint 32/0, build đạt. Chưa thử trên điện thoại thật.
- Kiểm tra sau phần A: `npm test` 41/41, trình duyệt 18/18 (thêm `dictation-word-practice-browser`), lint 32 cảnh báo/0 lỗi (mốc mới, đừng làm tăng), build JS chính ~541 kB + chunk Dictation ~44 kB.

## 18. Dictation — cài đặt đồng bộ thật và kiểm tra production (25–26/11)

**Đã tạo (do Claude thao tác trong trình duyệt tích hợp, người dùng đã đăng nhập sẵn; tên để tìm lại, không ghi ID/URL/secret):**
- Google Sheet **"VocabMaster - Dictation"** (tab "Từ vựng", "Câu hoàn chỉnh", "Meta", "Sao lưu" do Apps Script tự tạo).
- Dự án Apps Script **"VocabMaster - Dictation Backend"** gắn với Sheet đó; mã dán từ `dictation-apps-script.js` (đối chiếu SHA-256 sau khi dán: khớp file trong repo; file trên Windows là CRLF nên lớn hơn ~362 byte so với bản LF, nội dung giống). Triển khai **Web app** (deployment "Dictation v1"; Thực thi bằng tài khoản người dùng, Quyền truy cập: Bất kỳ ai). Script Property `DICTATION_SYNC_SECRET`.
- Vercel (`1thanhvien/vocabmaster`): 2 biến Production loại **Secret** `DICTATION_APPS_SCRIPT_URL` (URL Web app) và `DICTATION_SYNC_SECRET` (**phải trùng** Script Property). Biến chỉ có tác dụng với bản deploy **sau** khi thêm; bản `652765f` trên `main` đã dùng chúng.
- Secret do **người dùng tự dán** vào cả hai nơi (Claude không nhập secret). Claude chỉ so sánh hai nơi bằng mã băm để chắc hai giá trị giống hệt, không đọc/ghi lại secret.

**Bằng chứng kiểm tra:**
- 25/11 20:52 (Claude, trình duyệt tích hợp) và 21:43/21:44/22:19 (ảnh người dùng gửi): production, tab Dictation hiện **"Đã đồng bộ với Google Sheet."**
- 26/11 ~01:45 (Claude, đọc Sheet đã đăng nhập, chỉ lấy số liệu, không in nội dung): `Meta` có `Revision` = **187**, `Đang ghi` trống (không có lần ghi dở), `Schema` = 1; tab "Sao lưu" có bản lưu mới nhất `revision 186` lúc `2026-11-25T18:08Z` (≈ 01:08 ngày 26/11 giờ Việt Nam); hai tab "Từ vựng" và "Câu hoàn chỉnh" có hàng dữ liệu (dữ liệu thử của người dùng, không ghi số lượng vì có thể gồm hàng đã xóa). Nghĩa là đường **ghi** lên Sheet đã chạy thật, không chỉ đọc.
- Vercel Deployments: `652765f` Production **Ready** (mục 2). Trên production có các nút/tab mới: "Giọng đọc", "Từ đã lưu" → "Luyện nghe"/"Danh sách", "Thư viện bài" → "Xuất Excel (.xlsx)" và "Sao chép prompt cho AI" (kiểm tra bằng DOM, không bấm ghi dữ liệu).

**Việc cần nhớ khi sửa tiếp:**
- Sửa `dictation-apps-script.js` trong repo **không** tự cập nhật bản đang chạy: phải dán lại mã vào dự án Apps Script, lưu, rồi **Triển khai → Quản lý các bản triển khai → sửa → Phiên bản mới → Triển khai** (URL Web app giữ nguyên). Đổi cấu trúc Sheet là việc cần người dùng cho phép.
- Đổi secret: đổi Script Property **và** biến Vercel cùng một giá trị rồi deploy lại Vercel (hoặc đẩy commit mới). Lệch secret → tab báo "Máy chủ từ chối: secret … chưa khớp" (bảng lỗi trong `DICTATION-SETUP.md`).
- Đừng gọi endpoint production để thử ghi/xóa, đừng xóa dữ liệu trong Sheet hay LocalStorage khi kiểm tra. Trình duyệt tích hợp của Claude có LocalStorage riêng (trống), không phải dữ liệu thật của người dùng; chip "Vocabulary: đang tạm dừng ghi cloud / có bản sao cũ" thấy ở đó là bảo vệ dữ liệu của trình duyệt đó, đừng bấm "Bật đồng bộ thiết bị" ở đó.
- Thao tác trình duyệt tích hợp (kinh nghiệm 25/11): tab mới chỉ mở được khi chính người dùng bấm; ảnh chụp màn hình có thể cũ khi pane bị ẩn → ưu tiên `find`/`read_page` (bấm theo ref) và đọc DOM bằng JavaScript; menu Apps Script cần bấm bằng ref; ô React nhập qua native setter + sự kiện `input`/`change`; đặt lại khung nhìn bằng `resize_window` preset `desktop` khi xong.

## 19. Ngày 26/11 (chiều) — nhánh `feat/dictation-levels-simple-words` (chưa ghép `main`)

Tách từ `main` (`15ccb24`). **Chưa ghép vào `main`, chưa push, chưa deploy.**

- **Việc 1 — Chọn độ khó A1–B2 cho "Sao chép prompt cho AI":** thêm `DICTATION_LEVELS` (A1/A2/B1/B2, mặc định A2) và `buildDictationAiPrompt(levelId)` trong `src/utils/dictationAiPrompt.js`; thêm bộ chọn 4 nút cạnh nút copy trong `DictationLibrary.jsx`, lưu trên máy ở khóa `vocabmaster_dictation_prompt_level` (không đồng bộ cloud, không đưa vào bản sao `.json`). Chi tiết: [DICTATION.md](DICTATION.md) mục 12.
- **Việc 2 — Đơn giản hóa "Từ đã lưu":** từ lưu mới để rỗng `''` cho `sentenceId`/`sentence`/`lessonTitle` (giữ nguyên schema và cấu trúc Google Sheet; đã kiểm tra chỉ-đọc `dictationSyncMerge.js`, `dictationStorage.js`, `dictation-apps-script.js` đều chấp nhận chuỗi rỗng, không cần sửa hay triển khai lại Apps Script). Dữ liệu cũ giữ nguyên không migrate. "Danh sách" đổi sang lưới thẻ 2/3/4 cột chỉ hiện từ tiếng Anh + nút nghe + nút xoá, tìm kiếm chỉ theo từ; "Luyện nghe" bỏ bộ lọc "Tên bài" (giữ "Chỉ từ hay nghe sai" và "Chưa luyện"). Chi tiết: [DICTATION.md](DICTATION.md) mục 2, 11.
- **Đã kiểm tra:** `npm.cmd run build` đạt, `npm.cmd run lint` 0 lỗi / 32 cảnh báo sẵn có, `npm.cmd test` **42/42**, 7 test trình duyệt liên quan **7/7** đạt (`dictation-browser`, `dictation-sync-browser`, `dictation-word-practice-browser`, `dictation-ai-prompt-browser`, `dictation-export-browser`, `voice-settings-browser`, `navbar-sync-chip-browser`).
- **Chưa kiểm tra:** điện thoại thật, giọng đọc thật, đồng bộ Google Sheet thật với bản ghi mới, mở file Excel thật bằng Excel/WPS.

## 20. Ngày 26/11 (tối) — nhánh `feat/grammar-review-speak` (chưa ghép `main`)

Tách từ `main` (`21433b1`). **Chưa ghép vào `main`, chưa push, chưa deploy.**

- **Grammar → Ôn tập:** thêm hàng nút **"Nghe câu"** (`#grammar-review-speak`) và **`<VoiceSettings />`** ngay trên thẻ câu trong phiên ôn (`src/components/grammar/GrammarReview.jsx`), dùng chung cài đặt `vocabmaster_voice_prefs` (giọng, tốc độ, Chế độ thi) qua `speakWithSettings(getGrammarSentence(q), { itemKey: 'grammar-review:' + q.savedId })`. Câu rỗng ẩn nút "Nghe câu", vẫn hiện nút "Giọng đọc". Không tự đọc khi sang câu mới; tự dừng tiếng khi bấm "Câu tiếp"/"Hoàn tất", "Kết thúc phiên" hoặc rời màn hình. Không đụng `GrammarSentenceCard`, `UnderlinedSentence` hay bất kỳ file đo gạch chân/giọng đọc nào.
- **Đã kiểm tra:** `npm.cmd run build` đạt, `npm.cmd run lint` 0 lỗi / 32 cảnh báo sẵn có, `npm.cmd test` **42/42** (đã thêm `globalThis.window ??= {}` cho 2 test SSR `grammar-store-app`, `grammar-topic`), 8 test trình duyệt liên quan **8/8** đạt (`grammar-review-speak-browser`, `grammar-review-browser`, `grammar-review-notes-persist-browser`, `sentence-notes-browser`, `underline-rendering`, `grammar-topic-browser`, `voice-settings-browser`, `navbar-sync-chip-browser`).
- **Chưa kiểm tra:** điện thoại thật, giọng đọc thật, Safari/iOS.

## 21. Ngày 26/11 (tối) — nhánh `feat/storybook-theme-phase1` (chưa ghép `main`)

Tách từ `main` (`9df68cf`). **Đã push riêng nhánh `feat/storybook-theme-phase1` để tạo bản Preview Vercel; CHƯA ghép vào `main`, CHƯA push `main`.** Chi tiết thiết kế: [STORYBOOK-THEME.md](STORYBOOK-THEME.md).

- **Giai đoạn 1 (chỉ 3 phần rồi dừng):**
  1. **Nền tảng thiết kế (`src/index.css`, `src/styles/fonts.css`, `src/main.jsx`):** chuyển sang bảng màu giấy kem ấm (`#f6efe2` / `#fbf7ee` / mực `#2b2a33`), viền mực 2 px và bóng nhãn dán; bỏ link Google Fonts CDN, tự host `@fontsource-variable/fraunces` và `@fontsource-variable/nunito` (chỉ import subset `vietnamese` + `latin`). Giữ nguyên toàn bộ class `.vm-*` cũ và thêm các class `.sb-*` mới cùng lớp cầu nối **`.sb-legacy`** để bọc 6 tab chưa chuyển (`Vocabulary`, `Flashcard`, `Smart Quiz`, `Listening`, `Grammar`, `Dictation`) giữ nguyên nền tối cũ — **cần gỡ dần ở Giai đoạn 2–5**.
  2. **Navbar & App shell (`src/components/Navbar.jsx`, `src/App.jsx`, `src/components/ErrorBoundary.jsx`):** đổi thanh menu sang giấy kem viền mực, logo "V" kiểu nhãn dán, chip đồng bộ và nút Sync chữ đậm tương phản cao (`text-*-900` trên nền sáng), giữ nguyên 7 tab, nhãn, `id`, `aria-label`, `PushIndicator`, `SyncStatusChip` và khung `vocab-sync-controls`.
  3. **Dashboard "Bản đồ hành trình" (`src/components/Dashboard.jsx`, `src/components/storybook/StorybookArt.jsx`):** minh họa SVG gốc **Cáo nhỏ lữ khách** + bản đồ 5 chặng L1–L5 (`JourneyMapSvg`, `EmptyTrailScene`, `CompassBadge`), giữ nguyên 4 thẻ số liệu, 5 thanh `MasteryBar`, mẹo học và Quick Tips, thêm 6 thẻ chỉ đường tới các vùng đất (gọi `setActiveTab`).
- **Không đổi:** toàn bộ logic học/chấm điểm, dữ liệu, đồng bộ cloud, `src/hooks/`, `src/utils/`, `api/`, `*-apps-script.js`, nội dung trong 6 tab chưa chuyển, `UnderlinedSentence.jsx` và các file đo hình học Grammar.
- **Đã kiểm tra:**
  - `npm.cmd run build` đạt (JS chính `541,94 → 557,42 kB`, gzip `163,54 → 167,46 kB`, tăng `+3,92 kB` gzip; CSS `108,85 → 110,35 kB`; chỉ xuất 4 file font `.woff2` `vietnamese` + `latin`).
  - `npm.cmd run lint` 0 lỗi / 31 cảnh báo (giảm 1 so với mốc 32).
  - `npm.cmd test` **42/42** (có Python trong PATH).
  - 9 test trình duyệt Playwright + Edge headless **9/9** đạt: `navbar-sync-chip-browser` (1280/1024/768/640/375/320 px), `dictation-browser`, `vocab-quota-browser`, `vocab-star-browser`, `quiz-feedback-browser`, `listening-autofocus-browser`, `grammar-review-browser`, `voice-settings-browser`, `vocab-sync-browser`. Lưu ý: 2 test chip navbar (`navbar-sync-chip.test.js`, `navbar-sync-chip-browser.test.js`) đổi assert màu chữ chip từ `text-*-200` sang `text-*-900` do nền navbar chuyển từ tối sang sáng.
  - Tự chụp & kiểm tra ảnh màn hình trên Edge headless (dữ liệu mẫu cục bộ) ở 1440/1024/768/375 px cho Dashboard (có dữ liệu & rỗng) và 6 tab cũ trong `.sb-legacy` ở 1440 & 375 px: 0 tràn ngang, 0 lỗi trang, chữ tiếng Việt đủ dấu với `Fraunces Variable` và `Nunito Variable`.
- **Chưa kiểm tra:** điện thoại thật, Safari/iOS, Firefox, nhiều cỡ màn hình thật ngoài giả lập Edge.

## 22. Ngày 26/11 (đêm) — nhánh `feat/twilight-theme` (chưa ghép `main`)

Tách từ `main` (`2398fcb` — bản giấy kem sáng cũ vẫn nằm ở commit này). **Chỉ mới sửa trên nhánh `feat/twilight-theme`; CHƯA ghép `main`, CHƯA push `main`.** Chi tiết: [STORYBOOK-THEME.md](STORYBOOK-THEME.md).

- **Chuyển sang bảng màu Hoàng Hôn (Twilight / Blue Hour):**
  - `src/index.css`: đổi toàn bộ biến `--sb-*` sang nền gradient `#0f0b2e → #1a1446`, thẻ `#221b5a`/`#2b246b`, viền lavender 46–62%, chính periwinkle `#5b6ee1` (nút chữ trắng tinh chỉnh thành `--sb-primary-btn: #4c5ed1` để đạt tương phản 5,48:1), nhấn vàng hổ phách `#f2b45a`, hồng đào `#e8809a`/`#f0a38b`, ánh sao `#cfe0ff`, chữ `#f4efff`/`#b9b2e6`. Thay bóng cứng lệch đen đặc bằng bóng glow lavender/amber nhẹ. Hòa quyện `.sb-legacy` và các class `.vm-*`/`.field` vào tông chàm-tím hoàng hôn.
  - `src/App.jsx`, `src/components/ErrorBoundary.jsx`, `src/components/Navbar.jsx`, `src/components/Dashboard.jsx`: xóa mã màu giấy kem viết cứng, chuyển sang dùng token `var(--sb-*)` (Navbar chip dùng tông sáng `-200` trên nền tối).
  - `src/components/storybook/StorybookArt.jsx`: tô lại `JourneyMapSvg`, `EmptyTrailScene`, `CompassBadge` và `FoxBody` theo cảnh hoàng hôn (trời gradient chàm → tím → hồng đào → cam hổ phách, sao, trăng lưỡi liềm, mây tím viền đào, núi viền sáng vàng, cột mốc L1–L5 sáng). Không thêm animation mới.
- **Không đổi:** logic học/chấm điểm, dữ liệu, đồng bộ cloud, `src/hooks/`, `src/utils/`, `api/`, `*-apps-script.js`, nội dung trong 6 tab cũ, `UnderlinedSentence.jsx` và các file đo hình học Grammar.
- **Đã kiểm tra:**
  - `npm.cmd run build` đạt (JS chính `557,50 → 561,76 kB`, gzip `167,47 → 168,16 kB`, tăng `+0,69 kB` gzip; CSS `110,42 → 113,40 kB`, gzip `17,51 → 17,52 kB`).
  - `npm.cmd run lint` 0 lỗi / 31 cảnh báo (không tăng).
  - `npm.cmd test` **42/42** (có Python trong PATH).
  - 9 test trình duyệt Playwright + Edge headless **9/9** đạt (`navbar-sync-chip-browser`, `dictation-browser`, `vocab-quota-browser`, `vocab-star-browser`, `quiz-feedback-browser`, `listening-autofocus-browser`, `grammar-review-browser`, `voice-settings-browser`, `vocab-sync-browser`). Đã cập nhật 2 dòng assert màu chip trong `navbar-sync-chip.test.js` và `navbar-sync-chip-browser.test.js` (`-900` → `-200`).
  - Rà tương phản WCAG AA bằng script tính toán: mọi cặp chữ/nền chính đạt **5,48:1 – 15,12:1**.
  - Chụp và đọc ảnh màn hình ở 1440 px & 375 px cho Dashboard (có dữ liệu & rỗng) và tất cả 6 tab cũ trong `.sb-legacy`: 0 tràn ngang, 0 lỗi trang. Ghi nhận lệch màu nhẹ ở 6 tab cũ chưa chuyển: Flashcard (mặt thẻ chính dùng `bg-slate-*` xám lạnh) và vài nút pill/ô phụ `bg-slate-800/900` trong Vocabulary/Quiz/Listening/Grammar/Dictation vẫn giữ tông xám xanh cũ nhưng chữ vẫn rõ, sẽ đồng bộ hoàn toàn khi gỡ `.sb-legacy` ở Giai đoạn 2–5.
- **Chưa kiểm tra:** điện thoại thật, Safari/iOS, Firefox, chưa mở modal/toast phức tạp ngoài các test tự động.
