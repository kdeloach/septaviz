#!/bin/bash

set -e

DATA_DIR=/usr/data/ssl
KEYFILE="$DATA_DIR/septaviz.key"
CERTFILE="$DATA_DIR/septaviz.crt"

mkdir -p $DATA_DIR

if [[ -e $KEYFILE ]]; then
    exit 0
fi

openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
    -keyout $KEYFILE -out $CERTFILE
