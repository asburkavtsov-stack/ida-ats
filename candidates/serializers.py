from rest_framework import serializers
from .models import Candidate, Vacancy

class VacancySerializer(serializers.ModelSerializer):
    class Meta:
        model = Vacancy
        fields = ['id', 'title', 'department', 'is_active', 'created_at']

class CandidateSerializer(serializers.ModelSerializer):
    vacancy_title = serializers.CharField(source='vacancy.title', read_only=True)

    class Meta:
        model = Candidate
        fields = [
            'id', 'first_name', 'last_name', 'email',
            'phone', 'vacancy', 'vacancy_title',
            'status', 'notes', 'created_at'
        ]