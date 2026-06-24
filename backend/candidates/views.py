import csv
import logging
from datetime import datetime
from django.db import models
from django.shortcuts import get_object_or_404
from django.http import HttpResponse, JsonResponse
from django.utils import timezone

from rest_framework import serializers, status, viewsets, permissions, generics
from rest_framework.decorators import action, api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework.filters import OrderingFilter
from rest_framework_simplejwt.tokens import RefreshToken
from django_filters.rest_framework import DjangoFilterBackend

from .models import (
    Candidate, EmailTemplate, Organization,
    SentEmail, Tag, User, UserProfile, Vacancy, VacancyTemplate, Interview,
    BlacklistedOrganization, VacancyStage, StatusHistory, RejectionReason,
    HolidayTheme, PricingConfig, PromoCode, PromoCodeUsage,
    VacancyAccess, AuditLog, ModeratorNote,
)
from .serializers import (
    CandidateSerializer, EmailTemplateSerializer, OrganizationSerializer,
    SentEmailSerializer, TagSerializer, VacancySerializer, VacancyTemplateSerializer,
    DuplicateCandidateSerializer, InterviewSerializer, VacancyStageSerializer,
    RejectionReasonSerializer,
    HolidayThemeSerializer, HolidayThemeActivateSerializer, PricingConfigSerializer,
    PromoCodeSerializer, PromoCodeVerifySerializer, PromoCodeApplySerializer,
    VacancyAccessSerializer, AuditLogSerializer, ModeratorNoteSerializer,
)
from .pagination import StandardPagination
from .permissions import IsSuperAdmin, IsOrgMember, IsOrgAdmin, IsModerator
from .services import CandidateService, EmailService, AnalyticsService
from .services.candidate_service import parse_advanced_search
from .utils.export_service import ExportService, FullReportExportService
from .utils.context_processors import (
    get_user_profile, get_user_organization, get_user_role,
    is_superadmin, clear_user_cache
)
from .utils.validators import check_candidate_duplicates, validate_organization_limits
from .utils.csv_handlers import CSVHandler, CSVImportResult

from .constants import KANBAN_COLUMNS, SOURCE_CONFIG

from .job_board_views import VacancyJobBoardMixin

ALLAUTH_AVAILABLE = False
SocialAccount = None

logger = logging.getLogger(__name__)


# ─── TAGS ─────────────────────────────────────────────────────────────────────

class TagViewSet(viewsets.ModelViewSet):
    serializer_class = TagSerializer
    permission_classes = [IsAuthenticated, IsOrgMember]

    def get_queryset(self):
        role = get_user_role(self.request.user)
        if role == 'superadmin':
            org_id = self.request.query_params.get('organization')
            qs = Tag.objects.all()
            return qs.filter(organization_id=org_id) if org_id else qs
        org = get_user_organization(self.request.user)
        return Tag.objects.filter(organization=org) if org else Tag.objects.none()

    def perform_create(self, serializer):
        org = get_user_organization(self.request.user)
        if not org:
            raise serializers.ValidationError({'error': "Користувач не прив'язаний до організації"})
        serializer.save(organization=org)


# ─── VACANCY STAGES (CUSTOM KANBAN COLUMNS) ───────────────────────────────────

class VacancyStageViewSet(viewsets.ModelViewSet):
    serializer_class = VacancyStageSerializer
    permission_classes = [IsAuthenticated, IsOrgMember]

    def get_queryset(self):
        org = get_user_organization(self.request.user)
        role = get_user_role(self.request.user)
        if role == 'superadmin':
            qs = VacancyStage.objects.all()
        else:
            qs = VacancyStage.objects.filter(organization=org)

        vacancy_id = self.request.query_params.get('vacancy')
        org_template = self.request.query_params.get('org_template')

        if vacancy_id:
            vacancy = Vacancy.objects.filter(pk=vacancy_id).first()
            if vacancy:
                return VacancyStage.get_for_vacancy(vacancy)
        elif org_template:
            return qs.filter(vacancy=None)

        return qs.order_by('order', 'id')

    def perform_create(self, serializer):
        org = get_user_organization(self.request.user)
        if not org:
            raise serializers.ValidationError({'error': "Користувач не прив'язаний до організації"})
        serializer.save(organization=org)

    @action(detail=False, methods=['post'], url_path='reorder')
    def reorder(self, request):
        ordered_ids = request.data.get('ordered_ids', [])
        if not ordered_ids:
            return Response({'error': 'ordered_ids required'}, status=status.HTTP_400_BAD_REQUEST)

        org = get_user_organization(request.user)
        stages = VacancyStage.objects.filter(id__in=ordered_ids, organization=org)
        stage_map = {s.id: s for s in stages}

        for order, stage_id in enumerate(ordered_ids):
            if stage_id in stage_map:
                stage_map[stage_id].order = order
                stage_map[stage_id].save(update_fields=['order'])

        return Response({'ok': True})

    @action(detail=False, methods=['post'], url_path='reset_to_org')
    def reset_to_org(self, request):
        vacancy_id = request.data.get('vacancy_id')
        if not vacancy_id:
            return Response({'error': 'vacancy_id required'}, status=status.HTTP_400_BAD_REQUEST)

        org = get_user_organization(request.user)
        VacancyStage.objects.filter(vacancy_id=vacancy_id, organization=org).delete()

        vacancy = Vacancy.objects.filter(pk=vacancy_id, organization=org).first()
        if not vacancy:
            return Response({'error': 'Vacancy not found'}, status=status.HTTP_404_NOT_FOUND)

        stages = VacancyStage.get_for_vacancy(vacancy)
        return Response(VacancyStageSerializer(stages, many=True).data)


# ─── VACANCIES ────────────────────────────────────────────────────────────────

class VacancyViewSet(VacancyJobBoardMixin, viewsets.ModelViewSet):
    serializer_class = VacancySerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        user = self.request.user
        try:
            role = user.profile.role
            org  = user.profile.organization
            if role == 'superadmin':
                return Vacancy.objects.all()
            if role in ['admin', 'moderator']:
                # Модератор бачить всі вакансії організації
                return Vacancy.objects.filter(organization=org)
            # HR — тільки свої (owner) + делеговані
            from django.db.models import Q as DQ
            delegated_ids = VacancyAccess.objects.filter(
                user=user
            ).values_list('vacancy_id', flat=True)
            return Vacancy.objects.filter(organization=org).filter(
                DQ(owner=user) | DQ(id__in=delegated_ids)
            )
        except Exception:
            return Vacancy.objects.none()

    def perform_create(self, serializer):
        role = get_user_role(self.request.user)
        if role == 'moderator':
            return Response(
                {'error': 'Модератор не може створювати вакансії'},
                status=status.HTTP_403_FORBIDDEN
            )
        try:
            org = self.request.user.profile.organization
            serializer.save(organization=org, owner=self.request.user)
        except Exception:
            serializer.save()

    # ── Блокування вакансії ────────────────────────────────────────────────────

    @action(detail=True, methods=['post'], url_path='block',
            permission_classes=[IsAuthenticated, IsModerator])
    def block_vacancy(self, request, pk=None):
        """Заблокувати вакансію. Доступно модератору, адміну, суперадміну."""
        vacancy = self.get_object()
        if vacancy.is_blocked:
            return Response({'detail': 'Вакансія вже заблокована.'}, status=status.HTTP_400_BAD_REQUEST)

        reason = request.data.get('reason', '').strip()
        vacancy.is_blocked = True
        vacancy.blocked_by = request.user
        vacancy.blocked_at = timezone.now()
        vacancy.block_reason = reason
        vacancy.save(update_fields=['is_blocked', 'blocked_by', 'blocked_at', 'block_reason'])

        from .utils.audit import log_action
        log_action(request.user, 'block', vacancy, {'reason': reason}, request)

        return Response(VacancySerializer(vacancy, context={'request': request}).data)

    @action(detail=True, methods=['post'], url_path='unblock',
            permission_classes=[IsAuthenticated, IsModerator])
    def unblock_vacancy(self, request, pk=None):
        """Розблокувати вакансію."""
        vacancy = self.get_object()
        if not vacancy.is_blocked:
            return Response({'detail': 'Вакансія не заблокована.'}, status=status.HTTP_400_BAD_REQUEST)

        vacancy.is_blocked = False
        vacancy.blocked_by = None
        vacancy.blocked_at = None
        vacancy.block_reason = ''
        vacancy.save(update_fields=['is_blocked', 'blocked_by', 'blocked_at', 'block_reason'])

        from .utils.audit import log_action
        log_action(request.user, 'unblock', vacancy, {}, request)

        return Response(VacancySerializer(vacancy, context={'request': request}).data)

    @action(detail=True, methods=['post', 'delete'], url_path='access')
    def manage_access(self, request, pk=None):
        """POST: надати HR доступ до вакансії. DELETE: відкликати. Body: {user_id: 5}"""
        vacancy = self.get_object()
        try:
            role = request.user.profile.role
        except Exception:
            role = None
        if role not in ['admin', 'superadmin']:
            return Response(
                {'error': 'Тільки адміністратор може керувати доступом'},
                status=status.HTTP_403_FORBIDDEN
            )
        user_id = request.data.get('user_id')
        if not user_id:
            return Response({'error': 'user_id обов\'язковий'}, status=status.HTTP_400_BAD_REQUEST)
        try:
            target = User.objects.get(id=user_id)
        except User.DoesNotExist:
            return Response({'error': 'Користувача не знайдено'}, status=status.HTTP_404_NOT_FOUND)
        if request.method == 'POST':
            obj, created = VacancyAccess.objects.get_or_create(
                vacancy=vacancy, user=target,
                defaults={'granted_by': request.user}
            )
            from .utils.audit import log_action
            log_action(request.user, 'access_grant', vacancy,
                       {'target_user': target.username}, request)
            return Response({
                'status': 'granted' if created else 'already_exists',
                'user': target.username,
                'vacancy': vacancy.title,
            })
        elif request.method == 'DELETE':
            deleted, _ = VacancyAccess.objects.filter(vacancy=vacancy, user=target).delete()
            from .utils.audit import log_action
            log_action(request.user, 'access_revoke', vacancy,
                       {'target_user': target.username}, request)
            return Response({
                'status': 'revoked' if deleted else 'not_found',
                'user': target.username,
            })

    @action(detail=True, methods=['get'], url_path='access-list')
    def list_access(self, request, pk=None):
        vacancy = self.get_object()
        accesses = VacancyAccess.objects.filter(vacancy=vacancy).select_related('user', 'granted_by')
        from .serializers import VacancyAccessSerializer
        return Response(VacancyAccessSerializer(accesses, many=True).data)

    @action(detail=True, methods=['post'], url_path='save_as_template')
    def save_as_template(self, request, pk=None):
        vacancy = self.get_object()
        name = request.data.get('name', '').strip()
        category = request.data.get('category', 'other')

        if not name:
            return Response({'error': 'Вкажіть назву шаблону'}, status=status.HTTP_400_BAD_REQUEST)

        try:
            org = request.user.profile.organization
        except Exception:
            return Response({'error': "Користувач не прив'язаний до організації"}, status=status.HTTP_400_BAD_REQUEST)

        template = VacancyTemplate.objects.create(
            organization=org,
            name=name,
            category=category,
            title=vacancy.title,
            department=vacancy.department,
            description=vacancy.description,
            requirements=vacancy.requirements,
            city=vacancy.city,
            employment_type=vacancy.employment_type,
        )
        return Response(VacancyTemplateSerializer(template).data, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=['get'], url_path='stages')
    def stages(self, request, pk=None):
        vacancy = self.get_object()
        stages = VacancyStage.get_for_vacancy(vacancy)
        return Response(VacancyStageSerializer(stages, many=True).data)

    @action(detail=True, methods=['post'], url_path='copy_org_stages')
    def copy_org_stages(self, request, pk=None):
        vacancy = self.get_object()
        VacancyStage.copy_org_template_to_vacancy(vacancy)
        stages = VacancyStage.objects.filter(vacancy=vacancy).order_by('order', 'id')
        return Response(VacancyStageSerializer(stages, many=True).data, status=status.HTTP_201_CREATED)


