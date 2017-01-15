#!/bin/bash

set -ex

sudo apt-get update
sudo apt-get install -y git python-pip
sudo apt-get install -y docker.io

sudo pip install --upgrade pip
sudo pip install docker-compose

cat << EOF | sudo tee /lib/systemd/system/septaviz.service > /dev/null
[Unit]
Description=septaviz

[Service]
WorkingDirectory=/home/ubuntu/septa-viz
ExecStart=/usr/local/bin/docker-compose \
    -f docker-compose.yml \
    -f docker-compose-prod.yml \
    up
ExecStop=/usr/local/bin/docker-compose down

[Install]
WantedBy=multi-user.target
EOF

sudo systemctl daemon-reload
