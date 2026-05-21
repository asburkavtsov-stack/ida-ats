from rest_framework import serializers
from django.contrib.auth.models import User
from .models import Candidate, Vacancy, Organization, StatusHistory, EmailTemplate, SentEmail, Tag, Interview


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


class TagSerializer(serializers.ModelSerializer):
    class Meta:
        model = Tag
        fields = ['id', 'name', 'color', 'created_at']


class DuplicateCandidateSerializer(serializers.ModelSerializer):
    vacancy_title = serializers.CharField(source='vacancy.title', read_only=True)

    class Meta:
        model = Candidate
        fields = ['id', 'first_name', 'last_name', 'email', 'phone', 'vacancy_title', 'status', 'created_at']


class InterviewerSerializer(serializers.ModelSerializer):
    full_name = serializers.SerializerMethodField()

    class Meta:
        model = User
        fields = ['id', 'username', 'email', 'full_name']

    def get_full_name(self, obj):
        return obj.get_full_name() or obj.username


class InterviewSerializer(serializers.ModelSerializer):
    interviewers = InterviewerSerializer(many=True, read_only=True)
    interviewer_ids = serializers.PrimaryKeyRelatedField(
        many=True, queryset=User.objects.all(),
        write_only=True, source='interviewers', required=False
    )
    candidate_name = serializers.SerializerMethodField()
    candidate_email = serializers.SerializerMethodField()
    vacancy_title = serializers.SerializerMethodField()
    created_by_name = serializers.SerializerMethodField()

    class Meta:
        model = Interview
        fields = [
            'id', 'organization',
            'candidate', 'candidate_name', 'candidate_email',
            'vacancy', 'vacancy_title',
            'title', 'interview_type', 'status',
            'scheduled_at', 'duration_minutes',
            'location', 'notes',
            'interviewers', 'interviewer_ids',
            'google_event_id', 'google_meet_link', 'google_calendar_link',
            'created_by', 'created_by_name',
            'created_at', 'updated_at',
        ]
        read_only_fields = [
            'google_event_id', 'google_meet_link', 'google_calendar_link',
            'created_by', 'created_at', 'updated_at',
        ]

    def get_candidate_name(self, obj):
        return f"{obj.candidate.first_name} {obj.candidate.last_name}"

    def get_candidate_email(self, obj):
        return obj.candidate.email

    def get_vacancy_title(self, obj):
        return obj.vacancy.title if obj.vacancy else ''

    def get_created_by_name(self, obj):
        if obj.created_by:
            return obj.created_by.get_full_name() or obj.created_by.username
        return ''

    def create(self, validated_data):
        interviewers = validated_data.pop('interviewers', [])
        request = self.context.get('request')
        interview = Interview.objects.create(
            created_by=request.user if request else None,
            **validated_data
        )
        interview.interviewers.set(interviewers)
        return interview

    def update(self, instance, validated_data):
        interviewers = validated_data.pop('interviewers', None)
        for attr, value in validated_data.items():
            setattr(instance, attr, value)
        instance.save()
        if interviewers is not None:
            instance.interviewers.set(interviewers)
        return instance


class CandidateSerializer(serializers.ModelSerializer):
    vacancy_title = serializers.CharField(source='vacancy.title', read_only=True)
    assigned_to_name = serializers.SerializerMethodField()
    assigned_to_username = serializers.SerializerMethodField()
    status_history = StatusHistorySerializer(many=True, read_only=True)
    source_display = serializers.CharField(source='get_source_display', read_only=True)
    tags = TagSerializer(many=True, read_only=True)
    tag_ids = serializers.ListField(
        child=serializers.IntegerField(),
        write_only=True,
        required=False,
        allow_empty=True,
    )
    duplicates = serializers.SerializerMethodField(read_only=True)

    class Meta:
        model = Candidate
        fields = [
            'id', 'first_name', 'last_name', 'email',
            'phone', 'vacancy', 'vacancy_title',
            'status', 'source', 'source_display', 'notes', 'created_at',
            'assigned_to', 'assigned_to_name', 'assigned_to_username',
            'status_history', 'tags', 'tag_ids', 'duplicates',
        ]

    def get_assigned_to_name(self, obj):
        if not obj.assigned_to:
            return None
        full = f"{obj.assigned_to.first_name} {obj.assigned_to.last_name}".strip()
        return full or obj.assigned_to.username

    def get_assigned_to_username(self, obj):
        return obj.assigned_to.username if obj.assigned_to else None

    def get_duplicates(self, obj):
        dups = obj.check_duplicate()
        if dups.exists():
            return DuplicateCandidateSerializer(dups[:5], many=True).data
        return []

    def validate(self, data):
        request = self.context.get('request')
        if not request:
            return data

        org = None
        try:
            org = request.user.profile.organization
        except (AttributeError, UserProfile.DoesNotExist):
            pass

        email = data.get('email', '')
        phone = data.get('phone', '')

        if not email:
            return data

        from django.db.models import Q
        from .models import normalize_phone

        qs = Candidate.objects.filter(organization=org) if org else Candidate.objects.all()

        if self.instance:
            qs = qs.exclude(pk=self.instance.pk)

        email_dup = qs.filter(email__iexact=email).first()
        if email_dup:
            raise serializers.ValidationError({
                'duplicate': True,
                'duplicate_by': 'email',
                'duplicate_candidate': DuplicateCandidateSerializer(email_dup).data,
                'message': f'Кандидат з email {email} вже існує: {email_dup.first_name} {email_dup.last_name}'
            })

        if phone:
            phone_normalized = normalize_phone(phone)
            phone_dup = qs.filter(
                Q(phone=phone_normalized) | Q(phone__iexact=phone)
            ).exclude(email__iexact=email).first()
            if phone_dup:
                raise serializers.ValidationError({
                    'duplicate': True,
                    'duplicate_by': 'phone',
                    'duplicate_candidate': DuplicateCandidateSerializer(phone_dup).data,
                    'message': f'Кандидат з телефоном {phone} вже існує: {phone_dup.first_name} {phone_dup.last_name}'
                })

        return data

    def update(self, instance, validated_data):
        tag_ids = validated_data.pop('tag_ids', None)
        candidate = super().update(instance, validated_data)
        if tag_ids is not None:
            candidate.tags.set(tag_ids)
        return candidate


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
        fields = ['id', 'organization', 'organization_name', 'template_type', 'template_type_display', 'subject',
                  'body', 'is_active', 'created_at', 'updated_at']
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