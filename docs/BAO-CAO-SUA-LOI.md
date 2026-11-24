# Báo cáo sửa lỗi theo kiểm tra 2026-11

- **Nhánh:** `fix/audit-2026-11` (tách từ `main` tại `2ba0be3`). `main` không bị sửa.
- **Chưa push, chưa deploy, chưa gọi Apps Script/Vercel/Google Sheets thật.** Mọi kiểm tra chạy trên máy với dữ liệu giả.
- Danh sách lỗi gốc: [BAO-CAO-PHAN-TICH-WEB.md](BAO-CAO-PHAN-TICH-WEB.md).

## 1. Kết quả từng mục

Mỗi mục là một commit riêng. Với mỗi lỗi trong code, test được viết trước và **thất bại trên code cũ**, rồi **đạt sau khi sửa**.

| # | Trạng thái | Commit | File đã đổi | Test chứng minh |
| --- | --- | --- | --- | --- |
| 1 | Đã sửa | `e16a9b1` | `src/components/ErrorBoundary.jsx` (mới), `src/main.jsx` | `test/error-boundary.test.js` |
| 2 | Đã sửa | `cec0765` | `src/hooks/useGrammarStore.js`, `src/components/Grammar.jsx` | 3 ca mới trong `test/grammar-auto-sync.test.js` |
| 3 | Đã sửa | `2ff05ea` | `src/utils/vocabWord.js` (mới), `src/hooks/useVocabStore.js`, `src/components/Vocabulary.jsx` | `test/vocab-normalize.test.js` (dùng validator Apps Script thật) |
| 4 | Đã sửa | `f8aec40` | `src/utils/quizParse.js` (mới), `src/utils/grammarImport.js`, `src/components/Quiz.jsx` | `test/quiz-parse.test.js` |
| 5 | Đã sửa | `212bd1a` | `src/components/Quiz.jsx` | ca mới trong `test/quiz-parse.test.js` |
| 6 | Đã sửa | `e080796` | `src/components/Navbar.jsx`, `index.html` | `test/navbar-a11y.test.js` |
| 7 | Đã sửa | `167dfc2` | `.gitignore` | Kiểm bằng `git check-ignore` (trước: không khớp; sau: khớp `.env`, `.env.production`, `.env.local`, `.vercel/`) |
| 8 | Đã sửa | `3e130ab` | `src/components/WordInitialTile.jsx` (mới), `ListeningReview.jsx`, `Quiz.jsx` | `test/word-initial-tile.test.js` |
| 9 | Đã sửa | `dc7071d` | `package.json`, `test/run-node-tests.js` (mới) | Chạy `npm test` (trước: "Missing script"; sau: chạy hết, báo lỗi đúng khi có file hỏng) |
| 10 | Đã sửa | `d4b0c56` | `api/grammar-sync.js`, `grammar-apps-script.js` | `test/grammar-security.test.js`; cập nhật harness `structures-backend` (cấp secret giả) và mã 500→503 trong `grammar-auto-sync` |
| 11 | Đã sửa | `a1b6cb8` | `grammar-apps-script.js` | `test/grammar-review-sheet.test.js` (dữ liệu cũ, dữ liệu mới, 1.200 mục, hàng hỏng) |
| 12 | Đã sửa | `dd9c31b` | `src/utils/vocabBackup.js`, `src/utils/vocabSync.js` | `test/vocab-backup-prune.test.js` + IndexedDB giả `test/helpers/fake-indexeddb.js` |
| 13 | Đã sửa | `300fe5e` | `src/App.jsx`, `src/components/Grammar.jsx` | `test/grammar-store-app.test.js` |
| 14 | Đã sửa | `3247aa0` | `src/utils/grammarSyncMerge.js`, `src/hooks/useGrammarStore.js` | 2 ca mới trong `test/grammar-auto-sync.test.js` |
| 15 | Đã sửa (trừ 1 mục) | `95b53c0` | `Navbar.jsx`, `App.jsx`, `useVocabStore.js`, `storage.js`, `structureStorage.js`; xóa `App.css`, `src/assets/*`, `public/icons.svg`, `scripts/` | `test/dead-code.test.js` |
| 16 | Đã sửa | `20f9204` | `Quiz.jsx`, `structureQuiz.js`, `index.html`, `Dashboard.jsx`, `GrammarStats.jsx` | `test/vstep-labels.test.js` |
| 17 | Đã sửa | `ff1dfac` | `docs/BAO-CAO-PHAN-TICH-WEB.md` | (tài liệu) đối chiếu với `git show 2ba0be3:api/grammar-sync.js` |

