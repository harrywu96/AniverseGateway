#!/usr/bin/env python
"""
UV-based dependency installer for the SubTranslate project.

This script helps install dependencies using UV, the modern Python package installer.
It ensures proper virtual environment creation and dependency installation.

Usage:
    python uv_install.py [--dev] [--recreate-venv]
    
Options:
    --dev: Install development dependencies
    --recreate-venv: Recreate the virtual environment from scratch
"""

import argparse
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


def setup_virtual_environment(recreate=False):
    """Set up a virtual environment using UV."""
    venv_path = Path(".venv")
    
    if venv_path.exists() and recreate:
        print(f"Removing existing virtual environment at {venv_path}...")
        import shutil
        shutil.rmtree(venv_path)
    
    if not venv_path.exists():
        print("Creating virtual environment with UV...")
        run_command(["uv", "venv", ".venv"])
    else:
        print(f"Using existing virtual environment at {venv_path}")


def install_dependencies(dev=False):
    """Install dependencies using UV."""
    if dev:
        print("Installing development dependencies...")
        run_command(["uv", "pip", "install", "-e", ".[dev]"])
    else:
        print("Installing dependencies...")
        run_command(["uv", "pip", "install", "-e", "."])
    
    print("Dependencies installed successfully.")


def main():
    """Main function."""
    parser = argparse.ArgumentParser(description="Install dependencies using UV.")
    parser.add_argument("--dev", action="store_true", 
                        help="Install development dependencies")
    parser.add_argument("--recreate-venv", action="store_true", 
                        help="Recreate the virtual environment")
    
    args = parser.parse_args()
    
    if not check_uv_installed():
        sys.exit(1)
    
    setup_virtual_environment(recreate=args.recreate_venv)
    install_dependencies(dev=args.dev)
    
    # Create platform-specific activation scripts
    script_dir = Path("scripts")
    script_dir.mkdir(exist_ok=True)
    
    if platform.system() == "Windows":
        with open(script_dir / "activate.bat", "w") as f:
            f.write(f"@echo off\ncall {os.path.abspath('.venv/Scripts/activate.bat')}\n")
    else:
        with open(script_dir / "activate.sh", "w") as f:
            f.write(f"#!/bin/bash\nsource {os.path.abspath('.venv/bin/activate')}\n")
        os.chmod(script_dir / "activate.sh", 0o755)
    
    print("\nSetup complete! Activate the virtual environment with:")
    if platform.system() == "Windows":
        print("    .\\scripts\\activate.bat")
    else:
        print("    source ./scripts/activate.sh")


if __name__ == "__main__":
    main() 