# -*- coding: utf-8 -*-
from __future__ import print_function
from __future__ import unicode_literals
from __future__ import division

import itertools
from datetime import timedelta

from django.http import Http404, JsonResponse
from django.shortcuts import render
from django.utils import timezone

from septaviz.settings import BUS_ROUTES
from home.models import Location


class BusRouteUndefined(ValueError):
    pass


def fetch_bus_locations(route_num=None):
    """
    Return JSON serializable collection of bus locations
    grouped by vehicle_id.
    """
    all_locs = Location.objects.all() \
        .filter(reported_at_utc__gte=timezone.now() - timedelta(hours=2)) \
        .order_by('vehicle_id', 'created_at_utc')

    if route_num and route_num != 'all':
        if route_num not in BUS_ROUTES:
            raise BusRouteUndefined()
        all_locs = all_locs.filter(route_num=route_num)

    def location_key(loc):
        return loc.vehicle_id

    grouped_locs = itertools.groupby(all_locs, location_key)

    result = {}

    for vehicle_id, locs in grouped_locs:
        node = [locs.next().json(), None]
        for loc in locs:
            node = [loc.json(), node]
        result[vehicle_id] = node

    return result


def index_view(request):
    context = {
        'bus_routes': BUS_ROUTES,
    }
    return render(request, 'home/index.html', context)


def route_json_view(request, route_num):
    try:
        bus_locations = fetch_bus_locations(route_num=route_num)
    except BusRouteUndefined:
        raise Http404()
    context = {
        'vehicleLocations': bus_locations,
    }
    return JsonResponse(context)
