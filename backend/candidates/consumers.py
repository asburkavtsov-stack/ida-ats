import json
from channels.generic.websocket import AsyncWebsocketConsumer
from channels.db import database_sync_to_async
from rest_framework_simplejwt.tokens import UntypedToken
from rest_framework_simplejwt.exceptions import InvalidToken, TokenError
from django.contrib.auth import get_user_model

User = get_user_model()


class KanbanConsumer(AsyncWebsocketConsumer):
    async def connect(self):
        self.vacancy_id = self.scope['url_route']['kwargs']['vacancy_id']
        self.group_name = f'kanban_{self.vacancy_id}'

        # Авторизація через JWT у query params
        token = self._get_token_from_scope()
        if not token or not await self._authenticate(token):
            await self.close(code=4001)
            return

        await self.channel_layer.group_add(self.group_name, self.channel_name)
        await self.accept()

    async def disconnect(self, close_code):
        if hasattr(self, 'group_name'):
            await self.channel_layer.group_discard(self.group_name, self.channel_name)

    async def receive(self, text_data):
        # Клієнт може надіслати ping — відповідаємо pong
        try:
            data = json.loads(text_data)
            if data.get('type') == 'ping':
                await self.send(text_data=json.dumps({'type': 'pong'}))
        except (json.JSONDecodeError, KeyError):
            pass

    # ── Обробник broadcast-повідомлень від сервера ────────────────────────────
    async def kanban_move(self, event):
        """Отримує broadcast і надсилає клієнту."""
        await self.send(text_data=json.dumps({
            'type':         'candidate_moved',
            'candidate_id': event['candidate_id'],
            'stage_id':     event['stage_id'],
            'moved_by':     event['moved_by'],
        }))

    # ── Helpers ───────────────────────────────────────────────────────────────
    def _get_token_from_scope(self):
        query_string = self.scope.get('query_string', b'').decode()
        params = dict(
            part.split('=', 1)
            for part in query_string.split('&')
            if '=' in part
        )
        return params.get('token', '')

    @database_sync_to_async
    def _authenticate(self, token):
        try:
            UntypedToken(token)
            return True
        except (InvalidToken, TokenError):
            return False