"""
backend/utils/validators.py
Reusable validators shared across the entire backend.
"""
import magic
from django.core.exceptions import ValidationError

# ── File upload ────────────────────────────────────────────────────────────────
MAX_UPLOAD_BYTES = 5 * 1024 * 1024   # 5 MB
ALLOWED_MIME_TYPES = {"image/jpeg", "image/png", "application/pdf"}


def validate_upload(file):
    """
    Reject files that are larger than 5 MB or whose detected MIME type is not
    in the allowed set (image/jpeg, image/png, application/pdf).

    Use as a validator on any FileField / ImageField:
        photo = models.ImageField(validators=[validate_upload])
    """
    if not file:
        return

    # Size check
    size = getattr(file, "size", None)
    if size is None:
        try:
            file.seek(0, 2)
            size = file.tell()
            file.seek(0)
        except Exception:
            size = 0

    if size > MAX_UPLOAD_BYTES:
        raise ValidationError(
            f"File size {size // (1024 * 1024):.1f} MB exceeds the 5 MB limit."
        )

    # MIME-type check using python-magic (reads first bytes; does not trust
    # the Content-Type header or file extension).
    try:
        file.seek(0)
        header = file.read(2048)
        file.seek(0)
        detected = magic.from_buffer(header, mime=True)
    except Exception:
        # If libmagic is unavailable fall back to extension-only check.
        name = getattr(file, "name", "") or ""
        ext = name.rsplit(".", 1)[-1].lower()
        ext_map = {"jpg": "image/jpeg", "jpeg": "image/jpeg",
                   "png": "image/png", "pdf": "application/pdf"}
        detected = ext_map.get(ext, "application/octet-stream")

    if detected not in ALLOWED_MIME_TYPES:
        raise ValidationError(
            f"File type '{detected}' is not allowed. "
            "Only JPEG, PNG and PDF files are accepted."
        )
