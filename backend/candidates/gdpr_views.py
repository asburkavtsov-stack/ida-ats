"""
gdpr_views.py
=============
GDPR ендпоінти:

  POST   /api/candidates/<id>/gdpr/consent/     — надати/відкликати згоду
  POST   /api/candidates/<id>/gdpr/anonymize/   — анонімізувати (право на забуття)
  GET    /api/candidates/<id>/gdpr/export/      — експорт персональних даних
  GET    /api/gdpr/settings/                    — налаштування GDPR орг.
  PATCH  /api/gdpr/settings/                    — оновити налаштування
  GET    /api/gdpr/candidates/expiring/         — кандидати що закінчують строк
  POST   /api/gdpr/run-cleanup/                 — ручний запуск автоочищення
"""

import csv
import io
import json
import logging
from datetime import timedelta

from django.http import HttpResponse, JsonResponse
from django.utils import timezone
from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from .models import Candidate, GDPRSettings, Organization
from .serializers import GDPRSettingsSerializer, CandidateSerializer
from .permissions import IsOrgAdmin
from .throttles import GDPROperationThrottle

logger = logging.getLogger(__name__)


def _get_org(user):
    try:
        return user.profile.organization
    except Exception:
        return None


# ─── Consent: надати або відкликати ──────────────────────────────────────────

class CandidateGDPRConsentView(APIView):
    """
    POST /api/candidates/<id>/gdpr/consent/

    Body:
        { "consent": true,  "ip_address": "1.2.3.4" }  — надати згоду
        { "consent": false }                             — відкликати згоду
    """
    permission_classes = [IsAuthenticated]

    def post(self, request, pk):
        org = _get_org(request.user)
        try:
            candidate = Candidate.objects.get(pk=pk, organization=org)
        except Candidate.DoesNotExist:
            return Response({'error': 'Кандидата не знайдено'}, status=404)

        consent = request.data.get('consent')
        if consent is None:
            return Response({'error': 'Поле consent обов\'язкове'}, status=400)

        if consent:
            # Отримуємо текст згоди з налаштувань організації
            try:
                consent_text = org.gdpr_settings.consent_text
            except GDPRSettings.DoesNotExist:
                consent_text = GDPRSettings._meta.get_field('consent_text').default

            ip = request.data.get('ip_address') or request.META.get('REMOTE_ADDR')
            candidate.grant_consent(consent_text=consent_text, ip_address=ip)
            return Response({
                'success': True,
                'gdpr_consent': True,
                'gdpr_consent_date': candidate.gdpr_consent_date,
                'gdpr_delete_after': candidate.gdpr_delete_after,
            })
        else:
            candidate.withdraw_consent()
            return Response({
                'success': True,
                'gdpr_consent': False,
                'gdpr_withdraw_date': candidate.gdpr_withdraw_date,
            })


# ─── Anonymize: право на забуття ──────────────────────────────────────────────

class CandidateGDPRAnonymizeView(APIView):
    """
    POST /api/candidates/<id>/gdpr/anonymize/
    Анонімізує персональні дані. Незворотна дія — вимагає підтвердження.

    Body: { "confirm": true }
    """
    permission_classes = [IsAuthenticated, IsOrgAdmin]
    throttle_classes = [GDPROperationThrottle]

    def post(self, request, pk):
        org = _get_org(request.user)
        try:
            candidate = Candidate.objects.get(pk=pk, organization=org)
        except Candidate.DoesNotExist:
            return Response({'error': 'Кандидата не знайдено'}, status=404)

        if candidate.gdpr_anonymized:
            return Response({'error': 'Кандидат вже анонімізований'}, status=400)

        if not request.data.get('confirm'):
            return Response({
                'error': 'Потрібне підтвердження: { "confirm": true }',
                'warning': 'Ця дія незворотна. Персональні дані будуть видалені назавжди.',
            }, status=400)

        candidate.anonymize()
        logger.info(
            f'[GDPR] Candidate {pk} anonymized by user {request.user.id} '
            f'({request.user.username}) in org {org.id}'
        )
        return Response({
            'success': True,
            'message': 'Персональні дані анонімізовані',
            'gdpr_anonymized_at': candidate.gdpr_anonymized_at,
        })


