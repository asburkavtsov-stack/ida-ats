import csv
import logging
from datetime import datetime
from django.db import models
from django.shortcuts import get_object_or_404
from django.http import HttpResponse, JsonResponse

from rest_framework import status, viewsets
from rest_framework.decorators import action, api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from .models import (
    Candidate, EmailTemplate, Organization,
    SentEmail, Tag, User, UserProfile, Vacancy, Interview
)
from .serializers import (
    CandidateSerializer, EmailTemplateSerializer, OrganizationSerializer,
    SentEmailSerializer, TagSerializer, VacancySerializer, DuplicateCandidateSerializer,
    InterviewSerializer
)
from .pagination import StandardPagination
from .permissions import IsSuperAdmin, IsOrgMember
from .services import CandidateService, EmailService, AnalyticsService
from .utils.export_service import ExportService, FullReportExportService
from .utils.context_processors import (
    get_user_profile, get_user_organization, get_user_role,
    is_superadmin, clear_user_cache
)
from .utils.validators import check_candidate_duplicates, validate_organization_limits
from .utils.csv_handlers import CSVHandler, CSVImportResult

from .constants import KANBAN_COLUMNS, SOURCE_CONFIG

try:
    from allauth.account.models import EmailAddress
    ALLAUTH_AVAILABLE = True
except ImportError:
    ALLAUTH_AVAILABLE = False

logger = logging.getLogger(__name__)


# ═══════════════════════════════════════════════════════════════
# TAGS
# ═══════════════════════════════════════════════════════════════

class TagViewSet(viewsets.ModelViewSet):
    serializer_class = TagSerializer
    permission_classes = [IsAuthenticated, IsOrgMember]

    def get_queryset(self):
        role = get_user_role(self.request.user)
        if role == 'superadmin':
            org_id = self.request.query_params.get('organization')
            qs = Tag.objects.all()
            return qs.filter(organization_id=org_id) if org_id else qs
        org = get_user_organization(self.request.user)
        return Tag.objects.filter(organization=org) if org else Tag.objects.none()

    def perform_create(self, serializer):
        org = get_user_organization(self.request.user)
        if not org:
            raise serializers.ValidationError({'error': "Користувач не прив'язаний до організації"})
        serializer.save(organization=org)


# ═══════════════════════════════════════════════════════════════
# VACANCIES
# ═══════════════════════════════════════════════════════════════

class VacancyViewSet(viewsets.ModelViewSet):
    serializer_class = VacancySerializer
    permission_classes = [IsAuthenticated, IsOrgMember]

    def get_queryset(self):
        role = get_user_role(self.request.user)
        if role == 'superadmin':
            org_id = self.request.query_params.get('organization')
            qs = Vacancy.objects.all()
            if org_id:
                qs = qs.filter(organization_id=org_id)
        else:
            org = get_user_organization(self.request.user)
            qs = Vacancy.objects.filter(organization=org) if org else Vacancy.objects.none()
        return qs.order_by('-created_at')

    def perform_create(self, serializer):
        serializer.save(organization=get_user_organization(self.request.user))


# ═══════════════════════════════════════════════════════════════
# ORGANIZATIONS
# ═══════════════════════════════════════════════════════════════

class OrganizationViewSet(viewsets.ModelViewSet):
    queryset = Organization.objects.all().order_by('id')
    serializer_class = OrganizationSerializer
    permission_classes = [IsAuthenticated, IsSuperAdmin]


# ═══════════════════════════════════════════════════════════════
# CANDIDATES
# ═══════════════════════════════════════════════════════════════

