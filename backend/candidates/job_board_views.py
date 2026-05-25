import logging

from django.http import HttpResponse
from django.views.decorators.csrf import csrf_exempt
from django.utils.decorators import method_decorator
from rest_framework import status
from rest_framework.decorators import action, api_view, permission_classes
from rest_framework.permissions import IsAuthenticated, AllowAny
from rest_framework.response import Response

from .models import Candidate, Vacancy
from .serializers import VacancyPublishSerializer, CandidateSerializer
from .job_boards import rabota_ua as rabota_ua_client
from .job_boards import workua as workua_client
from .job_boards import dou_linkedin

logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# XML ФІДИ  (публічні — без авторизації, за захищеним токеном в URL)
# ---------------------------------------------------------------------------

@api_view(['GET'])
@permission_classes([AllowAny])
def vacancy_feed_rabota_ua(request):
    """
    GET /api/vacancies/feed/rabota-ua/?token=YOUR_FEED_TOKEN
    Повертає XML-фід вакансій для rabota.ua.
    Передайте цей URL менеджеру rabota.ua для автоімпорту.
    """
    feed_token = request.query_params.get('token', '')
    from django.conf import settings
    expected = getattr(settings, 'JOB_BOARD_FEED_TOKEN', '')
    if expected and feed_token != expected:
        return HttpResponse(status=403)

    # Фільтруємо по організації якщо передано org_slug
    org_slug = request.query_params.get('org', '')
    vacancies = Vacancy.objects.filter(is_active=True)
    if org_slug:
        vacancies = vacancies.filter(organization__slug=org_slug)

    xml = rabota_ua_client.generate_xml_feed(vacancies)
    return HttpResponse(xml, content_type='application/xml; charset=utf-8')


@api_view(['GET'])
@permission_classes([AllowAny])
def vacancy_feed_work_ua(request):
    """
    GET /api/vacancies/feed/work-ua/?token=YOUR_FEED_TOKEN
    Повертає XML-фід вакансій для work.ua.
    """
    feed_token = request.query_params.get('token', '')
    from django.conf import settings
    expected = getattr(settings, 'JOB_BOARD_FEED_TOKEN', '')
    if expected and feed_token != expected:
        return HttpResponse(status=403)

    org_slug = request.query_params.get('org', '')
    vacancies = Vacancy.objects.filter(is_active=True)
    if org_slug:
        vacancies = vacancies.filter(organization__slug=org_slug)

    xml = workua_client.generate_xml_feed(vacancies)
    return HttpResponse(xml, content_type='application/xml; charset=utf-8')


# ---------------------------------------------------------------------------
# ПУБЛІКАЦІЯ / ЗНЯТТЯ З ПУБЛІКАЦІЇ
# ---------------------------------------------------------------------------

