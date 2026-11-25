# AGENTS.md — Slide-Printer Architecture & Continuity Guide

This document defines the architecture, design invariants, and verification rules for **Slide-Printer** (`https://github.com/ermanueh02/Slide-printer`). Read and follow it before modifying code.

---

## 1. Project Overview & Versioning
- **Python Package (`pyproject.toml`, `slide_printer/__init__.py`):** `5.0.0` (CLI + Interactive Wizard + Python API).
- **Web Studio PWA (`web/`):** **Web Studio 3.0** (`https://ermanueh02.github.io/Slide-printer/`, auto-deployed on pushes to `web/**` via `.github/workflows/deploy-pages.yml`).
- **CI (`.github/workflows/ci.yml`):** Runs `pytest -v` across Ubuntu, Windows, and macOS on Python 3.9–3.14.

Slide-Printer offers two complete modes across both Python and the 100% client-side Web Studio PWA:
1. **Slide Handouts:** Converts 16:9 / 4:3 presentation PDFs onto `A4`, `Letter`, `Legal`, or `A3` in `1-up` or `2-up` layouts with 5 note patterns (`blank`, `lines`, `grid`, `dots`, `cornell`), active hyperlink preservation (`/Annots` `/Rect`), `study_header`, page range filtering (`--pages`), grayscale eco mode, and multi-file ZIP batch export.
2. **Digital Notebook Studio (`--notebook`):** Generates full-sheet digital/printable notebooks (Samsung Notes, GoodNotes, Notability, or print) with all 5 note styles, 7 paper tints (`white`, `ivory`, `cream`, `dark`, `oled`, `legal`, `sage`), classic red `margin_line` (with optional duplex mirroring), binding gutters (`none`, `binder` +30pt, `spiral` +22pt), punch/spiral guides, duplex alternating gutters, and 55 editorial/scientific covers.

---

## 2. Repository Architecture
- **Python Package (`slide_printer/`):**
  - `constants.py`: Paper sizes, 5 note styles, 7 paper tints (`oled` = pure `#000000`, `dark` = `#141518`), binding constants, and `COVER_TEMPLATES` / `COVER_TEMPLATE_ALIASES` (**55 canonical cover templates**).
  - `core.py`: `SlidePrinter`, `parse_page_ranges`, `transform_annotations`, `convert_slide_page`, `convert_2up_page` (uses a staging `PdfWriter` for `pypdf >= 7.0` compatibility), `process_file`, `generate_notebook`.
  - `patterns.py`: ReportLab vector engine for 1-up/2-up note overlays, `create_notebook_page`, duplex gutters, hole/spiral guides, `format_cover_date` (`DD/MM/YY` input -> per-template localized output), and `generate_cover_page`.
  - `cli.py`: CLI parser, interactive wizard, `--dry-run`, and local Web Studio server (`--web`).
  - `latex_compiler.py`: Compiles 20 vector math formulas via LaTeX (`newtxtext`, `newtxmath`) + `dvisvgm --no-fonts` to `slide_printer/assets/math/`, `web/assets/math/`, and `web/js/math_assets.js`.
- **Web Studio 3.0 PWA (`web/`):**
  - `index.html` & `css/style.css`: Editorial mid-century modern UI, Handouts + Notebook Studio workspaces, Visual Cover Gallery modal (`G`), instant cover search, smart presets, `localStorage` persistence.
  - `js/engine.js`: Client-side PDF generation via `pdf-lib` (vendored in `web/vendor/`).
  - `js/preview.js`: Live HTML5 Canvas + PDF.js preview renderer (`renderPreview`, `renderNotebookPreview`, `renderCoverThumbnail`).
  - `js/app.js`: State controller, `en`/`es`/`gl` i18n dictionary, preset persistence, cover gallery, keyboard shortcuts, and PWA install prompt.
  - `sw.js` & `manifest.json`: Offline precaching and installable PWA configuration.
- **Tests (`tests/`):** `test_printer.py`, `test_patterns.py`, `test_cli.py`, `test_pwa.py`.

---

## 3. Mandatory Engineering Invariants
1. **Strict 3-Layer Parity:** Any change to layouts, note patterns (1-up, 2-up, notebook), paper tints, duplex margins, cover dates, or cover designs MUST be kept synchronized across:
   - Python (`slide_printer/patterns.py`, `core.py`, `cli.py`)
   - Web PDF Exporter (`web/js/engine.js`)
   - Web Canvas Preview (`web/js/preview.js`)
2. **Cover Catalog & PWA Integrity (`tests/test_pwa.py`):**
   - Both `#coverTemplateSelect` and `#nbCoverTemplateSelect` in `web/index.html` MUST list all canonical templates in `COVER_TEMPLATES` (55).
   - Whenever web assets are added, renamed, or updated, update `PRECACHE_ASSETS` (if new files) and bump `CACHE_NAME` in `web/sw.js`.
   - Keep `slide_printer/assets/covers/` ↔ `web/covers/` and `slide_printer/assets/math/` ↔ `web/assets/math/` + `web/js/math_assets.js` synchronized.
3. **Full Trilingual UI (`en`, `es`, `gl`):** Every new UI label or placeholder in `web/` must have translations in `en`, `es`, and `gl` inside `web/js/app.js`.
4. **Prevent Resolved Regressions:**
   - Clone `ArrayBuffer` / `Uint8Array` slices before passing PDF bytes between PDF.js and `pdf-lib` so buffers never detach.
   - Preserve `study_header` horizontal offset and vertical clearance on odd/even duplex sheets.
   - In `pypdf >= 7.0`, never call `add_transformation()` on an unattached `PageObject` (attach to a `PdfWriter` first).
5. **Mandatory Verification:** Always run `pytest -v` before finishing any task (validates Python engine, CLI, PWA manifest/service worker, `node -c` JS syntax, and `engine.js` loading in Node).
