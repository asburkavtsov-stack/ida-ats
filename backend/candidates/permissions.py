from rest_framework.permissions import BasePermission
from candidates.utils.context_processors import get_user_role, is_superadmin


class IsSuperAdmin(BasePermission):
    def has_permission(self, request, view):
        return is_superadmin(request.user)

    def has_object_permission(self, request, view, obj):
        return is_superadmin(request.user)


class IsOrgAdmin(BasePermission):
    def has_permission(self, request, view):
        role = get_user_role(request.user)
        return role in ['admin', 'superadmin']

    def has_object_permission(self, request, view, obj):
        role = get_user_role(request.user)

        if role == 'superadmin':
            return True

        if role == 'admin':
            from candidates.utils.context_processors import get_user_organization
            user_org = get_user_organization(request.user)

            if hasattr(obj, 'organization'):
                return obj.organization == user_org
            elif hasattr(obj, 'candidate') and hasattr(obj.candidate, 'organization'):
                return obj.candidate.organization == user_org

        return False


class IsOrgMember(BasePermission):
    def has_permission(self, request, view):
        role = get_user_role(request.user)
        return role in ['hr', 'admin', 'superadmin']

    def has_object_permission(self, request, view, obj):
        role = get_user_role(request.user)

        if role == 'superadmin':
            return True

        from candidates.utils.context_processors import get_user_organization
        user_org = get_user_organization(request.user)

        if hasattr(obj, 'organization'):
            return obj.organization == user_org
        elif hasattr(obj, 'candidate') and hasattr(obj.candidate, 'organization'):
            return obj.candidate.organization == user_org

        return False