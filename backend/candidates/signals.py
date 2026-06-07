# candidates/signals.py
"""
Автотригери: при зміні статусу кандидата →
  1. Надсилає лист кандидату (якщо є EmailTemplate для цього stage)
  2. Сповіщає HR (assigned_to або vacancy.owner)
"""
import logging
from django.db.models.signals import post_save
from django.dispatch import receiver

from .models import StatusHistory
from .notifications import send_status_change_notifications

logger = logging.getLogger(__name__)


@receiver(post_save, sender=StatusHistory)
def on_status_history_created(sender, instance, created, **kwargs):
    """
    Спрацьовує щоразу, як створюється новий запис StatusHistory
    (тобто при кожній зміні статусу кандидата).
    """
    if not created:
        return

    try:
        send_status_change_notifications(instance)
    except Exception as exc:
        logger.exception(
            "Помилка автотригера для кандидата #%s → %s: %s",
            instance.candidate_id,
            instance.new_status,
            exc,
        )