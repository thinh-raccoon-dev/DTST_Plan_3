# API v2.1

Base URL: `/api/v1`. Mọi phản hồi là JSON (trừ ảnh QR). Lỗi có dạng thống nhất:

```json
{ "error": { "code": "VALIDATION_ERROR", "message": "Dữ liệu không hợp lệ.", "details": [{ "path": "name", "message": "..." }] } }
```

## Xác thực, CSRF, phiên ẩn danh

| Cookie | Mục đích |
| :--- | :--- |
| `dtst_access` | JWT (HS256) HttpOnly, SameSite theo `COOKIE_SAMESITE`, Secure trong production, hạn 7 ngày. Vai trò/trạng thái luôn đọc lại từ DB mỗi request. |
| `dtst_csrf` | Token CSRF HttpOnly (double-submit). |
| `dtst_anon` | UUID ngẫu nhiên cho hộ chiếu khách và ước lượng người dùng duy nhất. |

- Mọi request **POST/PUT/PATCH/DELETE** phải gửi header `x-csrf-token` lấy từ `GET /csrf` (client axios tự xử lý và thử lại một lần khi nhận `CSRF_INVALID`).
- `401 UNAUTHORIZED` khi chưa đăng nhập; `403 FORBIDDEN` khi đăng nhập nhưng không đủ quyền.
- Rate limit (429 `RATE_LIMITED`): API chung 300/phút; đăng nhập 10/15 phút; đăng ký 10/giờ; check-in & nộp thử thách 30/10 phút; ghi sự kiện & tạo lịch trình 60/phút.

---

## Công khai / Du khách

| Method | Path | Ghi chú |
| :--- | :--- | :--- |
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
| GET | `/trip-planner/health` | Kiểm tra trạng thái AI Trip Planner V9 & Valhalla routing |
| GET | `/trip-planner/places` | Danh mục địa điểm làm giàu từ MongoDB, gắn thẻ cá nhân hóa theo `req.user` |
| POST | `/trip-planner/recommend` | Gợi ý phương án lịch trình AI V9 theo sở thích, ngày, phương tiện |
| POST | `/trip-planner/itinerary` | Lập lịch trình tối ưu đa ràng buộc V9 (Valhalla routing matrix) |
| POST | `/itineraries/generate` | Bộ lập lịch legacy (heuristics) |
| POST | `/itineraries` 🔒 | Lưu lịch trình legacy hoặc `{title, v9Itinerary, v9Meta}` |
| GET | `/itineraries/my` 🔒 | Danh sách lịch trình đã lưu của người dùng |
| GET/PATCH/DELETE | `/itineraries/:id` 🔒 | Xem chi tiết, cập nhật tên/thứ tự điểm dừng, xóa lịch trình |
| POST | `/itineraries/:id/replan` 🔒 | **Live Replan thực địa**: `{itinerary_version, event_id, stop_id, event: arrived\|departed, occurred_at}`. Idempotent check qua `event_id` |
| GET | `/qr/:code` | Nội dung đích (chỉ đọc, không ghi thống kê). 404 `QR_NOT_FOUND`, 410 `QR_INACTIVE` |
| POST | `/qr/:code/scan` | Ghi `qr_landing_view` (gộp trong 10 phút/phiên) |
| POST | `/qr/:code/check-in` | Check-in tự xác nhận GPS thực địa, +10 điểm, tối đa một lần/điểm/chủ sở hữu → `{created, pointsAwarded, newBadges}` |
| GET | `/challenges/:id` | Câu hỏi **không kèm đáp án** |
| POST | `/challenges/:id/complete` | Máy chủ chấm câu đố, kiểm tra mã QR hợp lệ, thưởng điểm và huy hiệu |
| GET | `/passport/me` | Hộ chiếu của tài khoản hoặc trình duyệt kèm điểm, danh hiệu và huy hiệu động |
| POST | `/passport/claim` 🔒 | Chuyển con dấu/điểm từ thiết bị khách vào tài khoản chính thức |
| GET | `/favorites` 🔒 | Danh sách địa điểm yêu thích của người dùng |
| POST/DELETE | `/favorites/:destinationId` 🔒 | Thêm/xóa địa điểm yêu thích (idempotent) |

🔒 = cần đăng nhập.

---

## Cổng Đối tác & Quản trị (`/admin/*`)

| Method | Path | Quyền | Ghi chú |
| :--- | :--- | :--- | :--- |
| GET | `/admin/analytics` | `partner` \| `admin` | Admin xem toàn tỉnh; Partner xem báo cáo phân vùng các điểm mình quản lý (`managedBy`) |
| GET | `/admin/destinations` | `partner` \| `admin` | Admin xem toàn bộ; Partner chỉ xem danh sách điểm do mình phụ trách |
| POST | `/admin/destinations` | `partner` \| `admin` | Partner tạo với trạng thái `draft` hoặc `pending_review`; Admin có thể đặt `published` |
| GET/PATCH | `/admin/destinations/:id` | `partner` \| `admin` | Đối tác gửi duyệt (`pending_review` + `reviewNote`); Admin duyệt (`published`) hoặc yêu cầu sửa (`draft` + `reviewNote`) |
| DELETE | `/admin/destinations/:id` | `admin` | Xóa điểm đến (bị chặn nếu có QR hoặc thử thách đang liên kết) |
| GET/POST | `/admin/badges` | `admin` | Quản lý danh mục Huy hiệu Động: xem danh sách, tạo mới huy hiệu sự kiện |
| GET | `/admin/badges/analytics` | `admin` | Báo cáo tỷ lệ mở khóa huy hiệu, danh sách vinh danh gần đây |
| GET/PATCH/DELETE | `/admin/badges/:id` | `admin` | Cập nhật thông tin, chuyển đổi trạng thái `active`/`inactive`, soft-delete |
| GET/POST | `/admin/qr` | `admin` | Quản lý mã QR in ấn thực địa |
| GET/PATCH | `/admin/qr/:id` | `admin` | Sửa thông tin mã QR, đổi đích đến |
| GET | `/admin/qr/:id/image` | `admin` | Tải ảnh mã QR định dạng PNG/SVG |
| GET/POST | `/admin/challenges` | `admin` | Quản lý bộ câu hỏi trắc nghiệm thử thách văn hóa |
| GET/PUT/DELETE | `/admin/challenges/:id` | `admin` | Xem, sửa nội dung, xóa câu hỏi thử thách |
| PATCH | `/admin/challenges/:id/status` | `admin` | Đổi trạng thái kích hoạt thử thách |
| GET/POST | `/admin/banners` | `admin` | Quản lý banner truyền thông trang chủ |
| GET/PATCH/DELETE | `/admin/banners/:id` | `admin` | Sửa, đổi trạng thái, xóa banner |
