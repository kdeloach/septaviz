#!/bin/bash

set -e

function usage {
    cat << EOF
Install required dependencies for development environment.
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

sudo apt-get update
sudo apt-get install -y git python-pip
sudo apt-get install -y docker.io

sudo pip install --upgrade pip
sudo pip install docker-compose
