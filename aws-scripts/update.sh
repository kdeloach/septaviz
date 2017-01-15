#!/bin/bash

set -ex

DIR=$(dirname "$0")

docker-compose \
    -f docker-compose.yml \
    -f docker-compose-prod.yml \
    build

"$DIR/manage.sh" migrate

sudo systemctl stop septaviz || true
sudo systemctl start septaviz
