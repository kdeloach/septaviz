#!/bin/bash

set -e

SCRIPTS_DIR=/usr/src/scripts
TRACE_DIR=/usr/src/data/trace
BUS_ROUTES_FILE="$SCRIPTS_DIR/routes.txt"

mkdir -p $TRACE_DIR

# Download KML trace route
while read route_num; do
	file="$route_num.kml"
    path="$TRACE_DIR/$file"
	url="http://www3.septa.org/transitview/kml/$file"
    if [[ ! -e $path ]]; then
        echo "Downloading $url"
        curl $url -o $path
    fi
done < $BUS_ROUTES_FILE

# Convert KML to GeoJSON
while read route_num; do
    input="$TRACE_DIR/$route_num.kml"
    output="$TRACE_DIR/$route_num.json"
    if [[ ! -e $output ]]; then
        ogr2ogr -f GeoJSON $output $input
    fi
done < $BUS_ROUTES_FILE