Commit `296fe1c` chỉ lưu báo cáo phân tích gốc vào nhánh, để thấy rõ phần sửa ở lỗi 17.

**Ghi chú từng mục:**

- **#2:** lỗi lưu giờ hiện thông báo tiếng Việt ở đầu màn Grammar, không đánh dấu "chờ đồng bộ" và không nhận revision của cloud khi chưa lưu được dữ liệu.
- **#4:** khi AI trả thiếu câu, app hiện thông báo; bấm "Start Quiz" lần nữa để làm số câu đang có.
- **#8:** ở chế độ nghe-gõ, khung chữ cái làm lộ chữ đầu của từ. Ảnh cũ cũng gợi ý, và tên từ vốn đã hiện trên ảnh.
- **#10:** chế độ nhập thẳng URL Apps Script trong Grammar Cloud **không còn dùng được**, vì không có cách gửi secret. Thiết bị nào đang dùng thì phải chuyển sang `/api/grammar-sync` (nút "Dùng proxy").
- **#11:** tiến độ ôn được lưu thành hàng ở sheet **Review**, bản sao trước khi ghi ở sheet **ReviewBackup**. Ô `Meta!B1` chuyển thành dấu `migrated-to-Review-sheet`.
- **#12:** chỉ dọn các bản backup thường lệ khi có hơn 40 bản, và vẫn giữ 30 bản mới nhất. Không bao giờ xóa:
  - bản archive/xung đột/adopt;
  - bản có từ trước phiên bản này;
  - bản chuyển từ LocalStorage;
  - bản cũ nhất.

  Mỗi lần chấm điểm giờ ghi 1 backup thay vì 2.
- **#14:** câu đã xóa được giữ lại kèm `deletedAt`. Không cần sửa Apps Script vì validator chấp nhận trường này (đã kiểm). Test cũ "xóa câu cuối" được viết lại: câu được gửi dưới dạng tombstone thay vì danh sách rỗng, mục đích vẫn giữ nguyên.
- **#15:** **không xóa `validatePayload`** vì hai test `grammar-sentence` và `grammar-sync` đang dùng nó để đối chiếu với validator của Apps Script. Hằng `STRUCTURE_REVIEW_INTERVALS` giờ không còn ai dùng, nhưng không nằm trong danh sách nên tôi để nguyên.
- **#16:** mã nội bộ của chế độ đổi từ `toeic` sang `vstep`. Mã này không được lưu ở đâu nên không ảnh hưởng dữ liệu.

## 2. Kết quả kiểm tra cuối (so với trước khi sửa)

| Lệnh | Trước | Sau | Nhận xét |
| --- | --- | --- | --- |
| `npm run build` (ra thư mục tạm, không đè `dist/`) | exit 0; JS 499,56 kB (gzip 148,38) | exit 0; JS **503,88 kB** (gzip 149,82) | **Xấu đi nhẹ:** +4,3 kB (+0,9%), do thêm kiểm tra và component. Gói vừa vượt mốc 500 kB nên Vite in thêm cảnh báo "Some chunks are larger than 500 kB". App vẫn chạy bình thường; muốn hết cảnh báo thì cần tách gói theo tab (nằm ngoài danh sách sửa). |
| `npm run lint` | 0 lỗi, 36 cảnh báo | 0 lỗi, **34 cảnh báo** | Tốt hơn |
| Test Node | 19/19 file (chạy tay) | `npm test`: **30/30 file đạt** (19 cũ + 11 mới) | 4 test cũ được cập nhật có chủ đích (lỗi 10, 11, 14) |
| 9 test trình duyệt (Playwright + Edge) | chưa chạy | **9/9 đạt** | Xem mục 6 "Kiểm tra trình duyệt"; 2 test được cập nhật cho khớp hành vi hiện tại, không đổi code app |

## 3. Thứ tự triển khai (bạn làm bằng tay)

Làm đúng thứ tự dưới đây để đồng bộ không bị gián đoạn.

