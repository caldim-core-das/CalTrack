from rest_framework import status
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework.permissions import IsAuthenticated

from tasks.serializers.gap_job_serializers import GapJobListSerializer, SuspendedTaskSerializer
from tasks.serializers.task_serializers import TaskSerializer
from tasks.services import gap_job_service

class SuspendJobView(APIView):
    """
    POST /api/tasks/{id}/suspend/
    Body: {
        reason_category: spare_part|customer_absent|approval_pending|technical|other,
        reason?: str,           # optional free-text detail
        resume_deadline?: str,  # ISO8601 datetime
    }

    Returns 423 LOCKED if SLA breach is imminent (< 30 min).
    Returns 400 if task is High or Urgent priority.
    """
    permission_classes = [IsAuthenticated]

    def post(self, request, pk):
        from tasks.services.gap_job_service import SLABreachError
        reason          = request.data.get("reason", "")
        reason_category = request.data.get("reason_category")
        resume_deadline = request.data.get("resume_deadline")

        try:
            task = gap_job_service.suspend_job(
                task_id=pk,
                worker=request.user,
                reason=reason,
                reason_category=reason_category,
                resume_deadline=resume_deadline,
            )
        except SLABreachError as e:
            # 423 = Locked — SLA breach imminent
            return Response({"detail": str(e), "error": "sla_breach"}, status=423)
        except Exception as e:
            return Response({"detail": str(e)}, status=status.HTTP_400_BAD_REQUEST)

        return Response(SuspendedTaskSerializer(task).data, status=status.HTTP_200_OK)


class AvailableGapJobsView(APIView):
    """
    GET /api/tasks/available-gap-jobs/
    Params: ?lat=float&lng=float&radius_km=float
    """
    permission_classes = [IsAuthenticated]

    def get(self, request):
        lat = request.query_params.get("lat")
        lng = request.query_params.get("lng")
        radius_km = request.query_params.get("radius_km", 20)

        if not lat or not lng:
            return Response(
                {"detail": "Query parameters 'lat' and 'lng' are required."},
                status=status.HTTP_400_BAD_REQUEST
            )

        try:
            lat = float(lat)
            lng = float(lng)
            radius_km = float(radius_km)
        except ValueError:
            return Response(
                {"detail": "Invalid coordinates or radius supplied."},
                status=status.HTTP_400_BAD_REQUEST
            )

        jobs = gap_job_service.get_available_gap_jobs(
            worker=request.user,
            lat=lat,
            lng=lng,
            radius_km=radius_km
        )
        return Response(GapJobListSerializer(jobs, many=True).data, status=status.HTTP_200_OK)


class AcceptGapJobView(APIView):
    """
    POST /api/tasks/{id}/accept-gap-job/
    Body: { parent_task_id: int }
    """
    permission_classes = [IsAuthenticated]

    def post(self, request, pk):
        parent_task_id = request.data.get("parent_task_id")
        if not parent_task_id:
            return Response(
                {"detail": "Field 'parent_task_id' is required."},
                status=status.HTTP_400_BAD_REQUEST
            )

        parent_task, gap_task = gap_job_service.accept_gap_job(
            gap_task_id=pk,
            worker=request.user,
            parent_task_id=parent_task_id
        )
        return Response(
            {
                "parent_task": SuspendedTaskSerializer(parent_task).data,
                "gap_task": TaskSerializer(gap_task).data
            },
            status=status.HTTP_200_OK
        )


class CompleteGapJobView(APIView):
    """
    POST /api/tasks/{id}/complete-gap-job/
    """
    permission_classes = [IsAuthenticated]

    def post(self, request, pk):
        completed_task = gap_job_service.complete_gap_job(
            gap_task_id=pk,
            worker=request.user
        )
        return Response(TaskSerializer(completed_task).data, status=status.HTTP_200_OK)


class ResumeJobView(APIView):
    """
    POST /api/tasks/{id}/resume/
    Body: { lat: float, lng: float }
    """
    permission_classes = [IsAuthenticated]

    def post(self, request, pk):
        lat = request.data.get("lat")
        lng = request.data.get("lng")

        if lat is None or lng is None:
            return Response(
                {"detail": "Fields 'lat' and 'lng' are required."},
                status=status.HTTP_400_BAD_REQUEST
            )

        try:
            lat = float(lat)
            lng = float(lng)
        except ValueError:
            return Response(
                {"detail": "Invalid coordinates supplied."},
                status=status.HTTP_400_BAD_REQUEST
            )

        res = gap_job_service.resume_job(
            task_id=pk,
            worker=request.user,
            current_lat=lat,
            current_lng=lng
        )
        return Response(
            {
                "task": TaskSerializer(res["task"]).data,
                "overdue_warning": res["overdue_warning"]
            },
            status=status.HTTP_200_OK
        )


class AdminPushGapJobView(APIView):
    """
    POST /api/tasks/admin/{id}/push-gap-job/
    Body: { parent_task_id: int }
    """
    from tasks.views.task_views import IsAdmin
    permission_classes = [IsAdmin]

    def post(self, request, pk):
        from tasks.models import Task
        parent_task_id = request.data.get("parent_task_id")
        if not parent_task_id:
            return Response(
                {"detail": "Field 'parent_task_id' is required."},
                status=status.HTTP_400_BAD_REQUEST
            )

        try:
            parent_task = Task.objects.get(pk=parent_task_id, company=request.company)
        except Task.DoesNotExist:
            return Response(
                {"detail": "Parent task not found under your company."},
                status=status.HTTP_404_NOT_FOUND
            )

        if parent_task.status != Task.Status.SUSPENDED:
            return Response(
                {"detail": "Parent task must be suspended to receive a pushed gap job."},
                status=status.HTTP_400_BAD_REQUEST
            )

        worker = parent_task.assigned_to

        try:
            gap_task = Task.objects.get(pk=pk, company=request.company)
        except Task.DoesNotExist:
            return Response(
                {"detail": "Gap job not found under your company."},
                status=status.HTTP_404_NOT_FOUND
            )

        if gap_task.status != Task.Status.PENDING:
            return Response(
                {"detail": "Gap job must be pending."},
                status=status.HTTP_400_BAD_REQUEST
            )

        if gap_task.parent_tasks.exists():
            return Response(
                {"detail": "This gap job is already taken."},
                status=status.HTTP_400_BAD_REQUEST
            )

        try:
            # Assign gap task and link it (DO NOT automatically accept or start it!)
            gap_task.assigned_to = worker
            gap_task.status = Task.Status.PENDING
            gap_task.acceptance_status = Task.AcceptanceStatus.PENDING_ACCEPTANCE
            gap_task.is_pushed_gap_job = True
            gap_task.priority = Task.Priority.URGENT  # Escalate priority to urgent
            gap_task.save(update_fields=["assigned_to", "status", "acceptance_status", "is_pushed_gap_job", "priority"])

            parent_task.gap_job = gap_task
            parent_task.save(update_fields=["gap_job"])

            return Response(
                {
                    "parent_task": SuspendedTaskSerializer(parent_task).data,
                    "gap_task": TaskSerializer(gap_task).data
                },
                status=status.HTTP_200_OK
            )
        except Exception as e:
            return Response(
                {"detail": str(e)},
                status=status.HTTP_400_BAD_REQUEST
            )

