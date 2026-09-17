"""Slide-printer: Transform presentation slide PDFs into printable handouts with custom note sections."""

__version__ = "4.2.0"

from slide_printer.constants import PAPER_SIZES, STYLE_METADATA
from slide_printer.core import SlidePrinter, resolve_style
from slide_printer.patterns import create_notes_overlay

__all__ = [
    "__version__",
    "SlidePrinter",
    "resolve_style",
    "create_notes_overlay",
    "PAPER_SIZES",
    "STYLE_METADATA",
]
