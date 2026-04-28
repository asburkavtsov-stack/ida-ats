from rest_framework import viewsets, status
from rest_framework.decorators import action, api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView  # ← ДОДАТИ ЦЕ
from django.contrib.auth.models import User
from django.db import models
import csv
from django.http import HttpResponse
from .models import Candidate, Vacancy, UserProfile, Organization
from .serializers import CandidateSerializer, VacancySerializer, OrganizationSerializer
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

        if vacancy:
            queryset = queryset.filter(vacancy_id=vacancy)
        if status_filter:
            queryset = queryset.filter(status=status_filter)

        return queryset.order_by('-created_at')

    def perform_create(self, serializer):
        org = get_user_org(self.request.user)
        serializer.save(organization=org)

    @action(detail=True, methods=['patch'])
    def update_status(self, request, pk=None):
        candidate = self.get_object()
        new_status = request.data.get('status')
        if new_status:
            candidate.status = new_status
            candidate.save()
            return Response(CandidateSerializer(candidate).data)
        return Response({'error': 'Status required'}, status=status.HTTP_400_BAD_REQUEST)


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

        # Формуємо CSV
        response = HttpResponse(content_type='text/csv; charset=utf-8')
        response['Content-Disposition'] = 'attachment; filename="candidates.csv"'
        response.write('\ufeff')  # BOM для Excel

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