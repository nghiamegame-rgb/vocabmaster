// The prompt copied by "Sao chép prompt cho AI" (Dictation → Thư viện bài). The user
// sends it to a chatbot together with the exported .xlsx; the answer is pasted into
// "Nạp bài mới". Edit the text here.
export const DICTATION_AI_PROMPT = `Bạn là giáo viên luyện nghe tiếng Anh. File Excel đính kèm là các câu tiếng Anh tôi đã dùng để luyện nghe chép chính tả: cột A, mỗi dòng một câu, không có tiêu đề.

Việc cần làm: viết thêm bộ 40 câu MỚI để tôi nạp tiếp vào kho luyện nghe.

Quy tắc:
- Không trùng và không gần giống (chỉ đổi 1–2 từ) bất kỳ câu nào trong file. Trước khi viết, xem các chủ đề và cấu trúc câu đã có trong file, rồi viết bổ sung những dạng còn thiếu hoặc ít gặp.
- Độ khó: VSTEP Listening từ 5 điểm trở xuống (khoảng A2–B1). Đừng khó hơn.
- Mỗi câu 6–15 từ, từ vựng thông dụng, ngữ pháp đơn giản. Không dùng thành ngữ hiếm, tiếng lóng, từ chuyên ngành hay câu nhiều mệnh đề lồng nhau.
- Viết như người thật nói trong bài nghe: hội thoại ngắn, thông báo, hỏi đáp, nhờ vả, hẹn gặp, hỏi đường, mua sắm, đặt phòng, lịch học/lịch làm, thời tiết, du lịch.
- Trộn câu khẳng định, phủ định, câu hỏi, lời đề nghị và các thì cơ bản. Khoảng 1/4 số câu có thông tin dễ nghe nhầm: giờ giấc, ngày tháng, số, giá tiền, số điện thoại, tên riêng đơn giản.
- Mỗi câu kết thúc bằng một trong các dấu . ? ! và đứng riêng một dòng.

Định dạng kết quả:
- Trả lời trong MỘT khối code duy nhất để tôi bấm copy.
- Mỗi dòng đúng một câu theo dạng: English sentence | Bản dịch tiếng Việt
- Không đánh số, không tiêu đề, không giải thích thêm, không chèn dòng trống.`;