class VacancyJobBoardMixin:
    """
    Mixin для VacancyViewSet.
    Додає actions: publish, unpublish, sync_applications.
    """

    @action(detail=True, methods=['post'], url_path='publish')
    def publish(self, request, pk=None):
        """
        POST /api/vacancies/{id}/publish/
        Body: {"platform": "rabota_ua"}  або  {"platform": "dou", "url": "https://..."}
        """
        vacancy = self.get_object()
        serializer = VacancyPublishSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        platform = serializer.validated_data['platform']
        url = serializer.validated_data.get('url', '')

        if platform == 'rabota_ua':
            result = rabota_ua_client.publish_vacancy(vacancy)

        elif platform == 'work_ua':
            # work.ua не має прямого API — повертаємо XML-фід URL
            from django.conf import settings
            token = getattr(settings, 'JOB_BOARD_FEED_TOKEN', 'set_in_env')
            feed_url = request.build_absolute_uri(
                f'/api/vacancies/feed/work-ua/?token={token}'
            )
            result = {
                'success': True,
                'message': 'work.ua використовує XML-фід. Передайте URL менеджеру.',
                'feed_url': feed_url,
            }
            vacancy.published_work_ua = True
            from django.utils import timezone
            vacancy.published_at_work_ua = timezone.now()
            vacancy.save(update_fields=['published_work_ua', 'published_at_work_ua'])

        elif platform == 'dou':
            if not url:
                instructions = dou_linkedin.get_dou_publish_instructions(vacancy)
                return Response({
                    'success': False,
                    'message': 'DOU не має API. Опублікуйте вакансію вручну і передайте URL.',
                    'instructions': instructions,
                }, status=status.HTTP_200_OK)
            result = dou_linkedin.mark_published_dou(vacancy, url)

        elif platform == 'linkedin':
            if not url:
                share_url = dou_linkedin.generate_linkedin_share_url(vacancy)
                return Response({
                    'success': False,
                    'message': 'Відкрийте URL для публікації на LinkedIn, потім збережіть посилання на вакансію.',
                    'linkedin_share_url': share_url,
                }, status=status.HTTP_200_OK)
            result = dou_linkedin.mark_published_linkedin(vacancy, url)

        else:
            return Response({'error': 'Невідома платформа'}, status=status.HTTP_400_BAD_REQUEST)

        code = status.HTTP_200_OK if result.get('success') else status.HTTP_502_BAD_GATEWAY
        return Response(result, status=code)

    @action(detail=True, methods=['post'], url_path='unpublish')
    def unpublish(self, request, pk=None):
        """
        POST /api/vacancies/{id}/unpublish/
        Body: {"platform": "rabota_ua"}
        """
        vacancy = self.get_object()
        platform = request.data.get('platform', '')

        if platform == 'rabota_ua':
            result = rabota_ua_client.unpublish_vacancy(vacancy)
        else:
            return Response(
                {'error': f'Зняття публікації для {platform} не підтримується через API'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        code = status.HTTP_200_OK if result.get('success') else status.HTTP_502_BAD_GATEWAY
        return Response(result, status=code)

    @action(detail=True, methods=['post'], url_path='sync-applications')
    def sync_applications(self, request, pk=None):
        """
        POST /api/vacancies/{id}/sync-applications/
        Підтягує нові відгуки з rabota.ua і створює Candidate записи.
        """
        vacancy = self.get_object()
        applications = rabota_ua_client.fetch_applications(vacancy)

        if not applications:
            return Response({'created': 0, 'message': 'Нових відгуків немає'})

        created_count = 0
        skipped_count = 0

        for app in applications:
            if not app.get('email'):
                skipped_count += 1
                continue

            candidate, created = Candidate.objects.get_or_create(
                email=app['email'],
                organization=vacancy.organization,
                defaults={
                    'first_name': app.get('first_name', ''),
                    'last_name': app.get('last_name', ''),
                    'phone': app.get('phone', ''),
                    'source': app.get('source', 'rabota_ua'),
                    'notes': app.get('notes', ''),
                    'vacancy': vacancy,
                    'status': 'new',
                }
            )
            if created:
                created_count += 1
            else:
                skipped_count += 1

        return Response({
            'created': created_count,
            'skipped': skipped_count,
            'message': f'Додано {created_count} нових кандидатів',
        })


# ---------------------------------------------------------------------------
# ВЕБХУК від work.ua
# ---------------------------------------------------------------------------

@csrf_exempt
@api_view(['POST'])
@permission_classes([AllowAny])
def work_ua_webhook(request):
    """
    POST /api/webhooks/work-ua/
    Приймає відгуки від work.ua.

    Налаштування в особистому кабінеті work.ua:
      Налаштування → Інтеграції → Webhook URL → вказати цей ендпоінт

    Для захисту від несанкціонованих запитів — перевіряємо секретний заголовок.
    Додайте в .env: WORK_UA_WEBHOOK_SECRET=your_secret
    """
    from django.conf import settings
    secret = getattr(settings, 'WORK_UA_WEBHOOK_SECRET', '')
    if secret:
        incoming = request.headers.get('X-Webhook-Secret', '')
        if incoming != secret:
            return Response({'error': 'Unauthorized'}, status=status.HTTP_403_FORBIDDEN)

    data = request.data
    logger.info(f'work.ua webhook received: {data}')

    app = workua_client.parse_webhook_application(data)

    if not app.get('email'):
        return Response({'status': 'skipped', 'reason': 'no email'})

    # Знаходимо вакансію по external_vacancy_id (наш внутрішній id)
    vacancy = None
    ext_id = app.get('external_vacancy_id', '')
    if ext_id:
        try:
            vacancy = Vacancy.objects.get(id=int(ext_id))
        except (Vacancy.DoesNotExist, ValueError):
            pass

    org = vacancy.organization if vacancy else None

    candidate, created = Candidate.objects.get_or_create(
        email=app['email'],
        organization=org,
        defaults={
            'first_name': app.get('first_name', ''),
            'last_name': app.get('last_name', ''),
            'phone': app.get('phone', ''),
            'source': 'work_ua',
            'notes': app.get('notes', ''),
            'vacancy': vacancy,
            'status': 'new',
        }
    )

    return Response({
        'status': 'created' if created else 'exists',
        'candidate_id': candidate.id,
    })


# ---------------------------------------------------------------------------
# ВЕБХУК — загальний (для DOU, LinkedIn форм)
# ---------------------------------------------------------------------------

@csrf_exempt
@api_view(['POST'])
@permission_classes([AllowAny])
def job_board_application_webhook(request):
    """
    POST /api/webhooks/job-application/
    Загальний endpoint для прийому відгуків з будь-якої платформи.

    Очікуваний payload:
    {
        "source": "dou" | "linkedin" | "work_ua" | "rabota_ua",
        "first_name": "Іван",
        "last_name": "Петренко",
        "email": "ivan@example.com",
        "phone": "+380501234567",
        "vacancy_id": 42,
        "cover_letter": "..."
    }
    """
    from django.conf import settings
    secret = getattr(settings, 'WEBHOOK_SECRET', '')
    if secret:
        incoming = request.headers.get('X-Webhook-Secret', '')
        if incoming != secret:
            return Response({'error': 'Unauthorized'}, status=status.HTTP_403_FORBIDDEN)

    data = request.data
    email = data.get('email', '')
    if not email:
        return Response({'error': 'email обовʼязковий'}, status=status.HTTP_400_BAD_REQUEST)

    vacancy = None
    vacancy_id = data.get('vacancy_id')
    if vacancy_id:
        try:
            vacancy = Vacancy.objects.get(id=int(vacancy_id))
        except (Vacancy.DoesNotExist, ValueError):
            pass

    org = vacancy.organization if vacancy else None
    source = data.get('source', 'other')

    candidate, created = Candidate.objects.get_or_create(
        email=email,
        organization=org,
        defaults={
            'first_name': data.get('first_name', ''),
            'last_name': data.get('last_name', ''),
            'phone': data.get('phone', ''),
            'source': source,
            'notes': data.get('cover_letter', ''),
            'vacancy': vacancy,
            'status': 'new',
        }
    )

    logger.info(
        f'Job application webhook: source={source}, email={email}, '
        f'candidate_id={candidate.id}, created={created}'
    )

    return Response({
        'status': 'created' if created else 'exists',
        'candidate_id': candidate.id,
    }, status=status.HTTP_201_CREATED if created else status.HTTP_200_OK)
