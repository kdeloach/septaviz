// Generated with scripts/make_routes_json.py
var BUS_ROUTES = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "12", "14", "15B", "16", "17", "18", "19", "20", "21", "22", "23", "24", "25", "26", "27", "28", "29", "30", "31", "32", "33", "35", "37", "38", "39", "40", "42", "43", "44", "45", "46", "47", "47M", "48", "50", "52", "53", "54", "55", "56", "57", "58", "59", "60", "61", "62", "64", "65", "66", "67", "68", "70", "73", "75", "77", "78", "79", "80", "84", "88", "89", "90", "91", "92", "93", "94", "95", "96", "97", "98", "99", "103", "104", "105", "106", "107", "108", "109", "110", "111", "112", "113", "114", "115", "117", "118", "119", "120", "123", "124", "125", "126", "127", "128", "129", "130", "131", "132", "133", "139", "150", "201", "204", "205", "206", "310", "BSO", "MFO", "G", "H", "J", "K", "L", "R", "XH", "LUCY"];

var DEFAULT_CENTER = [39.952584, -75.165222];
var DEFAULT_ZOOM = 13;

// Only display bus stops when zoomed to this level and beyond
var STOPS_ZOOM_LEVEL = 16;

// Detect bus routes within this radius (meters)
var NEARBY_BUS_RADIUS = 500;

var PALETTE = [
    '#4C73B6',
    '#1C4CA4',
    '#F49484',
    '#F34930'
];

var busStopMarkerIcon = new L.DivIcon({
    className: 'bus-stop-marker'
});

function log() {
    console.log.apply(this, arguments);
}

function clone(obj) {
    return Object.assign({}, obj);
}

function arrayEqual(a, b) {
    a.sort();
    b.sort();
    a = a.join(',');
    b = b.join(',');
    return a === b;
}

function arrayRemoveIndex(arr, index) {
    var head = arr.slice(0, index);
    var tail = arr.slice(index + 1, arr.length);
    return head.concat(tail);
}

var uniqueId = (function() {
    var i = 0;
    return function() {
        return i++;
    };
}());

var routeTraceColor = (function() {
    var memo = {};
    var i = 0;
    return function(routeNum) {
        if (typeof memo[routeNum] === 'undefined') {
            memo[routeNum] = i++;
        }
        return PALETTE[memo[routeNum] % PALETTE.length];
    };
}());

function removeMarkers(layer) {
    layer.eachLayer(function(child) {
        if (child instanceof L.Marker) {
            layer.removeLayer(child);
        } else if (child.getLayers) {
            removeMarkers(child);
        }
    });
}

function State(initialState, onStateChanged) {
    this.onStateChanged = onStateChanged;
    this._state = clone(initialState);
    this._nextState = clone(initialState);
}
State.prototype.getPrevState = function() {
    return new State(this._prevState);
};

// Flush queued state changes by copying _nextState to _state
State.prototype.update = function() {
    this._prevState = this._state;
    this._state = clone(this._nextState);
    this.onStateChanged();
};

// Setters queue next state value using _nextState
State.prototype.setMenuActive = function(value) {
    this._nextState.menuActive = value;
    return this;
};
State.prototype.setLocation = function(latlng) {
    this._nextState.location = latlng;
    return this;
};
// This value cannot be changed once set to true
State.prototype.setAllStopsNeeded = function() {
    this._nextState.allStopsNeeded = true;
    return this;
};
State.prototype.setAllStops = function(stops) {
    this._nextState.allStops = stops;
    return this;
};
State.prototype.setActiveBusRoutes = function(routeNums) {
    log('setActiveBusRoutes', routeNums);
    this._nextState.busRoutes = routeNums;
    if (!arrayEqual(this.getActiveBusRoutes(), routeNums)) {
        this._nextState.busRoutesID = uniqueId();
    }
    return this;
};
State.prototype.setRouteTrace = function(routeNum, geojson) {
    if (!geojson) {
        throw Exception('Invalid route trace GeoJSON');
    }
    log('setRouteTrace', routeNum);
    this._nextState.routeTrace = this._nextState.routeTrace || {};
    this._nextState.routeTrace[routeNum] = geojson;
    this._nextState.routeTraceID = uniqueId();
    return this;
};
State.prototype.setStops = function(routeNum, data) {
    if (!data) {
        throw Exception('Invalid stops data');
    }
    log('setStops', routeNum);
    this._nextState.stops = this._nextState.stops || {};
    this._nextState.stops[routeNum] = data;
    this._nextState.stopsID = uniqueId();
    return this;
};
State.prototype.setVehicles = function(routeNum, data) {
    if (!data) {
        throw Exception('Invalid vehicles data');
    }
    log('setVehicles', routeNum);
    this._nextState.vehicles = this._nextState.vehicles || {};
    this._nextState.vehicles[routeNum] = data;
    this._nextState.vehiclesID = uniqueId();
    return this;
};

