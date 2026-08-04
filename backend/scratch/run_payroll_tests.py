import os
import sys
import django

sys.path.insert(0, os.getcwd())

os.environ['DJANGO_SECRET_KEY'] = 'dev-secret-key-12345'
os.environ['DJANGO_ALLOWED_HOSTS'] = 'localhost,127.0.0.1,testserver,*'
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'quicktims.settings')
django.setup()

from django.core.management import call_command
call_command("migrate", interactive=False)

import unittest
from payroll.tests.test_services import PayrollServicesTest
from service_requests.test_payment_hook import PaymentHookIntegrationTest
from payroll.tests.test_employee_wallet import EmployeeWalletApiTest
from payroll.tests.test_settlement_and_disputes import SettlementAndDisputesTest

if __name__ == '__main__':
    loader = unittest.TestLoader()
    suite = unittest.TestSuite()
    suite.addTests(loader.loadTestsFromTestCase(PayrollServicesTest))
    suite.addTests(loader.loadTestsFromTestCase(PaymentHookIntegrationTest))
    suite.addTests(loader.loadTestsFromTestCase(EmployeeWalletApiTest))
    suite.addTests(loader.loadTestsFromTestCase(SettlementAndDisputesTest))
    runner = unittest.TextTestRunner(verbosity=2)
    result = runner.run(suite)
    sys.exit(not result.wasSuccessful())
