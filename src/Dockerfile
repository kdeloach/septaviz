FROM python:2.7-slim

MAINTAINER kdeloach@gmail.com

COPY requirements.txt /tmp
RUN pip install -r /tmp/requirements.txt

WORKDIR /usr/src
ENTRYPOINT /bin/bash
