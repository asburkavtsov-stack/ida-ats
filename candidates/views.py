from rest_framework import viewsets, status
from rest_framework.decorators import action, api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from .models import Candidate, Vacancy, UserProfile
from .serializers import CandidateSerializer, VacancySerializer


def get_user_org(user):
    try:
        return user.profile.organization
    except:
        return None


class VacancyViewSet(viewsets.ModelViewSet):
    serializer_class = VacancySerializer

    def get_queryset(self):
        org = get_user_org(self.request.user)
        if org:
            return Vacancy.objects.filter(organization=org)
        return Vacancy.objects.all()

    def perform_create(self, serializer):
        org = get_user_org(self.request.user)
        serializer.save(organization=org)


class CandidateViewSet(viewsets.ModelViewSet):
    serializer_class = CandidateSerializer

    def get_queryset(self):
        org = get_user_org(self.request.user)
        queryset = Candidate.objects.filter(organization=org) if org else Candidate.objects.all()

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