class CandidateViewSet(viewsets.ModelViewSet):
    serializer_class = CandidateSerializer
    permission_classes = [IsAuthenticated, IsOrgMember]
    pagination_class = StandardPagination

    def get_queryset(self):
        filters = {
            'organization_id': self.request.query_params.get('organization'),
            'vacancy_id': self.request.query_params.get('vacancy'),
            'status': self.request.query_params.get('status'),
            'source': self.request.query_params.get('source'),
            'assigned_to_id': self.request.query_params.get('assigned_to'),
            'mine': self.request.query_params.get('mine'),
            'user': self.request.user,
            'search': self.request.query_params.get('search'),
            'tag_ids': [int(t) for t in self.request.query_params.get('tags', '').split(',') if t.isdigit()]
            if self.request.query_params.get('tags') else None,
        }
        qs = CandidateService.get_queryset_for_user(self.request.user, filters)
        return CandidateService.apply_filters(qs, filters)

    def perform_create(self, serializer):
        org = get_user_organization(self.request.user)
        tag_ids = serializer.validated_data.pop('tag_ids', [])

        has_dup, dup_candidate, match_by = check_candidate_duplicates(
            email=serializer.validated_data.get('email', ''),
            phone=serializer.validated_data.get('phone', ''),
            organization=org,
        )

        if has_dup:
            raise serializers.ValidationError({
                'duplicate': True,
                'duplicate_by': match_by,
                'duplicate_candidate': DuplicateCandidateSerializer(dup_candidate).data,
                'message': f'Кандидат вже існує: {dup_candidate.first_name} {dup_candidate.last_name}'
            })

        candidate = serializer.save(organization=org)
        if tag_ids:
            candidate.tags.set(tag_ids)

    @action(detail=True, methods=['patch'], url_path='update_status')
    def update_status(self, request, pk=None):
        candidate = self.get_object()
        new_status = request.data.get('status')
        if not new_status:
            return Response({'error': 'Status required'}, status=status.HTTP_400_BAD_REQUEST)
        CandidateService.update_candidate_status(candidate, new_status, request.user)
        return Response(CandidateSerializer(candidate).data)

    @action(detail=True, methods=['patch'], url_path='assign')
    def assign(self, request, pk=None):
        candidate = self.get_object()
        user_id = request.data.get('assigned_to')
        if user_id is None:
            candidate = CandidateService.assign_to_hr(candidate, None)
        else:
            try:
                hr_user = User.objects.get(id=user_id)
                candidate = CandidateService.assign_to_hr(candidate, hr_user)
            except User.DoesNotExist:
                return Response({'error': 'User not found'}, status=status.HTTP_404_NOT_FOUND)
        return Response(CandidateSerializer(candidate).data)

    @action(detail=False, methods=['post'], url_path='check-duplicate')
    def check_duplicate(self, request):
        email = request.data.get('email', '').strip()
        phone = request.data.get('phone', '').strip()
        if not email and not phone:
            return Response({'error': 'Email або телефон обов\'язкові'}, status=status.HTTP_400_BAD_REQUEST)
        org = get_user_organization(request.user)
        has_dup, dup_candidate, match_by = check_candidate_duplicates(email, phone, org)
        return Response({
            'has_duplicate': has_dup,
            'duplicate_by': match_by if has_dup else None,
            'duplicate_candidate': DuplicateCandidateSerializer(dup_candidate).data if dup_candidate else None,
        })

    @action(detail=False, methods=['post'], url_path='import-csv')
    def import_csv(self, request):
        csv_file = request.FILES.get('file')
        if not csv_file:
            return Response({'error': 'Файл CSV обов\'язковий'}, status=status.HTTP_400_BAD_REQUEST)

        org = get_user_organization(request.user)
        if not org:
            return Response({'error': "Користувач не прив'язаний до організації"}, status=status.HTTP_400_BAD_REQUEST)

        rows, fieldnames, error = CSVHandler.read_csv_file(csv_file)
        if error:
            return Response({'error': error}, status=status.HTTP_400_BAD_REQUEST)

        column_mapping = CSVHandler.detect_column_mapping(fieldnames)
        if 'first_name' not in column_mapping or 'last_name' not in column_mapping or 'email' not in column_mapping:
            return Response({'error': 'CSV має містити колонки: first_name, last_name, email'},
                            status=status.HTTP_400_BAD_REQUEST)

        result = CSVImportResult()
        for row_num, row in enumerate(rows, start=2):
            try:
                first_name = row.get(column_mapping.get('first_name', ''), '').strip()
                last_name = row.get(column_mapping.get('last_name', ''), '').strip()
                email = row.get(column_mapping.get('email', ''), '').strip().lower()
                phone = row.get(column_mapping.get('phone', ''), '').strip()
                vacancy_title = row.get(column_mapping.get('vacancy', ''), '').strip()
                status_val = row.get(column_mapping.get('status', ''), 'new').strip().lower()
                source_val = row.get(column_mapping.get('source', ''), 'csv').strip().lower()
                notes = row.get(column_mapping.get('notes', ''), '').strip()

                if not first_name or not last_name or not email:
                    result.errors.append({'row': row_num, 'error': "Ім'я, прізвище та email обов'язкові"})
                    continue

                has_dup, dup_candidate, match_by = check_candidate_duplicates(email, phone, org)
                if has_dup:
                    result.duplicates.append(
                        {'row': row_num, 'candidate': DuplicateCandidateSerializer(dup_candidate).data,
                         'matched_by': match_by})
                    continue

                vacancy = Vacancy.objects.filter(organization=org,
                                                 title__iexact=vacancy_title).first() if vacancy_title else None
                valid_statuses = [s[0] for s in Candidate.STATUS_CHOICES]
                valid_sources = [s[0] for s in Candidate.SOURCE_CHOICES]

                Candidate.objects.create(
                    organization=org, first_name=first_name, last_name=last_name, email=email, phone=phone,
                    vacancy=vacancy, status=status_val if status_val in valid_statuses else 'new',
                    source=source_val if source_val in valid_sources else 'csv', notes=notes,
                )
                result.created += 1
            except Exception as e:
                result.errors.append({'row': row_num, 'error': str(e)})

        return Response(result.to_dict())


# ═══════════════════════════════════════════════════════════════
# CANDIDATES CSV EXPORT
# ═══════════════════════════════════════════════════════════════

class CandidateExportCSVView(APIView):
    permission_classes = [IsAuthenticated, IsOrgMember]

    STATUS_LABELS = {'new': 'Новий', 'screening': 'Скринінг', 'interview': 'Співбесіда', 'offer': 'Оффер',
                     'rejected': 'Відмова'}

    def get(self, request):
        filters = {'organization_id': request.query_params.get('organization'),
                   'vacancy_id': request.query_params.get('vacancy'),
                   'status': request.query_params.get('status'), 'source': request.query_params.get('source'),
                   'search': request.query_params.get('search'),
                   'tag_ids': [int(t) for t in request.query_params.get('tags', '').split(',') if t.isdigit()]
                   if request.query_params.get('tags') else None}
        qs = CandidateService.get_queryset_for_user(request.user, filters)
        qs = CandidateService.apply_filters(qs, filters)

        def extractor(c):
            return [c.id, c.first_name or '', c.last_name or '', c.email or '', c.phone or '',
                    c.vacancy.title if c.vacancy else '—', c.organization.name if c.organization else '—',
                    self.STATUS_LABELS.get(c.status, c.status), c.get_source_display() if c.source else '—',
                    ', '.join([t.name for t in c.tags.all()]), (c.notes or '').replace('\n', ' ').replace('\r', ''),
                    c.created_at.strftime('%d.%m.%Y %H:%M') if c.created_at else '—']

        headers = ['ID', "Ім'я", 'Прізвище', 'Email', 'Телефон', 'Вакансія', 'Організація', 'Статус', 'Джерело', 'Теги',
                   'Нотатки', 'Дата створення']
        return CSVHandler.export_queryset_to_csv(qs, 'candidates.csv', headers, extractor)


# ═══════════════════════════════════════════════════════════════
# INTERVIEWS
# ═══════════════════════════════════════════════════════════════

