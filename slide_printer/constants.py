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
DEFAULT_OUTPUT_DIR = "handouts"
DEFAULT_MARGIN = 40.0
DEFAULT_STEP = 14.0  # ~4.94 mm
DEFAULT_SEPARATION = 10.0
DEFAULT_PAGE_NUMBERS = True
DEFAULT_PAGE_NUMBER_FORMAT = "total"  # "total" (1 / N) or "simple" (1)
DEFAULT_GUTTER_MARGIN = 0.0
BINDER_GUTTER_POINTS = 30.0  # ~10.6 mm for ring binders (ISO 838 standard)
SPIRAL_GUTTER_POINTS = 22.0  # ~7.8 mm for spiral / wire-o coil binding

DEFAULT_BINDING = "none"  # "none", "binder", "spiral"
DEFAULT_HOLE_GUIDES = False

BINDING_GUTTER_MAP: Dict[str, float] = {
    "none": 0.0,
    "binder": BINDER_GUTTER_POINTS,
    "spiral": SPIRAL_GUTTER_POINTS,
}

BINDING_ALIASES: Dict[str, str] = {
    "none": "none",
    "sin": "none",
    "ninguna": "none",
    "off": "none",
    "binder": "binder",
    "ring": "binder",
    "rings": "binder",
    "archivador": "binder",
    "anillas": "binder",
    "anelas": "binder",
    "spiral": "spiral",
    "espiral": "spiral",
    "wire-o": "spiral",
    "wireo": "spiral",
    "coil": "spiral",
    "canutillo": "spiral",
}

COVER_TEMPLATES = [
    "atelier",
    "george",
    "monograph",
    "bauhaus",
    "fifties",
    "sixties",
    "seventies",
    "eighties",
    "nineties",
    "natural",
]

COVER_TEMPLATE_ALIASES: Dict[str, str] = {
    "atelier": "atelier",
    "george": "george",
    "monograph": "monograph",
    "bauhaus": "bauhaus",
    "fifties": "fifties",
    "50s": "fifties",
    "midcentury": "fifties",
    "pelican": "fifties",
    "sixties": "sixties",
    "60s": "sixties",
    "swiss": "sixties",
    "helvetica": "sixties",
    "seventies": "seventies",
    "70s": "seventies",
    "retro": "seventies",
    "apollo": "seventies",
    "eighties": "eighties",
    "80s": "eighties",
    "memphis": "eighties",
    "synthwave": "eighties",
    "nineties": "nineties",
    "90s": "nineties",
    "grunge": "nineties",
    "lookbook": "nineties",
    "zine": "nineties",
    "natural": "natural",
    "botanical": "natural",
    "forest": "natural",
    "organic": "natural",
    "organico": "natural",
    "organica": "natural",
    "bosque": "natural",
    "nature": "natural",
}

DEFAULT_DUPLEX = False
DEFAULT_STUDY_HEADER = False
DEFAULT_LAYOUT = "1-up"  # "1-up" or "2-up"
DEFAULT_GRAYSCALE = False
DEFAULT_COVER_MODE = "none"  # "none", "clean_first", "generate"
DEFAULT_COVER_TEMPLATE = "atelier"

