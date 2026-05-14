from rest_framework.permissions import BasePermission

# Convenience set — import this in views instead of repeating the literal set
ADMIN_ROLES = frozenset({"admin", "manager"})


def is_admin_role(user) -> bool:
    """Return True when the user holds an admin-level role (admin or manager)."""
    return bool(user and getattr(user, "role", None) in ADMIN_ROLES)


class IsAdminRole(BasePermission):
    """Allows access for admin and manager roles."""
    ADMIN_ROLES = {"admin", "manager"}

    def has_permission(self, request, view):
        user = getattr(request, "user", None)
        return bool(user and user.is_authenticated and getattr(user, "role", None) in self.ADMIN_ROLES)


class IsEmployeeRole(BasePermission):
    def has_permission(self, request, view):
        user = getattr(request, "user", None)
        return bool(user and user.is_authenticated and getattr(user, "role", None) == "employee")
