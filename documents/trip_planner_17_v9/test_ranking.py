import unittest
from ranking import ranking_key,rating_info
from load_data import load_data
from recommendation import recommend
from test_recommendation import Routes

def item(ident,rating,count):
    return {'_id':ident,'source_record':{'rating':rating,'review_count':count,'data_date':'2026-10-28'}}

class RankingTests(unittest.TestCase):
    def test_close_tier_wins(self):
        self.assertLess(ranking_key(item('a',3.5,100),9),ranking_key(item('b',5,1000),21))
    def test_stars_win_inside_tier(self):
        self.assertLess(ranking_key(item('a',4.8,100),14),ranking_key(item('b',4,100),11))
    def test_review_count_stabilizes_small_sample(self):
        self.assertLess(ranking_key(item('a',4.3,5261),12),ranking_key(item('b',4.5,14),12))
    def test_missing_rating_is_not_fabricated(self):
        info=rating_info(item('a',None,None));self.assertIsNone(info['google_rating']);self.assertIsNone(info['google_review_count'])
        self.assertLess(ranking_key(item('a',4,100),12),ranking_key(item('b',None,None),12))
    def test_unknown_nearby_not_banned_for_far_rated(self):
        self.assertLess(ranking_key(item('a',None,None),4),ranking_key(item('b',5,1000),20))
    def test_invalid_source_values(self):
        for r,n in [(float('nan'),-1),(True,True),(8,3)]:
            x=rating_info(item('a',r,n));self.assertIsNone(x['google_rating'])
    def test_api_fields_manual_and_related_order(self):
        d=load_data();r=recommend(d,Routes(),{'mode':'manual','selected_ids':['new_014'],'days':2})
        self.assertEqual(r['primary_places'][0]['google_rating'],4.3)
        hotels=r['related_by_primary'][0]['suggestions']['accommodation']
        self.assertGreaterEqual(hotels[0]['rating_adjusted_for_review_count'],hotels[1]['rating_adjusted_for_review_count'])
        self.assertIn('ranking_reason',hotels[0]);self.assertEqual(r['primary_places'][0]['id'],'new_014')
    def test_ai_priority_changes_from_interests(self):
        d=load_data()
        r=recommend(d,Routes(),{'mode':'ai','goal':'sightseeing','start_id':'new_001','primary_limit':1,'interests':['du lịch sinh thái']})
        # Matching interests precede rating for attractions.
        self.assertEqual(r['primary_places'][0]['id'],'new_015')
        self.assertIn('route_from_previous',r['primary_places'][0])
if __name__=='__main__':unittest.main()
