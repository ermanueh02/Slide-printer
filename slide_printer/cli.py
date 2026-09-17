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
from typing import List, Optional, Tuple, Dict, Any

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

    tot_w = w_name + w_pages + w_out + 12

    top = f"╭{'─' * (tot_w - 2)}╮"
    hdr_title = "Slide-Printer · Run Summary"
    title_line = f"│ {bold(hdr_title.center(tot_w - 4))} │"
    mid = f"├{'─' * (w_name + 2)}┬{'─' * (w_pages + 2)}┬{'─' * (w_out + 2)}┤"
    header = f"│ {bold('Source Presentation'.ljust(w_name))} │ {bold('Slides'.rjust(w_pages))} │ {bold('Generated Output'.ljust(w_out))} │"
    sep = f"├{'─' * (w_name + 2)}┼{'─' * (w_pages + 2)}┼{'─' * (w_out + 2)}┤"
    bot = f"╰{'─' * (w_name + 2)}┴{'─' * (w_pages + 2)}┴{'─' * (w_out + 2)}╯"

    print(top)
    print(title_line)
    print(mid)
    print(header)
    print(sep)

    total_handouts = 0
    for r in rows:
        base = os.path.basename(r["name"])
        if len(base) > w_name:
            base = base[: w_name - 1] + "…"
        name_str = base.ljust(w_name)
        pages_str = str(r["slides"]).rjust(w_pages)
        out_str = str(r["output"]).ljust(w_out)
        total_handouts += r.get("count", 1)
        print(f"│ {name_str} │ {pages_str} │ {green(out_str)} │")

    print(bot)
    print(bold(f"\n{green('✔')} Successfully generated {total_handouts} handout(s) in {elapsed:.2f}s."))
    print(dim(f"   Paper: {paper.upper()} · Output Directory: {os.path.abspath(out_dir)}\n"))


# --- Interactive Wizard ---

def interactive_wizard() -> int:
    """Runs an interactive terminal wizard with presentation detection and drag-and-drop support."""
    print(bold("\n╭────────────────────────────────────────────────────────────╮"))
    print(bold(f"│  Slide-Printer v{__version__} · Terminal Studio Wizard          │"))
    print(bold("╰────────────────────────────────────────────────────────────╯\n"))

    # 1. Note Style Selection
    print(bold("1. Choose Note Style:"))
    print(f"  [{cyan('1')}] Ruled lines  (~5mm handwriting lines for study notes) {dim('[default]')}")
    print(f"  [{cyan('2')}] Graph grid  (Technical grid for diagrams and equations)")
    print(f"  [{cyan('3')}] Dot matrix  (Subtle dot grid for flexible bullet notes)")
    print(f"  [{cyan('4')}] Blank       (Clean blank space with hairline divider)")
    print(f"  [{cyan('A')}] All 4 styles (Generate all 4 note variants at once)")

    raw_selection = input(f"\nEnter choice [{bold('1')}, 2, 3, 4, or A] (default: 1): ").strip()

    wizard_style_map = {
        "1": "lines",
        "2": "grid",
        "3": "dots",
        "4": "blank",
        "lines": "lines",
        "ruled": "lines",
        "grid": "grid",
        "dots": "dots",
        "blank": "blank",
    }

    if not raw_selection:
        selected_styles = ["lines"]
    elif raw_selection.upper() == "A":
        selected_styles = ["lines", "grid", "dots", "blank"]
    else:
        selected_styles = []
        # Support commas or spaces e.g. "1,2" or "1 3"
        parts = [p.strip() for p in raw_selection.replace(",", " ").split() if p.strip()]
        for part in parts:
            part_lower = part.lower()
            if part_lower in wizard_style_map:
                canonical = wizard_style_map[part_lower]
                if canonical not in selected_styles:
                    selected_styles.append(canonical)
            else:
                try:
                    canonical = resolve_style(part_lower)
                    if canonical not in selected_styles:
                        selected_styles.append(canonical)
                except ValueError:
                    pass

    if not selected_styles:
        print(yellow("⚠️  No recognized style selected. Defaulting to 'Ruled lines' (lines)."))
        selected_styles = ["lines"]

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
    local_pdfs = sorted(glob.glob("*.pdf"))
    local_pdf_info: List[Tuple[str, Optional[int], int]] = []
    for f in local_pdfs:
        pgs = get_pdf_page_count(f)
        size = os.path.getsize(f) if os.path.isfile(f) else 0
        local_pdf_info.append((f, pgs, size))

    print(bold("\n3. Select Presentation File(s):"))
    if local_pdf_info:
        print(dim(f"Found {len(local_pdf_info)} PDF presentation(s) in current directory:"))
        for i, (pdf_name, pgs, sz) in enumerate(local_pdf_info, 1):
            pgs_label = f"{pgs} slides" if pgs is not None else "PDF"
            sz_label = format_bytes(sz)
            print(f"  [{cyan(str(i))}] {pdf_name} {dim(f'({pgs_label} · {sz_label})')}")
        print(dim(f"\n  - Type a number (1-{len(local_pdf_info)}), or '*' to process all above."))
    else:
        print(dim("  No PDF files detected in current directory."))

    print(dim("  - Drag & drop any PDF or folder directly into this terminal."))
    print(dim("  - Type '.' to process current directory."))

    entry = input(bold("\nYour choice: ")).strip()

    if not entry:
        print(red("❌ No file or selection entered. Exiting."))
        return 1

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

    # Check if user typed a number matching local_pdfs
    if local_pdf_info and entry.isdigit():
        idx = int(entry) - 1
        if 0 <= idx < len(local_pdf_info):
            files_to_process = [local_pdf_info[idx][0]]
        else:
            print(red(f"❌ Index {entry} out of range."))
            return 1
    elif local_pdf_info and entry in ("*", "all", "a", "A"):
        files_to_process = [p[0] for p in local_pdf_info]
    elif os.path.isdir(entry):
        files_to_process = sorted(glob.glob(os.path.join(entry, "*.pdf")))
    elif entry == ".":
        files_to_process = [p[0] for p in local_pdf_info]
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
        default=["blank"],
        help="Note styles: 'lines', 'grid', 'dots', 'blank', 'all' (or numbers 1-4). Multiple allowed.",
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
            print(bold("\n╭────────────────────────────────────────────────────────────╮"))
            print(bold(f"│  Slide-Printer Web Studio · {url:<29} │"))
            print(bold("╰────────────────────────────────────────────────────────────╯"))
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

    # Flatten and resolve styles
    raw_styles: List[str] = []
    for item in args.styles:
        for part in item.replace(",", " ").split():
            part_clean = part.strip().lower()
            if part_clean:
                raw_styles.append(part_clean)

    if "all" in raw_styles:
        chosen_styles = ["lines", "grid", "dots", "blank"]
    else:
        chosen_styles = []
        for s in raw_styles:
            try:
                canonical = resolve_style(s)
                if canonical not in chosen_styles:
                    chosen_styles.append(canonical)
            except ValueError as err:
                print(red(f"Error: {err}"), file=sys.stderr)
                return 1

    if not chosen_styles:
        chosen_styles = ["blank"]

    printer = SlidePrinter(
        paper_size=args.paper_size,
        margin=args.margin,
        step=args.step,
        output_dir=args.output_dir,
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