# ─── Export: право на портативність ──────────────────────────────────────────

class CandidateGDPRExportView(APIView):
    """
    GET /api/candidates/<id>/gdpr/export/?format=json|csv

    Повертає всі персональні дані кандидата у машиночитаємому форматі.
    """
    permission_classes = [IsAuthenticated]
    throttle_classes = [GDPROperationThrottle]

    def get(self, request, pk):
        org = _get_org(request.user)
        try:
            candidate = Candidate.objects.select_related(
                'vacancy', 'stage', 'organization'
            ).prefetch_related('tags', 'status_history').get(pk=pk, organization=org)
        except Candidate.DoesNotExist:
            return Response({'error': 'Кандидата не знайдено'}, status=404)

        export_data = {
            'export_date': timezone.now().isoformat(),
            'organization': org.name,
            'personal_data': {
                'first_name':  candidate.first_name,
                'last_name':   candidate.last_name,
                'email':       candidate.email,
                'phone':       candidate.phone,
            },
            'recruitment_data': {
                'vacancy':     candidate.vacancy.title if candidate.vacancy else None,
                'stage':       candidate.stage.name if candidate.stage else None,
                'source':      candidate.get_source_display(),
                'created_at':  candidate.created_at.isoformat(),
                'notes':       candidate.notes,
                'tags':        [t.name for t in candidate.tags.all()],
            },
            'gdpr': {
                'consent':          candidate.gdpr_consent,
                'consent_date':     candidate.gdpr_consent_date.isoformat() if candidate.gdpr_consent_date else None,
                'withdraw_date':    candidate.gdpr_withdraw_date.isoformat() if candidate.gdpr_withdraw_date else None,
                'delete_after':     str(candidate.gdpr_delete_after) if candidate.gdpr_delete_after else None,
                'anonymized':       candidate.gdpr_anonymized,
                'anonymized_at':    candidate.gdpr_anonymized_at.isoformat() if candidate.gdpr_anonymized_at else None,
            },
            'status_history': [
                {
                    'from':       h.old_stage.name if h.old_stage else h.old_status,
                    'to':         h.new_stage.name if h.new_stage else h.new_status,
                    'changed_at': h.changed_at.isoformat(),
                }
                for h in candidate.status_history.order_by('changed_at')
            ],
        }

        fmt = request.query_params.get('format', 'json')

        if fmt == 'csv':
            output = io.StringIO()
            writer = csv.writer(output)
            writer.writerow(['Поле', 'Значення'])
            writer.writerow(['Ім\'я', candidate.first_name])
            writer.writerow(['Прізвище', candidate.last_name])
            writer.writerow(['Email', candidate.email])
            writer.writerow(['Телефон', candidate.phone])
            writer.writerow(['Вакансія', candidate.vacancy.title if candidate.vacancy else ''])
            writer.writerow(['Статус', candidate.stage.name if candidate.stage else ''])
            writer.writerow(['Джерело', candidate.get_source_display()])
            writer.writerow(['Додано', candidate.created_at.isoformat()])
            writer.writerow(['GDPR згода', 'Так' if candidate.gdpr_consent else 'Ні'])
            writer.writerow(['Дата згоди', candidate.gdpr_consent_date or ''])
            writer.writerow(['Видалити до', candidate.gdpr_delete_after or ''])
            response = HttpResponse(output.getvalue(), content_type='text/csv; charset=utf-8')
            response['Content-Disposition'] = (
                f'attachment; filename="gdpr_export_{candidate.id}.csv"'
            )
            return response

        response = HttpResponse(
            json.dumps(export_data, ensure_ascii=False, indent=2),
            content_type='application/json; charset=utf-8',
        )
        response['Content-Disposition'] = (
            f'attachment; filename="gdpr_export_{candidate.id}.json"'
        )
        return response


