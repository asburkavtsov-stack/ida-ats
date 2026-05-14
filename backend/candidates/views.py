import csv
import logging
import smtplib
import socket
import traceback
import io

from django.conf import settings
from django.contrib.auth.models import User
from django.db import models
from django.http import HttpResponse

from rest_framework import serializers, status, viewsets
from rest_framework.decorators import action, api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from .models import (
    Candidate, EmailTemplate, Organization,
    SentEmail, StatusHistory, Tag, UserProfile, Vacancy, normalize_phone,
)
from .serializers import (
    CandidateSerializer, EmailTemplateSerializer, OrganizationSerializer,
    SentEmailSerializer, TagSerializer, VacancySerializer, DuplicateCandidateSerializer,
)
from .pagination import StandardPagination
from .gmail_service import GmailService

try:
    from allauth.socialaccount.models import SocialAccount

    ALLAUTH_AVAILABLE = True
except ImportError:
    ALLAUTH_AVAILABLE = False

logger = logging.getLogger(__name__)


# ═══════════════════════════════════════════════════════════════
# HELPERS
# ═══════════════════════════════════════════════════════════════

def get_user_profile(user):
    try:
        return user.profile
    except (UserProfile.DoesNotExist, AttributeError):
        return None


def get_user_org(user):
    profile = get_user_profile(user)
    return profile.organization if profile else None


def get_user_role(user):
    profile = get_user_profile(user)
    return profile.role if profile else None


def apply_template_replacements(subject: str, body: str, candidate, request) -> tuple[str, str]:
    """Підставляє змінні в тему та тіло листа."""
    hr_name = (
            f"{request.user.first_name} {request.user.last_name}".strip()
            or request.user.username
    )
    vacancy_title = candidate.vacancy.title if candidate.vacancy else '—'
    org_name = (
        candidate.organization.name
        if hasattr(candidate, 'organization') and candidate.organization
        else '—'
    )

    replacements = {
        '{{name}}': f"{candidate.first_name} {candidate.last_name}".strip(),
        '{{first_name}}': candidate.first_name or '',
        '{{last_name}}': candidate.last_name or '',
        '{{vacancy}}': vacancy_title,
        '{{email}}': candidate.email or '',
        '{{phone}}': candidate.phone or '—',
        '{{status}}': candidate.get_status_display(),
        '{{hr_name}}': hr_name,
        '{{hr_email}}': request.user.email or '',
        '{{organization}}': org_name,
        '{{date}}': (
            candidate.created_at.strftime('%d.%m.%Y') if candidate.created_at else '—'
        ),
    }

    for placeholder, value in replacements.items():
        subject = subject.replace(placeholder, str(value))
        body = body.replace(placeholder, str(value))

    # Підпис
    if '{{hr_signature}}' in body:
        signature = (
            f'<br><br>--<br>'
            f'<strong>{hr_name}</strong><br>'
            f'HR менеджер<br>'
            f'Email: <a href="mailto:{request.user.email}">{request.user.email}</a>'
        )
        body = body.replace('{{hr_signature}}', signature)

    return subject, body


STATUS_LABELS = {
    'new': 'Новий',
    'screening': 'Скринінг',
    'interview': 'Співбесіда',
    'offer': 'Оффер',
    'rejected': 'Відмова',
}

SOURCE_LABELS = {
    'linkedin': 'LinkedIn',
    'dou': 'DOU',
    'recommendation': 'Рекомендація',
    'csv': 'CSV',
    'direct': 'Прямий відгук',
    'other': 'Інше',
}


# ═══════════════════════════════════════════════════════════════
# TAGS
# ═══════════════════════════════════════════════════════════════

class TagViewSet(viewsets.ModelViewSet):
    serializer_class = TagSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        role = get_user_role(self.request.user)
        if role == 'superadmin':
            org_id = self.request.query_params.get('organization')
            qs = Tag.objects.all()
            return qs.filter(organization_id=org_id) if org_id else qs
        org = get_user_org(self.request.user)
        return Tag.objects.filter(organization=org) if org else Tag.objects.none()

    def perform_create(self, serializer):
        org = get_user_org(self.request.user)
        if not org:
            raise serializers.ValidationError({'error': "Користувач не прив'язаний до організації"})
        serializer.save(organization=org)

    def perform_update(self, serializer):
        org = get_user_org(self.request.user)
        if not org or serializer.instance.organization != org:
            raise serializers.ValidationError({'error': 'Немає прав'})
        serializer.save()


