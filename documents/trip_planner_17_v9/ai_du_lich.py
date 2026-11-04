"""Huấn luyện thử nghiệm AI gợi ý. Toàn bộ nhãn train được tạo bằng quy tắc giả lập."""
import argparse,csv,json,random,math
from pathlib import Path
from sklearn.ensemble import RandomForestClassifier
from sklearn.metrics import accuracy_score,classification_report
from sklearn.model_selection import GroupShuffleSplit
import joblib

ROOT=Path(__file__).resolve().parent
FEATURES=['do_khop_so_thich','biet_gia','gia_nhom_chia_ngan_sach','biet_thoi_gian','tong_phut_chia_thoi_gian','biet_quang_duong','khoang_cach_km']

def training_data(seed=42,n_profiles=600):
 r=random.Random(seed); rows=[];labels=[];groups=[]
 # Các cặp trong cùng một tình huống nằm cùng nhóm khi chia train/test.
 for group in range(n_profiles):
  budget=r.choice([500000,1000000,2000000,3000000]);people=r.choice([1,2,3,4]);available=r.choice([120,240,480,720]);
  for _ in range(12):
   match=r.choice([0,0.25,0.5,0.75,1.0]);price_known=r.random()<0.8;price=r.randint(20000,500000)*people if price_known else None
   time_known=r.random()<0.8;minutes=r.randint(40,600) if time_known else None;distance_known=r.random()<0.8;distance=r.randint(1,100) if distance_known else None
   # Đây là quy tắc của nhóm để sinh nhãn, không phải nhận xét của khách thật.
   label=int(match>=0.5 and (not price_known or price<=0.5*budget) and (not time_known or minutes<=available) and (not distance_known or distance<=50))
   rows.append([match,int(price_known),price/budget if price_known else 0,int(time_known),minutes/available if time_known else 0,int(distance_known),distance if distance_known else 0]);labels.append(label);groups.append(group)
 return rows,labels,groups

def train():
 x,y,g=training_data(); split=GroupShuffleSplit(n_splits=1,test_size=0.2,random_state=42); tr,te=next(split.split(x,y,groups=g))
 model=RandomForestClassifier(n_estimators=150,max_depth=12,min_samples_leaf=3,random_state=42,n_jobs=-1)
 model.fit([x[i] for i in tr],[y[i] for i in tr]);pred=model.predict([x[i] for i in te]);accuracy=accuracy_score([y[i] for i in te],pred)
 joblib.dump({'model':model,'features':FEATURES,'note':'Huấn luyện trên tình huống và nhãn giả lập, không phải người dùng thật','sklearn_version':__import__('sklearn').__version__},ROOT/'model_goi_y.pkl')
 with (ROOT/'du_lieu_gia_lap.csv').open('w',encoding='utf-8-sig',newline='') as f:
  writer=csv.writer(f);writer.writerow(['profile_id',*FEATURES,'phu_hop']);writer.writerows([[g[i],*x[i],y[i]] for i in range(len(x))])
 report={'so_mau':len(x),'so_tinh_huong':len(set(g)),'so_mau_train':len(tr),'so_mau_test':len(te),'accuracy_test_gia_lap':round(float(accuracy),4),'bao_cao':classification_report([y[i] for i in te],pred,output_dict=True,zero_division=0),'canh_bao':'Kết quả chỉ đo độ tái hiện quy tắc gắn nhãn giả lập, không chứng minh hiệu quả với khách thật.'}
 (ROOT/'ket_qua_train.json').write_text(json.dumps(report,ensure_ascii=False,indent=2),encoding='utf-8')
 print('Đã huấn luyện:',len(tr),'mẫu train;',len(te),'mẫu test. Accuracy dữ liệu giả lập:',round(accuracy,4))
 print('Đã tạo model_goi_y.pkl, du_lieu_gia_lap.csv và ket_qua_train.json')

def vector(request,place):
 interests=set(s.strip().casefold() for s in request['so_thich'] if s.strip());tags=set(s.strip().casefold() for s in place['nhan'] if s.strip());
 match=len(interests&tags)/len(interests) if interests else 0
 budget=float(request['ngan_sach_vnd']);people=int(request['so_nguoi']);available=float(request['thoi_gian_con_lai_phut'])
 if budget<=0 or people<=0 or available<=0:raise ValueError('Ngân sách, số người và thời gian phải lớn hơn 0.')
 # Giá quy định là theo người, tổng thời gian gồm đường đi và hoạt động.
 price=place.get('gia_moi_nguoi_vnd');minutes=place.get('tong_thoi_gian_phut');distance=place.get('khoang_cach_duong_km')
 for value in (price,minutes,distance):
  if value is not None and float(value)<0:raise ValueError('Giá, thời gian và khoảng cách phải không âm.')
 return [match,int(price is not None),float(price)*people/budget if price is not None else 0,int(minutes is not None),float(minutes)/available if minutes is not None else 0,int(distance is not None),float(distance) if distance is not None else 0]

def rank(req,places,model):
 result=[]
 for place in places:
  features=vector(req,place); score=float(model.predict_proba([features])[0][1]);missing=[]
  for k,name in [('gia_moi_nguoi_vnd','giá'),('tong_thoi_gian_phut','thời gian'),('khoang_cach_duong_km','khoảng cách đường bộ')]:
   if place.get(k) is None:missing.append(name)
  over=(place.get('gia_moi_nguoi_vnd') is not None and place['gia_moi_nguoi_vnd']*int(req['so_nguoi'])>req['ngan_sach_vnd'])
  overtime=(place.get('tong_thoi_gian_phut') is not None and place['tong_thoi_gian_phut']>req['thoi_gian_con_lai_phut'])
  result.append({'ten':place['ten'],'diem_mo_hinh_gia_lap':round(score,4),'do_khop_so_thich':features[0],'thieu_thong_tin':missing,'vuot_ngan_sach_mot_diem':over,'vuot_thoi_gian':overtime,'du_dieu_kien_da_biet':not (over or overtime),'can_xac_minh':bool(missing)})
 return sorted(result,key=lambda z:(z['du_dieu_kien_da_biet'],z['diem_mo_hinh_gia_lap']),reverse=True)

def main():
 ap=argparse.ArgumentParser();ap.add_argument('action',choices=['train','goi-y']);ap.add_argument('--input',default=str(ROOT/'yeu_cau_mau.json'));a=ap.parse_args()
 if a.action=='train':return train()
 f=ROOT/'model_goi_y.pkl'
 if not f.exists():raise SystemExit('Chưa có mô hình. Hãy chạy: python ai_du_lich.py train')
 req=json.loads(Path(a.input).read_text(encoding='utf-8'));places=json.loads((ROOT/'dia_diem_nhan.json').read_text(encoding='utf-8'));res=rank(req,places,joblib.load(f)['model']);(ROOT/'ket_qua_goi_y.json').write_text(json.dumps(res,ensure_ascii=False,indent=2),encoding='utf-8')
 for x in res[:10]: print(f"{x['ten']}: {x['diem_mo_hinh_gia_lap']:.3f}; thiếu: {', '.join(x['thieu_thong_tin']) or 'không'}")
 print('Đã lưu ket_qua_goi_y.json. Điểm là mô hình học từ dữ liệu giả lập.')
if __name__=='__main__':main()
