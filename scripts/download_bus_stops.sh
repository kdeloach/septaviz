#!/bin/bash

set -e

SCRIPTS_DIR=/usr/src/scripts
STOPS_DIR=/usr/src/data/stops
BUS_ROUTES_FILE="$SCRIPTS_DIR/routes.txt"

mkdir -p $STOPS_DIR

# Download bus stops
while read route_num; do
	file="$route_num.json"
    path="$STOPS_DIR/$file"
	url="http://www3.septa.org/hackathon/Stops/$route_num"
    if [[ ! -e $path ]]; then
        echo "Downloading $url"
        curl $url -o $path
    fi
done < $BUS_ROUTES_FILE
