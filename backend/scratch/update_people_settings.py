import os

file_path = r"C:\Users\user\Caltrackk\Caltrack\frontend\src\ui\pages\PeopleSettingsPage.jsx"

if not os.path.exists(file_path):
    print(f"Error: {file_path} not found")
    exit(1)

with open(file_path, "r", encoding="utf-8") as f:
    code = f.read()

# Approve block replacement
target_approve = """                                                    localStorage.setItem("caltrack_activation_dossier", JSON.stringify(nextDossier))
                                                    setDossierData(nextDossier)"""

replacement_approve = """                                                    localStorage.setItem("caltrack_activation_dossier", JSON.stringify(nextDossier))
                                                    await apiSaveRegistrationDossier(nextDossier)
                                                    setDossierData(nextDossier)"""

# Reject block replacement
target_reject = """                                                    localStorage.setItem("caltrack_activation_dossier", JSON.stringify(nextDossier))
                                                    setDossierData(nextDossier)"""

# Note: the target is identical, so let's do a replace that is specific.
# In the file, the approve onClick is async:
# onClick={async () => {
# while reject onClick is:
# onClick={() => {
# Let's make reject onClick async as well!
# onClick={async () => {

reject_block_target = """                                            <button
                                                onClick={() => {
                                                    const reason = window.prompt("Enter rejection remark/anomaly reason:", "Aadhaar Card mismatch with registration name.")
                                                    if (reason === null) return
                                                    const updatedClearance = { status: "rejected", remarks: reason || "Verification checks failed." }
                                                    const nextDossier = { ...dossierData, adminClearance: updatedClearance }
                                                    localStorage.setItem("caltrack_activation_dossier", JSON.stringify(nextDossier))
                                                    setDossierData(nextDossier)
                                                }}"""

reject_block_replacement = """                                            <button
                                                onClick={async () => {
                                                    const reason = window.prompt("Enter rejection remark/anomaly reason:", "Aadhaar Card mismatch with registration name.")
                                                    if (reason === null) return
                                                    const updatedClearance = { status: "rejected", remarks: reason || "Verification checks failed." }
                                                    const nextDossier = { ...dossierData, adminClearance: updatedClearance }
                                                    localStorage.setItem("caltrack_activation_dossier", JSON.stringify(nextDossier))
                                                    await apiSaveRegistrationDossier(nextDossier)
                                                    setDossierData(nextDossier)
                                                }}"""

if reject_block_target in code:
    code = code.replace(reject_block_target, reject_block_replacement)
    print("Updated reject block successfully!")
else:
    print("Warning: reject block target not found")

# Approve block has async in onClick, so let's replace it:
approve_block_target = """                                                    localStorage.setItem("caltrack_activation_dossier", JSON.stringify(nextDossier))
                                                    setDossierData(nextDossier)
                                                    
                                                    // Auto-create employee record in DB"""

approve_block_replacement = """                                                    localStorage.setItem("caltrack_activation_dossier", JSON.stringify(nextDossier))
                                                    await apiSaveRegistrationDossier(nextDossier)
                                                    setDossierData(nextDossier)
                                                    
                                                    // Auto-create employee record in DB"""

if approve_block_target in code:
    code = code.replace(approve_block_target, approve_block_replacement)
    print("Updated approve block successfully!")
else:
    print("Warning: approve block target not found")

with open(file_path, "w", encoding="utf-8") as f:
    f.write(code)

print("Finished!")
