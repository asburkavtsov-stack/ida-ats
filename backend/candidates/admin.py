from django.contrib import admin
from .models import (
    Organization, UserProfile, Vacancy, VacancyStage,
    Candidate, EmailTemplate, SentEmail, BlacklistedOrganization,
    Tag, VacancyTemplate, Interview, StatusHistory,
    HolidayTheme, PricingConfig, PromoCode, PromoCodeUsage
)


@admin.register(Organization)
class OrganizationAdmin(admin.ModelAdmin):
    list_display = ['name', 'slug', 'is_active', 'max_hr', 'max_vacancies', 'created_at']
    prepopulated_fields = {'slug': ('name',)}


@admin.register(UserProfile)
class UserProfileAdmin(admin.ModelAdmin):
    list_display = ['user', 'organization', 'role']


@admin.register(Vacancy)
class VacancyAdmin(admin.ModelAdmin):
    list_display = ['title', 'department', 'organization', 'city', 'employment_type', 'is_active', 'created_at']
    list_filter = ['is_active', 'organization', 'employment_type']
    search_fields = ['title', 'department', 'city']


@admin.register(VacancyStage)
class VacancyStageAdmin(admin.ModelAdmin):
    list_display = ['name', 'organization', 'vacancy', 'color', 'order', 'system_key', 'is_terminal']
    list_filter = ['organization', 'system_key', 'is_terminal']
    search_fields = ['name']
    ordering = ['organization', 'vacancy', 'order']


@admin.register(Candidate)
class CandidateAdmin(admin.ModelAdmin):
    list_display = ['first_name', 'last_name', 'email', 'organization', 'stage', 'source', 'assigned_to', 'created_at']
    list_filter = ['stage__system_key', 'source', 'assigned_to', 'organization']
    raw_id_fields = ['assigned_to']
    search_fields = ['first_name', 'last_name', 'email']


@admin.register(EmailTemplate)
class EmailTemplateAdmin(admin.ModelAdmin):
    list_display = ['organization', 'template_type', 'subject', 'is_active']
    list_filter = ['organization', 'template_type', 'is_active']
    search_fields = ['subject', 'body']


@admin.register(SentEmail)
class SentEmailAdmin(admin.ModelAdmin):
    list_display = ['subject', 'candidate', 'recipient_email', 'sent_by', 'sent_at', 'status']
    list_filter = ['status', 'sent_at']
    search_fields = ['subject', 'recipient_email', 'candidate__email']


@admin.register(BlacklistedOrganization)
class BlacklistedOrganizationAdmin(admin.ModelAdmin):
    list_display = ['name', 'added_by', 'reason', 'created_at']
    search_fields = ['name']
    readonly_fields = ['added_by', 'created_at']

    def save_model(self, request, obj, form, change):
        if not obj.pk:
            obj.added_by = request.user
        super().save_model(request, obj, form, change)


@admin.register(Tag)
class TagAdmin(admin.ModelAdmin):
    list_display = ['name', 'organization', 'color', 'created_at']
    list_filter = ['organization']
    search_fields = ['name']


@admin.register(VacancyTemplate)
class VacancyTemplateAdmin(admin.ModelAdmin):
    list_display = ['name', 'organization', 'category', 'employment_type', 'is_active', 'created_at']
    list_filter = ['organization', 'category', 'employment_type', 'is_active']
    search_fields = ['name', 'title']


@admin.register(Interview)
class InterviewAdmin(admin.ModelAdmin):
    list_display = ['title', 'candidate', 'status', 'scheduled_at', 'interview_type']
    list_filter = ['status', 'interview_type', 'scheduled_at']
    search_fields = ['title', 'candidate__first_name', 'candidate__last_name']


@admin.register(StatusHistory)
class StatusHistoryAdmin(admin.ModelAdmin):
    list_display = ['candidate', 'new_status', 'changed_by', 'changed_at']
    list_filter = ['changed_at']
    search_fields = ['candidate__first_name', 'candidate__last_name']


# ==============================================================================
# НОВІ АДМІНКИ ДЛЯ LED-ТЕМ, ЦІН ТА ПРОМО-КОДІВ
# ==============================================================================

@admin.register(HolidayTheme)
class HolidayThemeAdmin(admin.ModelAdmin):
    list_display = ['theme_type', 'name', 'is_active', 'start_date', 'end_date']
    list_filter = ['theme_type', 'is_active']
    search_fields = ['name']
    fieldsets = (
        ('Основне', {'fields': ('theme_type', 'name', 'is_active')}),
        ('Оформлення', {'fields': ('css_variables', 'primary_color', 'secondary_color', 'accent_color')}),
        ('Медіа', {'fields': ('hero_image', 'background_image')}),
        ('Розклад', {'fields': ('start_date', 'end_date')}),
    )


@admin.register(PricingConfig)
class PricingConfigAdmin(admin.ModelAdmin):
    list_display = ['plan', 'price_monthly', 'discount_percent', 'is_active']
    list_filter = ['plan', 'is_active']
    search_fields = ['name']
    fieldsets = (
        ('План', {'fields': ('plan', 'name', 'is_active')}),
        ('Ціни', {'fields': ('price_monthly', 'price_yearly', 'discount_percent', 'discount_valid_until')}),
        ('Ліміти', {'fields': ('max_hr', 'max_vacancies')}),
        ('Функціонал', {'fields': ('has_analytics', 'has_email_templates', 'has_google_integration', 'has_custom_stages')}),
    )


@admin.register(PromoCode)
class PromoCodeAdmin(admin.ModelAdmin):
    list_display = ['code', 'discount_value', 'discount_type', 'max_uses', 'used_count', 'is_active', 'valid_until']
    list_filter = ['discount_type', 'is_active']
    search_fields = ['code']
    readonly_fields = ['used_count', 'created_by', 'created_at']
    fieldsets = (
        ('Код', {'fields': ('code', 'description', 'is_active')}),
        ('Знижка', {'fields': ('discount_type', 'discount_value', 'applicable_plans')}),
        ('Ліміти', {'fields': ('max_uses', 'used_count', 'max_uses_per_user')}),
        ('Термін дії', {'fields': ('valid_from', 'valid_until')}),
    )

    def save_model(self, request, obj, form, change):
        if not obj.pk:
            obj.created_by = request.user
        super().save_model(request, obj, form, change)


@admin.register(PromoCodeUsage)
class PromoCodeUsageAdmin(admin.ModelAdmin):
    list_display = ['promo_code', 'user', 'applied_to_plan', 'final_price', 'used_at']
    list_filter = ['applied_to_plan', 'used_at']
    search_fields = ['promo_code__code', 'user__email']
    readonly_fields = ['promo_code', 'user', 'organization', 'applied_to_plan',
                       'original_price', 'discount_amount', 'final_price', 'used_at', 'ip_address']