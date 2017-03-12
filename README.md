# septa-viz
SEPTA API Visualization

![image](preview.png)

## Setup

```
./scripts/update.sh
./scripts/server.sh
```

Visit [https://localhost:9000/](https://192.167.1.2:9000/)

## SSL

Generate a self-signed certificate for local development:

```
> ./scripts/console.sh nginx
> openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
    -keyout /etc/nginx/ssl/septaviz.key -out /etc/nginx/ssl/septaviz.crt
```
