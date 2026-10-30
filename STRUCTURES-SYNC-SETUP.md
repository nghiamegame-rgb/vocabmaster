# Thiết lập Structures Cloud Sync

Mã trong repo đã hoàn thiện; chưa triển khai hay ghi thử lên Google Sheets thật.

## Cập nhật backend hiện có

1. Mở **spreadsheet Grammar hiện có** (không phải spreadsheet Vocabulary). Tạo bản sao dự phòng bằng **File → Make a copy**. Trên laptop/mobile có dữ liệu Structures, xuất JSON trong **Grammar → Structures → Xuất JSON** trước khi cập nhật ứng dụng.
2. Mở **Extensions → Apps Script** của spreadsheet Grammar. Thay mã backend Grammar bằng toàn bộ nội dung `grammar-apps-script.js` trong repo này rồi Save. Giữ nguyên Script Property `GRAMMAR_SYNC_SECRET` nếu đang dùng. Không chạy hàm xóa/reset sheet.
3. Chọn **Deploy → Manage deployments → Edit** deployment Web App hiện có → **Version: New version → Deploy**. Giữ cách thực thi/quyền truy cập đang dùng để proxy truy cập được. Dùng deployment hiện có để giữ URL `/exec`.
4. Không cần tạo hoặc nhập tay sheet. Khi sync, script tự tạo `Structures` và `StructuresBackup` trong cùng spreadsheet. Mỗi hàng cột A là một cấu trúc JSON, gồm ghi chú, tiến độ và lịch sử trả lời. Script dùng `Meta!E1` làm revision Structures, `Meta!F1` làm dấu ghi đang thực hiện. Không sửa hai ô này bằng tay trong vận hành bình thường. `SavedQuestions`, `Meta!A1:D1`, Grammar review và Vocabulary được giữ riêng.

## Proxy và ứng dụng

5. Khi triển khai phiên bản ứng dụng này trên Vercel, giữ biến môi trường server `GRAMMAR_APPS_SCRIPT_URL` trỏ đến `/exec` ở bước 3 và `GRAMMAR_SYNC_SECRET` khớp Script Property nếu đã bật secret. Nếu URL giữ nguyên thì không cần thay biến môi trường. Proxy phải dùng bản mới trong `api/grammar-sync.js` để chuyển tiếp `scope=structures`. Secret chỉ nằm trên server, không đưa vào mã frontend.
6. Trên cả laptop và mobile, dùng cùng URL trong **Grammar Cloud**: `/api/grammar-sync` nếu dùng proxy. Nếu đang dùng Apps Script trực tiếp và không bật secret, giữ URL `/exec` hiện có. Với secret, dùng proxy. Vite chạy riêng không phục vụ `/api/grammar-sync`; dùng môi trường có Vercel function để sync.
7. Mở **Grammar → Structures → Sync Structures** trên từng thiết bị. Chờ thông báo **đã đồng bộ Google Sheets**. Sau đó Smart Quiz có chế độ **Grammar Structures**: chọn cấu trúc → Copy Prompt → dán JSON → trả lời. Không cần có bốn từ Vocabulary để dùng chế độ này.

## Quy tắc bảo toàn dữ liệu

- Structures dùng revision riêng, CAS và ScriptLock chung. Client luôn GET rồi merge trước khi POST, retry một lần khi conflict. Backend kiểm tra cả revision lẫn snapshot đã merge; snapshot cũ, thiếu ID hoặc mất lịch sử không được ghi đè cloud. Client cũ chỉ sync Grammar không chạm Structures.
- Dữ liệu local được lưu ngay. Lỗi mạng không xóa cache. Sync thử lại khi mở ứng dụng, cửa sổ lấy focus, mạng trở lại hoặc bấm Sync. Hai thiết bị/tab không nhận cập nhật thời gian thực; hãy Sync trước/sau khi chuyển thiết bị. Sau hai conflict liên tiếp, dữ liệu vẫn trên máy và nút Sync cho phép thử lại.
- Nội dung cùng một ID ưu tiên thời điểm sửa mới hơn; nếu đồng thời chính xác thì chọn nhất quán theo dữ liệu. Vì vậy nên đặt giờ tự động trên hai thiết bị. Lần trả lời có ID riêng, hợp nhất rồi tính lại tiến độ theo thời gian và ID, giữ cả các câu trả lời offline. Xóa giữ tombstone để thiết bị cũ không làm mục xuất hiện lại. Muốn thêm lại, tạo mục mới với ID mới.
- Import JSON là thêm/hợp nhất, không thay toàn bộ thư viện. Export giao diện chỉ xuất các mục đang hiển thị trong thư viện, kèm lịch sử trả lời; dấu xóa vẫn được giữ trong local và cloud.
- Backend cũ/không xác nhận giao thức Structures sẽ báo chưa đồng bộ và giữ dữ liệu local. Sau khi cập nhật backend/proxy, bấm Sync lại.
- `StructuresBackup` chứa snapshot ngay trước lần ghi gần nhất, độc lập với `Backup` của Grammar. Lỗi ghi thông thường sẽ rollback. Nếu Apps Script bị dừng giữa chừng, `Meta!F1` chặn đọc/ghi Structures để tránh dùng dữ liệu ghi dở. Trước khi khôi phục thủ công, dừng sync trên các thiết bị và sao chép spreadsheet; lấy JSON cột A từ hàng 2 của `StructuresBackup` về `Structures` cột A từ hàng 1, bỏ các hàng dư trong riêng sheet Structures, khôi phục revision từ `StructuresBackup!B1` về `Meta!E1`, rồi xóa dấu trong `Meta!F1`. Không sửa các sheet/ô Grammar khác.
- Google Sheets có giới hạn kích thước ô; backend từ chối record JSON trên 45.000 ký tự trước khi ghi, giữ dữ liệu local để xuất dự phòng. Không tự cắt lịch sử trả lời.

## Kiểm tra local

`node test/structures.test.js`, `node test/structures-backend.test.js`, các test Grammar hiện có, `npm.cmd run lint`, `npm.cmd run build`.

Test dùng source ứng dụng và backend trong mô phỏng bộ nhớ, không gọi endpoint production. Chưa thay thế việc kiểm tra sync thật sau khi bạn triển khai.
