"""
Provisioning Exception Classes

Custom exceptions for provisioning operations with error classification.

Author: MoranERP Team
"""


class ProvisioningError(Exception):
    """Base provisioning error"""
    pass


class CriticalProvisioningError(ProvisioningError):
    """
    Critical error that blocks provisioning.
    
    Examples:
    - Chart of accounts import fails
    - Company creation fails
    - Required warehouse creation fails
    """
    def __init__(self, message: str, step: str = None, error_details: dict = None):
        super().__init__(message)
        self.step = step
        self.error_details = error_details or {}


class TransientProvisioningError(ProvisioningError):
    """
    Transient error that can be retried.
    
    Examples:
    - Network timeout
    - Connection errors
    - Temporary service unavailability
    """
    def __init__(self, message: str, step: str = None, retry_after: int = None):
        super().__init__(message)
        self.step = step
        self.retry_after = retry_after


class NonCriticalProvisioningError(ProvisioningError):
    """
    Non-critical error that can be skipped.
    
    Examples:
    - Demo items creation fails
    - Optional settings update fails
    """
    def __init__(self, message: str, step: str = None):
        super().__init__(message)
        self.step = step
