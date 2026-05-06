from rest_framework import viewsets, status, serializers
from rest_framework.decorators import action, api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView
from django.contrib.auth.models import User
from django.db import models
from django.core.mail import EmailMultiAlternatives
from django.conf import settings
import csv
import os
import socket
import smtplib
from django.http import HttpResponse
from .models import Candidate, Vacancy, UserProfile, Organization, StatusHistory, EmailTemplate, SentEmail
from .serializers import CandidateSerializer, VacancySerializer, OrganizationSerializer, EmailTemplateSerializer, \
    SentEmailSerializer
from .pagination import StandardPagination

# Спроба імпортувати SendGrid (опціонально)
try:
    from sendgrid import SendGridAPIClient
    from sendgrid.helpers.mail import Mail, Email, ReplyTo, Personalization

    SENDGRID_AVAILABLE = True
except ImportError:
    SENDGRID_AVAILABLE = False


def get_user_org(user):
    try:
        return user.profile.organization
    except (UserProfile.DoesNotExist, AttributeError):
        return None


def get_user_role(user):
    try:
        return user.profile.role
    except (UserProfile.DoesNotExist, AttributeError):
        return None


class VacancyViewSet(viewsets.ModelViewSet):
    serializer_class = VacancySerializer

    def get_queryset(self):
        role = get_user_role(self.request.user)
        org_id = self.request.query_params.get('organization')

        if role == 'superadmin':
            queryset = Vacancy.objects.all()
            if org_id:
                queryset = queryset.filter(organization_id=org_id)
        else:
            org = get_user_org(self.request.user)
            if org:
                queryset = Vacancy.objects.filter(organization=org)
            else:
                queryset = Vacancy.objects.none()

        return queryset

    def perform_create(self, serializer):
        org = get_user_org(self.request.user)
        serializer.save(organization=org)


class OrganizationViewSet(viewsets.ModelViewSet):
    queryset = Organization.objects.all()
    serializer_class = OrganizationSerializer


class CandidateViewSet(viewsets.ModelViewSet):
    queryset = Candidate.objects.all()
    serializer_class = CandidateSerializer
    pagination_class = StandardPagination

    def get_queryset(self):
        role = get_user_role(self.request.user)
        org_id = self.request.query_params.get('organization')

        if role == 'superadmin':
            queryset = Candidate.objects.all()
            if org_id:
                queryset = queryset.filter(organization_id=org_id)
        else:
            org = get_user_org(self.request.user)
            if org:
                queryset = Candidate.objects.filter(organization=org)
            else:
                queryset = Candidate.objects.none()

        vacancy = self.request.query_params.get('vacancy')
        status_filter = self.request.query_params.get('status')
        assigned_to = self.request.query_params.get('assigned_to')
        mine = self.request.query_params.get('mine')

        if vacancy:
            queryset = queryset.filter(vacancy_id=vacancy)
        if status_filter:
            queryset = queryset.filter(status=status_filter)
        if assigned_to:
            queryset = queryset.filter(assigned_to_id=assigned_to)
        if mine == 'true':
            queryset = queryset.filter(assigned_to=self.request.user)

        return queryset.select_related('assigned_to').order_by('-created_at')

    def perform_create(self, serializer):
        org = get_user_org(self.request.user)
        serializer.save(organization=org)

    @action(detail=True, methods=['patch'])
    def update_status(self, request, pk=None):
        candidate = self.get_object()
        new_status = request.data.get('status')
        if new_status:
            old_status = candidate.status
            candidate.status = new_status
            candidate.save()
            StatusHistory.objects.create(
                candidate=candidate,
                old_status=old_status,
                new_status=new_status,
                changed_by=request.user,
            )
            return Response(CandidateSerializer(candidate).data)
        return Response({'error': 'Status required'}, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=True, methods=['patch'])
    def assign(self, request, pk=None):
        candidate = self.get_object()
        user_id = request.data.get('assigned_to')

        if user_id is None:
            candidate.assigned_to = None
            candidate.save()
            return Response(CandidateSerializer(candidate).data)

        try:
            user = User.objects.get(id=user_id)
            candidate.assigned_to = user
            candidate.save()
            return Response(CandidateSerializer(candidate).data)
        except User.DoesNotExist:
            return Response({'error': 'User not found'}, status=status.HTTP_404_NOT_FOUND)


