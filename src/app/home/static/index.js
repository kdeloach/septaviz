// TODO:
// Draw "predicted" position (smooth transition?)
// Fit bounds fix
// Snap to point on route?
// Stats-based polling (ex. poll 3m, then 1m, then 30s)
// Filter out "points" during KML processing (ex. route 27)
// Add geolocate button
// Replace polling with websocket

// var POLL_INTERVAL_MS = 15 * 1000;
var POLL_INTERVAL_MS = 3 * 1000;

var RESOLVED_PROMISE = $.Deferred().resolve().promise();

var _map;
var _data;
var _options;
var _vehicleLayer;
var _vehicleTrailLayer;
var _routeTraceLayer;
var _selectedVehicleID;
var _currentView;

function toggleVehicle(vehicleID) {
    _selectedVehicleID = _selectedVehicleID === vehicleID ? null : vehicleID;
    render();
}

function createPoint(loc) {
    return {
        lat: loc.lat,
        lng: loc.lng
    };
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

function getMarkerSize() {
    var zoom = _map.getZoom();
    if (zoom <= 13) {
        return 'xtiny';
    } else if (zoom <= 14) {
        return 'tiny';
    } else if (zoom <= 15) {
        return 'small';
    } else if (zoom <= 16) {
        return 'medium';
    }
   return 'large';
}

function getVehicleCssClass(loc) {
    var result = [];
    result.push(getMarkerSize());
    if (_selectedVehicleID) {
        if (loc.vehicleID === _selectedVehicleID) {
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
    popupHtml.push(loc.reportedAtUTC);
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

    // TODO: Redraw on click breaks the marker popup
    marker.on('click', function() {
        toggleVehicle(loc.vehicleID);
    });

    return marker;
}

// Iterate over vehicle locations linked list.
// fn - Callback function; function(loc, prevLoc, i)
function eachLocation(locations, fn) {
    var i = 0;
    var prevNode = null;
    var node = locations;
    var result = undefined;
    while (node && result !== false) {
        result = fn(node[0], prevNode && prevNode[0], i);
        prevNode = node;
        node = node[1];
        i++;
    }
}

// Arguments:
// vehicles - Bus locations grouped by vehicle ID
function drawVehicles(vehicles) {
    _vehicleLayer.clearLayers();

    _.each(vehicles, function(locs, vehicleID) {
        var marker = createMarker(locs);
        _vehicleLayer.addLayer(marker);
    });

    // fitBounds(_vehicleLayer.getBounds());
}

// Arguments:
// locs - Linked list vehicle locations
// ex. [ {...}, [ {...}, null] ]
function drawTrail(locs, vehicleID) {
    eachLocation(locs, function(loc, prevLoc, i) {
        if (prevLoc) {
            var latlngs = [
                [prevLoc.lat, prevLoc.lng],
                [loc.lat, loc.lng],
            ];
            var line = new L.Polyline(latlngs, {
                color: '#000',
                weight: 10 - i * 1.16
            });
            _vehicleTrailLayer.addLayer(line);
        }
        return i < 5;
    });
}

// Arguments:
// vehicles - Bus locations grouped by vehicle ID
function drawVehicleTrails(vehicles) {
    _vehicleTrailLayer.clearLayers();
    _.each(vehicles, function(locs, vehicleID) {
        if (vehicleID == _selectedVehicleID) {
            drawTrail(locs, vehicleID);
        }
    });
}

function fitBounds(bounds) {
    if (bounds.isValid()) {
        _map.fitBounds(bounds);
    }
    return RESOLVED_PROMISE;
}

function getVehicles() {
    return _data.locations || [];
}

function render() {
    drawVehicles(getVehicles());
    drawVehicleTrails(getVehicles());
}

function update(data) {
    // TODO: Apply incremental updates
    _data = data;
    render();
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
    if (since) {
        return baseUrl + '?since=' + since;
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

    _vehicleLayer = new L.FeatureGroup();
    _vehicleTrailLayer = new L.FeatureGroup();
    _routeTraceLayer = new L.FeatureGroup();

    _map.addLayer(_vehicleLayer);
    _map.addLayer(_vehicleTrailLayer);
    _map.addLayer(_routeTraceLayer);

    return RESOLVED_PROMISE;
}

function showMenu() {
    var $el = $('<div id="main-menu">');

    _.each(_options.busRoutes, function(routeNum) {
        $('<a>')
            .attr({ href: '#' + routeNum })
            .text(routeNum)
            .appendTo($el);
    });

    hideMap()
        .then(function() { $('body').append($el); });

    return function() {
        $el.remove();
    };
}

function selectRoute(routeNum) {
    var stopPolling = startPolling(routeNum);

    showMap()
        .then(function() { _routeTraceLayer.clearLayers(); })
        .then(function() { return showRouteTrace(routeNum); })
        .then(function() { return fitBounds(_routeTraceLayer.getBounds()); });

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
