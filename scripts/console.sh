#!/bin/bash

set -ex

docker-compose \
    -f docker-compose.yml \
    -f docker-compose-dev.yml \
    run --rm \
    --entrypoint /bin/bash website
