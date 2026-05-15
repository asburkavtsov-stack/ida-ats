from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import (
    CandidateViewSet, VacancyViewSet, OrganizationViewSet,
    UserListView, current_user, CandidateExportCSVView,
    EmailTemplateViewSet, SentEmailViewSet, google_auth_status,
    TagViewSet, time_to_hire_analytics,
)

router = DefaultRouter()
router.register(r'candidates', CandidateViewSet, basename='candidate')
router.register(r'vacancies', VacancyViewSet, basename='vacancy')
router.register(r'organizations', OrganizationViewSet, basename='organization')
router.register(r'users', UserListView, basename='users')
router.register(r'email-templates', EmailTemplateViewSet, basename='email-template')
router.register(r'sent-emails', SentEmailViewSet, basename='sent-emails')
router.register(r'tags', TagViewSet, basename='tag')

urlpatterns = [
    path('candidates/export/', CandidateExportCSVView.as_view(), name='candidates-export'),
    path('candidates/<int:pk>/assign/', CandidateViewSet.as_view({'patch': 'assign'}), name='candidate-assign'),
    path('candidates/<int:pk>/update_status/', CandidateViewSet.as_view({'patch': 'update_status'}), name='candidate-update-status'),
    path('candidates/check_duplicate/', CandidateViewSet.as_view({'post': 'check_duplicate'}), name='candidate-check-duplicate'),
    path('candidates/import_csv/', CandidateViewSet.as_view({'post': 'import_csv'}), name='candidate-import-csv'),
    path('', include(router.urls)),
    path('me/', current_user),
    path('users-detail/<int:pk>/', UserListView.as_view({
        'patch': 'partial_update',
        'delete': 'destroy',
    })),
    path('analytics/time-to-hire/', time_to_hire_analytics, name='time-to-hire'),
    path('analytics/time-to-hire/candidate/<int:candidate_id>/', candidate_time_to_hire_detail,
         name='time-to-hire-candidate'),
    path('analytics/time-to-hire/export/', export_time_to_hire_csv, name='time-to-hire-export'),
    path('google-auth-status/', google_auth_status, name='google-auth-status'),
]