// Getters return current values from _state
State.prototype.isMenuActive = function() {
    return !!this._state.menuActive;
};

State.prototype.getAllStops = function() {
    return this._state.allStops;
};
State.prototype.getActiveBusRoutesID = function() {
    return this._state.busRoutesID;
};
State.prototype.getRouteTraceID = function() {
    return this._state.routeTraceID;
};
State.prototype.getStopsID = function() {
    return this._state.stopsID;
};
State.prototype.getVehiclesID = function() {
    return this._state.vehiclesID;
};
State.prototype.getActiveBusRoutes = function() {
    return this._state.busRoutes || [];
};
State.prototype.getRouteTrace = function(routeNum) {
    return this._state.routeTrace && this._state.routeTrace[routeNum];
};
State.prototype.getStops = function(routeNum) {
    return this._state.stops && this._state.stops[routeNum];
};
State.prototype.getVehicles = function(routeNum) {
    return this._state.vehicles && this._state.vehicles[routeNum];
};
State.prototype.getLocation = function() {
    return this._state.location;
};
State.prototype.isAllStopsLoaded = function() {
    return !!this.getAllStops();
};
State.prototype.isAllStopsNeeded = function() {
    return !!this._state.allStopsNeeded;
};
State.prototype.isBusRouteActive = function(routeNum) {
    if (routeNum === 'all') {
        return true;
    }
    return this.getActiveBusRoutes().indexOf(routeNum) !== -1;
};
State.prototype.isRouteTraceLoaded = function(routeNum) {
    return !!this.getRouteTrace(routeNum);
};
State.prototype.isStopsLoaded = function(routeNum) {
    return !!this.getStops(routeNum);
};
State.prototype.isVehiclesRecent = function(routeNum) {
    return !!this.getVehicles(routeNum);
};

