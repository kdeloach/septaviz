#!/bin/bash

set -e

SEPTAVIZ_ENV=${SEPTAVIZ_ENV:-dev}

function usage {
    cat << EOF
Run the frontend web server.
EOF
}

while getopts ":h" opt; do
    case $opt in
        h)
            usage
            exit 0
            ;;
        \?)
            echo "Invalid option: -$OPTARG" >&2
            exit 1
            ;;
    esac
done

if [ "$SEPTAVIZ_ENV" = "prod" ]; then
    DOCKER_COMPOSE_FILE="-f docker-compose-prod.yml"
else
    DOCKER_COMPOSE_FILE="-f docker-compose-dev.yml"
fi;

set -x

docker-compose \
    -f docker-compose.yml \
    ${DOCKER_COMPOSE_FILE} \
    up website
