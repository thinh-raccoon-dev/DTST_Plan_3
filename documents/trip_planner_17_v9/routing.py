import math
import json
from urllib.request import Request, urlopen
from urllib.error import URLError

class RoutingError(RuntimeError):
    pass

def coordinates(record):
    location = record.get('location') or {}
    coord = location.get('coordinates')
    if not isinstance(coord, list) or len(coord) != 2:
        raise ValueError('Địa điểm thiếu tọa độ: ' + str(record.get('_id')))
    lon, lat = coord
    if not all(isinstance(x, (int, float)) and math.isfinite(x) for x in coord) or not (-180 <= lon <= 180 and -90 <= lat <= 90) or (lon, lat) == (0, 0):
        raise ValueError('Tọa độ không hợp lệ')
    return lon, lat

def distance_km(a, b):
    # Straight-line distance is ONLY a candidate filter, never a travel-time estimate.
    lon1, lat1 = coordinates(a); lon2, lat2 = coordinates(b)
    lat1, lat2 = math.radians(lat1), math.radians(lat2)
    dlat, dlon = lat2 - lat1, math.radians(lon2 - lon1)
    h = math.sin(dlat/2)**2 + math.cos(lat1)*math.cos(lat2)*math.sin(dlon/2)**2
    return 6371 * 2 * math.asin(math.sqrt(min(1, h)))

class ValhallaClient:
    def __init__(self, url='http://localhost:8002', mode='car'):
        if mode not in ('car', 'motorcycle'):
            raise ValueError('mode phải là car hoặc motorcycle')
        self.url = url.rstrip('/'); self.mode = mode; self.cache = {}

    def route(self, origin, destination):
        a, b = coordinates(origin), coordinates(destination)
        key = (a, b, self.mode)
        if key in self.cache:
            return dict(self.cache[key])
        if a == b:
            return {'distance_km': 0.0, 'duration_minutes': 0.0, 'transport_mode': self.mode}
        try:
            payload = {
                'locations': [{'lat': a[1], 'lon': a[0]}, {'lat': b[1], 'lon': b[0]}],
                'costing': 'auto' if self.mode == 'car' else 'motorcycle', 'units': 'kilometers'
            }
            request = Request(self.url + '/route', data=json.dumps(payload).encode(), headers={'Content-Type': 'application/json'}, method='POST')
            with urlopen(request, timeout=60) as response:
                summary = json.load(response)['trip']['summary']
            km, minutes = float(summary['length']), float(summary['time']) / 60
            if not math.isfinite(km) or not math.isfinite(minutes) or min(km, minutes) < 0:
                raise ValueError('Giá trị tuyến không hợp lệ')
        except (URLError, OSError, ValueError, KeyError, TypeError) as exc:
            raise RoutingError('Không tính được tuyến: ' + str(exc)) from exc
        result = {'distance_km': round(km, 3), 'duration_minutes': minutes, 'transport_mode': self.mode}
        self.cache[key] = result
        return dict(result)
