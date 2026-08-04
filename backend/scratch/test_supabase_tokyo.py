"""
Test Supabase pooler host Tokyo/ap-northeast-1
"""
import psycopg2

user = "postgres.wvkudncxjysixtmuxdit"
password = "Caltrack@123"
dbname = "postgres"
host = "aws-0-ap-northeast-1.pooler.supabase.com"

for port in [5432, 6543]:
    try:
        conn = psycopg2.connect(
            dbname=dbname,
            user=user,
            password=password,
            host=host,
            port=port,
            sslmode="require",
            connect_timeout=5
        )
        print(f"SUCCESS CONNECTING TO {host}:{port}")
        conn.close()
    except Exception as e:
        print(f"FAILED {host}:{port} -> {e}")
