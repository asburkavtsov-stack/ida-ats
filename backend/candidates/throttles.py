"""
candidates/throttles.py
=======================
Rate limiting для IDA ATS.
"""

from rest_framework.throttling import AnonRateThrottle, UserRateThrottle, SimpleRateThrottle


class LoginRateThrottle(AnonRateThrottle):
    """10 спроб/хвилину — захист від brute-force на login/register."""
    scope = 'login'


class PublicEndpointThrottle(AnonRateThrottle):
    """30 запитів/хвилину для публічних ендпоінтів без авторизації."""
    scope = 'public'


class WebhookRateThrottle(SimpleRateThrottle):
    """200 запитів/годину для вхідних webhooks від job boards."""
    scope = 'webhook'

    def get_cache_key(self, request, view):
        ip = (
            request.META.get('HTTP_X_FORWARDED_FOR', '').split(',')[0].strip()
            or request.META.get('REMOTE_ADDR', '')
        )
        return self.cache_format % {'scope': self.scope, 'ident': ip}


class ExternalAPIThrottle(SimpleRateThrottle):
    """200 запитів/годину для /api/v1/ext/* — ідентифікація по API Key."""
    scope = 'external_api'

    def get_cache_key(self, request, view):
        auth_header = request.META.get('HTTP_AUTHORIZATION', '')
        if auth_header.startswith('Bearer ida_'):
            ident = auth_header[7:47]
        else:
            ident = (
                request.META.get('HTTP_X_FORWARDED_FOR', '').split(',')[0].strip()
                or request.META.get('REMOTE_ADDR', '')
            )
        return self.cache_format % {'scope': self.scope, 'ident': ident}


class VacancyFeedThrottle(AnonRateThrottle):
    """60 запитів/годину для XML-фідів вакансій."""
    scope = 'vacancy_feed'


class ExportRateThrottle(UserRateThrottle):
    """30 експортів/годину для авторизованих користувачів."""
    scope = 'export'


class GDPROperationThrottle(UserRateThrottle):
    """20 GDPR операцій/годину (anonymize, export, cleanup)."""
    scope = 'gdpr'