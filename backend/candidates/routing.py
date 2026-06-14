from django.urls import re_path
from . import consumers

websocket_urlpatterns = [
    re_path(r'^ws/kanban/(?P<vacancy_id>[\w-]+)/$', consumers.KanbanConsumer.as_asgi()),
]
