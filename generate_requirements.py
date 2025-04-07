#!/usr/bin/env python
"""
Generate requirements.txt files from pyproject.toml using UV.

This script uses UV to generate requirements.txt files from pyproject.toml
for both production and development dependencies.

Usage:
    python generate_requirements.py
"""

import os
import platform
import subprocess
import sys
from pathlib import Path


def run_command(cmd, check=True, shell=False, capture_output=False):
    """Run a command and return the result."""
    print(f"Running: {' '.join(cmd) if isinstance(cmd, list) else cmd}")
    result = subprocess.run(cmd, check=check, shell=shell, 
                           capture_output=capture_output)
    return result


def check_uv_installed():
    """Check if UV is installed and install if not."""
    try:
        subprocess.run(["uv", "--version"], 
                      check=True, 
                      stdout=subprocess.PIPE, 
                      stderr=subprocess.PIPE)
        print("UV is already installed.")
        return True
    except (subprocess.CalledProcessError, FileNotFoundError):
        print("UV not found. Installing UV...")
        
        # Install UV using the official installer
        if platform.system() == "Windows":
            install_cmd = ["powershell", "-Command", 
                         "Invoke-WebRequest -Uri https://github.com/astral-sh/uv/releases/latest/download/uv-installer.ps1 -OutFile uv-installer.ps1; .\\uv-installer.ps1"]
        else:  # Unix-like systems
            install_cmd = ["curl", "-fsSL", "https://astral.sh/uv/install.sh", "|", "sh"]
            
        try:
            if platform.system() == "Windows":
                subprocess.run(install_cmd, shell=True, check=True)
            else:
                subprocess.run(" ".join(install_cmd), shell=True, check=True)
            print("UV installed successfully.")
            return True
        except subprocess.CalledProcessError as e:
            print(f"Failed to install UV: {e}")
            print("Please install UV manually: https://github.com/astral-sh/uv#installation")
            return False


def generate_requirements():
    """Generate requirements.txt files using UV."""
    # Check if pyproject.toml exists
    if not Path("pyproject.toml").exists():
        print("Error: pyproject.toml not found.")
        sys.exit(1)
    
    # Generate requirements.txt for production dependencies
    print("Generating requirements.txt for production dependencies...")
    run_command(["uv", "pip", "compile", "pyproject.toml", 
                "--output-file", "requirements.txt"])
    
    # Generate requirements-dev.txt for development dependencies
    print("Generating requirements-dev.txt for development dependencies...")
    run_command(["uv", "pip", "compile", "pyproject.toml", 
                "--output-file", "requirements-dev.txt", "--all-extras"])
    
    print("\nRequirements files generated successfully:")
    print("  - requirements.txt (production dependencies)")
    print("  - requirements-dev.txt (production + development dependencies)")


def main():
    """Main function."""
    if not check_uv_installed():
        sys.exit(1)
    
    generate_requirements()


if __name__ == "__main__":
    main() 