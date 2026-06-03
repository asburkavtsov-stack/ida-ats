# candidates/utils/audit.py
from candidates.models import AuditLog


def log_action(user, action, instance, extra_data=None, request=None):
    """
    Логує дію користувача з об'єктом.

    Args:
        user:       request.user
        action:     рядок з ACTION_CHOICES ('status_change', 'assign', 'delete', ...)
        instance:   модельний об'єкт (Candidate, Vacancy, ...)
        extra_data: dict з додатковими даними
        request:    HttpRequest (для IP-адреси)
    """
    try:
        org = user.profile.organization
    except Exception:
        org = None

    ip = None
    if request:
        x_forwarded = request.META.get('HTTP_X_FORWARDED_FOR', '')
        ip = x_forwarded.split(',')[0].strip() if x_forwarded else request.META.get('REMOTE_ADDR')

    AuditLog.objects.create(
        user=user,
        organization=org,
        action=action,
        model_name=instance.__class__.__name__,
        object_id=instance.pk,
        object_repr=str(instance)[:200],
        extra_data=extra_data or {},
        ip_address=ip,
    )