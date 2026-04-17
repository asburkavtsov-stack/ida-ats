from django.contrib import admin
from django.urls import path, include
from rest_framework_simplejwt.views import TokenObtainPairView, TokenRefreshView


def setup_admin(request):
    """Тимчасовий ендпоінт для створення адміна"""
    if User.objects.filter(username='admin').exists():
        return JsonResponse({'status': 'admin already exists'})

    user = User.objects.create_superuser('admin', 'admin@test.com', 'admin123')
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