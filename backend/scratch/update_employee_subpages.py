import os

file_path = r"C:\Users\user\Caltrackk\Caltrack\frontend\src\ui\pages\EmployeeSubPages.jsx"

if not os.path.exists(file_path):
    print(f"Error: {file_path} not found")
    exit(1)

with open(file_path, "r", encoding="utf-8") as f:
    code = f.read()

# 1. Update imports
import_target = 'import { apiRequest, unwrapResults } from "../../api/client.js"'
import_replacement = 'import { apiRequest, unwrapResults } from "../../api/client.js"\nimport { apiFetchRegistrationDossier } from "../../api/authService.js"'

if import_target in code:
    code = code.replace(import_target, import_replacement)
    print("Imports updated successfully")
else:
    print("Warning: import target not found")

# 2. Update EmployeesDashboardPage dossier useEffect
dashboard_target = """  useEffect(() => {
    // Check local storage for dossier status to adjust pending/approved/rejected dynamically
    const dossier = localStorage.getItem("caltrack_activation_dossier")
    if (dossier) {
      try {
        const parsed = JSON.parse(dossier)
        const status = parsed.adminClearance?.status
        if (status === "pending") {
          setMetrics({ pending: 1, approved: 245, rejected: 18 })
        } else if (status === "approved") {
          setMetrics({ pending: 0, approved: 246, rejected: 18 })
        } else if (status === "rejected") {
          setMetrics({ pending: 0, approved: 245, rejected: 19 })
        }
      } catch (e) {}
    }
  }, [])"""

dashboard_replacement = """  useEffect(() => {
    async function load() {
      let savedDossier = localStorage.getItem("caltrack_activation_dossier")
      try {
        const backendDossier = await apiFetchRegistrationDossier()
        if (backendDossier && backendDossier.regForm?.fullName) {
          savedDossier = JSON.stringify(backendDossier)
          localStorage.setItem("caltrack_activation_dossier", savedDossier)
        }
      } catch (e) {}

      if (savedDossier) {
        try {
          const parsed = JSON.parse(savedDossier)
          const status = parsed.adminClearance?.status
          if (status === "pending") {
            setMetrics({ pending: 1, approved: 245, rejected: 18 })
          } else if (status === "approved") {
            setMetrics({ pending: 0, approved: 246, rejected: 18 })
          } else if (status === "rejected") {
            setMetrics({ pending: 0, approved: 245, rejected: 19 })
          }
        } catch (e) {}
      }
    }
    load()
  }, [])"""

if dashboard_target in code:
    code = code.replace(dashboard_target, dashboard_replacement)
    print("Dashboard page useEffect updated successfully")
else:
    print("Warning: dashboard page useEffect target not found")

# 3. Update RejectedEmployeesPage dossier useEffect
rejected_target = """  useEffect(() => {
    // Check if current dossier is rejected
    const dossier = localStorage.getItem("caltrack_activation_dossier")
    if (dossier) {
      try {
        const parsed = JSON.parse(dossier)
        if (parsed.adminClearance?.status === "rejected") {
          setRejected([
            {
              id: "EMP-2048",
              name: parsed.regForm.fullName,
              email: parsed.regForm.email,
              reason: parsed.adminClearance.remarks || "Aadhaar validation mismatch.",
              rejectedOn: parsed.adminClearance.rejectedOn || "02 Jun 2026",
            }
          ])
          return
        }
      } catch (e) {}
    }
    // Static fallback list if no active rejection simulation is running
    setRejected([
      { id: "EMP-1082", name: "Kunal Sharma", email: "kunal@caltrack.com", reason: "Blurred Aadhaar document scan", rejectedOn: "31 May 2026" },
      { id: "EMP-0925", name: "Riya Verma", email: "riya@caltrack.com", reason: "Face verification mesh match score below 90%", rejectedOn: "28 May 2026" },
    ])
  }, [])"""

rejected_replacement = """  useEffect(() => {
    async function load() {
      let savedDossier = localStorage.getItem("caltrack_activation_dossier")
      try {
        const backendDossier = await apiFetchRegistrationDossier()
        if (backendDossier && backendDossier.regForm?.fullName) {
          savedDossier = JSON.stringify(backendDossier)
          localStorage.setItem("caltrack_activation_dossier", savedDossier)
        }
      } catch (e) {}

      if (savedDossier) {
        try {
          const parsed = JSON.parse(savedDossier)
          if (parsed.adminClearance?.status === "rejected") {
            setRejected([
              {
                id: "EMP-2048",
                name: parsed.regForm.fullName,
                email: parsed.regForm.email,
                reason: parsed.adminClearance.remarks || "Aadhaar validation mismatch.",
                rejectedOn: parsed.adminClearance.rejectedOn || "02 Jun 2026",
              }
            ])
            return
          }
        } catch (e) {}
      }

      // Static fallback list if no active rejection simulation is running
      setRejected([
        { id: "EMP-1082", name: "Kunal Sharma", email: "kunal@caltrack.com", reason: "Blurred Aadhaar document scan", rejectedOn: "31 May 2026" },
        { id: "EMP-0925", name: "Riya Verma", email: "riya@caltrack.com", reason: "Face verification mesh match score below 90%", rejectedOn: "28 May 2026" },
      ])
    }
    load()
  }, [])"""

