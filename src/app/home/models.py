# -*- coding: utf-8 -*-
from __future__ import print_function
from __future__ import unicode_literals
from __future__ import division

from django.contrib.gis.db.models import (Model,
    CharField,
    DateTimeField,
    IntegerField,
    FloatField)

class Location(Model):
    route_num = CharField(max_length=16)
    block_id = IntegerField()
    vehicle_id = IntegerField()
    direction = CharField(max_length=16)
    destination = CharField(max_length=128)
    offset_sec = IntegerField()
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
            'offsetSec': self.offset_sec,
            'lat': self.lat,
            'lng': self.lng,
            'reportedAtUtc': self.reported_at_utc.isoformat(),
            'createdAtUtc': self.created_at_utc.isoformat(),
        }
