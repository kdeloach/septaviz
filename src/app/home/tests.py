# -*- coding: utf-8 -*-
from __future__ import print_function
from __future__ import unicode_literals
from __future__ import division

import random
from datetime import timedelta

from django.test import TestCase
from django.utils import timezone

import home.utils as utils
from home.models import Location, LocationStat


CITY_HALL = {'lat': 39.952379, 'lng': -75.1636}
LOVE_PARK = {'lat': 39.953853, 'lng': -75.165294}
ART_MUSEUM = {'lat': 39.965570, 'lng': -75.180966}


class MockDataHelpers(object):
    def create_location(self, **kwargs):
        result = Location()
        defaults = {
            'block_id': 0,
            'vehicle_id': 0,
            'direction': '',
            'lat': 0,
            'lng': 0,
            'reported_at_utc': timezone.now(),
            'created_at_utc': timezone.now(),
        }
        defaults.update(kwargs)
        for k, v in defaults.iteritems():
            setattr(result, k, v)
        result.save()
        return result

    def create_locations(self, locs):
        return [self.create_location(**loc) for loc in locs]

    def create_stat(self, **kwargs):
        result = LocationStat()
        defaults = {
            'hour_utc': 0,
            'total_distance_m': 0,
            'total_duration_s': 0,
            'count_observations': 0,
            'date_utc': timezone.now(),
            'created_at_utc': timezone.now(),
        }
        defaults.update(kwargs)
        for k, v in defaults.iteritems():
            setattr(result, k, v)
        result.save()
        return result

    def create_stats(self, stats):
        return [self.create_stat(**stat) for stat in stats]


