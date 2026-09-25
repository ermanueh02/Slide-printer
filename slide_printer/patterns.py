"""Pattern overlay generators for note sections."""

import io
import math
import os
from typing import Tuple, Optional, List
from pypdf import PdfReader
from pypdf._page import PageObject
from reportlab.lib.colors import Color
from reportlab.pdfgen import canvas

from slide_printer.constants import DEFAULT_STEP, COVER_TEMPLATE_ALIASES


def _get_cover_texture_path(template_name: str) -> Optional[str]:
    """Resolves path to high-res cover background texture image."""
    pkg_dir = os.path.dirname(os.path.abspath(__file__))
    candidates = [
        os.path.join(pkg_dir, "assets", "covers", f"{template_name}.jpg"),
        os.path.join(pkg_dir, "web", "covers", f"{template_name}.jpg"),
        os.path.join(pkg_dir, "..", "web", "covers", f"{template_name}.jpg"),
        os.path.join(os.getcwd(), "web", "covers", f"{template_name}.jpg"),
    ]
    for p in candidates:
        if os.path.exists(p):
            return p
    return None


def wrap_text_lines(
    text: str,
    font_name: str,
    font_size: float,
    max_width: float,
    canvas_obj: canvas.Canvas,
) -> List[str]:
    """Wraps text into lines that fit within max_width for a given font."""
    words = (text or "").split()
    if not words:
        return []
    lines: List[str] = []
    curr_line = ""
    for w in words:
        test_line = f"{curr_line} {w}".strip()
        if canvas_obj.stringWidth(test_line, font_name, font_size) <= max_width:
            curr_line = test_line
        else:
            if curr_line:
                lines.append(curr_line)
            curr_line = w
    if curr_line:
        lines.append(curr_line)
    return lines


def draw_binding_guides(
    c: canvas.Canvas,
    page_size: Tuple[float, float],
    binding: str,
    is_verso: bool = False,
    gutter_margin: float = 0.0,
) -> None:
    """Renders subtle registration and punch hole guides for binding.

    - 'binder': ISO 838 standard 4-hole / 2-hole punch targets (12mm from binding edge, 80mm spacing).
    - 'spiral': Safe margin clearance line and spiral boundary tick marks.
    """
    pw, ph = page_size
    norm_binding = (binding or "").lower()

    if norm_binding in ("binder", "ring", "rings", "archivador", "anillas", "anelas"):
        # ISO 838 specification: 12 mm from edge, 80 mm between holes, centered vertically
        dist_from_edge = 34.0
        x = (pw - dist_from_edge) if is_verso else dist_from_edge
        y_center = ph / 2.0
        spacing = 226.77  # 80 mm in points
        # 4-hole positions: -120mm, -40mm, +40mm, +120mm
        y_positions = [
            y_center - 1.5 * spacing,
            y_center - 0.5 * spacing,
            y_center + 0.5 * spacing,
            y_center + 1.5 * spacing,
        ]

        c.saveState()
        for y in y_positions:
            if 30.0 <= y <= ph - 30.0:
                # Outer circle guide (diameter ~2.1 mm / 6 pt)
                c.setStrokeColor(Color(0.2, 0.2, 0.2, alpha=0.25))
                c.setLineWidth(0.4)
                c.circle(x, y, 3.0, stroke=1, fill=0)
                # Subtle crosshair
                c.setStrokeColor(Color(0.2, 0.2, 0.2, alpha=0.35))
                c.line(x - 4.5, y, x + 4.5, y)
                c.line(x, y - 4.5, x, y + 4.5)
        c.restoreState()

    elif norm_binding in ("spiral", "espiral", "wire-o", "wireo", "coil", "canutillo"):
        # Spiral binding guide: subtle dashed line at gutter margin boundary with edge ticks
        effective_gutter = gutter_margin if gutter_margin > 0 else 22.0
        gx = (pw - effective_gutter) if is_verso else effective_gutter

        c.saveState()
        c.setStrokeColor(Color(0.3, 0.3, 0.3, alpha=0.2))
        c.setLineWidth(0.4)
        c.setDash(2, 4)
        c.line(gx, 28.0, gx, ph - 28.0)
        c.setDash()
        # Top and bottom safe limit ticks
        tick_dir = -3.5 if is_verso else 3.5
        c.line(gx, 28.0, gx + tick_dir, 28.0)
        c.line(gx, ph - 28.0, gx + tick_dir, ph - 28.0)
        c.restoreState()