class InterviewViewSet(viewsets.ModelViewSet):
    serializer_class = InterviewSerializer
    permission_classes = [IsAuthenticated, IsOrgMember]

    def get_queryset(self):
        role = get_user_role(self.request.user)
        if role == 'superadmin':
            org_id = self.request.query_params.get('organization')
            qs = Interview.objects.select_related(
                'candidate', 'vacancy', 'organization', 'created_by'
            ).prefetch_related('interviewers')
            return qs.filter(organization_id=org_id) if org_id else qs
        org = get_user_organization(self.request.user)
        if not org:
            return Interview.objects.none()
        qs = Interview.objects.filter(organization=org).select_related(
            'candidate', 'vacancy', 'organization', 'created_by'
        ).prefetch_related('interviewers')
        # Фільтри
        candidate_id = self.request.query_params.get('candidate')
        vacancy_id = self.request.query_params.get('vacancy')
        status_f = self.request.query_params.get('status')
        date_from = self.request.query_params.get('date_from')
        date_to = self.request.query_params.get('date_to')
        if candidate_id:
            qs = qs.filter(candidate_id=candidate_id)
        if vacancy_id:
            qs = qs.filter(vacancy_id=vacancy_id)
        if status_f:
            qs = qs.filter(status=status_f)
        if date_from:
            qs = qs.filter(scheduled_at__date__gte=date_from)
        if date_to:
            qs = qs.filter(scheduled_at__date__lte=date_to)
        return qs

    def perform_create(self, serializer):
        org = get_user_organization(self.request.user)
        interview = serializer.save(
            organization=org,
            created_by=self.request.user,
        )
        self._sync_google_create(interview)

    def perform_update(self, serializer):
        interview = serializer.save()
        self._sync_google_update(interview)

    def perform_destroy(self, instance):
        self._sync_google_delete(instance)
        instance.delete()

    def _sync_google_create(self, interview):
        from .utils.google_calendar_service import create_calendar_event
        result = create_calendar_event(interview, self.request.user)
        if result:
            Interview.objects.filter(pk=interview.pk).update(**result)

    def _sync_google_update(self, interview):
        from .utils.google_calendar_service import update_calendar_event
        result = update_calendar_event(interview, self.request.user)
        if result:
            Interview.objects.filter(pk=interview.pk).update(**result)

    def _sync_google_delete(self, interview):
        from .utils.google_calendar_service import delete_calendar_event
        delete_calendar_event(interview, self.request.user)

    @action(detail=True, methods=['post'], url_path='sync-google')
    def sync_google(self, request, pk=None):
        """POST /api/interviews/{id}/sync-google/ — примусова синхронізація з Google Calendar."""
        interview = self.get_object()
        from .utils.google_calendar_service import update_calendar_event, create_calendar_event
        if interview.google_event_id:
            result = update_calendar_event(interview, request.user)
        else:
            result = create_calendar_event(interview, request.user)
        if result:
            for field, value in result.items():
                setattr(interview, field, value)
            interview.save(update_fields=list(result.keys()))
            return Response(InterviewSerializer(interview, context={'request': request}).data)
        return Response(
            {'warning': 'Не вдалося синхронізувати з Google Calendar. Інтерв\'ю збережено.'},
            status=status.HTTP_200_OK
        )

    @action(detail=True, methods=['patch'], url_path='change-status')
    def change_status(self, request, pk=None):
        """PATCH /api/interviews/{id}/change-status/ — змінити статус інтерв'ю."""
        interview = self.get_object()
        new_status = request.data.get('status')
        if new_status not in dict(Interview.STATUS_CHOICES):
            return Response({'error': 'Невірний статус'}, status=status.HTTP_400_BAD_REQUEST)
        interview.status = new_status
        interview.save(update_fields=['status'])
        return Response(InterviewSerializer(interview, context={'request': request}).data)


# ═══════════════════════════════════════════════════════════════
# CURRENT USER
# ═══════════════════════════════════════════════════════════════

@api_view(['GET'])
@permission_classes([IsAuthenticated])
def current_user(request):
    user = request.user
    profile = get_user_profile(user)
    org = profile.organization if profile else None
    return Response({
        'id': user.id, 'username': user.username, 'first_name': user.first_name, 'last_name': user.last_name,
        'email': user.email, 'role': profile.role if profile else None,
        'organization': {'id': org.id, 'name': org.name, 'max_vacancies': org.max_vacancies,
                         'max_hr': org.max_hr} if org else None,
    })


# ═══════════════════════════════════════════════════════════════
# USERS
# ═══════════════════════════════════════════════════════════════

