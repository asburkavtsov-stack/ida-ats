from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import (
    CandidateViewSet, VacancyViewSet, OrganizationViewSet,
    UserListView, current_user, CandidateExportCSVView,
    EmailTemplateViewSet
)

router = DefaultRouter()
router.register(r'candidates', CandidateViewSet, basename='candidate')
router.register(r'vacancies', VacancyViewSet, basename='vacancy')
router.register(r'organizations', OrganizationViewSet, basename='organization')
router.register(r'users', UserListView, basename='users')
router.register(r'email-templates', EmailTemplateViewSet, basename='email-template')

urlpatterns = [
    path('candidates/export/', CandidateExportCSVView.as_view(), name='candidates-export'),
    path('candidates/<int:pk>/assign/', CandidateViewSet.as_view({'patch': 'assign'}), name='candidate-assign'),
    path('', include(router.urls)),
    path('me/', current_user),
    path('users-detail/<int:pk>/', UserListView.as_view({
        'patch': 'partial_update',
        'delete': 'destroy',
    })),
]