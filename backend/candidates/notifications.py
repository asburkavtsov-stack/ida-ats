# candidates/notifications.py
"""
Логіка сповіщень при зміні статусу кандидата.

Потік:
  StatusHistory створено
    → send_status_change_notifications(history)
        → notify_candidate()   – лист кандидату (якщо є шаблон)
        → notify_hr()          – лист HR-у (assigned_to або vacancy.owner)
"""
import logging
from django.core.mail import send_mail
from django.conf import settings
from django.template.loader import render_to_string
from django.utils.html import strip_tags

from .models import EmailTemplate, SentEmail

logger = logging.getLogger(__name__)

# Відображення system_key → тип EmailTemplate
STAGE_TO_TEMPLATE_TYPE = {
    'interview': 'interview',
    'offer':     'offer',
    'rejected':  'rejection',
}


# ──────────────────────────────────────────────────────────────────────────────
# Публічна точка входу
# ──────────────────────────────────────────────────────────────────────────────

def send_status_change_notifications(history):
    """
    Головна функція. Приймає об'єкт StatusHistory.
    Викликається з signals.py.
    """
    candidate = history.candidate
    new_stage  = history.new_stage

    if not new_stage:
        return

    # 1. Лист кандидату
    notify_candidate(candidate, new_stage, history)

    # 2. Сповіщення HR
    notify_hr(candidate, new_stage, history)


# ──────────────────────────────────────────────────────────────────────────────
# Лист кандидату
# ──────────────────────────────────────────────────────────────────────────────

def notify_candidate(candidate, new_stage, history):
    """
    Якщо для нового stage існує EmailTemplate в організації —
    відправляємо лист кандидату і пишемо в SentEmail.
    """
    if not candidate.email:
        return

    template_type = STAGE_TO_TEMPLATE_TYPE.get(new_stage.system_key)
    if not template_type:
        # Для stage 'new', 'screening' і кастомних — не надсилаємо авто-лист
        return

    org = candidate.organization
    template = EmailTemplate.objects.filter(
        organization=org,
        template_type=template_type,
        is_active=True,
    ).first()

    if not template:
        logger.info(
            "Немає активного шаблону '%s' для орг #%s, лист кандидату не надіслано.",
            template_type, org.id if org else '—',
        )
        return

    subject = _replace_placeholders(template.subject, candidate, history)
    body_html = _replace_placeholders(template.body, candidate, history)
    body_text = strip_tags(body_html)

    sent = SentEmail.objects.create(
        candidate=candidate,
        template=template,
        recipient_email=candidate.email,
        subject=subject,
        body=body_html,
        sent_by=history.changed_by,
        status='pending',
    )

    try:
        send_mail(
            subject=subject,
            message=body_text,
            html_message=body_html,
            from_email=_from_email(),
            recipient_list=[candidate.email],
            fail_silently=False,
        )
        sent.status = 'sent'
        sent.save(update_fields=['status'])
        logger.info("Лист кандидату %s надіслано (%s).", candidate.email, template_type)
    except Exception as exc:
        sent.status = 'failed'
        sent.error_message = str(exc)[:500]
        sent.save(update_fields=['status', 'error_message'])
        logger.error("Не вдалось надіслати лист кандидату %s: %s", candidate.email, exc)


# ──────────────────────────────────────────────────────────────────────────────
# Сповіщення HR
# ──────────────────────────────────────────────────────────────────────────────

def notify_hr(candidate, new_stage, history):
    """
    Надсилає HR листа про зміну статусу кандидата.
    Отримувач: assigned_to → vacancy.owner → нікого.
    Не надсилаємо, якщо HR сам ініціював зміну (changed_by == hr).
    """
    hr_user = candidate.assigned_to
    if not hr_user and candidate.vacancy:
        hr_user = candidate.vacancy.owner

    if not hr_user or not hr_user.email:
        return

    # Не спамимо HR якщо він сам змінив статус
    if history.changed_by and history.changed_by.id == hr_user.id:
        return

    subject = (
        f"[IDA ATS] Зміна статусу: {candidate.first_name} {candidate.last_name} "
        f"→ {new_stage.name}"
    )

    old_label = history.old_stage.name if history.old_stage else "—"
    vacancy_title = candidate.vacancy.title if candidate.vacancy else "—"
    changed_by_name = (
        history.changed_by.get_full_name() or history.changed_by.username
        if history.changed_by else "система"
    )
    rejection_info = ""
    if new_stage.system_key == 'rejected' and history.rejection_reason:
        rejection_info = (
            f"\nПричина відмови: {history.rejection_reason.name}"
        )
        if history.rejection_comment:
            rejection_info += f"\nКоментар: {history.rejection_comment}"

    body_text = (
        f"Вітаємо, {hr_user.first_name or hr_user.username}!\n\n"
        f"Кандидат {candidate.first_name} {candidate.last_name} "
        f"({candidate.email}) змінив статус:\n\n"
        f"  {old_label}  →  {new_stage.name}\n\n"
        f"Вакансія: {vacancy_title}\n"
        f"Змінив: {changed_by_name}"
        f"{rejection_info}\n\n"
        f"— IDA ATS"
    )

    try:
        send_mail(
            subject=subject,
            message=body_text,
            from_email=_from_email(),
            recipient_list=[hr_user.email],
            fail_silently=False,
        )
        logger.info(
            "HR-сповіщення надіслано %s про кандидата #%s → %s",
            hr_user.email, candidate.id, new_stage.name,
        )
    except Exception as exc:
        logger.error(
            "Не вдалось надіслати HR-сповіщення %s: %s",
            hr_user.email, exc,
        )


# ──────────────────────────────────────────────────────────────────────────────
# Допоміжні функції
# ──────────────────────────────────────────────────────────────────────────────

def _replace_placeholders(text, candidate, history):
    """
    Замінює плейсхолдери у тексті шаблону.
    Підтримувані теги:
      {{first_name}}, {{last_name}}, {{full_name}},
      {{vacancy}}, {{stage}}, {{email}}, {{phone}}
    """
    if not text:
        return text

    vacancy_title = candidate.vacancy.title if candidate.vacancy else ""
    replacements = {
        '{{first_name}}':  candidate.first_name,
        '{{last_name}}':   candidate.last_name,
        '{{full_name}}':   f"{candidate.first_name} {candidate.last_name}",
        '{{vacancy}}':     vacancy_title,
        '{{stage}}':       history.new_stage.name if history.new_stage else "",
        '{{email}}':       candidate.email,
        '{{phone}}':       candidate.phone or "",
    }
    for placeholder, value in replacements.items():
        text = text.replace(placeholder, value or "")
    return text


def _from_email():
    return getattr(settings, 'DEFAULT_FROM_EMAIL', 'noreply@ida-ats.com')