# Vocabulary: containment và phục hồi — 2026-11-04

Kế hoạch này **chưa triển khai**. Giữ đóng tất cả tab VocabMaster trên máy tính/điện thoại trong giai đoạn backup, containment và restore. Không mở client cũ để kiểm tra Sheet. Không dùng `localStorage.clear()`. Không thử POST (kể cả payload định bị reject) lên production.

## Nguyên nhân đã xác minh trong repo

Startup GET rồi `mergeVocabWords` giữ mọi mục chỉ có local. Nếu merged dài hơn cloud thì tự hẹn POST sau 2.050ms. Effect words đổi cũng hẹn POST 2 giây. Hard-sync vẫn merge nên không nhận nguyên bản sạch. Không có tombstone, generation hay revision. Backend cũ nhận mảng bất kỳ rồi clear/ghi lại sheet đầu tiên.

Các writer cũ gồm startup merge, sửa/thêm/xóa/import, ôn tập đổi level/streak và timer đã hẹn. Manual fetch không hủy POST đang chạy; guard push có thể bỏ lượt sửa mới khi đang verify. Một số timer có thể mất tham chiếu khi ref bị thay. Không có cleanup request toàn bộ khi unmount. POST `no-cors` rồi GET chỉ kiểm `count >= expected`, không xác minh nội dung. Bỏ qua list rỗng làm xóa từ cuối không lên cloud. Đây là đường lỗi xác nhận từ source, chưa xác minh deployment thực tế.

## Protocol 1 và lưu trữ

- Server cấp generation UUID cho mỗi lần thay/restore cả thư viện, revision bắt đầu 0. POST bắt buộc protocol/generation/expectedRevision/requestId/words/tombstones. Backend từ chối legacy/unversioned **vĩnh viễn**, kể cả client biết URL cũ; không tự cấp quyền cho cache cũ.
- ScriptLock bao GET/POST/pause/restore. CAS chặn generation/revision cũ. Tombstone theo ID không được bỏ trong cùng generation; bỏ record phải có tombstone. Xóa cuối gửi `words:[]`, tombstone và `confirmEmpty:true`. Tạo lại có chủ đích dùng ID mới.
- GET rỗng hợp lệ khác lỗi/malformed. ACK đọc được qua `/api/vocab-sync`, phải khớp requestId, generation, revision tăng 1 và **toàn bộ words/tombstones**. Không dùng opaque/count làm bằng chứng.
- Bản chuẩn là **snapshot JSON bất biến trên Drive** của chủ Apps Script. Script Property `VOCAB_HEAD` trỏ file đã commit. Mỗi commit validate → tạo file → đọc lại xác minh → ghi mirror Sheet → flush → đổi HEAD. File cũ giữ nguyên làm backup. Lỗi trước HEAD giữ bản chuẩn cũ, không báo thành công; mirror có thể lệch, repair khi paused. Crash sau HEAD vẫn có snapshot hợp lệ. Thiếu/hỏng HEAD chặn sync, không fallback vào Sheet.
- Sheet đầu tiên vẫn 10 cột nhưng từ nay là **mirror**, không sửa trực tiếp để restore. Không đổi vị trí sheet đầu tiên. JSON giữ cả trường mở rộng; mirror chỉ 10 cột. Text prefix chống formula trong Sheet. Drive cần quyền mới. Snapshot tích lũy, không tự xóa; giới hạn 20.000 live+tombstone và 45.000 ký tự/mục, vượt giới hạn báo lỗi.
- Client lưu base đã xác minh + words hiện tại nguyên tử trong `vocabmaster_vocab_sync_v1`. Chưa có base hoặc generation khác: backup rồi adopt nguyên remote, **không gửi cache legacy hay pending generation cũ**. Cùng generation: so sánh base/local/remote; unchanged không có quyền hồi sinh, xóa thắng, giữ thêm mới offline và sửa khác record. Sửa cùng record giữ cloud, archive local và thông báo để xem lại. Không đoán TOEIC/VSTEP, không dùng đồng hồ client quyết định.
- CAS conflict/lỗi giữ pending, báo lỗi; Sync/online/focus GET lại để hòa giải. Sửa trong POST còn pending cho lượt sau. Không có retry vô hạn. Mỗi phiên có backup riêng và bản đầu phiên bất biến: tab khác không phá bản duy nhất của pending. Reload có thể nhận shared state của tab khác; pending tab trước còn trong backup để xem lại thủ công, không tự import.
- Nút **Xuất bản sao Vocabulary** tải raw keys và backups; đây không phải file import trực tiếp. Bản sao tích lũy; quota lỗi chặn adoption/upload. Grammar/Structures/notes/underlines và stats không bị sửa/xóa. Vocabulary stats giữ nguyên.

