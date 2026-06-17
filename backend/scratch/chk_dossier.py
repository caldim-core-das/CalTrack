import json

with open("caltrack_activation_dossier.json", "r", encoding="utf-8") as f:
    d = json.load(f)

print("Keys in dossier:", list(d.keys()))
if "adminClearance" in d:
    print("adminClearance:", d["adminClearance"])
else:
    print("No adminClearance in dossier")
if "regForm" in d:
    print("regForm fullName:", d["regForm"].get("fullName"))
    print("regForm email:", d["regForm"].get("email"))
