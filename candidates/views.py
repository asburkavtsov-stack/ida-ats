from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from .models import Candidate, Vacancy
from .serializers import CandidateSerializer, VacancySerializer

class VacancyViewSet(viewsets.ModelViewSet):
    queryset = Vacancy.objects.all()
    serializer_class = VacancySerializer

class CandidateViewSet(viewsets.ModelViewSet):
    queryset = Candidate.objects.all()
    serializer_class = CandidateSerializer

    def get_queryset(self):
        queryset = Candidate.objects.all()
        vacancy = self.request.query_params.get('vacancy')
        status_filter = self.request.query_params.get('status')

        if vacancy:
            queryset = queryset.filter(vacancy_id=vacancy)
        if status_filter:
            queryset = queryset.filter(status=status_filter)

        return queryset

    @action(detail=True, methods=['patch'])
    def update_status(self, request, pk=None):
        candidate = self.get_object()
        new_status = request.data.get('status')
        if new_status:
            candidate.status = new_status
            candidate.save()
            return Response(CandidateSerializer(candidate).data)
        return Response({'error': 'Status required'}, status=status.HTTP_400_BAD_REQUEST)