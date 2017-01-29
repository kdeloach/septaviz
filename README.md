# septa-viz
SEPTA API Visualization

Staging: [http://54.173.102.251/](http://54.173.102.251/)

![image](preview.png)

## Setup

```
./scripts/update.sh
./scripts/server.sh
```

## SSL

Generate a self-signed certificate for local development:

```
./scripts/console.sh nginx
openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
    -keyout /etc/nginx/ssl/septaviz.key -out /etc/nginx/ssl/septaviz.crt
```
