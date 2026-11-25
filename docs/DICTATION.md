# Dictation (luyện nghe chép chính tả) — thiết kế kỹ thuật

Trạng thái: nhánh `feat/dictation` (25/11/2026). Đồng bộ mới chỉ được kiểm tra bằng mô phỏng, **chưa chạy với Apps Script/Vercel/Sheet thật**. Người dùng tự cài đặt theo [DICTATION-SETUP.md](DICTATION-SETUP.md).

## 1. File

| Lớp | File |
|---|---|
| Tab, tải lười | `src/components/Dictation.jsx`, `src/components/dictation/DictationPractice.jsx`, `DictationWords.jsx`, `DictationLibrary.jsx`, `DictationSyncStatus.jsx` |
| Listening (nguồn "Từ chép chính tả", tải lười) | `src/components/DictationWordListening.jsx`; nút chọn nguồn trong `ListeningReview.jsx` |
| Store (tạo ở `App.jsx`) | `src/hooks/useDictationStore.js` |
| Hàm thuần | `dictationCheck.js` (chấm câu), `dictationParse.js` (tách câu, đọc bài dán), `dictationModel.js` (sửa dữ liệu), `dictationSyncMerge.js` (kiểm tra + hợp nhất), `dictationStorage.js` (LocalStorage), `dictationCloud.js` (gọi proxy), `dictationExport.js` (Excel) |
| Máy chủ | `api/dictation-sync.js` (proxy Vercel), `dictation-apps-script.js` (Apps Script riêng) |
| Test | Node: `dictation-check`, `dictation-parse`, `dictation-model`, `dictation-backend` (+ `test/helpers/dictation-backend.js`). Trình duyệt: `dictation-browser`, `dictation-sync-browser` |

## 2. Mô hình dữ liệu

Snapshot `{ sentences, words }`. Bản ghi **không bao giờ bị xoá khỏi mảng**: xoá thì ghi `deletedAt` (tombstone).

**Bài** không có bản ghi riêng. Bài được suy ra từ các câu có cùng `lessonId`. Xoá bài nghĩa là tombstone mọi câu của bài đó. Từ đã lưu vẫn giữ lại.

**Câu** (`sentences[]`), id có dạng `<lessonId>_<order>`:

```
{ id, lessonId, lessonTitle, order, english, vietnamese, createdAt, updatedAt, deletedAt?,
  lastResult?: 'correct'|'wrong', lastResultAt?, attempts?: { [deviceId]: số lần nộp } }
```

**Từ đã lưu** (`words[]`):

```
{ id /* = normalizeWord(word), chữ thường */, word /* dạng hiển thị */, sentenceId, sentence /* câu gốc */,
  lessonTitle, savedAt, updatedAt, deletedAt?, listen?: { [deviceId]: { correct, wrong } } }
```

- Lưu lại một từ đã xoá dùng cùng `id`: bỏ `deletedAt`, tăng `updatedAt`, giữ bộ đếm `listen`.
- `deviceId` là chuỗi ngẫu nhiên riêng của từng trình duyệt (`vocabmaster_dictation_device`).

## 3. Quy tắc chấm (dictationCheck.js)

