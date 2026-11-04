"""One entry point shared by CLI and the local HTTP API."""
from copy import deepcopy
from recommendation import recommend
from assemble import assemble,PACEs
from progress import add_stop_ids

def priced_services(day):
    priced = {
        (step['type'], step['meal'] if step['type'] == 'meal' else step['place_id'])
        for step in day['activities']
        if step.get('estimated_group_cost_vnd') is not None
    }
    if (day['overnight_stay'] or {}).get('estimated_group_cost_vnd') is not None:
        priced.add(('stay', None))
    return priced


def plan_trip(data,routing,request,scorer=None):
    if not isinstance(request,dict):raise ValueError('Yêu cầu phải là object')
    req=deepcopy(request)
    enabled=req.get('assemble_itinerary',True)
    if not isinstance(enabled,bool):raise ValueError('assemble_itinerary phải là true/false')
    if req.get('mode','ai')=='ai' and 'primary_limit' not in req:
        pace=req.get('pace','balanced')
        if pace not in PACEs:raise ValueError('pace không hợp lệ')
        days=req.get('days',1)
        if isinstance(days,int) and not isinstance(days,bool):req['primary_limit']=min(10,max(1,days*PACEs[pace]))
    result=recommend(data,routing,req,scorer)
    result['activity_sources']=data.get('activity_sources',{})
    if not enabled:return result
    itinerary=assemble(data,routing,req,result)
    if itinerary['cost_summary']['budget_feasible'] is False:
        candidate = assemble(data,routing,req,result,economy=True)
        original_cost = itinerary['cost_summary']
        candidate_cost = candidate['cost_summary']
        if (candidate_cost['known_subtotal_vnd'] < original_cost['known_subtotal_vnd']
                and candidate_cost['unknown_cost_count'] <= original_cost['unknown_cost_count']
                and candidate['scheduled_primary_ids'] == itinerary['scheduled_primary_ids']
                and [d['status'] for d in candidate['days']] == [d['status'] for d in itinerary['days']]
                and candidate['scheduled_primary_ids']
                and all(
                    {x['meal'] for x in before['activities'] if x['type'] == 'meal'} <=
                    {x['meal'] for x in after['activities'] if x['type'] == 'meal'}
                    and priced_services(before) <= priced_services(after)
                    and bool(after['overnight_stay']) == bool(before['overnight_stay'])
                    for before, after in zip(itinerary['days'], candidate['days'])
                )):
            if req.get('mode','ai') == 'manual':
                add_stop_ids(candidate)
                result['budget_alternative'] = candidate
            else:
                itinerary = candidate
                itinerary['budget_adjusted'] = True
                itinerary['known_savings_vnd'] = original_cost['known_subtotal_vnd'] - candidate_cost['known_subtotal_vnd']
    add_stop_ids(itinerary)
    result['status']=itinerary['status'];result['itinerary']=itinerary
    result['budget_allocation']=itinerary['budget_allocation']
    result['budget_feasible']=itinerary['cost_summary']['budget_feasible']
    result['warnings']=[x for x in result['warnings'] if not x.startswith(('Đây là danh sách đề xuất, chưa phải lịch trình có giờ','Giờ mở cửa chỉ theo ngày bắt đầu'))]
    result['warnings'].append('Thông tin giờ trong primary_places theo ngày bắt đầu; xem hours_status từng hoạt động trong itinerary cho ngày đã xếp.')
    result['warnings']=list(dict.fromkeys(result['warnings']+itinerary['warnings']))
    return result

def readable(result):
    itinerary=result.get('itinerary')
    if not itinerary:return 'Chỉ có danh sách gợi ý; bật assemble_itinerary để ráp lịch.\n'
    types={'visit':'THAM QUAN/HOẠT ĐỘNG','meal':'ĂN UỐNG','meal_unassigned':'BỮA ĂN CHƯA CHỌN QUÁN','travel':'DI CHUYỂN','free_time':'NGHỈ/TỰ DO','unresolved_return':'CHƯA XẾP ĐƯỢC ĐƯỜNG VỀ'}
    lines=['LỊCH TRÌNH DỰ KIẾN — CHƯA ĐẶT DỊCH VỤ','Trạng thái: '+itinerary['status'],'']
    for d in itinerary['days']:
        lines.append(f"NGÀY {d['day']} — {d['date']}")
        for x in d['activities']:
            lines.append(f"{x['start']}–{x['end']} | {types.get(x['type'],x['type'])} | {x['name']}")
            if x['type']=='travel':lines.append(f"  {x['distance_km']:.1f} km; {x['route_duration_minutes']:.1f} phút chạy xe + {x['buffer_minutes']} phút dự phòng")
            if x.get('phone'):lines.append('  SĐT: '+x['phone'])
            if x.get('google_rating') is not None:lines.append(f"  Google: {x['google_rating']}/5 ({x.get('google_review_count')} lượt; dữ liệu lưu)")
            if x.get('price_status') == 'unknown':lines.append('  Giá cần xác nhận.')
            if x.get('hours_need_confirmation'):lines.append('  Giờ mở cửa cần xác nhận.')
            if x.get('hours_status'):lines.append('  Tình trạng giờ: '+x['hours_status'])
            if x.get('duration_status'):lines.append('  Nguồn thời lượng: '+x['duration_status'])
            if x.get('activities_available'):lines.append('  Có thể chọn trải nghiệm: '+'; '.join(a['name'] for a in x['activities_available']))
            if x.get('spending_target_group_vnd') is not None:lines.append(f"  Ngân sách mục tiêu cả nhóm: {x['spending_target_group_vnd']:,.0f}đ (không phải báo giá)")
        stay=d.get('overnight_stay')
        if stay:
            lines.append('NGỦ LẠI: '+stay['name']+' | dự kiến đến '+stay['planned_arrival'])
            lines.append(f"  Dự kiến ngủ {stay['sleep_start_at']} → {stay['sleep_end_at']}, sẵn sàng lúc {stay['ready_next_day_at']}.")
            lines.append(f"  Hạn trả phòng ngày cuối: {stay['checkout_deadline']}.")
            lines.append('  SĐT: '+(stay.get('phone') or 'chưa có'))
            lines.append('  Gọi xác nhận giá, sức chứa, còn phòng và giờ nhận/trả phòng.')
        lines.append('')
    if itinerary['unassigned_primary_places']:
        lines.append('ĐIỂM CHƯA XẾP ĐƯỢC:')
        lines += ['- '+p['name']+': '+p['reason'] for p in itinerary['unassigned_primary_places']]
    lines.append('NGÂN SÁCH MỤC TIÊU CẢ NHÓM:')
    for k,v in itinerary['budget_allocation']['whole_group_vnd'].items():lines.append(f'- {k}: {v:,.0f}đ')
    cost = itinerary['cost_summary']
    lines.append(f"Đã tính {cost['known_subtotal_vnd']:,.0f}đ, còn {cost['unknown_cost_count']} khoản trong lịch chưa có giá.")
    if result.get('budget_alternative'):
        alternative = result['budget_alternative']['cost_summary']
        lines.append(f"Có lịch thay thế trong JSON với phần đã tính {alternative['known_subtotal_vnd']:,.0f}đ.")
    lines.append('Tổng chi phí thực tế: chưa xác nhận.')
    lines.append('CẦN LƯU Ý:')
    lines+=['- '+x for x in result['warnings']]
    return '\n'.join(lines)+'\n'
