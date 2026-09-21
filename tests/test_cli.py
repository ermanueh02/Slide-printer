import os
import pytest
from pypdf import PdfReader
from slide_printer.cli import (
    parse_args,
    main,
    check_pptx_file,
    render_progress_bar,
    format_bytes,
)


def test_cli_parse_args_defaults():
    args = parse_args(["-i", "file.pdf"])
    assert args.input == ["file.pdf"]
    assert args.styles == ["grid"]
    assert args.paper_size == "a4"
    assert args.output_dir == "handouts"
    assert args.margin == 40.0
    assert args.dry_run is False
    assert args.open is False
    assert args.page_numbers is True


def test_cli_parse_args_custom():
    args = parse_args([
        "-i", "slide1.pdf", "slide2.pdf",
        "-s", "lines", "grid",
        "-p", "letter",
        "-m", "35",
        "--step", "16",
        "-o", "custom_out",
        "-O",
        "--dry-run",
        "-q"
    ])
    assert args.input == ["slide1.pdf", "slide2.pdf"]
    assert args.styles == ["lines", "grid"]
    assert args.paper_size == "letter"
    assert args.margin == 35.0
    assert args.step == 16.0
    assert args.output_dir == "custom_out"
    assert args.open is True
    assert args.dry_run is True
    assert args.quiet is True


def test_cli_main_nonexistent_file(tmp_path):
    code = main(["-i", str(tmp_path / "does_not_exist.pdf"), "-s", "blank", "-q"])
    assert code == 1


def test_cli_main_success(sample_slide_pdf, tmp_path):
    out_dir = str(tmp_path / "cli_out")
    code = main([
        "-i", sample_slide_pdf,
        "-s", "all",
        "-o", out_dir,
        "-q"
    ])
    assert code == 0


def test_cli_main_dry_run(sample_slide_pdf, tmp_path):
    out_dir = str(tmp_path / "dry_run_out")
    code = main([
        "-i", sample_slide_pdf,
        "-s", "lines",
        "-o", out_dir,
        "--dry-run",
        "-q"
    ])
    assert code == 0
    # In dry-run mode, no output files should have been created
    assert not (tmp_path / "dry_run_out").exists()


def test_cli_parse_web_args():
    args = parse_args(["--web", "--port", "8080"])
    assert args.web is True
    assert args.port == 8080


def test_check_pptx_detection(tmp_path):
    pptx_path = str(tmp_path / "presentation.pptx")
    with open(pptx_path, "w") as f:
        f.write("dummy")

    is_pptx, match = check_pptx_file(pptx_path)
    assert is_pptx is True
    assert match is None

    # Now create companion PDF
    pdf_path = str(tmp_path / "presentation.pdf")
    with open(pdf_path, "w") as f:
        f.write("dummy pdf")

    is_pptx, match = check_pptx_file(pptx_path)
    assert is_pptx is True
    assert match == pdf_path


def test_render_progress_bar():
    bar_50 = render_progress_bar(10, 20, width=10)
    assert "50%" in bar_50
    assert "10/20" in bar_50

    bar_100 = render_progress_bar(20, 20, width=10)
    assert "100%" in bar_100
    assert "20/20" in bar_100


def test_format_bytes():
    assert format_bytes(500) == "500 B"
    assert "KB" in format_bytes(2048)
    assert "MB" in format_bytes(5 * 1024 * 1024)