- Không phân biệt hoa/thường.
- Bỏ mọi dấu câu, kể cả dấu chấm và phẩy nằm trong từ: "U.S." thành "us", "1,000" thành "1000". Hai phía được xử lý như nhau.
- Giữ dấu nháy đơn và gạch nối ở giữa từ; ’ ‘ ʼ ` ´ đều coi là '.
- Khoảng trắng thừa không tính.
- So sánh bằng chuỗi con chung dài nhất (LCS). Kết quả gồm các loại `correct`, `wrong`, `missing`, `extra`.
- Câu chỉ đúng khi mọi từ đúng và không có từ thừa.
- Chip từ mở khi từ đó đã có trong phần gõ, đúng thứ tự (`matchedWordIndexes`).

## 4. Tách câu khi dán bài (dictationParse.js)

- Mỗi dòng là một câu. Viết `English | Tiếng Việt` để kèm bản dịch: chỉ dấu `|` đầu tiên được dùng để tách, phần sau giữ nguyên.
- Dòng không có `|` được tách tiếp tại `. ? ! …` khi theo sau là khoảng trắng và một ký tự không phải chữ thường.
- Không tách sau các từ viết tắt trong danh sách (Mr, Dr, etc, a.m.…), chữ cái viết tắt (U.S., e.g., J.) và số thập phân.
- Giới hạn đã biết: "9 a.m. Please…" không bị tách (an toàn hơn tách nhầm).
- Tối đa 500 câu mỗi bài, mỗi câu 1.000 ký tự.

## 5. Hợp nhất (dictationSyncMerge.js = các hàm `dict*` trong Apps Script)

- Phần nội dung của mỗi bản ghi: bản nào có `updatedAt` lớn hơn thắng. Khi bằng nhau thì so JSON chuẩn hoá để chọn, nên kết quả không phụ thuộc thứ tự. Vì vậy xoá (cập nhật mới hơn) thắng bản cũ chưa xoá, và thiết bị cũ không hồi sinh được dữ liệu.
- `lastResult`: bản có `lastResultAt` lớn hơn thắng.
- `attempts` và `listen`: lấy max theo từng `deviceId`. Lượt của hai thiết bị được cộng dồn, gửi lại không bị đếm gấp đôi.
- Phép hợp nhất có tính giao hoán và lặp lại không đổi kết quả (đã kiểm tra trong test). Hàm trong Apps Script được test là cho kết quả giống hệt hàm phía web.

## 6. Lưu trên máy

Mỗi lần sửa: ghi LocalStorage trước, thành công mới cập nhật giao diện. Ghi lỗi (đầy bộ nhớ) thì giữ nguyên trạng thái cũ và báo lỗi.

| Khóa | Nội dung |
|---|---|
| `vocabmaster_dictation_data` | `{ schema: 1, sentences, words }`. Nếu hỏng thì **khoá ghi và khoá đồng bộ**, không ghi đè |
| `vocabmaster_dictation_device` | `deviceId` |
| `vocabmaster_dictation_prefs` | tốc độ, tự phát, lặp, hiện bản dịch (riêng thiết bị, không đồng bộ) |
| `vocabmaster_listening_autofocus` | dùng chung với Listening (`listeningPrefs.js`) |

Không đụng các khóa Vocabulary/Grammar/Structures.

**Sao lưu tay:** Thư viện bài → "Xuất bản sao (.json)" (gồm cả tombstone). "Nhập bản sao" chỉ **gộp** bằng phép hợp nhất ở trên, không xoá gì.

**Xuất Excel** (`dictationExport.js`, nhánh `feat/export-sentences-only`): file để đưa chatbot đọc, **không phải bản sao lưu**. Đúng một sheet "Câu tiếng Anh", một cột A rộng 100, mỗi dòng một câu tiếng Anh; không tiêu đề, bản dịch, tên bài, ngày giờ, kết quả, từ đã lưu hay công thức. Chỉ câu đang dùng; lấy phần trước dấu `|`; bỏ câu trùng (sau khi cắt khoảng trắng, không phân biệt hoa/thường, giữ câu đầu tiên); thứ tự theo bài rồi theo vị trí câu. Xuống dòng/khoảng trắng thừa được gộp thành một khoảng trắng. Không có câu nào thì không tải file. Tên file `Dictation-YYYY-MM-DD.xlsx`. File trên Google Drive (đồng bộ) vẫn có tab "Từ vựng" và "Câu hoàn chỉnh" như cũ. Test: `dictation-export` (cần Python), `dictation-export-browser`.

## 7. Đồng bộ

Theo mẫu Structures:

1. GET `/api/dictation-sync` để lấy `{ ok, schema: 1, revision, sentences, words }`.
2. Hợp nhất với dữ liệu trên máy và lưu lại trên máy.
3. Nếu Sheet đã chứa đủ mọi thứ thì xong. Nếu chưa, POST `{ action: 'save', schema: 1, expectedRevision, sentences, words }`.
4. Server ghi khi `revision` khớp **và** bản gửi lên đã chứa mọi bản ghi trên Sheet (`merge(payload, cloud) == merge(payload)`). Nếu không thì trả `conflict`, client GET lại và thử thêm một lần.
5. Client chỉ coi là đã lưu khi `revision === expected + 1` và số bản ghi ghi được khớp.

**Lúc tự đồng bộ:** khi mở app, khi có mạng lại, khi focus (cách nhau tối thiểu 30 giây), và 2,5 giây sau mỗi lần sửa. Thay đổi xảy ra trong lúc POST thì có vòng đồng bộ riêng sau đó.

**Trạng thái** hiện trong tab Dictation (`#dictation-sync-status`), không hiện ở thanh menu:

| Trạng thái | Ý nghĩa |
|---|---|
| `idle`, `syncing`, `pending`, `ok` | Bình thường |
| `unconfigured` | 503 `unconfigured`, hoặc `npm run dev` không có `/api` |
| `error` | Có lỗi khác |
| `locked` | Dữ liệu trên máy hỏng |

**Apps Script** (`dictation-apps-script.js`):

- Sheet "Từ vựng" và "Câu hoàn chỉnh": hàng 1 là tiêu đề tiếng Việt, cột 10 là JSON thật, các cột khác chỉ để đọc. Chữ bắt đầu bằng `= + - @` được thêm `'` để không thành công thức.
- "Meta": B1 revision, B2 thời điểm ghi, B3 cờ đang ghi, B4 schema.
- "Sao lưu": bản trước mỗi lần ghi.
- Có LockService và secret bắt buộc (`DICTATION_SYNC_SECRET`).
- Hàng JSON hỏng hoặc cờ đang ghi còn sót thì chặn đọc (`server_error` / `interrupted`) thay vì làm mất hàng.
- Giới hạn: 20.000 câu và 20.000 từ; mỗi JSON tối đa 45.000 ký tự.

**Proxy** `api/dictation-sync.js`:

- Bắt buộc `DICTATION_APPS_SCRIPT_URL` và `DICTATION_SYNC_SECRET`; thiếu thì trả 503 `unconfigured`.
- Không có CORS; timeout 25 giây; không trả nội dung lỗi nội bộ.
- Mã HTTP: 409 conflict, 401 unauthorized, 503 busy, 500 interrupted/server_error.

**Giới hạn chưa xử lý (suy luận):**

- Mỗi lần đồng bộ gửi cả kho dữ liệu, nên cũng chịu giới hạn body 4,5 MB của Vercel như Grammar (xem TRANG-THAI mục 14). Với vài nghìn câu thì vẫn nhỏ, chưa đo.
- Tombstone không bao giờ bị dọn.

## 8. Phím tắt (DictationPractice)

| Phím | Tác dụng |
|---|---|
| Enter | Nộp (nộp rồi thì sang câu sau) |
| Ctrl+Enter | Nghe lại |
| Shift+Enter | Phát/dừng |
| Ctrl+↑ / Ctrl+↓ | Câu trước/sau |
| Ctrl+/ | Gợi ý từ |

- Không dùng phím chữ đơn, Alt+mũi tên, Ctrl+R/W/K/H/J/G/B/F, nên không đụng phím của trình duyệt trên Windows.
- Phím tắt bỏ qua khi con trỏ đang ở ô nhập khác, và khi đang gõ bộ gõ (IME composing).
- Trên Mac, Ctrl+↑ có thể mở Mission Control (chưa thử).

## 9. Listening (nguồn "Từ chép chính tả")

- Chỉ gọi `recordWordListen(id, đúng/sai)`, tức là cộng `listen[deviceId]` trên bản ghi từ Dictation. Không gọi `updateWordLevel`, không đổi `vocabmaster_words`, L1–L5 hay ngày ôn (test `dictation-browser` kiểm tra).
- "Chỉ từ hay sai" lấy các từ có tổng `wrong > 0`.
