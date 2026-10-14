# API v1

Base URL: `/api/v1`. Mọi phản hồi là JSON (trừ ảnh QR). Lỗi có dạng thống nhất:

```json
{ "error": { "code": "VALIDATION_ERROR", "message": "Dữ liệu không hợp lệ.", "details": [{ "path": "name", "message": "..." }] } }
```

## Xác thực, CSRF, phiên ẩn danh

| Cookie | Mục đích |
| --- | --- |
| `dtst_access` | JWT (HS256) HttpOnly, SameSite theo `COOKIE_SAMESITE`, Secure trong production, hạn 7 ngày. Vai trò/trạng thái luôn đọc lại từ DB mỗi request. |
| `dtst_csrf` | Token CSRF HttpOnly (double-submit). |
| `dtst_anon` | UUID ngẫu nhiên cho hộ chiếu khách và ước lượng người dùng duy nhất. |

- Mọi request **POST/PUT/PATCH/DELETE** phải gửi header `x-csrf-token` lấy từ `GET /csrf` (client axios tự xử lý và thử lại một
  lần khi nhận `CSRF_INVALID`).
- `401 UNAUTHORIZED` khi chưa đăng nhập; `403 FORBIDDEN` khi đăng nhập nhưng không đủ quyền.
- Rate limit (429 `RATE_LIMITED`): API chung 300/phút; đăng nhập 10/15 phút; đăng ký 10/giờ; check-in & nộp thử thách 30/10 phút;
  ghi sự kiện & tạo lịch trình 60/phút.

## Công khai / du khách

| Method | Path | Ghi chú |
| --- | --- | --- |
| GET | `/health` | `{status, database}`; 503 nếu mất kết nối DB |
| GET | `/csrf` | `{csrfToken}` |
| POST | `/auth/register` | `{email, password(8–128), displayName}` → luôn tạo vai trò `tourist`. 409 `EMAIL_TAKEN` |
| POST | `/auth/login` | `{email, password}` → 401 `INVALID_CREDENTIALS`, 403 `ACCOUNT_DISABLED` |
| POST | `/auth/logout` | 204, xóa cookie |
| GET | `/auth/me` | `{user}` hoặc `{user: null}` |
| GET | `/banners?placement=home_top` | Banner/quảng cáo đầu trang chủ: chỉ `active` và trong lịch `startAt`/`endAt`, tối đa 6, sắp theo `sortOrder`. Không trả bộ đếm/trạng thái; tăng `impressions` ngầm |
| POST | `/banners/:id/click` | Ghi lượt nhấp (204), có rate limit; không cần đăng nhập |
| GET | `/destinations` | Chỉ địa điểm `published`. Query: `q`, `category` (csv), `area` (csv), `hasActivity=true`, `sort=name\|recent`, `page`, `limit` |
| GET | `/destinations/:slug` | `{destination, challenges, hasActiveQr}`; 404 nếu chưa xuất bản |
| GET | `/destinations/:slug/related` | Gợi ý cùng loại hình/khu vực |
| POST | `/events/destination-view` | `{slug}` – ghi `destination_page_view` (gộp trong 30 phút/phiên) |
| POST | `/itineraries/generate` | `{numberOfDays 1–7, hoursPerDay 2–12, areas[], interests[], priorityDestinationIds[]}` → `PlanResult` (ngày, lý do, cảnh báo, điểm không xếp được, giả định) |
| POST | `/itineraries` 🔒 | Lưu lịch trình `{title, preferences, days[{dayNumber, items[{destinationId, note?}]}]}` |
| GET | `/itineraries/my` 🔒 | Danh sách của chính người dùng |
| GET/PATCH/DELETE | `/itineraries/:id` 🔒 | Chỉ chủ sở hữu; người khác nhận 404 |
| GET | `/qr/:code` | Nội dung đích (chỉ đọc, không ghi thống kê). 404 `QR_NOT_FOUND`, 410 `QR_INACTIVE`, 410 `QR_TARGET_UNAVAILABLE` |
| POST | `/qr/:code/scan` | Ghi `qr_landing_view` (gộp trong 10 phút/phiên). Trang xem trước của admin (`?preview=1`) không gọi API này |
| POST | `/qr/:code/check-in` | Check-in tự xác nhận, +10 điểm, tối đa một lần/điểm/chủ sở hữu → `{created, pointsAwarded, newBadges}` |
| GET | `/challenges/:id` | Câu hỏi **không kèm đáp án** |
| POST | `/challenges/:id/complete` | `{qrCode, answers[{questionId, optionIndex}]}` – máy chủ chấm. Cần mã QR đang hoạt động thuộc cùng địa điểm (`QR_CHALLENGE_MISMATCH`). Đáp án/giải thích chỉ trả về khi đạt. Thưởng một lần (`alreadyCompleted`) |
| GET | `/passport/me` | Hộ chiếu của tài khoản hoặc của trình duyệt (`mode: account\|device`), kèm `pendingDeviceEntries` |
| POST | `/passport/claim` 🔒 | Chuyển mục của trình duyệt vào tài khoản; mục trùng bị bỏ qua (không cộng điểm hai lần) |
| GET | `/favorites` 🔒 | `{items, hiddenCount}` |
| POST/DELETE | `/favorites/:destinationId` 🔒 | Thêm (idempotent) / bỏ yêu thích |