class UserListView(viewsets.ViewSet):
    permission_classes = [IsAuthenticated]

    def list(self, request):
        role = get_user_role(request.user)
        org_id = request.query_params.get('organization')
        if role == 'superadmin':
            if not org_id:
                return Response({'error': 'organization parameter required'}, status=status.HTTP_400_BAD_REQUEST)
            profiles = UserProfile.objects.filter(organization_id=org_id).select_related('user')
        else:
            user_org = get_user_organization(request.user)
            if not user_org:
                return Response([], status=status.HTTP_200_OK)
            profiles = UserProfile.objects.filter(organization=user_org).select_related('user')
        return Response([{'id': p.user.id, 'username': p.user.username, 'first_name': p.user.first_name,
                          'last_name': p.user.last_name, 'email': p.user.email, 'role': p.role, 'profile_id': p.id} for
                         p in profiles])

    @action(detail=False, methods=['get'])
    def all(self, request):
        if not is_superadmin(request.user):
            return Response({'error': 'Forbidden'}, status=status.HTTP_403_FORBIDDEN)
        data = []
        for u in User.objects.all().select_related('profile__organization'):
            profile = get_user_profile(u)
            org = profile.organization if profile else None
            data.append({'id': u.id, 'username': u.username, 'first_name': u.first_name, 'last_name': u.last_name,
                         'email': u.email, 'role': profile.role if profile else None,
                         'organization_id': org.id if org else None, 'organization_name': org.name if org else None})
        return Response(data)

    def create(self, request):
        username, password = request.data.get('username'), request.data.get('password')
        if not username or not password:
            return Response({'error': "username та password обов'язкові"}, status=status.HTTP_400_BAD_REQUEST)
        if User.objects.filter(username=username).exists():
            return Response({'error': 'Username вже існує'}, status=status.HTTP_400_BAD_REQUEST)

        org_id, role = request.data.get('organization'), request.data.get('role', 'hr')
        if org_id and role == 'hr':
            try:
                org = Organization.objects.get(id=org_id)
            except Organization.DoesNotExist:
                return Response({'error': 'Організацію не знайдено'}, status=status.HTTP_404_NOT_FOUND)
            is_valid, error_msg = validate_organization_limits(org, role)
            if not is_valid:
                return Response({'error': error_msg}, status=status.HTTP_400_BAD_REQUEST)
        else:
            org = Organization.objects.filter(id=org_id).first() if org_id else None

        user = User.objects.create_user(username=username, password=password,
                                        first_name=request.data.get('first_name', ''),
                                        last_name=request.data.get('last_name', ''),
                                        email=request.data.get('email', ''))
        UserProfile.objects.create(user=user, organization=org, role=role)
        clear_user_cache(user.id)
        return Response({'success': True}, status=status.HTTP_201_CREATED)

    def partial_update(self, request, pk=None):
        try:
            user = User.objects.get(id=pk)
        except User.DoesNotExist:
            return Response({'error': 'Юзер не знайдений'}, status=status.HTTP_404_NOT_FOUND)
        user.first_name = request.data.get('first_name', user.first_name)
        user.last_name = request.data.get('last_name', user.last_name)
        user.email = request.data.get('email', user.email)
        if request.data.get('password'):
            user.set_password(request.data['password'])
        user.save()
        org_id = request.data.get('organization')
        profile = get_user_profile(user)
        if profile:
            profile.role = request.data.get('role', profile.role)
            if 'organization' in request.data and (org_id == '' or org_id is None):
                profile.organization = None
            elif org_id:
                profile.organization = Organization.objects.filter(id=org_id).first()
            profile.save()
        clear_user_cache(user.id)
        return Response({'success': True})

    def destroy(self, request, pk=None):
        try:
            user = User.objects.get(id=pk)
            clear_user_cache(user.id)
            user.delete()
            return Response({'success': True})
        except User.DoesNotExist:
            return Response({'error': 'Юзер не знайдений'}, status=status.HTTP_404_NOT_FOUND)


# ═══════════════════════════════════════════════════════════════
# EMAIL TEMPLATES
# ═══════════════════════════════════════════════════════════════

class EmailTemplateViewSet(viewsets.ModelViewSet):
    serializer_class = EmailTemplateSerializer
    permission_classes = [IsAuthenticated, IsOrgMember]
    pagination_class = StandardPagination

    def get_queryset(self):
        role = get_user_role(self.request.user)
        if role == 'superadmin':
            qs = EmailTemplate.objects.all()
            org_id = self.request.query_params.get('organization')
            return qs.filter(organization_id=org_id) if org_id else qs
        org = get_user_organization(self.request.user)
        return EmailTemplate.objects.filter(organization=org) if org else EmailTemplate.objects.none()

    def perform_create(self, serializer):
        org = get_user_organization(self.request.user)
        if not org:
            raise serializers.ValidationError({'error': "Користувач не прив'язаний до організації"})
        serializer.save(organization=org)

    @action(detail=True, methods=['post'])
    def preview(self, request, pk=None):
        template = self.get_object()
        candidate_id = request.data.get('candidate_id')
        if not candidate_id:
            return Response({'error': 'candidate_id is required'}, status=status.HTTP_400_BAD_REQUEST)
        candidate = get_object_or_404(Candidate, id=candidate_id, organization=template.organization)
        subject, body = EmailService.apply_template_replacements(template.subject, template.body, candidate, request)
        return Response(
            {'subject': subject, 'body': body, 'candidate_email': candidate.email, 'from_email': request.user.email})

    @action(detail=True, methods=['post'])
    def send(self, request, pk=None):
        template = self.get_object()
        candidate_id = request.data.get('candidate_id')
        if not candidate_id:
            return Response({'error': 'candidate_id is required'}, status=status.HTTP_400_BAD_REQUEST)
        candidate = get_object_or_404(Candidate, id=candidate_id, organization=template.organization)
        if not candidate.email:
            return Response({'error': 'У кандидата не вказано email'}, status=status.HTTP_400_BAD_REQUEST)

        subject, body = EmailService.apply_template_replacements(template.subject, template.body, candidate, request)
        sent_email = EmailService.create_sent_record(candidate, template, subject, body, request.user, 'pending')

        try:
            if EmailService.get_email_backend_type() == 'gmail' and ALLAUTH_AVAILABLE:
                sender_user = User.objects.filter(id=request.user.id).first()
                result = EmailService.send_via_gmail(sender_user, candidate.email, subject, body)
                sent_email.status = 'sent'
                sent_email.save()
                return Response(
                    {'success': True, 'message': 'Лист відправлено через Gmail API', 'sent_email_id': sent_email.id})
            else:
                EmailService.send_via_smtp(candidate.email, subject, body, request.user.email, request.user.email)
                sent_email.status = 'sent'
                sent_email.save()
                return Response({'success': True, 'message': f'Лист відправлено на {candidate.email}',
                                 'sent_email_id': sent_email.id})
        except Exception as e:
            sent_email.status = 'failed'
            sent_email.error_message = str(e)[:500]
            sent_email.save()
            return Response({'success': False, 'error': str(e)}, status=status.HTTP_502_BAD_GATEWAY)

    @action(detail=False, methods=['get'])
    def history(self, request):
        role = get_user_role(request.user)
        if role == 'superadmin':
            qs = SentEmail.objects.all()
            org_id = request.query_params.get('organization')
            if org_id:
                qs = qs.filter(candidate__organization_id=org_id)
        else:
            org = get_user_organization(request.user)
            qs = SentEmail.objects.filter(candidate__organization=org) if org else SentEmail.objects.none()
        if request.query_params.get('candidate'):
            qs = qs.filter(candidate_id=request.query_params['candidate'])
        qs = qs.select_related('candidate', 'template', 'sent_by').order_by('-sent_at')
        page = self.paginate_queryset(qs)
        if page:
            return self.get_paginated_response(SentEmailSerializer(page, many=True).data)
        return Response(SentEmailSerializer(qs, many=True).data)


