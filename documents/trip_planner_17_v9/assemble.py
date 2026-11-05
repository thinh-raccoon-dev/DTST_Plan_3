"""Provisional dated itinerary using routed legs, meal windows and a shared hotel.
No invented routes, no automatic bookings, no claimed complete trip price.
"""
import math
from datetime import date,datetime,time,timedelta
from costs import estimate,transport_cost,nonnegative
from planner import minute,clock,opening
from recommendation import ROLES,number,allocate
from ranking import ranking_key,rating_info
from routing import RoutingError,coordinates

PACEs={'relaxed':2,'balanced':3,'busy':4}

def service_rank(rank, amount, economy):
    if not economy:
        return rank
    return (amount is None, amount if amount is not None else 0, *rank)


def assemble(data,routing,request,recommendations, *, economy=False):
    days=int(request.get('days',1));people=int(request.get('people',2));budget=request.get('budget_vnd',1000000)
    if not request.get('start_date'):raise ValueError('Ráp lịch cần start_date dạng YYYY-MM-DD')
    first=date.fromisoformat(request['start_date'])
    t0=minute(request.get('daily_start','08:00'));t1=minute(request.get('daily_end','20:00'))
    if not 0<=t0<t1<=1440:raise ValueError('Giờ bắt đầu/kết thúc trong ngày không hợp lệ')
    pace=request.get('pace','balanced')
    if pace not in PACEs:raise ValueError('pace: relaxed, balanced hoặc busy')
    allow_unknown=request.get('allow_unknown_hours',True)
    if not isinstance(allow_unknown,bool):raise ValueError('allow_unknown_hours phải là boolean')
    maximum=request.get('nearby_max_minutes',30)
    buffer=int(number(request.get('travel_buffer_minutes',5),'travel_buffer_minutes',0,60,True))
    meal_minutes=int(number(request.get('meal_duration_minutes',60),'meal_duration_minutes',15,180,True))
    include_breakfast=request.get('include_breakfast',True)
    if not isinstance(include_breakfast,bool):raise ValueError('include_breakfast phải là boolean')
    rows=data['attractions']+data['accommodations'];places={p['_id']:p for p in rows}
    primary=[places[x['id']] for x in recommendations['primary_places']]
    failures=[];warnings=[];pending=list(primary);completed=[];cost_items=[];road_km=0
    start_id=request.get('start_id') or (primary[0]['_id'] if primary else None)
    if start_id not in places:raise ValueError('Ráp lịch cần start_id hợp lệ hoặc ít nhất một điểm đã chọn')
    start=places[start_id];coordinates(start)
    if not request.get('start_id'):warnings.append('Chưa nhập điểm xuất phát; tạm dùng điểm đầu khách chọn, không gồm hành trình đến điểm đó.')
    end_id=request.get('end_id',start_id)
    if end_id not in places:raise ValueError('end_id không tồn tại')
    finish_point=places[end_id]
    transport=request.get('transport_cost') or {}
    if not isinstance(transport,dict):raise ValueError('transport_cost phải là object')
    for key in ['vnd_per_km','fixed_trip_vnd']:
        if transport.get(key) is not None and not nonnegative(transport[key]):raise ValueError('Chi phí di chuyển không hợp lệ')
    duration_overrides=request.get('visit_duration_overrides',{})
    if not isinstance(duration_overrides,dict):raise ValueError('visit_duration_overrides phải là object theo mã địa điểm')
    for ident,value in duration_overrides.items():
        if ident not in places:raise ValueError('Mã thời lượng không tồn tại: '+ident)
        number(value,'visit_duration_overrides.'+ident,1,1440,True)
    allocation=allocate(budget,days,people,request.get('budget_shares'))
    def role(p):return p.get('recommendation_role') or ROLES.get(p['_id'],p.get('record_type','attraction'))
    def route(a,b):
        try:
            coordinates(a);coordinates(b);r=routing.route(a,b)
            for key in ['distance_km','duration_minutes']:number(r.get(key),'route.'+key,0)
            return r
        except (RoutingError,ValueError) as exc:
            failures.append({'from_id':a['_id'],'to_id':b['_id'],'reason':str(exc)})
            return None
    def mins(r,a,b):return math.ceil(r['duration_minutes'])+(buffer if a['_id']!=b['_id'] else 0)
    def contact(p):
        raw=p.get('source_record') or {};details=p.get('tourism_details') or {}
        return {'phone':raw.get('phone') or next((x['phone'] for x in details.get('contacts_from_new_sources',[]) if x.get('phone')),None),
                'contact_alternatives':details.get('contacts_from_new_sources',[]),
                'information_needs_confirmation':details.get('needs_confirmation',[]),'source_url':(p.get('provenance') or {}).get('detail_url'),
                **rating_info(p)}
    def slots(p,day):
        ranges,status=opening(p,day)
        if ranges:return ranges,status
        # Never replace known closed entries. Only fill a missing date from another public source.
        if status in ('missing_date_hours','missing_weekday_hours') or not p.get('opening_hours'):
            published=(p.get('tourism_details') or {}).get('hours_from_new_sources',[])
            if allow_unknown and published:
                h=published[0]
                return [(minute(h['open']),minute(h['close']))],'published_hours_assumed_for_date_needs_confirmation'
            if allow_unknown:return [(t0,t1)],'unknown_hours_assumed_needs_confirmation'
        return [],status
    def fit(p,day,arrival,duration,deadline,earliest=None):
        ranges,status=slots(p,day)
        for a,b in sorted(ranges):
            begin=max(arrival,a,earliest or 0)
            if begin+duration<=min(b,deadline):return begin,begin+duration,status
        return None
    def common_hotel():
        if days==1:return None,None
        explicit=request.get('hotel_id')
        if explicit:
            if explicit in request.get('excluded_ids',[]):raise ValueError('hotel_id nằm trong danh sách loại trừ')
            p=places.get(explicit)
            if not p or role(p)!='accommodation':raise ValueError('hotel_id phải là chỗ ở hợp lệ')
            return p,{'method':'user_selected','availability':'not_checked'}
        chosen_stays=[p for p in primary if role(p)=='accommodation']
        if chosen_stays:return chosen_stays[0],{'method':'first_primary_accommodation','availability':'not_checked'}
        anchors=[p for p in primary if role(p)!='accommodation'] or [start]
        candidates=[]
        for h in data['accommodations']:
            if h['_id'] in request.get('excluded_ids',[]):continue
            times=[]
            for anchor in anchors:
                outward=route(anchor,h);back=route(h,anchor)
                if outward is None or back is None:break
                times.append(outward['duration_minutes']);times.append(back['duration_minutes'])
            else:
                if max(times)>maximum:continue
                total=sum(times)
                rank = service_rank(ranking_key(h,total), estimate(h,people,nights=days-1), economy)
                candidates.append((rank,h,{'method':'shared_hotel_road_time_sum_then_rating',
                    'anchor_ids':[p['_id'] for p in anchors],'sum_bidirectional_anchor_minutes':round(total,2),
                    'note':'Gợi ý chung theo các điểm chính; không phải tối ưu toàn tuyến hay xác nhận còn phòng.'}))
        if not candidates:return None,{'method':'no_common_hotel_within_limit'}
        candidates.sort(key=lambda x:x[0]);return candidates[0][1],candidates[0][2]
    if request.get('mode') == 'manual':
        stays = {p['_id'] for p in primary if role(p) == 'accommodation'}
        if request.get('hotel_id'):
            stays.add(request['hotel_id'])
        if len(stays) > 1 or (stays and days == 1):
            raise ValueError('Chỉ chọn một chỗ ở chung cho chuyến có ít nhất hai ngày.')
    hotel,hotel_reason=common_hotel()
    if days>1 and hotel is None:warnings.append('Không tìm được khách sạn chung trong giới hạn đi đường. Chưa xếp ngủ lại; các ngày tạm quay về điểm xuất phát.')
    restaurants=[p for p in rows if role(p)=='restaurant' and p['_id'] not in request.get('excluded_ids',[])]
    meal_specs=[]
    if include_breakfast:meal_specs.append(('breakfast','Ăn sáng',8*60,10*60))
    meal_specs += [('lunch','Ăn trưa',12*60,14*60),('dinner','Ăn tối',18*60,20*60)]
    # Only count meals that can fit wholly in the requested daily window.
    active_meals=[x for x in meal_specs if max(t0,x[2])+meal_minutes<=min(t1,x[3])]
    meal_count=len(active_meals)*days
    food_target=allocation['whole_group_vnd']['food']/meal_count if meal_count else None
    allocation['food_meal_count_assumption']=meal_count
    allocation['food_target_per_person_per_meal_vnd']=round(food_target/people) if food_target is not None else None
    allocation['note']+=' Số bữa mục tiêu điều chỉnh theo khung giờ lịch.'
    sleep_minutes = int(number(request.get('sleep_minutes',540),'sleep_minutes',480,600,True))
    checkout_deadline = minute(hotel.get('checkout_time') or '12:00') if hotel else None
    def timestamp(day, minutes):
        return (datetime.combine(day,time.min)+timedelta(minutes=minutes)).isoformat(timespec='minutes')

    daily=[];overnights=0;trip_meal_counts={}
    for offset in range(days):
        day=first+timedelta(days=offset)
        origin=start if offset==0 else places[daily[-1]['actual_end_place_id']]
        end=finish_point if offset==days-1 else (hotel or start)
        current=origin;now=t0;steps=[];visit_count=0;day_problem=False;day_meal_counts={};last_meal_id=None
        previous_stay = daily[-1]['overnight_stay'] if offset else None
        if previous_stay:
            now = max(now, previous_stay['ready_next_day_minute'])
            if offset == days-1:
                if now+15 <= min(checkout_deadline,t1):
                    steps.append({'type':'checkout','name':'Trả phòng','start':clock(now),'end':clock(now+15)})
                    now += 15
                else:
                    day_problem = True
                    warnings.append(f'{day}: không đủ thời gian trả phòng trước hạn sau khi ngủ và chuẩn bị.')
                    now = max(now,t1)
            if now >= t1:
                day_problem = True
                warnings.append(f'{day}: không còn thời gian hoạt động sau khi nghỉ qua đêm.')
                now = t1
        # Spread primary choices across remaining days, bounded by pace.
        remaining_visits=sum(role(p) not in ('restaurant','accommodation') for p in pending)
        quota=min(PACEs[pace],math.ceil(remaining_visits/(days-offset)))
        def wait(until):
            nonlocal now
            if until>now:
                steps.append({'type':'free_time','name':'Nghỉ/chờ hoặc thời gian tự do','start':clock(now),'end':clock(until)})
                now=until
        def move(p,r):
            nonlocal current,now,road_km
            duration=mins(r,current,p)
            if current['_id']!=p['_id']:
                steps.append({'type':'travel','name':'Di chuyển đến '+p['name'],'from_id':current['_id'],'to_id':p['_id'],
                    'start':clock(now),'end':clock(now+duration),'distance_km':r['distance_km'],
                    'route_duration_minutes':round(r['duration_minutes'],1),'buffer_minutes':buffer,
                    'provider':'local_valhalla','estimated':True})
            road_km+=r['distance_km'];now+=duration;current=p
        def visits_before(deadline):
            nonlocal now,visit_count
            effective_quota = quota
            if request.get('mode', 'ai') == 'ai' and effective_quota == 0 and visit_count < PACEs[pace]:
                effective_quota = PACEs[pace]
            while visit_count<effective_quota:
                if pending:
                    candidates = pending if request.get('mode','ai') == 'ai' else pending[:1]
                elif request.get('mode', 'ai') == 'ai':
                    candidates = [p for p in data['attractions'] if p['_id'] not in completed and role(p) not in ('restaurant','accommodation') and p['_id'] not in request.get('excluded_ids',[])]
                else:
                    break
                for p in candidates:
                    if role(p) in ('restaurant','accommodation'):continue
                    source_duration=int(number(p.get('visit_duration_minutes',90),'visit_duration_minutes',1,1440))
                    duration=int(duration_overrides.get(p['_id'],source_duration))
                    duration_status='request_override' if p['_id'] in duration_overrides else p.get('duration_status')
                    if p['_id'] not in duration_overrides and duration_status!='user_input':
                        cap={'relaxed':180,'balanced':120,'busy':90}[pace]
                        if duration>cap:duration=cap;duration_status='planning_assumption_capped_from_source_duration'
                    outward=route(current,p);back=route(p,end)
                    if outward is None or back is None:continue
                    if outward['duration_minutes']>maximum:continue
                    window=fit(p,day,now+mins(outward,current,p),duration,deadline)
                    if not window:continue
                    begin,stop,status=window
                    if stop+mins(back,p,end)>t1:continue
                    break
                else:
                    break
                move(p,outward);wait(begin)
                amount=estimate(p,people,minutes=duration)
                steps.append({'type':'visit','place_id':p['_id'],'name':p['name'],'start':clock(begin),'end':clock(stop),
                    'duration_minutes':duration,'duration_status':duration_status,'source_duration_minutes':source_duration,'hours_status':status,
                    'activities_available':p.get('activities_available',[]),
                    'activities_note':'Các hoạt động có thể chọn, không phải lịch đã bao gồm tất cả trò hoặc xác nhận lịch diễn.',
                    'estimated_group_cost_vnd':amount,**contact(p)})
                cost_items.append({'kind':'primary_visit','place_id':p['_id'],'amount_vnd':amount})
                now=stop;completed.append(p['_id'])
                if p in pending:pending.remove(p)
                visit_count+=1
        def meal(spec):
            nonlocal now, day_problem, last_meal_id
            kind,label,target,latest=spec;latest=min(latest,t1)
            requested=pending[0] if pending and role(pending[0])=='restaurant' else None
            pool=[requested] if requested else restaurants
            choices=[]
            for p in pool:
                if day_meal_counts.get(p['_id'], 0) >= 2:
                    continue
                out=route(current,p);back=route(p,end)
                if out is None or back is None or out['duration_minutes']>maximum:continue
                window=fit(p,day,now+mins(out,current,p),meal_minutes,latest,max(t0,target))
                if not window:continue
                begin,stop,status=window
                if stop+mins(back,p,end)>t1:continue
                rank = service_rank(ranking_key(p,out['duration_minutes']), estimate(p,people,minutes=meal_minutes), economy)
                
                day_penalty = day_meal_counts.get(p['_id'], 0)
                consecutive_penalty = 1 if p['_id'] == last_meal_id else 0
                trip_penalty = trip_meal_counts.get(p['_id'], 0)
                is_bf = any(w in p['name'].lower() for w in ['hủ tiếu', 'bún', 'cháo', 'phở', 'điểm tâm']) or \
                        any(x.get('name') == 'Bữa sáng' for x in (p.get('source_record') or {}).get('about', {}).get('Nổi tiếng về', []))
                fit_penalty = 0 if (kind == 'breakfast' and is_bf) or (kind != 'breakfast' and not is_bf) else 1
                
                meal_key = (day_penalty, consecutive_penalty, trip_penalty, fit_penalty, *rank)
                choices.append((meal_key,p,out,begin,stop,status))
            if choices:
                choices.sort(key=lambda x:x[0]);_,p,out,begin,stop,status=choices[0]
                day_meal_counts[p['_id']] = day_meal_counts.get(p['_id'], 0) + 1
                trip_meal_counts[p['_id']] = trip_meal_counts.get(p['_id'], 0) + 1
                last_meal_id = p['_id']
                move(p,out);wait(begin)
                amount=estimate(p,people,minutes=meal_minutes)
                steps.append({'type':'meal','meal':kind,'place_id':p['_id'],'name':label+' — '+p['name'],
                    'start':clock(begin),'end':clock(stop),'duration_minutes':meal_minutes,'duration_status':'planning_assumption',
                    'hours_status':status,'meal_service_status':'not_confirmed_for_meal_type','spending_target_group_vnd':round(food_target) if food_target is not None else None,
                    'estimated_group_cost_vnd':amount,'source_price_text':(p.get('cost') or {}).get('raw_text'),
                    'price_note':'Khoản dành ra không phải báo giá hoặc hóa đơn. Khách tự chọn món.',**contact(p)})
                now=stop;cost_items.append({'kind':'meal','place_id':p['_id'],'amount_vnd':amount})
                if requested:completed.append(p['_id']);pending.pop(0)
                return
            # Reserve time to eat without inventing a restaurant or claiming a route there.
            back=route(current,end);begin=max(now,target,t0);stop=begin+meal_minutes
            if back is not None and stop<=latest and stop+mins(back,current,end)<=t1:
                wait(begin)
                steps.append({'type':'meal_unassigned','meal':kind,'name':label+' — tự chọn quán gần vị trí hiện tại',
                    'start':clock(begin),'end':clock(stop),'anchor_id':current['_id'],
                    'spending_target_group_vnd':round(food_target) if food_target is not None else None,
                    'note':'Chưa tìm được quán phù hợp trong dữ liệu/khung giờ hoặc đã giới hạn lặp lại quán cũ trong ngày; tự do chọn quán lân cận.'})
                now=stop;cost_items.append({'kind':'meal_unassigned','amount_vnd':None})
                last_meal_id = None
            else:
                day_problem = True
                steps.append({'type':'meal_unscheduled','meal':kind,'name':label+' — không đủ điều kiện xếp',
                              'start':clock(now),'end':clock(now)})
                cost_items.append({'kind':'meal_unscheduled','amount_vnd':None})
                warnings.append(f'{day}: chưa bố trí được {label.lower()} trong khung giờ.')
        for spec in active_meals:
            visits_before(max(now,min(spec[3]-meal_minutes,t1)))
            meal(spec)
        visits_before(t1)
        final=route(current,end)
        if final is not None and now+mins(final,current,end)<=t1:
            move(end,final)
        else:
            day_problem=True
            steps.append({'type':'unresolved_return','name':'Chưa xếp được chặng kết thúc','from_id':current['_id'],'to_id':end['_id'],
                'start':clock(now),'end':clock(now),'note':'Không có tuyến hoặc không đủ thời gian. Chưa coi là đã đến điểm kết thúc.'})
            warnings.append(f'{day}: chưa hoàn thành chặng kết thúc, cần sửa lịch.')
        stay=None
        if offset<days-1 and hotel and current['_id']==hotel['_id']:
            overnights+=1
            amount=estimate(hotel,people,nights=1)
            stay={'id':hotel['_id'],'name':hotel['name'],'planned_arrival':clock(now),'nights':1,
                'estimated_group_cost_vnd':amount,'spending_target_group_vnd':round(allocation['whole_group_vnd']['stay']/(days-1)),
                'booking_status':'not_booked','availability_status':'not_checked','checkin_checkout_status':'needs_confirmation',
                'contact_note':'Gọi xác nhận giá, số phòng/sức chứa, còn phòng và giờ nhận/trả.',**contact(hotel)}
            sleep_start = now+30
            sleep_end = sleep_start+sleep_minutes
            stay.update({
                'evening_preparation_minutes':30,
                'checkin_required':offset == 0 or not previous_stay,
                'sleep_start_at':timestamp(day,sleep_start),
                'sleep_end_at':timestamp(day,sleep_end),
                'sleep_minutes':sleep_minutes,
                'morning_preparation_minutes':30,
                'ready_next_day_at':timestamp(day,sleep_end+30),
                'ready_next_day_minute':sleep_end+30-1440,
                'checkout_deadline':clock(checkout_deadline),
                'checkout_deadline_source':'property_data' if hotel.get('checkout_time') else 'default_needs_confirmation',
            })
            cost_items.append({'kind':'accommodation','place_id':hotel['_id'],'date':str(day),'amount_vnd':amount})
            if pending and pending[0]['_id']==hotel['_id']:
                completed.append(hotel['_id']);pending.pop(0)
        daily.append({'day':offset+1,'date':str(day),'status':'needs_revision' if day_problem else 'provisional',
            'start_place_id':origin['_id'],'planned_end_place_id':end['_id'],'actual_end_place_id':current['_id'],
            'activities':steps,'visit_count':visit_count,'overnight_stay':stay})
    unassigned=[{'id':p['_id'],'name':p['name'],'reason':'Không xếp được theo thứ tự, thời lượng, giờ hoạt động, giới hạn di chuyển, nhịp đi hoặc số ngày; cần điều chỉnh.'} for p in pending]
    amount_transport=transport_cost(road_km,transport)
    fixed=transport.get('fixed_trip_vnd')
    unknown_count = sum(item['amount_vnd'] is None for item in cost_items)
    unknown_count += int(road_km > 0 and amount_transport is None)
    for day in daily:
        for step in day['activities']:
            if step['type'] in ('visit', 'meal'):
                step['price_status'] = 'unknown' if step['estimated_group_cost_vnd'] is None else 'estimate'
                step['hours_need_confirmation'] = 'assum' in step['hours_status']
        stay = day['overnight_stay']
        if stay:
            stay['price_status'] = 'unknown' if stay['estimated_group_cost_vnd'] is None else 'estimate'
    known=sum(x['amount_vnd'] for x in cost_items if x.get('amount_vnd') is not None)+(amount_transport or 0)+(fixed or 0)
    if known>budget:warnings.append('Các khoản đã biết vượt ngân sách; cần đổi dịch vụ hoặc tăng ngân sách. Không xác nhận lịch phù hợp tài chính.')
    if unassigned:warnings.append('Có điểm chính chưa xếp được; xem unassigned_primary_places. Không tự bỏ qua yêu cầu của khách.')
    if any(x['type']=='meal_unassigned' for d in daily for x in d['activities']):warnings.append('Có bữa chưa gán quán; thời gian và chặng di chuyển sẽ cần tính lại sau khi chọn quán.')
    if any('assum' in x.get('hours_status','') for d in daily for x in d['activities']):warnings.append('Có điểm dùng giờ giả định hoặc giờ công bố chưa xác nhận cho ngày đi; xem hours_status.')
    warnings+=['Lịch dự kiến theo tuyến đường ước tính; chưa có giao thông trực tiếp hoặc đặt dịch vụ.',
        'Giờ, thời lượng và hoạt động có nguồn/giả định riêng. Danh sách trò có sẵn không có nghĩa trải nghiệm hết trong thời gian ghé.',
        'Giá và sức chứa thiếu; ngân sách dành ra không phải báo giá. Tổng chi phí chưa xác nhận.',
        'Giờ mở cửa quán không xác nhận có phục vụ từng bữa; đặc biệt bữa sáng cần kiểm tra thực đơn.',
        'Phương án chọn tham lam theo thứ tự; chưa tối ưu toàn bộ các tổ hợp hoặc tuyến nhiều vùng.']
    return {'status':'needs_revision' if (not primary or unassigned or (days>1 and hotel is None) or known>budget or any(d['status']=='needs_revision' for d in daily) or any(x['type']=='meal_unassigned' for d in daily for x in d['activities'])) else 'provisional_itinerary',
        'algorithm':'primary_order_then_meal_windows_shared_hotel','input':request,
        'days':daily,'shared_accommodation':{'id':hotel['_id'],'name':hotel['name'],'selection':hotel_reason,
            'scheduled_nights':overnights,'phone':contact(hotel)['phone'],'availability_status':'not_checked'} if hotel else None,
        'scheduled_primary_ids':completed,'unassigned_primary_places':unassigned,
        'budget_allocation':allocation,'cost_summary':{'known_subtotal_vnd':round(known),'unknown_cost_count':unknown_count,'items':cost_items,
            'road_distance_km':round(road_km,3),'transport_variable_estimate_vnd':amount_transport,'transport_fixed_vnd':fixed,
            'total_trip_cost_vnd':None,'budget_feasible':False if known>budget else None,
            'budget_overage_vnd':round(max(0,known-budget)),
            'note':'Known subtotal là phần đã có giá, không phải toàn bộ chuyến đi; chưa bao gồm mọi phụ phí và hành trình đến điểm xuất phát.'},
        'routing_failures':failures,'warnings':list(dict.fromkeys(warnings))}
