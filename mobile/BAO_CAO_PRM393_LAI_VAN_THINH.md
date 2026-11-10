# BÁO CÁO DỰ ÁN HỌC PHẦN PRM393 - LẬP TRÌNH ỨNG DỤNG DI ĐỘNG
## NỀN TẢNG DU LỊCH THÔNG MINH & HỘ CHIẾU TRẢI NGHIỆM SỐ ĐỒNG THÁP (DTST MOBILE)

- **Học phần**: PRM393 - Mobile Programming (Flutter)
- **Sinh viên thực hiện**: **LẠI VĂN THỊNH**
- **Hình thức thực hiện**: Cá nhân (**100% Solo Developer**)
- **Mã nguồn dự án**: Nằm trong thư mục `mobile/` (Flutter 3.x / Dart 3.x)

---

## 1. GIỚI THIỆU ỨNG DỤNG

### 1.1. Tên ứng dụng & Mục tiêu
**DTST Mobile (Du lịch số Đồng Tháp)** là ứng dụng di động thông minh hỗ trợ du khách khám phá Đất Sen Hồng, tích hợp công nghệ định vị GPS, camera quét QR thực địa, trợ lý AI lập kế hoạch hành trình V9 và Hộ chiếu trải nghiệm số Gamification.

### 1.2. Các Đối tượng Người dùng (Actors) & Chức năng Cốt lõi
- **Du khách khám phá tự do (Guest / Chế độ Khách trên thiết bị)**:
  - Khám phá danh mục điểm đến (12 huyện/thị, 6 nhóm trải nghiệm), tìm kiếm và lọc đa tiêu chí.
  - Xem chi tiết điểm đến, xem ảnh minh bạch (`isIllustrative`), mở Google Maps chỉ đường và gọi điện 1-chạm.
  - Quét mã QR thực địa bằng camera hoặc nhập mã thủ công, kiểm tra vị trí GPS tại trạm.
  - Trả lời thử thách trắc nghiệm văn hóa, nhận điểm thưởng và huy hiệu lưu tạm vào thiết bị (`localPassport`).
- **Du khách đã xác thực (Registered Tourist)**:
  - Đồng bộ Hộ chiếu số lên máy chủ đám mây; sử dụng tính năng **1-chạm gộp thành tích từ thiết bị vào tài khoản**.
  - Lập lịch trình AI V9 cá nhân hóa (theo ngân sách VND, số ngày, phương tiện, nhịp độ và sở thích).
  - Sử dụng bảng điều khiển **Live Replan thực địa 2 bước** (Đã đến / Xuất phát) kèm xử lý trễ thời gian.
  - Quản lý danh sách địa điểm yêu thích (Favorites) và cập nhật hồ sơ du lịch.
- **Quản trị viên / Nghiệm thu (Admin & Tester)**:
  - Sử dụng chip điền nhanh tài khoản test mẫu (`dukhach@dongthap.vn` và `admin@example.com`).
  - Kiểm tra kết nối máy chủ thời gian thực qua đèn LED xanh/đỏ trên AppBar; chuyển đổi Base URL linh hoạt giữa Android Emulator (`10.0.2.2:4000`), Localhost hoặc IP mạng LAN.

### 1.3. Chức năng & Công nghệ Nâng cao Được Ứng dụng
1. **Camera Quét QR Thời gian thực (`mobile_scanner`)**: Tự động nhận diện mã định danh trạm QR, có công tắc đèn Flash và cơ chế dự phòng nhập mã thủ công khi điều kiện thực địa ánh sáng yếu.
2. **Định vị Vệ tinh GPS Thực địa (`geolocator`)**: Tính toán khoảng cách trắc địa (Haversine formula) so khớp bán kính cho phép ($300\text{m} - 500\text{m}$) chống gian lận check-in, kèm cơ chế tự động giả lập tọa độ khi chạy máy ảo Android Emulator.
3. **Trợ lý Hành trình AI V9 & Live Replan Thực địa**: Phân bổ 5 nhóm ngân sách (di chuyển, vé tham quan, ăn uống, lưu trú, dự phòng), tối ưu cung đường tránh đi vòng và tự động tính toán lại thời gian khi lịch trình thực tế phát sinh trễ.
4. **Cơ chế Tự phục hồi Ngoại tuyến (Local Smart Replan Synthesis)**: Khi du khách ở vùng sóng yếu (rừng tràm, cù lao), ứng dụng tự động tổng hợp lịch trình cục bộ mà không làm gián đoạn trải nghiệm.
5. **Hạ tầng Mạng Bền vững & An toàn**: Quản lý phiên bằng Persistent Cookie Jar trên `SharedPreferences` và chống tấn công giả mạo yêu cầu bằng Double-Submit CSRF Token (`x-csrf-token`).

