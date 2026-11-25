# Cài đặt đồng bộ Dictation với Google Sheet (Nghĩa tự làm)

Khi chưa làm các bước dưới đây, tab **Dictation** vẫn dùng bình thường: bài, kết quả và từ đã lưu nằm trên từng thiết bị. Dòng trạng thái trong tab sẽ báo *"Chưa cài đặt đồng bộ Google Sheet"*.

Làm xong thì mọi thiết bị dùng chung một file Google Sheet, gồm 2 tab dữ liệu **"Từ vựng"** và **"Câu hoàn chỉnh"**.

Thời gian: khoảng 15 phút. Cần đăng nhập Google (tài khoản chứa Drive) và Vercel.

> Không dùng lại Apps Script hay secret của Grammar. Dictation có file Sheet, Apps Script và secret **riêng**.

---

## Bước 1 — Tạo file Google Sheet

1. Mở <https://drive.google.com> → **Mới** → **Google Trang tính** → **Bảng tính trống**.
2. Bấm vào tên "Bảng tính không có tiêu đề" ở góc trên, đổi thành **VocabMaster - Dictation**.
3. Không cần tạo tab hay tiêu đề nào. Lần đồng bộ đầu tiên sẽ tự tạo các tab "Từ vựng", "Câu hoàn chỉnh", "Meta" và "Sao lưu".

## Bước 2 — Dán mã Apps Script

1. Trong file Sheet vừa tạo, chọn menu **Tiện ích mở rộng** → **Apps Script**.
2. Ở góc trên bên trái, bấm "Dự án không có tiêu đề" và đổi tên thành **VocabMaster - Dictation Backend**.
3. Trong file `Code.gs`, xoá hết mã mẫu (`Ctrl+A` → `Delete`).
4. Mở file `dictation-apps-script.js` trong thư mục dự án `C:\web toiec`, bằng VS Code hoặc Notepad.
5. Chép **toàn bộ** nội dung (`Ctrl+A` → `Ctrl+C`), quay lại Apps Script và dán vào `Code.gs` (`Ctrl+V`).
6. Bấm biểu tượng 💾 (hoặc `Ctrl+S`) để lưu.

## Bước 3 — Tạo secret (mật mã riêng)

Secret là một chuỗi ngẫu nhiên dài. Vercel dùng nó để chứng minh với Apps Script rằng yêu cầu đến từ web của bạn. **Không gửi secret cho ai và không dán vào mã nguồn.**

Cách tạo: mở **PowerShell** và chép-dán lệnh này (mỗi lần chạy ra một chuỗi khác):

```powershell
-join ((48..57)+(65..90)+(97..122) | Get-Random -Count 40 | ForEach-Object {[char]$_})
```

Chép chuỗi vừa hiện ra vào Notepad để dùng ở bước 4 và bước 6.

## Bước 4 — Đặt Script Property trong Apps Script

1. Trong Apps Script, bấm biểu tượng ⚙️ **Cài đặt dự án** ở thanh bên trái.
2. Kéo xuống phần **Thuộc tính tập lệnh** → **Thêm thuộc tính tập lệnh**.
3. Ô **Thuộc tính**: `DICTATION_SYNC_SECRET` (gõ đúng chữ in hoa và dấu gạch dưới).
4. Ô **Giá trị**: dán secret ở bước 3.
5. Bấm **Lưu thuộc tính tập lệnh**.

## Bước 5 — Triển khai Apps Script thành ứng dụng web

1. Bấm nút xanh **Triển khai** (góc trên bên phải) → **Tùy chọn triển khai mới**.
2. Bấm ⚙️ cạnh "Chọn loại" → chọn **Ứng dụng web**.
3. Điền như sau:
   - **Mô tả**: `Dictation v1`
   - **Thực thi dưới dạng**: **Tôi** (email của bạn)
   - **Người có quyền truy cập**: **Bất kỳ ai**

   Yên tâm: không có secret thì Apps Script từ chối mọi yêu cầu.
4. Bấm **Triển khai**. Google hỏi cấp quyền:
   1. Bấm **Cấp quyền truy cập** rồi chọn tài khoản của bạn.
   2. Nếu gặp màn hình "Google chưa xác minh ứng dụng này", bấm **Nâng cao** → **Đi tới VocabMaster - Dictation Backend (không an toàn)**. Đây là mã của chính bạn.
   3. Bấm **Cho phép**.
