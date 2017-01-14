#!/bin/bash

set -ex

git pull origin master --rebase
./setup.sh
./manage.sh migrate
docker-compose build
