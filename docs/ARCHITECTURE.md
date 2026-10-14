# Kiến trúc

```text
Trình duyệt (React SPA)
  │  axios, withCredentials, header x-csrf-token
  ▼
Express /api/v1 ── helmet ─ cors(allowlist) ─ pino-http(redact) ─ json(200kb) ─ cookie-parser
                └─ rateLimit ─ anonymousSession ─ csrfProtection ─ attachUser(JWT → DB) ─ routes ─ errorHandler
  ▼
MongoDB (Mongoose)
```

- **Server** (`server/src`): `config` (env Zod, DB, danh mục, huy hiệu) → `schemas` (Zod, `.strict()`) → `controllers` (mỏng) →
  `services` (nghiệp vụ: planner, passport, analytics, QR, serialize) → `models`. Lỗi đi qua `AppError` và `errorHandler`.
- **Client** (`client/src`): `components/ui` (design system), `components/layout` (Header, PublicLayout, AdminLayout, guards),
  `pages` (du khách), `pages/admin` (lazy-load), `stores` (Zustand: auth, toast, bản nháp lịch trình), `lib` (api, format,
  catalog, thao tác lịch trình, phân tích mã QR).
- **Phân quyền**: guard phía client chỉ phục vụ UX; mọi API được bảo vệ đều kiểm tra lại trên server, vai trò đọc từ DB.

## Mô hình dữ liệu

| Collection | Trường chính | Ràng buộc / index |
| --- | --- | --- |
| `users` | email, passwordHash (bcrypt 12, `select:false`), displayName, role `tourist\|admin`, status | unique email |
| `destinations` | slug, name, summary, description, category, tags, area, address?, coordinates?, images[{url, alt, credit, license, sourceUrl}], openingHours?, referencePrice?, contactInfo?, estimatedVisitDuration?{minutes, isEstimate, note}, sourceUrls, verification{location, openingHours, referencePrice, contactInfo}, verificationStatus, isIllustrative, lastVerifiedAt?, publicationStatus, operationalStatus, searchText | unique slug; index (publicationStatus, category, area), updatedAt |
| `challenges` | destinationId, title, description, story, type `quiz`, questions[{prompt, options, correctOptionIndex, explanation}], scoringRules{rewardPoints, minCorrect}, status | index destinationId+status |
| `qrcodes` | code (A–Z, 0–9, `-`), label, targetType `destination\|challenge`, targetId, status, notes | unique code |
| `banners` | placement `home_top`, kind `cover\|event\|promo`, theme, eyebrow?, title, subtitle?, imageUrl?, imageAlt?, linkUrl?, linkLabel?, sponsorName?, status, startAt?, endAt?, sortOrder, impressions, clicks | index (placement, status, sortOrder); `promo` bắt buộc `sponsorName`; link/ảnh chỉ http(s) hoặc `/path` |
| `passportentries` | userId? \| anonymousSessionId?, entryType `check_in\|challenge_completed\|badge`, destinationId?, challengeId?, qrCodeId?, badgeKey?, scoreAwarded, correctCount, totalQuestions, completedAt | 6 unique partial index: (chủ sở hữu × challengeId), (chủ sở hữu × destinationId cho check-in), (chủ sở hữu × badgeKey) |
| `favorites` | userId, destinationId | unique (userId, destinationId) |
| `itineraries` | userId, title, preferences, days[{dayNumber, items[{destinationId, nameSnapshot, slugSnapshot, durationMinutes, durationIsEstimate, note}]}], estimatedDurationMinutes | index userId+updatedAt |
| `analyticsevents` | eventType, timestamp, destinationId?, qrCodeId?, challengeId?, itineraryId?, userId?, anonymousSessionId?, metadata | index timestamp, eventType+timestamp; **không** lưu IP/user agent |

Giá trị không biết được lưu là **vắng mặt** (không phải 0 hay chuỗi rỗng); API trả `null` và giao diện hiển thị
"Chưa có thông tin xác minh".

## Các quyết định quan trọng

