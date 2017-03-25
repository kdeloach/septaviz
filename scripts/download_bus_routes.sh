#!/bin/bash

set -e

DATA_DIR=/usr/data/kml
TRACE_DIR=/usr/src/frontend/static/trace
BUS_ROUTES_FILE=/usr/src/backend/routes.txt

mkdir -p $DATA_DIR
mkdir -p $TRACE_DIR

# Download KML trace route
while read route_num; do
	file="$route_num.kml"
    path="$DATA_DIR/$file"
	url="http://www3.septa.org/transitview/kml/$file"
    if [[ ! -e $path ]]; then
        echo "Downloading $url"
        curl $url -o $path
    fi
done < $BUS_ROUTES_FILE

# Convert KML to GeoJSON
while read route_num; do
    input="$DATA_DIR/$route_num.kml"
    output="$TRACE_DIR/$route_num.json"
    if [[ ! -e $output ]]; then
        ogr2ogr -f GeoJSON $output $input
    fi
done < $BUS_ROUTES_FILE
