var _map;
var _vehicleLayer;
var _routeTraceLayer;
var _data;

function createPoint(loc) {
    return {
        lat: parseFloat(loc.lat),
        lng: parseFloat(loc.lng)
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

function getTextClassName(loc) {
    var result = 'vehicle-marker-text';
    result += ' ' + loc.direction.toLocaleLowerCase();
    return result;
}

function getArrowClassName(loc) {
    var result = 'vehicle-marker-arrow';
    result += ' ' + loc.direction.toLocaleLowerCase();
    return result;
}

function getPrevLocation(locations) {
    var next = locations[1];
    return next && next[0];
}

function createMarker(locations) {
    var loc = locations[0];
    var prevLoc = getPrevLocation(locations);

    var point = createPoint(loc);
    var textClassName = getTextClassName(loc);
    var arrowClassName = getArrowClassName(loc);
    var minutesAgo = Math.round(loc.offset_sec / 60);
    var angle = calculateMarkerAngle(loc, prevLoc);

    var html = [];
    html.push('<div class="vehicle-marker-inner ');
    html.push(getMarkerSize());
    html.push('">');
    html.push('<div class="');
    html.push(textClassName);
    html.push('">');
    html.push(loc.route_num);
    html.push('</div>');
    if (angle !== false) {
        html.push('<div class="');
        html.push(arrowClassName);
        html.push('" style="transform: rotate(');
        html.push(angle);
        html.push('deg)">');
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
            className: 'vehicle-marker',
            iconSize: [100, 100],
            html: html
        })
    }).bindPopup(popupHtml);
    return marker;
}

function drawVehicles(vehicles) {
    _vehicleLayer.clearLayers();

    _.each(vehicles, function(locations, vehicleId) {
        var marker = createMarker(locations);
        _vehicleLayer.addLayer(marker);
    });

    // fitBounds(_vehicleLayer.getBounds());
}

function fitBounds(bounds) {
    if (bounds.isValid()) {
        _map.fitBounds(bounds);
    }
}

function redraw() {
    drawVehicles(_data);
}

function update(data) {
    _data = data;
    redraw();
}

function drawRouteTrace(routeNum) {
    $.getJSON('static/' + routeNum + '.json')
        .then(function(geom) {
            _routeTraceLayer.clearLayers();
            _routeTraceLayer.addLayer(new L.GeoJSON(geom));
        })
        .catch(function() {
            console.log('derp');
        });
}

function init() {
    _map = new L.Map('map', {
        center: [39.952757, -75.163826],
        zoom: 16
    });

    var baseLayer = new L.TileLayer('http://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}.png', {
        attribution: '&copy; <a href="http://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="http://cartodb.com/attributions">CartoDB</a>',
        subdomains: 'abcd',
        maxZoom: 19
    });
    _map.addLayer(baseLayer);

    _vehicleLayer = new L.FeatureGroup();
    _routeTraceLayer = new L.FeatureGroup();

    _map.addLayer(_vehicleLayer);
    _map.addLayer(_routeTraceLayer);

    _map.on('zoomend', redraw);
}

init();
