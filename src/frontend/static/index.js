var DEFAULT_CENTER = [39.952584, -75.165222];
var DEFAULT_ZOOM = 13;

// Detect bus routes within this radius (meters)
var NEARBY_BUS_RADIUS = 500;

var CITY_HALL = [39.952584, -75.165222];

// Source: http://bl.ocks.org/aaizemberg/78bd3dade9593896a59d
// google 10c
var PALETTE = [
    '#3366cc',
    '#dc3912',
    '#ff9900',
    '#109618',
    '#990099',
    '#0099c6',
    '#dd4477',
    '#66aa00',
    '#b82e2e',
    '#316395'
];

var busStopMarkerIcon = new L.DivIcon({
    className: 'bus-stop-marker'
});

var App = {
    map: null,
    url: ''
};

var ReloadControl = L.Control.extend({
    onAdd: function(map) {
        var $el = $('' +
            '<div class="leaflet-control leaflet-bar">' +
                '<a href="#reload" title="Reload" aria-label="Reload" ' +
                    'role="button" class="leaflet-control-zoom-in">&#8635;</a>' +
            '</div>'
        );
        return $el.get(0);
    }
});

function Map() {
    var map = new L.Map('map', {
        minZoom: 10,
        zoomControl: false
    });
    this.leafletMap = map;

    var baseLayer = new L.TileLayer('//cartodb-basemaps-{s}.global.ssl.fastly.net/light_all/{z}/{x}/{y}.png', {
        attribution: '&copy; <a href="http://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="http://cartodb.com/attributions">CartoDB</a>',
        subdomains: 'abcd',
        maxZoom: 19
    });
    map.addLayer(baseLayer);

    map.addControl(new L.Control.Zoom({
        position: 'bottomright'
    }));

    map.addControl(new ReloadControl({
        position: 'bottomright'
    }));

    map.on('locationfound', function(e) {
        locate(e.latlng);
    });

    map.on('locationerror', function(e) {
        alert(e.message);
        locate(CITY_HALL);
    });

    this.vehicleLayer = new L.FeatureGroup();
    this.routeTraceLayer = new L.FeatureGroup();
    this.searchLayer = new L.FeatureGroup();

    map.addLayer(this.vehicleLayer);
    map.addLayer(this.routeTraceLayer);
    map.addLayer(this.searchLayer);

    map.setView(DEFAULT_CENTER, DEFAULT_ZOOM);
    return this;
}

var nextRouteTraceColor = (function() {
    var i = 0;
    return function() {
        return PALETTE[i++ % PALETTE.length];
    };
}());

// Return first point found inside LatLngBounds or false if none found.
function findPointInBounds(bounds, points) {
    for (var i = 0; i < points.length; i++) {
        var point = points[i];
        if (bounds.contains(point)) {
            return true;
        }
    }
    return false;
}

// Return list of bus routes within LatLngBounds.
function findRoutesWithinBounds(bounds, stops) {
    var result = [];
    for (var routeNum in stops) {
        var points = stops[routeNum];
        if (findPointInBounds(bounds, points)) {
            result.push(routeNum);
        }
    }
    return result;
}

function locate(latlng) {
    fetchAllStops().then(function(stops) {
        locateRoutes(stops, latlng);
    });
}

function reset() {
    // Deactivate menu buttons
    $('header-btn').removeClass('header-btn-active');
    // Deactivate lists
    hideBusList();
    hideTrolleyList();
    // Clear "locate" marker
    App.map.searchLayer.clearLayers();
}

function locateRoutes(stops, latlng) {
    App.map.searchLayer.clearLayers();

    var circle = new L.Circle(latlng, NEARBY_BUS_RADIUS);
    App.map.searchLayer.addLayer(circle);

    var marker = new L.Marker(latlng, {
        draggable: true,
        zIndexOffset: 10000
    });
    marker.on('dragend', function(e) {
        var latlng = marker.getLatLng();
        locateRoutes(stops, latlng);
        App.map.leafletMap.setView(latlng);
    });
    App.map.searchLayer.addLayer(marker);

    var bounds = circle.getBounds();
    var routeNums = findRoutesWithinBounds(bounds, stops);
    var url = '#' + routeNums.join(',');
    setUrl(url);
}

function addRouteTrace(geojson) {
    var routeNum = geojson.routeNum;
    if (routeTraceExists(routeNum)) {
        return;
    }
    var layer = new L.GeoJSON(geojson, {
        color: nextRouteTraceColor(),
        weight: 3
    });
    layer.routeNum = routeNum;
    App.map.routeTraceLayer.addLayer(layer);
}

function routeTraceExists(routeNum) {
    var layers = App.map.routeTraceLayer.getLayers();
    for (var i = 0; i < layers.length; i++) {
        var layer = layers[i];
        if (layer.routeNum === routeNum) {
            return true;
        }
    }
    return false;
}

