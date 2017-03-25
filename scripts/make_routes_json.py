#!/usr/bin/env python
import os
import sys
import json

BUS_ROUTES_FILE = '/usr/src/backend/routes.txt'

result = []

with open(BUS_ROUTES_FILE, 'r') as fp:
    for line in fp:
        route_num = line.strip()
        result.append(route_num)

json.dump(result, sys.stdout)
