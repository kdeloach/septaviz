#!/bin/bash
docker-compose run --rm --entrypoint ./manage.py website $@
