from rest_framework import viewsets, status, serializers
from rest_framework.decorators import action, api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView
from django.contrib.auth.models import User
from django.db import models
import csv
from django.http import HttpResponse
from .models import Candidate, Vacancy, UserProfile, Organization, StatusHistory, EmailTemplate
from .serializers import CandidateSerializer, VacancySerializer, OrganizationSerializer, EmailTemplateSerializer
from .pagination import StandardPagination


def get_user_org(user):
    try:
        return user.profile.organization
    except (UserProfile.DoesNotExist, AttributeError):
        return None


def get_user_role(user):
    try:
        return user.profile.role
    except (UserProfile.DoesNotExist, AttributeError):
        return None


class VacancyViewSet(viewsets.ModelViewSet):
    serializer_class = VacancySerializer

    def get_queryset(self):
        role = get_user_role(self.request.user)
        org_id = self.request.query_params.get('organization')

        if role == 'superadmin':
            queryset = Vacancy.objects.all()
            if org_id:
                queryset = queryset.filter(organization_id=org_id)
        else:
            org = get_user_org(self.request.user)
            if org:
                queryset = Vacancy.objects.filter(organization=org)
            else:
                queryset = Vacancy.objects.none()

        return queryset

    def perform_create(self, serializer):
        org = get_user_org(self.request.user)
        serializer.save(organization=org)


class OrganizationViewSet(viewsets.ModelViewSet):
    queryset = Organization.objects.all()
    serializer_class = OrganizationSerializer


class CandidateViewSet(viewsets.ModelViewSet):
    queryset = Candidate.objects.all()
    serializer_class = CandidateSerializer
    pagination_class = StandardPagination

    def get_queryset(self):
        role = get_user_role(self.request.user)
        org_id = self.request.query_params.get('organization')

        if role == 'superadmin':
            queryset = Candidate.objects.all()
            if org_id:
                queryset = queryset.filter(organization_id=org_id)
        else:
            org = get_user_org(self.request.user)
            if org:
                queryset = Candidate.objects.filter(organization=org)
            else:
                queryset = Candidate.objects.none()

        vacancy = self.request.query_params.get('vacancy')
        status_filter = self.request.query_params.get('status')
        assigned_to = self.request.query_params.get('assigned_to')
        mine = self.request.query_params.get('mine')

        if vacancy:
            queryset = queryset.filter(vacancy_id=vacancy)
        if status_filter:
            queryset = queryset.filter(status=status_filter)
        if assigned_to:
            queryset = queryset.filter(assigned_to_id=assigned_to)
        if mine == 'true':
            queryset = queryset.filter(assigned_to=self.request.user)

        return queryset.select_related('assigned_to').order_by('-created_at')

    def perform_create(self, serializer):
        org = get_user_org(self.request.user)
        serializer.save(organization=org)

    @action(detail=True, methods=['patch'])
    def update_status(self, request, pk=None):
        candidate = self.get_object()
        new_status = request.data.get('status')
        if new_status:
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
        return Response({'error': 'Status required'}, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=True, methods=['patch'])
    def assign(self, request, pk=None):
        candidate = self.get_object()
        user_id = request.data.get('assigned_to')

        if user_id is None:
            candidate.assigned_to = None
            candidate.save()
            return Response(CandidateSerializer(candidate).data)

        try:
            user = User.objects.get(id=user_id)
            candidate.assigned_to = user
            candidate.save()
            return Response(CandidateSerializer(candidate).data)
        except User.DoesNotExist:
            return Response({'error': 'User not found'}, status=status.HTTP_404_NOT_FOUND)