class SentEmailViewSet(viewsets.ReadOnlyModelViewSet):
    serializer_class = SentEmailSerializer
    permission_classes = [IsAuthenticated, IsOrgMember]
    pagination_class = StandardPagination

    def get_queryset(self):
        role = get_user_role(self.request.user)
        if role == 'superadmin':
            qs = SentEmail.objects.all()
            org_id = self.request.query_params.get('organization')
            if org_id:
                qs = qs.filter(candidate__organization_id=org_id)
        else:
            org = get_user_organization(self.request.user)
            qs = SentEmail.objects.filter(candidate__organization=org) if org else SentEmail.objects.none()
        return qs.select_related('candidate', 'template', 'sent_by').order_by('-sent_at')


# ═══════════════════════════════════════════════════════════════
# GOOGLE AUTH
# ═══════════════════════════════════════════════════════════════

@api_view(['GET'])
@permission_classes([IsAuthenticated])
def google_auth_status(request):
    has_google = ALLAUTH_AVAILABLE and SocialAccount.objects.filter(user=request.user, provider='google').exists()
    return Response({'has_google_account': has_google, 'email': request.user.email,
                     'login_url': '/accounts/google/login/', 'logout_url': '/accounts/logout/'})


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def test_email_config(request):
    has_google = ALLAUTH_AVAILABLE and SocialAccount.objects.filter(user=request.user, provider='google').exists()
    return Response({'gmail_api': 'active' if ALLAUTH_AVAILABLE else 'inactive', 'has_google_account': has_google,
                     'google_login_url': '/accounts/google/login/', 'current_user_email': request.user.email,
                     'email_backend_type': EmailService.get_email_backend_type()})


# ═══════════════════════════════════════════════════════════════
# TIME-TO-HIRE ANALYTICS
# ═══════════════════════════════════════════════════════════════

@api_view(['GET'])
@permission_classes([IsAuthenticated, IsOrgMember])
def time_to_hire_analytics(request):
    role = get_user_role(request.user)
    if role == 'superadmin':
        qs = Candidate.objects.all()
        org_id = request.query_params.get('organization')
        if org_id:
            qs = qs.filter(organization_id=org_id)
    else:
        org = get_user_organization(request.user)
        qs = Candidate.objects.filter(organization=org) if org else Candidate.objects.none()

    if request.query_params.get('vacancy'):
        qs = qs.filter(vacancy_id=request.query_params['vacancy'])
    if request.query_params.get('assigned_to'):
        qs = qs.filter(assigned_to_id=request.query_params['assigned_to'])

    time_data = AnalyticsService.calculate_time_to_hire_data(qs, request.query_params.get('date_from'),
                                                             request.query_params.get('date_to'))
    result = AnalyticsService.calculate_statistics(time_data)

    period = request.query_params.get('period', 'month')
    period_format = {'day': '%Y-%m-%d', 'week': '%Y-W%W', 'month': '%Y-%m', 'quarter': '%Y-Q%q', 'year': '%Y'}.get(
        period, '%Y-%m')
    period_stats = {}
    for d in time_data:
        pkey = d['offer_date'].strftime(period_format)
        period_stats.setdefault(pkey, []).append(d['days'])
    result['by_period'] = [{'period': pkey, 'avg_days': round(sum(t) / len(t), 1), 'offers_count': len(t)} for pkey, t
                           in sorted(period_stats.items())]

    cumulative_times = []
    result['trend'] = []
    for bp in result['by_period']:
        cumulative_times.extend(period_stats.get(bp['period'], []))
        result['trend'].append({'period': bp['period'],
                                'cumulative_avg': round(sum(cumulative_times) / len(cumulative_times),
                                                        1) if cumulative_times else 0,
                                'offers_to_date': len(cumulative_times)})

    return Response(result)


@api_view(['GET'])
@permission_classes([IsAuthenticated, IsOrgMember])
def candidate_time_to_hire_detail(request, candidate_id):
    candidate = get_object_or_404(Candidate, id=candidate_id)
    role = get_user_role(request.user)
    if role != 'superadmin' and candidate.organization != get_user_organization(request.user):
        return Response({'error': 'Forbidden'}, status=status.HTTP_403_FORBIDDEN)

    status_timeline = []
    prev_time, prev_status = candidate.created_at, 'new'
    for history in candidate.status_history.order_by('changed_at'):
        if prev_time:
            status_timeline.append({'from_status': prev_status, 'to_status': history.new_status,
                                    'changed_by': history.changed_by.get_full_name() or history.changed_by.username if history.changed_by else None,
                                    'changed_at': history.changed_at,
                                    'days_in_status': round((history.changed_at - prev_time).total_seconds() / 86400,
                                                            1)})
        prev_time, prev_status = history.changed_at, history.new_status

    time_to_offer, offer_date = None, None
    if candidate.status == 'offer':
        first_offer = candidate.status_history.filter(new_status='offer').order_by('changed_at').first()
        if first_offer:
            time_to_offer, offer_date = round((first_offer.changed_at - candidate.created_at).total_seconds() / 86400,
                                              1), first_offer.changed_at
        else:
            time_to_offer, offer_date = 0, candidate.created_at

    return Response({'candidate_id': candidate.id, 'name': f"{candidate.first_name} {candidate.last_name}".strip(),
                     'email': candidate.email, 'phone': candidate.phone,
                     'vacancy': {'id': candidate.vacancy_id,
                                 'title': candidate.vacancy.title if candidate.vacancy else None},
                     'created_at': candidate.created_at, 'current_status': candidate.status,
                     'current_status_display': candidate.get_status_display(), 'time_to_offer_days': time_to_offer,
                     'offer_date': offer_date, 'status_timeline': status_timeline,
                     'total_status_changes': len(status_timeline)})


