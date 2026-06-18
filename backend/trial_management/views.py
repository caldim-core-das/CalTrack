from rest_framework.views import APIView
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework import status
from .models import TrialPlan, TrialNotification
from .services import record_upgrade_click, record_subscription_purchased


class TrialStatusView(APIView):
    """GET /api/trial/status/ — Returns trial state for the current user's company."""
    permission_classes = [IsAuthenticated]

    def get(self, request):
        company = getattr(request.user, "company", None)
        if not company:
            return Response({"success": True, "data": None})
        try:
            trial = company.trial_plan
            return Response({
                "success": True,
                "data": {
                    "status":        trial.status,
                    "days_remaining": trial.days_remaining,
                    "trial_end":     trial.trial_end.isoformat(),
                    "is_active":     trial.is_active,
                }
            })
        except TrialPlan.DoesNotExist:
            return Response({"success": True, "data": None})


class TrialNotificationsView(APIView):
    """GET /api/trial/notifications/ — Unread in-app trial notifications."""
    permission_classes = [IsAuthenticated]

    def get(self, request):
        company = getattr(request.user, "company", None)
        if not company:
            return Response({"success": True, "data": []})
        notifications = TrialNotification.objects.filter(
            company_id=company.id, is_read=False
        ).order_by("-created_at")[:10]
        return Response({
            "success": True,
            "data": [{"id": n.id, "title": n.title, "body": n.body,
                       "type": n.notification_type, "created_at": n.created_at.isoformat()}
                     for n in notifications]
        })

    def patch(self, request):
        """Mark all notifications as read."""
        company = getattr(request.user, "company", None)
        if company:
            TrialNotification.objects.filter(
                company_id=company.id, is_read=False
            ).update(is_read=True)
        return Response({"success": True})


class TrialUpgradeClickView(APIView):
    """POST /api/trial/upgrade-click/ — Records upgrade intent for analytics."""
    permission_classes = [IsAuthenticated]

    def post(self, request):
        company = getattr(request.user, "company", None)
        if company:
            try:
                record_upgrade_click(
                    trial=company.trial_plan,
                    actor_id=request.user.id,
                    ip_address=request.META.get("REMOTE_ADDR"),
                )
            except TrialPlan.DoesNotExist:
                pass
        return Response({"success": True})


class TrialMetricsView(APIView):
    """GET /api/trial/metrics/ — Admin-only trial conversion metrics."""
    permission_classes = [IsAuthenticated]

    def get(self, request):
        if not (request.user.is_staff or request.user.is_superuser):
            return Response({"success": False, "message": "Forbidden"}, status=403)
        from .models import TrialPlan
        total     = TrialPlan.objects.count()
        active    = TrialPlan.objects.filter(status="active").count()
        expired   = TrialPlan.objects.filter(status="expired").count()
        converted = TrialPlan.objects.filter(status="converted").count()
        rate      = round(converted / total * 100, 1) if total else 0
        return Response({
            "success": True,
            "data": {
                "total_trials":     total,
                "active_trials":    active,
                "expired_trials":   expired,
                "converted_trials": converted,
                "conversion_rate":  f"{rate}%",
            }
        })
