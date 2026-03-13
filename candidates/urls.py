from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import CandidateViewSet, VacancyViewSet, OrganizationViewSet, current_user
from .views import current_user

router = DefaultRouter()
router.register(r'candidates', CandidateViewSet, basename='candidate')
router.register(r'vacancies', VacancyViewSet, basename='vacancy')
router.register(r'organizations', OrganizationViewSet, basename='organization')


urlpatterns = [
    path('', include(router.urls)),
    path('me/', current_user),
]