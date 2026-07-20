import os
import sys
import django

# Add the project root to sys.path
sys.path.append(r'c:\Users\user\Caltrackk\Caltrack\backend')
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'backend.settings')
django.setup()

from tasks.models import Task

def fix_tasks():
    tasks = Task.objects.filter(status='completed', face_match_status__in=['pending', ''], time_log__isnull=False)
    count = 0
    for task in tasks:
        log = task.time_log
        if log.clock_out:
            if log.face_match_status:
                task.face_match_status = log.face_match_status
            if log.face_match_score is not None:
                task.face_match_percentage = log.face_match_score
            if log.clock_out_photo:
                task.end_photo = log.clock_out_photo
            task.save()
            count += 1
    print(f"Fixed {count} tasks.")

if __name__ == '__main__':
    fix_tasks()
