import os
from django.core.asgi import get_asgi_application
from channels.routing import ProtocolTypeRouter, URLRouter

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'ida_ats.settings')

django_asgi_app = get_asgi_application()

from candidates.routing import websocket_urlpatterns  # noqa: E402 — після setdefault

# AllowedHostsOriginValidator прибрано: не підтримує wildcard ALLOWED_HOSTS = ['*'].
# Авторизація WebSocket вже захищена через JWT у KanbanConsumer._authenticate().
application = ProtocolTypeRouter({
    'http': django_asgi_app,
    'websocket': URLRouter(websocket_urlpatterns),
})