# ─── GDPR Settings ────────────────────────────────────────────────────────────

class GDPRSettingsView(APIView):
    """
    GET   /api/gdpr/settings/   — отримати налаштування
    PATCH /api/gdpr/settings/   — оновити налаштування
    """
    permission_classes = [IsAuthenticated, IsOrgAdmin]

    def _get_or_create_settings(self, org):
        settings, _ = GDPRSettings.objects.get_or_create(organization=org)
        return settings

    def get(self, request):
        org = _get_org(request.user)
        if not org:
            return Response({'error': 'Організацію не знайдено'}, status=404)
        gdpr = self._get_or_create_settings(org)
        return Response(GDPRSettingsSerializer(gdpr).data)

    def patch(self, request):
        org = _get_org(request.user)
        if not org:
            return Response({'error': 'Організацію не знайдено'}, status=404)
        gdpr = self._get_or_create_settings(org)
        serializer = GDPRSettingsSerializer(gdpr, data=request.data, partial=True)
        if not serializer.is_valid():
            return Response({'errors': serializer.errors}, status=400)
        serializer.save()
        return Response(serializer.data)


# ─── Candidates що скоро закінчуються ────────────────────────────────────────

class GDPRExpiringCandidatesView(APIView):
    """
    GET /api/gdpr/candidates/expiring/?days=30

    Повертає кандидатів у яких gdpr_delete_after <= today + days.
    """
    permission_classes = [IsAuthenticated, IsOrgAdmin]

    def get(self, request):
        org = _get_org(request.user)
        if not org:
            return Response({'error': 'Організацію не знайдено'}, status=404)

        try:
            days = int(request.query_params.get('days', 30))
        except ValueError:
            days = 30

        cutoff = (timezone.now() + timedelta(days=days)).date()

        candidates = Candidate.objects.filter(
            organization=org,
            gdpr_anonymized=False,
            gdpr_delete_after__lte=cutoff,
            gdpr_delete_after__isnull=False,
        ).order_by('gdpr_delete_after')

        today = timezone.now().date()
        data = [
            {
                'id':              c.id,
                'name':            f'{c.first_name} {c.last_name}',
                'email':           c.email,
                'gdpr_consent':    c.gdpr_consent,
                'gdpr_delete_after': str(c.gdpr_delete_after),
                'days_remaining':  (c.gdpr_delete_after - today).days,
                'vacancy':         c.vacancy.title if c.vacancy else None,
            }
            for c in candidates
        ]

        return Response({
            'count':      len(data),
            'cutoff_date': str(cutoff),
            'candidates': data,
        })


# ─── Ручний запуск автоочищення ───────────────────────────────────────────────

class GDPRRunCleanupView(APIView):
    """
    POST /api/gdpr/run-cleanup/

    Анонімізує всіх кандидатів у яких gdpr_delete_after <= today.
    Повертає кількість оброблених записів.
    """
    permission_classes = [IsAuthenticated, IsOrgAdmin]
    throttle_classes = [GDPROperationThrottle]

    def post(self, request):
        org = _get_org(request.user)
        if not org:
            return Response({'error': 'Організацію не знайдено'}, status=404)

        today = timezone.now().date()
        expired = Candidate.objects.filter(
            organization=org,
            gdpr_anonymized=False,
            gdpr_delete_after__lte=today,
            gdpr_delete_after__isnull=False,
        )

        count = expired.count()
        anonymized = 0

        for candidate in expired:
            try:
                candidate.anonymize()
                anonymized += 1
            except Exception as e:
                logger.error(f'[GDPR] Cleanup error for candidate {candidate.id}: {e}')

        logger.info(
            f'[GDPR] Cleanup by {request.user.username} in org {org.id}: '
            f'{anonymized}/{count} candidates anonymized'
        )

        return Response({
            'success':    True,
            'found':      count,
            'anonymized': anonymized,
            'run_at':     timezone.now().isoformat(),
        })