#!/bin/bash

set -e

usage() {
    echo -n "$(basename "${0}") [OPTION]

Options:
    django
    nginx
"
}

console_run() {
    docker-compose \
        -f docker-compose.yml \
        -f docker-compose-dev.yml \
        run --rm \
        --entrypoint /bin/bash $1
}

case $1 in
    django|nginx)
        console_run $1
        ;;
    *)
        usage
        exit 1
        ;;
esac
