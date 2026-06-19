from rest_framework.permissions import BasePermission
from candidates.utils.context_processors import get_user_role, is_superadmin


class IsSuperAdmin(BasePermission):
    def has_permission(self, request, view):
        return is_superadmin(request.user)

    def has_object_permission(self, request, view, obj):
        return is_superadmin(request.user)


class IsOrgAdmin(BasePermission):
    """Admin або Superadmin. Модератор НЕ входить — він не управляє організацією."""
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
    """
    HR, Admin, Superadmin, або Moderator — усі є членами організації
    і мають базовий доступ до читання даних.
    """
    def has_permission(self, request, view):
        role = get_user_role(request.user)
        return role in ['hr', 'admin', 'superadmin', 'moderator']

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


class IsModerator(BasePermission):
    """
    Модератор, Admin або Superadmin.
    Дає доступ до модераційних дій: блокування/розблокування,
    перегляд усіх кандидатів/вакансій, управління blacklist,
    audit log, email templates.
    """
    def has_permission(self, request, view):
        role = get_user_role(request.user)
        return role in ['moderator', 'admin', 'superadmin']

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


class IsHROwnerOrAdmin(BasePermission):
    """
    HR бачить/редагує об'єкт лише якщо він owner вакансії або має делегований доступ.
    Admin/superadmin/moderator — повний доступ.
    """
    def has_object_permission(self, request, view, obj):
        role = get_user_role(request.user)
        if role in ['admin', 'superadmin', 'moderator']:
            return True

        # Визначаємо вакансію з об'єкта
        if hasattr(obj, 'owner'):          # це Vacancy
            vacancy = obj
        elif hasattr(obj, 'vacancy') and obj.vacancy:
            vacancy = obj.vacancy
        else:
            # Candidate без вакансії — дозволяємо якщо assigned_to == user
            if hasattr(obj, 'assigned_to') and obj.assigned_to == request.user:
                return True
            return False

        if vacancy.owner == request.user:
            return True

        from candidates.models import VacancyAccess
        return VacancyAccess.objects.filter(
            vacancy=vacancy, user=request.user
        ).exists()