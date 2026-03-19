from rest_framework import viewsets, status
from rest_framework.decorators import action, api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from django.contrib.auth.models import User
from rest_framework import serializers as drf_serializers
from .models import Candidate, Vacancy, UserProfile, Organization
from .serializers import CandidateSerializer, VacancySerializer, OrganizationSerializer


def get_user_org(user):
    try:
        return user.profile.organization
    except:
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
        org_data = {'id': org.id, 'name': org.name} if org else None
        role = user.profile.role
    except:
        org_data = None
        role = None

    return Response({
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
        } for p in profiles]
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
        org = Organization.objects.get(id=org_id)
        UserProfile.objects.create(user=user, organization=org, role=role)
        return Response({'success': True}, status=status.HTTP_201_CREATED)