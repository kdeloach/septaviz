// Generated with scripts/make_routes_json.py
var BUS_ROUTES = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "12", "14", "15B", "16", "17", "18", "19", "20", "21", "22", "23", "24", "25", "26", "27", "28", "29", "30", "31", "32", "33", "35", "37", "38", "39", "40", "42", "43", "44", "45", "46", "47", "47M", "48", "50", "52", "53", "54", "55", "56", "57", "58", "59", "60", "61", "62", "64", "65", "66", "67", "68", "70", "73", "75", "77", "78", "79", "80", "84", "88", "89", "90", "91", "92", "93", "94", "95", "96", "97", "98", "99", "103", "104", "105", "106", "107", "108", "109", "110", "111", "112", "113", "114", "115", "117", "118", "119", "120", "123", "124", "125", "126", "127", "128", "129", "130", "131", "132", "133", "139", "150", "201", "204", "205", "206", "310", "BSO", "MFO", "G", "H", "J", "K", "L", "R", "XH", "LUCY"];

var RESOLVED_PROMISE = $.Deferred().resolve().promise();

var _map;
var _vehicleLayer;
var _routeTraceLayer;
var _currentView;
var _state = {
    currentRoute: null,
    vehicles: []
};
var _leafletState = {
    vehicleMarkers: {}
};

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

function createMarker(loc) {
    var point = createPoint(loc);
    var angle = getMarkerAngle(loc);
    var arrowTransform = 'transform: rotate(' + angle + 'deg)';

    var html = [];
    html.push('<div class="vehicle-marker-inner">');
    html.push('<div class="vehicle-marker-text">');
    html.push(loc.routeNum);
    html.push('</div>');
    html.push('<div class="vehicle-marker-arrow" style="');
    html.push(arrowTransform);
    html.push('">');
    html.push('<i class="fa fa-chevron-right"></i></div>');
    html.push('</div>');
    html = html.join('');

    var marker = new L.Marker(point, {
        icon: new L.DivIcon({
            className: 'vehicle-marker ' + getVehicleCssClass(loc),
            iconSize: [100, 100],
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

function render(state) {
    var markers = _leafletState.vehicleMarkers;

    _.each(markers, function(marker) {
        marker.alive = false;
    });

    _.each(state.vehicles, function(loc) {
        var vehicleID = loc.VehicleID;
        var marker = markers[vehicleID];
        var point = createPoint(loc);
        if (marker) {
            marker.setLatLng(point);
        } else {
            marker = createMarker(loc);
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

function parseResponse(routeNum, data) {
    var locs = data && data.bus || [];
    for (var i = 0; i < locs.length; i++) {
        locs[i].routeNum = routeNum;
    }
    return locs;
}

function updateRouteData(routeNum, locs) {
    // TODO: Filter old locs for `routeNum`
    _state.vehicles = [];
    _state.vehicles = _state.vehicles.concat(locs);
    render(_state);
}

function fetchRouteTrace(routeNum) {
    // TODO: Filter out random points from GeoJSON
    return $.getJSON('data/trace/' + routeNum + '.json');
}

function showRouteTrace(routeNum) {
    return fetchRouteTrace(routeNum)
        .done(function(geom) {
            var layer = new L.GeoJSON(geom);
            _routeTraceLayer.addLayer(layer);
        });
}

// TODO: Invalidate cache after interval
var fetchVehicleLocations = function(routeNum) {
    var url = 'http://www3.septa.org/api/TransitView/?route=' + routeNum;
    return $.ajax({
        url: url,
        dataType: 'jsonp'
    }).then(function(data) {
        return parseResponse(routeNum, data);
    });
};

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

    var baseLayer = new L.TileLayer('//{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}.png', {
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

    _.each(BUS_ROUTES, function(routeNum) {
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
    _state.currentRoute = routeNum;
    showMap()
        .then(function() {
            // TODO: Show "Loading..." message
            return fetchVehicleLocations(routeNum);
        })
        .then(function(locs) {
            updateRouteData(routeNum, locs);
            _routeTraceLayer.clearLayers();
            return showRouteTrace(routeNum);
        })
        .then(function() {
            return fitBounds(_routeTraceLayer.getBounds());
        });
    return RESOLVED_PROMISE;
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

function executeRoute(e) {
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

function init() {
    $(window).on('hashchange', executeRoute);
    executeRoute();
}

init();
