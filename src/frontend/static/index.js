// Generated with scripts/make_routes_json.py
var BUS_ROUTES = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "12", "14", "15B", "16", "17", "18", "19", "20", "21", "22", "23", "24", "25", "26", "27", "28", "29", "30", "31", "32", "33", "35", "37", "38", "39", "40", "42", "43", "44", "45", "46", "47", "47M", "48", "50", "52", "53", "54", "55", "56", "57", "58", "59", "60", "61", "62", "64", "65", "66", "67", "68", "70", "73", "75", "77", "78", "79", "80", "84", "88", "89", "90", "91", "92", "93", "94", "95", "96", "97", "98", "99", "103", "104", "105", "106", "107", "108", "109", "110", "111", "112", "113", "114", "115", "117", "118", "119", "120", "123", "124", "125", "126", "127", "128", "129", "130", "131", "132", "133", "139", "150", "201", "204", "205", "206", "310", "BSO", "MFO", "G", "H", "J", "K", "L", "R", "XH", "LUCY"];

var DEFAULT_CENTER = [39.952584, -75.165222];
var DEFAULT_ZOOM = 13;

// Detect bus routes within this radius (meters)
var NEARBY_BUS_RADIUS = 500;

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

    map.on('locationfound', function(e) {
        var latlng = e.latlng;
        fetchAllStops().then(function(stops) {
            locateRoutes(stops, latlng);
        });
    });

    map.on('locationerror', function(e) {
        alert(e.message);
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
    var layer = new L.GeoJSON(geojson, {
        color: nextRouteTraceColor(),
        weight: 3
    });
    layer.routeNum = geojson.routeNum;
    App.map.routeTraceLayer.addLayer(layer);
}

function removeRouteTrace(routeNum) {
    App.map.routeTraceLayer.eachLayer(function(layer) {
        if (layer.routeNum === routeNum) {
            layer.remove();
        }
    });
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
        'vehicle-marker',
        this.getMarkerDirection(loc)
    ];
    if (loc.routeNum.length > 2) {
        result.push('condensed');
    }
    return result.join(' ');
}

function getMarkerHtml(loc) {
    var result = [loc.routeNum];
    var direction = getMarkerDirection(loc);
    if (direction.length) {
        result.push('<div class="vehicle-marker-arrow"></div>');
    }
    return result.join('');
}

function getMarkerContent(loc) {
    var now = new Date();
    var offsetMs = parseInt(loc.Offset_sec, 10) * 1000;
    var reportedAt = new Date(loc.createdAt.getTime() - offsetMs);
    var elapsedSec = (now.getTime() - reportedAt.getTime()) / 1000;
    var min = Math.round(elapsedSec / 60);
    var s = min === 1 ? '' : 's';
    if (min < 1) {
        return 'Updated less than 1 minute ago';
    } else {
        return 'Updated ' + min + ' minute' + s + ' ago';
    }
}

function addVehicles(vehicles) {
    function createMarker(loc) {
        var marker = new L.Marker(loc, {
            icon: new L.DivIcon({
                iconSize: [50, 50],
                className: getMarkerClassName(loc),
                html: getMarkerHtml(loc)
            })
        });
        marker.routeNum = loc.routeNum;
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
            layer.remove();
        }
    });
}

function initHeader() {
    var $menu = $('#menu-btn');
    var $find = $('#find-btn');

    $menu.on('click', function(e) {
        e.preventDefault();
        toggleMenu();
    });

    $find.on('click', function(e) {
        e.preventDefault();
        App.map.leafletMap.locate({
            watch: false,
            setView: true,
            maxZoom: 16
        });
        $find.addClass('header-btn-active');
        hideMenu();
    });
}

function initMenu() {
    var $el = $('#menu');

    // Events
    $el.on('click', 'a', function(e) {
        var $a = $(e.target);
        var routeNum = $a.attr('data-route-num');
        if (routeNum) {
            e.preventDefault();
            toggleRoute(routeNum);
            toggleMenu();
        }
    });

    // Template
    var $fragment = $('<div>');
    for (var i = 0; i < BUS_ROUTES.length; i++) {
        var routeNum = BUS_ROUTES[i];
        var $a = $('<a>')
            .attr('href', '#' + routeNum)
            .attr('data-route-num', routeNum)
            .text(routeNum);
        $fragment.append($a);
    }
    $el.html($fragment.html());
}

function toggleMenu() {
    if ($('#menu').is(':visible')) {
        hideMenu();
    } else {
        showMenu();
    }
}

function showMenu() {
    $('#menu').show();
    $('#menu-btn').addClass('header-btn-active');
}

function hideMenu() {
    $('#menu').hide();
    $('#menu-btn').removeClass('header-btn-active');
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
    var $a = $('#menu [data-route-num="' + routeNum + '"]');
    $a.addClass('active');

    fetchRouteTrace(routeNum)
        .then(addRouteTrace);
    return fetchVehicles(routeNum)
        .then(addVehicles);
}

function removeRoute(routeNum) {
    var $a = $('#menu [data-route-num="' + routeNum + '"]');
    $a.removeClass('active');

    removeRouteTrace(routeNum);
    removeVehicles(routeNum);
}

function fetch(url, args) {
    args = args || {};
    args.dataType = args.dataType || 'json';
    return $.ajax(url, args);
}

function fetchRouteTrace(routeNum) {
    return fetch('static/stops/' + routeNum + '.geojson')
        .then(function(geojson) {
            geojson.routeNum = routeNum;
            return geojson;
        });
}

function fetchAllStops() {
    return fetch('static/stops/all.json');
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
    return fetch(url, { dataType: 'jsonp' })
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

function filterEmpty(arr) {
    return arr.filter(function(n) {
        return n;
    });
}

function getBusRoutesFromUrl(url) {
    return filterEmpty(url.split(','));
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
    var bounds = App.map.vehicleLayer.getBounds();
    if (bounds.isValid()) {
        App.map.leafletMap.fitBounds(bounds, {
            padding: [10, 10]
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

function onHashChange() {
    var prevUrl = App.url;
    var nextUrl = getUrl();

    var prevRoutes = getBusRoutesFromUrl(prevUrl);
    var nextRoutes = getBusRoutesFromUrl(nextUrl);

    var toAdd = difference(nextRoutes, prevRoutes);
    var toRemove = difference(prevRoutes, nextRoutes);

    for (var i = 0; i < toAdd.length; i++) {
        addRoute(toAdd[i]);
    }

    for (var i = 0; i < toRemove.length; i++) {
        removeRoute(toRemove[i]);
    }

    App.url = nextUrl;
}

function init() {
    App.map = new Map();

    initMenu();
    initHeader();

    $(window).on('hashchange', onHashChange);
    onHashChange();

    if (getActiveBusRoutes().length === 0) {
        showMenu();
    } else {
        hideMenu();
    }
}

init();
