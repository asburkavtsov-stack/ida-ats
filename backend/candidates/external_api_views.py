"""
external_api_views.py
======================
Зовнішнє REST API для інтеграцій з IDA ATS.

Авторизація:
    Header: Authorization: Bearer ida_<token>
    або     X-API-Key: ida_<token>

Всі ендпоінти ізольовані від внутрішнього API — окремий namespace /api/v1/ext/
"""

import hashlib
import hmac
import json
import logging
import time

import requests as http_requests
from django.utils import timezone
from rest_framework import serializers, status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny, BasePermission
from rest_framework.response import Response
from rest_framework.views import APIView

from .throttles import ExternalAPIThrottle
from .models import (
    Candidate, ExternalAPIKey, Organization, Vacancy, VacancyStage,
    WebhookEndpoint, WebhookLog,
)

logger = logging.getLogger(__name__)


# ─── Авторизація по API Key ───────────────────────────────────────────────────

def _extract_api_key(request):
    """Витягує raw key з заголовків Authorization: Bearer ... або X-API-Key: ..."""
    auth = request.headers.get('Authorization', '')
    if auth.startswith('Bearer '):
        return auth[7:].strip()
    return request.headers.get('X-API-Key', '').strip()


class ExternalAPIKeyPermission(BasePermission):
    """
    Базовий permission для зовнішнього API.
    Встановлює request.api_key і request.api_org після успішної перевірки.
    """
    message = 'Недійсний або відсутній API-ключ.'

    def has_permission(self, request, view):
        raw_key = _extract_api_key(request)
        if not raw_key:
            return False
        api_key = ExternalAPIKey.authenticate(raw_key)
        if not api_key:
            return False
        request.api_key = api_key
        request.api_org = api_key.organization
        return True


class ReadOnlyAPIKeyPermission(ExternalAPIKeyPermission):
    """Дозволяє будь-який scope (read, write, full)."""
    pass


class WriteAPIKeyPermission(ExternalAPIKeyPermission):
    """Вимагає scope write або full."""
    message = 'Для цієї дії потрібен ключ зі scope write або full.'

    def has_permission(self, request, view):
        if not super().has_permission(request, view):
            return False
        return request.api_key.scope in ('write', 'full')


class FullAPIKeyPermission(ExternalAPIKeyPermission):
    """Вимагає scope full."""
    message = 'Для цієї дії потрібен ключ зі scope full.'

    def has_permission(self, request, view):
        if not super().has_permission(request, view):
            return False
        return request.api_key.scope == 'full'


# ─── Серіалайзери зовнішнього API ────────────────────────────────────────────

class ExtVacancySerializer(serializers.ModelSerializer):
    employment_type_label = serializers.CharField(source='get_employment_type_display', read_only=True)

    class Meta:
        model = Vacancy
        fields = [
            'id', 'title', 'department', 'description', 'requirements',
            'city', 'employment_type', 'employment_type_label',
            'is_active', 'created_at',
        ]


class ExtCandidateCreateSerializer(serializers.Serializer):
    first_name  = serializers.CharField(max_length=100)
    last_name   = serializers.CharField(max_length=100)
    email       = serializers.EmailField()
    phone       = serializers.CharField(max_length=30, required=False, allow_blank=True)
    vacancy_id  = serializers.IntegerField(required=False, allow_null=True)
    source      = serializers.ChoiceField(
        choices=['linkedin', 'dou', 'work_ua', 'rabota_ua', 'recommendation', 'direct', 'other'],
        default='other',
    )
    notes       = serializers.CharField(required=False, allow_blank=True, default='')
    resume_url  = serializers.URLField(required=False, allow_blank=True)

    def validate_vacancy_id(self, value):
        if value is None:
            return value
        org = self.context['org']
        if not Vacancy.objects.filter(id=value, organization=org, is_active=True).exists():
            raise serializers.ValidationError('Вакансія не знайдена або неактивна.')
        return value

    def validate_email(self, value):
        return value.lower()


class ExtCandidateSerializer(serializers.ModelSerializer):
    status       = serializers.ReadOnlyField()
    status_label = serializers.ReadOnlyField()
    vacancy_title = serializers.CharField(source='vacancy.title', read_only=True, default=None)

    class Meta:
        model = Candidate
        fields = [
            'id', 'first_name', 'last_name', 'email', 'phone',
            'vacancy', 'vacancy_title',
            'source', 'notes', 'status', 'status_label', 'created_at',
        ]


