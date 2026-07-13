# CalTrack — Danger Zone: Technical & Product Documentation

> **Section:** Settings → Danger Zone  
> **File:** `frontend/src/ui/pages/settings/DangerZoneSection.jsx`  
> **Backend:** `backend/settings_hub/views.py` → `WorkspaceDeletionView`, `OwnerTransferView`  
> **Access Level:** Admin only  
> **Date:** June 25, 2026

---

## 1. What is the Danger Zone?

The **Danger Zone** is a dedicated section in the Settings module that exposes high-impact, irreversible administrative actions for a workspace (company/organisation). It follows industry-standard patterns used by GitHub, Notion, Vercel, Slack, and other SaaS platforms.

It is accessible only by users with the **Admin** role. Employees see a locked screen: *"Admin access required."*

---

## 2. Why Does a SaaS Product Need This?

### 2.1 Legal Requirement — GDPR (EU) & UK GDPR

Under **GDPR Article 17 — Right to Erasure ("Right to be Forgotten")**, any customer (data controller) has the legal right to request that all their data be permanently deleted from your platform.

> If you refuse or have no mechanism to comply, you are exposed to fines of up to **€20,000,000 or 4% of global annual revenue**, whichever is higher.

Since CalTrack targets both **US and UK organisations**, the following regulations apply:

| Regulation | Jurisdiction | Requirement |
|:---|:---|:---|
| **GDPR Art. 17** | European Union | Right to erasure of all personal data |
| **UK GDPR** | United Kingdom | Identical right to erasure post-Brexit |
| **CCPA** | California, USA | Right to delete personal information |

### 2.2 Business & Trust Reasons

| Reason | Explanation |
|:---|:---|
| **Customer trust** | Companies won't sign up if they feel permanently locked in |
| **Trial cleanup** | Customers who tested during free trial need a clean exit |
| **Subscription cancellations** | Cancelled customers have the right to remove their data |
| **Churn handling** | A clean offboarding process reduces support tickets and legal risk |

---

## 3. Current Implementation

### 3.1 Action 1 — Transfer Workspace Ownership

**Purpose:** Transfer full ownership of the workspace to another admin member.

**Flow:**
1. Admin clicks **"Transfer ownership"** button
2. A confirmation form expands in-place:
   - Enters the **new owner's email address**
   - Must type the word **`TRANSFER`** exactly to enable the confirm button
3. On confirm → calls `POST /settings/data/transfer-ownership/`
4. Backend validates the new owner exists in the same company and is active
5. New owner's role is upgraded to `admin`
6. Current admin's role is downgraded to `manager`

**Safety Guards:**
- Confirm button disabled until both fields are correctly filled
- Cannot transfer to yourself
- Cannot transfer to a user outside your company
- Cannot transfer to an inactive user

**Backend logic (`OwnerTransferView`):**
```python
new_owner = User.objects.filter(
    email=new_owner_email,
    company=request.user.company,
    is_active=True
).first()

new_owner.role = "admin"
request.user.role = "manager"
```

---

### 3.2 Action 2 — Delete Workspace

**Purpose:** Permanently delete the workspace and all associated data.

**What gets deleted:**
- Company record
- All employee profiles
- All time logs and break records
- All leave requests and approvals
- All payroll records and payslips
- All compliance audit trail records
- All mileage trips
- All right-to-work documents
- All WTR opt-out agreements
- All user accounts associated with the company

**Flow:**
1. Admin clicks **"Delete workspace"** button
2. A confirmation form expands showing:
   - Warning: *"This will permanently delete your workspace. There is NO recovery option."*
   - Input field: Admin must type the **exact workspace/company name**
   - Expected value is displayed below the input for reference
3. On confirm → calls `POST /settings/data/delete-workspace/`
4. Backend validates the typed name matches the company name exactly
5. Deletion is processed

**Safety Guards:**
- Confirm button disabled until workspace name is typed
- Name must match exactly (case-sensitive)
- Admin role required
- Non-admins (employees) see a locked screen

**Current Backend State:**
```python
# WorkspaceDeletionView — current implementation
# NOTE: Currently returns a scheduled message without actual deletion.
# Actual deletion logic is pending implementation of the 30-day soft delete flow.
return Response({
    "success": True,
    "message": "Workspace deletion scheduled. You will receive a confirmation email."
})
```

> ⚠️ **Important:** The current backend does NOT delete any data. It returns a success message only. The actual deletion mechanism needs the 30-Day Soft Delete implementation described in Section 5.

---

## 4. The Rogue Admin Problem

### 4.1 What is it?

A **rogue or vengeful admin** is a scenario where:
- A disgruntled employee with admin access intentionally deletes the workspace
- An admin who is leaving the company acts maliciously before their account is deactivated
- An admin accidentally triggers deletion without understanding the consequences
- A compromised admin account is used by a bad actor to destroy company data

### 4.2 Risk Assessment

| Risk Level | Scenario |
|:---|:---|
| 🔴 **Critical** | Disgruntled admin deletes workspace before resignation |
| 🔴 **Critical** | Account compromise — attacker gains admin credentials and deletes data |
| 🟡 **High** | Admin misunderstands the action and confirms deletion accidentally |
| 🟡 **High** | Admin tests the feature in production thinking it is reversible |

### 4.3 Current Protections (Already in Place)

| Protection | Status |
|:---|:---|
| Admin-only access | ✅ Implemented |
| Must type exact workspace name | ✅ Implemented |
| Warning banner shown prominently | ✅ Implemented |
| Non-admins see locked screen | ✅ Implemented |
| Backend validates name match server-side | ✅ Implemented |

