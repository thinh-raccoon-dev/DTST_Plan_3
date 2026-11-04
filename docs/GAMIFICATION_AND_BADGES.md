# CHUYÊN ĐỀ: GAMIFICATION, QR CODE & HỘ CHIẾU SỐ
#gamification #passport #badges #qr_code #anti_fraud #gps

Tài liệu ghi lại toàn bộ cơ chế trò chơi hóa (gamification), công nghệ mã QR, xác thực GPS và hệ thống huy hiệu động của dự án DTST.

---

## 1. Cấu trúc Hộ chiếu Trải nghiệm Số (Digital Passport)

Hộ chiếu số Đồng Tháp hoạt động song song theo 2 chế độ:
1. **Chế độ Ẩn danh (Guest Mode)**:
   - Du khách chưa đăng nhập vẫn có thể quét QR và nhận con dấu/điểm thưởng tạm thời trên thiết bị thông qua cookie ẩn danh `dtst_anon` (UUID v4).
   - Khi du khách đăng ký/đăng nhập, hệ thống tự động kích hoạt tính năng **Claim Hộ chiếu** (`POST /passport/claim`), chuyển toàn bộ dấu và điểm từ thiết bị vào tài khoản mà không làm mất dữ liệu.
2. **Chế độ Tài khoản Chính thức (Account Mode)**:
   - Toàn bộ lịch sử check-in, thử thách văn hóa và huy hiệu được lưu vĩnh viễn trong collection `passportentries`.
   - Tính toán cấp bậc danh hiệu:
     - 🥉 *Người mới khám phá* (0 - 49 điểm)
     - 🥈 *Nhà lữ hành Đất Sen Hồng* (50 - 149 điểm)
     - 🥇 *Sứ giả Du lịch Đồng Tháp* (≥ 150 điểm)

---

## 2. Mã QR Định danh & Xác thực GPS Thực địa (Anti-Fraud)

### Nguyên tắc bảo mật mã QR:
- Mã QR không chứa URL trang web tùy ý để triệt tiêu lỗ hổng **Open Redirect**.
- Mỗi mã QR là một mã định danh ngắn gọn trong DB (`qrcodes`), liên kết trực tiếp tới `destinationId` hoặc `challengeId`.
- Định dạng in ấn: `{PUBLIC_APP_URL}/qr/{code}`. Khi du khách quét bằng camera, hệ thống sẽ gọi API `/qr/:code/scan` và `/qr/:code/check-in`.

### Cơ chế Chống gian lận vị trí bằng GPS:
Khi thực hiện check-in, máy khách gửi kèm tọa độ GPS của thiết bị (`latitude`, `longitude`).
Máy chủ tính khoảng cách đường bộ bằng **Công thức Haversine**:

$$\Delta\sigma = 2 \arcsin \sqrt{\sin^2\left(\frac{\Delta\phi}{2}\right) + \cos\phi_1 \cos\phi_2 \sin^2\left(\frac{\Delta\lambda}{2}\right)}$$

$$d = R \cdot \Delta\sigma$$

- Nếu khoảng cách $d \le 1.0\text{ km}$ (bán kính hợp lệ): Cho phép nhận điểm check-in.
- Nếu $d > 1.0\text{ km}$: Từ chối check-in với mã lỗi `LOCATION_TOO_FAR`, ngăn chặn việc chụp ảnh QR chia sẻ lên mạng để check-in từ xa.

### Chống nhận thưởng trùng lặp (Idempotency):
Collection `passportentries` được thiết lập 3 **Partial Unique Indexes**:
1. `{ userId: 1, destinationId: 1, entryType: 'check_in' }`
2. `{ userId: 1, challengeId: 1, entryType: 'challenge_completed' }`
3. `{ userId: 1, badgeKey: 1, entryType: 'badge_awarded' }`
→ Dù người dùng bấm liên tục nhiều lần cùng một lúc, cơ sở dữ liệu sẽ chặn đứng lỗi trùng lặp (MongoDB error 11000) và trả về an toàn `alreadyCompleted: true`.

---

## 3. Hệ thống Huy hiệu Động (Dynamic Badge Engine)

Thay vì hardcode danh sách huy hiệu trong mã nguồn, DTST v2.1 chuyển toàn bộ sang mô hình **Huy hiệu Động** (`server/src/models/Badge.ts`):

```typescript
interface Badge {
  key: string;              // Mã định danh duy nhất (vd: 'heritage_explorer')
  name: string;             // Tên hiển thị (vd: 'Nhà Thám Hiểm Di Tích')
  description: string;      // Mô tả điều kiện đạt
  icon: BadgeIcon;          // Icon hiển thị (landmark, tree, sun, award...)
  criteriaType:             // Loại tiêu chí đánh giá tự động:
    | 'checkin_count'       // Đạt mốc N lượt check-in bất kỳ
    | 'challenge_count'     // Hoàn thành N câu đố/thử thách
    | 'heritage_challenge_count' // Hoàn thành N thử thách tại di tích lịch sử
    | 'points_threshold'    // Đạt mốc N điểm kinh nghiệm
    | 'itinerary_created';  // Đã tự tạo lịch trình du lịch
  targetCount: number;      // Chỉ số mục tiêu cần đạt
  rewardPoints: number;     // Điểm thưởng bonus khi mở khóa
  status: 'active' | 'inactive'; // Trạng thái huy hiệu
}
```

### Dashboard Quản lý Huy hiệu (`/admin/badges`):
- **Phân tích Tỷ lệ Mở khóa**: Biểu đồ Recharts hiển thị tỷ lệ % du khách đã đạt được từng huy hiệu.
- **Quản lý CRUD**: Cho phép Quản trị viên thêm mới huy hiệu cho các sự kiện/lễ hội hoa xuân Đồng Tháp, chỉnh sửa tiêu chí hoặc tạm dừng huy hiệu cũ.
- **Nhật ký trao thưởng Realtime**: Theo dõi danh sách du khách vừa được vinh danh.