class ExtWebhookSerializer(serializers.ModelSerializer):
    class Meta:
        model = WebhookEndpoint
        fields = ['id', 'name', 'url', 'events', 'is_active', 'last_fired_at', 'fail_count', 'created_at']
        read_only_fields = ['last_fired_at', 'fail_count', 'created_at']

    def validate_events(self, value):
        valid = {e for e, _ in WebhookEndpoint.EVENT_CHOICES}
        bad = [e for e in value if e not in valid]
        if bad:
            raise serializers.ValidationError(f'Невідомі події: {bad}. Допустимі: {sorted(valid)}')
        return value


# ─── /vacancies ───────────────────────────────────────────────────────────────

class ExtVacancyListView(APIView):
    """
    GET /api/v1/ext/vacancies/
    Повертає активні вакансії організації.

    Query params:
        is_active   — true/false (default: true)
        department  — фільтр по відділу (contains)
        search      — пошук в title + department
        limit       — к-сть результатів (max 100, default 20)
        offset      — зсув для пагінації
    """
    permission_classes = [ReadOnlyAPIKeyPermission]
    throttle_classes = [ExternalAPIThrottle]

    def get(self, request):
        org = request.api_org
        qs = Vacancy.objects.filter(organization=org)

        # Фільтри
        is_active = request.query_params.get('is_active', 'true')
        if is_active.lower() == 'false':
            qs = qs.filter(is_active=False)
        else:
            qs = qs.filter(is_active=True)

        department = request.query_params.get('department', '')
        if department:
            qs = qs.filter(department__icontains=department)

        search = request.query_params.get('search', '')
        if search:
            from django.db.models import Q
            qs = qs.filter(Q(title__icontains=search) | Q(department__icontains=search))

        # Пагінація
        try:
            limit  = min(int(request.query_params.get('limit', 20)), 100)
            offset = int(request.query_params.get('offset', 0))
        except (ValueError, TypeError):
            limit, offset = 20, 0

        total = qs.count()
        qs = qs.order_by('-created_at')[offset: offset + limit]

        return Response({
            'count':   total,
            'limit':   limit,
            'offset':  offset,
            'results': ExtVacancySerializer(qs, many=True).data,
        })


class ExtVacancyDetailView(APIView):
    """
    GET /api/v1/ext/vacancies/<id>/
    Деталі однієї вакансії.
    """
    permission_classes = [ReadOnlyAPIKeyPermission]
    throttle_classes = [ExternalAPIThrottle]

    def get(self, request, pk):
        org = request.api_org
        try:
            vacancy = Vacancy.objects.get(pk=pk, organization=org)
        except Vacancy.DoesNotExist:
            return Response({'error': 'Вакансію не знайдено'}, status=status.HTTP_404_NOT_FOUND)
        return Response(ExtVacancySerializer(vacancy).data)


# ─── /candidates ──────────────────────────────────────────────────────────────

class ExtCandidateCreateView(APIView):
    """
    POST /api/v1/ext/candidates/
    Додає нового кандидата до організації.

    Body (JSON):
        first_name  string  required
        last_name   string  required
        email       string  required
        phone       string  optional
        vacancy_id  int     optional
        source      string  optional  (linkedin|dou|work_ua|rabota_ua|recommendation|direct|other)
        notes       string  optional
        resume_url  string  optional

    Returns 201 Created або 200 OK якщо кандидат вже існує.
    """
    permission_classes = [WriteAPIKeyPermission]
    throttle_classes = [ExternalAPIThrottle]

    def post(self, request):
        org = request.api_org
        serializer = ExtCandidateCreateSerializer(
            data=request.data,
            context={'org': org},
        )
        if not serializer.is_valid():
            return Response({'errors': serializer.errors}, status=status.HTTP_400_BAD_REQUEST)

        data = serializer.validated_data
        vacancy = None
        if data.get('vacancy_id'):
            vacancy = Vacancy.objects.get(id=data['vacancy_id'], organization=org)

        # Знайти перший доступний stage "new" для org
        new_stage = VacancyStage.objects.filter(
            organization=org, system_key='new',
        ).order_by('id').first()
        if vacancy and not new_stage:
            new_stage = VacancyStage.objects.filter(
                vacancy=vacancy, system_key='new',
            ).first()

        candidate, created = Candidate.objects.get_or_create(
            email=data['email'],
            organization=org,
            defaults={
                'first_name': data['first_name'],
                'last_name':  data['last_name'],
                'phone':      data.get('phone', ''),
                'vacancy':    vacancy,
                'stage':      new_stage,
                'source':     data.get('source', 'other'),
                'notes':      data.get('notes', ''),
            }
        )

        if created:
            # Пожежимо webhook candidate.created
            _fire_webhook(org, 'candidate.created', _candidate_payload(candidate))

        response_status = status.HTTP_201_CREATED if created else status.HTTP_200_OK
        return Response({
            'id':      candidate.id,
            'created': created,
            'candidate': ExtCandidateSerializer(candidate).data,
        }, status=response_status)


