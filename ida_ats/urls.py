from django.contrib import admin
from django.urls import path, include
from rest_framework_simplejwt.views import TokenObtainPairView, TokenRefreshView
from django.http import HttpResponse
from django.views.decorators.csrf import csrf_exempt


@csrf_exempt
def cors_options_handler(request):
    response = HttpResponse(status=204)
    response['Access-Control-Allow-Origin'] = 'https://ida-ats.vercel.app'  # або '*' для тесту
    response['Access-Control-Allow-Methods'] = 'GET, POST, OPTIONS, PUT, PATCH, DELETE'
    response['Access-Control-Allow-Headers'] = 'Content-Type, Authorization, X-CSRFToken, Accept, Origin'
    response['Access-Control-Allow-Credentials'] = 'true'
    response['Access-Control-Max-Age'] = '86400'
    return response


urlpatterns = [
    path('admin/', admin.site.urls),
    path('api/', include('candidates.urls')),

    # JWT
    path('api/auth/login/', TokenObtainPairView.as_view(), name='token_obtain_pair'),
    path('api/auth/refresh/', TokenRefreshView.as_view(), name='token_refresh'),

    # Точний handler для логіну (OPTIONS)
    path('api/auth/login/', cors_options_handler, name='login-options'),

    # Якщо потрібно для refresh або інших — додай аналогічно
    path('api/auth/refresh/', cors_options_handler, name='refresh-options'),
]