# Grammar VSTEP B1

Luyện tập dùng câu hoàn chỉnh và phân tích tiếng Việt. Chủ đề là nhóm tự học, không phải đề cương VSTEP chính thức. JSON mới bắt buộc `schemaVersion: 2`, `type: "sentence-analysis"`, `sentence`, `vietnameseSentence`, `topic`, `grammarPoints` (category, phrase nguyên văn trong câu, explanation). `structures` và `readingNotes` là các mảng chuỗi tùy chọn. Khóa chủ đề cũ được giữ để tương thích lịch sử; giao diện hiển thị nhãn tiếng Việt.

Không migrate hoặc xóa dữ liệu. Câu TOEIC cũ giữ nguyên savedId, options, answer, ghi chú, dấu sao và tiến độ. Giao diện chỉ điền đáp án cũ khi hiển thị câu; không ghi ngược thành bản ghi mới. Bạn tự xóa các câu cũ trong thư viện khi muốn.

## Giải thích nhanh

Phân tích v2 hiển thị bản dịch, tối đa 6 gạch đầu dòng trích nguyên văn và giải thích ngắn, sau đó đến lưu ý đọc hiểu/thêm nhanh. Prompt dùng lại `grammarPoints`, yêu cầu thường 3–6 ý tự nhiên, chỉ liên quan chủ đề đã chọn; Tổng hợp chọn vài điểm hữu ích thay vì liệt kê hết. Không còn khối cấu trúc dài hoặc các thẻ phân loại ngữ pháp. `structures` cũ vẫn được giữ trong dữ liệu nhưng không hiển thị thành phần riêng.

Khi lưu câu mới, frontend bổ sung metadata tùy chọn `analysisTopic` để nhớ chủ đề luyện tập (đặc biệt Tổng hợp); trường `topic` vẫn là chủ đề chính của câu. Backend v2 giữ nguyên metadata trong JSON, không cần đổi backend hay migrate dữ liệu. Bản ghi cũ thiếu metadata dùng `topic`; bộ lọc chủ đề cụ thể ở thư viện/ôn tập được ưu tiên khi hiển thị. Nội dung cũ chỉ được lọc và trích ngắn trên giao diện, không được viết lại thành văn phong mới; cần tạo bộ câu mới để có lời giải tự nhiên hơn.

## Lưu ý đọc hiểu và thêm nhanh

Prompt mới phân bố khoảng 40% B1, 30% B1+/B2 vừa, 20% B2 khó và 10% tiếp xúc C1, đi từ dễ đến khó; phần khó vẫn được giải thích cho người học hướng tới B1.

Trường bổ sung `readingItems` là mảng mục học: `category` (vocabulary, structure, word-form, preposition, phrase, collocation hoặc pattern), `text` trích nguyên văn từ câu, `explanation` tiếng Việt; tùy chọn `meaning`, `usefulness`, `pattern` (mẫu ngữ pháp khái quát). Không ép số lượng; mảng rỗng hợp lệ. Giữ nguyên `readingNotes` dạng mảng chuỗi để tương thích câu cũ. Hai trường cùng hiển thị trong “Lưu ý đọc hiểu” sau khi mở phân tích.

Ở Luyện tập, Câu đã lưu và Ôn tập, `+ Vocab` / `+ Structure` mở biểu mẫu nhỏ cho phép chỉnh nội dung trước khi lưu bằng store hiện có. Vocabulary giữ nguyên phần tiếng Anh, lưu ghi chú vào annotation; Structures lấy pattern nếu có, giữ câu gốc làm ví dụ và gợi ý giải thích/chủ đề. Kiểm tra trùng sau chuẩn hóa chữ hoa/thường, khoảng trắng và dấu nháy; không ghi đè mục trùng hay tiến độ hiện có. Thông báo thêm thành công là thêm vào thư viện local; đồng bộ tiếp tục do store đích thực hiện.

Đây là phần mở rộng bổ sung của v2: backend hỗ trợ v2 hiện có giữ nguyên trường `readingItems` trong JSON, nên nâng cấp này không cần sửa Apps Script/proxy hoặc triển khai backend mới. Validation mục học được thực hiện khi nhập JSON ở frontend. Câu cũ thiếu `readingItems` vẫn hợp lệ, hiển thị ghi chú cũ và không tự suy diễn mục để thêm nhanh; cần tạo bộ câu mới để có các mục học mới. Kiểm tra thêm bằng `node test/grammar-reading-items.test.js`.

## Bước cập nhật cloud thủ công

Backend cũ yêu cầu dấu trống và A/B/C/D nên không nhận bản ghi v2. Trước khi đồng bộ câu VSTEP, cần cập nhật Apps Script đang chạy:

1. Lưu một bản mã Apps Script đang triển khai để đối chiếu với repo (bản production có thể khác).
2. Bổ sung hàm `validateSentenceAnalysis` từ `grammar-apps-script.js` và nhánh gọi hàm này trong `validateQuestion`, ngay sau kiểm tra savedId. Không thay logic Structures, sheet, secret, revision/CAS, khóa, backup hoặc dữ liệu.
3. Cập nhật deployment Web App hiện có sang phiên bản mới, giữ URL và cấu hình truy cập hiện tại. Không chạy hàm tạo dữ liệu mẫu hoặc xóa sheet.
4. Cập nhật frontend và tải lại trên các thiết bị trước khi tiếp tục đồng bộ câu mới. Frontend cũ chưa hiểu bản ghi v2 nên có thể từ chối snapshot chứa câu mới.

Proxy Vercel và cấu hình URL/secret không cần thay đổi. Chưa cập nhật backend thì bản ghi mới vẫn lưu local, thao tác gửi bị từ chối và pending được giữ; không coi là đã đồng bộ. Thay đổi trong repo chưa được triển khai tự động.

## Thống kê và giới hạn

Thống kê phân tích/tự đánh giá nằm riêng trong `sentenceActivity`, cùng khóa thống kê Grammar hiện có; lịch sử độ chính xác TOEIC vẫn giữ nguyên. Mỗi đánh giá ôn được ghi ngay và cập nhật lịch L1–L5 hiện tại. Lượt phân tích luyện tập được tổng kết khi bấm Kết thúc. Thống kê tiếp tục chỉ lưu trên thiết bị, như trước đây.

Validation kiểm tra cấu trúc JSON, phiên bản, chủ đề, số câu và cụm trích nguyên văn; không thể bảo đảm câu do AI tạo đúng ngữ pháp, bản dịch chính xác hay phân tích đã đầy đủ. Cơ chế merge Grammar cũ giữ nguyên, gồm giới hạn chưa có tombstone: dữ liệu cũ từ thiết bị khác có thể khôi phục câu đã xóa hoặc cấp cao hơn. Không đổi Vocabulary, Structures hoặc chế độ Structures của Smart Quiz.

Kiểm tra không dùng trình duyệt hay endpoint thật: `node test/grammar-sentence.test.js`, `node test/grammar-auto-sync.test.js`, `node test/grammar-sync.test.js`, `node test/structures-backend.test.js`.
