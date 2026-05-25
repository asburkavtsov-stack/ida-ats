from django.contrib import admin
from .models import Organization, UserProfile, Vacancy, Candidate, EmailTemplate, SentEmail


@admin.register(Organization)
class OrganizationAdmin(admin.ModelAdmin):
    list_display = ['name', 'slug', 'is_active', 'max_hr', 'max_vacancies', 'created_at']
    prepopulated_fields = {'slug': ('name',)}


@admin.register(UserProfile)
class UserProfileAdmin(admin.ModelAdmin):
    list_display = ['user', 'organization', 'role']


@admin.register(Vacancy)
class VacancyAdmin(admin.ModelAdmin):
    list_display = [
        'title', 'department', 'organization', 'city', 'employment_type', 'is_active',
        'published_rabota_ua', 'published_work_ua', 'published_dou', 'published_linkedin',
        'created_at',
    ]
    list_filter = [
        'is_active', 'organization', 'employment_type',
        'published_rabota_ua', 'published_work_ua', 'published_dou', 'published_linkedin',
    ]
    search_fields = ['title', 'department', 'city']
    readonly_fields = [
        'published_at_rabota_ua', 'published_at_work_ua',
        'published_at_dou', 'published_at_linkedin',
        'rabota_ua_vacancy_id', 'work_ua_vacancy_id',
    ]
    fieldsets = (
        ('Основне', {
            'fields': ('organization', 'title', 'department', 'city', 'employment_type', 'is_active'),
        }),
        ('Деталі', {
            'fields': ('description', 'requirements', 'salary_min', 'salary_max'),
        }),
        ('rabota.ua', {
            'classes': ('collapse',),
            'fields': ('published_rabota_ua', 'rabota_ua_vacancy_id', 'published_at_rabota_ua'),
        }),
        ('work.ua', {
            'classes': ('collapse',),
            'fields': ('published_work_ua', 'work_ua_vacancy_id', 'published_at_work_ua'),
        }),
        ('DOU', {
            'classes': ('collapse',),
            'fields': ('published_dou', 'dou_vacancy_url', 'published_at_dou'),
        }),
        ('LinkedIn', {
            'classes': ('collapse',),
            'fields': ('published_linkedin', 'linkedin_vacancy_url', 'published_at_linkedin'),
        }),
    )


@admin.register(Candidate)
class CandidateAdmin(admin.ModelAdmin):
    list_display = ['first_name', 'last_name', 'email', 'organization', 'status', 'source', 'assigned_to', 'created_at']
    list_filter = ['status', 'source', 'assigned_to', 'organization']
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
    raw_id_fields = ['candidate', 'template', 'sent_by']
