"""Pattern overlay generators for note sections."""

import io
from typing import Tuple
from pypdf import PdfReader
from pypdf._page import PageObject
from reportlab.lib.colors import Color
from reportlab.pdfgen import canvas

from slide_printer.constants import DEFAULT_STEP


def create_notes_overlay(
    page_size: Tuple[float, float],
    y_sep: float,
    margin: float,
    width: float,
    bottom_margin: float,
    style: str,
    step: float = DEFAULT_STEP,
    dot_radius: float = 0.65,
) -> PageObject:
    """Creates a PDF overlay page containing the notes pattern.

    Args:
        page_size: Target page (width, height) in points.
        y_sep: Y-coordinate of the separator line below the slide.
        margin: Left margin coordinate.
        width: Available width for the note section.
        bottom_margin: Minimum Y-coordinate for lines/dots.
        style: Pattern style ('blank', 'lines', 'grid', 'dots' or their aliases).
        step: Spacing between lines or dots in points (default: 14pt).
        dot_radius: Radius for dot grid pattern (default: 0.65pt).

    Returns:
        PageObject containing the rendered overlay.
    """
    packet = io.BytesIO()
    c = canvas.Canvas(packet, pagesize=page_size)

    x1 = margin
    x2 = margin + width
    y_start = y_sep - 10

    # Draw upper separator line with subtle end ticks
    c.setStrokeColor(Color(0.2, 0.2, 0.2, alpha=0.35))
    c.setLineWidth(0.8)
    c.line(x1, y_sep, x2, y_sep)
    c.setLineWidth(0.5)
    c.line(x1, y_sep - 3, x1, y_sep + 3)
    c.line(x2, y_sep - 3, x2, y_sep + 3)

    norm_style = style.lower()
    if norm_style in ("lines", "lineas", "line"):
        c.setStrokeColor(Color(0.4, 0.4, 0.4, alpha=0.22))
        c.setLineWidth(0.4)
        curr_y = y_start - step
        while curr_y >= bottom_margin:
            c.line(x1, curr_y, x2, curr_y)
            curr_y -= step

    elif norm_style in ("grid", "cuadricula"):
        c.setStrokeColor(Color(0.4, 0.4, 0.4, alpha=0.18))
        c.setLineWidth(0.35)

        curr_y = y_start
        while curr_y >= bottom_margin:
            c.line(x1, curr_y, x2, curr_y)
            curr_y -= step

        y_min = curr_y + step
        curr_x = x1
        while curr_x <= x2:
            c.line(curr_x, y_min, curr_x, y_start)
            curr_x += step

    elif norm_style in ("dots", "puntos", "dot"):
        c.setFillColor(Color(0.25, 0.25, 0.25, alpha=0.35))

        curr_y = y_start
        while curr_y >= bottom_margin:
            curr_x = x1
            while curr_x <= x2:
                c.circle(curr_x, curr_y, dot_radius, fill=1, stroke=0)
                curr_x += step
            curr_y -= step

    # 'blank' style only draws the separator line

    c.save()
    packet.seek(0)
    return PdfReader(packet).pages[0]
