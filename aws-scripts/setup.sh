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
WorkingDirectory=/opt/app
ExecStart=/opt/app/aws-scripts/server.sh
ExecStop=/usr/local/bin/docker-compose down

[Install]
WantedBy=multi-user.target
EOF

sudo systemctl daemon-reload