### Trung thực dữ liệu
- `verificationStatus` do server tính từ `verification` + dữ liệu thực có; không thể đặt "đã xác minh" nếu thiếu dữ liệu,
  thiếu nguồn hoặc thiếu ngày xác minh.
- `isIllustrative` hiển thị nhãn "Dữ liệu minh họa". Thiếu ảnh → placeholder thiết kế sẵn, ảnh lỗi → tự chuyển placeholder.

### QR và thử thách
- Mã QR là mã ổn định trong DB; nội dung in ra là `{PUBLIC_APP_URL}/qr/{code}`. Admin đổi đích mà không cần in lại.
  Đích chỉ là địa điểm hoặc thử thách trong DB (không có URL tùy ý → không có open redirect).
- Tách bạch: `GET /qr/:code` (đọc, không ghi) · `POST /scan` (lượt mở trang từ QR) · `POST /check-in` · `POST /challenges/:id/complete`.
- Đáp án chỉ nằm ở server. Server chấm, kiểm tra QR đang hoạt động thuộc đúng địa điểm, và ghi `passportentries` bằng insert;
  unique index bảo đảm **một lần thưởng** kể cả khi gửi đồng thời (lỗi 11000 → `alreadyCompleted`).
- Huy hiệu được tính lại sau mỗi check-in/hoàn thành; cũng được bảo vệ bằng unique index.

### Hộ chiếu khách và đồng bộ
- Khách chưa đăng nhập được gắn cookie `dtst_anon`; mục hộ chiếu lưu theo `anonymousSessionId`.
- `POST /passport/claim` chuyển từng mục sang `userId`; mục đã tồn tại trong tài khoản bị xóa khỏi phía trình duyệt thay vì
  cộng thêm → không cộng điểm hai lần. Sau đó tính lại huy hiệu.

### Bộ lập lịch theo quy tắc (`services/itineraryPlanner.ts`)
1. Lọc địa điểm `published` + `active` theo khu vực.
2. Chấm điểm: +3 khớp loại hình quan tâm, +1 mỗi tag khớp, +0,5 nếu có thời lượng thật; điểm ưu tiên luôn xếp trước.
3. Gom cụm bằng láng giềng gần nhất (haversine) có trọng số điểm; địa điểm không có tọa độ xếp sau và có cảnh báo.
4. Xếp vào từng ngày theo giới hạn giờ/ngày; mỗi lần chuyển điểm cộng **khoảng đệm cố định 30 phút** (ghi rõ không phải
   thời gian di chuyển). Thiếu thời lượng → dùng mặc định 90 phút và cảnh báo.
5. Trả về lý do chọn từng điểm, cảnh báo và danh sách điểm không xếp được kèm lý do (không âm thầm bỏ điểm).

### Thống kê
- Chỉ server ghi sự kiện; khử trùng lặp theo phiên (xem trang 30 phút, mở QR 10 phút). Ghi lỗi chỉ log, không chặn người dùng.
- Dashboard gom nhóm theo ngày giờ Việt Nam; "người dùng duy nhất" = số định danh khác nhau (userId hoặc cookie ẩn danh) và
  được ghi rõ là ước lượng.

### Bảo mật
- Mật khẩu bcrypt (cost 12), đăng nhập so sánh với hash giả khi email không tồn tại để giảm rò rỉ thời gian phản hồi.
- JWT chỉ trong cookie HttpOnly (không localStorage). CSRF double-submit cho mọi request thay đổi dữ liệu.
- Zod `.strict()` cho mọi body, ép kiểu nguyên thủy → chặn NoSQL operator injection; regex tìm kiếm được escape.
- Helmet CSP chặt (`script-src 'self'`), CORS theo allowlist, body tối đa 200 KB, log pino che cookie/token/mật khẩu.
- Không có endpoint tạo admin; admin chỉ được tạo bằng script seed từ biến môi trường.

Các biện pháp trên giảm rủi ro phổ biến nhưng không thay thế kiểm thử bảo mật chuyên sâu; hệ thống chưa qua đánh giá hay
chứng nhận bảo mật độc lập.
