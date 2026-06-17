from typing import Optional, Dict, Any, Tuple, List
import re
from django.db import transaction
from django.db.models import Q, QuerySet
from django.contrib.auth.models import User

from candidates.models import (
    Candidate, Organization, Vacancy, Tag,
    StatusHistory, UserProfile, normalize_phone
)
from candidates.utils.validators import check_candidate_duplicates
from candidates.utils.context_processors import clear_user_cache


# ─── Advanced Search Parser ────────────────────────────────────────────────────
#
# Підтримувані токени (Gmail-стиль):
#   source:linkedin          → candidate.source
#   status:interview         → stage.system_key  (або system_key alias)
#   stage:interview          → те саме, що status:
#   hr:ivan                  → assigned_to.username / first_name / last_name (icontains)
#   tags:python,django       → теги (AND: кандидат має мати всі перелічені)
#   tag:python               → те саме, один тег
#   vacancy:backend          → vacancy.title icontains
#   notes:important          → notes icontains
#   email:@gmail             → email icontains
#   phone:+380               → phone icontains
#   (решта тексту)           → full-text по first_name / last_name / email
#
# Приклади:
#   source:linkedin status:interview hr:ivan tags:python
#   backend source:dou
#   tags:react,node hr:olena

KNOWN_TOKENS = {'source', 'status', 'stage', 'hr', 'tags', 'tag', 'vacancy', 'notes', 'email', 'phone'}

# Псевдоніми для source (щоб писати linkedin замість linkedin, dou, work_ua...)
SOURCE_ALIASES = {
    'linkedin':       'linkedin',
    'дou':            'dou',
    'dou':            'dou',
    'work_ua':        'work_ua',
    'work.ua':        'work_ua',
    'workua':         'work_ua',
    'rabota_ua':      'rabota_ua',
    'rabota.ua':      'rabota_ua',
    'rabotaua':       'rabota_ua',
    'recommendation': 'recommendation',
    'рекомендація':   'recommendation',
    'csv':            'csv',
    'direct':         'direct',
    'прямий':         'direct',
    'other':          'other',
    'інше':           'other',
}

# Псевдоніми для status / stage system_key
STATUS_ALIASES = {
    'new':         'new',
    'новий':       'new',
    'нові':        'new',
    'screening':   'screening',
    'скринінг':    'screening',
    'interview':   'interview',
    'інтерв':      'interview',
    'interview':   'interview',
    'offer':       'offer',
    'оффер':       'offer',
    'офер':        'offer',
    'rejected':    'rejected',
    'відмова':     'rejected',
}


def parse_advanced_search(query: str) -> Dict:
    """
    Парсить рядок Gmail-стилю і повертає словник розпізнаних фільтрів.

    Повертає:
    {
        'text':     str | None,      # вільний текст (ім'я / прізвище / email)
        'source':   str | None,
        'status':   str | None,      # system_key
        'hr':       str | None,      # пошук по username/ім'ю HR
        'tags':     list[str],       # назви тегів (icontains кожен)
        'vacancy':  str | None,
        'notes':    str | None,
        'email':    str | None,
        'phone':    str | None,
    }
    """
    if not query or not query.strip():
        return {}

    result = {
        'text': None,
        'source': None,
        'status': None,
        'hr': None,
        'tags': [],
        'vacancy': None,
        'notes': None,
        'email': None,
        'phone': None,
    }

    # Регексп: key:value  або  key:"value with spaces"
    token_pattern = re.compile(
        r'(\w+):"([^"]+)"|(\w+):(\S+)'
    )

    remaining = query

    for m in token_pattern.finditer(query):
        key = (m.group(1) or m.group(3)).lower()
        value = (m.group(2) or m.group(4)).strip()

        if key not in KNOWN_TOKENS:
            continue

        # Видаляємо токен з залишку (для вільного тексту)
        remaining = remaining.replace(m.group(0), '', 1)

        if key == 'source':
            result['source'] = SOURCE_ALIASES.get(value.lower(), value.lower())

        elif key in ('status', 'stage'):
            result['status'] = STATUS_ALIASES.get(value.lower(), value.lower())

        elif key == 'hr':
            result['hr'] = value

        elif key in ('tags', 'tag'):
            # Дозволяємо через кому: tags:python,django
            for t in value.split(','):
                t = t.strip()
                if t:
                    result['tags'].append(t)

        elif key == 'vacancy':
            result['vacancy'] = value

        elif key == 'notes':
            result['notes'] = value

        elif key == 'email':
            result['email'] = value

        elif key == 'phone':
            result['phone'] = value

    # Вільний текст — все що залишилось після видалення токенів
    free_text = remaining.strip()
    if free_text:
        result['text'] = free_text

    return result


