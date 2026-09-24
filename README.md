# Slide-Printer 📄✏️

[![CI](https://github.com/ermanueh02/Slide-printer/actions/workflows/ci.yml/badge.svg)](https://github.com/ermanueh02/Slide-printer/actions/workflows/ci.yml)
[![Python Version](https://img.shields.io/badge/python-3.9%20%7C%203.10%20%7C%203.11%20%7C%203.12%20%7C%203.13%20%7C%203.14-blue.svg)](https://www.python.org/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![Tests](https://img.shields.io/badge/tests-36%20passing-brightgreen.svg)](tests/)
[![Web App](https://img.shields.io/badge/Web%20Studio-Live-blueviolet.svg)](https://ermanueh02.github.io/Slide-printer/)

**Slide-Printer** transforms digital presentation slides (16:9 widescreen or 4:3 standard) into clean, printable handouts on **DIN A4**, **US Letter**, **US Legal**, or **DIN A3** paper, adding dedicated note-taking space directly below each slide.

Whether you're attending a lecture, giving a seminar, or preparing study material, Slide-Printer gives you physical paper space to write handwritten notes while preserving original slide proportions and keeping **interactive PDF hyperlinks fully functional**.

---

## 📐 Layout Overview

Each page of your presentation is placed on the sheet, followed by a customizable notes section:

```text
+---------------------------------------------------+
|  [TEMA: Machine Learning]    [FECHA: __/__/20__]  |  <-- Optional Study Header
|                                                   |
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
|                      1 / 24                       |  <-- Centered Page Number
+---------------------------------------------------+
```

---

## ✨ Features

- **4 Note Patterns**:
  - **Ruled Lines (`lines`)**: Clean horizontal lines tailored for handwriting (~4.9 mm / ~14 pt spacing).
  - **Graph Grid (`grid`)**: Technical squared grid for math, diagrams, sketches, and charts.
  - **Dot Matrix (`dots`)**: Subtle bullet dot grid for flexible note-taking.
  - **Blank (`blank`)**: Clean open space with an elegant hairline divider.
- **2 Layout Modes**:
  - **1-Up Standard**: 1 slide per sheet with full-width note space.
  - **2-Up Compact Handout (`-2`, `--layout 2-up`)**: 2 slides per sheet, each with compact notes and a middle hairline divider, halving paper usage.
- **Smart Binding Gutter & Duplex Support**:
  - **Ring Binder (`--binding binder` / `--gutter` / `--binder-margin`)**: +11 mm (+30 pt) margin safe for ISO 838 4-hole / 2-hole punches.
  - **Spiral / Coil Binding (`--binding spiral` / `--spiral`)**: +8 mm (+22 pt) margin optimized for spiral wire-o and coil combs, saving 3 mm of slide space.
  - **Hole & Spiral Guides (`--hole-guides`)**: Prints subtle punch targets (crosshair circles at ISO 838 centers) or spiral coil clearance ticks.
  - **Duplex Intelligence (`--duplex`)**: Shifts odd sheets (recto) to the right (left gutter) and even sheets (verso) to the left (right gutter) so punched holes never bite into content.
- **35+ Editorial Cover Templates (`--generate-cover`, `--cover-template`)**:
  - **Scientific & Physics Flat 90s Minimalist (Pure Vector Line Art)**:
    - **Mecánica Cuántica III (`quantum_flat` / `mecanica_cuantica_3_flat`)**: Harmonic oscillator parabolic well, quantized energy levels ($E_0 \dots E_3$), Hermite wavefunction curves, and Schrödinger monograph header.
    - **Biofísica (`biophysics_flat` / `biofisica_flat`)**: Interlaced double helix backbone ribbons, base-pair rungs, thermodynamic identity header, and 3.4 nm pitch scale bar.
    - **Física de los Sistemas Complejos (`complex_systems_flat` / `sistemas_complejos_flat`)**: Lorenz strange attractor butterfly orbits, coordinate axes, and differential equations header.
    - **Simulación en Física de Materiales (`materials_sim_flat` / `simulacion_materiales_flat`)**: Isometric 3D FCC crystal unit cell wireframe, atom spheres, interatomic potential force formula, and MPI Fortran footer.
    - **Física del Estado Sólido (`solid_state_flat` / `estado_solido_flat`)**: 1st Brillouin zone hexagon, reciprocal lattice vectors $\mathbf{b}_1, \mathbf{b}_2$, symmetry points ($\Gamma, K, M$), and Fermi surface sphere.
    - **Fundamentos de Instrumentación Electrónica (`circuits_flat` / `fundamentos_instrumentacion_flat`)**: Inverting Op-Amp circuit schematic ($R_{in}, R_f$), ground terminals, transfer equation, and IEEE bench metadata.
    - **Física Nuclear & de Partículas (`nuclear_flat` / `particulas_flat`)**: $e^+ e^- \to \gamma^*/Z^0 \to q \bar{q}$ Feynman diagram, gauge propagator wavy line, vertex nodes, and 4π detector chamber arcs.
  - **Scientific & Physics Composition Books (AI Illustrated Textures)**:
    - **Biofísica (`biophysics_ml` / `biofisica` / `alphafold`)**: AlphaFold 3D protein folding ribbon structures interwoven with bioluminescent neural network graph nodes and deep marine cyan spine.
    - **Física de los Sistemas Complejos (`atmospheric_chaos` / `sistemas_complejos` / `lorenz`)**: Lorenz strange attractor streamlines, barometric isobars, convection turbulence, and storm navy spine.
    - **Simulación en Física de Materiales (`fortran_materials` / `simulacion_materiales` / `fortran`)**: 3D crystal lattice unit cells (FCC/BCC), molecular dynamics velocity trajectories, and vintage mainframe terminal phosphor green spine.
    - **Física Nuclear & de Partículas (`nuclear_particles` / `nuclear` / `cern`)**: High-energy collider collision jets, bubble chamber particle spirals, Feynman propagators, and cosmic obsidian spine.
    - **Física del Estado Sólido (`solid_state` / `estado_solido` / `brillouin`)**: First Brillouin zone polyhedron, Fermi surface topologies, reciprocal $k$-space vectors, and cobalt steel spine.
    - **Mecánica Cuántica III (`atomic_physics` / `mecanica_cuantica_3` / `spectroscopy`)**: Electron orbital probability wavefunctions, Rydberg transition ladders, laser spectroscopy interference, and deep quantum violet spine.
    - **Fundamentos de Instrumentación Electrónica (`circuits_instrumentation` / `fundamentos_instrumentacion` / `opamps`)**: Opamp differential schematics, Bode magnitude/phase plots, DAC/ADC ladder networks, oscilloscope phosphor traces, and dark PCB solder mask green spine.
  - **Notebooks & Marbled Papers**:
    - **Academic Peacock (`academic_green` / `peacock`)**: Florentine combed peacock marbling in red, yellow, and green with forest green cloth spine and ivory Academic label.
    - **Academic Ebru (`academic_teal` / `ebru`)**: Turkish stone/bubble marbling in slate and ochre with petroleum teal spine and ivory Academic label.
    - **Academic Wave (`academic_wave` / `suminagashi`)**: Suminagashi flowing water marbling in Prussian blue with burgundy spine and ivory Academic label.
    - **Composition Book (`composition` / `compbook`)**: Iconic American composition notebook with black & white agate marble pattern, black spine tape, and classic arched badge.
  - **Classics & Decades**:
    - **Atelier (`atelier`)**: Clean linen notebook style with dual fine hairlines.
    - **George 90s (`george` / `90s_executive`)**: Executive editorial format with bold top header rule.
    - **Archival Monograph (`monograph` / `bookplate`)**: Heritage library bookplate frame.
    - **Swiss Modernist (`bauhaus` / `swiss`)**: Müller-Brockmann asymmetrical grid layout.
    - **Fifties (`fifties` / `50s`)**: Mid-century Pelican classic tri-band color blocking.
    - **Sixties (`sixties` / `60s`)**: Swiss International typography with heavy black header.
    - **Seventies (`seventies` / `70s`)**: Retro warm groove & Apollo badge.
    - **Eighties (`eighties` / `80s`)**: Memphis tech & Mac 1984 workshop manual.
    - **Nineties (`nineties` / `90s`)**: Minimalist indie zine lookbook.
    - **Natural (`natural` / `forest`)**: Organic botanical & deep forest green editorial.
    - **Polo & Equestrian (`polo`, `equestrian`)**: Ralph Lauren collegiate and British country estate editions.
- **Study Header Metadata Bar (`--study-header`, `--study-title`)**:
  - Adds a top study bar with topic/subject fill-in and date line (`FECHA: _____ / _____ / 20___`).
- **Slide Range Filtering (`--pages`)**:
  - Process only selected slides, e.g. `--pages "1-10, 15, 20-30"`.
- **Eco-Print / Grayscale Mode (`--eco`, `--grayscale`)**:
  - Monochromatic rendering optimized to save colored ink and toner on standard office printers.
- **Advanced Page Numbering**:
  - Centered footer numbering with total count format (`1 / 24`) or simple format (`1`). Enabled by default.
- **Hyperlink & Annotation Preservation**:
  - Standard transformation tools often break or misalign clickable links. Slide-Printer recalculates and transforms coordinate matrices (`/Annots` `/Rect`) so all hyperlinks remain clickable across 1-up and 2-up layouts.
- **Multiple Paper Formats**: Supports **DIN A4**, **US Letter**, **US Legal**, and **DIN A3**.
- **Smart PowerPoint Guidance**:
  - Slide-Printer operates directly on PDF to guarantee 100% vector accuracy and embedded font rendering.
  - If a `.pptx` or `.ppt` presentation is passed or dropped into either the CLI or the Web Studio, it provides instant instructions on exporting to PDF in 1 click (`File > Export > Create PDF`).
  - In the CLI, if a matching PDF already exists in the same folder, it automatically offers to process it!
- **Multi-Modal Interface**:
  - **Web Studio**: 100% in-browser, private, multilingual (EN, ES, GL), instant, with automatic preset saving in `localStorage`.
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
- **Instant Live Preview**: Toggle styles, 1-up vs 2-up, duplex binding margins, covers, headers, and grayscale with real-time canvas feedback.
- **Auto-Saved Presets**: Remembers your preferred paper format, margins, styles, and options across sessions.
- **1-Click Export & Print**: Download individual PDFs, export selected styles in a ZIP archive, or trigger browser printing directly.

---

### 💻 2. Command-Line Interface (CLI)

The CLI provides full scriptability, batch processing, and live terminal progress feedback:

```bash
# Launch the web studio locally from the CLI
slide-printer --web

# Process a presentation with ruled lines on A4
slide-printer -i presentation.pdf -s lines

# Selective styles (e.g. ruled lines & graph grid only, skipping blank & dots)
slide-printer -i presentation.pdf -s lines grid
# Or using numbers / ranges:
slide-printer -i presentation.pdf -s 1-2

# Generate all 4 note styles at once
slide-printer -i presentation.pdf -s all

# Print 2 slides per sheet (compact 2-up handout) with binding gutter for ring binder
slide-printer -i presentation.pdf -s lines -2 --gutter

# Double-sided (duplex) printing with alternating margin and clean first slide cover
slide-printer -i presentation.pdf -s grid --gutter --duplex --clean-cover

# Generate new editorial title cover with study metadata header and slide range
slide-printer -i presentation.pdf -s lines --generate-cover --cover-title "Machine Learning" --cover-author "Alex" --study-header --pages "1-15"

# Eco-print / grayscale mode targeting US Letter
slide-printer -i presentation.pdf -p letter -s grid --eco -O

# Simulate execution (check slide count and output paths without modifying disk)
slide-printer --dry-run -i presentation.pdf -s all
```

#### Available CLI Options

| Flag | Description | Default |
| ------ | ------------- | --------- |
| `-i`, `--input` | Input PDF presentation(s), folder, or wildcards | *(Interactive)* |
| `-s`, `--styles` | Note style(s): `grid`, `lines`, `dots`, `blank`, numbers (1–4), ranges (`1-2`), or `all` | `grid` |
| `-o`, `--output-dir` | Directory where output PDFs are organized | `handouts` |
| `-p`, `--paper-size` | Target paper: `a4`, `letter`, `legal`, `a3` | `a4` |
| `-m`, `--margin` | Page margin in points (1 pt = 1/72 in) | `40.0` |
| `--step` | Distance between lines/dots in points | `14.0` |
| `--layout`, `-2`, `--two-up` | Layout: `1-up` (1 slide) or `2-up` (2 slides per sheet) | `1-up` |
| `--binding` | Binding type: `none`, `binder` (+11mm / 30pt), `spiral` (+8mm / 22pt) | `none` |
| `--spiral` | Shortcut for spiral / coil binding (`--binding spiral`, +8mm margin) | `False` |
| `--gutter`, `--binder-margin` | Margin for ring binders (`--binding binder`, +11mm / 30pt) | `0.0` |
| `--hole-guides` | Print subtle punch hole targets or spiral coil clearance marks | `False` |
| `--duplex` / `--simplex` | Alternate gutter margin on odd/even sheets for 2-sided printing | `--simplex` |
| `--clean-cover` | Use 1st slide as title cover without note lines or dividers | `False` |
| `--generate-cover` | Generate an editorial title cover page before slides | `False` |
| `--cover-template` | Cover design: `atelier`, `quantum_flat`, `biophysics_flat`, `complex_systems_flat`, `materials_sim_flat`, `solid_state_flat`, `circuits_flat`, `nuclear_flat`, `academic_green`, `academic_teal`, `academic_wave`, `composition`, `george`, `monograph`, `bauhaus`, `fifties`, `sixties`, `seventies`, `eighties`, `nineties`, `natural`, `polo`, `equestrian` | `atelier` |
| `--cover-title` | Title for generated cover page | Presentation name |
| `--cover-author` | Author/Student/Topic for generated cover page | — |
| `--study-header` | Add top metadata bar with subject fill-in and date line | `False` |
| `--study-title` | Optional subject/topic name pre-filled in study header | — |
| `--pages` | Process specific slide range (e.g. `1-10, 15, 20-30` or `all`) | `all` |
| `--page-numbers`, `--no-page-numbers` | Centered page numbers at the footer of each sheet | `Enabled` |
| `--page-format` | Footer page number format: `total` (`1 / 24`) or `simple` (`1`) | `total` |
| `--eco`, `--grayscale` | Grayscale / ink-saver mode for monochrome printers | `False` |
| `-O`, `--open` | Automatically open output folder or generated PDF upon completion | — |
| `--dry-run` | Simulate execution: inspect slide counts and output paths without writing to disk | — |
| `--web` | Launch the local web studio in your default browser | — |
| `--port` | Port for the local web server | `8000` |
| `--interactive` | Force interactive prompt wizard | — |
| `-q`, `--quiet` | Suppress non-error logs and progress meters | — |
| `-v`, `--version` | Display program version | — |

---

### 🪄 3. Interactive Terminal Wizard

Running `slide-printer` without arguments (or with `--interactive`) launches a guided terminal wizard. Hitting `Enter` through all steps uses the instant defaults (**Graph grid**, **DIN A4**, and **current directory**):

```bash
slide-printer
```

---

### 🐍 4. Python API

You can also use `slide_printer` directly in your Python applications:

```python
from slide_printer import SlidePrinter

# Initialize printer with study header, duplex gutter, and 2-up layout
printer = SlidePrinter(
    paper_size="a4",
    layout="2-up",
    gutter_margin=30.0,
    duplex=True,
    study_header=True,
    study_title="Algorithms & Data Structures",
    cover_mode="clean_first",
    page_number_format="total"
)

# Process a presentation PDF with ruled lines and graph grid notes
output_files = printer.process_file(
    input_path="presentation.pdf",
    styles=["lines", "grid"],
    output_dir="handouts/",
    page_ranges="1-20"
)

print(f"Generated handouts: {output_files}")
```

---

## 🧪 Testing

Slide-Printer includes an automated test suite with `pytest` covering core transformation logic, 1-up and 2-up layouts, duplex binding margins, cover generation, study headers, pattern generators, link recalculations, CLI flags, PowerPoint detection, and dry-run simulation:

```bash
pip install -r requirements-dev.txt
pytest -v
```

All 36 unit tests run in ~3 seconds.

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