def test_print_summary_table_perfect_alignment(capsys):
    import re
    from slide_printer.cli import print_summary_table

    rows = [
        {"name": "Tema 0. Fundamentos de Instrumentación y Medida.pdf", "slides": 40, "output": "1 files (dots)"},
        {"name": "Tema 1. Amplificación.pdf", "slides": 80, "output": "1 files (dots)"},
        {"name": "Tema 2. Filtrado.pdf", "slides": 77, "output": "1 files (dots)"},
        {"name": "Tema 3. Conversión de Datos.pdf", "slides": 103, "output": "1 files (dots)"},
    ]
    print_summary_table(rows, elapsed=1.23, out_dir="handouts", paper="a4")
    captured = capsys.readouterr().out
    table_lines = [line for line in captured.splitlines() if line.startswith(("╭", "│", "├", "╰"))]
    assert len(table_lines) >= 8

    ansi_escape = re.compile(r'\x1B(?:[@-Z\\-_]|\[[0-?]*[ -/]*[@-~])')
    plain_lines = [ansi_escape.sub('', l) for l in table_lines]
    lengths = [len(l) for l in plain_lines]
    assert len(set(lengths)) == 1, f"Table border misalignment detected: lengths={lengths}"


def test_interactive_wizard_defaults(monkeypatch, sample_slide_pdf, tmp_path):
    import shutil
    import os
    from slide_printer.cli import interactive_wizard

    # Run in a temp directory with a copy of sample_slide_pdf
    shutil.copy(sample_slide_pdf, tmp_path / "test_presentation.pdf")
    old_cwd = os.getcwd()
    os.chdir(tmp_path)
    try:
        # Simulate hitting Enter 4 times (style default: grid, paper default: a4, binding default: none, files default: .)
        # and 'n' to open folder prompt
        inputs = iter(["", "", "", "", "n"])
        monkeypatch.setattr("builtins.input", lambda prompt="": next(inputs))
        res = interactive_wizard()
        assert res == 0
        # Output should be generated in handouts/grid directory
        assert (tmp_path / "handouts" / "grid" / "test_presentation_grid.pdf").exists()
    finally:
        os.chdir(old_cwd)


def test_parse_index_ranges():
    from slide_printer.cli import parse_index_ranges

    # Basic ranges and numbers
    assert parse_index_ranges("1-3, 5", 5) == [0, 1, 2, 4]
    assert parse_index_ranges("1, 2, 3, 5", 5) == [0, 1, 2, 4]
    assert parse_index_ranges("2-4", 5) == [1, 2, 3]
    assert parse_index_ranges(" 1 - 3 , 5 ", 5) == [0, 1, 2, 4]
    assert parse_index_ranges("3", 5) == [2]
    assert parse_index_ranges("3-1", 5) == [2, 1, 0]

    # Non-index strings return None
    assert parse_index_ranges("lecture.pdf", 5) is None
    assert parse_index_ranges(".", 5) is None
    assert parse_index_ranges("", 5) is None
    assert parse_index_ranges("*", 5) is None

    # Out of range raises ValueError
    with pytest.raises(ValueError, match="Index 6 is out of range"):
        parse_index_ranges("1-3, 6", 5)

    with pytest.raises(ValueError, match="Index 0 is out of range"):
        parse_index_ranges("0-2", 5)


def test_interactive_wizard_range_selection(monkeypatch, sample_slide_pdf, tmp_path):
    import shutil
    import os
    from slide_printer.cli import interactive_wizard

    # Create 3 presentations
    shutil.copy(sample_slide_pdf, tmp_path / "lecture1.pdf")
    shutil.copy(sample_slide_pdf, tmp_path / "lecture2.pdf")
    shutil.copy(sample_slide_pdf, tmp_path / "lecture3.pdf")

    old_cwd = os.getcwd()
    os.chdir(tmp_path)
    try:
        # Style: 1 (grid), Paper: 1 (a4), Binding: 1 (none), Selection: "1, 3" (lecture1 and lecture3, skip lecture2), Open: n
        inputs = iter(["1", "1", "1", "1, 3", "n"])
        monkeypatch.setattr("builtins.input", lambda prompt="": next(inputs))
        res = interactive_wizard()
        assert res == 0
        assert (tmp_path / "handouts" / "grid" / "lecture1_grid.pdf").exists()
        assert not (tmp_path / "handouts" / "grid" / "lecture2_grid.pdf").exists()
        assert (tmp_path / "handouts" / "grid" / "lecture3_grid.pdf").exists()
    finally:
        os.chdir(old_cwd)


