#!/bin/bash

set -ex

DIR=$(dirname "$0")

git pull origin master --rebase

"$DIR/setup.sh"

docker-compose \
    -f docker-compose.yml \
    -f docker-compose-prod.yml \
    build

"$DIR/manage.sh" migrate

sudo systemctl stop septaviz || true
sudo systemctl start septaviz