---

## 2. MỨC ĐỘ ĐÓNG GÓP

Dự án được thực hiện độc lập **100% bởi sinh viên LẠI VĂN THỊNH**:

| Nội dung công việc (Topic) | Tỷ trọng dự án (Team Effort) | LẠI VĂN THỊNH (Solo Developer) |
|---|:---:|:---:|
| **Phân tích yêu cầu (Requirements Analysis)** | 100% | **100%** |
| **Thiết kế hệ thống & UI/UX (Architecture & Design)** | 100% | **100%** |
| **Lập trình (Implementation / Coding)** | 100% | **100%** |
| **Kiểm thử tự động & Sửa lỗi (Testing & Bug Fixing)** | 100% | **100%** |
| **Viết tài liệu kỹ thuật & Báo cáo (Documentation)** | 100% | **100%** |

---

## 3. ĐỐI CHIẾU TIÊU CHÍ ĐÁNH GIÁ DỰ ÁN (PRM393 RUBRICS)

### 3.1. Có đủ các nội dung trong chương trình học (Tỷ trọng: 15%)
- **Flutter Framework**: Xây dựng kiến trúc phân tầng rõ ràng (`models`, `services`, `state`, `theme`, `widgets`, `screens`). Sử dụng đa dạng các Widget: `IndexedStack`, `CustomScrollView`, `ListView`, `GridView`, `Card`, `FilterChip`, `ActionChip`, `DropdownButtonFormField`, `LinearProgressIndicator`, `ModalBottomSheet`, `AlertDialog`.
- **Database / Local Storage (`SharedPreferences`)**: Lưu trữ bền vững Cookie session `dtst_cookies_v1`, cấu hình Base URL tùy biến `dtst_api_base_url`, trạng thái Hộ chiếu khách trên thiết bị và cấu hình cá nhân hóa.
- **Material Design 3**: Bộ theme đồng nhất lấy cảm hứng từ hoa sen và thiên nhiên Đồng Tháp, phông chữ `Be Vietnam Pro` hỗ trợ chuẩn tiếng Việt có dấu.
- **API Calls & Xử lý Bất đồng bộ**: Tương tác với REST API qua `http.Client`, quản lý lỗi mạng, timeout, tự động gắn token bảo mật và cấu hình động Base URL cho Android Emulator.
- **State Management**: Quản lý trạng thái toàn cục bằng `ChangeNotifier` và `ListenableBuilder` nguyên bản, tối ưu hiệu năng render khung hình.

### 3.2. Thiết kế Giao diện & Trải nghiệm Người dùng (UI/UX) (Tỷ trọng: 15%)
- **Tính đồng nhất cao**: Sử dụng bảng màu nhận diện Đất Sen Hồng xuyên suốt toàn bộ ứng dụng (`AppColors`: Sắc Sen Hồng, Rừng Tràm, Nước Phù Sa, Cát và Mặt Nước).
- **Phản hồi trạng thái toàn diện**: Hiển thị rõ ràng các trạng thái Loading (vòng xoay tiến trình), Empty State (khi danh sách yêu thích/lịch trình trống), Error State (kèm nút Thử lại) và SnackBar thông báo.
- **Tối ưu thao tác người dùng (1-Tap Experience)**:
  - Đèn LED trạng thái máy chủ (Xanh: Đang kết nối / Đỏ: Mất kết nối) trực tiếp trên AppBar.
  - Chip 1-chạm điền ngay tài khoản test mẫu, không cần gõ phím thủ công.
  - Nút gọi điện và mở Google Maps chỉ đường thực địa 1-chạm.

