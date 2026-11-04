# KỊCH BẢN KIỂM THỬ HỆ THỐNG & QA PLAYBOOK
#testing #qa #playbook #test_cases #verification

Tài liệu hướng dẫn kịch bản kiểm thử toàn diện hệ thống DTST v2.1 bao phủ trọn vẹn 14 hạng mục chức năng.

---

## 1. Môi trường & Tài khoản Kiểm thử Mẫu

- **Web Frontend**: `http://localhost:5173`
- **Backend API**: `http://localhost:4000/api/v1`
- **Python V9 Service**: `http://localhost:8010`
- **Valhalla Routing**: `http://localhost:8002`

| Tài khoản | Email | Mật khẩu | Quyền hạn kiểm thử |
| :--- | :--- | :--- | :--- |
| **Quản trị viên (Admin)** | `admin@example.com` | `Dt-FbhNoHLx8l90` | Phê duyệt điểm đến, CRUD huy hiệu, xem phễu phân tích |
| **Đối tác (Partner)** | `partner@example.com` | `Partner@123456` | Quản lý Làng hoa Sa Đéc, gửi duyệt điểm, xem thống kê riêng |
| **Du khách (Tourist)** | `tourist@example.com` | `Tourist@123456` | Trải nghiệm AI Planner, Live Replan, Quét QR, Hộ chiếu số |

---

## 2. Danh mục 5 Kịch bản Kiểm thử Nghiệp vụ (Test Scenarios)

### Kịch bản 1: Lập lịch trình AI V9, Cá nhân hóa & Replan 1-chạm
- **Mục tiêu**: Kiểm tra Backlog 3, 7, 8, 9, 11.
- **Các bước**:
  1. Đăng nhập bằng tài khoản `tourist@example.com`.
  2. Vào `/itinerary/create`, chọn 2 ngày, phương tiện Ô tô, bấm "Gợi ý phương án lịch trình".
  3. Kiểm tra hiển thị ảnh thật từ MongoDB và huy hiệu *"✨ Dành riêng cho bạn"*.
  4. Bấm thử nút `↑` và `↓` để hoán đổi vị trí 2 điểm dừng trong ngày.
  5. Bấm nút `🗑️` để loại bỏ 1 điểm dừng không thích.
  6. Bấm các nút tình huống nhanh: `Mưa to (+45p)`, `Kẹt xe (+30p)`, `Bỏ qua điểm`.
  7. Bấm "Lưu lịch trình" và kiểm tra lịch trình xuất hiện trong `/my-itineraries`.

### Kịch bản 2: Hộ chiếu số, Quét QR & Check-in GPS
- **Mục tiêu**: Kiểm tra Backlog 4, 5, 10.
- **Các bước**:
  1. Vào `/passport` xem điểm số và danh mục huy hiệu.
  2. Vào `/scan` để mở camera quét QR điểm đến.
  3. Kiểm tra thông báo cảnh báo khoảng cách GPS khi ở xa điểm đến.
  4. Trả lời đúng các câu đố văn hóa để nhận điểm thưởng và mở khóa huy hiệu.

### Kịch bản 3: Đối tác Quản lý Điểm đến & Gửi duyệt
- **Mục tiêu**: Kiểm tra Backlog 2, 12.
- **Các bước**:
  1. Đăng nhập bằng `partner@example.com`.
  2. Quan sát giao diện Cổng Đối tác và thống kê riêng của mình.
  3. Vào `/admin/destinations`, thấy điểm "Làng hoa Sa Đéc" đang ở trạng thái `Chờ duyệt`.
  4. Bấm Sửa điểm đến, nhập ghi chú gửi duyệt và bấm "Gửi duyệt điểm đến".

### Kịch bản 4: Quản trị viên Phê duyệt, Quản lý Huy hiệu & Phễu
- **Mục tiêu**: Kiểm tra Backlog 6, 13.
- **Các bước**:
  1. Đăng nhập bằng `admin@example.com`.
  2. Vào `/admin/destinations`, bấm "Duyệt xuất bản" hoặc "Yêu cầu sửa" kèm ghi chú phản hồi.
  3. Vào `/admin/badges`, xem biểu đồ tỷ lệ mở khóa, bấm nút "Thêm huy hiệu" để tạo một huy hiệu mới.
  4. Vào `/admin` xem biểu đồ phễu chuyển đổi du khách.

### Kịch bản 5: Kiểm tra Triển khai Doanh nghiệp Docker
- **Mục tiêu**: Kiểm tra Backlog 14.
- **Các bước**:
  1. Mở terminal, chạy lệnh: `docker compose -f docker-compose.prod.yml up -d --build`.
  2. Kiểm tra `docker compose -f docker-compose.prod.yml ps`: Cả 5 container đều đạt trạng thái `healthy`.
