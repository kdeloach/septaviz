#!/usr/bin/env python
import os
import sys
import json

SCRIPTS_DIR = '/usr/src/scripts'
BUS_ROUTES_FILE = os.path.join(SCRIPTS_DIR, 'routes.txt')

result = []

with open(BUS_ROUTES_FILE, 'r') as fp:
    for line in fp:
        route_num = line.strip()
        result.append(route_num)

json.dump(result, sys.stdout)
