import io
import pytest
from pypdf import PdfWriter, PdfReader
from pypdf.generic import DictionaryObject, NameObject, ArrayObject, FloatObject, TextStringObject
from reportlab.pdfgen import canvas


@pytest.fixture
def sample_slide_pdf(tmp_path):
    """Generates a synthetic 2-page 16:9 presentation PDF with an annotation."""
    slide_w, slide_h = 960.0, 540.0
    pdf_path = str(tmp_path / "sample_slides.pdf")

    # Create base PDF with reportlab
    packet = io.BytesIO()
    c = canvas.Canvas(packet, pagesize=(slide_w, slide_h))

    # Slide 1
    c.drawString(100, 450, "Slide 1: Introduction")
    c.rect(100, 200, 300, 150, fill=0, stroke=1)
    c.showPage()

    # Slide 2
    c.drawString(100, 450, "Slide 2: Details & References")
    c.rect(100, 200, 300, 150, fill=0, stroke=1)
    c.showPage()
    c.save()

    packet.seek(0)
    reader = PdfReader(packet)
    writer = PdfWriter()

    for i, page in enumerate(reader.pages):
        # Add a test link annotation to page 0
        if i == 0:
            link_annot = DictionaryObject()
            link_annot[NameObject("/Type")] = NameObject("/Annot")
            link_annot[NameObject("/Subtype")] = NameObject("/Link")
            link_annot[NameObject("/Rect")] = ArrayObject([
                FloatObject(100.0),
                FloatObject(200.0),
                FloatObject(400.0),
                FloatObject(350.0),
            ])
            action = DictionaryObject()
            action[NameObject("/S")] = NameObject("/URI")
            action[NameObject("/URI")] = TextStringObject("https://github.com")
            link_annot[NameObject("/A")] = action
            page[NameObject("/Annots")] = ArrayObject([link_annot])
        writer.add_page(page)

    with open(pdf_path, "wb") as f:
        writer.write(f)

    return pdf_path
