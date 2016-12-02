var _map;
var _vehicleLayer;
var _data;

function createPoint(trip) {
    return {
        lat: parseFloat(trip.lat),
        lng: parseFloat(trip.lng)
    };
}

function nextDistinctTrip(firstTrip, trips) {
    for (var i = 0; i < trips.length; i++) {
        var trip = trips[i];
        if (trip.id < firstTrip.id) {
            var match = trip.lat === firstTrip.lat
                && trip.lng === firstTrip.lng;
            if (!match) {
                return trip;
            }
        }
    }
    return null;
}

function calculateAngle(a, b) {
    var x = b.lng - a.lng;
    var y = b.lat - a.lat;
    var angle = Math.atan2(y, x) * 180 / Math.PI;
    // CSS transform rotates clockwise instead of counter-clockwise.
    return angle * -1;
}

function markerAngle(trip, allTrips) {
    var prevTrip = nextDistinctTrip(trip, allTrips);
    if (prevTrip) {
        var a = createPoint(trip);
        var b = createPoint(prevTrip);
        return calculateAngle(b, a);
    }
    switch (trip.direction.toLocaleLowerCase()) {
        case 'northbound': return -90;
        case 'southbound': return 90;
        case 'eastbound': return 0;
        case 'westbound': return 180;
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

function getTextClassName(trip) {
    var result = 'vehicle-marker-text';
    result += ' ' + trip.direction.toLocaleLowerCase();
    return result;
}

function getArrowClassName(trip) {
    var result = 'vehicle-marker-arrow';
    result += ' ' + trip.direction.toLocaleLowerCase();
    return result;
}

function createMarker(trip, allTrips) {
    var point = createPoint(trip);
    var textClassName = getTextClassName(trip);
    var arrowClassName = getArrowClassName(trip);
    var minutesAgo = Math.round(trip.offset_sec / 60);
    var angle = markerAngle(trip, allTrips);

    var html = [];
    html.push('<div class="vehicle-marker-inner ');
    html.push(getMarkerSize());
    html.push('">');
    html.push('<div class="');
    html.push(textClassName);
    html.push('">');
    html.push(trip.route_num);
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
    popupHtml.push(trip.vehicle_id);
    popupHtml.push(' ');
    popupHtml.push(trip.direction);
    popupHtml.push(' (');
    popupHtml.push(minutesAgo);
    popupHtml.push(' minutes ago)');
    popupHtml = popupHtml.join('');

    return new L.Marker(point, {
            icon: new L.DivIcon({
                className: 'vehicle-marker',
                iconSize: [100, 100],
                html: html
            })
        })
        .bindPopup(popupHtml);
}

function drawVehicles(vehicleTrips) {
    var firstTime = !!!_vehicleLayer;
    if (firstTime) {
        _vehicleLayer = new L.FeatureGroup();
        _map.addLayer(_vehicleLayer);
    }
    _vehicleLayer.clearLayers();

    _.each(vehicleTrips, function(trips, vehicleId) {
        var firstTrip = trips[0];
        var marker = createMarker(firstTrip, trips);
        _vehicleLayer.addLayer(marker);
    });

    if (firstTime) {
        _map.fitBounds(_vehicleLayer.getBounds());
    }
}

function redraw() {
    console.log(_map.getZoom());
    drawVehicles(_data);
}

function update(data) {
    _data = data;
    redraw();
}

function init() {
    _map = new L.Map('map');
    _map.setZoom(16);

    L.tileLayer('http://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}.png', {
        attribution: '&copy; <a href="http://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="http://cartodb.com/attributions">CartoDB</a>',
        subdomains: 'abcd',
        maxZoom: 19
    }).addTo(_map);

    _map.on('zoomend', redraw);
}

init();
