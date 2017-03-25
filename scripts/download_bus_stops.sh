#!/bin/bash

set -e

STOPS_DIR=/usr/src/frontend/static/stops
BUS_ROUTES_FILE=/usr/src/backend/routes.txt
ALL_STOPS_FILE="$STOPS_DIR/all.json"

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

# Combine all bus stops
if [[ ! -e $ALL_STOPS_FILE ]]; then
    /usr/src/scripts/make_all_stops_json.py > $ALL_STOPS_FILE
fi
