# Bàn giao Trip Planner V9

Python cung cấp dữ liệu 17 địa điểm, gợi ý theo sở thích, thời gian đi và điểm sao, rồi ráp lịch theo giờ mở cửa, bữa ăn, chỗ ở và ngân sách. Chế độ AI tự chọn điểm. Chế độ manual nhận danh sách điểm khách chọn. Mô hình học từ dữ liệu giả lập là tùy chọn hỗ trợ xếp hạng. Valhalla cung cấp thời gian chạy xe cho bộ lập lịch. V8 đã có thời gian ngủ, chuẩn bị và trả phòng. V9 thêm cập nhật tiến độ trong ngày cho lượt tham quan và ăn uống.

## Chạy Python

Cài thư viện bằng `python -m pip install -r requirements.txt`. Chạy Valhalla với dữ liệu khu vực trên cổng 8002, rồi chạy:

```bash
python web_api.py --port 8010 --valhalla-url http://127.0.0.1:8002
```

| Endpoint | Mục đích |
|---|---|
| GET /health | Kiểm tra Python có phản hồi. |
| GET /places | Danh sách địa điểm, phân loại, sao, hoạt động và thông tin liên hệ có trong dữ liệu. |
| POST /recommend | Gợi ý. Đặt `assemble_itinerary: false` nếu chỉ cần danh sách. |
| POST /itinerary | Tạo lịch. Dùng `request_ai.json` hoặc `request_manual.json` làm mẫu. Lưu object `itinerary` từ kết quả. |
| POST /itineraries/replan | Cập nhật giờ đến/rời và tính lại các lượt ghé còn lại trong ngày. |

## Luồng FE và BE

FE làm GPS, nút **Tôi đã đến nơi**, nút **Hoàn thành và đi tiếp** và mở bản đồ. BE lưu lịch, kiểm tra quyền, chống gửi lặp bằng event_id và gọi Python trên mạng nội bộ. Mỗi lượt ghé có stop_id riêng và cần giữ nguyên khi cập nhật. Python nhận bản lịch từ BE ở mỗi lần gọi.

Body của API replan gồm các trường dưới đây. Thay giá trị itinerary bằng toàn bộ object itinerary đã lưu, gồm input và days.

```json
{
  "trip_id": "trip_123",
  "itinerary_version": 1,
  "event_id": "evt_01",
  "stop_id": "mã lượt ghé lấy từ activities",
  "event": "arrived",
  "occurred_at": "2026-11-07T10:40:00+07:00",
  "itinerary": {}
}
```

Gửi arrived cho lượt pending đầu tiên trong ngày. Gửi departed cho lượt đã arrived và giữ arrived_at khi lưu. Giờ đến dùng để tính giờ rời dự kiến theo giờ mở cửa và thời lượng ghé. Giờ rời thực tế thay thế mốc đó khi tính tuyến tiếp. Dùng ISO 8601 có múi giờ.

| Kết quả | Cách dùng |
|---|---|
| current_stop | Cập nhật trạng thái và giờ thực tế theo stop_id. |
| remaining_stops | Bản cập nhật các lượt vẫn xếp được, kèm estimated_arrival_at, planned_start_at và planned_end_at. Merge theo stop_id, giữ lịch sử và những lượt còn vướng. |
| next_stop | Điểm tiếp theo có thể hiển thị, kèm latitude và longitude. Có thể null khi hết lượt hoặc lượt ngay sau bị vướng. |
| issues | Các lượt/chặng không khả thi. Hiển thị để khách quyết định. |
| estimated_day_end_at | Giờ kết thúc ước tính theo tuyến cuối. |
| later_days_need_review | Có lịch qua đêm sau ngày này, cần xem lại ảnh hưởng đến ngày sau. |

BE chỉ lưu kết quả nếu phiên bản lịch vẫn khớp, rồi tăng phiên bản. Nếu gọi lại cùng event_id, dùng kết quả BE đã lưu. HTTP 400 báo dữ liệu hoặc trạng thái không hợp lệ. HTTP 200 với needs_revision vẫn có thể chứa sự kiện đến/rời hợp lệ và danh sách vướng mắc.

V9 tính lại lượt tham quan và bữa ăn đã có trong ngày theo thứ tự hiện hành. Giữ nguyên các lượt vướng trong dữ liệu lưu để xử lý tiếp. Phản hồi là bản cập nhật theo stop_id, nên FE hiển thị giờ mới từ các trường ISO. Các dòng di chuyển, chờ và chi phí trong lịch gốc thuộc lần lập lịch ban đầu. Lịch qua đêm và ngày sau cần được xem lại nếu giờ về đổi.
