import json,unittest
from copy import deepcopy
from datetime import date,timedelta
from pathlib import Path
from load_data import load_data
from trip_service import plan_trip,readable
from test_recommendation import Routes
from planner import minute
from routing import RoutingError

class AssemblyTests(unittest.TestCase):
 def setUp(self):
  self.data=load_data();self.req={'mode':'manual','goal':'sightseeing','start_id':'new_001','selected_ids':['new_014','new_016'],'days':2,'people':4,'budget_vnd':5000000,'start_date':'2026-11-01'}
 def runtrip(self,req=None,routes=None):return plan_trip(self.data,routes or Routes(),req or self.req)
 def test_manual_points_scheduled_order_and_day_dates(self):
  r=self.runtrip();it=r['itinerary']
  self.assertEqual(it['scheduled_primary_ids'],['new_014','new_016']);self.assertFalse(it['unassigned_primary_places'])
  self.assertEqual([d['date'] for d in it['days']],['2026-11-01','2026-11-02'])
 def test_times_no_overlap_and_daily_bound(self):
  it=self.runtrip()['itinerary']
  for day in it['days']:
   end=8*60
   for x in day['activities']:
    self.assertGreaterEqual(minute(x['start']),end);self.assertGreaterEqual(minute(x['end']),minute(x['start']))
    end=minute(x['end']);self.assertLessEqual(end,20*60)
 def test_spatial_continuity_and_return(self):
  it=self.runtrip()['itinerary'];last=None
  for day in it['days']:
   current=day['start_place_id']
   if last:self.assertEqual(last,current)
   for x in day['activities']:
    if x['type']=='travel':self.assertEqual(x['from_id'],current);current=x['to_id']
    if x['type'] in ('visit','meal'):self.assertEqual(x['place_id'],current)
   self.assertEqual(current,day['actual_end_place_id']);last=current
  self.assertEqual(last,'new_001')
 def test_shared_hotel_one_night_with_phone(self):
  it=self.runtrip()['itinerary'];h=it['shared_accommodation']
  self.assertIsNotNone(h);self.assertEqual(h['scheduled_nights'],1)
  self.assertTrue(it['days'][0]['overnight_stay']['phone']);self.assertIsNone(it['days'][1]['overnight_stay'])
 def test_one_day_no_hotel(self):
  it=self.runtrip(dict(self.req,days=1))['itinerary']
  self.assertIsNone(it['shared_accommodation']);self.assertTrue(all(d['overnight_stay'] is None for d in it['days']))
 def test_meal_windows_and_targets(self):
  it=self.runtrip()['itinerary'];count=0
  bounds={'breakfast':(480,600),'lunch':(720,840),'dinner':(1080,1200)}
  for day in it['days']:
   for x in day['activities']:
    if x['type']=='meal':
     count+=1;a,b=bounds[x['meal']];self.assertGreaterEqual(minute(x['start']),a);self.assertLessEqual(minute(x['end']),b)
     self.assertIsNotNone(x['spending_target_group_vnd'])
  self.assertEqual(count,6)
 def test_enrichment_37_and_phone_fallback(self):
  count=sum(len(p.get('activities_available',[])) for p in self.data['attractions'])
  self.assertEqual(count,37)
  r=self.runtrip(dict(self.req,selected_ids=['new_015']))
  self.assertEqual(r['primary_places'][0]['phone'],'0986999749')
  self.assertEqual(r['primary_places'][0]['duration_minutes'],120)
  visits=[x for d in r['itinerary']['days'] for x in d['activities'] if x['type']=='visit']
  self.assertTrue(visits[0]['activities_available']);self.assertTrue(r['activity_sources'])
 def test_oversized_manual_not_silently_dropped(self):
  r=self.runtrip(dict(self.req,days=1,visit_duration_overrides={'new_014':900}))
  self.assertEqual(r['status'],'needs_revision')
  self.assertEqual([p['id'] for p in r['itinerary']['unassigned_primary_places']],['new_014','new_016'])
 def test_explicit_closed_no_assumption(self):
  self.data['attractions'][2]['opening_hours']={'weekday_schedule':{str(i):[] for i in range(7)}}
  # Select a known tourism record directly, regardless of list position.
  p=next(p for p in self.data['attractions'] if p['_id']=='new_014')
  p['opening_hours']={'weekday_schedule':{str(i):[] for i in range(7)}}
  it=self.runtrip()['itinerary'];self.assertIn('new_014',[x['id'] for x in it['unassigned_primary_places']])
 def test_strict_unknown_does_not_use_published_hours(self):
  r=self.runtrip(dict(self.req,start_date='2027-01-01',allow_unknown_hours=False))
  self.assertTrue(r['itinerary']['unassigned_primary_places'])
 def test_unknown_fallback_marked(self):
  r=self.runtrip(dict(self.req,selected_ids=['new_015']))
  visits=[x for d in r['itinerary']['days'] for x in d['activities'] if x['type']=='visit']
  self.assertIn('needs_confirmation',visits[0]['hours_status'])
 def test_cost_known_subtotal_and_unknown_total(self):
  p=next(x for x in self.data['attractions'] if x['_id']=='new_014')
  p['cost']={'confirmed_max_vnd':100000,'unit':'person_per_visit','currency':'VND','verified_at':'2026-10-30'}
  r=self.runtrip();c=r['itinerary']['cost_summary'];self.assertEqual(c['known_subtotal_vnd'],400000)
  self.assertIsNone(c['total_trip_cost_vnd']);self.assertIsNone(c['budget_feasible'])
 def test_known_over_budget_flag(self):
  p=next(x for x in self.data['attractions'] if x['_id']=='new_014')
  p['cost']={'confirmed_max_vnd':2000000,'unit':'person_per_visit','currency':'VND','verified_at':'2026-10-30'}
  r=self.runtrip();self.assertFalse(r['budget_feasible']);self.assertEqual(r['status'],'needs_revision')
 def test_ai_assembled_default_limit_days(self):
  req=dict(self.req,mode='ai');req.pop('selected_ids')
  r=self.runtrip(req);self.assertTrue(r['itinerary']['scheduled_primary_ids']);self.assertEqual(len(r['itinerary']['days']),2)
 def test_recommendations_only_compatibility(self):
  r=self.runtrip(dict(self.req,assemble_itinerary=False));self.assertNotIn('itinerary',r);self.assertEqual(r['status'],'recommendations_only')
 def test_routing_failure_never_invented(self):
  class Fail(Routes):
   def route(self,a,b):
    if a['_id']!=b['_id']:raise RoutingError('no route')
    return super().route(a,b)
  it=self.runtrip(routes=Fail())['itinerary'];self.assertTrue(it['routing_failures']);self.assertTrue(it['unassigned_primary_places'])
  self.assertFalse(any(x['type']=='travel' for d in it['days'] for x in d['activities']))
 def test_no_restaurant_meal_unassigned(self):
  self.data['attractions']=[x for x in self.data['attractions'] if x.get('record_type') != 'restaurant' and x['_id'] not in ('new_001','new_002','new_010','new_011','new_013')]
  r=self.runtrip(dict(self.req,start_id='new_014'));self.assertTrue(any(x['type']=='meal_unassigned' for d in r['itinerary']['days'] for x in d['activities']))
 def test_bad_schedule_inputs(self):
  for extra in [{'daily_start':'21:00','daily_end':'20:00'},{'pace':'bad'},{'meal_duration_minutes':-1},{'visit_duration_overrides':{'bad':20}},{'assemble_itinerary':'yes'}]:
   with self.assertRaises(ValueError):self.runtrip(dict(self.req,**extra))
 def test_readable(self):
  t=readable(self.runtrip());self.assertIn('NGÀY 1',t);self.assertIn('NGỦ LẠI',t);self.assertIn('SĐT',t);self.assertIn('Có thể chọn trải nghiệm',t)
 def test_duration_capping_is_labelled(self):
  r=self.runtrip();v=next(x for d in r['itinerary']['days'] for x in d['activities'] if x.get('place_id')=='new_014' and x['type']=='visit')
  self.assertEqual(v['source_duration_minutes'],240);self.assertEqual(v['duration_minutes'],120);self.assertIn('assumption',v['duration_status'])
if __name__=='__main__':unittest.main()
