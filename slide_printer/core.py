"""Core transformation engine for converting slide PDFs to printable handouts."""

import os
import glob
import datetime
from typing import List, Optional, Tuple, Union, Callable
from pypdf import PdfReader, PdfWriter, Transformation
from pypdf.generic import RectangleObject, FloatObject, ArrayObject, NameObject
from pypdf._page import PageObject

from slide_printer.constants import (
    PAPER_SIZES,
    STYLE_METADATA,
    STYLE_KEY_MAP,
    DEFAULT_PAPER_SIZE,
    DEFAULT_OUTPUT_DIR,
    DEFAULT_MARGIN,
    DEFAULT_STEP,
    DEFAULT_SEPARATION,
    DEFAULT_PAGE_NUMBERS,
    DEFAULT_PAGE_NUMBER_FORMAT,
    DEFAULT_GUTTER_MARGIN,
    BINDER_GUTTER_POINTS,
    SPIRAL_GUTTER_POINTS,
    DEFAULT_BINDING,
    DEFAULT_HOLE_GUIDES,
    BINDING_GUTTER_MAP,
    BINDING_ALIASES,
    COVER_TEMPLATES,
    COVER_TEMPLATE_ALIASES,
    DEFAULT_DUPLEX,
    DEFAULT_STUDY_HEADER,
    DEFAULT_LAYOUT,
    DEFAULT_GRAYSCALE,
    DEFAULT_COVER_MODE,
)
from slide_printer.patterns import (
    create_notes_overlay,
    create_2up_notes_overlay,
    generate_cover_page,
)


def parse_page_ranges(range_str: Optional[str], total_pages: int) -> List[int]:
    """Parses a comma-separated list of 1-based page indices or ranges into 0-based indices.

    Examples:
        '1-3, 5, 8' on 10 pages -> [0, 1, 2, 4, 7]
        'all' or None -> [0, 1, ..., total_pages - 1]
    """
    if not range_str or not range_str.strip() or range_str.strip().lower() in ("all", "*"):
        return list(range(total_pages))

    indices: List[int] = []
    parts = range_str.split(",")
    for part in parts:
        clean = part.strip()
        if not clean:
            continue
        if "-" in clean:
            subparts = clean.split("-", 1)
            start_str = subparts[0].strip()
            end_str = subparts[1].strip()
            try:
                start = 1 if not start_str else int(start_str)
                end = total_pages if not end_str else int(end_str)
                step = 1 if start <= end else -1
                for p in range(start, end + step, step):
                    idx = p - 1
                    if 0 <= idx < total_pages and idx not in indices:
                        indices.append(idx)
            except ValueError:
                continue
        else:
            try:
                p = int(clean)
                idx = p - 1
                if 0 <= idx < total_pages and idx not in indices:
                    indices.append(idx)
            except ValueError:
                continue

    return indices


def transform_annotations(page: PageObject, scale: float, tx: float, ty: float) -> None:
    """Recalculate /Rect coordinates for hyperlinks and interactive annotations.
    
    Ensures that clickable areas remain aligned with the slide content after
    scaling and translation.
    """
    if "/Annots" not in page:
        return

    try:
        annots = page["/Annots"]
        for annot_ref in annots:
            try:
                annot = annot_ref.get_object()
                if "/Rect" in annot:
                    rect = annot["/Rect"]
                    x1, y1, x2, y2 = [float(val) for val in rect]
                    new_x1 = x1 * scale + tx
                    new_y1 = y1 * scale + ty
                    new_x2 = x2 * scale + tx
                    new_y2 = y2 * scale + ty
                    annot[NameObject("/Rect")] = ArrayObject([
                        FloatObject(new_x1),
                        FloatObject(new_y1),
                        FloatObject(new_x2),
                        FloatObject(new_y2),
                    ])
            except Exception:
                continue
    except Exception:
        pass


def resolve_style(style_input: str) -> str:
    """Map user/CLI style strings to canonical style ids ('blank', 'lines', 'grid', 'dots')."""
    cleaned = style_input.strip().lower()
    if cleaned in STYLE_KEY_MAP:
        return STYLE_KEY_MAP[cleaned]
    raise ValueError(f"Unknown style '{style_input}'. Valid styles: {list(STYLE_METADATA.keys())}")


