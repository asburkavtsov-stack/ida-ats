import re
from typing import Tuple, Optional, Dict, Any

from django.db.models import Q

from candidates.models import Candidate, Organization, normalize_phone


def normalize_phone_number(phone: str) -> str:
    return normalize_phone(phone)


def validate_email_domain(email: str, allowed_domains: list = None) -> bool:
    if not email or '@' not in email:
        return False

    if allowed_domains:
        domain = email.split('@')[-1].lower()
        return domain in allowed_domains

    return True


def check_candidate_duplicates(
        email: str,
        phone: str,
        organization: Organization,
        exclude_id: Optional[int] = None
) -> Tuple[bool, Optional[Candidate], str]:
    if not email and not phone:
        return False, None, ''

    qs = Candidate.objects.filter(organization=organization)

    if exclude_id:
        qs = qs.exclude(id=exclude_id)

    if email:
        dup = qs.filter(email__iexact=email).first()
        if dup:
            return True, dup, 'email'

    if phone:
        phone_norm = normalize_phone(phone)
        dup = qs.filter(
            Q(phone=phone_norm) | Q(phone__iexact=phone)
        ).first()
        if dup:
            return True, dup, 'phone'

    return False, None, ''


def validate_organization_limits(
        organization: Organization,
        role: str = 'hr'
) -> Tuple[bool, Optional[str]]:
    if role == 'hr':
        current_hr_count = UserProfile.objects.filter(
            organization=organization,
            role='hr'
        ).count()

        if current_hr_count >= organization.max_hr:
            return False, f'Ліміт HR-менеджерів досягнуто ({organization.max_hr})'

    return True, None


def parse_csv_row(
        row: Dict[str, str],
        column_mapping: Dict[str, str],
        required_fields: list
) -> Tuple[Dict[str, Any], Optional[str]]:

    parsed = {}
    errors = []

    for field, column in column_mapping.items():
        value = row.get(column, '').strip()

        if field in required_fields and not value:
            errors.append(f"Поле '{field}' обов'язкове")

        parsed[field] = value

    if errors:
        return None, '; '.join(errors)

    return parsed, None