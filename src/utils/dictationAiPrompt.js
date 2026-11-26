// The prompt copied by "Sao chép prompt cho AI" (Dictation → Thư viện bài). The user
// sends it to a chatbot together with the exported .xlsx; the answer is pasted into
// "Nạp bài mới". Edit the level definitions and prompt template here.

export const LS_DICTATION_PROMPT_LEVEL = 'vocabmaster_dictation_prompt_level';
export const DEFAULT_DICTATION_LEVEL = 'A2';

export const DICTATION_LEVELS = [
  {
    id: 'A1',
    label: 'A1',
    description: '4–8 từ · hiện tại đơn, to be, can, there is/are, từ vựng cực quen thuộc',
    difficultyLine: 'mức CEFR A1 (tương đương VSTEP Listening khoảng dưới 4 điểm). Đừng khó hơn.',
    grammarLine: "Mỗi câu 4–8 từ; chỉ dùng thì hiện tại đơn, to be, can, there is/are, câu mệnh lệnh, don't/doesn't; từ vựng cực quen thuộc (số, giờ, giá tiền, gia đình, đồ ăn, đồ vật hằng ngày); không dùng mệnh đề phụ.",
    topicLine: 'Viết như người thật nói trong bài nghe: câu ngắn hằng ngày về gia đình, đồ ăn, giờ giấc, giá tiền, đồ vật quen thuộc, lời chào và yêu cầu đơn giản.',
  },
  {
    id: 'A2',
    label: 'A2',
    description: '6–11 từ · quá khứ đơn, will/going to, so sánh hơn, should/must',
    difficultyLine: 'mức CEFR A2 (tương đương VSTEP Listening khoảng 4–5 điểm). Đừng khó hơn.',
    grammarLine: 'Mỗi câu 6–11 từ; dùng hiện tại đơn, quá khứ đơn, will / going to, so sánh hơn, because/and/but/when, should/must; từ vựng thông dụng, không dùng thành ngữ hiếm, tiếng lóng hay từ chuyên ngành.',
    topicLine: 'Viết như người thật nói trong bài nghe: chủ đề hằng ngày, mua sắm, hẹn gặp, hỏi đường, lịch học/lịch làm, thời tiết, đặt chỗ.',
  },
  {
    id: 'B1',
    label: 'B1',
    description: '8–15 từ · hiện tại hoàn thành, điều kiện loại 1, mệnh đề quan hệ, bị động đơn giản',
    difficultyLine: 'mức CEFR B1 (tương đương VSTEP Listening khoảng 5–6 điểm). Đừng khó hơn.',
    grammarLine: 'Mỗi câu 8–15 từ; có thể dùng hiện tại hoàn thành, câu điều kiện loại 1, mệnh đề quan hệ who/which/that, bị động đơn giản, phrasal verb thông dụng, câu gián tiếp cơ bản; vẫn không dùng thành ngữ hiếm, tiếng lóng, từ chuyên ngành.',
    topicLine: 'Viết như người thật nói trong bài nghe: hội thoại ngắn, thông báo, hỏi đáp, nhờ vả, hẹn gặp, hỏi đường, mua sắm, đặt phòng, lịch học/lịch làm, thời tiết, du lịch.',
  },
  {
    id: 'B2',
    label: 'B2',
    description: '12–20 từ · điều kiện loại 2/3, bị động nhiều dạng, mệnh đề phức, học thuật nhẹ',
    difficultyLine: 'mức CEFR B2 (tương đương VSTEP Listening khoảng 7–8 điểm). Đừng khó hơn.',
    grammarLine: 'Mỗi câu 12–20 từ; có thể dùng điều kiện loại 2/3, bị động nhiều dạng, mệnh đề phức, từ vựng trừu tượng/học thuật nhẹ; vẫn là lời nói tự nhiên như trong bài nghe, không dùng thành ngữ hiếm hay tiếng lóng.',
    topicLine: 'Viết như người thật nói trong bài nghe: thảo luận, thông báo công việc/học tập, nêu ý kiến, giải thích nguyên nhân – kết quả, kế hoạch, phỏng vấn ngắn, bài nói phổ thông.',
  },
];

function findLevel(levelId) {
  return DICTATION_LEVELS.find(level => level.id === levelId)
    || DICTATION_LEVELS.find(level => level.id === DEFAULT_DICTATION_LEVEL);
}

export function buildDictationAiPrompt(levelId = DEFAULT_DICTATION_LEVEL) {
  const level = findLevel(levelId);
  return `Bạn là giáo viên luyện nghe tiếng Anh. File Excel đính kèm là các câu tiếng Anh tôi đã dùng để luyện nghe chép chính tả: cột A, mỗi dòng một câu, không có tiêu đề.

Việc cần làm: viết thêm bộ 40 câu MỚI để tôi nạp tiếp vào kho luyện nghe.

Quy tắc:
- Không trùng và không gần giống (chỉ đổi 1–2 từ) bất kỳ câu nào trong file. Trước khi viết, xem các chủ đề và cấu trúc câu đã có trong file, rồi viết bổ sung những dạng còn thiếu hoặc ít gặp.
- Độ khó: ${level.difficultyLine}
- ${level.grammarLine}
- ${level.topicLine}
- Trộn câu khẳng định, phủ định, câu hỏi, lời đề nghị và các thì cơ bản. Khoảng 1/4 số câu có thông tin dễ nghe nhầm: giờ giấc, ngày tháng, số, giá tiền, số điện thoại, tên riêng đơn giản.
- Mỗi câu kết thúc bằng một trong các dấu . ? ! và đứng riêng một dòng.

Định dạng kết quả:
- Trả lời trong MỘT khối code duy nhất để tôi bấm copy.
- Mỗi dòng đúng một câu theo dạng: English sentence | Bản dịch tiếng Việt
- Không đánh số, không tiêu đề, không giải thích thêm, không chèn dòng trống.`;
}

export const DICTATION_AI_PROMPT = buildDictationAiPrompt(DEFAULT_DICTATION_LEVEL);

export function readDictationPromptLevel() {
  try {
    const raw = globalThis.localStorage?.getItem(LS_DICTATION_PROMPT_LEVEL);
    return findLevel(raw).id;
  } catch {
    return DEFAULT_DICTATION_LEVEL;
  }
}

export function writeDictationPromptLevel(levelId) {
  const normalized = findLevel(levelId).id;
  try {
    globalThis.localStorage?.setItem(LS_DICTATION_PROMPT_LEVEL, normalized);
  } catch {
    // Device-only preference; ignore quota/privacy storage errors.
  }
  return normalized;
}