@api_view(['GET'])
@permission_classes([IsAuthenticated, IsOrgMember])
def export_time_to_hire_csv(request):
    role = get_user_role(request.user)
    if role == 'superadmin':
        qs = Candidate.objects.all()
        org_id = request.query_params.get('organization')
        if org_id:
            qs = qs.filter(organization_id=org_id)
    else:
        org = get_user_organization(request.user)
        qs = Candidate.objects.filter(organization=org) if org else Candidate.objects.none()

    if request.query_params.get('vacancy'):
        qs = qs.filter(vacancy_id=request.query_params['vacancy'])
    if request.query_params.get('assigned_to'):
        qs = qs.filter(assigned_to_id=request.query_params['assigned_to'])

    time_data = AnalyticsService.calculate_time_to_hire_data(qs, request.query_params.get('date_from'),
                                                             request.query_params.get('date_to'))

    response = HttpResponse(content_type='text/csv; charset=utf-8')
    response['Content-Disposition'] = 'attachment; filename="time_to_hire_export.csv"'
    response.write('\ufeff')
    writer = csv.writer(response)
    writer.writerow(
        ['ID', "Ім'я", 'Прізвище', 'Email', 'Телефон', 'Вакансія', 'HR Менеджер', 'Дата створення', 'Дата офферу',
         'Днів до офферу'])
    for row in time_data:
        writer.writerow([row['candidate_id'], row['candidate_name'].split()[0] if row['candidate_name'] else '',
                         ' '.join(row['candidate_name'].split()[1:]) if row['candidate_name'] else '', '', '',
                         row['vacancy_title'], row['assigned_to_name'] or '',
                         row['new_date'].strftime('%d.%m.%Y') if row['new_date'] else '',
                         row['offer_date'].strftime('%d.%m.%Y') if row['offer_date'] else '', row['days']])
    return response


# ═══════════════════════════════════════════════════════════════
# HR EFFECTIVENESS ANALYTICS
# ═══════════════════════════════════════════════════════════════

@api_view(['GET'])
@permission_classes([IsAuthenticated, IsOrgMember])
def hr_effectiveness_analytics(request):
    role = get_user_role(request.user)
    if role == 'superadmin':
        qs = Candidate.objects.all()
        org_id = request.query_params.get('organization')
        if org_id:
            qs = qs.filter(organization_id=org_id)
    else:
        org = get_user_organization(request.user)
        qs = Candidate.objects.filter(organization=org) if org else Candidate.objects.none()

    if request.query_params.get('date_from'):
        qs = qs.filter(created_at__date__gte=request.query_params['date_from'])
    if request.query_params.get('date_to'):
        qs = qs.filter(created_at__date__lte=request.query_params['date_to'])
    if request.query_params.get('vacancy'):
        qs = qs.filter(vacancy_id=request.query_params['vacancy'])

    hr_data = AnalyticsService.calculate_hr_effectiveness(qs)

    total_candidates = qs.count()
    total_offers = qs.filter(status='offer').count()
    overall_conversion = round(total_offers / total_candidates * 100, 1) if total_candidates > 0 else 0

    return Response({
        'hr_managers': hr_data,
        'summary': {
            'total_hr': len(hr_data),
            'total_candidates': total_candidates,
            'total_offers': total_offers,
            'overall_conversion': overall_conversion,
        }
    })


@api_view(['GET'])
@permission_classes([IsAuthenticated, IsOrgMember])
def export_hr_effectiveness_csv(request):
    import csv
    from django.http import HttpResponse

    role = get_user_role(request.user)
    if role == 'superadmin':
        qs = Candidate.objects.all()
        org_id = request.query_params.get('organization')
        if org_id:
            qs = qs.filter(organization_id=org_id)
    else:
        org = get_user_organization(request.user)
        qs = Candidate.objects.filter(organization=org) if org else Candidate.objects.none()

    hr_data = AnalyticsService.calculate_hr_effectiveness(qs)

    response = HttpResponse(content_type='text/csv; charset=utf-8')
    response['Content-Disposition'] = 'attachment; filename="hr_effectiveness.csv"'
    response.write('\ufeff')

    writer = csv.writer(response)
    writer.writerow([
        'HR ID', "Ім'я HR", 'Username', 'Email',
        'Всього кандидатів', 'Офферів', 'Співбесід', 'Відмов', 'Активних',
        'Конверсія в оффер %', 'Конверсія в співбесіду+ %',
        'Середній час до офферу (дні)',
        'Нові', 'Скринінг', 'Співбесіда', 'Оффер', 'Відмова'
    ])

    for hr in hr_data:
        writer.writerow([
            hr['hr_id'], hr['hr_name'], hr['hr_username'], hr['hr_email'],
            hr['total_candidates'], hr['offers_count'], hr['interviews_count'],
            hr['rejected_count'], hr['active_candidates'],
            hr['conversion_rate'], hr['interview_rate'],
            hr['time_to_hire_avg'] or '—',
            hr['by_status']['new'], hr['by_status']['screening'],
            hr['by_status']['interview'], hr['by_status']['offer'],
            hr['by_status']['rejected'],
        ])

    return response


# ═══════════════════════════════════════════════════════════════
# EXCEL / PDF EXPORT VIEWS
# ═══════════════════════════════════════════════════════════════

@api_view(['GET'])
@permission_classes([IsAuthenticated, IsOrgMember])
def export_time_to_hire_excel(request):
    role = get_user_role(request.user)
    if role == 'superadmin':
        qs = Candidate.objects.all()
        org_id = request.query_params.get('organization')
        if org_id:
            qs = qs.filter(organization_id=org_id)
    else:
        org = get_user_organization(request.user)
        qs = Candidate.objects.filter(organization=org) if org else Candidate.objects.none()

    if request.query_params.get('vacancy'):
        qs = qs.filter(vacancy_id=request.query_params['vacancy'])
    if request.query_params.get('assigned_to'):
        qs = qs.filter(assigned_to_id=request.query_params['assigned_to'])

    time_data = AnalyticsService.calculate_time_to_hire_data(
        qs,
        request.query_params.get('date_from'),
        request.query_params.get('date_to')
    )
    statistics = AnalyticsService.calculate_statistics(time_data)

    filters = {
        'Організація': org_id if role == 'superadmin' else (org.name if org else None),
        'Вакансія': request.query_params.get('vacancy'),
        'HR Менеджер': request.query_params.get('assigned_to'),
        'Дата від': request.query_params.get('date_from'),
        'Дата до': request.query_params.get('date_to'),
    }

    return ExportService.export_time_to_hire_excel(time_data, statistics, filters)


