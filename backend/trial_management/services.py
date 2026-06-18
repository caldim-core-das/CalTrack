from django.core.mail import send_mail
from django.conf import settings
from django.utils import timezone
from .models import TrialPlan, TrialEmailLog, TrialAuditLog, TrialNotification


def activate_trial(company):
    """Idempotent — safe to call multiple times; only creates once."""
    import datetime
    trial, created = TrialPlan.objects.get_or_create(
        company=company,
        defaults={
            "trial_start": timezone.now(),
            "trial_end":   timezone.now() + datetime.timedelta(days=14),
            "status":      TrialPlan.Status.ACTIVE,
        }
    )
    
    just_activated = False
    if created:
        just_activated = True
    elif trial.status == TrialPlan.Status.NOT_STARTED:
        trial.status = TrialPlan.Status.ACTIVE
        trial.trial_start = timezone.now()
        trial.trial_end = timezone.now() + datetime.timedelta(days=14)
        trial.save(update_fields=["status", "trial_start", "trial_end", "updated_at"])
        just_activated = True

    if just_activated:
        _record_audit(trial, "trial_started", company.id)
        _create_notification(trial, company.id, "banner",
            title="Your 14-day free trial has started! 🚀",
            body="Explore all premium features. Trial ends on {}.".format(
                trial.trial_end.strftime("%d %b %Y")
            )
        )
        _send_trial_email(trial, "activated")
    return trial


def send_reminder(trial, milestone):
    """Send a single milestone reminder email if not already sent."""
    flag_map = {
        "10d": "reminder_10d_sent",
        "5d":  "reminder_5d_sent",
        "3d":  "reminder_3d_sent",
        "1d":  "reminder_1d_sent",
    }
    flag = flag_map.get(milestone)
    if flag and getattr(trial, flag):
        return  # Already sent — idempotent guard
    _send_trial_email(trial, milestone)
    if flag:
        setattr(trial, flag, True)
        trial.save(update_fields=[flag, "updated_at"])
    _record_audit(trial, "reminder_sent", trial.company_id,
                  metadata={"milestone": milestone})
    _create_notification(trial, trial.company_id, "bell",
        title=f"Trial reminder: {milestone.replace('d', ' days')} left",
        body="Upgrade now to keep all your data and features."
    )


def expire_trial(trial):
    """Mark trial as expired. Data preserved. Premium features restricted."""
    if trial.status == TrialPlan.Status.EXPIRED:
        return
    trial.status = TrialPlan.Status.EXPIRED
    trial.save(update_fields=["status", "updated_at"])
    _record_audit(trial, "trial_expired", trial.company_id)
    if not trial.expired_email_sent:
        _send_trial_email(trial, "expired")
        trial.expired_email_sent = True
        trial.save(update_fields=["expired_email_sent", "updated_at"])
    _create_notification(trial, trial.company_id, "banner",
        title="Your free trial has ended",
        body="Upgrade to restore full access. Your data is safe."
    )


def record_upgrade_click(trial, actor_id=None, ip_address=None):
    _record_audit(trial, "upgrade_clicked", trial.company_id,
                  actor_id=actor_id, ip_address=ip_address)


def record_subscription_purchased(trial, plan_name, actor_id=None):
    trial.status = TrialPlan.Status.CONVERTED
    trial.upgraded_at = timezone.now()
    trial.subscription_plan = plan_name
    trial.save(update_fields=["status", "upgraded_at", "subscription_plan", "updated_at"])
    _record_audit(trial, "subscription_purchased", trial.company_id,
                  actor_id=actor_id, metadata={"plan": plan_name})


# ── Private helpers ──────────────────────────────────────────────────────────

def _send_trial_email(trial, milestone):
    company = trial.company
    from django.contrib.auth import get_user_model
    User = get_user_model()
    admins = User.objects.filter(company=company, role="admin", is_active=True)
    emails = [u.email for u in admins if u.email]
    if not emails:
        return

    subject, html_body = _build_email_content(trial, milestone, company)

    for email in emails:
        success, error = True, ""
        try:
            send_mail(
                subject=subject,
                message="",  # plain text fallback
                from_email=settings.DEFAULT_FROM_EMAIL,
                recipient_list=[email],
                html_message=html_body,
                fail_silently=False,
            )
        except Exception as e:
            success, error = False, str(e)

        TrialEmailLog.objects.create(
            trial_plan=trial,
            company_id=company.id,
            recipient_email=email,
            milestone=milestone,
            subject=subject,
            success=success,
            error_message=error,
        )


