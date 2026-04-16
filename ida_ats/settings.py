from pathlib import Path
from datetime import timedelta
import os
import dj_database_url
from urllib.parse import quote

BASE_DIR = Path(__file__).resolve().parent.parent

SECRET_KEY = os.environ.get('SECRET_KEY', 'django-insecure-change-me-in-production')

DEBUG = os.environ.get('DEBUG', 'False') == 'True'

ALLOWED_HOSTS = ['*']

INSTALLED_APPS = [
    'django.contrib.admin',
    'django.contrib.auth',
    'django.contrib.contenttypes',
    'django.contrib.sessions',
    'django.contrib.messages',
    'django.contrib.staticfiles',
    'rest_framework',
    'corsheaders',
    'rest_framework_simplejwt',
    'candidates',
]

MIDDLEWARE = [
    'corsheaders.middleware.CorsMiddleware',  # ПЕРШИЙ!
    'django.middleware.security.SecurityMiddleware',
    'whitenoise.middleware.WhiteNoiseMiddleware',
    'django.contrib.sessions.middleware.SessionMiddleware',
    'django.middleware.common.CommonMiddleware',
    'django.middleware.csrf.CsrfViewMiddleware',
    'django.contrib.auth.middleware.AuthenticationMiddleware',
    'django.contrib.messages.middleware.MessageMiddleware',
    'django.middleware.clickjacking.XFrameOptionsMiddleware',
]

ROOT_URLCONF = 'ida_ats.urls'

TEMPLATES = [
    {
        'BACKEND': 'django.template.backends.django.DjangoTemplates',
        'DIRS': [],
        'APP_DIRS': True,
        'OPTIONS': {
            'context_processors': [
                'django.template.context_processors.request',
                'django.contrib.auth.context_processors.auth',
                'django.contrib.messages.context_processors.messages',
            ],
        },
    },
]

WSGI_APPLICATION = 'ida_ats.wsgi.application'

# Database
DATABASE_URL = os.environ.get('DATABASE_URL', '')
DATABASE_PUBLIC_URL = os.environ.get('DATABASE_PUBLIC_URL', '')

if DATABASE_PUBLIC_URL and DATABASE_PUBLIC_URL.startswith('postgres'):
    ACTIVE_DATABASE_URL = DATABASE_PUBLIC_URL
elif DATABASE_URL and DATABASE_URL.startswith('postgres'):
    ACTIVE_DATABASE_URL = DATABASE_URL
else:
    ACTIVE_DATABASE_URL = ''

def encode_database_url(url):
    if not url or not url.startswith('postgres'):
        return url
    try:
        rest = url.replace('postgresql://', '').replace('postgres://', '')
        if '@' not in rest:
            return url
        creds, host_part = rest.split('@', 1)
        if ':' not in creds:
            return url
        user, password = creds.split(':', 1)
        encoded_password = quote(password, safe='')
        return f"postgres://{user}:{encoded_password}@{host_part}"
    except Exception:
        return url

ENCODED_DATABASE_URL = encode_database_url(ACTIVE_DATABASE_URL)

if ENCODED_DATABASE_URL:
    DATABASES = {
        'default': dj_database_url.config(
            default=ENCODED_DATABASE_URL,
            conn_max_age=600,
            ssl_require=True
        )
    }
else:
    DATABASES = {
        'default': {
            'ENGINE': 'django.db.backends.sqlite3',
            'NAME': BASE_DIR / 'db.sqlite3',
        }
    }

AUTH_PASSWORD_VALIDATORS = [
    {'NAME': 'django.contrib.auth.password_validation.UserAttributeSimilarityValidator'},
    {'NAME': 'django.contrib.auth.password_validation.MinimumLengthValidator'},
    {'NAME': 'django.contrib.auth.password_validation.CommonPasswordValidator'},
    {'NAME': 'django.contrib.auth.password_validation.NumericPasswordValidator'},
]

LANGUAGE_CODE = 'en-us'
TIME_ZONE = 'UTC'
USE_I18N = True
USE_TZ = True

STATIC_URL = 'static/'
STATIC_ROOT = BASE_DIR / 'staticfiles'
STATICFILES_STORAGE = 'whitenoise.storage.CompressedManifestStaticFilesStorage'

MEDIA_URL = 'media/'
MEDIA_ROOT = Path(os.environ.get('MEDIA_ROOT', BASE_DIR / 'media'))

DEFAULT_AUTO_FIELD = 'django.db.models.BigAutoField'

# CORS - критично важливі налаштування
CORS_ALLOW_ALL_ORIGINS = True
CORS_ALLOW_CREDENTIALS = True
CORS_ALLOW_METHODS = [
    'DELETE',
    'GET',
    'OPTIONS',
    'PATCH',
    'POST',
    'PUT',
]
CORS_ALLOW_HEADERS = [
    'accept',
    'accept-encoding',
    'authorization',
    'content-type',
    'dnt',
    'origin',
    'user-agent',
    'x-csrftoken',
    'x-requested-with',
    'x-requested-by',
]

# Додаємо CORS middleware для preflight запитів
CORS_PREFLIGHT_MAX_AGE = 86400

CSRF_TRUSTED_ORIGINS = [
    'https://ida-ats.vercel.app',
    'https://web-production-007d9.up.railway.app',
    'https://*.railway.app',
]

REST_FRAMEWORK = {
    'DEFAULT_PERMISSION_CLASSES': [
        'rest_framework.permissions.IsAuthenticated',
    ],
    'DEFAULT_AUTHENTICATION_CLASSES': [
        'rest_framework_simplejwt.authentication.JWTAuthentication',
    ],
}

SIMPLE_JWT = {
    'ACCESS_TOKEN_LIFETIME': timedelta(hours=8),
    'REFRESH_TOKEN_LIFETIME': timedelta(days=7),
}