def test_parse_styles_arg():
    from slide_printer.cli import parse_styles_arg

    # Default
    assert parse_styles_arg(None) == ["grid"]
    assert parse_styles_arg("") == ["grid"]

    # Individual and combinations
    assert parse_styles_arg("lines") == ["lines"]
    assert parse_styles_arg("1") == ["grid"]
    assert parse_styles_arg("2") == ["lines"]
    assert parse_styles_arg("1, 2") == ["grid", "lines"]
    assert parse_styles_arg("1-2") == ["grid", "lines"]
    assert parse_styles_arg("2-3") == ["lines", "dots"]
    assert parse_styles_arg(["lines", "grid"]) == ["lines", "grid"]
    assert parse_styles_arg("lineas y cuadricula") == ["lines", "grid"]
    assert parse_styles_arg("grid + lines") == ["grid", "lines"]

    # All styles
    assert parse_styles_arg("A") == ["grid", "lines", "dots", "blank"]
    assert parse_styles_arg("all") == ["grid", "lines", "dots", "blank"]
    assert parse_styles_arg("*") == ["grid", "lines", "dots", "blank"]

    # Invalid style raises ValueError
    with pytest.raises(ValueError, match="Unknown style"):
        parse_styles_arg("invalid_style")


def test_selective_styles_cli_execution(sample_slide_pdf, tmp_path):
    # Process only lines and grid
    out_dir = str(tmp_path / "custom_handouts")
    code = main([
        "-i", sample_slide_pdf,
        "-s", "lines", "grid",
        "-o", out_dir,
        "-q"
    ])
    assert code == 0

    base = os.path.splitext(os.path.basename(sample_slide_pdf))[0]
    # Check that ONLY lines and grid are generated
    assert (tmp_path / "custom_handouts" / "lines" / f"{base}_lines.pdf").exists()
    assert (tmp_path / "custom_handouts" / "grid" / f"{base}_grid.pdf").exists()
    # Ensure blank and dots were NOT compiled
    assert not (tmp_path / "custom_handouts" / "blank").exists()
    assert not (tmp_path / "custom_handouts" / "dots").exists()


def test_interactive_wizard_selective_styles(monkeypatch, sample_slide_pdf, tmp_path):
    import shutil
    import os
    from slide_printer.cli import interactive_wizard

    shutil.copy(sample_slide_pdf, tmp_path / "presentation.pdf")
    old_cwd = os.getcwd()
    os.chdir(tmp_path)
    try:
        # Style: "1, 2" (Grid + Lines), Paper: 1 (a4), Binding: 1 (none), File: 1, Open: n
        inputs = iter(["1, 2", "1", "1", "1", "n"])
        monkeypatch.setattr("builtins.input", lambda prompt="": next(inputs))
        res = interactive_wizard()
        assert res == 0
        assert (tmp_path / "handouts" / "grid" / "presentation_grid.pdf").exists()
        assert (tmp_path / "handouts" / "lines" / "presentation_lines.pdf").exists()
        assert not (tmp_path / "handouts" / "blank").exists()
        assert not (tmp_path / "handouts" / "dots").exists()
    finally:
        os.chdir(old_cwd)



def test_cli_parse_args_page_numbers():
    args_default = parse_args(["-i", "file.pdf"])
    assert args_default.page_numbers is True

    args_no = parse_args(["-i", "file.pdf", "--no-page-numbers"])
    assert args_no.page_numbers is False

    args_yes = parse_args(["-i", "file.pdf", "--page-numbers"])
    assert args_yes.page_numbers is True


