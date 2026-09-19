"""Pattern overlay generators for note sections."""

import io
from typing import Tuple, Optional
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
    page_number: Optional[int] = None,
    total_pages: Optional[int] = None,
    page_number_format: str = "total",
    draw_separator: bool = True,
    study_header: bool = False,
    study_title: Optional[str] = None,
    header_y: Optional[float] = None,
    footer_margin: Optional[float] = None,
    grayscale: bool = False,
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
    """Generates an elegant mid-century modern / 90s editorial notebook cover page in English.

    Templates:
      - 'atelier': Zara Home timeless notebook with double hairline borders and quiet serif typography.
      - 'george': JFK Jr 90s executive brief with architectural header rules and authoritative editorial hierarchy.
      - 'monograph': Archival heritage stationery with a centered bordered cartouche/bookplate.
      - 'bauhaus': Swiss modernist layout with asymmetric cross-rules and modernist composition.
    """
    packet = io.BytesIO()
    c = canvas.Canvas(packet, pagesize=page_size)
    pw, ph = page_size
    clean_title = (title or "Presentation").strip()
    tpl = (template or "atelier").lower()

    if tpl == "george":
        # 1. George 90s Editorial / JFK Jr Executive Style
        # Clean architectural margin framing
        margin = 44.0
        c.setStrokeColor(Color(0.12, 0.12, 0.14, alpha=1.0))
        c.setLineWidth(2.0)
        c.line(margin, ph - 58.0, pw - margin, ph - 58.0)
        c.setLineWidth(0.5)
        c.line(margin, ph - 63.0, pw - margin, ph - 63.0)

        # Header folio
        c.setFont("Times-Bold", 8.5)
        c.setFillColor(Color(0.15, 0.15, 0.18, alpha=0.9))
        c.drawString(margin, ph - 50.0, "STUDY DOSSIER")
        c.setFont("Times-Italic", 8.0)
        c.setFillColor(Color(0.45, 0.45, 0.48, alpha=0.85))
        c.drawRightString(pw - margin, ph - 50.0, "EXECUTIVE BRIEF · 90S ARCHIVE")

        # Display Title (left-aligned, authoritative editorial serif)
        c.setFont("Times-Bold", 28)
        c.setFillColor(Color(0.08, 0.08, 0.10, alpha=1.0))
        words = clean_title.split()
        lines = []
        curr_line = ""
        for w in words:
            test_line = f"{curr_line} {w}".strip()
            if c.stringWidth(test_line, "Times-Bold", 28) < (pw - 2 * margin - 20):
                curr_line = test_line
            else:
                if curr_line:
                    lines.append(curr_line)
                curr_line = w
        if curr_line:
            lines.append(curr_line)

        title_y = ph * 0.64
        for line in lines:
            c.drawString(margin, title_y, line)
            title_y -= 36.0

        if subtitle:
            c.setFont("Times-Italic", 13.5)
            c.setFillColor(Color(0.35, 0.35, 0.38, alpha=0.95))
            c.drawString(margin, title_y - 6.0, subtitle)
            title_y -= 28.0

        # Sleek divider rule
        c.setStrokeColor(Color(0.2, 0.2, 0.25, alpha=0.25))
        c.setLineWidth(0.6)
        c.line(margin, title_y - 14.0, margin + 80.0, title_y - 14.0)

        # Structured metadata grid at bottom
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
        # Subtle outer page border
        c.setStrokeColor(Color(0.3, 0.3, 0.3, alpha=0.18))
        c.setLineWidth(0.5)
        c.rect(inset, inset, pw - 2 * inset, ph - 2 * inset)

        # Centered elegant bookplate cartouche
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

        # Cartouche header
        c.setFont("Times-Roman", 8)
        c.setFillColor(Color(0.45, 0.45, 0.45, alpha=0.85))
        c.drawCentredString(pw / 2.0, box_y + box_h - 26.0, "M O N O G R A P H   ·   N O T E S")

        c.setStrokeColor(Color(0.4, 0.4, 0.4, alpha=0.22))
        c.setLineWidth(0.35)
        c.line(pw / 2.0 - 20.0, box_y + box_h - 33.0, pw / 2.0 + 20.0, box_y + box_h - 33.0)

        # Title inside cartouche (with word wrapping)
        c.setFont("Times-Bold", 20)
        c.setFillColor(Color(0.12, 0.12, 0.14, alpha=1.0))
        max_box_text_w = box_w - 36.0
        words = clean_title.split()
        lines = []
        curr_line = ""
        for w in words:
            test_line = f"{curr_line} {w}".strip()
            if c.stringWidth(test_line, "Times-Bold", 20) <= max_box_text_w:
                curr_line = test_line
            else:
                if curr_line:
                    lines.append(curr_line)
                curr_line = w
        if curr_line:
            lines.append(curr_line)

        title_y = box_y + box_h * 0.54 + (len(lines) - 1) * 13.0
        for line in lines:
            c.drawCentredString(pw / 2.0, title_y, line)
            title_y -= 26.0

        if subtitle:
            c.setFont("Times-Italic", 11.5)
            c.setFillColor(Color(0.35, 0.35, 0.38, alpha=0.9))
            c.drawCentredString(pw / 2.0, title_y - 8.0, subtitle)

        # Bottom metadata
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
        # Vertical accent line running through page
        vert_x = m + 28.0
        c.setStrokeColor(Color(0.15, 0.15, 0.18, alpha=0.18))
        c.setLineWidth(0.6)
        c.line(vert_x, m, vert_x, ph - m)

        # Horizontal header rule
        hdr_y = ph - m - 20.0
        c.line(m, hdr_y, pw - m, hdr_y)

        c.setFont("Helvetica-Bold" if not grayscale else "Times-Bold", 8.0)
        c.setFillColor(Color(0.2, 0.2, 0.25, alpha=0.9))
        c.drawString(vert_x + 14.0, hdr_y + 8.0, "VOLUME I  ·  STUDY COMPENDIUM")

        # Large modern title with word wrapping
        c.setFont("Times-Bold", 24)
        c.setFillColor(Color(0.08, 0.08, 0.10, alpha=1.0))
        max_title_w = pw - (vert_x + 14.0) - m
        words = clean_title.split()
        lines = []
        curr_line = ""
        for w in words:
            test_line = f"{curr_line} {w}".strip()
            if c.stringWidth(test_line, "Times-Bold", 24) <= max_title_w:
                curr_line = test_line
            else:
                if curr_line:
                    lines.append(curr_line)
                curr_line = w
        if curr_line:
            lines.append(curr_line)

        title_y = ph * 0.58 + (len(lines) - 1) * 15.0
        for line in lines:
            c.drawString(vert_x + 14.0, title_y, line)
            title_y -= 30.0

        if subtitle:
            c.setFont("Times-Italic", 12.5)
            c.setFillColor(Color(0.35, 0.35, 0.38, alpha=0.9))
            c.drawString(vert_x + 14.0, title_y - 6.0, subtitle)

        # Structured metadata lines
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

        # Top Super-header (understated notebook label, no software branding)
        c.setFont("Times-Roman", 8)
        c.setFillColor(Color(0.42, 0.42, 0.42, alpha=0.75))
        c.drawCentredString(pw / 2.0, ph - 95.0, "N O T E B O O K")

        # Separator accent
        c.setStrokeColor(Color(0.3, 0.3, 0.3, alpha=0.2))
        c.setLineWidth(0.4)
        c.line(pw / 2.0 - 24, ph - 105.0, pw / 2.0 + 24, ph - 105.0)

        # Main Title (centered classic serif, elegant word-wrapping)
        c.setFont("Times-Bold", 24)
        c.setFillColor(Color(0.12, 0.12, 0.14, alpha=1.0))
        words = clean_title.split()
        lines = []
        curr_line = ""
        for w in words:
            test_line = f"{curr_line} {w}".strip()
            if c.stringWidth(test_line, "Times-Bold", 24) < (pw - 2 * inset - 60):
                curr_line = test_line
            else:
                if curr_line:
                    lines.append(curr_line)
                curr_line = w
        if curr_line:
            lines.append(curr_line)

        title_y = ph * 0.58 + (len(lines) - 1) * 16.0
        for line in lines:
            c.drawCentredString(pw / 2.0, title_y, line)
            title_y -= 32.0

        # Subtitle / Subject (classic serif italic)
        if subtitle:
            c.setFont("Times-Italic", 12.5)
            c.setFillColor(Color(0.32, 0.32, 0.34, alpha=0.9))
            c.drawCentredString(pw / 2.0, title_y - 8.0, subtitle)
            title_y -= 26.0

        # Delicate divider between title and metadata
        c.setStrokeColor(Color(0.3, 0.3, 0.3, alpha=0.18))
        c.setLineWidth(0.4)
        c.line(pw / 2.0 - 32, title_y - 12.0, pw / 2.0 + 32, title_y - 12.0)

        # Author / Metadata block (subtle, timeless typography)
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

    c.save()
    packet.seek(0)
    return PdfReader(packet).pages[0]