def create_notes_overlay(
    page_size: Tuple[float, float],
    y_sep: float,
    margin: float,
    width: float,
    bottom_margin: float,
    style: str,
    step: float = DEFAULT_STEP,
    dot_radius: float = 0.65,
    page_number: Optional[int] = None,
    total_pages: Optional[int] = None,
    page_number_format: str = "total",
    draw_separator: bool = True,
    study_header: bool = False,
    study_title: Optional[str] = None,
    header_y: Optional[float] = None,
    footer_margin: Optional[float] = None,
    grayscale: bool = False,
    binding: str = "none",
    hole_guides: bool = False,
    is_verso: bool = False,
    gutter_margin: float = 0.0,
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
        page_number: Folio index to print in footer.
        total_pages: Total number of folios in the document.
        page_number_format: 'total' (e.g. '1 / 24') or 'simple' ('1').
        draw_separator: Whether to render separator line below slide.
        study_header: Whether to render study header at the top.
        study_title: Custom subject/topic title for the study header.
        header_y: Y-coordinate for the study header baseline.
        footer_margin: Bottom margin for footer positioning.
        grayscale: Optimize stroke/fill tones for pure grayscale output.
        binding: Binding type ('none', 'binder', 'spiral').
        hole_guides: Whether to draw subtle hole punch or spiral guides.
        is_verso: True if current sheet is even in duplex mode.
        gutter_margin: Extra binding margin in points.

    Returns:
        PageObject containing the rendered overlay.
    """
    packet = io.BytesIO()
    c = canvas.Canvas(packet, pagesize=page_size)

    x1 = margin
    x2 = margin + width
    y_start = y_sep - 10

    # Draw study header if requested
    if study_header and header_y is not None:
        c.setFont("Helvetica-Bold", 8)
        c.setFillColor(Color(0.25, 0.25, 0.25, alpha=0.85))
        left_label = f"SUBJECT / TOPIC: {study_title}" if study_title else "SUBJECT / TOPIC: _____________________________"
        c.drawString(x1, header_y, left_label)

        c.setFont("Helvetica", 8)
        c.drawRightString(x2, header_y, "DATE: _____ / _____ / 20___")

        # Subtle divider below header
        c.setStrokeColor(Color(0.25, 0.25, 0.25, alpha=0.25))
        c.setLineWidth(0.5)
        c.line(x1, header_y - 4, x2, header_y - 4)

    # Draw upper separator line with subtle end ticks
    if draw_separator:
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

        num_cols = max(1, int(width // step))
        grid_w = num_cols * step
        grid_x1 = x1 + (width - grid_w) / 2.0
        grid_x2 = grid_x1 + grid_w

        curr_y = y_start
        while curr_y >= bottom_margin:
            c.line(grid_x1, curr_y, grid_x2, curr_y)
            curr_y -= step

        y_min = curr_y + step
        for col in range(num_cols + 1):
            cx = grid_x1 + col * step
            c.line(cx, y_min, cx, y_start)

    elif norm_style in ("dots", "puntos", "dot"):
        c.setFillColor(Color(0.25, 0.25, 0.25, alpha=0.35))

        num_cols = max(1, int(width // step))
        grid_w = num_cols * step
        grid_x1 = x1 + (width - grid_w) / 2.0

        curr_y = y_start
        while curr_y >= bottom_margin:
            for col in range(num_cols + 1):
                cx = grid_x1 + col * step
                c.circle(cx, curr_y, dot_radius, fill=1, stroke=0)
            curr_y -= step

    # Centered page number at footer
    if page_number is not None:
        c.setFont("Helvetica", 9)
        c.setFillColor(Color(0.3, 0.3, 0.3, alpha=0.7))
        effective_footer_margin = footer_margin if footer_margin is not None else margin
        footer_y = max(effective_footer_margin / 2.0 - 3, 12)

        if page_number_format == "total" and total_pages is not None and total_pages > 0:
            num_str = f"{page_number} / {total_pages}"
        else:
            num_str = str(page_number)

        c.drawCentredString(page_size[0] / 2.0, footer_y, num_str)

    # Optional binding punch / spiral guides
    if hole_guides and binding in ("binder", "ring", "rings", "archivador", "anillas", "anelas", "spiral", "espiral", "wire-o", "wireo", "coil", "canutillo"):
        draw_binding_guides(c, page_size, binding, is_verso=is_verso, gutter_margin=gutter_margin)

    c.save()
    packet.seek(0)
    return PdfReader(packet).pages[0]



def generate_cover_page(
    page_size: Tuple[float, float],
    title: str,
    subtitle: Optional[str] = None,
    author: Optional[str] = None,
    date_str: Optional[str] = None,
    num_slides: Optional[int] = None,
    grayscale: bool = False,
    template: str = "atelier",
    binding: str = "none",
    hole_guides: bool = False,
    is_verso: bool = False,
    gutter_margin: float = 0.0,
    margin: float = 40.0,
) -> PageObject:
    """Generates an editorial notebook cover page inspired by vintage and modernist designs.

    Supports binding margin offsets and hole guides.
    """
    packet = io.BytesIO()
    c = canvas.Canvas(packet, pagesize=page_size)
    pw, ph = page_size
    clean_title = (title or "Presentation").strip()
    raw_tpl = (template or "atelier").lower().strip()
    tpl = COVER_TEMPLATE_ALIASES.get(raw_tpl, raw_tpl)

    left_gutter = 0.0 if is_verso else gutter_margin
    right_gutter = gutter_margin if is_verso else 0.0
    effective_m = max(margin, 20.0)
    x1 = left_gutter + effective_m
    x2 = pw - right_gutter - effective_m
    w = x2 - x1
    avail_w = w
    center_x = x1 + w / 2.0

    if tpl == "george":
        # 1. George 90s Editorial / JFK Jr Executive Style
        m = 44.0
        x1 = left_gutter + m
        x2 = pw - right_gutter - m
        w = x2 - x1

        c.setStrokeColor(Color(0.12, 0.12, 0.14, alpha=1.0))
        c.setLineWidth(2.0)
        c.line(x1, ph - 58.0, x2, ph - 58.0)
        c.setLineWidth(0.5)
        c.line(x1, ph - 63.0, x2, ph - 63.0)

        c.setFont("Times-Bold", 8.5)
        c.setFillColor(Color(0.15, 0.15, 0.18, alpha=0.9))
        c.drawString(x1, ph - 50.0, "STUDY DOSSIER")
        c.setFont("Times-Italic", 8.0)
        c.setFillColor(Color(0.45, 0.45, 0.48, alpha=0.85))
        c.drawRightString(x2, ph - 50.0, "EXECUTIVE BRIEF · 90S ARCHIVE")

        c.setFont("Times-Bold", 28)
        c.setFillColor(Color(0.08, 0.08, 0.10, alpha=1.0))
        lines = wrap_text_lines(clean_title, "Times-Bold", 28, w - 20.0, c)
        title_y = ph * 0.64
        for line in lines:
            c.drawString(x1, title_y, line)
            title_y -= 36.0

        if subtitle:
            c.setFont("Times-Italic", 13.5)
            c.setFillColor(Color(0.35, 0.35, 0.38, alpha=0.95))
            c.drawString(x1, title_y - 6.0, subtitle)
            title_y -= 28.0

        c.setStrokeColor(Color(0.2, 0.2, 0.25, alpha=0.25))
        c.setLineWidth(0.6)
        c.line(x1, title_y - 14.0, x1 + 80.0, title_y - 14.0)

        meta_y = ph * 0.18
        c.setStrokeColor(Color(0.12, 0.12, 0.14, alpha=1.0))
        c.setLineWidth(0.8)
        c.line(x1, meta_y + 40.0, x2, meta_y + 40.0)

        c.setFont("Times-Bold", 7.5)
        c.setFillColor(Color(0.35, 0.35, 0.38, alpha=0.8))
        c.drawString(x1, meta_y + 26.0, "AUTHOR / STUDENT")
        c.setFont("Times-Roman", 10.0)
        c.setFillColor(Color(0.12, 0.12, 0.14, alpha=1.0))
        c.drawString(x1, meta_y + 12.0, author or "General Notes")

        col2_x = x1 + w * 0.52
        c.setFont("Times-Bold", 7.5)
        c.setFillColor(Color(0.35, 0.35, 0.38, alpha=0.8))
        c.drawString(col2_x, meta_y + 26.0, "DATE / COMPILATION")
        c.setFont("Times-Roman", 10.0)
        c.setFillColor(Color(0.12, 0.12, 0.14, alpha=1.0))
        c.drawString(col2_x, meta_y + 12.0, date_str or "Archival Copy")

        if num_slides is not None:
            c.setFont("Times-Italic", 8.0)
            c.setFillColor(Color(0.48, 0.48, 0.50, alpha=0.75))
            s_word = "slide" if num_slides == 1 else "slides"
            c.drawRightString(x2, meta_y - 8.0, f"{num_slides} {s_word} with study notes")

    elif tpl == "monograph":
        # 2. Archival Monograph (Heritage Stationery Bookplate)
        inset = 34.0
        x1 = left_gutter + inset
        x2 = pw - right_gutter - inset
        w = x2 - x1

        c.setStrokeColor(Color(0.3, 0.3, 0.3, alpha=0.18))
        c.setLineWidth(0.5)
        c.rect(x1, inset, w, ph - 2 * inset)

        box_w = min(w - 70.0, 420.0)
        box_h = 190.0
        box_x = center_x - box_w / 2.0
        box_y = ph * 0.42

        c.setStrokeColor(Color(0.2, 0.2, 0.22, alpha=0.35))
        c.setLineWidth(0.75)
        c.rect(box_x, box_y, box_w, box_h)
        c.setStrokeColor(Color(0.2, 0.2, 0.22, alpha=0.14))
        c.setLineWidth(0.35)
        c.rect(box_x + 4.5, box_y + 4.5, box_w - 9.0, box_h - 9.0)

        c.setFont("Times-Roman", 8)
        c.setFillColor(Color(0.45, 0.45, 0.45, alpha=0.85))
        c.drawCentredString(center_x, box_y + box_h - 26.0, "M O N O G R A P H   ·   N O T E S")

        c.setStrokeColor(Color(0.4, 0.4, 0.4, alpha=0.22))
        c.setLineWidth(0.35)
        c.line(center_x - 20.0, box_y + box_h - 33.0, center_x + 20.0, box_y + box_h - 33.0)

        c.setFont("Times-Bold", 20)
        c.setFillColor(Color(0.12, 0.12, 0.14, alpha=1.0))
        lines = wrap_text_lines(clean_title, "Times-Bold", 20, box_w - 36.0, c)
        title_y = box_y + box_h * 0.54 + (len(lines) - 1) * 13.0
        for line in lines:
            c.drawCentredString(center_x, title_y, line)
            title_y -= 26.0

        if subtitle:
            c.setFont("Times-Italic", 11.5)
            c.setFillColor(Color(0.35, 0.35, 0.38, alpha=0.9))
            c.drawCentredString(center_x, title_y - 8.0, subtitle)

        meta_y = ph * 0.22
        if author:
            c.setFont("Times-Roman", 10.5)
            c.setFillColor(Color(0.22, 0.22, 0.24, alpha=0.9))
            c.drawCentredString(center_x, meta_y, author)
            meta_y -= 18.0

        if date_str:
            c.setFont("Times-Italic", 9.0)
            c.setFillColor(Color(0.42, 0.42, 0.42, alpha=0.8))
            c.drawCentredString(center_x, meta_y, f"Date: {date_str}")
            meta_y -= 16.0

        if num_slides is not None:
            c.setFont("Times-Roman", 8.5)
            c.setFillColor(Color(0.48, 0.48, 0.48, alpha=0.75))
            s_word = "slide" if num_slides == 1 else "slides"
            c.drawCentredString(center_x, meta_y, f"{num_slides} {s_word} with dedicated notes")

    elif tpl == "bauhaus":
        # 3. Swiss Modernist Bauhaus Layout
        m = 48.0
        x1 = left_gutter + m
        x2 = pw - right_gutter - m
        vert_x = x1 + 28.0

        c.setStrokeColor(Color(0.15, 0.15, 0.18, alpha=0.18))
        c.setLineWidth(0.6)
        c.line(vert_x, m, vert_x, ph - m)

        hdr_y = ph - m - 20.0
        c.line(x1, hdr_y, x2, hdr_y)

        c.setFont("Helvetica-Bold", 8.0)
        c.setFillColor(Color(0.2, 0.2, 0.25, alpha=0.9))
        c.drawString(vert_x + 14.0, hdr_y + 8.0, "VOLUME I  ·  STUDY COMPENDIUM")

        c.setFont("Helvetica-Bold", 24)
        c.setFillColor(Color(0.08, 0.08, 0.10, alpha=1.0))
        lines = wrap_text_lines(clean_title, "Helvetica-Bold", 24, x2 - (vert_x + 14.0), c)
        title_y = ph * 0.58 + (len(lines) - 1) * 15.0
        for line in lines:
            c.drawString(vert_x + 14.0, title_y, line)
            title_y -= 30.0

        if subtitle:
            c.setFont("Helvetica-Oblique", 12.5)
            c.setFillColor(Color(0.35, 0.35, 0.38, alpha=0.9))
            c.drawString(vert_x + 14.0, title_y - 6.0, subtitle)

        meta_y = ph * 0.25
        c.setFont("Helvetica-Bold", 7.0)
        c.setFillColor(Color(0.45, 0.45, 0.48, alpha=0.85))
        c.drawString(vert_x + 14.0, meta_y + 36.0, "STUDENT:")
        c.setFont("Helvetica", 10.0)
        c.setFillColor(Color(0.12, 0.12, 0.14, alpha=1.0))
        c.drawString(vert_x + 72.0, meta_y + 36.0, author or "Study Notes")

        c.setFont("Helvetica-Bold", 7.0)
        c.setFillColor(Color(0.45, 0.45, 0.48, alpha=0.85))
        c.drawString(vert_x + 14.0, meta_y + 18.0, "DATE:")
        c.setFont("Helvetica", 10.0)
        c.setFillColor(Color(0.12, 0.12, 0.14, alpha=1.0))
        c.drawString(vert_x + 72.0, meta_y + 18.0, date_str or "Archival")

        if num_slides is not None:
            s_word = "slide" if num_slides == 1 else "slides"
            c.setFont("Helvetica-Oblique", 8.0)
            c.setFillColor(Color(0.5, 0.5, 0.52, alpha=0.75))
            c.drawString(vert_x + 14.0, meta_y - 4.0, f"{num_slides} {s_word} included")

    elif tpl in ("nineteen00s", "1900s", "1900", "00s"):
        # 4a. 1900s Art Nouveau & Belle Époque Classic
        m = 42.0
        x1 = left_gutter + m
        x2 = pw - right_gutter - m
        w = x2 - x1

        bordeaux = Color(0.42, 0.12, 0.15, alpha=1.0)
        gold = Color(0.72, 0.58, 0.32, alpha=1.0)
        c.setStrokeColor(bordeaux)
        c.setLineWidth(1.4)
        c.rect(x1, m, w, ph - 2 * m, stroke=1, fill=0)
        c.setStrokeColor(gold)
        c.setLineWidth(0.5)
        c.rect(x1 + 4.5, m + 4.5, w - 9.0, ph - 2 * (m + 4.5), stroke=1, fill=0)

        c.setFont("Times-Bold", 8.5)
        c.setFillColor(bordeaux)
        c.drawCentredString(center_x, ph - m - 28.0, "B E L L E   É P O Q U E   ·   1 9 0 0 s")
        c.setFont("Times-Italic", 7.5)
        c.setFillColor(gold)
        c.drawCentredString(center_x, ph - m - 42.0, "ART NOUVEAU ARCHIVE · TURN OF THE CENTURY")

        loz_y = ph * 0.65
        c.setStrokeColor(bordeaux)
        c.setLineWidth(0.8)
        c.circle(center_x, loz_y, 14.0, stroke=1, fill=0)
        c.setStrokeColor(gold)
        c.setLineWidth(0.5)
        c.circle(center_x, loz_y, 9.0, stroke=1, fill=0)

        c.setFont("Times-Bold", 25)
        c.setFillColor(Color(0.14, 0.10, 0.12, alpha=1.0))
        lines = wrap_text_lines(clean_title, "Times-Bold", 25, w - 60.0, c)
        cur_y = loz_y - 40.0
        for line in lines:
            c.drawCentredString(center_x, cur_y, line)
            cur_y -= 33.0

        if subtitle:
            c.setFont("Times-Italic", 12.0)
            c.setFillColor(bordeaux)
            c.drawCentredString(center_x, cur_y - 8.0, subtitle)
            cur_y -= 24.0

        c.setStrokeColor(gold)
        c.setLineWidth(0.6)
        c.line(center_x - 45.0, cur_y - 10.0, center_x + 45.0, cur_y - 10.0)

        meta_y = m + 36.0
        c.setFont("Times-Bold", 7.5)
        c.setFillColor(gold)
        c.drawCentredString(center_x, meta_y + 26.0, "STUDENT / AUTHOR")
        c.setFont("Times-Bold", 10.5)
        c.setFillColor(bordeaux)
        c.drawCentredString(center_x, meta_y + 12.0, author or "Belle Époque Edition")
        c.setFont("Times-Italic", 8.5)
        c.setFillColor(gold)
        c.drawCentredString(center_x, meta_y - 2.0, date_str or "Turn of the Century")
        if num_slides is not None:
            s_word = "slide" if num_slides == 1 else "slides"
            c.setFont("Times-Roman", 8.0)
            c.setFillColor(Color(0.4, 0.4, 0.4, alpha=0.8))
            c.drawCentredString(center_x, meta_y - 16.0, f"{num_slides} {s_word} compiled")

    elif tpl in ("nineteen10s", "1910s", "1910", "10s"):
        # 4b. 1910s Edwardian & Aviation Monograph
        m = 42.0
        x1 = left_gutter + m
        x2 = pw - right_gutter - m
        w = x2 - x1

        navy = Color(0.10, 0.16, 0.28, alpha=1.0)
        gold_muted = Color(0.70, 0.58, 0.36, alpha=1.0)
        c.setStrokeColor(navy)
        c.setLineWidth(1.8)
        c.rect(x1, m, w, ph - 2 * m, stroke=1, fill=0)
        c.setStrokeColor(gold_muted)
        c.setLineWidth(0.5)
        c.rect(x1 + 4.0, m + 4.0, w - 8.0, ph - 2 * (m + 4.0), stroke=1, fill=0)

        c.setStrokeColor(navy)
        c.setLineWidth(0.6)
        c.rect(x2 - 110.0, ph - m - 45.0, 96.0, 26.0, stroke=1, fill=0)
        c.setFont("Helvetica-Bold", 6.5)
        c.setFillColor(navy)
        c.drawCentredString(x2 - 62.0, ph - m - 32.0, "REGISTRY NO. 1914-SP")
        c.setFont("Helvetica", 5.5)
        c.drawCentredString(x2 - 62.0, ph - m - 40.0, "TELEGRAPH DOSSIER")

        c.setFont("Times-Bold", 8.5)
        c.setFillColor(navy)
        c.drawString(x1 + 16.0, ph - m - 28.0, "E D W A R D I A N   D O S S I E R   ·   1 9 1 0 s")
        c.setFont("Times-Italic", 7.5)
        c.setFillColor(gold_muted)
        c.drawString(x1 + 16.0, ph - m - 40.0, "EARLY MODERNIST MONOGRAPH · AVIATION ERA")

        c.setFont("Times-Bold", 26)
        c.setFillColor(navy)
        lines = wrap_text_lines(clean_title, "Times-Bold", 26, w - 50.0, c)
        cur_y = ph * 0.58 + (len(lines) - 1) * 16.0
        for line in lines:
            c.drawString(x1 + 16.0, cur_y, line)
            cur_y -= 34.0

        if subtitle:
            c.setFont("Times-Italic", 12.5)
            c.setFillColor(gold_muted)
            c.drawString(x1 + 16.0, cur_y - 6.0, subtitle)
            cur_y -= 24.0

        c.setStrokeColor(navy)
        c.setLineWidth(1.0)
        c.line(x1 + 16.0, cur_y - 10.0, x1 + 90.0, cur_y - 10.0)

        meta_y = m + 36.0
        c.setFont("Helvetica-Bold", 7.0)
        c.setFillColor(gold_muted)
        c.drawString(x1 + 16.0, meta_y + 26.0, "AUTHOR / CORRESPONDENT")
        c.setFont("Times-Bold", 10.5)
        c.setFillColor(navy)
        c.drawString(x1 + 16.0, meta_y + 12.0, author or "Edwardian Edition")
        c.setFont("Times-Italic", 8.5)
        c.setFillColor(gold_muted)
        c.drawString(x1 + 16.0, meta_y - 2.0, date_str or "Archival Record 1910")
        if num_slides is not None:
            s_word = "slide" if num_slides == 1 else "slides"
            c.setFont("Times-Roman", 8.0)
            c.setFillColor(navy)
            c.drawRightString(x2 - 16.0, meta_y + 12.0, f"{num_slides} {s_word} registered")

    elif tpl in ("twenties", "20s", "1920s", "1920", "artdeco", "gatsby"):
        # 4c. 1920s Art Deco & Roaring Twenties
        m = 40.0
        x1 = left_gutter + m
        x2 = pw - right_gutter - m
        w = x2 - x1

        deco_black = Color(0.10, 0.10, 0.12, alpha=1.0)
        deco_gold = Color(0.82, 0.65, 0.28, alpha=1.0)

        c.setStrokeColor(deco_black)
        c.setLineWidth(2.0)
        c.rect(x1, m, w, ph - 2 * m, stroke=1, fill=0)

        c.setStrokeColor(deco_gold)
        c.setLineWidth(0.8)
        c.rect(x1 + 4.5, m + 4.5, w - 9.0, ph - 2 * (m + 4.5), stroke=1, fill=0)
        c.setLineWidth(0.4)
        c.rect(x1 + 8.0, m + 8.0, w - 16.0, ph - 2 * (m + 8.0), stroke=1, fill=0)

        c.setFont("Helvetica-Bold", 8.0)
        c.setFillColor(deco_gold)
        c.drawCentredString(center_x, ph - m - 28.0, "★   A R T   D E C O   C O M P E N D I U M   ·   1 9 2 0 s   ★")
        c.setFont("Times-Italic", 7.5)
        c.setFillColor(deco_black)
        c.drawCentredString(center_x, ph - m - 42.0, "ROARING TWENTIES EDITORIAL · GATSBY ARCHIVE")

        loz_y = ph * 0.65
        c.setStrokeColor(deco_black)
        c.setLineWidth(1.2)
        p = c.beginPath()
        p.moveTo(center_x, loz_y + 15.0)
        p.lineTo(center_x + 15.0, loz_y)
        p.lineTo(center_x, loz_y - 15.0)
        p.lineTo(center_x - 15.0, loz_y)
        p.close()
        c.drawPath(p, stroke=1, fill=0)

        c.setFillColor(deco_gold)
        c.circle(center_x, loz_y, 4.0, fill=1, stroke=0)

        c.setFont("Times-Bold", 26)
        c.setFillColor(deco_black)
        lines = wrap_text_lines(clean_title, "Times-Bold", 26, w - 60.0, c)
        cur_y = loz_y - 42.0
        for line in lines:
            c.drawCentredString(center_x, cur_y, line)
            cur_y -= 34.0

        if subtitle:
            c.setFont("Times-Italic", 12.5)
            c.setFillColor(deco_gold)
            c.drawCentredString(center_x, cur_y - 6.0, subtitle)
            cur_y -= 24.0

        c.setStrokeColor(deco_gold)
        c.setLineWidth(1.0)
        c.line(center_x - 45.0, cur_y - 10.0, center_x + 45.0, cur_y - 10.0)

        meta_y = m + 36.0
        c.setFont("Helvetica-Bold", 7.5)
        c.setFillColor(deco_gold)
        c.drawCentredString(center_x, meta_y + 26.0, "CURATOR / STUDENT")
        c.setFont("Times-Bold", 10.5)
        c.setFillColor(deco_black)
        c.drawCentredString(center_x, meta_y + 12.0, author or "Gatsby Edition")
        c.setFont("Times-Italic", 8.5)
        c.setFillColor(deco_gold)
        c.drawCentredString(center_x, meta_y - 2.0, date_str or "1920s Archive")
        if num_slides is not None:
            s_word = "slide" if num_slides == 1 else "slides"
            c.setFont("Times-Roman", 8.0)
            c.setFillColor(deco_black)
            c.drawCentredString(center_x, meta_y - 16.0, f"{num_slides} {s_word} bound")

    elif tpl in ("thirties", "30s", "1930s", "1930", "streamline"):
        # 4d. 1930s Streamline Moderne & Constructivism
        m = 42.0
        x1 = left_gutter + m
        x2 = pw - right_gutter - m
        w = x2 - x1

        copper = Color(0.60, 0.28, 0.16, alpha=1.0)
        slate = Color(0.22, 0.26, 0.32, alpha=1.0)

        c.setStrokeColor(slate)
        c.setLineWidth(1.6)
        c.rect(x1, m, w, ph - 2 * m, stroke=1, fill=0)

        c.setStrokeColor(copper)
        c.setLineWidth(1.2)
        c.line(x1, ph - m - 45.0, x2, ph - m - 45.0)
        c.setLineWidth(0.5)
        c.line(x1, ph - m - 49.0, x2, ph - m - 49.0)

        c.setFont("Helvetica-Bold", 8.5)
        c.setFillColor(slate)
        c.drawString(x1 + 14.0, ph - m - 32.0, "STREAMLINE MODERNE  ·  DOSSIER 1935")
        c.setFont("Times-Italic", 7.5)
        c.setFillColor(copper)
        c.drawRightString(x2 - 14.0, ph - m - 32.0, "INDUSTRIAL DESIGN ARCHIVE")

        c.setFont("Helvetica-Bold", 26)
        c.setFillColor(slate)
        lines = wrap_text_lines(clean_title, "Helvetica-Bold", 26, w - 50.0, c)
        cur_y = ph * 0.58 + (len(lines) - 1) * 16.0
        for line in lines:
            c.drawString(x1 + 14.0, cur_y, line)
            cur_y -= 34.0

        if subtitle:
            c.setFont("Helvetica-Oblique", 12.5)
            c.setFillColor(copper)
            c.drawString(x1 + 14.0, cur_y - 6.0, subtitle)
            cur_y -= 24.0

        c.setStrokeColor(copper)
        c.setLineWidth(1.5)
        c.line(x1 + 14.0, cur_y - 12.0, x1 + 100.0, cur_y - 12.0)

        meta_y = m + 36.0
        c.setFont("Helvetica-Bold", 7.0)
        c.setFillColor(copper)
        c.drawString(x1 + 14.0, meta_y + 26.0, "DESIGNER / AUTHOR")
        c.setFont("Helvetica-Bold", 10.5)
        c.setFillColor(slate)
        c.drawString(x1 + 14.0, meta_y + 12.0, author or "Streamline Monograph")
        c.setFont("Helvetica-Oblique", 8.5)
        c.setFillColor(copper)
        c.drawString(x1 + 14.0, meta_y - 2.0, date_str or "1930s Edition")
        if num_slides is not None:
            s_word = "slide" if num_slides == 1 else "slides"
            c.setFont("Helvetica", 8.0)
            c.setFillColor(slate)
            c.drawRightString(x2 - 14.0, meta_y + 12.0, f"{num_slides} {s_word} compiled")

    elif tpl in ("forties", "40s", "1940s", "1940", "typewriter", "postwar"):
        # 4e. 1940s Typewriter Dossier & Post-War Press Release
        m = 40.0
        x1 = left_gutter + m
        x2 = pw - right_gutter - m
        w = x2 - x1

        ink_black = Color(0.12, 0.12, 0.14, alpha=1.0)
        stamp_red = Color(0.70, 0.15, 0.15, alpha=1.0)

        c.setStrokeColor(ink_black)
        c.setLineWidth(1.2)
        c.rect(x1, m, w, ph - 2 * m, stroke=1, fill=0)

        c.setStrokeColor(stamp_red)
        c.setLineWidth(0.8)
        c.rect(x2 - 130.0, ph - m - 45.0, 116.0, 24.0, stroke=1, fill=0)
        c.setFont("Courier-Bold", 7.0)
        c.setFillColor(stamp_red)
        c.drawCentredString(x2 - 72.0, ph - m - 32.0, "CONFIDENTIAL STUDY FILE")
        c.setFont("Courier", 5.5)
        c.drawCentredString(x2 - 72.0, ph - m - 40.0, "PRESS & RESEARCH DOSSIER")

        c.setFont("Courier-Bold", 8.0)
        c.setFillColor(ink_black)
        c.drawString(x1 + 16.0, ph - m - 28.0, "[ DOSSIER 1944 ] :: OFFICIAL BRIEF")

        c.setFont("Courier-Bold", 24)
        c.setFillColor(ink_black)
        lines = wrap_text_lines(clean_title, "Courier-Bold", 24, w - 50.0, c)
        cur_y = ph * 0.58 + (len(lines) - 1) * 16.0
        for line in lines:
            c.drawString(x1 + 16.0, cur_y, line)
            cur_y -= 32.0

        if subtitle:
            c.setFont("Courier-Oblique", 12.0)
            c.setFillColor(Color(0.35, 0.35, 0.38, alpha=0.9))
            c.drawString(x1 + 16.0, cur_y - 6.0, subtitle)
            cur_y -= 24.0

        c.setStrokeColor(ink_black)
        c.setLineWidth(1.0)
        c.line(x1 + 16.0, cur_y - 10.0, x1 + 110.0, cur_y - 10.0)

        meta_y = m + 28.0
        c.setFont("Courier-Bold", 8.0)
        c.setFillColor(ink_black)
        c.drawString(x1 + 16.0, meta_y + 44.0, f"[ OPERATOR ] : {author or 'Anonymous.44'}")
        c.drawString(x1 + 16.0, meta_y + 28.0, f"[ TIMESTAMP] : {date_str or '1944.06.06'}")
        c.drawString(x1 + 16.0, meta_y + 12.0, f"[ DATASETS ] : {num_slides or 0} Slides Compiled // Monograph")

    elif tpl in ("fifties", "50s"):
        # 4. 1950s Mid-Century Pelican / Penguin Tri-Band Paperbound Classic
        top_band_h = ph * 0.20
        c.setFillColor(Color(0.16, 0.18, 0.20, alpha=1.0))
        c.rect(left_gutter, ph - top_band_h, pw - left_gutter - right_gutter, top_band_h, fill=1, stroke=0)

        c.setFont("Helvetica-Bold", 8.5)
        c.setFillColor(Color(0.96, 0.96, 0.96, alpha=0.95))
        c.drawCentredString(center_x, ph - 42.0, "M I D - C E N T U R Y   D O S S I E R")
        c.setFont("Times-Italic", 8.0)
        c.setFillColor(Color(0.82, 0.84, 0.86, alpha=0.85))
        c.drawCentredString(center_x, ph - 58.0, "PELICAN & PENGUIN STUDY MONOGRAPH · SERIES NO. 54")

        c.setStrokeColor(Color(0.96, 0.96, 0.96, alpha=0.3))
        c.setLineWidth(0.5)
        c.line(center_x - 45.0, ph - 70.0, center_x + 45.0, ph - 70.0)

        lozenge_y = ph * 0.65
        c.setStrokeColor(Color(0.18, 0.20, 0.22, alpha=0.4))
        c.setLineWidth(0.8)
        p = c.beginPath()
        p.moveTo(center_x, lozenge_y + 13.0)
        p.lineTo(center_x + 13.0, lozenge_y)
        p.lineTo(center_x, lozenge_y - 13.0)
        p.lineTo(center_x - 13.0, lozenge_y)
        p.close()
        c.drawPath(p, stroke=1, fill=0)

        c.setFont("Helvetica-Bold", 24)
        c.setFillColor(Color(0.10, 0.12, 0.14, alpha=1.0))
        lines = wrap_text_lines(clean_title, "Helvetica-Bold", 24, w - 40.0, c)
        cur_y = lozenge_y - 36.0
        for line in lines:
            c.drawCentredString(center_x, cur_y, line)
            cur_y -= 32.0

        if subtitle:
            c.setFont("Times-Italic", 12.0)
            c.setFillColor(Color(0.35, 0.38, 0.40, alpha=0.95))
            c.drawCentredString(center_x, cur_y - 8.0, subtitle)
            cur_y -= 26.0

        bot_band_y = ph * 0.22
        c.setStrokeColor(Color(0.16, 0.18, 0.20, alpha=1.0))
        c.setLineWidth(1.8)
        c.line(left_gutter + 40.0, bot_band_y + 10.0, pw - right_gutter - 40.0, bot_band_y + 10.0)
        c.setLineWidth(0.5)
        c.line(left_gutter + 40.0, bot_band_y + 6.0, pw - right_gutter - 40.0, bot_band_y + 6.0)

        c.setFont("Helvetica-Bold", 7.5)
        c.setFillColor(Color(0.40, 0.42, 0.45, alpha=0.85))
        c.drawCentredString(center_x, bot_band_y - 10.0, "STUDENT / RESEARCH COMPILATION")

        c.setFont("Times-Roman", 10.5)
        c.setFillColor(Color(0.12, 0.14, 0.16, alpha=1.0))
        c.drawCentredString(center_x, bot_band_y - 26.0, author or "General Lecture Edition")

        c.setFont("Times-Italic", 9.0)
        c.setFillColor(Color(0.45, 0.45, 0.48, alpha=0.85))
        c.drawCentredString(center_x, bot_band_y - 42.0, f"Published: {date_str}" if date_str else "Archival Edition")

        if num_slides is not None:
            c.setFont("Helvetica", 7.5)
            c.setFillColor(Color(0.52, 0.54, 0.56, alpha=0.8))
            s_word = "slide" if num_slides == 1 else "slides"
            c.drawCentredString(center_x, bot_band_y - 58.0, f"{num_slides} {s_word} with ruled marginal notes")

    elif tpl == "sixties":
        # 5. 1960s Swiss International Typographic Style (Müller-Brockmann / Basel)
        m = 46.0
        x1 = left_gutter + m
        x2 = pw - right_gutter - m
        w = x2 - x1

        c.setFillColor(Color(0.08, 0.08, 0.10, alpha=1.0))
        c.rect(x1, ph - 54.0, w, 5.0, fill=1, stroke=0)

        c.setFont("Helvetica-Bold", 44)
        c.setFillColor(Color(0.08, 0.08, 0.10, alpha=0.12))
        c.drawRightString(x2, ph - 110.0, "60")

        c.setFont("Helvetica-Bold", 8.0)
        c.setFillColor(Color(0.15, 0.15, 0.18, alpha=0.9))
        c.drawString(x1, ph - 74.0, "INTERNATIONALE TYPOGRAPHIE  ·  SCHWEIZ 1960")

        c.setFont("Helvetica-Bold", 27)
        c.setFillColor(Color(0.08, 0.08, 0.10, alpha=1.0))
        lines = wrap_text_lines(clean_title, "Helvetica-Bold", 27, w - 50.0, c)
        cur_y = ph * 0.62 + (len(lines) - 1) * 16.0
        for line in lines:
            c.drawString(x1, cur_y, line)
            cur_y -= 35.0

        if subtitle:
            c.setFont("Helvetica-Oblique", 12.0)
            c.setFillColor(Color(0.35, 0.35, 0.38, alpha=0.9))
            c.drawString(x1, cur_y - 6.0, subtitle)
            cur_y -= 26.0

        c.setStrokeColor(Color(0.08, 0.08, 0.10, alpha=1.0))
        c.setLineWidth(1.2)
        c.line(x1, cur_y - 12.0, x1 + 45.0, cur_y - 12.0)

        grid_y = ph * 0.24
        col_w = w / 2.0
        c.setStrokeColor(Color(0.15, 0.15, 0.18, alpha=0.25))
        c.setLineWidth(0.5)
        c.line(x1, grid_y + 36.0, x2, grid_y + 36.0)
        c.line(x1 + col_w, grid_y + 36.0, x1 + col_w, grid_y - 20.0)

        c.setFont("Helvetica-Bold", 7.0)
        c.setFillColor(Color(0.40, 0.40, 0.42, alpha=0.85))
        c.drawString(x1, grid_y + 24.0, "FORSCHER / AUTHOR")
        c.setFont("Helvetica", 9.5)
        c.setFillColor(Color(0.10, 0.10, 0.12, alpha=1.0))
        c.drawString(x1, grid_y + 10.0, author or "Allgemeine Vorlesung")

        c.setFont("Helvetica-Bold", 7.0)
        c.setFillColor(Color(0.40, 0.40, 0.42, alpha=0.85))
        c.drawString(x1 + col_w + 14.0, grid_y + 24.0, "DATUM / REGISTRY")
        c.setFont("Helvetica", 9.5)
        c.setFillColor(Color(0.10, 0.10, 0.12, alpha=1.0))
        c.drawString(x1 + col_w + 14.0, grid_y + 10.0, date_str or "Archiv Zürich")

        if num_slides is not None:
            c.setFont("Helvetica-Bold", 7.0)
            c.drawString(x1, grid_y - 8.0, "FOLIO")
            c.setFont("Helvetica", 9.5)
            s_word = "slide" if num_slides == 1 else "slides"
            c.drawString(x1, grid_y - 20.0, f"{num_slides} {s_word}")

    elif tpl == "seventies":
        # 6. 1970s Retro Warm Editorial & Apollo NASA Checklist
        m = 38.0
        x1 = left_gutter + m
        x2 = pw - right_gutter - m
        w = x2 - x1

        c.setStrokeColor(Color(0.22, 0.20, 0.18, alpha=0.85))
        c.setLineWidth(1.6)
        c.roundRect(x1, m, w, ph - 2 * m, 12.0, stroke=1, fill=0)
        c.setLineWidth(0.6)
        c.roundRect(x1 + 4.0, m + 4.0, w - 8.0, ph - 2 * m - 8.0, 9.0, stroke=1, fill=0)
        c.setLineWidth(0.4)
        c.roundRect(x1 + 7.5, m + 7.5, w - 15.0, ph - 2 * m - 15.0, 7.0, stroke=1, fill=0)

        c.setFont("Helvetica-Bold", 8.0)
        c.setFillColor(Color(0.35, 0.32, 0.30, alpha=0.9))
        c.drawCentredString(center_x, ph - m - 28.0, "★  A R C H I V A L   D O S S I E R   ·   1 9 7 X  ★")

        badge_x = x2 - 46.0
        badge_y = ph - m - 52.0
        c.setStrokeColor(Color(0.35, 0.32, 0.30, alpha=0.4))
        c.circle(badge_x, badge_y, 18.0, stroke=1, fill=0)
        c.setFont("Helvetica-Bold", 6.5)
        c.setFillColor(Color(0.35, 0.32, 0.30, alpha=0.85))
        c.drawCentredString(badge_x, badge_y + 2.0, "VOL. 74")
        c.setFont("Helvetica", 5.5)
        c.drawCentredString(badge_x, badge_y - 6.0, "OFFICIAL")

        c.setFont("Helvetica-Bold", 25)
        c.setFillColor(Color(0.14, 0.12, 0.10, alpha=1.0))
        lines = wrap_text_lines(clean_title, "Helvetica-Bold", 25, w - 70.0, c)
        cur_y = ph * 0.58 + (len(lines) - 1) * 15.0
        for line in lines:
            c.drawCentredString(center_x, cur_y, line)
            cur_y -= 33.0

        if subtitle:
            c.setFont("Times-Italic", 12.0)
            c.setFillColor(Color(0.40, 0.36, 0.32, alpha=0.95))
            c.drawCentredString(center_x, cur_y - 8.0, subtitle)
            cur_y -= 24.0

        c.setStrokeColor(Color(0.40, 0.36, 0.32, alpha=0.25))
        c.setLineWidth(0.6)
        c.setDash(4, 3)
        c.line(center_x - 50.0, cur_y - 12.0, center_x + 50.0, cur_y - 12.0)
        c.setDash()

        box_y = m + 36.0
        box_w = w - 50.0
        box_h = 76.0
        bx = center_x - box_w / 2.0
        c.setStrokeColor(Color(0.35, 0.32, 0.30, alpha=0.25))
        c.setLineWidth(0.5)
        c.roundRect(bx, box_y, box_w, box_h, 4.0, stroke=1, fill=0)

        c.setFont("Helvetica-Bold", 7.0)
        c.drawString(bx + 14.0, box_y + box_h - 18.0, "PREPARED BY:")
        c.setFont("Times-Roman", 9.5)
        c.drawString(bx + 92.0, box_y + box_h - 18.0, author or "General Lecture Notes")

        c.setFont("Helvetica-Bold", 7.0)
        c.drawString(bx + 14.0, box_y + box_h - 38.0, "SESSION DATE:")
        c.setFont("Times-Roman", 9.5)
        c.drawString(bx + 92.0, box_y + box_h - 38.0, date_str or "Archival Record")

        c.setFont("Helvetica-Bold", 7.0)
        c.drawString(bx + 14.0, box_y + box_h - 58.0, "CATALOGUE NO:")
        c.setFont("Helvetica", 8.5)
        s_cnt = num_slides if num_slides is not None else 12
        c.drawString(bx + 92.0, box_y + box_h - 58.0, f"NASA-74-SP-{s_cnt:02d}")

    elif tpl == "eighties":
        # 7. 1980s Memphis Design & Early Macintosh Tech Manual
        m = 42.0
        x1 = left_gutter + m
        x2 = pw - right_gutter - m
        w = x2 - x1

        c.setStrokeColor(Color(0.10, 0.10, 0.12, alpha=1.0))
        c.setLineWidth(1.4)
        c.rect(x1, m, w, ph - 2 * m, stroke=1, fill=0)
        c.setLineWidth(0.4)
        c.rect(x1 + 3.5, m + 3.5, w - 7.0, ph - 2 * m - 7.0, stroke=1, fill=0)

        hatch_w = 44.0
        hatch_h = 24.0
        hx = x2 - hatch_w - 12.0
        hy = ph - m - hatch_h - 12.0
        c.setStrokeColor(Color(0.10, 0.10, 0.12, alpha=0.35))
        c.setLineWidth(0.5)
        c.rect(hx, hy, hatch_w, hatch_h, stroke=1, fill=0)
        for d in range(-20, int(hatch_w + hatch_h), 5):
            c.line(hx + max(0, d), hy + max(0, -d), hx + min(hatch_w, d + hatch_h), hy + min(hatch_h, hatch_h))

        c.setFillColor(Color(0.10, 0.10, 0.12, alpha=0.85))
        c.circle(hx - 12.0, hy + 12.0, 3.0, fill=1, stroke=0)

        c.setFont("Helvetica-Bold", 7.5)
        c.drawString(x1 + 16.0, ph - m - 24.0, "SYS.MANUAL // VOL.84 · PERSONAL STUDY COMPENDIUM")

        c.setFont("Helvetica-Bold", 26)
        c.setFillColor(Color(0.08, 0.08, 0.10, alpha=1.0))
        lines = wrap_text_lines(clean_title, "Helvetica-Bold", 26, w - 50.0, c)
        cur_y = ph * 0.60 + (len(lines) - 1) * 16.0
        for line in lines:
            c.drawString(x1 + 16.0, cur_y, line)
            cur_y -= 34.0

        if subtitle:
            c.setFont("Helvetica", 11.5)
            c.setFillColor(Color(0.35, 0.35, 0.38, alpha=0.9))
            c.drawString(x1 + 16.0, cur_y - 6.0, subtitle)
            cur_y -= 24.0

        c.setStrokeColor(Color(0.10, 0.10, 0.12, alpha=1.0))
        c.setLineWidth(1.0)
        c.line(x1 + 16.0, cur_y - 12.0, x1 + 120.0, cur_y - 12.0)

        tech_y = m + 28.0
        c.setFont("Courier-Bold", 8.0)
        c.setFillColor(Color(0.20, 0.20, 0.24, alpha=0.95))
        c.drawString(x1 + 16.0, tech_y + 44.0, f"[ OPERATOR ] : {author or 'User.01'}")
        c.drawString(x1 + 16.0, tech_y + 28.0, f"[ TIMESTAMP] : {date_str or '1984.10.24'}")
        c.drawString(x1 + 16.0, tech_y + 12.0, f"[ DATASETS ] : {num_slides or 0} Slides Compiled // Format A4")

    elif tpl == "nineties":
        # 8. 1990s Minimalist Lookbook & Indie Zine (Ray Gun, Calvin Klein 90s minimalism)
        m = 36.0
        x1 = left_gutter + m
        x2 = pw - right_gutter - m
        w = x2 - x1

        c.setStrokeColor(Color(0.12, 0.12, 0.14, alpha=0.4))
        c.setLineWidth(0.4)
        for cx_val, cy in [(x1, ph - m), (x2, ph - m), (x1, m), (x2, m)]:
            c.line(cx_val - 8.0, cy, cx_val + 8.0, cy)
            c.line(cx_val, cy - 8.0, cx_val, cy + 8.0)
            c.circle(cx_val, cy, 3.5, stroke=1, fill=0)

        c.setFont("Courier-Bold", 8.0)
        c.setFillColor(Color(0.25, 0.25, 0.28, alpha=0.9))
        c.drawString(x1 + 16.0, ph - m - 18.0, "ISSUE #09 // EDITORIAL DOSSIER")

        bx = x2 - 60.0
        by = ph - m - 24.0
        bar_widths = [1.2, 0.5, 2.0, 0.8, 1.5, 0.5, 2.2, 0.8, 1.2, 0.5, 1.8]
        curr_bx = bx
        c.setFillColor(Color(0.12, 0.12, 0.14, alpha=0.85))
        for bw in bar_widths:
            c.rect(curr_bx, by, bw, 14.0, fill=1, stroke=0)
            curr_bx += bw + 1.8

        c.setStrokeColor(Color(0.12, 0.12, 0.14, alpha=0.2))
        c.setLineWidth(0.5)
        c.line(x1 + 16.0, m + 40.0, x1 + 16.0, ph - m - 40.0)

        c.setFont("Helvetica-Bold", 28)
        c.setFillColor(Color(0.06, 0.06, 0.08, alpha=1.0))
        lines = wrap_text_lines(clean_title, "Helvetica-Bold", 28, w - 70.0, c)
        cur_y = ph * 0.56 + (len(lines) - 1) * 16.0
        for line in lines:
            c.drawString(x1 + 28.0, cur_y, line)
            cur_y -= 36.0

        if subtitle:
            c.setFont("Helvetica-Oblique", 13.0)
            c.setFillColor(Color(0.40, 0.40, 0.44, alpha=0.95))
            c.drawString(x1 + 28.0, cur_y - 6.0, subtitle)
            cur_y -= 26.0

        meta_y = m + 32.0
        c.setFont("Courier-Bold", 8.5)
        c.setFillColor(Color(0.20, 0.20, 0.24, alpha=0.95))
        c.drawString(x1 + 28.0, meta_y + 40.0, "INDEX.REF  :: 90S-ARCHIVE")
        c.drawString(x1 + 28.0, meta_y + 26.0, f"CURATOR    :: {author or 'Anonymous'}")
        c.drawString(x1 + 28.0, meta_y + 12.0, f"TIMESTAMP  :: {date_str or 'Autumn 1996'}")
        c.drawString(x1 + 28.0, meta_y - 2.0,  f"CONTENT    :: {num_slides or 0} Slide Folios")

    elif tpl in ("twothousands", "2000s", "2000", "y2k", "noughties"):
        # 9a. 2000s Y2K Millennium Tech & Dot-Com Era
        m = 42.0
        x1 = left_gutter + m
        x2 = pw - right_gutter - m
        w = x2 - x1

        cobalt = Color(0.06, 0.30, 0.62, alpha=1.0)
        cyan_y2k = Color(0.10, 0.60, 0.82, alpha=1.0)

        c.setFillColor(cobalt)
        c.rect(x1, ph - m - 12.0, w, 12.0, fill=1, stroke=0)
        c.setFillColor(cyan_y2k)
        c.rect(x1, ph - m - 15.0, w, 3.0, fill=1, stroke=0)

        c.setStrokeColor(cobalt)
        c.setLineWidth(0.8)
        c.roundRect(x2 - 74.0, ph - m - 42.0, 60.0, 18.0, 9.0, stroke=1, fill=0)
        c.setFont("Helvetica-Bold", 7.0)
        c.setFillColor(cobalt)
        c.drawCentredString(x2 - 44.0, ph - m - 34.0, "Y2K-2000")

        c.setFont("Helvetica-Bold", 8.5)
        c.setFillColor(cobalt)
        c.drawString(x1, ph - m - 34.0, "Y2K MILLENNIUM DOSSIER // DIGITAL ERA")

        c.setFont("Helvetica-Bold", 27)
        c.setFillColor(Color(0.08, 0.12, 0.18, alpha=1.0))
        lines = wrap_text_lines(clean_title, "Helvetica-Bold", 27, w - 50.0, c)
        cur_y = ph * 0.58 + (len(lines) - 1) * 16.0
        for line in lines:
            c.drawString(x1, cur_y, line)
            cur_y -= 35.0

        if subtitle:
            c.setFont("Helvetica", 12.0)
            c.setFillColor(cyan_y2k)
            c.drawString(x1, cur_y - 6.0, subtitle)
            cur_y -= 24.0

        c.setStrokeColor(cyan_y2k)
        c.setLineWidth(1.2)
        c.line(x1, cur_y - 12.0, x1 + 100.0, cur_y - 12.0)

        meta_y = m + 28.0
        c.setFont("Courier-Bold", 8.0)
        c.setFillColor(cobalt)
        c.drawString(x1, meta_y + 44.0, f"<AUTHOR>    {author or 'Y2K.User'}")
        c.drawString(x1, meta_y + 28.0, f"<TIMESTAMP> {date_str or '2000.01.01'}")
        c.drawString(x1, meta_y + 12.0, f"<FOLIOS>    {num_slides or 0} Slides Processed")

    elif tpl in ("twenty10s", "2010s", "2010", "flatdesign", "startup"):
        # 9b. 2010s Flat Design & Startup Minimalist
        m = 46.0
        x1 = left_gutter + m
        x2 = pw - right_gutter - m
        w = x2 - x1

        charcoal = Color(0.10, 0.12, 0.16, alpha=1.0)
        indigo = Color(0.35, 0.38, 0.88, alpha=1.0)

        c.setFont("Helvetica-Bold", 8.0)
        c.setFillColor(indigo)
        c.drawString(x1, ph - m - 20.0, "2010s MINIMALIST // STARTUP EDITION")
        c.setFont("Helvetica", 7.5)
        c.setFillColor(Color(0.5, 0.5, 0.55, alpha=0.9))
        c.drawRightString(x2, ph - m - 20.0, "FLAT DESIGN ARCHIVE · VOL. 14")

        c.setStrokeColor(Color(0.15, 0.15, 0.18, alpha=0.15))
        c.setLineWidth(0.5)
        c.line(x1, ph - m - 30.0, x2, ph - m - 30.0)

        c.setFont("Helvetica-Bold", 27)
        c.setFillColor(charcoal)
        lines = wrap_text_lines(clean_title, "Helvetica-Bold", 27, w - 40.0, c)
        cur_y = ph * 0.60 + (len(lines) - 1) * 16.0
        for line in lines:
            c.drawString(x1, cur_y, line)
            cur_y -= 35.0

        if subtitle:
            c.setFont("Helvetica", 12.0)
            c.setFillColor(Color(0.4, 0.4, 0.45, alpha=0.9))
            c.drawString(x1, cur_y - 6.0, subtitle)
            cur_y -= 24.0

        c.setFillColor(indigo)
        c.circle(x1 + 4.0, cur_y - 12.0, 3.0, fill=1, stroke=0)

        meta_y = m + 36.0
        c.setFont("Helvetica-Bold", 7.0)
        c.setFillColor(indigo)
        c.drawString(x1, meta_y + 24.0, "AUTHOR")
        c.setFont("Helvetica", 10.0)
        c.setFillColor(charcoal)
        c.drawString(x1, meta_y + 10.0, author or "Startup Notes")

        c.setFont("Helvetica-Bold", 7.0)
        c.setFillColor(indigo)
        c.drawString(x1 + w * 0.52, meta_y + 24.0, "DATE")
        c.setFont("Helvetica", 10.0)
        c.setFillColor(charcoal)
        c.drawString(x1 + w * 0.52, meta_y + 10.0, date_str or "2015 Edition")

    elif tpl in ("twentytwenties", "2020s", "2020", "neubrutalism", "contemporary", "ai_era"):
        # 9c. 2020s Modern Neubrutalism & Contemporary AI Era
        m = 40.0
        x1 = left_gutter + m
        x2 = pw - right_gutter - m
        w = x2 - x1

        pitch_black = Color(0.05, 0.05, 0.06, alpha=1.0)
        emerald = Color(0.05, 0.72, 0.45, alpha=1.0)

        c.setStrokeColor(pitch_black)
        c.setLineWidth(2.5)
        c.rect(x1, m, w, ph - 2 * m, stroke=1, fill=0)

        c.setFont("Courier-Bold", 8.0)
        c.setFillColor(pitch_black)
        c.drawString(x1 + 16.0, ph - m - 24.0, "[ 2020s // CONTEMPORARY STUDY FOLIO ]")

        c.setFillColor(emerald)
        c.rect(x2 - 80.0, ph - m - 30.0, 64.0, 16.0, fill=1, stroke=0)
        c.setFont("Courier-Bold", 7.0)
        c.setFillColor(pitch_black)
        c.drawCentredString(x2 - 48.0, ph - m - 22.0, "2026.AI")

        c.setFont("Helvetica-Bold", 27)
        c.setFillColor(pitch_black)
        lines = wrap_text_lines(clean_title, "Helvetica-Bold", 27, w - 50.0, c)
        cur_y = ph * 0.58 + (len(lines) - 1) * 16.0
        for line in lines:
            c.drawString(x1 + 16.0, cur_y, line)
            cur_y -= 35.0

        if subtitle:
            c.setFont("Helvetica", 12.0)
            c.setFillColor(Color(0.3, 0.3, 0.35, alpha=0.9))
            c.drawString(x1 + 16.0, cur_y - 6.0, subtitle)
            cur_y -= 24.0

        c.setFillColor(pitch_black)
        c.rect(x1 + 16.0, cur_y - 12.0, 120.0, 3.0, fill=1, stroke=0)

        box_y = m + 24.0
        box_w = w - 32.0
        box_h = 56.0
        bx = x1 + 16.0
        c.setStrokeColor(pitch_black)
        c.setLineWidth(1.5)
        c.rect(bx, box_y, box_w, box_h, stroke=1, fill=0)

        c.setFont("Courier-Bold", 7.5)
        c.setFillColor(pitch_black)
        c.drawString(bx + 12.0, box_y + box_h - 18.0, f"AUTHOR    : {author or 'User.2020'}")
        c.drawString(bx + 12.0, box_y + box_h - 34.0, f"TIMESTAMP : {date_str or 'Contemporary'}")
        c.drawString(bx + 12.0, box_y + box_h - 48.0, f"DATASETS  : {num_slides or 0} Slide Folios")

    elif tpl == "natural":
        # 10. Natural Deep Forest Editorial (Luxury Architectural Notebook)
        c.setFillColor(Color(0.965, 0.958, 0.942, alpha=1.0))
        c.rect(0, 0, pw, ph, fill=1, stroke=0)

        m = 40.0
        x1 = left_gutter + m
        x2 = pw - right_gutter - m
        w = x2 - x1

        forest_dark = Color(0.06, 0.18, 0.11, alpha=1.0)
        forest_mid = Color(0.12, 0.28, 0.18, alpha=1.0)
        forest_light = Color(0.24, 0.44, 0.32, alpha=0.35)
        brass_gold = Color(0.72, 0.58, 0.36, alpha=1.0)

        c.setStrokeColor(forest_dark)
        c.setLineWidth(1.4)
        c.rect(x1, m, w, ph - 2 * m, stroke=1, fill=0)

        c.setStrokeColor(forest_light)
        c.setLineWidth(0.4)
        c.rect(x1 + 4.5, m + 4.5, w - 9.0, ph - 2 * (m + 4.5), stroke=1, fill=0)

        c.setStrokeColor(brass_gold)
        c.setLineWidth(0.6)
        for cx_val, cy in [(x1, m), (x2, m), (x1, ph - m), (x2, ph - m)]:
            c.line(cx_val - 5.0, cy, cx_val + 5.0, cy)
            c.line(cx_val, cy - 5.0, cx_val, cy + 5.0)

        hdr_h = 24.0
        c.setFillColor(forest_dark)
        c.rect(x1 + 16.0, ph - m - 32.0, w - 32.0, hdr_h, fill=1, stroke=0)

        c.setFont("Helvetica-Bold", 8.0)
        c.setFillColor(Color(0.97, 0.97, 0.96, alpha=0.95))
        c.drawString(x1 + 26.0, ph - m - 22.0, "NATURAL COMPENDIUM // EDITORIAL STUDY FOLIO")

        c.setFont("Times-Italic", 8.0)
        c.setFillColor(brass_gold)
        c.drawRightString(x2 - 26.0, ph - m - 22.0, "VOL. 01 · DEEP FOREST ARCHIVE")

        c.setFillColor(brass_gold)
        c.rect(x1 + 16.0, ph - m - 35.0, w - 32.0, 1.0, fill=1, stroke=0)

        title_x = x1 + 22.0
        c.setFont("Helvetica-Bold", 8.0)
        c.setFillColor(forest_mid)
        c.drawString(title_x, ph * 0.65, "STUDY DOSSIER · NATURAL EDITION")

        c.setFont("Times-Bold", 27)
        c.setFillColor(forest_dark)
        lines = wrap_text_lines(clean_title, "Times-Bold", 27, w - 60.0, c)
        cur_y = ph * 0.60 + (len(lines) - 1) * 16.0
        for line in lines:
            c.drawString(title_x, cur_y, line)
            cur_y -= 35.0

        if subtitle:
            c.setFont("Times-Italic", 13.0)
            c.setFillColor(forest_mid)
            c.drawString(title_x, cur_y - 6.0, subtitle)
            cur_y -= 26.0

        rule_y = cur_y - 12.0
        c.setStrokeColor(forest_dark)
        c.setLineWidth(1.0)
        c.line(title_x, rule_y, title_x + 60.0, rule_y)

        c.setFillColor(brass_gold)
        c.rect(title_x + 64.0, rule_y - 2.0, 4.0, 4.0, fill=1, stroke=0)

        c.setStrokeColor(forest_light)
        c.setLineWidth(0.5)
        c.line(title_x + 72.0, rule_y, x2 - 22.0, rule_y)

        grid_y = m + 36.0
        col_w = (w - 44.0) / 2.0

        c.setStrokeColor(forest_dark)
        c.setLineWidth(0.8)
        c.line(title_x, grid_y + 44.0, x2 - 22.0, grid_y + 44.0)
        c.setStrokeColor(forest_light)
        c.setLineWidth(0.5)
        c.line(title_x + col_w, grid_y + 44.0, title_x + col_w, grid_y - 16.0)

        c.setFont("Helvetica-Bold", 7.0)
        c.setFillColor(forest_mid)
        c.drawString(title_x, grid_y + 32.0, "STUDENT / AUTHOR")
        c.setFont("Times-Bold", 10.0)
        c.setFillColor(forest_dark)
        c.drawString(title_x, grid_y + 16.0, author or "Natural Dossier")

        c.setFont("Helvetica-Bold", 6.5)
        c.setFillColor(forest_mid)
        c.drawString(title_x, grid_y - 2.0, "CONTENT FOLIOS")
        c.setFont("Times-Italic", 9.0)
        c.setFillColor(forest_dark)
        s_cnt = num_slides if num_slides is not None else 0
        s_word = "slide sheet" if s_cnt == 1 else "slide sheets"
        c.drawString(title_x, grid_y - 14.0, f"{s_cnt} {s_word} compiled")

        col2_x = title_x + col_w + 16.0
        c.setFont("Helvetica-Bold", 7.0)
        c.setFillColor(forest_mid)
        c.drawString(col2_x, grid_y + 32.0, "DATE / COMPILATION")
        c.setFont("Times-Bold", 10.0)
        c.setFillColor(forest_dark)
        c.drawString(col2_x, grid_y + 16.0, date_str or "Archival Record")

        c.setFont("Helvetica-Bold", 6.5)
        c.setFillColor(forest_mid)
        c.drawString(col2_x, grid_y - 2.0, "EDITION")
        c.setFont("Times-Italic", 9.0)
        c.setFillColor(forest_dark)
        c.drawString(col2_x, grid_y - 14.0, "Natural Forest Series // No. 01")

    elif tpl == "spring":
        # 11. Spring / Vernal Editorial (Fresh Sage Green & Airy Geometry)
        c.setFillColor(Color(0.985, 0.988, 0.982, alpha=1.0))
        c.rect(0, 0, pw, ph, fill=1, stroke=0)

        m = 42.0
        x1 = left_gutter + m
        x2 = pw - right_gutter - m
        w = x2 - x1

        sage_deep = Color(0.18, 0.38, 0.25, alpha=1.0)
        sage_soft = Color(0.35, 0.55, 0.42, alpha=0.8)
        sage_mist = Color(0.35, 0.55, 0.42, alpha=0.18)
        blossom_tint = Color(0.78, 0.54, 0.48, alpha=1.0)

        c.setStrokeColor(sage_soft)
        c.setLineWidth(0.8)
        c.rect(x1, m, w, ph - 2 * m, stroke=1, fill=0)

        c.setStrokeColor(sage_mist)
        c.setLineWidth(0.4)
        c.rect(x1 + 4.0, m + 4.0, w - 8.0, ph - 2 * (m + 4.0), stroke=1, fill=0)

        lozenge_y = ph * 0.68
        c.setStrokeColor(sage_deep)
        c.setLineWidth(0.6)
        c.circle(center_x, lozenge_y, 11.0, stroke=1, fill=0)
        c.setStrokeColor(blossom_tint)
        c.line(center_x - 15.0, lozenge_y, center_x + 15.0, lozenge_y)
        c.line(center_x, lozenge_y - 15.0, center_x, lozenge_y + 15.0)

        c.setFont("Helvetica-Bold", 8.0)
        c.setFillColor(sage_deep)
        c.drawCentredString(center_x, ph - m - 32.0, "V E R N A L   C O M P E N D I U M")
        c.setFont("Times-Italic", 8.0)
        c.setFillColor(sage_soft)
        c.drawCentredString(center_x, ph - m - 46.0, "SPRING SERIES · NEW CYCLE · VOL. I")

        c.setFont("Times-Bold", 25)
        c.setFillColor(Color(0.12, 0.22, 0.16, alpha=1.0))
        lines = wrap_text_lines(clean_title, "Times-Bold", 25, w - 60.0, c)
        cur_y = lozenge_y - 42.0
        for line in lines:
            c.drawCentredString(center_x, cur_y, line)
            cur_y -= 33.0

        if subtitle:
            c.setFont("Times-Italic", 12.0)
            c.setFillColor(sage_soft)
            c.drawCentredString(center_x, cur_y - 8.0, subtitle)
            cur_y -= 24.0

        c.setStrokeColor(sage_soft)
        c.setLineWidth(0.5)
        c.line(center_x - 36.0, cur_y - 12.0, center_x + 36.0, cur_y - 12.0)

        meta_y = m + 40.0
        c.setFont("Helvetica-Bold", 7.0)
        c.setFillColor(sage_soft)
        c.drawCentredString(center_x, meta_y + 24.0, "CURATED STUDY FOLIO")
        c.setFont("Times-Roman", 10.0)
        c.setFillColor(sage_deep)
        c.drawCentredString(center_x, meta_y + 10.0, author or "Spring Session Notes")
        c.setFont("Times-Italic", 8.5)
        c.setFillColor(sage_soft)
        c.drawCentredString(center_x, meta_y - 4.0, date_str or "Springtime")
        if num_slides is not None:
            s_word = "slide" if num_slides == 1 else "slides"
            c.drawCentredString(center_x, meta_y - 18.0, f"{num_slides} {s_word} compiled")

    elif tpl == "summer":
        # 12. Summer / Solstice Editorial (Aegean Azure & Solar Warmth)
        c.setFillColor(Color(0.99, 0.99, 0.985, alpha=1.0))
        c.rect(0, 0, pw, ph, fill=1, stroke=0)

        m = 42.0
        x1 = left_gutter + m
        x2 = pw - right_gutter - m
        w = x2 - x1

        azure_deep = Color(0.06, 0.24, 0.44, alpha=1.0)
        azure_light = Color(0.18, 0.45, 0.70, alpha=0.3)
        solar_gold = Color(0.86, 0.60, 0.20, alpha=1.0)

        bar_h = 36.0
        c.setFillColor(azure_deep)
        c.rect(left_gutter, ph - bar_h, pw - left_gutter - right_gutter, bar_h, fill=1, stroke=0)
        c.setFillColor(solar_gold)
        c.rect(left_gutter, ph - bar_h - 2.5, pw - left_gutter - right_gutter, 2.5, fill=1, stroke=0)

        c.setFont("Helvetica-Bold", 8.5)
        c.setFillColor(Color(0.98, 0.98, 0.98, alpha=0.95))
        c.drawString(x1, ph - 22.0, "SOLSTICE COMPENDIUM · SUMMER FOLIO")
        c.setFont("Helvetica", 8.0)
        c.drawRightString(x2, ph - 22.0, "MEDITERRANEAN ARCHIVE // 02")

        c.setStrokeColor(azure_light)
        c.setLineWidth(0.6)
        c.rect(x1, m, w, ph - m - bar_h - 16.0, stroke=1, fill=0)

        c.setFont("Helvetica-Bold", 27)
        c.setFillColor(azure_deep)
        lines = wrap_text_lines(clean_title, "Helvetica-Bold", 27, w - 50.0, c)
        cur_y = ph * 0.58 + (len(lines) - 1) * 16.0
        for line in lines:
            c.drawString(x1 + 18.0, cur_y, line)
            cur_y -= 35.0

        if subtitle:
            c.setFont("Times-Italic", 13.0)
            c.setFillColor(Color(0.25, 0.40, 0.55, alpha=0.95))
            c.drawString(x1 + 18.0, cur_y - 6.0, subtitle)
            cur_y -= 26.0

        rule_y = cur_y - 14.0
        c.setStrokeColor(azure_deep)
        c.setLineWidth(1.0)
        c.line(x1 + 18.0, rule_y, x1 + 80.0, rule_y)
        c.setStrokeColor(solar_gold)
        c.setLineWidth(1.0)
        c.line(x1 + 80.0, rule_y, x1 + 120.0, rule_y)

        meta_y = m + 32.0
        c.setFont("Helvetica-Bold", 7.0)
        c.setFillColor(solar_gold)
        c.drawString(x1 + 18.0, meta_y + 36.0, "STUDY RESEARCHER")
        c.setFont("Times-Roman", 10.0)
        c.setFillColor(azure_deep)
        c.drawString(x1 + 18.0, meta_y + 22.0, author or "Summer Study Compendium")

        c.setFont("Helvetica-Bold", 7.0)
        c.setFillColor(solar_gold)
        c.drawString(x1 + 18.0, meta_y + 6.0, "CALENDAR REGISTRY")
        c.setFont("Times-Italic", 9.0)
        c.setFillColor(azure_deep)
        c.drawString(x1 + 18.0, meta_y - 8.0, date_str or "Summer Solstice")

        if num_slides is not None:
            s_word = "slide" if num_slides == 1 else "slides"
            c.setFont("Helvetica", 8.0)
            c.setFillColor(Color(0.4, 0.5, 0.6, alpha=0.9))
            c.drawRightString(x2 - 18.0, meta_y + 22.0, f"{num_slides} {s_word} in dossier")

    elif tpl == "autumn":
        # 13. Autumn / Equinox Editorial (Burnt Terracotta & Amber Warmth)
        c.setFillColor(Color(0.965, 0.945, 0.915, alpha=1.0))
        c.rect(0, 0, pw, ph, fill=1, stroke=0)

        m = 40.0
        x1 = left_gutter + m
        x2 = pw - right_gutter - m
        w = x2 - x1

        terracotta = Color(0.62, 0.22, 0.12, alpha=1.0)
        amber = Color(0.76, 0.50, 0.18, alpha=1.0)
        espresso = Color(0.18, 0.10, 0.08, alpha=1.0)

        c.setStrokeColor(amber)
        c.setLineWidth(0.5)
        c.rect(x1, m, w, ph - 2 * m, stroke=1, fill=0)

        c.setStrokeColor(terracotta)
        c.setLineWidth(1.4)
        c.rect(x1 + 4.0, m + 4.0, w - 8.0, ph - 2 * (m + 4.0), stroke=1, fill=0)

        c.setFont("Helvetica-Bold", 8.0)
        c.setFillColor(terracotta)
        c.drawCentredString(center_x, ph - m - 32.0, "E Q U I N O X   D O S S I E R")
        c.setFont("Times-Italic", 8.0)
        c.setFillColor(amber)
        c.drawCentredString(center_x, ph - m - 46.0, "AUTUMNAL COMPENDIUM · OCTOBER ARCHIVE")

        loz_y = ph * 0.65
        c.setStrokeColor(terracotta)
        c.setLineWidth(0.8)
        p = c.beginPath()
        p.moveTo(center_x, loz_y + 11.0)
        p.lineTo(center_x + 11.0, loz_y)
        p.lineTo(center_x, loz_y - 11.0)
        p.lineTo(center_x - 11.0, loz_y)
        p.close()
        c.drawPath(p, stroke=1, fill=0)

        c.setFillColor(amber)
        c.circle(center_x, loz_y, 2.5, fill=1, stroke=0)

        c.setFont("Times-Bold", 25)
        c.setFillColor(espresso)
        lines = wrap_text_lines(clean_title, "Times-Bold", 25, w - 60.0, c)
        cur_y = loz_y - 36.0
        for line in lines:
            c.drawCentredString(center_x, cur_y, line)
            cur_y -= 32.0

        if subtitle:
            c.setFont("Times-Italic", 12.0)
            c.setFillColor(terracotta)
            c.drawCentredString(center_x, cur_y - 8.0, subtitle)
            cur_y -= 24.0

        c.setStrokeColor(amber)
        c.setLineWidth(0.6)
        c.line(center_x - 45.0, cur_y - 10.0, center_x + 45.0, cur_y - 10.0)

        box_y = m + 32.0
        box_w = w - 40.0
        box_h = 68.0
        bx = center_x - box_w / 2.0
        c.setStrokeColor(Color(0.62, 0.22, 0.12, alpha=0.25))
        c.setLineWidth(0.5)
        c.rect(bx, box_y, box_w, box_h, stroke=1, fill=0)

        c.setFont("Helvetica-Bold", 7.0)
        c.setFillColor(terracotta)
        c.drawString(bx + 14.0, box_y + box_h - 18.0, "RESEARCHER / STUDENT:")
        c.setFont("Times-Roman", 9.5)
        c.setFillColor(espresso)
        c.drawString(bx + 140.0, box_y + box_h - 18.0, author or "Autumn Studies")

        c.setFont("Helvetica-Bold", 7.0)
        c.setFillColor(terracotta)
        c.drawString(bx + 14.0, box_y + box_h - 36.0, "SESSION DATE:")
        c.setFont("Times-Roman", 9.5)
        c.setFillColor(espresso)
        c.drawString(bx + 140.0, box_y + box_h - 36.0, date_str or "Autumn Season")

        c.setFont("Helvetica-Bold", 7.0)
        c.setFillColor(terracotta)
        c.drawString(bx + 14.0, box_y + box_h - 54.0, "FOLIO ARCHIVE:")
        c.setFont("Times-Italic", 8.5)
        c.setFillColor(amber)
        s_cnt = num_slides if num_slides is not None else 0
        c.drawString(bx + 140.0, box_y + box_h - 54.0, f"{s_cnt} Slide Sheets Compiled")

    elif tpl == "winter":
        # 14. Winter / Hiemal Editorial (Nordic Alpine Midnight & Crystalline Slate)
        c.setFillColor(Color(0.965, 0.975, 0.985, alpha=1.0))
        c.rect(0, 0, pw, ph, fill=1, stroke=0)

        m = 44.0
        x1 = left_gutter + m
        x2 = pw - right_gutter - m
        w = x2 - x1

        midnight = Color(0.08, 0.14, 0.24, alpha=1.0)
        slate_blue = Color(0.32, 0.46, 0.60, alpha=1.0)
        frost_line = Color(0.32, 0.46, 0.60, alpha=0.25)

        c.setStrokeColor(slate_blue)
        c.setLineWidth(0.8)
        c.rect(x1, m, w, ph - 2 * m, stroke=1, fill=0)
        c.setStrokeColor(frost_line)
        c.setLineWidth(0.35)
        c.rect(x1 + 4.0, m + 4.0, w - 8.0, ph - 2 * (m + 4.0), stroke=1, fill=0)
        c.rect(x1 + 7.0, m + 7.0, w - 14.0, ph - 2 * (m + 7.0), stroke=1, fill=0)

        star_y = ph * 0.68
        c.setStrokeColor(slate_blue)
        c.setLineWidth(0.7)
        c.circle(center_x, star_y, 13.0, stroke=1, fill=0)
        for deg in [0, 60, 120]:
            rad = math.radians(deg)
            dx = 17.0 * math.cos(rad)
            dy = 17.0 * math.sin(rad)
            c.line(center_x - dx, star_y - dy, center_x + dx, star_y + dy)

        c.setFont("Helvetica-Bold", 8.0)
        c.setFillColor(midnight)
        c.drawCentredString(center_x, ph - m - 28.0, "HIEMAL COMPENDIUM · ARCTIC ARCHIVE")
        c.setFont("Helvetica", 7.0)
        c.setFillColor(slate_blue)
        c.drawCentredString(center_x, ph - m - 42.0, "NORDIC ALPINE EDITION · NO. 04")

        c.setFont("Times-Bold", 26)
        c.setFillColor(midnight)
        lines = wrap_text_lines(clean_title, "Times-Bold", 26, w - 60.0, c)
        cur_y = star_y - 42.0
        for line in lines:
            c.drawCentredString(center_x, cur_y, line)
            cur_y -= 34.0

        if subtitle:
            c.setFont("Times-Italic", 12.0)
            c.setFillColor(slate_blue)
            c.drawCentredString(center_x, cur_y - 8.0, subtitle)
            cur_y -= 24.0

        c.setStrokeColor(slate_blue)
        c.setLineWidth(0.5)
        c.line(center_x - 30.0, cur_y - 12.0, center_x + 30.0, cur_y - 12.0)

        meta_y = m + 38.0
        c.setFont("Helvetica-Bold", 7.0)
        c.setFillColor(slate_blue)
        c.drawCentredString(center_x, meta_y + 24.0, "OPERATOR / CURATOR")
        c.setFont("Helvetica", 9.5)
        c.setFillColor(midnight)
        c.drawCentredString(center_x, meta_y + 10.0, author or "Winter Session")
        c.setFont("Helvetica", 8.0)
        c.setFillColor(slate_blue)
        c.drawCentredString(center_x, meta_y - 4.0, date_str or "Winter Season")
        if num_slides is not None:
            s_word = "slide" if num_slides == 1 else "slides"
            c.drawCentredString(center_x, meta_y - 18.0, f"{num_slides} {s_word} indexed")

    elif tpl == "polo":
        # 15. Ralph Lauren Polo (Collegiate Navy & Gold Shield Heritage)
        c.setFillColor(Color(0.975, 0.970, 0.960, alpha=1.0))
        c.rect(0, 0, pw, ph, fill=1, stroke=0)

        m = 40.0
        x1 = left_gutter + m
        x2 = pw - right_gutter - m
        w = x2 - x1

        rl_navy = Color(0.06, 0.12, 0.25, alpha=1.0)
        rl_green = Color(0.08, 0.22, 0.14, alpha=1.0)
        rl_gold = Color(0.76, 0.60, 0.32, alpha=1.0)

        c.setStrokeColor(rl_navy)
        c.setLineWidth(2.5)
        c.rect(x1, m, w, ph - 2 * m, stroke=1, fill=0)

        c.setStrokeColor(rl_gold)
        c.setLineWidth(0.6)
        c.rect(x1 + 4.5, m + 4.5, w - 9.0, ph - 2 * (m + 4.5), stroke=1, fill=0)

        c.setStrokeColor(rl_navy)
        c.setLineWidth(0.4)
        c.rect(x1 + 8.0, m + 8.0, w - 16.0, ph - 2 * (m + 8.0), stroke=1, fill=0)

        c.setFont("Times-Bold", 8.5)
        c.setFillColor(rl_navy)
        c.drawCentredString(center_x, ph - m - 28.0, "P O L O   S T U D Y   C O M P E N D I U M")
        c.setFont("Times-Italic", 7.5)
        c.setFillColor(rl_green)
        c.drawCentredString(center_x, ph - m - 42.0, "HERITAGE COLLEGIATE ARCHIVE · EST. 1967")

        shield_y = ph * 0.66
        c.setStrokeColor(rl_navy)
        c.setLineWidth(1.2)
        sh_p = c.beginPath()
        sh_p.moveTo(center_x, shield_y + 16.0)
        sh_p.lineTo(center_x + 16.0, shield_y)
        sh_p.lineTo(center_x, shield_y - 16.0)
        sh_p.lineTo(center_x - 16.0, shield_y)
        sh_p.close()
        c.drawPath(sh_p, stroke=1, fill=0)

        c.setStrokeColor(rl_gold)
        c.setLineWidth(0.6)
        c.circle(center_x, shield_y, 9.0, stroke=1, fill=0)
        c.line(center_x - 11.0, shield_y, center_x + 11.0, shield_y)
        c.line(center_x, shield_y - 11.0, center_x, shield_y + 11.0)

        c.setFont("Times-Bold", 5.5)
        c.setFillColor(rl_navy)
        c.drawCentredString(center_x, shield_y - 1.5, "RL")

        c.setFont("Times-Bold", 26)
        c.setFillColor(rl_navy)
        lines = wrap_text_lines(clean_title, "Times-Bold", 26, w - 60.0, c)
        cur_y = shield_y - 42.0
        for line in lines:
            c.drawCentredString(center_x, cur_y, line)
            cur_y -= 34.0

        if subtitle:
            c.setFont("Times-Italic", 12.5)
            c.setFillColor(rl_green)
            c.drawCentredString(center_x, cur_y - 6.0, subtitle)
            cur_y -= 24.0

        c.setStrokeColor(rl_navy)
        c.setLineWidth(1.0)
        c.line(center_x - 40.0, cur_y - 10.0, center_x + 40.0, cur_y - 10.0)
        c.setStrokeColor(rl_gold)
        c.setLineWidth(0.5)
        c.line(center_x - 25.0, cur_y - 13.0, center_x + 25.0, cur_y - 13.0)

        meta_y = m + 36.0
        c.setFont("Times-Bold", 7.5)
        c.setFillColor(rl_gold)
        c.drawCentredString(center_x, meta_y + 26.0, "FELLOW / STUDENT RECORD")
        c.setFont("Times-Bold", 10.5)
        c.setFillColor(rl_navy)
        c.drawCentredString(center_x, meta_y + 12.0, author or "Collegiate Member")
        c.setFont("Times-Italic", 8.5)
        c.setFillColor(rl_green)
        c.drawCentredString(center_x, meta_y - 2.0, date_str or "Academic Term")
        if num_slides is not None:
            s_word = "slide folio" if num_slides == 1 else "slide folios"
            c.setFont("Times-Roman", 8.0)
            c.setFillColor(Color(0.4, 0.45, 0.5, alpha=0.85))
            c.drawCentredString(center_x, meta_y - 16.0, f"{num_slides} {s_word} bound")

    elif tpl == "equestrian":
        # 16. Ralph Lauren Equestrian (British Country Estate & Hunter Green)
        c.setFillColor(Color(0.965, 0.952, 0.925, alpha=1.0))
        c.rect(0, 0, pw, ph, fill=1, stroke=0)

        m = 40.0
        x1 = left_gutter + m
        x2 = pw - right_gutter - m
        w = x2 - x1

        hunter_green = Color(0.08, 0.20, 0.13, alpha=1.0)
        saddle_tan = Color(0.55, 0.30, 0.14, alpha=1.0)
        brass = Color(0.74, 0.58, 0.30, alpha=1.0)

        c.setStrokeColor(hunter_green)
        c.setLineWidth(1.6)
        c.rect(x1, m, w, ph - 2 * m, stroke=1, fill=0)

        c.setStrokeColor(brass)
        c.setLineWidth(0.6)
        c.rect(x1 + 4.0, m + 4.0, w - 8.0, ph - 2 * (m + 4.0), stroke=1, fill=0)

        c.setStrokeColor(saddle_tan)
        c.setLineWidth(0.4)
        c.setDash(4, 3)
        c.rect(x1 + 7.5, m + 7.5, w - 15.0, ph - 2 * (m + 7.5), stroke=1, fill=0)
        c.setDash()

        c.setFont("Times-Bold", 8.5)
        c.setFillColor(hunter_green)
        c.drawCentredString(center_x, ph - m - 28.0, "E Q U E S T R I A N   &   F I E L D")
        c.setFont("Times-Italic", 7.5)
        c.setFillColor(saddle_tan)
        c.drawCentredString(center_x, ph - m - 42.0, "COUNTRY ESTATE ARCHIVE · SERIES IX")

        stirrup_y = ph * 0.66
        c.setStrokeColor(brass)
        c.setLineWidth(1.2)
        p = c.beginPath()
        p.arc(center_x - 13.0, stirrup_y - 6.0, center_x + 13.0, stirrup_y + 20.0, 0, 180)
        p.lineTo(center_x - 13.0, stirrup_y - 8.0)
        p.lineTo(center_x + 13.0, stirrup_y - 8.0)
        p.close()
        c.drawPath(p, stroke=1, fill=0)

        c.setStrokeColor(saddle_tan)
        c.setLineWidth(1.0)
        c.line(center_x - 16.0, stirrup_y - 8.0, center_x + 16.0, stirrup_y - 8.0)

        c.setFont("Times-Bold", 25)
        c.setFillColor(hunter_green)
        lines = wrap_text_lines(clean_title, "Times-Bold", 25, w - 60.0, c)
        cur_y = stirrup_y - 36.0
        for line in lines:
            c.drawCentredString(center_x, cur_y, line)
            cur_y -= 33.0

        if subtitle:
            c.setFont("Times-Italic", 12.0)
            c.setFillColor(saddle_tan)
            c.drawCentredString(center_x, cur_y - 6.0, subtitle)
            cur_y -= 24.0

        rule_y = cur_y - 10.0
        c.setStrokeColor(saddle_tan)
        c.setLineWidth(0.8)
        c.setDash(3, 3)
        c.line(center_x - 45.0, rule_y, center_x + 45.0, rule_y)
        c.setDash()

        c.setFillColor(brass)
        c.circle(center_x - 50.0, rule_y, 2.0, fill=1, stroke=0)
        c.circle(center_x + 50.0, rule_y, 2.0, fill=1, stroke=0)

        meta_y = m + 36.0
        c.setFont("Helvetica-Bold", 7.0)
        c.setFillColor(saddle_tan)
        c.drawCentredString(center_x, meta_y + 26.0, "ESTATE REGISTER")
        c.setFont("Times-Bold", 10.5)
        c.setFillColor(hunter_green)
        c.drawCentredString(center_x, meta_y + 12.0, author or "Estate Member")
        c.setFont("Times-Italic", 8.5)
        c.setFillColor(saddle_tan)
        c.drawCentredString(center_x, meta_y - 2.0, date_str or "Season Archive")
        if num_slides is not None:
            s_word = "slide" if num_slides == 1 else "slides"
            c.setFont("Times-Roman", 8.0)
            c.setFillColor(brass)
            c.drawCentredString(center_x, meta_y - 16.0, f"{num_slides} {s_word} registered")

    elif tpl in ("quantum_flat", "mecanica_cuantica_flat", "mecanica_cuantica_3_flat", "cuantica_flat", "cuantica3_flat", "mq3_flat", "atomic_flat"):
        # Scientific & Physics Notebooks — Flat 90s Minimalist: Mecánica Cuántica III
        # Theme: 90s Theoretical Physics Monograph (CUP / Princeton Preprint)
        c.setFillColor(Color(0.980, 0.976, 0.965, alpha=1.0))
        c.rect(0, 0, pw, ph, fill=1, stroke=0)

        m = 44.0
        x1 = left_gutter + m
        x2 = pw - right_gutter - m
        w = x2 - x1
        center_x = x1 + w / 2.0

        ink_dark = Color(0.12, 0.11, 0.29, alpha=1.0)     # Quantum Indigo #1e1b4b
        ink_violet = Color(0.43, 0.16, 0.85, alpha=1.0)   # Electric Violet #6d28d9
        ink_muted = Color(0.42, 0.45, 0.50, alpha=0.9)    # Slate Lavender #6b7280
        hairline = Color(0.12, 0.11, 0.29, alpha=0.25)

        # 1. Corner registration marks (90s technical lookbook)
        c.setStrokeColor(hairline)
        c.setLineWidth(0.5)
        for cx, cy in [(x1, ph - m), (x2, ph - m), (x1, m), (x2, m)]:
            c.circle(cx, cy, 3.5, stroke=1, fill=0)
            c.line(cx - 7.0, cy, cx + 7.0, cy)
            c.line(cx, cy - 7.0, cx, cy + 7.0)

        # 2. Outer hairline framing rule
        c.rect(x1, m, w, ph - 2 * m, stroke=1, fill=0)
        c.rect(x1 + 3.5, m + 3.5, w - 7.0, ph - 2 * m - 7.0, stroke=1, fill=0)

        # 3. Header band: Series stamp & fundamental eigenvalue equation
        head_y = ph - m - 22.0
        c.setFont("Courier-Bold", 8.0)
        c.setFillColor(ink_violet)
        c.drawString(x1 + 14.0, head_y, "[ PREPRINT QM-III // THEORETICAL & ATOMIC PHYSICS ]")
        c.setFont("Times-BoldItalic", 9.0)
        c.drawRightString(x2 - 14.0, head_y, "H |psi> = E |psi>  ·  L·S  ·  sigma_tot = (4pi/k) Im f(0)")

        c.setStrokeColor(hairline)
        c.setLineWidth(0.6)
        c.line(x1 + 14.0, head_y - 8.0, x2 - 14.0, head_y - 8.0)

        # 4. Title block
        disp_title = clean_title if clean_title != "Presentation" else "QUANTUM MECHANICS III"
        c.setFont("Helvetica-Bold", 26.0)
        c.setFillColor(ink_dark)
        lines = wrap_text_lines(disp_title, "Helvetica-Bold", 26.0, w - 28.0, c)
        cur_y = ph - m - 62.0
        for line in lines:
            c.drawString(x1 + 14.0, cur_y, line)
            cur_y -= 32.0

        disp_sub = subtitle or "Dirac Fine Structure · Hyperfine Interactions · Hartree-Fock · Collision Theory"
        c.setFont("Times-Italic", 11.5)
        c.setFillColor(ink_muted)
        c.drawString(x1 + 14.0, cur_y - 4.0, disp_sub)

        # 5. Scientific Vector Illustration: Quantum Harmonic Oscillator Well & Wavefunctions
        diag_cy = ph * 0.44
        diag_w = min(w * 0.78, 300.0)
        diag_x1 = center_x - diag_w / 2.0
        diag_x2 = center_x + diag_w / 2.0

        # Parabolic Potential Well V(x) = 1/2 m w^2 x^2
        c.setStrokeColor(hairline)
        c.setLineWidth(1.2)
        p_path = c.beginPath()
        steps = 40
        for s in range(steps + 1):
            t = (s / steps) * 2.0 - 1.0
            px = center_x + t * (diag_w * 0.42)
            py = diag_cy - 70.0 + (t ** 2) * 130.0
            if s == 0:
                p_path.moveTo(px, py)
            else:
                p_path.lineTo(px, py)
        c.drawPath(p_path, stroke=1, fill=0)

        # Quantized Energy Levels (n = 0, 1, 2, 3) and Eigen-wavefunctions psi_n(x)
        level_labels = ["E0 = (1/2) hbar omega", "E1 = (3/2) hbar omega", "E2 = (5/2) hbar omega", "E3 = (7/2) hbar omega"]
        for n in range(4):
            ly = diag_cy - 50.0 + n * 32.0
            lw = diag_w * (0.35 + n * 0.14)
            lx1 = center_x - lw / 2.0
            lx2 = center_x + lw / 2.0
            c.setStrokeColor(ink_muted)
            c.setLineWidth(0.5)
            c.line(lx1, ly, lx2, ly)

            c.setFont("Courier-Bold", 7.0)
            c.setFillColor(ink_violet)
            c.drawString(lx2 + 6.0, ly - 2.5, level_labels[n])

            # Wavefunction curve superimposed on level
            c.setStrokeColor(ink_violet)
            c.setLineWidth(1.0 if n == 0 or n == 1 else 0.7)
            w_path = c.beginPath()
            w_steps = 36
            for ws in range(w_steps + 1):
                wt = (ws / w_steps) * 2.0 - 1.0
                wx = center_x + wt * (lw * 0.46)
                envelope = math.exp(-2.5 * (wt ** 2))
                if n == 0:
                    amp = 14.0 * envelope
                elif n == 1:
                    amp = 16.0 * (wt * 2.0) * envelope
                elif n == 2:
                    amp = 14.0 * (4.0 * (wt ** 2) - 1.0) * envelope
                else:
                    amp = 14.0 * (8.0 * (wt ** 3) - 6.0 * wt) * 0.5 * envelope
                wy = ly + amp
                if ws == 0:
                    w_path.moveTo(wx, wy)
                else:
                    w_path.lineTo(wx, wy)
            c.drawPath(w_path, stroke=1, fill=0)

        # Measurement axis
        c.setStrokeColor(ink_dark)
        c.setLineWidth(0.8)
        c.line(diag_x1 + 10.0, diag_cy - 70.0, diag_x2 - 10.0, diag_cy - 70.0)
        c.setFont("Times-Italic", 8.0)
        c.setFillColor(ink_dark)
        c.drawCentredString(center_x, diag_cy - 82.0, "x (Position / Spatial Coordinate)")
        c.drawRightString(diag_x2 - 10.0, diag_cy - 82.0, "+inf")
        c.drawString(diag_x1 + 10.0, diag_cy - 82.0, "-inf")

        # 6. Lower Technical Metadata Grid
        meta_y = m + 28.0
        c.setStrokeColor(hairline)
        c.setLineWidth(0.6)
        c.line(x1 + 14.0, meta_y + 44.0, x2 - 14.0, meta_y + 44.0)

        c.setFont("Courier-Bold", 7.5)
        c.setFillColor(ink_violet)
        c.drawString(x1 + 14.0, meta_y + 30.0, "CURATOR / STUDENT")
        c.drawString(x1 + w * 0.42, meta_y + 30.0, "TERM / CONVOCATION")
        c.drawString(x1 + w * 0.75, meta_y + 30.0, "VOLUME / REF")

        c.setFont("Times-Bold", 10.0)
        c.setFillColor(ink_dark)
        c.drawString(x1 + 14.0, meta_y + 14.0, author or "Department of Theoretical Physics")
        c.drawString(x1 + w * 0.42, meta_y + 14.0, date_str or "Academic Semester")
        s_count = f"{num_slides} Slides" if num_slides else "Complete Dossier"
        c.drawString(x1 + w * 0.75, meta_y + 14.0, s_count)

    elif tpl in ("biophysics_flat", "biofisica_flat", "bio_flat", "alphafold_flat"):
        # Scientific & Physics Notebooks — Flat 90s Minimalist: Biofísica
        # Theme: 90s Molecular Biophysics Review (Cold Spring Harbor / Cambridge)
        c.setFillColor(Color(0.968, 0.980, 0.976, alpha=1.0))
        c.rect(0, 0, pw, ph, fill=1, stroke=0)

        m = 44.0
        x1 = left_gutter + m
        x2 = pw - right_gutter - m
        w = x2 - x1
        center_x = x1 + w / 2.0

        ink_dark = Color(0.02, 0.31, 0.23, alpha=1.0)     # Deep Forest Cyan #064e3b
        ink_teal = Color(0.05, 0.58, 0.53, alpha=1.0)     # Bright Teal #0d9488
        ink_muted = Color(0.39, 0.45, 0.55, alpha=0.9)    # Sage Slate #64748b
        hairline = Color(0.02, 0.31, 0.23, alpha=0.22)

        # 1. Corner registration marks
        c.setStrokeColor(hairline)
        c.setLineWidth(0.5)
        for cx, cy in [(x1, ph - m), (x2, ph - m), (x1, m), (x2, m)]:
            c.circle(cx, cy, 3.5, stroke=1, fill=0)
            c.line(cx - 7.0, cy, cx + 7.0, cy)
            c.line(cx, cy - 7.0, cx, cy + 7.0)

        # 2. Outer hairline framing rule
        c.rect(x1, m, w, ph - 2 * m, stroke=1, fill=0)
        c.rect(x1 + 3.5, m + 3.5, w - 7.0, ph - 2 * m - 7.0, stroke=1, fill=0)

        # 3. Header band: Series stamp & thermodynamic identity
        head_y = ph - m - 22.0
        c.setFont("Courier-Bold", 8.0)
        c.setFillColor(ink_teal)
        c.drawString(x1 + 14.0, head_y, "[ MOLECULAR BIOPHYSICS // MONOGRAPH DOSSIER ]")
        c.setFont("Times-BoldItalic", 9.0)
        c.drawRightString(x2 - 14.0, head_y, "Delta G = Delta H - T Delta S  ·  k_B T ln(K_eq)")

        c.setStrokeColor(hairline)
        c.setLineWidth(0.6)
        c.line(x1 + 14.0, head_y - 8.0, x2 - 14.0, head_y - 8.0)

        # 4. Title block
        disp_title = clean_title if clean_title != "Presentation" else "BIOPHYSICS"
        c.setFont("Helvetica-Bold", 26.0)
        c.setFillColor(ink_dark)
        lines = wrap_text_lines(disp_title, "Helvetica-Bold", 26.0, w - 28.0, c)
        cur_y = ph - m - 62.0
        for line in lines:
            c.drawString(x1 + 14.0, cur_y, line)
            cur_y -= 32.0

        disp_sub = subtitle or "Macromolecular Thermodynamics · Machine Learning · Turing Patterns · Hodgkin-Huxley"
        c.setFont("Times-Italic", 11.5)
        c.setFillColor(ink_muted)
        c.drawString(x1 + 14.0, cur_y - 4.0, disp_sub)

        # 5. Scientific Vector Illustration: Interlaced DNA Double Helix & Base Pair Ladder
        diag_cy = ph * 0.44
        helix_h = 160.0
        helix_w = 70.0
        helix_bot = diag_cy - helix_h / 2.0
        num_turns = 2.5
        rungs = 14

        # Draw rungs (base-pairs) connecting the two strands
        for r in range(rungs + 1):
            ry = helix_bot + (r / rungs) * helix_h
            phase = (r / rungs) * num_turns * 2.0 * math.pi
            rx1 = center_x + math.sin(phase) * (helix_w / 2.0)
            rx2 = center_x - math.sin(phase) * (helix_w / 2.0)
            c.setStrokeColor(ink_teal)
            c.setLineWidth(1.0)
            c.line(rx1, ry, rx2, ry)
            c.setFillColor(ink_dark)
            c.circle(rx1, ry, 2.0, fill=1, stroke=0)
            c.circle(rx2, ry, 2.0, fill=1, stroke=0)

        # Draw the two continuous backbone sinusoidal ribbons
        for strand in (0, 1):
            c.setStrokeColor(ink_dark if strand == 0 else ink_teal)
            c.setLineWidth(1.6)
            s_path = c.beginPath()
            s_pts = 60
            for sp in range(s_pts + 1):
                py = helix_bot + (sp / s_pts) * helix_h
                phase = (sp / s_pts) * num_turns * 2.0 * math.pi + (0 if strand == 0 else math.pi)
                px = center_x + math.sin(phase) * (helix_w / 2.0)
                if sp == 0:
                    s_path.moveTo(px, py)
                else:
                    s_path.lineTo(px, py)
            c.drawPath(s_path, stroke=1, fill=0)

        # Dimension scale annotation (10 Angstroms / 3.4 nm pitch)
        scale_x = center_x + helix_w / 2.0 + 28.0
        c.setStrokeColor(ink_muted)
        c.setLineWidth(0.6)
        c.line(scale_x, diag_cy - 40.0, scale_x, diag_cy + 40.0)
        c.line(scale_x - 3.0, diag_cy - 40.0, scale_x + 3.0, diag_cy - 40.0)
        c.line(scale_x - 3.0, diag_cy + 40.0, scale_x + 3.0, diag_cy + 40.0)
        c.setFont("Courier-Bold", 7.0)
        c.setFillColor(ink_muted)
        c.drawString(scale_x + 6.0, diag_cy - 2.5, "PITCH: 3.4 nm (10 bp)")

        # 6. Lower Technical Metadata Grid
        meta_y = m + 28.0
        c.setStrokeColor(hairline)
        c.setLineWidth(0.6)
        c.line(x1 + 14.0, meta_y + 44.0, x2 - 14.0, meta_y + 44.0)

        c.setFont("Courier-Bold", 7.5)
        c.setFillColor(ink_teal)
        c.drawString(x1 + 14.0, meta_y + 30.0, "INVESTIGATOR / STUDENT")
        c.drawString(x1 + w * 0.42, meta_y + 30.0, "REGISTRATION DATE")
        c.drawString(x1 + w * 0.75, meta_y + 30.0, "RECORD / FOLIOS")

        c.setFont("Times-Bold", 10.0)
        c.setFillColor(ink_dark)
        c.drawString(x1 + 14.0, meta_y + 14.0, author or "Laboratory of Biophysics")
        c.drawString(x1 + w * 0.42, meta_y + 14.0, date_str or "Research Archive")
        s_count = f"{num_slides} Slides" if num_slides else "Complete Dossier"
        c.drawString(x1 + w * 0.75, meta_y + 14.0, s_count)

    elif tpl in ("complex_systems_flat", "sistemas_complejos_flat", "chaos_flat", "atmospheric_flat", "atmosferica_flat"):
        # Scientific & Physics Notebooks — Flat 90s Minimalist: Física de los Sistemas Complejos
        # Theme: Santa Fe Institute / 1990s Nonlinear Dynamics & Chaos Monograph
        c.setFillColor(Color(0.972, 0.980, 0.988, alpha=1.0))
        c.rect(0, 0, pw, ph, fill=1, stroke=0)

        m = 44.0
        x1 = left_gutter + m
        x2 = pw - right_gutter - m
        w = x2 - x1
        center_x = x1 + w / 2.0

        ink_dark = Color(0.06, 0.09, 0.16, alpha=1.0)     # Obsidian Slate #0f172a
        ink_amber = Color(0.85, 0.47, 0.02, alpha=1.0)    # Electric Amber #d97706
        ink_muted = Color(0.39, 0.45, 0.55, alpha=0.9)    # Storm Slate #64748b
        hairline = Color(0.06, 0.09, 0.16, alpha=0.22)

        # 1. Corner registration marks
        c.setStrokeColor(hairline)
        c.setLineWidth(0.5)
        for cx, cy in [(x1, ph - m), (x2, ph - m), (x1, m), (x2, m)]:
            c.circle(cx, cy, 3.5, stroke=1, fill=0)
            c.line(cx - 7.0, cy, cx + 7.0, cy)
            c.line(cx, cy - 7.0, cx, cy + 7.0)

        # 2. Outer hairline framing rule
        c.rect(x1, m, w, ph - 2 * m, stroke=1, fill=0)
        c.rect(x1 + 3.5, m + 3.5, w - 7.0, ph - 2 * m - 7.0, stroke=1, fill=0)

        # 3. Header band: Series stamp & Lorenz differential equations
        head_y = ph - m - 22.0
        c.setFont("Courier-Bold", 8.0)
        c.setFillColor(ink_amber)
        c.drawString(x1 + 14.0, head_y, "[ NONLINEAR DYNAMICS // COMPLEX SYSTEMS & CHAOS ]")
        c.setFont("Times-BoldItalic", 9.0)
        c.drawRightString(x2 - 14.0, head_y, "dx/dt = sigma(y-x) · dy/dt = x(rho-z)-y · dz/dt = xy-beta z")

        c.setStrokeColor(hairline)
        c.setLineWidth(0.6)
        c.line(x1 + 14.0, head_y - 8.0, x2 - 14.0, head_y - 8.0)

        # 4. Title block
        disp_title = clean_title if clean_title != "Presentation" else "PHYSICS OF COMPLEX SYSTEMS"
        c.setFont("Helvetica-Bold", 24.0)
        c.setFillColor(ink_dark)
        lines = wrap_text_lines(disp_title, "Helvetica-Bold", 24.0, w - 28.0, c)
        cur_y = ph - m - 62.0
        for line in lines:
            c.drawString(x1 + 14.0, cur_y, line)
            cur_y -= 30.0

        disp_sub = subtitle or "Nonlinear Dynamics · Lorenz Strange Attractor · Complex Networks · Criticality"
        c.setFont("Times-Italic", 11.5)
        c.setFillColor(ink_muted)
        c.drawString(x1 + 14.0, cur_y - 4.0, disp_sub)

        # 5. Scientific Vector Illustration: Lorenz Strange Attractor Butterfly Orbits
        diag_cy = ph * 0.44
        c.setStrokeColor(hairline)
        c.setLineWidth(0.5)
        c.line(center_x - 120.0, diag_cy, center_x + 120.0, diag_cy)
        c.line(center_x, diag_cy - 70.0, center_x, diag_cy + 75.0)
        c.setFont("Courier-Bold", 7.0)
        c.setFillColor(ink_muted)
        c.drawString(center_x + 122.0, diag_cy - 2.5, "X")
        c.drawString(center_x - 3.0, diag_cy + 78.0, "Z")

        # Two butterfly lobes (Lorenz orbits)
        for loop in range(4):
            c.setStrokeColor(ink_amber if loop % 2 == 1 else ink_dark)
            c.setLineWidth(0.9 if loop == 3 else 0.6)
            radius_x = 42.0 + loop * 14.0
            radius_y = 35.0 + loop * 9.0
            center_lx = center_x - 48.0
            c.ellipse(center_lx - radius_x * 0.6, diag_cy - radius_y * 0.5,
                      center_lx + radius_x * 0.6, diag_cy + radius_y * 0.7)

        for loop in range(4):
            c.setStrokeColor(ink_amber if loop % 2 == 0 else ink_dark)
            c.setLineWidth(0.9 if loop == 3 else 0.6)
            radius_x = 42.0 + loop * 14.0
            radius_y = 35.0 + loop * 9.0
            center_rx = center_x + 48.0
            c.ellipse(center_rx - radius_x * 0.6, diag_cy - radius_y * 0.5,
                      center_rx + radius_x * 0.6, diag_cy + radius_y * 0.7)

        c.setFillColor(ink_amber)
        c.circle(center_x - 48.0, diag_cy + 5.0, 3.0, fill=1, stroke=0)
        c.circle(center_x + 48.0, diag_cy + 5.0, 3.0, fill=1, stroke=0)

        c.setFont("Courier-Bold", 7.5)
        c.setFillColor(ink_muted)
        c.drawCentredString(center_x, diag_cy - 68.0, "LORENZ (1963) · sigma = 10.0 · rho = 28.0 · beta = 8/3 · DIM = 2.06")

        # 6. Lower Technical Metadata Grid
        meta_y = m + 28.0
        c.setStrokeColor(hairline)
        c.setLineWidth(0.6)
        c.line(x1 + 14.0, meta_y + 44.0, x2 - 14.0, meta_y + 44.0)

        c.setFont("Courier-Bold", 7.5)
        c.setFillColor(ink_amber)
        c.drawString(x1 + 14.0, meta_y + 30.0, "OPERATOR / INVESTIGATOR")
        c.drawString(x1 + w * 0.42, meta_y + 30.0, "DATE / ARCHIVE")
        c.drawString(x1 + w * 0.75, meta_y + 30.0, "SLIDES / RECORD")

        c.setFont("Times-Bold", 10.0)
        c.setFillColor(ink_dark)
        c.drawString(x1 + 14.0, meta_y + 14.0, author or "Complex Systems Group")
        c.drawString(x1 + w * 0.42, meta_y + 14.0, date_str or "Chaos Dynamics Archive")
        s_count = f"{num_slides} Slides" if num_slides else "Theoretical Monograph"
        c.drawString(x1 + w * 0.75, meta_y + 14.0, s_count)

    elif tpl in ("materials_sim_flat", "simulacion_materiales_flat", "simulacion_fisica_materiales_flat", "fortran_flat", "materiales_flat"):
        # Scientific & Physics Notebooks — Flat 90s Minimalist: Simulación en Física de Materiales
        # Theme: 90s High Performance Computing / Fortran Materials Simulation
        c.setFillColor(Color(0.965, 0.973, 0.965, alpha=1.0))
        c.rect(0, 0, pw, ph, fill=1, stroke=0)

        m = 44.0
        x1 = left_gutter + m
        x2 = pw - right_gutter - m
        w = x2 - x1
        center_x = x1 + w / 2.0

        ink_dark = Color(0.09, 0.09, 0.11, alpha=1.0)     # Mainframe Charcoal #18181b
        ink_green = Color(0.08, 0.50, 0.24, alpha=1.0)    # Phosphor Green #15803d
        ink_muted = Color(0.44, 0.44, 0.48, alpha=0.9)    # Terminal Steel #71717a
        hairline = Color(0.09, 0.09, 0.11, alpha=0.22)

        # 1. Corner registration marks
        c.setStrokeColor(hairline)
        c.setLineWidth(0.5)
        for cx, cy in [(x1, ph - m), (x2, ph - m), (x1, m), (x2, m)]:
            c.circle(cx, cy, 3.5, stroke=1, fill=0)
            c.line(cx - 7.0, cy, cx + 7.0, cy)
            c.line(cx, cy - 7.0, cx, cy + 7.0)

        # 2. Outer hairline framing rule
        c.rect(x1, m, w, ph - 2 * m, stroke=1, fill=0)
        c.rect(x1 + 3.5, m + 3.5, w - 7.0, ph - 2 * m - 7.0, stroke=1, fill=0)

        # 3. Header band: Series stamp & interatomic force formula
        head_y = ph - m - 22.0
        c.setFont("Courier-Bold", 8.0)
        c.setFillColor(ink_green)
        c.drawString(x1 + 14.0, head_y, "[ HPC SIMULATION // COMPUTATIONAL MATERIALS & MOLECULAR DYNAMICS ]")
        c.setFont("Times-BoldItalic", 9.0)
        c.drawRightString(x2 - 14.0, head_y, "F_i = -grad_i V(r_ij)  ·  dt = 1.0 fs  ·  D = (1/6) lim d<dr^2>/dt")

        c.setStrokeColor(hairline)
        c.setLineWidth(0.6)
        c.line(x1 + 14.0, head_y - 8.0, x2 - 14.0, head_y - 8.0)

        # 4. Title block
        disp_title = clean_title if clean_title != "Presentation" else "MATERIALS PHYSICS SIMULATION"
        c.setFont("Helvetica-Bold", 23.0)
        c.setFillColor(ink_dark)
        lines = wrap_text_lines(disp_title, "Helvetica-Bold", 23.0, w - 28.0, c)
        cur_y = ph - m - 62.0
        for line in lines:
            c.drawString(x1 + 14.0, cur_y, line)
            cur_y -= 29.0

        disp_sub = subtitle or "Molecular Dynamics · Monte Carlo & Metropolis · Lennard-Jones · Transport"
        c.setFont("Times-Italic", 11.5)
        c.setFillColor(ink_muted)
        c.drawString(x1 + 14.0, cur_y - 4.0, disp_sub)

        # 5. Scientific Vector Illustration: 3D Isometric FCC Unit Cell & Lattice Vectors
        diag_cy = ph * 0.44
        box_s = 60.0
        vx = (box_s * 0.866, box_s * 0.5)
        vy = (-box_s * 0.866, box_s * 0.5)
        vz = (0.0, box_s)

        c.setStrokeColor(ink_muted)
        c.setLineWidth(0.7)
        corners = []
        for dx in (0, 1):
            for dy in (0, 1):
                for dz in (0, 1):
                    px = center_x + dx * vx[0] + dy * vy[0] + dz * vz[0] - (vx[0] + vy[0]) / 2.0
                    py = diag_cy - 40.0 + dx * vx[1] + dy * vy[1] + dz * vz[1] - (vx[1] + vy[1] + vz[1]) / 2.0
                    corners.append((px, py))

        cube_edges = [
            (0, 1), (0, 2), (1, 3), (2, 3),
            (4, 5), (4, 6), (5, 7), (6, 7),
            (0, 4), (1, 5), (2, 6), (3, 7),
        ]
        for i1, i2 in cube_edges:
            c.line(corners[i1][0], corners[i1][1], corners[i2][0], corners[i2][1])

        c.setFillColor(ink_dark)
        for px, py in corners:
            c.circle(px, py, 3.5, fill=1, stroke=0)

        face_centers = [
            ((corners[0][0] + corners[3][0]) / 2.0, (corners[0][1] + corners[3][1]) / 2.0),
            ((corners[4][0] + corners[7][0]) / 2.0, (corners[4][1] + corners[7][1]) / 2.0),
            ((corners[0][0] + corners[5][0]) / 2.0, (corners[0][1] + corners[5][1]) / 2.0),
            ((corners[2][0] + corners[7][0]) / 2.0, (corners[2][1] + corners[7][1]) / 2.0),
        ]
        c.setFillColor(ink_green)
        for fx, fy in face_centers:
            c.circle(fx, fy, 4.5, fill=1, stroke=0)

        c.setFont("Courier-Bold", 7.5)
        c.setFillColor(ink_green)
        c.drawCentredString(center_x, diag_cy - 72.0, "FCC CRYSTAL LATTICE · LENNARD-JONES · MPI FORTRAN 90")

        # 6. Lower Technical Metadata Grid
        meta_y = m + 28.0
        c.setStrokeColor(hairline)
        c.setLineWidth(0.6)
        c.line(x1 + 14.0, meta_y + 44.0, x2 - 14.0, meta_y + 44.0)

        c.setFont("Courier-Bold", 7.5)
        c.setFillColor(ink_green)
        c.drawString(x1 + 14.0, meta_y + 30.0, "PROGRAMMER / STUDENT")
        c.drawString(x1 + w * 0.42, meta_y + 30.0, "COMPILATION DATE")
        c.drawString(x1 + w * 0.75, meta_y + 30.0, "DATASET / SLIDES")

        c.setFont("Times-Bold", 10.0)
        c.setFillColor(ink_dark)
        c.drawString(x1 + 14.0, meta_y + 14.0, author or "Supercomputing & Materials Physics")
        c.drawString(x1 + w * 0.42, meta_y + 14.0, date_str or "Fortran 90 / HPC Archive")
        s_count = f"{num_slides} Slides" if num_slides else "Code & Monograph"
        c.drawString(x1 + w * 0.75, meta_y + 14.0, s_count)

    elif tpl in ("circuits_flat", "circuitos_flat", "instrumentacion_flat", "fundamentos_instrumentacion_flat", "electronica_flat"):
        # Scientific & Physics Notebooks — Flat 90s Minimalist: Fundamentos de Instrumentación Electrónica
        # Theme: 90s IEEE Laboratory Reference & Tektronix / HP Instrumentation Manual
        c.setFillColor(Color(0.988, 0.984, 0.976, alpha=1.0))
        c.rect(0, 0, pw, ph, fill=1, stroke=0)

        m = 44.0
        x1 = left_gutter + m
        x2 = pw - right_gutter - m
        w = x2 - x1
        center_x = x1 + w / 2.0

        ink_dark = Color(0.12, 0.16, 0.23, alpha=1.0)     # Instrument Slate #1e293b
        ink_green = Color(0.02, 0.47, 0.34, alpha=1.0)    # Circuit PCB Green #047857
        ink_muted = Color(0.39, 0.45, 0.55, alpha=0.9)    # Precision Gray #64748b
        hairline = Color(0.12, 0.16, 0.23, alpha=0.22)

        # 1. Corner registration marks
        c.setStrokeColor(hairline)
        c.setLineWidth(0.5)
        for cx, cy in [(x1, ph - m), (x2, ph - m), (x1, m), (x2, m)]:
            c.circle(cx, cy, 3.5, stroke=1, fill=0)
            c.line(cx - 7.0, cy, cx + 7.0, cy)
            c.line(cx, cy - 7.0, cx, cy + 7.0)

        # 2. Outer hairline framing rule
        c.rect(x1, m, w, ph - 2 * m, stroke=1, fill=0)
        c.rect(x1 + 3.5, m + 3.5, w - 7.0, ph - 2 * m - 7.0, stroke=1, fill=0)

        # 3. Header band: Series stamp & Op-Amp transfer equation
        head_y = ph - m - 22.0
        c.setFont("Courier-Bold", 8.0)
        c.setFillColor(ink_green)
        c.drawString(x1 + 14.0, head_y, "[ IEEE INSTRUMENTATION // ANALOG FRONT-END & DAQ ]")
        c.setFont("Times-BoldItalic", 9.0)
        c.drawRightString(x2 - 14.0, head_y, "V_out = -(R_f / R_in) V_in  ·  CMRR > 120 dB  ·  f_s >= 2 f_max")

        c.setStrokeColor(hairline)
        c.setLineWidth(0.6)
        c.line(x1 + 14.0, head_y - 8.0, x2 - 14.0, head_y - 8.0)

        # 4. Title block
        disp_title = clean_title if clean_title != "Presentation" else "FUNDAMENTALS OF ELECTRONIC INSTRUMENTATION"
        c.setFont("Helvetica-Bold", 22.0)
        c.setFillColor(ink_dark)
        lines = wrap_text_lines(disp_title, "Helvetica-Bold", 22.0, w - 28.0, c)
        cur_y = ph - m - 62.0
        for line in lines:
            c.drawString(x1 + 14.0, cur_y, line)
            cur_y -= 28.0

        disp_sub = subtitle or "Operational Amplifiers · Active Filter Design · ADC/DAC Conversion · DAQ & LabVIEW"
        c.setFont("Times-Italic", 11.0)
        c.setFillColor(ink_muted)
        c.drawString(x1 + 14.0, cur_y - 4.0, disp_sub)

        # 5. Scientific Vector Illustration: Op-Amp Inverting Amplifier Schematic & Test Waveform
        diag_cy = ph * 0.44
        c.setStrokeColor(ink_dark)
        c.setLineWidth(1.4)
        c.setFillColor(Color(0.95, 0.97, 0.95, alpha=1.0))
        tri_w = 60.0
        tri_h = 70.0
        tri_x = center_x - 10.0
        t_path = c.beginPath()
        t_path.moveTo(tri_x, diag_cy - tri_h / 2.0)
        t_path.lineTo(tri_x, diag_cy + tri_h / 2.0)
        t_path.lineTo(tri_x + tri_w, diag_cy)
        t_path.close()
        c.drawPath(t_path, fill=1, stroke=1)

        c.setFont("Helvetica-Bold", 10.0)
        c.setFillColor(ink_dark)
        c.drawString(tri_x + 6.0, diag_cy + 14.0, "-")
        c.drawString(tri_x + 6.0, diag_cy - 22.0, "+")

        c.setLineWidth(1.0)
        c.line(tri_x - 80.0, diag_cy + 18.0, tri_x - 50.0, diag_cy + 18.0)
        c.rect(tri_x - 50.0, diag_cy + 12.0, 26.0, 12.0, fill=0, stroke=1)
        c.setFont("Courier-Bold", 6.5)
        c.drawString(tri_x - 46.0, diag_cy + 27.0, "R_in")
        c.line(tri_x - 24.0, diag_cy + 18.0, tri_x, diag_cy + 18.0)

        c.line(tri_x - 12.0, diag_cy + 18.0, tri_x - 12.0, diag_cy + 52.0)
        c.line(tri_x - 12.0, diag_cy + 52.0, tri_x + 10.0, diag_cy + 52.0)
        c.rect(tri_x + 10.0, diag_cy + 46.0, 26.0, 12.0, fill=0, stroke=1)
        c.drawString(tri_x + 16.0, diag_cy + 61.0, "R_f")
        c.line(tri_x + 36.0, diag_cy + 52.0, tri_x + 75.0, diag_cy + 52.0)
        c.line(tri_x + 75.0, diag_cy + 52.0, tri_x + 75.0, diag_cy)

        c.line(tri_x, diag_cy - 18.0, tri_x - 24.0, diag_cy - 18.0)
        c.line(tri_x - 24.0, diag_cy - 18.0, tri_x - 24.0, diag_cy - 30.0)
        c.line(tri_x - 30.0, diag_cy - 30.0, tri_x - 18.0, diag_cy - 30.0)
        c.line(tri_x - 28.0, diag_cy - 33.0, tri_x - 20.0, diag_cy - 33.0)
        c.line(tri_x - 26.0, diag_cy - 36.0, tri_x - 22.0, diag_cy - 36.0)

        c.line(tri_x + tri_w, diag_cy, tri_x + tri_w + 35.0, diag_cy)
        c.circle(tri_x + tri_w + 35.0, diag_cy, 2.5, fill=1, stroke=0)
        c.drawString(tri_x + tri_w + 42.0, diag_cy - 3.0, "V_out")

        c.circle(tri_x - 80.0, diag_cy + 18.0, 2.5, fill=1, stroke=0)
        c.drawString(tri_x - 105.0, diag_cy + 15.0, "V_in")

        c.setFont("Courier-Bold", 7.5)
        c.setFillColor(ink_green)
        c.drawCentredString(center_x, diag_cy - 68.0, "ANALOG CIRCUITS · TEKTRONIX BENCH · LAB STANDARD")

        # 6. Lower Technical Metadata Grid
        meta_y = m + 28.0
        c.setStrokeColor(hairline)
        c.setLineWidth(0.6)
        c.line(x1 + 14.0, meta_y + 44.0, x2 - 14.0, meta_y + 44.0)

        c.setFont("Courier-Bold", 7.5)
        c.setFillColor(ink_green)
        c.drawString(x1 + 14.0, meta_y + 30.0, "ENGINEER / STUDENT")
        c.drawString(x1 + w * 0.42, meta_y + 30.0, "WORKBENCH / DATE")
        c.drawString(x1 + w * 0.75, meta_y + 30.0, "DOSSIER / SLIDES")

        c.setFont("Times-Bold", 10.0)
        c.setFillColor(ink_dark)
        c.drawString(x1 + 14.0, meta_y + 14.0, author or "Instrumentation Laboratory")
        c.drawString(x1 + w * 0.42, meta_y + 14.0, date_str or "Calibration & Test Bench")
        s_count = f"{num_slides} Slides" if num_slides else "Laboratory Manual"
        c.drawString(x1 + w * 0.75, meta_y + 14.0, s_count)

    elif tpl in ("solid_state_flat", "estado_solido_flat", "solido_flat", "condensed_matter_flat"):
        # Scientific & Physics Notebooks — Flat 90s Minimalist: Física del Estado Sólido
        # Theme: 90s Ashcroft & Mermin / Kittel Solid State Classic Editorial
        c.setFillColor(Color(0.984, 0.980, 0.969, alpha=1.0))
        c.rect(0, 0, pw, ph, fill=1, stroke=0)

        m = 44.0
        x1 = left_gutter + m
        x2 = pw - right_gutter - m
        w = x2 - x1
        center_x = x1 + w / 2.0

        ink_dark = Color(0.09, 0.15, 0.33, alpha=1.0)     # Prussian Cobalt #172554
        ink_copper = Color(0.71, 0.33, 0.04, alpha=1.0)   # Copper Bronze #b45309
        ink_muted = Color(0.39, 0.45, 0.55, alpha=0.9)    # Reciprocal Slate #64748b
        hairline = Color(0.09, 0.15, 0.33, alpha=0.22)

        # 1. Corner registration marks
        c.setStrokeColor(hairline)
        c.setLineWidth(0.5)
        for cx, cy in [(x1, ph - m), (x2, ph - m), (x1, m), (x2, m)]:
            c.circle(cx, cy, 3.5, stroke=1, fill=0)
            c.line(cx - 7.0, cy, cx + 7.0, cy)
            c.line(cx, cy - 7.0, cx, cy + 7.0)

        # 2. Outer hairline framing rule
        c.rect(x1, m, w, ph - 2 * m, stroke=1, fill=0)
        c.rect(x1 + 3.5, m + 3.5, w - 7.0, ph - 2 * m - 7.0, stroke=1, fill=0)

        # 3. Header band: Series stamp & Bloch wave theorem
        head_y = ph - m - 22.0
        c.setFont("Courier-Bold", 8.0)
        c.setFillColor(ink_copper)
        c.drawString(x1 + 14.0, head_y, "[ CONDENSED MATTER // SOLID STATE & BRILLOUIN ARCHIVE ]")
        c.setFont("Times-BoldItalic", 9.0)
        c.drawRightString(x2 - 14.0, head_y, "psi_k(r) = e^{ik·r} u_k(r)  ·  E_F = (hbar^2 k_F^2)/2m*  ·  Phi_0 = h/2e")

        c.setStrokeColor(hairline)
        c.setLineWidth(0.6)
        c.line(x1 + 14.0, head_y - 8.0, x2 - 14.0, head_y - 8.0)

        # 4. Title block
        disp_title = clean_title if clean_title != "Presentation" else "SOLID STATE PHYSICS"
        c.setFont("Helvetica-Bold", 26.0)
        c.setFillColor(ink_dark)
        lines = wrap_text_lines(disp_title, "Helvetica-Bold", 26.0, w - 28.0, c)
        cur_y = ph - m - 62.0
        for line in lines:
            c.drawString(x1 + 14.0, cur_y, line)
            cur_y -= 32.0

        disp_sub = subtitle or "Crystal Lattices & Reciprocal Space · Phonons · Bloch Bands · Superconductivity & BCS"
        c.setFont("Times-Italic", 11.5)
        c.setFillColor(ink_muted)
        c.drawString(x1 + 14.0, cur_y - 4.0, disp_sub)

        # 5. Scientific Vector Illustration: 1st Brillouin Zone Hexagon & Band Dispersion
        diag_cy = ph * 0.44
        hex_r = 55.0
        c.setStrokeColor(ink_dark)
        c.setLineWidth(1.2)
        h_path = c.beginPath()
        for i in range(6):
            ang = (i / 6.0) * 2.0 * math.pi
            hx = center_x + hex_r * math.cos(ang)
            hy = diag_cy + hex_r * math.sin(ang)
            if i == 0:
                h_path.moveTo(hx, hy)
            else:
                h_path.lineTo(hx, hy)
        h_path.close()
        c.drawPath(h_path, stroke=1, fill=0)

        # Reciprocal lattice vectors b1, b2
        c.setStrokeColor(ink_copper)
        c.setLineWidth(1.0)
        c.line(center_x, diag_cy, center_x + hex_r * 0.9, diag_cy)
        c.line(center_x, diag_cy, center_x + hex_r * 0.45, diag_cy + hex_r * 0.78)

        # Symmetry points: Gamma, K, M
        c.setFillColor(ink_dark)
        c.circle(center_x, diag_cy, 2.5, fill=1, stroke=0)
        c.setFont("Times-BoldItalic", 9.0)
        c.drawString(center_x - 12.0, diag_cy - 2.0, "G")
        c.circle(center_x + hex_r, diag_cy, 2.0, fill=1, stroke=0)
        c.drawString(center_x + hex_r + 4.0, diag_cy - 3.0, "K")
        c.circle(center_x + hex_r * 0.866 * math.cos(math.pi / 6), diag_cy + hex_r * 0.866 * math.sin(math.pi / 6), 2.0, fill=1, stroke=0)
        c.drawString(center_x + hex_r * 0.866 * math.cos(math.pi / 6) + 4.0, diag_cy + hex_r * 0.866 * math.sin(math.pi / 6) + 2.0, "M")

        # Fermi surface contour circle
        c.setStrokeColor(ink_copper)
        c.setLineWidth(0.8)
        c.circle(center_x, diag_cy, hex_r * 0.62, stroke=1, fill=0)

        c.setFont("Courier-Bold", 7.5)
        c.setFillColor(ink_copper)
        c.drawCentredString(center_x, diag_cy - 72.0, "RECIPROCAL SPACE · 1ST BRILLOUIN ZONE · FERMI SPHERE")

        # 6. Lower Technical Metadata Grid
        meta_y = m + 28.0
        c.setStrokeColor(hairline)
        c.setLineWidth(0.6)
        c.line(x1 + 14.0, meta_y + 44.0, x2 - 14.0, meta_y + 44.0)

        c.setFont("Courier-Bold", 7.5)
        c.setFillColor(ink_copper)
        c.drawString(x1 + 14.0, meta_y + 30.0, "PROFESSOR / STUDENT")
        c.drawString(x1 + w * 0.42, meta_y + 30.0, "TERM / ACADEMIC YEAR")
        c.drawString(x1 + w * 0.75, meta_y + 30.0, "VOLUME / FOLIOS")

        c.setFont("Times-Bold", 10.0)
        c.setFillColor(ink_dark)
        c.drawString(x1 + 14.0, meta_y + 14.0, author or "Department of Condensed Matter")
        c.drawString(x1 + w * 0.42, meta_y + 14.0, date_str or "Academic Session")
        s_count = f"{num_slides} Slides" if num_slides else "Theoretical Monograph"
        c.drawString(x1 + w * 0.75, meta_y + 14.0, s_count)

    elif tpl in ("nuclear_flat", "particulas_flat", "nuclear_particles_flat", "particle_physics_flat"):
        # Scientific & Physics Notebooks — Flat 90s Minimalist: Física Nuclear y de Partículas
        # Theme: 90s CERN / SLAC / Particle Data Group (PDG) Monograph
        c.setFillColor(Color(0.980, 0.980, 0.976, alpha=1.0))
        c.rect(0, 0, pw, ph, fill=1, stroke=0)

        m = 44.0
        x1 = left_gutter + m
        x2 = pw - right_gutter - m
        w = x2 - x1
        center_x = x1 + w / 2.0

        ink_dark = Color(0.06, 0.09, 0.16, alpha=1.0)     # Collider Obsidian #0f172a
        ink_violet = Color(0.39, 0.40, 0.95, alpha=1.0)   # High-Energy Violet #6366f1
        ink_muted = Color(0.39, 0.45, 0.55, alpha=0.9)    # Detector Slate #64748b
        hairline = Color(0.06, 0.09, 0.16, alpha=0.22)

        # 1. Corner registration marks
        c.setStrokeColor(hairline)
        c.setLineWidth(0.5)
        for cx, cy in [(x1, ph - m), (x2, ph - m), (x1, m), (x2, m)]:
            c.circle(cx, cy, 3.5, stroke=1, fill=0)
            c.line(cx - 7.0, cy, cx + 7.0, cy)
            c.line(cx, cy - 7.0, cx, cy + 7.0)

        # 2. Outer hairline framing rule
        c.rect(x1, m, w, ph - 2 * m, stroke=1, fill=0)
        c.rect(x1 + 3.5, m + 3.5, w - 7.0, ph - 2 * m - 7.0, stroke=1, fill=0)

        # 3. Header band: Series stamp & Standard Model gauge group
        head_y = ph - m - 22.0
        c.setFont("Courier-Bold", 8.0)
        c.setFillColor(ink_violet)
        c.drawString(x1 + 14.0, head_y, "[ HIGH ENERGY PHYSICS // CERN-SLAC COLLIDER ARCHIVE ]")
        c.setFont("Times-BoldItalic", 9.0)
        c.drawRightString(x2 - 14.0, head_y, "SU(3)_C x SU(2)_L x U(1)_Y  ·  B(A,Z)  ·  sqrt(s) = 14 TeV")

        c.setStrokeColor(hairline)
        c.setLineWidth(0.6)
        c.line(x1 + 14.0, head_y - 8.0, x2 - 14.0, head_y - 8.0)

        # 4. Title block
        disp_title = clean_title if clean_title != "Presentation" else "NUCLEAR & PARTICLE PHYSICS"
        c.setFont("Helvetica-Bold", 23.0)
        c.setFillColor(ink_dark)
        lines = wrap_text_lines(disp_title, "Helvetica-Bold", 23.0, w - 28.0, c)
        cur_y = ph - m - 62.0
        for line in lines:
            c.drawString(x1 + 14.0, cur_y, line)
            cur_y -= 29.0

        disp_sub = subtitle or "Nuclear Shell Model · Radioactive Decay · Quark Model & QCD · Electroweak Model"
        c.setFont("Times-Italic", 11.5)
        c.setFillColor(ink_muted)
        c.drawString(x1 + 14.0, cur_y - 4.0, disp_sub)

        # 5. Scientific Vector Illustration: e+ e- -> Z0/gamma* -> q qbar Feynman Diagram
        diag_cy = ph * 0.44
        v1_x = center_x - 30.0
        v2_x = center_x + 30.0

        # Incoming electron (e-) and positron (e+)
        c.setStrokeColor(ink_dark)
        c.setLineWidth(1.2)
        c.line(v1_x - 60.0, diag_cy + 40.0, v1_x, diag_cy)
        c.line(v1_x - 60.0, diag_cy - 40.0, v1_x, diag_cy)
        c.setFont("Times-Italic", 9.0)
        c.drawString(v1_x - 72.0, diag_cy + 38.0, "e-")
        c.drawString(v1_x - 72.0, diag_cy - 42.0, "e+")

        # Gauge boson propagator (Z0 / gamma*) wavy line
        c.setStrokeColor(ink_violet)
        c.setLineWidth(1.4)
        w_path = c.beginPath()
        w_steps = 24
        for ws in range(w_steps + 1):
            wx = v1_x + (ws / w_steps) * (v2_x - v1_x)
            wy = diag_cy + 5.0 * math.sin((ws / w_steps) * 4.0 * math.pi)
            if ws == 0:
                w_path.moveTo(wx, wy)
            else:
                w_path.lineTo(wx, wy)
        c.drawPath(w_path, stroke=1, fill=0)
        c.setFont("Courier-Bold", 7.5)
        c.setFillColor(ink_violet)
        c.drawCentredString(center_x, diag_cy + 10.0, "gamma* / Z0")

        # Outgoing quarks (q, q-bar)
        c.setStrokeColor(ink_dark)
        c.setLineWidth(1.2)
        c.line(v2_x, diag_cy, v2_x + 60.0, diag_cy + 40.0)
        c.line(v2_x, diag_cy, v2_x + 60.0, diag_cy - 40.0)
        c.setFont("Times-Italic", 9.0)
        c.drawString(v2_x + 66.0, diag_cy + 38.0, "q")
        c.drawString(v2_x + 66.0, diag_cy - 42.0, "q_bar")

        # Vertex interaction nodes
        c.setFillColor(ink_dark)
        c.circle(v1_x, diag_cy, 3.0, fill=1, stroke=0)
        c.circle(v2_x, diag_cy, 3.0, fill=1, stroke=0)

        # Concentric detector drift chamber arcs
        c.setStrokeColor(hairline)
        c.setLineWidth(0.5)
        c.arc(center_x - 85.0, diag_cy - 85.0, center_x + 85.0, diag_cy + 85.0, 30, 60)
        c.arc(center_x - 85.0, diag_cy - 85.0, center_x + 85.0, diag_cy + 85.0, 210, 60)

        # Stamp box
        c.setFont("Courier-Bold", 7.5)
        c.setFillColor(ink_violet)
        c.drawCentredString(center_x, diag_cy - 68.0, "ELECTROWEAK ANNIHILATION · FEYNMAN DIAGRAM · 4pi DETECTOR")

        # 6. Lower Technical Metadata Grid
        meta_y = m + 28.0
        c.setStrokeColor(hairline)
        c.setLineWidth(0.6)
        c.line(x1 + 14.0, meta_y + 44.0, x2 - 14.0, meta_y + 44.0)

        c.setFont("Courier-Bold", 7.5)
        c.setFillColor(ink_violet)
        c.drawString(x1 + 14.0, meta_y + 30.0, "PHYSICIST / RESEARCHER")
        c.drawString(x1 + w * 0.42, meta_y + 30.0, "COLLABORATION / DATE")
        c.drawString(x1 + w * 0.75, meta_y + 30.0, "ARCHIVE / SLIDES")

        c.setFont("Times-Bold", 10.0)
        c.setFillColor(ink_dark)
        c.drawString(x1 + 14.0, meta_y + 14.0, author or "High-Energy Physics Collaboration")
        c.drawString(x1 + w * 0.42, meta_y + 14.0, date_str or "Research Preprint Archive")
        s_count = f"{num_slides} Slides" if num_slides else "Particle Physics Monograph"
        c.drawString(x1 + w * 0.75, meta_y + 14.0, s_count)

    elif tpl in ("composition", "compbook", "composition_book", "comp_classic", "marble_bw", "cuaderno", "compo",
                 "comp_blue", "comp_ocean", "comp_wave", "academic_wave", "suminagashi", "ocean_wave", "academic_navy", "academic_burgundy",
                 "comp_coral", "comp_terracotta", "comp_slate", "academic_teal", "ebru", "bubble", "academic_ebru", "academic_stone", "academic_blue",
                 "comp_amber", "comp_gold", "comp_onyx", "academic_green", "academic", "peacock", "florentine", "academic_peacock", "academic_yellow",
                 "comp_morris", "morris", "strawberry_thief", "william_morris", "botanical",
                 "comp_ukiyoe", "ukiyoe", "japanese", "sakura", "woodblock",
                 "comp_flora", "flora", "still_life", "dutch_flora", "bouquet", "baroque_flora",
                 "comp_pastoral", "pastoral", "landscape", "oil_landscape", "romantic_landscape",
                 "comp_marbled", "marbled", "florentine_stone", "ebru_stone",
                 "biophysics_ml", "biophysics", "biofisica", "biofisica_ml", "alphafold", "neural_bio",
                 "atmospheric_chaos", "atmospheric", "atmosferica", "complex_systems", "sistemas_complejos", "chaos", "lorenz",
                 "fortran_materials", "fortran", "materiales", "materials_sim", "computational_materials", "f77", "f90",
                 "nuclear_particles", "nuclear", "particulas", "particle_physics", "cern", "lhc", "feynman",
                 "solid_state", "estado_solido", "solido", "condensed_matter", "brillouin", "fermi_surface",
                 "atomic_physics", "atomic", "atomica", "quantum_atomic", "spectroscopy", "rydberg",
                 "circuits_instrumentation", "circuits", "instrumentacion", "opamps", "electronica", "filters", "adc_dac"):
        asset_key = "composition"
        spine_color = Color(0.08, 0.08, 0.09, alpha=1.0)
        seam_color = Color(0.20, 0.20, 0.22, alpha=1.0)
        fallback_bg = Color(0.11, 0.11, 0.12, alpha=1.0)
        book_title = "COMPOSITION BOOK"
        edition_tag = "Archival Edition"

        if any(k in tpl for k in ("biophysics", "biofisica", "alphafold", "neural_bio")):
            asset_key = "science_biophysics"
            spine_color = Color(0.04, 0.12, 0.16, alpha=1.0)  # Bioluminescent Marine #0a1f29
            seam_color = Color(0.10, 0.32, 0.38, alpha=1.0)   # Cyan Accent #1a5261
            fallback_bg = Color(0.06, 0.15, 0.20, alpha=1.0)
            book_title = "BIOPHYSICS"
            edition_tag = "Biophysics Dossier · Molecular Dynamics"
        elif any(k in tpl for k in ("atmospheric", "atmosferica", "complex_systems", "sistemas_complejos", "chaos", "lorenz")):
            asset_key = "science_atmospheric"
            spine_color = Color(0.07, 0.11, 0.18, alpha=1.0)  # Deep Storm Navy #121c2e
            seam_color = Color(0.18, 0.28, 0.40, alpha=1.0)   # Storm Slate #2e4766
            fallback_bg = Color(0.09, 0.14, 0.22, alpha=1.0)
            book_title = "PHYSICS OF COMPLEX SYSTEMS"
            edition_tag = "Nonlinear Dynamics & Complex Systems Archive"
        elif any(k in tpl for k in ("fortran", "materiales", "materials_sim", "computational_materials", "simulacion_materiales", "simulacion_fisica_materiales", "f77", "f90")):
            asset_key = "science_fortran"
            spine_color = Color(0.08, 0.11, 0.09, alpha=1.0)  # Mainframe Dark Phosphor Charcoal #141c17
            seam_color = Color(0.18, 0.28, 0.20, alpha=1.0)   # Terminal Green #2e4733
            fallback_bg = Color(0.10, 0.14, 0.11, alpha=1.0)
            book_title = "MATERIALS PHYSICS SIMULATION"
            edition_tag = "Materials Simulation Archive · Computational Physics"
        elif any(k in tpl for k in ("nuclear", "particulas", "particle_physics", "cern", "lhc", "feynman")):
            asset_key = "science_nuclear"
            spine_color = Color(0.08, 0.06, 0.12, alpha=1.0)  # Deep Cosmic Obsidian #140f1f
            seam_color = Color(0.25, 0.18, 0.34, alpha=1.0)   # Collider Violet #402e57
            fallback_bg = Color(0.09, 0.07, 0.14, alpha=1.0)
            book_title = "NUCLEAR & PARTICLE PHYSICS"
            edition_tag = "High-Energy Physics Compendium"
        elif any(k in tpl for k in ("solid_state", "estado_solido", "solido", "condensed_matter", "brillouin", "fermi_surface")):
            asset_key = "science_solid_state"
            spine_color = Color(0.07, 0.11, 0.16, alpha=1.0)  # Cobalt Steel #121c29
            seam_color = Color(0.20, 0.28, 0.38, alpha=1.0)   # Reciprocal K-space Slate #334761
            fallback_bg = Color(0.09, 0.14, 0.20, alpha=1.0)
            book_title = "SOLID STATE PHYSICS"
            edition_tag = "Condensed Matter Laboratory Log"
        elif any(k in tpl for k in ("atomic", "atomica", "quantum_atomic", "spectroscopy", "rydberg", "mecanica_cuantica", "cuantica", "quantum")):
            asset_key = "science_atomic"
            spine_color = Color(0.10, 0.05, 0.14, alpha=1.0)  # Deep Quantum Violet #1a0d24
            seam_color = Color(0.28, 0.17, 0.38, alpha=1.0)   # Spectroscopy Plum #472b61
            fallback_bg = Color(0.12, 0.07, 0.17, alpha=1.0)
            book_title = "QUANTUM MECHANICS III"
            edition_tag = "Quantum Mechanics III · Spectroscopy Register"
        elif any(k in tpl for k in ("circuits", "instrumentacion", "fundamentos_instrumentacion", "opamps", "electronica", "filters", "adc_dac")):
            asset_key = "science_circuits"
            spine_color = Color(0.05, 0.12, 0.08, alpha=1.0)  # Dark PCB Solder Mask #0d1f14
            seam_color = Color(0.16, 0.32, 0.22, alpha=1.0)   # Circuit Copper Green #295238
            fallback_bg = Color(0.07, 0.14, 0.10, alpha=1.0)
            book_title = "FUNDAMENTALS OF ELECTRONIC INSTRUMENTATION"
            edition_tag = "Electronic Instrumentation & Laboratory Dossier"
        elif any(k in tpl for k in ("morris", "strawberry", "botanical")):
            asset_key = "comp_morris"
            spine_color = Color(0.07, 0.12, 0.21, alpha=1.0)  # Deep Victorian Indigo #122036
            seam_color = Color(0.18, 0.23, 0.31, alpha=1.0)   # #2d3b50
            fallback_bg = Color(0.11, 0.20, 0.31, alpha=1.0)  # #1d334e
        elif any(k in tpl for k in ("ukiyoe", "japanese", "sakura", "woodblock")):
            asset_key = "comp_ukiyoe"
            spine_color = Color(0.45, 0.11, 0.09, alpha=1.0)  # Lacquer Vermilion #731c18
            seam_color = Color(0.61, 0.20, 0.17, alpha=1.0)   # #9c342b
            fallback_bg = Color(0.20, 0.32, 0.28, alpha=1.0)  # #335248
        elif any(k in tpl for k in ("flora", "bouquet", "still_life")):
            asset_key = "comp_flora"
            spine_color = Color(0.06, 0.06, 0.07, alpha=1.0)  # Velvet Black / Charcoal #101012
            seam_color = Color(0.22, 0.20, 0.15, alpha=1.0)   # Dark bronze gold #383226
            fallback_bg = Color(0.07, 0.07, 0.07, alpha=1.0)  # #111113
        elif any(k in tpl for k in ("pastoral", "landscape")):
            asset_key = "comp_pastoral"
            spine_color = Color(0.18, 0.13, 0.09, alpha=1.0)  # Dark Walnut Leather #2e2218
            seam_color = Color(0.30, 0.23, 0.17, alpha=1.0)   # #4d3a2b
            fallback_bg = Color(0.28, 0.24, 0.16, alpha=1.0)  # #473d2a
        elif any(k in tpl for k in ("marbled", "florentine_stone")):
            asset_key = "comp_marbled"
            spine_color = Color(0.30, 0.08, 0.11, alpha=1.0)  # Deep Burgundy Wine #4c141d
            seam_color = Color(0.44, 0.15, 0.18, alpha=1.0)   # #70252e
            fallback_bg = Color(0.48, 0.20, 0.14, alpha=1.0)  # #7a3424
        elif any(k in tpl for k in ("blue", "wave", "ocean", "suminagashi", "navy")):
            asset_key = "comp_blue"
            spine_color = Color(0.05, 0.12, 0.20, alpha=1.0)
            seam_color = Color(0.14, 0.24, 0.38, alpha=1.0)
            fallback_bg = Color(0.11, 0.20, 0.32, alpha=1.0)
        elif any(k in tpl for k in ("coral", "terracotta", "slate", "teal", "ebru", "bubble", "stone")):
            asset_key = "comp_coral"
            spine_color = Color(0.11, 0.16, 0.16, alpha=1.0)
            seam_color = Color(0.20, 0.28, 0.28, alpha=1.0)
            fallback_bg = Color(0.78, 0.41, 0.29, alpha=1.0)
        elif any(k in tpl for k in ("amber", "gold", "onyx", "green", "peacock", "florentine", "academic")):
            asset_key = "comp_amber"
            spine_color = Color(0.14, 0.08, 0.05, alpha=1.0)
            seam_color = Color(0.27, 0.17, 0.11, alpha=1.0)
            fallback_bg = Color(0.59, 0.38, 0.16, alpha=1.0)

        # 1. Capa Fondo (Full-bleed texture)
        tex_path = _get_cover_texture_path(asset_key)
        if tex_path:
            c.drawImage(tex_path, 0, 0, width=pw, height=ph, preserveAspectRatio=False)
        else:
            c.setFillColor(fallback_bg)
            c.rect(0, 0, pw, ph, fill=1, stroke=0)

        # 2. Capa Lomo (Harmonized spine on binding edge)
        base_spine_w = max(pw * 0.145, 68.0)
        spine_w = (right_gutter + base_spine_w) if is_verso else (left_gutter + base_spine_w)
        spine_x = (pw - spine_w) if is_verso else 0.0

        c.setFillColor(spine_color)
        c.rect(spine_x, 0, spine_w, ph, fill=1, stroke=0)

        seam_x = (pw - spine_w) if is_verso else spine_w
        c.setStrokeColor(seam_color)
        c.setLineWidth(1.4)
        c.line(seam_x, 0, seam_x, ph)

        # 3. Capa Etiqueta (Centered badge with vector borders and ruled lines)
        visible_x1 = 0.0 if is_verso else spine_w
        visible_x2 = (pw - spine_w) if is_verso else pw
        visible_w = visible_x2 - visible_x1
        visible_center_x = (visible_x1 + visible_x2) / 2.0

        badge_w = min(visible_w * 0.72, 330.0)
        badge_h = 178.0
        badge_x = visible_center_x - badge_w / 2.0
        badge_y = ph * 0.60

        is_bw = (asset_key == "composition")

        if is_bw:
            # Blanco puro para portadas en blanco y negro (Composition clásica)
            badge_bg = Color(1.0, 1.0, 1.0, alpha=1.0)
            outer_stroke = Color(0.08, 0.08, 0.09, alpha=1.0)
            inner_stroke = Color(0.13, 0.13, 0.14, alpha=1.0)
            line_stroke = Color(0.47, 0.47, 0.50, alpha=0.55)
            text_head_color = Color(0.08, 0.08, 0.10, alpha=1.0)
            text_title_color = Color(0.10, 0.10, 0.12, alpha=1.0)
            text_sub_color = Color(0.25, 0.25, 0.28, alpha=1.0)
            text_meta_dark = Color(0.14, 0.14, 0.14, alpha=1.0)
            text_meta_muted = Color(0.35, 0.35, 0.35, alpha=1.0)
        else:
            # Crema cálido / marfil de archivo para portadas artísticas y a color
            badge_bg = Color(0.980, 0.957, 0.910, alpha=1.0)  # #faf4e8
            outer_stroke = Color(0.12, 0.11, 0.10, alpha=1.0)  # #1f1c18
            inner_stroke = Color(0.18, 0.16, 0.14, alpha=1.0)  # #2e2924
            line_stroke = Color(0.57, 0.51, 0.45, alpha=0.50)  # Sepia suave armonizado
            text_head_color = Color(0.08, 0.07, 0.06, alpha=1.0)
            text_title_color = Color(0.10, 0.09, 0.08, alpha=1.0)
            text_sub_color = Color(0.23, 0.21, 0.19, alpha=1.0)
            text_meta_dark = Color(0.14, 0.13, 0.12, alpha=1.0)
            text_meta_muted = Color(0.34, 0.31, 0.28, alpha=1.0)

        c.setFillColor(badge_bg)
        c.setStrokeColor(outer_stroke)
        c.setLineWidth(2.8)
        c.roundRect(badge_x, badge_y, badge_w, badge_h, 12.0, fill=1, stroke=1)

        c.setStrokeColor(inner_stroke)
        c.setLineWidth(0.8)
        c.roundRect(badge_x + 4.5, badge_y + 4.5, badge_w - 9.0, badge_h - 9.0, 8.5, fill=0, stroke=1)

        # Dynamic header text size to prevent truncation of long discipline titles
        head_font_size = 14.5
        while head_font_size > 7.5 and c.stringWidth(book_title, "Times-Bold", head_font_size) > (badge_w - 24.0):
            head_font_size -= 0.5
        c.setFont("Times-Bold", head_font_size)
        c.setFillColor(text_head_color)
        c.drawCentredString(visible_center_x, badge_y + badge_h - 32.0, book_title)

        line_w = badge_w - 40.0
        lx1 = badge_x + 20.0
        lx2 = lx1 + line_w
        line1_y = badge_y + badge_h - 58.0
        line2_y = badge_y + badge_h - 83.0
        line3_y = badge_y + badge_h - 108.0

        c.setStrokeColor(line_stroke)
        c.setLineWidth(0.6)
        for ly in (line1_y, line2_y, line3_y):
            c.line(lx1, ly, lx2, ly)

        t_lines = wrap_text_lines(clean_title, "Times-Bold", 11.5, line_w - 10.0, c)
        c.setFillColor(text_title_color)
        if len(t_lines) >= 2:
            c.setFont("Times-Bold", 11.5)
            c.drawCentredString(visible_center_x, line1_y + 3.5, t_lines[0])
            c.drawCentredString(visible_center_x, line2_y + 3.5, t_lines[1])
            c.setFont("Times-Roman", 10.0)
            c.setFillColor(text_sub_color)
            c.drawCentredString(visible_center_x, line3_y + 3.5, author or date_str or "Study Compendium")
        elif len(t_lines) == 1:
            c.setFont("Times-Bold", 12.0)
            c.drawCentredString(visible_center_x, line1_y + 3.5, t_lines[0])
            c.setFont("Times-Italic", 10.5)
            c.setFillColor(text_sub_color)
            c.drawCentredString(visible_center_x, line2_y + 3.5, subtitle or author or "Subject Notes")
            c.setFont("Times-Roman", 9.5)
            auth_date = (f"{author} · " if author else "") + (date_str or "Archival Copy")
            c.drawCentredString(visible_center_x, line3_y + 3.5, auth_date)

        c.setFont("Helvetica-Bold", 7.0)
        c.setFillColor(text_meta_dark)
        slide_count_str = f"{num_slides} {'Slide' if num_slides == 1 else 'Slides'} Bound" if num_slides else "100 Sheets · 200 Pages"
        c.drawCentredString(visible_center_x, badge_y + 36.0, slide_count_str)
        c.setFont("Helvetica", 6.5)
        c.setFillColor(text_meta_muted)
        c.drawCentredString(visible_center_x, badge_y + 24.0, "9 3/4 in × 7 1/2 in (24.7cm × 19cm)")
        c.setFont("Helvetica-Bold", 6.5)
        c.setFillColor(text_meta_dark)
        c.drawCentredString(visible_center_x, badge_y + 12.0, edition_tag)

    elif tpl in ("penguin", "penguin_classics", "triband", "orange_classic"):
        # Penguin Classics Tri-Band (1935 Edward Young & Allen Lane)
        band_x1 = left_gutter
        band_x2 = pw - right_gutter
        band_w = band_x2 - band_x1
        band_center_x = band_x1 + band_w / 2.0

        top_h = ph * 0.32
        mid_h = ph * 0.40
        bot_h = ph * 0.28

        y_bot_top = bot_h
        y_mid_top = bot_h + mid_h

        # Top Band: Classic Vintage Penguin Orange
        c.setFillColor(Color(0.92, 0.38, 0.16, alpha=1.0))
        c.rect(band_x1, y_mid_top, band_w, top_h, fill=1, stroke=0)

        # Center Band: Ivory / Cream paper
        c.setFillColor(Color(0.985, 0.965, 0.925, alpha=1.0))
        c.rect(band_x1, y_bot_top, band_w, mid_h, fill=1, stroke=0)

        # Bottom Band: Matching Vintage Orange
        c.setFillColor(Color(0.92, 0.38, 0.16, alpha=1.0))
        c.rect(band_x1, 0, band_w, bot_h, fill=1, stroke=0)

        # Divider Lines (Bold charcoal rules)
        c.setStrokeColor(Color(0.12, 0.12, 0.14, alpha=1.0))
        c.setLineWidth(2.2)
        c.line(band_x1, y_mid_top, band_x2, y_mid_top)
        c.line(band_x1, y_bot_top, band_x2, y_bot_top)

        # Hairline inner rules
        c.setLineWidth(0.5)
        c.line(band_x1, y_mid_top + 4.0, band_x2, y_mid_top + 4.0)
        c.line(band_x1, y_bot_top - 4.0, band_x2, y_bot_top - 4.0)

        # Top Band Text: White small-caps rubric
        c.setFont("Helvetica-Bold", 10.0)
        c.setFillColor(Color(1.0, 1.0, 1.0, alpha=0.98))
        c.drawCentredString(band_center_x, ph - 68.0, "S L I D E — P R I N T E R   C L A S S I C S")
        c.setFont("Times-Italic", 9.0)
        c.drawCentredString(band_center_x, ph - 84.0, "COMPLETE & UNABRIDGED STUDY COMPENDIUM")

        c.setStrokeColor(Color(1.0, 1.0, 1.0, alpha=0.45))
        c.setLineWidth(0.6)
        c.rect(band_center_x - 140.0, ph - 92.0, 280.0, 36.0, fill=0, stroke=1)

        # Middle Band: Main Title & Typography
        c.setFont("Times-Bold", 24)
        c.setFillColor(Color(0.10, 0.10, 0.12, alpha=1.0))
        lines = wrap_text_lines(clean_title, "Times-Bold", 24, band_w - 70.0, c)
        title_y = y_bot_top + mid_h * 0.62 + (len(lines) - 1) * 15.0
        for line in lines:
            c.drawCentredString(band_center_x, title_y, line)
            title_y -= 30.0

        if subtitle:
            c.setFont("Times-Italic", 12.5)
            c.setFillColor(Color(0.32, 0.32, 0.36, alpha=0.95))
            c.drawCentredString(band_center_x, title_y - 8.0, subtitle)
            title_y -= 26.0

        # Author in center band
        c.setFont("Times-Roman", 11.0)
        c.setFillColor(Color(0.20, 0.20, 0.22, alpha=0.9))
        c.drawCentredString(band_center_x, y_bot_top + 46.0, author or "Dedicated Study Edition")

        c.setFont("Times-Italic", 9.0)
        c.setFillColor(Color(0.45, 0.45, 0.48, alpha=0.85))
        c.drawCentredString(band_center_x, y_bot_top + 28.0, date_str or "Archival Reissue")

        # Bottom Band: Oval badge & penguin icon
        badge_y = y_bot_top * 0.48
        c.setFillColor(Color(0.985, 0.965, 0.925, alpha=1.0))
        c.setStrokeColor(Color(0.12, 0.12, 0.14, alpha=1.0))
        c.setLineWidth(1.2)
        c.ellipse(band_center_x - 22.0, badge_y - 30.0, band_center_x + 22.0, badge_y + 30.0, fill=1, stroke=1)

        c.setFillColor(Color(0.12, 0.12, 0.14, alpha=1.0))
        c.circle(band_center_x, badge_y + 10.0, 7.0, fill=1, stroke=0)
        c.rect(band_center_x - 8.0, badge_y - 18.0, 16.0, 24.0, fill=1, stroke=0)
        c.setFillColor(Color(0.985, 0.965, 0.925, alpha=1.0))
        c.circle(band_center_x, badge_y - 6.0, 5.0, fill=1, stroke=0)
        c.setFillColor(Color(0.92, 0.38, 0.16, alpha=1.0))
        p_beak = c.beginPath()
        p_beak.moveTo(band_center_x + 3.0, badge_y + 10.0)
        p_beak.lineTo(band_center_x + 9.0, badge_y + 8.0)
        p_beak.lineTo(band_center_x + 3.0, badge_y + 6.0)
        p_beak.close()
        c.drawPath(p_beak, fill=1, stroke=0)

        c.setFont("Helvetica-Bold", 8.0)
        c.setFillColor(Color(1.0, 1.0, 1.0, alpha=0.95))
        c.drawCentredString(band_center_x, 34.0, "PENGUIN BOOKS")
        if num_slides is not None:
            c.setFont("Times-Italic", 7.5)
            c.setFillColor(Color(1.0, 1.0, 1.0, alpha=0.8))
            s_word = "slide" if num_slides == 1 else "slides"
            c.drawCentredString(band_center_x, 20.0, f"{num_slides} {s_word} · study notes edition")

    elif tpl in ("gallimard", "gallimard_blanche", "nrf", "blanche"):
        # Gallimard Blanche NRF (Éditions Gallimard, Paris)
        c.setFillColor(Color(0.988, 0.980, 0.953, alpha=1.0))
        c.rect(left_gutter, 0, pw - gutter_margin, ph, fill=1, stroke=0)

        frame_inset = 40.0
        fx1 = left_gutter + frame_inset
        fx2 = pw - right_gutter - frame_inset
        fw = fx2 - fx1
        f_center = fx1 + fw / 2.0

        red_ink = Color(0.76, 0.14, 0.16, alpha=1.0)
        c.setStrokeColor(red_ink)
        c.setLineWidth(1.4)
        c.rect(fx1, frame_inset, fw, ph - 2 * frame_inset)

        c.setLineWidth(0.4)
        c.rect(fx1 + 4.5, frame_inset + 4.5, fw - 9.0, ph - 2 * (frame_inset + 4.5))

        c.setFont("Times-Bold", 8.5)
        c.setFillColor(red_ink)
        c.drawCentredString(f_center, ph - frame_inset - 36.0, "C O L L E C T I O N   B L A N C H E")

        c.setStrokeColor(red_ink)
        c.setLineWidth(0.5)
        c.line(f_center - 28.0, ph - frame_inset - 44.0, f_center + 28.0, ph - frame_inset - 44.0)

        c.setFont("Times-Roman", 12.0)
        c.setFillColor(Color(0.12, 0.12, 0.14, alpha=1.0))
        c.drawCentredString(f_center, ph * 0.70, (author or "AUTEUR INCONNU").upper())

        c.setFont("Times-Bold", 26)
        c.setFillColor(Color(0.08, 0.08, 0.10, alpha=1.0))
        lines = wrap_text_lines(clean_title, "Times-Bold", 26, fw - 40.0, c)
        title_y = ph * 0.54 + (len(lines) - 1) * 16.0
        for line in lines:
            c.drawCentredString(f_center, title_y, line)
            title_y -= 34.0

        if subtitle:
            c.setFont("Times-Italic", 13.0)
            c.setFillColor(Color(0.35, 0.35, 0.38, alpha=0.9))
            c.drawCentredString(f_center, title_y - 10.0, subtitle)

        emblem_y = ph * 0.28
        c.setStrokeColor(red_ink)
        c.setLineWidth(0.8)
        c.circle(f_center, emblem_y, 16.0, fill=0, stroke=1)
        c.setFont("Times-Bold", 10.0)
        c.setFillColor(red_ink)
        c.drawCentredString(f_center, emblem_y - 3.5, "nrf")

        c.setFont("Times-Bold", 8.5)
        c.setFillColor(Color(0.12, 0.12, 0.14, alpha=0.95))
        c.drawCentredString(f_center, frame_inset + 34.0, "É D I T I O N S   D E   L ' A T E L I E R")
        c.setFont("Times-Roman", 7.5)
        c.setFillColor(Color(0.45, 0.45, 0.48, alpha=0.85))
        c.drawCentredString(f_center, frame_inset + 20.0, f"PARIS · {date_str or 'ANNÉE UNIVERSITAIRE'}")

    elif tpl in ("oxford_press", "oxford", "cambridge", "academic_press"):
        # Oxford / Cambridge Academic Press (Clarendon Monograph)
        c.setFillColor(Color(0.99, 0.985, 0.97, alpha=1.0))
        c.rect(left_gutter, 0, pw - gutter_margin, ph, fill=1, stroke=0)

        inset = 38.0
        x1 = left_gutter + inset
        x2 = pw - right_gutter - inset
        w = x2 - x1
        center_x = x1 + w / 2.0

        navy_color = Color(0.08, 0.16, 0.32, alpha=1.0)
        gold_color = Color(0.72, 0.58, 0.28, alpha=1.0)

        c.setStrokeColor(navy_color)
        c.setLineWidth(1.6)
        c.rect(x1, inset, w, ph - 2 * inset)
        c.setLineWidth(0.5)
        c.rect(x1 + 4.0, inset + 4.0, w - 8.0, ph - 2 * (inset + 4.0))

        for cx, cy in [(x1 + 4.0, inset + 4.0), (x2 - 4.0, inset + 4.0), (x1 + 4.0, ph - inset - 4.0), (x2 - 4.0, ph - inset - 4.0)]:
            c.setFillColor(gold_color)
            c.circle(cx, cy, 2.5, fill=1, stroke=0)

        c.setFillColor(navy_color)
        c.rect(center_x - 140.0, ph - inset - 38.0, 280.0, 20.0, fill=1, stroke=0)
        c.setFont("Times-Bold", 8.0)
        c.setFillColor(Color(1.0, 1.0, 1.0, alpha=1.0))
        c.drawCentredString(center_x, ph - inset - 32.0, "OXFORD SCHOLARLY COMPENDIUM")

        emblem_y = ph * 0.72
        c.setStrokeColor(navy_color)
        c.setLineWidth(1.0)
        c.rect(center_x - 16.0, emblem_y - 12.0, 32.0, 24.0, fill=0, stroke=1)
        c.setLineWidth(0.5)
        c.line(center_x, emblem_y - 12.0, center_x, emblem_y + 12.0)
        c.setFillColor(gold_color)
        c.setFont("Times-Bold", 7.0)
        c.drawCentredString(center_x - 8.0, emblem_y - 2.0, "DOM")
        c.drawCentredString(center_x + 8.0, emblem_y - 2.0, "ILL")

        c.setFont("Times-Bold", 24)
        c.setFillColor(navy_color)
        lines = wrap_text_lines(clean_title, "Times-Bold", 24, w - 40.0, c)
        title_y = ph * 0.52 + (len(lines) - 1) * 15.0
        for line in lines:
            c.drawCentredString(center_x, title_y, line)
            title_y -= 32.0

        if subtitle:
            c.setFont("Times-Italic", 12.5)
            c.setFillColor(Color(0.28, 0.32, 0.40, alpha=0.95))
            c.drawCentredString(center_x, title_y - 8.0, subtitle)
            title_y -= 24.0

        c.setStrokeColor(gold_color)
        c.setLineWidth(0.6)
        c.line(center_x - 60.0, title_y - 14.0, center_x + 60.0, title_y - 14.0)
        c.setFont("Times-Italic", 8.5)
        c.setFillColor(gold_color)
        c.drawCentredString(center_x, title_y - 26.0, "Dominus Illuminatio Mea · Sapientia et Doctrina")

        meta_y = inset + 32.0
        c.setFont("Times-Roman", 10.0)
        c.setFillColor(navy_color)
        c.drawCentredString(center_x, meta_y + 24.0, author or "Scholarly Edition")
        c.setFont("Times-Italic", 8.5)
        c.setFillColor(Color(0.42, 0.45, 0.52, alpha=0.85))
        c.drawCentredString(center_x, meta_y + 10.0, f"Published {date_str or 'Academic Year'} · At the Clarendon Press")

    elif tpl in ("cahier", "cahier_ecolier", "seyes", "french_notebook"):
        # Cahier d'Écolier (French Seyès Vintage School Notebook)
        c.setFillColor(Color(0.14, 0.32, 0.55, alpha=1.0))
        c.rect(left_gutter, 0, pw - gutter_margin, ph, fill=1, stroke=0)

        tape_w = 34.0
        c.setFillColor(Color(0.10, 0.10, 0.12, alpha=1.0))
        c.rect(left_gutter, 0, tape_w, ph, fill=1, stroke=0)

        c.setStrokeColor(Color(0.85, 0.85, 0.85, alpha=0.35))
        c.setLineWidth(0.6)
        c.setDash(2, 4)
        c.line(left_gutter + tape_w - 5.0, 0, left_gutter + tape_w - 5.0, ph)
        c.setDash()

        avail_x1 = left_gutter + tape_w
        avail_w = pw - right_gutter - avail_x1
        center_x = avail_x1 + avail_w / 2.0

        lbl_w = min(avail_w - 48.0, 380.0)
        lbl_h = 240.0
        lbl_x = center_x - lbl_w / 2.0
        lbl_y = ph * 0.42

        c.setFillColor(Color(0.06, 0.14, 0.24, alpha=0.35))
        c.roundRect(lbl_x + 2.0, lbl_y - 3.0, lbl_w, lbl_h, 6.0, fill=1, stroke=0)

        c.setFillColor(Color(0.99, 0.99, 0.98, alpha=1.0))
        c.setStrokeColor(Color(0.18, 0.24, 0.32, alpha=0.9))
        c.setLineWidth(1.2)
        c.roundRect(lbl_x, lbl_y, lbl_w, lbl_h, 6.0, fill=1, stroke=1)

        c.setLineWidth(0.4)
        c.roundRect(lbl_x + 3.5, lbl_y + 3.5, lbl_w - 7.0, lbl_h - 7.0, 4.0, fill=0, stroke=1)

        seyes_color = Color(0.72, 0.68, 0.86, alpha=0.45)
        c.setStrokeColor(seyes_color)
        c.setLineWidth(0.4)
        line_spacing = 16.0
        curr_y = lbl_y + 24.0
        while curr_y <= lbl_y + lbl_h - 40.0:
            c.line(lbl_x + 14.0, curr_y, lbl_x + lbl_w - 14.0, curr_y)
            curr_y += line_spacing

        c.setFont("Helvetica-Bold", 8.5)
        c.setFillColor(Color(0.18, 0.22, 0.30, alpha=1.0))
        c.drawString(lbl_x + 18.0, lbl_y + lbl_h - 26.0, "CAHIER DE :")

        c.setFont("Times-Bold", 18.0)
        c.setFillColor(Color(0.08, 0.12, 0.20, alpha=1.0))
        lines = wrap_text_lines(clean_title, "Times-Bold", 18.0, lbl_w - 40.0, c)
        t_y = lbl_y + lbl_h - 52.0
        for line in lines[:3]:
            c.drawString(lbl_x + 18.0, t_y, line)
            t_y -= 22.0

        if subtitle:
            c.setFont("Times-Italic", 11.0)
            c.setFillColor(Color(0.25, 0.28, 0.35, alpha=0.95))
            c.drawString(lbl_x + 18.0, t_y - 4.0, f"Matière : {subtitle}")
            t_y -= 20.0

        c.setFont("Helvetica-Bold", 7.5)
        c.setFillColor(Color(0.35, 0.38, 0.45, alpha=0.9))
        c.drawString(lbl_x + 18.0, lbl_y + 44.0, "Appartenant à :")
        c.setFont("Times-Roman", 10.5)
        c.setFillColor(Color(0.10, 0.12, 0.18, alpha=1.0))
        c.drawString(lbl_x + 95.0, lbl_y + 44.0, author or "Étudiant")

        c.setFont("Helvetica-Bold", 7.5)
        c.setFillColor(Color(0.35, 0.38, 0.45, alpha=0.9))
        c.drawString(lbl_x + 18.0, lbl_y + 24.0, "Année scolaire :")
        c.setFont("Times-Roman", 10.0)
        c.setFillColor(Color(0.10, 0.12, 0.18, alpha=1.0))
        c.drawString(lbl_x + 95.0, lbl_y + 24.0, date_str or "2026-2027")

        c.setFont("Helvetica-Bold", 7.5)
        c.setFillColor(Color(1.0, 1.0, 1.0, alpha=0.85))
        c.drawCentredString(center_x, 30.0, f"GRAND FORMAT · GRANDS CARREAUX SEYÈS · {num_slides or 100} PAGES")

    elif tpl in ("midori", "midori_md", "japanese_minimalist", "wabi_sabi"):
        # Midori MD Minimalist (Japanese Paper Craft & Hanko)
        c.setFillColor(Color(0.975, 0.965, 0.940, alpha=1.0))
        c.rect(left_gutter, 0, pw - gutter_margin, ph, fill=1, stroke=0)

        spine_w = 18.0
        c.setFillColor(Color(0.86, 0.88, 0.82, alpha=1.0))
        c.rect(left_gutter, 0, spine_w, ph, fill=1, stroke=0)

        m = 48.0
        x1 = left_gutter + spine_w + m
        x2 = pw - right_gutter - m
        w = x2 - x1
        center_x = x1 + w / 2.0

        hanko_size = 28.0
        hanko_x = x2 - hanko_size
        hanko_y = ph - m - hanko_size
        c.setFillColor(Color(0.78, 0.22, 0.16, alpha=0.95))
        c.roundRect(hanko_x, hanko_y, hanko_size, hanko_size, 3.0, fill=1, stroke=0)
        c.setFont("Helvetica-Bold", 8.0)
        c.setFillColor(Color(1.0, 1.0, 1.0, alpha=0.98))
        c.drawCentredString(hanko_x + hanko_size / 2.0, hanko_y + 15.0, "NOTE")
        c.setFont("Helvetica-Bold", 7.0)
        c.drawCentredString(hanko_x + hanko_size / 2.0, hanko_y + 5.0, "MD")

        c.setFont("Helvetica", 7.5)
        c.setFillColor(Color(0.45, 0.45, 0.48, alpha=0.8))
        c.drawString(x1, ph - m - 12.0, "MD PAPER NOTEBOOK · COTTON ARCHIVE")

        c.setStrokeColor(Color(0.20, 0.20, 0.22, alpha=0.18))
        c.setLineWidth(0.4)
        c.line(x1, ph - m - 20.0, x2 - 36.0, ph - m - 20.0)

        c.setFont("Times-Bold", 24)
        c.setFillColor(Color(0.12, 0.12, 0.14, alpha=1.0))
        lines = wrap_text_lines(clean_title, "Times-Bold", 24, w - 20.0, c)
        title_y = ph * 0.58 + (len(lines) - 1) * 16.0
        for line in lines:
            c.drawString(x1, title_y, line)
            title_y -= 34.0

        if subtitle:
            c.setFont("Times-Italic", 12.0)
            c.setFillColor(Color(0.40, 0.40, 0.42, alpha=0.9))
            c.drawString(x1, title_y - 6.0, subtitle)
            title_y -= 26.0

        c.setStrokeColor(Color(0.78, 0.22, 0.16, alpha=0.35))
        c.setLineWidth(0.6)
        c.line(x1, title_y - 14.0, x1 + 40.0, title_y - 14.0)

        grid_y = ph * 0.18
        c.setStrokeColor(Color(0.20, 0.20, 0.22, alpha=0.15))
        c.setLineWidth(0.4)
        c.line(x1, grid_y + 40.0, x2, grid_y + 40.0)

        c.setFont("Helvetica-Bold", 6.5)
        c.setFillColor(Color(0.48, 0.48, 0.50, alpha=0.85))
        c.drawString(x1, grid_y + 28.0, "NO. 01 / TITLE")
        c.drawString(x1 + w * 0.50, grid_y + 28.0, "NO. 02 / COMPILER")

        c.setFont("Times-Roman", 10.0)
        c.setFillColor(Color(0.14, 0.14, 0.16, alpha=1.0))
        c.drawString(x1, grid_y + 14.0, clean_title[:32])
        c.drawString(x1 + w * 0.50, grid_y + 14.0, author or "Personal Notebook")

        c.setStrokeColor(Color(0.20, 0.20, 0.22, alpha=0.12))
        c.line(x1, grid_y + 4.0, x2, grid_y + 4.0)

        c.setFont("Helvetica-Bold", 6.5)
        c.setFillColor(Color(0.48, 0.48, 0.50, alpha=0.85))
        c.drawString(x1, grid_y - 8.0, "NO. 03 / DATE")
        c.drawString(x1 + w * 0.50, grid_y - 8.0, "NO. 04 / FORMAT")

        c.setFont("Times-Roman", 10.0)
        c.setFillColor(Color(0.14, 0.14, 0.16, alpha=1.0))
        c.drawString(x1, grid_y - 22.0, date_str or "Archival")
        c.drawString(x1 + w * 0.50, grid_y - 22.0, f"{num_slides or 1} Slides Bound")

    elif tpl in ("blueprint", "cyanotype", "drafting", "architectural"):
        # Cyanotype Blueprint Docket (Architectural & Engineering Drawing)
        c.setFillColor(Color(0.06, 0.16, 0.28, alpha=1.0))
        c.rect(left_gutter, 0, pw - gutter_margin, ph, fill=1, stroke=0)

        m = 32.0
        x1 = left_gutter + m
        x2 = pw - right_gutter - m
        w = x2 - x1
        center_x = x1 + w / 2.0

        minor_grid_color = Color(1.0, 1.0, 1.0, alpha=0.08)
        grid_step = 20.0

        c.setLineWidth(0.3)
        c.setStrokeColor(minor_grid_color)
        gx = x1
        while gx <= x2:
            c.line(gx, m, gx, ph - m)
            gx += grid_step

        gy = m
        while gy <= ph - m:
            c.line(x1, gy, x2, gy)
            gy += grid_step

        c.setStrokeColor(Color(1.0, 1.0, 1.0, alpha=0.85))
        c.setLineWidth(1.4)
        c.rect(x1, m, w, ph - 2 * m)

        c.setLineWidth(0.4)
        c.rect(x1 + 4.0, m + 4.0, w - 8.0, ph - 2 * (m + 4.0))

        c.setFont("Helvetica-Bold", 7.0)
        c.setFillColor(Color(1.0, 1.0, 1.0, alpha=0.7))
        for idx, lbl in enumerate(["A", "B", "C", "D"]):
            c.drawCentredString(x1 + (idx + 0.5) * (w / 4.0), ph - m + 6.0, lbl)
            c.drawCentredString(x1 + (idx + 0.5) * (w / 4.0), m - 14.0, lbl)

        for idx, lbl in enumerate(["1", "2", "3", "4"]):
            c.drawRightString(x1 - 6.0, m + (idx + 0.5) * ((ph - 2 * m) / 4.0) - 2.5, lbl)
            c.drawString(x2 + 6.0, m + (idx + 0.5) * ((ph - 2 * m) / 4.0) - 2.5, lbl)

        compass_x = x1 + 36.0
        compass_y = ph - m - 46.0
        c.setStrokeColor(Color(1.0, 1.0, 1.0, alpha=0.6))
        c.setLineWidth(0.6)
        c.circle(compass_x, compass_y, 18.0, fill=0, stroke=1)
        p_needle = c.beginPath()
        p_needle.moveTo(compass_x, compass_y + 18.0)
        p_needle.lineTo(compass_x + 4.0, compass_y)
        p_needle.lineTo(compass_x, compass_y - 18.0)
        p_needle.lineTo(compass_x - 4.0, compass_y)
        p_needle.close()
        c.drawPath(p_needle, fill=0, stroke=1)
        c.setFont("Helvetica-Bold", 7.0)
        c.setFillColor(Color(1.0, 1.0, 1.0, alpha=0.9))
        c.drawCentredString(compass_x, compass_y + 22.0, "N")

        c.setFont("Helvetica-Bold", 26)
        c.setFillColor(Color(1.0, 1.0, 1.0, alpha=0.98))
        lines = wrap_text_lines(clean_title, "Helvetica-Bold", 26, w - 80.0, c)
        title_y = ph * 0.56 + (len(lines) - 1) * 16.0
        for line in lines:
            c.drawString(x1 + 24.0, title_y, line)
            title_y -= 34.0

        if subtitle:
            c.setFont("Helvetica-Oblique", 13.0)
            c.setFillColor(Color(0.70, 0.88, 1.0, alpha=0.9))
            c.drawString(x1 + 24.0, title_y - 8.0, subtitle)

        tb_w = min(w - 20.0, 360.0)
        tb_h = 100.0
        tb_x = x2 - 4.0 - tb_w
        tb_y = m + 4.0

        c.setFillColor(Color(0.04, 0.12, 0.22, alpha=0.95))
        c.rect(tb_x, tb_y, tb_w, tb_h, fill=1, stroke=0)
        c.setStrokeColor(Color(1.0, 1.0, 1.0, alpha=0.85))
        c.setLineWidth(1.0)
        c.rect(tb_x, tb_y, tb_w, tb_h, fill=0, stroke=1)

        c.setLineWidth(0.5)
        c.line(tb_x, tb_y + 60.0, tb_x + tb_w, tb_y + 60.0)
        c.line(tb_x, tb_y + 30.0, tb_x + tb_w, tb_y + 30.0)
        c.line(tb_x + tb_w * 0.60, tb_y, tb_x + tb_w * 0.60, tb_y + 60.0)

        c.setFont("Helvetica-Bold", 6.5)
        c.setFillColor(Color(0.65, 0.82, 0.95, alpha=0.85))
        c.drawString(tb_x + 8.0, tb_y + 88.0, "PROJECT / DRAWING TITLE")
        c.setFont("Helvetica-Bold", 10.5)
        c.setFillColor(Color(1.0, 1.0, 1.0, alpha=1.0))
        c.drawString(tb_x + 8.0, tb_y + 70.0, clean_title[:32])

        c.setFont("Helvetica-Bold", 6.0)
        c.setFillColor(Color(0.65, 0.82, 0.95, alpha=0.85))
        c.drawString(tb_x + 8.0, tb_y + 48.0, "ENGINEER / AUTHOR")
        c.drawString(tb_x + tb_w * 0.60 + 8.0, tb_y + 48.0, "DATE OF ISSUE")

        c.setFont("Helvetica", 9.0)
        c.setFillColor(Color(1.0, 1.0, 1.0, alpha=0.95))
        c.drawString(tb_x + 8.0, tb_y + 36.0, author or "Technical Office")
        c.drawString(tb_x + tb_w * 0.60 + 8.0, tb_y + 36.0, date_str or "2026-09-24")

        c.setFont("Helvetica-Bold", 6.0)
        c.setFillColor(Color(0.65, 0.82, 0.95, alpha=0.85))
        c.drawString(tb_x + 8.0, tb_y + 18.0, "SCALE: N.T.S.")
        c.drawString(tb_x + tb_w * 0.35, tb_y + 18.0, f"SHEETS: {num_slides or 1}")
        c.drawString(tb_x + tb_w * 0.60 + 8.0, tb_y + 18.0, "DWG NO. SLP-001  REV: A")

    elif tpl in ("celestial", "star_atlas", "uranometria", "astronomy"):
        # Celestial Star Atlas (Uranometria Antiqua & Harmonia Macrocosmica)
        c.setFillColor(Color(0.04, 0.06, 0.14, alpha=1.0))
        c.rect(left_gutter, 0, pw - gutter_margin, ph, fill=1, stroke=0)

        m = 36.0
        x1 = left_gutter + m
        x2 = pw - right_gutter - m
        w = x2 - x1
        center_x = x1 + w / 2.0

        gold_color = Color(0.85, 0.74, 0.48, alpha=1.0)
        gold_faint = Color(0.85, 0.74, 0.48, alpha=0.25)
        star_white = Color(1.0, 1.0, 1.0, alpha=0.9)

        c.setStrokeColor(gold_color)
        c.setLineWidth(1.4)
        c.rect(x1, m, w, ph - 2 * m)
        c.setLineWidth(0.4)
        c.rect(x1 + 5.0, m + 5.0, w - 10.0, ph - 2 * (m + 5.0))

        sphere_y = ph * 0.58
        sphere_r = min(w / 2.0 - 20.0, 160.0)

        c.setStrokeColor(gold_faint)
        c.setLineWidth(0.6)
        c.circle(center_x, sphere_y, sphere_r, fill=0, stroke=1)
        c.circle(center_x, sphere_y, sphere_r * 0.70, fill=0, stroke=1)
        c.circle(center_x, sphere_y, sphere_r * 0.40, fill=0, stroke=1)

        for angle_deg in range(0, 360, 30):
            rad = math.radians(angle_deg)
            rx = center_x + sphere_r * math.cos(rad)
            ry = sphere_y + sphere_r * math.sin(rad)
            c.line(center_x, sphere_y, rx, ry)

        constellation_points = [
            (center_x - 70.0, sphere_y + 40.0),
            (center_x - 35.0, sphere_y + 85.0),
            (center_x + 15.0, sphere_y + 70.0),
            (center_x + 60.0, sphere_y + 95.0),
            (center_x + 85.0, sphere_y + 35.0),
            (center_x + 30.0, sphere_y + 10.0),
            (center_x - 20.0, sphere_y + 25.0),
        ]
        c.setStrokeColor(Color(1.0, 1.0, 1.0, alpha=0.45))
        c.setLineWidth(0.6)
        for i in range(len(constellation_points) - 1):
            c.line(constellation_points[i][0], constellation_points[i][1], constellation_points[i+1][0], constellation_points[i+1][1])

        for px, py in constellation_points:
            c.setFillColor(star_white)
            c.circle(px, py, 2.2, fill=1, stroke=0)
            c.setFillColor(Color(1.0, 1.0, 1.0, alpha=0.15))
            c.circle(px, py, 5.0, fill=1, stroke=0)

        banner_w = 260.0
        banner_h = 24.0
        c.setFillColor(Color(0.04, 0.06, 0.14, alpha=0.95))
        c.setStrokeColor(gold_color)
        c.setLineWidth(0.8)
        c.rect(center_x - banner_w / 2.0, ph - m - 42.0, banner_w, banner_h, fill=1, stroke=1)
        c.setFont("Times-Bold", 8.0)
        c.setFillColor(gold_color)
        c.drawCentredString(center_x, ph - m - 34.0, "ATLAS COELESTIS · HARMONIA MACROCOSMICA")

        c.setFont("Times-Bold", 24)
        c.setFillColor(gold_color)
        lines = wrap_text_lines(clean_title, "Times-Bold", 24, w - 50.0, c)
        title_y = ph * 0.38 + (len(lines) - 1) * 15.0
        for line in lines:
            c.drawCentredString(center_x, title_y, line)
            title_y -= 30.0

        if subtitle:
            c.setFont("Times-Italic", 12.0)
            c.setFillColor(Color(0.9, 0.88, 0.78, alpha=0.9))
            c.drawCentredString(center_x, title_y - 6.0, subtitle)
            title_y -= 22.0

        meta_y = m + 36.0
        c.setFont("Times-Roman", 10.0)
        c.setFillColor(gold_color)
        c.drawCentredString(center_x, meta_y + 16.0, author or "Observatorium Astronomicum")
        c.setFont("Times-Italic", 8.0)
        c.setFillColor(Color(0.85, 0.78, 0.65, alpha=0.75))
        c.drawCentredString(center_x, meta_y + 2.0, f"Observationes {date_str or 'Anno Domini MMXXVI'} · {num_slides or 'Omnia'} Folia")

    elif tpl in ("field_notes", "fieldnotes", "expedition", "utilitarian"):
        # Field Notes Utility & Rubric (Industrial Heavy Duty)
        c.setFillColor(Color(0.88, 0.84, 0.76, alpha=1.0))
        c.rect(left_gutter, 0, pw - gutter_margin, ph, fill=1, stroke=0)

        m = 38.0
        x1 = left_gutter + m
        x2 = pw - right_gutter - m
        w = x2 - x1
        center_x = x1 + w / 2.0

        top_bar_h = 56.0
        c.setFillColor(Color(0.96, 0.42, 0.14, alpha=1.0))
        c.rect(left_gutter, ph - top_bar_h, pw - gutter_margin, top_bar_h, fill=1, stroke=0)

        c.setFont("Helvetica-Bold", 14.0)
        c.setFillColor(Color(0.08, 0.08, 0.10, alpha=1.0))
        c.drawString(x1, ph - 36.0, "FIELD NOTES")
        c.setFont("Helvetica-Bold", 7.5)
        c.drawRightString(x2, ph - 34.0, "PRACTICAL APPLICATIONS")

        dot_color = Color(0.25, 0.22, 0.18, alpha=0.22)
        c.setFillColor(dot_color)
        dot_step = 14.0
        d_y = ph - top_bar_h - 20.0
        while d_y >= ph * 0.64:
            d_x = x1
            while d_x <= x2:
                c.circle(d_x, d_y, 0.8, fill=1, stroke=0)
                d_x += dot_step
            d_y -= dot_step

        c.setFont("Helvetica-Bold", 26)
        c.setFillColor(Color(0.10, 0.10, 0.12, alpha=1.0))
        lines = wrap_text_lines(clean_title, "Helvetica-Bold", 26, w - 20.0, c)
        title_y = ph * 0.52 + (len(lines) - 1) * 16.0
        for line in lines:
            c.drawString(x1, title_y, line)
            title_y -= 34.0

        if subtitle:
            c.setFont("Helvetica-Bold", 11.5)
            c.setFillColor(Color(0.96, 0.42, 0.14, alpha=1.0))
            c.drawString(x1, title_y - 6.0, subtitle.upper())

        tbl_y = m + 140.0
        tbl_h = 130.0

        c.setStrokeColor(Color(0.12, 0.12, 0.14, alpha=1.0))
        c.setLineWidth(1.2)
        c.rect(x1, tbl_y - tbl_h, w, tbl_h)

        c.setLineWidth(0.6)
        c.line(x1, tbl_y - 28.0, x2, tbl_y - 28.0)
        c.line(x1, tbl_y - 62.0, x2, tbl_y - 62.0)
        c.line(x1, tbl_y - 96.0, x2, tbl_y - 96.0)
        c.line(x1 + w * 0.50, tbl_y - tbl_h, x1 + w * 0.50, tbl_y - 28.0)

        c.setFillColor(Color(0.12, 0.12, 0.14, alpha=1.0))
        c.rect(x1, tbl_y - 28.0, w, 28.0, fill=1, stroke=0)
        c.setFont("Helvetica-Bold", 8.0)
        c.setFillColor(Color(1.0, 1.0, 1.0, alpha=1.0))
        c.drawString(x1 + 10.0, tbl_y - 18.0, "DOCUMENT SPECIFICATIONS & STUDY MEMORANDUM")

        c.setFont("Helvetica-Bold", 6.5)
        c.setFillColor(Color(0.40, 0.38, 0.34, alpha=0.9))
        c.drawString(x1 + 10.0, tbl_y - 40.0, "SUBJECT / PROJECT")
        c.drawString(x1 + w * 0.50 + 10.0, tbl_y - 40.0, "RECORDED BY")

        c.setFont("Helvetica-Bold", 9.0)
        c.setFillColor(Color(0.12, 0.12, 0.14, alpha=1.0))
        c.drawString(x1 + 10.0, tbl_y - 54.0, clean_title[:24])
        c.drawString(x1 + w * 0.50 + 10.0, tbl_y - 54.0, author or "Field Researcher")

        c.setFont("Helvetica-Bold", 6.5)
        c.setFillColor(Color(0.40, 0.38, 0.34, alpha=0.9))
        c.drawString(x1 + 10.0, tbl_y - 74.0, "DATE OF ENTRY")
        c.drawString(x1 + w * 0.50 + 10.0, tbl_y - 74.0, "TOTAL EXTENT")

        c.setFont("Helvetica", 9.0)
        c.setFillColor(Color(0.12, 0.12, 0.14, alpha=1.0))
        c.drawString(x1 + 10.0, tbl_y - 88.0, date_str or "2026-09-24")
        c.drawString(x1 + w * 0.50 + 10.0, tbl_y - 88.0, f"{num_slides or 1} Slides with dedicated notes")

        c.setFont("Helvetica", 6.5)
        c.setFillColor(Color(0.45, 0.42, 0.38, alpha=0.85))
        c.drawCentredString(center_x, tbl_y - 116.0, "DURABLE BOUND EDITION · PRINTED IN GALICIA · SLIDE-PRINTER STANDARD")

    else:
        # Default: Atelier Notebook (Zara Home Classic)
        inset = 36.0
        x1 = left_gutter + inset
        x2 = pw - right_gutter - inset
        w = x2 - x1

        c.setStrokeColor(Color(0.25, 0.25, 0.25, alpha=0.22))
        c.setLineWidth(0.6)
        c.rect(x1, inset, w, ph - 2 * inset)

        inner_inset = 42.0
        ix1 = left_gutter + inner_inset
        ix2 = pw - right_gutter - inner_inset
        iw = ix2 - ix1
        c.setStrokeColor(Color(0.25, 0.25, 0.25, alpha=0.10))
        c.setLineWidth(0.35)
        c.rect(ix1, inner_inset, iw, ph - 2 * inner_inset)

        c.setFont("Times-Roman", 8)
        c.setFillColor(Color(0.42, 0.42, 0.42, alpha=0.75))
        c.drawCentredString(center_x, ph - 95.0, "N O T E B O O K")

        c.setStrokeColor(Color(0.3, 0.3, 0.3, alpha=0.2))
        c.setLineWidth(0.4)
        c.line(center_x - 24, ph - 105.0, center_x + 24, ph - 105.0)

        c.setFont("Times-Bold", 24)
        c.setFillColor(Color(0.12, 0.12, 0.14, alpha=1.0))
        lines = wrap_text_lines(clean_title, "Times-Bold", 24, w - 60, c)
        title_y = ph * 0.58 + (len(lines) - 1) * 16.0
        for line in lines:
            c.drawCentredString(center_x, title_y, line)
            title_y -= 32.0

        if subtitle:
            c.setFont("Times-Italic", 12.5)
            c.setFillColor(Color(0.32, 0.32, 0.34, alpha=0.9))
            c.drawCentredString(center_x, title_y - 8.0, subtitle)
            title_y -= 26.0

        c.setStrokeColor(Color(0.3, 0.3, 0.3, alpha=0.18))
        c.setLineWidth(0.4)
        c.line(center_x - 32, title_y - 12.0, center_x + 32, title_y - 12.0)

        meta_y = ph * 0.26
        if author:
            c.setFont("Times-Roman", 10.5)
            c.setFillColor(Color(0.22, 0.22, 0.24, alpha=0.9))
            c.drawCentredString(center_x, meta_y, author)
            meta_y -= 18.0

        if date_str:
            c.setFont("Times-Italic", 9)
            c.setFillColor(Color(0.42, 0.42, 0.42, alpha=0.8))
            c.drawCentredString(center_x, meta_y, f"Date: {date_str}")
            meta_y -= 16.0

        if num_slides is not None:
            c.setFont("Times-Roman", 8.5)
            c.setFillColor(Color(0.48, 0.48, 0.48, alpha=0.75))
            s_word = "slide" if num_slides == 1 else "slides"
            c.drawCentredString(center_x, meta_y, f"{num_slides} {s_word} with dedicated notes")

    if hole_guides and binding in ("binder", "ring", "rings", "archivador", "anillas", "anelas", "spiral", "espiral", "wire-o", "wireo", "coil", "canutillo"):
        draw_binding_guides(c, page_size, binding, is_verso=is_verso, gutter_margin=gutter_margin)

    c.save()
    packet.seek(0)
    return PdfReader(packet).pages[0]

    c.save()
    packet.seek(0)
    return PdfReader(packet).pages[0]


def create_2up_notes_overlay(
    page_size: Tuple[float, float],
    margin: float,
    width: float,
    slot1_sep_y: float,
    slot1_bottom: float,
    slot2_sep_y: Optional[float],
    slot2_bottom: float,
    style: str,
    step: float = DEFAULT_STEP,
    dot_radius: float = 0.65,
    page_number: Optional[int] = None,
    total_pages: Optional[int] = None,
    page_number_format: str = "total",
    study_header: bool = False,
    study_title: Optional[str] = None,
    header_y: Optional[float] = None,
    grayscale: bool = False,
    binding: str = "none",
    hole_guides: bool = False,
    is_verso: bool = False,
    gutter_margin: float = 0.0,
) -> PageObject:
    """Creates a PDF overlay page for 2-Up (2 slides per sheet) handouts."""
    packet = io.BytesIO()
    c = canvas.Canvas(packet, pagesize=page_size)
    pw, ph = page_size

    x1 = margin
    x2 = margin + width

    # Draw study header at top if requested
    if study_header and header_y is not None:
        c.setFont("Helvetica-Bold", 8)
        c.setFillColor(Color(0.25, 0.25, 0.25, alpha=0.85))
        left_label = f"SUBJECT / TOPIC: {study_title}" if study_title else "SUBJECT / TOPIC: _____________________________"
        c.drawString(x1, header_y, left_label)

        c.setFont("Helvetica", 8)
        c.drawRightString(x2, header_y, "DATE: _____ / _____ / 20___")

        c.setStrokeColor(Color(0.25, 0.25, 0.25, alpha=0.25))
        c.setLineWidth(0.5)
        c.line(x1, header_y - 4, x2, header_y - 4)

    # Helper to draw note pattern in a specific Y interval
    def draw_pattern_zone(sep_y: float, bottom_limit: float):
        # Separator line with ticks
        c.setStrokeColor(Color(0.2, 0.2, 0.2, alpha=0.35))
        c.setLineWidth(0.7)
        c.line(x1, sep_y, x2, sep_y)
        c.setLineWidth(0.5)
        c.line(x1, sep_y - 2, x1, sep_y + 2)
        c.line(x2, sep_y - 2, x2, sep_y + 2)

        norm_style = style.lower()
        y_start = sep_y - 8
        if norm_style in ("lines", "lineas", "line"):
            c.setStrokeColor(Color(0.4, 0.4, 0.4, alpha=0.22))
            c.setLineWidth(0.4)
            curr_y = y_start - step
            while curr_y >= bottom_limit:
                c.line(x1, curr_y, x2, curr_y)
                curr_y -= step
        elif norm_style in ("grid", "cuadricula"):
            c.setStrokeColor(Color(0.4, 0.4, 0.4, alpha=0.18))
            c.setLineWidth(0.35)

            num_cols = max(1, int(width // step))
            grid_w = num_cols * step
            grid_x1 = x1 + (width - grid_w) / 2.0
            grid_x2 = grid_x1 + grid_w

            curr_y = y_start
            while curr_y >= bottom_limit:
                c.line(grid_x1, curr_y, grid_x2, curr_y)
                curr_y -= step
            y_min = curr_y + step
            for col in range(num_cols + 1):
                cx = grid_x1 + col * step
                c.line(cx, y_min, cx, y_start)
        elif norm_style in ("dots", "puntos", "dot"):
            c.setFillColor(Color(0.25, 0.25, 0.25, alpha=0.35))

            num_cols = max(1, int(width // step))
            grid_w = num_cols * step
            grid_x1 = x1 + (width - grid_w) / 2.0

            curr_y = y_start
            while curr_y >= bottom_limit:
                for col in range(num_cols + 1):
                    cx = grid_x1 + col * step
                    c.circle(cx, curr_y, dot_radius, fill=1, stroke=0)
                curr_y -= step

    # Draw Slot 1 pattern
    draw_pattern_zone(slot1_sep_y, slot1_bottom)

    # Subtle dashed divider between slots
    mid_y = ph / 2.0
    c.setStrokeColor(Color(0.3, 0.3, 0.3, alpha=0.18))
    c.setLineWidth(0.5)
    c.setDash(2, 4)
    c.line(x1, mid_y, x2, mid_y)
    c.setDash()  # restore solid line

    # Draw Slot 2 pattern if present
    if slot2_sep_y is not None:
        draw_pattern_zone(slot2_sep_y, slot2_bottom)

    # Footer page number
    if page_number is not None:
        c.setFont("Helvetica", 9)
        c.setFillColor(Color(0.3, 0.3, 0.3, alpha=0.7))
        footer_y = max(margin / 2.0 - 3, 12)
        if page_number_format == "total" and total_pages is not None and total_pages > 0:
            num_str = f"{page_number} / {total_pages}"
        else:
            num_str = str(page_number)
        c.drawCentredString(pw / 2.0, footer_y, num_str)

    # Optional binding punch / spiral guides
    if hole_guides and binding in ("binder", "ring", "rings", "archivador", "anillas", "anelas", "spiral", "espiral", "wire-o", "wireo", "coil", "canutillo"):
        draw_binding_guides(c, page_size, binding, is_verso=is_verso, gutter_margin=gutter_margin)

    c.save()
    packet.seek(0)
    return PdfReader(packet).pages[0]



