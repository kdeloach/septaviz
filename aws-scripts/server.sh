#!/bin/bash

set -ex

docker-compose \
    -f docker-compose.yml \
    -f docker-compose-prod.yml \
    up