## Tạm dừng

Ba lớp đều mặc định chặn ghi:

1. Client: chỉ key `vocabmaster_vocab_sync_paused` đúng chuỗi `false` mới cho POST. Nút pause hủy debounce, tăng token bỏ response cũ, abort request và báo qua storage event cho tab mới cùng origin. POST kiểm lại pause sát dispatch. GET vẫn có thể đọc/adopt. Bật ở thiết bị không mở khóa server.
2. Proxy: env `VOCAB_WRITES_ENABLED` chỉ `true` mới cho POST. Đổi env cần redeploy Vercel.
3. Apps Script: Script Property `VOCAB_WRITES_ENABLED` chỉ `true` mới cho POST. Chạy `pauseVocabularyWrites()` trong editor: dùng cùng lock với commit. Sau khi hàm trả về, handler protocol mới không commit thêm trước resume.

Abort không thu hồi request server đã nhận. POST đang giữ lock có thể hoàn tất trước pause; restore phải sau khi pause hoàn tất. Request generation cũ đến sau restore bị reject. **Execution legacy đã bắt đầu trước deploy không có guard/lock mới**: phải chờ Apps Script Executions không còn legacy Running trước restore. Đóng tab không đủ. Mọi URL/deployment cũ có thể ghi Sheet phải được cập nhật hoặc archive; chỉ tạo URL mới không bảo vệ dữ liệu.

## Thứ tự triển khai và phục hồi (sau khi được phép)

### 1. Backup, mọi tab vẫn đóng

Copy toàn bộ production spreadsheet sang bản độc lập, export workbook, giữ mixed version và Version history. Ghi lại spreadsheet ID, tên/thứ tự sheet, project/deployment IDs/URLs/version hiện tại. Copy/export riêng bản **VSTEP sạch do người dùng xác nhận**, không ghi đè bản mixed backup.

**Đầu vào còn thiếu:** file JSON UTF-8 mảng Word đầy đủ, hoặc bản Sheet/CSV/XLSX sạch đủ cột để chuyển thành JSON và kiểm tra trước. Giữ id, english, vietnamese, annotation, imageUrl, wordType, level, currentStreak, createdAt, lastReviewedDate nếu có, cả trường mở rộng. Không sinh ID/ngày/tiến độ thay dữ liệu thiếu nếu chưa được xác nhận. Snapshot lịch sử thiếu annotation cần chuẩn bị migration trên bản sao và xác nhận kết quả. Người dùng phải chỉ rõ bản/version sạch và xác nhận toàn bộ thư viện muốn giữ, kể cả 0 từ.

Không xác định TOEIC bằng tuổi, vị trí hàng hoặc nghĩa đoán; không dựng lại từ screenshot. File Excel + Prompt chỉ có English **không phải bản backup phục hồi**. Hiện chưa có snapshot sạch được cung cấp/xác minh; không thể suy ra từ mixed library.

### 2. Khóa backend cũ trước mọi restore/mở client

- Trong **project Apps Script Vocabulary hiện tại**, thay code bằng `google-apps-script.js`. Không dán vào project Grammar/Structures. Script Properties: `VOCAB_SYNC_SECRET` = secret ngẫu nhiên mạnh; `VOCAB_WRITES_ENABLED=false`. Không đặt HEAD bằng tay. Thiếu HEAD báo recovery_required, không tự seed từ Sheet/cache.
- Cấp quyền Drive/Sheets bằng chạy `pauseVocabularyWrites()` trong editor. Hàm không restore/xóa dữ liệu.
- **Deploy → Manage deployments → chọn deployment có URL client cũ đang dùng → Edit → Version: New version → Deploy.** Lặp lại cho mọi deployment Vocabulary đang hoạt động; archive deployment không dùng. Không chỉ bấm New deployment để tạo URL khác. Kiểm tra project khác nếu cũng có writer vào Sheet.
- Chờ và kiểm tra Apps Script Executions: không còn execution legacy Running. Không coi chờ một số giây tùy ý là bằng chứng. Nếu không xác minh được tất cả writer cũ đã disabled/drained, dừng trước restore.
- Test payload legacy và pause trên **Sheet/Drive/project staging riêng**, không thử ghi production.

### 3. Deploy frontend/proxy với ghi vẫn khóa

Env Vercel server: `VOCAB_APPS_SCRIPT_URL` = deployment đã cập nhật, `VOCAB_SYNC_SECRET` = secret trên Script Properties, `VOCAB_WRITES_ENABLED=false` hoặc unset. Deploy code client/proxy mới. Không đưa secret vào frontend. Vite dev/preview riêng không phục vụ `/api/vocab-sync`; dùng Vercel local/staging hoặc mock. Các tab production vẫn đóng.

