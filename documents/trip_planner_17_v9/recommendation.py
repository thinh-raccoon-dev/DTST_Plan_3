"""Two selection modes. Recommendations are not bookings or a timed itinerary."""
import math
from datetime import date,timedelta
from costs import estimate
from planner import opening
from routing import coordinates, RoutingError
from ranking import rating_info,ranking_key,explanation,POLICY

GOALS={'sightseeing':'attraction','food':'restaurant','relaxation':'wellness','nightlife':'entertainment','stay':'accommodation'}
ROLES={**{f'new_{i:03d}':'restaurant' for i in [1,2]},
       **{f'new_{i:03d}':'accommodation' for i in range(3,8)},
       **{f'new_{i:03d}':'entertainment' for i in range(8,12)},
       **{f'new_{i:03d}':'wellness' for i in [12,13]},
       **{f'new_{i:03d}':'attraction' for i in range(14,18)}}

def number(value, name, low=0, high=float('inf'), integer=False):
    if isinstance(value,bool) or not isinstance(value,(int,float)) or not math.isfinite(value) or not low<=value<=high or (integer and int(value)!=value):
        raise ValueError('Giá trị không hợp lệ: '+name)
    return value

def allocate(budget, days, people, shares=None):
    shares=shares or ({'food':.3,'stay':.3,'transport':.2,'activities':.1,'reserve':.1} if days>1 else {'food':.35,'stay':0,'transport':.25,'activities':.25,'reserve':.15})
    if set(shares)!={'food','stay','transport','activities','reserve'}:raise ValueError('budget_shares phải có food, stay, transport, activities, reserve')
    for key,value in shares.items():number(value,'budget_shares.'+key,0,1)
    if not math.isclose(sum(shares.values()),1,abs_tol=1e-8):raise ValueError('Tổng tỷ lệ ngân sách phải bằng 1')
    if days==1 and shares['stay']!=0:raise ValueError('Chuyến một ngày không phân bổ lưu trú')
    parts={key:int(budget*value) for key,value in shares.items()}
    parts['reserve']+=budget-sum(parts.values())
    return {'kind':'spending_targets_not_service_prices','whole_group_vnd':parts,
            'food_target_per_person_per_meal_vnd':round(parts['food']/(days*3*people)),
            'food_meal_count_assumption':days*3,
            'stay_target_whole_group_per_night_vnd':round(parts['stay']/(days-1)) if days>1 else None,
            'note':'Khoản khách dự kiến dành ra; không phải giá của quán/khách sạn và không chứng minh đủ ngân sách.'}

