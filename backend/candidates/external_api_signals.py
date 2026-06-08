# external_api_signals.py
# Підключити в apps.py:
#
#   class IDAATSConfig(AppConfig):
#       def ready(self):
#           import ida_ats.external_api_signals  # noqa

from django.db.models.signals import post_save
from django.dispatch import receiver

from .models import Candidate, StatusHistory, Vacancy
from .external_api_views import _fire_webhook, _candidate_payload


# ─── Новий кандидат ───────────────────────────────────────────────────────────

@receiver(post_save, sender=Candidate)
def on_candidate_created(sender, instance, created, **kwargs):
    if not created:
        return
    if not instance.organization:
        return
    _fire_webhook(instance.organization, 'candidate.created', _candidate_payload(instance))


# ─── Зміна статусу кандидата ──────────────────────────────────────────────────

@receiver(post_save, sender=StatusHistory)
def on_status_changed(sender, instance, created, **kwargs):
    if not created:
        return
    candidate = instance.candidate
    if not candidate.organization:
        return

    new_key = instance.new_stage.system_key if instance.new_stage else instance.new_status

    payload = {
        **_candidate_payload(candidate),
        'from_status': instance.old_stage.name if instance.old_stage else instance.old_status,
        'to_status':   instance.new_stage.name if instance.new_stage else instance.new_status,
        'changed_at':  instance.changed_at.isoformat(),
    }

    # Завжди надсилаємо загальну подію
    _fire_webhook(candidate.organization, 'candidate.status_changed', payload)

    # Додатково — специфічні події
    if new_key == 'offer':
        _fire_webhook(candidate.organization, 'candidate.hired', payload)
    elif new_key == 'rejected':
        _fire_webhook(candidate.organization, 'candidate.rejected', payload)


# ─── Нова вакансія ────────────────────────────────────────────────────────────

@receiver(post_save, sender=Vacancy)
def on_vacancy_created(sender, instance, created, **kwargs):
    if not created:
        return
    if not instance.organization:
        return
    _fire_webhook(instance.organization, 'vacancy.created', {
        'vacancy_id':    instance.id,
        'title':         instance.title,
        'department':    instance.department,
        'city':          instance.city,
        'employment_type': instance.employment_type,
        'created_at':    instance.created_at.isoformat() if instance.created_at else None,
    })


# ─── Вакансія закрита ─────────────────────────────────────────────────────────

@receiver(post_save, sender=Vacancy)
def on_vacancy_closed(sender, instance, created, **kwargs):
    if created:
        return
    # Перевіряємо чи is_active щойно стала False
    # (Django не надає попереднє значення в post_save — тому відстежуємо через update_fields)
    update_fields = kwargs.get('update_fields')
    if update_fields and 'is_active' in update_fields and not instance.is_active:
        if instance.organization:
            _fire_webhook(instance.organization, 'vacancy.closed', {
                'vacancy_id': instance.id,
                'title':      instance.title,
            })