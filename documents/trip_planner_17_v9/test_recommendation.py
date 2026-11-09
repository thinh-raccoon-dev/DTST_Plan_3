import unittest
from copy import deepcopy
from recommendation import recommend,allocate
from load_data import load_data
from routing import RoutingError

class Routes:
    mode='car'
    def route(self,a,b):
        t=0 if a['_id']==b['_id'] else 10
        return {'distance_km':t/2,'duration_minutes':t,'transport_mode':'car'}

class RecommendationTests(unittest.TestCase):
    def setUp(self):self.data=load_data();self.req={'mode':'ai','goal':'sightseeing','start_id':'new_001','days':2,'people':4,'budget_vnd':5000000,'start_date':'2026-11-01'}
    def test_manual_preserves_user_order(self):
        self.req.update(mode='manual',selected_ids=['new_017','new_014'])
        r=recommend(self.data,Routes(),self.req)
        self.assertEqual([x['id'] for x in r['primary_places']],['new_017','new_014'])
        self.assertTrue(r['related_by_primary'][0]['suggestions']['accommodation'])
    def test_ai_only_goal_category(self):
        r=recommend(self.data,Routes(),self.req)
        self.assertTrue(r['primary_places'])
        self.assertTrue(all(x['role']=='attraction' for x in r['primary_places']))
    def test_food_goal(self):
        self.req['goal']='food';r=recommend(self.data,Routes(),self.req)
        self.assertTrue(all(x['role']=='restaurant' for x in r['primary_places']))
        self.assertIn('attraction',r['related_by_primary'][0]['suggestions'])
    def test_stay_goal(self):
        self.req['goal']='stay';r=recommend(self.data,Routes(),self.req)
        self.assertTrue(all(x['role']=='accommodation' for x in r['primary_places']))
    def test_no_hotel_one_day(self):
        self.req['days']=1;r=recommend(self.data,Routes(),self.req)
        self.assertNotIn('accommodation',r['related_by_primary'][0]['suggestions'])
        self.assertEqual(r['budget_allocation']['whole_group_vnd']['stay'],0)
    def test_budget_totals_not_quotes(self):
        r=recommend(self.data,Routes(),self.req)
        self.assertEqual(sum(r['budget_allocation']['whole_group_vnd'].values()),5000000)
        self.assertIsNone(r['budget_feasible']);self.assertIsNone(r['total_trip_cost_vnd'])
        self.assertTrue(all(x['known_group_cost_vnd'] is None for x in r['primary_places']))
    def test_no_route_not_fake(self):
        class Fail(Routes):
            def route(self,a,b):raise RoutingError('no route')
        r=recommend(self.data,Fail(),self.req)
        self.assertFalse(r['primary_places']);self.assertTrue(r['routing_failures'])
    def test_nearby_limit(self):
        self.req['nearby_max_minutes']=5;r=recommend(self.data,Routes(),self.req)
        self.assertFalse(r['primary_places'])
    def test_exclusions(self):
        self.req['excluded_ids']=['new_014'];r=recommend(self.data,Routes(),self.req)
        self.assertNotIn('new_014',[x['id'] for x in r['primary_places']])
    def test_invalid_manual_and_conflict(self):
        for ids in [[],['bad'],['new_014','new_014']]:
            with self.assertRaises(ValueError):recommend(self.data,Routes(),dict(self.req,mode='manual',selected_ids=ids))
        with self.assertRaises(ValueError):recommend(self.data,Routes(),dict(self.req,mode='manual',selected_ids=['new_014'],excluded_ids=['new_014']))
    def test_road_order(self):
        class Variable(Routes):
            def route(self,a,b):
                r=super().route(a,b);r['duration_minutes']=int(b['_id'][-3:]);return r
        self.req.update(mode='manual',selected_ids=['new_014'])
        r=recommend(self.data,Variable(),self.req)
        food=r['related_by_primary'][0]['suggestions']['restaurant']
        self.assertEqual([x['id'] for x in food],['new_001','new_002','new_013'])
    def test_input_validation(self):
        for kwargs in [{'people':True},{'days':1.5},{'budget_vnd':-1},{'interests':'food'},{'nearby_max_minutes':float('nan')}]:
            with self.assertRaises(ValueError):recommend(self.data,Routes(),dict(self.req,**kwargs))
    def test_unknown_hours_not_claimed_open(self):
        self.req['start_date']='2027-01-01';r=recommend(self.data,Routes(),self.req)
        self.assertTrue(all(x['hours_status']=='missing_date_hours' for x in r['primary_places']))
if __name__=='__main__':unittest.main()