class CandidateExportCSVView(APIView):
    """Експорт кандидатів у CSV з урахуванням фільтрів та прав доступу"""
    permission_classes = [IsAuthenticated]

    def get(self, request):
        role = get_user_role(request.user)
        org_id = request.query_params.get('organization')

        if role == 'superadmin':
            queryset = Candidate.objects.all()
            if org_id:
                queryset = queryset.filter(organization_id=org_id)
        else:
            org = get_user_org(request.user)
            if org:
                queryset = Candidate.objects.filter(organization=org)
            else:
                queryset = Candidate.objects.none()

        vacancy = request.query_params.get('vacancy')
        status_filter = request.query_params.get('status')
        search = request.query_params.get('search')

        if vacancy:
            queryset = queryset.filter(vacancy_id=vacancy)
        if status_filter:
            queryset = queryset.filter(status=status_filter)
        if search:
            queryset = queryset.filter(
                models.Q(first_name__icontains=search) |
                models.Q(last_name__icontains=search) |
                models.Q(email__icontains=search)
            )

        queryset = queryset.select_related('vacancy', 'organization').order_by('-created_at')

        response = HttpResponse(content_type='text/csv; charset=utf-8')
        response['Content-Disposition'] = 'attachment; filename="candidates.csv"'
        response.write('\ufeff')

        writer = csv.writer(response)
        writer.writerow([
            'ID', 'Ім\'я', 'Прізвище', 'Email', 'Телефон',
            'Вакансія', 'Організація', 'Статус', 'Нотатки', 'Дата створення'
        ])

        status_labels = {
            'new': 'Новий',
            'screening': 'Скринінг',
            'interview': 'Співбесіда',
            'offer': 'Оффер',
            'rejected': 'Відмова',
        }

        for c in queryset:
            writer.writerow([
                c.id,
                c.first_name or '',
                c.last_name or '',
                c.email or '',
                c.phone or '',
                c.vacancy.title if c.vacancy else '—',
                c.organization.name if c.organization else '—',
                status_labels.get(c.status, c.status),
                (c.notes or '').replace('\n', ' ').replace('\r', ''),
                c.created_at.strftime('%d.%m.%Y %H:%M') if c.created_at else '—',
            ])

        return response


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def current_user(request):
    user = request.user
    try:
        org = user.profile.organization
        org_data = {
            'id': org.id,
            'name': org.name,
            'max_vacancies': org.max_vacancies,
            'max_hr': org.max_hr,
        } if org else None
        role = user.profile.role
    except (UserProfile.DoesNotExist, AttributeError):
        org_data = None
        role = None

    return Response({
        'id': user.id,
        'username': user.username,
        'first_name': user.first_name,
        'last_name': user.last_name,
        'email': user.email,
        'organization': org_data,
        'role': role,
    })


