#!/bin/bash

set -e

usage() {
    echo -n "$(basename "${0}") [-h|--help]

Run Django unit tests.
"
}

do_unit_tests() {
    docker-compose \
        -f docker-compose.yml \
        -f docker-compose-dev.yml \
        run --rm \
        django test
}

case $1 in
    -h|--help)
        usage
        exit 0
        ;;
    *)
        do_unit_tests
        ;;
esac
