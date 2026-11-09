# CHUYÊN ĐỀ: GIẢI THUẬT AI TRIP PLANNER V9 & LIVE REPLAN
#trip_planner_v9 #algorithm #routing #valhalla #replan #personalization

Tài liệu này ghi lại kiến trúc, thuật toán và các giải pháp kỹ thuật của module **Trip Planner V9** trong dự án DTST.

---

## 1. Bài toán Tối ưu hóa Hành trình Đa Ràng buộc (Multi-constraint TSP)

Khác với việc sắp xếp điểm đến thông thường (chỉ tối ưu khoảng cách đường chim bay), Trip Planner V9 giải quyết bài toán hành trình du lịch với tập ràng buộc thực tế:

1. **Khung giờ mở cửa địa điểm (Opening Windows)**:
   - Tính toán theo từng ngày cụ thể (`hours_by_date`) hoặc ngày trong tuần (`weekday_schedule`).
   - Nếu địa điểm đóng cửa lúc 17:00, hành trình không được xếp lượt ghé bắt đầu lúc 16:30 nếu thời gian tham quan cần 90 phút.
2. **Khung giờ ăn uống cố định (Meal Windows)**:
   - Bữa sáng (`breakfast`): 08:00 – 10:00 (480 – 600 phút).
   - Bữa trưa (`lunch`): 12:00 – 14:00 (720 – 840 phút).
   - Bữa tối (`dinner`): 18:00 – 20:00 (1080 – 1200 phút).
   - Điểm ăn uống phải được tự động chèn vào khung giờ này mà không làm gãy chuỗi tham quan.
3. **Giới hạn thời gian trong ngày (Daily Bounds)**:
   - Giờ xuất phát (`daily_start`, mặc định 08:00) và giờ kết thúc ngày (`daily_end`, mặc định 20:00).
   - Chặng di chuyển từ điểm cuối ngày quay về khách sạn/điểm kết thúc phải hoàn tất trước `daily_end`.
4. **Ngân sách chuyến đi (Budget Allocation)**:
   - Phân bổ ngân sách linh hoạt: Ăn uống (food), Lưu trú (stay), Di chuyển (transport), Hoạt động (activities), Dự phòng (reserve).
   - Cung cấp phương án thay thế tiết kiệm (`budget_alternative`) nếu chi phí thực tế vượt ngưỡng chi tiêu của nhóm.

---

## 2. Định tuyến Đường bộ Thực tế qua Valhalla

Hệ thống tích hợp **Valhalla Routing Engine** chạy độc lập trên cổng `:8002` nạp dữ liệu bản đồ OpenStreetMap (OSM) của tỉnh Đồng Tháp và khu vực lân cận:
- **Tốc độ di chuyển thực tế**: Tự động phân biệt giữa ô tô (`costing: auto` - vận tốc trung bình 36 km/h trên quốc lộ miền Tây) và xe máy (`costing: motorcycle` - vận tốc trung bình 32 km/h kể cả các tuyến đường đan nhỏ).
- **Độ chính xác cao**: Tính toán theo mạng lưới đường bộ, cầu phà thực tế của Đồng Tháp (cầu Cao Lãnh, phà Sa Đéc, cầu Vàm Cống...).
- **Cơ chế Fallback thông minh (`LocalValhallaFallback`)**: Nếu container Docker Valhalla chưa bật, server tự động khởi động một bộ định tuyến giả lập dựa trên công thức Haversine có hệ số uốn khúc đường bộ thực tế ($1.25 \times d$) để đảm bảo hệ thống không bao giờ bị gián đoạn.

---

## 3. Máy trạng thái Cập nhật Tiến độ Thực địa (Live Replan State Machine)

Khi du khách đang đi tour thực tế trên địa bàn Đồng Tháp:

```
[Chờ đến (pending)] 
        │
        │ Bấm "Tôi đã đến nơi" (event: arrived)
        ▼
[Đang ở tại điểm (arrived)] ── Ghi nhận arrived_at thực tế
        │                    ── Tính estimated_departure_at
        │ Bấm "Hoàn thành & đi tiếp" (event: departed)
        ▼
[Đã hoàn thành (completed)] ── Gọi Valhalla tính lại tuyến đến Next Stop
                             ── Cập nhật lại các chặng còn lại trong ngày
```

### Các sự cố thường gặp được phát hiện tự động:
- `current_stop_has_no_feasible_window`: Điểm hiện tại bị trễ giờ mở cửa.
- `time_window_or_return_conflict`: Không kịp ăn trưa hoặc không kịp về khách sạn trước giờ giới hạn.
- `return_after_daily_end`: Chặng về muộn hơn giới hạn tối.

---

## 4. Thanh Phản ứng Nhanh 1-Chạm theo Tình huống (Situational Replan)

Để du khách không cần phải nhập biểu mẫu phức tạp khi đang di chuyển ngoài trời, DTST v2.1 bổ sung các hành động 1 chạm:

| Tình huống | Thao tác 1-chạm | Cơ chế xử lý kỹ thuật |
| :--- | :--- | :--- |
| 🌧️ **Trời mưa lớn** | `Mưa to (+45p)` | Cộng thêm 45 phút nghỉ chờ ngớt mưa, tự động đẩy lùi thời gian dự kiến của các điểm tiếp theo. |
| 🚗 **Kẹt xe / Đường trắc trở** | `Kẹt xe (+30p)` | Thêm 30 phút buffer di chuyển, kiểm tra lại xem có bị lố giờ đóng cửa của các điểm sau không. |
| ⏭️ **Bỏ qua điểm này** | `Bỏ qua` | Kích hoạt sự kiện `departed` ngay lập tức để chuyển hướng Valhalla thẳng đến điểm tiếp theo, hoặc xóa điểm khỏi lịch ngày. |
| ⚡ **Đến nơi ngay bây giờ** | `Check-in ngay` | Lấy timestamp hiện tại của thiết bị `new Date().toISOString()` và kích hoạt `arrived`. |
| ⚡ **Rời điểm ngay bây giờ** | `Đi tiếp ngay` | Lấy timestamp hiện tại và kích hoạt `departed`. |

---

## 5. Cá nhân hóa Gợi ý (Personalization Engine)

Dịch vụ kết hợp dữ liệu giữa Python V9 và cơ sở dữ liệu MongoDB qua hàm `enrichV9Places`:
1. **Liên kết Điểm Yêu thích (`FavoriteModel`)**:
   - Nếu du khách từng bấm thả tim các điểm đến, hệ thống tự động ưu tiên chọn các điểm này vào `priority_place_ids` khi lập lịch.
   - Gắn huy hiệu `❤️ Nằm trong danh sách Yêu thích của bạn`.
2. **Kế thừa Lịch sử Check-in (`PassportEntryModel`)**:
   - Nhận diện các điểm du khách đã từng check-in trong Hộ chiếu số để đề xuất hành trình khám phá những điểm mới lạ tiếp theo.
3. **Khớp nối Sở thích Du khách (`UserModel.preferences`)**:
   - Tự động map sở thích `culinary` → ẩm thực, `nature` → Tràm Chim / Gáo Giồng / Xẻo Quýt, `culture` → Khu di tích Nguyễn Sinh Sắc / Làng hoa Sa Đéc.
   - Hiển thị nhãn minh bạch: *"✨ Phù hợp sở thích đã lưu trong hồ sơ của bạn"*.
4. **Làm giàu Hình ảnh & Đường dẫn từ MongoDB**:
   - Tự động bổ sung ảnh chất lượng cao và slug trang chi tiết vào từng thẻ điểm dừng trong giao diện V9.
