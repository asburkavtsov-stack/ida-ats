# candidates/utils/google_calendar.py
import logging
from datetime import timedelta

from google.oauth2.credentials import Credentials
from googleapiclient.discovery import build
from googleapiclient.errors import HttpError

logger = logging.getLogger(__name__)

SCOPES = [
    'https://www.googleapis.com/auth/calendar',
    'https://www.googleapis.com/auth/calendar.events',
]


def get_calendar_service(user):
    """
    Отримує авторизований Google Calendar сервіс для користувача.
    Використовує allauth SocialToken.
    """
    try:
        from allauth.socialaccount.models import SocialToken, SocialApp
        social_token = SocialToken.objects.select_related('account', 'app').get(
            account__user=user,
            account__provider='google'
        )
        creds = Credentials(
            token=social_token.token,
            refresh_token=social_token.token_secret,
            token_uri='https://oauth2.googleapis.com/token',
            client_id=social_token.app.client_id,
            client_secret=social_token.app.secret,
            scopes=SCOPES,
        )
        return build('calendar', 'v3', credentials=creds)
    except Exception as e:
        logger.warning(f"Google Calendar: не вдалося отримати сервіс для {user}: {e}")
        return None


def build_event_body(interview):
    """Будує тіло події для Google Calendar з моделі Interview."""
    start_dt = interview.scheduled_at
    end_dt = start_dt + timedelta(minutes=interview.duration_minutes)

    # Учасники: кандидат + інтерв'юери
    attendees = []
    if interview.candidate.email:
        attendees.append({
            'email': interview.candidate.email,
            'displayName': str(interview.candidate),
        })
    for interviewer in interview.interviewers.all():
        if interviewer.email:
            attendees.append({
                'email': interviewer.email,
                'displayName': interviewer.get_full_name() or interviewer.username,
            })

    description_parts = []
    if interview.notes:
        description_parts.append(interview.notes)
    description_parts.append(
        f"\nКандидат: {interview.candidate.first_name} {interview.candidate.last_name}"
    )
    if interview.vacancy:
        description_parts.append(f"Вакансія: {interview.vacancy.title}")
    description_parts.append(
        f"Тип: {'Онлайн' if interview.interview_type == 'online' else 'Офлайн'}"
    )

    event = {
        'summary': interview.title,
        'description': '\n'.join(description_parts),
        'start': {
            'dateTime': start_dt.isoformat(),
            'timeZone': 'Europe/Kyiv',
        },
        'end': {
            'dateTime': end_dt.isoformat(),
            'timeZone': 'Europe/Kyiv',
        },
        'attendees': attendees,
        'reminders': {
            'useDefault': False,
            'overrides': [
                {'method': 'email', 'minutes': 60},
                {'method': 'popup', 'minutes': 15},
            ],
        },
        'guestsCanModifyEvent': False,
    }

    if interview.location:
        event['location'] = interview.location

    if interview.interview_type == 'online':
        event['conferenceData'] = {
            'createRequest': {
                'requestId': f"ida-ats-{interview.pk}",
                'conferenceSolutionKey': {'type': 'hangoutsMeet'},
            }
        }

    return event


def create_calendar_event(interview, user):
    """Створює подію в Google Calendar."""
    service = get_calendar_service(user)
    if not service:
        return None

    try:
        event_body = build_event_body(interview)
        conference_version = 1 if interview.interview_type == 'online' else 0

        event = service.events().insert(
            calendarId='primary',
            body=event_body,
            sendUpdates='all',
            conferenceDataVersion=conference_version,
        ).execute()

        result = {
            'google_event_id': event.get('id', ''),
            'google_calendar_link': event.get('htmlLink', ''),
            'google_meet_link': '',
        }

        conf_data = event.get('conferenceData', {})
        for ep in conf_data.get('entryPoints', []):
            if ep.get('entryPointType') == 'video':
                result['google_meet_link'] = ep.get('uri', '')
                break

        logger.info(f"Google Calendar: створено подію {result['google_event_id']} для інтерв'ю {interview.pk}")
        return result

    except HttpError as e:
        logger.error(f"Google Calendar API помилка: {e}")
        return None
    except Exception as e:
        logger.error(f"Google Calendar: несподівана помилка: {e}")
        return None


def update_calendar_event(interview, user):
    """Оновлює існуючу подію в Google Calendar."""
    if not interview.google_event_id:
        return create_calendar_event(interview, user)

    service = get_calendar_service(user)
    if not service:
        return None

    try:
        event_body = build_event_body(interview)
        conference_version = 1 if interview.interview_type == 'online' else 0

        event = service.events().update(
            calendarId='primary',
            eventId=interview.google_event_id,
            body=event_body,
            sendUpdates='all',
            conferenceDataVersion=conference_version,
        ).execute()

        result = {
            'google_event_id': event.get('id', ''),
            'google_calendar_link': event.get('htmlLink', ''),
            'google_meet_link': interview.google_meet_link,
        }

        conf_data = event.get('conferenceData', {})
        for ep in conf_data.get('entryPoints', []):
            if ep.get('entryPointType') == 'video':
                result['google_meet_link'] = ep.get('uri', '')
                break

        logger.info(f"Google Calendar: оновлено подію {interview.google_event_id}")
        return result

    except HttpError as e:
        logger.error(f"Google Calendar update помилка: {e}")
        return None


def delete_calendar_event(interview, user):
    """Видаляє подію з Google Calendar."""
    if not interview.google_event_id:
        return True

    service = get_calendar_service(user)
    if not service:
        return False

    try:
        service.events().delete(
            calendarId='primary',
            eventId=interview.google_event_id,
            sendUpdates='all',
        ).execute()
        logger.info(f"Google Calendar: видалено подію {interview.google_event_id}")
        return True
    except HttpError as e:
        logger.error(f"Google Calendar delete помилка: {e}")
        return False