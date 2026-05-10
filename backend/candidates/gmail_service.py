# candidates/gmail_service.py
from allauth.socialaccount.models import SocialToken, SocialAccount
from google.oauth2.credentials import Credentials
from googleapiclient.discovery import build
from google.auth.transport.requests import Request
from googleapiclient.errors import HttpError
from django.conf import settings
import base64
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
import logging

logger = logging.getLogger(__name__)


class GmailService:
    """Сервіс для роботи з Gmail API через django-allauth"""

    @staticmethod
    def get_credentials(user):
        """Отримати Google credentials для користувача"""
        try:
            social_account = SocialAccount.objects.filter(
                user=user,
                provider='google'
            ).first()

            if not social_account:
                return None

            social_token = SocialToken.objects.filter(
                account=social_account,
                account__user=user
            ).first()

            if not social_token:
                return None

            creds = Credentials(
                token=social_token.token,
                refresh_token=social_token.token_secret,
                token_uri="https://oauth2.googleapis.com/token",
                client_id=settings.GOOGLE_CLOUD_CLIENT_ID,
                client_secret=settings.GOOGLE_CLOUD_CLIENT_SECRET,
            )

            # Оновлюємо токен якщо потрібно
            if creds.expired and creds.refresh_token:
                creds.refresh(Request())
                # Зберігаємо оновлений токен
                social_token.token = creds.token
                social_token.save()

            return creds

        except Exception as e:
            logger.error(f"Помилка отримання Google credentials: {e}")
            return None

    @staticmethod
    def send_email(user, to_email, subject, body, cc=None, bcc=None):
        """
        Відправка email через Gmail API від імені користувача

        Args:
            user: Django User об'єкт (відправник)
            to_email: email отримувача
            subject: тема листа
            body: тіло листа (HTML)
            cc: список email для копії
            bcc: список email для прихованої копії

        Returns:
            dict: результат з id повідомлення
        """
        try:
            creds = GmailService.get_credentials(user)
            if not creds:
                raise Exception("Не вдалося отримати Google credentials. " +
                                "Будь ласка, увійдіть в Google акаунт через /accounts/google/login/")

            service = build("gmail", "v1", credentials=creds)

            # Створюємо повідомлення
            message = MIMEMultipart('alternative')
            message["to"] = to_email
            message["subject"] = subject
            message["From"] = user.email

            if cc:
                message["Cc"] = ", ".join(cc)
            if bcc:
                message["Bcc"] = ", ".join(bcc)

            # Додаємо HTML версію
            html_part = MIMEText(body, "html", "utf-8")
            message.attach(html_part)

            # Кодуємо в base64
            raw_message = base64.urlsafe_b64encode(message.as_bytes()).decode()

            # Відправляємо
            send_result = service.users().messages().send(
                userId="me",
                body={"raw": raw_message}
            ).execute()

            logger.info(f"Email відправлено через Gmail API: {send_result['id']}")
            return {
                'success': True,
                'message_id': send_result['id'],
                'from_email': user.email
            }

        except HttpError as e:
            logger.error(f"Gmail API помилка: {e}")
            if e.resp.status == 401:
                raise Exception("Термін дії Google сесії минув. Увійдіть знову.")
            raise Exception(f"Помилка Gmail API: {e}")

        except Exception as e:
            logger.error(f"Помилка відправки email: {e}")
            raise