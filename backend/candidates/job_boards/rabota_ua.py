"""
rabota.ua інтеграція
=====================
Два режими роботи:

1. XML-фід (рекомендовано для початку)
   - Генеруємо /api/vacancies/feed/rabota-ua/ → XML
   - Передаємо URL фіду в підтримку rabota.ua
   - Вони самі підтягують вакансії щогодини

2. Employer API (потребує акаунту роботодавця на rabota.ua)
   - POST на їх endpoint з токеном
   - Документація: https://employers.rabota.ua/apidoc
"""

import logging
from datetime import datetime
from xml.etree.ElementTree import Element, SubElement, tostring
from xml.dom.minidom import parseString

import requests
from django.conf import settings
from django.utils import timezone

logger = logging.getLogger(__name__)

RABOTA_UA_API_BASE = 'https://employer-api.rabota.ua'
RABOTA_UA_TOKEN = getattr(settings, 'RABOTA_UA_API_TOKEN', '')


# ---------------------------------------------------------------------------
# XML ФІД
# ---------------------------------------------------------------------------

def generate_xml_feed(vacancies):
    """
    Генерує XML-фід вакансій у форматі rabota.ua / HR-XML.
    Приймає queryset або список об'єктів Vacancy.
    Повертає рядок XML.
    """
    root = Element('vacancies')
    root.set('xmlns:xsi', 'http://www.w3.org/2001/XMLSchema-instance')
    root.set('created', datetime.utcnow().isoformat())

    for v in vacancies:
        vacancy_el = SubElement(root, 'vacancy')

        SubElement(vacancy_el, 'id').text = str(v.id)
        SubElement(vacancy_el, 'title').text = v.title
        SubElement(vacancy_el, 'description').text = _build_description(v)
        SubElement(vacancy_el, 'city').text = v.city or ''
        SubElement(vacancy_el, 'company').text = (
            v.organization.name if v.organization else 'IDA'
        )
        SubElement(vacancy_el, 'employment_type').text = _map_employment_type(v.employment_type)
        SubElement(vacancy_el, 'category').text = v.department or 'Інше'
        SubElement(vacancy_el, 'date_posted').text = v.created_at.strftime('%Y-%m-%d')

        if v.salary_min or v.salary_max:
            salary_el = SubElement(vacancy_el, 'salary')
            if v.salary_min:
                SubElement(salary_el, 'from').text = str(v.salary_min)
            if v.salary_max:
                SubElement(salary_el, 'to').text = str(v.salary_max)
            SubElement(salary_el, 'currency').text = 'UAH'

    xml_str = tostring(root, encoding='unicode')
    return parseString(xml_str).toprettyxml(indent='  ', encoding=None)


def _build_description(vacancy):
    """Збирає повний опис вакансії з полів моделі."""
    parts = []
    if vacancy.description:
        parts.append(vacancy.description)
    if vacancy.requirements:
        parts.append(f"\n\nВимоги:\n{vacancy.requirements}")
    return '\n'.join(parts) or vacancy.title


def _map_employment_type(et):
    mapping = {
        'full_time': 'Повна зайнятість',
        'part_time': 'Часткова зайнятість',
        'volunteer': 'Волонтерство',
        'contract': 'Контракт',
    }
    return mapping.get(et, 'Повна зайнятість')


# ---------------------------------------------------------------------------
# EMPLOYER API (потребує RABOTA_UA_API_TOKEN в .env)
# ---------------------------------------------------------------------------

def publish_vacancy(vacancy):
    """
    Публікує вакансію через Employer API rabota.ua.
    Повертає {'success': True, 'vacancy_id': '...'} або {'success': False, 'error': '...'}.

    Потрібно додати в .env:
        RABOTA_UA_API_TOKEN=your_token_here
        RABOTA_UA_EMPLOYER_ID=your_employer_id
    """
    if not RABOTA_UA_TOKEN:
        return {'success': False, 'error': 'RABOTA_UA_API_TOKEN не налаштований в .env'}

    payload = {
        'title': vacancy.title,
        'description': _build_description(vacancy),
        'city': vacancy.city or 'Київ',
        'employmentType': _map_employment_type(vacancy.employment_type),
        'category': vacancy.department,
    }

    if vacancy.salary_min:
        payload['salaryFrom'] = vacancy.salary_min
    if vacancy.salary_max:
        payload['salaryTo'] = vacancy.salary_max

    headers = {
        'Authorization': f'Bearer {RABOTA_UA_TOKEN}',
        'Content-Type': 'application/json',
    }

    try:
        response = requests.post(
            f'{RABOTA_UA_API_BASE}/vacancies',
            json=payload,
            headers=headers,
            timeout=15,
        )
        response.raise_for_status()
        data = response.json()

        vacancy_id = str(data.get('id', ''))
        vacancy.published_rabota_ua = True
        vacancy.rabota_ua_vacancy_id = vacancy_id
        vacancy.published_at_rabota_ua = timezone.now()
        vacancy.save(update_fields=[
            'published_rabota_ua', 'rabota_ua_vacancy_id', 'published_at_rabota_ua'
        ])

        logger.info(f'Vacancy {vacancy.id} published to rabota.ua, id={vacancy_id}')
        return {'success': True, 'vacancy_id': vacancy_id}

    except requests.exceptions.HTTPError as e:
        error = f'HTTP {e.response.status_code}: {e.response.text[:200]}'
        logger.error(f'rabota.ua publish error for vacancy {vacancy.id}: {error}')
        return {'success': False, 'error': error}
    except requests.exceptions.RequestException as e:
        logger.error(f'rabota.ua connection error: {e}')
        return {'success': False, 'error': str(e)}


def unpublish_vacancy(vacancy):
    """Знімає вакансію з публікації на rabota.ua."""
    if not RABOTA_UA_TOKEN or not vacancy.rabota_ua_vacancy_id:
        return {'success': False, 'error': 'Немає токену або ID вакансії'}

    headers = {'Authorization': f'Bearer {RABOTA_UA_TOKEN}'}

    try:
        response = requests.delete(
            f'{RABOTA_UA_API_BASE}/vacancies/{vacancy.rabota_ua_vacancy_id}',
            headers=headers,
            timeout=15,
        )
        response.raise_for_status()

        vacancy.published_rabota_ua = False
        vacancy.save(update_fields=['published_rabota_ua'])
        return {'success': True}

    except requests.exceptions.RequestException as e:
        return {'success': False, 'error': str(e)}


def fetch_applications(vacancy):
    """
    Отримує відгуки на вакансію з rabota.ua.
    Повертає список словників з даними кандидатів.
    """
    if not RABOTA_UA_TOKEN or not vacancy.rabota_ua_vacancy_id:
        return []

    headers = {'Authorization': f'Bearer {RABOTA_UA_TOKEN}'}

    try:
        response = requests.get(
            f'{RABOTA_UA_API_BASE}/vacancies/{vacancy.rabota_ua_vacancy_id}/applications',
            headers=headers,
            timeout=15,
        )
        response.raise_for_status()
        data = response.json()

        # Нормалізуємо в наш формат Candidate
        applications = []
        for item in data.get('items', []):
            applications.append({
                'first_name': item.get('firstName', ''),
                'last_name': item.get('lastName', ''),
                'email': item.get('email', ''),
                'phone': item.get('phone', ''),
                'source': 'rabota_ua',
                'notes': item.get('coverLetter', ''),
            })
        return applications

    except requests.exceptions.RequestException as e:
        logger.error(f'rabota.ua fetch_applications error: {e}')
        return []
