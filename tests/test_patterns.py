import pytest
from pypdf._page import PageObject
from slide_printer.constants import PAPER_SIZES
from slide_printer.patterns import create_notes_overlay


@pytest.mark.parametrize("style", ["blank", "lines", "grid", "dots"])
def test_create_notes_overlay_styles(style):
    a4_size = PAPER_SIZES["a4"]
    margin = 40.0
    width = a4_size[0] - 2 * margin
    y_sep = 500.0
    bottom_margin = 40.0

    overlay = create_notes_overlay(
        page_size=a4_size,
        y_sep=y_sep,
        margin=margin,
        width=width,
        bottom_margin=bottom_margin,
        style=style,
        step=14.0,
    )

    assert isinstance(overlay, PageObject)
    assert float(overlay.mediabox.width) == pytest.approx(a4_size[0], 0.1)
    assert float(overlay.mediabox.height) == pytest.approx(a4_size[1], 0.1)


def test_create_notes_overlay_custom_paper():
    letter_size = PAPER_SIZES["letter"]
    overlay = create_notes_overlay(
        page_size=letter_size,
        y_sep=400.0,
        margin=30.0,
        width=letter_size[0] - 60.0,
        bottom_margin=30.0,
        style="grid",
        step=18.0,
    )
    assert float(overlay.mediabox.width) == pytest.approx(letter_size[0], 0.1)
    assert float(overlay.mediabox.height) == pytest.approx(letter_size[1], 0.1)


def test_create_notes_overlay_page_number():
    a4_size = PAPER_SIZES["a4"]
    overlay_with = create_notes_overlay(
        page_size=a4_size,
        y_sep=500.0,
        margin=40.0,
        width=a4_size[0] - 80.0,
        bottom_margin=40.0,
        style="blank",
        page_number=42,
    )
    assert "42" in overlay_with.extract_text()

    overlay_without = create_notes_overlay(
        page_size=a4_size,
        y_sep=500.0,
        margin=40.0,
        width=a4_size[0] - 80.0,
        bottom_margin=40.0,
        style="blank",
        page_number=None,
    )
    assert overlay_without.extract_text().strip() == ""


from slide_printer.constants import COVER_TEMPLATES


@pytest.mark.parametrize("template", COVER_TEMPLATES)
@pytest.mark.parametrize("binding,gutter_margin", [("none", 0.0), ("binder", 30.0), ("spiral", 22.0)])
def test_generate_cover_page_templates(template, binding, gutter_margin):
    from slide_printer.patterns import generate_cover_page
    a4_size = PAPER_SIZES["a4"]
    for is_verso in [False, True]:
        cover = generate_cover_page(
            page_size=a4_size,
            title="Test Presentation on Architectural Binding Systems",
            subtitle="Memphis and Modernist Layout Compendium",
            author="Test Author",
            date_str="2026-09-20",
            num_slides=12,
            template=template,
            binding=binding,
            hole_guides=True,
            is_verso=is_verso,
            gutter_margin=gutter_margin,
        )
        assert isinstance(cover, PageObject)
        assert float(cover.mediabox.width) == pytest.approx(a4_size[0], 0.1)
        assert float(cover.mediabox.height) == pytest.approx(a4_size[1], 0.1)