### 3.3. Quy tắc Nghiệp vụ & Xử lý Ràng buộc Logic (Business Logic / Rules) (Tỷ trọng: 50%)
1. **Ràng buộc Check-in GPS Thực địa**: Kiểm tra khoảng cách vệ tinh Haversine giữa tọa độ du khách và tọa độ trạm QR. Nếu khoảng cách $> 300\text{m}$, ứng dụng **từ chối check-in**, hiển thị cảnh báo khoảng cách thực tế và hướng dẫn du khách tiến lại gần trạm.
2. **Quy tắc Chấm điểm & Vinh danh Huy hiệu**: Gửi đáp án trắc nghiệm lên máy chủ chấm điểm bảo mật; chỉ khi trả lời đúng mới được cộng điểm thưởng và mở khóa huy hiệu; tự động kích hoạt hộp thoại vinh danh huy hiệu mới đạt được (`showNewBadgesDialog`).
3. **Ràng buộc Chuyển giao Hộ chiếu (Claim Device Passport)**: Cho phép gom toàn bộ lượt check-in, điểm số và huy hiệu tích lũy ở chế độ Khách vào tài khoản chính thức sau khi đăng nhập, không làm mất dữ liệu của người dùng.
4. **Ràng buộc Lập lịch AI & Phân bổ Ngân sách**: Kiểm tra tính hợp lệ của ngân sách (chặn số âm, bằng 0), số ngày giới hạn từ 1 đến 7 ngày, số lượng khách tối thiểu 1 người; tự động phân bổ 5 nhóm chi phí hợp lý.
5. **Quy tắc Live Replan Thực địa**: Quy trình 2 bước nghiêm ngặt: Phải bấm "Đã đến" (`arrived`) trước khi bấm "Xuất phát" (`departed`); các nút hoãn thời gian (+15p, +30p, +45p, +60p) tự động cộng dồn và tính toán lại giờ khởi hành cho toàn bộ các điểm dừng tiếp theo trong ngày.
6. **Validation Biểu mẫu Người dùng**: Kiểm tra định dạng Email theo chuẩn Regex, mật khẩu tối thiểu 8 ký tự, chặn gửi yêu cầu khi dữ liệu bắt buộc bị để trống.

### 3.4. Chất lượng Mã nguồn & Bằng chứng Kiểm thử (Presentation / Testing) (Tỷ trọng: 20%)
- **Phân tích mã nguồn (`flutter analyze`)**: Đạt **0 issues found** (Không có bất kỳ cảnh báo lỗi cú pháp hay cảnh báo thư viện nào).
- **Kiểm thử tự động (`flutter test`)**: Đạt **17/17 tests PASSED (100% Passed)** kiểm tra toàn diện từ Định dạng, Tra cứu Catalog, Serialization mô hình dữ liệu cho đến Luồng chuyển tab, Cấu hình máy chủ, Điền tài khoản test, Quét mã QR và Lập lịch trình AI.

---

## 4. HƯỚNG DẪN TEST NHANH DÀNH CHO GIẢNG VIÊN CHẤM ĐIỂM

1. **Khởi động ứng dụng**: Mở thư mục `mobile/` trong Android Studio và chạy trên máy ảo Android Emulator.
2. **Kiểm tra trạng thái máy chủ**: Quan sát biểu tượng DNS góc trên AppBar có chấm xanh lá cây (`http://10.0.2.2:4000/api/v1`).
3. **Đăng nhập 1-chạm**: Chạm vào nút "Tài khoản" trên AppBar -> Chạm vào chip `Du khách (dukhach@dongthap.vn)` -> Bấm "Đăng nhập".
4. **Thử nghiệm Quét QR & Check-in**: Chuyển sang tab "Quét QR" -> Chạm vào trạm thí điểm `Vườn QG Tràm Chim (TRAMCHIM-01)` -> Bấm Check-in GPS và trả lời câu hỏi trắc nghiệm văn hóa.
5. **Thử nghiệm AI Trip Planner**: Chuyển sang tab "Lịch trình AI" -> Bấm "Tạo lịch trình AI thông minh" -> Trải nghiệm xem biểu đồ ngân sách và bấm nút điều chỉnh thực địa "Live Replan".
