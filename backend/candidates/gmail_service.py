import base64
import logging
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText

from django.conf import settings
from google.auth.transport.requests import Request
from google.oauth2.credentials import Credentials
from googleapiclient.discovery import build
from googleapiclient.errors import HttpError

logger = logging.getLogger(__name__)


class GmailService:

    @staticmethod
    def get_credentials(user):
        from allauth.socialaccount.models import SocialAccount, SocialToken
        social_account = SocialAccount.objects.filter(
            user=user,
            provider='google',
        ).first()
        if not social_account:
            return None

        social_token = SocialToken.objects.filter(
            account=social_account,
        ).first()
        if not social_token:
            return None

        refresh_token = social_token.token_secret or None

        creds = Credentials(
            token=social_token.token,
            refresh_token=refresh_token,
            token_uri='https://oauth2.googleapis.com/token',
            client_id=getattr(settings, 'GOOGLE_CLOUD_CLIENT_ID', ''),
            client_secret=getattr(settings, 'GOOGLE_CLOUD_CLIENT_SECRET', ''),
        )

        if creds.expired and creds.refresh_token:
            try:
                creds.refresh(Request())
                social_token.token = creds.token
                social_token.save(update_fields=['token'])
                logger.info("Google access token оновлено для %s", user.email)
            except Exception as e:
                logger.error("Не вдалося оновити Google токен для %s: %s", user.email, e)
                return None

        return creds

    @staticmethod
    def send_email(user, to_email, subject, body, cc=None, bcc=None):
        creds = GmailService.get_credentials(user)
        if not creds:
            raise Exception(
                'Не вдалося отримати Google credentials. '
                'Будь ласка, увійдіть в Google акаунт через /accounts/google/login/'
            )

        try:
            service = build('gmail', 'v1', credentials=creds)

            message = MIMEMultipart('alternative')
            message['To'] = to_email
            message['Subject'] = subject
            message['From'] = user.email
            if cc:
                message['Cc'] = ', '.join(cc)
            if bcc:
                message['Bcc'] = ', '.join(bcc)

            message.attach(MIMEText(body, 'html', 'utf-8'))

            raw = base64.urlsafe_b64encode(message.as_bytes()).decode()
            result = service.users().messages().send(
                userId='me',
                body={'raw': raw},
            ).execute()

            logger.info("Gmail API: лист відправлено, id=%s, від=%s", result['id'], user.email)
            return {
                'success': True,
                'message_id': result['id'],
                'from_email': user.email,
            }

        except HttpError as e:
            logger.error("Gmail API HttpError для %s: %s", user.email, e)
            if e.resp.status == 401:
                raise Exception('Термін дії Google сесії минув. Увійдіть в Google знову.')
            if e.resp.status == 403:
                raise Exception(
                    'Немає дозволу на відправку email. '
                    'Перевірте що scope gmail.send додано в Google Cloud.'
                )
            raise Exception(f'Gmail API помилка ({e.resp.status}): {e}')

        except Exception as e:
            logger.error("Помилка відправки Gmail для %s: %s", user.email, e)
            raise