class CandidateService:

    @staticmethod
    def get_queryset_for_user(user: User, filters: Dict = None) -> QuerySet:
        from candidates.utils.context_processors import get_user_role, get_user_organization
        from candidates.models import VacancyAccess
        from django.db.models import Q as DQ

        role = get_user_role(user)
        org = get_user_organization(user)

        if role == 'superadmin':
            qs = Candidate.objects.all()
            if filters and filters.get('organization_id'):
                qs = qs.filter(organization_id=filters['organization_id'])
        elif role == 'admin':
            qs = Candidate.objects.filter(organization=org) if org else Candidate.objects.none()
        else:
            # HR — лише кандидати по своїх вакансіях (owner або делегований доступ)
            if not org:
                return Candidate.objects.none()
            delegated_ids = VacancyAccess.objects.filter(
                user=user
            ).values_list('vacancy_id', flat=True)
            qs = Candidate.objects.filter(organization=org).filter(
                DQ(vacancy__owner=user) |
                DQ(vacancy__id__in=delegated_ids) |
                DQ(vacancy__isnull=True, assigned_to=user)
            )

        return qs.select_related('assigned_to', 'vacancy', 'organization').prefetch_related(
            'status_history', 'status_history__changed_by', 'tags'
        ).order_by('-created_at')

    @staticmethod
    def apply_filters(qs: QuerySet, filters: Dict) -> QuerySet:
        # ── Стандартні фільтри (з query params) ───────────────────────────────
        if filters.get('vacancy_id'):
            qs = qs.filter(vacancy_id=filters['vacancy_id'])

        if filters.get('status'):
            qs = qs.filter(status=filters['status'])

        if filters.get('source'):
            qs = qs.filter(source=filters['source'])

        if filters.get('assigned_to_id'):
            qs = qs.filter(assigned_to_id=filters['assigned_to_id'])

        if filters.get('mine') == 'true' and filters.get('user'):
            qs = qs.filter(assigned_to=filters['user'])

        if filters.get('tag_ids'):
            qs = qs.filter(tags__id__in=filters['tag_ids']).distinct()

        # ── Advanced search (q= параметр, Gmail-стиль) ────────────────────────
        if filters.get('advanced'):
            parsed = filters['advanced']

            # Вільний текст → ім'я, прізвище, email
            if parsed.get('text'):
                text = parsed['text']
                qs = qs.filter(
                    Q(first_name__icontains=text) |
                    Q(last_name__icontains=text) |
                    Q(email__icontains=text)
                )

            # source:
            if parsed.get('source'):
                qs = qs.filter(source=parsed['source'])

            # status: / stage: → через VacancyStage.system_key
            if parsed.get('status'):
                qs = qs.filter(stage__system_key=parsed['status'])

            # hr: → assigned_to username або ім'я
            if parsed.get('hr'):
                hr_val = parsed['hr']
                qs = qs.filter(
                    Q(assigned_to__username__icontains=hr_val) |
                    Q(assigned_to__first_name__icontains=hr_val) |
                    Q(assigned_to__last_name__icontains=hr_val)
                )

            # tags: → AND логіка (кандидат має мати всі зазначені теги)
            if parsed.get('tags'):
                for tag_name in parsed['tags']:
                    qs = qs.filter(tags__name__icontains=tag_name)
                qs = qs.distinct()

            # vacancy:
            if parsed.get('vacancy'):
                qs = qs.filter(vacancy__title__icontains=parsed['vacancy'])

            # notes:
            if parsed.get('notes'):
                qs = qs.filter(notes__icontains=parsed['notes'])

            # email:
            if parsed.get('email'):
                qs = qs.filter(email__icontains=parsed['email'])

            # phone:
            if parsed.get('phone'):
                qs = qs.filter(phone__icontains=parsed['phone'])

            return qs

        # ── Старий простий пошук (search=) — зворотна сумісність ──────────────
        if filters.get('search'):
            search = filters['search']
            qs = qs.filter(
                Q(first_name__icontains=search) |
                Q(last_name__icontains=search) |
                Q(email__icontains=search)
            )

        return qs

    @staticmethod
    @transaction.atomic
    def create_candidate(
            data: Dict[str, Any],
            organization: Organization,
            tag_ids: List[int] = None
    ) -> Tuple[Candidate, bool, Optional[str]]:
        has_dup, dup_candidate, match_by = check_candidate_duplicates(
            email=data.get('email', ''),
            phone=data.get('phone', ''),
            organization=organization,
            exclude_id=None
        )

        if has_dup:
            return dup_candidate, False, f'Дублікат за {match_by}'

        candidate = Candidate.objects.create(
            organization=organization,
            first_name=data.get('first_name'),
            last_name=data.get('last_name'),
            email=data.get('email'),
            phone=normalize_phone(data.get('phone', '')),
            vacancy=data.get('vacancy'),
            status=data.get('status', 'new'),
            source=data.get('source', 'other'),
            notes=data.get('notes', ''),
            assigned_to=data.get('assigned_to'),
        )

        if tag_ids:
            candidate.tags.set(tag_ids)

        StatusHistory.objects.create(
            candidate=candidate,
            old_status=None,
            new_status=candidate.status,
            changed_by=data.get('created_by'),
        )

        return candidate, True, None

    @staticmethod
    @transaction.atomic
    def update_candidate_status(
            candidate: Candidate,
            new_status: str,
            changed_by: User
    ) -> StatusHistory:
        old_status = candidate.status

        if old_status == new_status:
            return None

        candidate.status = new_status
        candidate.save()

        history = StatusHistory.objects.create(
            candidate=candidate,
            old_status=old_status,
            new_status=new_status,
            changed_by=changed_by,
        )

        return history

    @staticmethod
    @transaction.atomic
    def assign_to_hr(candidate: Candidate, hr_user: User = None) -> Candidate:
        candidate.assigned_to = hr_user
        candidate.save()
        return candidate

    @staticmethod
    def get_candidate_with_details(candidate_id: int, organization: Organization) -> Optional[Candidate]:
        return Candidate.objects.filter(
            id=candidate_id,
            organization=organization
        ).select_related('assigned_to', 'vacancy').prefetch_related('tags', 'status_history').first()