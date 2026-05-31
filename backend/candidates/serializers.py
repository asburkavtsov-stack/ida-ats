from rest_framework import serializers
from django.contrib.auth import get_user_model
from .models import (
    Candidate, Vacancy, VacancyTemplate, VacancyStage,
    Organization, StatusHistory, EmailTemplate, SentEmail,
    Tag, Interview, UserProfile, HolidayTheme, PricingConfig,
    PromoCode, PromoCodeUsage
)

User = get_user_model()


# ─── VacancyStage ─────────────────────────────────────────────────────────────
class VacancyStageSerializer(serializers.ModelSerializer):
    candidates_count = serializers.SerializerMethodField()

    class Meta:
        model = VacancyStage
        fields = ['id', 'name', 'color', 'order', 'system_key', 'is_terminal', 'vacancy', 'candidates_count', 'created_at', 'updated_at']
        read_only_fields = ['created_at', 'updated_at']

    def get_candidates_count(self, obj):
        return obj.candidates.count()


# ─── Vacancy ──────────────────────────────────────────────────────────────────
class VacancySerializer(serializers.ModelSerializer):
    published_boards = serializers.ReadOnlyField()
    stages = VacancyStageSerializer(many=True, read_only=True)

    class Meta:
        model = Vacancy
        fields = [
            'id', 'title', 'department', 'description', 'requirements', 'city',
            'employment_type', 'salary_min', 'salary_max', 'is_active', 'created_at', 'stages',
            'published_boards', 'published_rabota_ua', 'rabota_ua_vacancy_id', 'published_at_rabota_ua',
            'published_work_ua', 'work_ua_vacancy_id', 'published_at_work_ua',
            'published_dou', 'dou_vacancy_url', 'published_at_dou',
            'published_linkedin', 'linkedin_vacancy_url', 'published_at_linkedin',
        ]
        read_only_fields = ['published_boards', 'stages']


class VacancyPublishSerializer(serializers.Serializer):
    platform = serializers.ChoiceField(choices=['rabota_ua', 'work_ua', 'dou', 'linkedin'])
    url = serializers.URLField(required=False, allow_blank=True)


# ─── VacancyTemplate ──────────────────────────────────────────────────────────
class VacancyTemplateSerializer(serializers.ModelSerializer):
    category_display = serializers.CharField(source='get_category_display', read_only=True)
    employment_type_display = serializers.CharField(source='get_employment_type_display', read_only=True)

    class Meta:
        model = VacancyTemplate
        fields = ['id', 'name', 'category', 'category_display', 'title', 'department',
                  'description', 'requirements', 'city', 'employment_type', 'employment_type_display',
                  'is_active', 'created_at', 'updated_at']
        read_only_fields = ['created_at', 'updated_at']


# ─── StatusHistory ────────────────────────────────────────────────────────────
class StatusHistorySerializer(serializers.ModelSerializer):
    changed_by_name = serializers.SerializerMethodField()
    old_stage_name = serializers.SerializerMethodField()
    new_stage_name = serializers.SerializerMethodField()
    old_stage_color = serializers.SerializerMethodField()
    new_stage_color = serializers.SerializerMethodField()

    class Meta:
        model = StatusHistory
        fields = ['id', 'old_status', 'new_status', 'old_stage', 'new_stage',
                  'old_stage_name', 'new_stage_name', 'old_stage_color', 'new_stage_color',
                  'changed_by_name', 'changed_at']

    def get_changed_by_name(self, obj):
        if not obj.changed_by:
            return None
        full = f"{obj.changed_by.first_name} {obj.changed_by.last_name}".strip()
        return full or obj.changed_by.username

    def get_old_stage_name(self, obj):
        return obj.old_stage.name if obj.old_stage else obj.old_status

    def get_new_stage_name(self, obj):
        return obj.new_stage.name if obj.new_stage else obj.new_status

    def get_old_stage_color(self, obj):
        return obj.old_stage.color if obj.old_stage else '#aaaaaa'

    def get_new_stage_color(self, obj):
        return obj.new_stage.color if obj.new_stage else '#7a1a2e'


