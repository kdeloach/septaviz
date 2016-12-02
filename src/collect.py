#!/usr/bin/env python
# -*- coding: utf-8 -*-
import os
import os.path
import json
import urllib
import time
import logging
import sqlite3

from datetime import datetime, timedelta

import pytz
import dateutil.parser


EST = pytz.timezone('US/Eastern')

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DATA_DIR = os.path.join(BASE_DIR, 'data')
DB_FILE = os.path.join(DATA_DIR, 'db.sqlite3')

log = logging.getLogger(__name__)
log.setLevel(logging.DEBUG)

conn = sqlite3.connect(DB_FILE)
conn.row_factory = sqlite3.Row


class Download(object):
    def __init__(self):
        self.last_executed = datetime.min

    def run(self):
        now = datetime.utcnow()

        delta = datetime.utcnow() - self.last_executed
        if delta < timedelta(seconds=60):
            return

        filename = os.path.join(DATA_DIR, '{:%Y%m%d_%H%M}.json'.format(now))

        log.info('Downloading %s...', filename)
        url = 'http://www3.septa.org/hackathon/TransitViewAll'
        response = urllib.urlopen(url)
        data = response.read()

        with open(filename, 'w') as fp:
            fp.write(data)

        self.last_executed = now


class Insert(object):
    def __init__(self, conn):
        self.conn = conn

    def run(self):
        files = list(self.get_data_files())
        imported_files = self.select_imported_files()
        new_files = [path for path in files if path not in imported_files]

        for path in new_files:
            self.insert_file(path)

    def parse_records(self, path):
        with open(path, 'r') as fp:
            data = json.load(fp)
            for recorded_date, routes in data.iteritems():
                created_at_utc = dateutil.parser.parse(recorded_date) \
                    .replace(tzinfo=EST) \
                    .astimezone(pytz.utc)
                for route in routes:
                    for route_num, facts in route.iteritems():
                        for fact in facts:
                            yield (created_at_utc,
                                   route_num,
                                   fact['BlockID'],
                                   fact['VehicleID'],
                                   fact['label'],
                                   fact['Direction'],
                                   fact['destination'],
                                   fact['Offset_sec'],
                                   fact['lat'],
                                   fact['lng'])

    def insert_file(self, path):
        log.info('Inserting %s', path)
        with self.conn:
            records = self.parse_records(path)
            self.conn.executemany("""
                INSERT INTO fact (created_at, route_num, block_id, vehicle_id,
                    label, direction, destination, offset_sec, lat, lng)
                VALUES(?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """, records)
            self.conn.execute('INSERT INTO imported_file (path) VALUES(?)',
                              (path,))

    def get_data_files(self):
        result = []
        for path in os.listdir(DATA_DIR):
            if path.endswith('.json'):
                result.append(os.path.join(DATA_DIR, path))
        return result

    def select_imported_files(self):
        rows = self.conn.execute('SELECT path FROM imported_file')
        return [path for (path,) in rows]


class Test(object):
    def __init__(self, conn):
        self.conn = conn
        self.alive = True

    def run(self):
        if not self.alive:
            return

        rows = self.conn.execute('select * from fact')
        for row in rows:
            print(row)

        self.alive = False


def init_db():
    conn.execute("""
        CREATE TABLE IF NOT EXISTS imported_file (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            path TEXT UNIQUE NOT NULL
        )
    """)
    conn.execute("""
        CREATE TABLE IF NOT EXISTS fact (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            created_at TEXT NOT NULL,
            route_num TEXT NOT NULL,
            block_id INT NOT NULL,
            vehicle_id INT NOT NULL,
            label TEXT NOT NULL,
            direction TEXT,
            destination TEXT,
            offset_sec INT NOT NULL,
            lat NUMERIC NOT NULL,
            lng NUMERIC NOT NULL
        )
    """)


def run(workers):
    while True:
        log.info('Heartbeat')
        for worker in workers:
            worker.run()
        time.sleep(1)


def main():
    ch = logging.StreamHandler()
    ch.setLevel(logging.DEBUG)
    ch.setFormatter(logging.Formatter('%(asctime)s %(levelname)s %(message)s'))
    log.addHandler(ch)

    init_db()

    workers = [
        Insert(conn),
        # Test(conn),
        Download(),
    ]

    run(workers)


if __name__ == '__main__':
    main()
