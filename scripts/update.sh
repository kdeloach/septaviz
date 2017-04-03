#!/bin/bash

set -e

docker-compose build

docker-compose run --rm \
    --entrypoint ./scripts/download_bus_stops.sh \
    app

docker-compose run --rm \
    --entrypoint ./scripts/make_ssl_cert.sh \
    app