class ExtCandidateStatusView(APIView):
    """
    GET /api/v1/ext/candidates/<id>/status/
    Повертає поточний статус кандидата + коротку історію.
    """
    permission_classes = [ReadOnlyAPIKeyPermission]
    throttle_classes = [ExternalAPIThrottle]

    def get(self, request, pk):
        org = request.api_org
        try:
            candidate = Candidate.objects.select_related('stage', 'vacancy').get(
                pk=pk, organization=org,
            )
        except Candidate.DoesNotExist:
            return Response({'error': 'Кандидата не знайдено'}, status=status.HTTP_404_NOT_FOUND)

        history = candidate.status_history.select_related('new_stage', 'old_stage').order_by('-changed_at')[:10]

        return Response({
            'candidate_id': candidate.id,
            'name':         f"{candidate.first_name} {candidate.last_name}",
            'email':        candidate.email,
            'status':       candidate.status,
            'status_label': candidate.status_label,
            'vacancy':      candidate.vacancy.title if candidate.vacancy else None,
            'history': [
                {
                    'from':        h.old_stage.name if h.old_stage else h.old_status,
                    'to':          h.new_stage.name if h.new_stage else h.new_status,
                    'changed_at':  h.changed_at,
                }
                for h in history
            ],
        })


# ─── /webhooks ────────────────────────────────────────────────────────────────