@api_view(['GET'])
@permission_classes([IsAuthenticated, IsOrgMember])
def export_time_to_hire_pdf(request):
    role = get_user_role(request.user)
    if role == 'superadmin':
        qs = Candidate.objects.all()
        org_id = request.query_params.get('organization')
        if org_id:
            qs = qs.filter(organization_id=org_id)
    else:
        org = get_user_organization(request.user)
        qs = Candidate.objects.filter(organization=org) if org else Candidate.objects.none()

    if request.query_params.get('vacancy'):
        qs = qs.filter(vacancy_id=request.query_params['vacancy'])
    if request.query_params.get('assigned_to'):
        qs = qs.filter(assigned_to_id=request.query_params['assigned_to'])

    time_data = AnalyticsService.calculate_time_to_hire_data(
        qs,
        request.query_params.get('date_from'),
        request.query_params.get('date_to')
    )
    statistics = AnalyticsService.calculate_statistics(time_data)

    filters = {
        'Організація': org_id if role == 'superadmin' else (org.name if org else None),
        'Вакансія': request.query_params.get('vacancy'),
        'HR Менеджер': request.query_params.get('assigned_to'),
        'Дата від': request.query_params.get('date_from'),
        'Дата до': request.query_params.get('date_to'),
    }

    return ExportService.export_time_to_hire_pdf(time_data, statistics, filters)


@api_view(['GET'])
@permission_classes([IsAuthenticated, IsOrgMember])
def export_hr_effectiveness_excel(request):
    role = get_user_role(request.user)
    if role == 'superadmin':
        qs = Candidate.objects.all()
        org_id = request.query_params.get('organization')
        if org_id:
            qs = qs.filter(organization_id=org_id)
    else:
        org = get_user_organization(request.user)
        qs = Candidate.objects.filter(organization=org) if org else Candidate.objects.none()

    if request.query_params.get('date_from'):
        qs = qs.filter(created_at__date__gte=request.query_params['date_from'])
    if request.query_params.get('date_to'):
        qs = qs.filter(created_at__date__lte=request.query_params['date_to'])
    if request.query_params.get('vacancy'):
        qs = qs.filter(vacancy_id=request.query_params['vacancy'])

    hr_data = AnalyticsService.calculate_hr_effectiveness(qs)
    total_candidates = qs.count()
    total_offers = qs.filter(status='offer').count()
    overall_conversion = round(total_offers / total_candidates * 100, 1) if total_candidates > 0 else 0

    summary = {
        'total_hr': len(hr_data),
        'total_candidates': total_candidates,
        'total_offers': total_offers,
        'overall_conversion': overall_conversion,
    }

    filters = {
        'Організація': org_id if role == 'superadmin' else (org.name if org else None),
        'Вакансія': request.query_params.get('vacancy'),
        'Дата від': request.query_params.get('date_from'),
        'Дата до': request.query_params.get('date_to'),
    }

    return ExportService.export_hr_effectiveness_excel(hr_data, summary, filters)


@api_view(['GET'])
@permission_classes([IsAuthenticated, IsOrgMember])
def export_hr_effectiveness_pdf(request):
    role = get_user_role(request.user)
    if role == 'superadmin':
        qs = Candidate.objects.all()
        org_id = request.query_params.get('organization')
        if org_id:
            qs = qs.filter(organization_id=org_id)
    else:
        org = get_user_organization(request.user)
        qs = Candidate.objects.filter(organization=org) if org else Candidate.objects.none()

    if request.query_params.get('date_from'):
        qs = qs.filter(created_at__date__gte=request.query_params['date_from'])
    if request.query_params.get('date_to'):
        qs = qs.filter(created_at__date__lte=request.query_params['date_to'])
    if request.query_params.get('vacancy'):
        qs = qs.filter(vacancy_id=request.query_params['vacancy'])

    hr_data = AnalyticsService.calculate_hr_effectiveness(qs)
    total_candidates = qs.count()
    total_offers = qs.filter(status='offer').count()
    overall_conversion = round(total_offers / total_candidates * 100, 1) if total_candidates > 0 else 0

    summary = {
        'total_hr': len(hr_data),
        'total_candidates': total_candidates,
        'total_offers': total_offers,
        'overall_conversion': overall_conversion,
    }

    filters = {
        'Організація': org_id if role == 'superadmin' else (org.name if org else None),
        'Вакансія': request.query_params.get('vacancy'),
        'Дата від': request.query_params.get('date_from'),
        'Дата до': request.query_params.get('date_to'),
    }

    return ExportService.export_hr_effectiveness_pdf(hr_data, summary, filters)


