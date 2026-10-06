import os
import sys

# Ensure project root is at the front of sys.path
path = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if path not in sys.path:
    sys.path.insert(0, path)

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'backend.settings')

try:
    from django.core.wsgi import get_wsgi_application
    application = get_wsgi_application()
except Exception as e:
    import traceback
    err_trace = traceback.format_exc()
    def application(environ, start_response):
        status = '500 Internal Server Error'
        output = f"Django WSGI Startup Error:\n{err_trace}".encode('utf-8')
        response_headers = [
            ('Content-type', 'text/plain; charset=utf-8'),
            ('Content-Length', str(len(output))),
            ('Access-Control-Allow-Origin', '*'),
            ('Access-Control-Allow-Credentials', 'true'),
            ('Access-Control-Allow-Methods', 'GET, POST, OPTIONS, PUT, DELETE, PATCH'),
            ('Access-Control-Allow-Headers', '*'),
        ]
        start_response(status, response_headers)
        return [output]

app = application
handler = application
