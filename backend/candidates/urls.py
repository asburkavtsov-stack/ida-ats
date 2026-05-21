from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import (
    CandidateViewSet, VacancyViewSet, OrganizationViewSet,
    UserListView, current_user, CandidateExportCSVView,
    EmailTemplateViewSet, SentEmailViewSet, google_auth_status,
    TagViewSet, time_to_hire_analytics,
    candidate_time_to_hire_detail,
    export_time_to_hire_csv,
    hr_effectiveness_analytics,
    export_hr_effectiveness_csv,
    export_time_to_hire_excel,
    export_time_to_hire_pdf,
    export_hr_effectiveness_excel,
    export_hr_effectiveness_pdf,
    export_full_report_excel,
    export_full_report_pdf,
    InterviewViewSet,
)

router = DefaultRouter()
router.register(r'candidates', CandidateViewSet, basename='candidate')
router.register(r'vacancies', VacancyViewSet, basename='vacancy')
router.register(r'organizations', OrganizationViewSet, basename='organization')
router.register(r'users', UserListView, basename='users')
router.register(r'email-templates', EmailTemplateViewSet, basename='email-template')
router.register(r'sent-emails', SentEmailViewSet, basename='sent-emails')
router.register(r'tags', TagViewSet, basename='tag')
router.register(r'interviews', InterviewViewSet, basename='interview')

urlpatterns = [
    path('candidates/export/', CandidateExportCSVView.as_view(), name='candidates-export'),
    path('candidates/check-duplicate/', CandidateViewSet.as_view({'post': 'check_duplicate'}),
         name='candidate-check-duplicate'),
    path('candidates/import-csv/', CandidateViewSet.as_view({'post': 'import_csv'}), name='candidate-import-csv'),
    path('', include(router.urls)),
    path('me/', current_user, name='current-user'),
    path('users-detail/<int:pk>/', UserListView.as_view({
        'patch': 'partial_update',
        'delete': 'destroy',
    }), name='user-detail'),
    path('analytics/time-to-hire/', time_to_hire_analytics, name='time-to-hire'),
    path('analytics/time-to-hire/candidate/<int:candidate_id>/', candidate_time_to_hire_detail,
         name='time-to-hire-candidate'),
    path('analytics/time-to-hire/export/', export_time_to_hire_csv, name='time-to-hire-export'),
    path('analytics/time-to-hire/export-excel/', export_time_to_hire_excel, name='time-to-hire-export-excel'),
    path('analytics/time-to-hire/export-pdf/', export_time_to_hire_pdf, name='time-to-hire-export-pdf'),
    path('analytics/hr-effectiveness/', hr_effectiveness_analytics, name='hr-effectiveness'),
    path('analytics/hr-effectiveness/export/', export_hr_effectiveness_csv, name='hr-effectiveness-export'),
    path('analytics/hr-effectiveness/export-excel/', export_hr_effectiveness_excel,
         name='hr-effectiveness-export-excel'),
    path('analytics/hr-effectiveness/export-pdf/', export_hr_effectiveness_pdf, name='hr-effectiveness-export-pdf'),
    path('analytics/export-full-excel/', export_full_report_excel, name='full-report-export-excel'),
    path('analytics/export-full-pdf/', export_full_report_pdf, name='full-report-export-pdf'),
    path('google-auth-status/', google_auth_status, name='google-auth-status'),
]