# -*- coding: utf-8 -*-
from __future__ import print_function
from __future__ import unicode_literals
from __future__ import division

from django.conf.urls import url

from home import views

urlpatterns = [
    url(r'^$', views.index_view, name='homepage'),
    url(r'^(?P<route_num>[a-z0-9]+|all)$', views.route_view, name='bus_route'),
    url(r'^(?P<route_num>[a-z0-9]+|all)\.json$', views.route_json_view,
        name='bus_route_json'),
]
