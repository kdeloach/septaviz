#!/bin/bash

set -ex

docker-compose run --rm --entrypoint ./manage.py website $@
