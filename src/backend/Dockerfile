FROM python:3.6-slim

MAINTAINER kdeloach@gmail.com

RUN set -ex && apt-get update && apt-get install -y \
    curl gdal-bin less groff awscli

WORKDIR /usr/src
