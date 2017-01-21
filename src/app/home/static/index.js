// TODO:
// Draw "predicted" position (smooth transition?)
// Fit bounds fix
// Homepage (select route)
// Snap to point on route?
// Draw arrow based on previous (route) point?
// Incremental polling
// Filter out "points" during KML processing (ex. route 27)
// Add geolocate button
// Replace polling with websocket

var POLL_INTERVAL_MS = 15 * 1000;

var _map;
var _data;
var _options;
var _vehicleLayer;
var _vehicleTrailLayer;
var _routeTraceLayer;
var _selectedVehicleID;
var _timeout;

function toggleVehicle(vehicleID) {
    _selectedVehicleID = _selectedVehicleID === vehicleID ? null : vehicleID;
    redraw();
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
        if (loc.vehicle_id === _selectedVehicleID) {
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
    var minutesAgo = Math.round(loc.offset_sec / 60);
    var angle = calculateMarkerAngle(loc, prevLoc);
    var arrowTransform = 'transform: rotate(' + angle + 'deg)';

    var html = [];
    html.push('<div class="vehicle-marker-inner">');
    html.push('<div class="vehicle-marker-text">');
    html.push(loc.route_num);
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
    popupHtml.push(loc.vehicle_id);
    popupHtml.push(' ');
    popupHtml.push(loc.direction);
    popupHtml.push(' ');
    popupHtml.push(loc.reported_at_utc);
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
        toggleVehicle(loc.vehicle_id);
    });

    return marker;
}

// Arguments:
// vehicles - Bus locations grouped by vehicle ID
function drawVehicles(vehicles) {
    _vehicleLayer.clearLayers();

    _.each(vehicles, function(locations, vehicleID) {
        var marker = createMarker(locations);
        _vehicleLayer.addLayer(marker);
    });

    // fitBounds(_vehicleLayer.getBounds());
}

// Arguments:
// vehicles - Bus locations grouped by vehicle ID
function drawVehicleTrails(vehicles) {
    _vehicleTrailLayer.clearLayers();

    var i = 0;
    var locs = vehicles[_selectedVehicleID];

    // Skip first location.
    locs = locs && locs[1];

    while (locs && i < 10) {
        var loc = locs[0];
        var point = createPoint(loc);
        var radius = Math.max(1, (10 - i) * 1.161);

        var dot = new L.CircleMarker(point, {
            stroke: false,
            fillOpacity: 1,
            fillColor: '#000',
            radius: radius
        });
        dot.bindPopup(moment(loc.reported_at_utc).fromNow());

        _vehicleTrailLayer.addLayer(dot);

        locs = locs[1];
        i++;
    }
}

function fitBounds(bounds) {
    if (bounds.isValid()) {
        _map.fitBounds(bounds);
    }
}

function getVehicles() {
    return _data.locations || [];
}

function redraw() {
    drawVehicles(getVehicles());
    drawVehicleTrails(getVehicles());
}

function update(data) {
    // TODO: Apply incremental updates
    _data = data;
    redraw();
}

function clearRouteTrace() {
    _routeTraceLayer.clearLayers();
}

// TODO: memoization
function fetchRouteTrace(routeNum) {
    return $.getJSON('static/' + routeNum + '.json');
}

function showRouteTrace(routeNum) {
    return fetchRouteTrace(routeNum)
        .then(function(geom) {
            var layer = new L.GeoJSON(geom);
            _routeTraceLayer.addLayer(layer);
        });
}

function stopPolling() {
    if (_timeout) {
        clearTimeout(_timeout);
    }
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
    var since,
        url = pollUrl(routeNum, since);
    function poll() {
        $.getJSON(url).then(update)
            .catch(_.noop)
            .then(function() {
                since = moment();
                url = pollUrl(routeNum, since);
                _timeout = setTimeout(poll, POLL_INTERVAL_MS);
            });
    }
    stopPolling();
    poll();
}

function hideMap() {
    if (_map) {
        _map.remove();
        _map = null;
    }
}

function showMap() {
    if (_map) {
        return;
    }

    hideMenu();

    _map = new L.Map('map', {
    });

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
}

function hideMenu() {
    $('#main-menu').remove();
}

function showMenu() {
    hideMap();
    var $el = $('<div id="main-menu">');
    _.each(_options.busRoutes, function(routeNum) {
        $('<a>')
            .attr({ href: '#' + routeNum })
            .text(routeNum)
            .appendTo($el);
    });
    $('body').append($el);
}

function selectRoute(routeNum) {
    showMap();
    clearRouteTrace();
    showRouteTrace(routeNum).then(function() {
        fitBounds(_routeTraceLayer.getBounds());
    });
    startPolling(routeNum);
}

function executeRouter(e) {
    var url = window.location.href;
    var parts = url.split('#');

    console.log(parts);

    if (parts.length > 0) {
        parts.shift();
    }

    if (parts.length > 0 && parts[0].length > 0) {
        var routeNum = parts[0];
        selectRoute(routeNum);
    } else {
        showMenu();
    }
}

function init(options) {
    _options = options;
    $(window).on('hashchange', executeRouter);
    executeRouter();
}
