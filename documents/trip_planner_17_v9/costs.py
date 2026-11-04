"""Explicit upper-bound estimates. Unknown is never free."""
import math

def nonnegative(x):
    return isinstance(x,(int,float)) and not isinstance(x,bool) and math.isfinite(x) and x>=0

def estimate(place, people, minutes=0, nights=0):
    c=place.get('cost') or {}
    value=c.get('confirmed_max_vnd')
    if not nonnegative(value) or c.get('currency')!='VND' or not c.get('verified_at'):
        return None
    unit=c.get('unit')
    capacity=c.get('capacity')
    if unit=='person_per_visit': factor=people
    elif unit=='group_per_visit':
        if not nonnegative(capacity) or capacity<1:return None
        factor=math.ceil(people/capacity)
    elif unit=='person_per_hour':factor=people*math.ceil(minutes/60)
    elif unit=='room_per_hour':
        if not nonnegative(capacity) or capacity<1:return None
        factor=math.ceil(people/capacity)*math.ceil(minutes/60)
    elif unit=='room_per_night':
        if not nonnegative(capacity) or capacity<1:return None
        factor=math.ceil(people/capacity)*nights
    else:return None
    return value*factor

def transport_cost(km, config):
    config=config or {}
    rate=config.get('vnd_per_km')
    if not nonnegative(rate):return None
    return km*rate
