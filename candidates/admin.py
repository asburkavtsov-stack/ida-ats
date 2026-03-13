from django.contrib import admin
from .models import Candidate, Vacancy

@admin.register(Vacancy)
class VacancyAdmin(admin.ModelAdmin):
    list_display = ['title', 'department', 'is_active', 'created_at']

@admin.register(Candidate)
class CandidateAdmin(admin.ModelAdmin):
    list_display = ['first_name', 'last_name', 'email', 'vacancy', 'status', 'created_at']
    list_filter = ['status', 'vacancy']
    search_fields = ['first_name', 'last_name', 'email']