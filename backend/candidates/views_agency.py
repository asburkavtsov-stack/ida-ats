"""
candidates/views_agency.py

WHITE-LABEL: API views для агентської мульти-тенантності.
Включити в candidates/urls.py (дивись urls_agency.py).
"""

from rest_framework import generics, permissions, status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.response import Response
from rest_framework.views import APIView
from django.shortcuts import get_object_or_404

from candidates.models import Agency, AgencyMember, Organization
from candidates.serializers_agency import (
    AgencyBrandingSerializer,
    AgencyClientSerializer,
    AgencyClientCreateSerializer,
    AgencyMemberSerializer,
    AgencyDetailSerializer,
)


# ── Перевірки прав ────────────────────────────────────────────────────────────

class IsAgencyOwnerOrManager(permissions.BasePermission):
    """Тільки owner або manager агентства."""
    def has_permission(self, request, view):
        member = getattr(request.user, 'agency_member', None)
        return member and member.role in ('owner', 'manager') and member.is_active


class IsAgencyOwner(permissions.BasePermission):
    def has_permission(self, request, view):
        member = getattr(request.user, 'agency_member', None)
        return member and member.role == 'owner' and member.is_active


def get_user_agency(request):
    """Повертає Agency поточного користувача або 403."""
    member = getattr(request.user, 'agency_member', None)
    if not member or not member.is_active:
        return None
    return member.agency


# ══════════════════════════════════════════════════════════════════════════════
# БРЕНДИНГ (публічний ендпоінт — без логіну)
# ══════════════════════════════════════════════════════════════════════════════

@api_view(['GET'])
@permission_classes([permissions.AllowAny])
def agency_branding(request):
    """
    GET /api/agency/branding/
    Повертає брендинг агентства для поточного домену.
    Фронтенд викликає при завантаженні щоб підставити логотип/кольори.
    """
    agency = getattr(request, 'agency', None)
    if not agency:
        # Повертаємо дефолтний брендинг платформи
        return Response({
            'agency_name': 'IDA ATS',
            'logo_url': None,
            'favicon_url': None,
            'primary_color': '#7a1a2e',
            'secondary_color': '#b03050',
            'accent_color': '#c2185b',
            'custom_css': '',
        })
    serializer = AgencyBrandingSerializer(agency, context={'request': request})
    return Response(serializer.data)


# ══════════════════════════════════════════════════════════════════════════════
# АГЕНТСТВО — профіль і налаштування
# ══════════════════════════════════════════════════════════════════════════════

class AgencyProfileView(APIView):
    """
    GET  /api/agency/profile/   — отримати профіль агентства
    PATCH /api/agency/profile/  — оновити брендинг, контакти
    """
    permission_classes = [permissions.IsAuthenticated, IsAgencyOwnerOrManager]

    def get(self, request):
        agency = get_user_agency(request)
        if not agency:
            return Response({'detail': 'Агентство не знайдено.'}, status=404)
        serializer = AgencyDetailSerializer(agency, context={'request': request})
        return Response(serializer.data)

    def patch(self, request):
        agency = get_user_agency(request)
        if not agency:
            return Response({'detail': 'Агентство не знайдено.'}, status=404)
        serializer = AgencyDetailSerializer(
            agency, data=request.data, partial=True, context={'request': request}
        )
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(serializer.data)


class AgencyLogoUploadView(APIView):
    """
    POST /api/agency/logo/  — завантажити логотип агентства
    """
    permission_classes = [permissions.IsAuthenticated, IsAgencyOwner]

    def post(self, request):
        agency = get_user_agency(request)
        if not agency:
            return Response({'detail': 'Агентство не знайдено.'}, status=404)

        logo_file = request.FILES.get('logo')
        favicon_file = request.FILES.get('favicon')

        if logo_file:
            agency.logo = logo_file
        if favicon_file:
            agency.favicon = favicon_file
        if logo_file or favicon_file:
            agency.save()

        return Response({
            'logo_url':    request.build_absolute_uri(agency.logo.url) if agency.logo else None,
            'favicon_url': request.build_absolute_uri(agency.favicon.url) if agency.favicon else None,
        })