🔒 = cần đăng nhập.

## Quản trị (`/admin/*`, cần vai trò admin)

| Method | Path | Ghi chú |
| --- | --- | --- |
| GET | `/admin/analytics?from=YYYY-MM-DD&to=YYYY-MM-DD` | Khoảng ngày theo giờ Việt Nam (mặc định 30 ngày, tối đa 366). Trả `totals`, `daily`, top địa điểm/QR/thử thách và `definitions` |
| GET | `/admin/destinations` | Query `q`, `category`, `publicationStatus`, `page`, `limit≤100` |
| POST | `/admin/destinations` | Tạo; slug tự sinh nếu trống. 409 `SLUG_TAKEN`. Không cho đánh dấu "đã xác minh" khi thiếu dữ liệu, nguồn hoặc ngày xác minh |
| GET/PATCH | `/admin/destinations/:id` | PATCH từng phần (vd. `{publicationStatus: "published"}`) |
| DELETE | `/admin/destinations/:id` | 409 `DESTINATION_IN_USE` nếu còn QR/thử thách gắn vào (hãy ẩn thay vì xóa) |
| GET/POST | `/admin/qr` | Tạo `{code?, label, targetType: destination\|challenge, targetId, status, notes}`; code trống → `DT-XXXXXX`. 409 `QR_CODE_TAKEN` |
| GET/PATCH | `/admin/qr/:id` | GET kèm thống kê; PATCH đổi nhãn/trạng thái/đích (mã không đổi được) |
| GET | `/admin/qr/:id/image?format=png\|svg&download=1` | Ảnh QR chứa `{PUBLIC_APP_URL}/qr/{code}` |
| GET/POST | `/admin/challenges` | Query `destinationId`, `status`. Kèm số lượt gửi đáp án & hoàn thành |
| GET/PUT/DELETE | `/admin/challenges/:id` | DELETE bị chặn (409 `CHALLENGE_IN_USE`) khi đã có người hoàn thành hoặc có QR trỏ tới |
| PATCH | `/admin/challenges/:id/status` | `{status: active\|inactive}` |
| GET/POST | `/admin/banners` | Query `status`, `page`, `limit≤100`. Tạo `{kind: cover\|event\|promo, theme: forest\|lotus\|cream, eyebrow?, title, subtitle?, imageUrl?, imageAlt?, linkUrl?, linkLabel?, sponsorName?, status, startAt?, endAt?, sortOrder}`. `linkUrl`/`imageUrl` chỉ nhận http(s) hoặc đường dẫn nội bộ `/...`; `kind=promo` bắt buộc `sponsorName`; `startAt ≤ endAt`. Trả kèm `isLive`, `impressions`, `clicks` |
| GET/PATCH/DELETE | `/admin/banners/:id` | PATCH từng phần; gửi `""`/`null` để xóa một trường (vd. bỏ lịch hiển thị) |

## Sự kiện thống kê

`destination_page_view`, `qr_landing_view`, `challenge_started` (mỗi lần nộp đáp án), `challenge_completed` (lần đầu đạt),
`destination_check_in`, `itinerary_generated`, `itinerary_saved`, `passport_badge_awarded`. Chỉ máy chủ ghi sự kiện; lỗi ghi
sự kiện không chặn thao tác của người dùng.
