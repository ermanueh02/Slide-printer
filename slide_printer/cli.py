"""Command-line interface for Slide-Printer.

Converts PDF presentations into printable study handouts with note-taking areas.
Includes interactive wizard, live progress bars, PPTX guidance, and local web studio launcher.
"""

import os
import sys
import glob
import time
import argparse
import subprocess
import re
from typing import List, Optional, Tuple, Dict, Any, Union

from pypdf import PdfReader

from slide_printer import __version__
from slide_printer.constants import (
    PAPER_SIZES,
    STYLE_METADATA,
    STYLE_KEY_MAP,
    DEFAULT_PAPER_SIZE,
    DEFAULT_OUTPUT_DIR,
    DEFAULT_MARGIN,
    DEFAULT_STEP,
    DEFAULT_PAGE_NUMBERS,
)
from slide_printer.core import SlidePrinter, resolve_style


# --- Terminal & ANSI Formatting Utilities ---

def _enable_windows_ansi() -> bool:
    """Enables Virtual Terminal Processing in Windows Console (Windows 10+)."""
    if sys.platform == "win32":
        try:
            import ctypes
            kernel32 = ctypes.windll.kernel32
            h_stdout = kernel32.GetStdHandle(-11)  # STD_OUTPUT_HANDLE
            mode = ctypes.c_ulong()
            if kernel32.GetConsoleMode(h_stdout, ctypes.byref(mode)):
                # ENABLE_VIRTUAL_TERMINAL_PROCESSING = 0x0004
                mode.value |= 0x0004
                return bool(kernel32.SetConsoleMode(h_stdout, mode))
        except Exception:
            try:
                os.system("")
                return True
            except Exception:
                pass
    return False


_enable_windows_ansi()

if hasattr(sys.stdout, "reconfigure"):
    try:
        sys.stdout.reconfigure(encoding="utf-8")
        sys.stderr.reconfigure(encoding="utf-8")
    except Exception:
        pass


def _is_color_supported() -> bool:
    """Checks if the current terminal environment supports ANSI escape sequences."""
    if os.environ.get("NO_COLOR"):
        return False
    if not sys.stdout.isatty():
        return False
    return True


USE_COLOR = _is_color_supported()


def _c(code: str, text: Any) -> str:
    return f"\033[{code}m{text}\033[0m" if USE_COLOR else str(text)


def bold(text: Any) -> str:
    return _c("1", text)


def dim(text: Any) -> str:
    return _c("2", text)


def green(text: Any) -> str:
    return _c("32", text)


def cyan(text: Any) -> str:
    return _c("36", text)


def yellow(text: Any) -> str:
    return _c("33", text)


def red(text: Any) -> str:
    return _c("31", text)


def magenta(text: Any) -> str:
    return _c("35", text)


def format_bytes(num_bytes: int) -> str:
    """Formats bytes into human-readable size string."""
    if num_bytes < 1024:
        return f"{num_bytes} B"
    for unit in ["KB", "MB", "GB"]:
        num_bytes /= 1024.0
        if num_bytes < 1024.0:
            return f"{num_bytes:.1f} {unit}"
    return f"{num_bytes:.1f} TB"


def render_progress_bar(current: int, total: int, width: int = 20) -> str:
    """Renders a Unicode progress bar: [████████░░░░] 60%."""
    if total <= 0:
        pct = 1.0
    else:
        pct = min(max(current / total, 0.0), 1.0)
    filled = int(round(width * pct))
    bar = "█" * filled + "░" * (width - filled)
    return f"[{bar}] {int(pct * 100):>3}% ({current}/{total})"


def open_path_in_os(target_path: str) -> None:
    """Opens a file or directory in the default system application / file manager."""
    try:
        abs_path = os.path.abspath(target_path)
        if sys.platform.startswith("win"):
            os.startfile(abs_path)
        elif sys.platform.startswith("darwin"):
            subprocess.run(["open", abs_path], check=False)
        else:
            subprocess.run(["xdg-open", abs_path], check=False)
    except Exception as e:
        print(dim(f"Could not open '{target_path}': {e}"))


