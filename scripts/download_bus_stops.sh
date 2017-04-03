#!/bin/bash

set -eu

STOPS_DIR=/usr/src/frontend/static/stops

mkdir -p $STOPS_DIR

if [[ ! -e "$STOPS_DIR/all.json" ]]; then
    pushd /tmp
    curl -Lo stops.zip \
        https://github.com/kdeloach/septa-stops/archive/1.0.zip
    unzip stops.zip
    mv septa-stops-1.0/dist/* $STOPS_DIR
    popd
fi