function removeRouteTrace(routeNum) {
    var layers = App.map.routeTraceLayer.getLayers();
    for (var i = 0; i < layers.length; i++) {
        var layer = layers[i];
        if (layer.routeNum === routeNum) {
            App.map.routeTraceLayer.removeLayer(layer);
            break;
        }
    }
}

function getMarkerDirection(loc) {
    var direction = loc.Direction.toLocaleLowerCase();
    switch (direction) {
        case 'northbound':
        case 'eastbound':
        case 'southbound':
        case 'westbound':
            return direction;
    }
    return '';
}

function getMarkerClassName(loc) {
    var result = [
        'vehicle-marker-inner',
        this.getMarkerDirection(loc)
    ];
    if (loc.routeNum.length > 2) {
        result.push('condensed');
    }
    return result.join(' ');
}

function getMarkerHtml(loc) {
    var result = [loc.routeNum];
    var className = getMarkerClassName(loc);
    var direction = getMarkerDirection(loc);
    if (direction.length) {
        result.push('<div class="vehicle-marker-arrow"></div>');
    }
    return '<div class="' + className + '">' + result.join('') + '</div>';
}

function getMarkerContent(loc) {
    var now = new Date();
    var offsetMs = parseInt(loc.Offset_sec, 10) * 1000;
    var reportedAt = new Date(loc.createdAt.getTime() - offsetMs);
    var elapsedSec = Math.round((now.getTime() - reportedAt.getTime()) / 1000);
    var min = Math.round(elapsedSec / 60);
    var s;
    if (min > 1) {
        s = min === 1 ? '' : 's';
        return 'Updated ' + min + ' minute' + s + ' ago';
    } else {
        s = elapsedSec === 1 ? '' : 's';
        return 'Updated ' + elapsedSec + ' second' + s + ' ago';
    }
}

function addVehicles(vehicles) {
    function createMarker(loc) {
        var marker = new L.Marker(loc, {
            icon: new L.DivIcon({
                iconSize: [50, 50],
                className: 'vehicle-marker',
                html: getMarkerHtml(loc)
            })
        });
        marker.routeNum = loc.routeNum;
        marker.on('add', function(e) {
            var $el = $('.vehicle-marker-inner', e.target._icon);
            $el.css('transform', 'scale(0)');
            setTimeout(function() {
                $el.css('transform', 'scale(1)');
            }, 100 + Math.random() * 100);
        });
        marker.on('popupopen', function(e) {
            e.popup.setContent(getMarkerContent(loc));
        });
        marker.bindPopup('', {
            offset: [0, -5]
        });
        return marker;
    }
    for (var i = 0; i < vehicles.length; i++) {
        var loc = vehicles[i];
        var marker = createMarker(loc);
        App.map.vehicleLayer.addLayer(marker);
    }
}

function removeVehicles(routeNum) {
    App.map.vehicleLayer.eachLayer(function(layer) {
        if (layer.routeNum === routeNum) {
            App.map.vehicleLayer.removeLayer(layer);
        }
    });
}

function initHeader() {
    var $banner = $('#banner-btn');
    var $trolley = $('#trolley-btn');
    var $bus = $('#bus-btn');

    $banner.on('click', function(e) {
        // Delay to prevent animation flicker
        setTimeout(reset, 1);
    });

    $trolley.on('click', function(e) {
        e.preventDefault();
        toggleTrolleyList();
    });

    $bus.on('click', function(e) {
        e.preventDefault();
        toggleBusList();
    });
}

function initRouteList() {
    var $bus = $('#bus-list');
    var $trolley = $('#trolley-list');
    $bus.add($trolley).on('click', 'a', function(e) {
        var $a = $(e.target);
        var routeNum = $a.attr('data-route-num');
        if (routeNum) {
            e.preventDefault();
            toggleRoute(routeNum);
            // Delay to prevent animation flicker when removing routes
            setTimeout(function() {
                hideBusList();
                hideTrolleyList();
            }, 1);
        }
    });
}

function toggleBusList() {
    if ($('#bus-list').hasClass('hide')) {
        showBusList();
    } else {
        hideBusList();
    }
}

function showBusList() {
    hideTrolleyList();
    $('#bus-list').removeClass('hide');
    $('#bus-btn').addClass('header-btn-active');
}

function hideBusList() {
    $('#bus-list').addClass('hide');
    $('#bus-btn').removeClass('header-btn-active');
}

function toggleTrolleyList() {
    if ($('#trolley-list').hasClass('hide')) {
        showTrolleyList();
    } else {
        hideTrolleyList();
    }
}

function showTrolleyList() {
    hideBusList();
    $('#trolley-list').removeClass('hide');
    $('#trolley-btn').addClass('header-btn-active');
}

function hideTrolleyList() {
    $('#trolley-list').addClass('hide');
    $('#trolley-btn').removeClass('header-btn-active');
}

