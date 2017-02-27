# -*- coding: utf-8 -*-
from __future__ import print_function
from __future__ import unicode_literals
from __future__ import division

from django.contrib.gis.db.models import \
    Model, CharField, DateField, DateTimeField, IntegerField, FloatField


class Location(Model):
    route_num = CharField(max_length=16)
    block_id = IntegerField()
    vehicle_id = IntegerField()
    direction = CharField(max_length=16)
    destination = CharField(max_length=128)
    lat = FloatField()
    lng = FloatField()
    reported_at_utc = DateTimeField()
    created_at_utc = DateTimeField()

    def json(self):
        return {
            'id': self.id,
            'routeNum': self.route_num,
            'blockID': self.block_id,
            'vehicleID': self.vehicle_id,
            'direction': self.direction,
            'destination': self.destination,
            'lat': self.lat,
            'lng': self.lng,
            'reportedAtUtc': self.reported_at_utc.isoformat(),
            'createdAtUtc': self.created_at_utc.isoformat(),
        }

    def __unicode__(self):
        return 'Location({}, {}, {}, {}, {})'.format(self.id,
                                                     self.route_num,
                                                     self.direction,
                                                     self.vehicle_id,
                                                     self.reported_at_utc)


class LocationStat(Model):
    route_num = CharField(max_length=16)
    direction = CharField(max_length=16)
    # Hours 0 to 23
    hour_utc = IntegerField()
    # Meters
    total_distance_m = IntegerField()
    # Seconds
    total_duration_s = IntegerField()
    count_observations = IntegerField()
    created_at_utc = DateTimeField()

    # This value represents the date of the latest Location data that
    # has been aggregated into this record.
    # For example, if this value is "2017-02-26", then we know that this
    # record includes all observations up to and including that date.
    date_utc = DateField(null=True)

    class Meta:
        unique_together = ('route_num', 'direction', 'hour_utc')

    @property
    def avg_distance_m(self):
        return self.total_distance_m / self.count_observations

    @property
    def avg_duration_s(self):
        return self.total_duration_s / self.count_observations

    def json(self):
        return {
            'id': self.id,
            'routeNum': self.route_num,
            'direction': self.direction,
            'hourUtc': self.hour_utc,
            'totalDistanceM': self.total_distance_m,
            'totalDurationS': self.total_duration_s,
            'avgDistanceM': self.avg_distance_m,
            'avgDurationS': self.avg_duration_s,
            'countObservations': self.count_observations,
            'createdAtUtc': self.created_at_utc.isoformat(),
        }

    def __unicode__(self):
        return 'LocationStat({}, {}, {}, {}, {})'.format(self.id,
                                                         self.route_num,
                                                         self.direction,
                                                         self.date_utc,
                                                         self.hour_utc)
