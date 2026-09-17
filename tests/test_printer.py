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
        assert annot_rect[0] > 0
        assert annot_rect[1] > 0
        assert annot_rect[2] > annot_rect[0]
        assert annot_rect[3] > annot_rect[1]


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
