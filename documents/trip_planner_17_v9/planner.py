"""Greedy provisional planner, based on website hours and estimated road routes."""
import math
from datetime import date, timedelta
from routing import distance_km, coordinates, RoutingError
from costs import estimate, transport_cost, nonnegative

def minute(value):
    if value=='24:00': return 1440
    h, m = map(int, value.split(':'))
    if not (0 <= h < 24 and 0 <= m < 60): raise ValueError('Giờ không hợp lệ')
    return h*60+m

def clock(value):
    return f'{value//60:02d}:{value%60:02d}'

def opening(place, travel_date):
    hours = place.get('opening_hours') or {}
    schedule = hours.get('weekday_schedule')
    exact = hours.get('date_schedule')
    if isinstance(exact, dict):
        spans = exact.get(travel_date.isoformat())
        if spans is None: return [], 'missing_date_hours'
        status = 'dated_hours_unconfirmed'
    elif isinstance(schedule, dict):
        spans = schedule.get(str(travel_date.weekday()))
        if spans is None: return [], 'missing_weekday_hours'
        status = 'weekday_hours_from_dataset'
    else:
        spans = [{'open': hours.get('open'), 'close': hours.get('close')}]
        status = 'weekday_hours_unconfirmed'
    result = []
    for span in spans:
        try:
            a, b = minute(span['open']), minute(span['close'])
            if a < b: result.append((a,b))
        except (ValueError, KeyError, TypeError): pass
    return result, status

def unit_cost(place):
    c = place.get('cost') or {}
    value = c.get('confirmed_max_vnd')
    if isinstance(value, (int, float)) and math.isfinite(value) and value >= 0 and c.get('currency') == 'VND' and c.get('unit') == 'person_per_visit' and c.get('verified_at'):
        return value
    return None

