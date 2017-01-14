#!/bin/bash

set -ex

sudo apt-get update
sudo apt-get install -y git python-pip
sudo apt-get install -y docker.io

sudo pip install --upgrade pip
sudo pip install docker-compose

# TODO: Install services.
