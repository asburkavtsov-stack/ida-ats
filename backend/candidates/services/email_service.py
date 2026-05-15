import logging
from typing import Dict, Any, Tuple, Optional

from django.contrib.auth.models import User
from django.conf import settings

from candidates.models import Candidate, EmailTemplate, SentEmail
from candidates.gmail_service import GmailService

logger = logging.getLogger(__name__)


class EmailService:

    @staticmethod
    def apply_template_replacements(
            subject: str,
            body: str,
            candidate: Candidate,
            request
    ) -> Tuple[str, str]:
        hr_name = (
                f"{request.user.first_name} {request.user.last_name}".strip()
                or request.user.username
        )
        vacancy_title = candidate.vacancy.title if candidate.vacancy else '—'
        org_name = candidate.organization.name if candidate.organization else '—'

        replacements = {
            '{{name}}': f"{candidate.first_name} {candidate.last_name}".strip(),
            '{{first_name}}': candidate.first_name or '',
            '{{last_name}}': candidate.last_name or '',
            '{{vacancy}}': vacancy_title,
            '{{email}}': candidate.email or '',
            '{{phone}}': candidate.phone or '—',
            '{{status}}': candidate.get_status_display(),
            '{{hr_name}}': hr_name,
            '{{hr_email}}': request.user.email or '',
            '{{organization}}': org_name,
            '{{date}}': candidate.created_at.strftime('%d.%m.%Y') if candidate.created_at else '—',
        }

        for placeholder, value in replacements.items():
            subject = subject.replace(placeholder, str(value))
            body = body.replace(placeholder, str(value))

        # Підпис
        if '{{hr_signature}}' in body:
            signature = (
                f'<br><br>--<br>'
                f'<strong>{hr_name}</strong><br>'
                f'HR менеджер<br>'
                f'Email: <a href="mailto:{request.user.email}">{request.user.email}</a>'
            )
            body = body.replace('{{hr_signature}}', signature)

        return subject, body

    @staticmethod
    def create_sent_record(
            candidate: Candidate,
            template: Optional[EmailTemplate],
            subject: str,
            body: str,
            sent_by: User,
            status: str = 'pending'
    ) -> SentEmail:
        return SentEmail.objects.create(
            candidate=candidate,
            template=template,
            recipient_email=candidate.email,
            subject=subject,
            body=body,
            sent_by=sent_by,
            status=status,
        )

    @staticmethod
    def send_via_gmail(
            user: User,
            to_email: str,
            subject: str,
            body: str
    ) -> Dict[str, Any]:
        return GmailService.send_email(
            user=user,
            to_email=to_email,
            subject=subject,
            body=body,
        )

    @staticmethod
    def send_via_smtp(
            to_email: str,
            subject: str,
            body: str,
            from_email: str,
            reply_to: str = None
    ) -> bool:
        from django.core.mail import EmailMultiAlternatives

        msg = EmailMultiAlternatives(
            subject=subject,
            body=body,
            from_email=from_email or settings.DEFAULT_FROM_EMAIL,
            to=[to_email],
            reply_to=[reply_to] if reply_to else None,
        )
        msg.attach_alternative(body, 'text/html')
        msg.send()
        return True

    @staticmethod
    def get_email_backend_type() -> str:
        return getattr(settings, 'EMAIL_BACKEND_TYPE', 'console')