def check_pptx_file(path: str) -> Tuple[bool, Optional[str]]:
    """Checks if a path is a PowerPoint file and prints helpful conversion guidance.
    
    Returns:
        (is_pptx, matching_pdf_path)
    """
    clean_path = path.strip("\"'")
    lower = clean_path.lower()
    if lower.endswith(".pptx") or lower.endswith(".ppt"):
        base = os.path.splitext(clean_path)[0]
        pdf_candidate = base + ".pdf"
        matching_pdf = pdf_candidate if os.path.isfile(pdf_candidate) else None

        print(yellow(f"\n💡 PowerPoint presentation detected: '{clean_path}'"))
        print(dim("   Slide-Printer operates directly on PDF to guarantee 100% exact vector layout,"))
        print(dim("   embedded fonts, mathematical formulas, and active hyperlinks."))
        print(bold("   To convert in PowerPoint:"))
        print(dim("   1. File > Export > Create PDF/XPS (or Ctrl+P -> Microsoft Print to PDF)"))
        print(dim(f"   2. Save as '{os.path.basename(pdf_candidate)}'"))

        if matching_pdf:
            print(green(f"\n   ✔ Found matching PDF: '{matching_pdf}'"))
        else:
            print(cyan(f"   Then run: slide-printer -i \"{pdf_candidate}\"\n"))

        return True, matching_pdf
    return False, None


def get_pdf_page_count(path: str) -> Optional[int]:
    """Quickly extracts slide page count from a PDF file."""
    try:
        reader = PdfReader(path)
        return len(reader.pages)
    except Exception:
        return None


def parse_index_ranges(expr: str, max_count: int) -> Optional[List[int]]:
    """Parses index selections and ranges such as '1-3, 5' or '1, 3, 5-7'.

    Returns:
        List of 0-based unique indices if expr is a valid selection, or None
        if expr does not represent an index expression.
    Raises:
        ValueError: If an index in a valid expression is out of range (e.g. > max_count or < 1).
    """
    clean = expr.strip()
    if not clean:
        return None

    import re
    # Must contain only digits, commas, hyphens, spaces, semicolons
    if not re.match(r"^[\d\s,;\-]+$", clean):
        return None

    # Must contain at least one digit
    if not re.search(r"\d", clean):
        return None

    parts = [p.strip() for p in clean.replace(";", ",").split(",") if p.strip()]
    indices: List[int] = []

    for part in parts:
        if "-" in part:
            sub = [s.strip() for s in part.split("-")]
            if len(sub) == 2 and (sub[0].isdigit() or sub[0] == "") and (sub[1].isdigit() or sub[1] == ""):
                if not sub[0] and not sub[1]:
                    return None
                start = 1 if not sub[0] else int(sub[0])
                end = max_count if not sub[1] else int(sub[1])
                step = 1 if start <= end else -1
                for val in range(start, end + step, step):
                    if 1 <= val <= max_count:
                        zero_idx = val - 1
                        if zero_idx not in indices:
                            indices.append(zero_idx)
                    else:
                        raise ValueError(f"Index {val} is out of range (found {max_count} presentations).")
            else:
                return None
        elif part.isdigit():
            val = int(part)
            if 1 <= val <= max_count:
                zero_idx = val - 1
                if zero_idx not in indices:
                    indices.append(zero_idx)
            else:
                raise ValueError(f"Index {val} is out of range (found {max_count} presentations).")
        else:
            return None

    return indices if indices else None


