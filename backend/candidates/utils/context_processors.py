from functools import lru_cache
from typing import Optional, Tuple

from django.contrib.auth.models import User
from django.core.cache import cache

from candidates.models import Organization, UserProfile


def get_user_profile(user: User) -> Optional[UserProfile]:
    if not user or not user.is_authenticated:
        return None

    cache_key = f"user_profile_{user.id}"
    profile = cache.get(cache_key)

    if profile is None:
        try:
            profile = user.profile
            cache.set(cache_key, profile, 300)  # 5 хвилин
        except UserProfile.DoesNotExist:
            profile = None
            cache.set(cache_key, None, 60)

    return profile


def get_user_organization(user: User) -> Optional[Organization]:
    profile = get_user_profile(user)
    return profile.organization if profile else None


def get_user_role(user: User) -> Optional[str]:
    profile = get_user_profile(user)
    return profile.role if profile else None


def is_superadmin(user: User) -> bool:
    return get_user_role(user) == 'superadmin'


def is_org_admin(user: User) -> bool:
    role = get_user_role(user)
    return role == 'admin' or role == 'superadmin'


def clear_user_cache(user_id: int) -> None:
    cache.delete(f"user_profile_{user_id}")