def generate_itinerary(data, routing, *, start_id, days=1, people=2, budget_vnd=1000000,
                       start_date='2026-11-07', interests=None, daily_start='08:00', daily_end='18:00',
                       radius_km=30, candidate_limit=20, max_stops=3, hotel_id=None, scorer=None, transport=None):
    if not (1 <= days <= 7) or people < 1 or budget_vnd <= 0: raise ValueError('days 1–7, people >=1, budget >0')
    if radius_km <= 0 or not 1 <= candidate_limit <= 100 or not 1 <= max_stops <= 10:
        raise ValueError('Giới hạn điểm hoặc bán kính không hợp lệ')
    transport=transport or {}
    for key in ('vnd_per_km','fixed_trip_vnd'):
        if transport.get(key) is not None and not nonnegative(transport[key]):raise ValueError('Chi phí di chuyển không hợp lệ')
    first = date.fromisoformat(start_date); t0, t1 = minute(daily_start), minute(daily_end)
    if t0 >= t1: raise ValueError('Giờ kết thúc phải sau giờ bắt đầu trong cùng ngày')
    interests = interests or []
    all_places = {r['_id']: r for r in data['attractions'] + data['accommodations']}
    if start_id not in all_places: raise ValueError('Không tìm thấy start_id: ' + start_id)
    start = all_places[start_id]; coordinates(start)
    hotel = None; issues = []; rejected = []; spent = 0; cost_items = []; visited = set()
    if days > 1:
        valid_hotels = []
        for h in data['accommodations']:
            try:
                if distance_km(start,h) <= radius_km: valid_hotels.append(h)
            except ValueError: pass
        if hotel_id:
            hotel = next((h for h in data['accommodations'] if h['_id'] == hotel_id), None)
            if not hotel: raise ValueError('hotel_id không tồn tại')
            coordinates(hotel)
        else:
            hotel = min(valid_hotels, key=lambda h:distance_km(start,h)) if valid_hotels else None
        if not hotel: raise ValueError('Không có lưu trú có tọa độ trong khu vực; tăng bán kính hoặc chọn hotel_id')
        # A real route is checked before suggesting the accommodation.
        routing.route(start,hotel)
        issues.extend(['Lưu trú chỉ là gợi ý vị trí; chưa xác nhận sức chứa, giá, giờ nhận/trả phòng hoặc còn phòng.',
                       'Bản đầu dùng một nơi lưu trú cố định; chưa tối ưu chuyến đi nhiều khu vực.'])
    hotel_amount=estimate(hotel,people,nights=days-1) if hotel else 0
    fixed_amount=transport.get('fixed_trip_vnd')
    spent=(hotel_amount or 0)+(fixed_amount or 0)
    if spent>budget_vnd:raise ValueError('Chi phí lưu trú/di chuyển đã biết vượt ngân sách')
    travel_km=0
    candidates = []
    for p in data['attractions']:
        if 'possible_non_attraction_review_required' in p.get('quality_flags',[]): continue
        try:
            d = distance_km(start,p)
            if d > radius_km: continue
        except ValueError: continue
        duration = p.get('visit_duration_minutes')
        if not isinstance(duration,(int,float)) or duration <= 0: continue
        tags = p.get('tags') or p.get('suggested_tags') or []
        matches = len(set(interests)&set(tags))
        candidates.append((p,matches,d))
    candidates.sort(key=lambda x:(-x[1], x[2], x[0]['_id']))
    candidates = candidates[:candidate_limit]
    if not candidates: raise ValueError('Không có điểm ứng viên với tọa độ/thời lượng trong phạm vi')
    daily = []
    for day in range(days):
        travel_date = first + timedelta(days=day)
        origin = start if day == 0 else hotel
        end = start if day == days-1 else hotel
        current, now, steps = origin, t0, []
        stopped = 0
        def travel_step(a,b,route,start_time):
            mins = math.ceil(route['duration_minutes']) + (5 if a['_id'] != b['_id'] else 0)
            return {'type':'travel','from_id':a['_id'],'to_id':b['_id'],'start':clock(start_time),'end':clock(start_time+mins),
                    'distance_km':route['distance_km'],'route_duration_minutes':round(route['duration_minutes'],1),
                    'buffer_minutes':5 if a['_id']!=b['_id'] else 0,'transport_mode':route['transport_mode'],'provider':'local_valhalla','estimated':True}, mins
        while stopped < max_stops:
            choices = []
            for p,matches,_ in candidates:
                if p['_id'] in visited: continue
                spans, hours_status = opening(p,travel_date)
                if not spans: continue
                price = estimate(p,people,minutes=p['visit_duration_minutes'])
                if price is not None and spent+price > budget_vnd: continue
                try:
                    route = routing.route(current,p); back = routing.route(p,end)
                except RoutingError as exc:
                    rejected.append({'date':str(travel_date),'place_id':p['_id'],'reason':str(exc)}); continue
                leg_cost=transport_cost(route['distance_km'],transport)
                return_cost=transport_cost(back['distance_km'],transport)
                if spent+(price or 0)+(leg_cost or 0)+(return_cost or 0)>budget_vnd:continue
                move, mins = travel_step(current,p,route,now)
                arrival = now+mins; duration = math.ceil(p['visit_duration_minutes'])
                for opened,closed in spans:
                    begin = max(arrival,opened); finish = begin+duration
                    # Reserve a real return leg and an unassigned 60-min midday break.
                    pause = 60 if now < 12*60 <= finish else 0
                    if pause: begin=max(arrival+pause,opened);finish=begin+duration
                    if finish > closed or finish+math.ceil(back['duration_minutes'])+5 > t1: continue
                    ai_score = scorer(p, interests, people, budget_vnd-spent, duration + mins, t1 - now, route['distance_km']) if scorer else None
                    utility = (ai_score * 100 if ai_score is not None else matches*100) - mins - max(0,begin-arrival)
                    choices.append((utility,p,route,begin,finish,price,hours_status,move,mins,pause))
                    break
            if not choices: break
            choices.sort(key=lambda x:(-x[0],x[1]['_id']))
            _,p,route,begin,finish,price,hours_status,move,mins,pause = choices[0]
            steps.append(move);now+=mins
            travel_km+=route['distance_km']
            spent+=transport_cost(route['distance_km'],transport) or 0
            if begin>now:
                steps.append({'type':'break_or_wait','start':clock(now),'end':clock(begin),
                              'note':'Thời gian nghỉ hoặc chờ; chưa gán địa điểm ăn uống và chi phí.'})
            amount = price
            steps.append({'type':'visit','place_id':p['_id'],'name':p['name'],'start':clock(begin),'end':clock(finish),
                'duration_minutes':finish-begin,'duration_status':p.get('duration_status'),'estimated_cost_vnd':amount,'source_price_text':(p.get('cost') or {}).get('raw_text'),
                'hours_status':hours_status,'interests_matched':list(set(interests)&set(p.get('tags') or p.get('suggested_tags') or [])),
                'source_url':(p.get('provenance') or {}).get('detail_url'), 'verification_status':'provisional'})
            cost_items.append({'place_id':p['_id'],'amount_vnd':amount,'status':'confirmed_input' if amount is not None else 'unknown'})
            if amount is not None:spent+=amount
            visited.add(p['_id']);current=p;now=finish;stopped+=1
        final_route = routing.route(current,end)
        step,mins=travel_step(current,end,final_route,now)
        if now+mins>t1:raise ValueError('Chặng kết thúc không vừa thời gian; hãy đổi nơi ở hoặc giờ kết thúc')
        steps.append(step)
        travel_km+=final_route['distance_km']
        spent+=transport_cost(final_route['distance_km'],transport) or 0
        if spent>budget_vnd:raise ValueError('Chi phí tuyến kết thúc vượt ngân sách')
        if not stopped:issues.append(f'Ngày {day+1}: không xếp được điểm tham quan mới trong điều kiện hiện tại.')
        daily.append({'day':day+1,'date':str(travel_date),'start_place_id':origin['_id'],'end_place_id':end['_id'],
                      'activities':steps,'visit_count':stopped})
    rooms = [r for r in data['rooms'] if hotel and r['accommodation_id']==hotel['_id']]
    return {'status':'provisional','algorithm':'synthetic_random_forest_plus_greedy' if scorer else 'greedy_rules_no_trained_model','input':{'days':days,'people':people,'budget_vnd':budget_vnd,
       'budget_scope':'whole_group','start_date':start_date,'start_id':start_id,'interests':interests,'transport_mode':routing.mode},
       'days':daily,'accommodation':{'id':hotel['_id'],'name':hotel['name'],'nights':days-1,'room_candidates':rooms[:5],
          'selection_reason':'Selected explicitly or nearest to starting point within search radius; not a confirmed booking.'} if hotel else None,
       'cost_summary':{'known_attraction_subtotal_vnd':sum(x['amount_vnd'] or 0 for x in cost_items),'known_trip_subtotal_vnd':spent,'accommodation_vnd':hotel_amount,'transport_distance_km':round(travel_km,3),'transport_variable_vnd':transport_cost(travel_km,transport),'transport_fixed_vnd':fixed_amount,'items':cost_items,'total_trip_cost_vnd':None,'budget_feasible':None,'budget_status':'not_confirmed_missing_costs_or_meals',
          'excluded_or_unknown':['ăn uống','nhiên liệu/di chuyển','phí gửi xe','giá tham quan chưa xác nhận','lưu trú nếu qua đêm','đi đến điểm xuất phát']},
       'warnings':list(dict.fromkeys(issues+(['Điểm AI học từ nhãn giả lập, không phải phản hồi khách thật.'] if scorer else [])+['Giờ theo ngày nguồn chưa xác minh; thời lượng lấy cận trên quan sát hoặc giả định 90 phút, xem duration_status.',
         'Không thể xác nhận tổng chuyến đi vừa ngân sách khi thiếu giá/đơn vị/sức chứa.',
         'Thời gian Valhalla là ước tính, chưa có giao thông trực tiếp; mỗi chặng khác điểm cộng 5 phút dự phòng.',
         'Chưa xếp địa điểm ăn uống. Khoảng nghỉ là thời gian chưa phân bổ, không phải dịch vụ đã đặt.'])),
       'routing_failures':rejected}