### 4. Restore đúng snapshot và đổi generation

- Upload JSON sạch vào Drive chủ script đọc được; đặt `VOCAB_RECOVERY_FILE_ID` bằng file ID này.
- Chạy `previewVocabularyRecovery()` từ editor: chỉ đọc/validate và log count/SHA-256. Đối chiếu **toàn bộ nội dung** (ID/notes/progress), không chỉ count. Sau người dùng xác nhận đúng file, đặt `VOCAB_CONFIRMED_SHA256` bằng hash vừa xem.
- Chạy `pauseVocabularyWrites()` và chờ hoàn tất; mọi tab đóng, legacy executions drained. Chạy **một lần** `restoreConfirmedVocabulary()`.
- Hàm yêu cầu paused + hash đúng, tạo snapshot/mirror rồi đổi HEAD sang generation UUID mới/revision 0, giữ bản cũ và xóa confirmation hash, vẫn paused. Không restore thủ công hàng Sheet trước/sau hàm. Không reset revision trên generation cũ.
- Nếu lỗi: giữ pause, kiểm tra HEAD/file snapshot/execution log. Không resume vì Sheet nhìn sạch. Mirror lệch thì `repairVocabularyMirror()` khi paused. Cần restore lại thì xác nhận snapshot và tạo generation mới nữa; không hạ revision hoặc rollback sang backend nhận mảng.

### 5. Client nhận bản mới, mở từng thiết bị có kiểm soát

Đây mới là lúc kết thúc giai đoạn tất cả tab đóng. Các thiết bị/tab khác vẫn đóng; chỉ mở **một tab build mới**. Client mặc định pause, backup cache rồi adopt. Bấm **Xuất bản sao Vocabulary** để tải bản độc lập, đối chiếu active words với snapshot và GET generation/revision. Đóng tab trước khi chuyển thiết bị. Không cần xóa cache.

Nếu cache hỏng buộc reset: trước hết export/lưu raw `vocabmaster_words`, `vocabmaster_vocab_sync_v1`, `vocabmaster_vocab_backup_*`, `vocabmaster_stats`, pause key. Chỉ khi backup đọc được và đã được phép mới bỏ **words + sync_v1** ở đúng origin; giữ pause, backup, stats và tất cả khóa module khác. Không dùng localStorage.clear(), không xóa Grammar/Structures/notes/underlines. Không vượt quota bằng xóa bản duy nhất.

Archive có mục mới hữu ích thì người dùng chọn từng mục để thêm lại bằng ID mới hoặc áp sửa vào đúng record sau kiểm tra. Không import toàn bộ cache TOEIC hoặc file recovery backup. Không tự replay pending generation cũ.

### 6. Kiểm thử stale-device trên staging trước resume

Trên project/Sheet/Drive riêng và browser profiles/storage cô lập, dùng cùng build/protocol: một profile cache legacy 614 mục; một profile base generation cũ + từ mới offline. Restore snapshot sạch sang generation mới rồi reconnect. Active words phải chỉ là snapshot sạch; archive giữ cache/offline; không upload legacy. Test mảng cũ/generation cũ/revision cũ bị reject; xóa từ cuối rồi reconnect thiết bị cũ vẫn rỗng; offline additions/concurrent updates; conflict archive; lỗi mạng không Saved; pause timer; upload racing restore.

`node test/vocab-sync.test.js` đã mô phỏng runtime thực trong repo, nhưng không thay test staging Apps Script/Drive/proxy thực tế. Không dùng production làm nơi thử POST/xóa.

Sau staging đạt và production GET/mirror đối chiếu đúng: chạy `resumeVocabularyWrites()` trong editor; tiếp theo đặt env proxy `VOCAB_WRITES_ENABLED=true` và redeploy. Client vẫn pause. Mở một client mới, bấm Bật đồng bộ thiết bị và theo dõi HEAD/status; sau đó mới cho các thiết bị mới khác bật. Nếu bất thường: đóng tab khác, pause server dưới lock, pause proxy rồi điều tra từ backup; không sửa Sheet đơn thuần.

## Giới hạn

Secret bảo vệ Apps Script khỏi legacy trực tiếp; proxy personal app chưa có xác thực người dùng riêng, không coi secret là hệ thống phân quyền. Chống stale write dựa trên CAS/epoch/tombstone. Không có UI tự giải quyết conflict hay tự replay backup tab đã đóng; có file export để xem và chọn lại. Backup local/Drive tích lũy cần theo dõi quota. Quyền Drive, cutover deployment, CORS/redirect, điện thoại thực chưa được xác minh local. Không commit/push/deploy hoặc sửa production trong nhiệm vụ chuẩn bị này.
