# Slide-Printer 📄✏️

[![CI](https://github.com/ermanueh02/Slide-printer/actions/workflows/ci.yml/badge.svg)](https://github.com/ermanueh02/Slide-printer/actions/workflows/ci.yml)
[![Python Version](https://img.shields.io/badge/python-3.9%20%7C%203.10%20%7C%203.11%20%7C%203.12%20%7C%203.13%20%7C%203.14-blue.svg)](https://www.python.org/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![Tests](https://img.shields.io/badge/tests-passing-brightgreen.svg)](tests/)
[![Web App](https://img.shields.io/badge/Web%20App-Live%20Studio-blueviolet.svg)](https://ermanueh02.github.io/Slide-printer/)

**Slide-Printer** transforms digital presentation slides (16:9 widescreen or 4:3 standard) into clean, printable handouts on **DIN A4** or **US Letter** paper, adding dedicated note-taking space directly below each slide.

Whether you're attending a lecture, giving a seminar, or preparing study material, Slide-Printer gives you physical paper space to write handwritten notes while preserving original slide proportions and keeping **interactive PDF hyperlinks fully functional**.

---

## 📐 Layout Overview

Each page of your presentation is placed at the top of the sheet, followed by a customizable notes section:

```text
+---------------------------------------------------+
|                     MARGIN                        |
|   +-------------------------------------------+   |
|   |                                           |   |
|   |            PRESENTATION SLIDE             |   |
|   |        (Preserves aspect ratio &          |   |
|   |         interactive hyperlinks)           |   |
|   |                                           |   |
|   +-------------------------------------------+   |
|                                                   |
|   |---[ Separation line with tick markers ]---|   |
|                                                   |
|   +-------------------------------------------+   |
|   |                                           |   |
|   |            NOTE-TAKING AREA               |   |
|   |                                           |   |
|   |   Available styles:                       |   |
|   |    1. Blank                               |   |
|   |    2. Lined                               |   |
|   |    3. Grid                                |   |
|   |    4. Dot Grid                            |   |
|   |                                           |   |
|   +-------------------------------------------+   |
|                     MARGIN                        |
+---------------------------------------------------+
```

---

## ✨ Features

- **4 Note Patterns**:
  - **Blank (`blank`)**: Clean open space with an elegant separator line.
  - **Lined (`lines`)**: Ruled horizontal lines tailored for handwriting (~4.9 mm spacing).
  - **Grid (`grid`)**: Squared graph paper pattern for math, diagrams, and sketches.
  - **Dot Grid (`dots`)**: Subtle bullet dot grid for flexible note-taking.
- **Hyperlink & Annotation Preservation**:
  - Standard PDF transformation tools often break or misalign clickable links. Slide-Printer recalculates and transforms coordinate matrices (`/Annots` `/Rect`) so all hyperlinks remain clickable in the printed/digital handout.
- **Multiple Paper Formats**: Supports **A4**, **US Letter**, **US Legal**, and **A3**.
- **Flexible Batch Processing**: Accepts individual files, directory paths, or glob wildcards (`*.pdf`).
- **Multi-Modal Interface**:
  - **Web App Studio**: 100% in-browser, private, and instant for users without Python or Git.
  - **Command-Line Interface (CLI)**: For scripts, automation, and power users.
  - **Interactive Terminal Wizard**: Guided prompts for interactive use (100% backward compatible).
- **Python Library API**: Easily integrate into your own Python tools or scripts.

---

## 📦 Installation

### Prerequisites
- Python 3.9 or newer.

### From Source
Clone the repository and install dependencies:

```bash
git clone https://github.com/ermanueh02/Slide-printer.git
cd Slide-printer
pip install -e .
```

Or install dependencies directly:
```bash
pip install -r requirements.txt
```

---

## 🚀 Quick Start

### 🌐 1. Web Studio (No Python / Git Required)

If you don't have Python or Git installed, simply open the web app in any browser:

👉 **[Open Slide-Printer Web Studio](https://ermanueh02.github.io/Slide-printer/)**

- **Zero Install**: Works instantly on laptops, tablets (iPad/Surface), and mobile.
- **100% Private**: Your presentation never leaves your device — all transformations happen locally in your browser.
- **Instant Live Preview**: Toggle between Blank, Lined, Grid, and Dot Grid with real-time visual feedback.
- **1-Click Export & Print**: Download individual PDFs, export all 4 styles in a ZIP archive, or print directly.

---

### 💻 2. Command-Line Interface (CLI)

For developers and power users, the offline Python CLI remains fully available:

```bash
# Launch the web studio locally from the CLI
slide-printer --web

# Process a single presentation with default lined notes on A4
slide-printer -i presentation.pdf -s lines

# Generate all 4 note styles at once
slide-printer -i presentation.pdf -s all

# Process multiple PDFs or wildcards into a custom directory
slide-printer -i "lectures/*.pdf" -s lines grid -o my_handouts/

# Target US Letter paper size with custom margin
slide-printer -i presentation.pdf -p letter -m 30 -s dots
```

#### Available CLI Options:
| Flag | Description | Default |
|------|-------------|---------|
| `-i`, `--input` | Input PDF file(s), folders, or wildcards | *(Interactive)* |
| `-s`, `--styles` | Note style(s): `blank`, `lines`, `grid`, `dots`, or `all` | `blank` |
| `-o`, `--output-dir`| Directory where output PDFs are organized | `handouts` |
| `-p`, `--paper-size`| Target paper: `a4`, `letter`, `legal`, `a3` | `a4` |
| `-m`, `--margin` | Page margin in points (1 pt = 1/72 in) | `40.0` |
| `--step` | Distance between lines/dots in points | `14.0` |
| `--web` | Launch the local web studio in your browser | — |
| `--port` | Port for the local web server | `8000` |
| `--interactive` | Force interactive prompt wizard | — |
| `-q`, `--quiet` | Suppress non-error output | — |
| `-v`, `--version` | Display program version | — |

---

### 2. Interactive Terminal Wizard

If you run `slide-printer` without arguments (or with `--interactive`), it launches an interactive terminal wizard:

```bash
slide-printer
```

*(You can also continue using `python slide_printer_v4.0.py` for backward compatibility).*

```text
============================================================
📄 Slide-Printer v4.1.0 - Interactive Mode
============================================================

Select the note styles you want to generate:
  [1] Blank
  [2] Lined
  [3] Grid
  [4] Dot Grid
  [A] All styles

Enter options (comma-separated, e.g. 1, 3 or A) [1]: 2, 4

Input options:
  - Type '.' to process all PDFs in the current directory.
  - Type a folder path to process all PDFs inside it.
  - Type file names or paths separated by semicolon (;) or vertical bar (|).
Your selection: presentation.pdf
```

---

### 3. Python API

You can use `slide_printer` programmatically in your own Python scripts:

```python
from slide_printer import SlidePrinter

# Initialize printer with desired paper format and margin
printer = SlidePrinter(paper_size="a4", margin=40.0)

# Process a presentation PDF with lined and dot grid notes
output_files = printer.process_file(
    input_path="presentation.pdf",
    styles=["lines", "dots"],
    output_dir="handouts/"
)

print(f"Generated handouts: {output_files}")
```

---

## 🧪 Testing

The project includes an automated test suite with `pytest`. Run tests locally with:

```bash
pip install -r requirements-dev.txt
pytest -v
```

---

## 📁 Output Structure

Outputs are neatly organized by style into subfolders:

```text
handouts/
├── blank/
│   └── presentation_blank.pdf
├── lines/
│   └── presentation_lines.pdf
├── grid/
│   └── presentation_grid.pdf
└── dots/
    └── presentation_dots.pdf
```

---

## 🤝 Contributing

Contributions, issues, and feature requests are welcome!
Feel free to check the [issues page](https://github.com/ermanueh02/Slide-printer/issues).

1. Fork the project
2. Create your feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

---

## 🙏 Acknowledgements

- Modernized, refactored, and tested with the assistance of **[Antigravity](https://deepmind.google/)** (Google DeepMind).

---

## 📄 License

Distributed under the **MIT License**. See [`LICENSE`](LICENSE) for more information.
