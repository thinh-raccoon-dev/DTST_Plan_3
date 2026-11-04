"""Nearby road-time tiers, then Google ratings from the saved source snapshot."""
import math

TIER_MINUTES=5
PRIOR_RATING=3.8
PRIOR_COUNT=50

def rating_info(place):
    source=place.get('source_record') or {}
    raw=source.get('rating')
    count=source.get('review_count')
    valid_rating=isinstance(raw,(int,float)) and not isinstance(raw,bool) and math.isfinite(raw) and 1<=raw<=5
    valid_count=isinstance(count,(int,float)) and not isinstance(count,bool) and math.isfinite(count) and count>=0 and int(count)==count
    rating=float(raw) if valid_rating else None
    reviews=int(count) if valid_count else None
    n=reviews if reviews is not None else 0
    adjusted=(n*rating+PRIOR_COUNT*PRIOR_RATING)/(n+PRIOR_COUNT) if rating is not None else None
    return {'google_rating':rating,'google_review_count':reviews,
            'rating_adjusted_for_review_count':round(adjusted,6) if adjusted is not None else None,
            'rating_status':'source_snapshot' if rating is not None else 'missing',
            'rating_source_date':(place.get('provenance') or {}).get('source_date') or source.get('data_date')}

def ranking_key(place,minutes,interest_matches=0,model_score=None):
    rating=rating_info(place)
    # Road-time tier is always dominant. Within a tier, adjusted rating wins.
    return (math.floor(minutes/TIER_MINUTES),rating['google_rating'] is None,
            -(rating['rating_adjusted_for_review_count'] or 0), minutes,
            -interest_matches,-(model_score or 0),place['_id'])

def explanation(place,route):
    rating=rating_info(place)
    minutes=route['duration_minutes'];tier=math.floor(minutes/TIER_MINUTES)
    return {'policy':'nearby_road_time_tier_then_rating',
            'road_time_tier_minutes':[tier*TIER_MINUTES,(tier+1)*TIER_MINUTES],
            'tier_upper_bound_exclusive':True,
            'note':'Ưu tiên nhóm gần hơn; trong cùng nhóm 5 phút, ưu tiên điểm sao điều chỉnh theo số lượt đánh giá.',
            **rating}

POLICY={'name':'nearby_road_time_tier_then_rating','tier_minutes':TIER_MINUTES,
        'rating_prior':PRIOR_RATING,'rating_prior_review_count':PRIOR_COUNT,
        'adjusted_rating_formula':'(review_count * google_rating + 50 * 3.8) / (review_count + 50)',
        'order':['road_time_tier','rating_available','adjusted_rating_desc','road_time_minutes','interest_matches_desc','optional_model_score_desc','id'],
        'note':'Điểm điều chỉnh là quy tắc của ứng dụng, không phải điểm Google mới hoặc mô hình vừa huấn luyện. Giá trị thiếu được giữ null.'}
