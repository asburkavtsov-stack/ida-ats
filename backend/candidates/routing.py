from django.urls import re_path
from . import consumers

websocket_urlpatterns = [
    # Окремий маршрут для org-шаблону (vacancy_id відсутній)
    re_path(r'^ws/kanban/org/$', consumers.KanbanConsumer.as_asgi()),
    # Маршрут для конкретної вакансії
    re_path(r'^ws/kanban/(?P<vacancy_id>[\w-]+)/$', consumers.KanbanConsumer.as_asgi()),
]