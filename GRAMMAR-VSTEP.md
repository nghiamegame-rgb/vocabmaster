# Grammar VSTEP B1

Luyện tập dùng câu hoàn chỉnh và phân tích tiếng Việt. Chủ đề là nhóm tự học, không phải đề cương VSTEP chính thức. JSON mới bắt buộc `schemaVersion: 2`, `type: "sentence-analysis"`, `sentence`, `vietnameseSentence`, `topic`, `grammarPoints` (category, phrase nguyên văn trong câu, explanation). `structures` và `readingNotes` là các mảng chuỗi tùy chọn. Khóa chủ đề cũ được giữ để tương thích lịch sử; giao diện hiển thị nhãn tiếng Việt.

Không migrate hoặc xóa dữ liệu. Câu TOEIC cũ giữ nguyên savedId, options, answer, ghi chú, dấu sao và tiến độ. Giao diện chỉ điền đáp án cũ khi hiển thị câu; không ghi ngược thành bản ghi mới. Bạn tự xóa các câu cũ trong thư viện khi muốn.

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
