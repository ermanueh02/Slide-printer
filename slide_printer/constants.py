"""Constants and presets for slide-printer."""

from typing import Dict, Tuple

# Standard paper sizes in points (1 pt = 1/72 inch)
PAPER_SIZES: Dict[str, Tuple[float, float]] = {
    "a4": (595.28, 841.89),
    "letter": (612.0, 792.0),
    "legal": (612.0, 1008.0),
    "a3": (841.89, 1190.55),
}

# Note patterns metadata
STYLE_METADATA = {
    "blank": {
        "id": "blank",
        "name": "Blank",
        "code": "blank",
        "key": "1",
    },
    "lines": {
        "id": "lines",
        "name": "Lined",
        "code": "lines",
        "key": "2",
    },
    "grid": {
        "id": "grid",
        "name": "Grid",
        "code": "grid",
        "key": "3",
    },
    "dots": {
        "id": "dots",
        "name": "Dot Grid",
        "code": "dots",
        "key": "4",
    },
}

STYLE_KEY_MAP = {
    "1": "blank",
    "2": "lines",
    "3": "grid",
    "4": "dots",
    "blank": "blank",
    "lines": "lines",
    "line": "lines",
    "grid": "grid",
    "dots": "dots",
    "dot": "dots",
    # Legacy / alias compatibility
    "en_blanco": "blank",
    "lineas": "lines",
    "cuadricula": "grid",
    "puntos": "dots",
}

DEFAULT_PAPER_SIZE = "a4"
DEFAULT_OUTPUT_DIR = "."
DEFAULT_MARGIN = 40.0
DEFAULT_STEP = 14.0  # ~4.94 mm
DEFAULT_SEPARATION = 10.0
