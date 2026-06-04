import os
import django
from django.db import connection

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "quicktims.settings")
django.setup()

duplicates_to_delete = [
    {"id": 2, "schema": "demo"},
    {"id": 5, "schema": "caldim_kal_2"},
    {"id": 7, "schema": "caldim"},
    {"id": 8, "schema": "caldim_2"},
    {"id": 11, "schema": "caldim_4"},
    {"id": 17, "schema": "caldimmm_2"},
]

company_ids = [item["id"] for item in duplicates_to_delete]

print("=== STARTING RAW SQL DUPLICATE CLEANUP (WITH FK RESOLUTION) ===")

connection.set_schema_to_public()

with connection.cursor() as cursor:
    # 1. Nullify the company foreign keys in accounts_user to prevent constraint violations
    try:
        print(f"Nullifying company references in accounts_user for IDs {company_ids}...")
        cursor.execute("UPDATE accounts_user SET company_id = NULL WHERE company_id IN %s;", [tuple(company_ids)])
        print("Successfully nullified user references.")
    except Exception as e:
        print(f"Error nullifying user references: {e}")

    # 2. Proceed with schema, domain, and company deletion
    for item in duplicates_to_delete:
        company_id = item["id"]
        schema_name = item["schema"]
        
        print(f"\nProcessing deletion for Schema: '{schema_name}' (ID: {company_id})")
        
        # Drop the schema cascade
        try:
            print(f"  - Dropping PostgreSQL schema '{schema_name}' CASCADE...")
            cursor.execute(f"DROP SCHEMA IF EXISTS {schema_name} CASCADE;")
            print("    Successfully dropped schema.")
        except Exception as e:
            print(f"    Error dropping schema: {e}")
            
        # Delete domains linked to this company
        try:
            print(f"  - Deleting domain records for tenant ID {company_id}...")
            cursor.execute("DELETE FROM companies_domain WHERE tenant_id = %s;", [company_id])
            print("    Successfully deleted domains.")
        except Exception as e:
            print(f"    Error deleting domains: {e}")
            
        # Delete the company record itself
        try:
            print(f"  - Deleting company record for ID {company_id}...")
            cursor.execute("DELETE FROM companies_company WHERE id = %s;", [company_id])
            print("    Successfully deleted company.")
        except Exception as e:
            print(f"    Error deleting company: {e}")

print("\n=== RAW SQL DUPLICATE CLEANUP COMPLETED ===")
