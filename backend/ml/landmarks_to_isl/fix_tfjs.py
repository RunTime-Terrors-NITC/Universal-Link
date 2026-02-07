"""
Fix tensorflowjs NumPy Compatibility Issue
This patches the tensorflowjs package to work with newer NumPy versions
"""

import os
import sys

# Find the tensorflowjs installation path
try:
    import tensorflowjs
    tfjs_path = os.path.dirname(tensorflowjs.__file__)
    read_weights_file = os.path.join(tfjs_path, 'read_weights.py')
    
    print(f"Found tensorflowjs at: {tfjs_path}")
    print(f"Patching: {read_weights_file}")
    
    # Read the file
    with open(read_weights_file, 'r') as f:
        content = f.read()
    
    # Backup original
    backup_file = read_weights_file + '.backup'
    if not os.path.exists(backup_file):
        with open(backup_file, 'w') as f:
            f.write(content)
        print(f"Created backup: {backup_file}")
    
    # Fix the deprecated NumPy aliases
    replacements = [
        ('np.object', 'object'),
        ('np.bool', 'bool'),
        ('np.int', 'int'),
        ('np.float', 'float'),
    ]
    
    modified = False
    for old, new in replacements:
        if old in content:
            content = content.replace(old, new)
            modified = True
            print(f"  Replaced '{old}' with '{new}'")
    git 
    if modified:
        # Write the fixed content
        with open(read_weights_file, 'w') as f:
            f.write(content)
        print("\n✅ Successfully patched tensorflowjs!")
        print("\nNow you can run convert_model.py")
    else:
        print("\n⚠️ File already appears to be patched or uses different syntax")
        
except ImportError:
    print("❌ tensorflowjs is not installed")
    print("\nInstall it with: pip install tensorflowjs")
except Exception as e:
    print(f"❌ Error: {e}")
    print("\nYou may need to run this with sudo or fix permissions")