if rejected_target in code:
    code = code.replace(rejected_target, rejected_replacement)
    print("Rejected page useEffect updated successfully")
else:
    print("Warning: rejected page useEffect target not found")

# 4. Update DocumentVaultPage dossier useEffect
vault_target = """  useEffect(() => {
    const dossier = localStorage.getItem("caltrack_activation_dossier")
    if (dossier) {
      try {
        const parsed = JSON.parse(dossier)
        if (parsed.regForm && parsed.docForm) {
          const fresh = [
            { name: parsed.regForm.fullName, type: "Aadhaar Card", file: parsed.docForm.aadhaarFile || "aadhaar_scan.pdf", check: "OCR Approved (99%)" },
            { name: parsed.regForm.fullName, type: "PAN Card", file: parsed.docForm.panFile || "pan_scan.pdf", check: "OCR Approved (98%)" },
            { name: parsed.regForm.fullName, type: "Bank Passbook", file: parsed.docForm.bankPassbookFile || "passbook.pdf", check: "Checksum Passed" },
          ]
          setVault(fresh)
        }
      } catch (e) {}
    }
  }, [])"""

vault_replacement = """  useEffect(() => {
    async function load() {
      let savedDossier = localStorage.getItem("caltrack_activation_dossier")
      try {
        const backendDossier = await apiFetchRegistrationDossier()
        if (backendDossier && backendDossier.regForm?.fullName) {
          savedDossier = JSON.stringify(backendDossier)
          localStorage.setItem("caltrack_activation_dossier", savedDossier)
        }
      } catch (e) {}

      if (savedDossier) {
        try {
          const parsed = JSON.parse(savedDossier)
          if (parsed.regForm && parsed.docForm) {
            const fresh = [
              { name: parsed.regForm.fullName, type: "Aadhaar Card", file: parsed.docForm.aadhaarFile || "aadhaar_scan.pdf", check: "OCR Approved (99%)" },
              { name: parsed.regForm.fullName, type: "PAN Card", file: parsed.docForm.panFile || "pan_scan.pdf", check: "OCR Approved (98%)" },
              { name: parsed.regForm.fullName, type: "Bank Passbook", file: parsed.docForm.bankPassbookFile || "passbook.pdf", check: "Checksum Passed" },
            ]
            setVault(fresh)
          }
        } catch (e) {}
      }
    }
    load()
  }, [])"""

if vault_target in code:
    code = code.replace(vault_target, vault_replacement)
    print("Vault page useEffect updated successfully")
else:
    print("Warning: vault page useEffect target not found")

# 5. Update TrainingRecordsPage dossier useEffect
training_target = """  useEffect(() => {
    const dossier = localStorage.getItem("caltrack_activation_dossier")
    if (dossier) {
      try {
        const parsed = JSON.parse(dossier)
        if (parsed.regForm && parsed.academyState) {
          const fresh = [
            {
              name: parsed.regForm.fullName,
              status: parsed.academyState.isCompleted ? "Completed" : "In Progress",
              completion: parsed.academyState.isCompleted ? "100%" : "60%",
              quiz: parsed.academyState.isCompleted ? "92%" : "—",
              statusText: parsed.academyState.isCompleted ? "PASSED" : "PENDING"
            }
          ]
          setRecords(fresh)
        }
      } catch (e) {}
    }
  }, [])"""

training_replacement = """  useEffect(() => {
    async function load() {
      let savedDossier = localStorage.getItem("caltrack_activation_dossier")
      try {
        const backendDossier = await apiFetchRegistrationDossier()
        if (backendDossier && backendDossier.regForm?.fullName) {
          savedDossier = JSON.stringify(backendDossier)
          localStorage.setItem("caltrack_activation_dossier", savedDossier)
        }
      } catch (e) {}

      if (savedDossier) {
        try {
          const parsed = JSON.parse(savedDossier)
          if (parsed.regForm && parsed.academyState) {
            const fresh = [
              {
                name: parsed.regForm.fullName,
                status: parsed.academyState.isCompleted ? "Completed" : "In Progress",
                completion: parsed.academyState.isCompleted ? "100%" : "60%",
                quiz: parsed.academyState.isCompleted ? "92%" : "—",
                statusText: parsed.academyState.isCompleted ? "PASSED" : "PENDING"
              }
            ]
            setRecords(fresh)
          }
        } catch (e) {}
      }
    }
    load()
  }, [])"""

if training_target in code:
    code = code.replace(training_target, training_replacement)
    print("Training page useEffect updated successfully")
else:
    print("Warning: training page useEffect target not found")

with open(file_path, "w", encoding="utf-8") as f:
    f.write(code)

print("EmployeeSubPages.jsx updates finished!")
