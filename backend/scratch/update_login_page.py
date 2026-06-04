import os

file_path = r"C:\Users\user\Caltrackk\Caltrack\frontend\src\ui\pages\LoginPage.jsx"

if not os.path.exists(file_path):
    print(f"Error: {file_path} not found")
    exit(1)

with open(file_path, "r", encoding="utf-8") as f:
    code = f.read()

# 1. Update imports
import_target = 'import { extractAuthError } from "../../api/authService.js"'
import_replacement = 'import { extractAuthError, apiFetchRegistrationDossier, apiDeleteRegistrationDossier } from "../../api/authService.js"'

if import_target in code:
    code = code.replace(import_target, import_replacement)
    print("Imports updated successfully")
else:
    print("Warning: import target not found")

# 2. Update signin intercept block
# We want to fetch the dossier from the backend before reading it from localStorage
signin_intercept_target = """    if (mode === "signin") {
      const ve = validateLoginForm({ identifier: username, password })
      if (ve) return setError(ve)
      setLoading(true)
      
      const savedDossier = localStorage.getItem("caltrack_activation_dossier")"""

signin_intercept_replacement = """    if (mode === "signin") {
      const ve = validateLoginForm({ identifier: username, password })
      if (ve) return setError(ve)
      setLoading(true)
      
      // Sync dossier from backend first
      let savedDossier = localStorage.getItem("caltrack_activation_dossier")
      try {
        const backendDossier = await apiFetchRegistrationDossier()
        if (backendDossier && backendDossier.regForm?.fullName) {
          savedDossier = JSON.stringify(backendDossier)
          localStorage.setItem("caltrack_activation_dossier", savedDossier)
        }
      } catch (err) {
        console.error("Fetch registration dossier pre-login intercept error", err)
      }"""

if signin_intercept_target in code:
    code = code.replace(signin_intercept_target, signin_intercept_replacement)
    print("Signin intercept updated successfully")
else:
    print("Warning: signin intercept target not found")

# 3. Update confirm button onClick (Approved page)
confirm_click_target = """              <button
                type="button"
                onClick={() => {
                  setEmployeeStatus(null)
                  localStorage.removeItem("caltrack_activation_dossier")
                  navigate(routes.dashboard, { replace: true })
                }}"""

confirm_click_replacement = """              <button
                type="button"
                onClick={async () => {
                  setEmployeeStatus(null)
                  localStorage.removeItem("caltrack_activation_dossier")
                  await apiDeleteRegistrationDossier()
                  navigate(routes.dashboard, { replace: true })
                }}"""

if confirm_click_target in code:
    code = code.replace(confirm_click_target, confirm_click_replacement)
    print("Confirm click handler updated successfully")
else:
    print("Warning: confirm click target not found")

# 4. Update upload new documents button onClick (Rejected page)
upload_click_target = """                <button
                  type="button"
                  onClick={() => {
                    localStorage.removeItem("caltrack_activation_dossier")
                    setEmployeeStatus(null)
                    navigate(routes.activation_journey)
                  }}"""

upload_click_replacement = """                <button
                  type="button"
                  onClick={async () => {
                    localStorage.removeItem("caltrack_activation_dossier")
                    await apiDeleteRegistrationDossier()
                    setEmployeeStatus(null)
                    navigate(routes.activation_journey)
                  }}"""

if upload_click_target in code:
    code = code.replace(upload_click_target, upload_click_replacement)
    print("Upload click handler updated successfully")
else:
    print("Warning: upload click target not found")

with open(file_path, "w", encoding="utf-8") as f:
    f.write(code)

print("LoginPage.jsx updates finished!")
