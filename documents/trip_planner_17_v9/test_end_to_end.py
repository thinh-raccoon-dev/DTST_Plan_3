"""HTTP wiring and CLI smoke tests against a clearly simulated Valhalla endpoint."""
import json,subprocess,sys,tempfile,threading,unittest
from pathlib import Path
from http.server import BaseHTTPRequestHandler,ThreadingHTTPServer
from urllib.request import Request,urlopen
from urllib.error import HTTPError
import web_api

class MockValhalla(BaseHTTPRequestHandler):
 def log_message(self,*args):pass
 def do_POST(self):
  payload=json.loads(self.rfile.read(int(self.headers['Content-Length'])))
  assert payload['costing'] in ['auto','motorcycle']
  data=json.dumps({'trip':{'summary':{'length':3,'time':600}}}).encode()
  self.send_response(200);self.send_header('Content-Type','application/json');self.end_headers();self.wfile.write(data)

class EndToEndTests(unittest.TestCase):
 @classmethod
 def setUpClass(cls):
  cls.router=ThreadingHTTPServer(('127.0.0.1',0),MockValhalla)
  cls.thread=threading.Thread(target=cls.router.serve_forever,daemon=True);cls.thread.start()
  cls.url=f'http://127.0.0.1:{cls.router.server_port}'
 @classmethod
 def tearDownClass(cls):cls.router.shutdown();cls.router.server_close()
 def test_cli_manual_and_readable_file(self):
  root=Path(__file__).resolve().parent
  with tempfile.TemporaryDirectory() as tmp:
   out=Path(tmp)/'result.json'
   proc=subprocess.run([sys.executable,str(root/'recommend.py'),'--request',str(root/'request_manual.json'),'--output',str(out),'--valhalla-url',self.url],capture_output=True,text=True,encoding='utf-8',timeout=45)
   self.assertEqual(proc.returncode,0,proc.stderr)
   result=json.loads(out.read_text(encoding='utf-8'));self.assertIn('itinerary',result)
   self.assertTrue(out.with_suffix('.txt').exists());self.assertIn('NGÀY 1',out.with_suffix('.txt').read_text(encoding='utf-8-sig'))
 def test_http_api_and_bundled_ai_model(self):
  server=ThreadingHTTPServer(('127.0.0.1',0),web_api.Handler);server.valhalla_url=self.url
  worker=threading.Thread(target=server.serve_forever,daemon=True);worker.start();base=f'http://127.0.0.1:{server.server_port}'
  try:
   with urlopen(base+'/places') as response:
    places=json.load(response)['places'];self.assertEqual(len(places),17)
    self.assertTrue(next(p for p in places if p['id']=='new_015')['activities_available'])
   req=json.loads((Path(__file__).parent/'request_ai.json').read_text(encoding='utf-8'))
   with urlopen(Request(base+'/itinerary',data=json.dumps(req).encode(),headers={'Content-Type':'application/json'}),timeout=45) as response:
    result=json.load(response);self.assertEqual(len(result['itinerary']['days']),2);self.assertIn('NGÀY 1',result['readable_itinerary'])
    self.assertTrue(result['itinerary']['scheduled_primary_ids'])
   with self.assertRaises(HTTPError) as ctx:
    urlopen(Request(base+'/itinerary',data=b'{"mode":"manual"}',headers={'Content-Type':'application/json'}))
   self.assertEqual(ctx.exception.code,400)
  finally:server.shutdown();server.server_close()

if __name__=='__main__':unittest.main()
