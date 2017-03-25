#!/usr/bin/env python
"""
Combine all bus stops per route into single lookup object
for the geolocation feature.
"""
import sys
import json
import os.path

from collections import defaultdict


BUS_STOPS_DIR = '/usr/src/frontend/static/stops'
BUS_ROUTES_FILE = '/usr/src/backend/routes.txt'


def get_bus_routes():
    with open(BUS_ROUTES_FILE, 'r') as fp:
        for line in fp:
            route_num = line.strip()
            yield route_num


def get_stops(route_num):
    stops_path = os.path.join(BUS_STOPS_DIR, f'{route_num}.json')
    with open(stops_path, 'r') as fp:
        stops = json.load(fp)
        for stop in stops:
            lat = stop['lat']
            lng = stop['lng']
            yield (lat, lng)


def main():
    result = defaultdict(list)
    for route_num in get_bus_routes():
        for stop in get_stops(route_num):
            result[route_num].append(stop)
    json.dump(result, sys.stdout)


if __name__ == '__main__':
    main()
