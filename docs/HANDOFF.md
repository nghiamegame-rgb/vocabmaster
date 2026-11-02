# Bàn giao workspace VocabMaster

Ngày khảo sát: **2026-11-02**, Asia/Saigon. HEAD tham chiếu: `4a4aff095591629029e9a2deb75ef7fd7cc8ccc6`.

## 1. Phạm vi lần bàn giao

Chỉ khảo sát và viết Markdown để tiếp tục giữa Codex/Gemini/agent khác. Không phát triển/sửa lỗi, thay cấu hình/dependency/dữ liệu, commit, push, merge, deploy hoặc ghi dịch vụ ngoài. Tài liệu tổng quan nằm trong [PROJECT_CONTEXT.md](PROJECT_CONTEXT.md); hướng dẫn áp dụng nằm trong [AGENTS.md](../AGENTS.md).

Mô tả hiện tại dựa trên working tree chưa commit. Mã xác nhận Grammar đã luyện phân tích câu VSTEP B1; Vocabulary là công cụ dùng chung; cả Smart Quiz Vocabulary và Structures vẫn dùng prompt TOEIC. Không có bằng chứng đã chuyển toàn bộ sản phẩm sang VSTEP.

## 2. Trạng thái có sẵn trước khảo sát

`git status --short` lúc bắt đầu:

```text
 M GRAMMAR-VSTEP.md
 M src/components/Grammar.jsx
 M src/components/grammar/GrammarPractice.jsx
 M src/utils/grammarPrompt.js
?? src/utils/grammarBatch.js
?? src/utils/grammarImport.js
?? test/grammar-import.test.js
```

Không suy đoán ai tạo thay đổi hoặc chúng đã được duyệt hay chưa. Các thay đổi quan sát được:

| File | Nội dung thấy từ diff/source |
| --- | --- |
| `src/components/Grammar.jsx` | Quản lý `promptBatch`, cấu hình số câu/chủ đề ở cấp module; ghi lịch sử câu khi chấp nhận bộ nhập; tạo batch mới khi quay từ kết quả |
| `src/components/grammar/GrammarPractice.jsx` | Dùng pipeline nhập mới, lỗi theo trường, xác nhận bỏ readingItems lỗi/trùng lịch sử; nút tạo prompt mới |
| `src/utils/grammarPrompt.js` | Hợp đồng JSON v2/checklist và gợi ý batch, ưu tiên mục học đọc hiểu; vẫn là VSTEP phân tích câu |
| `src/utils/grammarBatch.js` (untracked) | ID bộ prompt, xoay gợi ý, lịch sử tối đa 50 câu local |
| `src/utils/grammarImport.js` (untracked) | Parser mảng/fence/lời dẫn, khớp quote an toàn, báo lỗi, xác nhận mục tùy chọn/trùng |
| `test/grammar-import.test.js` (untracked) | Test pipeline nhập và lịch sử/batch |
| `GRAMMAR-VSTEP.md` | Có phần mô tả nhập mới; đầu file bắt đầu bằng đoạn câu bị dở, phần giới thiệu nằm về cuối và cuối file dừng giữa câu. Đây là hiện trạng quan sát, chưa xác định chủ ý |

Giữ nguyên cả bảy file trên. Không sửa định dạng GRAMMAR-VSTEP dù thấy đoạn dở, để không trộn thay đổi bàn giao vào thay đổi có sẵn.

**Việc đang dang dở:** có bằng chứng về nhóm thay đổi nhập Grammar/batch chưa commit và văn bản chuyên đề bị dở. Chưa xác định còn hạng mục chức năng nào được yêu cầu, còn lỗi nào người dùng đang xử lý, hay thay đổi đã sẵn sàng commit. Test pass không đủ để kết luận quy trình phát triển/triển khai đã xong. Không tự tạo backlog hoặc coi việc đổi toàn bộ TOEIC là nhiệm vụ đã được giao.

## 3. Các phát hiện cần biết trước khi sửa tiếp

