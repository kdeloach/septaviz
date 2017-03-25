// Generated with scripts/make_routes_json.py
var BUS_ROUTES = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "12", "14", "15B", "16", "17", "18", "19", "20", "21", "22", "23", "24", "25", "26", "27", "28", "29", "30", "31", "32", "33", "35", "37", "38", "39", "40", "42", "43", "44", "45", "46", "47", "47M", "48", "50", "52", "53", "54", "55", "56", "57", "58", "59", "60", "61", "62", "64", "65", "66", "67", "68", "70", "73", "75", "77", "78", "79", "80", "84", "88", "89", "90", "91", "92", "93", "94", "95", "96", "97", "98", "99", "103", "104", "105", "106", "107", "108", "109", "110", "111", "112", "113", "114", "115", "117", "118", "119", "120", "123", "124", "125", "126", "127", "128", "129", "130", "131", "132", "133", "139", "150", "201", "204", "205", "206", "310", "BSO", "MFO", "G", "H", "J", "K", "L", "R", "XH", "LUCY"];

// Only load bus stops >= to this zoom level
var STOPS_ZOOM_LEVEL = 15;

var ROUTE_PALETTE = [
    '#341334',
    '#376c9f',
    '#379f9e',
    '#ee4035',
    '#f37736'
];

var RESOLVED_PROMISE = $.Deferred().resolve().promise();

var _map;
var _vehicleLayer;
var _routeTraceLayer;
var _stopsLayer;
var _state = {
    loading: 0,
    vehicles: {},
    routeTrace: {},
    routeTraceColor: 0,
    stops: {}
};
var _leafletState = {
    vehicleMarkers: {}
};

function getActiveBusRoutes() {
    return _.keys(_state.vehicles);
}

var getRouteTraceColor = _.memoize(function(routeNum) {
    var i = _state.routeTraceColor++;
    return ROUTE_PALETTE[i % ROUTE_PALETTE.length];
});

function createPoint(loc) {
    return {
        lat: loc.lat,
        lng: loc.lng
    };
}

function getMarkerAngle(loc) {
    switch (loc.Direction.toLocaleLowerCase()) {
        case 'eastbound': return 0;
        case 'southbound': return 90;
        case 'westbound': return 180;
        case 'northbound': return 270;
    }
    return false;
}

function getVehicleCssClass(loc) {
    var result = [];
    if (loc.Direction.length) {
        result.push('vehicle-' + loc.Direction.toLocaleLowerCase());
    }
    return result.join(' ');
}

function createMarker(routeNum, loc) {
    var point = createPoint(loc);
    var angle = getMarkerAngle(loc);
    var arrowTransform = 'transform: rotate(' + angle + 'deg)';

    var html = [];
    html.push('<div class="vehicle-marker-inner">');
    html.push('<div class="vehicle-marker-text">');
    html.push(routeNum);
    html.push('</div>');
    if (angle !== false) {
        html.push('<div class="vehicle-marker-arrow" style="');
        html.push(arrowTransform);
        html.push('">');
        html.push('<i class="fa fa-chevron-right"></i></div>');
    }
    html.push('</div>');
    html = html.join('');

    var marker = new L.Marker(point, {
        icon: new L.DivIcon({
            className: 'vehicle-marker ' + getVehicleCssClass(loc),
            iconSize: [50, 50],
            html: html
        })
    });

    return marker;
}

function fitBounds(bounds) {
    if (bounds.isValid()) {
        _map.fitBounds(bounds);
    }
    return RESOLVED_PROMISE;
}

function renderVehicles() {
    var markers = _leafletState.vehicleMarkers;

    _.each(markers, function(marker) {
        marker.alive = false;
    });

    _.each(_state.vehicles, function(locs, routeNum) {
        _.each(locs, function(loc) {
            var vehicleID = loc.VehicleID;
            var marker = markers[vehicleID];
            var point = createPoint(loc);
            if (marker) {
                marker.setLatLng(point);
            } else {
                marker = createMarker(routeNum, loc);
                markers[vehicleID] = marker;
                _vehicleLayer.addLayer(marker);
            }
            marker.alive = true;
        });
    });

    _.each(markers, function(marker, vehicleID) {
        if (!marker.alive) {
            marker.remove();
            delete markers[vehicleID];
        }
    });

    fitBounds(_vehicleLayer.getBounds());
}

function removeMarkers(layer) {
    layer.eachLayer(function(child) {
        if (child instanceof L.Marker) {
            layer.removeLayer(child);
        } else if (child.getLayers) {
            removeMarkers(child);
        }
    });
}

function renderRouteTrace() {
    _routeTraceLayer.clearLayers();
    _.each(_state.routeTrace, function(geoJSON, routeNum) {
        var color = getRouteTraceColor(routeNum);
        var layer = new L.GeoJSON(geoJSON, {
            color: color,
            weight: 2
        });
        _routeTraceLayer.addLayer(layer);
    });
    removeMarkers(_routeTraceLayer);
}

