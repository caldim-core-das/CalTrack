"""
Test Supabase connection pooler hosts
"""
import psycopg2

project_ref = "wvkudncxjysixtmuxdit"
user = f"postgres.{project_ref}"
password = "Caltrack@123"
dbname = "postgres"

poolers = [
    "aws-0-ap-south-1.pooler.supabase.com",
    "aws-0-us-east-1.pooler.supabase.com",
    "aws-0-us-west-1.pooler.supabase.com",
    "aws-0-eu-central-1.pooler.supabase.com",
    "aws-0-ap-southeast-1.pooler.supabase.com",
    "aws-0-ap-northeast-1.pooler.supabase.com",
    "aws-0-sa-east-1.pooler.supabase.com",
]

connected = False
for host in poolers:
    for port in [5432, 6543]:
        try:
            print(f"Testing {host}:{port} with user {user}...", end=" ")
            conn = psycopg2.connect(
                dbname=dbname,
                user=user,
                password=password,
                host=host,
                port=port,
                sslmode="require",
                connect_timeout=5
            )
            print("✅ SUCCESS!")
            print(f"--> MATCHING POOLER HOST: {host}, PORT: {port}")
            conn.close()
            connected = True
            break
        except Exception as e:
            err_msg = str(e).strip().replace("\n", " ")
            print(f"FAILED ({err_msg})")
    if connected:
        break

if not connected:
    print("\nCould not auto-detect pooler region host.")
