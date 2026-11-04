import unittest
from planner import generate_itinerary,unit_cost
from routing import RoutingError
class FakeRoutes:
 mode='car'
 def route(self,a,b):return {'distance_km':1,'duration_minutes':10 if a['_id']!=b['_id'] else 0,'transport_mode':'car'}
def place(i,opening='08:00',closing='17:00'):
 return {'_id':i,'name':i,'location':{'coordinates':[105.6,10.45]},'opening_hours':{'open':opening,'close':closing},
 'visit_duration_minutes':60,'suggested_tags':['chup_hinh'],'cost':{'raw_text':'Miễn phí'}}
class Tests(unittest.TestCase):
 def data(self):return {'attractions':[place('a'),place('b')],'accommodations':[{'_id':'h','name':'Hotel','location':{'coordinates':[105.6,10.45]}}],'rooms':[]}
 def test_unknown_budget_and_no_repeated_visits(self):
  r=generate_itinerary(self.data(),FakeRoutes(),start_id='a',days=2)
  visits=[x for d in r['days'] for x in d['activities'] if x['type']=='visit']
  self.assertEqual(len({x['place_id'] for x in visits}),len(visits));self.assertIsNone(r['cost_summary']['budget_feasible'])
  self.assertEqual(r['days'][-1]['end_place_id'],'a')
 def test_closed_weekday(self):
  d=self.data();d['attractions'][1]['opening_hours']['weekday_schedule']={'5':[]}
  r=generate_itinerary(d,FakeRoutes(),start_id='a',start_date='2026-11-07')
  self.assertFalse(any(x.get('place_id')=='b' for x in r['days'][0]['activities']))
 def test_budget_and_hours(self):
  d=self.data();d['attractions'][1]['cost']={'confirmed_max_vnd':2000000,'currency':'VND','unit':'person_per_visit','verified_at':'2026-10-13'}
  r=generate_itinerary(d,FakeRoutes(),start_id='a',budget_vnd=1000000)
  self.assertFalse(any(x.get('place_id')=='b' for x in r['days'][0]['activities']))
  for x in r['days'][0]['activities']:
   self.assertLessEqual(x['start'],x['end'])
   if x['type']=='visit':self.assertLessEqual(x['end'],'17:00')
 def test_no_route_is_not_faked(self):
  class F(FakeRoutes):
   def route(self,a,b):
    if b['_id']=='b':raise RoutingError('no route')
    return super().route(a,b)
  r=generate_itinerary(self.data(),F(),start_id='a');self.assertTrue(r['routing_failures'])
  self.assertFalse(any(x.get('place_id')=='b' for x in r['days'][0]['activities']))
if __name__=='__main__':unittest.main()
