# candidates/urls.py
from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import (
    CandidateViewSet, VacancyViewSet, OrganizationViewSet,
    UserListView, current_user, CandidateExportCSVView,
    EmailTemplateViewSet, SentEmailViewSet, google_auth_status
)

router = DefaultRouter()
router.register(r'candidates', CandidateViewSet, basename='candidate')
router.register(r'vacancies', VacancyViewSet, basename='vacancy')
router.register(r'organizations', OrganizationViewSet, basename='organization')
router.register(r'users', UserListView, basename='users')
router.register(r'email-templates', EmailTemplateViewSet, basename='email-template')
router.register(r'sent-emails', SentEmailViewSet, basename='sent-emails')

urlpatterns = [
    path('candidates/export/', CandidateExportCSVView.as_view(), name='candidates-export'),
    path('candidates/<int:pk>/assign/', CandidateViewSet.as_view({'patch': 'assign'}), name='candidate-assign'),
    path('candidates/<int:pk>/update_status/', CandidateViewSet.as_view({'patch': 'update_status'}), name='candidate-update-status'),
    path('', include(router.urls)),
    path('me/', current_user),
    path('users-detail/<int:pk>/', UserListView.as_view({
        'patch': 'partial_update',
        'delete': 'destroy',
    })),
    path('google-auth-status/', google_auth_status, name='google-auth-status'),
]