class SeptaVizTestCase(TestCase, MockDataHelpers):
    def test_delete_records_on_date(self):
        """
        Test that records are deleted on the correct date.
        """
        now = timezone.now()
        self.create_locations([
            dict(route_num='A', reported_at_utc=now),
            dict(route_num='B', reported_at_utc=now + timedelta(days=1)),
            dict(route_num='C', reported_at_utc=now + timedelta(days=2)),
        ])

        self.assertEqual(3, len(Location.objects.all()))

        utils.delete_records_on_date(now + timedelta(days=2))
        self.assertEqual(2, len(Location.objects.all()))

        utils.delete_records_on_date(now + timedelta(days=1))
        self.assertEqual(1, len(Location.objects.all()))

        utils.delete_records_on_date(now)
        self.assertEqual(0, len(Location.objects.all()))

    def test_get_all_records_on_date(self):
        """
        Test that records are selected from the correct date.
        """
        now = timezone.now()
        self.create_locations([
            dict(route_num='A', reported_at_utc=now),
            dict(route_num='B', reported_at_utc=now + timedelta(days=1)),
            dict(route_num='C', reported_at_utc=now + timedelta(days=2)),
        ])

        locs = utils.get_all_records_on_date(now)
        self.assertEqual(1, len(locs))
        self.assertEqual('A', locs[0].route_num)

        locs = utils.get_all_records_on_date(now + timedelta(days=1))
        self.assertEqual(1, len(locs))
        self.assertEqual('B', locs[0].route_num)

        locs = utils.get_all_records_on_date(now + timedelta(days=2))
        self.assertEqual(1, len(locs))
        self.assertEqual('C', locs[0].route_num)

    def test_get_total_distance(self):
        """
        Test that total distance between all points is measured correctly.
        """
        locs = self.create_locations([
            dict(route_num='A', **CITY_HALL),
            dict(route_num='A', **LOVE_PARK),
            dict(route_num='A', **ART_MUSEUM),
        ])
        distance = utils.get_total_distance(locs)
        self.assertAlmostEqual(2085, distance, delta=0.1)

    def test_get_total_duration(self):
        """
        Test that total duration between all points is measured correctly.
        """
        now = timezone.now()
        locs = self.create_locations([
            dict(route_num='A', reported_at_utc=now),
            dict(route_num='A', reported_at_utc=now + timedelta(minutes=5)),
            dict(route_num='A', reported_at_utc=now + timedelta(minutes=15)),
        ])
        duration = utils.get_total_duration(locs)
        self.assertEqual(15 * 60, duration)

    def test_get_latest_stat_date(self):
        """
        Test that the MAX reported_at_utc date is returned
        from LocationStat table.
        """
        now = timezone.now()
        stats = [
            dict(route_num='A', hour_utc=0, date_utc=now),
            dict(route_num='A', hour_utc=1, date_utc=now + timedelta(days=1)),
            dict(route_num='A', hour_utc=2, date_utc=now + timedelta(days=2)),
        ]
        random.shuffle(stats)
        self.create_stats(stats)

        expected_latest_date = (now + timedelta(days=2)).date()

        latest_stat_date = utils.get_latest_stat_date()
        self.assertEqual(expected_latest_date, latest_stat_date)

    def test_get_oldest_valid_record(self):
        """
        Test that the "oldest valid record" excludes locations
        that have been aggregated as stats.
        """
        now = timezone.now()
        locs = [
            dict(route_num='A', reported_at_utc=now),
            dict(route_num='B', reported_at_utc=now - timedelta(minutes=60)),
        ]
        random.shuffle(locs)
        self.create_locations(locs)

        # Test that no records are returned
        record = utils.get_oldest_valid_record()
        self.assertEqual(None, record)

        locs = [
            dict(route_num='C', reported_at_utc=now - timedelta(days=1)),
            dict(route_num='D', reported_at_utc=now - timedelta(days=2)),
        ]
        random.shuffle(locs)
        self.create_locations(locs)

        # Test that the oldest record is returned
        record = utils.get_oldest_valid_record()
        self.assertEqual('D', record.route_num)

        # Simulate aggregate stats for the "two_days" date
        self.create_stats([
            dict(route_num='D', date_utc=now - timedelta(days=2))
        ])

        # Test that oldest record excludes aggregated locations
        record = utils.get_oldest_valid_record()
        self.assertEqual('C', record.route_num)

    def test_histogram(self):
        d1 = timezone.now()
        d2 = d1 + timedelta(minutes=10)
        self.create_locations([
            dict(route_num='A', vehicle_id=1, lat=10, lng=0, date_utc=d1),
            dict(route_num='A', vehicle_id=2, lat=30, lng=0, date_utc=d1),
            dict(route_num='A', vehicle_id=1, lat=20, lng=0, date_utc=d2),
            dict(route_num='A', vehicle_id=2, lat=20, lng=0, date_utc=d2),
            dict(route_num='B', vehicle_id=3, lat=10, lng=10, date_utc=d1),
            dict(route_num='B', vehicle_id=4, lat=30, lng=10, date_utc=d1),
            dict(route_num='B', vehicle_id=3, lat=20, lng=10, date_utc=d2),
            dict(route_num='B', vehicle_id=4, lat=20, lng=10, date_utc=d2),
        ])
        locs = Location.objects.all()
        histogram = list(utils.histogram(locs))
        self.assertEqual(2, len(histogram))
        for stat in histogram:
            self.assertEqual(4, stat.count_observations)

    def test_merge_histogram(self):
        now = timezone.now()
        one_day = now + timedelta(days=1)
        hist1 = self.create_locations([
            dict(route_num='A', hour_utc=0, date_utc=now,
                 total_distance_m=1, total_duration_s=1, count_observations=1),
            dict(route_num='A', hour_utc=2, date_utc=now,
                 total_distance_m=1, total_duration_s=1, count_observations=1),
        ])
        hist2 = self.create_locations([
            dict(route_num='A', hour_utc=0, date_utc=one_day,
                 total_distance_m=1, total_duration_s=1, count_observations=1),
            dict(route_num='A', hour_utc=1, date_utc=one_day,
                 total_distance_m=1, total_duration_s=1, count_observations=1),
        ])
        hist3 = list(utils.histogram_merge_left(hist1, hist2))
        self.assertEqual(3, len(hist3))
        for stat in hist3:
            if stat.hour_utc == 0:
                self.assertEqual(2, stat.total_distance_m)
                self.assertEqual(2, stat.total_duration_s)
                self.assertEqual(2, stat.count_observations)
            else:
                self.assertEqual(1, stat.total_distance_m)
                self.assertEqual(1, stat.total_duration_s)
                self.assertEqual(1, stat.count_observations)

            if stat.hour_utc in (0, 1):
                self.assertEqual(one_day, stat.date_utc)
            else:
                self.assertEqual(now, stat.date_utc)