// Adapted from http://stackoverflow.com/a/30670574/40
function stopMarker(latlng, size) {
    var p = _map.latLngToContainerPoint(latlng);
    var w = size / 2;
    var h = size / 2;
    var southWest = new L.Point(p.x - w, p.y - h);
    var northEast = new L.Point(p.x + w, p.y + h);
    var bounds = new L.LatLngBounds(
        _map.containerPointToLatLng(southWest),
        _map.containerPointToLatLng(northEast));
    return new L.Rectangle(bounds, {
        color: '#000',
        weight: 1,
        opacity: 1,
        fillColor: '#fff',
        fillOpacity: 1
    });
}

function renderStops() {
    _stopsLayer.clearLayers();

    if (_map.getZoom() < STOPS_ZOOM_LEVEL) {
        return;
    }

    _.each(_state.stops, function(stops, routeNum) {
        _.each(stops, function(stop) {
            var marker = stopMarker([stop.lat, stop.lng], 10);
            _stopsLayer.addLayer(marker);
        });
    });
}

function renderLoading() {
    var $el = $('#loading');
    $el.toggleClass('hide', _state.loading === 0);
}

function render() {
    renderVehicles();
    renderRouteTrace();
    renderStops();
}

function fetchRouteTrace(routeNum) {
    return fetch('static/trace/' + routeNum + '.json');
}

function fetch(url, args) {
    _state.loading++;
    renderLoading();

    args = _.assign({
        dataType: 'json'
    }, args);

    var defer = $.ajax(url, args);
    defer.always(function() {
        _state.loading--;
        renderLoading();
    });
    return defer;
}

function fetchVehicles(routeNum) {
    var url = '//www3.septa.org/api/TransitView/?route=' + routeNum;
    return fetch(url, {
        dataType: 'jsonp'
    }).then(function(data) {
        return data && data.bus || [];
    });
}

function fetchStops(routeNum) {
    return fetch('static/stops/' + routeNum + '.json');
}

function hideMap() {
    if (_map) {
        _map.remove();
        _map = null;
    }
    return RESOLVED_PROMISE;
}

function initMap() {
    _map = new L.Map('map', {
        minZoom: 12,
        // Philadelphia city bounds
        maxBounds: [[39.699262, -75.587311], [40.209294, -74.737930]],
        zoomControl: false
    });

    var baseLayer = new L.TileLayer('//cartodb-basemaps-{s}.global.ssl.fastly.net/light_all/{z}/{x}/{y}.png', {
        attribution: '&copy; <a href="http://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="http://cartodb.com/attributions">CartoDB</a>',
        subdomains: 'abcd',
        maxZoom: 19
    });
    _map.addLayer(baseLayer);

    _map.addControl(new L.Control.Zoom({
        position: 'bottomright'
    }));
    _map.addControl(new L.Control.Locate({
        position: 'bottomright'
    }));

    _vehicleLayer = new L.FeatureGroup();
    _routeTraceLayer = new L.FeatureGroup();
    _stopsLayer = new L.FeatureGroup();

    _map.addLayer(_vehicleLayer);
    _map.addLayer(_routeTraceLayer);
    _map.addLayer(_stopsLayer);

    _map.on('zoomend', renderStops);

    // Philadelphia
    _map.setView([39.952584, -75.165222], 13);
}

function showMenu() {
    var $el = $('#menu');
    $el.html('');

    _.each(BUS_ROUTES, function(routeNum) {
        $('<a>')
            .attr({ href: '#' + routeNum })
            .text(routeNum)
            .appendTo($el);
    });

    $el.show();
    $el.focus();
}

function hideMenu() {
    $('#menu').hide();
}

// Load all map objects for single bus route.
function loadRoute(routeNum) {
    fetchVehicles(routeNum)
        .then(function(locs) {
            _state.vehicles[routeNum] = locs;
        })
        .done(renderVehicles);
    fetchRouteTrace(routeNum)
        .then(function(geoJSON) {
            _state.routeTrace[routeNum] = geoJSON;
        })
        .done(renderRouteTrace);
    fetchStops(routeNum)
        .then(function(stops) {
            _state.stops[routeNum] = stops;
        })
        .done(renderStops);
}

function showBackButton() {
    $('#back').show();
}

function hideBackButton() {
    $('#back').hide();
}

function selectRoutes(routeNums) {
    _.each(routeNums, function(routeNum) {
        loadRoute(routeNum);
    });
}

function parseRoutes(value) {
    return value.split(',');
}

function executeRoute(e) {
    var url = window.location.href;
    var parts = url.split('#');

    if (parts.length > 0) {
        parts.shift();
    }

    if (parts.length > 0 && parts[0].length > 0) {
        var routeNum = parseRoutes(parts[0]);
        selectRoutes(routeNum);
        hideMenu();
        showBackButton();
    } else {
        showMenu();
        hideBackButton();
    }
}

function init() {
    initMap();
    $(window).on('hashchange', executeRoute);
    executeRoute();
}

init();
