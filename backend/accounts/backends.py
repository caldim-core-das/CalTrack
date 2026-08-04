from django.contrib.auth.backends import ModelBackend
from django.contrib.auth import get_user_model
from django.db.models import Q

User = get_user_model()

class EmailOrUsernameModelBackend(ModelBackend):
    """
    Authenticates against settings.AUTH_USER_MODEL.
    Allows login via either username OR email.
    """
    def authenticate(self, request, username=None, password=None, **kwargs):
        if username is None:
            username = kwargs.get(User.USERNAME_FIELD)
            
        users = User.objects.filter(
            Q(username__iexact=username) | Q(email__iexact=username)
        ).order_by('role', 'id')
        
        user = None
        for u in users:
            if u.check_password(password) and self.user_can_authenticate(u):
                return u
                
        if not users.exists():
            User().set_password(password)

        if user and user.check_password(password) and self.user_can_authenticate(user):
            return user
        
        return None