class UserListView(viewsets.ViewSet):
    permission_classes = [IsAuthenticated]

    def list(self, request):
        role = get_user_role(request.user)
        org_id = request.query_params.get('organization')

        if role == 'superadmin':
            if not org_id:
                return Response({'error': 'organization parameter required'}, status=status.HTTP_400_BAD_REQUEST)
            profiles = UserProfile.objects.filter(organization_id=org_id).select_related('user')
        else:
            user_org = get_user_org(request.user)
            if not user_org:
                return Response([], status=status.HTTP_200_OK)
            profiles = UserProfile.objects.filter(organization=user_org).select_related('user')

        data = [{
            'id': p.user.id,
            'username': p.user.username,
            'first_name': p.user.first_name,
            'last_name': p.user.last_name,
            'email': p.user.email,
            'role': p.role,
            'profile_id': p.id,
        } for p in profiles]
        return Response(data)

    @action(detail=False, methods=['get'])
    def all(self, request):
        role = get_user_role(request.user)
        if role != 'superadmin':
            return Response({'error': 'Forbidden'}, status=status.HTTP_403_FORBIDDEN)

        users = User.objects.all().select_related('profile__organization')
        data = []
        for u in users:
            try:
                profile = u.profile
                org = profile.organization
                role_name = profile.role
                org_id = org.id if org else None
                org_name = org.name if org else None
            except (UserProfile.DoesNotExist, AttributeError):
                role_name = None
                org_id = None
                org_name = None
            data.append({
                'id': u.id,
                'username': u.username,
                'first_name': u.first_name,
                'last_name': u.last_name,
                'email': u.email,
                'role': role_name,
                'organization_id': org_id,
                'organization_name': org_name,
            })
        return Response(data)

    def create(self, request):
        username = request.data.get('username')
        password = request.data.get('password')
        first_name = request.data.get('first_name', '')
        last_name = request.data.get('last_name', '')
        email = request.data.get('email', '')
        org_id = request.data.get('organization')
        role = request.data.get('role', 'hr')

        if User.objects.filter(username=username).exists():
            return Response({'error': 'Username вже існує'}, status=status.HTTP_400_BAD_REQUEST)

        # ВАЛІДАЦІЯ ЛІМІТУ HR
        if org_id and role == 'hr':
            try:
                org = Organization.objects.get(id=org_id)
                current_hr_count = UserProfile.objects.filter(
                    organization=org,
                    role='hr'
                ).count()
                if current_hr_count >= org.max_hr:
                    return Response(
                        {
                            'error': f'Ліміт HR-менеджерів досягнуто ({org.max_hr}). Збільшіть ліміт у налаштуваннях організації.'},
                        status=status.HTTP_400_BAD_REQUEST
                    )
            except Organization.DoesNotExist:
                return Response({'error': 'Організацію не знайдено'}, status=status.HTTP_404_NOT_FOUND)

        user = User.objects.create_user(
            username=username, password=password,
            first_name=first_name, last_name=last_name, email=email
        )
        org = Organization.objects.get(id=org_id) if org_id else None
        UserProfile.objects.create(user=user, organization=org, role=role)
        return Response({'success': True}, status=status.HTTP_201_CREATED)

    def partial_update(self, request, pk=None):
        try:
            user = User.objects.get(id=pk)
        except User.DoesNotExist:
            return Response({'error': 'Юзер не знайдений'}, status=status.HTTP_404_NOT_FOUND)

        user.first_name = request.data.get('first_name', user.first_name)
        user.last_name = request.data.get('last_name', user.last_name)
        user.email = request.data.get('email', user.email)
        if request.data.get('password'):
            user.set_password(request.data.get('password'))
        user.save()

        try:
            profile = user.profile
            profile.role = request.data.get('role', profile.role)
            org_id = request.data.get('organization')
            if org_id:
                profile.organization = Organization.objects.get(id=org_id)
            elif org_id == '':
                profile.organization = None
            profile.save()
        except (UserProfile.DoesNotExist, AttributeError):
            org_id = request.data.get('organization')
            org = Organization.objects.get(id=org_id) if org_id else None
            UserProfile.objects.create(user=user, organization=org, role=request.data.get('role', 'hr'))

        return Response({'success': True})

    def destroy(self, request, pk=None):
        try:
            user = User.objects.get(id=pk)
            user.delete()
            return Response({'success': True})
        except User.DoesNotExist:
            return Response({'error': 'Юзер не знайдений'}, status=status.HTTP_404_NOT_FOUND)