function Map(app) {
    this.state = app.state;
    this.router = app.router;
    this.$el = $('#map');
    this.initMap();
    this.bindEvents();
}
Map.prototype.initMap = function() {
    var map = this.map = new L.Map('map', {
        minZoom: 10,
        zoomControl: false
    });

    var baseLayer = new L.TileLayer('//cartodb-basemaps-{s}.global.ssl.fastly.net/light_all/{z}/{x}/{y}.png', {
        attribution: '&copy; <a href="http://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="http://cartodb.com/attributions">CartoDB</a>',
        subdomains: 'abcd',
        maxZoom: 19
    });
    map.addLayer(baseLayer);

    map.addControl(new L.Control.Zoom({
        position: 'bottomright'
    }));
    map.addControl(new L.Control.Locate({
        position: 'bottomright',
        keepCurrentZoomLevel: true,
        drawCircle: false,
        drawMarker: false
    }));

    this.vehicleLayer = new L.FeatureGroup();
    this.routeTraceLayer = new L.FeatureGroup();
    this.stopsLayer = new L.FeatureGroup();
    this.searchLayer = new L.FeatureGroup();

    // Note that stopsLayer is not visible by default
    map.addLayer(this.vehicleLayer);
    map.addLayer(this.routeTraceLayer);
    map.addLayer(this.searchLayer);

    map.setView(DEFAULT_CENTER, DEFAULT_ZOOM);
};
Map.prototype.bindEvents = function() {
    this.map.on('zoomend', this.onZoomChanged.bind(this));
    this.map.on('locationfound', this.onLocationFound.bind(this));
};
Map.prototype.onZoomChanged = function() {
    this.hideOrShowStops();
};
Map.prototype.onLocationFound = function(e) {
    this.map.stopLocate();
    this.state.setLocation(e.latlng)
        .setAllStopsNeeded()
        .update();
};
// Return first point found inside LatLngBounds or false if none found.
Map.prototype.findPointInBounds = function(bounds, points) {
    for (var i = 0; i < points.length; i++) {
        var point = points[i];
        if (bounds.contains(point)) {
            return true;
        }
    }
    return false;
};
// Return list of bus routes within LatLngBounds.
Map.prototype.findRoutesWithinBounds = function(bounds, stops) {
    var result = [];
    for (var routeNum in stops) {
        var points = stops[routeNum];
        if (this.findPointInBounds(bounds, points)) {
            result.push(routeNum);
        }
    }
    return result;
};
Map.prototype.locateBusRoutes = function() {
    var stops = this.state.getAllStops();
    var latlng = this.state.getLocation();

    if (!stops) {
        return;
    } else if (!latlng) {
        return;
    }

    this.searchLayer.clearLayers();
    var circle = new L.Circle(latlng, NEARBY_BUS_RADIUS);
    this.searchLayer.addLayer(circle);
    var bounds = circle.getBounds();

    var marker = new L.Marker(latlng, {
        draggable: true
    });
    marker.on('dragend', function(e) {
        this.state.setLocation(marker.getLatLng()).update();
    }.bind(this));
    this.searchLayer.addLayer(marker);

    this.map.fitBounds(circle.getBounds());

    var routeNums = this.findRoutesWithinBounds(bounds, stops);
    var url = '#' + routeNums.join(',');
    this.router.route(url);
};
Map.prototype.update = function() {
    var state = this.state;
    var prevState = this.state.getPrevState();

    // Render everything if active bus routes changed
    if (prevState.getActiveBusRoutesID() !== state.getActiveBusRoutesID()) {
        this.renderRouteTrace();
        this.renderStops();
        this.renderVehicles();
        return;
    }

    // Partial render depending on which data has loaded
    if (prevState.getRouteTraceID() !== state.getRouteTraceID()) {
        this.renderRouteTrace();
    }
    if (prevState.getStopsID() !== state.getStopsID()) {
        this.renderStops();
    }
    if (prevState.getVehiclesID() !== state.getVehiclesID()) {
        this.renderVehicles();
    }

    if (prevState.getLocation() !== state.getLocation()) {
        this.locateBusRoutes();
    } else if (prevState.isAllStopsLoaded() !== state.isAllStopsLoaded()) {
        this.locateBusRoutes();
    }
};
Map.prototype.renderRouteTrace = function() {
    log('renderRouteTrace');
    var routeNums = this.state.getActiveBusRoutes();

    this.routeTraceLayer.clearLayers();

    for (var i = 0; i < routeNums.length; i++) {
        var routeNum = routeNums[i];
        var geojson = this.state.getRouteTrace(routeNum);
        if (!geojson) {
            continue;
        }
        var layer = new L.GeoJSON(geojson, {
            color: routeTraceColor(routeNum),
            weight: 3
        });
        this.routeTraceLayer.addLayer(layer);
    }

    // Remove marker present in some route traces
    removeMarkers(this.routeTraceLayer);
};
Map.prototype.hideOrShowStops = function() {
    log('hideOrShowStops');
    if (this.map.getZoom() < STOPS_ZOOM_LEVEL) {
        this.map.removeLayer(this.stopsLayer);
    } else {
        this.map.addLayer(this.stopsLayer);
    }
};
Map.prototype.renderStops = function() {
    log('renderStops');
    var routeNums = this.state.getActiveBusRoutes();
    this.stopsLayer.clearLayers();
    for (var i = 0; i < routeNums.length; i++) {
        var routeNum = routeNums[i];
        var stops = this.state.getStops(routeNum);
        if (!stops) {
            continue;
        }
        for (var j = 0; j < stops.length; j++) {
            var stop = stops[j];
            var marker = new L.Marker([stop.lat, stop.lng], {
                icon: busStopMarkerIcon,
                zIndexOffset: 100
            });
            this.stopsLayer.addLayer(marker);
        }
    }
};
Map.prototype.getMarkerDirection = function(loc) {
    var direction = loc.Direction.toLocaleLowerCase();
    switch (direction) {
        case 'northbound':
        case 'eastbound':
        case 'southbound':
        case 'westbound':
            return direction;
    }
    return '';
};
Map.prototype.getMarkerClassName = function(routeNum, loc) {
    var result = [
        'vehicle-marker',
        this.getMarkerDirection(loc)
    ];
    if (routeNum.length > 2) {
        result.push('condensed');
    }
    return result.join(' ');
};
Map.prototype.getMarkerHtml = function(routeNum, loc) {
    var result = [routeNum];
    var direction = this.getMarkerDirection(loc);
    if (direction.length) {
        result.push('<div class="vehicle-marker-arrow"></div>');
    }
    return result.join('');
};
Map.prototype.getMarkerContent = function(loc) {
    var now = new Date();
    var offsetMS = parseInt(loc.Offset_sec, 10) * 1000;
    var reportedAt = new Date(loc.createdAt.getTime() - offsetMS);
    var elapsedSec = (now.getTime() - reportedAt.getTime()) / 1000;
    var min = Math.round(elapsedSec / 60);
    if (min < 1) {
        return 'Updated less than 1 minute ago';
    } else {
        return 'Updated ' + min + 'm ago';
    }
};
Map.prototype.renderVehicles = function() {
    log('renderVehicles');
    var routeNums = this.state.getActiveBusRoutes();

    var updateMarkerContent = function(loc) {
        return function(e) {
            e.popup.setContent(this.getMarkerContent(loc));
        }.bind(this);
    }.bind(this);

    this.vehicleLayer.clearLayers();

    this.vehicleLayer.eachLayer(function(marker) {
        marker.alive = false;
    });

    for (var i = 0; i < routeNums.length; i++) {
        var routeNum = routeNums[i];
        var vehicles = this.state.getVehicles(routeNum);
        if (!vehicles) {
            continue;
        }
        for (var j = 0; j < vehicles.length; j++) {
            var loc = vehicles[j];
            var marker = new L.Marker(loc, {
                icon: new L.DivIcon({
                    className: this.getMarkerClassName(routeNum, loc),
                    iconSize: [50, 50],
                    html: this.getMarkerHtml(routeNum, loc)
                }),
                zIndexOffset: 200
            });
            marker.on('popupopen', updateMarkerContent(loc));
            marker.bindPopup('', {
                offset: [0, -5]
            });
            marker.alive = true;
            this.vehicleLayer.addLayer(marker);
        }
    }

    this.vehicleLayer.eachLayer(function(marker) {
        if (!marker.alive) {
            this.vehicleLayer.removeLayer(marker);
        }
    });

};
Map.prototype.render = function() {};

