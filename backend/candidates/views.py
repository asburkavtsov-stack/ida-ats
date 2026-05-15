import logging
from datetime import datetime

from django.db import models
from django.shortcuts import get_object_or_404
from django.core.cache import cache

from rest_framework import status, viewsets
from rest_framework.decorators import action, api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from .models import (
    Candidate, EmailTemplate, Organization,
    SentEmail, StatusHistory, Tag, User, UserProfile, Vacancy,
)
from .serializers import (
    CandidateSerializer, EmailTemplateSerializer, OrganizationSerializer,
    SentEmailSerializer, TagSerializer, VacancySerializer, DuplicateCandidateSerializer,
)
from .pagination import StandardPagination
from .permissions import IsSuperAdmin, IsOrgAdmin, IsOrgMember
from .mixins import OrganizationFilterMixin, OrganizationCreateMixin, PaginatedResponseMixin
from .services import CandidateService, EmailService, AnalyticsService
from .utils.context_processors import (
    get_user_organization, get_user_role, is_superadmin, clear_user_cache
)
from .utils.validators import check_candidate_duplicates, validate_organization_limits
from .utils.csv_handlers import CSVHandler, CSVImportResult

try:
    from allauth.socialaccount.models import SocialAccount

    ALLAUTH_AVAILABLE = True
except ImportError:
    ALLAUTH_AVAILABLE = False

logger = logging.getLogger(__name__)

class TagViewSet(OrganizationFilterMixin, viewsets.ModelViewSet):

    serializer_class = TagSerializer
    permission_classes = [IsAuthenticated, IsOrgMember]
    model = Tag

    def perform_create(self, serializer):
        org = get_user_organization(self.request.user)
        if not org:
            raise serializers.ValidationError({'error': "Користувач не прив'язаний до організації"})
        serializer.save(organization=org)

    def perform_update(self, serializer):
        org = get_user_organization(self.request.user)
        if not org or serializer.instance.organization != org:
            raise serializers.ValidationError({'error': 'Немає прав'})
        serializer.save()

class VacancyViewSet(OrganizationFilterMixin, viewsets.ModelViewSet):

    serializer_class = VacancySerializer
    permission_classes = [IsAuthenticated, IsOrgMember]
    model = Vacancy

    def _apply_additional_filters(self, qs):
        return qs.order_by('-created_at')

    def perform_create(self, serializer):
        serializer.save(organization=get_user_organization(self.request.user))

class OrganizationViewSet(viewsets.ModelViewSet):
    queryset = Organization.objects.all().order_by('id')
    serializer_class = OrganizationSerializer
    permission_classes = [IsAuthenticated, IsSuperAdmin]

