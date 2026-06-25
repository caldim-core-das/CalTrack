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


def RequireModuleAccess(module_name: str, required_action: str):
    """
    Factory function that returns a BasePermission instance configured
    for a specific module and action.
    """
    class _RequireModuleAccess(BasePermission):
        def has_permission(self, request, view):
            user = getattr(request, "user", None)
            if not user or not user.is_authenticated:
                return False
                
            company = getattr(request, "company", getattr(user, "company", None))
            if not company:
                return False
                
            user_role = getattr(user, "role", "employee")
            
            # Superusers bypass
            if user.is_superuser:
                return True
                
            perms = company.module_permissions or {}
            if not perms or module_name not in perms:
                try:
                    from companies.models import default_module_permissions
                    perms = default_module_permissions()
                except Exception:
                    perms = {}
            
            module_perms = perms.get(module_name) or {}
            
            if user_role == "manager" and "manager" not in module_perms:
                role_actions = module_perms.get("admin") or []
            else:
                role_actions = module_perms.get(user_role) or []
            
            return required_action in role_actions

        def __call__(self):
            return self

    return _RequireModuleAccess()
