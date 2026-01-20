#!/usr/bin/env python3
"""
Fix FastAPI function parameter order: non-default arguments must come before default arguments.
This script fixes the common pattern where 'request: Request' comes after a parameter with a default value.
"""
import os
import re
from pathlib import Path

def fix_function_parameters(file_path: Path) -> bool:
    """
    Fix parameter ordering in a Python file.
    Returns True if file was modified, False otherwise.
    """
    with open(file_path, 'r', encoding='utf-8') as f:
        content = f.read()
    
    original_content = content
    lines = content.split('\n')
    modified = False
    i = 0
    
    while i < len(lines):
        line = lines[i]
        
        # Check if  this is a function definition
        if 'def ' in line and '(' in line:
            func_start = i
            # Find the closing parenthesis of function signature
            param_lines = [lines[i]]
            paren_count = line.count('(') - line.count(')')
            i += 1
            
            while i < len(lines) and paren_count > 0:
                param_lines.append(lines[i])
                paren_count += lines[i].count('(') - lines[i].count(')')
                i += 1
            
            # Check if we have the problematic pattern
            params_text = '\n'.join(param_lines)
            
            # Pattern: parameter with default value followed by parameter without default
            # We look for patterns like:
            # tenant_id: str = Depends(...),
            # request: Request,
            
            if 'request: Request,' in params_text or 'request: Request, ' in params_text:
                # Check if request comes after a parameter with default
                param_list = []
                for pl in param_lines:
                    stripped = pl.strip()
                    if stripped and stripped not in [')', '):', 'def ', '']:
                        param_list.append((stripped, pl))
                
                # Extract parameters (skip function name line)
                params = []
                for idx, (stripped, original) in enumerate(param_list):
                    if 'def ' in stripped:
                        continue
                    params.append((stripped, original, idx))
                
                # Find request parameter and check if it should be moved
                request_param = None
                request_idx = None
                has_default_before_request = False
                
                for idx, (param, orig, line_idx) in enumerate(params):
                    if 'request: Request' in param:
                        request_param = (param, orig, line_idx)
                        request_idx = idx
                    elif request_param is None and '=' in param and 'Depends(' in param:
                        has_default_before_request = True
                
                # If request parameter found after default params, reorder
                if request_param and has_default_before_request:
                    # Rebuild the parameter list with request moved earlier
                    new_params = []
                    request_added = False
                    
                    for idx, (param, orig, line_idx) in enumerate(params):
                        # Add request before first parameter with default
                        if not request_added and '=' in param and 'Depends(' in param:
                            new_params.append(request_param)
                            request_added = True
                        
                        # Don't add request again when we reach it
                        if idx != request_idx:
                            new_params.append((param, orig, line_idx))
                    
                    # Rebuild function signature
                    new_param_lines = [param_lines[0]]  # Keep function definition line
                    indent = '    '  # Standard Python indent
                    
                    for idx, (param, orig, line_idx) in enumerate(new_params):
                        # Preserve original formatting/whitespace
                        new_param_lines.append(indent + param)
                    
                    new_param_lines.append(lines[func_start + len(param_lines) - 1])  # Keep closing line
                    
                    # Replace in lines array
                    lines[func_start:func_start + len(param_lines)] = new_param_lines
                    modified = True
                    
            continue
        i += 1
    
    if modified:
        new_content = '\n'.join(lines)
        with open(file_path, 'w', encoding='utf-8') as f:
            f.write(new_content)
        return True
    
    return False

def main():
    # Fix all router files
    routers_dir = Path(__file__).parent / 'app' / 'routers'
    
    files_to_fix = [
        'crm.py',
        'hr.py',
        'manufacturing.py',
        'projects.py',
        'erpnext.py',
        'assets.py',
        'quality.py',
        'sales.py',
        'support.py',
        'user_roles.py',
        # accounting.py already fixed manually
    ]
    
    fixed_count = 0
    for filename in files_to_fix:
        file_path = routers_dir / filename
        if file_path.exists():
            if fix_function_parameters(file_path):
                print(f"✓ Fixed: {filename}")
                fixed_count += 1
            else:
                print(f"- Skipped: {filename} (no changes needed)")
        else:
            print(f"✗ Not found: {filename}")
    
    print(f"\nFixed {fixed_count} files")

if __name__ == '__main__':
    main()
