import pytest
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
    assert args.styles == ["blank"]
    assert args.paper_size == "a4"
    assert args.margin == 40.0
    assert args.dry_run is False
    assert args.open is False


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