function toggleRoute(routeNum) {
    var activeRouteNums = getActiveBusRoutes();
    if (activeRouteNums.indexOf(routeNum) !== -1) {
        setUrl(getUrlWithoutRoute(routeNum));
    } else {
        setUrl(getUrlWithRoute(routeNum));
    }
}

function addRoute(routeNum) {
    activateRoute(routeNum);

    fetchVehicles(routeNum)
        .then(function(vehicles) {
            removeVehicles(routeNum);
            return vehicles;
        })
        .then(addVehicles);

    return fetchRouteTrace(routeNum)
        .then(addRouteTrace);
}

function addRouteThenFitBounds(routeNum) {
    addRoute(routeNum)
        .then(fitBounds);
}

function removeRoute(routeNum) {
    deactivateRoute(routeNum);
    removeRouteTrace(routeNum);
    removeVehicles(routeNum);
}

function activateRoute(routeNum) {
    var $a = $('[data-route-num="' + routeNum + '"]');
    $a.addClass('active');
}

function deactivateRoute(routeNum) {
    var $a = $('[data-route-num="' + routeNum + '"]');
    $a.removeClass('active');
}

function fetch(url, args) {
    args = args || {};
    args.dataType = args.dataType || 'json';
    return $.ajax(url, args);
}

function fetchRouteTrace(routeNum) {
    return fetch('static/stops/' + routeNum + '.geojson', { cache: true })
        .then(function(geojson) {
            geojson.routeNum = routeNum;
            return geojson;
        });
}

function fetchAllStops() {
    return fetch('static/stops/all.json', { cache: true });
}

function parseVehicles(routeNum, data) {
    var locs = data && data.bus || [];
    for (var i = 0; i < locs.length; i++) {
        locs[i].createdAt = new Date();
        locs[i].routeNum = routeNum;
    }
    return locs;
}

function fetchVehicles(routeNum) {
    var url = '//www3.septa.org/api/TransitView/?route=' + routeNum;
    return fetch(url, { dataType: 'jsonp', cache: false })
        .then(function(data) {
            return parseVehicles(routeNum, data);
        });
}

function setUrl(url) {
    window.location.href = url;
}

function getUrl() {
    var url = window.location.href;
    var parts = url.split('#');
    return parts && parts[1] || '';
}

function getBusRoutesFromUrl(url) {
    var parts = url.split(',');
    return parts.filter(function(item) {
        return item.length > 0 &&
            item !== 'locate' && item !== 'reload';
    });
}

function getActiveBusRoutes() {
    return getBusRoutesFromUrl(App.url);
}

function getUrlWithRoute(routeNum) {
    var routeNums = getActiveBusRoutes();
    var i = routeNums.indexOf(routeNum);
    if (i === -1) {
        routeNums.push(routeNum);
    }
    return '#' + routeNums.join(',');
}

function getUrlWithoutRoute(routeNum) {
    var routeNums = getActiveBusRoutes();
    var i = routeNums.indexOf(routeNum);
    if (i !== -1) {
        routeNums.splice(i, 1);
    }
    return '#' + routeNums.join(',');
}

function fitBounds() {
    var bounds = App.map.routeTraceLayer.getBounds();
    if (bounds.isValid()) {
        App.map.leafletMap.fitBounds(bounds, {
            padding: [10, 50]
        });
    }
}

// Return items from first list that do not appear in second list.
function difference(a, b) {
    var result = [];
    for (var i = 0; i < a.length; i++) {
        if (b.indexOf(a[i]) === -1) {
            result.push(a[i]);
        }
    }
    return result;
}

function each(items, fn) {
    for (var i = 0; i < items.length; i++) {
        fn(items[i]);
    }
}

function onHashChange() {
    var prevUrl = App.url;
    var nextUrl = getUrl();
    App.url = nextUrl;

    var prevRoutes = getBusRoutesFromUrl(prevUrl);
    var nextRoutes = getBusRoutesFromUrl(nextUrl);

    var toAdd = difference(nextRoutes, prevRoutes);
    var toRemove = difference(prevRoutes, nextRoutes);

    if (nextUrl === 'locate') {
        hideBusList();
        hideTrolleyList();
        each(toRemove, removeRoute);
        App.map.leafletMap.locate({
            watch: false,
            setView: true,
            maxZoom: 16
        });
    } else if (prevUrl === 'locate') {
        each(toAdd, addRoute);
    } else if (nextUrl === 'reload') {
        var url = '#' + toRemove.join(',');
        setUrl(url);
    } else if (prevUrl === 'reload') {
        each(toAdd, addRoute);
    } else {
        each(toRemove, removeRoute);
        each(toAdd, addRouteThenFitBounds);
    }
}

function init() {
    App.map = new Map();

    initHeader();
    initRouteList();

    $(window).on('hashchange', onHashChange);
    onHashChange();

    if (getActiveBusRoutes().length > 0 ||
            App.url === 'locate') {
        hideBusList();
    }
}

init();
