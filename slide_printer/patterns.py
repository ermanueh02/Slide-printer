"""Pattern overlay generators for note sections."""

import io
import math
from typing import Tuple, Optional, List
from pypdf import PdfReader
from pypdf._page import PageObject
from reportlab.lib.colors import Color
from reportlab.pdfgen import canvas

from slide_printer.constants import DEFAULT_STEP, COVER_TEMPLATE_ALIASES


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
) -> PageObject:
    """Generates an editorial notebook cover page inspired by vintage and modernist designs.

    Templates:
      Classics / Zara:
        - 'atelier': Zara Home timeless notebook with double hairline borders and quiet serif typography.
        - 'george': JFK Jr 90s executive brief with architectural header rules and authoritative hierarchy.
        - 'monograph': Archival heritage stationery with a centered bordered cartouche/bookplate.
        - 'bauhaus': Swiss modernist layout with asymmetric cross-rules and modernist composition.
      Decades:
        - 'fifties': Mid-century 1950s Pelican/Penguin tri-band classic with geometric diamond emblem.
        - 'sixties': 1960s Swiss International Typographic Style (Müller-Brockmann / Helvetica grid).
        - 'seventies': 1970s warm retro groove & Apollo flight checklist with triple rounded frames.
        - 'eighties': 1980s Memphis design & early Macintosh 1984 manual with diagonal hatch accents.
        - 'nineties': 1990s minimalist lookbook & indie zine with corner registration marks & monospace specs.
      Seasons:
        - 'spring': Vernal sage & fresh linen with delicate solar crosshair and airy typography.
        - 'summer': Mediterranean azure horizon & solar ochre bar with marine precision.
        - 'autumn': Burnt terracotta & harvest amber with diamond lozenge and warm archival cartouche.
        - 'winter': Nordic alpine midnight blue & crystalline slate with hexagonal ice compass.
      Ralph Lauren:
        - 'polo': Collegiate navy pinstripe & antique gold shield emblem with Ivy League typography.
        - 'equestrian': Hunter green & saddle leather tan with equestrian stirrup crest & dashed rule.
      Nature:
        - 'natural': Deep forest green architectural dossier on unbleached linen with brass accents.
    """
    packet = io.BytesIO()
    c = canvas.Canvas(packet, pagesize=page_size)
    pw, ph = page_size
    clean_title = (title or "Presentation").strip()
    raw_tpl = (template or "atelier").lower().strip()
    tpl = COVER_TEMPLATE_ALIASES.get(raw_tpl, raw_tpl)

    if tpl == "george":
        # 1. George 90s Editorial / JFK Jr Executive Style
        margin = 44.0
        c.setStrokeColor(Color(0.12, 0.12, 0.14, alpha=1.0))
        c.setLineWidth(2.0)
        c.line(margin, ph - 58.0, pw - margin, ph - 58.0)
        c.setLineWidth(0.5)
        c.line(margin, ph - 63.0, pw - margin, ph - 63.0)

        c.setFont("Times-Bold", 8.5)
        c.setFillColor(Color(0.15, 0.15, 0.18, alpha=0.9))
        c.drawString(margin, ph - 50.0, "STUDY DOSSIER")
        c.setFont("Times-Italic", 8.0)
        c.setFillColor(Color(0.45, 0.45, 0.48, alpha=0.85))
        c.drawRightString(pw - margin, ph - 50.0, "EXECUTIVE BRIEF · 90S ARCHIVE")

        c.setFont("Times-Bold", 28)
        c.setFillColor(Color(0.08, 0.08, 0.10, alpha=1.0))
        lines = wrap_text_lines(clean_title, "Times-Bold", 28, pw - 2 * margin - 20, c)
        title_y = ph * 0.64
        for line in lines:
            c.drawString(margin, title_y, line)
            title_y -= 36.0

        if subtitle:
            c.setFont("Times-Italic", 13.5)
            c.setFillColor(Color(0.35, 0.35, 0.38, alpha=0.95))
            c.drawString(margin, title_y - 6.0, subtitle)
            title_y -= 28.0

        c.setStrokeColor(Color(0.2, 0.2, 0.25, alpha=0.25))
        c.setLineWidth(0.6)
        c.line(margin, title_y - 14.0, margin + 80.0, title_y - 14.0)

        meta_y = ph * 0.18
        c.setStrokeColor(Color(0.12, 0.12, 0.14, alpha=1.0))
        c.setLineWidth(0.8)
        c.line(margin, meta_y + 40.0, pw - margin, meta_y + 40.0)

        c.setFont("Times-Bold", 7.5)
        c.setFillColor(Color(0.35, 0.35, 0.38, alpha=0.8))
        c.drawString(margin, meta_y + 26.0, "AUTHOR / STUDENT")
        c.setFont("Times-Roman", 10.0)
        c.setFillColor(Color(0.12, 0.12, 0.14, alpha=1.0))
        c.drawString(margin, meta_y + 12.0, author or "General Notes")

        col2_x = margin + (pw - 2 * margin) * 0.52
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
            c.drawRightString(pw - margin, meta_y - 8.0, f"{num_slides} {s_word} with study notes")

    elif tpl == "monograph":
        # 2. Archival Monograph (Heritage Stationery Bookplate)
        inset = 34.0
        c.setStrokeColor(Color(0.3, 0.3, 0.3, alpha=0.18))
        c.setLineWidth(0.5)
        c.rect(inset, inset, pw - 2 * inset, ph - 2 * inset)

        box_w = pw - 2 * inset - 70.0
        box_h = 190.0
        box_x = (pw - box_w) / 2.0
        box_y = ph * 0.42

        c.setStrokeColor(Color(0.2, 0.2, 0.22, alpha=0.35))
        c.setLineWidth(0.75)
        c.rect(box_x, box_y, box_w, box_h)
        c.setStrokeColor(Color(0.2, 0.2, 0.22, alpha=0.14))
        c.setLineWidth(0.35)
        c.rect(box_x + 4.5, box_y + 4.5, box_w - 9.0, box_h - 9.0)

        c.setFont("Times-Roman", 8)
        c.setFillColor(Color(0.45, 0.45, 0.45, alpha=0.85))
        c.drawCentredString(pw / 2.0, box_y + box_h - 26.0, "M O N O G R A P H   ·   N O T E S")

        c.setStrokeColor(Color(0.4, 0.4, 0.4, alpha=0.22))
        c.setLineWidth(0.35)
        c.line(pw / 2.0 - 20.0, box_y + box_h - 33.0, pw / 2.0 + 20.0, box_y + box_h - 33.0)

        c.setFont("Times-Bold", 20)
        c.setFillColor(Color(0.12, 0.12, 0.14, alpha=1.0))
        lines = wrap_text_lines(clean_title, "Times-Bold", 20, box_w - 36.0, c)
        title_y = box_y + box_h * 0.54 + (len(lines) - 1) * 13.0
        for line in lines:
            c.drawCentredString(pw / 2.0, title_y, line)
            title_y -= 26.0

        if subtitle:
            c.setFont("Times-Italic", 11.5)
            c.setFillColor(Color(0.35, 0.35, 0.38, alpha=0.9))
            c.drawCentredString(pw / 2.0, title_y - 8.0, subtitle)

        meta_y = ph * 0.22
        if author:
            c.setFont("Times-Roman", 10.5)
            c.setFillColor(Color(0.22, 0.22, 0.24, alpha=0.9))
            c.drawCentredString(pw / 2.0, meta_y, author)
            meta_y -= 18.0

        if date_str:
            c.setFont("Times-Italic", 9.0)
            c.setFillColor(Color(0.42, 0.42, 0.42, alpha=0.8))
            c.drawCentredString(pw / 2.0, meta_y, f"Date: {date_str}")
            meta_y -= 16.0

        if num_slides is not None:
            c.setFont("Times-Roman", 8.5)
            c.setFillColor(Color(0.48, 0.48, 0.48, alpha=0.75))
            s_word = "slide" if num_slides == 1 else "slides"
            c.drawCentredString(pw / 2.0, meta_y, f"{num_slides} {s_word} with dedicated notes")

    elif tpl == "bauhaus":
        # 3. Swiss Modernist Bauhaus Layout
        m = 48.0
        vert_x = m + 28.0
        c.setStrokeColor(Color(0.15, 0.15, 0.18, alpha=0.18))
        c.setLineWidth(0.6)
        c.line(vert_x, m, vert_x, ph - m)

        hdr_y = ph - m - 20.0
        c.line(m, hdr_y, pw - m, hdr_y)

        c.setFont("Helvetica-Bold" if not grayscale else "Times-Bold", 8.0)
        c.setFillColor(Color(0.2, 0.2, 0.25, alpha=0.9))
        c.drawString(vert_x + 14.0, hdr_y + 8.0, "VOLUME I  ·  STUDY COMPENDIUM")

        c.setFont("Times-Bold", 24)
        c.setFillColor(Color(0.08, 0.08, 0.10, alpha=1.0))
        lines = wrap_text_lines(clean_title, "Times-Bold", 24, pw - (vert_x + 14.0) - m, c)
        title_y = ph * 0.58 + (len(lines) - 1) * 15.0
        for line in lines:
            c.drawString(vert_x + 14.0, title_y, line)
            title_y -= 30.0

        if subtitle:
            c.setFont("Times-Italic", 12.5)
            c.setFillColor(Color(0.35, 0.35, 0.38, alpha=0.9))
            c.drawString(vert_x + 14.0, title_y - 6.0, subtitle)

        meta_y = ph * 0.25
        c.setFont("Helvetica-Bold" if not grayscale else "Times-Bold", 7.0)
        c.setFillColor(Color(0.45, 0.45, 0.48, alpha=0.85))
        c.drawString(vert_x + 14.0, meta_y + 36.0, "STUDENT:")
        c.setFont("Times-Roman", 10.0)
        c.setFillColor(Color(0.12, 0.12, 0.14, alpha=1.0))
        c.drawString(vert_x + 72.0, meta_y + 36.0, author or "Study Notes")

        c.setFont("Helvetica-Bold" if not grayscale else "Times-Bold", 7.0)
        c.setFillColor(Color(0.45, 0.45, 0.48, alpha=0.85))
        c.drawString(vert_x + 14.0, meta_y + 18.0, "DATE:")
        c.setFont("Times-Roman", 10.0)
        c.setFillColor(Color(0.12, 0.12, 0.14, alpha=1.0))
        c.drawString(vert_x + 72.0, meta_y + 18.0, date_str or "Archival")

        if num_slides is not None:
            s_word = "slide" if num_slides == 1 else "slides"
            c.setFont("Times-Italic", 8.0)
            c.setFillColor(Color(0.5, 0.5, 0.52, alpha=0.75))
            c.drawString(vert_x + 14.0, meta_y - 4.0, f"{num_slides} {s_word} included")

    elif tpl == "fifties":
        # 4. 1950s Mid-Century Pelican / Penguin Tri-Band Paperbound Classic
        top_band_h = ph * 0.20
        c.setFillColor(Color(0.16, 0.18, 0.20, alpha=1.0))
        c.rect(0, ph - top_band_h, pw, top_band_h, fill=1, stroke=0)

        c.setFont("Helvetica-Bold", 8.5)
        c.setFillColor(Color(0.96, 0.96, 0.96, alpha=0.95))
        c.drawCentredString(pw / 2.0, ph - 42.0, "M I D - C E N T U R Y   D O S S I E R")
        c.setFont("Times-Italic", 8.0)
        c.setFillColor(Color(0.82, 0.84, 0.86, alpha=0.85))
        c.drawCentredString(pw / 2.0, ph - 58.0, "PELICAN & PENGUIN STUDY MONOGRAPH · SERIES NO. 54")

        c.setStrokeColor(Color(0.96, 0.96, 0.96, alpha=0.3))
        c.setLineWidth(0.5)
        c.line(pw / 2.0 - 45.0, ph - 70.0, pw / 2.0 + 45.0, ph - 70.0)

        lozenge_y = ph * 0.65
        c.setStrokeColor(Color(0.18, 0.20, 0.22, alpha=0.4))
        c.setLineWidth(0.8)
        p = c.beginPath()
        p.moveTo(pw / 2.0, lozenge_y + 13.0)
        p.lineTo(pw / 2.0 + 13.0, lozenge_y)
        p.lineTo(pw / 2.0, lozenge_y - 13.0)
        p.lineTo(pw / 2.0 - 13.0, lozenge_y)
        p.close()
        c.drawPath(p, stroke=1, fill=0)

        c.setFont("Times-Bold", 24)
        c.setFillColor(Color(0.10, 0.12, 0.14, alpha=1.0))
        lines = wrap_text_lines(clean_title, "Times-Bold", 24, pw - 80.0, c)
        cur_y = lozenge_y - 36.0
        for line in lines:
            c.drawCentredString(pw / 2.0, cur_y, line)
            cur_y -= 32.0

        if subtitle:
            c.setFont("Times-Italic", 12.0)
            c.setFillColor(Color(0.35, 0.38, 0.40, alpha=0.95))
            c.drawCentredString(pw / 2.0, cur_y - 8.0, subtitle)
            cur_y -= 26.0

        bot_band_y = ph * 0.22
        c.setStrokeColor(Color(0.16, 0.18, 0.20, alpha=1.0))
        c.setLineWidth(1.8)
        c.line(40.0, bot_band_y + 10.0, pw - 40.0, bot_band_y + 10.0)
        c.setLineWidth(0.5)
        c.line(40.0, bot_band_y + 6.0, pw - 40.0, bot_band_y + 6.0)

        c.setFont("Helvetica-Bold", 7.5)
        c.setFillColor(Color(0.40, 0.42, 0.45, alpha=0.85))
        c.drawCentredString(pw / 2.0, bot_band_y - 10.0, "STUDENT / RESEARCH COMPILATION")

        c.setFont("Times-Roman", 10.5)
        c.setFillColor(Color(0.12, 0.14, 0.16, alpha=1.0))
        c.drawCentredString(pw / 2.0, bot_band_y - 26.0, author or "General Lecture Edition")

        c.setFont("Times-Italic", 9.0)
        c.setFillColor(Color(0.45, 0.45, 0.48, alpha=0.85))
        c.drawCentredString(pw / 2.0, bot_band_y - 42.0, f"Published: {date_str}" if date_str else "Archival Edition")

        if num_slides is not None:
            c.setFont("Helvetica", 7.5)
            c.setFillColor(Color(0.52, 0.54, 0.56, alpha=0.8))
            s_word = "slide" if num_slides == 1 else "slides"
            c.drawCentredString(pw / 2.0, bot_band_y - 58.0, f"{num_slides} {s_word} with ruled marginal notes")

    elif tpl == "sixties":
        # 5. 1960s Swiss International Typographic Style (Müller-Brockmann / Basel)
        margin = 46.0
        c.setFillColor(Color(0.08, 0.08, 0.10, alpha=1.0))
        c.rect(margin, ph - 54.0, pw - 2 * margin, 5.0, fill=1, stroke=0)

        c.setFont("Helvetica-Bold", 44)
        c.setFillColor(Color(0.08, 0.08, 0.10, alpha=0.12))
        c.drawRightString(pw - margin, ph - 110.0, "60")

        c.setFont("Helvetica-Bold", 8.0)
        c.setFillColor(Color(0.15, 0.15, 0.18, alpha=0.9))
        c.drawString(margin, ph - 74.0, "INTERNATIONALE TYPOGRAPHIE  ·  SCHWEIZ 1960")

        c.setFont("Helvetica-Bold", 27)
        c.setFillColor(Color(0.08, 0.08, 0.10, alpha=1.0))
        lines = wrap_text_lines(clean_title, "Helvetica-Bold", 27, pw - 2 * margin - 50.0, c)
        cur_y = ph * 0.62 + (len(lines) - 1) * 16.0
        for line in lines:
            c.drawString(margin, cur_y, line)
            cur_y -= 35.0

        if subtitle:
            c.setFont("Helvetica", 12.0)
            c.setFillColor(Color(0.35, 0.35, 0.38, alpha=0.9))
            c.drawString(margin, cur_y - 6.0, subtitle)
            cur_y -= 26.0

        c.setStrokeColor(Color(0.08, 0.08, 0.10, alpha=1.0))
        c.setLineWidth(1.2)
        c.line(margin, cur_y - 12.0, margin + 45.0, cur_y - 12.0)

        grid_y = ph * 0.24
        col_w = (pw - 2 * margin) / 2.0
        c.setStrokeColor(Color(0.15, 0.15, 0.18, alpha=0.25))
        c.setLineWidth(0.5)
        c.line(margin, grid_y + 36.0, pw - margin, grid_y + 36.0)
        c.line(margin + col_w, grid_y + 36.0, margin + col_w, grid_y - 20.0)

        c.setFont("Helvetica-Bold", 7.0)
        c.setFillColor(Color(0.40, 0.40, 0.42, alpha=0.85))
        c.drawString(margin, grid_y + 24.0, "FORSCHER / AUTHOR")
        c.setFont("Helvetica", 9.5)
        c.setFillColor(Color(0.10, 0.10, 0.12, alpha=1.0))
        c.drawString(margin, grid_y + 10.0, author or "Allgemeine Vorlesung")

        c.setFont("Helvetica-Bold", 7.0)
        c.setFillColor(Color(0.40, 0.40, 0.42, alpha=0.85))
        c.drawString(margin + col_w + 14.0, grid_y + 24.0, "DATUM / REGISTRY")
        c.setFont("Helvetica", 9.5)
        c.setFillColor(Color(0.10, 0.10, 0.12, alpha=1.0))
        c.drawString(margin + col_w + 14.0, grid_y + 10.0, date_str or "Archiv Zürich")

        if num_slides is not None:
            c.setFont("Helvetica-Bold", 7.0)
            c.drawString(margin, grid_y - 8.0, "FOLIO")
            c.setFont("Helvetica", 9.5)
            s_word = "slide" if num_slides == 1 else "slides"
            c.drawString(margin, grid_y - 20.0, f"{num_slides} {s_word}")

    elif tpl == "seventies":
        # 6. 1970s Retro Warm Editorial & Apollo NASA Checklist
        m = 38.0
        c.setStrokeColor(Color(0.22, 0.20, 0.18, alpha=0.85))
        c.setLineWidth(1.6)
        c.roundRect(m, m, pw - 2 * m, ph - 2 * m, 12.0, stroke=1, fill=0)
        c.setLineWidth(0.6)
        c.roundRect(m + 4.0, m + 4.0, pw - 2 * m - 8.0, ph - 2 * m - 8.0, 9.0, stroke=1, fill=0)
        c.setLineWidth(0.4)
        c.roundRect(m + 7.5, m + 7.5, pw - 2 * m - 15.0, ph - 2 * m - 15.0, 7.0, stroke=1, fill=0)

        c.setFont("Helvetica-Bold", 8.0)
        c.setFillColor(Color(0.35, 0.32, 0.30, alpha=0.9))
        c.drawCentredString(pw / 2.0, ph - m - 28.0, "★  A R C H I V A L   D O S S I E R   ·   1 9 7 X  ★")

        badge_x = pw - m - 46.0
        badge_y = ph - m - 52.0
        c.setStrokeColor(Color(0.35, 0.32, 0.30, alpha=0.4))
        c.circle(badge_x, badge_y, 18.0, stroke=1, fill=0)
        c.setFont("Helvetica-Bold", 6.5)
        c.setFillColor(Color(0.35, 0.32, 0.30, alpha=0.85))
        c.drawCentredString(badge_x, badge_y + 2.0, "VOL. 74")
        c.setFont("Helvetica", 5.5)
        c.drawCentredString(badge_x, badge_y - 6.0, "OFFICIAL")

        c.setFont("Times-Bold", 25)
        c.setFillColor(Color(0.14, 0.12, 0.10, alpha=1.0))
        lines = wrap_text_lines(clean_title, "Times-Bold", 25, pw - 2 * m - 70.0, c)
        cur_y = ph * 0.58 + (len(lines) - 1) * 15.0
        for line in lines:
            c.drawCentredString(pw / 2.0, cur_y, line)
            cur_y -= 33.0

        if subtitle:
            c.setFont("Times-Italic", 12.0)
            c.setFillColor(Color(0.40, 0.36, 0.32, alpha=0.95))
            c.drawCentredString(pw / 2.0, cur_y - 8.0, subtitle)
            cur_y -= 24.0

        c.setStrokeColor(Color(0.40, 0.36, 0.32, alpha=0.25))
        c.setLineWidth(0.6)
        c.setDash(4, 3)
        c.line(pw / 2.0 - 50.0, cur_y - 12.0, pw / 2.0 + 50.0, cur_y - 12.0)
        c.setDash()

        box_y = m + 36.0
        box_w = pw - 2 * m - 50.0
        box_h = 76.0
        bx = (pw - box_w) / 2.0
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
        c.setStrokeColor(Color(0.10, 0.10, 0.12, alpha=1.0))
        c.setLineWidth(1.4)
        c.rect(m, m, pw - 2 * m, ph - 2 * m, stroke=1, fill=0)
        c.setLineWidth(0.4)
        c.rect(m + 3.5, m + 3.5, pw - 2 * m - 7.0, ph - 2 * m - 7.0, stroke=1, fill=0)

        hatch_w = 44.0
        hatch_h = 24.0
        hx = pw - m - hatch_w - 12.0
        hy = ph - m - hatch_h - 12.0
        c.setStrokeColor(Color(0.10, 0.10, 0.12, alpha=0.35))
        c.setLineWidth(0.5)
        c.rect(hx, hy, hatch_w, hatch_h, stroke=1, fill=0)
        for d in range(-20, int(hatch_w + hatch_h), 5):
            c.line(hx + max(0, d), hy + max(0, -d), hx + min(hatch_w, d + hatch_h), hy + min(hatch_h, hatch_h))

        c.setFillColor(Color(0.10, 0.10, 0.12, alpha=0.85))
        c.circle(hx - 12.0, hy + 12.0, 3.0, fill=1, stroke=0)

        c.setFont("Helvetica-Bold", 7.5)
        c.drawString(m + 16.0, ph - m - 24.0, "SYS.MANUAL // VOL.84 · PERSONAL STUDY COMPENDIUM")

        c.setFont("Helvetica-Bold", 26)
        c.setFillColor(Color(0.08, 0.08, 0.10, alpha=1.0))
        lines = wrap_text_lines(clean_title, "Helvetica-Bold", 26, pw - 2 * m - 50.0, c)
        cur_y = ph * 0.60 + (len(lines) - 1) * 16.0
        for line in lines:
            c.drawString(m + 16.0, cur_y, line)
            cur_y -= 34.0

        if subtitle:
            c.setFont("Helvetica", 11.5)
            c.setFillColor(Color(0.35, 0.35, 0.38, alpha=0.9))
            c.drawString(m + 16.0, cur_y - 6.0, subtitle)
            cur_y -= 24.0

        c.setStrokeColor(Color(0.10, 0.10, 0.12, alpha=1.0))
        c.setLineWidth(1.0)
        c.line(m + 16.0, cur_y - 12.0, m + 120.0, cur_y - 12.0)

        tech_y = m + 28.0
        c.setFont("Courier-Bold", 8.0)
        c.setFillColor(Color(0.20, 0.20, 0.24, alpha=0.95))
        c.drawString(m + 16.0, tech_y + 44.0, f"[ OPERATOR ] : {author or 'User.01'}")
        c.drawString(m + 16.0, tech_y + 28.0, f"[ TIMESTAMP] : {date_str or '1984.10.24'}")
        c.drawString(m + 16.0, tech_y + 12.0, f"[ DATASETS ] : {num_slides or 0} Slides Compiled // Format A4")

    elif tpl == "nineties":
        # 8. 1990s Minimalist Lookbook & Indie Zine (Ray Gun, Calvin Klein 90s minimalism)
        m = 36.0
        c.setStrokeColor(Color(0.12, 0.12, 0.14, alpha=0.4))
        c.setLineWidth(0.4)
        for cx, cy in [(m, ph - m), (pw - m, ph - m), (m, m), (pw - m, m)]:
            c.line(cx - 8.0, cy, cx + 8.0, cy)
            c.line(cx, cy - 8.0, cx, cy + 8.0)
            c.circle(cx, cy, 3.5, stroke=1, fill=0)

        c.setFont("Courier-Bold", 8.0)
        c.setFillColor(Color(0.25, 0.25, 0.28, alpha=0.9))
        c.drawString(m + 16.0, ph - m - 18.0, "ISSUE #09 // EDITORIAL DOSSIER")

        bx = pw - m - 60.0
        by = ph - m - 24.0
        bar_widths = [1.2, 0.5, 2.0, 0.8, 1.5, 0.5, 2.2, 0.8, 1.2, 0.5, 1.8]
        curr_bx = bx
        c.setFillColor(Color(0.12, 0.12, 0.14, alpha=0.85))
        for bw in bar_widths:
            c.rect(curr_bx, by, bw, 14.0, fill=1, stroke=0)
            curr_bx += bw + 1.8

        c.setStrokeColor(Color(0.12, 0.12, 0.14, alpha=0.2))
        c.setLineWidth(0.5)
        c.line(m + 16.0, m + 40.0, m + 16.0, ph - m - 40.0)

        c.setFont("Helvetica-Bold", 28)
        c.setFillColor(Color(0.06, 0.06, 0.08, alpha=1.0))
        lines = wrap_text_lines(clean_title, "Helvetica-Bold", 28, pw - m - 70.0, c)
        cur_y = ph * 0.56 + (len(lines) - 1) * 16.0
        for line in lines:
            c.drawString(m + 28.0, cur_y, line)
            cur_y -= 36.0

        if subtitle:
            c.setFont("Times-Italic", 13.0)
            c.setFillColor(Color(0.40, 0.40, 0.44, alpha=0.95))
            c.drawString(m + 28.0, cur_y - 6.0, subtitle)
            cur_y -= 26.0

        meta_y = m + 32.0
        c.setFont("Courier", 8.5)
        c.setFillColor(Color(0.20, 0.20, 0.24, alpha=0.95))
        c.drawString(m + 28.0, meta_y + 40.0, "INDEX.REF  :: 90S-ARCHIVE")
        c.drawString(m + 28.0, meta_y + 26.0, f"CURATOR    :: {author or 'Anonymous'}")
        c.drawString(m + 28.0, meta_y + 12.0, f"TIMESTAMP  :: {date_str or 'Autumn 1996'}")
        c.drawString(m + 28.0, meta_y - 2.0,  f"CONTENT    :: {num_slides or 0} Slide Folios")

    elif tpl == "natural":
        # 10. Natural Deep Forest Editorial (Luxury Architectural Notebook)
        # Background: Warm unbleached linen paper
        c.setFillColor(Color(0.965, 0.958, 0.942, alpha=1.0))
        c.rect(0, 0, pw, ph, fill=1, stroke=0)

        m = 40.0
        forest_dark = Color(0.06, 0.18, 0.11, alpha=1.0)  # #0F2E1C deep dark forest green
        forest_mid = Color(0.12, 0.28, 0.18, alpha=1.0)
        forest_light = Color(0.24, 0.44, 0.32, alpha=0.35)
        brass_gold = Color(0.72, 0.58, 0.36, alpha=1.0)

        # Outer bold forest frame
        c.setStrokeColor(forest_dark)
        c.setLineWidth(1.4)
        c.rect(m, m, pw - 2 * m, ph - 2 * m, stroke=1, fill=0)

        # Inner fine pinstripe frame
        c.setStrokeColor(forest_light)
        c.setLineWidth(0.4)
        c.rect(m + 4.5, m + 4.5, pw - 2 * (m + 4.5), ph - 2 * (m + 4.5), stroke=1, fill=0)

        # Corner brass cross-ticks
        c.setStrokeColor(brass_gold)
        c.setLineWidth(0.6)
        for cx, cy in [(m, m), (pw - m, m), (m, ph - m), (pw - m, ph - m)]:
            c.line(cx - 5.0, cy, cx + 5.0, cy)
            c.line(cx, cy - 5.0, cx, cy + 5.0)

        # Top deep forest header block
        hdr_h = 24.0
        c.setFillColor(forest_dark)
        c.rect(m + 16.0, ph - m - 32.0, pw - 2 * m - 32.0, hdr_h, fill=1, stroke=0)

        c.setFont("Helvetica-Bold", 8.0)
        c.setFillColor(Color(0.97, 0.97, 0.96, alpha=0.95))
        c.drawString(m + 26.0, ph - m - 22.0, "NATURAL COMPENDIUM // EDITORIAL STUDY FOLIO")

        c.setFont("Times-Italic", 8.0)
        c.setFillColor(brass_gold)
        c.drawRightString(pw - m - 26.0, ph - m - 22.0, "VOL. 01 · DEEP FOREST ARCHIVE")

        # Thin brass accent below header block
        c.setFillColor(brass_gold)
        c.rect(m + 16.0, ph - m - 35.0, pw - 2 * m - 32.0, 1.0, fill=1, stroke=0)

        # Title block
        title_x = m + 22.0
        c.setFont("Helvetica-Bold", 8.0)
        c.setFillColor(forest_mid)
        c.drawString(title_x, ph * 0.65, "STUDY DOSSIER · NATURAL EDITION")

        c.setFont("Times-Bold", 27)
        c.setFillColor(forest_dark)
        lines = wrap_text_lines(clean_title, "Times-Bold", 27, pw - 2 * m - 60.0, c)
        cur_y = ph * 0.60 + (len(lines) - 1) * 16.0
        for line in lines:
            c.drawString(title_x, cur_y, line)
            cur_y -= 35.0

        if subtitle:
            c.setFont("Times-Italic", 13.0)
            c.setFillColor(forest_mid)
            c.drawString(title_x, cur_y - 6.0, subtitle)
            cur_y -= 26.0

        # Architecture triple rule with brass center lozenge
        rule_y = cur_y - 12.0
        c.setStrokeColor(forest_dark)
        c.setLineWidth(1.0)
        c.line(title_x, rule_y, title_x + 60.0, rule_y)

        c.setFillColor(brass_gold)
        c.rect(title_x + 64.0, rule_y - 2.0, 4.0, 4.0, fill=1, stroke=0)

        c.setStrokeColor(forest_light)
        c.setLineWidth(0.5)
        c.line(title_x + 72.0, rule_y, pw - m - 22.0, rule_y)

        # Bottom Two-Column Architectural Metadata Grid in Deep Forest
        grid_y = m + 36.0
        col_w = (pw - 2 * m - 44.0) / 2.0

        c.setStrokeColor(forest_dark)
        c.setLineWidth(0.8)
        c.line(title_x, grid_y + 44.0, pw - m - 22.0, grid_y + 44.0)
        c.setStrokeColor(forest_light)
        c.setLineWidth(0.5)
        c.line(title_x + col_w, grid_y + 44.0, title_x + col_w, grid_y - 16.0)

        # Col 1
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

        # Col 2
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
        sage_deep = Color(0.18, 0.38, 0.25, alpha=1.0)
        sage_soft = Color(0.35, 0.55, 0.42, alpha=0.8)
        sage_mist = Color(0.35, 0.55, 0.42, alpha=0.18)
        blossom_tint = Color(0.78, 0.54, 0.48, alpha=1.0)

        c.setStrokeColor(sage_soft)
        c.setLineWidth(0.8)
        c.rect(m, m, pw - 2 * m, ph - 2 * m, stroke=1, fill=0)

        c.setStrokeColor(sage_mist)
        c.setLineWidth(0.4)
        c.rect(m + 4.0, m + 4.0, pw - 2 * (m + 4.0), ph - 2 * (m + 4.0), stroke=1, fill=0)

        # Vernal solar crosshair emblem centered in top half
        lozenge_y = ph * 0.68
        c.setStrokeColor(sage_deep)
        c.setLineWidth(0.6)
        c.circle(pw / 2.0, lozenge_y, 11.0, stroke=1, fill=0)
        c.setStrokeColor(blossom_tint)
        c.line(pw / 2.0 - 15.0, lozenge_y, pw / 2.0 + 15.0, lozenge_y)
        c.line(pw / 2.0, lozenge_y - 15.0, pw / 2.0, lozenge_y + 15.0)

        # Header tag
        c.setFont("Helvetica-Bold", 8.0)
        c.setFillColor(sage_deep)
        c.drawCentredString(pw / 2.0, ph - m - 32.0, "V E R N A L   C O M P E N D I U M")
        c.setFont("Times-Italic", 8.0)
        c.setFillColor(sage_soft)
        c.drawCentredString(pw / 2.0, ph - m - 46.0, "SPRING SERIES · NEW CYCLE · VOL. I")

        c.setFont("Times-Bold", 25)
        c.setFillColor(Color(0.12, 0.22, 0.16, alpha=1.0))
        lines = wrap_text_lines(clean_title, "Times-Bold", 25, pw - 2 * m - 60.0, c)
        cur_y = lozenge_y - 42.0
        for line in lines:
            c.drawCentredString(pw / 2.0, cur_y, line)
            cur_y -= 33.0

        if subtitle:
            c.setFont("Times-Italic", 12.0)
            c.setFillColor(sage_soft)
            c.drawCentredString(pw / 2.0, cur_y - 8.0, subtitle)
            cur_y -= 24.0

        # Fine divider
        c.setStrokeColor(sage_soft)
        c.setLineWidth(0.5)
        c.line(pw / 2.0 - 36.0, cur_y - 12.0, pw / 2.0 + 36.0, cur_y - 12.0)

        # Footer
        meta_y = m + 40.0
        c.setFont("Helvetica-Bold", 7.0)
        c.setFillColor(sage_soft)
        c.drawCentredString(pw / 2.0, meta_y + 24.0, "CURATED STUDY FOLIO")
        c.setFont("Times-Roman", 10.0)
        c.setFillColor(sage_deep)
        c.drawCentredString(pw / 2.0, meta_y + 10.0, author or "Spring Session Notes")
        c.setFont("Times-Italic", 8.5)
        c.setFillColor(sage_soft)
        c.drawCentredString(pw / 2.0, meta_y - 4.0, date_str or "Springtime")
        if num_slides is not None:
            s_word = "slide" if num_slides == 1 else "slides"
            c.drawCentredString(pw / 2.0, meta_y - 18.0, f"{num_slides} {s_word} compiled")

    elif tpl == "summer":
        # 12. Summer / Solstice Editorial (Aegean Azure & Solar Warmth)
        c.setFillColor(Color(0.99, 0.99, 0.985, alpha=1.0))
        c.rect(0, 0, pw, ph, fill=1, stroke=0)

        m = 42.0
        azure_deep = Color(0.06, 0.24, 0.44, alpha=1.0)  # Mediterranean deep blue
        azure_light = Color(0.18, 0.45, 0.70, alpha=0.3)
        solar_gold = Color(0.86, 0.60, 0.20, alpha=1.0)  # Warm sun gold

        # Top sea horizon bar
        bar_h = 36.0
        c.setFillColor(azure_deep)
        c.rect(0, ph - bar_h, pw, bar_h, fill=1, stroke=0)
        c.setFillColor(solar_gold)
        c.rect(0, ph - bar_h - 2.5, pw, 2.5, fill=1, stroke=0)

        c.setFont("Helvetica-Bold", 8.5)
        c.setFillColor(Color(0.98, 0.98, 0.98, alpha=0.95))
        c.drawString(m, ph - 22.0, "SOLSTICE COMPENDIUM · SUMMER FOLIO")
        c.setFont("Helvetica", 8.0)
        c.drawRightString(pw - m, ph - 22.0, "MEDITERRANEAN ARCHIVE // 02")

        # Double outer frame below bar
        c.setStrokeColor(azure_light)
        c.setLineWidth(0.6)
        c.rect(m, m, pw - 2 * m, ph - m - bar_h - 16.0, stroke=1, fill=0)

        # Title
        c.setFont("Times-Bold", 27)
        c.setFillColor(azure_deep)
        lines = wrap_text_lines(clean_title, "Times-Bold", 27, pw - 2 * m - 50.0, c)
        cur_y = ph * 0.58 + (len(lines) - 1) * 16.0
        for line in lines:
            c.drawString(m + 18.0, cur_y, line)
            cur_y -= 35.0

        if subtitle:
            c.setFont("Times-Italic", 13.0)
            c.setFillColor(Color(0.25, 0.40, 0.55, alpha=0.95))
            c.drawString(m + 18.0, cur_y - 6.0, subtitle)
            cur_y -= 26.0

        # Compass tick line
        rule_y = cur_y - 14.0
        c.setStrokeColor(azure_deep)
        c.setLineWidth(1.0)
        c.line(m + 18.0, rule_y, m + 80.0, rule_y)
        c.setStrokeColor(solar_gold)
        c.setLineWidth(1.0)
        c.line(m + 80.0, rule_y, m + 120.0, rule_y)

        # Clean metadata grid
        meta_y = m + 32.0
        c.setFont("Helvetica-Bold", 7.0)
        c.setFillColor(solar_gold)
        c.drawString(m + 18.0, meta_y + 36.0, "STUDY RESEARCHER")
        c.setFont("Times-Roman", 10.0)
        c.setFillColor(azure_deep)
        c.drawString(m + 18.0, meta_y + 22.0, author or "Summer Study Compendium")

        c.setFont("Helvetica-Bold", 7.0)
        c.setFillColor(solar_gold)
        c.drawString(m + 18.0, meta_y + 6.0, "CALENDAR REGISTRY")
        c.setFont("Times-Italic", 9.0)
        c.setFillColor(azure_deep)
        c.drawString(m + 18.0, meta_y - 8.0, date_str or "Summer Solstice")

        if num_slides is not None:
            s_word = "slide" if num_slides == 1 else "slides"
            c.setFont("Helvetica", 8.0)
            c.setFillColor(Color(0.4, 0.5, 0.6, alpha=0.9))
            c.drawRightString(pw - m - 18.0, meta_y + 22.0, f"{num_slides} {s_word} in dossier")

    elif tpl == "autumn":
        # 13. Autumn / Equinox Editorial (Burnt Terracotta & Amber Warmth)
        c.setFillColor(Color(0.965, 0.945, 0.915, alpha=1.0))
        c.rect(0, 0, pw, ph, fill=1, stroke=0)

        m = 40.0
        terracotta = Color(0.62, 0.22, 0.12, alpha=1.0)  # Rust terracotta #9E381F
        amber = Color(0.76, 0.50, 0.18, alpha=1.0)       # Amber gold
        espresso = Color(0.18, 0.10, 0.08, alpha=1.0)    # Dark coffee ink

        # Heavy inner rule, thin outer rule (classical bookbindery)
        c.setStrokeColor(amber)
        c.setLineWidth(0.5)
        c.rect(m, m, pw - 2 * m, ph - 2 * m, stroke=1, fill=0)

        c.setStrokeColor(terracotta)
        c.setLineWidth(1.4)
        c.rect(m + 4.0, m + 4.0, pw - 2 * (m + 4.0), ph - 2 * (m + 4.0), stroke=1, fill=0)

        # Header tag
        c.setFont("Helvetica-Bold", 8.0)
        c.setFillColor(terracotta)
        c.drawCentredString(pw / 2.0, ph - m - 32.0, "E Q U I N O X   D O S S I E R")
        c.setFont("Times-Italic", 8.0)
        c.setFillColor(amber)
        c.drawCentredString(pw / 2.0, ph - m - 46.0, "AUTUMNAL COMPENDIUM · OCTOBER ARCHIVE")

        # Centered amber diamond lozenge
        loz_y = ph * 0.65
        c.setStrokeColor(terracotta)
        c.setLineWidth(0.8)
        p = c.beginPath()
        p.moveTo(pw / 2.0, loz_y + 11.0)
        p.lineTo(pw / 2.0 + 11.0, loz_y)
        p.lineTo(pw / 2.0, loz_y - 11.0)
        p.lineTo(pw / 2.0 - 11.0, loz_y)
        p.close()
        c.drawPath(p, stroke=1, fill=0)

        c.setFillColor(amber)
        c.circle(pw / 2.0, loz_y, 2.5, fill=1, stroke=0)

        # Title
        c.setFont("Times-Bold", 25)
        c.setFillColor(espresso)
        lines = wrap_text_lines(clean_title, "Times-Bold", 25, pw - 2 * m - 60.0, c)
        cur_y = loz_y - 36.0
        for line in lines:
            c.drawCentredString(pw / 2.0, cur_y, line)
            cur_y -= 32.0

        if subtitle:
            c.setFont("Times-Italic", 12.0)
            c.setFillColor(terracotta)
            c.drawCentredString(pw / 2.0, cur_y - 8.0, subtitle)
            cur_y -= 24.0

        c.setStrokeColor(amber)
        c.setLineWidth(0.6)
        c.line(pw / 2.0 - 45.0, cur_y - 10.0, pw / 2.0 + 45.0, cur_y - 10.0)

        # Bottom archival box
        box_y = m + 32.0
        box_w = pw - 2 * m - 40.0
        box_h = 68.0
        bx = (pw - box_w) / 2.0
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
        midnight = Color(0.08, 0.14, 0.24, alpha=1.0)
        slate_blue = Color(0.32, 0.46, 0.60, alpha=1.0)
        frost_line = Color(0.32, 0.46, 0.60, alpha=0.25)

        # Alpine triple hairline borders
        c.setStrokeColor(slate_blue)
        c.setLineWidth(0.8)
        c.rect(m, m, pw - 2 * m, ph - 2 * m, stroke=1, fill=0)
        c.setStrokeColor(frost_line)
        c.setLineWidth(0.35)
        c.rect(m + 4.0, m + 4.0, pw - 2 * (m + 4.0), ph - 2 * (m + 4.0), stroke=1, fill=0)
        c.rect(m + 7.0, m + 7.0, pw - 2 * (m + 7.0), ph - 2 * (m + 7.0), stroke=1, fill=0)

        # Geometric ice crystal / 6-axis star emblem
        star_y = ph * 0.68
        c.setStrokeColor(slate_blue)
        c.setLineWidth(0.7)
        c.circle(pw / 2.0, star_y, 13.0, stroke=1, fill=0)
        for deg in [0, 60, 120]:
            rad = math.radians(deg)
            dx = 17.0 * math.cos(rad)
            dy = 17.0 * math.sin(rad)
            c.line(pw / 2.0 - dx, star_y - dy, pw / 2.0 + dx, star_y + dy)

        # Header
        c.setFont("Helvetica-Bold", 8.0)
        c.setFillColor(midnight)
        c.drawCentredString(pw / 2.0, ph - m - 28.0, "HIEMAL COMPENDIUM · ARCTIC ARCHIVE")
        c.setFont("Helvetica", 7.0)
        c.setFillColor(slate_blue)
        c.drawCentredString(pw / 2.0, ph - m - 42.0, "NORDIC ALPINE EDITION · NO. 04")

        # Title
        c.setFont("Times-Bold", 26)
        c.setFillColor(midnight)
        lines = wrap_text_lines(clean_title, "Times-Bold", 26, pw - 2 * m - 60.0, c)
        cur_y = star_y - 42.0
        for line in lines:
            c.drawCentredString(pw / 2.0, cur_y, line)
            cur_y -= 34.0

        if subtitle:
            c.setFont("Times-Italic", 12.0)
            c.setFillColor(slate_blue)
            c.drawCentredString(pw / 2.0, cur_y - 8.0, subtitle)
            cur_y -= 24.0

        c.setStrokeColor(slate_blue)
        c.setLineWidth(0.5)
        c.line(pw / 2.0 - 30.0, cur_y - 12.0, pw / 2.0 + 30.0, cur_y - 12.0)

        # Metadata
        meta_y = m + 38.0
        c.setFont("Helvetica-Bold", 7.0)
        c.setFillColor(slate_blue)
        c.drawCentredString(pw / 2.0, meta_y + 24.0, "OPERATOR / CURATOR")
        c.setFont("Helvetica", 9.5)
        c.setFillColor(midnight)
        c.drawCentredString(pw / 2.0, meta_y + 10.0, author or "Winter Session")
        c.setFont("Helvetica", 8.0)
        c.setFillColor(slate_blue)
        c.drawCentredString(pw / 2.0, meta_y - 4.0, date_str or "Winter Season")
        if num_slides is not None:
            s_word = "slide" if num_slides == 1 else "slides"
            c.drawCentredString(pw / 2.0, meta_y - 18.0, f"{num_slides} {s_word} indexed")

    elif tpl == "polo":
        # 15. Ralph Lauren Polo (Collegiate Navy & Gold Shield Heritage)
        c.setFillColor(Color(0.975, 0.970, 0.960, alpha=1.0))
        c.rect(0, 0, pw, ph, fill=1, stroke=0)

        m = 40.0
        rl_navy = Color(0.06, 0.12, 0.25, alpha=1.0)   # Ralph Lauren deep collegiate navy #0F1F40
        rl_green = Color(0.08, 0.22, 0.14, alpha=1.0)  # Ralph Lauren deep hunter green #143824
        rl_gold = Color(0.76, 0.60, 0.32, alpha=1.0)   # Heritage antique gold #C29952

        # Heavy outer navy border
        c.setStrokeColor(rl_navy)
        c.setLineWidth(2.5)
        c.rect(m, m, pw - 2 * m, ph - 2 * m, stroke=1, fill=0)

        # Inner gold pinstripe border
        c.setStrokeColor(rl_gold)
        c.setLineWidth(0.6)
        c.rect(m + 4.5, m + 4.5, pw - 2 * (m + 4.5), ph - 2 * (m + 4.5), stroke=1, fill=0)

        # Inner fine navy hairline
        c.setStrokeColor(rl_navy)
        c.setLineWidth(0.4)
        c.rect(m + 8.0, m + 8.0, pw - 2 * (m + 8.0), ph - 2 * (m + 8.0), stroke=1, fill=0)

        # Top collegiate banner
        c.setFont("Times-Bold", 8.5)
        c.setFillColor(rl_navy)
        c.drawCentredString(pw / 2.0, ph - m - 28.0, "P O L O   S T U D Y   C O M P E N D I U M")
        c.setFont("Times-Italic", 7.5)
        c.setFillColor(rl_green)
        c.drawCentredString(pw / 2.0, ph - m - 42.0, "HERITAGE COLLEGIATE ARCHIVE · EST. 1967")

        # Centered collegiate shield/crest emblem
        shield_y = ph * 0.66
        c.setStrokeColor(rl_navy)
        c.setLineWidth(1.2)
        sh_p = c.beginPath()
        sh_p.moveTo(pw / 2.0, shield_y + 16.0)
        sh_p.lineTo(pw / 2.0 + 16.0, shield_y)
        sh_p.lineTo(pw / 2.0, shield_y - 16.0)
        sh_p.lineTo(pw / 2.0 - 16.0, shield_y)
        sh_p.close()
        c.drawPath(sh_p, stroke=1, fill=0)

        # Inner gold circle & cross
        c.setStrokeColor(rl_gold)
        c.setLineWidth(0.6)
        c.circle(pw / 2.0, shield_y, 9.0, stroke=1, fill=0)
        c.line(pw / 2.0 - 11.0, shield_y, pw / 2.0 + 11.0, shield_y)
        c.line(pw / 2.0, shield_y - 11.0, pw / 2.0, shield_y + 11.0)

        c.setFont("Times-Bold", 5.5)
        c.setFillColor(rl_navy)
        c.drawCentredString(pw / 2.0, shield_y - 1.5, "RL")

        # Title
        c.setFont("Times-Bold", 26)
        c.setFillColor(rl_navy)
        lines = wrap_text_lines(clean_title, "Times-Bold", 26, pw - 2 * m - 60.0, c)
        cur_y = shield_y - 42.0
        for line in lines:
            c.drawCentredString(pw / 2.0, cur_y, line)
            cur_y -= 34.0

        if subtitle:
            c.setFont("Times-Italic", 12.5)
            c.setFillColor(rl_green)
            c.drawCentredString(pw / 2.0, cur_y - 6.0, subtitle)
            cur_y -= 24.0

        # Navy and gold dual divider line
        c.setStrokeColor(rl_navy)
        c.setLineWidth(1.0)
        c.line(pw / 2.0 - 40.0, cur_y - 10.0, pw / 2.0 + 40.0, cur_y - 10.0)
        c.setStrokeColor(rl_gold)
        c.setLineWidth(0.5)
        c.line(pw / 2.0 - 25.0, cur_y - 13.0, pw / 2.0 + 25.0, cur_y - 13.0)

        # Bottom collegiate registry
        meta_y = m + 36.0
        c.setFont("Times-Bold", 7.5)
        c.setFillColor(rl_gold)
        c.drawCentredString(pw / 2.0, meta_y + 26.0, "FELLOW / STUDENT RECORD")
        c.setFont("Times-Bold", 10.5)
        c.setFillColor(rl_navy)
        c.drawCentredString(pw / 2.0, meta_y + 12.0, author or "Collegiate Member")
        c.setFont("Times-Italic", 8.5)
        c.setFillColor(rl_green)
        c.drawCentredString(pw / 2.0, meta_y - 2.0, date_str or "Academic Term")
        if num_slides is not None:
            s_word = "slide folio" if num_slides == 1 else "slide folios"
            c.setFont("Times-Roman", 8.0)
            c.setFillColor(Color(0.4, 0.45, 0.5, alpha=0.85))
            c.drawCentredString(pw / 2.0, meta_y - 16.0, f"{num_slides} {s_word} bound")

    elif tpl == "equestrian":
        # 16. Ralph Lauren Equestrian (British Country Estate & Hunter Green)
        c.setFillColor(Color(0.965, 0.952, 0.925, alpha=1.0))
        c.rect(0, 0, pw, ph, fill=1, stroke=0)

        m = 40.0
        hunter_green = Color(0.08, 0.20, 0.13, alpha=1.0)  # Hunter green #143321
        saddle_tan = Color(0.55, 0.30, 0.14, alpha=1.0)    # Saddle leather tan #8C4D24
        brass = Color(0.74, 0.58, 0.30, alpha=1.0)         # Antique equestrian brass #BD944D

        # Triple frame in hunter green and saddle tan
        c.setStrokeColor(hunter_green)
        c.setLineWidth(1.6)
        c.rect(m, m, pw - 2 * m, ph - 2 * m, stroke=1, fill=0)

        c.setStrokeColor(brass)
        c.setLineWidth(0.6)
        c.rect(m + 4.0, m + 4.0, pw - 2 * (m + 4.0), ph - 2 * (m + 4.0), stroke=1, fill=0)

        c.setStrokeColor(saddle_tan)
        c.setLineWidth(0.4)
        c.setDash(4, 3)
        c.rect(m + 7.5, m + 7.5, pw - 2 * (m + 7.5), ph - 2 * (m + 7.5), stroke=1, fill=0)
        c.setDash()

        # Header tag
        c.setFont("Times-Bold", 8.5)
        c.setFillColor(hunter_green)
        c.drawCentredString(pw / 2.0, ph - m - 28.0, "E Q U E S T R I A N   &   F I E L D")
        c.setFont("Times-Italic", 7.5)
        c.setFillColor(saddle_tan)
        c.drawCentredString(pw / 2.0, ph - m - 42.0, "COUNTRY ESTATE ARCHIVE · SERIES IX")

        # Centered stirrup / buckle motif
        stirrup_y = ph * 0.66
        c.setStrokeColor(brass)
        c.setLineWidth(1.2)
        p = c.beginPath()
        p.arc(pw / 2.0 - 13.0, stirrup_y - 6.0, pw / 2.0 + 13.0, stirrup_y + 20.0, 0, 180)
        p.lineTo(pw / 2.0 - 13.0, stirrup_y - 8.0)
        p.lineTo(pw / 2.0 + 13.0, stirrup_y - 8.0)
        p.close()
        c.drawPath(p, stroke=1, fill=0)

        c.setStrokeColor(saddle_tan)
        c.setLineWidth(1.0)
        c.line(pw / 2.0 - 16.0, stirrup_y - 8.0, pw / 2.0 + 16.0, stirrup_y - 8.0)

        # Title
        c.setFont("Times-Bold", 25)
        c.setFillColor(hunter_green)
        lines = wrap_text_lines(clean_title, "Times-Bold", 25, pw - 2 * m - 60.0, c)
        cur_y = stirrup_y - 36.0
        for line in lines:
            c.drawCentredString(pw / 2.0, cur_y, line)
            cur_y -= 33.0

        if subtitle:
            c.setFont("Times-Italic", 12.0)
            c.setFillColor(saddle_tan)
            c.drawCentredString(pw / 2.0, cur_y - 6.0, subtitle)
            cur_y -= 24.0

        # Saddle-stitched divider line
        rule_y = cur_y - 10.0
        c.setStrokeColor(saddle_tan)
        c.setLineWidth(0.8)
        c.setDash(3, 3)
        c.line(pw / 2.0 - 45.0, rule_y, pw / 2.0 + 45.0, rule_y)
        c.setDash()

        c.setFillColor(brass)
        c.circle(pw / 2.0 - 50.0, rule_y, 2.0, fill=1, stroke=0)
        c.circle(pw / 2.0 + 50.0, rule_y, 2.0, fill=1, stroke=0)

        # Metadata
        meta_y = m + 36.0
        c.setFont("Helvetica-Bold", 7.0)
        c.setFillColor(saddle_tan)
        c.drawCentredString(pw / 2.0, meta_y + 26.0, "ESTATE REGISTER")
        c.setFont("Times-Bold", 10.5)
        c.setFillColor(hunter_green)
        c.drawCentredString(pw / 2.0, meta_y + 12.0, author or "Estate Member")
        c.setFont("Times-Italic", 8.5)
        c.setFillColor(saddle_tan)
        c.drawCentredString(pw / 2.0, meta_y - 2.0, date_str or "Season Archive")
        if num_slides is not None:
            s_word = "slide" if num_slides == 1 else "slides"
            c.setFont("Times-Roman", 8.0)
            c.setFillColor(brass)
            c.drawCentredString(pw / 2.0, meta_y - 16.0, f"{num_slides} {s_word} registered")

    else:
        # Default: Atelier Notebook (Zara Home Classic)
        inset = 36.0
        c.setStrokeColor(Color(0.25, 0.25, 0.25, alpha=0.22))
        c.setLineWidth(0.6)
        c.rect(inset, inset, pw - 2 * inset, ph - 2 * inset)

        inner_inset = 42.0
        c.setStrokeColor(Color(0.25, 0.25, 0.25, alpha=0.10))
        c.setLineWidth(0.35)
        c.rect(inner_inset, inner_inset, pw - 2 * inner_inset, ph - 2 * inner_inset)

        c.setFont("Times-Roman", 8)
        c.setFillColor(Color(0.42, 0.42, 0.42, alpha=0.75))
        c.drawCentredString(pw / 2.0, ph - 95.0, "N O T E B O O K")

        c.setStrokeColor(Color(0.3, 0.3, 0.3, alpha=0.2))
        c.setLineWidth(0.4)
        c.line(pw / 2.0 - 24, ph - 105.0, pw / 2.0 + 24, ph - 105.0)

        c.setFont("Times-Bold", 24)
        c.setFillColor(Color(0.12, 0.12, 0.14, alpha=1.0))
        lines = wrap_text_lines(clean_title, "Times-Bold", 24, pw - 2 * inset - 60, c)
        title_y = ph * 0.58 + (len(lines) - 1) * 16.0
        for line in lines:
            c.drawCentredString(pw / 2.0, title_y, line)
            title_y -= 32.0

        if subtitle:
            c.setFont("Times-Italic", 12.5)
            c.setFillColor(Color(0.32, 0.32, 0.34, alpha=0.9))
            c.drawCentredString(pw / 2.0, title_y - 8.0, subtitle)
            title_y -= 26.0

        c.setStrokeColor(Color(0.3, 0.3, 0.3, alpha=0.18))
        c.setLineWidth(0.4)
        c.line(pw / 2.0 - 32, title_y - 12.0, pw / 2.0 + 32, title_y - 12.0)

        meta_y = ph * 0.26
        if author:
            c.setFont("Times-Roman", 10.5)
            c.setFillColor(Color(0.22, 0.22, 0.24, alpha=0.9))
            c.drawCentredString(pw / 2.0, meta_y, author)
            meta_y -= 18.0

        if date_str:
            c.setFont("Times-Italic", 9)
            c.setFillColor(Color(0.42, 0.42, 0.42, alpha=0.8))
            c.drawCentredString(pw / 2.0, meta_y, f"Date: {date_str}")
            meta_y -= 16.0

        if num_slides is not None:
            c.setFont("Times-Roman", 8.5)
            c.setFillColor(Color(0.48, 0.48, 0.48, alpha=0.75))
            s_word = "slide" if num_slides == 1 else "slides"
            c.drawCentredString(pw / 2.0, meta_y, f"{num_slides} {s_word} with dedicated notes")

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



