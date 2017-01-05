# -*- coding: utf-8 -*-
from __future__ import print_function
from __future__ import unicode_literals
from __future__ import division

import json
import itertools
import operator

from datetime import timedelta

from django.shortcuts import render
from django.utils import timezone

from home.models import Location


def fetch_bus_routes(route_num=None):
    """
    Return JSON serializable collection of bus locations
    grouped by vehicle_id.
    """
    all_locs = Location.objects.all() \
        .filter(reported_at_utc__gte=timezone.now() - timedelta(hours=2)) \
        .order_by('vehicle_id', 'created_at_utc')

    if route_num:
        all_locs = all_locs.filter(route_num=route_num)

    location_key = operator.attrgetter('vehicle_id')
    grp = itertools.groupby(all_locs, key=location_key)

    result = {}

    for vehicle_id, locs in grp:
        node = [locs.next().json(), None]
        for loc in locs:
            node = [loc.json(), node]
        result[vehicle_id] = node

    return result


def index_view(request):
    bus_routes = fetch_bus_routes()
    context = {
        'bus_routes': json.dumps(bus_routes),
    }
    return render(request, 'home/index.html', context)


def route_view(request, route_num):
    bus_routes = fetch_bus_routes(route_num=route_num)
    context = {
        'route_num': route_num,
        'bus_routes': json.dumps(bus_routes),
    }
    return render(request, 'home/index.html', context)