function Header(app) {
    this.state = app.state;
    this.$el = $('#header');
    this.$menuBtn = this.$el.find('#menu-btn');
    this.bindEvents();
}
Header.prototype.bindEvents = function() {
    var state = this.state;
    this.$menuBtn.on('click', function(e) {
        e.preventDefault();
        state.setMenuActive(!state.isMenuActive()).update();
    });
};
Header.prototype.update = function() {
    this.$menuBtn.toggleClass('header-btn-active', this.state.isMenuActive());
};

function Menu(app) {
    this.state = app.state;
    this.router = app.router;
    this.$el = $('#menu');
    this.bindEvents();
    this.render();
}
Menu.prototype.bindEvents = function() {
    this.$el.on('click', 'a', this.onMenuItemClicked.bind(this));
};
Menu.prototype.onMenuItemClicked = function(e) {
    e.preventDefault();
    var $a = $(e.target);
    var routeNum = $a.attr('data-route-num');
    var activeRouteNums = this.state.getActiveBusRoutes();
    var routeNums = this.toggleBusRoute(activeRouteNums, routeNum);
    var url = '#' + routeNums.join(',');
    this.router.route(url);
};
// Toggle bus route from list of bus routes.
// Ex.
// toggleBusRoute([1, 2], 3) -> [1, 2, 3]
// toggleBusRoute([1, 2, 3], 3) -> [1, 2]
Menu.prototype.toggleBusRoute = function(routeNums, routeNum) {
    var index = routeNums.indexOf(routeNum);
    if (index !== -1) {
        return arrayRemoveIndex(routeNums, index);
    }
    return routeNums.concat(routeNum);
};
Menu.prototype.show = function() {
    this.$el.show();
};
Menu.prototype.hide = function() {
    this.$el.hide();
};
Menu.prototype.update = function() {
    var menuActive = this.state.isMenuActive();
    if (menuActive !== this.state.getPrevState().isMenuActive()) {
        if (menuActive) {
            this.show();
        } else {
            this.hide();
        }
    }
};
Menu.prototype.render = function() {
    var $fragment = $('<div>');
    for (var i = 0; i < BUS_ROUTES.length; i++) {
        var routeNum = BUS_ROUTES[i];
        var $a = $('<a>')
            .attr('href', '#' + routeNum)
            .attr('data-route-num', routeNum)
            .text(routeNum);
        $fragment.append($a);
    }
    this.$el.html($fragment.html());
};

