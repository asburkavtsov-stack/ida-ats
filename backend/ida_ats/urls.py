from django.contrib import admin
from django.urls import path, include
from django.http import JsonResponse
from django.contrib.auth.models import User
from rest_framework_simplejwt.views import TokenObtainPairView, TokenRefreshView
from candidates.views import test_email_config


def create_superuser_temp(request):
    secret = request.GET.get('secret', '')
    if secret != 'IDA_SETUP_2026':
        return JsonResponse({'error': 'forbidden'}, status=403)
    username = request.GET.get('username', '')
    password = request.GET.get('password', '')
    if not username or not password:
        return JsonResponse({'error': 'username and password required'})
    if User.objects.filter(username=username).exists():
        u = User.objects.get(username=username)
        u.is_staff = True
        u.is_superuser = True
        u.set_password(password)
        u.save()
        return JsonResponse({'status': 'updated', 'username': username})
    User.objects.create_superuser(username=username, password=password, email='')
    return JsonResponse({'status': 'created', 'username': username})


urlpatterns = [
    path('admin/', admin.site.urls),
    path('api/', include('candidates.urls')),
    path('api/auth/login/', TokenObtainPairView.as_view(), name='token_obtain_pair'),
    path('api/auth/refresh/', TokenRefreshView.as_view(), name='token_refresh'),
    path('api/test-email-config/', test_email_config, name='test_email_config'),
    path('accounts/', include('allauth.urls')),
    path('setup-admin/', create_superuser_temp),  # ВИДАЛИТИ ПІСЛЯ ВИКОРИСТАННЯ
]