def recommend(data, routing, request, scorer=None):
    if not isinstance(request,dict):raise ValueError('Yêu cầu phải là JSON object')
    mode=request.get('mode','ai');goal=request.get('goal','sightseeing')
    if mode not in ('manual','ai'):raise ValueError('mode phải là manual hoặc ai')
    if goal not in GOALS:raise ValueError('goal không được hỗ trợ')
    days=number(request.get('days',1),'days',1,7,True)
    people=number(request.get('people',2),'people',1,100,True)
    budget=number(request.get('budget_vnd',1000000),'budget_vnd',1,1e12,True)
    maximum=number(request.get('nearby_max_minutes',30),'nearby_max_minutes',1,240)
    limit=number(request.get('primary_limit',3),'primary_limit',1,10,True)
    limit=int(limit)
    interests=request.get('interests',[])
    if not isinstance(interests,list) or any(not isinstance(x,str) for x in interests):raise ValueError('interests phải là danh sách chuỗi')
    travel_date=date.fromisoformat(request['start_date']) if request.get('start_date') else None
    all_rows=data['attractions']+data['accommodations']
    indexed={x['_id']:x for x in all_rows}
    failures=[];warnings=[]
    def role(p):return p.get('recommendation_role') or ROLES.get(p['_id'],p.get('record_type','attraction'))
    def routed(a,b):
        try:
            coordinates(a);coordinates(b)
            r=routing.route(a,b)
            for key in ('distance_km','duration_minutes'):number(r.get(key),'route.'+key,0)
            return r
        except (RoutingError,ValueError) as e:
            failures.append({'from_id':a['_id'],'to_id':b['_id'],'reason':str(e)})
            return None
    def info(p, day=travel_date):
        spans,status=opening(p,day) if day else ([], 'date_not_provided')
        # Empty exact schedule entry is known closed; missing date is unknown.
        hs='closed_or_no_usable_hours' if day and not spans and status not in ('missing_date_hours','missing_weekday_hours') else status
        amount=estimate(p,people,minutes=p.get('visit_duration_minutes',90),nights=max(0,days-1))
        return {**rating_info(p),'id':p['_id'],'name':p['name'],'role':role(p),'tags':p.get('tags',[]),
                'coordinates':p['location']['coordinates'],'address':(p.get('source_record') or {}).get('address'),
                'phone':(p.get('source_record') or {}).get('phone') or next((x.get('phone') for x in (p.get('tourism_details') or {}).get('contacts_from_new_sources',[]) if x.get('phone')),None),
                'contact_alternatives':(p.get('tourism_details') or {}).get('contacts_from_new_sources',[]),
                'activities_available':p.get('activities_available',[]),
                'onsite_services':(p.get('tourism_details') or {}).get('onsite_services',[]),
                'information_needs_confirmation':(p.get('tourism_details') or {}).get('needs_confirmation',[]),
                'source_url':(p.get('provenance') or {}).get('detail_url'),
                'source_date':(p.get('provenance') or {}).get('source_date'),
                'hours_status':hs,'opening_spans_minutes':spans,
                'known_group_cost_vnd':amount,'source_price_text':(p.get('cost') or {}).get('raw_text'),
                'price_status':'verified_input_estimate_not_booking' if amount is not None else 'unknown',
                'availability_status':'not_checked','duration_minutes':p.get('visit_duration_minutes'),
                'duration_status':p.get('duration_status')}
    excluded=request.get('excluded_ids',[])
    if not isinstance(excluded,list) or any(not isinstance(x,str) for x in excluded):raise ValueError('excluded_ids phải là danh sách mã')
    if set(excluded)-indexed.keys():raise ValueError('excluded_ids chứa mã không tồn tại')
    matches=lambda p:len({x.casefold().strip() for x in interests}&{x.casefold().strip() for x in p.get('tags',[])})
    selected_details={}
    if mode=='manual':
        selected=request.get('selected_ids',[])
        if not isinstance(selected,list) or not selected or any(not isinstance(x,str) for x in selected):raise ValueError('Chế độ thủ công cần selected_ids')
        if len(selected)!=len(set(selected)):raise ValueError('selected_ids không được trùng')
        if set(selected)-indexed.keys():raise ValueError('selected_ids chứa mã không tồn tại')
        if set(selected)&set(excluded):raise ValueError('Một điểm không thể vừa chọn vừa loại trừ')
        primary=[indexed[x] for x in selected]
        if any(role(p)!=GOALS[goal] for p in primary):warnings.append('Một số điểm khách chọn khác loại mục tiêu; vẫn giữ nguyên, không tự thay đổi.')
    else:
        if request.get('selected_ids'):raise ValueError('AI mode không dùng selected_ids; chuyển manual để giữ điểm khách chọn')
        start_id=request.get('start_id')
        if start_id not in indexed:raise ValueError('AI mode cần start_id hợp lệ làm điểm xuất phát')
        current=indexed[start_id];primary=[];pool=[p for p in all_rows if role(p)==GOALS[goal] and p['_id'] not in excluded]
        for _ in range(limit):
            choices=[]
            for p in pool:
                r=routed(current,p)
                if r is None or r['duration_minutes']>maximum:continue
                detail=info(p)
                if detail['hours_status']=='closed_or_no_usable_hours' and not any(
                    info(p, travel_date+timedelta(days=i))['hours_status'] != 'closed_or_no_usable_hours'
                    for i in range(1, days)
                ):continue
                score=scorer(p,interests,people,budget,p.get('visit_duration_minutes',90)+r['duration_minutes'],days*600,r['distance_km']) if scorer else None
                rank=ranking_key(p,r['duration_minutes'],matches(p),score)
                if role(p) == "attraction":
                    rank = (-matches(p), *rank)
                choices.append((rank,p,r))
            if not choices:break
            choices.sort(key=lambda x:x[0]);chosen=choices[0][1]
            selected_details[chosen['_id']]={'route_from_previous':choices[0][2],'ranking_reason':explanation(chosen,choices[0][2])}
            primary.append(chosen);pool.remove(chosen);current=chosen
        if not primary:warnings.append('Không tìm được điểm chính phù hợp trong phạm vi và dữ liệu hiện có; tăng nearby_max_minutes hoặc đổi điểm xuất phát.')
    def nearby(anchor,target_role):
        found=[]
        for p in all_rows:
            if role(p)!=target_role or p['_id']==anchor['_id'] or p['_id'] in excluded:continue
            r=routed(anchor,p)
            if r is None or r['duration_minutes']>maximum:continue
            detail=info(p)
            if detail['hours_status']=='closed_or_no_usable_hours' and not any(
                    info(p, travel_date+timedelta(days=i))['hours_status'] != 'closed_or_no_usable_hours'
                    for i in range(1, days)
                ):continue
            found.append((ranking_key(p,r['duration_minutes'],matches(p)),dict(detail,route_from_anchor=r,ranking_reason=explanation(p,r))))
        found.sort(key=lambda x:x[0])
        return [x[1] for x in found[:3]]
    related=[]
    for p in primary:
        types=['restaurant']+(['accommodation'] if days>1 else [])
        if GOALS[goal] in ('restaurant','accommodation','wellness','entertainment'):types.append('attraction')
        types=[t for t in dict.fromkeys(types) if t!=role(p)]
        suggestions={t:nearby(p,t) for t in types}
        missing=[t for t,items in suggestions.items() if not items]
        related.append({'anchor_id':p['_id'],'suggestions':suggestions,'missing_categories':missing})
        if missing:warnings.append('Không có gợi ý gần '+p['name']+' cho: '+', '.join(missing)+'. Không tự mở rộng phạm vi.')
    if failures:warnings.append('Một số tuyến không tính được; không dùng khoảng cách thẳng thay thế thời gian đi đường.')
    warnings+=['Đây là danh sách đề xuất, chưa phải lịch trình có giờ; chưa kiểm tra xung đột giữa các hoạt động.',
               'Giá, sức chứa và còn phòng chưa đầy đủ; chưa thể xác nhận tổng chi phí chuyến đi.',
               'Giờ mở cửa chỉ theo ngày bắt đầu nếu có; chưa xác minh các ngày khác hoặc giờ đến.',
               'Chỉ chọn trong dữ liệu 17 địa điểm hiện có.',
               'Điểm sao và lượt đánh giá lấy từ dữ liệu đã lưu, không cập nhật Google trực tiếp.']
    return {'status':'recommendations_only','mode':mode,'goal':goal,
            'selection_method':'user_selected_preserved' if mode=='manual' else 'nearby_and_google_rating_with_optional_model_tiebreak',
            'ranking_policy':dict(POLICY, attraction_primary_priority='interest_matches_desc_before_road_time'),
            'primary_places':[dict(info(p),**selected_details.get(p['_id'],{})) for p in primary],'related_by_primary':related,
            'budget_allocation':allocate(budget,days,people,request.get('budget_shares')),
            'total_trip_cost_vnd':None,'budget_feasible':None,'routing_failures':failures,
            'warnings':list(dict.fromkeys(warnings+(['Mô hình kèm theo học nhãn giả lập, chưa được đánh giá với khách thật.'] if scorer else [])))}
