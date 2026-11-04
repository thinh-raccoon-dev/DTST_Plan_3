"""Local development API for Node.js backend integration."""
import argparse,json
from http.server import BaseHTTPRequestHandler,ThreadingHTTPServer
from ranking import rating_info
from load_data import load_data
from model_scoring import build_scorer
from recommendation import ROLES
from trip_service import plan_trip,readable
from routing import ValhallaClient
from progress import replan

class Handler(BaseHTTPRequestHandler):
    def reply(self,status,obj):
        raw=json.dumps(obj,ensure_ascii=False).encode('utf-8')
        self.send_response(status);self.send_header('Content-Type','application/json; charset=utf-8');self.send_header('Content-Length',str(len(raw)));self.end_headers();self.wfile.write(raw)
    def do_GET(self):
        if self.path=='/health':return self.reply(200,{'status':'ok','routing_status':'not_checked'})
        if self.path=='/places':
            rows=load_data()
            all_places=sorted(rows['attractions']+rows['accommodations'],key=lambda item:item['_id'])
            return self.reply(200,{'places':[{**rating_info(p),'id':p['_id'],'name':p['name'],'role':ROLES.get(p['_id']),'tags':p.get('tags',[]),'activities_available':p.get('activities_available',[]),'address':(p.get('source_record') or {}).get('address'),'coordinates':(p.get('location') or {}).get('coordinates'),'visit_duration_minutes':p.get('visit_duration_minutes'),'phone':(p.get('source_record') or {}).get('phone') or next((x.get('phone') for x in (p.get('tourism_details') or {}).get('contacts_from_new_sources',[]) if x.get('phone')),None)} for p in all_places]})
        self.reply(404,{'error':'Không có endpoint này'})
    def do_POST(self):
        if self.path not in ('/recommend','/itinerary','/itineraries/replan'):return self.reply(404,{'error':'Không có endpoint này'})
        try:
            n=int(self.headers.get('Content-Length','0'))
            if n<1 or n>1048576:return self.reply(413,{'error':'JSON body phải từ 1 đến 1048576 bytes'})
            req=json.loads(self.rfile.read(n))
            if not isinstance(req,dict):raise ValueError('Yêu cầu phải là JSON object')
            if self.path=='/itineraries/replan':
                config=req['itinerary']['input']
                return self.reply(200,replan(load_data(),ValhallaClient(self.server.valhalla_url,config.get('mode_of_transport','car')),req))
            if self.path=='/itinerary':req['assemble_itinerary']=True
            result=plan_trip(load_data(),ValhallaClient(self.server.valhalla_url,req.get('mode_of_transport','car')),req,scorer=build_scorer(req) if req.get('mode','ai')=='ai' else None)
            result['readable_itinerary']=readable(result)
            self.reply(200,result)
        except (ValueError,TypeError,KeyError,AttributeError) as e:self.reply(400,{'error':str(e)})
        except OSError:self.reply(503,{'error':'Không đọc được dữ liệu hoặc dịch vụ phụ thuộc'})

if __name__=='__main__':
    import math,socket,threading
    p=argparse.ArgumentParser();p.add_argument('--port',type=int,default=8010);p.add_argument('--valhalla-url',default='http://localhost:8002');a=p.parse_args()
    def is_port_open(host,port):
        with socket.socket(socket.AF_INET,socket.SOCK_STREAM) as s:
            s.settimeout(0.5)
            return s.connect_ex((host,port))==0
    if not is_port_open('127.0.0.1',8002):
        class LocalValhallaFallback(BaseHTTPRequestHandler):
            def log_message(self,*args):pass
            def do_POST(self):
                n=int(self.headers.get('Content-Length','0'))
                payload=json.loads(self.rfile.read(n)) if n>0 else {}
                locs=payload.get('locations') or []
                if len(locs)>=2:
                    lat1,lon1=math.radians(float(locs[0]['lat'])),math.radians(float(locs[0]['lon']))
                    lat2,lon2=math.radians(float(locs[1]['lat'])),math.radians(float(locs[1]['lon']))
                    h=math.sin((lat2-lat1)/2)**2+math.cos(lat1)*math.cos(lat2)*math.sin((lon2-lon1)/2)**2
                    straight_km=6371*2*math.asin(math.sqrt(min(1.0,h)))
                    road_km=round(max(0.2,straight_km*1.25),3)
                    speed_kmh=36.0 if payload.get('costing')=='auto' else 32.0
                    seconds=round(max(60.0,(road_km/speed_kmh)*3600.0),1)
                else:
                    road_km,seconds=3.0,600.0
                raw=json.dumps({'trip':{'summary':{'length':road_km,'time':seconds}}}).encode('utf-8')
                self.send_response(200);self.send_header('Content-Type','application/json');self.send_header('Content-Length',str(len(raw)));self.end_headers();self.wfile.write(raw)
        valhalla_sim=ThreadingHTTPServer(('127.0.0.1',8002),LocalValhallaFallback)
        threading.Thread(target=valhalla_sim.serve_forever,daemon=True).start()
        print('Valhalla Docker (:8002) chưa bật -> Đã tự động chạy bộ định tuyến giả lập trên http://127.0.0.1:8002')
    server=ThreadingHTTPServer(('127.0.0.1',a.port),Handler);server.valhalla_url=a.valhalla_url
    print(f'Local development API: http://127.0.0.1:{a.port}; GET /places; POST /recommend')
    server.serve_forever()