def test_cli_page_numbers_execution(sample_slide_pdf, tmp_path):
    # 1. Default (with page numbers and --no-cover)
    out_dir_yes = str(tmp_path / "out_yes")
    code_yes = main(["-i", sample_slide_pdf, "-s", "lines", "--no-cover", "-o", out_dir_yes, "-q"])
    assert code_yes == 0

    base = os.path.splitext(os.path.basename(sample_slide_pdf))[0]
    pdf_yes = tmp_path / "out_yes" / "lines" / f"{base}_lines.pdf"
    reader_yes = PdfReader(str(pdf_yes))
    lines_p0_yes = [l.strip() for l in reader_yes.pages[0].extract_text().splitlines()]
    lines_p1_yes = [l.strip() for l in reader_yes.pages[1].extract_text().splitlines()]
    assert "1 / 2" in lines_p0_yes
    assert "2 / 2" in lines_p1_yes

    # 2. Disabled via --no-page-numbers
    out_dir_no = str(tmp_path / "out_no")
    code_no = main(["-i", sample_slide_pdf, "-s", "lines", "--no-cover", "--no-page-numbers", "-o", out_dir_no, "-q"])
    assert code_no == 0

    pdf_no = tmp_path / "out_no" / "lines" / f"{base}_lines.pdf"
    reader_no = PdfReader(str(pdf_no))
    lines_p0_no = [l.strip() for l in reader_no.pages[0].extract_text().splitlines()]
    lines_p1_no = [l.strip() for l in reader_no.pages[1].extract_text().splitlines()]
    # Footer should not contain standalone page numbers
    assert "1" not in lines_p0_no
    assert "2" not in lines_p1_no


def test_cli_parse_args_extended_flags():
    args = parse_args([
        "-i", "file.pdf",
        "--pages", "1-5, 8",
        "--page-format", "simple",
        "--study-header",
        "--study-title", "Biología",
        "--binder-margin",
        "--duplex",
        "--generate-cover",
        "--cover-title", "Apuntes Biología",
        "--cover-author", "Manuel",
        "-2",
        "--grayscale",
    ])
    assert args.pages == "1-5, 8"
    assert args.page_format == "simple"
    assert args.study_header is True
    assert args.study_title == "Biología"
    assert args.gutter == 30.0
    assert args.duplex is True
    assert args.generate_cover is True
    assert args.cover_title == "Apuntes Biología"
    assert args.cover_author == "Manuel"
    assert args.layout == "2-up"
    assert args.grayscale is True


def test_cli_execution_extended_flags(sample_slide_pdf, tmp_path):
    out_dir = str(tmp_path / "extended_out")
    code = main([
        "-i", sample_slide_pdf,
        "-s", "grid",
        "--pages", "1",
        "--study-header",
        "--study-title", "Física Cuántica",
        "-2",
        "--no-cover",
        "-o", out_dir,
        "-q",
    ])
    assert code == 0
    base = os.path.splitext(os.path.basename(sample_slide_pdf))[0]
    out_pdf = tmp_path / "extended_out" / "grid" / f"{base}_grid.pdf"
    assert out_pdf.exists()
    reader = PdfReader(str(out_pdf))
    assert len(reader.pages) == 1
    text = reader.pages[0].extract_text()
    assert "Física Cuántica" in text
    assert "Slide 1: Introduction" in text
    assert "Slide 2: Details" not in text  # Page 2 was filtered out!


def test_cli_version():
    from slide_printer import __version__
    assert __version__ == "4.3.0"
    with pytest.raises(SystemExit) as exc:
        parse_args(["-v"])
    assert exc.value.code == 0


def test_cli_binding_and_spiral_flags(sample_slide_pdf, tmp_path):
    out_dir = str(tmp_path / "cli_spiral")
    code = main([
        "-i", sample_slide_pdf,
        "-s", "lines",
        "--spiral",
        "--hole-guides",
        "--duplex",
        "-o", out_dir,
        "-q",
    ])
    assert code == 0
    base = os.path.splitext(os.path.basename(sample_slide_pdf))[0]
    out_pdf = tmp_path / "cli_spiral" / "lines" / f"{base}_lines.pdf"
    assert out_pdf.exists()


