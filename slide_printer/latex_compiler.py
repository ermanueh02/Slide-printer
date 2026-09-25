"""LaTeX Math Compiler for Slide-Printer.

Compiles mathematical equations and formulas for the scientific cover templates
using LaTeX with the `newtxtext` and `newtxmath` packages, generating crisp
vector SVGs, high-res PNGs, and a standalone JavaScript bundle for client-side
rendering in the web studio.
"""

from __future__ import annotations

import base64
import os
import shutil
import subprocess
import sys
import tempfile
from typing import Dict, Tuple

# All mathematical formulas used across Slide-Printer scientific templates
# Formatted with proper LaTeX typography and newtxmath styling
MATH_FORMULAS: Dict[str, Dict[str, str]] = {
    # 1. Mecánica Cuántica III (Quantum Mechanics III)
    "quantum_header": {
        "latex": r"$\hat{H} |\psi\rangle = E |\psi\rangle \quad\cdot\quad \vec{L}\cdot\vec{S} \quad\cdot\quad \sigma_{\mathrm{tot}} = \frac{4\pi}{k}\,\mathrm{Im}\,f(0)$",
        "color": "#4338ca",  # deep indigo violet
    },
    "quantum_e0": {
        "latex": r"$E_0 = \frac{1}{2}\hbar\omega$",
        "color": "#4338ca",
    },
    "quantum_e1": {
        "latex": r"$E_1 = \frac{3}{2}\hbar\omega$",
        "color": "#4338ca",
    },
    "quantum_e2": {
        "latex": r"$E_2 = \frac{5}{2}\hbar\omega$",
        "color": "#4338ca",
    },
    "quantum_e3": {
        "latex": r"$E_3 = \frac{7}{2}\hbar\omega$",
        "color": "#4338ca",
    },
    "quantum_inf_pos": {
        "latex": r"$+\infty$",
        "color": "#0f172a",
    },
    "quantum_inf_neg": {
        "latex": r"$-\infty$",
        "color": "#0f172a",
    },

    # 2. Biofísica (Molecular Biophysics)
    "biophysics_header": {
        "latex": r"$\Delta G = \Delta H - T\Delta S \quad\cdot\quad k_B T \ln(K_{\mathrm{eq}})$",
        "color": "#0d9488",  # bright teal
    },

    # 3. Física de los Sistemas Complejos (Complex Systems & Chaos)
    "complex_header": {
        "latex": r"$\dot{x}=\sigma(y-x) \quad\cdot\quad \dot{y}=x(\rho-z)-y \quad\cdot\quad \dot{z}=xy-\beta z \quad\cdot\quad \delta\approx 4.6692$",
        "color": "#d97706",  # electric amber
    },
    "complex_lorenz": {
        "latex": r"$\mathrm{LORENZ}\ (1963) \quad\cdot\quad \sigma = 10.0 \quad\cdot\quad \rho = 28.0 \quad\cdot\quad \beta = 8/3 \quad\cdot\quad D_{\mathrm{KY}} = 2.06$",
        "color": "#64748b",  # storm slate
    },

    # 4. Simulación en Física de Materiales (Materials Physics Simulation)
    "materials_header": {
        "latex": r"$\mathbf{F}_i = -\nabla_i V(r_{ij}) \quad\cdot\quad \Delta t = 1.0\ \mathrm{fs} \quad\cdot\quad D = \frac{1}{6}\lim_{t\to\infty} \frac{d\langle |\Delta \mathbf{r}|^2 \rangle}{dt}$",
        "color": "#15803d",  # phosphor green
    },

    # 5. Fundamentos de Instrumentación Electrónica (Electronic Instrumentation)
    "circuits_header": {
        "latex": r"$V_{\mathrm{out}} = -\frac{R_f}{R_{\mathrm{in}}} V_{\mathrm{in}} \quad\cdot\quad \mathrm{CMRR} > 120\ \mathrm{dB} \quad\cdot\quad f_s \ge 2 f_{\max}$",
        "color": "#047857",  # circuit pcb green
    },

    # 6. Física del Estado Sólido (Solid State Physics)
    "solid_header": {
        "latex": r"$\psi_{\mathbf{k}}(\mathbf{r}) = e^{i\mathbf{k}\cdot\mathbf{r}} u_{\mathbf{k}}(\mathbf{r}) \quad\cdot\quad E_F = \frac{\hbar^2 k_F^2}{2m^*} \quad\cdot\quad \Phi_0 = \frac{h}{2e}$",
        "color": "#b45309",  # copper bronze
    },
    "solid_gamma": {
        "latex": r"$\Gamma$",
        "color": "#172554",  # cobalt dark
    },
    "solid_k": {
        "latex": r"$K$",
        "color": "#172554",
    },
    "solid_m": {
        "latex": r"$M$",
        "color": "#172554",
    },

    # 7. Física Nuclear y de Partículas (Nuclear & Particle Physics)
    "nuclear_header": {
        "latex": r"$\mathrm{SU}(3)_C \times \mathrm{SU}(2)_L \times \mathrm{U}(1)_Y \quad\cdot\quad B(A,Z) \quad\cdot\quad \sqrt{s} = 14\ \mathrm{TeV}$",
        "color": "#6366f1",  # high-energy violet
    },
    "nuclear_eminus": {
        "latex": r"$e^-$",
        "color": "#0f172a",
    },
    "nuclear_eplus": {
        "latex": r"$e^+$",
        "color": "#0f172a",
    },
    "nuclear_boson": {
        "latex": r"$\gamma^* / Z^0$",
        "color": "#6366f1",
    },
}