1. **Sao lưu.** Mở spreadsheet Grammar → **File → Make a copy**. Trong app, tải bản sao Vocabulary và xuất JSON Structures (bạn đã có bản sao riêng; làm thêm lần nữa cho chắc).
2. **Tạo secret.** Tạo một chuỗi ngẫu nhiên dài (ví dụ 40 ký tự từ trình tạo mật khẩu). Không đưa chuỗi này vào code hay gửi cho ai.
3. **Vercel → Settings → Environment Variables:**
   - đặt `GRAMMAR_SYNC_SECRET` = secret vừa tạo;
   - kiểm tra `GRAMMAR_APPS_SCRIPT_URL` đúng URL `/exec` của Apps Script Grammar;
   - nếu bạn đã có sẵn secret thì giữ nguyên giá trị cũ ở cả bước này và bước 6.
4. **Ghép nhánh vào `main` rồi deploy web lên Vercel.** Web mới bắt buộc có secret (bước 3). Apps Script cũ vẫn chấp nhận yêu cầu có kèm secret, nên đồng bộ vẫn chạy.
5. **Kiểm tra web:** mở web → Grammar → Cloud → bấm Sync, phải thấy "Đã đồng bộ". Nếu thấy lỗi "unconfigured", nghĩa là bước 3 chưa đúng hoặc Vercel chưa nhận biến môi trường. Hãy redeploy.
6. **Apps Script Grammar → Project Settings → Script Properties:** đặt `GRAMMAR_SYNC_SECRET` = **đúng** secret ở bước 3.
7. **Cập nhật mã Apps Script Grammar:**
   - dán toàn bộ `grammar-apps-script.js` mới → Save;
   - **Deploy → Manage deployments → Edit → Version: New version → Deploy** (giữ nguyên URL cũ);
   - không chạy hàm xóa/reset sheet nào.
8. **Kiểm tra dữ liệu:**
   - mở web → ôn một câu Grammar → chờ "Đã đồng bộ";
   - trong spreadsheet phải xuất hiện sheet **Review** (mỗi hàng một câu) và **ReviewBackup**;
   - `Meta!B1` phải hiện `migrated-to-Review-sheet`.
9. **Trên mọi thiết bị:** đóng hết tab cũ rồi mở lại web.
   - Thiết bị còn chạy bản cũ sẽ hiện lại câu đã xóa (vì chưa biết tombstone) và dùng định dạng backup cũ.
   - Thiết bị nào nhập URL Apps Script trực tiếp trong Grammar Cloud thì chuyển sang `/api/grammar-sync`.
10. **Không quay Apps Script về bản cũ sau bước 7.** Bản cũ chỉ đọc `Meta!B1`, nên sẽ thấy tiến độ ôn trên cloud là rỗng. Dữ liệu trên máy vẫn còn, nhưng nên tránh.