def _record_audit(trial, event, company_id, actor_id=None, ip_address=None, metadata=None):
    TrialAuditLog.objects.create(
        trial_plan=trial,
        company_id=company_id,
        actor_id=actor_id,
        event=event,
        metadata=metadata,
        ip_address=ip_address,
    )


def _create_notification(trial, company_id, ntype, title, body):
    import datetime
    TrialNotification.objects.create(
        trial_plan=trial,
        company_id=company_id,
        notification_type=ntype,
        title=title,
        body=body,
        expires_at=trial.trial_end + datetime.timedelta(days=7),
    )


def _build_email_content(trial, milestone, company):
    """Returns (subject, html_body) for each milestone."""
    days_left = trial.days_remaining
    org_name  = company.company_name
    end_date  = trial.trial_end.strftime("%d %B %Y")
    upgrade_url = f"{settings.FRONTEND_URL}/settings/billing"

    configs = {
        "activated": {
            "subject": f"🚀 Your QuickTIMS 14-day free trial is active — {org_name}",
            "headline": "Your trial has started!",
            "subline":  f"You have 14 days to explore everything QuickTIMS offers.",
            "cta_text": "Explore Features",
            "cta_url":  settings.FRONTEND_URL,
            "urgency":  False,
        },
        "10d": {
            "subject": f"⏳ 10 days left on your QuickTIMS trial — {org_name}",
            "headline": "10 days remaining",
            "subline":  f"Your trial ends on {end_date}. Upgrade now to keep everything.",
            "cta_text": "Upgrade Now",
            "cta_url":  upgrade_url,
            "urgency":  False,
        },
        "5d": {
            "subject": f"⚠️ Only 5 days left — Don't lose your QuickTIMS data",
            "headline": "5 days left on your trial",
            "subline":  "Upgrade before your trial ends to preserve all your data.",
            "cta_text": "Upgrade Before It's Too Late",
            "cta_url":  upgrade_url,
            "urgency":  True,
        },
        "3d": {
            "subject": f"🔴 3 days left — Your QuickTIMS trial expires {end_date}",
            "headline": "3 days remaining",
            "subline":  "Act now — your premium features will be locked in 3 days.",
            "cta_text": "Secure My Account",
            "cta_url":  upgrade_url,
            "urgency":  True,
        },
        "1d": {
            "subject": f"🚨 Last day! Your QuickTIMS trial expires tomorrow",
            "headline": "Final 24 Hours",
            "subline":  "This is your last chance to upgrade without losing access.",
            "cta_text": "Upgrade Now — Last Chance",
            "cta_url":  upgrade_url,
            "urgency":  True,
        },
        "expired": {
            "subject": f"Your QuickTIMS trial has ended — {org_name}",
            "headline": "Trial period ended",
            "subline":  "Your data is safe. Upgrade to restore full premium access.",
            "cta_text": "Restore Access",
            "cta_url":  upgrade_url,
            "urgency":  False,
        },
    }
    cfg = configs[milestone]
    html = _render_email_html(cfg, org_name)
    return cfg["subject"], html


def _render_email_html(cfg, org_name):
    accent = "#E94560" if cfg["urgency"] else "#5d5fef"
    return f"""
    <div style="background:#0e1116;color:#f1f5f9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;
                padding:40px 20px;max-width:600px;margin:0 auto;border:1px solid #1e293b;border-radius:20px;">
      <div style="text-align:center;border-bottom:1px solid #1e293b;padding-bottom:20px;margin-bottom:28px;">
        <div style="color:{accent};font-weight:900;font-size:18px;letter-spacing:0.2em;text-transform:uppercase;">
          QUICKTIMS
        </div>
      </div>
      <h2 style="color:#f1f5f9;font-size:22px;margin-bottom:12px;">{cfg['headline']}</h2>
      <p style="color:#94a3b8;font-size:15px;line-height:1.7;margin-bottom:24px;">
        Hello <strong style="color:#e2e8f0;">{org_name}</strong>,<br/><br/>
        {cfg['subline']}
      </p>
      <div style="text-align:center;margin:30px 0;">
        <a href="{cfg['cta_url']}"
           style="background:{accent};color:#fff;text-decoration:none;padding:14px 32px;
                  font-size:13px;font-weight:bold;text-transform:uppercase;letter-spacing:0.12em;
                  border-radius:12px;display:inline-block;">
          {cfg['cta_text']}
        </a>
      </div>
      <div style="border-top:1px solid #1e293b;padding-top:18px;margin-top:30px;
                  font-size:11px;color:#64748b;text-align:center;font-family:monospace;">
        QuickTIMS · Workforce Management Platform
      </div>
    </div>
    """
