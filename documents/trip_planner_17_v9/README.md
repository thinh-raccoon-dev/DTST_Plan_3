# Trip Planner V9

Chuyến qua đêm mặc định ngủ 540 phút. Có thể đặt sleep_minutes từ 480 đến 600. Hạn trả phòng mặc định 12:00, ưu tiên checkout_time của khách sạn nếu có.
V6 ưu tiên sở thích khi chọn điểm tham quan. Nếu phần chi phí đã biết vượt ngân sách, hệ thống thử ráp lại với dịch vụ có giá thấp hơn. Chế độ chọn tay trả lịch rẻ hơn riêng trong `budget_alternative` nếu tìm được. Xem `unknown_cost_count`, `price_status` và `hours_need_confirmation` để hiển thị khoản cần xác nhận.

Bản này có đầy đủ 17 địa điểm, tích hợp 37 mục hoạt động có nguồn của 4 điểm tham quan và thêm lịch theo ngày/giờ cho hai chế độ. Đây là bản thay thế để chạy, không cần tự chép từng file vào v4.

## Chạy thử trên Windows

Giải nén. Mở thư mục có recommend.py, gõ powershell vào thanh địa chỉ rồi Enter.

```
python -m pip install -r requirements.txt
```

Mở Docker Desktop, chờ Engine chạy rồi:

```
docker start valhalla
docker ps
```

Thủ công:

```
python recommend.py --request request_manual.json --output result_manual.json
notepad result_manual.txt
```

AI đề xuất:

```
python recommend.py --request request_ai.json --output result_ai.json
notepad result_ai.txt
```

Mỗi lần chạy tạo hai file: JSON cho IT và TXT dễ đọc cho bạn. main.py gọi cùng luồng mới của V9.

Valhalla mặc định http://localhost:8002. Đổi bằng --valhalla-url nếu cần. Container phải có dữ liệu đường bao phủ đủ các tọa độ của Mỹ Tho, Thới Sơn, Kiểng Phước và Sa Đéc; tên file dong-thap.osm.pbf chưa chứng minh bao phủ. Khi lỗi tuyến, không thay bằng thời gian giả.

## Luồng xử lý

1. Đọc tiêu chí và chế độ; đúng loại mục tiêu trước, rồi ưu tiên gần và sao Google như v4 (nhóm thời gian cố định 5 phút, trong cùng nhóm xét điểm điều chỉnh số lượt). Sao lấy bản lưu 28/10/2026, không cập nhật trực tiếp.
2. Manual giữ điểm và thứ tự khách chọn. AI chọn lần lượt các điểm, giữ thứ tự đề xuất để ráp lịch. Nếu không nhập primary_limit thì giới hạn gợi ý theo số ngày và nhịp đi, tối đa 10; dữ liệu ít có thể không đủ điểm.
3. Chọn một khách sạn chung cho chuyến nhiều ngày, dựa trên tổng thời gian hai chiều từ khách sạn đến các điểm chính, rồi sao. Mỗi chặng đến/đi từ các điểm phải trong nearby_max_minutes. Chưa tối ưu toàn bộ tuyến, chưa xác nhận sức chứa/còn phòng. Có thể chỉ định hotel_id.
4. Ráp điểm chính giữa các khung giờ ăn; cộng thời gian đường đi và 5 phút dự phòng cho mỗi chặng khác điểm. Chừa đường về khách sạn hoặc điểm kết thúc ngày cuối. Phân phối số lượt ghé qua số ngày còn lại, giới hạn theo pace.
5. Xếp bữa sáng trong 08:00–10:00, trưa trong 12:00–14:00, tối trong 18:00–20:00 nếu đủ khung giờ. Tìm quán gần vị trí lúc đó, ưu tiên sao trong nhóm gần. Giờ mở cửa không đảm bảo nhà hàng có phục vụ món ăn sáng; cần xác nhận thực đơn.
6. Xuất từng ngày, hoạt động có thể trải nghiệm, giờ, chặng đi, SĐT để liên hệ và chỗ ngủ. Nếu không xếp được điểm, ghi unassigned_primary_places. Nếu không tìm được quán, giữ bữa ăn chưa gán quán và nêu việc phải tính lại chặng đi khi khách chọn quán.

## Chỉnh request

Mở request_manual.json hoặc request_ai.json bằng Notepad. Các trường chính:

- mode: manual hoặc ai.
- goal: sightseeing (tham quan), food (ẩm thực), stay (lưu trú), relaxation (spa), nightlife (giải trí).
- selected_ids: danh sách cố định trong manual. AI dùng start_id và primary_limit tùy chọn.
- start_id: nơi bắt đầu. Nếu manual không nhập, tạm dùng điểm đầu đã chọn và cảnh báo không gồm chặng tới đó.
- end_id: nơi kết thúc ngày cuối; mặc định bằng start_id.
- start_date: bắt buộc khi ráp lịch, định dạng YYYY-MM-DD.
- days: 1–7; people: số người; budget_vnd: tổng tiền cả nhóm.
- daily_start, daily_end: khung giờ mỗi ngày, mặc định 08:00–20:00.
- pace: relaxed (tối đa 2 lượt ghé/ngày), balanced (3), busy (4). Đây là số điểm chính, chưa tính bữa ăn.
- nearby_max_minutes: giới hạn một chặng gợi ý; không phải tổng thời gian chuyến đi.
- hotel_id: tùy chọn, giữ khách sạn khách chọn; một ngày không tự gợi ý ngủ lại.
- include_breakfast: true/false. meal_duration_minutes: mặc định 60 phút/bữa, là giả định lập lịch.
- visit_duration_overrides: ví dụ {"new_014":180}, số phút muốn dành cho điểm đó.
- allow_unknown_hours: true mặc định cho phép ráp lịch dự kiến với giờ chưa rõ và gắn cờ; false sẽ không xếp các điểm thiếu giờ cho ngày đó.
- assemble_itinerary: true mặc định. false hoặc cờ CLI --recommendations-only trả danh sách gợi ý như v4.
- transport_cost: tùy chọn {"vnd_per_km":...,"fixed_trip_vnd":...}, giá cho cả nhóm/phương tiện, tránh tính trùng. Không tự nhân theo số người.
- use_model: mô hình Random Forest giả lập cũ, chỉ phân xử khi các tiêu chí xếp hạng trước bằng nhau. Chưa huấn luyện lại bằng khách thật.