class CandidateExportCSVView(APIView):
    """Експорт кандидатів у CSV з урахуванням фільтрів та прав доступу"""
    permission_classes = [IsAuthenticated]

    def get(self, request):
        role = get_user_role(request.user)
        org_id = request.query_params.get('organization')

        if role == 'superadmin':
            queryset = Candidate.objects.all()
            if org_id:
                queryset = queryset.filter(organization_id=org_id)
        else:
            org = get_user_org(request.user)
            if org:
                queryset = Candidate.objects.filter(organization=org)
            else:
                queryset = Candidate.objects.none()

        vacancy = request.query_params.get('vacancy')
        status_filter = request.query_params.get('status')
        search = request.query_params.get('search')

        if vacancy:
            queryset = queryset.filter(vacancy_id=vacancy)
        if status_filter:
            queryset = queryset.filter(status=status_filter)
        if search:
            queryset = queryset.filter(
                models.Q(first_name__icontains=search) |
                models.Q(last_name__icontains=search) |
                models.Q(email__icontains=search)
            )

        queryset = queryset.select_related('vacancy', 'organization').order_by('-created_at')

        response = HttpResponse(content_type='text/csv; charset=utf-8')
        response['Content-Disposition'] = 'attachment; filename="candidates.csv"'
        response.write('\ufeff')

        writer = csv.writer(response)
        writer.writerow([
            'ID', 'Ім\'я', 'Прізвище', 'Email', 'Телефон',
            'Вакансія', 'Організація', 'Статус', 'Нотатки', 'Дата створення'
        ])

        status_labels = {
            'new': 'Новий',
            'screening': 'Скринінг',
            'interview': 'Співбесіда',
            'offer': 'Оффер',
            'rejected': 'Відмова',
        }

        for c in queryset:
            writer.writerow([
                c.id,
                c.first_name or '',
                c.last_name or '',
                c.email or '',
                c.phone or '',
                c.vacancy.title if c.vacancy else '—',
                c.organization.name if c.organization else '—',
                status_labels.get(c.status, c.status),
                (c.notes or '').replace('\n', ' ').replace('\r', ''),
                c.created_at.strftime('%d.%m.%Y %H:%M') if c.created_at else '—',
            ])

        return response


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def current_user(request):
    user = request.user
    try:
        org = user.profile.organization
        org_data = {
            'id': org.id,
            'name': org.name,
            'max_vacancies': org.max_vacancies,
            'max_hr': org.max_hr,
        } if org else None
        role = user.profile.role
    except (UserProfile.DoesNotExist, AttributeError):
        org_data = None
        role = None

    return Response({
        'id': user.id,
        'username': user.username,
        'first_name': user.first_name,
        'last_name': user.last_name,
        'email': user.email,
        'organization': org_data,
        'role': role,
    })


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
            user_org = get_user_org(request.user)
            if not user_org:
                return Response([], status=status.HTTP_200_OK)
            profiles = UserProfile.objects.filter(organization=user_org).select_related('user')

        data = [{
            'id': p.user.id,
            'username': p.user.username,
            'first_name': p.user.first_name,
            'last_name': p.user.last_name,
            'email': p.user.email,
            'role': p.role,
            'profile_id': p.id,
        } for p in profiles]
        return Response(data)

    @action(detail=False, methods=['get'])
    def all(self, request):
        role = get_user_role(request.user)
        if role != 'superadmin':
            return Response({'error': 'Forbidden'}, status=status.HTTP_403_FORBIDDEN)

        users = User.objects.all().select_related('profile__organization')
        data = []
        for u in users:
            try:
                profile = u.profile
                org = profile.organization
                role_name = profile.role
                org_id = org.id if org else None
                org_name = org.name if org else None
            except (UserProfile.DoesNotExist, AttributeError):
                role_name = None
                org_id = None
                org_name = None
            data.append({
                'id': u.id,
                'username': u.username,
                'first_name': u.first_name,
                'last_name': u.last_name,
                'email': u.email,
                'role': role_name,
                'organization_id': org_id,
                'organization_name': org_name,
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

        if User.objects.filter(username=username).exists():
            return Response({'error': 'Username вже існує'}, status=status.HTTP_400_BAD_REQUEST)

        # ВАЛІДАЦІЯ ЛІМІТУ HR
        if org_id and role == 'hr':
            try:
                org = Organization.objects.get(id=org_id)
                current_hr_count = UserProfile.objects.filter(
                    organization=org,
                    role='hr'
                ).count()
                if current_hr_count >= org.max_hr:
                    return Response(
                        {
                            'error': f'Ліміт HR-менеджерів досягнуто ({org.max_hr}). Збільшіть ліміт у налаштуваннях організації.'},
                        status=status.HTTP_400_BAD_REQUEST
                    )
            except Organization.DoesNotExist:
                return Response({'error': 'Організацію не знайдено'}, status=status.HTTP_404_NOT_FOUND)

        user = User.objects.create_user(
            username=username, password=password,
            first_name=first_name, last_name=last_name, email=email
        )
        org = Organization.objects.get(id=org_id) if org_id else None
        UserProfile.objects.create(user=user, organization=org, role=role)
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
            user.set_password(request.data.get('password'))
        user.save()

        try:
            profile = user.profile
            profile.role = request.data.get('role', profile.role)
            org_id = request.data.get('organization')
            if org_id:
                profile.organization = Organization.objects.get(id=org_id)
            elif org_id == '':
                profile.organization = None
            profile.save()
        except (UserProfile.DoesNotExist, AttributeError):
            org_id = request.data.get('organization')
            org = Organization.objects.get(id=org_id) if org_id else None
            UserProfile.objects.create(user=user, organization=org, role=request.data.get('role', 'hr'))

        return Response({'success': True})

    def destroy(self, request, pk=None):
        try:
            user = User.objects.get(id=pk)
            user.delete()
            return Response({'success': True})
        except User.DoesNotExist:
            return Response({'error': 'Юзер не знайдений'}, status=status.HTTP_404_NOT_FOUND)


class EmailTemplateViewSet(viewsets.ModelViewSet):
    serializer_class = EmailTemplateSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        role = get_user_role(self.request.user)

        # Супер-адмін бачить всі шаблони
        if role == 'superadmin':
            org_id = self.request.query_params.get('organization')
            if org_id:
                return EmailTemplate.objects.filter(organization_id=org_id)
            return EmailTemplate.objects.all()

        # Звичайний користувач — тільки свої організації
        org = get_user_org(self.request.user)
        if not org:
            return EmailTemplate.objects.none()
        return EmailTemplate.objects.filter(organization=org)

    def list(self, request, *args, **kwargs):
        """Перевизначаємо list для кращої обробки помилок"""
        try:
            queryset = self.get_queryset()
            serializer = self.get_serializer(queryset, many=True)
            return Response(serializer.data)
        except Exception as e:
            print(f"EmailTemplate list error: {e}")
            return Response(
                {'error': 'Помилка завантаження шаблонів', 'detail': str(e)},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )

    def create(self, request, *args, **kwargs):
        """Перевизначаємо create для кращої обробки помилок"""
        try:
            return super().create(request, *args, **kwargs)
        except serializers.ValidationError as e:
            return Response(e.detail, status=status.HTTP_400_BAD_REQUEST)
        except Exception as e:
            print(f"EmailTemplate create error: {e}")
            return Response(
                {'error': 'Помилка створення шаблону', 'detail': str(e)},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )

    def perform_create(self, serializer):
        org = get_user_org(self.request.user)
        if not org:
            raise serializers.ValidationError(
                {'error': "Користувач не прив\'язаний до організації. Зверніться до адміністратора."}
            )
        # Перевіряємо, чи вже існує шаблон цього типу для організації
        template_type = serializer.validated_data.get('template_type')
        if template_type and EmailTemplate.objects.filter(organization=org, template_type=template_type).exists():
            raise serializers.ValidationError(
                {'error': f'Шаблон типу "{template_type}" вже існує для цієї організації. Використовуйте PATCH для оновлення.'}
            )
        serializer.save(organization=org)

    def perform_update(self, serializer):
        org = get_user_org(self.request.user)
        if not org:
            raise serializers.ValidationError(
                {'error': "Користувач не прив\'язаний до організації"}
            )
        # Перевіряємо, що шаблон належить організації користувача
        if serializer.instance.organization != org:
            raise serializers.ValidationError(
                {'error': 'Немає прав для редагування цього шаблону'}
            )
        serializer.save()

    @action(detail=True, methods=['post'])
    def preview(self, request, pk=None):
        """Генерація попереднього перегляду шаблону з підстановкою даних кандидата"""
        try:
            template = self.get_object()
        except Exception as e:
            return Response({'error': 'Шаблон не знайдено'}, status=status.HTTP_404_NOT_FOUND)

        candidate_id = request.data.get('candidate_id')

        if not candidate_id:
            return Response({'error': 'candidate_id is required'}, status=status.HTTP_400_BAD_REQUEST)

        try:
            candidate = Candidate.objects.get(id=candidate_id, organization=template.organization)
        except Candidate.DoesNotExist:
            return Response({'error': 'Кандидата не знайдено'}, status=status.HTTP_404_NOT_FOUND)

        vacancy_title = candidate.vacancy.title if candidate.vacancy else '—'
        hr_name = f"{request.user.first_name} {request.user.last_name}".strip() or request.user.username

        subject = template.subject
        body = template.body

        # Підстановка плейсхолдерів
        replacements = {
            '{{name}}': f"{candidate.first_name} {candidate.last_name}",
            '{{first_name}}': candidate.first_name,
            '{{last_name}}': candidate.last_name,
            '{{vacancy}}': vacancy_title,
            '{{email}}': candidate.email,
            '{{phone}}': candidate.phone or '—',
            '{{status}}': candidate.get_status_display(),
            '{{hr_name}}': hr_name,
            '{{organization}}': template.organization.name if template.organization else '—',
            '{{date}}': candidate.created_at.strftime('%d.%m.%Y') if candidate.created_at else '—',
        }

        for placeholder, value in replacements.items():
            subject = subject.replace(placeholder, value)
            body = body.replace(placeholder, value)

        return Response({
            'subject': subject,
            'body': body,
            'candidate_email': candidate.email,
        })

    @action(detail=True, methods=['post'])
    def send(self, request, pk=None):
        """Відправка листа кандидату (заглушка — повертає згенерований лист)"""
        preview_response = self.preview(request, pk)
        if preview_response.status_code != status.HTTP_200_OK:
            return preview_response

        # Тут можна інтегрувати Django email backend
        # from django.core.mail import send_mail
        # send_mail(...)

        return Response({
            'success': True,
            'message': 'Лист згенеровано (відправка через email backend буде реалізована окремо)',
            **preview_response.data
        })
 реалізована окремо)',
            **preview_response.data
        })