- AGENTS cũ nói Grammar chưa fetch lúc mount; mã hiện tại đã tự GET khi mount module/đổi endpoint/online (`useGrammarStore`). Tài liệu điểm vào đã sửa cho đúng.
- Có **ba store học độc lập**: `useVocabStore`, `useGrammarStore`, `useStructuresStore`. Structures nằm ở App và chia sẻ với Smart Quiz; không phải mảng `structures` trên từng câu v2.
- URL Grammar mặc định `/api/grammar-sync`, cũng dùng cho Structures nhưng khác scope/revision. Xóa chuỗi URL trở về default, không vô hiệu hóa sync. Vite riêng không phục vụ function này.
- Vocabulary có endpoint riêng khai báo trong `src/config.js`; không chép URL thật. Vocabulary POST opaque và verify số lượng không bảo đảm nội dung. Sửa/xóa/tiến độ cùng từ có thể bị cloud-first merge ghi đè; không có CAS/backup ở backend tham chiếu.
- Grammar có CAS/pending, bảo vệ sửa trong request và response cũ; nhưng merge OR/max không có tombstone xuyên thiết bị. Có thể khôi phục câu/sao/notes/cấp cũ sau lần merge khác.
- Structures có tombstone và event union, CAS/revision/backup/journal riêng. Không áp dụng nhầm quy tắc sync Structures cho câu Grammar.
- Import Vocabulary không restore nguyên snapshot: đi qua `addWord` sinh lại ID, không phục hồi `lastReviewedDate`. Không sửa trong lần bàn giao.
- Backend tham chiếu hỗ trợ câu v2 và Structures. Chưa biết deployment hiện tại có hỗ trợ hay chưa; cần quyền riêng nếu nhiệm vụ sau yêu cầu triển khai. Các hướng dẫn cập nhật backend cũ trong tài liệu không chứng minh backend đang chạy đã được cập nhật.

Chi tiết chức năng, dữ liệu, hàm tham chiếu và hạn chế nằm trong PROJECT_CONTEXT, tránh sao chép toàn bộ ở đây.

## 4. Kiểm tra thực sự đã làm

Môi trường: Node `v24.21.0`, npm `11.19.0`. Không cài dependency mới. Không mở dev server hoặc browser, không thao tác dữ liệu thật.

| Kiểm tra | Kết quả | Giới hạn bằng chứng |
| --- | --- | --- |
| `git status`, `git diff`, HEAD, hướng dẫn scoped | Đã đọc; chỉ thấy AGENTS ở root trong cây đã khảo sát | Cần kiểm tra lại khi agent mới bắt đầu |
| Đọc source/config/docs | Đã khảo sát App/components/hooks/utils, hai backend và proxy | Không kiểm chứng dịch vụ đang chạy |
| `node test/annotation.test.js` | Exit 0 | Logic sao chép, không test UI thật |
| `node test/vocab-sync.test.js` | Exit 0 | Logic sao chép, không sync live |
| `node test/word-selection.test.js` | Exit 0 | Chọn từ local |
| `node test/vocabulary-render.test.js` | Exit 0 | SSR component với dữ liệu giả, không thao tác browser |
| `node test/grammar-sync.test.js` | Exit 0 | Mô phỏng CAS/backend |
| `node test/grammar-auto-sync.test.js` | Exit 0 | Hook harness, client/proxy với network giả |
| `node test/grammar-sentence.test.js` | Exit 0 | Validator, Apps Script VM, React SSR |
| `node test/grammar-reading-items.test.js` | Exit 0 | Utility/draft thêm nhanh, không click UI |
| `node test/grammar-import.test.js` | Exit 0 | Parser/normalize/validation/batch/history |
| `node test/structures.test.js` | Exit 0 | Hook/merge/protocol mô phỏng |
| `node test/structures-backend.test.js` | Exit 0 | Mã Apps Script thật chạy với Sheets/Lock giả |
| `npm.cmd run lint` | Exit 0, còn cảnh báo | Không đồng nghĩa không còn vấn đề React; không sửa cảnh báo |
| `npm.cmd run build -- --outDir <thư-mục-tạm-mới>` | Exit 0, Vite 8.3.1 | Build client; không build/triển khai Vercel function hoặc Apps Script |