class EmailTemplateViewSet(viewsets.ModelViewSet):
    serializer_class = EmailTemplateSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        role = get_user_role(self.request.user)

        if role == 'superadmin':
            org_id = self.request.query_params.get('organization')
            if org_id:
                return EmailTemplate.objects.filter(organization_id=org_id)
            return EmailTemplate.objects.all()

        org = get_user_org(self.request.user)
        if not org:
            return EmailTemplate.objects.none()
        return EmailTemplate.objects.filter(organization=org)

    def list(self, request, *args, **kwargs):
        """GET /api/email-templates/ — список шаблонів"""
        try:
            queryset = self.get_queryset()
            serializer = self.get_serializer(queryset, many=True)
            return Response(serializer.data)
        except Exception as e:
            import traceback
            print(f"EmailTemplate LIST ERROR: {e}")
            traceback.print_exc()
            return Response(
                {'error': 'Помилка завантаження шаблонів', 'detail': str(e)},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )

    def create(self, request, *args, **kwargs):
        """POST /api/email-templates/ — створення шаблону"""
        try:
            serializer = self.get_serializer(data=request.data)
            serializer.is_valid(raise_exception=True)
            self.perform_create(serializer)
            headers = self.get_success_headers(serializer.data)
            return Response(serializer.data, status=status.HTTP_201_CREATED, headers=headers)
        except serializers.ValidationError as e:
            return Response(
                e.detail if isinstance(e.detail, dict) else {'error': str(e.detail)},
                status=status.HTTP_400_BAD_REQUEST
            )
        except Exception as e:
            import traceback
            print(f"EmailTemplate CREATE ERROR: {e}")
            traceback.print_exc()
            return Response(
                {'error': 'Помилка створення шаблону', 'detail': str(e)},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )

    def update(self, request, *args, **kwargs):
        """PUT/PATCH /api/email-templates/<id>/ — оновлення шаблону"""
        try:
            partial = kwargs.pop('partial', False)
            instance = self.get_object()
            serializer = self.get_serializer(instance, data=request.data, partial=partial)
            serializer.is_valid(raise_exception=True)
            self.perform_update(serializer)
            return Response(serializer.data)
        except serializers.ValidationError as e:
            return Response(
                e.detail if isinstance(e.detail, dict) else {'error': str(e.detail)},
                status=status.HTTP_400_BAD_REQUEST
            )
        except Exception as e:
            import traceback
            print(f"EmailTemplate UPDATE ERROR: {e}")
            traceback.print_exc()
            return Response(
                {'error': 'Помилка оновлення шаблону', 'detail': str(e)},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )

    def perform_create(self, serializer):
        """Збереження шаблону з автоматичним встановленням організації"""
        org = get_user_org(self.request.user)
        if not org:
            raise serializers.ValidationError(
                {'error': 'Користувач не прив\'язаний до організації. Зверніться до адміністратора.'}
            )

        template_type = serializer.validated_data.get('template_type')
        if template_type:
            existing = EmailTemplate.objects.filter(organization=org, template_type=template_type).first()
            if existing:
                # Оновлюємо існуючий шаблон замість створення нового
                existing.subject = serializer.validated_data.get('subject', existing.subject)
                existing.body = serializer.validated_data.get('body', existing.body)
                existing.is_active = serializer.validated_data.get('is_active', existing.is_active)
                existing.save()
                # Повертаємо оновлений об'єкт через serializer
                serializer.instance = existing
                return

        serializer.save(organization=org)

    def perform_update(self, serializer):
        """Оновлення шаблону з перевіркою прав"""
        org = get_user_org(self.request.user)
        if not org:
            raise serializers.ValidationError(
                {'error': 'Користувач не прив\'язаний до організації'}
            )
        if serializer.instance.organization != org:
            raise serializers.ValidationError(
                {'error': 'Немає прав для редагування цього шаблону'}
            )
        serializer.save()

    @action(detail=True, methods=['post'])
    def preview(self, request, pk=None):
        try:
            template = self.get_object()
        except Exception:
            return Response({'error': 'Шаблон не знайдено'}, status=status.HTTP_404_NOT_FOUND)

        candidate_id = request.data.get('candidate_id')
        if not candidate_id:
            return Response({'error': 'candidate_id is required'}, status=status.HTTP_400_BAD_REQUEST)

        try:
            candidate = Candidate.objects.get(id=candidate_id, organization=template.organization)
        except Candidate.DoesNotExist:
            return Response({'error': 'Кандидата не знайдено'}, status=status.HTTP_404_NOT_FOUND)

        vacancy_title = candidate.vacancy.title if candidate.vacancy else '—'
        hr_name = f"{request.user.first_name} {request.user.last_name}".strip() or request.user.username
        hr_email = request.user.email

        subject = template.subject
        body = template.body

        replacements = {
            '{{name}}': f"{candidate.first_name} {candidate.last_name}",
            '{{first_name}}': candidate.first_name or '',
            '{{last_name}}': candidate.last_name or '',
            '{{vacancy}}': vacancy_title,
            '{{email}}': candidate.email or '',
            '{{phone}}': candidate.phone or '—',
            '{{status}}': candidate.get_status_display(),
            '{{hr_name}}': hr_name,
            '{{hr_email}}': hr_email,
            '{{organization}}': template.organization.name if template.organization else '—',
            '{{date}}': candidate.created_at.strftime('%d.%m.%Y') if candidate.created_at else '—',
        }

        for placeholder, value in replacements.items():
            subject = subject.replace(placeholder, str(value) if value else '')
            body = body.replace(placeholder, str(value) if value else '')

        return Response({
            'subject': subject,
            'body': body,
            'candidate_email': candidate.email,
            'from_email': hr_email,
        })

    def _send_via_smtp(self, request, template, candidate, hr_email, subject, body):
        """Відправка через SMTP з Reply-To на HR"""
        recipient_email = candidate.email

        sent_email = SentEmail.objects.create(
            candidate=candidate,
            template=template,
            recipient_email=recipient_email,
            subject=subject,
            body=body,
            sent_by=request.user,
            status='pending'
        )

        try:
            # Використовуємо DEFAULT_FROM_EMAIL як відправника,
            # але додаємо Reply-To на email HR
            from_email = settings.DEFAULT_FROM_EMAIL

            email = EmailMultiAlternatives(
                subject=subject,
                body=body,
                from_email=from_email,
                to=[recipient_email],
                reply_to=[hr_email],  # Відповідь піде HR
                headers={
                    'X-Sender-Name': f"{request.user.first_name} {request.user.last_name}".strip() or request.user.username,
                    'X-Sender-Email': hr_email,
                }
            )
            email.attach_alternative(body, "text/html")

            old_timeout = socket.getdefaulttimeout()
            socket.setdefaulttimeout(10)

            try:
                email.send()
            finally:
                socket.setdefaulttimeout(old_timeout)

            sent_email.status = 'sent'
            sent_email.save()

            return Response({
                'success': True,
                'message': f'Лист відправлено від {from_email} від імені {hr_email} на {recipient_email}',
                'sent_email_id': sent_email.id,
                'subject': subject,
                'from_email': from_email,
                'reply_to': hr_email,
            })

        except (smtplib.SMTPException, socket.timeout, OSError) as e:
            error_msg = str(e)
            sent_email.status = 'failed'
            sent_email.error_message = f'SMTP: {error_msg[:500]}'
            sent_email.save()
            raise Exception(f'SMTP помилка: {error_msg}')

    def _send_via_sendgrid(self, request, template, candidate, hr_email, subject, body):
        """Відправка через SendGrid з відправкою від HR"""
        if not SENDGRID_AVAILABLE:
            raise Exception('SendGrid бібліотека не встановлена')

        recipient_email = candidate.email
        hr_name = f"{request.user.first_name} {request.user.last_name}".strip() or request.user.username

        sent_email = SentEmail.objects.create(
            candidate=candidate,
            template=template,
            recipient_email=recipient_email,
            subject=subject,
            body=body,
            sent_by=request.user,
            status='pending'
        )

        try:
            sg = SendGridAPIClient(settings.SENDGRID_API_KEY)

            # В SendGrid можна відправляти від будь-якого email
            from_email = Email(hr_email, name=hr_name)
            to_email = Email(recipient_email)

            message = Mail(
                from_email=from_email,
                to_emails=to_email,
                subject=subject,
                html_content=body
            )

            # Додаємо Reply-To (опціонально)
            message.reply_to = ReplyTo(hr_email)

            response = sg.send(message)

            if response.status_code in [200, 202]:
                sent_email.status = 'sent'
                sent_email.save()

                return Response({
                    'success': True,
                    'message': f'Лист відправлено від {hr_email} на {recipient_email} через SendGrid',
                    'sent_email_id': sent_email.id,
                    'subject': subject,
                    'from_email': hr_email,
                    'status_code': response.status_code,
                })
            else:
                raise Exception(f'SendGrid відповів з кодом {response.status_code}')

        except Exception as e:
            sent_email.status = 'failed'
            sent_email.error_message = str(e)[:500]
            sent_email.save()
            raise Exception(f'SendGrid помилка: {str(e)}')

    def _send_via_console(self, request, template, candidate, hr_email, subject, body):
        """Для розробки - виводимо в консоль"""
        recipient_email = candidate.email
        hr_name = f"{request.user.first_name} {request.user.last_name}".strip() or request.user.username

        sent_email = SentEmail.objects.create(
            candidate=candidate,
            template=template,
            recipient_email=recipient_email,
            subject=subject,
            body=body,
            sent_by=request.user,
            status='sent'  # В консолі одразу позначаємо як відправлений
        )

        print(f"\n{'=' * 60}")
        print(f"📧 ТЕСТОВИЙ ЛИСТ (режим консолі)")
        print(f"{'=' * 60}")
        print(f"Від: {hr_name} <{hr_email}>")
        print(f"Кому: {candidate.first_name} {candidate.last_name} <{recipient_email}>")
        print(f"Тема: {subject}")
        print(f"{'-' * 60}")
        print(f"Тіло листа:")
        print(body)
        print(f"{'=' * 60}\n")

        return Response({
            'success': True,
            'message': f'Тестовий режим: лист не відправлено реально (використовується консольний бекенд)',
            'test_mode': True,
            'sent_email_id': sent_email.id,
            'subject': subject,
            'from_email': hr_email,
        })

    def _send_via_file(self, request, template, candidate, hr_email, subject, body):
        """Для тестування - зберігаємо у файл"""
        recipient_email = candidate.email
        hr_name = f"{request.user.first_name} {request.user.last_name}".strip() or request.user.username

        sent_email = SentEmail.objects.create(
            candidate=candidate,
            template=template,
            recipient_email=recipient_email,
            subject=subject,
            body=body,
            sent_by=request.user,
            status='sent'
        )

        # Використовуємо стандартний Django email бекенд (який налаштований на file)
        from django.core.mail import send_mail
        send_mail(
            subject=subject,
            message=body,
            from_email=hr_email,
            recipient_list=[recipient_email],
            html_message=body,
            fail_silently=False,
        )

        return Response({
            'success': True,
            'message': f'Лист збережено у файл (Email бекенд: {settings.EMAIL_BACKEND})',
            'test_mode': True,
            'sent_email_id': sent_email.id,
            'subject': subject,
            'from_email': hr_email,
        })

    @action(detail=True, methods=['post'])
    def send(self, request, pk=None):
        """
        POST /api/email-templates/{id}/send/
        Body: {"candidate_id": 123}

        Відправляє email від імені поточного HR.
        Підтримує:
        - SendGrid (рекомендовано) - реальна відправка від email HR
        - SMTP - відправка від DEFAULT_FROM_EMAIL з Reply-To на HR
        - Console - для розробки
        - File - для тестування
        """

        try:
            template = self.get_object()
        except Exception:
            return Response(
                {'success': False, 'error': 'Шаблон не знайдено'},
                status=status.HTTP_404_NOT_FOUND
            )

        candidate_id = request.data.get('candidate_id')
        if not candidate_id:
            return Response(
                {'success': False, 'error': 'candidate_id is required'},
                status=status.HTTP_400_BAD_REQUEST
            )

        try:
            candidate = Candidate.objects.get(id=candidate_id, organization=template.organization)
        except Candidate.DoesNotExist:
            return Response(
                {'success': False, 'error': 'Кандидата не знайдено'},
                status=status.HTTP_404_NOT_FOUND
            )

        if not candidate.email:
            return Response(
                {'success': False, 'error': 'У кандидата не вказано email'},
                status=status.HTTP_400_BAD_REQUEST
            )

        # Отримуємо email HR
        hr_email = request.user.email
        if not hr_email:
            return Response(
                {
                    'success': False,
                    'error': 'У вашому профілі не вказано email. Оновіть профіль перед відправкою.'
                },
                status=status.HTTP_400_BAD_REQUEST
            )

        # Генерація subject та body з підстановкою
        vacancy_title = candidate.vacancy.title if candidate.vacancy else '—'
        hr_name = f"{request.user.first_name} {request.user.last_name}".strip() or request.user.username

        subject = template.subject or 'Без теми'
        body = template.body or ''

        replacements = {
            '{{name}}': f"{candidate.first_name} {candidate.last_name}",
            '{{first_name}}': candidate.first_name or '',
            '{{last_name}}': candidate.last_name or '',
            '{{vacancy}}': vacancy_title,
            '{{email}}': candidate.email or '',
            '{{phone}}': candidate.phone or '—',
            '{{status}}': candidate.get_status_display(),
            '{{hr_name}}': hr_name,
            '{{hr_email}}': hr_email,
            '{{organization}}': template.organization.name if template.organization else '—',
            '{{date}}': candidate.created_at.strftime('%d.%m.%Y') if candidate.created_at else '—',
        }

        for placeholder, value in replacements.items():
            subject = subject.replace(placeholder, str(value) if value is not None else '')
            body = body.replace(placeholder, str(value) if value is not None else '')

        # Додаємо інформацію про HR в кінець листа (якщо ще немає)
        if '{{hr_signature}}' in body:
            signature = f"""
            <br><br>
            --<br>
            <strong>{hr_name}</strong><br>
            HR менеджер<br>
            Email: <a href="mailto:{hr_email}">{hr_email}</a>
            """
            body = body.replace('{{hr_signature}}', signature)

        # Визначаємо тип бекенду і відправляємо
        backend_type = getattr(settings, 'EMAIL_BACKEND_TYPE', 'console')

        try:
            if backend_type == 'sendgrid' and settings.SENDGRID_API_KEY:
                return self._send_via_sendgrid(request, template, candidate, hr_email, subject, body)
            elif backend_type == 'smtp':
                return self._send_via_smtp(request, template, candidate, hr_email, subject, body)
            elif backend_type == 'file':
                return self._send_via_file(request, template, candidate, hr_email, subject, body)
            else:  # console або інший
                return self._send_via_console(request, template, candidate, hr_email, subject, body)

        except Exception as e:
            error_msg = str(e)
            return Response(
                {
                    'success': False,
                    'error': error_msg,
                    'backend_type': backend_type,
                    'suggestion': 'Перевірте налаштування email або змініть EMAIL_BACKEND_TYPE'
                },
                status=status.HTTP_502_BAD_GATEWAY
            )

    @action(detail=False, methods=['get'])
    def history(self, request):
        """GET /api/email-templates/history/?candidate=123"""
        role = get_user_role(request.user)

        if role == 'superadmin':
            org_id = request.query_params.get('organization')
            if org_id:
                queryset = SentEmail.objects.filter(candidate__organization_id=org_id)
            else:
                queryset = SentEmail.objects.all()
        else:
            org = get_user_org(request.user)
            if not org:
                queryset = SentEmail.objects.none()
            else:
                queryset = SentEmail.objects.filter(candidate__organization=org)

        candidate_id = request.query_params.get('candidate')
        if candidate_id:
            queryset = queryset.filter(candidate_id=candidate_id)

        template_type = request.query_params.get('template_type')
        if template_type:
            queryset = queryset.filter(template__template_type=template_type)

        page = self.paginate_queryset(queryset.select_related('candidate', 'template', 'sent_by'))
        if page is not None:
            serializer = SentEmailSerializer(page, many=True)
            return self.get_paginated_response(serializer.data)

        serializer = SentEmailSerializer(queryset, many=True)
        return Response(serializer.data)


