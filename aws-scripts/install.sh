#!/bin/bash

set -ex

DIR=$(dirname "$0")

git pull origin master --rebase

"$DIR/setup.sh"
"$DIR/update.sh"
