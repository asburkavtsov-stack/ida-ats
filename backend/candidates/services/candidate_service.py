from typing import Optional, Dict, Any, Tuple, List
from django.db import transaction
from django.db.models import Q, QuerySet
from django.contrib.auth.models import User

from candidates.models import (
    Candidate, Organization, Vacancy, Tag,
    StatusHistory, UserProfile, normalize_phone
)
from candidates.utils.validators import check_candidate_duplicates
from candidates.utils.context_processors import clear_user_cache


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