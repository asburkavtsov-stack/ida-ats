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
    list_display = ['title', 'department', 'organization', 'is_active', 'created_at']


@admin.register(Candidate)
class CandidateAdmin(admin.ModelAdmin):
    list_display = ['first_name', 'last_name', 'email', 'organization', 'status', 'assigned_to', 'created_at']
    list_filter = ['status', 'assigned_to', 'organization']
    raw_id_fields = ['assigned_to']


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