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
            'route_num': self.route_num,
            'block_id': self.block_id,
            'vehicle_id': self.vehicle_id,
            'direction': self.direction,
            'destination': self.destination,
            'offset_sec': self.offset_sec,
            'lat': self.lat,
            'lng': self.lng,
            'reported_at_utc': self.reported_at_utc.isoformat(),
            'created_at_utc': self.created_at_utc.isoformat(),
        }
