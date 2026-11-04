import unittest
from copy import deepcopy
from datetime import date
from costs import estimate
from load_data import load_data
from planner import opening,generate_itinerary
from test_planner import FakeRoutes,place

class V2Tests(unittest.TestCase):
 def priced(self,unit,capacity=None):
  return {'cost':{'confirmed_max_vnd':100000,'currency':'VND','unit':unit,'capacity':capacity,'verified_at':'2026-10-30'}}
 def test_unit_person(self):self.assertEqual(estimate(self.priced('person_per_visit'),3),300000)
 def test_unit_group(self):self.assertEqual(estimate(self.priced('group_per_visit',4),5),200000)
 def test_room_nights(self):self.assertEqual(estimate(self.priced('room_per_night',2),5,nights=2),600000)
 def test_hour_rounding(self):self.assertEqual(estimate(self.priced('room_per_hour',4),5,minutes=90),400000)
 def test_unknown_not_zero(self):
  self.assertIsNone(estimate(self.priced('room_per_night'),3,nights=2))
  self.assertIsNone(estimate({'cost':{}},2))
 def test_all_records_and_midnight(self):
  d=load_data();self.assertEqual(len(d['attractions'])+len(d['accommodations']),17)
  karaoke=next(x for x in d['attractions'] if x['_id']=='new_009')
  self.assertEqual(opening(karaoke,date(2026,11,1))[0],[(630,1440)])
  self.assertEqual(opening(karaoke,date(2027,1,1))[0],[])
  self.assertEqual(d['attractions'][0]['visit_duration_minutes'],120)
  self.assertIn('menu',d['attractions'][0]['source_record'])
 def test_route_cost_reserved(self):
  a,b=place('a'),place('b');b.update(self.priced('person_per_visit'))
  d={'attractions':[a,b],'accommodations':[],'rooms':[]}
  # A round trip to b costs 100k fare + 100k entry; budget only 150k.
  r=generate_itinerary(d,FakeRoutes(),start_id='a',people=1,budget_vnd=150000,transport={'vnd_per_km':50000,'fixed_trip_vnd':0})
  self.assertFalse(any(x.get('place_id')=='b' for x in r['days'][0]['activities']))
 def test_hotel_budget(self):
  h=place('h');h.update(self.priced('room_per_night',2))
  d={'attractions':[place('a'),place('b')],'accommodations':[h],'rooms':[]}
  with self.assertRaisesRegex(ValueError,'vượt ngân sách'):
   generate_itinerary(d,FakeRoutes(),start_id='a',days=2,people=3,budget_vnd=150000)
 def test_snapshot_schedule_with_ai(self):
  d=load_data();calls=[]
  def scorer(*args):calls.append(args);return .8
  r=generate_itinerary(d,FakeRoutes(),start_id='new_001',start_date='2026-11-01',scorer=scorer)
  self.assertTrue(calls);self.assertTrue(r['days'][0]['visit_count'])
  self.assertIsNone(r['cost_summary']['budget_feasible'])
  self.assertTrue(all(x['start']<=x['end'] for x in r['days'][0]['activities']))

if __name__=='__main__':unittest.main()
