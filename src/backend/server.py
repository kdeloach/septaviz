#!/usr/bin/env python
import os
import sys
import ssl

from http.server import HTTPServer, SimpleHTTPRequestHandler
from socketserver import BaseServer

host = sys.argv[1]
port = int(sys.argv[2])

os.chdir('/usr/src/frontend')

httpd = HTTPServer((host, port), SimpleHTTPRequestHandler)
httpd.socket = ssl.wrap_socket(httpd.socket,
                               certfile='/usr/data/ssl/septaviz.crt',
                               keyfile='/usr/data/ssl/septaviz.key',
                               server_side=True)

print(f'Running website at https://{host}:{port}...')
sys.stdout.flush()

httpd.serve_forever()
