"""
DOU та LinkedIn інтеграція
===========================

DOU:
  - Немає API для публікації — лише ручна публікація через dou.ua/jobs
  - Відгуки надходять на email або через форму DOU
  - Ми: зберігаємо URL вакансії на DOU і відстежуємо source='dou'

LinkedIn:
  - Jobs API є, але доступна тільки для верифікованих партнерів LinkedIn
    (процес верифікації займає 2-4 тижні, потрібен business акаунт)
  - Практичний підхід зараз: deep link + відстеження source='linkedin'
  - Для майбутнього: LinkedIn Job Posting API (OAuth 2.0)
"""

import logging
import urllib.parse

from django.conf import settings
from django.utils import timezone

logger = logging.getLogger(__name__)

LINKEDIN_CLIENT_ID = getattr(settings, 'LINKEDIN_CLIENT_ID', '')
LINKEDIN_CLIENT_SECRET = getattr(settings, 'LINKEDIN_CLIENT_SECRET', '')


# ---------------------------------------------------------------------------
# DOU
# ---------------------------------------------------------------------------

def mark_published_dou(vacancy, dou_url):
    """
    Позначає вакансію як опубліковану на DOU.
    Викликається вручну HR-менеджером після публікації на dou.ua/jobs.
    """
    vacancy.published_dou = True
    vacancy.dou_vacancy_url = dou_url
    vacancy.published_at_dou = timezone.now()
    vacancy.save(update_fields=['published_dou', 'dou_vacancy_url', 'published_at_dou'])
    logger.info(f'Vacancy {vacancy.id} marked as published on DOU: {dou_url}')
    return {'success': True, 'url': dou_url}


def get_dou_publish_instructions(vacancy):
    """
    Повертає інструкцію для HR щодо публікації на DOU.
    """
    return {
        'platform': 'DOU',
        'manual': True,
        'steps': [
            '1. Перейдіть на https://dou.ua/jobs/add/',
            f'2. Заголовок: {vacancy.title}',
            f'3. Відділ: {vacancy.department}',
            f'4. Місто: {vacancy.city or "Дистанційно"}',
            '5. Після публікації — скопіюйте URL і збережіть його в ATS',
        ],
        'template_description': vacancy.description or vacancy.title,
    }


# ---------------------------------------------------------------------------
# LinkedIn — deep link генератор
# ---------------------------------------------------------------------------

def generate_linkedin_share_url(vacancy, company_page_url=None):
    """
    Генерує URL для швидкого постингу вакансії через LinkedIn Share.
    Це не офіційний Jobs API, але працює без верифікації.
    """
    base = 'https://www.linkedin.com/jobs/post/'
    params = {
        'title': vacancy.title,
        'description': _build_linkedin_description(vacancy),
    }
    if vacancy.city:
        params['location'] = vacancy.city
    if company_page_url:
        params['company'] = company_page_url

    url = base + '?' + urllib.parse.urlencode(params)
    return url


def mark_published_linkedin(vacancy, linkedin_url):
    """
    Позначає вакансію як опубліковану на LinkedIn.
    """
    vacancy.published_linkedin = True
    vacancy.linkedin_vacancy_url = linkedin_url
    vacancy.published_at_linkedin = timezone.now()
    vacancy.save(update_fields=['published_linkedin', 'linkedin_vacancy_url', 'published_at_linkedin'])
    return {'success': True, 'url': linkedin_url}


def _build_linkedin_description(vacancy):
    """Форматує опис для LinkedIn (підтримує базовий HTML)."""
    parts = []

    if vacancy.description:
        parts.append(vacancy.description)

    if vacancy.requirements:
        parts.append(f'\n\n<strong>Вимоги:</strong>\n{vacancy.requirements}')

    employment_labels = {
        'full_time': 'Повна зайнятість',
        'part_time': 'Часткова зайнятість',
        'volunteer': 'Волонтерство',
        'contract': 'Контракт',
    }
    if vacancy.employment_type:
        label = employment_labels.get(vacancy.employment_type, '')
        if label:
            parts.append(f'\n\n<strong>Тип роботи:</strong> {label}')

    if vacancy.salary_min or vacancy.salary_max:
        salary = []
        if vacancy.salary_min:
            salary.append(f'від {vacancy.salary_min}')
        if vacancy.salary_max:
            salary.append(f'до {vacancy.salary_max}')
        parts.append(f'\n\n<strong>Зарплата:</strong> {" ".join(salary)} грн')

    return ''.join(parts) or vacancy.title


# ---------------------------------------------------------------------------
# LinkedIn Jobs API (для майбутнього, коли буде верифікація партнера)
# ---------------------------------------------------------------------------

def publish_vacancy_linkedin_api(vacancy, access_token, organization_urn):
    """
    Публікує вакансію через LinkedIn Jobs API.

    УВАГА: Потрібна верифікація партнера LinkedIn.
    Процес: https://developer.linkedin.com/product-catalog/jobs

    Параметри:
        access_token: OAuth 2.0 токен з scopes w_member_social, r_organization_admin
        organization_urn: 'urn:li:organization:YOUR_COMPANY_ID'
    """
    import requests

    if not access_token:
        return {'success': False, 'error': 'LinkedIn access_token не налаштований'}

    payload = {
        'distribution': {
            'linkedInDistributionTarget': {
                'visibleToGuest': True,
            }
        },
        'owner': organization_urn,
        'title': vacancy.title,
        'description': {
            'text': _build_linkedin_description(vacancy),
        },
        'employmentStatus': _map_employment_type_linkedin(vacancy.employment_type),
        'workplaceTypes': ['REMOTE'] if not vacancy.city else ['ON_SITE'],
    }

    if vacancy.city:
        payload['location'] = {'country': 'UA', 'city': vacancy.city}

    headers = {
        'Authorization': f'Bearer {access_token}',
        'Content-Type': 'application/json',
        'X-Restli-Protocol-Version': '2.0.0',
    }

    try:
        response = requests.post(
            'https://api.linkedin.com/v2/simpleJobPostings',
            json=payload,
            headers=headers,
            timeout=15,
        )
        response.raise_for_status()
        job_id = response.headers.get('x-restli-id', '')
        job_url = f'https://www.linkedin.com/jobs/view/{job_id}/'

        mark_published_linkedin(vacancy, job_url)
        return {'success': True, 'vacancy_id': job_id, 'url': job_url}

    except requests.exceptions.RequestException as e:
        error = str(e)
        logger.error(f'LinkedIn API error for vacancy {vacancy.id}: {error}')
        return {'success': False, 'error': error}


def _map_employment_type_linkedin(et):
    mapping = {
        'full_time': 'FULL_TIME',
        'part_time': 'PART_TIME',
        'volunteer': 'VOLUNTEER',
        'contract': 'CONTRACT',
    }
    return mapping.get(et, 'FULL_TIME')
