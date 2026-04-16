from rest_framework import viewsets, status
from rest_framework.decorators import action, api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from django.contrib.auth.models import User
from rest_framework import serializers as drf_serializers
from .models import Candidate, Vacancy, UserProfile, Organization
from .serializers import CandidateSerializer, VacancySerializer, OrganizationSerializer
from rest_framework.permissions import AllowAny


def get_user_org(user):
    try:
        return user.profile.organization
    except (AttributeError, UserProfile.DoesNotExist):
        return None

class VacancyViewSet(viewsets.ModelViewSet):
    serializer_class = VacancySerializer

    def get_queryset(self):
        try:
            role = self.request.user.profile.role
        except:
            role = None

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

    def get_queryset(self):
        try:
            role = self.request.user.profile.role
        except:
            role = None

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

        return queryset

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
    except (AttributeError, UserProfile.DoesNotExist):
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
        org_id = request.query_params.get('organization')
        profiles = UserProfile.objects.filter(organization_id=org_id).select_related('user')
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
        users = User.objects.all().select_related('profile__organization')
        data = []
        for u in users:
            try:
                profile = u.profile
                org = profile.organization
                role = profile.role
                org_id = org.id if org else None
                org_name = org.name if org else None
            except:
                role = None
                org_id = None
                org_name = None
            data.append({
                'id': u.id,
                'username': u.username,
                'first_name': u.first_name,
                'last_name': u.last_name,
                'email': u.email,
                'role': role,
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
        except UserProfile.DoesNotExist:
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

        @api_view(['POST'])
        @permission_classes([AllowAny])  # або IsAdminUser, якщо тільки адміни можуть реєструвати
        def register_user(request):
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
                username=username,
                password=password,
                first_name=first_name,
                last_name=last_name,
                email=email
            )

            org = Organization.objects.get(id=org_id) if org_id else None
            UserProfile.objects.create(user=user, organization=org, role=role)

            return Response({'success': True, 'username': username}, status=status.HTTP_201_CREATED)