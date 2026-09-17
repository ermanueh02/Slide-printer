#!/usr/bin/env python3
"""
Backward-compatibility wrapper for Slide-printer v4.0.
Invoking this script directly executes the interactive wizard or CLI arguments.
For new projects, please import from the `slide_printer` package or use the `slide-printer` CLI.
"""

import sys
from slide_printer.cli import main

if __name__ == "__main__":
    sys.exit(main())