"""Stateless same-day itinerary revision for the application backend."""
from datetime import date, datetime, time, timedelta, timezone
from math import ceil
from uuid import uuid4

from planner import opening, minute
from routing import coordinates, RoutingError

LOCAL = timezone(timedelta(hours=7))
MEAL_WINDOWS = {'breakfast': (480, 600), 'lunch': (720, 840), 'dinner': (1080, 1200)}


def add_stop_ids(itinerary):
    for day in itinerary['days']:
        for step in day['activities']:
            if step['type'] in ('visit', 'meal'):
                step.update(stop_id=uuid4().hex, status='pending')


def replan(data, routing, payload):
    itinerary = payload['itinerary']
    config = itinerary['input']
    event = payload['event']
    if event not in ('arrived', 'departed'):
        raise ValueError('event phải là arrived hoặc departed')
    actual = datetime.fromisoformat(payload['occurred_at'])
    if actual.utcoffset() is None:
        raise ValueError('occurred_at cần múi giờ')
    actual = actual.astimezone(LOCAL)
    day = next((d for d in itinerary['days'] if d['date'] == actual.date().isoformat()), None)
    if day is None:
        raise ValueError('Ngày sự kiện nằm ngoài lịch')
    stops = [step for step in day['activities'] if step.get('stop_id')]
    current = next((step for step in stops if step.get('status') != 'completed'), None)
    if current is None or current['stop_id'] != payload['stop_id']:
        raise ValueError('Sự kiện phải thuộc lượt ghé chưa hoàn thành đầu tiên')
    expected = 'pending' if event == 'arrived' else 'arrived'
    if current.get('status') != expected:
        raise ValueError('Trạng thái lượt ghé không phù hợp với sự kiện')
    if event == 'departed' and actual < datetime.fromisoformat(current['arrived_at']):
        raise ValueError('Giờ rời phải sau hoặc bằng giờ đến')

    places = {p['_id']: p for p in data['attractions'] + data['accommodations']}
    start = minute(config.get('daily_start', '08:00'))
    end = minute(config.get('daily_end', '20:00'))
    buffer = config.get('travel_buffer_minutes', 5)
    midnight = datetime.combine(date.fromisoformat(day['date']), time.min, LOCAL)

    def stamp(minutes):
        return (midnight + timedelta(minutes=minutes)).isoformat()

    def slot(step, arrival):
        place = places[step['place_id']]
        ranges, status = opening(place, actual.date())
        if not ranges and status in ('missing_date_hours', 'missing_weekday_hours') and config.get('allow_unknown_hours', True):
            published = (place.get('tourism_details') or {}).get('hours_from_new_sources', [])
            ranges = [(minute(published[0]['open']), minute(published[0]['close']))] if published else [(start, end)]
            status = 'assumed_needs_confirmation'
        low, high = MEAL_WINDOWS.get(step.get('meal'), (start, end))
        for opens, closes in sorted(ranges):
            begin = max(arrival, opens, low)
            finish = begin + step['duration_minutes']
            if finish <= min(closes, high, end):
                return begin, finish, status
        return None

    def travel(origin, target):
        if origin == target:
            return 0
        return ceil(routing.route(places[origin], places[target])['duration_minutes']) + buffer

    now = ceil((actual - midnight).total_seconds()/60)
    origin = current['place_id']
    updates = []
    issues = []
    if event == 'arrived':
        current_update = dict(current, status='arrived', arrived_at=actual.isoformat())
        window = slot(current, now)
        if window:
            now = window[1]
            current_update['estimated_departure_at'] = stamp(now)
        else:
            issues.append({'stop_id':current['stop_id'], 'reason':'current_stop_has_no_feasible_window'})
    else:
        current_update = dict(current, status='completed', departed_at=actual.isoformat())
        current_update.pop('estimated_departure_at', None)

    remaining = stops[stops.index(current)+1:]
    destination = day['planned_end_place_id']
    if not issues:
        for step in remaining:
            target = step['place_id']
            try:
                arrival = now + travel(origin, target)
                window = slot(step, arrival)
                fits_return = window and window[1] + travel(target, destination) <= end
            except (RoutingError, ValueError):
                issues.append({'stop_id':step['stop_id'], 'reason':'route_unavailable'})
                continue
            if not fits_return:
                issues.append({'stop_id':step['stop_id'], 'reason':'time_window_or_return_conflict'})
                continue
            begin, now, hours_status = window
            lon, lat = coordinates(places[target])
            updates.append(dict(step, latitude=lat, longitude=lon, estimated_arrival_at=stamp(arrival),
                                planned_start_at=stamp(begin), planned_end_at=stamp(now), hours_status=hours_status))
            origin = target

    return_at = None
    if event != 'arrived' or 'estimated_departure_at' in current_update:
        try:
            return_at = stamp(now + travel(origin, destination))
            if datetime.fromisoformat(return_at) > midnight + timedelta(minutes=end):
                issues.append({'reason':'return_after_daily_end'})
        except (RoutingError, ValueError):
            issues.append({'reason':'return_route_unavailable'})
    return {
        'trip_id': payload['trip_id'], 'itinerary_version': payload['itinerary_version'],
        'event_id': payload['event_id'], 'date': day['date'],
        'status': 'needs_revision' if issues else 'replanned',
        'current_stop': current_update, 'remaining_stops': updates,
        'next_stop': updates[0] if updates and (not issues or updates[0]['stop_id'] == remaining[0]['stop_id']) else None,
        'issues': issues, 'estimated_day_end_at': return_at,
        'later_days_need_review': bool(day.get('overnight_stay')),
    }