5. Chép **URL ứng dụng web**. URL có dạng `https://script.google.com/macros/s/……/exec`. Dán nó vào Notepad.

## Bước 6 — Thêm 2 biến môi trường trên Vercel

1. Mở <https://vercel.com>, chọn dự án web VocabMaster → **Settings** → **Environment Variables**.
2. Thêm biến thứ nhất:
   - **Key**: `DICTATION_APPS_SCRIPT_URL`
   - **Value**: URL `/exec` ở bước 5
   - **Environments**: tick **Production** (thêm **Preview** nếu muốn thử trên bản preview)
   - Bấm **Save**.
3. Thêm biến thứ hai:
   - **Key**: `DICTATION_SYNC_SECRET`
   - **Value**: đúng secret ở bước 3 (giống hệt bước 4)
   - **Environments**: như biến thứ nhất
   - Bấm **Save**.

## Bước 7 — Đưa mã lên và cho Vercel áp dụng biến mới

Biến môi trường chỉ có tác dụng với **lần deploy sau khi thêm biến**.

- **Nếu chưa ghép nhánh `feat/dictation` vào `main`:** ghép và push theo hướng dẫn trong báo cáo. Vercel sẽ tự deploy và dùng luôn biến mới.
- **Nếu đã ghép từ trước:** Vercel → **Deployments** → bản trên cùng → nút **⋯** → **Redeploy** → **Redeploy**.

## Bước 8 — Kiểm tra

1. Mở web (bản production) → tab **Dictation**. Dòng trạng thái phải hiện **"Đã đồng bộ với Google Sheet."**
2. Vào **Thư viện bài**, thêm một bài thử 1–2 câu. Đợi khoảng 3–5 giây.
3. Mở file Sheet **VocabMaster - Dictation**: tab **Câu hoàn chỉnh** phải có các câu vừa thêm (hàng 1 là tiêu đề tiếng Việt).
4. Trên điện thoại (hoặc máy khác), mở web → tab Dictation. Bài vừa tạo phải xuất hiện.

## Nếu có lỗi

Dòng trạng thái trong tab Dictation cho biết lỗi:

| Thông báo | Nghĩa là | Cách sửa |
|---|---|---|
| Chưa cài đặt đồng bộ Google Sheet | Vercel chưa có đủ 2 biến, hoặc chưa redeploy | Làm lại bước 6 và 7 |
| Máy chủ từ chối: secret … chưa khớp | Secret ở Vercel khác secret ở Apps Script | Dán lại **cùng một** secret ở bước 4 và 6, rồi Redeploy |
| Lần ghi trước trên Sheet bị ngắt giữa chừng | Apps Script bị dừng khi đang ghi; Sheet tạm khoá để không mất dữ liệu | Đừng sửa tay. Dữ liệu cũ nằm ở tab "Sao lưu" và vẫn còn trên các thiết bị. Nhờ AI/người hỗ trợ khôi phục rồi xoá ô `Meta!B3` |
| Mất kết nối mạng / Máy chủ đang bận | Tạm thời | Tự thử lại; hoặc bấm **Đồng bộ ngay** |

## Quy tắc khi mở file Sheet

- **Xem thoải mái.** Có thể lọc, tô màu, chỉnh độ rộng cột.
- **Không sửa tay cột cuối "Dữ liệu (JSON – không sửa tay)".** Đó là dữ liệu thật. Sửa các cột khác cũng không có tác dụng vì lần đồng bộ sau sẽ ghi lại.
- **Không xoá hàng, không đổi tên tab.** Muốn xoá bài hay xoá từ thì làm trong web. Mục đã xoá vẫn còn hàng với trạng thái "Đã xoá"; đây là dấu để thiết bị cũ không làm sống lại dữ liệu đã xoá.
- Tab "Sao lưu" luôn giữ bản trước lần ghi gần nhất.

## Khi có bản `dictation-apps-script.js` mới

1. Dán mã mới vào Apps Script như bước 2, rồi lưu.
2. **Triển khai** → **Quản lý việc triển khai** → bấm ✏️ trên bản đang dùng → ô **Phiên bản**: chọn **Phiên bản mới** → **Triển khai**.

URL `/exec` giữ nguyên nên không phải sửa Vercel.
