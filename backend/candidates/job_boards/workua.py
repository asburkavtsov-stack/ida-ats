"""
work.ua інтеграція
===================
work.ua не має публічного Employer API для прямої публікації.

Доступні варіанти:
1. XML-фід (рекомендовано) — передати URL фіду менеджеру work.ua
2. Вебхук від work.ua — налаштовується в особистому кабінеті роботодавця
3. Email-парсинг відгуків — work.ua надсилає відгуки на email роботодавця

Документація: https://www.work.ua/employer/vacancies/xml/
"""

import logging
from datetime import datetime
from xml.etree.ElementTree import Element, SubElement, tostring
from xml.dom.minidom import parseString

logger = logging.getLogger(__name__)

# Категорії work.ua (основні)
WORK_UA_CATEGORIES = {
    'IT': 1,
    'Marketing': 2,
    'Finance': 3,
    'HR': 4,
    'Management': 5,
    'Other': 99,
}

# Типи зайнятості work.ua
WORK_UA_EMPLOYMENT = {
    'full_time': 74,   # Повна зайнятість
    'part_time': 75,   # Неповна зайнятість
    'volunteer': 76,   # Волонтерство
    'contract': 77,    # Проектна робота
}


# ---------------------------------------------------------------------------
# XML ФІД
# ---------------------------------------------------------------------------

def generate_xml_feed(vacancies):
    """
    Генерує XML-фід у форматі work.ua.
    URL цього фіду треба передати вашому менеджеру на work.ua.
    Вони налаштують автоімпорт раз на годину.
    """
    root = Element('jobs')
    root.set('xmlns:xsi', 'http://www.w3.org/2001/XMLSchema-instance')
    root.set('date', datetime.utcnow().strftime('%Y-%m-%dT%H:%M:%S'))

    for v in vacancies:
        job = SubElement(root, 'job')

        SubElement(job, 'id').text = str(v.id)
        SubElement(job, 'title').text = v.title
        SubElement(job, 'description').text = _build_description(v)
        SubElement(job, 'company').text = (
            v.organization.name if v.organization else 'IDA'
        )
        SubElement(job, 'city').text = v.city or 'Україна'
        SubElement(job, 'category_id').text = str(_get_category_id(v.department))
        SubElement(job, 'employment_id').text = str(
            WORK_UA_EMPLOYMENT.get(v.employment_type, 74)
        )
        SubElement(job, 'date_posted').text = v.created_at.strftime('%Y-%m-%d')

        if v.salary_min or v.salary_max:
            if v.salary_min:
                SubElement(job, 'salary_from').text = str(v.salary_min)
            if v.salary_max:
                SubElement(job, 'salary_to').text = str(v.salary_max)

    xml_str = tostring(root, encoding='unicode')
    return parseString(xml_str).toprettyxml(indent='  ', encoding=None)


def _build_description(vacancy):
    parts = []
    if vacancy.description:
        parts.append(vacancy.description)
    if vacancy.requirements:
        parts.append(f"\n\nВимоги:\n{vacancy.requirements}")
    return '\n'.join(parts) or vacancy.title


def _get_category_id(department):
    """Спрощений маппінг department → work.ua category_id."""
    department_lower = (department or '').lower()
    if any(k in department_lower for k in ['it', 'розробк', 'програм', 'dev']):
        return WORK_UA_CATEGORIES['IT']
    if any(k in department_lower for k in ['hr', 'кадр', 'рекрут']):
        return WORK_UA_CATEGORIES['HR']
    if any(k in department_lower for k in ['маркет', 'market', 'smm']):
        return WORK_UA_CATEGORIES['Marketing']
    if any(k in department_lower for k in ['фінанс', 'бухгалт', 'finance']):
        return WORK_UA_CATEGORIES['Finance']
    return WORK_UA_CATEGORIES['Other']


# ---------------------------------------------------------------------------
# ВЕБХУК — прийом відгуків від work.ua
# ---------------------------------------------------------------------------

def parse_webhook_application(data):
    """
    Парсить вебхук-payload від work.ua і повертає dict у форматі Candidate.

    work.ua надсилає POST на ваш URL (налаштовується в кабінеті роботодавця).
    Приклад payload:
    {
        "applicant": {
            "name": "Іван Петренко",
            "email": "ivan@example.com",
            "phone": "+380501234567"
        },
        "vacancy_id": "123",
        "cover_letter": "Хочу у вас працювати..."
    }
    """
    applicant = data.get('applicant', {})
    name_parts = applicant.get('name', '').split(' ', 1)

    return {
        'first_name': name_parts[0] if name_parts else '',
        'last_name': name_parts[1] if len(name_parts) > 1 else '',
        'email': applicant.get('email', ''),
        'phone': applicant.get('phone', ''),
        'source': 'work_ua',
        'notes': data.get('cover_letter', ''),
        'external_vacancy_id': str(data.get('vacancy_id', '')),
    }
