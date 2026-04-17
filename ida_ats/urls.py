from django.contrib import admin
from django.urls import path, include
from django.http import JsonResponse
from django.contrib.auth.models import User
from rest_framework_simplejwt.views import TokenObtainPairView, TokenRefreshView


def setup_admin(request):
    if User.objects.filter(username='admin').exists():
        return JsonResponse({'status': 'admin already exists'})

    User.objects.create_superuser('admin', 'admin@test.com', 'admin123')
    return JsonResponse({
        'status': 'created',
        'username': 'admin',
        'password': 'admin123'
    })


urlpatterns = [
    path('admin/', admin.site.urls),
    path('api/', include('candidates.urls')),
    path('api/auth/login/', TokenObtainPairView.as_view(), name='token_obtain_pair'),
    path('api/auth/refresh/', TokenRefreshView.as_view(), name='token_refresh'),
    path('setup-admin/', setup_admin),
]