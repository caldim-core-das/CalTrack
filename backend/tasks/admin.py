from django.contrib import admin
from django.contrib import messages
from tasks.models import Task, TaskAttachment

class TaskAttachmentInline(admin.TabularInline):
    model = TaskAttachment
    extra = 0

@admin.register(Task)
class TaskAdmin(admin.ModelAdmin):
    list_display = (
        "id",
        "title",
        "assigned_to",
        "status",
        "acceptance_status",
        "suspended_at",
        "resume_deadline",
        "total_active_seconds",
        "gap_job",
        "due_date",
    )
    list_filter = (
        "status",
        "acceptance_status",
        "priority",
        "category",
    )
    search_fields = (
        "title",
        "description",
        "assigned_to__username",
        "client_name",
    )
    inlines = [TaskAttachmentInline]
    actions = ["push_gap_job"]

    @admin.action(description="Push gap job to suspended worker")
    def push_gap_job(self, request, queryset):
        # We process the first selected task as the gap job candidate
        gap_task = queryset.first()
        if not gap_task:
            return

        if gap_task.status not in [Task.Status.PENDING, Task.Status.ACCEPTED]:
            self.message_user(
                request,
                "Selected task must be in Pending or Accepted status to be pushed as a gap job.",
                level=messages.ERROR
            )
            return

        # Find any suspended task in the same tenant/company to push this gap job to
        suspended_task = Task.objects.filter(
            company=gap_task.company,
            status=Task.Status.SUSPENDED
        ).first()

        if not suspended_task:
            self.message_user(
                request,
                "No suspended tasks found under this company schema to receive this gap job.",
                level=messages.WARNING
            )
            return

        worker = suspended_task.assigned_to

        try:
            gap_task.assigned_to = worker
            gap_task.status = Task.Status.PENDING
            gap_task.acceptance_status = Task.AcceptanceStatus.PENDING_ACCEPTANCE
            gap_task.is_pushed_gap_job = True
            gap_task.priority = Task.Priority.URGENT
            gap_task.save(update_fields=["assigned_to", "status", "acceptance_status", "is_pushed_gap_job", "priority"])

            suspended_task.gap_job = gap_task
            suspended_task.save(update_fields=["gap_job"])

            self.message_user(
                request,
                f"Successfully pushed gap job '{gap_task.title}' to worker '{worker.username}' (linked to parent '{suspended_task.title}'). Employee has been alerted.",
                level=messages.SUCCESS
            )
        except Exception as e:
            self.message_user(
                request,
                f"Failed to push gap job: {str(e)}",
                level=messages.ERROR
            )