# ─── Tag ──────────────────────────────────────────────────────────────────────
class TagSerializer(serializers.ModelSerializer):
    class Meta:
        model = Tag
        fields = ['id', 'name', 'color', 'created_at']


# ─── Duplicate helper ─────────────────────────────────────────────────────────
class DuplicateCandidateSerializer(serializers.ModelSerializer):
    vacancy_title = serializers.CharField(source='vacancy.title', read_only=True)
    stage_name = serializers.CharField(source='stage.name', read_only=True)
    stage_color = serializers.CharField(source='stage.color', read_only=True)
    status = serializers.CharField(read_only=True)

    class Meta:
        model = Candidate
        fields = ['id', 'first_name', 'last_name', 'email', 'phone', 'vacancy_title', 'status', 'stage_name', 'stage_color', 'created_at']


# ─── Interview ────────────────────────────────────────────────────────────────
class InterviewerSerializer(serializers.ModelSerializer):
    full_name = serializers.SerializerMethodField()

    class Meta:
        model = User
        fields = ['id', 'username', 'email', 'full_name']

    def get_full_name(self, obj):
        return obj.get_full_name() or obj.username


class InterviewSerializer(serializers.ModelSerializer):
    interviewers = InterviewerSerializer(many=True, read_only=True)
    interviewer_ids = serializers.PrimaryKeyRelatedField(many=True, queryset=User.objects.all(), write_only=True, source='interviewers', required=False)
    candidate_name = serializers.SerializerMethodField()
    candidate_email = serializers.SerializerMethodField()
    vacancy_title = serializers.SerializerMethodField()
    created_by_name = serializers.SerializerMethodField()

    class Meta:
        model = Interview
        fields = [
            'id', 'organization', 'candidate', 'candidate_name', 'candidate_email',
            'vacancy', 'vacancy_title', 'title', 'interview_type', 'status',
            'scheduled_at', 'duration_minutes', 'location', 'notes',
            'interviewers', 'interviewer_ids', 'google_event_id', 'google_meet_link',
            'google_calendar_link', 'created_by', 'created_by_name', 'created_at', 'updated_at',
        ]
        read_only_fields = ['organization', 'google_event_id', 'google_meet_link', 'google_calendar_link', 'created_by', 'created_at', 'updated_at']

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