# ═══════════════════════════════════════════════════════════════
# VACANCIES
# ═══════════════════════════════════════════════════════════════

class VacancyViewSet(viewsets.ModelViewSet):
    serializer_class = VacancySerializer

    def get_queryset(self):
        role = get_user_role(self.request.user)
        org_id = self.request.query_params.get('organization')

        if role == 'superadmin':
            qs = Vacancy.objects.all()
            if org_id:
                qs = qs.filter(organization_id=org_id)
        else:
            org = get_user_org(self.request.user)
            qs = Vacancy.objects.filter(organization=org) if org else Vacancy.objects.none()

        return qs.order_by('-created_at')

    def perform_create(self, serializer):
        serializer.save(organization=get_user_org(self.request.user))


# ═══════════════════════════════════════════════════════════════
# ORGANIZATIONS
# ═══════════════════════════════════════════════════════════════

class OrganizationViewSet(viewsets.ModelViewSet):
    queryset = Organization.objects.all().order_by('id')
    serializer_class = OrganizationSerializer


# ═══════════════════════════════════════════════════════════════
# CANDIDATES
# ═══════════════════════════════════════════════════════════════

class CandidateViewSet(viewsets.ModelViewSet):
    serializer_class = CandidateSerializer
    pagination_class = StandardPagination

    def get_queryset(self):
        user = self.request.user
        role = get_user_role(user)
        params = self.request.query_params

        if role == 'superadmin':
            qs = Candidate.objects.all()
            if params.get('organization'):
                qs = qs.filter(organization_id=params['organization'])
        else:
            org = get_user_org(user)
            qs = Candidate.objects.filter(organization=org) if org else Candidate.objects.none()

        if params.get('vacancy'):
            qs = qs.filter(vacancy_id=params['vacancy'])
        if params.get('status'):
            qs = qs.filter(status=params['status'])
        if params.get('source'):
            qs = qs.filter(source=params['source'])
        if params.get('assigned_to'):
            qs = qs.filter(assigned_to_id=params['assigned_to'])
        if params.get('mine') == 'true':
            qs = qs.filter(assigned_to=user)
        if params.get('tags'):
            tag_ids = [int(t) for t in params.get('tags').split(',') if t.isdigit()]
            qs = qs.filter(tags__id__in=tag_ids).distinct()

        # ── Пошук за ім'ям, прізвищем, email ──────────────────
        if params.get('search'):
            search = params['search']
            qs = qs.filter(
                models.Q(first_name__icontains=search)
                | models.Q(last_name__icontains=search)
                | models.Q(email__icontains=search)
            )

        # ── FIX: prefetch status_history щоб уникнути N+1 і 500 ──
        return (
            qs
            .select_related('assigned_to', 'vacancy', 'organization')
            .prefetch_related(
                'status_history',
                'status_history__changed_by',
                'tags',
            )
            .order_by('-created_at')
        )

    def perform_create(self, serializer):
        tag_ids = serializer.validated_data.pop('tag_ids', [])
        candidate = serializer.save(organization=get_user_org(self.request.user))
        if tag_ids:
            candidate.tags.set(tag_ids)

    @action(detail=True, methods=['patch'])
    def update_status(self, request, pk=None):
        candidate = self.get_object()
        new_status = request.data.get('status')
        if not new_status:
            return Response(
                {'error': 'Status required'},
                status=status.HTTP_400_BAD_REQUEST,
            )
        old_status = candidate.status
        candidate.status = new_status
        candidate.save()
        StatusHistory.objects.create(
            candidate=candidate,
            old_status=old_status,
            new_status=new_status,
            changed_by=request.user,
        )
        return Response(CandidateSerializer(candidate).data)

    @action(detail=True, methods=['patch'])
    def assign(self, request, pk=None):
        candidate = self.get_object()
        user_id = request.data.get('assigned_to')

        if user_id is None:
            candidate.assigned_to = None
            candidate.save()
            return Response(CandidateSerializer(candidate).data)

        try:
            candidate.assigned_to = User.objects.get(id=user_id)
            candidate.save()
            return Response(CandidateSerializer(candidate).data)
        except User.DoesNotExist:
            return Response(
                {'error': 'User not found'},
                status=status.HTTP_404_NOT_FOUND,
            )

    @action(detail=False, methods=['post'])
    def check_duplicate(self, request):
        """
        POST /api/candidates/check_duplicate/
        Body: {"email": "...", "phone": "..."}
        Перевіряє чи існує дублікат без створення кандидата.
        """
        email = request.data.get('email', '').strip()
        phone = request.data.get('phone', '').strip()

        if not email and not phone:
            return Response(
                {'error': 'Email або телефон обов\'язкові'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        org = get_user_org(request.user)
        qs = Candidate.objects.filter(organization=org) if org else Candidate.objects.none()

        from django.db.models import Q

        filters = Q()
        if email:
            filters |= Q(email__iexact=email)
        if phone:
            phone_norm = normalize_phone(phone)
            filters |= Q(phone=phone_norm) | Q(phone__iexact=phone)

        duplicates = qs.filter(filters).distinct()[:5]

        return Response({
            'has_duplicate': duplicates.exists(),
            'count': duplicates.count(),
            'duplicates': DuplicateCandidateSerializer(duplicates, many=True).data,
        })

    @action(detail=False, methods=['post'])
    def import_csv(self, request):
        """
        POST /api/candidates/import_csv/
        Body: multipart/form-data з файлом CSV
        Повертає: {"created": N, "duplicates": [...], "errors": [...]}
        """
        csv_file = request.FILES.get('file')
        if not csv_file:
            return Response(
                {'error': 'Файл CSV обов\'язковий'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        org = get_user_org(request.user)
        if not org:
            return Response(
                {'error': "Користувач не прив'язаний до організації"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        created_count = 0
        duplicates = []
        errors = []

        try:
            decoded_file = csv_file.read().decode('utf-8-sig')
            io_string = io.StringIO(decoded_file)
            reader = csv.DictReader(io_string)

            # Нормалізуємо назви колонок
            fieldnames = [f.strip().lower() for f in reader.fieldnames] if reader.fieldnames else []

            # Мапінг можливих назв колонок
            col_map = {}
            for f in fieldnames:
                if f in ('first_name', 'ім\'я', 'имя', 'name', 'first name', 'імя'):
                    col_map['first_name'] = f
                elif f in ('last_name', 'прізвище', 'фамилия', 'last name', 'прізвище'):
                    col_map['last_name'] = f
                elif f in ('email', 'пошта', 'email address', 'e-mail'):
                    col_map['email'] = f
                elif f in ('phone', 'телефон', 'phone number', 'мобільний'):
                    col_map['phone'] = f
                elif f in ('vacancy', 'вакансія', 'vacancy_id', 'position'):
                    col_map['vacancy'] = f
                elif f in ('status', 'статус'):
                    col_map['status'] = f
                elif f in ('source', 'джерело', 'source'):
                    col_map['source'] = f
                elif f in ('notes', 'нотатки', 'коментар', 'comments'):
                    col_map['notes'] = f

            if 'first_name' not in col_map or 'last_name' not in col_map or 'email' not in col_map:
                return Response(
                    {'error': 'CSV має містити колонки: first_name, last_name, email'},
                    status=status.HTTP_400_BAD_REQUEST,
                )

            for row_num, row in enumerate(reader, start=2):
                try:
                    first_name = row.get(col_map.get('first_name', ''), '').strip()
                    last_name = row.get(col_map.get('last_name', ''), '').strip()
                    email = row.get(col_map.get('email', ''), '').strip().lower()
                    phone = row.get(col_map.get('phone', ''), '').strip()
                    vacancy_title = row.get(col_map.get('vacancy', ''), '').strip()
                    status_val = row.get(col_map.get('status', ''), 'new').strip().lower()
                    source_val = row.get(col_map.get('source', ''), 'csv').strip().lower()
                    notes = row.get(col_map.get('notes', ''), '').strip()

                    if not first_name or not last_name or not email:
                        errors.append({
                            'row': row_num,
                            'error': "Ім'я, прізвище та email обов'язкові"
                        })
                        continue

                    # Перевірка дублікатів
                    from django.db.models import Q
                    phone_norm = normalize_phone(phone) if phone else ''

                    dup_filters = Q(email__iexact=email)
                    if phone_norm:
                        dup_filters |= Q(phone=phone_norm)

                    existing = Candidate.objects.filter(
                        organization=org
                    ).filter(dup_filters).first()

                    if existing:
                        duplicates.append({
                            'row': row_num,
                            'candidate': DuplicateCandidateSerializer(existing).data,
                            'matched_by': 'email' if existing.email.lower() == email else 'phone',
                            'import_data': {
                                'first_name': first_name,
                                'last_name': last_name,
                                'email': email,
                                'phone': phone,
                            }
                        })
                        continue

                    # Знаходимо вакансію за назвою
                    vacancy = None
                    if vacancy_title:
                        vacancy = Vacancy.objects.filter(
                            organization=org,
                            title__iexact=vacancy_title
                        ).first()

                    # Валідний статус
                    valid_statuses = [s[0] for s in Candidate.STATUS_CHOICES]
                    if status_val not in valid_statuses:
                        status_val = 'new'

                    # Валідне джерело
                    valid_sources = [s[0] for s in Candidate.SOURCE_CHOICES]
                    if source_val not in valid_sources:
                        source_val = 'csv'

                    candidate = Candidate.objects.create(
                        organization=org,
                        first_name=first_name,
                        last_name=last_name,
                        email=email,
                        phone=phone,
                        vacancy=vacancy,
                        status=status_val,
                        source=source_val,
                        notes=notes,
                    )
                    created_count += 1

                except Exception as e:
                    errors.append({
                        'row': row_num,
                        'error': str(e)
                    })

        except Exception as e:
            return Response(
                {'error': f'Помилка обробки CSV: {str(e)}'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        return Response({
            'created': created_count,
            'duplicates_found': len(duplicates),
            'duplicates': duplicates,
            'errors_count': len(errors),
            'errors': errors[:10],  # Показуємо перші 10 помилок
        })


# ═══════════════════════════════════════════════════════════════
# CANDIDATES CSV EXPORT
# ═══════════════════════════════════════════════════════════════

class CandidateExportCSVView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        role = get_user_role(request.user)
        params = request.query_params

        if role == 'superadmin':
            qs = Candidate.objects.all()
            if params.get('organization'):
                qs = qs.filter(organization_id=params['organization'])
        else:
            org = get_user_org(request.user)
            qs = Candidate.objects.filter(organization=org) if org else Candidate.objects.none()

        if params.get('vacancy'):
            qs = qs.filter(vacancy_id=params['vacancy'])
        if params.get('status'):
            qs = qs.filter(status=params['status'])
        if params.get('source'):
            qs = qs.filter(source=params['source'])
        if params.get('search'):
            search = params['search']
            qs = qs.filter(
                models.Q(first_name__icontains=search)
                | models.Q(last_name__icontains=search)
                | models.Q(email__icontains=search)
            )
        if params.get('tags'):
            tag_ids = [int(t) for t in params.get('tags').split(',') if t.isdigit()]
            qs = qs.filter(tags__id__in=tag_ids).distinct()

        qs = qs.select_related('vacancy', 'organization').prefetch_related('tags').order_by('-created_at')

        response = HttpResponse(content_type='text/csv; charset=utf-8')
        response['Content-Disposition'] = 'attachment; filename="candidates.csv"'
        response.write('\ufeff')  # BOM для Excel

        writer = csv.writer(response)
        writer.writerow([
            'ID', "Ім'я", 'Прізвище', 'Email', 'Телефон',
            'Вакансія', 'Організація', 'Статус', 'Джерело', 'Теги', 'Нотатки', 'Дата створення',
        ])

        for c in qs:
            tags_str = ', '.join([t.name for t in c.tags.all()])
            writer.writerow([
                c.id,
                c.first_name or '',
                c.last_name or '',
                c.email or '',
                c.phone or '',
                c.vacancy.title if c.vacancy else '—',
                c.organization.name if c.organization else '—',
                STATUS_LABELS.get(c.status, c.status),
                c.get_source_display() if c.source else '—',
                tags_str,
                (c.notes or '').replace('\n', ' ').replace('\r', ''),
                c.created_at.strftime('%d.%m.%Y %H:%M') if c.created_at else '—',
            ])

        return response


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
                return Response(
                    {'error': 'organization parameter required'},
                    status=status.HTTP_400_BAD_REQUEST,
                )
            profiles = UserProfile.objects.filter(
                organization_id=org_id,
            ).select_related('user')
        else:
            user_org = get_user_org(request.user)
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

    @action(detail=False, methods=['get'])
    def all(self, request):
        if get_user_role(request.user) != 'superadmin':
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

        # Перевірка ліміту HR
        if org_id and role == 'hr':
            try:
                org = Organization.objects.get(id=org_id)
            except Organization.DoesNotExist:
                return Response(
                    {'error': 'Організацію не знайдено'},
                    status=status.HTTP_404_NOT_FOUND,
                )
            current_hr_count = UserProfile.objects.filter(
                organization=org, role='hr',
            ).count()
            if current_hr_count >= org.max_hr:
                return Response(
                    {
                        'error': (
                            f'Ліміт HR-менеджерів досягнуто ({org.max_hr}). '
                            f'Збільшіть ліміт у налаштуваннях організації.'
                        )
                    },
                    status=status.HTTP_400_BAD_REQUEST,
                )
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
        else:
            org = Organization.objects.filter(id=org_id).first() if org_id else None
            UserProfile.objects.create(
                user=user,
                organization=org,
                role=request.data.get('role', 'hr'),
            )

        return Response({'success': True})

    def destroy(self, request, pk=None):
        try:
            User.objects.get(id=pk).delete()
            return Response({'success': True})
        except User.DoesNotExist:
            return Response(
                {'error': 'Юзер не знайдений'},
                status=status.HTTP_404_NOT_FOUND,
            )


# ═══════════════════════════════════════════════════════════════
# EMAIL TEMPLATES
# ═══════════════════════════════════════════════════════════════

class EmailTemplateViewSet(viewsets.ModelViewSet):
    serializer_class = EmailTemplateSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        role = get_user_role(self.request.user)
        if role == 'superadmin':
            org_id = self.request.query_params.get('organization')
            qs = EmailTemplate.objects.all()
            return qs.filter(organization_id=org_id) if org_id else qs
        org = get_user_org(self.request.user)
        return EmailTemplate.objects.filter(organization=org) if org else EmailTemplate.objects.none()

    def list(self, request, *args, **kwargs):
        try:
            serializer = self.get_serializer(self.get_queryset(), many=True)
            return Response(serializer.data)
        except Exception as e:
            logger.exception("EmailTemplate LIST error")
            return Response(
                {'error': 'Помилка завантаження шаблонів', 'detail': str(e)},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )

    def create(self, request, *args, **kwargs):
        try:
            serializer = self.get_serializer(data=request.data)
            serializer.is_valid(raise_exception=True)
            self.perform_create(serializer)
            return Response(serializer.data, status=status.HTTP_201_CREATED)
        except serializers.ValidationError as e:
            detail = e.detail if isinstance(e.detail, dict) else {'error': str(e.detail)}
            return Response(detail, status=status.HTTP_400_BAD_REQUEST)
        except Exception as e:
            logger.exception("EmailTemplate CREATE error")
            return Response(
                {'error': 'Помилка створення шаблону', 'detail': str(e)},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )

    def update(self, request, *args, **kwargs):
        try:
            partial = kwargs.pop('partial', False)
            instance = self.get_object()
            serializer = self.get_serializer(instance, data=request.data, partial=partial)
            serializer.is_valid(raise_exception=True)
            self.perform_update(serializer)
            return Response(serializer.data)
        except serializers.ValidationError as e:
            detail = e.detail if isinstance(e.detail, dict) else {'error': str(e.detail)}
            return Response(detail, status=status.HTTP_400_BAD_REQUEST)
        except Exception as e:
            logger.exception("EmailTemplate UPDATE error")
            return Response(
                {'error': 'Помилка оновлення шаблону', 'detail': str(e)},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )

    def perform_create(self, serializer):
        org = get_user_org(self.request.user)
        if not org:
            raise serializers.ValidationError(
                {'error': "Користувач не прив'язаний до організації. Зверніться до адміністратора."}
            )
        template_type = serializer.validated_data.get('template_type')
        if template_type:
            existing = EmailTemplate.objects.filter(
                organization=org, template_type=template_type,
            ).first()
            if existing:
                for field in ('subject', 'body', 'is_active'):
                    if field in serializer.validated_data:
                        setattr(existing, field, serializer.validated_data[field])
                existing.save()
                serializer.instance = existing
                return
        serializer.save(organization=org)

    def perform_update(self, serializer):
        org = get_user_org(self.request.user)
        if not org:
            raise serializers.ValidationError({'error': 'Користувач не прив\'язаний до організації'})
        if serializer.instance.organization != org:
            raise serializers.ValidationError({'error': 'Немає прав для редагування цього шаблону'})
        serializer.save()

    # ─── Preview ────────────────────────────────────────────────

    @action(detail=True, methods=['post'])
    def preview(self, request, pk=None):
        template = self.get_object()
        candidate_id = request.data.get('candidate_id')
        if not candidate_id:
            return Response(
                {'error': 'candidate_id is required'},
                status=status.HTTP_400_BAD_REQUEST,
            )
        try:
            candidate = Candidate.objects.get(id=candidate_id, organization=template.organization)
        except Candidate.DoesNotExist:
            return Response({'error': 'Кандидата не знайдено'}, status=status.HTTP_404_NOT_FOUND)

        subject, body = apply_template_replacements(
            template.subject, template.body, candidate, request,
        )
        return Response({
            'subject': subject,
            'body': body,
            'candidate_email': candidate.email,
            'from_email': request.user.email,
        })

    # ─── Send ────────────────────────────────────────────────────

    @action(detail=True, methods=['post'])
    def send(self, request, pk=None):
        """
        POST /api/email-templates/{id}/send/
        Body: {"candidate_id": 123}
        """
        template = self.get_object()
        candidate, hr_email, subject, body = self._prepare_email(request, template)
        if isinstance(candidate, Response):
            return candidate  # early validation error

        backend_type = getattr(settings, 'EMAIL_BACKEND_TYPE', 'gmail')
        try:
            if backend_type == 'smtp':
                return self._send_via_smtp(request, template, candidate, hr_email, subject, body)
            elif backend_type == 'gmail':
                return self._send_via_gmail(request, template, candidate, hr_email, subject, body)
            else:
                return self._send_via_console(request, template, candidate, hr_email, subject, body)
        except Exception as e:
            logger.exception("Email send error")
            return Response(
                {
                    'success': False,
                    'error': str(e),
                    'backend_type': backend_type,
                },
                status=status.HTTP_502_BAD_GATEWAY,
            )

    @action(detail=True, methods=['post'])
    def send_via_gmail(self, request, pk=None):
        """POST /api/email-templates/{id}/send_via_gmail/ (аліас для send)"""
        template = self.get_object()
        candidate, hr_email, subject, body = self._prepare_email(request, template)
        if isinstance(candidate, Response):
            return candidate

        if ALLAUTH_AVAILABLE:
            has_google = SocialAccount.objects.filter(
                user=request.user, provider='google',
            ).exists()
        else:
            has_google = False

        if not has_google:
            return Response(
                {
                    'success': False,
                    'error': 'Необхідно підключити Google акаунт',
                    'redirect_url': '/accounts/google/login/',
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        sent_email = SentEmail.objects.create(
            candidate=candidate,
            template=template,
            recipient_email=candidate.email,
            subject=subject,
            body=body,
            sent_by=request.user,
            status='pending',
        )

        try:
            result = GmailService.send_email(
                user=request.user,
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
                'subject': subject,
                'from_email': result['from_email'],
                'message_id': result['message_id'],
            })
        except Exception as e:
            sent_email.status = 'failed'
            sent_email.error_message = str(e)[:500]
            sent_email.save()
            return Response(
                {'success': False, 'error': str(e)},
                status=status.HTTP_502_BAD_GATEWAY,
            )

    # ─── History ─────────────────────────────────────────────────

    @action(detail=False, methods=['get'])
    def history(self, request):
        """GET /api/email-templates/history/?candidate=123"""
        role = get_user_role(request.user)

        if role == 'superadmin':
            org_id = request.query_params.get('organization')
            qs = (
                SentEmail.objects.filter(candidate__organization_id=org_id)
                if org_id
                else SentEmail.objects.all()
            )
        else:
            org = get_user_org(request.user)
            qs = (
                SentEmail.objects.filter(candidate__organization=org)
                if org
                else SentEmail.objects.none()
            )

        if request.query_params.get('candidate'):
            qs = qs.filter(candidate_id=request.query_params['candidate'])
        if request.query_params.get('template_type'):
            qs = qs.filter(template__template_type=request.query_params['template_type'])

        qs = qs.select_related('candidate', 'template', 'sent_by').order_by('-sent_at')
        page = self.paginate_queryset(qs)
        if page is not None:
            return self.get_paginated_response(SentEmailSerializer(page, many=True).data)
        return Response(SentEmailSerializer(qs, many=True).data)

    # ─── Private helpers ──────────────────────────────────────────

    def _prepare_email(self, request, template):
        """
        Валідує запит і повертає (candidate, hr_email, subject, body).
        При помилці повертає (Response, None, None, None).
        """
        candidate_id = request.data.get('candidate_id')
        if not candidate_id:
            return (
                Response({'success': False, 'error': 'candidate_id is required'}, status=status.HTTP_400_BAD_REQUEST),
                None, None, None,
            )

        try:
            candidate = Candidate.objects.get(id=candidate_id, organization=template.organization)
        except Candidate.DoesNotExist:
            return (
                Response({'success': False, 'error': 'Кандидата не знайдено'}, status=status.HTTP_404_NOT_FOUND),
                None, None, None,
            )

        if not candidate.email:
            return (
                Response({'success': False, 'error': 'У кандидата не вказано email'},
                         status=status.HTTP_400_BAD_REQUEST),
                None, None, None,
            )

        hr_email = request.user.email
        if not hr_email:
            return (
                Response(
                    {'success': False, 'error': 'У вашому профілі не вказано email. Оновіть профіль перед відправкою.'},
                    status=status.HTTP_400_BAD_REQUEST,
                ),
                None, None, None,
            )

        subject, body = apply_template_replacements(
            template.subject or 'Без теми',
            template.body or '',
            candidate,
            request,
        )
        return candidate, hr_email, subject, body

    def _create_sent_record(self, candidate, template, hr_email, subject, body, request, *, initial_status='pending'):
        return SentEmail.objects.create(
            candidate=candidate,
            template=template,
            recipient_email=candidate.email,
            subject=subject,
            body=body,
            sent_by=request.user,
            status=initial_status,
        )

    def _send_via_smtp(self, request, template, candidate, hr_email, subject, body):
        from django.core.mail import EmailMultiAlternatives

        sent = self._create_sent_record(candidate, template, hr_email, subject, body, request)
        try:
            msg = EmailMultiAlternatives(
                subject=subject,
                body=body,
                from_email=settings.DEFAULT_FROM_EMAIL,
                to=[candidate.email],
                reply_to=[hr_email],
            )
            msg.attach_alternative(body, 'text/html')
            old_timeout = socket.getdefaulttimeout()
            socket.setdefaulttimeout(10)
            try:
                msg.send()
            finally:
                socket.setdefaulttimeout(old_timeout)

            sent.status = 'sent'
            sent.save()
            return Response({
                'success': True,
                'message': f'Лист відправлено на {candidate.email}',
                'sent_email_id': sent.id,
                'from_email': settings.DEFAULT_FROM_EMAIL,
                'reply_to': hr_email,
            })
        except (smtplib.SMTPException, socket.timeout, OSError) as e:
            sent.status = 'failed'
            sent.error_message = f'SMTP: {str(e)[:500]}'
            sent.save()
            raise Exception(f'SMTP помилка: {e}')

    def _get_gmail_sender_user(self, request):
        """
        Повертає User з підключеним Google акаунтом.
        Спочатку перевіряє поточного юзера, потім шукає спільний акаунт організації
        (перший юзер в організації з підключеним Google).
        """
        from allauth.socialaccount.models import SocialAccount
        from django.contrib.auth.models import User

        # 1. Поточний юзер має Google?
        if SocialAccount.objects.filter(user=request.user, provider='google').exists():
            return request.user

        # 2. Шукаємо будь-якого юзера організації з Google акаунтом
        org = get_user_org(request.user)
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

        # 3. Суперадмін акаунт з Google (fallback)
        social = SocialAccount.objects.filter(
            provider='google',
            user__profile__role='superadmin',
        ).select_related('user').first()
        if social:
            return social.user

        return None

    def _send_via_gmail(self, request, template, candidate, hr_email, subject, body):
        """Відправка через Gmail API. Використовує спільний Google акаунт організації."""
        if not ALLAUTH_AVAILABLE:
            raise Exception('django-allauth не встановлено')

        sender_user = self._get_gmail_sender_user(request)
        if not sender_user:
            raise Exception(
                'Жоден акаунт організації не підключено до Google. '
                'Адмін має зайти на /accounts/google/login/ один раз.'
            )

        sent = self._create_sent_record(candidate, template, hr_email, subject, body, request)
        try:
            result = GmailService.send_email(
                user=sender_user,
                to_email=candidate.email,
                subject=subject,
                body=body,
            )
            sent.status = 'sent'
            sent.save()
            return Response({
                'success': True,
                'message': f'Лист відправлено через Gmail на {candidate.email}',
                'sent_email_id': sent.id,
                'from_email': result['from_email'],
                'message_id': result['message_id'],
            })
        except Exception as e:
            sent.status = 'failed'
            sent.error_message = str(e)[:500]
            sent.save()
            raise

    def _send_via_console(self, request, template, candidate, hr_email, subject, body):
        hr_name = (
                f"{request.user.first_name} {request.user.last_name}".strip()
                or request.user.username
        )
        sent = self._create_sent_record(
            candidate, template, hr_email, subject, body, request, initial_status='sent',
        )
        logger.info(
            "\n%s\n📧 ТЕСТОВИЙ ЛИСТ\nВід: %s <%s>\nКому: <%s>\nТема: %s\n%s\n%s\n%s",
            '=' * 60, hr_name, hr_email, candidate.email, subject,
            '-' * 60, body, '=' * 60,
        )
        return Response({
            'success': True,
            'message': 'Тестовий режим: лист виведено в консоль',
            'test_mode': True,
            'sent_email_id': sent.id,
            'from_email': hr_email,
        })

    def _send_via_file(self, request, template, candidate, hr_email, subject, body):
        from django.core.mail import send_mail

        sent = self._create_sent_record(
            candidate, template, hr_email, subject, body, request, initial_status='sent',
        )
        send_mail(
            subject=subject,
            message=body,
            from_email=hr_email,
            recipient_list=[candidate.email],
            html_message=body,
            fail_silently=False,
        )
        return Response({
            'success': True,
            'message': f'Лист збережено у файл (backend: {settings.EMAIL_BACKEND})',
            'test_mode': True,
            'sent_email_id': sent.id,
            'from_email': hr_email,
        })


class SentEmailViewSet(viewsets.ReadOnlyModelViewSet):
    serializer_class = SentEmailSerializer
    permission_classes = [IsAuthenticated]
    pagination_class = StandardPagination

    def get_queryset(self):
        role = get_user_role(self.request.user)
        if role == 'superadmin':
            org_id = self.request.query_params.get('organization')
            qs = SentEmail.objects.all()
            return qs.filter(candidate__organization_id=org_id) if org_id else qs
        org = get_user_org(self.request.user)
        return (
            SentEmail.objects.filter(candidate__organization=org)
            if org
            else SentEmail.objects.none()
        )

    def list(self, request, *args, **kwargs):
        qs = self.get_queryset()
        if request.query_params.get('candidate'):
            qs = qs.filter(candidate_id=request.query_params['candidate'])
        if request.query_params.get('template_type'):
            qs = qs.filter(template__template_type=request.query_params['template_type'])

        qs = qs.select_related('candidate', 'template', 'sent_by').order_by('-sent_at')
        page = self.paginate_queryset(qs)
        if page is not None:
            return self.get_paginated_response(self.get_serializer(page, many=True).data)
        return Response(self.get_serializer(qs, many=True).data)


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
    """Діагностика email-конфігурації."""
    from allauth.socialaccount.models import SocialAccount
    has_google = SocialAccount.objects.filter(
        user=request.user, provider='google',
    ).exists()
    return Response({
        'gmail_api': 'active',
        'has_google_account': has_google,
        'google_login_url': '/accounts/google/login/',
        'current_user_email': request.user.email,
        'google_client_id_set': bool(getattr(settings, 'GOOGLE_CLOUD_CLIENT_ID', '')),
    })