#!/bin/bash

set -e

usage() {
    echo -n "$(basename "${0}") [-h|--help]

Lint Python scripts.
"
}

do_lint() {
    docker-compose \
        -f docker-compose.yml \
        -f docker-compose-dev.yml \
        run --rm \
        --entrypoint /usr/local/bin/flake8 django \
        --exclude migrations,admin.py,manage.py
}

case $1 in
    -h|--help)
        usage
        exit 0
        ;;
    *)
        do_lint
        ;;
esac
