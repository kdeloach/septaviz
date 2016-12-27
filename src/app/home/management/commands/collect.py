# -*- coding: utf-8 -*-
from __future__ import print_function
from __future__ import unicode_literals
from __future__ import division

import time
import pytz
import dateutil.parser
import requests

from django.db import transaction
from django.db.models import Max
from django.utils import timezone
from django.core.management import BaseCommand

from home.models import Location


EST = pytz.timezone('US/Eastern')


class Command(BaseCommand):
    help='Download SEPTA API data'

    def update_bus_locations(self):
        """
        Download and insert updated bus locations.
        """
        data = self.download_bus_locations()
        locations = list(self.parse_bus_locations(data))
        to_add = list(self.filter_bus_locations(locations))
        with transaction.atomic():
            Location.objects.bulk_create(to_add)
            self.stdout.write('Inserted {} records'.format(len(to_add)))

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
        self.stdout.write('Downloading...',)
        url = 'http://www3.septa.org/hackathon/TransitViewAll'
        response = requests.get(url)
        return response.json()

    def parse_bus_locations(self, data):
        """
        Transform SEPTA API response into Location records.
        """
        for reported_at_est, routes in data.iteritems():
            created_at_utc = timezone.now()
            reported_at_utc = dateutil.parser.parse(reported_at_est) \
                .replace(tzinfo=EST).astimezone(pytz.utc)
            for route in routes:
                for route_num, locations in route.iteritems():
                    for location in locations:
                        loc = Location()
                        loc.route_num = route_num
                        loc.created_at_utc = created_at_utc
                        loc.reported_at_utc = reported_at_utc
                        loc.block_id = location['BlockID']
                        loc.vehicle_id = location['VehicleID']
                        loc.direction = location['Direction']
                        loc.destination = location['destination'] or ''
                        loc.offset_sec = location['Offset_sec']
                        loc.lat = location['lat']
                        loc.lng = location['lng']
                        yield loc

    def handle(self, *args, **options):
        while True:
            self.update_bus_locations()
            time.sleep(30)
        self.stdout.write('Done')
