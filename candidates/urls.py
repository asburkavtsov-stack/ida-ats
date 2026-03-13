from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import CandidateViewSet, VacancyViewSet

router = DefaultRouter()
router.register(r'candidates', CandidateViewSet)
router.register(r'vacancies', VacancyViewSet)

urlpatterns = [
    path('', include(router.urls)),
]