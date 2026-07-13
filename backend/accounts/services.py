from django.contrib.auth import get_user_model

def create_organization_admin_user(email, password, first_name="", last_name="", is_superuser=False):
    """
    Creates an organization admin user without a company attached.
    This allows the user to be redirected to the onboarding flow upon login.
    """
    User = get_user_model()
    
    # We use email for username
    user, created = User.objects.get_or_create(username=email, defaults={
        "email": email,
    })
    
    user.set_password(password)
    user.role = "admin"
    user.is_active = True
    user.first_name = first_name
    user.last_name = last_name
    
    if is_superuser:
        user.is_staff = True
        user.is_superuser = True

    user.save()
    return user, created
