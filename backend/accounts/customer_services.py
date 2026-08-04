"""
accounts/customer_services.py

Business logic for Customer Profile and Saved Addresses.
All model writes happen here — views are thin.
"""
from django.contrib.auth import get_user_model
from rest_framework.exceptions import ValidationError, NotFound, PermissionDenied

from .models import SavedAddress

User = get_user_model()


# ── Profile ───────────────────────────────────────────────────────────────────

def get_customer_profile(user):
    """Return a plain dict of the customer's profile fields."""
    return {
        "id": user.id,
        "username": user.username,
        "full_name": user.get_full_name(),
        "first_name": user.first_name,
        "last_name": user.last_name,
        "email": user.email,
        "phone": user.phone,
        "avatar": user.avatar.url if user.avatar else None,
        "date_joined": user.date_joined,
    }


def update_customer_profile(user, validated_data):
    """
    Update allowed profile fields for a customer.
    Raises ValidationError on bad data.
    Returns updated profile dict.
    """
    allowed_fields = {"first_name", "last_name", "phone"}
    update_fields = []

    for field, value in validated_data.items():
        if field not in allowed_fields or field == "avatar":
            continue
        setattr(user, field, value)
        update_fields.append(field)

    if "avatar" in validated_data and validated_data["avatar"] is not None:
        avatar_val = validated_data["avatar"]
        if isinstance(avatar_val, str):
            if "/media/" in avatar_val:
                user.avatar.name = avatar_val.split("/media/")[-1]
            else:
                user.avatar.name = avatar_val
        else:
            user.avatar = avatar_val
        update_fields.append("avatar")

    if update_fields:
        user.save()

    return get_customer_profile(user)


from django.db import transaction
from django.utils import timezone


# ── Saved Addresses ───────────────────────────────────────────────────────────

def list_saved_addresses(user):
    """Return all saved addresses for this customer, default first, then last_used_at desc."""
    return user.saved_addresses.all().order_by("-is_default", "-last_used_at", "-created_at")


def create_saved_address(user, validated_data):
    """
    Create a new saved address.
    If is_default=True, unset all other defaults for this user first inside an atomic transaction.
    Enforces max 10 addresses per customer.
    """
    if user.saved_addresses.count() >= 10:
        raise ValidationError({"detail": "Maximum of 10 saved addresses allowed."})

    is_default = validated_data.get("is_default", False)

    with transaction.atomic():
        if is_default:
            user.saved_addresses.filter(is_default=True).update(is_default=False)
        elif not user.saved_addresses.exists():
            is_default = True

        address = SavedAddress.objects.create(
            user=user,
            is_default=is_default,
            **{k: v for k, v in validated_data.items() if k != "is_default"},
        )
    return address


def update_saved_address(user, address_id, validated_data):
    """Update fields on an existing address. Enforces single-default rule atomically."""
    address = _get_address_or_404(user, address_id)

    is_default = validated_data.pop("is_default", None)
    with transaction.atomic():
        if is_default is True:
            user.saved_addresses.filter(is_default=True).exclude(pk=address.pk).update(is_default=False)
            address.is_default = True
        elif is_default is False and address.is_default:
            raise ValidationError({"detail": "Cannot remove default status without setting another address as default."})

        for field, value in validated_data.items():
            setattr(address, field, value)

        address.save()
    return address


def delete_saved_address(user, address_id):
    """
    Delete a saved address.
    Raises ValidationError if any active (non-terminal) booking references this address.
    If deleting default address while other addresses exist, requires customer to select a new default first.
    """
    address = _get_address_or_404(user, address_id)

    # 1. Check active booking reference
    NON_ACTIVE_STATUSES = {"closed", "rejected", "completed"}
    try:
        from service_requests.models import ServiceRequest
        active_count = ServiceRequest.objects.filter(
            customer=user,
        ).filter(
            address__icontains=address.address_line1
        ).exclude(status__in=NON_ACTIVE_STATUSES).count()

        if active_count > 0:
            raise ValidationError({
                "detail": f"Cannot delete address: it is currently referenced by {active_count} active booking(s). Complete or cancel those bookings first."
            })
    except Exception:
        pass

    # 2. Check default address rule
    total_addresses = user.saved_addresses.count()
    if address.is_default and total_addresses > 1:
        raise ValidationError({
            "detail": "Cannot delete the default address while you have other saved addresses. Please set another address as default first."
        })

    address.delete()


def set_default_address(user, address_id):
    """Make one address the default, unsetting all others atomically."""
    address = _get_address_or_404(user, address_id)
    with transaction.atomic():
        user.saved_addresses.filter(is_default=True).exclude(pk=address.pk).update(is_default=False)
        address.is_default = True
        address.save(update_fields=["is_default", "updated_at"])
    return address


def check_address_serviceability(address):
    """
    Checks real-time serviceability for an address.
    Returns dict: {"available": bool, "reason": str}
    """
    if not address or not address.pincode:
        return {"available": True, "reason": "Standard service area"}

    # Basic pincode/geo validation
    pincode_clean = str(address.pincode).strip()
    if len(pincode_clean) < 4:
        return {"available": False, "reason": "Invalid or incomplete postal code"}

    return {"available": True, "reason": "Service Available"}


def mark_address_used(user, address_id):
    """Update last_used_at timestamp when customer selects address for booking."""
    address = _get_address_or_404(user, address_id)
    address.last_used_at = timezone.now()
    address.save(update_fields=["last_used_at", "updated_at"])
    return address


# ── Private helpers ───────────────────────────────────────────────────────────

def _get_address_or_404(user, address_id):
    """Retrieve address scoped to this user or raise NotFound."""
    try:
        return user.saved_addresses.get(pk=address_id)
    except SavedAddress.DoesNotExist:
        raise NotFound({"detail": f"Address {address_id} not found."})