Với nhịp balanced, thời lượng nguồn quá dài được tạm giới hạn 120 phút/lượt; relaxed 180, busy 90. Đây là giả định có nhãn, không phải khẳng định tham quan hết mọi hoạt động. Thời lượng do bạn nhập rõ trong override được giữ nguyên. JSON có source_duration_minutes và duration_status để phân biệt. Ví dụ nguồn Trại rắn ghi tối đa 240 phút, lịch balanced có thể bố trí 120 phút và ghi rõ giả định. Có thể có khoảng tự do khi ít điểm hoặc không thể nhét thêm điểm theo thứ tự.

## Dữ liệu hoạt động và xung đột nguồn

- tourism_places_enriched.json và activity_sources.json được đọc tự động. Mỗi hoạt động có nguồn và trạng thái: nguồn cơ sở/cổng du lịch hoặc bài bên thứ ba. Vườn Xanh vẫn cần cơ sở xác nhận.
- source_record và source_snapshot giữ dữ liệu Maps gốc. Không ghi đè số điện thoại/giờ gốc khi nguồn khác nhau. Giao diện có contact_alternatives và information_needs_confirmation.
- Kỳ Lân và Công Đoàn có nguồn cổng du lịch gợi ý 120 phút. Kỳ Lân bổ sung SĐT mà Maps cũ thiếu.
- Nếu giờ Maps cho ngày cụ thể đã có, dùng giờ đó. Nếu thiếu, chế độ cho phép giờ chưa rõ có thể dùng giờ công bố trên nguồn khác và gắn published_hours_assumed_for_date_needs_confirmation. Chưa có gì thì tạm dùng khung giờ chuyến đi, gắn unknown_hours_assumed_needs_confirmation. Đây không phải xác minh thực tế.
- Không tự chuyển giá “miễn phí” trên cổng du lịch thành tất cả trò chơi/đồ ăn/tour miễn phí. planning_overrides.json vẫn để trống giá chưa xác minh.
- Danh sách hoạt động trong mỗi lượt ghé là các lựa chọn có thể tham gia, không phải một lịch diễn từng trò.

## Đọc kết quả

- itinerary.days: lịch theo ngày/giờ, ăn uống, di chuyển và overnight_stay.
- shared_accommodation: khách sạn chung và lý do chọn; SĐT để gọi hỏi giá, số phòng, còn phòng, nhận/trả phòng.
- scheduled_primary_ids / unassigned_primary_places: điểm đã/chưa ráp được.
- activities_available: trải nghiệm có nguồn tại điểm đó.
- budget_allocation: khoản chi mục tiêu, không phải báo giá. Số bữa trong công thức được chỉnh theo khung giờ.
- cost_summary.known_subtotal_vnd: chỉ tổng phần đã có giá. total_trip_cost_vnd và budget_feasible vẫn null nếu chưa xác nhận đủ. Nếu phần đã biết vượt tiền thì budget_feasible=false và status=needs_revision; bản này cảnh báo chứ chưa tự tìm dịch vụ khác theo giá.
- status=provisional_itinerary: lịch dự kiến, chưa đặt dịch vụ. needs_revision: có điểm/bữa ăn/chặng về/lưu trú chưa giải quyết hoặc chi phí đã biết vượt ngân sách; xem cảnh báo.

Lịch là giải pháp tham lam có kiểm tra giờ/chặng đi, không đảm bảo tối ưu toàn tuyến. Nguồn dữ liệu có thể cũ, không có giao thông trực tiếp, chưa xác nhận đặt bàn/đặt phòng, tiện ích theo từng ngày hoặc yêu cầu sức khỏe/độ tuổi. Có thể lặp quán vì danh sách chỉ có 2 nhà hàng. Khung ngày ngắn có thể không chứa đủ 3 bữa. Không coi mở cửa 24h là chắc chắn có phục vụ ăn sáng.

## API cho Node.js

```
python web_api.py --port 8010
```

- GET /health: kiểm tra tiến trình API, không xác nhận Valhalla.
- GET /places: 17 địa điểm kèm sao, SĐT và hoạt động.
- POST /recommend: JSON mẫu, mặc định có itinerary và readable_itinerary.
- POST /itinerary: ép ráp lịch.

API chỉ bind localhost, phục vụ phát triển, chưa phải triển khai production có xác thực/giới hạn tải. Backend Node gọi API như trước; chưa làm giao diện React.

## Kiểm thử

```
python -m unittest discover -v
```

56 kiểm thử đạt: gồm tính liên tục địa điểm, không trùng giờ, khung ăn, ngày/đêm, điểm không xếp được, thiếu giờ, giá chưa biết và API/CLI qua máy chủ Valhalla giả lập. Mô hình kèm theo cũng được gọi trong kiểm thử API. Chưa kiểm tra Valhalla thực tế trên máy bạn; không kèm kết quả giả lập dưới tên lịch thực.

Hướng dẫn tích hợp và bàn giao: [BAN_GIAO_FE_BE.md](BAN_GIAO_FE_BE.md).