class ExtWebhookListCreateView(APIView):
    """
    GET  /api/v1/ext/webhooks/       — список вебхуків організації
    POST /api/v1/ext/webhooks/       — зареєструвати новий вебхук

    POST body:
        name    string   required
        url     string   required
        events  array    required  (candidate.created, candidate.status_changed, ...)
        secret  string   optional  (HMAC-підпис payload)

    Доступні події:
        candidate.created
        candidate.status_changed
        candidate.hired
        candidate.rejected
        vacancy.created
        vacancy.closed
    """
    permission_classes = [WriteAPIKeyPermission]
    throttle_classes = [ExternalAPIThrottle]

    def get(self, request):
        org = request.api_org
        endpoints = WebhookEndpoint.objects.filter(organization=org)
        return Response(ExtWebhookSerializer(endpoints, many=True).data)

    def post(self, request):
        org = request.api_org
        serializer = ExtWebhookSerializer(data=request.data)
        if not serializer.is_valid():
            return Response({'errors': serializer.errors}, status=status.HTTP_400_BAD_REQUEST)

        # Ліміт: не більше 10 вебхуків на організацію
        if WebhookEndpoint.objects.filter(organization=org).count() >= 10:
            return Response(
                {'error': 'Досягнуто ліміт вебхуків (10 на організацію)'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        endpoint = serializer.save(
            organization=org,
            created_by=None,
            secret=request.data.get('secret', ''),
        )
        return Response(ExtWebhookSerializer(endpoint).data, status=status.HTTP_201_CREATED)


class ExtWebhookDetailView(APIView):
    """
    GET    /api/v1/ext/webhooks/<id>/   — деталі вебхука
    PATCH  /api/v1/ext/webhooks/<id>/   — оновити (url, events, is_active)
    DELETE /api/v1/ext/webhooks/<id>/   — видалити
    """
    permission_classes = [WriteAPIKeyPermission]
    throttle_classes = [ExternalAPIThrottle]

    def _get_endpoint(self, pk, org):
        try:
            return WebhookEndpoint.objects.get(pk=pk, organization=org)
        except WebhookEndpoint.DoesNotExist:
            return None

    def get(self, request, pk):
        ep = self._get_endpoint(pk, request.api_org)
        if not ep:
            return Response({'error': 'Не знайдено'}, status=status.HTTP_404_NOT_FOUND)
        return Response(ExtWebhookSerializer(ep).data)

    def patch(self, request, pk):
        ep = self._get_endpoint(pk, request.api_org)
        if not ep:
            return Response({'error': 'Не знайдено'}, status=status.HTTP_404_NOT_FOUND)
        serializer = ExtWebhookSerializer(ep, data=request.data, partial=True)
        if not serializer.is_valid():
            return Response({'errors': serializer.errors}, status=status.HTTP_400_BAD_REQUEST)
        serializer.save()
        return Response(serializer.data)

    def delete(self, request, pk):
        ep = self._get_endpoint(pk, request.api_org)
        if not ep:
            return Response({'error': 'Не знайдено'}, status=status.HTTP_404_NOT_FOUND)
        ep.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)


class ExtWebhookTestView(APIView):
    """
    POST /api/v1/ext/webhooks/<id>/test/
    Надсилає тестовий ping на URL вебхука.
    """
    permission_classes = [WriteAPIKeyPermission]
    throttle_classes = [ExternalAPIThrottle]

    def post(self, request, pk):
        try:
            ep = WebhookEndpoint.objects.get(pk=pk, organization=request.api_org)
        except WebhookEndpoint.DoesNotExist:
            return Response({'error': 'Не знайдено'}, status=status.HTTP_404_NOT_FOUND)

        test_payload = {
            'event':   'webhook.test',
            'message': 'Тестовий запит від IDA ATS',
            'organization': ep.organization.name,
            'timestamp': timezone.now().isoformat(),
        }
        result = _deliver_webhook(ep, 'webhook.test', test_payload)
        return Response(result)


class ExtWebhookLogsView(APIView):
    """
    GET /api/v1/ext/webhooks/<id>/logs/
    Останні 50 логів вебхука.
    """
    permission_classes = [ReadOnlyAPIKeyPermission]
    throttle_classes = [ExternalAPIThrottle]

    def get(self, request, pk):
        try:
            ep = WebhookEndpoint.objects.get(pk=pk, organization=request.api_org)
        except WebhookEndpoint.DoesNotExist:
            return Response({'error': 'Не знайдено'}, status=status.HTTP_404_NOT_FOUND)

        logs = ep.logs.order_by('-fired_at')[:50]
        return Response([{
            'id':          log.id,
            'event':       log.event,
            'status':      log.status,
            'http_status': log.http_status,
            'duration_ms': log.duration_ms,
            'fired_at':    log.fired_at,
        } for log in logs])


# ─── /api-keys (self-service) ─────────────────────────────────────────────────

class ExtAPIKeyInfoView(APIView):
    """
    GET /api/v1/ext/me/
    Повертає інформацію про поточний API-ключ.
    """
    permission_classes = [ReadOnlyAPIKeyPermission]
    throttle_classes = [ExternalAPIThrottle]

    def get(self, request):
        key = request.api_key
        return Response({
            'key_name':     key.name,
            'scope':        key.scope,
            'organization': key.organization.name,
            'created_at':   key.created_at,
            'expires_at':   key.expires_at,
            'last_used_at': key.last_used_at,
        })


# ─── Внутрішнє управління API-ключами (потребує JWT авторизації) ─────────────

from rest_framework.permissions import IsAuthenticated
from .permissions import IsOrgAdmin
from .utils.context_processors import get_user_organization


class APIKeyManageView(APIView):
    """
    GET  /api/internal/api-keys/   — список ключів організації
    POST /api/internal/api-keys/   — створити новий ключ

    Доступно лише Admin та SuperAdmin через JWT.

    POST body:
        name        string   required
        scope       string   read|write|full  (default: read)
        expires_at  datetime optional
    """
    permission_classes = [IsAuthenticated, IsOrgAdmin]

    def get(self, request):
        org = get_user_organization(request.user)
        if not org:
            return Response({'error': 'Організацію не знайдено'}, status=404)
        keys = ExternalAPIKey.objects.filter(organization=org).order_by('-created_at')
        return Response([{
            'id':          k.id,
            'name':        k.name,
            'scope':       k.scope,
            'key_prefix':  k.key_prefix + '...',
            'is_active':   k.is_active,
            'created_at':  k.created_at,
            'expires_at':  k.expires_at,
            'last_used_at': k.last_used_at,
        } for k in keys])

    def post(self, request):
        org = get_user_organization(request.user)
        if not org:
            return Response({'error': 'Організацію не знайдено'}, status=404)

        name = request.data.get('name', '').strip()
        if not name:
            return Response({'errors': {'name': 'Назва обов\'язкова'}}, status=400)

        scope = request.data.get('scope', 'read')
        if scope not in ('read', 'write', 'full'):
            return Response({'errors': {'scope': 'Допустимі: read, write, full'}}, status=400)

        expires_at = request.data.get('expires_at')

        instance, raw_key = ExternalAPIKey.generate(
            organization=org,
            name=name,
            scope=scope,
            created_by=request.user,
            expires_at=expires_at,
        )

        return Response({
            'id':       instance.id,
            'name':     instance.name,
            'scope':    instance.scope,
            'api_key':  raw_key,  # ← показуємо тільки ОДИН РАЗ
            'warning':  'Збережіть ключ зараз — він більше не буде показаний',
            'created_at': instance.created_at,
        }, status=status.HTTP_201_CREATED)


class APIKeyDetailManageView(APIView):
    """
    PATCH  /api/internal/api-keys/<id>/  — деактивувати / перейменувати
    DELETE /api/internal/api-keys/<id>/  — видалити назавжди
    """
    permission_classes = [IsAuthenticated, IsOrgAdmin]

    def _get_key(self, pk, user):
        org = get_user_organization(user)
        try:
            return ExternalAPIKey.objects.get(pk=pk, organization=org)
        except ExternalAPIKey.DoesNotExist:
            return None

    def patch(self, request, pk):
        key = self._get_key(pk, request.user)
        if not key:
            return Response({'error': 'Ключ не знайдено'}, status=404)
        if 'name' in request.data:
            key.name = request.data['name']
        if 'is_active' in request.data:
            key.is_active = bool(request.data['is_active'])
        key.save(update_fields=['name', 'is_active'])
        return Response({'id': key.id, 'name': key.name, 'is_active': key.is_active})

    def delete(self, request, pk):
        key = self._get_key(pk, request.user)
        if not key:
            return Response({'error': 'Ключ не знайдено'}, status=404)
        key.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)


