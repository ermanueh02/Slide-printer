# Slide-Printer 📄✏️

[![CI](https://github.com/ermanueh02/Slide-printer/actions/workflows/ci.yml/badge.svg)](https://github.com/ermanueh02/Slide-printer/actions/workflows/ci.yml)
[![Python Version](https://img.shields.io/badge/python-3.9%20%7C%203.10%20%7C%203.11%20%7C%203.12%20%7C%203.13%20%7C%203.14-blue.svg)](https://www.python.org/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![Tests](https://img.shields.io/badge/tests-18%20passing-brightgreen.svg)](tests/)
[![Web App](https://img.shields.io/badge/Web%20Studio-Live-blueviolet.svg)](https://ermanueh02.github.io/Slide-printer/)

**Slide-Printer** transforms digital presentation slides (16:9 widescreen or 4:3 standard) into clean, printable handouts on **DIN A4**, **US Letter**, **US Legal**, or **DIN A3** paper, adding dedicated note-taking space directly below each slide.

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
|   |    1. Ruled lines (handwriting lines)     |   |
|   |    2. Graph grid (technical math/plots)   |   |
|   |    3. Dot matrix (flexible bullet points) |   |
|   |    4. Blank (clean open space)            |   |
|   |                                           |   |
|   +-------------------------------------------+   |
|                     MARGIN                        |
+---------------------------------------------------+
```

---

## ✨ Features

- **4 Note Patterns**:
  - **Ruled Lines (`lines`)**: Clean horizontal lines tailored for handwriting (~4.9 mm / ~14 pt spacing).
  - **Graph Grid (`grid`)**: Technical squared grid for math, diagrams, sketches, and charts.
  - **Dot Matrix (`dots`)**: Subtle bullet dot grid for flexible note-taking.
  - **Blank (`blank`)**: Clean open space with an elegant hairline divider.
- **Hyperlink & Annotation Preservation**:
  - Standard transformation tools often break or misalign clickable links. Slide-Printer recalculates and transforms coordinate matrices (`/Annots` `/Rect`) so all hyperlinks remain clickable in the printed or digital handout.
- **Multiple Paper Formats**: Supports **DIN A4**, **US Letter**, **US Legal**, and **DIN A3**.
- **Smart PowerPoint Guidance**:
  - Slide-Printer operates directly on PDF to guarantee 100% vector accuracy and embedded font rendering.
  - If a `.pptx` or `.ppt` presentation is passed or dropped into either the CLI or the Web Studio, it provides instant instructions on exporting to PDF in 1 click (`File > Export > Create PDF`).
  - In the CLI, if a matching PDF already exists in the same folder, it automatically offers to process it!
- **Multi-Modal Interface**:
  - **Web Studio**: 100% in-browser, private, multilingual (EN, ES, GL), and instant without requiring Python or Git.
  - **Command-Line Interface (CLI)**: Rich ANSI styling, live progress meters, run summary tables, simulation mode (`--dry-run`), and auto-open support (`-O`).
  - **Interactive Terminal Wizard**: Guided prompts with presentation discovery and drag-and-drop support.
- **Python Library API**: Easily integrate into your own Python pipelines or scripts.

---

## 📦 Installation

### Prerequisites
- Python 3.9 or newer.

### From Source
Clone the repository and install in editable mode:

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

### 🌐 1. Web Studio (No Install Required)

If you don't have Python installed or prefer a visual UI, open the web app in any browser:

👉 **[Open Slide-Printer Web Studio](https://ermanueh02.github.io/Slide-printer/)**

- **Zero Installation**: Works instantly on desktop, tablets (iPad/Surface), and mobile phones.
- **100% Private**: Your presentation never leaves your device — all transformations run client-side in your browser.
- **Multilingual**: Switch seamlessly between **English**, **Español**, and **Galego**.
- **Instant Live Preview**: Toggle between Ruled lines, Grid, Bullet points, and Blank with real-time visual feedback.
- **1-Click Export & Print**: Download individual PDFs, export all 4 styles in a ZIP archive, or trigger browser printing directly.

---

### 💻 2. Command-Line Interface (CLI)

The CLI provides full scriptability, batch processing, and live terminal progress feedback:

```bash
# Launch the web studio locally from the CLI
slide-printer --web

# Process a presentation with ruled lines on A4
slide-printer -i presentation.pdf -s lines

# Generate all 4 note styles at once
slide-printer -i presentation.pdf -s all

# Process multiple presentations or wildcards into a custom directory
slide-printer -i "lectures/*.pdf" -s lines grid -o my_handouts/

# Target US Letter paper size and open output folder when finished
slide-printer -i presentation.pdf -p letter -s grid -O

# Simulate execution (check slide count and output paths without modifying disk)
slide-printer --dry-run -i presentation.pdf -s all
```

#### Available CLI Options:
| Flag | Description | Default |
|------|-------------|---------|
| `-i`, `--input` | Input PDF presentation(s), folder, or wildcards | *(Interactive)* |
| `-s`, `--styles` | Note style(s): `lines`, `grid`, `dots`, `blank`, or `all` (or numbers 1–4) | `blank` |
| `-o`, `--output-dir`| Directory where output PDFs are organized | `handouts` |
| `-p`, `--paper-size`| Target paper: `a4`, `letter`, `legal`, `a3` | `a4` |
| `-m`, `--margin` | Page margin in points (1 pt = 1/72 in) | `40.0` |
| `--step` | Distance between lines/dots in points | `14.0` |
| `-O`, `--open` | Automatically open the output folder or generated PDF upon completion | — |
| `--dry-run` | Simulate execution: inspect slide counts and output paths without writing to disk | — |
| `--web` | Launch the local web studio in your default browser | — |
| `--port` | Port for the local web server | `8000` |
| `--interactive` | Force interactive prompt wizard | — |
| `-q`, `--quiet` | Suppress non-error logs and progress meters | — |
| `-v`, `--version` | Display program version | — |

---

### 🪄 3. Interactive Terminal Wizard

Running `slide-printer` without arguments (or with `--interactive`) launches a guided terminal wizard:

```bash
slide-printer
```

```text
╭────────────────────────────────────────────────────────────╮
│  Slide-Printer v4.2.0 · Terminal Studio Wizard             │
╰────────────────────────────────────────────────────────────╯

1. Choose Note Style:
  [1] Ruled lines  (~5mm handwriting lines for study notes) [default]
  [2] Graph grid   (Technical grid for diagrams and equations)
  [3] Dot matrix   (Subtle dot grid for flexible bullet notes)
  [4] Blank        (Clean blank space with hairline divider)
  [A] All 4 styles (Generate all 4 note variants at once)

Enter choice [1, 2, 3, 4, or A] (default: 1): 1

2. Target Paper Format:
  [1] DIN A4      (210 × 297 mm) [default]
  [2] US Letter   (8.5 × 11 in)
  [3] US Legal    (8.5 × 14 in)
  [4] DIN A3      (297 × 420 mm)

Enter paper choice [1, 2, 3, 4] (default: 1): 1

3. Select Presentation File(s):
Found 2 PDF presentation(s) in current directory:
  [1] lecture_week_01.pdf (34 slides · 3.2 MB)
  [2] seminar_slides.pdf  (18 slides · 1.1 MB)

  - Type a number (1-2), or '*' to process all above.
  - Drag & drop any PDF or folder directly into this terminal.
  - Type '.' to process current directory.

Your choice: 1

🚀 Processing 1 presentation(s) into A4 with: Lined...

[1/1] lecture_week_01.pdf (34 slides)
   ├─ lines   ✔ handouts/lines/lecture_week_01_lines.pdf

╭─────────────────────────────────────────────────────────────────────────╮
│                       Slide-Printer · Run Summary                       │
├──────────────────────────────┬────────┬─────────────────────────────────┤
│ Source Presentation          │ Slides │ Generated Output                │
├──────────────────────────────┼────────┼─────────────────────────────────┤
│ lecture_week_01.pdf          │ 34     │ 1 files (lines)                 │
╰──────────────────────────────┴────────┴─────────────────────────────────╯

✔ Successfully generated 1 handout(s) in 0.45s.
   Paper: A4 · Output Directory: C:\...\handouts

Open output folder now? [Y/n]: y
```

---

### 🐍 4. Python API

You can also use `slide_printer` directly in your Python applications:

```python
from slide_printer import SlidePrinter

# Initialize printer with desired paper format and margins
printer = SlidePrinter(paper_size="a4", margin=40.0)

# Process a presentation PDF with ruled lines and graph grid notes
output_files = printer.process_file(
    input_path="presentation.pdf",
    styles=["lines", "grid"],
    output_dir="handouts/"
)

print(f"Generated handouts: {output_files}")
```

To process multiple paths or wildcards programmatically:
```python
output_files = printer.process_paths(
    paths=["slides/*.pdf"],
    styles=["lines", "dots", "blank"],
    output_dir="handouts/"
)
```

---

## 🧪 Testing

Slide-Printer includes an automated test suite with `pytest` covering core transformation logic, pattern generators, link recalculations, CLI flags, PowerPoint detection, and dry-run simulation:

```bash
pip install -r requirements-dev.txt
pytest -v
```

All 18 unit tests run in ~2 seconds.

---

## 📁 Output Directory Structure

Generated handouts are organized cleanly by style:

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

Contributions, issues, and feature requests are warmly welcomed!
Feel free to open an issue or pull request on the [GitHub repository](https://github.com/ermanueh02/Slide-printer/issues).

---

## 📄 License

Distributed under the **MIT License**. See [`LICENSE`](LICENSE) for details.