### 4.4 Missing Protection

| Missing Protection | Risk |
|:---|:---|
| No email alert sent to workspace owner | Owner has no notification if a rogue admin triggers deletion |
| No grace period / undo window | Once triggered (when real deletion is implemented), data is gone immediately |
| No audit log of the deletion trigger event | No forensic trail of who triggered it and when |

---

## 5. Recommended Enhancement — 30-Day Soft Delete

### 5.1 What is Soft Delete?

Instead of immediately destroying data, the system **marks the workspace for deletion** and starts a countdown. During this window, any admin (including the original owner) can cancel the request.

This is the standard approach used by:
- **Google Workspace** — 20-day recovery window
- **GitHub** — 90-day recovery window for organisations
- **Notion** — 30-day page recovery
- **Slack** — 30-day deactivation grace period

### 5.2 Proposed Flow

```
Admin triggers "Delete workspace" + types workspace name
                    ↓
Backend sets: company.deletion_scheduled_at = now()
Backend sets: company.deletion_status = "scheduled"
                    ↓
Immediate email sent to ALL admin email addresses:
"⚠️ Your workspace [Name] is scheduled for deletion in 30 days.
 If this was a mistake, click here to cancel immediately."
                    ↓
Dashboard shows a red warning banner to all admins:
"⚠️ This workspace is scheduled for deletion on [date].
 [Cancel Deletion] button visible."
                    ↓
Grace period: 30 days
                    ↓
Any admin can click "Cancel Deletion" at any time during 30 days
                    ↓
After 30 days → Scheduled task permanently deletes all data
                    ↓
Final confirmation email sent:
"Your workspace [Name] has been permanently deleted."
```

### 5.3 Backend Changes Required

#### Company Model Addition
```python
# companies/models.py
deletion_scheduled_at = models.DateTimeField(null=True, blank=True)
deletion_status = models.CharField(
    max_length=20,
    choices=[
        ("active", "Active"),
        ("scheduled", "Scheduled for Deletion"),
        ("deleted", "Deleted"),
    ],
    default="active"
)
```

#### Updated WorkspaceDeletionView
```python
class WorkspaceDeletionView(APIView):
    def post(self, request):
        # 1. Validate name match
        # 2. Set soft delete fields
        company.deletion_scheduled_at = timezone.now()
        company.deletion_status = "scheduled"
        company.save()
        # 3. Send alert email to all admins
        send_deletion_alert_email(company)
        # 4. Log to audit trail
        AuditLog.objects.create(action="WORKSPACE_DELETION_SCHEDULED", ...)
        return Response({"success": True, "deletion_date": deletion_date})
```

#### Cancel Endpoint (New)
```python
class CancelWorkspaceDeletionView(APIView):
    def post(self, request):
        company.deletion_scheduled_at = None
        company.deletion_status = "active"
        company.save()
        send_deletion_cancelled_email(company)
        return Response({"success": True, "message": "Deletion cancelled."})
```

#### Scheduled Cleanup Task
```python
# Run daily via cron/Celery beat
def purge_scheduled_workspaces():
    threshold = timezone.now() - timedelta(days=30)
    companies = Company.objects.filter(
        deletion_status="scheduled",
        deletion_scheduled_at__lte=threshold
    )
    for company in companies:
        # Delete all related data
        # Send final confirmation email
        company.delete()
```

### 5.4 Frontend Changes Required

#### Warning Banner (shown to all admins during grace period)
```
┌─────────────────────────────────────────────────────────┐
│ ⚠️  This workspace is scheduled for permanent deletion  │
│     on [DATE]. All data will be lost.                   │
│                    [Cancel Deletion]                    │
└─────────────────────────────────────────────────────────┘
```

---

## 6. Access Control Summary

| Role | Can See Danger Zone | Can Transfer Ownership | Can Delete Workspace |
|:---|:---|:---|:---|
| **Admin** | ✅ Yes | ✅ Yes | ✅ Yes |
| **Manager** | ❌ Locked screen | ❌ No | ❌ No |
| **Employee** | ❌ Locked screen | ❌ No | ❌ No |

---

## 7. Audit Trail Recommendation

Every Danger Zone action should be written to the immutable `AuditLog`:

| Action | Log Entry |
|:---|:---|
| Transfer ownership triggered | `action: OWNERSHIP_TRANSFER`, before/after roles |
| Deletion scheduled | `action: WORKSPACE_DELETION_SCHEDULED`, triggered_by, scheduled_date |
| Deletion cancelled | `action: WORKSPACE_DELETION_CANCELLED`, cancelled_by |
| Deletion completed | `action: WORKSPACE_DELETED`, final confirmation |

---

## 8. Current Status Summary

| Feature | Status |
|:---|:---|
| Transfer ownership — frontend UI | ✅ Complete |
| Transfer ownership — backend logic | ✅ Complete |
| Delete workspace — frontend UI | ✅ Complete |
| Delete workspace — backend name validation | ✅ Complete |
| Delete workspace — actual data deletion | ⚠️ Placeholder (returns message only) |
| 30-day soft delete grace period | 🔲 Planned |
| Email alert on deletion trigger | 🔲 Planned |
| Cancellation flow | 🔲 Planned |
| Dashboard warning banner during grace period | 🔲 Planned |
| Audit log for Danger Zone actions | 🔲 Planned |

---

*This document was prepared by the development team to describe the Danger Zone module, its legal context, current implementation state, risk analysis, and recommended enhancements for the CalTrack application.*
