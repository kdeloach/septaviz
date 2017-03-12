// TODO:
// Draw "predicted" position (smooth transition?)
// Fit bounds fix
// Snap to point on route?
// Stats-based polling (ex. poll 3m, then 1m, then 30s)
// Filter out "points" during KML processing (ex. route 27)
// Add geolocate button
// Replace polling with websocket
// Show routes that service a point within some radius
// Vehicle marker should update during animation

var POLL_INTERVAL_MS = 15 * 1000;

var RESOLVED_PROMISE = $.Deferred().resolve().promise();

var _map;
var _options;
var _vehicleLayer;
var _routeTraceLayer;
var _currentView;
var _state = {};
var _leafletState = {
    vehicleMarkers: {}
};

function createPoint(loc) {
    return {
        lat: loc.lat,
        lng: loc.lng
    };
}

function pointsMatch(a, b) {
    return a.lat === b.lat && a.lng === b.lng;
}

function calculateAngle(a, b) {
    var x = b.lng - a.lng;
    var y = b.lat - a.lat;
    var angle = Math.atan2(y, x) * 180 / Math.PI;
    // CSS transform rotates clockwise instead of counter-clockwise.
    return angle * -1;
}

function calculateMarkerAngle(loc, prevLoc) {
    if (prevLoc) {
        var a = createPoint(loc);
        var b = createPoint(prevLoc);
        return calculateAngle(b, a);
    }
    switch (loc.direction.toLocaleLowerCase()) {
        case 'eastbound': return 0;
        case 'southbound': return 90;
        case 'westbound': return 180;
        case 'northbound': return 270;
    }
    return false;
}

function getVehicleCssClass(loc) {
    var result = [];
    if (_state.selectedVehicleID) {
        if (loc.vehicleID === _state.selectedVehicleID) {
            result.push('vehicle-active');
        } else {
            result.push('vehicle-inactive');
        }
    }
    if (loc.direction.length) {
        result.push('vehicle-' + loc.direction.toLocaleLowerCase());
    }
    return result.join(' ');
}

function createMarker(locations) {
    var loc = locations[0];

    var prevLoc = locations[1];
    prevLoc = prevLoc && prevLoc[0];

    var point = createPoint(loc);
    var minutesAgo = Math.round(loc.offsetSec / 60);
    var angle = calculateMarkerAngle(loc, prevLoc);
    var arrowTransform = 'transform: rotate(' + angle + 'deg)';

    var html = [];
    html.push('<div class="vehicle-marker-inner">');
    html.push('<div class="vehicle-marker-text">');
    html.push(loc.routeNum);
    html.push('</div>');
    if (angle !== false) {
        html.push('<div class="vehicle-marker-arrow" style="');
        html.push(arrowTransform);
        html.push('">');
        html.push('<i class="fa fa-chevron-right"></i></div>');
    }
    html.push('</div>');
    html = html.join('');

    var popupHtml = [];
    popupHtml.push(loc.vehicleID);
    popupHtml.push(' ');
    popupHtml.push(loc.direction);
    popupHtml.push(' ');
    popupHtml.push(loc.reportedAtUtc);
    popupHtml.push(' (');
    popupHtml.push(minutesAgo);
    popupHtml.push(' minutes ago)');
    popupHtml = popupHtml.join('');

    var marker = new L.Marker(point, {
        icon: new L.DivIcon({
            className: 'vehicle-marker ' + getVehicleCssClass(loc),
            iconSize: [100, 100],
            html: html
        })
    }).bindPopup(popupHtml);

    return marker;
}

function fitBounds(bounds) {
    if (bounds.isValid()) {
        _map.fitBounds(bounds);
    }
    return RESOLVED_PROMISE;
}

function animate(marker, from, to) {
    // XXX Disable animations temporarily.
    marker.setLatLng(to);
    return;

    var i = 0;
    var TICKS = 10;
    var DURATION = 500;
    var TIMEOUT = DURATION / TICKS;

    function step() {
        var lat = from.lat + (to.lat - from.lat) * i / TICKS;
        var lng = from.lng + (to.lng - from.lng) * i / TICKS;

        console.log(i, i / TICKS, lat, lng);

        marker.setLatLng([lat, lng]);

        if (i < TICKS) {
            setTimeout(step, TIMEOUT);
            i++;
        } else {
            marker.animating = false;
        }
    }

    if (marker.animating || pointsMatch(from, to)) {
        // Do nothing if animation is in progress, or marker position
        // hasn't changed.
        return;
    } else {
        marker.animating = true;
        step();
    }
}

