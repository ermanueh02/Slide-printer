import os
import io
import pytest
from pypdf import PdfWriter, PdfReader
from pypdf.generic import DictionaryObject, NameObject, ArrayObject, FloatObject, TextStringObject
from reportlab.pdfgen import canvas

from slide_printer.core import SlidePrinter, resolve_style, transform_annotations
from slide_printer.constants import PAPER_SIZES






def test_resolve_style():
    assert resolve_style("1") == "blank"
    assert resolve_style("2") == "lines"
    assert resolve_style("3") == "grid"
    assert resolve_style("4") == "dots"
    assert resolve_style("en_blanco") == "blank"
    assert resolve_style("cuadricula") == "grid"
    assert resolve_style("LINE") == "lines"
    with pytest.raises(ValueError):
        resolve_style("nonexistent_style")


def test_slide_printer_conversion(sample_slide_pdf, tmp_path):
    out_dir = str(tmp_path / "output")
    printer = SlidePrinter(paper_size="a4", margin=40.0, output_dir=out_dir)

    results = printer.process_file(
        sample_slide_pdf,
        styles=["blank", "lines", "grid", "dots"],
    )

    assert len(results) == 4
    for out_file in results:
        assert os.path.exists(out_file)
        reader = PdfReader(out_file)
        assert len(reader.pages) == 2

        # Check page size is A4
        for page in reader.pages:
            assert float(page.mediabox.width) == pytest.approx(PAPER_SIZES["a4"][0], 0.1)
            assert float(page.mediabox.height) == pytest.approx(PAPER_SIZES["a4"][1], 0.1)

        # Check that page 0 still has annotations and coordinates shifted
        p0 = reader.pages[0]
        assert "/Annots" in p0
        annots = p0["/Annots"]
        assert len(annots) >= 1
        annot_rect = [float(v) for v in annots[0].get_object()["/Rect"]]
        # Link rect coordinates should be scaled and translated
        assert annot_rect[0] == pytest.approx(93.675, 0.01)
        assert annot_rect[1] == pytest.approx(619.395, 0.01)
        assert annot_rect[2] == pytest.approx(254.7, 0.01)
        assert annot_rect[3] == pytest.approx(699.9075, 0.01)


def test_slide_printer_letter_size(sample_slide_pdf, tmp_path):
    out_dir = str(tmp_path / "output_letter")
    printer = SlidePrinter(paper_size="letter", margin=30.0, output_dir=out_dir)

    results = printer.process_file(sample_slide_pdf, styles=["lines"])
    assert len(results) == 1
    reader = PdfReader(results[0])
    p0 = reader.pages[0]
    assert float(p0.mediabox.width) == pytest.approx(PAPER_SIZES["letter"][0], 0.1)
    assert float(p0.mediabox.height) == pytest.approx(PAPER_SIZES["letter"][1], 0.1)


def test_batch_process_paths(sample_slide_pdf, tmp_path):
    out_dir = str(tmp_path / "output_batch")
    printer = SlidePrinter(output_dir=out_dir)

    results = printer.process_paths([sample_slide_pdf], styles=["dots"])
    assert len(results) == 1
    assert os.path.exists(results[0])


def test_slide_printer_page_numbers_toggle(sample_slide_pdf, tmp_path):
    # With page numbers
    printer_on = SlidePrinter(output_dir=str(tmp_path / "on"), page_numbers=True)
    res_on = printer_on.process_file(sample_slide_pdf, styles=["blank"])
    reader_on = PdfReader(res_on[0])
    lines_p0_on = [l.strip() for l in reader_on.pages[0].extract_text().splitlines()]
    lines_p1_on = [l.strip() for l in reader_on.pages[1].extract_text().splitlines()]
    assert "1 / 2" in lines_p0_on
    assert "2 / 2" in lines_p1_on

    # Without page numbers
    printer_off = SlidePrinter(output_dir=str(tmp_path / "off"), page_numbers=False)
    res_off = printer_off.process_file(sample_slide_pdf, styles=["blank"])
    reader_off = PdfReader(res_off[0])
    lines_p0_off = [l.strip() for l in reader_off.pages[0].extract_text().splitlines()]
    lines_p1_off = [l.strip() for l in reader_off.pages[1].extract_text().splitlines()]
    assert "1" not in lines_p0_off
    assert "2" not in lines_p1_off