def parse_styles_arg(raw_input: Union[str, List[str], None]) -> List[str]:
    """Parses style selections from CLI args or wizard input into canonical style codes.
    
    Supports:
      - Individual styles: 'grid', 'lines', 'dots', 'blank'
      - Numbers: '1' (grid), '2' (lines), '3' (dots), '4' (blank)
      - Ranges: '1-2' (grid, lines), '2-3', '1-3', etc.
      - Lists & natural separators: 'lines, grid', 'lines and grid', '1, 2', '1 + 2'
      - Wildcards / all: 'all', 'a', '*', 'todos'
    """
    if not raw_input:
        return ["grid"]

    style_code_map = {
        "1": "grid",
        "2": "lines",
        "3": "dots",
        "4": "blank",
        "grid": "grid",
        "cuadricula": "grid",
        "lines": "lines",
        "line": "lines",
        "lineas": "lines",
        "ruled": "lines",
        "dots": "dots",
        "dot": "dots",
        "puntos": "dots",
        "blank": "blank",
        "blanco": "blank",
        "en_blanco": "blank",
    }

    raw_items: List[str] = []
    if isinstance(raw_input, str):
        raw_items = [raw_input]
    else:
        raw_items = list(raw_input)

    tokens: List[str] = []
    for item in raw_items:
        cleaned = item.replace(",", " ").replace("+", " ").replace("&", " ")
        cleaned = re.sub(r'\b(and|y|e)\b', ' ', cleaned, flags=re.IGNORECASE)
        for part in cleaned.split():
            p = part.strip().lower()
            if p:
                tokens.append(p)

    if any(t in ("all", "a", "*", "todos") for t in tokens):
        return ["grid", "lines", "dots", "blank"]

    resolved: List[str] = []
    for tok in tokens:
        # Check range pattern e.g. "1-2"
        if "-" in tok:
            sub = tok.split("-")
            if len(sub) == 2 and sub[0].strip().isdigit() and sub[1].strip().isdigit():
                start, end = int(sub[0].strip()), int(sub[1].strip())
                step = 1 if start <= end else -1
                for n in range(start, end + step, step):
                    s_str = str(n)
                    if s_str in style_code_map:
                        code = style_code_map[s_str]
                        if code not in resolved:
                            resolved.append(code)
                    else:
                        raise ValueError(f"Style number {n} is invalid. Supported: 1 (grid), 2 (lines), 3 (dots), 4 (blank).")
                continue

        if tok in style_code_map:
            code = style_code_map[tok]
            if code not in resolved:
                resolved.append(code)
        else:
            try:
                code = resolve_style(tok)
                if code not in resolved:
                    resolved.append(code)
            except ValueError:
                raise ValueError(
                    f"Unknown style '{tok}'. Valid styles: grid, lines, dots, blank (or numbers 1-4, ranges like 1-2)."
                )

    return resolved if resolved else ["grid"]


def print_summary_table(rows: List[Dict[str, Any]], elapsed: float, out_dir: str, paper: str) -> None:
    """Prints a polished Unicode summary table of processed presentations."""
    if not rows:
        return

    # Calculate column widths
    w_name = max(len("Source Presentation"), max(len(os.path.basename(r["name"])) for r in rows))
    w_name = min(max(w_name, 22), 40)
    w_pages = max(len("Slides"), max(len(str(r["slides"])) for r in rows))
    w_out = max(len("Generated Output"), max(len(str(r["output"])) for r in rows))
    w_out = min(max(w_out, 18), 35)

    d1 = w_name + 2
    d2 = w_pages + 2
    d3 = w_out + 2
    total_inner = d1 + d2 + d3 + 2

    top = f"╭{'─' * total_inner}╮"
    hdr_title = "Slide-Printer · Run Summary"
    title_line = f"│ {bold(hdr_title.center(total_inner - 2))} │"
    mid = f"├{'─' * d1}┬{'─' * d2}┬{'─' * d3}┤"
    header = f"│ {bold('Source Presentation'.ljust(w_name))} │ {bold('Slides'.rjust(w_pages))} │ {bold('Generated Output'.ljust(w_out))} │"
    sep = f"├{'─' * d1}┼{'─' * d2}┼{'─' * d3}┤"
    bot = f"╰{'─' * d1}┴{'─' * d2}┴{'─' * d3}╯"

    print(top)
    print(title_line)
    print(mid)
    print(header)
    print(sep)

    total_handouts = 0
    for r in rows:
        base = os.path.basename(r["name"])
        if len(base) > w_name:
            base = base[: w_name - 3] + "..."
        name_str = base.ljust(w_name)
        pages_str = str(r["slides"]).rjust(w_pages)
        out_raw = str(r["output"])
        if len(out_raw) > w_out:
            out_raw = out_raw[: w_out - 3] + "..."
        out_str = out_raw.ljust(w_out)
        total_handouts += r.get("count", 1)
        print(f"│ {name_str} │ {pages_str} │ {green(out_str)} │")

    print(bot)
    print(bold(f"\n{green('✔')} Successfully generated {total_handouts} handout(s) in {elapsed:.2f}s."))
    print(dim(f"   Paper: {paper.upper()} · Output Directory: {os.path.abspath(out_dir)}\n"))


# --- Interactive Wizard ---