function Loader(app) {
    this.state = app.state;
    this.requests = [];
}
Loader.prototype.shouldCancelRequest = function(request) {
    if (this.isRequestDone(request)) {
        return false;
    } else if (this.state.isBusRouteActive(request.routeNum)) {
        return false;
    }
    return true;
};
// Cancel requests for bus routes that are no longer active.
Loader.prototype.cancel = function() {
    for (var i = 0; i < this.requests.length; i++) {
        var request = this.requests[i];
        if (this.shouldCancelRequest(request)) {
            log('cancel', request);
            request.xhr.reject();
        }
    }
};
Loader.prototype.isRequestDone = function(request) {
    return request.xhr.state() !== 'pending';
};
Loader.prototype.prune = function() {
    var result = [];
    for (var i = 0; i < this.requests.length; i++) {
        var request = this.requests[i];
        if (this.isRequestDone(request)) {
            log('prune', request);
            continue;
        }
        result.push(request);
    }
    this.requests = result;
};
Loader.prototype.isAllStopsLoading = function() {
    for (var i = 0; i < this.requests.length; i++) {
        var request = this.requests[i];
        if (request.kind === 'allstops') {
            return true;
        }
    }
    return false;
};
Loader.prototype.isRouteTraceLoading = function(routeNum) {
    for (var i = 0; i < this.requests.length; i++) {
        var request = this.requests[i];
        if (request.kind === 'trace' && request.routeNum === routeNum) {
            return true;
        }
    }
    return false;
};
Loader.prototype.isStopsLoading = function(routeNum) {
    for (var i = 0; i < this.requests.length; i++) {
        var request = this.requests[i];
        if (request.kind === 'stops' && request.routeNum === routeNum) {
            return true;
        }
    }
    return false;
};
Loader.prototype.isVehiclesLoading = function(routeNum) {
    for (var i = 0; i < this.requests.length; i++) {
        var request = this.requests[i];
        if (request.kind === 'vehicles' && request.routeNum === routeNum) {
            return true;
        }
    }
    return false;
};
Loader.prototype.shouldLoadAllStops = function() {
    if (this.state.isAllStopsLoaded()) {
        return false;
    } else if (this.isAllStopsLoading()) {
        return false;
    }
    return this.state.isAllStopsNeeded();
};
// Don't load route trace if it's been loaded or loading is in progress.
Loader.prototype.shouldLoadRouteTrace = function(routeNum) {
    if (this.state.isRouteTraceLoaded(routeNum)) {
        return false;
    } else if (this.isRouteTraceLoading(routeNum)) {
        return false;
    }
    return true;
};
// Don't load bus stops if they've been loaded or loading is in progress.
Loader.prototype.shouldLoadStops = function(routeNum) {
    if (this.state.isStopsLoaded(routeNum)) {
        return false;
    } else if (this.isStopsLoading(routeNum)) {
        return false;
    }
    return true;
};
// Don't load vehicles if loading is in progress.
Loader.prototype.shouldLoadVehicles = function(routeNum) {
    if (this.state.isVehiclesRecent(routeNum)) {
        return false;
    } else if (this.isVehiclesLoading(routeNum)) {
        return false;
    }
    return true;
};
Loader.prototype.fetch = function(url, args) {
    log('fetch', url);
    args = args || {};
    args.dataType = args.dataType || 'json';
    return $.ajax(url, args);
};
Loader.prototype.createRouteTraceRequest = function(routeNum) {
    return {
        kind: 'trace',
        routeNum: routeNum,
        xhr: this.fetch('static/trace/' + routeNum + '.json')
    };
};
Loader.prototype.createStopsRequest = function(routeNum) {
    return {
        kind: 'stops',
        routeNum: routeNum,
        xhr: this.fetch('static/stops/' + routeNum + '.json')
    };
};
Loader.prototype.createAllStopsRequest = function() {
    return {
        kind: 'allstops',
        xhr: this.fetch('static/stops/all.json')
    };
};
Loader.prototype.parseVehiclesData = function(data) {
    var locs = data && data.bus || [];
    for (var i = 0; i < locs.length; i++) {
        locs[i].createdAt = new Date();
    }
    return locs;
};
Loader.prototype.createVehiclesRequest = function(routeNum) {
    var url = '//www3.septa.org/api/TransitView/?route=' + routeNum;
    var xhr = this.fetch(url, {
            dataType: 'jsonp'
        }).then(this.parseVehiclesData.bind(this));
    return {
        kind: 'vehicles',
        routeNum: routeNum,
        xhr: xhr
    };
};
Loader.prototype.resolveRequest = function(request, data) {
    log('resolve', request);
    if (request.kind === 'trace') {
        this.state.setRouteTrace(request.routeNum, data).update();
    } else if (request.kind === 'stops') {
        this.state.setStops(request.routeNum, data).update();
    } else if (request.kind === 'allstops') {
        this.state.setAllStops(data).update();
    } else if (request.kind === 'vehicles') {
        this.state.setVehicles(request.routeNum, data).update();
    } else {
        throw Error('Unable to resolve request');
    }
};
Loader.prototype.load = function() {
    var routeNums = this.state.getActiveBusRoutes();

    var resolve = function(request) {
        return function(data) {
            this.resolveRequest(request, data);
        }.bind(this);
    }.bind(this);

    for (var i = 0; i < routeNums.length; i++) {
        var routeNum = routeNums[i];
        if (this.shouldLoadRouteTrace(routeNum)) {
            var request = this.createRouteTraceRequest(routeNum);
            log('load trace', request);
            request.xhr.done(resolve(request));
            this.requests.push(request);
        }
        if (this.shouldLoadStops(routeNum)) {
            var request = this.createStopsRequest(routeNum);
            log('load stops', request);
            request.xhr.done(resolve(request));
            this.requests.push(request);
        }
        if (this.shouldLoadVehicles(routeNum)) {
            var request = this.createVehiclesRequest(routeNum);
            log('load vehicles', request);
            request.xhr.done(resolve(request));
            this.requests.push(request);
        }
    }

    if (this.shouldLoadAllStops()) {
        var request = this.createAllStopsRequest();
        log('load all stops', request);
        request.xhr.done(resolve(request));
        this.requests.push(request);
    }
};
Loader.prototype.update = function() {
    this.cancel();
    this.prune();
    this.load();
};

