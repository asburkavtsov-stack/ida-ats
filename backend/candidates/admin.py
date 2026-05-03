from django.contrib import admin
from .models import Organization, UserProfile, Vacancy, Candidate

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