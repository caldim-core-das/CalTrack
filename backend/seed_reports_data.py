import os
import django
import random
from datetime import datetime, timedelta, date, time
from decimal import Decimal

# Set up Django environment
os.environ.setdefault("DJANGO_SETTINGS_MODULE", "quicktims.settings")
django.setup()

from django.utils import timezone
from django.contrib.auth import get_user_model
from companies.models import Company
from employees.models import Employee
from time_tracking.models import TimeLog, Break, Location, JobSite
from payroll.models import PayrollPeriod, PayrollRecord
from tasks.models import Task
from leaves.models import LeaveRequest
from scheduling.models import Shift

User = get_user_model()

def seed_data():
    print("Starting reports data seeding...")
    
    # 1. Fetch the main company 'rohit' (or fallback to the first one)
    company = Company.objects.filter(schema_name='rohit').first()
    if not company:
        company = Company.objects.first()
    if not company:
        print("Error: No company found! Please create a company first.")
        return
    print(f"Using company: {company.company_name} (ID: {company.id}, schema: {company.schema_name})")

    # 2. Clear old data for this company to prevent integrity violations
    print("Clearing old reports data for this company...")
    TimeLog.objects.filter(employee__company=company).delete()
    PayrollRecord.objects.filter(company=company).delete()
    PayrollPeriod.objects.filter(company=company).delete()
    Task.objects.filter(company=company).delete()
    LeaveRequest.objects.filter(company=company).delete()
    Shift.objects.filter(company=company).delete()
    Location.objects.filter(company=company).delete()
    JobSite.objects.filter(company=company).delete()
    
    # 3. Create active Locations and JobSites
    print("Creating locations and job sites...")
    loc_hq = Location.objects.create(
        company=company,
        name="Headquarters",
        address="100 Pine St, San Francisco, CA 94111",
        lat=37.774900,
        lng=-122.419400,
        geofence_radius=300,
        location_type="office",
        is_active=True
    )
    
    loc_sv = Location.objects.create(
        company=company,
        name="Silicon Valley Office",
        address="101 Lytton Ave, Palo Alto, CA 94301",
        lat=37.338200,
        lng=-121.886300,
        geofence_radius=300,
        location_type="office",
        is_active=True
    )
    
    loc_remote = Location.objects.create(
        company=company,
        name="Remote Site Alpha",
        address="700 Flower St, Los Angeles, CA 90017",
        lat=34.052200,
        lng=-118.243700,
        geofence_radius=300,
        location_type="client_site",
        is_active=True
    )

    # Also register corresponding JobSite models for backend validation compatibility
    JobSite.objects.create(
        company=company,
        name="Headquarters",
        address="100 Pine St, San Francisco, CA 94111",
        lat=Decimal("37.774900"),
        lng=Decimal("-122.419400"),
        geofence_radius=300
    )
    JobSite.objects.create(
        company=company,
        name="Silicon Valley Office",
        address="101 Lytton Ave, Palo Alto, CA 94301",
        lat=Decimal("37.338200"),
        lng=Decimal("-121.886300"),
        geofence_radius=300
    )

    # 4. Fetch/Setup Employees
    print("Setting up employees...")
    # Find or update user employee profile titles & hourly rates
    employees = Employee.objects.filter(company=company)
    
    emp_map = {}
    for emp in employees:
        u = emp.user
        if u.username == 'employee':
            emp.title = "Software Engineer"
            emp.hourly_rate = Decimal("40.00")
            emp.assigned_job_site = JobSite.objects.filter(name="Silicon Valley Office").first()
            emp.save()
            emp_map['employee'] = emp
        elif u.username == 'surya':
            emp.title = "UI/UX Designer"
            emp.hourly_rate = Decimal("35.00")
            emp.assigned_job_site = JobSite.objects.filter(name="Headquarters").first()
            emp.save()
            emp_map['surya'] = emp
        elif u.username == 'admin':
            emp.title = "Operations Director"
            emp.hourly_rate = Decimal("60.00")
            emp.save()
            emp_map['admin'] = emp
            
    # fallback in case employee user is not fully bound
    if 'employee' not in emp_map and employees.exists():
        emp_map['employee'] = employees.first()
    
    # 5. Create Time Logs for the last 30 days
    print("Generating 30 days of time logs...")
    today = timezone.localdate()
    start_date = today - timedelta(days=30)
    
    seeded_logs = []
    
    # Iterate through each of the last 30 days
    for day_offset in range(31):
        log_date = start_date + timedelta(days=day_offset)
        
        # Decide if they work on this day (Skip most weekends, keep it realistic)
        is_weekend = log_date.weekday() >= 5
        
        for name, emp in emp_map.items():
            if name == 'admin': 
                continue # Admin doesn't log time normally in this flow
                
            if is_weekend and random.random() > 0.15:
                continue # 15% chance of weekend overtime
                
            # Choose a target location for this day's work
            work_loc = loc_sv if name == 'employee' else loc_hq
            
            # Clock-in time: between 08:30 and 09:30 AM
            in_hour = random.randint(8, 9)
            in_minute = random.randint(0, 59) if in_hour == 9 else random.randint(30, 59)
            check_in_dt = timezone.make_aware(
                datetime.combine(log_date, time(in_hour, in_minute))
            )
            
            # Clock-out time: between 05:00 and 06:30 PM (17:00 and 18:30)
            out_hour = random.randint(17, 18)
            out_minute = random.randint(0, 59) if out_hour == 17 else random.randint(0, 30)
            check_out_dt = timezone.make_aware(
                datetime.combine(log_date, time(out_hour, out_minute))
            )
            
            # Small random variations inside geofence radius
            lat_offset = random.uniform(-0.001, 0.001)
            lng_offset = random.uniform(-0.001, 0.001)
            
            log = TimeLog.objects.create(
                employee=emp,
                work_date=log_date,
                clock_in=check_in_dt,
                clock_in_lat=Decimal(str(work_loc.lat + lat_offset)),
                clock_in_lon=Decimal(str(work_loc.lng + lng_offset)),
                clock_in_address=work_loc.address,
                clock_in_notes="Started daily tasks.",
                
                clock_out=check_out_dt,
                clock_out_lat=Decimal(str(work_loc.lat + lat_offset * 0.9)),
                clock_out_lon=Decimal(str(work_loc.lng + lng_offset * 0.9)),
                clock_out_address=work_loc.address,
                clock_out_notes="Completed tasks for the day.",
                
                location=work_loc,
                distance_from_site_meters=random.randint(15, 120),
                geofence_passed=True,
                status='approved' if log_date < today - timedelta(days=2) else 'submitted',
                face_match_status='matched',
                face_match_score=0.92 + random.uniform(0.01, 0.06)
            )
            
            # Add a Lunch Break
            break_start_dt = timezone.make_aware(
                datetime.combine(log_date, time(12, 30 + random.randint(-15, 15)))
            )
            break_duration = random.randint(45, 60)
            break_end_dt = break_start_dt + timedelta(minutes=break_duration)
            
            Break.objects.create(
                time_log=log,
                break_start=break_start_dt,
                break_end=break_end_dt,
                break_type="lunch",
                duration_minutes=break_duration
            )
            
            seeded_logs.append(log)
            
    print(f"Successfully created {len(seeded_logs)} time logs.")

    # 6. Generate Payroll periods and matching Payroll records
    print("Generating payroll periods and records...")
    # Define 3 historical payroll periods
    periods_def = [
        (date(2026, 5, 1), date(2026, 5, 15)),
        (date(2026, 5, 16), date(2026, 5, 31)),
        (date(2026, 6, 1), date(2026, 6, 15)),
    ]
    
    for start_d, end_d in periods_def:
        period = PayrollPeriod.objects.create(
            company=company,
            start_date=start_d,
            end_date=end_d
        )
        
        for name, emp in emp_map.items():
            if name == 'admin':
                continue
                
            # Sum up approved work hours in this period
            logs_in_period = TimeLog.objects.filter(
                employee=emp,
                work_date__gte=start_d,
                work_date__lte=end_d,
                status='approved'
            )
            
            total_seconds = 0
            for log in logs_in_period:
                total_seconds += log.worked_seconds()
                
            total_hours = Decimal(str(round(total_seconds / 3600, 2)))
            
            # Gross pay: rate * hours
            gross_pay = (total_hours * emp.hourly_rate).quantize(Decimal("0.01"))
            # Net pay: gross * 0.85 (minus 15% estimated taxes)
            net_pay = (gross_pay * Decimal("0.85")).quantize(Decimal("0.01"))
            
            PayrollRecord.objects.create(
                period=period,
                employee=emp,
                company=company,
                hourly_rate=emp.hourly_rate,
                regular_hours=total_hours,
                gross_pay=gross_pay,
                net_pay=net_pay,
                region="US FLSA (CA)",
                is_exempt=False,
                wage_floor_compliant=True
            )
            
    print("Payroll records seeded successfully.")

    # 7. Create realistic Tasks distribution
    print("Creating tasks...")
    # Task title pool
    titles = [
        "Upgrade system database schemas", "Fix layout shift in user dashboard",
        "Implement bi-weekly payroll aggregation", "Integrate geofence map layers",
        "Refactor auth login middleware", "Optimize reports database query speeds",
        "Create documentation for compliance team", "Design client onboarding slides",
        "Review weekly employee timesheet approvals", "Test mobile geolocation accuracy"
    ]
    
    statuses = [
        ('completed', 14),
        ('in_progress', 6),
        ('pending', 4),
        ('cancelled', 1),
    ]
    
    categories = ['engineering', 'design', 'operations', 'marketing']
    
    for status, count in statuses:
        for _ in range(count):
            title = random.choice(titles) + f" #{random.randint(100, 999)}"
            category = random.choice(categories)
            assigned_user = random.choice([emp.user for emp in emp_map.values() if emp.user.role == 'employee'])
            Task.objects.create(
                company=company,
                title=title,
                description="Seeded task description for Reports & Analytics analytics dashboard simulation.",
                status=status,
                category=category,
                priority=random.choice(['low', 'medium', 'high']),
                assigned_to=assigned_user
            )
            
    print("Tasks status distribution seeded.")

    # 8. Create Leave Requests
    print("Creating leaves...")
    LeaveRequest.objects.create(
        company=company,
        employee=emp_map.get('employee', employees.first()),
        leave_type='sick',
        start_date=today - timedelta(days=20),
        end_date=today - timedelta(days=19),
        reason="Flu symptoms",
        status=LeaveRequest.Status.APPROVED
    )
    
    LeaveRequest.objects.create(
        company=company,
        employee=emp_map.get('surya', employees.first()),
        leave_type='vacation',
        start_date=today - timedelta(days=10),
        end_date=today - timedelta(days=5),
        reason="Family vacation trip",
        status=LeaveRequest.Status.APPROVED
    )
    
    LeaveRequest.objects.create(
        company=company,
        employee=emp_map.get('employee', employees.first()),
        leave_type='personal',
        start_date=today + timedelta(days=15),
        end_date=today + timedelta(days=16),
        reason="Moving apartment",
        status=LeaveRequest.Status.PENDING
    )
    
    print("Leave requests seeded.")

    # 9. Create Shifts for next 7 days
    print("Creating shifts...")
    for day_offset in range(1, 8):
        shift_date = today + timedelta(days=day_offset)
        
        # Don't schedule on weekends
        if shift_date.weekday() >= 5:
            continue
            
        for name, emp in emp_map.items():
            if name == 'admin':
                continue
                
            Shift.objects.create(
                company=company,
                employee=emp,
                shift_start=timezone.make_aware(datetime.combine(shift_date, time(9, 0))),
                shift_end=timezone.make_aware(datetime.combine(shift_date, time(17, 0))),
                notes="Standard daily work shift."
            )
            
    print("Shifts seeded successfully.")
    print("All Reports & Analytics dashboard real workflow data seeded successfully!")

if __name__ == "__main__":
    seed_data()