class CandidateViewSet(PaginatedResponseMixin, viewsets.ModelViewSet):

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
            'tag_ids': [
                int(t) for t in self.request.query_params.get('tags', '').split(',')
                if t.isdigit()
            ] if self.request.query_params.get('tags') else None,
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

        candidate = serializer.save(
            organization=org,
            created_by=self.request.user
        )

        if tag_ids:
            candidate.tags.set(tag_ids)

    @action(detail=True, methods=['patch'], url_path='update-status')
    def update_status(self, request, pk=None):
        candidate = self.get_object()
        new_status = request.data.get('status')

        if not new_status:
            return Response(
                {'error': 'Status required'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        history = CandidateService.update_candidate_status(
            candidate, new_status, request.user
        )

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
                return Response(
                    {'error': 'User not found'},
                    status=status.HTTP_404_NOT_FOUND,
                )

        return Response(CandidateSerializer(candidate).data)

    @action(detail=False, methods=['post'], url_path='check-duplicate')
    def check_duplicate(self, request):
        email = request.data.get('email', '').strip()
        phone = request.data.get('phone', '').strip()

        if not email and not phone:
            return Response(
                {'error': 'Email або телефон обов\'язкові'},
                status=status.HTTP_400_BAD_REQUEST,
            )

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
            return Response(
                {'error': 'Файл CSV обов\'язковий'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        org = get_user_organization(request.user)
        if not org:
            return Response(
                {'error': "Користувач не прив'язаний до організації"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        rows, fieldnames, error = CSVHandler.read_csv_file(csv_file)
        if error:
            return Response({'error': error}, status=status.HTTP_400_BAD_REQUEST)

        column_mapping = CSVHandler.detect_column_mapping(fieldnames)

        if 'first_name' not in column_mapping or 'last_name' not in column_mapping or 'email' not in column_mapping:
            return Response(
                {'error': 'CSV має містити колонки: first_name, last_name, email'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        result = CSVImportResult()

        for row_num, row in enumerate(rows, start=2):
            try:
                # Отримуємо значення
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

                # Перевірка дублікатів
                has_dup, dup_candidate, match_by = check_candidate_duplicates(email, phone, org)

                if has_dup:
                    result.duplicates.append({
                        'row': row_num,
                        'candidate': DuplicateCandidateSerializer(dup_candidate).data,
                        'matched_by': match_by,
                        'import_data': {
                            'first_name': first_name,
                            'last_name': last_name,
                            'email': email,
                            'phone': phone,
                        }
                    })
                    continue

                # Знаходимо вакансію
                vacancy = None
                if vacancy_title:
                    vacancy = Vacancy.objects.filter(
                        organization=org,
                        title__iexact=vacancy_title
                    ).first()

                # Валідація статусу та джерела
                valid_statuses = [s[0] for s in Candidate.STATUS_CHOICES]
                valid_sources = [s[0] for s in Candidate.SOURCE_CHOICES]

                Candidate.objects.create(
                    organization=org,
                    first_name=first_name,
                    last_name=last_name,
                    email=email,
                    phone=phone,
                    vacancy=vacancy,
                    status=status_val if status_val in valid_statuses else 'new',
                    source=source_val if source_val in valid_sources else 'csv',
                    notes=notes,
                )
                result.created += 1

            except Exception as e:
                result.errors.append({'row': row_num, 'error': str(e)})

        return Response(result.to_dict())


class CandidateExportCSVView(APIView):
    permission_classes = [IsAuthenticated, IsOrgMember]

    STATUS_LABELS = {
        'new': 'Новий',
        'screening': 'Скринінг',
        'interview': 'Співбесіда',
        'offer': 'Оффер',
        'rejected': 'Відмова',
    }

    def get(self, request):
        filters = {
            'organization_id': request.query_params.get('organization'),
            'vacancy_id': request.query_params.get('vacancy'),
            'status': request.query_params.get('status'),
            'source': request.query_params.get('source'),
            'search': request.query_params.get('search'),
            'tag_ids': [
                int(t) for t in request.query_params.get('tags', '').split(',')
                if t.isdigit()
            ] if request.query_params.get('tags') else None,
        }

        qs = CandidateService.get_queryset_for_user(request.user, filters)
        qs = CandidateService.apply_filters(qs, filters)

        def extractor(candidate):
            tags_str = ', '.join([t.name for t in candidate.tags.all()])
            return [
                candidate.id,
                candidate.first_name or '',
                candidate.last_name or '',
                candidate.email or '',
                candidate.phone or '',
                candidate.vacancy.title if candidate.vacancy else '—',
                candidate.organization.name if candidate.organization else '—',
                self.STATUS_LABELS.get(candidate.status, candidate.status),
                candidate.get_source_display() if candidate.source else '—',
                tags_str,
                (candidate.notes or '').replace('\n', ' ').replace('\r', ''),
                candidate.created_at.strftime('%d.%m.%Y %H:%M') if candidate.created_at else '—',
            ]

        headers = [
            'ID', "Ім'я", 'Прізвище', 'Email', 'Телефон',
            'Вакансія', 'Організація', 'Статус', 'Джерело',
            'Теги', 'Нотатки', 'Дата створення',
        ]

        return CSVHandler.export_queryset_to_csv(qs, 'candidates.csv', headers, extractor)

@api_view(['GET'])
@permission_classes([IsAuthenticated])
def current_user(request):
    user = request.user
    profile = get_user_profile(user)
    org = profile.organization if profile else None

    return Response({
        'id': user.id,
        'username': user.username,
        'first_name': user.first_name,
        'last_name': user.last_name,
        'email': user.email,
        'role': profile.role if profile else None,
        'organization': {
            'id': org.id,
            'name': org.name,
            'max_vacancies': org.max_vacancies,
            'max_hr': org.max_hr,
        } if org else None,
    })

class UserListView(viewsets.ViewSet):

    permission_classes = [IsAuthenticated]

    def list(self, request):
        role = get_user_role(request.user)
        org_id = request.query_params.get('organization')

        if role == 'superadmin':
            if not org_id:
                return Response(
                    {'error': 'organization parameter required'},
                    status=status.HTTP_400_BAD_REQUEST,
                )
            profiles = UserProfile.objects.filter(
                organization_id=org_id,
            ).select_related('user')
        else:
            user_org = get_user_organization(request.user)
            if not user_org:
                return Response([], status=status.HTTP_200_OK)
            profiles = UserProfile.objects.filter(
                organization=user_org,
            ).select_related('user')

        return Response([
            {
                'id': p.user.id,
                'username': p.user.username,
                'first_name': p.user.first_name,
                'last_name': p.user.last_name,
                'email': p.user.email,
                'role': p.role,
                'profile_id': p.id,
            }
            for p in profiles
        ])

    @action(detail=False, methods=['get'], url_path='all')
    def all(self, request):
        if not is_superadmin(request.user):
            return Response({'error': 'Forbidden'}, status=status.HTTP_403_FORBIDDEN)

        users = User.objects.all().select_related('profile__organization')
        data = []
        for u in users:
            profile = get_user_profile(u)
            org = profile.organization if profile else None
            data.append({
                'id': u.id,
                'username': u.username,
                'first_name': u.first_name,
                'last_name': u.last_name,
                'email': u.email,
                'role': profile.role if profile else None,
                'organization_id': org.id if org else None,
                'organization_name': org.name if org else None,
            })
        return Response(data)

    def create(self, request):
        username = request.data.get('username')
        password = request.data.get('password')
        first_name = request.data.get('first_name', '')
        last_name = request.data.get('last_name', '')
        email = request.data.get('email', '')
        org_id = request.data.get('organization')
        role = request.data.get('role', 'hr')

        if not username or not password:
            return Response(
                {'error': "username та password обов'язкові"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        if User.objects.filter(username=username).exists():
            return Response(
                {'error': 'Username вже існує'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        if org_id and role == 'hr':
            try:
                org = Organization.objects.get(id=org_id)
            except Organization.DoesNotExist:
                return Response(
                    {'error': 'Організацію не знайдено'},
                    status=status.HTTP_404_NOT_FOUND,
                )

            is_valid, error_msg = validate_organization_limits(org, role)
            if not is_valid:
                return Response({'error': error_msg}, status=status.HTTP_400_BAD_REQUEST)
        else:
            org = Organization.objects.filter(id=org_id).first() if org_id else None

        user = User.objects.create_user(
            username=username,
            password=password,
            first_name=first_name,
            last_name=last_name,
            email=email,
        )
        UserProfile.objects.create(user=user, organization=org, role=role)

        clear_user_cache(user.id)

        return Response({'success': True}, status=status.HTTP_201_CREATED)

    def partial_update(self, request, pk=None):
        try:
            user = User.objects.get(id=pk)
        except User.DoesNotExist:
            return Response(
                {'error': 'Юзер не знайдений'},
                status=status.HTTP_404_NOT_FOUND,
            )

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
            return Response(
                {'error': 'Юзер не знайдений'},
                status=status.HTTP_404_NOT_FOUND,
            )

class EmailTemplateViewSet(PaginatedResponseMixin, viewsets.ModelViewSet):
    serializer_class = EmailTemplateSerializer
    permission_classes = [IsAuthenticated, IsOrgMember]
    pagination_class = StandardPagination

    def get_queryset(self):
        role = get_user_role(self.request.user)

        if role == 'superadmin':
            qs = EmailTemplate.objects.all()
            org_id = self.request.query_params.get('organization')
            if org_id:
                qs = qs.filter(organization_id=org_id)
        else:
            org = get_user_organization(self.request.user)
            qs = EmailTemplate.objects.filter(organization=org) if org else EmailTemplate.objects.none()

        return qs

    def perform_create(self, serializer):
        org = get_user_organization(self.request.user)
        if not org:
            raise serializers.ValidationError(
                {'error': "Користувач не прив'язаний до організації"}
            )

        template_type = serializer.validated_data.get('template_type')
        existing = EmailTemplate.objects.filter(
            organization=org, template_type=template_type
        ).first()

        if existing:
            for field in ('subject', 'body', 'is_active'):
                if field in serializer.validated_data:
                    setattr(existing, field, serializer.validated_data[field])
            existing.save()
            serializer.instance = existing
        else:
            serializer.save(organization=org)

    @action(detail=True, methods=['post'], url_path='preview')
    def preview(self, request, pk=None):
        template = self.get_object()
        candidate_id = request.data.get('candidate_id')

        if not candidate_id:
            return Response(
                {'error': 'candidate_id is required'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        try:
            candidate = Candidate.objects.get(
                id=candidate_id,
                organization=template.organization
            )
        except Candidate.DoesNotExist:
            return Response(
                {'error': 'Кандидата не знайдено'},
                status=status.HTTP_404_NOT_FOUND
            )

        subject, body = EmailService.apply_template_replacements(
            template.subject, template.body, candidate, request
        )

        return Response({
            'subject': subject,
            'body': body,
            'candidate_email': candidate.email,
            'from_email': request.user.email,
        })

    @action(detail=True, methods=['post'], url_path='send')
    def send(self, request, pk=None):
        template = self.get_object()
        candidate_id = request.data.get('candidate_id')

        if not candidate_id:
            return Response(
                {'error': 'candidate_id is required'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        try:
            candidate = Candidate.objects.get(
                id=candidate_id,
                organization=template.organization
            )
        except Candidate.DoesNotExist:
            return Response(
                {'error': 'Кандидата не знайдено'},
                status=status.HTTP_404_NOT_FOUND
            )

        if not candidate.email:
            return Response(
                {'error': 'У кандидата не вказано email'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        subject, body = EmailService.apply_template_replacements(
            template.subject, template.body, candidate, request
        )

        # Створюємо запис про відправку
        sent_email = EmailService.create_sent_record(
            candidate, template, subject, body, request.user, 'pending'
        )

        backend_type = EmailService.get_email_backend_type()

        try:
            if backend_type == 'gmail' and ALLAUTH_AVAILABLE:
                sender_user = EmailTemplateViewSet._get_gmail_sender_user(request)
                if not sender_user:
                    raise Exception('Необхідно підключити Google акаунт')

                result = EmailService.send_via_gmail(
                    user=sender_user,
                    to_email=candidate.email,
                    subject=subject,
                    body=body,
                )
                sent_email.status = 'sent'
                sent_email.save()

                return Response({
                    'success': True,
                    'message': 'Лист відправлено через Gmail API',
                    'sent_email_id': sent_email.id,
                    'from_email': result['from_email'],
                })

            elif backend_type == 'smtp':
                EmailService.send_via_smtp(
                    to_email=candidate.email,
                    subject=subject,
                    body=body,
                    from_email=request.user.email,
                    reply_to=request.user.email,
                )
                sent_email.status = 'sent'
                sent_email.save()

                return Response({
                    'success': True,
                    'message': f'Лист відправлено на {candidate.email}',
                    'sent_email_id': sent_email.id,
                })

            else:
                sent_email.status = 'sent'
                sent_email.save()

                logger.info(f"\n📧 ТЕСТОВИЙ ЛИСТ\nКому: {candidate.email}\nТема: {subject}\n\n{body}\n")

                return Response({
                    'success': True,
                    'message': 'Тестовий режим: лист виведено в консоль',
                    'test_mode': True,
                    'sent_email_id': sent_email.id,
                })

        except Exception as e:
            sent_email.status = 'failed'
            sent_email.error_message = str(e)[:500]
            sent_email.save()

            return Response(
                {'success': False, 'error': str(e)},
                status=status.HTTP_502_BAD_GATEWAY,
            )

    @action(detail=False, methods=['get'], url_path='history')
    def history(self, request):
        role = get_user_role(request.user)

        if role == 'superadmin':
            org_id = request.query_params.get('organization')
            qs = SentEmail.objects.all()
            if org_id:
                qs = qs.filter(candidate__organization_id=org_id)
        else:
            org = get_user_organization(request.user)
            qs = SentEmail.objects.filter(candidate__organization=org) if org else SentEmail.objects.none()

        if request.query_params.get('candidate'):
            qs = qs.filter(candidate_id=request.query_params['candidate'])
        if request.query_params.get('template_type'):
            qs = qs.filter(template__template_type=request.query_params['template_type'])

        qs = qs.select_related('candidate', 'template', 'sent_by').order_by('-sent_at')

        return self.get_paginated_response(qs, SentEmailSerializer)

    @staticmethod
    def _get_gmail_sender_user(request):
        from candidates.utils.context_processors import get_user_organization

        if SocialAccount.objects.filter(user=request.user, provider='google').exists():
            return request.user

        org = get_user_organization(request.user)
        if org:
            org_user_ids = UserProfile.objects.filter(
                organization=org,
            ).values_list('user_id', flat=True)
            social = SocialAccount.objects.filter(
                provider='google',
                user_id__in=org_user_ids,
            ).select_related('user').first()
            if social:
                return social.user

        return None


class SentEmailViewSet(PaginatedResponseMixin, viewsets.ReadOnlyModelViewSet):
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

    def list(self, request, *args, **kwargs):
        qs = self.get_queryset()

        if request.query_params.get('candidate'):
            qs = qs.filter(candidate_id=request.query_params['candidate'])
        if request.query_params.get('template_type'):
            qs = qs.filter(template__template_type=request.query_params['template_type'])

        return self.get_paginated_response(qs, SentEmailSerializer)

@api_view(['GET'])
@permission_classes([IsAuthenticated])
def google_auth_status(request):
    has_google = (
            ALLAUTH_AVAILABLE
            and SocialAccount.objects.filter(user=request.user, provider='google').exists()
    )

    return Response({
        'has_google_account': has_google,
        'email': request.user.email,
        'login_url': '/accounts/google/login/',
        'logout_url': '/accounts/logout/',
    })


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def test_email_config(request):
    has_google = (
            ALLAUTH_AVAILABLE
            and SocialAccount.objects.filter(user=request.user, provider='google').exists()
    )

    return Response({
        'gmail_api': 'active' if ALLAUTH_AVAILABLE else 'inactive',
        'has_google_account': has_google,
        'google_login_url': '/accounts/google/login/',
        'current_user_email': request.user.email,
        'email_backend_type': EmailService.get_email_backend_type(),
    })

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

    vacancy_id = request.query_params.get('vacancy')
    if vacancy_id:
        qs = qs.filter(vacancy_id=vacancy_id)

    assigned_to = request.query_params.get('assigned_to')
    if assigned_to:
        qs = qs.filter(assigned_to_id=assigned_to)

    date_from = request.query_params.get('date_from')
    date_to = request.query_params.get('date_to')

    if date_from:
        try:
            datetime.strptime(date_from, '%Y-%m-%d')
        except ValueError:
            return Response(
                {'error': 'date_from має бути у форматі YYYY-MM-DD'},
                status=status.HTTP_400_BAD_REQUEST
            )

    if date_to:
        try:
            datetime.strptime(date_to, '%Y-%m-%d')
        except ValueError:
            return Response(
                {'error': 'date_to має бути у форматі YYYY-MM-DD'},
                status=status.HTTP_400_BAD_REQUEST
            )

    time_data = AnalyticsService.calculate_time_to_hire_data(qs, date_from, date_to)
    result = AnalyticsService.calculate_statistics(time_data)

    period = request.query_params.get('period', 'month')
    period_format = {
        'day': '%Y-%m-%d',
        'week': '%Y-W%W',
        'month': '%Y-%m',
        'quarter': '%Y-Q%q',
        'year': '%Y',
    }.get(period, '%Y-%m')

    period_stats = {}
    for d in time_data:
        period_key = d['offer_date'].strftime(period_format)
        if period_key not in period_stats:
            period_stats[period_key] = []
        period_stats[period_key].append(d['days'])

    by_period = []
    for pkey, times in sorted(period_stats.items()):
        avg = round(sum(times) / len(times), 1) if times else 0
        by_period.append({
            'period': pkey,
            'avg_days': avg,
            'offers_count': len(times),
        })

    result['by_period'] = by_period

    trend = []
    cumulative_times = []
    for bp in by_period:
        period_times = period_stats.get(bp['period'], [])
        cumulative_times.extend(period_times)
        trend.append({
            'period': bp['period'],
            'cumulative_avg': round(sum(cumulative_times) / len(cumulative_times), 1) if cumulative_times else 0,
            'offers_to_date': len(cumulative_times),
        })

    result['trend'] = trend

    return Response(result)

@api_view(['GET'])
@permission_classes([IsAuthenticated, IsOrgMember])
def candidate_time_to_hire_detail(request, candidate_id):
    candidate = get_object_or_404(Candidate, id=candidate_id)

    role = get_user_role(request.user)
    if role != 'superadmin':
        org = get_user_organization(request.user)
        if candidate.organization != org:
            return Response({'error': 'Forbidden'}, status=status.HTTP_403_FORBIDDEN)

    status_timeline = []
    prev_time = candidate.created_at
    prev_status = 'new'

    for history in candidate.status_history.order_by('changed_at'):
        if prev_time:
            days = round((history.changed_at - prev_time).total_seconds() / 86400, 1)
            status_timeline.append({
                'from_status': prev_status,
                'to_status': history.new_status,
                'changed_by': history.changed_by.get_full_name() or history.changed_by.username if history.changed_by else None,
                'changed_at': history.changed_at,
                'days_in_status': days,
            })
        prev_time = history.changed_at
        prev_status = history.new_status

    time_to_offer = None
    offer_date = None

    if candidate.status == 'offer':
        first_offer = candidate.status_history.filter(new_status='offer').order_by('changed_at').first()
        if first_offer:
            time_to_offer = round((first_offer.changed_at - candidate.created_at).total_seconds() / 86400, 1)
            offer_date = first_offer.changed_at
        else:
            time_to_offer = 0
            offer_date = candidate.created_at

    return Response({
        'candidate_id': candidate.id,
        'name': f"{candidate.first_name} {candidate.last_name}".strip(),
        'email': candidate.email,
        'phone': candidate.phone,
        'vacancy': {
            'id': candidate.vacancy_id,
            'title': candidate.vacancy.title if candidate.vacancy else None,
        },
        'assigned_to': {
            'id': candidate.assigned_to_id,
            'name': f"{candidate.assigned_to.first_name} {candidate.assigned_to.last_name}".strip() if candidate.assigned_to else None,
        } if candidate.assigned_to else None,
        'created_at': candidate.created_at,
        'current_status': candidate.status,
        'current_status_display': candidate.get_status_display(),
        'time_to_offer_days': time_to_offer,
        'offer_date': offer_date,
        'status_timeline': status_timeline,
        'total_status_changes': len(status_timeline),
    })

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
    if request.query_params.get('date_from'):
        qs = qs.filter(created_at__date__gte=request.query_params['date_from'])
    if request.query_params.get('date_to'):
        qs = qs.filter(created_at__date__lte=request.query_params['date_to'])

    time_data = AnalyticsService.calculate_time_to_hire_data(qs)

    response = HttpResponse(content_type='text/csv; charset=utf-8')
    response['Content-Disposition'] = 'attachment; filename="time_to_hire_export.csv"'
    response.write('\ufeff')

    writer = csv.writer(response)
    writer.writerow([
        'ID', "Ім'я", 'Прізвище', 'Email', 'Телефон',
        'Вакансія', 'HR Менеджер', 'Дата створення', 'Дата офферу', 'Днів до офферу'
    ])

    for row in time_data:
        writer.writerow([
            row['candidate_id'],
            row['candidate_name'].split()[0] if row['candidate_name'] else '',
            ' '.join(row['candidate_name'].split()[1:]) if row['candidate_name'] else '',
            '',
            '',
            row['vacancy_title'],
            row['assigned_to_name'] or '',
            row['new_date'].strftime('%d.%m.%Y') if row['new_date'] else '',
            row['offer_date'].strftime('%d.%m.%Y') if row['offer_date'] else '',
            row['days'],
        ])

    return response