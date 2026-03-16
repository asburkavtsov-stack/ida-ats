from django.contrib import admin
from django.urls import path, include, re_path
from django.http import HttpResponse
from django.views.decorators.csrf import csrf_exempt
from rest_framework_simplejwt.views import TokenObtainPairView, TokenRefreshView


@csrf_exempt
def cors_preflight_handler(request):
    """
    Явний обробник для OPTIONS-запитів (preflight),
    щоб Railway не блокував CORS через відсутність заголовків.
    """
    response = HttpResponse(status=204)  # 204 No Content — стандарт для preflight
    response['Access-Control-Allow-Origin'] = 'https://ida-ats.vercel.app'
    response['Access-Control-Allow-Methods'] = 'GET, POST, OPTIONS, PUT, PATCH, DELETE'
    response['Access-Control-Allow-Headers'] = 'Content-Type, Authorization, X-CSRFToken, Accept, Origin'
    response['Access-Control-Allow-Credentials'] = 'true'
    response['Access-Control-Max-Age'] = '86400'  # 24 години кешування preflight
    return response


urlpatterns = [
    # Адмінка
    path('admin/', admin.site.urls),

    # Твій API (candidates app)
    path('api/', include('candidates.urls')),

    # JWT авторизація
    path('api/auth/login/', TokenObtainPairView.as_view(), name='token_obtain_pair'),
    path('api/auth/refresh/', TokenRefreshView.as_view(), name='token_refresh'),

    # Обробка всіх OPTIONS-запитів у /api/ (найнадійніше рішення для Railway)
    re_path(r'^api/.*$', cors_preflight_handler, name='cors-preflight'),
]