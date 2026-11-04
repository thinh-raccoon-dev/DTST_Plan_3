import unittest
from load_data import load_data
from progress import replan
from test_recommendation import Routes
from trip_service import plan_trip


class ProgressTests(unittest.TestCase):
    def test_arrival_then_departure_preserve_stop_identity(self):
        data = load_data()
        routing = Routes()
        itinerary = plan_trip(data, routing, {
            'mode': 'manual', 'selected_ids': ['new_014'],
            'start_date': '2026-11-01', 'include_breakfast': False,
        })['itinerary']
        stop = next(s for s in itinerary['days'][0]['activities'] if s.get('stop_id'))
        payload = dict(trip_id='trip', itinerary_version=1, event_id='a',
                       stop_id=stop['stop_id'], event='arrived',
                       occurred_at=f"2026-11-01T{stop['start']}:00+07:00", itinerary=itinerary)
        arrived = replan(data, routing, payload)
        self.assertEqual(arrived['current_stop']['status'], 'arrived')
        stop.update(arrived['current_stop'])
        payload.update(event='departed', event_id='b', itinerary_version=2,
                       occurred_at=f"2026-11-01T{stop['end']}:00+07:00")
        departed = replan(data, routing, payload)
        self.assertEqual(departed['current_stop']['status'], 'completed')
        self.assertEqual(departed['current_stop']['stop_id'], stop['stop_id'])
        self.assertNotIn('estimated_departure_at', departed['current_stop'])