@api_view(['GET'])
@permission_classes([IsAuthenticated, IsOrgMember])
def export_full_report_excel(request):
    """Експорт ПОВНОГО звіту з аналітики у формат Excel"""
    role = get_user_role(request.user)

    if role == 'superadmin':
        org_id = request.query_params.get('organization')
        if org_id:
            candidates_qs = Candidate.objects.filter(organization_id=org_id)
        else:
            candidates_qs = Candidate.objects.all()
    else:
        org = get_user_organization(request.user)
        candidates_qs = Candidate.objects.filter(organization=org) if org else Candidate.objects.none()

    vacancy_filter = request.query_params.get('vacancy')
    assigned_to_filter = request.query_params.get('assigned_to')
    date_from = request.query_params.get('date_from')
    date_to = request.query_params.get('date_to')

    if vacancy_filter:
        candidates_qs = candidates_qs.filter(vacancy_id=vacancy_filter)
    if assigned_to_filter:
        candidates_qs = candidates_qs.filter(assigned_to_id=assigned_to_filter)
    if date_from:
        candidates_qs = candidates_qs.filter(created_at__date__gte=date_from)
    if date_to:
        candidates_qs = candidates_qs.filter(created_at__date__lte=date_to)

    if role == 'superadmin':
        if org_id:
            vacancies_qs = Vacancy.objects.filter(organization_id=org_id)
        else:
            vacancies_qs = Vacancy.objects.all()
    else:
        org = get_user_organization(request.user)
        vacancies_qs = Vacancy.objects.filter(organization=org) if org else Vacancy.objects.none()

    time_data = AnalyticsService.calculate_time_to_hire_data(candidates_qs, date_from, date_to)
    tth_statistics = AnalyticsService.calculate_statistics(time_data)

    period = request.query_params.get('period', 'month')
    period_format = {'day': '%Y-%m-%d', 'week': '%Y-W%W', 'month': '%Y-%m', 'quarter': '%Y-Q%q', 'year': '%Y'}.get(
        period, '%Y-%m')
    period_stats = {}
    for d in time_data:
        pkey = d['offer_date'].strftime(period_format)
        period_stats.setdefault(pkey, []).append(d['days'])
    tth_statistics['by_period'] = [{'period': pkey, 'avg_days': round(sum(t) / len(t), 1), 'offers_count': len(t)}
                                   for pkey, t in sorted(period_stats.items())]

    cumulative_times = []
    tth_statistics['trend'] = []
    for bp in tth_statistics['by_period']:
        cumulative_times.extend(period_stats.get(bp['period'], []))
        tth_statistics['trend'].append({
            'period': bp['period'],
            'cumulative_avg': round(sum(cumulative_times) / len(cumulative_times), 1) if cumulative_times else 0,
            'offers_to_date': len(cumulative_times)
        })

    hr_data = AnalyticsService.calculate_hr_effectiveness(candidates_qs)
    total_candidates = candidates_qs.count()
    total_offers = candidates_qs.filter(status='offer').count()
    overall_conversion = round(total_offers / total_candidates * 100, 1) if total_candidates > 0 else 0

    hr_effectiveness = {
        'hr_managers': hr_data,
        'summary': {
            'total_hr': len(hr_data),
            'total_candidates': total_candidates,
            'total_offers': total_offers,
            'overall_conversion': overall_conversion,
        }
    }

    funnel = AnalyticsService.calculate_funnel_data(candidates_qs, total_candidates, KANBAN_COLUMNS)
    sources, source_conversion = AnalyticsService.calculate_sources_data(candidates_qs, total_candidates, SOURCE_CONFIG)
    vacancies_list = AnalyticsService.calculate_vacancies_data(candidates_qs, vacancies_qs)

    analytics_data = {
        'time_to_hire': tth_statistics,
        'hr_effectiveness': hr_effectiveness,
        'funnel': funnel,
        'sources': sources,
        'source_conversion': source_conversion,
        'vacancies': vacancies_list,
        'total_candidates': total_candidates,
        'filters': {
            'organization_id': org_id if role == 'superadmin' else None,
            'vacancy': vacancy_filter,
            'assigned_to': assigned_to_filter,
            'date_from': date_from,
            'date_to': date_to,
        }
    }

    try:
        return FullReportExportService.export_full_report_pdf(analytics_data)
    except Exception as e:
        logger.error(f"Full report PDF export failed: {e}")
        return JsonResponse({'error': 'PDF export failed, try Excel'}, status=500)


@api_view(['GET'])
@permission_classes([IsAuthenticated, IsOrgMember])
def export_full_report_pdf(request):
    """Експорт ПОВНОГО звіту з аналітики у формат PDF"""
    role = get_user_role(request.user)

    if role == 'superadmin':
        org_id = request.query_params.get('organization')
        if org_id:
            candidates_qs = Candidate.objects.filter(organization_id=org_id)
        else:
            candidates_qs = Candidate.objects.all()
    else:
        org = get_user_organization(request.user)
        candidates_qs = Candidate.objects.filter(organization=org) if org else Candidate.objects.none()

    vacancy_filter = request.query_params.get('vacancy')
    assigned_to_filter = request.query_params.get('assigned_to')
    date_from = request.query_params.get('date_from')
    date_to = request.query_params.get('date_to')

    if vacancy_filter:
        candidates_qs = candidates_qs.filter(vacancy_id=vacancy_filter)
    if assigned_to_filter:
        candidates_qs = candidates_qs.filter(assigned_to_id=assigned_to_filter)
    if date_from:
        candidates_qs = candidates_qs.filter(created_at__date__gte=date_from)
    if date_to:
        candidates_qs = candidates_qs.filter(created_at__date__lte=date_to)

    time_data = AnalyticsService.calculate_time_to_hire_data(candidates_qs, date_from, date_to)
    tth_statistics = AnalyticsService.calculate_statistics(time_data)

    hr_data = AnalyticsService.calculate_hr_effectiveness(candidates_qs)
    total_candidates = candidates_qs.count()
    total_offers = candidates_qs.filter(status='offer').count()
    overall_conversion = round(total_offers / total_candidates * 100, 1) if total_candidates > 0 else 0

    funnel = AnalyticsService.calculate_funnel_data(candidates_qs, total_candidates, KANBAN_COLUMNS)

    analytics_data = {
        'time_to_hire': tth_statistics,
        'hr_effectiveness': {
            'hr_managers': hr_data,
            'summary': {
                'total_hr': len(hr_data),
                'total_candidates': total_candidates,
                'total_offers': total_offers,
                'overall_conversion': overall_conversion,
            }
        },
        'funnel': funnel,
        'total_candidates': total_candidates,
    }

    try:
        return FullReportExportService.export_full_report_pdf(analytics_data)
    except Exception as e:
        logger.error(f"Full report PDF export failed: {e}")
        return JsonResponse({'error': 'PDF export failed, try Excel'}, status=500)