class SentEmailViewSet(viewsets.ReadOnlyModelViewSet):
    """ViewSet для перегляду історії відправлених листів"""
    serializer_class = SentEmailSerializer
    permission_classes = [IsAuthenticated]
    pagination_class = StandardPagination

    def get_queryset(self):
        role = get_user_role(self.request.user)

        if role == 'superadmin':
            org_id = self.request.query_params.get('organization')
            if org_id:
                return SentEmail.objects.filter(candidate__organization_id=org_id)
            return SentEmail.objects.all()

        org = get_user_org(self.request.user)
        if not org:
            return SentEmail.objects.none()
        return SentEmail.objects.filter(candidate__organization=org)

    def list(self, request, *args, **kwargs):
        """GET /api/sent-emails/ - список всіх відправлених листів"""
        candidate_id = request.query_params.get('candidate')
        template_type = request.query_params.get('template_type')

        queryset = self.get_queryset()
        if candidate_id:
            queryset = queryset.filter(candidate_id=candidate_id)
        if template_type:
            queryset = queryset.filter(template__template_type=template_type)

        queryset = queryset.select_related('candidate', 'template', 'sent_by').order_by('-sent_at')
        page = self.paginate_queryset(queryset)
        if page is not None:
            serializer = self.get_serializer(page, many=True)
            return self.get_paginated_response(serializer.data)
        serializer = self.get_serializer(queryset, many=True)
        return Response(serializer.data)


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def test_email_config(request):
    """Перевірка налаштувань email - корисний ендпоінт для діагностики"""
    return Response({
        'email_backend': settings.EMAIL_BACKEND,
        'email_backend_type': getattr(settings, 'EMAIL_BACKEND_TYPE', 'not_set'),
        'email_host': getattr(settings, 'EMAIL_HOST', None),
        'email_host_user': bool(getattr(settings, 'EMAIL_HOST_USER', None)),
        'has_sendgrid_api_key': bool(getattr(settings, 'SENDGRID_API_KEY', None)),
        'sendgrid_available': SENDGRID_AVAILABLE,
        'is_configured': bool(
            getattr(settings, 'EMAIL_HOST_USER', None) or
            getattr(settings, 'SENDGRID_API_KEY', None) or
            getattr(settings, 'EMAIL_BACKEND_TYPE', '') in ['console', 'file']
        ),
        'default_from_email': getattr(settings, 'DEFAULT_FROM_EMAIL', None),
        'current_user_email': request.user.email,
    })