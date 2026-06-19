from rest_framework.response import Response
from rest_framework import status

from candidates.utils.context_processors import get_user_organization, get_user_role


class OrganizationFilterMixin:
    """
    Повертає queryset з урахуванням ролі:
    - superadmin: всі записи (з опціональним фільтром по ?organization=)
    - admin / moderator: тільки своя організація, але БЕЗ обмежень по owner/assigned_to
    - hr: тільки своя організація (вакансії додатково фільтруються по owner у views)
    """
    def get_queryset(self):
        user = self.request.user
        role = get_user_role(user)

        if role == 'superadmin':
            qs = self.model.objects.all()
            org_id = self.request.query_params.get('organization')
            if org_id:
                qs = qs.filter(organization_id=org_id)
        elif role in ['admin', 'moderator']:
            # Модератор бачить всю організацію, як адмін, але без прав управління
            org = get_user_organization(user)
            qs = self.model.objects.filter(organization=org) if org else self.model.objects.none()
        else:
            # hr та інші — тільки своя організація; додаткові обмеження по owner у views
            org = get_user_organization(user)
            qs = self.model.objects.filter(organization=org) if org else self.model.objects.none()

        return self._apply_additional_filters(qs)

    def _apply_additional_filters(self, qs):
        return qs


class OrganizationCreateMixin:
    def perform_create(self, serializer):
        org = get_user_organization(self.request.user)
        if not org:
            return Response(
                {'error': "Користувач не прив'язаний до організації"},
                status=status.HTTP_400_BAD_REQUEST
            )
        serializer.save(organization=org)


class PaginatedResponseMixin:
    pagination_class = None

    def get_paginated_response(self, queryset, serializer_class):
        page = self.paginate_queryset(queryset)
        if page is not None:
            serializer = serializer_class(page, many=True)
            return self.get_paginated_response(serializer.data)

        serializer = serializer_class(queryset, many=True)
        return Response(serializer.data)