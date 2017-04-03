FROM python:3.6-slim

MAINTAINER kdeloach@gmail.com

RUN apt-get update && apt-get install -y \
    curl \
    gdal-bin \
    less \
    groff \
    awscli \
    unzip \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /usr/src
