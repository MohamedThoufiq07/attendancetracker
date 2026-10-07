import os
import sys

# Ensure repository root is in python path
current_dir = os.path.dirname(os.path.abspath(__file__))
parent_dir = os.path.dirname(current_dir)
if parent_dir not in sys.path:
    sys.path.insert(0, parent_dir)

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'backend.settings')

from django.core.wsgi import get_wsgi_application

django_app = get_wsgi_application()

def app(environ, start_response):
    # Fix PATH_INFO on Vercel Serverless
    # Vercel sets PATH_INFO to '/api/index.py' when rewriting requests.
    # The actual requested URL is passed in HTTP_X_MATCHED_PATH or REQUEST_URI or RAW_URI.
    path_info = environ.get('PATH_INFO', '')
    if '/api/index.py' in path_info or path_info == '/api/index.py':
        actual_path = (
            environ.get('HTTP_X_MATCHED_PATH') or 
            environ.get('REQUEST_URI') or 
            environ.get('RAW_URI') or 
            '/'
        )
        # Strip query strings if present
        actual_path = actual_path.split('?')[0]
        environ['PATH_INFO'] = actual_path

    return django_app(environ, start_response)