def interactive_wizard() -> int:
    """Runs an interactive terminal wizard with presentation detection and drag-and-drop support."""
    wizard_hdr = f"Slide-Printer v{__version__} · Terminal Studio Wizard"
    box_w = 60
    print(bold(f"\n╭{'─' * box_w}╮"))
    print(bold(f"│ {wizard_hdr.center(box_w - 2)} │"))
    print(bold(f"╰{'─' * box_w}╯\n"))

    # 1. Note Style Selection
    print(bold("1. Choose Note Style:"))
    print(f"  [{cyan('1')}] Graph grid   (Technical grid for diagrams and notes) {dim('[default]')}")
    print(f"  [{cyan('2')}] Ruled lines  (~5mm handwriting lines for study notes)")
    print(f"  [{cyan('3')}] Dot matrix   (Subtle dot grid for flexible bullet notes)")
    print(f"  [{cyan('4')}] Blank        (Clean blank space with hairline divider)")
    print(f"  [{cyan('A')}] All 4 styles (Generate all 4 note variants at once)")
    print(dim("  - Enter numbers or names (e.g. '1, 2' for Grid + Lined, '1-2', 'lines grid', or 'A' for all)."))

    raw_selection = input(f"\nEnter choice [{bold('1')}, 2, 3, 4, or A] (default: 1): ").strip()
    try:
        selected_styles = parse_styles_arg(raw_selection)
    except ValueError as err:
        print(yellow(f"⚠️  {err} Defaulting to 'Graph grid' (grid)."))
        selected_styles = ["grid"]

    # 2. Paper Size Selection
    print(bold("\n2. Target Paper Format:"))
    print(f"  [{cyan('1')}] DIN A4      (210 × 297 mm) {dim('[default]')}")
    print(f"  [{cyan('2')}] US Letter   (8.5 × 11 in)")
    print(f"  [{cyan('3')}] US Legal    (8.5 × 14 in)")
    print(f"  [{cyan('4')}] DIN A3      (297 × 420 mm)")

    paper_choice = input(f"\nEnter paper choice [{bold('1')}, 2, 3, 4] (default: 1): ").strip()
    paper_map = {"1": "a4", "2": "letter", "3": "legal", "4": "a3"}
    selected_paper = paper_map.get(paper_choice, "a4")

    # 3. Detect presentations in current directory
    all_pdfs = sorted(glob.glob("*.pdf"))
    presentation_pdfs = [
        f for f in all_pdfs
        if not any(f.lower().endswith(f"_{s}.pdf") for s in ("grid", "lines", "dots", "blank"))
    ]
    local_pdfs = presentation_pdfs if presentation_pdfs else all_pdfs
    local_pdf_info: List[Tuple[str, Optional[int], int]] = []
    for f in local_pdfs:
        pgs = get_pdf_page_count(f)
        size = os.path.getsize(f) if os.path.isfile(f) else 0
        local_pdf_info.append((f, pgs, size))

    print(bold("\n3. Select Presentation File(s):"))
    if local_pdf_info:
        print(dim(f"Found {len(local_pdf_info)} presentation PDF(s) in current directory:"))
        for i, (pdf_name, pgs, sz) in enumerate(local_pdf_info, 1):
            pgs_label = f"{pgs} slides" if pgs is not None else "PDF"
            sz_label = format_bytes(sz)
            print(f"  [{cyan(str(i))}] {pdf_name} {dim(f'({pgs_label} · {sz_label})')}")
        print(dim(f"\n  - Press Enter to process current directory '.' {bold('[default]')}"))
        print(dim(f"  - Select files by number or range (e.g. '1-3, 5', '2', or '*' for all)."))
    else:
        print(dim("  No presentation PDF files detected in current directory."))
        print(dim("  - Drag & drop any PDF or folder directly into this terminal."))
        print(dim(f"  - Press Enter to scan current directory '.' {bold('[default]')}"))

    entry = input(bold("\nYour choice (default: current directory '.'): ")).strip()

    if not entry:
        entry = "."

    # Clean quotes from drag & drop
    entry = entry.strip("\"'")

    # Check for PPTX input
    is_pptx, matching_pdf = check_pptx_file(entry)
    if is_pptx:
        if matching_pdf:
            use_pdf = input(bold("Would you like to process the matching PDF instead? [Y/n]: ")).strip().lower()
            if use_pdf in ("", "y", "yes"):
                entry = matching_pdf
            else:
                return 1
        else:
            return 1

    files_to_process: List[str] = []

    # Check if user typed a number or range matching local_pdfs (e.g. '1-3, 5')
    if local_pdf_info:
        try:
            matched_indices = parse_index_ranges(entry, len(local_pdf_info))
        except ValueError as err:
            print(red(f"❌ {err}"))
            return 1

        if matched_indices is not None:
            files_to_process = [local_pdf_info[i][0] for i in matched_indices]

    if not files_to_process:
        if local_pdf_info and entry in ("*", "all", "a", "A"):
            files_to_process = [p[0] for p in local_pdf_info]
        elif entry == ".":
            files_to_process = [p[0] for p in local_pdf_info]
        elif os.path.isdir(entry):
            files_to_process = sorted(glob.glob(os.path.join(entry, "*.pdf")))
        else:
            # Delimited list or single file
            delimiter = ";" if ";" in entry else "|"
            items = [item.strip().strip("\"'") for item in entry.split(delimiter) if item.strip()]
            for item in items:
                is_p, match_pdf = check_pptx_file(item)
                if is_p:
                    if match_pdf:
                        files_to_process.append(match_pdf)
                    continue
                path = item if item.lower().endswith(".pdf") else f"{item}.pdf"
                if os.path.isfile(path):
                    files_to_process.append(path)
                else:
                    print(yellow(f"⚠️  File not found: '{path}'. Skipping..."))

    if not files_to_process:
        print(red("❌ No valid PDF presentations found to process."))
        return 1

    style_names = [STYLE_METADATA[s]["name"] for s in selected_styles]
    print(f"\n🚀 Processing {bold(str(len(files_to_process)))} presentation(s) into {cyan(selected_paper.upper())} with: {cyan(', '.join(style_names))}...\n")

    printer = SlidePrinter(
        paper_size=selected_paper,
        margin=DEFAULT_MARGIN,
        step=DEFAULT_STEP,
        output_dir=DEFAULT_OUTPUT_DIR,
    )

    t0 = time.time()
    summary_rows: List[Dict[str, Any]] = []
    first_output = None

    for i, path in enumerate(files_to_process, 1):
        pages = get_pdf_page_count(path) or 0
        pages_text = f" ({pages} slides)" if pages else ""
        print(bold(f"[{i}/{len(files_to_process)}] {os.path.basename(path)}{dim(pages_text)}"))

        # Progress tracking per style
        current_style_holder = [""]

        def on_slide_progress(style: str, cur_p: int, tot_p: int) -> None:
            if sys.stdout.isatty():
                bar = render_progress_bar(cur_p, tot_p, width=20)
                st_name = STYLE_METADATA[style]["name"]
                sys.stdout.write(f"\r   ├─ {cyan(st_name)}: {bar}")
                sys.stdout.flush()

        try:
            generated = printer.process_file(
                path,
                selected_styles,
                progress_cb=on_slide_progress,
            )
            if sys.stdout.isatty():
                sys.stdout.write("\r" + " " * 75 + "\r")  # Clear progress line
                sys.stdout.flush()

            for gen in generated:
                if not first_output:
                    first_output = gen
                folder = os.path.basename(os.path.dirname(gen))
                print(f"   ├─ {cyan(folder):<7} {green('✔')} {gen}")

            summary_rows.append({
                "name": path,
                "slides": pages,
                "output": f"{len(generated)} files ({', '.join(selected_styles)})",
                "count": len(generated),
            })
        except Exception as e:
            print(f"   {red('✖')} Error processing '{path}': {e}")

    elapsed = time.time() - t0
    print()
    print_summary_table(summary_rows, elapsed, DEFAULT_OUTPUT_DIR, selected_paper)

    if first_output and os.path.exists(first_output):
        open_choice = input(dim("Open output folder now? [Y/n]: ")).strip().lower()
        if open_choice in ("", "y", "yes"):
            open_path_in_os(os.path.dirname(first_output))

    return 0


