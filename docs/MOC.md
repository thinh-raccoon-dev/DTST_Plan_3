# BẢN ĐỒ TRI THỨC HỆ THỐNG (Map of Content - MOC)
#du_lich_thong_minh #dong_thap #trip_planner_v9 #kien_truc #obsidian_vault

Chào mừng đến với kho tri thức kỹ thuật và nghiệp vụ của **Nền tảng Du lịch Thông minh và Hộ chiếu Trải nghiệm số Đồng Tháp & Trip Planner V9** (DTST v2.1).

---

## 🗺️ Mạng lưới Liên kết Tri thức (Knowledge Graph)

```
                              ┌────────────────────────┐
                              │     [[docs/MOC]]       │
                              │ (Cổng Tri Thức Chính)  │
                              └───────────┬────────────┘
                                          │
       ┌──────────────────┬───────────────┼───────────────┬──────────────────┐
       ▼                  ▼               ▼               ▼                  ▼
┌──────────────┐   ┌──────────────┐ ┌───────────┐  ┌─────────────┐   ┌───────────────┐
│[[docs/       │   │[[docs/       │ │[[docs/    │  │[[docs/      │   │[[docs/        │
│ARCHITECTURE]]│   │API]]         │ │TRIP_      │  │GAMIFICATION_│   │PARTNER_AND_   │
│Kiến trúc     │   │Đặc tả API    │ │PLANNER_V9]│  │AND_BADGES]] │   │MODERATION]]   │
│tổng thể v2.1 │   │Endpoint v2.1 │ │Giải thuật │  │QR, GPS &    │   │Cổng đối tác & │
│              │   │              │ │& Replan   │  │Hộ chiếu số  │   │Kiểm duyệt     │
└──────┬───────┘   └──────────────┘ └─────┬─────┘  └─────────────┘   └───────────────┘
       │                                  │
       ▼                                  ▼
┌──────────────┐                   ┌─────────────┐
│[[docs/       │                   │[[docs/      │
│DEPLOYMENT]]  │                   │TESTING_     │
│Vận hành      │                   │AND_QA]]     │
│Docker & CI/CD│                   │Kịch bản test│
└──────────────┘                   └─────────────┘
```

---

## 📚 Danh mục Chuyên đề Tri thức

### 1. [[docs/ARCHITECTURE|Kiến trúc Tổng thể & Thiết kế Hệ thống]]
- Mô hình Monorepo (Node.js Express + React 19 SPA + Python 3.11 AI Engine + MongoDB + Valhalla).
- Thiết kế bảo mật đa lớp: CSRF double-submit, JWT HttpOnly, Rate Limiter, RBAC 3 vai trò (`tourist`, `partner`, `admin`).
- Nguyên tắc trung thực dữ liệu (không đoán mò giờ mở cửa/giá vé, gắn nhãn minh họa minh bạch).

### 2. [[docs/TRIP_PLANNER_V9|Chuyên đề: Giải thuật AI Trip Planner V9 & Live Replan]]
- Tối ưu hóa hành trình đa ràng buộc: khung giờ mở cửa, khung giờ ăn uống, ngân sách, giới hạn giờ về trong ngày.
- Ma trận khoảng cách đường bộ thực tế tỉnh Đồng Tháp qua **Valhalla OSRM Engine**.
- Máy trạng thái hành trình thực địa (State Machine: `pending` → `arrived` → `departed`).
- **Thanh phản ứng nhanh 1-chạm (Situational Replan)**: 🌧️ Mưa to (+45p), 🚗 Kẹt xe (+30p), ⏭️ Bỏ qua điểm, ⚡ Check-in tức thì.
- **Cá nhân hóa theo dữ liệu thực tế**: Đồng bộ hóa danh mục điểm đến từ MongoDB, gắn thẻ ảnh chất lượng cao và tự động ưu tiên theo `FavoriteModel` & `PassportEntryModel`.

### 3. [[docs/GAMIFICATION_AND_BADGES|Chuyên đề: Gamification, QR Code & Hộ chiếu Trải nghiệm số]]
- Cấu trúc **Hộ chiếu số Đồng Tháp** (`PassportPage`): Cấp bậc danh hiệu, con dấu số, điểm kinh nghiệm.
- Cơ chế Check-in bảo mật: Mã hóa QR Code không chứa URL tùy ý, kiểm tra vị trí thực tế bằng GPS (công thức Haversine chống gian lận).
- Hệ thống **Huy hiệu Động** (`BadgeModel`): Đánh giá tự động qua các tiêu chí linh hoạt, thưởng điểm trực tiếp, Dashboard quản trị huy hiệu trực quan tại `/admin/badges`.

### 4. [[docs/PARTNER_AND_MODERATION|Chuyên đề: Cổng Đối tác & Kiểm duyệt Nội dung Doanh nghiệp]]
- Phân quyền đối tác du lịch (`partner`): Quyền sở hữu điểm đến (`managedBy`), bảo vệ dữ liệu chéo giữa các bên.
- Quy trình kiểm duyệt chuẩn doanh nghiệp: `draft` → `pending_review` (Gửi duyệt) → `published` (Admin duyệt) hoặc trả về `draft` kèm `reviewNote` phản hồi chi tiết.
- Báo cáo thống kê phân vùng (Scoped Partner Analytics): Đối tác chỉ xem báo cáo lượt xem, lượt ghé của điểm đến do cơ sở mình sở hữu.

### 5. [[docs/TESTING_AND_QA|Kịch bản Kiểm thử Toàn diện & QA Playbook]]
- Thông tin kết nối môi trường phát triển & cổng dịch vụ.
- Bộ tài khoản kiểm thử chuẩn cho 3 vai trò: Admin, Partner, Tourist.
- 5 kịch bản kiểm thử mẫu từng bước bao phủ 14 hạng mục chức năng.

### 6. [[docs/DEPLOYMENT|Hướng dẫn Triển khai & Vận hành Doanh nghiệp]]
- Kiến trúc cụm 5 container Docker: `mongodb`, `valhalla`, `planner-v9`, `server-api`, `client-web` (Nginx).
- Cấu hình file `docker-compose.prod.yml`, lệnh khởi chạy 1-click.
- Quy trình tự động hóa CI/CD với GitHub Actions (`.github/workflows/ci-cd.yml`).
- Quy trình Backup & Khôi phục thảm họa (Disaster Recovery).

---
*Ghi chú được cập nhật và kiểm chứng tự động vào phiên bản DTST v2.1.*