# ─── VACANCY TEMPLATES ────────────────────────────────────────────────────────

class VacancyTemplateViewSet(viewsets.ModelViewSet):
    serializer_class = VacancyTemplateSerializer
    permission_classes = [IsAuthenticated, IsOrgMember]

    def get_queryset(self):
        role = get_user_role(self.request.user)
        if role == 'superadmin':
            org_id = self.request.query_params.get('organization')
            qs = VacancyTemplate.objects.all()
            return qs.filter(organization_id=org_id) if org_id else qs
        org = get_user_organization(self.request.user)
        if not org:
            return VacancyTemplate.objects.none()
        qs = VacancyTemplate.objects.filter(organization=org)
        category = self.request.query_params.get('category')
        if category:
            qs = qs.filter(category=category)
        return qs

    def perform_create(self, serializer):
        org = get_user_organization(self.request.user)
        if not org:
            raise serializers.ValidationError({'error': "Користувач не прив'язаний до організації"})
        serializer.save(organization=org)


# ─── ORGANIZATIONS ────────────────────────────────────────────────────────────

class OrganizationViewSet(viewsets.ModelViewSet):
    queryset = Organization.objects.all().order_by('id')
    serializer_class = OrganizationSerializer
    permission_classes = [IsAuthenticated, IsSuperAdmin]

    def perform_create(self, serializer):
        name = serializer.validated_data.get('name', '')
        if BlacklistedOrganization.objects.filter(name__iexact=name.strip()).exists():
            raise serializers.ValidationError({
                'name': f'Організація "{name}" знаходиться в чорному списку і не може бути створена.'
            })
        serializer.save()

    def perform_update(self, serializer):
        name = serializer.validated_data.get('name', serializer.instance.name)
        if serializer.instance.name.lower() != name.strip().lower() and \
                BlacklistedOrganization.objects.filter(name__iexact=name.strip()).exists():
            raise serializers.ValidationError({
                'name': f'Організація "{name}" знаходиться в чорному списку.'
            })
        serializer.save()


# ─── BLACKLIST ─────────────────────────────────────────────────────────────────

class BlacklistSerializer(serializers.ModelSerializer):
    added_by_username = serializers.SerializerMethodField()

    class Meta:
        model = BlacklistedOrganization
        fields = ['id', 'name', 'reason', 'added_by', 'added_by_username', 'created_at']
        read_only_fields = ['added_by', 'added_by_username', 'created_at']

    def get_added_by_username(self, obj):
        return obj.added_by.get_full_name() or obj.added_by.username if obj.added_by else '—'


class BlacklistViewSet(viewsets.ModelViewSet):
    queryset = BlacklistedOrganization.objects.all().order_by('-created_at')
    serializer_class = BlacklistSerializer
    # Модератор може переглядати та керувати blacklist
    permission_classes = [IsAuthenticated, IsModerator]

    def perform_create(self, serializer):
        serializer.save(added_by=self.request.user)


# ─── MODERATOR NOTES ──────────────────────────────────────────────────────────

class ModeratorNoteViewSet(viewsets.ModelViewSet):
    """
    CRUD для нотаток модератора.
    Читати можуть: moderator, admin, superadmin.
    Створювати/редагувати/видаляти — тільки moderator, admin, superadmin.
    """
    serializer_class = ModeratorNoteSerializer
    permission_classes = [IsAuthenticated, IsModerator]
    pagination_class = StandardPagination

    def get_queryset(self):
        role = get_user_role(self.request.user)
        if role == 'superadmin':
            qs = ModeratorNote.objects.select_related('author', 'candidate', 'vacancy').all()
        else:
            org = get_user_organization(self.request.user)
            if not org:
                return ModeratorNote.objects.none()
            # Нотатки до кандидатів або вакансій цієї організації
            qs = ModeratorNote.objects.filter(
                models.Q(candidate__organization=org) |
                models.Q(vacancy__organization=org)
            ).select_related('author', 'candidate', 'vacancy')

        # Фільтр по кандидату або вакансії
        candidate_id = self.request.query_params.get('candidate')
        vacancy_id = self.request.query_params.get('vacancy')
        if candidate_id:
            qs = qs.filter(candidate_id=candidate_id)
        if vacancy_id:
            qs = qs.filter(vacancy_id=vacancy_id)
        return qs

    def perform_create(self, serializer):
        serializer.save(author=self.request.user)

    def perform_update(self, serializer):
        # Тільки автор або admin/superadmin може редагувати
        role = get_user_role(self.request.user)
        if role not in ['admin', 'superadmin'] and serializer.instance.author != self.request.user:
            raise serializers.ValidationError({'error': 'Ви можете редагувати тільки свої нотатки.'})
        serializer.save()

    def perform_destroy(self, instance):
        role = get_user_role(self.request.user)
        if role not in ['admin', 'superadmin'] and instance.author != self.request.user:
            raise serializers.ValidationError({'error': 'Ви можете видаляти тільки свої нотатки.'})
        instance.delete()


# ─── CANDIDATES ───────────────────────────────────────────────────────────────

