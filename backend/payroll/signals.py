"""
payroll/signals.py

Django signals for payroll domain events.
"""

from django.dispatch import Signal

# Signal emitted after credit_wallet_transaction succeeds.
# Signal arguments: transaction, booking, employee, org
wallet_credited = Signal()