# ─── Candidate ────────────────────────────────────────────────────────────────
class CandidateSerializer(serializers.ModelSerializer):
    vacancy_title = serializers.CharField(source='vacancy.title', read_only=True)
    assigned_to_name = serializers.SerializerMethodField()
    assigned_to_username = serializers.SerializerMethodField()
    status_history = StatusHistorySerializer(many=True, read_only=True)
    source_display = serializers.CharField(source='get_source_display', read_only=True)
    tags = TagSerializer(many=True, read_only=True)
    tag_ids = serializers.ListField(child=serializers.IntegerField(), write_only=True, required=False, allow_empty=True)
    duplicates = serializers.SerializerMethodField(read_only=True)
    stage_id = serializers.PrimaryKeyRelatedField(queryset=VacancyStage.objects.all(), source='stage', required=False, allow_null=True)
    stage_name = serializers.CharField(source='stage.name', read_only=True)
    stage_color = serializers.CharField(source='stage.color', read_only=True)
    stage_order = serializers.IntegerField(source='stage.order', read_only=True)
    system_key = serializers.CharField(source='stage.system_key', read_only=True)
    status = serializers.CharField(read_only=True)

    class Meta:
        model = Candidate
        fields = [
            'id', 'first_name', 'last_name', 'email', 'phone', 'vacancy', 'vacancy_title',
            'stage', 'stage_id', 'stage_name', 'stage_color', 'stage_order', 'system_key', 'status',
            'source', 'source_display', 'notes', 'created_at',
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


# ─── Organization ─────────────────────────────────────────────────────────────
class OrganizationSerializer(serializers.ModelSerializer):
    class Meta:
        model = Organization
        fields = ['id', 'name', 'slug', 'is_active', 'created_at', 'max_hr', 'max_vacancies']


class OrganizationDetailSerializer(serializers.ModelSerializer):
    class Meta:
        model = Organization
        fields = '__all__'


# ─── EmailTemplate / SentEmail ────────────────────────────────────────────────
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
        fields = ['id', 'candidate', 'candidate_name', 'template', 'template_type', 'template_type_display',
                  'recipient_email', 'subject', 'body', 'sent_by', 'sent_by_name', 'sent_at', 'status', 'error_message']
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
        return obj.template.get_template_type_display() if obj.template else None

    def get_template_type(self, obj):
        return obj.template.template_type if obj.template else None


# ==============================================================================
# НОВІ СЕРІАЛІЗАТОРИ ДЛЯ LED-ТЕМ, ЦІН ТА ПРОМО-КОДІВ
# ==============================================================================

class HolidayThemeSerializer(serializers.ModelSerializer):
    theme_type_display = serializers.CharField(source='get_theme_type_display', read_only=True)

    class Meta:
        model = HolidayTheme
        fields = [
            'id', 'theme_type', 'theme_type_display', 'name', 'is_active',
            'css_variables', 'hero_image', 'background_image',
            'primary_color', 'secondary_color', 'accent_color',
            'start_date', 'end_date', 'created_at', 'updated_at',
        ]
        read_only_fields = ['created_at', 'updated_at']


class HolidayThemeActivateSerializer(serializers.Serializer):
    theme_id = serializers.IntegerField()
    auto_schedule = serializers.BooleanField(default=False)


class PricingConfigSerializer(serializers.ModelSerializer):
    plan_display = serializers.CharField(source='get_plan_display', read_only=True)
    current_price = serializers.SerializerMethodField()

    class Meta:
        model = PricingConfig
        fields = [
            'id', 'plan', 'plan_display', 'name', 'price_monthly', 'price_yearly',
            'discount_percent', 'discount_valid_until', 'current_price',
            'max_hr', 'max_vacancies', 'has_analytics', 'has_email_templates',
            'has_google_integration', 'has_custom_stages', 'is_active',
            'created_at', 'updated_at',
        ]
        read_only_fields = ['created_at', 'updated_at']

    def get_current_price(self, obj):
        return float(obj.get_current_price())


class PromoCodeSerializer(serializers.ModelSerializer):
    created_by_name = serializers.SerializerMethodField()
    usage_count = serializers.SerializerMethodField()
    is_valid = serializers.SerializerMethodField()

    class Meta:
        model = PromoCode
        fields = [
            'id', 'code', 'discount_type', 'discount_value', 'applicable_plans',
            'max_uses', 'used_count', 'usage_count', 'max_uses_per_user',
            'valid_from', 'valid_until', 'is_active', 'is_valid', 'description',
            'created_by', 'created_by_name', 'created_at',
        ]
        read_only_fields = ['used_count', 'created_by', 'created_at']

    def get_created_by_name(self, obj):
        if obj.created_by:
            return obj.created_by.get_full_name() or obj.created_by.username
        return None

    def get_usage_count(self, obj):
        return obj.usages.count()

    def get_is_valid(self, obj):
        is_valid, _ = obj.is_valid()
        return is_valid


class PromoCodeVerifySerializer(serializers.Serializer):
    code = serializers.CharField(max_length=50)
    plan = serializers.CharField(max_length=20, required=False, allow_blank=True)

    def validate_code(self, value):
        try:
            promo = PromoCode.objects.get(code__iexact=value)
            is_valid, message = promo.is_valid(plan=self.initial_data.get('plan'))
            if not is_valid:
                raise serializers.ValidationError(message)
            return promo
        except PromoCode.DoesNotExist:
            raise serializers.ValidationError("Промо-код не знайдено")


class PromoCodeApplySerializer(serializers.Serializer):
    code = serializers.CharField(max_length=50)
    plan = serializers.CharField(max_length=20)
    price = serializers.DecimalField(max_digits=10, decimal_places=2)


class PromoCodeUsageSerializer(serializers.ModelSerializer):
    user_email = serializers.CharField(source='user.email', read_only=True)
    user_name = serializers.SerializerMethodField()

    class Meta:
        model = PromoCodeUsage
        fields = ['id', 'promo_code', 'user', 'user_email', 'user_name', 'applied_to_plan',
                  'original_price', 'discount_amount', 'final_price', 'used_at']

    def get_user_name(self, obj):
        return obj.user.get_full_name() or obj.user.username