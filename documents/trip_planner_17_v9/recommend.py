"""CLI entry point for the new web selection flow."""
import argparse,json,sys
from pathlib import Path
from load_data import load_data
from model_scoring import build_scorer
from routing import ValhallaClient
from trip_service import plan_trip,readable

if hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8', errors='replace')

def main():
    p=argparse.ArgumentParser()
    p.add_argument('--request',type=Path,required=True)
    p.add_argument('--output',type=Path,default=Path('recommendations.json'))
    p.add_argument('--recommendations-only',action='store_true')
    p.add_argument('--valhalla-url',default='http://localhost:8002')
    a=p.parse_args()
    try:
        request=json.loads(a.request.read_text(encoding='utf-8-sig'))
        if not isinstance(request,dict):raise ValueError('Yêu cầu phải là JSON object')
        if a.recommendations_only:request['assemble_itinerary']=False
        r=plan_trip(load_data(),ValhallaClient(a.valhalla_url,request.get('mode_of_transport','car')),request,scorer=build_scorer(request) if request.get('mode','ai')=='ai' else None)
    except (OSError,ValueError,TypeError) as e:p.exit(1,'Lỗi: '+str(e)+'\n')
    a.output.parent.mkdir(parents=True,exist_ok=True)
    a.output.write_text(json.dumps(r,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
    text_path=a.output.with_suffix('.txt')
    text_path.write_text(readable(r),encoding='utf-8-sig')
    print(readable(r))
    print('Đã lưu bản dễ đọc:',text_path.resolve())
    print('Đã lưu JSON:',a.output.resolve())
    for x in r['primary_places']:print(x['id']+' | '+x['name'])
    print('Lịch dự kiến; liên hệ số điện thoại trong kết quả để xác nhận dịch vụ.')
if __name__=='__main__':main()
