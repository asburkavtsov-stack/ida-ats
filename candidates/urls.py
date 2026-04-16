from django.urls import path, include
from rest_framework.routers import DefaultRouter
from rest_framework_simplejwt.views import TokenObtainPairView, TokenRefreshView
from .views import (
    CandidateViewSet,
    VacancyViewSet,
    OrganizationViewSet,
    UserListView,
    current_user,
    register_user
)

router = DefaultRouter()
router.register(r'candidates', CandidateViewSet, basename='candidate')
router.register(r'vacancies', VacancyViewSet, basename='vacancy')
router.register(r'organizations', OrganizationViewSet, basename='organization')
router.register(r'users', UserListView, basename='users')

urlpatterns = [
    path('', include(router.urls)),

    # 🔧 JWT Auth (для логіна)
    path('auth/login/', TokenObtainPairView.as_view(), name='token_obtain_pair'),
    path('auth/refresh/', TokenRefreshView.as_view(), name='token_refresh'),

    # 🔧 Поточний користувач
    path('me/', current_user, name='current_user'),

    # 🔧 Реєстрація (опціонально)
    path('auth/register/', register_user, name='register'),

    # 🔧 Детальний URL для юзерів (PATCH/DELETE)
    path('users-detail/<int:pk>/', UserListView.as_view({
        'get': 'retrieve',
        'patch': 'partial_update',
        'delete': 'destroy',
    }), name='user-detail'),
]