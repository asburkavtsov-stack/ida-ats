from django.apps import AppConfig


class CandidatesConfig(AppConfig):
    default_auto_field = 'django.db.models.BigAutoField'
    name = 'candidates'

    def ready(self):
        import candidates.signals          # noqa: F401
        import candidates.external_api_signals  # noqa: F401