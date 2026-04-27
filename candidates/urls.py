from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import CandidateViewSet, VacancyViewSet, OrganizationViewSet, UserListView, current_user, CandidateExportCSVView

router = DefaultRouter()
router.register(r'candidates', CandidateViewSet, basename='candidate')
router.register(r'vacancies', VacancyViewSet, basename='vacancy')
router.register(r'organizations', OrganizationViewSet, basename='organization')
router.register(r'users', UserListView, basename='users')

urlpatterns = [
    path('', include(router.urls)),
    path('me/', current_user),
    # 🔧 ДОДАТИ: явний маршрут для PATCH/DELETE по конкретному юзеру
    path('users-detail/<int:pk>/', UserListView.as_view({
        'patch': 'partial_update',
        'delete': 'destroy',
    })),
    path('api/candidates/export/', CandidateExportCSVView.as_view(), name='candidates-export'),
]