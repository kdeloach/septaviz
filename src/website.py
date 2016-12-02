#!/usr/bin/env python
# -*- coding: utf-8 -*-
import json
import itertools
from datetime import datetime

from flask import Flask, render_template

from .collect import conn


app = Flask(__name__)


@app.route('/')
def hello_world():
    return 'Hello, World!'


@app.route('/<route_num>')
def bus_route(route_num):
    def by_vehicle_id(row):
        return row['vehicle_id']

    def group_results(rows):
        result = {}
        grouped_rows = itertools.groupby(rows, by_vehicle_id)
        for vehicle_id, records in grouped_rows:
            result[vehicle_id] = list(records)
        return result

    rows = conn.execute("""
        SELECT * FROM fact
        WHERE route_num=CASE :route_num WHEN 'all' THEN route_num ELSE :route_num END
        AND CAST((julianday('now') - julianday(created_at)) * 24 AS INT) < 1
        ORDER BY vehicle_id, created_at DESC
    """, { 'route_num': route_num })
    rows = [dict((k, row[k]) for k in row.keys()) for row in rows]

    vehicle_trips = group_results(rows)
    vehicle_trips = json.dumps(vehicle_trips)

    return render_template('index.html', vehicle_trips=vehicle_trips)