class SlidePrinter:
    """Main processor for converting slides into handouts with notes."""

    def __init__(
        self,
        paper_size: Union[str, Tuple[float, float]] = DEFAULT_PAPER_SIZE,
        margin: float = DEFAULT_MARGIN,
        step: float = DEFAULT_STEP,
        separation: float = DEFAULT_SEPARATION,
        output_dir: str = DEFAULT_OUTPUT_DIR,
        page_numbers: bool = DEFAULT_PAGE_NUMBERS,
        page_number_format: str = DEFAULT_PAGE_NUMBER_FORMAT,
        study_header: bool = DEFAULT_STUDY_HEADER,
        study_title: Optional[str] = None,
        gutter_margin: Optional[float] = None,
        binding: str = DEFAULT_BINDING,
        hole_guides: bool = DEFAULT_HOLE_GUIDES,
        duplex: bool = DEFAULT_DUPLEX,
        layout: str = DEFAULT_LAYOUT,
        page_ranges: Optional[str] = None,
        grayscale: bool = DEFAULT_GRAYSCALE,
        cover_mode: str = DEFAULT_COVER_MODE,
        cover_title: Optional[str] = None,
        cover_author: Optional[str] = None,
        cover_template: str = "atelier",
    ):
        if isinstance(paper_size, str):
            paper_norm = paper_size.lower()
            if paper_norm not in PAPER_SIZES:
                raise ValueError(
                    f"Unsupported paper size '{paper_size}'. Supported: {list(PAPER_SIZES.keys())}"
                )
            self.paper_dimensions = PAPER_SIZES[paper_norm]
            self.paper_name = paper_norm
        else:
            self.paper_dimensions = paper_size
            self.paper_name = "custom"

        self.margin = float(margin)
        self.step = float(step)
        self.separation = float(separation)
        self.output_dir = output_dir
        self.page_numbers = bool(page_numbers)
        self.page_number_format = str(page_number_format)
        self.study_header = bool(study_header)
        self.study_title = study_title

        # Resolve binding type and gutter margin
        raw_b = str(binding or "none").strip().lower()
        self.binding = BINDING_ALIASES.get(raw_b, raw_b)
        self.hole_guides = bool(hole_guides)

        if gutter_margin is not None and float(gutter_margin) != DEFAULT_GUTTER_MARGIN:
            self.gutter_margin = float(gutter_margin)
            if self.binding == "none":
                if abs(self.gutter_margin - SPIRAL_GUTTER_POINTS) < 1.0:
                    self.binding = "spiral"
                elif self.gutter_margin > 0.0:
                    self.binding = "binder"
        else:
            self.gutter_margin = BINDING_GUTTER_MAP.get(self.binding, DEFAULT_GUTTER_MARGIN)

        self.duplex = bool(duplex)
        self.layout = str(layout).lower()
        self.page_ranges = page_ranges
        self.grayscale = bool(grayscale)
        self.cover_mode = str(cover_mode).lower()
        self.cover_title = cover_title
        self.cover_author = cover_author
        raw_tpl = str(cover_template).lower().strip()
        self.cover_template = COVER_TEMPLATE_ALIASES.get(raw_tpl, raw_tpl)

    def convert_slide_page(
        self,
        page: PageObject,
        style: str,
        page_number: Optional[int] = None,
        total_pages: Optional[int] = None,
        sheet_idx: int = 1,
        is_clean_cover: bool = False,
    ) -> PageObject:
        """Transforms a single presentation slide page onto target paper with notes overlay."""
        if getattr(page, "rotation", 0) != 0:
            page.transfer_rotation_to_content()

        paper_width, paper_height = self.paper_dimensions

        # Gutter calculation based on duplex and sheet_idx
        is_verso = False
        if self.duplex:
            if sheet_idx % 2 == 1:
                left_gutter = self.gutter_margin
            else:
                left_gutter = 0.0
                is_verso = True
        else:
            left_gutter = self.gutter_margin

        x_offset = self.margin + left_gutter
        available_width = paper_width - 2 * self.margin - self.gutter_margin

        orig_width = float(page.mediabox.width)
        orig_height = float(page.mediabox.height)

        if orig_width <= 0 or orig_height <= 0:
            raise ValueError(f"Invalid page dimensions: {orig_width}x{orig_height}")

        scale = available_width / orig_width
        scaled_height = orig_height * scale

        if is_clean_cover:
            y_translation = (paper_height - scaled_height) / 2.0
        else:
            header_offset = 24.0 if self.study_header else 0.0
            y_translation = paper_height - scaled_height - self.margin - header_offset

        # 1. Transform slide content and vector paths
        op = Transformation().scale(sx=scale, sy=scale).translate(tx=x_offset, ty=y_translation)
        page.add_transformation(op)

        # 2. Re-align hyperlinks
        transform_annotations(page, scale, x_offset, y_translation)

        # 3. Resize canvas to target paper format
        page.mediabox = RectangleObject([0, 0, paper_width, paper_height])
        page.cropbox = RectangleObject([0, 0, paper_width, paper_height])

        # 4. Generate & merge note overlay (unless clean cover)
        if not is_clean_cover:
            sep_y = y_translation - self.separation
            num_to_draw = page_number if (self.page_numbers and page_number is not None) else None
            header_y = (paper_height - self.margin + 4.0) if self.study_header else None
            overlay = create_notes_overlay(
                page_size=self.paper_dimensions,
                y_sep=sep_y,
                margin=x_offset,
                width=available_width,
                bottom_margin=self.margin,
                style=style,
                step=self.step,
                page_number=num_to_draw,
                total_pages=total_pages,
                page_number_format=self.page_number_format,
                study_header=self.study_header,
                study_title=self.study_title,
                header_y=header_y,
                grayscale=self.grayscale,
                binding=self.binding,
                hole_guides=self.hole_guides,
                is_verso=is_verso,
                gutter_margin=self.gutter_margin,
            )
            page.merge_page(overlay)

        return page

    def convert_2up_page(
        self,
        page1: PageObject,
        page2: Optional[PageObject],
        style: str,
        page_number: Optional[int] = None,
        total_pages: Optional[int] = None,
        sheet_idx: int = 1,
        writer: Optional[PdfWriter] = None,
    ) -> PageObject:
        """Composes two presentation slides onto a single sheet (2-Up layout)."""
        if writer is not None:
            page1.pdf = writer
            if page2 is not None:
                page2.pdf = writer

        paper_width, paper_height = self.paper_dimensions

        # Gutter calculation based on duplex and sheet_idx
        is_verso = False
        if self.duplex:
            if sheet_idx % 2 == 1:
                left_gutter = self.gutter_margin
            else:
                left_gutter = 0.0
                is_verso = True
        else:
            left_gutter = self.gutter_margin

        x_offset = self.margin + left_gutter
        available_width = paper_width - 2 * self.margin - self.gutter_margin

        half_height = paper_height / 2.0
        header_height = 22.0 if self.study_header else 0.0
        slot1_top = paper_height - self.margin - header_height
        slot1_bottom = half_height + 6.0

        # Slot 1 slide transformation
        if getattr(page1, "rotation", 0) != 0:
            page1.transfer_rotation_to_content()
        orig_w1 = float(page1.mediabox.width)
        orig_h1 = float(page1.mediabox.height)
        max_h1 = (slot1_top - slot1_bottom) * 0.58
        scale1 = min(available_width / orig_w1, max_h1 / orig_h1)
        scaled_w1 = orig_w1 * scale1
        scaled_h1 = orig_h1 * scale1
        tx1 = x_offset + (available_width - scaled_w1) / 2.0
        ty1 = slot1_top - scaled_h1
        op1 = Transformation().scale(sx=scale1, sy=scale1).translate(tx=tx1, ty=ty1)
        page1.add_transformation(op1)
        transform_annotations(page1, scale1, tx1, ty1)

        sep1_y = ty1 - self.separation

        # Slot 2 slide transformation (if page2 present)
        sep2_y = None
        slot2_bottom = self.margin
        if page2 is not None:
            if getattr(page2, "rotation", 0) != 0:
                page2.transfer_rotation_to_content()
            slot2_top = half_height - 12.0
            orig_w2 = float(page2.mediabox.width)
            orig_h2 = float(page2.mediabox.height)
            max_h2 = (slot2_top - slot2_bottom) * 0.58
            scale2 = min(available_width / orig_w2, max_h2 / orig_h2)
            scaled_w2 = orig_w2 * scale2
            scaled_h2 = orig_h2 * scale2
            tx2 = x_offset + (available_width - scaled_w2) / 2.0
            ty2 = slot2_top - scaled_h2
            op2 = Transformation().scale(sx=scale2, sy=scale2).translate(tx=tx2, ty=ty2)
            page2.add_transformation(op2)
            transform_annotations(page2, scale2, tx2, ty2)
            sep2_y = ty2 - self.separation

        # Compose into a new blank page
        if writer is not None:
            new_page = writer.add_page(PageObject.create_blank_page(width=paper_width, height=paper_height))
        else:
            new_page = PageObject.create_blank_page(width=paper_width, height=paper_height)
        new_page.merge_page(page1)
        if "/Annots" in page1:
            new_page[NameObject("/Annots")] = ArrayObject(page1["/Annots"])

        if page2 is not None:
            new_page.merge_page(page2)
            if "/Annots" in page2:
                if "/Annots" not in new_page:
                    new_page[NameObject("/Annots")] = ArrayObject(page2["/Annots"])
                else:
                    new_page["/Annots"].extend(page2["/Annots"])

        num_to_draw = page_number if (self.page_numbers and page_number is not None) else None
        header_y = (paper_height - self.margin + 4.0) if self.study_header else None
        overlay = create_2up_notes_overlay(
            page_size=self.paper_dimensions,
            margin=x_offset,
            width=available_width,
            slot1_sep_y=sep1_y,
            slot1_bottom=slot1_bottom,
            slot2_sep_y=sep2_y,
            slot2_bottom=slot2_bottom,
            style=style,
            step=self.step,
            page_number=num_to_draw,
            total_pages=total_pages,
            page_number_format=self.page_number_format,
            study_header=self.study_header,
            study_title=self.study_title,
            header_y=header_y,
            grayscale=self.grayscale,
            binding=self.binding,
            hole_guides=self.hole_guides,
            is_verso=is_verso,
            gutter_margin=self.gutter_margin,
        )
        new_page.merge_page(overlay)
        return new_page


    def process_file(
        self,
        input_path: str,
        styles: List[str],
        output_dir: Optional[str] = None,
        progress_cb: Optional[Callable[[str, int, int], None]] = None,
    ) -> List[str]:
        """Processes a single PDF file and produces output PDFs for each requested style.

        Args:
            input_path: Path to the input PDF file.
            styles: List of style names (e.g. ['blank', 'lines', 'grid', 'dots']).
            output_dir: Target output directory (overrides default).
            progress_cb: Optional callback(current_style, current_page, total_pages).

        Returns:
            List of generated output file paths.
        """
        if not os.path.isfile(input_path):
            raise FileNotFoundError(f"PDF file not found: '{input_path}'")

        out_root = output_dir or self.output_dir
        base_name = os.path.splitext(os.path.basename(input_path))[0]
        generated_files: List[str] = []

        canonical_styles = [resolve_style(s) for s in styles]

        for style in canonical_styles:
            style_meta = STYLE_METADATA[style]
            folder_name = style_meta["code"]
            style_dir = os.path.join(out_root, folder_name)
            os.makedirs(style_dir, exist_ok=True)

            reader = PdfReader(input_path)
            total_input_pages = len(reader.pages)
            selected_indices = parse_page_ranges(self.page_ranges, total_input_pages)

            writer = PdfWriter()
            has_gen_cover = (self.cover_mode == "generate")

            # Calculate total handout sheets
            if self.layout == "2-up":
                handout_sheets = (len(selected_indices) + 1) // 2
            else:
                handout_sheets = len(selected_indices)
            total_sheets = handout_sheets + (1 if has_gen_cover else 0)

            # 1. Prepend generated cover page if requested
            if has_gen_cover:
                today_str = datetime.date.today().strftime("%B %d, %Y")
                cover_title = self.cover_title or base_name.replace("_", " ").title()
                cover_page = generate_cover_page(
                    page_size=self.paper_dimensions,
                    title=cover_title,
                    subtitle=self.study_title,
                    author=self.cover_author,
                    date_str=today_str,
                    num_slides=len(selected_indices),
                    grayscale=self.grayscale,
                    template=self.cover_template,
                    binding=self.binding,
                    hole_guides=self.hole_guides,
                    is_verso=False,
                    gutter_margin=self.gutter_margin,
                )
                writer.add_page(cover_page)

            # 2. Process slides
            sheet_counter = 1 if not has_gen_cover else 2
            if self.layout == "2-up":
                for i in range(0, len(selected_indices), 2):
                    page1 = reader.pages[selected_indices[i]]
                    page2 = reader.pages[selected_indices[i + 1]] if (i + 1 < len(selected_indices)) else None
                    self.convert_2up_page(
                        page1=page1,
                        page2=page2,
                        style=style,
                        page_number=sheet_counter,
                        total_pages=total_sheets,
                        sheet_idx=sheet_counter,
                        writer=writer,
                    )
                    if progress_cb:
                        progress_cb(style, min(i + 2, len(selected_indices)), len(selected_indices))
                    sheet_counter += 1
            else:
                for idx, orig_idx in enumerate(selected_indices):
                    page = reader.pages[orig_idx]
                    is_clean = (idx == 0 and self.cover_mode == "clean_first")
                    p = writer.add_page(page)
                    self.convert_slide_page(
                        page=p,
                        style=style,
                        page_number=sheet_counter if not is_clean else None,
                        total_pages=total_sheets,
                        sheet_idx=sheet_counter,
                        is_clean_cover=is_clean,
                    )
                    if progress_cb:
                        progress_cb(style, idx + 1, len(selected_indices))
                    sheet_counter += 1

            output_file = os.path.join(style_dir, f"{base_name}_{folder_name}.pdf")
            with open(output_file, "wb") as f:
                writer.write(f)

            generated_files.append(output_file)

        return generated_files

    def process_paths(
        self,
        paths: List[str],
        styles: List[str],
        output_dir: Optional[str] = None,
        on_file_complete: Optional[Callable[[str, List[str]], None]] = None,
        progress_cb: Optional[Callable[[str, str, int, int], None]] = None,
    ) -> List[str]:
        """Resolves wildcards, folders, and individual paths, then processes all found PDFs."""
        resolved_files: List[str] = []
        for path in paths:
            path_clean = path.strip()
            if not path_clean:
                continue
            if os.path.isdir(path_clean):
                candidates = sorted(glob.glob(os.path.join(path_clean, "*.pdf")))
                filtered = [
                    c for c in candidates
                    if not any(c.lower().endswith(f"_{s}.pdf") for s in ("grid", "lines", "dots", "blank"))
                ]
                resolved_files.extend(filtered if filtered else candidates)
            elif "*" in path_clean or "?" in path_clean:
                resolved_files.extend(sorted(glob.glob(path_clean)))
            else:
                target = path_clean if path_clean.lower().endswith(".pdf") else f"{path_clean}.pdf"
                if os.path.isfile(target):
                    resolved_files.append(target)
                else:
                    raise FileNotFoundError(f"File not found: '{path_clean}'")

        # Deduplicate while preserving order
        unique_files: List[str] = []
        for f in resolved_files:
            abs_p = os.path.abspath(f)
            if abs_p not in [os.path.abspath(u) for u in unique_files]:
                unique_files.append(f)

        all_generated: List[str] = []
        for file_path in unique_files:
            file_progress = None
            if progress_cb:
                file_progress = lambda style, cur, tot, fp=file_path: progress_cb(fp, style, cur, tot)
            generated = self.process_file(file_path, styles, output_dir=output_dir, progress_cb=file_progress)
            all_generated.extend(generated)
            if on_file_complete:
                on_file_complete(file_path, generated)

        return all_generated