LATEX_DOCUMENT_TEMPLATE = r"""\documentclass{standalone}
\usepackage[utf8]{inputenc}
\usepackage{amsmath,amssymb}
\usepackage{xcolor}
\usepackage{newtxtext,newtxmath}
\pagestyle{empty}
\begin{document}
\color{COLOR_HEX}
MATH_EXPRESSION
\end{document}
"""


def compile_all(
    py_assets_dir: str = "slide_printer/assets/math",
    web_assets_dir: str = "web/assets/math",
    js_bundle_path: str = "web/js/math_assets.js",
) -> None:
    """Compile all LaTeX formulas with newtxmath into SVGs and JavaScript bundle."""
    os.makedirs(py_assets_dir, exist_ok=True)
    os.makedirs(web_assets_dir, exist_ok=True)

    svg_dict: Dict[str, str] = {}

    with tempfile.TemporaryDirectory() as tmpdir:
        for name, spec in MATH_FORMULAS.items():
            color = spec.get("color", "#000000").lstrip("#")
            expr = spec["latex"]

            # Replace placeholders in LaTeX template
            tex_doc = LATEX_DOCUMENT_TEMPLATE.replace("COLOR_HEX", f"[HTML]{{{color}}}")
            tex_doc = tex_doc.replace("MATH_EXPRESSION", expr)

            tex_file = os.path.join(tmpdir, f"{name}.tex")
            with open(tex_file, "w", encoding="utf-8") as f:
                f.write(tex_doc)

            # Compile with latex to DVI
            cmd_latex = ["latex", "-interaction=nonstopmode", f"{name}.tex"]
            res1 = subprocess.run(cmd_latex, cwd=tmpdir, capture_output=True, text=True)
            dvi_file = os.path.join(tmpdir, f"{name}.dvi")

            if not os.path.exists(dvi_file):
                print(f"[FAIL] LaTeX compilation failed for {name}:")
                print(res1.stdout[-300:])
                continue

            # Convert to SVG with dvisvgm --no-fonts (all glyphs -> vector bezier paths)
            svg_file = os.path.join(tmpdir, f"{name}.svg")
            cmd_dvisvgm = [
                "dvisvgm",
                "--no-fonts",
                "--exact",
                f"{name}.dvi",
                "-o",
                f"{name}.svg",
            ]
            res2 = subprocess.run(cmd_dvisvgm, cwd=tmpdir, capture_output=True, text=True)

            if not os.path.exists(svg_file):
                print(f"[FAIL] dvisvgm conversion failed for {name}:")
                print(res2.stderr)
                continue

            with open(svg_file, "r", encoding="utf-8") as f:
                svg_content = f.read()

            # Copy to python and web asset directories
            py_target = os.path.join(py_assets_dir, f"{name}.svg")
            web_target = os.path.join(web_assets_dir, f"{name}.svg")
            with open(py_target, "w", encoding="utf-8") as f:
                f.write(svg_content)
            with open(web_target, "w", encoding="utf-8") as f:
                f.write(svg_content)

            svg_dict[name] = svg_content
            print(f"[OK] Generated {name}.svg ({len(svg_content)} bytes)")

    # Generate web/js/math_assets.js for instant browser loading
    os.makedirs(os.path.dirname(js_bundle_path), exist_ok=True)
    with open(js_bundle_path, "w", encoding="utf-8") as f:
        f.write("// Pre-compiled LaTeX mathematical formulas using newtxtext & newtxmath\n")
        f.write("// Pure vector SVG strings with bezier paths, zero font dependency\n")
        f.write("window.SLIDE_PRINTER_MATH_ASSETS = {\n")
        for k, v in svg_dict.items():
            # escape backslashes and single quotes
            escaped = v.replace("\\", "\\\\").replace("'", "\\'").replace("\n", "\\n")
            f.write(f"  '{k}': '{escaped}',\n")
        f.write("};\n")

    print(f"\nSuccessfully generated {len(svg_dict)} math assets in {js_bundle_path}!")


if __name__ == "__main__":
    compile_all()
