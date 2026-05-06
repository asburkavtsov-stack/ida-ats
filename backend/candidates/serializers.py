from rest_framework import serializers
from django.contrib.auth.models import User
from .models import Candidate, Vacancy, Organization, StatusHistory, EmailTemplate, SentEmail


class VacancySerializer(serializers.ModelSerializer):
    class Meta:
        model = Vacancy
        fields = ['id', 'title', 'department', 'is_active', 'created_at']


class StatusHistorySerializer(serializers.ModelSerializer):
    changed_by_name = serializers.SerializerMethodField()

    class Meta:
        model = StatusHistory
        fields = ['id', 'old_status', 'new_status', 'changed_by_name', 'changed_at']

    def get_changed_by_name(self, obj):
        if not obj.changed_by:
            return None
        full = f"{obj.changed_by.first_name} {obj.changed_by.last_name}".strip()
        return full or obj.changed_by.username


class CandidateSerializer(serializers.ModelSerializer):
    vacancy_title = serializers.CharField(source='vacancy.title', read_only=True)
    assigned_to_name = serializers.SerializerMethodField()
    assigned_to_username = serializers.SerializerMethodField()
    status_history = StatusHistorySerializer(many=True, read_only=True)

    class Meta:
        model = Candidate
        fields = [
            'id', 'first_name', 'last_name', 'email',
            'phone', 'vacancy', 'vacancy_title',
            'status', 'notes', 'created_at',
            'assigned_to', 'assigned_to_name', 'assigned_to_username',
            'status_history',
        ]

    def get_assigned_to_name(self, obj):
        if not obj.assigned_to:
            return None
        full = f"{obj.assigned_to.first_name} {obj.assigned_to.last_name}".strip()
        return full or obj.assigned_to.username

    def get_assigned_to_username(self, obj):
        return obj.assigned_to.username if obj.assigned_to else None


class OrganizationSerializer(serializers.ModelSerializer):
    class Meta:
        model = Organization
        fields = ['id', 'name', 'slug', 'is_active', 'created_at', 'max_hr', 'max_vacancies']


class OrganizationDetailSerializer(serializers.ModelSerializer):
    class Meta:
        model = Organization
        fields = '__all__'


class EmailTemplateSerializer(serializers.ModelSerializer):
    template_type_display = serializers.CharField(source='get_template_type_display', read_only=True)
    organization_name = serializers.CharField(source='organization.name', read_only=True)

    class Meta:
        model = EmailTemplate
        fields = ['id', 'organization', 'organization_name', 'template_type', 'template_type_display', 'subject', 'body', 'is_active', 'created_at', 'updated_at']
        read_only_fields = ['organization', 'organization_name', 'created_at', 'updated_at']


class SentEmailSerializer(serializers.ModelSerializer):
    candidate_name = serializers.SerializerMethodField()
    sent_by_name = serializers.SerializerMethodField()
    template_type_display = serializers.SerializerMethodField()
    template_type = serializers.SerializerMethodField()

    class Meta:
        model = SentEmail
        fields = [
            'id', 'candidate', 'candidate_name', 'template', 'template_type', 'template_type_display',
            'recipient_email', 'subject', 'body', 'sent_by', 'sent_by_name',
            'sent_at', 'status', 'error_message'
        ]
        read_only_fields = ['id', 'sent_at', 'status', 'error_message']

    def get_candidate_name(self, obj):
        if obj.candidate:
            return f"{obj.candidate.first_name} {obj.candidate.last_name}"
        return None

    def get_sent_by_name(self, obj):
        if obj.sent_by:
            full = f"{obj.sent_by.first_name} {obj.sent_by.last_name}".strip()
            return full or obj.sent_by.username
        return None

    def get_template_type_display(self, obj):
        if obj.template:
            return obj.template.get_template_type_display()
        return None

    def get_template_type(self, obj):
        if obj.template:
            return obj.template.template_type
        return None