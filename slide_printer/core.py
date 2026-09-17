"""Core transformation engine for converting slide PDFs to printable handouts."""

import os
import glob
from typing import List, Optional, Tuple, Union, Callable
from pypdf import PdfReader, PdfWriter, Transformation
from pypdf.generic import RectangleObject, FloatObject, ArrayObject
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
)
from slide_printer.patterns import create_notes_overlay


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
                    annot[RectangleObject("/Rect")] = ArrayObject([
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

    def convert_slide_page(
        self,
        page: PageObject,
        style: str,
    ) -> PageObject:
        """Transforms a single presentation slide page onto target paper with notes overlay."""
        # Normalize rotation if any
        if getattr(page, "rotation", 0) != 0:
            page.transfer_rotation_to_content()

        paper_width, paper_height = self.paper_dimensions
        available_width = paper_width - 2 * self.margin

        orig_width = float(page.mediabox.width)
        orig_height = float(page.mediabox.height)

        if orig_width <= 0 or orig_height <= 0:
            raise ValueError(f"Invalid page dimensions: {orig_width}x{orig_height}")

        scale = available_width / orig_width
        scaled_height = orig_height * scale
        y_translation = paper_height - scaled_height - self.margin

        # 1. Transform slide content and vector paths
        op = Transformation().scale(sx=scale, sy=scale).translate(tx=self.margin, ty=y_translation)
        page.add_transformation(op)

        # 2. Re-align hyperlinks
        transform_annotations(page, scale, self.margin, y_translation)

        # 3. Resize canvas to target paper format
        page.mediabox = RectangleObject([0, 0, paper_width, paper_height])
        page.cropbox = RectangleObject([0, 0, paper_width, paper_height])

        # 4. Generate & merge note overlay
        sep_y = y_translation - self.separation
        overlay = create_notes_overlay(
            page_size=self.paper_dimensions,
            y_sep=sep_y,
            margin=self.margin,
            width=available_width,
            bottom_margin=self.margin,
            style=style,
            step=self.step,
        )
        page.merge_page(overlay)

        return page

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

            # Use clone_from to instantiate writer with pages attached directly
            writer = PdfWriter(clone_from=input_path)
            total_pages = len(writer.pages)

            for idx, page in enumerate(writer.pages):
                self.convert_slide_page(page, style)
                if progress_cb:
                    progress_cb(style, idx + 1, total_pages)

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
    ) -> List[str]:
        """Resolves wildcards, folders, and individual paths, then processes all found PDFs."""
        resolved_files: List[str] = []
        for path in paths:
            path_clean = path.strip()
            if not path_clean:
                continue
            if os.path.isdir(path_clean):
                resolved_files.extend(sorted(glob.glob(os.path.join(path_clean, "*.pdf"))))
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
            generated = self.process_file(file_path, styles, output_dir=output_dir)
            all_generated.extend(generated)
            if on_file_complete:
                on_file_complete(file_path, generated)

        return all_generated