def test_parse_page_ranges():
    from slide_printer.core import parse_page_ranges
    assert parse_page_ranges(None, 10) == list(range(10))
    assert parse_page_ranges("all", 5) == list(range(5))
    assert parse_page_ranges("1", 5) == [0]
    assert parse_page_ranges("1-3", 5) == [0, 1, 2]
    assert parse_page_ranges("1, 3, 5", 5) == [0, 2, 4]
    assert parse_page_ranges("2-4, 5", 10) == [1, 2, 3, 4]
    assert parse_page_ranges("99", 5) == []  # out of bounds ignored


def test_study_header_and_gutter(sample_slide_pdf, tmp_path):
    printer = SlidePrinter(
        output_dir=str(tmp_path / "study"),
        study_header=True,
        study_title="Matemáticas Avanzadas",
        gutter_margin=30.0,
        duplex=True,
    )
    res = printer.process_file(sample_slide_pdf, styles=["lines"])
    assert len(res) == 1
    reader = PdfReader(res[0])
    text_p0 = reader.pages[0].extract_text()
    assert "Matemáticas Avanzadas" in text_p0
    assert "FECHA:" in text_p0


def test_layout_2up(sample_slide_pdf, tmp_path):
    # sample_slide_pdf has 2 slides -> with 2-up layout it should fit in 1 sheet!
    printer = SlidePrinter(output_dir=str(tmp_path / "2up"), layout="2-up")
    res = printer.process_file(sample_slide_pdf, styles=["grid"])
    assert len(res) == 1
    reader = PdfReader(res[0])
    assert len(reader.pages) == 1
    text = reader.pages[0].extract_text()
    assert "Slide 1: Introduction" in text
    assert "Slide 2: Details" in text
    assert "1 / 1" in text


def test_cover_modes(sample_slide_pdf, tmp_path):
    # 1. Generated editorial cover
    printer_gen = SlidePrinter(
        output_dir=str(tmp_path / "cov_gen"),
        cover_mode="generate",
        cover_title="Dossier de Cálculo",
        cover_author="Manuel",
    )
    res_gen = printer_gen.process_file(sample_slide_pdf, styles=["lines"])
    reader_gen = PdfReader(res_gen[0])
    # 1 cover + 2 slides = 3 pages
    assert len(reader_gen.pages) == 3
    cover_text = reader_gen.pages[0].extract_text()
    assert "Dossier de Cálculo" in cover_text
    assert "Manuel" in cover_text

    # 2. Clean first slide cover
    printer_clean = SlidePrinter(
        output_dir=str(tmp_path / "cov_clean"),
        cover_mode="clean_first",
    )
    res_clean = printer_clean.process_file(sample_slide_pdf, styles=["blank"])
    reader_clean = PdfReader(res_clean[0])
    assert len(reader_clean.pages) == 2
    # First page is clean cover without page number
    p0_lines = [l.strip() for l in reader_clean.pages[0].extract_text().splitlines()]
    assert "1 / 2" not in p0_lines
    # Second page has page number
    p1_lines = [l.strip() for l in reader_clean.pages[1].extract_text().splitlines()]
    assert "2 / 2" in p1_lines


def test_page_number_format_simple(sample_slide_pdf, tmp_path):
    printer = SlidePrinter(
        output_dir=str(tmp_path / "simple"),
        page_number_format="simple",
    )
    res = printer.process_file(sample_slide_pdf, styles=["dots"])
    reader = PdfReader(res[0])
    p0_lines = [l.strip() for l in reader.pages[0].extract_text().splitlines()]
    assert "1" in p0_lines
    assert "1 / 2" not in p0_lines