# ─── Webhook dispatcher (внутрішня функція) ───────────────────────────────────

def _candidate_payload(candidate):
    return {
        'candidate_id': candidate.id,
        'first_name':   candidate.first_name,
        'last_name':    candidate.last_name,
        'email':        candidate.email,
        'phone':        candidate.phone,
        'status':       candidate.status,
        'status_label': candidate.status_label,
        'vacancy_id':   candidate.vacancy_id,
        'vacancy_title': candidate.vacancy.title if candidate.vacancy else None,
        'source':       candidate.source,
        'created_at':   candidate.created_at.isoformat() if candidate.created_at else None,
    }


def _fire_webhook(organization, event, payload):
    """
    Знаходить всі активні вебхуки організації, що підписані на цю подію,
    і надсилає їм payload.
    Викликається з сигналів Django або views.
    """
    endpoints = WebhookEndpoint.objects.filter(
        organization=organization,
        is_active=True,
    )
    for ep in endpoints:
        if event not in (ep.events or []):
            continue
        _deliver_webhook(ep, event, payload)


def _deliver_webhook(endpoint, event, payload):
    """Надсилає один HTTP POST на endpoint."""
    full_payload = {
        'event':        event,
        'organization': endpoint.organization.name,
        'timestamp':    timezone.now().isoformat(),
        'data':         payload,
    }

    headers = {'Content-Type': 'application/json', 'User-Agent': 'IDA-ATS/1.0'}

    # HMAC підпис якщо є secret
    if endpoint.secret:
        body = json.dumps(full_payload, ensure_ascii=False)
        sig = hmac.new(
            endpoint.secret.encode(),
            body.encode(),
            hashlib.sha256,
        ).hexdigest()
        headers['X-IDA-Signature'] = f'sha256={sig}'
    else:
        body = None

    start = time.monotonic()
    http_status = None
    response_text = ''
    delivery_status = 'failed'

    try:
        resp = http_requests.post(
            endpoint.url,
            json=full_payload if not body else None,
            data=body if body else None,
            headers=headers,
            timeout=10,
        )
        http_status = resp.status_code
        response_text = resp.text[:500]
        delivery_status = 'success' if resp.status_code < 400 else 'failed'

    except http_requests.exceptions.Timeout:
        delivery_status = 'timeout'
    except Exception as e:
        delivery_status = 'failed'
        response_text = str(e)[:200]

    duration_ms = int((time.monotonic() - start) * 1000)

    WebhookLog.objects.create(
        endpoint=endpoint,
        event=event,
        payload=full_payload,
        status=delivery_status,
        http_status=http_status,
        response=response_text,
        duration_ms=duration_ms,
    )

    if delivery_status == 'failed':
        WebhookEndpoint.objects.filter(pk=endpoint.pk).update(
            fail_count=endpoint.fail_count + 1
        )
    else:
        WebhookEndpoint.objects.filter(pk=endpoint.pk).update(
            last_fired_at=timezone.now(),
            fail_count=0,
        )

    logger.info(
        f'Webhook {event} → {endpoint.url}: '
        f'{delivery_status} ({duration_ms}ms, HTTP {http_status})'
    )

    return {
        'status':      delivery_status,
        'http_status': http_status,
        'duration_ms': duration_ms,
        'response':    response_text,
    }