# --- Command-Line Argument Parser ---

def parse_args(args: Optional[List[str]] = None) -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        prog="slide-printer",
        description="Transform PDF presentations into printable study handouts with note-taking space.",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  slide-printer                                  Launch interactive studio wizard
  slide-printer -i lecture.pdf -s lines          Generate ruled lines handout (A4)
  slide-printer -i *.pdf -s all -o my_handouts   Convert all PDFs with all 4 styles
  slide-printer -i slides.pdf -p letter -s grid  US Letter paper with technical grid
  slide-printer -i slides.pdf -O                 Auto-open output folder on finish
  slide-printer --dry-run -i slides.pdf -s all   Preview outputs without writing
  slide-printer --web                            Launch local browser studio (port 8000)
        """,
    )
    parser.add_argument(
        "-i",
        "--input",
        nargs="+",
        help="Input PDF presentation(s), folder, or wildcards (e.g. slides.pdf, *.pdf, ./lectures/).",
    )
    parser.add_argument(
        "-s",
        "--styles",
        nargs="+",
        default=["grid"],
        help="Note styles: 'grid', 'lines', 'dots', 'blank', numbers (1-4), ranges ('1-2'), or 'all'. Multiple allowed (default: 'grid').",
    )
    parser.add_argument(
        "-o",
        "--output-dir",
        default=DEFAULT_OUTPUT_DIR,
        help=f"Output directory for generated handouts (default: '{DEFAULT_OUTPUT_DIR}').",
    )
    parser.add_argument(
        "-p",
        "--paper-size",
        choices=list(PAPER_SIZES.keys()),
        default=DEFAULT_PAPER_SIZE,
        help=f"Target printable paper size (default: '{DEFAULT_PAPER_SIZE}').",
    )
    parser.add_argument(
        "-m",
        "--margin",
        type=float,
        default=DEFAULT_MARGIN,
        help=f"Page margin in points (default: {DEFAULT_MARGIN}).",
    )
    parser.add_argument(
        "--step",
        type=float,
        default=DEFAULT_STEP,
        help=f"Line or grid dot spacing in points (default: {DEFAULT_STEP}).",
    )
    parser.add_argument(
        "--no-page-numbers",
        dest="page_numbers",
        action="store_false",
        default=DEFAULT_PAGE_NUMBERS,
        help="Disable centered page numbers in the footer (page numbers are ON by default).",
    )
    parser.add_argument(
        "--page-numbers",
        dest="page_numbers",
        action="store_true",
        default=DEFAULT_PAGE_NUMBERS,
        help="Enable centered page numbers in the footer (default: ON).",
    )
    parser.add_argument(
        "--page-format",
        choices=["total", "simple"],
        default="total",
        help="Page number format: 'total' ('1 / 24') or 'simple' ('1') (default: total).",
    )
    parser.add_argument(
        "--pages",
        type=str,
        default=None,
        help="Specific slide numbers or ranges to include (e.g. '1-10, 15, 20-30').",
    )
    parser.add_argument(
        "--study-header",
        action="store_true",
        default=False,
        help="Include study header (Subject/Topic and Date lines) at the top of each sheet.",
    )
    parser.add_argument(
        "--study-title",
        type=str,
        default=None,
        help="Custom Subject or Topic name for the study header.",
    )
    parser.add_argument(
        "--binder-margin",
        "--gutter",
        dest="gutter",
        type=float,
        nargs="?",
        const=30.0,
        default=0.0,
        help="Add extra margin for ring binders or spiral binding (+30 pt / ~11 mm).",
    )
    parser.add_argument(
        "--duplex",
        action="store_true",
        default=False,
        help="Enable double-sided printing margin alternation (odd pages on left, even pages on right).",
    )
    parser.add_argument(
        "--simplex",
        dest="duplex",
        action="store_false",
        help="Single-sided printing: binding margin is always on the left edge (default).",
    )
    parser.add_argument(
        "--clean-cover",
        action="store_true",
        default=False,
        help="Use the first presentation slide as a clean cover without note lines or divider.",
    )
    parser.add_argument(
        "--generate-cover",
        action="store_true",
        default=False,
        help="Generate an elegant editorial cover page at the beginning of the handout.",
    )
    parser.add_argument(
        "--cover-template",
        choices=["atelier", "george", "monograph", "bauhaus"],
        default="atelier",
        help="Editorial cover template: 'atelier' (Zara Home classic), 'george' (90s executive brief), 'monograph' (archival bookplate), 'bauhaus' (Swiss modernist) (default: atelier).",
    )
    parser.add_argument(
        "--cover-title",
        type=str,
        default=None,
        help="Custom main title for the generated cover page.",
    )
    parser.add_argument(
        "--cover-author",
        type=str,
        default=None,
        help="Student, author, or presenter name for the generated cover page.",
    )
    parser.add_argument(
        "--layout",
        choices=["1-up", "2-up"],
        default="1-up",
        help="Handout layout: '1-up' (1 slide/sheet) or '2-up' (2 slides/sheet) (default: 1-up).",
    )
    parser.add_argument(
        "-2",
        "--two-up",
        dest="layout",
        action="store_const",
        const="2-up",
        help="Shortcut for --layout 2-up (2 slides per sheet).",
    )
    parser.add_argument(
        "--grayscale",
        "--eco",
        dest="grayscale",
        action="store_true",
        default=False,
        help="Eco-print mode: optimize tones for monochrome / black-and-white printing.",
    )
    parser.add_argument(
        "-O",
        "--open",
        action="store_true",
        help="Automatically open the output folder or generated handout in OS upon completion.",
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Simulate execution: inspect slide counts and output paths without modifying disk.",
    )
    parser.add_argument(
        "--web",
        action="store_true",
        help="Launch the offline local Web Studio in your default browser.",
    )
    parser.add_argument(
        "--port",
        type=int,
        default=8000,
        help="Port for the local web server (default: 8000).",
    )
    parser.add_argument(
        "--interactive",
        action="store_true",
        help="Force interactive prompt wizard.",
    )
    parser.add_argument(
        "-q",
        "--quiet",
        action="store_true",
        help="Quiet mode: suppress non-error logs and progress meters.",
    )
    parser.add_argument(
        "-v",
        "--version",
        action="version",
        version=f"%(prog)s {__version__}",
    )
    return parser.parse_args(args)


def launch_web_ui(port: int = 8000) -> int:
    """Launches local web server for the offline web app studio."""
    import http.server
    import socketserver
    import webbrowser
    from functools import partial

    base_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    web_dir = os.path.join(base_dir, "web")
    if not os.path.isdir(web_dir):
        web_dir = os.path.join(os.path.dirname(os.path.abspath(__file__)), "web")
    if not os.path.isdir(web_dir):
        print(f"Error: Web directory not found at '{web_dir}'.", file=sys.stderr)
        return 1

    handler = partial(http.server.SimpleHTTPRequestHandler, directory=web_dir)
    socketserver.TCPServer.allow_reuse_address = True
    try:
        with socketserver.TCPServer(("127.0.0.1", port), handler) as httpd:
            url = f"http://127.0.0.1:{port}"
            web_hdr = f"Slide-Printer Web Studio · {url}"
            box_w = max(len(web_hdr) + 4, 60)
            print(bold(f"\n╭{'─' * box_w}╮"))
            print(bold(f"│ {web_hdr.center(box_w - 2)} │"))
            print(bold(f"╰{'─' * box_w}╯"))
            print(dim("100% Private · Zero cloud uploads · Running locally."))
            print(dim("Press Ctrl+C to stop the server.\n"))
            webbrowser.open(url)
            try:
                httpd.serve_forever()
            except KeyboardInterrupt:
                print(dim("\nServer stopped."))
                return 0
    except OSError as e:
        print(red(f"Could not bind to port {port}: {e}"), file=sys.stderr)
        return 1


# --- Main Application Execution ---

def main(argv: Optional[List[str]] = None) -> int:
    """Main CLI entrypoint."""
    if argv is None:
        argv = sys.argv[1:]

    if "--web" in argv:
        args = parse_args(argv)
        return launch_web_ui(port=args.port)

    # If no arguments provided or explicitly requested interactive
    if (len(argv) == 0 and sys.stdin.isatty()) or "--interactive" in argv:
        return interactive_wizard()

    args = parse_args(argv)

    if not args.input:
        if sys.stdin.isatty():
            return interactive_wizard()
        print(red("Error: No input files specified. Use -i/--input or run interactive mode."), file=sys.stderr)
        return 1

    # Check for PowerPoint files in input arguments
    processed_inputs: List[str] = []
    for inp in args.input:
        is_p, match_pdf = check_pptx_file(inp)
        if is_p:
            if match_pdf:
                processed_inputs.append(match_pdf)
            else:
                continue
        else:
            processed_inputs.append(inp)

    if not processed_inputs:
        print(red("Error: No valid PDF presentations specified."), file=sys.stderr)
        return 1

    # Resolve requested styles
    try:
        chosen_styles = parse_styles_arg(args.styles)
    except ValueError as err:
        print(red(f"Error: {err}"), file=sys.stderr)
        return 1

    cover_mode = "none"
    if args.generate_cover:
        cover_mode = "generate"
    elif args.clean_cover:
        cover_mode = "clean_first"

    printer = SlidePrinter(
        paper_size=args.paper_size,
        margin=args.margin,
        step=args.step,
        output_dir=args.output_dir,
        page_numbers=args.page_numbers,
        page_number_format=args.page_format,
        study_header=args.study_header,
        study_title=args.study_title,
        gutter_margin=args.gutter,
        duplex=args.duplex,
        layout=args.layout,
        page_ranges=args.pages,
        grayscale=args.grayscale,
        cover_mode=cover_mode,
        cover_template=getattr(args, "cover_template", "atelier"),
        cover_title=args.cover_title,
        cover_author=args.cover_author,
    )

    t0 = time.time()
    paper_dim = printer.paper_dimensions

    if not args.quiet:
        print(bold(f"\n● Slide-Printer v{__version__}"))
        print(f"  Target : {cyan(args.paper_size.upper())} ({paper_dim[0]:.1f} × {paper_dim[1]:.1f} pt) · Margin: {args.margin:.0f} pt · Spacing: {args.step:.0f} pt")
        style_labels = [STYLE_METADATA[s]["name"] for s in chosen_styles]
        print(f"  Styles : {cyan(', '.join(style_labels))}")
        print(f"  Output : {dim(args.output_dir)}\n")

    # Dry-run handling
    if args.dry_run:
        print(yellow("🔍 DRY-RUN MODE: Simulating handout generation without writing to disk.\n"))
        total_slides = 0
        total_files = 0
        for inp in processed_inputs:
            candidates = glob.glob(inp) if ("*" in inp or "?" in inp) else [inp]
            for cand in candidates:
                if os.path.isfile(cand) and cand.lower().endswith(".pdf"):
                    pgs = get_pdf_page_count(cand) or 0
                    total_slides += pgs
                    print(f"  {bold(cand)} ({pgs} slides)")
                    for st in chosen_styles:
                        code = STYLE_METADATA[st]["code"]
                        base = os.path.splitext(os.path.basename(cand))[0]
                        dest = os.path.join(args.output_dir, code, f"{base}_{code}.pdf")
                        print(f"   ├─ {cyan(code):<7} ➜ {dest}")
                        total_files += 1
        print(bold(f"\nDry-run complete: Would generate {total_files} handouts ({total_slides} total slides)."))
        return 0

    summary_rows: List[Dict[str, Any]] = []

    def on_file_done(src: str, outputs: List[str]):
        if not args.quiet:
            pages = get_pdf_page_count(src) or 0
            pages_text = f" ({pages} slides)" if pages else ""
            print(f"  {bold(src)}{dim(pages_text)}")
            for out in outputs:
                style_name = os.path.basename(os.path.dirname(out))
                print(f"   ├─ {cyan(style_name):<7} {green('✔')} {out}")
            summary_rows.append({
                "name": src,
                "slides": pages,
                "output": f"{len(outputs)} handouts",
                "count": len(outputs),
            })

    def on_progress(file_path: str, style: str, cur_p: int, tot_p: int):
        if not args.quiet and sys.stdout.isatty():
            bar = render_progress_bar(cur_p, tot_p, width=16)
            st_name = STYLE_METADATA[style]["code"]
            base = os.path.basename(file_path)
            sys.stdout.write(f"\r  [{cyan(st_name)}] {base[:18]}: {bar} ")
            sys.stdout.flush()

    try:
        results = printer.process_paths(
            paths=processed_inputs,
            styles=chosen_styles,
            output_dir=args.output_dir,
            on_file_complete=on_file_done,
            progress_cb=on_progress,
        )
        if sys.stdout.isatty() and not args.quiet:
            sys.stdout.write("\r" + " " * 75 + "\r")
            sys.stdout.flush()

        if not results:
            print(yellow("Warning: No matching PDF files found to process."), file=sys.stderr)
            return 1

        elapsed = time.time() - t0
        if not args.quiet:
            print_summary_table(summary_rows, elapsed, args.output_dir, args.paper_size)

        if args.open and results:
            target = args.output_dir if os.path.isdir(args.output_dir) else results[0]
            open_path_in_os(target)

        return 0
    except Exception as e:
        print(red(f"Error: {e}"), file=sys.stderr)
        return 1


if __name__ == "__main__":
    sys.exit(main())