Vocabulary không cần đổi Apps Script, proxy hay biến môi trường cho các sửa đổi này (#3, #12 chỉ ở web).

## 4. Cách hoàn tác

- **Bỏ một sửa đổi:** `git revert <mã commit>` (mã ở bảng mục 1). Ví dụ, muốn giữ TOEIC thì chạy `git revert 20f9204`.
- **Bỏ toàn bộ:** `git checkout main`, vì `main` chưa bị đổi. Muốn xóa hẳn nhánh thì chạy thêm `git branch -D fix/audit-2026-11`.
- Nếu đã làm bước 7 (sheet Review đã có dữ liệu), hoàn tác code Apps Script **không** tự chép dữ liệu về `Meta!B1`. Hãy hỏi lại trước khi quay về bản cũ.

## 5. Việc còn lại / lưu ý

- Đã cập nhật tài liệu `AGENTS.md`, `STRUCTURES-SYNC-SETUP.md`, `docs/PROJECT_CONTEXT.md` và `docs/HANDOFF.md` (mục 17, có thứ tự triển khai) theo code mới, ở commit `12fdf71`. `GRAMMAR-VSTEP.md` chưa sửa: file này vốn đã bị đảo đoạn và không nằm trong yêu cầu.
- Câu đã xóa và backup thường lệ vẫn được giữ dạng tombstone/có giới hạn, nên kho cloud tăng chậm theo thời gian (giống Structures).
- Test `vocab-quota-browser` (hỏng sẵn trên `main`) đã được cập nhật theo yêu cầu ở commit `722263e`, xem mục 6.

## 6. Kiểm tra trình duyệt (2026-11-24)

**Cách chạy:**
- Cài Playwright vào thư mục tạm ngoài dự án (`%TEMP%\vocabmaster-underline-test-tools`) theo `docs/HANDOFF.md` mục 7, với `--no-package-lock`. Không đổi `package.json` hay `package-lock.json`.
- Trình duyệt là Edge có sẵn trên máy, chạy ẩn (headless).
- Mọi test dùng dữ liệu giả và chặn mạng ra ngoài máy.

| Test | Kết quả | Ghi chú |
| --- | --- | --- |
| `grammar-corpus-browser` | Đạt | |
| `grammar-export-browser` | Đạt | |
| `grammar-review-browser` | Đạt | |
| `grammar-topic-browser` | Đạt | |
| `sentence-notes-browser` | Đạt | |
| `underline-rendering` | Đạt | |
| `vocab-sync-browser` | Đạt | |
| `vocab-star-browser` | Đạt **sau khi cập nhật test** (commit `0592875`) | Lần chạy đầu hỏng do thay đổi của lỗi 4 (xem dưới). Không đổi code app. |
| `vocab-quota-browser` | Đạt **sau khi cập nhật test** (commit `722263e`) | Hỏng sẵn trên `main`, không do nhánh này (xem dưới). Không đổi code app. |

**`vocab-star-browser` (do code mới, đã xử lý):**
- Test dán **1 câu** trong khi Smart Quiz mặc định yêu cầu 10 câu.
- Theo lỗi 4, app giờ báo "AI chỉ trả về 1/10 câu…" và cần bấm Start Quiz lần nữa. Test cũ chỉ bấm một lần nên chờ quá 30 giây.
- Đây là hành vi mới có chủ đích, nên tôi sửa test: kiểm tra thông báo hiện ra, chưa vào bài, rồi bấm lần hai. Sau đó test đạt.
- Bản `main` (chưa có thay đổi này) đạt test cũ.

**`vocab-quota-browser` (lỗi có sẵn, không do nhánh này):**
- Hỏng ở dòng 101, kỳ vọng số backup không đổi sau khi tải lại trang.
- Chạy cùng test trên code `main` (bản sao tạm bằng `git worktree`, đã xóa sau khi chạy) cũng hỏng đúng dòng đó: `main` 6≠5, nhánh này 4≠3. Nhánh này có ít backup hơn nhờ lỗi 12.
- Đã dò bằng một bản sao tạm của test (đã xóa):
  - trước khi tải lại: 3 backup, khóa cũ `vocabmaster_vocab_backup_old` vẫn ở LocalStorage;
  - sau khi tải lại: 4 backup, khóa cũ đã chuyển vào IndexedDB và bị xóa khỏi LocalStorage.
- Đây là tính năng "chuyển backup LocalStorage cũ sang IndexedDB" do commit `2ba0be3` trên `main` thêm vào, sau khi test này được viết. Test vẫn kỳ vọng khóa cũ nằm nguyên (dòng 108) và số backup không đổi.
- Tôi chạy thêm một bản sao tạm của test, chỉ chỉnh 2 kỳ vọng lỗi thời này (cộng thêm bản backup được chuyển; khóa cũ có trong file xuất thay vì trong LocalStorage). **Toàn bộ phần còn lại đều đạt**: hết dung lượng, giữ dữ liệu/sao, thử lại, xuất bản sao, chống cache hỏng, không chạm kho khác.
- Đã cập nhật theo yêu cầu người dùng (commit `722263e`): sau khi tải lại, chờ khóa cũ rời LocalStorage, kỳ vọng số backup tăng đúng 1 và giữ nguyên khi đồng bộ lại; bản cũ có trong IndexedDB và file xuất; các khóa khác vẫn nguyên. Test đạt.
- Lần chạy cuối (sau commit `722263e`): `npm test` 30/30, lint 34 cảnh báo/0 lỗi, build đạt, test trình duyệt **9/9**.

**Môi trường:** không có lỗi do môi trường. Edge và Playwright đều chạy được.

**Lưu ý trong lúc kiểm tra:** khi dọn bản sao tạm của `main`, lệnh xóa của Git chạy trước khi gỡ liên kết `node_modules`. Tôi đã kiểm tra `node_modules` của dự án vẫn nguyên vẹn: `npm ls` không báo thiếu gói nào, build và `npm test` vẫn đạt sau đó.