Build tạo trong thư mục tạm mới của hệ điều hành để không ghi đè `dist` có sẵn. Có cảnh báo outDir ngoài project không tự dọn và thông tin thời gian plugin. Lint có các nhóm unused, hook deps, set-state-in-effect, purity và refs; source không thay đổi trong khảo sát nên đây không phải cảnh báo do tài liệu mới gây ra.

**Chưa làm:** UI tương tác, kiểm tra responsive trên thiết bị thật, clipboard, phát âm/ảnh/font qua mạng, import/export qua trình duyệt, LocalStorage thật, endpoint production, xác thực/quyền truy cập, sync nhiều thiết bị, kiểm tra deployment v2/Structures. Không gọi POST thật hay chạy `testGrammarBackend` trong Apps Script. Không xác minh tính đúng đắn ngôn ngữ của JSON do AI sinh.

Lý do không mở app thường: các store có thể tự GET rồi POST theo dữ liệu local/cloud ngay khi mount; tác vụ này cấm ghi dịch vụ ngoài. SSR/test mock cung cấp kiểm tra local có giới hạn; không được mô tả là đã kiểm tra UI trực tiếp.

## 5. Tài liệu tạo/cập nhật trong lần này

- `AGENTS.md`: thêm mục tiêu VSTEP và đường dẫn đọc trước/sau sửa; cập nhật bản đồ ba store, auto-sync Grammar, Structures và danh sách test.
- `docs/PROJECT_CONTEXT.md`: ngữ cảnh sản phẩm, màn hình/luồng học, kiến trúc/file, schema/AI, lưu trữ/sync/backup, lệnh và giới hạn.
- `docs/HANDOFF.md`: hiện trạng working tree, bằng chứng kiểm tra và điểm đọc tiếp.

Chỉ ba Markdown trên thuộc thay đổi bàn giao. Mã, cấu hình, dependency, dữ liệu và tài liệu chuyên đề có sẵn được giữ nguyên; so sánh SHA-256 trước/sau dùng để kiểm tra các file đã khảo sát. Không commit/push/deploy.

## 6. Điểm đọc tiếp theo nhiệm vụ sau

1. Bắt đầu từ `git status`/diff mới nhất; đừng mặc định các file untracked đã có trong HEAD hoặc được phép bỏ đi. Đọc AGENTS và PROJECT_CONTEXT rồi kiểm tra source tương ứng.
2. Nếu làm nhập JSON/prompt: đọc `Grammar::promptBatch`, `GrammarPractice::handleImport/startImport`, `prepareGrammarImport/completeGrammarImport`, `grammarBatch.js`, rồi test import/sentence/reading-items. Xem phần dở trong GRAMMAR-VSTEP trước khi quyết định chỉnh tài liệu đó.
3. Nếu làm học/điểm: đọc `QuizGame::grade`, `recordReview`, `structureProgress`; xác định rõ store cần thay. Kiểm tra việc rời phiên và thời điểm persist/tổng kết.
4. Nếu làm sync: đọc ba hook và ba cloud client, `grammarSyncMerge.js`, proxy và backend tương ứng; dùng mock trước. Giữ pending/ID/notes/sao/ngày ôn/event/tombstone, xem offline/thiết bị cũ/sửa trong request. Không triển khai hoặc ghi production nếu chưa được giao phép.
5. Nếu mở UI để kiểm tra ở nhiệm vụ sau, cần môi trường cô lập dữ liệu và chặn/mock sync trước khi mount. Không dùng/xóa LocalStorage thật để tạo trạng thái test.

Trạng thái hoàn thành của lần này là **khảo sát và bàn giao tài liệu**, không phải hoàn tất chuyển đổi toàn bộ sang VSTEP hay xác nhận cloud production.
