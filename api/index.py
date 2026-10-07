import os
import sys

# Ensure repository root is in python path
current_dir = os.path.dirname(os.path.abspath(__file__))
parent_dir = os.path.dirname(current_dir)
if parent_dir not in sys.path:
    sys.path.insert(0, parent_dir)

# Inspect manage.py or wsgi.py to get the exact settings module name (e.g., 'backend.settings' or 'core.settings')
# Set the matching DJANGO_SETTINGS_MODULE below:
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'backend.settings')

from django.core.wsgi import get_wsgi_application

# Vercel looks for the WSGI/ASGI 'app' callable
app = get_wsgi_application()
