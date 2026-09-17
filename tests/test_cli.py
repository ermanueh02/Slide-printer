import pytest
from slide_printer.cli import parse_args, main


def test_cli_parse_args_defaults():
    args = parse_args(["-i", "file.pdf"])
    assert args.input == ["file.pdf"]
    assert args.styles == ["blank"]
    assert args.paper_size == "a4"
    assert args.margin == 40.0


def test_cli_parse_args_custom():
    args = parse_args([
        "-i", "slide1.pdf", "slide2.pdf",
        "-s", "lines", "grid",
        "-p", "letter",
        "-m", "35",
        "--step", "16",
        "-o", "custom_out",
        "-q"
    ])
    assert args.input == ["slide1.pdf", "slide2.pdf"]
    assert args.styles == ["lines", "grid"]
    assert args.paper_size == "letter"
    assert args.margin == 35.0
    assert args.step == 16.0
    assert args.output_dir == "custom_out"
    assert args.quiet is True


def test_cli_main_nonexistent_file(tmp_path):
    # Non-existent file should exit with code 1
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