# ══════════════════════════════════════════════════════════════════════════════
# КЛІЄНТИ АГЕНТСТВА (компанії)
# ══════════════════════════════════════════════════════════════════════════════

class AgencyClientListView(generics.ListCreateAPIView):
    """
    GET  /api/agency/clients/        — список клієнтів
    POST /api/agency/clients/        — додати нового клієнта
    """
    permission_classes = [permissions.IsAuthenticated, IsAgencyOwnerOrManager]

    def get_serializer_class(self):
        if self.request.method == 'POST':
            return AgencyClientCreateSerializer
        return AgencyClientSerializer

    def get_queryset(self):
        agency = get_user_agency(self.request)
        if not agency:
            return Organization.objects.none()
        return Organization.objects.filter(agency=agency).order_by('name')

    def get_serializer_context(self):
        ctx = super().get_serializer_context()
        ctx['agency'] = get_user_agency(self.request)
        return ctx


class AgencyClientDetailView(generics.RetrieveUpdateDestroyAPIView):
    """
    GET    /api/agency/clients/<id>/  — деталі клієнта
    PATCH  /api/agency/clients/<id>/  — оновити
    DELETE /api/agency/clients/<id>/  — деактивувати (soft-delete)
    """
    permission_classes = [permissions.IsAuthenticated, IsAgencyOwnerOrManager]
    serializer_class = AgencyClientSerializer

    def get_queryset(self):
        agency = get_user_agency(self.request)
        if not agency:
            return Organization.objects.none()
        return Organization.objects.filter(agency=agency)

    def destroy(self, request, *args, **kwargs):
        """Soft-delete: деактивуємо, не видаляємо."""
        obj = self.get_object()
        obj.is_active = False
        obj.save()
        return Response({'detail': 'Клієнта деактивовано.'}, status=status.HTTP_200_OK)


# ══════════════════════════════════════════════════════════════════════════════
# ЧЛЕНИ АГЕНТСТВА (рекрутери, менеджери)
# ══════════════════════════════════════════════════════════════════════════════

class AgencyMemberListView(generics.ListAPIView):
    """GET /api/agency/members/"""
    permission_classes = [permissions.IsAuthenticated, IsAgencyOwnerOrManager]
    serializer_class = AgencyMemberSerializer

    def get_queryset(self):
        agency = get_user_agency(self.request)
        if not agency:
            return AgencyMember.objects.none()
        return AgencyMember.objects.filter(agency=agency).select_related('user')


class AgencyMemberDetailView(generics.RetrieveUpdateDestroyAPIView):
    """
    GET    /api/agency/members/<id>/
    PATCH  /api/agency/members/<id>/  — змінити роль / allowed_clients
    DELETE /api/agency/members/<id>/  — деактивувати
    """
    permission_classes = [permissions.IsAuthenticated, IsAgencyOwner]
    serializer_class = AgencyMemberSerializer

    def get_queryset(self):
        agency = get_user_agency(self.request)
        if not agency:
            return AgencyMember.objects.none()
        return AgencyMember.objects.filter(agency=agency)

    def destroy(self, request, *args, **kwargs):
        obj = self.get_object()
        obj.is_active = False
        obj.save()
        return Response({'detail': 'Члена деактивовано.'}, status=status.HTTP_200_OK)


# ══════════════════════════════════════════════════════════════════════════════
# КОНТЕКСТ СЕСІЇ — яке агентство і клієнт зараз активні
# ══════════════════════════════════════════════════════════════════════════════

@api_view(['GET'])
@permission_classes([permissions.IsAuthenticated])
def agency_context(request):
    """
    GET /api/agency/context/
    Повертає інформацію про поточний тенант для фронтенду.
    """
    member = getattr(request.user, 'agency_member', None)
    profile = getattr(request.user, 'profile', None)

    return Response({
        'is_agency_user': member is not None and member.is_active,
        'agency': {
            'id':   member.agency.id,
            'name': member.agency.brand_name or member.agency.name,
            'slug': member.agency.slug,
            'plan': member.agency.plan,
        } if member else None,
        'agency_role': member.role if member else None,
        'organization': {
            'id':   profile.organization.id,
            'name': profile.organization.name,
        } if profile and profile.organization else None,
        'branding': request.agency.get_branding() if request.agency else None,
    })
