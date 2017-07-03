#!/bin/bash

set -e
set -u

git rev-parse HEAD > ./src/frontend/version.txt

docker-compose run --rm \
    --entrypoint aws \
    --workdir /usr/src/frontend \
    app \
    s3 sync --delete . s3://septaviz.kevinx.net
