FROM python:2.7-slim

MAINTAINER kdeloach@gmail.com

RUN set -ex && apt-get update && apt-get install -y \
    binutils libproj-dev gdal-bin python-gdal \
    # For pysqlite
    gcc \
    # For spatialite
    spatialite-bin \
    # For sqlite
    libsqlite3-dev

COPY requirements.txt /tmp
RUN pip install -r /tmp/requirements.txt

WORKDIR /usr/src
ENTRYPOINT ["./manage.py"]
