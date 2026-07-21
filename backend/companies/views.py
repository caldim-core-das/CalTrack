from rest_framework import status, views
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated, AllowAny
from accounts.permissions import IsAdminRole
from .models import Company, Region
from .serializers import CompanySerializer, RegionSerializer


# ── Regions ─────────────────────────────────────────────────────────────────

class RegionListView(views.APIView):
    """
    GET /api/company/regions/
    Returns the two supported regions (US, UK) with all compliance metadata.
    Public — no auth required (needed during onboarding before company is set).
    """
    permission_classes = [AllowAny]

    def get(self, request):
        regions = Region.objects.all()
        return Response(RegionSerializer(regions, many=True).data)


# ── Company ──────────────────────────────────────────────────────────────────

class CompanyCreateView(views.APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        skip_trial = request.data.get("start_trial") is False
        serializer = CompanySerializer(data=request.data, context={"skip_trial_activation": skip_trial})
        if serializer.is_valid():
            company = serializer.save()

            # Create domain for this company
            from .models import Domain
            Domain.objects.create(
                domain=f"{company.schema_name}.localhost",
                tenant=company,
                is_primary=True,
            )

            # Assign company to the creating user and make them admin
            user = request.user
            user.company = company
            user.role = "admin"
            user.save()

            # --- Handle invites ---
            invites = request.data.get("invites", [])
            if invites and isinstance(invites, list):
                from settings_hub.models import TeamInvite
                from django.core.mail import send_mail
                from django.conf import settings
                from django.template.loader import render_to_string
                from django.utils.html import strip_tags
                from django_tenants.utils import tenant_context
                
                frontend_url = getattr(settings, 'FRONTEND_URL', 'http://localhost:5173')

                with tenant_context(company):
                    for item in invites:
                        if isinstance(item, dict):
                            email = item.get("email", "").strip()
                            role = item.get("role", "employee").strip()
                        else:
                            email = str(item).strip()
                            role = "employee"

                        if not email:
                            continue
                        
                        if TeamInvite.objects.filter(company=company, email=email, status="pending").exists():
                            continue
                        
                        invite = TeamInvite.objects.create(
                            company=company,
                            invited_by=user,
                            email=email,
                            role=role,
                        )
                        
                        invite_link = f"{frontend_url}/accept-invite?token={invite.token}&org={company.schema_name}"
                        
                        context = {
                            'company_name': company.company_name,
                            'inviter_name': user.get_full_name() or user.username,
                            'role': invite.role,
                            'invite_link': invite_link,
                        }
                        
                        html_message = render_to_string('emails/team_invite.html', context)
                        plain_message = strip_tags(html_message)
                        
                        def send_invite_email(subject, plain, from_email, recipient, html):
                            try:
                                send_mail(
                                    subject=subject,
                                    message=plain,
                                    from_email=from_email,
                                    recipient_list=[recipient],
                                    html_message=html,
                                    fail_silently=True,
                                )
                            except Exception as e:
                                print(f"Failed to send invite email to {recipient} during onboarding: {e}")

                        import threading
                        email_thread = threading.Thread(
                            target=send_invite_email,
                            args=(
                                f"Invitation to join {company.company_name} on Caltrack",
                                plain_message,
                                getattr(settings, 'DEFAULT_FROM_EMAIL', 'noreply@caltrack.com'),
                                email,
                                html_message
                            )
                        )
                        email_thread.daemon = True
                        email_thread.start()
            # ----------------------

            return Response(CompanySerializer(company).data, status=status.HTTP_201_CREATED)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


class CompanyMeView(views.APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        if not hasattr(request, "company") or not request.company:
            return Response({"error": "No company associated with user"}, status=status.HTTP_404_NOT_FOUND)
        serializer = CompanySerializer(request.company)
        return Response(serializer.data)


class CompanyUpdateView(views.APIView):
    permission_classes = [IsAuthenticated, IsAdminRole]

    def put(self, request):
        if not hasattr(request, "company") or not request.company:
            return Response({"error": "No company associated with user"}, status=status.HTTP_404_NOT_FOUND)

        company = request.company
        serializer = CompanySerializer(company, data=request.data, partial=True)
        if serializer.is_valid():
            serializer.save()
            return Response(serializer.data)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
