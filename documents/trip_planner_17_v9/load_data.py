"""Read the 17 source records without discarding raw details."""
import json,re
from copy import deepcopy
from pathlib import Path
from dictionary_17_dia_diem import places

def observed_duration(text):
    if not text:return None
    text=text.replace(',','.')
    pairs=re.findall(r'(\d+(?:\.\d+)?)\s*(phút|giờ)',text)
    values=[float(n)*(60 if u=='giờ' else 1) for n,u in pairs]
    return int(max(values)) if values else None

def load_data(root=None):
    root=Path(root) if root else Path(__file__).resolve().parent
    labels=json.loads((root/'dia_diem_nhan.json').read_text(encoding='utf-8'))
    by_name={x['ten']:x for x in labels}
    overrides=json.loads((root/'planning_overrides.json').read_text(encoding='utf-8'))
    enrichment={x['id']:x for x in json.loads((root/'tourism_places_enriched.json').read_text(encoding='utf-8'))['places']}
    result={'attractions':[],'accommodations':[],'rooms':[],
            'activity_sources':json.loads((root/'activity_sources.json').read_text(encoding='utf-8'))}
    for i,p in enumerate(places):
        ident=f'new_{i+1:03d}'; extra=overrides[ident];hotel=2<=i<=6
        schedule={}
        for h in p.get('hours_by_date',[]):
            if len(h.get('date') or [])!=3:continue
            key='%04d-%02d-%02d'%tuple(h['date']);spans=[]
            for value in h.get('hours') or []:
                if value=='Mở cửa cả ngày':spans.append({'open':'00:00','close':'24:00'});continue
                if '–' in value:
                    a,b=value.split('–',1)
                    spans.append({'open':a,'close':'24:00' if b=='00:00' and a!='00:00' else b})
            schedule[key]=spans
        duration=extra.get('visit_duration_minutes') or observed_duration(p.get('visit_duration_text')) or 90
        status='user_input' if extra.get('visit_duration_minutes') else ('observed_upper_bound_unconfirmed' if p.get('visit_duration_text') else 'assumed_90_minutes')
        row={'_id':ident,'name':p['name'],'location':{'type':'Point','coordinates':[p['longitude'],p['latitude']]},
             'tags':by_name[p['name']]['nhan'],'opening_hours':{'date_schedule':schedule},'visit_duration_minutes':duration,
             'cost':dict(extra['cost'],raw_text=p.get('price_text')),'quality_flags':[],
             'provenance':{'detail_url':p.get('google_maps_url'),'source_date':p.get('data_date')},
             'duration_status':status,'record_type':'accommodation' if hotel else ('restaurant' if i<2 else 'candidate'),
             'source_record':deepcopy(p)}
        detail=enrichment.get(ident)
        if detail:
            row['tourism_details']=deepcopy(detail)
            row['activities_available']=deepcopy(detail.get('activities',[]))
            row['tags']=list(dict.fromkeys(row['tags']+detail.get('planning_tags_inferred',[])))
            observed=(detail.get('visit_duration_from_new_sources_minutes') or {}).get('value')
            if observed and not extra.get('visit_duration_minutes') and not p.get('visit_duration_text'):
                row['visit_duration_minutes']=observed
                row['duration_status']='tourism_portal_suggestion_unconfirmed'
        if extra.get('weekday_schedule') is not None:row['opening_hours']={'weekday_schedule':extra['weekday_schedule']}
        result['accommodations' if hotel else 'attractions'].append(row)
    return result