def test_cli_no_cover_flag(sample_slide_pdf, tmp_path):
    out_dir = str(tmp_path / "cli_no_cover")
    code = main([
        "-i", sample_slide_pdf,
        "-s", "lines",
        "--no-cover",
        "-o", out_dir,
        "-q",
    ])
    assert code == 0
    base = os.path.splitext(os.path.basename(sample_slide_pdf))[0]
    out_pdf = tmp_path / "cli_no_cover" / "lines" / f"{base}_lines.pdf"
    assert out_pdf.exists()
    reader = PdfReader(str(out_pdf))
    # 2 slides with no cover = exactly 2 pages
    assert len(reader.pages) == 2


def test_cli_decade_cover_template_flag(sample_slide_pdf, tmp_path):
    out_dir = str(tmp_path / "cli_fifties")
    code = main([
        "-i", sample_slide_pdf,
        "-s", "blank",
        "--generate-cover",
        "--cover-template", "fifties",
        "--cover-title", "Quantum Mechanics 1950",
        "-o", out_dir,
        "-q",
    ])
    assert code == 0
    base = os.path.splitext(os.path.basename(sample_slide_pdf))[0]
    out_pdf = tmp_path / "cli_fifties" / "blank" / f"{base}_blank.pdf"
    assert out_pdf.exists()
    reader = PdfReader(str(out_pdf))
    assert len(reader.pages) == 3


def test_cli_natural_cover_template_flag(sample_slide_pdf, tmp_path):
    out_dir = str(tmp_path / "cli_natural")
    code = main([
        "-i", sample_slide_pdf,
        "-s", "lines",
        "--generate-cover",
        "--cover-template", "natural",
        "--cover-title", "Forest & Woodwork Compendium",
        "--cover-author", "Architect Alexander",
        "-o", out_dir,
        "-q",
    ])
    assert code == 0
    base = os.path.splitext(os.path.basename(sample_slide_pdf))[0]
    out_pdf = tmp_path / "cli_natural" / "lines" / f"{base}_lines.pdf"
    assert out_pdf.exists()
    reader = PdfReader(str(out_pdf))
    assert len(reader.pages) == 3


def test_cli_polo_and_seasons_template_flags(sample_slide_pdf, tmp_path):
    for tmpl in ["polo", "equestrian", "spring", "summer", "autumn", "winter"]:
        out_dir = str(tmp_path / f"cli_{tmpl}")
        code = main([
            "-i", sample_slide_pdf,
            "-s", "lines",
            "--cover-template", tmpl,
            "--cover-title", f"Edition {tmpl.title()}",
            "-o", out_dir,
            "-q",
        ])
        assert code == 0
        base = os.path.splitext(os.path.basename(sample_slide_pdf))[0]
        out_pdf = tmp_path / f"cli_{tmpl}" / "lines" / f"{base}_lines.pdf"
        assert out_pdf.exists()
        reader = PdfReader(str(out_pdf))
        cover_text = reader.pages[0].extract_text()
        assert f"Edition {tmpl.title()}" in cover_text


def test_cli_notebooks_cover_template_flags(sample_slide_pdf, tmp_path):
    for tmpl in [
        "academic_green", "academic_teal", "academic_wave",
        "composition", "comp_blue", "comp_coral", "comp_amber",
        "comp_morris", "comp_ukiyoe", "comp_flora", "comp_pastoral", "comp_marbled"
    ]:
        out_dir = str(tmp_path / f"cli_{tmpl}")
        code = main([
            "-i", sample_slide_pdf,
            "-s", "grid",
            "--cover-template", tmpl,
            "--cover-title", f"Notebook {tmpl}",
            "-o", out_dir,
            "-q",
        ])
        assert code == 0
        base = os.path.splitext(os.path.basename(sample_slide_pdf))[0]
        out_pdf = tmp_path / f"cli_{tmpl}" / "grid" / f"{base}_grid.pdf"
        assert out_pdf.exists()
        reader = PdfReader(str(out_pdf))
        assert len(reader.pages) == 3
        cover_text = reader.pages[0].extract_text()
        assert f"Notebook {tmpl}" in cover_text
