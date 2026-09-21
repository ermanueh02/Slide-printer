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
    "nineteen00s",
    "nineteen10s",
    "twenties",
    "thirties",
    "forties",
    "fifties",
    "sixties",
    "seventies",
    "eighties",
    "nineties",
    "twothousands",
    "twenty10s",
    "twentytwenties",
    "spring",
    "summer",
    "autumn",
    "winter",
    "polo",
    "equestrian",
    "natural",
    "college",
    "academic_green",
    "academic_teal",
    "academic_wave",
    "composition",
    "comp_blue",
    "comp_coral",
    "comp_amber",
]

COVER_TEMPLATE_ALIASES: Dict[str, str] = {
    # Composition Books & Traditional Notebooks
    "composition": "composition",
    "compbook": "composition",
    "composition_book": "composition",
    "comp_classic": "composition",
    "marble_bw": "composition",
    "cuaderno": "composition",
    "compo": "composition",
    "comp_blue": "comp_blue",
    "comp_ocean": "comp_blue",
    "comp_wave": "comp_blue",
    "academic_wave": "comp_blue",
    "suminagashi": "comp_blue",
    "ocean_wave": "comp_blue",
    "academic_navy": "comp_blue",
    "academic_burgundy": "comp_blue",
    "comp_coral": "comp_coral",
    "comp_terracotta": "comp_coral",
    "comp_slate": "comp_coral",
    "academic_teal": "comp_coral",
    "ebru": "comp_coral",
    "bubble": "comp_coral",
    "academic_ebru": "comp_coral",
    "academic_stone": "comp_coral",
    "academic_blue": "comp_coral",
    "comp_amber": "comp_amber",
    "comp_gold": "comp_amber",
    "comp_onyx": "comp_amber",
    "academic_green": "comp_amber",
    "academic": "comp_amber",
    "peacock": "comp_amber",
    "florentine": "comp_amber",
    "academic_peacock": "comp_amber",
    "academic_yellow": "comp_amber",
    "college": "college",
    "collegeruled": "college",
    "college_ruled": "college",
    "vintage_college": "college",
    "swirl": "college",
    "marble_grey": "college",
    # Classics
    "atelier": "atelier",
    "zara": "atelier",
    "zarahome": "atelier",
    "george": "george",
    "jfk": "george",
    "executive": "george",
    "monograph": "monograph",
    "bauhaus": "bauhaus",
    # Decades 20th Century
    "nineteen00s": "nineteen00s",
    "1900s": "nineteen00s",
    "1900": "nineteen00s",
    "00s": "nineteen00s",
    "artnouveau": "nineteen00s",
    "bellepoque": "nineteen00s",
    "turnofcentury": "nineteen00s",
    "nineteen10s": "nineteen10s",
    "1910s": "nineteen10s",
    "1910": "nineteen10s",
    "10s": "nineteen10s",
    "edwardian": "nineteen10s",
    "telegraph": "nineteen10s",
    "twenties": "twenties",
    "20s": "twenties",
    "1920s": "twenties",
    "1920": "twenties",
    "artdeco": "twenties",
    "gatsby": "twenties",
    "thirties": "thirties",
    "30s": "thirties",
    "1930s": "thirties",
    "1930": "thirties",
    "streamline": "thirties",
    "forties": "forties",
    "40s": "forties",
    "1940s": "forties",
    "1940": "forties",
    "typewriter": "forties",
    "postwar": "forties",
    "fifties": "fifties",
    "50s": "fifties",
    "1950s": "fifties",
    "1950": "fifties",
    "midcentury": "fifties",
    "pelican": "fifties",
    "sixties": "sixties",
    "60s": "sixties",
    "1960s": "sixties",
    "1960": "sixties",
    "swiss": "sixties",
    "helvetica": "sixties",
    "seventies": "seventies",
    "70s": "seventies",
    "1970s": "seventies",
    "1970": "seventies",
    "retro": "seventies",
    "apollo": "seventies",
    "eighties": "eighties",
    "80s": "eighties",
    "1980s": "eighties",
    "1980": "eighties",
    "memphis": "eighties",
    "synthwave": "eighties",
    "nineties": "nineties",
    "90s": "nineties",
    "1990s": "nineties",
    "1990": "nineties",
    "grunge": "nineties",
    "lookbook": "nineties",
    "zine": "nineties",
    # Decades 21st Century
    "twothousands": "twothousands",
    "2000s": "twothousands",
    "2000": "twothousands",
    "y2k": "twothousands",
    "noughties": "twothousands",
    "twenty10s": "twenty10s",
    "2010s": "twenty10s",
    "2010": "twenty10s",
    "flatdesign": "twenty10s",
    "startup": "twenty10s",
    "twentytwenties": "twentytwenties",
    "2020s": "twentytwenties",
    "2020": "twentytwenties",
    "neubrutalism": "twentytwenties",
    "contemporary": "twentytwenties",
    "ai_era": "twentytwenties",
    # Seasons
    "spring": "spring",
    "primavera": "spring",
    "vernal": "spring",
    "summer": "summer",
    "verano": "summer",
    "estio": "summer",
    "autumn": "autumn",
    "otono": "autumn",
    "otonno": "autumn",
    "fall": "autumn",
    "winter": "winter",
    "invierno": "winter",
    "hiemal": "winter",
    # Ralph Lauren
    "polo": "polo",
    "ralph": "polo",
    "ralphlauren": "polo",
    "ralph_lauren": "polo",
    "rl_polo": "polo",
    "preppy": "polo",
    "equestrian": "equestrian",
    "ecuestre": "equestrian",
    "rl_equestrian": "equestrian",
    "saddlery": "equestrian",
    # Nature
    "natural": "natural",
    "forest": "natural",
    "verde": "natural",
    "darkgreen": "natural",
    "bosque": "natural",
    "nature": "natural",
}

DEFAULT_DUPLEX = False
DEFAULT_STUDY_HEADER = False
DEFAULT_LAYOUT = "1-up"  # "1-up" or "2-up"
DEFAULT_GRAYSCALE = False
DEFAULT_COVER_MODE = "generate"  # "generate" (default), "clean_first", "none"
DEFAULT_COVER_TEMPLATE = "atelier"

