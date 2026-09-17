"""Command-line interface for slide-printer."""

import os
import sys
import glob
import argparse
from typing import List, Optional

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


def interactive_wizard() -> int:
    """Runs interactive prompt wizard replicating and enhancing the classic workflow."""
    print("=" * 60)
    print(f"📄 Slide-Printer v{__version__} - Interactive Mode")
    print("=" * 60)

    print("\nSelect the note styles you want to generate:")
    for key in ["1", "2", "3", "4"]:
        style_id = STYLE_KEY_MAP[key]
        meta = STYLE_METADATA[style_id]
        print(f"  [{key}] {meta['name']}")
    print("  [A] All styles")

    raw_selection = input("\nEnter options (comma-separated, e.g. 1, 3 or A) [1]: ").strip()

    if not raw_selection:
        selected_styles = ["blank"]
    elif raw_selection.upper() == "A":
        selected_styles = ["blank", "lines", "grid", "dots"]
    else:
        selected_styles = []
        for part in raw_selection.split(","):
            part_clean = part.strip()
            if part_clean in STYLE_KEY_MAP:
                canonical = STYLE_KEY_MAP[part_clean]
                if canonical not in selected_styles:
                    selected_styles.append(canonical)

    if not selected_styles:
        print("⚠️  No valid selection provided. Defaulting to 'Blank'.")
        selected_styles = ["blank"]

    print("\nInput options:")
    print("  - Type '.' to process all PDFs in the current directory.")
    print("  - Type a folder path to process all PDFs inside it.")
    print("  - Type file names or paths separated by semicolon (;) or vertical bar (|).")
    entry = input("Your selection: ").strip()

    if not entry:
        print("❌ No input specified.")
        return 1

    files_to_process: List[str] = []

    if os.path.isdir(entry):
        files_to_process = sorted(glob.glob(os.path.join(entry, "*.pdf")))
    elif entry == ".":
        files_to_process = sorted(glob.glob("*.pdf"))
    else:
        delimiter = ";" if ";" in entry else "|"
        items = [item.strip() for item in entry.split(delimiter) if item.strip()]
        for item in items:
            path = item if item.lower().endswith(".pdf") else f"{item}.pdf"
            if os.path.isfile(path):
                files_to_process.append(path)
            else:
                print(f"⚠️  File not found: '{path}'. Skipping...")

    if not files_to_process:
        print("❌ No valid PDF files found to process.")
        return 1

    print(f"\n🚀 Processing {len(files_to_process)} file(s)...")

    printer = SlidePrinter(
        paper_size=DEFAULT_PAPER_SIZE,
        margin=DEFAULT_MARGIN,
        step=DEFAULT_STEP,
        output_dir=DEFAULT_OUTPUT_DIR,
    )

    for path in files_to_process:
        print(f"\n📄 File: '{path}'")
        try:
            generated = printer.process_file(path, selected_styles)
            for gen in generated:
                print(f"  ✅ Saved: {gen}")
        except Exception as e:
            print(f"  ❌ Error processing '{path}': {e}")

    print("\n✨ Processing completed successfully!")
    return 0


def parse_args(args: Optional[List[str]] = None) -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        prog="slide-printer",
        description="Print PDF slides onto A4/Letter paper with blank or patterned note-taking sections.",
    )
    parser.add_argument(
        "-i",
        "--input",
        nargs="+",
        help="Input PDF file(s), folders, or wildcards (e.g. presentation.pdf, slides/*.pdf).",
    )
    parser.add_argument(
        "-s",
        "--styles",
        nargs="+",
        default=["blank"],
        help="Note styles: 'blank', 'lines', 'grid', 'dots', 'all' (or numbers 1-4). Can specify multiple.",
    )
    parser.add_argument(
        "-o",
        "--output-dir",
        default=DEFAULT_OUTPUT_DIR,
        help=f"Output directory (default: '{DEFAULT_OUTPUT_DIR}').",
    )
    parser.add_argument(
        "-p",
        "--paper-size",
        choices=list(PAPER_SIZES.keys()),
        default=DEFAULT_PAPER_SIZE,
        help=f"Paper size (default: '{DEFAULT_PAPER_SIZE}').",
    )
    parser.add_argument(
        "-m",
        "--margin",
        type=float,
        default=DEFAULT_MARGIN,
        help=f"Margin in points (default: {DEFAULT_MARGIN}).",
    )
    parser.add_argument(
        "--step",
        type=float,
        default=DEFAULT_STEP,
        help=f"Spacing between lines or grid points in pt (default: {DEFAULT_STEP}).",
    )
    parser.add_argument(
        "--interactive",
        action="store_true",
        help="Launch interactive prompt wizard.",
    )
    parser.add_argument(
        "-q",
        "--quiet",
        action="store_true",
        help="Quiet mode: suppress non-error messages.",
    )
    parser.add_argument(
        "-v",
        "--version",
        action="version",
        version=f"%(prog)s {__version__}",
    )
    return parser.parse_args(args)


def main(argv: Optional[List[str]] = None) -> int:
    """Main CLI entrypoint."""
    # Check if run with no args and in interactive terminal
    if argv is None:
        argv = sys.argv[1:]

    # If no arguments provided or explicitly requested interactive
    if (len(argv) == 0 and sys.stdin.isatty()) or "--interactive" in argv:
        return interactive_wizard()

    args = parse_args(argv)

    if not args.input:
        if sys.stdin.isatty():
            return interactive_wizard()
        print("Error: No input files specified. Use -i/--input or --interactive.", file=sys.stderr)
        return 1

    # Flatten and parse styles
    raw_styles: List[str] = []
    for item in args.styles:
        for part in item.split(","):
            part_clean = part.strip().lower()
            if part_clean:
                raw_styles.append(part_clean)

    if "all" in raw_styles:
        chosen_styles = ["blank", "lines", "grid", "dots"]
    else:
        chosen_styles = []
        for s in raw_styles:
            try:
                canonical = resolve_style(s)
                if canonical not in chosen_styles:
                    chosen_styles.append(canonical)
            except ValueError as err:
                print(f"Error: {err}", file=sys.stderr)
                return 1

    if not chosen_styles:
        chosen_styles = ["blank"]

    printer = SlidePrinter(
        paper_size=args.paper_size,
        margin=args.margin,
        step=args.step,
        output_dir=args.output_dir,
    )

    if not args.quiet:
        print(f"Slide-Printer v{__version__} | Target: {args.paper_size.upper()} | Styles: {', '.join(chosen_styles)}")

    def on_file_done(src: str, outputs: List[str]):
        if not args.quiet:
            print(f"✅ Processed: {src}")
            for out in outputs:
                print(f"   -> {out}")

    try:
        results = printer.process_paths(
            paths=args.input,
            styles=chosen_styles,
            output_dir=args.output_dir,
            on_file_complete=on_file_done,
        )
        if not results:
            print("Warning: No matching PDF files found to process.", file=sys.stderr)
            return 1
        if not args.quiet:
            print(f"\nDone! Successfully generated {len(results)} handout PDF(s).")
        return 0
    except Exception as e:
        print(f"Error: {e}", file=sys.stderr)
        return 1


if __name__ == "__main__":
    sys.exit(main())
