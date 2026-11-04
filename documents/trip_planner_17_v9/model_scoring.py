"""Optional bundled synthetic model; no claim of real-user validation."""
from pathlib import Path

def build_scorer(request):
    enabled=request.get('use_model',False)
    if not isinstance(enabled,bool):raise ValueError('use_model phải là true hoặc false')
    if not enabled:return None
    import joblib
    from ai_du_lich import vector
    from costs import estimate
    model=joblib.load(Path(__file__).resolve().parent/'model_goi_y.pkl')['model']
    def score(place,interests,people,budget,total_minutes,available_minutes,distance_km):
        amount=estimate(place,people,minutes=place.get('visit_duration_minutes',90))
        req={'so_thich':interests,'ngan_sach_vnd':budget,'so_nguoi':people,'thoi_gian_con_lai_phut':available_minutes}
        item={'nhan':place.get('tags',[]),'gia_moi_nguoi_vnd':amount/people if amount is not None else None,'tong_thoi_gian_phut':total_minutes,'khoang_cach_duong_km':distance_km}
        return float(model.predict_proba([vector(req,item)])[0][1])
    return score
