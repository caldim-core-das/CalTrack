import requests

url = "http://localhost:8000/api/auth/login/"
payload = {
    "username": "admin@caltrack.com",
    "password": "Admin@1234"
}

session = requests.Session()
r = session.post(url, json=payload)
print("Login status:", r.status_code)
print("Login response:", r.json() if r.status_code == 200 else r.text)

# Now call the employees endpoint
r_emp = session.get("http://localhost:8000/api/employees/")
print("\nEmployees status:", r_emp.status_code)
if r_emp.status_code == 200:
    data = r_emp.json()
    print("Employees count:", len(data) if isinstance(data, list) else data.get("count", "N/A"))
    print("Employees data:", data)
else:
    print("Employees error:", r_emp.text)
