"""
DateTime Utilities for ERPNext Integration

Provides standardized datetime formatting functions for ERPNext API compatibility.
ERPNext expects MySQL DATETIME format: 'YYYY-MM-DD HH:MM:SS' (without timezone).

Author: MoranERP Team
"""

from datetime import datetime, date, timezone
from typing import Optional, Union


def format_erpnext_datetime(dt: Union[datetime, str, None]) -> Optional[str]:
    """
    Format datetime for ERPNext API.
    
    ERPNext expects MySQL DATETIME format: 'YYYY-MM-DD HH:MM:SS' (no timezone).
    
    Args:
        dt: datetime object, ISO string, or None
        
    Returns:
        Formatted datetime string or None
        
    Examples:
        >>> format_erpnext_datetime(datetime(2026, 1, 12, 19, 48, 22))
        '2026-01-12 19:48:22'
        
        >>> format_erpnext_datetime(datetime.now(timezone.utc))
        '2026-01-12 19:48:22'  # UTC timezone removed
        
        >>> format_erpnext_datetime(None)
        None
    """
    if dt is None:
        return None
    
    # If string, try to parse it
    if isinstance(dt, str):
        try:
            # Try parsing ISO format
            if 'T' in dt:
                dt = datetime.fromisoformat(dt.replace('Z', '+00:00'))
            else:
                # Try MySQL format
                dt = datetime.strptime(dt, '%Y-%m-%d %H:%M:%S')
        except (ValueError, AttributeError):
            # If parsing fails, return as-is (assume it's already formatted)
            return dt
    
    # If datetime object, format it
    if isinstance(dt, datetime):
        # Convert to naive datetime (remove timezone)
        if dt.tzinfo is not None:
            dt = dt.replace(tzinfo=None)
        return dt.strftime('%Y-%m-%d %H:%M:%S')
    
    # Fallback: convert to string
    return str(dt)


def format_erpnext_date(d: Union[date, datetime, str, None]) -> Optional[str]:
    """
    Format date for ERPNext API.
    
    ERPNext expects ISO date format: 'YYYY-MM-DD'.
    
    Args:
        d: date object, datetime object, ISO string, or None
        
    Returns:
        Formatted date string or None
        
    Examples:
        >>> format_erpnext_date(date(2026, 1, 12))
        '2026-01-12'
        
        >>> format_erpnext_date(datetime(2026, 1, 12, 19, 48, 22))
        '2026-01-12'
    """
    if d is None:
        return None
    
    # If string, try to parse it
    if isinstance(d, str):
        try:
            # Try parsing ISO format
            if 'T' in d:
                d = datetime.fromisoformat(d.replace('Z', '+00:00'))
            else:
                # Try date format
                d = datetime.strptime(d, '%Y-%m-%d').date()
        except (ValueError, AttributeError):
            # If parsing fails, return as-is (assume it's already formatted)
            return d
    
    # If datetime object, extract date
    if isinstance(datetime, type) and isinstance(d, datetime):
        d = d.date()
    
    # If date object, format it
    if isinstance(d, date):
        return d.isoformat()
    
    # Fallback: convert to string
    return str(d)


def format_erpnext_time(t: Union[time, datetime, str, None]) -> Optional[str]:
    """
    Format time for ERPNext API.
    
    ERPNext expects time format: 'HH:MM:SS'.
    
    Args:
        t: time object, datetime object, ISO string, or None
        
    Returns:
        Formatted time string or None
        
    Examples:
        >>> format_erpnext_time(time(19, 48, 22))
        '19:48:22'
        
        >>> format_erpnext_time(datetime(2026, 1, 12, 19, 48, 22))
        '19:48:22'
    """
    if t is None:
        return None
    
    # If string, try to parse it
    if isinstance(t, str):
        try:
            # Try parsing time format
            from datetime import time as time_class
            t = time_class.fromisoformat(t)
        except (ValueError, AttributeError):
            # If parsing fails, return as-is (assume it's already formatted)
            return t
    
    # If datetime object, extract time
    if isinstance(datetime, type) and isinstance(t, datetime):
        t = t.time()
    
    # If time object, format it
    from datetime import time as time_class
    if isinstance(t, time_class):
        return t.strftime('%H:%M:%S')
    
    # Fallback: convert to string
    return str(t)