function render(state) {
    var vehicleLocations = state.vehicleLocations || [];
    var markers = _leafletState.vehicleMarkers;

    _.each(markers, function(marker) {
        marker.alive = false;
    });

    _.each(vehicleLocations, function(locs, vehicleID) {
        var marker = markers[vehicleID];
        if (marker) {
            var oldPoint = marker.getLatLng();
            var newPoint = createPoint(locs[0]);
            animate(marker, oldPoint, newPoint);
        } else {
            marker = createMarker(locs);
            markers[vehicleID] = marker;
            _vehicleLayer.addLayer(marker);
        }
        marker.alive = true;
    });

    _.each(markers, function(marker, vehicleID) {
        if (!marker.alive) {
            marker.remove();
            delete markers[vehicleID];
        }
    });
}

function update(data) {
    _state.vehicleLocations = data.vehicleLocations;
    render(_state);
}

// TODO: memoization
function fetchRouteTrace(routeNum) {
    return $.getJSON('static/' + routeNum + '.json');
}

function showRouteTrace(routeNum) {
    return fetchRouteTrace(routeNum)
        .done(function(geom) {
            var layer = new L.GeoJSON(geom);
            _routeTraceLayer.addLayer(layer);
        });
}

function pollUrl(routeNum, since) {
    var baseUrl = routeNum + '.json';
    var nowUtc = moment().format();
    if (since) {
        return baseUrl + '?since=' + nowUtc;
    } else {
        return baseUrl;
    }
}

function startPolling(routeNum) {
    var since, xhr, timeout;
    var alive = true;
    var url = pollUrl(routeNum, since);

    function poll() {
        xhr = $.getJSON(url);
        xhr.done(function(data) {
                if (alive) {
                    update(data);
                }
            })
            .catch(_.noop)
            .always(function() {
                if (alive) {
                    since = moment();
                    url = pollUrl(routeNum, since);
                    timeout = setTimeout(poll, POLL_INTERVAL_MS);
                }
            });
    }

    poll();

    return function cancel() {
        alive = false;
        xhr.abort();
        clearTimeout(timeout);
        return RESOLVED_PROMISE;
    };
}

function hideMap() {
    if (_map) {
        _map.remove();
        _map = null;
    }
    return RESOLVED_PROMISE;
}

function showMap() {
    if (_map) {
        return RESOLVED_PROMISE;
    }

    _map = new L.Map('map');

    var baseLayer = new L.TileLayer('http://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}.png', {
        attribution: '&copy; <a href="http://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="http://cartodb.com/attributions">CartoDB</a>',
        subdomains: 'abcd',
        maxZoom: 19
    });
    _map.addLayer(baseLayer);

    _map.addControl(L.control.locate());

    _vehicleLayer = new L.FeatureGroup();
    _routeTraceLayer = new L.FeatureGroup();

    _map.addLayer(_vehicleLayer);
    _map.addLayer(_routeTraceLayer);

    return RESOLVED_PROMISE;
}

function showMenu() {
    var $el = $('<div id="main-menu" tabindex="0">');

    _.each(_options.busRoutes, function(routeNum) {
        $('<a>')
            .attr({ href: '#' + routeNum })
            .text(routeNum)
            .appendTo($el);
    });

    hideMap()
        .then(function() {
            $('body').append($el);
            $el.focus();
        });

    return function() {
        $el.remove();
    };
}

function selectRoute(routeNum) {
    var stopPolling = startPolling(routeNum);

    showMap()
        .then(function() {
            _routeTraceLayer.clearLayers();
        })
        .then(function() {
            return showRouteTrace(routeNum);
        })
        .then(function() {
            return fitBounds(_routeTraceLayer.getBounds());
        });

    return function() {
        stopPolling();
    }
}

function setPage(cleanupViewFn) {
    var defer = RESOLVED_PROMISE;
    // Execute cleanup function for current page.
    if (_currentView) {
        defer = defer.then(_currentView);
    }
    // Assign cleanup function for next page.
    defer.then(function() {
        _currentView = cleanupViewFn;
    });
    return defer.promise();
}

function executeRouter(e) {
    var url = window.location.href;
    var parts = url.split('#');

    if (parts.length > 0) {
        parts.shift();
    }

    if (parts.length > 0 && parts[0].length > 0) {
        var routeNum = parts[0];
        setPage(selectRoute(routeNum));
    } else {
        setPage(showMenu());
    }
}

function init(options) {
    _options = options;
    $(window).on('hashchange', executeRouter);
    executeRouter();
}
