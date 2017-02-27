# -*- coding: utf-8 -*-
from __future__ import print_function
from __future__ import unicode_literals
from __future__ import division

import os.path
import logging
import dateutil.parser
from time import sleep
from subprocess import call
from datetime import timedelta

import pytz
import requests
from django.db import transaction
from django.db.models import Max
from django.utils import timezone
from django.core.management import BaseCommand

import home.utils as utils
from home.models import Location, LocationStat
from septaviz.settings import BUS_ROUTES, COMMON_STATIC_ROOT


log = logging.getLogger(__name__)

EST = pytz.timezone('US/Eastern')


class UpdateBusLocations(object):
    """
    Download and insert the latest bus locations at an interval.
    """
    def __init__(self):
        self.last_ran_at = None

    def should_run(self):
        return not self.last_ran_at \
                or self.last_ran_at <= timezone.now() - timedelta(minutes=1)

    def run(self):
        if not self.should_run():
            return

        data = self.download_bus_locations()

        if data:
            locations = list(self.parse_bus_locations(data))
            to_add = list(self.filter_bus_locations(locations))

            with transaction.atomic():
                Location.objects.bulk_create(to_add)
                log.info('Inserted {} records'.format(len(to_add)))

        self.last_ran_at = timezone.now()

    def filter_bus_locations(self, locations):
        """
        Return locations that are significantly different from
        existing locations.
        """
        latest_ids = Location.objects.values('vehicle_id') \
            .annotate(id=Max('id'))
        latest_ids = [row['id'] for row in latest_ids]

        latest_models = Location.objects.filter(id__in=latest_ids) \
            .values_list('vehicle_id', 'lat', 'lng')

        lookup = {vehicle_id: (lat, lng)
                  for vehicle_id, lat, lng in latest_models}

        for loc in locations:
            latlng = lookup.get(loc.vehicle_id)
            if not latlng:
                # If no record yet exists for this vehicle.
                yield loc
            elif latlng != (loc.lat, loc.lng):
                # If a record exists but the coordinates are outdated.
                yield loc

    def download_bus_locations(self):
        log.info('Downloading bus locations...')
        url = 'http://www3.septa.org/hackathon/TransitViewAll'
        response = requests.get(url)
        try:
            return response.json()
        except ValueError:
            log.debug(response.text)
            log.exception('ERROR downloading bus locations')
            return None

    def parse_bus_locations(self, data):
        """
        Transform SEPTA API response into Location records.
        """
        created_at_utc = timezone.now()
        for reported_at_est, routes in data.iteritems():
            reported_at_utc = dateutil.parser.parse(reported_at_est) \
                    .replace(tzinfo=EST).astimezone(pytz.utc)
            for route in routes:
                for route_num, locations in route.iteritems():
                    for location in locations:
                        offset_sec = location['Offset_sec']
                        offset_reported_at_utc = reported_at_utc - \
                            timedelta(seconds=offset_sec)
                        loc = Location()
                        loc.route_num = route_num
                        loc.created_at_utc = created_at_utc
                        loc.reported_at_utc = offset_reported_at_utc
                        loc.block_id = location['BlockID']
                        loc.vehicle_id = location['VehicleID']
                        loc.direction = location['Direction']
                        loc.destination = location['destination'] or ''
                        loc.lat = location['lat']
                        loc.lng = location['lng']
                        yield loc


class UpdateRouteTrace(object):
    """
    Download route trace GeoJSON for each route.
    """
    def __init__(self):
        self.last_ran_at = None

    def should_run(self):
        return not self.last_ran_at \
                or self.last_ran_at <= timezone.now() - timedelta(days=1)

    def run(self):
        if not self.should_run():
            return

        log.info('Updating route trace files')

        for route_num in BUS_ROUTES:
            if not self.route_trace_exists(route_num):
                self.download_kml(route_num)
                self.convert_kml(route_num)

        self.last_ran_at = timezone.now()

    def get_kml_path(self, route_num):
        return os.path.join(COMMON_STATIC_ROOT, route_num + '.kml')

    def get_json_path(self, route_num):
        return os.path.join(COMMON_STATIC_ROOT, route_num + '.json')

    def route_trace_exists(self, route_num):
        path = self.get_json_path(route_num)
        return os.path.exists(path)

    def download_kml(self, route_num):
        log.info('Downloading route trace {}...'.format(route_num))
        url = 'http://www3.septa.org/transitview/kml/{}.kml'.format(route_num)
        response = requests.get(url)

        if not response.ok:
            log.info('ERROR: Could not download route trace "{}"'
                     .format(route_num))
            return

        path = self.get_kml_path(route_num)
        with open(path, 'w') as fp:
            fp.write(response.text)

    def convert_kml(self, route_num):
        kml_path = self.get_kml_path(route_num)

        if not os.path.exists(kml_path):
            log.info('ERROR: KML file does not exist for route trace "{}"'
                     .format(route_num))
            return

        json_path = self.get_json_path(route_num)
        call(['ogr2ogr', '-f', 'GeoJSON', json_path, kml_path])


class UpdateStats(object):
    """
    Summarize Location data by Route, Direction, and time of day.
    """
    def __init__(self):
        self.last_ran_at = None

    def should_run(self):
        return not self.last_ran_at \
            or self.last_ran_at <= timezone.now() - timedelta(hours=1)

    def update(self, stats):
        stats = list(stats)
        count = LocationStat.objects.count()

        if len(stats) < count:
            # Since this table accumulates data, the number of records
            # should only increase, not decrease.
            raise Exception('ERROR: Number of LocationStat records has decreased')

        with transaction.atomic():
            LocationStat.objects.all().delete()
            LocationStat.objects.bulk_create(stats)

    def run(self):
        if not self.should_run():
            return

        log.info('Updating statistics')

        record = utils.get_oldest_valid_record()
        if record:
            rows = utils.get_all_records_on_date(record.created_at_utc)
            pending_stats = utils.histogram(rows)
            existing_stats = LocationStat.objects.all()
            new_stats = utils.histogram_merge_left(existing_stats, pending_stats)
            self.update(new_stats)

            # Keep running this task until we run out of records to import
            self.last_ran_at = None
        else:
            self.last_ran_at = timezone.now()


class Command(BaseCommand):
    help = 'Download SEPTA API data'

    def handle(self, *args, **options):
        tasks = [
            UpdateRouteTrace(),
            UpdateBusLocations(),
            UpdateStats(),
        ]

        while True:
            for task in tasks:
                task.run()
            time.sleep(10)

        log.info('Done')