function Router(onRouteChanged) {
    this.onRouteChanged = onRouteChanged;
    this.bindEvents();
}
Router.prototype.bindEvents = function() {
    $(window).on('hashchange', this.onHashChange.bind(this));
};
Router.prototype.onHashChange = function() {
    this.onRouteChanged(this.getRouteUrl());
};
Router.prototype.getRouteUrl = function() {
    var url = window.location.href;
    var parts = url.split('#');
    return parts && parts[1] || '';
};
Router.prototype.route = function(url) {
    window.location.href = url;
};

function App() {
    var initialState = {
        menuActive: true
    };

    this.state = new State(initialState, this.update.bind(this));
    this.router = new Router(this.onRouteChanged.bind(this));

    this.map = new Map(this);
    this.header = new Header(this);
    this.menu = new Menu(this);
    this.loader = new Loader(this);

    this.onRouteChanged(this.router.getRouteUrl());
}
App.prototype.update = function() {
    log('update');
    this.map.update();
    this.header.update();
    this.menu.update();
    this.loader.update();
};
App.prototype.onRouteChanged = function(routeUrl) {
    log('onRouteChanged', routeUrl);
    if (routeUrl.length > 0) {
        var routeNums = routeUrl.split(',');
        this.showBusRoutes(routeNums);
    } else {
        this.showMenu();
    }
};
App.prototype.showMenu = function() {
    log('showMenu');
    this.state
        .setMenuActive(true)
        .setActiveBusRoutes([])
        .update();
};
App.prototype.showBusRoutes = function(routeNums) {
    log('showBusRoutes', routeNums);
    this.state
        .setMenuActive(false)
        .setActiveBusRoutes(routeNums)
        .update();
};

window.app = new App();