class CandidateViewSet(viewsets.ModelViewSet):
    serializer_class = CandidateSerializer
    permission_classes = [IsAuthenticated, IsOrgMember]
    pagination_class = StandardPagination

    def get_queryset(self):
        q = self.request.query_params.get('q', '').strip()
        filters = {
            'organization_id': self.request.query_params.get('organization'),
            'vacancy_id': self.request.query_params.get('vacancy'),
            'status': self.request.query_params.get('status'),
            'source': self.request.query_params.get('source'),
            'assigned_to_id': self.request.query_params.get('assigned_to'),
            'mine': self.request.query_params.get('mine'),
            'user': self.request.user,
            'search': self.request.query_params.get('search'),
            'tag_ids': [int(t) for t in self.request.query_params.get('tags', '').split(',') if t.isdigit()]
            if self.request.query_params.get('tags') else None,
            'advanced': parse_advanced_search(q) if q else None,
        }
        # Модератор бачить всіх кандидатів організації (як admin)
        role = get_user_role(self.request.user)
        if role == 'moderator':
            filters['_moderator_override'] = True
        qs = CandidateService.get_queryset_for_user(self.request.user, filters)
        return CandidateService.apply_filters(qs, filters)

    def perform_create(self, serializer):
        role = get_user_role(self.request.user)
        if role == 'moderator':
            raise serializers.ValidationError({'error': 'Модератор не може створювати кандидатів.'})
        org = get_user_organization(self.request.user)
        tag_ids = serializer.validated_data.pop('tag_ids', [])

        has_dup, dup_candidate, match_by = check_candidate_duplicates(
            email=serializer.validated_data.get('email', ''),
            phone=serializer.validated_data.get('phone', ''),
            organization=org,
        )

        if has_dup:
            raise serializers.ValidationError({
                'duplicate': True,
                'duplicate_by': match_by,
                'duplicate_candidate': DuplicateCandidateSerializer(dup_candidate).data,
                'message': f'Кандидат вже існує: {dup_candidate.first_name} {dup_candidate.last_name}'
            })

        candidate = serializer.save(organization=org)
        if tag_ids:
            candidate.tags.set(tag_ids)

    # ── Блокування кандидата ───────────────────────────────────────────────────

    @action(detail=True, methods=['post'], url_path='block',
            permission_classes=[IsAuthenticated, IsModerator])
    def block_candidate(self, request, pk=None):
        """Заблокувати кандидата. Доступно модератору, адміну, суперадміну."""
        candidate = self.get_object()
        if candidate.is_blocked:
            return Response({'detail': 'Кандидат вже заблокований.'}, status=status.HTTP_400_BAD_REQUEST)

        reason = request.data.get('reason', '').strip()
        candidate.is_blocked = True
        candidate.blocked_by = request.user
        candidate.blocked_at = timezone.now()
        candidate.block_reason = reason
        candidate.save(update_fields=['is_blocked', 'blocked_by', 'blocked_at', 'block_reason'])

        from .utils.audit import log_action
        log_action(request.user, 'block', candidate, {'reason': reason}, request)

        return Response(CandidateSerializer(candidate, context={'request': request}).data)

    @action(detail=True, methods=['post'], url_path='unblock',
            permission_classes=[IsAuthenticated, IsModerator])
    def unblock_candidate(self, request, pk=None):
        """Розблокувати кандидата."""
        candidate = self.get_object()
        if not candidate.is_blocked:
            return Response({'detail': 'Кандидат не заблокований.'}, status=status.HTTP_400_BAD_REQUEST)

        candidate.is_blocked = False
        candidate.blocked_by = None
        candidate.blocked_at = None
        candidate.block_reason = ''
        candidate.save(update_fields=['is_blocked', 'blocked_by', 'blocked_at', 'block_reason'])

        from .utils.audit import log_action
        log_action(request.user, 'unblock', candidate, {}, request)

        return Response(CandidateSerializer(candidate, context={'request': request}).data)

    @action(detail=True, methods=['patch'], url_path='update_status')
    def update_status(self, request, pk=None):
        candidate = self.get_object()
        stage_id = request.data.get('stage_id')
        system_key = request.data.get('status')

        if stage_id:
            new_stage = VacancyStage.objects.filter(pk=stage_id).first()
            if not new_stage:
                return Response({'error': 'Stage not found'}, status=status.HTTP_404_NOT_FOUND)
        elif system_key:
            if candidate.vacancy:
                stages = VacancyStage.get_for_vacancy(candidate.vacancy)
                new_stage = stages.filter(system_key=system_key).first()
            else:
                org = get_user_organization(request.user)
                new_stage = VacancyStage.objects.filter(
                    organization=org, system_key=system_key, vacancy=None
                ).first()
            if not new_stage:
                return Response({'error': f'Stage with system_key={system_key} not found'}, status=status.HTTP_404_NOT_FOUND)
        else:
            return Response({'error': 'stage_id or status required'}, status=status.HTTP_400_BAD_REQUEST)

        rejection_reason = None
        rejection_comment = ''
        if new_stage.system_key == 'rejected':
            rejection_reason_id = request.data.get('rejection_reason_id')
            rejection_comment = request.data.get('rejection_comment', '')
            if not rejection_reason_id:
                return Response(
                    {'error': 'rejection_reason_id is required for rejected stage'},
                    status=status.HTTP_400_BAD_REQUEST
                )
            rejection_reason = RejectionReason.objects.filter(pk=rejection_reason_id).first()
            if not rejection_reason:
                return Response({'error': 'RejectionReason not found'}, status=status.HTTP_404_NOT_FOUND)

        old_stage = candidate.stage

        StatusHistory.objects.create(
            candidate=candidate,
            old_stage=old_stage,
            new_stage=new_stage,
            old_status=old_stage.name if old_stage else '',
            new_status=new_stage.name,
            changed_by=request.user,
            rejection_reason=rejection_reason,
            rejection_comment=rejection_comment,
        )

        candidate.stage = new_stage
        candidate.save(update_fields=['stage'])

        from .utils.audit import log_action
        log_action(request.user, 'status_change', candidate, {
            'from': old_stage.name if old_stage else None,
            'to': new_stage.name,
        }, request)

        try:
            from asgiref.sync import async_to_sync
            from channels.layers import get_channel_layer

            channel_layer = get_channel_layer()
            if channel_layer:
                message = {
                    'type':         'kanban.move',
                    'candidate_id': candidate.id,
                    'stage_id':     new_stage.id,
                    'moved_by':     request.user.username,
                }
                groups = ['kanban_org']
                if candidate.vacancy_id:
                    groups.append(f'kanban_{candidate.vacancy_id}')
                for group_name in groups:
                    logger.info(
                        f'WS broadcast: group={group_name}, '
                        f'candidate_id={candidate.id}, stage_id={new_stage.id}'
                    )
                    async_to_sync(channel_layer.group_send)(group_name, message)
                logger.info('WS broadcast: group_send completed without error')
        except Exception as ws_err:
            logger.warning(f'WS broadcast failed: {ws_err}')

        return Response(CandidateSerializer(candidate, context={'request': request}).data)

    @action(detail=True, methods=['patch'], url_path='assign')
    def assign(self, request, pk=None):
        candidate = self.get_object()
        user_id = request.data.get('assigned_to')
        if user_id is None:
            candidate = CandidateService.assign_to_hr(candidate, None)
        else:
            try:
                hr_user = User.objects.get(id=user_id)
                candidate = CandidateService.assign_to_hr(candidate, hr_user)
            except User.DoesNotExist:
                return Response({'error': 'User not found'}, status=status.HTTP_404_NOT_FOUND)
        from .utils.audit import log_action
        log_action(request.user, 'assign', candidate, {
            'assigned_to': hr_user.username if user_id else None,
        }, request)
        return Response(CandidateSerializer(candidate).data)

    @action(detail=False, methods=['post'], url_path='check-duplicate')
    def check_duplicate(self, request):
        email = request.data.get('email', '').strip()
        phone = request.data.get('phone', '').strip()
        if not email and not phone:
            return Response({'error': "Email або телефон обов'язкові"}, status=status.HTTP_400_BAD_REQUEST)
        org = get_user_organization(request.user)
        has_dup, dup_candidate, match_by = check_candidate_duplicates(email, phone, org)
        return Response({
            'has_duplicate': has_dup,
            'duplicate_by': match_by if has_dup else None,
            'duplicate_candidate': DuplicateCandidateSerializer(dup_candidate).data if dup_candidate else None,
        })

    @action(detail=False, methods=['post'], url_path='import-csv')
    def import_csv(self, request):
        csv_file = request.FILES.get('file')
        if not csv_file:
            return Response({'error': "Файл CSV обов'язковий"}, status=status.HTTP_400_BAD_REQUEST)

        org = get_user_organization(request.user)
        if not org:
            return Response({'error': "Користувач не прив'язаний до організації"}, status=status.HTTP_400_BAD_REQUEST)

        rows, fieldnames, error = CSVHandler.read_csv_file(csv_file)
        if error:
            return Response({'error': error}, status=status.HTTP_400_BAD_REQUEST)

        column_mapping = CSVHandler.detect_column_mapping(fieldnames)
        if 'first_name' not in column_mapping or 'last_name' not in column_mapping or 'email' not in column_mapping:
            return Response({'error': 'CSV має містити колонки: first_name, last_name, email'},
                            status=status.HTTP_400_BAD_REQUEST)

        result = CSVImportResult()
        for row_num, row in enumerate(rows, start=2):
            try:
                first_name = row.get(column_mapping.get('first_name', ''), '').strip()
                last_name = row.get(column_mapping.get('last_name', ''), '').strip()
                email = row.get(column_mapping.get('email', ''), '').strip().lower()
                phone = row.get(column_mapping.get('phone', ''), '').strip()
                vacancy_title = row.get(column_mapping.get('vacancy', ''), '').strip()
                status_val = row.get(column_mapping.get('status', ''), 'new').strip().lower()
                source_val = row.get(column_mapping.get('source', ''), 'csv').strip().lower()
                notes = row.get(column_mapping.get('notes', ''), '').strip()

                if not first_name or not last_name or not email:
                    result.errors.append({'row': row_num, 'error': "Ім'я, прізвище та email обов'язкові"})
                    continue

                has_dup, dup_candidate, match_by = check_candidate_duplicates(email, phone, org)
                if has_dup:
                    result.duplicates.append(
                        {'row': row_num, 'candidate': DuplicateCandidateSerializer(dup_candidate).data,
                         'matched_by': match_by})
                    continue

                vacancy = Vacancy.objects.filter(organization=org,
                                                 title__iexact=vacancy_title).first() if vacancy_title else None
                valid_statuses = [s[0] for s in Candidate.STATUS_CHOICES]
                valid_sources = [s[0] for s in Candidate.SOURCE_CHOICES]

                Candidate.objects.create(
                    organization=org, first_name=first_name, last_name=last_name, email=email, phone=phone,
                    vacancy=vacancy, status=status_val if status_val in valid_statuses else 'new',
                    source=source_val if source_val in valid_sources else 'csv', notes=notes,
                )
                result.created += 1
            except Exception as e:
                result.errors.append({'row': row_num, 'error': str(e)})

        return Response(result.to_dict())

    # ── CV upload / delete ─────────────────────────────────────────────────────

    @action(detail=True, methods=['post', 'delete'], url_path='cv',
            parser_classes=None)  # parser_classes=None → використовує глобальні (multipart + json)
    def cv(self, request, pk=None):
        """
        POST  /api/candidates/{id}/cv/  — завантажити/замінити CV (multipart/form-data, поле "file")
        DELETE /api/candidates/{id}/cv/ — видалити CV
        """
        from rest_framework.parsers import MultiPartParser, FormParser
        candidate = self.get_object()

        # Модератор не може керувати CV
        role = get_user_role(request.user)
        if role == 'moderator':
            return Response(
                {'error': 'Модератор не може керувати CV кандидата.'},
                status=status.HTTP_403_FORBIDDEN,
            )

        if request.method == 'DELETE':
            if not candidate.cv_file:
                return Response({'error': 'CV відсутнє.'}, status=status.HTTP_400_BAD_REQUEST)
            # Видаляємо фізичний файл
            candidate.cv_file.delete(save=False)
            candidate.cv_file = None
            candidate.cv_original_name = ''
            candidate.cv_uploaded_at = None
            candidate.save(update_fields=['cv_file', 'cv_original_name', 'cv_uploaded_at'])

            from .utils.audit import log_action
            log_action(request.user, 'cv_delete', candidate, {}, request)

            return Response({'ok': True, 'detail': 'CV видалено.'})

        # POST — завантаження
        uploaded = request.FILES.get('file')
        if not uploaded:
            return Response({'error': "Поле 'file' обов'язкове."}, status=status.HTTP_400_BAD_REQUEST)

        # Валідація типу
        ALLOWED_TYPES = (
            'application/pdf',
            'application/msword',
            'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        )
        ALLOWED_EXT = ('.pdf', '.doc', '.docx')
        import os
        ext = os.path.splitext(uploaded.name)[1].lower()
        if uploaded.content_type not in ALLOWED_TYPES and ext not in ALLOWED_EXT:
            return Response(
                {'error': 'Дозволені тільки PDF, DOC, DOCX файли.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        # Валідація розміру (10 МБ)
        MAX_SIZE = 10 * 1024 * 1024
        if uploaded.size > MAX_SIZE:
            return Response(
                {'error': 'Розмір файлу не може перевищувати 10 МБ.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        # Видаляємо старий файл якщо є
        if candidate.cv_file:
            candidate.cv_file.delete(save=False)

        candidate.cv_file = uploaded
        candidate.cv_original_name = uploaded.name
        candidate.cv_uploaded_at = timezone.now()
        candidate.save(update_fields=['cv_file', 'cv_original_name', 'cv_uploaded_at'])

        from .utils.audit import log_action
        log_action(request.user, 'cv_upload', candidate, {'filename': uploaded.name}, request)

        return Response(
            CandidateSerializer(candidate, context={'request': request}).data,
            status=status.HTTP_200_OK,
        )


# ─── CANDIDATES CSV EXPORT ────────────────────────────────────────────────────

class CandidateExportCSVView(APIView):
    permission_classes = [IsAuthenticated, IsOrgMember]

    STATUS_LABELS = {'new': 'Новий', 'screening': 'Скринінг', 'interview': 'Співбесіда', 'offer': 'Оффер',
                     'rejected': 'Відмова'}

    def get(self, request):
        q = request.query_params.get('q', '').strip()
        filters = {'organization_id': request.query_params.get('organization'),
                   'vacancy_id': request.query_params.get('vacancy'),
                   'status': request.query_params.get('status'), 'source': request.query_params.get('source'),
                   'search': request.query_params.get('search'),
                   'tag_ids': [int(t) for t in request.query_params.get('tags', '').split(',') if t.isdigit()]
                   if request.query_params.get('tags') else None,
                   'advanced': parse_advanced_search(q) if q else None}
        qs = CandidateService.get_queryset_for_user(request.user, filters)
        qs = CandidateService.apply_filters(qs, filters)

        def extractor(c):
            return [c.id, c.first_name or '', c.last_name or '', c.email or '', c.phone or '',
                    c.vacancy.title if c.vacancy else '—', c.organization.name if c.organization else '—',
                    self.STATUS_LABELS.get(c.status, c.status), c.get_source_display() if c.source else '—',
                    ', '.join([t.name for t in c.tags.all()]), (c.notes or '').replace('\n', ' ').replace('\r', ''),
                    c.created_at.strftime('%d.%m.%Y %H:%M') if c.created_at else '—']

        headers = ['ID', "Ім'я", 'Прізвище', 'Email', 'Телефон', 'Вакансія', 'Організація', 'Статус', 'Джерело',
                   'Теги', 'Нотатки', 'Дата створення']
        return CSVHandler.export_queryset_to_csv(qs, 'candidates.csv', headers, extractor)


# ─── INTERVIEWS ───────────────────────────────────────────────────────────────

    def perform_destroy(self, instance):
        from .utils.audit import log_action
        log_action(self.request.user, 'delete', instance, {}, self.request)
        instance.delete()


class InterviewViewSet(viewsets.ModelViewSet):
    serializer_class = InterviewSerializer
    permission_classes = [IsAuthenticated, IsOrgMember]

    def get_queryset(self):
        role = get_user_role(self.request.user)
        if role == 'superadmin':
            org_id = self.request.query_params.get('organization')
            qs = Interview.objects.select_related(
                'candidate', 'vacancy', 'organization', 'created_by'
            ).prefetch_related('interviewers')
            return qs.filter(organization_id=org_id) if org_id else qs
        org = get_user_organization(self.request.user)
        if not org:
            return Interview.objects.none()
        qs = Interview.objects.filter(organization=org).select_related(
            'candidate', 'vacancy', 'organization', 'created_by'
        ).prefetch_related('interviewers')
        candidate_id = self.request.query_params.get('candidate')
        vacancy_id = self.request.query_params.get('vacancy')
        status_f = self.request.query_params.get('status')
        date_from = self.request.query_params.get('date_from')
        date_to = self.request.query_params.get('date_to')
        if candidate_id:
            qs = qs.filter(candidate_id=candidate_id)
        if vacancy_id:
            qs = qs.filter(vacancy_id=vacancy_id)
        if status_f:
            qs = qs.filter(status=status_f)
        if date_from:
            qs = qs.filter(scheduled_at__date__gte=date_from)
        if date_to:
            qs = qs.filter(scheduled_at__date__lte=date_to)
        return qs

    def perform_create(self, serializer):
        org = get_user_organization(self.request.user)
        interview = serializer.save(organization=org)
        self._sync_google_create(interview)

    def perform_update(self, serializer):
        interview = serializer.save()
        self._sync_google_update(interview)

    def perform_destroy(self, instance):
        self._sync_google_delete(instance)
        instance.delete()

    def _sync_google_create(self, interview):
        from .utils.google_calendar_service import create_calendar_event
        result = create_calendar_event(interview, self.request.user)
        if result:
            Interview.objects.filter(pk=interview.pk).update(**result)

    def _sync_google_update(self, interview):
        from .utils.google_calendar_service import update_calendar_event
        result = update_calendar_event(interview, self.request.user)
        if result:
            Interview.objects.filter(pk=interview.pk).update(**result)

    def _sync_google_delete(self, interview):
        from .utils.google_calendar_service import delete_calendar_event
        delete_calendar_event(interview, self.request.user)

    @action(detail=True, methods=['post'], url_path='sync-google')
    def sync_google(self, request, pk=None):
        interview = self.get_object()
        from .utils.google_calendar_service import update_calendar_event, create_calendar_event
        if interview.google_event_id:
            result = update_calendar_event(interview, request.user)
        else:
            result = create_calendar_event(interview, request.user)
        if result:
            for field, value in result.items():
                setattr(interview, field, value)
            interview.save(update_fields=list(result.keys()))
            return Response(InterviewSerializer(interview, context={'request': request}).data)
        return Response(
            {'warning': "Не вдалося синхронізувати з Google Calendar. Інтерв'ю збережено."},
            status=status.HTTP_200_OK
        )

    @action(detail=True, methods=['patch'], url_path='change-status')
    def change_status(self, request, pk=None):
        interview = self.get_object()
        new_status = request.data.get('status')
        if new_status not in dict(Interview.STATUS_CHOICES):
            return Response({'error': 'Невірний статус'}, status=status.HTTP_400_BAD_REQUEST)
        interview.status = new_status
        interview.save(update_fields=['status'])
        return Response(InterviewSerializer(interview, context={'request': request}).data)


# ─── REJECTION REASONS ────────────────────────────────────────────────────────

class RejectionReasonViewSet(viewsets.ModelViewSet):
    serializer_class = RejectionReasonSerializer
    permission_classes = [IsAuthenticated, IsOrgMember]

    def get_queryset(self):
        org = get_user_organization(self.request.user)
        return RejectionReason.objects.filter(organization=org, is_active=True)

    def perform_create(self, serializer):
        org = get_user_organization(self.request.user)
        RejectionReason.get_or_create_defaults(org)
        serializer.save(organization=org)


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def rejection_analytics(request):
    org = get_user_organization(request.user)
    vacancy_id = request.query_params.get('vacancy')
    date_from = request.query_params.get('date_from')
    date_to = request.query_params.get('date_to')

    qs = StatusHistory.objects.filter(
        candidate__organization=org,
        new_stage__system_key='rejected',
        rejection_reason__isnull=False,
    )
    if vacancy_id:
        qs = qs.filter(candidate__vacancy_id=vacancy_id)
    if date_from:
        qs = qs.filter(changed_at__date__gte=date_from)
    if date_to:
        qs = qs.filter(changed_at__date__lte=date_to)

    from django.db.models import Count
    data = (
        qs.values('rejection_reason__name')
          .annotate(count=Count('id'))
          .order_by('-count')
    )
    total = qs.count()
    return Response({
        'total': total,
        'breakdown': [
            {
                'reason': item['rejection_reason__name'],
                'count': item['count'],
                'percent': round(item['count'] / total * 100, 1) if total else 0,
            }
            for item in data
        ]
    })


# ─── CURRENT USER ─────────────────────────────────────────────────────────────


# ─── AUDIT LOG ────────────────────────────────────────────────────────────────
class AuditLogView(generics.ListAPIView):
    """
    Перегляд логів дій.
    Доступно: admin, superadmin, moderator.
    Модератор бачить повну історію своєї організації.
    """
    serializer_class = AuditLogSerializer
    permission_classes = [IsAuthenticated, IsModerator]
    filter_backends = [DjangoFilterBackend, OrderingFilter]
    filterset_fields = ['action', 'model_name', 'user']
    ordering_fields = ['created_at']
    ordering = ['-created_at']

    def get_queryset(self):
        role = get_user_role(self.request.user)
        if role == 'superadmin':
            return AuditLog.objects.select_related('user', 'organization').all()
        org = get_user_organization(self.request.user)
        return AuditLog.objects.filter(organization=org).select_related('user', 'organization')

@api_view(['GET'])
@permission_classes([IsAuthenticated])
def current_user(request):
    user = request.user
    profile = get_user_profile(user)
    org = profile.organization if profile else None
    return Response({
        'id': user.id, 'username': user.username, 'first_name': user.first_name, 'last_name': user.last_name,
        'email': user.email, 'role': profile.role if profile else None,
        'organization': {'id': org.id, 'name': org.name, 'max_vacancies': org.max_vacancies,
                         'max_hr': org.max_hr} if org else None,
    })


# ─── USERS ────────────────────────────────────────────────────────────────────

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
            user_org = get_user_organization(request.user)
            if not user_org:
                return Response([], status=status.HTTP_200_OK)
            profiles = UserProfile.objects.filter(organization=user_org).select_related('user')
        return Response([{'id': p.user.id, 'username': p.user.username, 'first_name': p.user.first_name,
                          'last_name': p.user.last_name, 'email': p.user.email, 'role': p.role,
                          'profile_id': p.id} for p in profiles])

    @action(detail=False, methods=['get'])
    def all(self, request):
        if not is_superadmin(request.user):
            return Response({'error': 'Forbidden'}, status=status.HTTP_403_FORBIDDEN)
        data = []
        for u in User.objects.all().select_related('profile__organization'):
            profile = get_user_profile(u)
            org = profile.organization if profile else None
            data.append({'id': u.id, 'username': u.username, 'first_name': u.first_name, 'last_name': u.last_name,
                         'email': u.email, 'role': profile.role if profile else None,
                         'organization_id': org.id if org else None, 'organization_name': org.name if org else None})
        return Response(data)

    def create(self, request):
        username, password = request.data.get('username'), request.data.get('password')
        if not username or not password:
            return Response({'error': "username та password обов'язкові"}, status=status.HTTP_400_BAD_REQUEST)
        if User.objects.filter(username=username).exists():
            return Response({'error': 'Username вже існує'}, status=status.HTTP_400_BAD_REQUEST)

        org_id, role = request.data.get('organization'), request.data.get('role', 'hr')
        if org_id and role == 'hr':
            try:
                org = Organization.objects.get(id=org_id)
            except Organization.DoesNotExist:
                return Response({'error': 'Організацію не знайдено'}, status=status.HTTP_404_NOT_FOUND)
            is_valid, error_msg = validate_organization_limits(org, role)
            if not is_valid:
                return Response({'error': error_msg}, status=status.HTTP_400_BAD_REQUEST)
        else:
            org = Organization.objects.filter(id=org_id).first() if org_id else None

        user = User.objects.create_user(username=username, password=password,
                                        first_name=request.data.get('first_name', ''),
                                        last_name=request.data.get('last_name', ''),
                                        email=request.data.get('email', ''))
        UserProfile.objects.create(user=user, organization=org, role=role)
        clear_user_cache(user.id)
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
            user.set_password(request.data['password'])
        user.save()
        org_id = request.data.get('organization')
        profile = get_user_profile(user)
        if profile:
            profile.role = request.data.get('role', profile.role)
            if 'organization' in request.data and (org_id == '' or org_id is None):
                profile.organization = None
            elif org_id:
                profile.organization = Organization.objects.filter(id=org_id).first()
            profile.save()
        clear_user_cache(user.id)
        return Response({'success': True})

    def destroy(self, request, pk=None):
        try:
            user = User.objects.get(id=pk)
            clear_user_cache(user.id)
            user.delete()
            return Response({'success': True})
        except User.DoesNotExist:
            return Response({'error': 'Юзер не знайдений'}, status=status.HTTP_404_NOT_FOUND)


# ─── EMAIL TEMPLATES ──────────────────────────────────────────────────────────

class EmailTemplateViewSet(viewsets.ModelViewSet):
    serializer_class = EmailTemplateSerializer
    # Модератор може переглядати та редагувати email templates
    permission_classes = [IsAuthenticated, IsModerator]
    pagination_class = StandardPagination

    def get_queryset(self):
        role = get_user_role(self.request.user)
        if role == 'superadmin':
            qs = EmailTemplate.objects.all()
            org_id = self.request.query_params.get('organization')
            return qs.filter(organization_id=org_id) if org_id else qs
        org = get_user_organization(self.request.user)
        return EmailTemplate.objects.filter(organization=org) if org else EmailTemplate.objects.none()

    def perform_create(self, serializer):
        org = get_user_organization(self.request.user)
        if not org:
            raise serializers.ValidationError({'error': "Користувач не прив'язаний до організації"})
        serializer.save(organization=org)

    @action(detail=True, methods=['post'])
    def preview(self, request, pk=None):
        template = self.get_object()
        candidate_id = request.data.get('candidate_id')
        if not candidate_id:
            return Response({'error': 'candidate_id is required'}, status=status.HTTP_400_BAD_REQUEST)
        candidate = get_object_or_404(Candidate, id=candidate_id, organization=template.organization)
        subject, body = EmailService.apply_template_replacements(template.subject, template.body, candidate, request)
        return Response(
            {'subject': subject, 'body': body, 'candidate_email': candidate.email, 'from_email': request.user.email})

    @action(detail=True, methods=['post'])
    def send(self, request, pk=None):
        template = self.get_object()
        candidate_id = request.data.get('candidate_id')
        if not candidate_id:
            return Response({'error': 'candidate_id is required'}, status=status.HTTP_400_BAD_REQUEST)
        candidate = get_object_or_404(Candidate, id=candidate_id, organization=template.organization)
        if not candidate.email:
            return Response({'error': 'У кандидата не вказано email'}, status=status.HTTP_400_BAD_REQUEST)

        subject, body = EmailService.apply_template_replacements(template.subject, template.body, candidate, request)
        sent_email = EmailService.create_sent_record(candidate, template, subject, body, request.user, 'pending')

        try:
            if EmailService.get_email_backend_type() == 'gmail' and ALLAUTH_AVAILABLE:
                sender_user = User.objects.filter(id=request.user.id).first()
                result = EmailService.send_via_gmail(sender_user, candidate.email, subject, body)
                sent_email.status = 'sent'
                sent_email.save()
                return Response(
                    {'success': True, 'message': 'Лист відправлено через Gmail API', 'sent_email_id': sent_email.id})
            else:
                EmailService.send_via_smtp(candidate.email, subject, body, request.user.email, request.user.email)
                sent_email.status = 'sent'
                sent_email.save()
                return Response({'success': True, 'message': f'Лист відправлено на {candidate.email}',
                                 'sent_email_id': sent_email.id})
        except Exception as e:
            sent_email.status = 'failed'
            sent_email.error_message = str(e)[:500]
            sent_email.save()
            return Response({'success': False, 'error': str(e)}, status=status.HTTP_502_BAD_GATEWAY)

    @action(detail=False, methods=['get'])
    def history(self, request):
        role = get_user_role(request.user)
        if role == 'superadmin':
            qs = SentEmail.objects.all()
            org_id = request.query_params.get('organization')
            if org_id:
                qs = qs.filter(candidate__organization_id=org_id)
        else:
            org = get_user_organization(request.user)
            qs = SentEmail.objects.filter(candidate__organization=org) if org else SentEmail.objects.none()
        if request.query_params.get('candidate'):
            qs = qs.filter(candidate_id=request.query_params['candidate'])
        qs = qs.select_related('candidate', 'template', 'sent_by').order_by('-sent_at')
        page = self.paginate_queryset(qs)
        if page:
            return self.get_paginated_response(SentEmailSerializer(page, many=True).data)
        return Response(SentEmailSerializer(qs, many=True).data)


class SentEmailViewSet(viewsets.ReadOnlyModelViewSet):
    serializer_class = SentEmailSerializer
    permission_classes = [IsAuthenticated, IsOrgMember]
    pagination_class = StandardPagination

    def get_queryset(self):
        role = get_user_role(self.request.user)
        if role == 'superadmin':
            qs = SentEmail.objects.all()
            org_id = self.request.query_params.get('organization')
            if org_id:
                qs = qs.filter(candidate__organization_id=org_id)
        else:
            org = get_user_organization(self.request.user)
            qs = SentEmail.objects.filter(candidate__organization=org) if org else SentEmail.objects.none()
        return qs.select_related('candidate', 'template', 'sent_by').order_by('-sent_at')


# ─── GOOGLE AUTH ──────────────────────────────────────────────────────────────

@api_view(['GET'])
@permission_classes([IsAuthenticated])
def google_auth_status(request):
    has_google = ALLAUTH_AVAILABLE and SocialAccount.objects.filter(user=request.user, provider='google').exists()
    return Response({'has_google_account': has_google, 'email': request.user.email,
                     'login_url': '/accounts/google/login/', 'logout_url': '/accounts/logout/'})


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def test_email_config(request):
    has_google = ALLAUTH_AVAILABLE and SocialAccount.objects.filter(user=request.user, provider='google').exists()
    return Response({'gmail_api': 'active' if ALLAUTH_AVAILABLE else 'inactive', 'has_google_account': has_google,
                     'google_login_url': '/accounts/google/login/', 'current_user_email': request.user.email,
                     'email_backend_type': EmailService.get_email_backend_type()})


# ─── TIME-TO-HIRE ANALYTICS ───────────────────────────────────────────────────

@api_view(['GET'])
@permission_classes([IsAuthenticated, IsOrgMember])
def time_to_hire_analytics(request):
    role = get_user_role(request.user)
    if role == 'superadmin':
        qs = Candidate.objects.all()
        org_id = request.query_params.get('organization')
        if org_id:
            qs = qs.filter(organization_id=org_id)
    else:
        org = get_user_organization(request.user)
        qs = Candidate.objects.filter(organization=org) if org else Candidate.objects.none()

    if request.query_params.get('vacancy'):
        qs = qs.filter(vacancy_id=request.query_params['vacancy'])
    if request.query_params.get('assigned_to'):
        qs = qs.filter(assigned_to_id=request.query_params['assigned_to'])

    time_data = AnalyticsService.calculate_time_to_hire_data(
        qs,
        request.query_params.get('date_from'),
        request.query_params.get('date_to'),
    )
    result = AnalyticsService.calculate_statistics(time_data)

    period = request.query_params.get('period', 'month')
    period_format = {'day': '%Y-%m-%d', 'week': '%Y-W%W', 'month': '%Y-%m', 'quarter': '%Y-Q', 'year': '%Y'}.get(
        period, '%Y-%m')
    period_stats = {}
    for d in time_data:
        try:
            pkey = d['offer_date'].strftime(period_format)
        except Exception:
            continue
        period_stats.setdefault(pkey, []).append(d['days'])
    result['by_period'] = [
        {'period': pkey, 'avg_days': round(sum(t) / len(t), 1), 'offers_count': len(t)}
        for pkey, t in sorted(period_stats.items())
    ]

    cumulative_times = []
    result['trend'] = []
    for bp in result['by_period']:
        cumulative_times.extend(period_stats.get(bp['period'], []))
        result['trend'].append({
            'period': bp['period'],
            'cumulative_avg': round(sum(cumulative_times) / len(cumulative_times), 1) if cumulative_times else 0,
            'offers_to_date': len(cumulative_times),
        })

    result['funnel'] = AnalyticsService.calculate_funnel_data(qs)

    return Response(result)


@api_view(['GET'])
@permission_classes([IsAuthenticated, IsOrgMember])
def monthly_trend_analytics(request):
    import traceback as _tb
    try:
        role = get_user_role(request.user)
        if role == 'superadmin':
            qs = Candidate.objects.all()
            org_id = request.query_params.get('organization')
            if org_id:
                qs = qs.filter(organization_id=org_id)
        else:
            org = get_user_organization(request.user)
            qs = Candidate.objects.filter(organization=org) if org else Candidate.objects.none()

        if request.query_params.get('vacancy'):
            qs = qs.filter(vacancy_id=request.query_params['vacancy'])

        data = AnalyticsService.calculate_monthly_trend(qs)
        return Response({'monthly': data})
    except Exception as e:
        return Response({'error': str(e), 'tb': _tb.format_exc()}, status=500)


@api_view(['GET'])
@permission_classes([IsAuthenticated, IsOrgMember])
def candidate_time_to_hire_detail(request, candidate_id):
    candidate = get_object_or_404(Candidate, id=candidate_id)
    role = get_user_role(request.user)
    if role != 'superadmin' and candidate.organization != get_user_organization(request.user):
        return Response({'error': 'Forbidden'}, status=status.HTTP_403_FORBIDDEN)

    status_timeline = []
    prev_time, prev_status = candidate.created_at, 'new'
    for history in candidate.status_history.order_by('changed_at'):
        if prev_time:
            status_timeline.append({'from_status': prev_status, 'to_status': history.new_status,
                                    'changed_by': history.changed_by.get_full_name() or history.changed_by.username
                                    if history.changed_by else None,
                                    'changed_at': history.changed_at,
                                    'days_in_status': round(
                                        (history.changed_at - prev_time).total_seconds() / 86400, 1)})
        prev_time, prev_status = history.changed_at, history.new_status

    time_to_offer, offer_date = None, None
    if candidate.status == 'offer':
        first_offer = candidate.status_history.filter(new_status='offer').order_by('changed_at').first()
        if first_offer:
            time_to_offer = round((first_offer.changed_at - candidate.created_at).total_seconds() / 86400, 1)
            offer_date = first_offer.changed_at
        else:
            time_to_offer, offer_date = 0, candidate.created_at

    return Response({'candidate_id': candidate.id,
                     'name': f"{candidate.first_name} {candidate.last_name}".strip(),
                     'email': candidate.email, 'phone': candidate.phone,
                     'vacancy': {'id': candidate.vacancy_id,
                                 'title': candidate.vacancy.title if candidate.vacancy else None},
                     'created_at': candidate.created_at, 'current_status': candidate.status,
                     'current_status_display': candidate.get_status_display(),
                     'time_to_offer_days': time_to_offer, 'offer_date': offer_date,
                     'status_timeline': status_timeline, 'total_status_changes': len(status_timeline)})


@api_view(['GET'])
@permission_classes([IsAuthenticated, IsOrgMember])
def export_time_to_hire_csv(request):
    role = get_user_role(request.user)
    if role == 'superadmin':
        qs = Candidate.objects.all()
        org_id = request.query_params.get('organization')
        if org_id:
            qs = qs.filter(organization_id=org_id)
    else:
        org = get_user_organization(request.user)
        qs = Candidate.objects.filter(organization=org) if org else Candidate.objects.none()

    if request.query_params.get('vacancy'):
        qs = qs.filter(vacancy_id=request.query_params['vacancy'])
    if request.query_params.get('assigned_to'):
        qs = qs.filter(assigned_to_id=request.query_params['assigned_to'])

    time_data = AnalyticsService.calculate_time_to_hire_data(qs, request.query_params.get('date_from'),
                                                             request.query_params.get('date_to'))
    response = HttpResponse(content_type='text/csv; charset=utf-8')
    response['Content-Disposition'] = 'attachment; filename="time_to_hire_export.csv"'
    response.write('\ufeff')
    writer = csv.writer(response)
    writer.writerow(['ID', "Ім'я", 'Прізвище', 'Email', 'Телефон', 'Вакансія', 'HR Менеджер',
                     'Дата створення', 'Дата офферу', 'Днів до офферу'])
    for row in time_data:
        writer.writerow([row['candidate_id'], row['candidate_name'].split()[0] if row['candidate_name'] else '',
                         ' '.join(row['candidate_name'].split()[1:]) if row['candidate_name'] else '', '', '',
                         row['vacancy_title'], row['assigned_to_name'] or '',
                         row['new_date'].strftime('%d.%m.%Y') if row['new_date'] else '',
                         row['offer_date'].strftime('%d.%m.%Y') if row['offer_date'] else '', row['days']])
    return response


# ─── HR EFFECTIVENESS ANALYTICS ───────────────────────────────────────────────

@api_view(['GET'])
@permission_classes([IsAuthenticated, IsOrgMember])
def hr_effectiveness_analytics(request):
    import traceback as _tb
    try:
        role = get_user_role(request.user)
        if role == 'superadmin':
            qs = Candidate.objects.all()
            org_id = request.query_params.get('organization')
            if org_id:
                qs = qs.filter(organization_id=org_id)
        else:
            org = get_user_organization(request.user)
            qs = Candidate.objects.filter(organization=org) if org else Candidate.objects.none()

        if request.query_params.get('date_from'):
            qs = qs.filter(created_at__date__gte=request.query_params['date_from'])
        if request.query_params.get('date_to'):
            qs = qs.filter(created_at__date__lte=request.query_params['date_to'])
        if request.query_params.get('vacancy'):
            qs = qs.filter(vacancy_id=request.query_params['vacancy'])

        hr_data = AnalyticsService.calculate_hr_effectiveness(qs)
        total_candidates = qs.count()
        from django.db.models import Q as _Q
        _terminal_ids = AnalyticsService._get_offer_stage_ids(qs)
        total_offers = qs.filter(stage__is_terminal=True).count()
        overall_conversion = round(total_offers / total_candidates * 100, 1) if total_candidates > 0 else 0

        return Response({
            'hr_managers': hr_data,
            'summary': {
                'total_hr': len(hr_data),
                'total_candidates': total_candidates,
                'total_offers': total_offers,
                'overall_conversion': overall_conversion,
            }
        })
    except Exception as e:
        return Response({'error': str(e), 'tb': _tb.format_exc()}, status=500)


@api_view(['GET'])
@permission_classes([IsAuthenticated, IsOrgMember])
def export_hr_effectiveness_csv(request):
    role = get_user_role(request.user)
    if role == 'superadmin':
        qs = Candidate.objects.all()
        org_id = request.query_params.get('organization')
        if org_id:
            qs = qs.filter(organization_id=org_id)
    else:
        org = get_user_organization(request.user)
        qs = Candidate.objects.filter(organization=org) if org else Candidate.objects.none()

    hr_data = AnalyticsService.calculate_hr_effectiveness(qs)

    response = HttpResponse(content_type='text/csv; charset=utf-8')
    response['Content-Disposition'] = 'attachment; filename="hr_effectiveness.csv"'
    response.write('\ufeff')
    writer = csv.writer(response)
    writer.writerow([
        'HR ID', "Ім'я HR", 'Username', 'Email',
        'Всього кандидатів', 'Офферів', 'Співбесід', 'Відмов', 'Активних',
        'Конверсія в оффер %', 'Конверсія в співбесіду+ %',
        'Середній час до офферу (дні)',
        'Нові', 'Скринінг', 'Співбесіда', 'Оффер', 'Відмова'
    ])
    for hr in hr_data:
        writer.writerow([
            hr['hr_id'], hr['hr_name'], hr['hr_username'], hr['hr_email'],
            hr['total_candidates'], hr['offers_count'], hr['interviews_count'],
            hr['rejected_count'], hr['active_candidates'],
            hr['conversion_rate'], hr['interview_rate'],
            hr['time_to_hire_avg'] or '—',
            hr['by_status']['new'], hr['by_status']['screening'],
            hr['by_status']['interview'], hr['by_status']['offer'],
            hr['by_status']['rejected'],
        ])
    return response


# ─── EXCEL / PDF EXPORTS ──────────────────────────────────────────────────────

@api_view(['GET'])
@permission_classes([IsAuthenticated, IsOrgMember])
def export_time_to_hire_excel(request):
    role = get_user_role(request.user)
    if role == 'superadmin':
        qs = Candidate.objects.all()
        org_id = request.query_params.get('organization')
        if org_id:
            qs = qs.filter(organization_id=org_id)
    else:
        org = get_user_organization(request.user)
        qs = Candidate.objects.filter(organization=org) if org else Candidate.objects.none()
    if request.query_params.get('vacancy'):
        qs = qs.filter(vacancy_id=request.query_params['vacancy'])
    if request.query_params.get('assigned_to'):
        qs = qs.filter(assigned_to_id=request.query_params['assigned_to'])
    time_data = AnalyticsService.calculate_time_to_hire_data(qs, request.query_params.get('date_from'),
                                                             request.query_params.get('date_to'))
    result = AnalyticsService.calculate_statistics(time_data)
    return ExportService.export_time_to_hire_excel(time_data, result)


@api_view(['GET'])
@permission_classes([IsAuthenticated, IsOrgMember])
def export_time_to_hire_pdf(request):
    role = get_user_role(request.user)
    if role == 'superadmin':
        qs = Candidate.objects.all()
        org_id = request.query_params.get('organization')
        if org_id:
            qs = qs.filter(organization_id=org_id)
    else:
        org = get_user_organization(request.user)
        qs = Candidate.objects.filter(organization=org) if org else Candidate.objects.none()
    if request.query_params.get('vacancy'):
        qs = qs.filter(vacancy_id=request.query_params['vacancy'])
    if request.query_params.get('assigned_to'):
        qs = qs.filter(assigned_to_id=request.query_params['assigned_to'])
    time_data = AnalyticsService.calculate_time_to_hire_data(qs, request.query_params.get('date_from'),
                                                             request.query_params.get('date_to'))
    result = AnalyticsService.calculate_statistics(time_data)
    return ExportService.export_time_to_hire_pdf(time_data, result)


@api_view(['GET'])
@permission_classes([IsAuthenticated, IsOrgMember])
def export_hr_effectiveness_excel(request):
    role = get_user_role(request.user)
    if role == 'superadmin':
        qs = Candidate.objects.all()
        org_id = request.query_params.get('organization')
        if org_id:
            qs = qs.filter(organization_id=org_id)
    else:
        org = get_user_organization(request.user)
        qs = Candidate.objects.filter(organization=org) if org else Candidate.objects.none()
    hr_data = AnalyticsService.calculate_hr_effectiveness(qs)
    total_candidates = qs.count()
    total_offers = qs.filter(stage__is_terminal=True).count()
    overall_conversion = round(total_offers / total_candidates * 100, 1) if total_candidates > 0 else 0
    summary = {
        'total_hr': len(hr_data), 'total_candidates': total_candidates,
        'total_offers': total_offers, 'overall_conversion': overall_conversion,
    }
    return ExportService.export_hr_effectiveness_excel(hr_data, summary)


@api_view(['GET'])
@permission_classes([IsAuthenticated, IsOrgMember])
def export_hr_effectiveness_pdf(request):
    role = get_user_role(request.user)
    org = None
    if role == 'superadmin':
        qs = Candidate.objects.all()
        org_id = request.query_params.get('organization')
        if org_id:
            qs = qs.filter(organization_id=org_id)
    else:
        org = get_user_organization(request.user)
        qs = Candidate.objects.filter(organization=org) if org else Candidate.objects.none()
    if request.query_params.get('date_from'):
        qs = qs.filter(created_at__date__gte=request.query_params['date_from'])
    if request.query_params.get('date_to'):
        qs = qs.filter(created_at__date__lte=request.query_params['date_to'])
    if request.query_params.get('vacancy'):
        qs = qs.filter(vacancy_id=request.query_params['vacancy'])

    hr_data = AnalyticsService.calculate_hr_effectiveness(qs)
    total_candidates = qs.count()
    total_offers = qs.filter(stage__is_terminal=True).count()
    overall_conversion = round(total_offers / total_candidates * 100, 1) if total_candidates > 0 else 0
    summary = {
        'total_hr': len(hr_data), 'total_candidates': total_candidates,
        'total_offers': total_offers, 'overall_conversion': overall_conversion,
    }
    filters = {
        'Організація': request.query_params.get('organization') if role == 'superadmin' else (org.name if org else None),
        'Вакансія': request.query_params.get('vacancy'),
        'Дата від': request.query_params.get('date_from'),
        'Дата до': request.query_params.get('date_to'),
    }
    return ExportService.export_hr_effectiveness_pdf(hr_data, summary, filters)


@api_view(['GET'])
@permission_classes([IsAuthenticated, IsOrgMember])
def export_full_report_excel(request):
    role = get_user_role(request.user)
    if role == 'superadmin':
        org_id = request.query_params.get('organization')
        candidates_qs = Candidate.objects.filter(organization_id=org_id) if org_id else Candidate.objects.all()
    else:
        org = get_user_organization(request.user)
        candidates_qs = Candidate.objects.filter(organization=org) if org else Candidate.objects.none()

    vacancy_filter = request.query_params.get('vacancy')
    assigned_to_filter = request.query_params.get('assigned_to')
    date_from = request.query_params.get('date_from')
    date_to = request.query_params.get('date_to')

    if vacancy_filter:
        candidates_qs = candidates_qs.filter(vacancy_id=vacancy_filter)
    if assigned_to_filter:
        candidates_qs = candidates_qs.filter(assigned_to_id=assigned_to_filter)
    if date_from:
        candidates_qs = candidates_qs.filter(created_at__date__gte=date_from)
    if date_to:
        candidates_qs = candidates_qs.filter(created_at__date__lte=date_to)

    if role == 'superadmin':
        org_id = request.query_params.get('organization')
        vacancies_qs = Vacancy.objects.filter(organization_id=org_id) if org_id else Vacancy.objects.all()
    else:
        org = get_user_organization(request.user)
        vacancies_qs = Vacancy.objects.filter(organization=org) if org else Vacancy.objects.none()

    time_data = AnalyticsService.calculate_time_to_hire_data(candidates_qs, date_from, date_to)
    tth_statistics = AnalyticsService.calculate_statistics(time_data)

    period = request.query_params.get('period', 'month')
    period_format = {'day': '%Y-%m-%d', 'week': '%Y-W%W', 'month': '%Y-%m', 'quarter': '%Y-Q%q', 'year': '%Y'}.get(
        period, '%Y-%m')
    period_stats = {}
    for d in time_data:
        pkey = d['offer_date'].strftime(period_format)
        period_stats.setdefault(pkey, []).append(d['days'])
    tth_statistics['by_period'] = [
        {'period': pkey, 'avg_days': round(sum(t) / len(t), 1), 'offers_count': len(t)}
        for pkey, t in sorted(period_stats.items())
    ]
    cumulative_times = []
    tth_statistics['trend'] = []
    for bp in tth_statistics['by_period']:
        cumulative_times.extend(period_stats.get(bp['period'], []))
        tth_statistics['trend'].append({
            'period': bp['period'],
            'cumulative_avg': round(sum(cumulative_times) / len(cumulative_times), 1) if cumulative_times else 0,
            'offers_to_date': len(cumulative_times),
        })

    hr_data = AnalyticsService.calculate_hr_effectiveness(candidates_qs)
    total_candidates = candidates_qs.count()
    total_offers = candidates_qs.filter(stage__is_terminal=True).count()
    overall_conversion = round(total_offers / total_candidates * 100, 1) if total_candidates > 0 else 0

    hr_effectiveness = {
        'hr_managers': hr_data,
        'summary': {
            'total_hr': len(hr_data), 'total_candidates': total_candidates,
            'total_offers': total_offers, 'overall_conversion': overall_conversion,
        }
    }

    funnel = AnalyticsService.calculate_funnel_data(candidates_qs, total_candidates, KANBAN_COLUMNS)
    sources, source_conversion = AnalyticsService.calculate_sources_data(candidates_qs, total_candidates, SOURCE_CONFIG)
    vacancies_list = AnalyticsService.calculate_vacancies_data(candidates_qs, vacancies_qs)

    analytics_data = {
        'time_to_hire': tth_statistics, 'hr_effectiveness': hr_effectiveness,
        'funnel': funnel, 'sources': sources, 'source_conversion': source_conversion,
        'vacancies': vacancies_list, 'total_candidates': total_candidates,
        'filters': {
            'organization_id': org_id if role == 'superadmin' else None,
            'vacancy': vacancy_filter, 'assigned_to': assigned_to_filter,
            'date_from': date_from, 'date_to': date_to,
        }
    }

    try:
        return FullReportExportService.export_full_report_pdf(analytics_data)
    except Exception as e:
        logger.error(f"Full report PDF export failed: {e}")
        return JsonResponse({'error': 'PDF export failed, try Excel'}, status=500)


@api_view(['GET'])
@permission_classes([IsAuthenticated, IsOrgMember])
def export_full_report_pdf(request):
    role = get_user_role(request.user)
    if role == 'superadmin':
        org_id = request.query_params.get('organization')
        candidates_qs = Candidate.objects.filter(organization_id=org_id) if org_id else Candidate.objects.all()
    else:
        org = get_user_organization(request.user)
        candidates_qs = Candidate.objects.filter(organization=org) if org else Candidate.objects.none()

    vacancy_filter = request.query_params.get('vacancy')
    assigned_to_filter = request.query_params.get('assigned_to')
    date_from = request.query_params.get('date_from')
    date_to = request.query_params.get('date_to')

    if vacancy_filter:
        candidates_qs = candidates_qs.filter(vacancy_id=vacancy_filter)
    if assigned_to_filter:
        candidates_qs = candidates_qs.filter(assigned_to_id=assigned_to_filter)
    if date_from:
        candidates_qs = candidates_qs.filter(created_at__date__gte=date_from)
    if date_to:
        candidates_qs = candidates_qs.filter(created_at__date__lte=date_to)

    time_data = AnalyticsService.calculate_time_to_hire_data(candidates_qs, date_from, date_to)
    tth_statistics = AnalyticsService.calculate_statistics(time_data)
    hr_data = AnalyticsService.calculate_hr_effectiveness(candidates_qs)
    total_candidates = candidates_qs.count()
    total_offers = candidates_qs.filter(stage__is_terminal=True).count()
    overall_conversion = round(total_offers / total_candidates * 100, 1) if total_candidates > 0 else 0
    funnel = AnalyticsService.calculate_funnel_data(candidates_qs, total_candidates, KANBAN_COLUMNS)

    analytics_data = {
        'time_to_hire': tth_statistics,
        'hr_effectiveness': {
            'hr_managers': hr_data,
            'summary': {
                'total_hr': len(hr_data), 'total_candidates': total_candidates,
                'total_offers': total_offers, 'overall_conversion': overall_conversion,
            }
        },
        'funnel': funnel,
        'total_candidates': total_candidates,
    }

    try:
        return FullReportExportService.export_full_report_pdf(analytics_data)
    except Exception as e:
        logger.error(f"Full report PDF export failed: {e}")
        return JsonResponse({'error': 'PDF export failed, try Excel'}, status=500)


# ==============================================================================
# HOLIDAY THEMES (LED-теми)
# ==============================================================================

class HolidayThemeViewSet(viewsets.ModelViewSet):
    serializer_class = HolidayThemeSerializer
    permission_classes = [IsAuthenticated, IsSuperAdmin]
    queryset = HolidayTheme.objects.all()

    @action(detail=False, methods=['get'], url_path='active', permission_classes=[])
    def get_active(self, request):
        theme = HolidayTheme.get_active_theme()
        return Response(HolidayThemeSerializer(theme).data)

    @action(detail=False, methods=['post'], url_path='activate')
    def activate_theme(self, request):
        serializer = HolidayThemeActivateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        theme_id = serializer.validated_data['theme_id']
        theme = get_object_or_404(HolidayTheme, id=theme_id)
        theme.is_active = True
        theme.save()
        return Response(HolidayThemeSerializer(theme).data)

    @action(detail=False, methods=['post'], url_path='schedule')
    def schedule_themes(self, request):
        now = timezone.now()
        expired = HolidayTheme.objects.filter(end_date__lt=now, is_active=True)
        for theme in expired:
            theme.is_active = False
            theme.save()
        to_activate = HolidayTheme.objects.filter(
            start_date__lte=now, end_date__gte=now, is_active=False
        )
        for theme in to_activate:
            theme.is_active = True
            theme.save()
        return Response({
            'activated': to_activate.count(),
            'deactivated': expired.count(),
            'active_theme': HolidayThemeSerializer(HolidayTheme.get_active_theme()).data
        })


# ==============================================================================
# PRICING CONFIG
# ==============================================================================

class PricingConfigViewSet(viewsets.ModelViewSet):
    serializer_class = PricingConfigSerializer
    permission_classes = [IsAuthenticated, IsSuperAdmin]
    queryset = PricingConfig.objects.all()


@api_view(['GET'])
@permission_classes([])
def public_pricing(request):
    return Response(PricingConfig.get_all_prices())


# ==============================================================================
# PROMO CODES
# ==============================================================================

class PromoCodeViewSet(viewsets.ModelViewSet):
    serializer_class = PromoCodeSerializer
    permission_classes = [IsAuthenticated, IsSuperAdmin]
    queryset = PromoCode.objects.all()

    def get_queryset(self):
        qs = super().get_queryset()
        is_active = self.request.query_params.get('is_active')
        if is_active is not None:
            qs = qs.filter(is_active=is_active.lower() == 'true')
        return qs

    @action(detail=False, methods=['post'], url_path='verify', permission_classes=[])
    def verify_code(self, request):
        serializer = PromoCodeVerifySerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        promo = serializer.validated_data['code']
        is_valid, message = promo.is_valid(plan=request.data.get('plan'))
        return Response({
            'valid': is_valid, 'message': message,
            'discount_type': promo.discount_type, 'discount_value': promo.discount_value,
            'code': promo.code,
        })

    @action(detail=False, methods=['post'], url_path='apply')
    def apply_code(self, request):
        if not request.user.is_authenticated:
            return Response({'error': 'Необхідна авторизація'}, status=status.HTTP_401_UNAUTHORIZED)
        serializer = PromoCodeApplySerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        promo_code = PromoCode.objects.filter(code__iexact=serializer.validated_data['code']).first()
        if not promo_code:
            return Response({'error': 'Промо-код не знайдено'}, status=status.HTTP_404_NOT_FOUND)
        user_usage_count = PromoCodeUsage.objects.filter(promo_code=promo_code, user=request.user).count()
        if user_usage_count >= promo_code.max_uses_per_user:
            return Response({'error': 'Ви вже використали цей промо-код'}, status=status.HTTP_400_BAD_REQUEST)
        is_valid, message = promo_code.is_valid(plan=serializer.validated_data['plan'])
        if not is_valid:
            return Response({'error': message}, status=status.HTTP_400_BAD_REQUEST)
        original_price = float(serializer.validated_data['price'])
        final_price = promo_code.apply_discount(original_price)
        discount_amount = original_price - final_price
        PromoCodeUsage.objects.create(
            promo_code=promo_code, user=request.user,
            applied_to_plan=serializer.validated_data['plan'],
            original_price=original_price, discount_amount=discount_amount, final_price=final_price,
            ip_address=request.META.get('REMOTE_ADDR'),
        )
        promo_code.used_count += 1
        promo_code.save(update_fields=['used_count'])
        return Response({
            'success': True, 'original_price': original_price,
            'discount_amount': float(discount_amount), 'final_price': float(final_price),
            'code': promo_code.code,
        })

    @action(detail=True, methods=['get'], url_path='stats')
    def usage_stats(self, request, pk=None):
        promo = self.get_object()
        usages = promo.usages.select_related('user').order_by('-used_at')
        return Response({
            'total_uses': promo.used_count,
            'remaining_uses': promo.max_uses - promo.used_count,
            'recent_usages': [
                {'user_email': u.user.email, 'user_name': u.user.get_full_name(),
                 'plan': u.applied_to_plan, 'discount': float(u.discount_amount), 'used_at': u.used_at}
                for u in usages[:20]
            ]
        })


class RegisterView(APIView):
    permission_classes = []

    def post(self, request):
        from .serializers import RegisterSerializer
        serializer = RegisterSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
        user, org = serializer.save()
        refresh = RefreshToken.for_user(user)
        return Response({
            'access': str(refresh.access_token),
            'refresh': str(refresh),
            'user': {'id': user.id, 'username': user.username, 'email': user.email, 'role': 'admin'},
            'organization': {'id': org.id, 'name': org.name, 'slug': org.slug},
        }, status=status.HTTP_201_CREATED)


# ─── D&I Analytics ────────────────────────────────────────────────────────────

@api_view(['GET'])
@permission_classes([IsAuthenticated])
def di_analytics(request):
    org = get_user_organization(request.user)
    if not org:
        return Response({'error': 'Організацію не знайдено'}, status=404)

    qs = Candidate.objects.filter(organization=org, di_consent=True)

    vacancy_id = request.query_params.get('vacancy_id')
    if vacancy_id:
        qs = qs.filter(vacancy_id=vacancy_id)

    total_with_consent = qs.count()
    total_all = Candidate.objects.filter(organization=org).count()

    gender_map = {
        'male': 'Чоловік', 'female': 'Жінка',
        'non_binary': 'Небінарний/а', 'prefer_not': 'Не вказали', 'other': 'Інше', '': 'Не вказали',
    }
    from django.db.models import Count, Q
    gender_qs = qs.values('di_gender').annotate(count=Count('id'))
    gender_data = [
        {'key': r['di_gender'] or 'prefer_not', 'label': gender_map.get(r['di_gender'] or '', 'Не вказали'), 'count': r['count']}
        for r in gender_qs
    ]

    age_map = {'18-24': '18–24', '25-34': '25–34', '35-44': '35–44', '45-54': '45–54', '55+': '55+', 'prefer_not': 'Не вказали', '': 'Не вказали'}
    age_qs = qs.filter(di_age_range__gt='').values('di_age_range').annotate(count=Count('id'))
    age_data = [
        {'key': r['di_age_range'], 'label': age_map.get(r['di_age_range'], r['di_age_range']), 'count': r['count']}
        for r in age_qs
    ]

    disability_yes = qs.filter(di_disability=True).count()
    disability_no  = qs.filter(di_disability=False).count()
    veteran_yes = qs.filter(di_veteran=True).count()

    funnel_qs = Candidate.objects.filter(organization=org, di_consent=True)\
        .select_related('stage')\
        .values('stage__name', 'stage__color', 'di_gender')\
        .annotate(count=Count('id'))\
        .order_by('stage__order', 'di_gender')

    funnel_stages = {}
    for row in funnel_qs:
        stage_name = row['stage__name'] or 'Без стейджу'
        color = row['stage__color'] or '#7a1a2e'
        gender = row['di_gender'] or 'prefer_not'
        if stage_name not in funnel_stages:
            funnel_stages[stage_name] = {'stage': stage_name, 'color': color, 'total': 0, 'male': 0, 'female': 0, 'other': 0}
        funnel_stages[stage_name]['total'] += row['count']
        if gender == 'male':
            funnel_stages[stage_name]['male'] += row['count']
        elif gender == 'female':
            funnel_stages[stage_name]['female'] += row['count']
        else:
            funnel_stages[stage_name]['other'] += row['count']

    hired_qs = qs.filter(stage__system_key='offer')
    hired_male   = hired_qs.filter(di_gender='male').count()
    hired_female = hired_qs.filter(di_gender='female').count()
    total_male   = qs.filter(di_gender='male').count()
    total_female = qs.filter(di_gender='female').count()

    return Response({
        'summary': {
            'total_candidates': total_all, 'with_di_consent': total_with_consent,
            'consent_rate_pct': round(total_with_consent / total_all * 100, 1) if total_all else 0,
            'disability_count': disability_yes, 'veteran_count': veteran_yes,
        },
        'gender': gender_data, 'age': age_data,
        'disability': {'yes': disability_yes, 'no': disability_no},
        'veteran': {'yes': veteran_yes},
        'funnel': list(funnel_stages.values()),
        'conversion_by_gender': {
            'male':   {'hired': hired_male,   'total': total_male,   'rate': round(hired_male/total_male*100,1) if total_male else 0},
            'female': {'hired': hired_female, 'total': total_female, 'rate': round(hired_female/total_female*100,1) if total_female else 0},
        },
    })


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def anonymous_candidate(request, pk):
    org = get_user_organization(request.user)
    try:
        c = Candidate.objects.get(pk=pk, organization=org)
    except Candidate.DoesNotExist:
        return Response({'error': 'Не знайдено'}, status=404)

    return Response({
        'id':           c.id,
        'code':         f'CAND-{c.id:04d}',
        'vacancy':      c.vacancy_id,
        'vacancy_title': c.vacancy.title if c.vacancy else None,
        'stage':        c.stage_id,
        'stage_name':   c.stage.name if c.stage else None,
        'stage_color':  c.stage.color if c.stage else None,
        'source':       c.source,
        'created_at':   c.created_at,
        'notes':        '',
        'tags':         [{'id': t.id, 'name': t.name, 'color': t.color} for t in c.tags.all()],
        'status':       c.status,
    })


# ─── PREDICTIVE ANALYTICS ─────────────────────────────────────────────────────

from statistics import median, stdev
from collections import defaultdict


@api_view(['GET'])
@permission_classes([IsAuthenticated, IsOrgMember])
def predictive_analytics(request):
    role = get_user_role(request.user)
    if role == 'superadmin':
        org_id = request.query_params.get('organization')
        base_qs = Candidate.objects.all()
        if org_id:
            base_qs = base_qs.filter(organization_id=org_id)
    else:
        org = get_user_organization(request.user)
        if not org:
            return Response({'error': 'Організація не знайдена'}, status=400)
        base_qs = Candidate.objects.filter(organization=org)

    vacancy_id = request.query_params.get('vacancy')
    if vacancy_id:
        base_qs = base_qs.filter(vacancy_id=vacancy_id)

    def _stats(values):
        if not values:
            return None
        values_sorted = sorted(values)
        n = len(values_sorted)
        med = median(values_sorted)
        q1 = values_sorted[n // 4]
        q3 = values_sorted[(3 * n) // 4]
        sd = round(stdev(values_sorted), 1) if n >= 2 else 0
        return {
            'median': round(med, 1), 'min': round(min(values_sorted), 1),
            'max': round(max(values_sorted), 1), 'q1': round(q1, 1), 'q3': round(q3, 1),
            'std_dev': sd, 'sample_size': n,
            'forecast_low': round(max(0, med - sd), 1), 'forecast_high': round(med + sd, 1),
        }

    offer_candidates = (
        base_qs.filter(stage__system_key='offer')
        .select_related('vacancy', 'stage')
        .prefetch_related('status_history__new_stage')
    )

    hire_times = []
    stage_times = defaultdict(list)

    for cand in offer_candidates:
        history = list(cand.status_history.order_by('changed_at'))
        if not history:
            continue
        offer_date = None
        for h in history:
            if h.new_stage and h.new_stage.system_key == 'offer':
                offer_date = h.changed_at
                break
        if not offer_date:
            continue
        days_to_hire = (offer_date - cand.created_at).total_seconds() / 86400
        if days_to_hire < 0:
            continue
        hire_times.append({
            'days': round(days_to_hire, 1), 'vacancy_id': cand.vacancy_id,
            'vacancy_title': cand.vacancy.title if cand.vacancy else '—',
            'source': cand.source or 'other',
        })
        prev_time = cand.created_at
        prev_key = 'new'
        for h in history:
            dur = (h.changed_at - prev_time).total_seconds() / 86400
            if dur >= 0 and prev_key:
                stage_times[prev_key].append(round(dur, 1))
            prev_key = (h.new_stage.system_key if h.new_stage else None) or h.new_status
            prev_time = h.changed_at

    all_days = [r['days'] for r in hire_times]
    hire_stats = _stats(all_days)
    n = len(all_days)

    if n == 0:
        confidence = 'no_data'
        confidence_label = 'Недостатньо даних'
    elif n < 5:
        confidence = 'low'
        confidence_label = f'Низька впевненість ({n} закрит. вакансій)'
    elif n < 20:
        confidence = 'medium'
        confidence_label = f'Середня впевненість ({n} закрит. вакансій)'
    else:
        confidence = 'high'
        confidence_label = f'Висока впевненість ({n} закрит. вакансій)'

    by_vacancy = defaultdict(list)
    for r in hire_times:
        if r['vacancy_id']:
            by_vacancy[r['vacancy_id']].append(r)

    vacancy_forecasts = []
    for vid, rows in by_vacancy.items():
        s = _stats([r['days'] for r in rows])
        if s:
            vacancy_forecasts.append({'vacancy_id': vid, 'vacancy_title': rows[0]['vacancy_title'], **s})
    vacancy_forecasts.sort(key=lambda x: x['median'])

    total_reached_offer = (
        base_qs.filter(status_history__new_stage__system_key='offer').distinct().count()
    )
    declined_after_offer = (
        base_qs.filter(status_history__rejection_reason__name__icontains='відмовився від офер').distinct().count()
    )
    if total_reached_offer > 0:
        accepted = max(0, total_reached_offer - declined_after_offer)
        offer_acceptance_rate = round(accepted / total_reached_offer * 100, 1)
    else:
        offer_acceptance_rate = None

    STAGE_ORDER = ['new', 'screening', 'interview', 'offer', 'rejected']
    STAGE_LABELS = {
        'new': 'Новий', 'screening': 'Скринінг',
        'interview': 'Співбесіда', 'offer': 'Оффер', 'rejected': 'Відмова',
    }
    stage_duration_stats = []
    for key in STAGE_ORDER:
        s = _stats(stage_times.get(key, []))
        if s:
            stage_duration_stats.append({'stage_key': key, 'stage_label': STAGE_LABELS.get(key, key), **s})

    SOURCE_LABELS = {
        'linkedin': 'LinkedIn', 'dou': 'DOU', 'work_ua': 'work.ua',
        'rabota_ua': 'rabota.ua', 'recommendation': 'Рекомендація',
        'csv': 'CSV', 'direct': 'Прямий відгук', 'other': 'Інше',
    }
    by_source = defaultdict(list)
    for r in hire_times:
        by_source[r['source']].append(r['days'])

    source_stats = []
    for src, days_list in by_source.items():
        s = _stats(days_list)
        if s:
            source_stats.append({'source': src, 'source_label': SOURCE_LABELS.get(src, src), **s})
    source_stats.sort(key=lambda x: x['median'])

    return Response({
        'hiring_forecast': {
            'stats': hire_stats, 'confidence': confidence,
            'confidence_label': confidence_label, 'sample_size': n,
        },
        'offer_acceptance_rate': offer_acceptance_rate,
        'total_reached_offer': total_reached_offer,
        'stage_duration': stage_duration_stats,
        'by_vacancy': vacancy_forecasts,
        'by_source': source_stats,
    })

# ==============================================================================
# BETA TESTING VIEWS
# ==============================================================================
from django.core.mail import send_mail
from django.conf import settings
from rest_framework.permissions import AllowAny
from .models import BetaApplication, BetaConfig


# ── Helpers ────────────────────────────────────────────────────────────────────

def _get_client_ip(request):
    x_forwarded = request.META.get('HTTP_X_FORWARDED_FOR')
    return x_forwarded.split(',')[0].strip() if x_forwarded else request.META.get('REMOTE_ADDR')


def _send_beta_email(app):
    """Надсилає лист заявнику після рішення адміна. Повертає True/False."""
    try:
        if app.status == 'approved':
            subject = '✅ Вашу заявку на IDA ATS Beta схвалено!'
            message = (
                f'Привіт, {app.contact_name}!\n\n'
                f'Раді повідомити — заявку від «{app.company_name}» схвалено.\n\n'
                f'Найближчим часом ми надішлемо інструкції для доступу до системи.\n\n'
                f'Якщо є питання — просто відповідайте на цей лист.\n\n'
                f'— Команда IDA ATS'
            )
        else:
            subject = 'Заявка на IDA ATS Beta'
            message = (
                f'Привіт, {app.contact_name}!\n\n'
                f'Дякуємо за інтерес до IDA ATS.\n\n'
                f'На жаль, наразі всі місця в поточній хвилі бети зайняті.\n'
                f'Ми збережемо вашу заявку і повідомимо, як тільки відкриємо наступну хвилю.\n\n'
                + (f'Причина: {app.reviewer_note}\n\n' if app.reviewer_note else '')
                + '— Команда IDA ATS'
            )
        send_mail(
            subject=subject,
            message=message,
            from_email=settings.DEFAULT_FROM_EMAIL,
            recipient_list=[app.email],
            fail_silently=False,
        )
        app.email_sent = True
        app.save(update_fields=['email_sent'])
        return True
    except Exception as e:
        import logging
        logging.getLogger(__name__).error(f'[Beta] Email error: {e}')
        return False


def _notify_admin_new_beta_app(app, config):
    """Сповіщає суперадміна про нову заявку."""
    notify_to = config.notify_email or settings.DEFAULT_FROM_EMAIL
    if not notify_to:
        return
    try:
        send_mail(
            subject=f'[IDA ATS Beta] Нова заявка: {app.company_name}',
            message=(
                f'Нова заявка на бета-тестування!\n\n'
                f'Агенція:   {app.company_name}\n'
                f'Контакт:   {app.contact_name}\n'
                f'Email:     {app.email}\n'
                f'Телефон:   {app.phone or "—"}\n'
                f'Команда:   {app.get_team_size_display() if app.team_size else "—"}\n'
                f'Зараз:     {app.get_current_tool_display() if app.current_tool else "—"}\n'
                f'Коментар:  {app.comment or "—"}\n\n'
                f'Адмінка: /admin/candidates/betaapplication/{app.id}/change/'
            ),
            from_email=settings.DEFAULT_FROM_EMAIL,
            recipient_list=[notify_to],
            fail_silently=True,
        )
    except Exception:
        pass


# ── Public endpoints ───────────────────────────────────────────────────────────

@api_view(['GET'])
@permission_classes([AllowAny])
def beta_status(request):
    """GET /api/public/beta-status/"""
    config = BetaConfig.get()
    approved_count = BetaApplication.objects.filter(status='approved').count()
    return Response({
        'beta_open': config.beta_open and (approved_count < config.max_slots),
        'slots_left': max(0, config.max_slots - approved_count),
    })


@api_view(['POST'])
@permission_classes([AllowAny])
def beta_apply(request):
    """POST /api/public/beta-apply/"""
    config = BetaConfig.get()

    if not config.beta_open:
        return Response(
            {'error': 'Реєстрацію на бету тимчасово закрито.'},
            status=status.HTTP_400_BAD_REQUEST,
        )

    email = request.data.get('email', '').strip().lower()
    if not email:
        return Response({'error': 'Email обов\'язковий.'}, status=status.HTTP_400_BAD_REQUEST)

    company_name = request.data.get('company_name', '').strip()
    contact_name = request.data.get('contact_name', '').strip()
    if not company_name or not contact_name:
        return Response({'error': 'Назва агенції та контактна особа обов\'язкові.'}, status=status.HTTP_400_BAD_REQUEST)

    if BetaApplication.objects.filter(email__iexact=email).exists():
        return Response(
            {'error': 'Заявка з цим email вже існує. Ми вас повідомимо!'},
            status=status.HTTP_400_BAD_REQUEST,
        )

    approved_count = BetaApplication.objects.filter(status='approved').count()
    if approved_count >= config.max_slots:
        return Response(
            {'error': 'Всі місця вже зайняті. Ваша заявка потрапить до листа очікування.'},
            status=status.HTTP_400_BAD_REQUEST,
        )

    app = BetaApplication.objects.create(
        company_name=company_name,
        contact_name=contact_name,
        email=email,
        phone=request.data.get('phone', '').strip(),
        team_size=request.data.get('team_size', ''),
        current_tool=request.data.get('current_tool', ''),
        comment=request.data.get('comment', '').strip(),
        ip_address=_get_client_ip(request),
    )

    _notify_admin_new_beta_app(app, config)

    return Response({'ok': True, 'id': app.id}, status=status.HTTP_201_CREATED)


# ── Superadmin endpoints ───────────────────────────────────────────────────────

@api_view(['GET'])
@permission_classes([IsAuthenticated])
def beta_applications_list(request):
    """GET /api/beta/applications/?status=pending|approved|rejected"""
    if not is_superadmin(request.user):
        return Response({'error': 'Forbidden'}, status=403)

    status_filter = request.query_params.get('status')
    qs = BetaApplication.objects.all()
    if status_filter:
        qs = qs.filter(status=status_filter)

    data = [{
        'id': app.id,
        'company_name': app.company_name,
        'contact_name': app.contact_name,
        'email': app.email,
        'phone': app.phone,
        'team_size': app.team_size,
        'team_size_display': app.get_team_size_display() if app.team_size else '',
        'current_tool': app.current_tool,
        'current_tool_display': app.get_current_tool_display() if app.current_tool else '',
        'comment': app.comment,
        'status': app.status,
        'status_display': app.get_status_display(),
        'reviewer_note': app.reviewer_note,
        'email_sent': app.email_sent,
        'created_at': app.created_at.isoformat(),
        'reviewed_at': app.reviewed_at.isoformat() if app.reviewed_at else None,
    } for app in qs]

    return Response(data)


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def beta_application_review(request, app_id):
    """POST /api/beta/applications/<id>/review/  body: {action: approve|reject, note: ''}"""
    if not is_superadmin(request.user):
        return Response({'error': 'Forbidden'}, status=403)

    app = get_object_or_404(BetaApplication, pk=app_id)

    action_val = request.data.get('action')
    if action_val not in ('approve', 'reject'):
        return Response({'error': 'action має бути approve або reject'}, status=400)

    app.status = 'approved' if action_val == 'approve' else 'rejected'
    app.reviewer_note = request.data.get('note', '')
    app.reviewed_by = request.user
    app.reviewed_at = timezone.now()
    app.save()

    email_ok = _send_beta_email(app)

    return Response({'ok': True, 'status': app.status, 'email_sent': email_ok})


@api_view(['GET', 'POST'])
@permission_classes([IsAuthenticated])
def beta_config_view(request):
    """
    GET  /api/beta/config/  — отримати налаштування
    POST /api/beta/config/  — оновити налаштування
    """
    if not is_superadmin(request.user):
        return Response({'error': 'Forbidden'}, status=403)

    config = BetaConfig.get()

    if request.method == 'GET':
        return Response({
            'beta_open':      config.beta_open,
            'max_slots':      config.max_slots,
            'notify_email':   config.notify_email,
            'approved_count': BetaApplication.objects.filter(status='approved').count(),
            'pending_count':  BetaApplication.objects.filter(status='pending').count(),
            'total_count':    BetaApplication.objects.count(),
        })

    if 'beta_open' in request.data:
        config.beta_open = bool(request.data['beta_open'])
    if 'max_slots' in request.data:
        try:
            config.max_slots = int(request.data['max_slots'])
        except (ValueError, TypeError):
            return Response({'error': 'max_slots має бути числом'}, status=400)
    if 'notify_email' in request.data:
        config.notify_email = request.data['notify_email']
    config.save()

    return Response({'ok': True, 'beta_open': config.beta_open, 'max_slots': config.max_slots})