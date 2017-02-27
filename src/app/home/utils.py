# -*- coding: utf-8 -*-
from __future__ import print_function
from __future__ import unicode_literals
from __future__ import division

import logging
import itertools
from datetime import time, timedelta, datetime

import pytz
from django.db.models import Max
from django.utils import timezone
from geopy.distance import great_circle

from home.models import Location, LocationStat


log = logging.getLogger(__name__)

time_min_utc = time.min.replace(tzinfo=pytz.utc)
time_max_utc = time.max.replace(tzinfo=pytz.utc)


def get_latest_stat_date():
    row = LocationStat.objects.all().aggregate(Max('date_utc'))
    return row['date_utc__max']


def get_oldest_valid_record():
    """
    Return first record found that is at least 1 day old.
    """
    rows = Location.objects.filter(
            reported_at_utc__lte=timezone.now() - timedelta(days=1)) \
        .order_by('reported_at_utc')

    latest_stat_date = get_latest_stat_date()
    log.debug('Latest stat date: {}'.format(latest_stat_date))

    if latest_stat_date:
        # Filter records that have already been aggregated
        dt = latest_stat_date + timedelta(days=1)
        dt = datetime.combine(dt, time(tzinfo=pytz.UTC))
        rows = rows.filter(reported_at_utc__gte=dt)

    try:
        return rows[0]
    except IndexError:
        return None


def delete_records_on_date(reference_date_utc):
    qs = get_all_records_on_date(reference_date_utc)
    qs.delete()


def get_all_records_on_date(date_utc):
    """
    Return all records created on target date.
    """
    start_time = datetime.combine(date_utc, time_min_utc)
    end_time = datetime.combine(date_utc, time_max_utc)
    return Location.objects.filter(reported_at_utc__gte=start_time) \
        .filter(reported_at_utc__lte=end_time) \
        .order_by('route_num', 'direction', 'vehicle_id', 'reported_at_utc')


def get_total_distance(locations):
    """
    Return total distance traveled in meters.
    """
    result = 0
    for a, b in itertools.izip(locations, locations[1:]):
        result += great_circle((a.lat, a.lng), (b.lat, b.lng)).meters
    return result


def get_total_duration(locations):
    """
    Return total duration in seconds.
    """
    a = locations[0].reported_at_utc
    b = locations[-1].reported_at_utc
    return (b - a).seconds


def _histogram_vehicles(location_rows):
    """
    Return LocationStat instance for each vehicle grouped by hour.

    The first step to generate the histogram is to aggregate by Vehicle,
    because the data used to calculate total distance and duration is
    collected on a per-vehicle basis. Later, we group these Vehicle stats
    by Route/Direction/Hour.
    """
    def group_key(loc):
        return (loc.route_num,
                loc.direction,
                loc.vehicle_id,
                loc.reported_at_utc.date(),
                loc.reported_at_utc.hour)

    created_at_utc = timezone.now()
    sorted_rows = sorted(location_rows, key=group_key)
    grouped_rows = itertools.groupby(sorted_rows, key=group_key)

    for key, row_group in grouped_rows:
        route_num, direction, vehicle_id, date_utc, hour_utc = key
        locations = list(row_group)

        if len(locations) < 2:
            # Not enough observations
            continue

        stat = LocationStat()
        stat.route_num = route_num
        stat.direction = direction
        stat.hour_utc = hour_utc
        stat.date_utc = date_utc
        stat.total_distance_m = get_total_distance(locations)
        stat.total_duration_s = get_total_duration(locations)
        stat.count_observations = len(locations)
        stat.created_at_utc = created_at_utc
        yield stat


def histogram(locations):
    def group_key(stat):
        return (stat.route_num,
                stat.direction,
                stat.date_utc,
                stat.hour_utc)

    vehicles_stats = _histogram_vehicles(locations)
    sorted_rows = sorted(vehicles_stats, key=group_key)
    grouped_rows = itertools.groupby(sorted_rows, key=group_key)

    for key, row_group in grouped_rows:
        acc_stat = next(row_group)
        for stat in row_group:
            acc_stat.total_distance_m += stat.total_distance_m
            acc_stat.total_duration_s += stat.total_duration_s
            acc_stat.count_observations += stat.count_observations
        yield acc_stat


def _find_existing_stat(stats, route_num, direction, hour_utc):
    for stat in stats:
        if stat.route_num == route_num \
                and stat.direction == direction \
                and stat.hour_utc == hour_utc:
            return stat
    return False


def histogram_merge_left(existing_stats, pending_stats):
    """
    Merge pending_stats into existing_stats. If there is no existing record,
    yield the pending record.
    Mutates the existing_stats argument. The underlying assumption here
    is that we will truncate the LocationStat table instead of performing
    a series of update/insert commands.
    """
    now = timezone.now()

    for pending in pending_stats:
        existing = _find_existing_stat(
            existing_stats, pending.route_num, pending.direction,
            pending.hour_utc)

        if existing:
            existing.id = None
            existing.total_distance_m += pending.total_distance_m
            existing.total_duration_s += pending.total_duration_s
            existing.count_observations += pending.count_observations
            existing.date_utc = pending.date_utc
            existing.created_at_utc = now
            yield existing
        else:
            yield pending

    for existing in existing_stats:
        if existing.id:
            existing.id = None
            existing.created_at_utc = now
            yield existing
