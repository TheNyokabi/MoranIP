#!/usr/bin/env python3
"""
Quick fix for parameter ordering in FastAPI routes.
Moves 'request: Request' before parameters with defaults.
"""
import re
import sys
from pathlib import Path

def fix_file(filepath):
    """Fix parameter ordering in a single file."""
    with open(filepath, 'r') as f:
        content = f.read()
    
    # Pattern to match function definitions with the problematic parameter order
    # This looks for functions where:
    # 1. There's a parameter with "= Depends(...)"
    # 2. Followed by "request: Request,"
    # 3. Optionally followed by more parameters with "= Depends(...)"
    
    # Simple replacement: move "request: Request," before "tenant_id: str = Depends(...)"
    pattern = r'(\ndef \w+\(\n)(\s+tenant_id: str = Depends\([^)]+\),\n)(\s+request: Request,\n)'
    replacement = r'\1\3\2'
    
    new_content = re.sub(pattern, replacement, content)
    
    # Also handle path parameters that come after default parameters
    # Pattern: (path_param: str,) after (param = Depends(...),)
    lines = new_content.split('\n')
    result_lines = []
    i = 0
    
    while i < len(lines):
        if 'def ' in lines[i] and '(' in lines[i]:
            # Collect the function signature
            func_lines = [lines[i]]
            i += 1
            paren_depth = lines[func_lines[0]].count('(') - lines[func_lines[0]].count(')')
            
            while i < len(lines) and paren_depth > 0:
                func_lines.append(lines[i])
                paren_depth += lines[i].count('(') - lines[i].count(')')
                i += 1
            
            # Now reorder parameters if needed
            params = []
            non_param_lines = []
            
            for idx, line in enumerate(func_lines):
                if idx == 0:  # function def line
                    non_param_lines.append((idx, line))
                elif ')' in line and '=' not in line.split(')')[0]:  # closing line
                    non_param_lines.append((idx, line))
                elif ':' in line and '=' not in line:  # path parameter (no default)
                    params.append((idx, line, 'path'))
                elif '= Depends(' in line or '= Body(' in line:  # dependency parameter
                    params.append((idx, line, 'dep'))
                else:
                    non_param_lines.append((idx, line))
            
            # Check if we need to reorder
            has_issue = False
            for idx, (_, param, ptype) in enumerate(params):
                if ptype == 'path':
                    # Check if there's a dep before this
                    for prev_idx in range(idx):
                        if params[prev_idx][2] == 'dep':
                            has_issue = True
                            break
                if has_issue:
                    break
            
            if has_issue:
                # Reorder: path params first, then deps
                path_params = [(idx, line) for (idx, line, ptype) in params if ptype == 'path']
                dep_params = [(idx, line) for (idx, line, ptype) in params if ptype == 'dep']
                
                # Rebuild function signature
                new_func_lines = []
                for idx, line in non_param_lines:
                    if idx == 0:
                        new_func_lines.append(line)
                    elif idx == len(func_lines) - 1:
                        # Add all params before closing
                        for _, param_line in path_params + dep_params:
                            new_func_lines.append(param_line)
                        new_func_lines.append(line)
                    else:
                        new_func_lines.append(line)
                
                result_lines.extend(new_func_lines)
            else:
                result_lines.extend(func_lines)
        else:
            result_lines.append(lines[i])
            i += 1
    
    fixed_content = '\n'.join(result_lines)
    
    if fixed_content != content:
        with open(filepath, 'w') as f:
            f.write(fixed_content)
        return True
    return False

def main():
    routers_dir = Path(__file__).parent / 'app' / 'routers'
    
    files = [
        'crm.py', 'hr.py', 'manufacturing.py', 'projects.py',
        'erpnext.py', 'assets.py', 'quality.py', 'sales.py',
        'support.py', 'user_roles.py', 'purchases.py',
        'inventory.py',
    ]
    
    for filename in files:
        filepath = routers_dir / filename
        if filepath.exists():
            if fix_file(filepath):
                print(f"✓ {filename}")
            else:
                print(f"  {filename} (no changes)")

if __name__ == '__main__':
    main()
