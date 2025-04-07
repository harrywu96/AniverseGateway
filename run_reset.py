#!/usr/bin/env python
"""
Debug wrapper for reset_venv.py
"""

import traceback
import sys

print("Starting reset_venv wrapper...")

try:
    import reset_venv

    print("Successfully imported reset_venv")

    # Set up exception hook to get detailed error information
    def exception_hook(exctype, value, tb):
        print(f"An error occurred: {exctype.__name__}: {value}")
        traceback.print_tb(tb)

    sys.excepthook = exception_hook

    # Run the reset_venv function
    print("Calling reset_venv.reset_venv()")
    result = reset_venv.reset_venv()
    print(f"Function returned: {result}")

except Exception as e:
    print(f"Error importing or running reset_venv: {e}")
    traceback.print_exc()

print("Script completed")
input("Press Enter to exit...")
