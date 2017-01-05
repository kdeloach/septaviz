# -*- coding: utf-8 -*-
from __future__ import print_function
from __future__ import unicode_literals
from __future__ import division

from django.conf.urls import url

from home import views

urlpatterns = [
    url(r'^$', views.index_view, name='all_routes'),
    url(r'^(?P<route_num>[a-z0-9]+)$', views.route_view, name='route_num'),
]
