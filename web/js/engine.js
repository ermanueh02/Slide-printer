/**
 * Slide-Printer Engine (Client-Side)
 * 
 * Transforms presentation slide PDFs into printable handouts with note-taking space.
 * Matches the exact behavior, mathematical coordinates, and style overlays
 * of the Slide-Printer Python core engine.
 */

(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory(require('../vendor/pdf-lib.min.js'));
  } else {
    root.SlidePrinterEngine = factory(root.PDFLib);
  }
})(typeof self !== 'undefined' ? self : this, function (PDFLib) {
  'use strict';

  if (!PDFLib) {
    throw new Error('PDFLib is required for SlidePrinterEngine.');
  }

  const { PDFDocument, rgb, PDFName, PDFArray, PDFDict, StandardFonts } = PDFLib;

  // Standard paper sizes in points (1 pt = 1/72 inch)
  const PAPER_SIZES = {
    a4: [595.28, 841.89],
    letter: [612.0, 792.0],
    legal: [612.0, 1008.0],
    a3: [841.89, 1190.55],
  };

  const DEFAULT_MARGIN = 40.0;
  const DEFAULT_STEP = 14.0; // ~4.94 mm
  const DEFAULT_SEPARATION = 10.0;

  const STYLES = {
    blank: { id: 'blank', name: 'Blank', code: 'blank' },
    lines: { id: 'lines', name: 'Lined', code: 'lines' },
    grid: { id: 'grid', name: 'Grid', code: 'grid' },
    dots: { id: 'dots', name: 'Dot Grid', code: 'dots' },
  };

  /**
   * Parses page ranges string (e.g. '1-5, 8, 11-15') into 0-based indices array.
   */
  function parsePageRanges(rangeStr, totalPages) {
    if (!rangeStr || !rangeStr.trim() || rangeStr.trim().toLowerCase() === 'all' || rangeStr.trim() === '*') {
      return Array.from({ length: totalPages }, (_, i) => i);
    }
    const indices = [];
    const parts = rangeStr.split(',');
    for (const part of parts) {
      const clean = part.trim();
      if (!clean) continue;
      if (clean.includes('-')) {
        const sub = clean.split('-');
        const start = parseInt(sub[0].trim(), 10);
        const end = parseInt(sub[1].trim(), 10);
        if (!isNaN(start) && !isNaN(end)) {
          for (let p = start; p <= end; p++) {
            const idx = p - 1;
            if (idx >= 0 && idx < totalPages && !indices.includes(idx)) {
              indices.push(idx);
            }
          }
        }
      } else {
        const p = parseInt(clean, 10);
        const idx = p - 1;
        if (!isNaN(p) && idx >= 0 && idx < totalPages && !indices.includes(idx)) {
          indices.push(idx);
        }
      }
    }
    return indices.length > 0 ? indices : Array.from({ length: totalPages }, (_, i) => i);
  }

  /**
   * Recalculates and re-maps /Rect coordinates for hyperlinks and interactive annotations.
   */
  function transformAndCopyAnnotations(srcDoc, srcPage, outDoc, newPage, scale, tx, ty) {
    const annots = srcPage.node.Annots();
    if (!annots || typeof annots.size !== 'function' || annots.size() === 0) {
      return;
    }

    let existingAnnots = newPage.node.Annots();
    if (!existingAnnots) {
      existingAnnots = outDoc.context.obj([]);
      newPage.node.set(PDFName.of('Annots'), existingAnnots);
    }

    for (let i = 0; i < annots.size(); i++) {
      try {
        const annotRefOrDict = annots.get(i);
        const annotDict = srcDoc.context.lookup(annotRefOrDict);
        if (!annotDict || !(annotDict instanceof PDFDict)) {
          continue;
        }

        const rect = annotDict.lookup(PDFName.of('Rect'));
        if (!rect || !(rect instanceof PDFArray) || rect.size() < 4) {
          continue;
        }

        const x1 = rect.get(0).asNumber();
        const y1 = rect.get(1).asNumber();
        const x2 = rect.get(2).asNumber();
        const y2 = rect.get(3).asNumber();

        const newX1 = x1 * scale + tx;
        const newY1 = y1 * scale + ty;
        const newX2 = x2 * scale + tx;
        const newY2 = y2 * scale + ty;

        // Clone annotation dictionary into target document context
        const clonedDict = annotDict.clone(outDoc.context);
        clonedDict.set(
          PDFName.of('Rect'),
          outDoc.context.obj([newX1, newY1, newX2, newY2])
        );

        const newAnnotRef = outDoc.context.register(clonedDict);
        existingAnnots.push(newAnnotRef);
      } catch (err) {
        console.warn('Could not transform annotation:', err);
      }
    }
  }

  /**
   * Draws note-taking patterns onto the page for 1-Up layout.
   */
  function drawNotesOverlay(page, options) {
    const { margin, width, ySep, bottomMargin, style, step, dotRadius = 0.65, drawSeparator = true } = options;
    const x1 = margin;
    const x2 = margin + width;
    const yStart = ySep - 10;

    if (drawSeparator) {
      // Upper separator line with subtle end ticks
      page.drawLine({
        start: { x: x1, y: ySep },
        end: { x: x2, y: ySep },
        thickness: 0.8,
        color: rgb(0.2, 0.2, 0.2),
        opacity: 0.35,
      });
      // Left tick
      page.drawLine({
        start: { x: x1, y: ySep - 3 },
        end: { x: x1, y: ySep + 3 },
        thickness: 0.5,
        color: rgb(0.2, 0.2, 0.2),
        opacity: 0.35,
      });
      // Right tick
      page.drawLine({
        start: { x: x2, y: ySep - 3 },
        end: { x: x2, y: ySep + 3 },
        thickness: 0.5,
        color: rgb(0.2, 0.2, 0.2),
        opacity: 0.35,
      });
    }

    const normStyle = (style || 'lines').toLowerCase();

    if (normStyle === 'lines') {
      let currY = yStart - step;
      while (currY >= bottomMargin) {
        page.drawLine({
          start: { x: x1, y: currY },
          end: { x: x2, y: currY },
          thickness: 0.4,
          color: rgb(0.4, 0.4, 0.4),
          opacity: 0.22,
        });
        currY -= step;
      }
    } else if (normStyle === 'grid') {
      const numCols = Math.max(1, Math.floor(width / step));
      const gridW = numCols * step;
      const gridX1 = x1 + (width - gridW) / 2;
      const gridX2 = gridX1 + gridW;

      let currY = yStart;
      while (currY >= bottomMargin) {
        page.drawLine({
          start: { x: gridX1, y: currY },
          end: { x: gridX2, y: currY },
          thickness: 0.35,
          color: rgb(0.4, 0.4, 0.4),
          opacity: 0.18,
        });
        currY -= step;
      }

      const yMin = currY + step;
      for (let col = 0; col <= numCols; col++) {
        const cx = gridX1 + col * step;
        page.drawLine({
          start: { x: cx, y: yMin },
          end: { x: cx, y: yStart },
          thickness: 0.35,
          color: rgb(0.4, 0.4, 0.4),
          opacity: 0.18,
        });
      }
    } else if (normStyle === 'dots') {
      const numCols = Math.max(1, Math.floor(width / step));
      const gridW = numCols * step;
      const gridX1 = x1 + (width - gridW) / 2;

      let currY = yStart;
      while (currY >= bottomMargin) {
        for (let col = 0; col <= numCols; col++) {
          const cx = gridX1 + col * step;
          page.drawCircle({
            x: cx,
            y: currY,
            size: dotRadius,
            color: rgb(0.25, 0.25, 0.25),
            opacity: 0.35,
          });
        }
        currY -= step;
      }
    }
  }

  /**
   * Draws note-taking patterns for 2-Up layout.
   */
  function draw2UpNotesOverlay(page, options) {
    const { margin, width, slot1SepY, slot1Bottom, slot2SepY, slot2Bottom, style, step, dotRadius = 0.65 } = options;
    const x1 = margin;
    const x2 = margin + width;

    function drawZone(sepY, bottomLimit) {
      if (sepY === null || sepY === undefined) return;
      page.drawLine({
        start: { x: x1, y: sepY },
        end: { x: x2, y: sepY },
        thickness: 0.7,
        color: rgb(0.2, 0.2, 0.2),
        opacity: 0.35,
      });
      page.drawLine({
        start: { x: x1, y: sepY - 2 },
        end: { x: x1, y: sepY + 2 },
        thickness: 0.5,
        color: rgb(0.2, 0.2, 0.2),
        opacity: 0.35,
      });
      page.drawLine({
        start: { x: x2, y: sepY - 2 },
        end: { x: x2, y: sepY + 2 },
        thickness: 0.5,
        color: rgb(0.2, 0.2, 0.2),
        opacity: 0.35,
      });

      const yStart = sepY - 8;
      const normStyle = (style || 'lines').toLowerCase();

      if (normStyle === 'lines') {
        let currY = yStart - step;
        while (currY >= bottomLimit) {
          page.drawLine({
            start: { x: x1, y: currY },
            end: { x: x2, y: currY },
            thickness: 0.4,
            color: rgb(0.4, 0.4, 0.4),
            opacity: 0.22,
          });
          currY -= step;
        }
      } else if (normStyle === 'grid') {
        const numCols = Math.max(1, Math.floor(width / step));
        const gridW = numCols * step;
        const gridX1 = x1 + (width - gridW) / 2;
        const gridX2 = gridX1 + gridW;

        let currY = yStart;
        while (currY >= bottomLimit) {
          page.drawLine({
            start: { x: gridX1, y: currY },
            end: { x: gridX2, y: currY },
            thickness: 0.35,
            color: rgb(0.4, 0.4, 0.4),
            opacity: 0.18,
          });
          currY -= step;
        }
        const yMin = currY + step;
        for (let col = 0; col <= numCols; col++) {
          const cx = gridX1 + col * step;
          page.drawLine({
            start: { x: cx, y: yMin },
            end: { x: cx, y: yStart },
            thickness: 0.35,
            color: rgb(0.4, 0.4, 0.4),
            opacity: 0.18,
          });
        }
      } else if (normStyle === 'dots') {
        const numCols = Math.max(1, Math.floor(width / step));
        const gridW = numCols * step;
        const gridX1 = x1 + (width - gridW) / 2;

        let currY = yStart;
        while (currY >= bottomLimit) {
          for (let col = 0; col <= numCols; col++) {
            const cx = gridX1 + col * step;
            page.drawCircle({
              x: cx,
              y: currY,
              size: dotRadius,
              color: rgb(0.25, 0.25, 0.25),
              opacity: 0.35,
            });
          }
          currY -= step;
        }
      }
    }

    drawZone(slot1SepY, slot1Bottom);

    // Subtle dashed divider line at mid-height
    const midY = page.getHeight() / 2;
    page.drawLine({
      start: { x: x1, y: midY },
      end: { x: x2, y: midY },
      thickness: 0.5,
      color: rgb(0.3, 0.3, 0.3),
      opacity: 0.18,
      dashArray: [2, 4],
    });

    if (slot2SepY !== null && slot2SepY !== undefined) {
      drawZone(slot2SepY, slot2Bottom);
    }
  }

  /**
   * Draws study header at the top of the page.
   */
  function drawStudyHeader(page, options, font) {
    const { margin, width, title, topMargin } = options;
    const x1 = margin;
    const x2 = margin + width;
    const effectiveTopMargin = topMargin !== undefined ? topMargin : DEFAULT_MARGIN;
    const headerY = page.getHeight() - effectiveTopMargin + 4;

    const leftText = title ? `TEMA / ASIGNATURA: ${title}` : 'TEMA / ASIGNATURA: _____________________________';
    const rightText = 'FECHA: _____ / _____ / 20___';

    if (font) {
      page.drawText(leftText, {
        x: x1,
        y: headerY,
        size: 8,
        font: font,
        color: rgb(0.25, 0.25, 0.25),
        opacity: 0.85,
      });

      const rightW = font.widthOfTextAtSize(rightText, 8);
      page.drawText(rightText, {
        x: x2 - rightW,
        y: headerY,
        size: 8,
        font: font,
        color: rgb(0.25, 0.25, 0.25),
        opacity: 0.85,
      });
    }

    page.drawLine({
      start: { x: x1, y: headerY - 4 },
      end: { x: x2, y: headerY - 4 },
      thickness: 0.5,
      color: rgb(0.25, 0.25, 0.25),
      opacity: 0.25,
    });
  }

  /**
   * Generates an elegant, timeless notebook cover page (Zara Home aesthetic).
   */
  async function generateCoverPage(outDoc, options, fontMap) {
    const [pw, ph] = options.paperDimensions || PAPER_SIZES.a4;
    const page = outDoc.addPage([pw, ph]);

    const timesFont = fontMap.timesFont || fontMap.helveticaFont;
    const timesBold = fontMap.timesBold || fontMap.helveticaBold;
    const timesItalic = fontMap.timesItalic || fontMap.helveticaFont;

    const inset = 36;
    page.drawRectangle({
      x: inset,
      y: inset,
      width: pw - 2 * inset,
      height: ph - 2 * inset,
      borderColor: rgb(0.25, 0.25, 0.25),
      borderWidth: 0.6,
      borderOpacity: 0.22,
      color: rgb(1, 1, 1),
    });

    const innerInset = 42;
    page.drawRectangle({
      x: innerInset,
      y: innerInset,
      width: pw - 2 * innerInset,
      height: ph - 2 * innerInset,
      borderColor: rgb(0.25, 0.25, 0.25),
      borderWidth: 0.35,
      borderOpacity: 0.10,
    });

    // Top Super-header (understated notebook label, no software branding)
    if (timesFont) {
      const superHdr = 'C U A D E R N O   D E   N O T A S';
      const superW = timesFont.widthOfTextAtSize(superHdr, 7.5);
      page.drawText(superHdr, {
        x: (pw - superW) / 2,
        y: ph - 95,
        size: 7.5,
        font: timesFont,
        color: rgb(0.42, 0.42, 0.42),
        opacity: 0.75,
      });
    }

    page.drawLine({
      start: { x: pw / 2 - 24, y: ph - 105 },
      end: { x: pw / 2 + 24, y: ph - 105 },
      thickness: 0.4,
      color: rgb(0.3, 0.3, 0.3),
      opacity: 0.20,
    });

    // Title (classic serif, centered)
    const titleText = (options.title || 'Presentación').trim();
    let endTitleY = ph * 0.58;
    if (timesBold) {
      const titleSize = 24;
      const titleW = timesBold.widthOfTextAtSize(titleText, titleSize);
      endTitleY = ph * 0.58;
      page.drawText(titleText, {
        x: (pw - Math.min(titleW, pw - 80)) / 2,
        y: endTitleY,
        size: titleSize,
        font: timesBold,
        color: rgb(0.12, 0.12, 0.14),
      });
    }

    // Subtitle / Subject (classic serif italic)
    if (options.subtitle && timesItalic) {
      const subW = timesItalic.widthOfTextAtSize(options.subtitle, 12.5);
      page.drawText(options.subtitle, {
        x: (pw - subW) / 2,
        y: endTitleY - 26,
        size: 12.5,
        font: timesItalic,
        color: rgb(0.32, 0.32, 0.34),
        opacity: 0.9,
      });
    }

    // Delicate accent rule between title and metadata
    const dividerY = endTitleY - (options.subtitle ? 44 : 26);
    page.drawLine({
      start: { x: pw / 2 - 32, y: dividerY },
      end: { x: pw / 2 + 32, y: dividerY },
      thickness: 0.4,
      color: rgb(0.3, 0.3, 0.3),
      opacity: 0.18,
    });

    // Metadata block (quiet, elegant typography)
    let metaY = ph * 0.26;
    if (options.author && timesFont) {
      const authStr = options.author;
      const authW = timesFont.widthOfTextAtSize(authStr, 10.5);
      page.drawText(authStr, {
        x: (pw - authW) / 2,
        y: metaY,
        size: 10.5,
        font: timesFont,
        color: rgb(0.22, 0.22, 0.24),
        opacity: 0.9,
      });
      metaY -= 18;
    }

    const todayStr = new Date().toLocaleDateString('es-ES');
    if (timesItalic) {
      const dateStr = `Fecha: ${todayStr}`;
      const dateW = timesItalic.widthOfTextAtSize(dateStr, 9);
      page.drawText(dateStr, {
        x: (pw - dateW) / 2,
        y: metaY,
        size: 9,
        font: timesItalic,
        color: rgb(0.42, 0.42, 0.42),
        opacity: 0.8,
      });
      metaY -= 16;
    }

    if (options.numSlides && timesFont) {
      const numStr = `${options.numSlides} diapositivas con pauta de notas`;
      const numW = timesFont.widthOfTextAtSize(numStr, 8.5);
      page.drawText(numStr, {
        x: (pw - numW) / 2,
        y: metaY,
        size: 8.5,
        font: timesFont,
        color: rgb(0.48, 0.48, 0.48),
        opacity: 0.75,
      });
    }
  }

  /**
   * Main conversion function.
   */
  async function convertSlidesToHandout(pdfBytes, options = {}) {
    const style = (options.style || 'lines').toLowerCase();
    const paperKey = (options.paperSize || 'a4').toLowerCase();
    const [paperWidth, paperHeight] = PAPER_SIZES[paperKey] || PAPER_SIZES.a4;
    const margin = options.margin !== undefined ? Number(options.margin) : DEFAULT_MARGIN;
    const step = options.step !== undefined ? Number(options.step) : DEFAULT_STEP;
    const separation = options.separation !== undefined ? Number(options.separation) : DEFAULT_SEPARATION;
    const layout = (options.layout || '1-up').toLowerCase();
    const gutterMargin = options.gutter !== undefined ? Number(options.gutter) : 0.0;
    const duplex = Boolean(options.duplex);
    const coverMode = (options.coverMode || 'none').toLowerCase();
    const pageRanges = options.pageRanges || null;
    const studyHeader = Boolean(options.studyHeader);
    const studyTitle = options.studyTitle || '';
    const pageNumberFormat = options.pageNumberFormat || 'total';
    const onProgress = options.onProgress || null;

    const srcDoc = await PDFDocument.load(pdfBytes, { ignoreEncryption: true });
    const outDoc = await PDFDocument.create();

    const pageNumbers = options.pageNumbers !== undefined ? Boolean(options.pageNumbers) : true;
    let helveticaFont = null;
    let helveticaBold = null;
    let timesFont = null;
    let timesBold = null;
    let timesItalic = null;
    if (StandardFonts) {
      try {
        helveticaFont = await outDoc.embedFont(StandardFonts.Helvetica);
        helveticaBold = await outDoc.embedFont(StandardFonts.HelveticaBold);
        timesFont = await outDoc.embedFont(StandardFonts.TimesRoman);
        timesBold = await outDoc.embedFont(StandardFonts.TimesRomanBold);
        timesItalic = await outDoc.embedFont(StandardFonts.TimesRomanItalic);
      } catch (e) {
        console.warn('Could not embed fonts:', e);
      }
    }

    const totalInputPages = srcDoc.getPageCount();
    const selectedIndices = parsePageRanges(pageRanges, totalInputPages);

    const hasGenCover = (coverMode === 'generate');
    const handoutSheets = layout === '2-up'
      ? Math.ceil(selectedIndices.length / 2)
      : selectedIndices.length;
    const totalSheets = handoutSheets + (hasGenCover ? 1 : 0);

    // 1. Optional Generated Editorial Cover
    if (hasGenCover) {
      await generateCoverPage(
        outDoc,
        {
          paperDimensions: [paperWidth, paperHeight],
          title: options.coverTitle || 'Presentación',
          subtitle: studyTitle,
          author: options.coverAuthor || '',
          numSlides: selectedIndices.length,
        },
        {
          timesFont,
          timesBold,
          timesItalic,
          helveticaFont,
          helveticaBold,
        }
      );
    }

    let sheetCounter = hasGenCover ? 2 : 1;

    // Helper for footer page number
    function drawFooter(page, sheetNum) {
      if (!pageNumbers || !helveticaFont) return;
      const numStr = pageNumberFormat === 'total' ? `${sheetNum} / ${totalSheets}` : String(sheetNum);
      const textSize = 9;
      const textWidth = helveticaFont.widthOfTextAtSize(numStr, textSize);
      const footerY = Math.max(margin / 2 - 3, 12);
      page.drawText(numStr, {
        x: (paperWidth - textWidth) / 2,
        y: footerY,
        size: textSize,
        font: helveticaFont,
        color: rgb(0.3, 0.3, 0.3),
        opacity: 0.7,
      });
    }

    // 2. Process Slides
    if (layout === '2-up') {
      for (let i = 0; i < selectedIndices.length; i += 2) {
        const idx1 = selectedIndices[i];
        const idx2 = i + 1 < selectedIndices.length ? selectedIndices[i + 1] : null;

        const leftGutter = duplex ? (sheetCounter % 2 === 1 ? gutterMargin : 0) : gutterMargin;
        const xOffset = margin + leftGutter;
        const availableWidth = paperWidth - 2 * margin - gutterMargin;

        const newPage = outDoc.addPage([paperWidth, paperHeight]);
        const halfHeight = paperHeight / 2;
        const headerHeight = studyHeader ? 22 : 0;
        const slot1Top = paperHeight - margin - headerHeight;
        const slot1Bottom = halfHeight + 6;

        // Slot 1
        const srcPage1 = srcDoc.getPage(idx1);
        const [emb1] = await outDoc.embedPdf(srcDoc, [idx1]);
        const { width: origW1, height: origH1 } = srcPage1.getSize();
        const maxH1 = (slot1Top - slot1Bottom) * 0.58;
        const scale1 = Math.min(availableWidth / origW1, maxH1 / origH1);
        const scaledW1 = origW1 * scale1;
        const scaledH1 = origH1 * scale1;
        const tx1 = xOffset + (availableWidth - scaledW1) / 2;
        const ty1 = slot1Top - scaledH1;

        newPage.drawPage(emb1, { x: tx1, y: ty1, width: scaledW1, height: scaledH1 });
        transformAndCopyAnnotations(srcDoc, srcPage1, outDoc, newPage, scale1, tx1, ty1);
        const sep1Y = ty1 - separation;

        // Slot 2
        let sep2Y = null;
        const slot2Bottom = margin;
        if (idx2 !== null) {
          const srcPage2 = srcDoc.getPage(idx2);
          const [emb2] = await outDoc.embedPdf(srcDoc, [idx2]);
          const { width: origW2, height: origH2 } = srcPage2.getSize();
          const slot2Top = halfHeight - 12;
          const maxH2 = (slot2Top - slot2Bottom) * 0.58;
          const scale2 = Math.min(availableWidth / origW2, maxH2 / origH2);
          const scaledW2 = origW2 * scale2;
          const scaledH2 = origH2 * scale2;
          const tx2 = xOffset + (availableWidth - scaledW2) / 2;
          const ty2 = slot2Top - scaledH2;

          newPage.drawPage(emb2, { x: tx2, y: ty2, width: scaledW2, height: scaledH2 });
          transformAndCopyAnnotations(srcDoc, srcPage2, outDoc, newPage, scale2, tx2, ty2);
          sep2Y = ty2 - separation;
        }

        if (studyHeader) {
          drawStudyHeader(newPage, { margin: xOffset, topMargin: margin, width: availableWidth, title: studyTitle }, helveticaFont);
        }

        draw2UpNotesOverlay(newPage, {
          margin: xOffset,
          width: availableWidth,
          slot1SepY: sep1Y,
          slot1Bottom,
          slot2SepY: sep2Y,
          slot2Bottom,
          style,
          step,
        });

        drawFooter(newPage, sheetCounter);

        if (onProgress) {
          onProgress(Math.min(i + 2, selectedIndices.length), selectedIndices.length, style);
        }
        sheetCounter++;
      }
    } else {
      // 1-Up layout
      for (let sIdx = 0; sIdx < selectedIndices.length; sIdx++) {
        const srcIdx = selectedIndices[sIdx];
        const isCleanCover = (sIdx === 0 && coverMode === 'clean_first');

        const leftGutter = duplex ? (sheetCounter % 2 === 1 ? gutterMargin : 0) : gutterMargin;
        const xOffset = margin + leftGutter;
        const availableWidth = paperWidth - 2 * margin - gutterMargin;

        const srcPage = srcDoc.getPage(srcIdx);
        const { width: origWidth, height: origHeight } = srcPage.getSize();
        const rotation = (srcPage.getRotation().angle || 0) % 360;

        let effectiveWidth = origWidth;
        let effectiveHeight = origHeight;
        if (rotation === 90 || rotation === 270) {
          effectiveWidth = origHeight;
          effectiveHeight = origWidth;
        }

        const scale = availableWidth / effectiveWidth;
        const scaledHeight = effectiveHeight * scale;

        let yTranslation;
        if (isCleanCover) {
          yTranslation = (paperHeight - scaledHeight) / 2;
        } else {
          const headerOffset = studyHeader ? 24 : 0;
          yTranslation = paperHeight - scaledHeight - margin - headerOffset;
        }

        const [embeddedPage] = await outDoc.embedPdf(srcDoc, [srcIdx]);
        const newPage = outDoc.addPage([paperWidth, paperHeight]);

        newPage.drawPage(embeddedPage, {
          x: xOffset,
          y: yTranslation,
          width: availableWidth,
          height: scaledHeight,
        });

        transformAndCopyAnnotations(srcDoc, srcPage, outDoc, newPage, scale, xOffset, yTranslation);

        if (!isCleanCover) {
          if (studyHeader) {
            drawStudyHeader(newPage, { margin: xOffset, topMargin: margin, width: availableWidth, title: studyTitle }, helveticaFont);
          }

          const sepY = yTranslation - separation;
          drawNotesOverlay(newPage, {
            margin: xOffset,
            width: availableWidth,
            ySep: sepY,
            bottomMargin: margin,
            style,
            step,
            drawSeparator: true,
          });

          drawFooter(newPage, sheetCounter);
        }

        if (onProgress) {
          onProgress(sIdx + 1, selectedIndices.length, style);
        }
        sheetCounter++;
      }
    }

    return await outDoc.save();
  }

  return {
    PAPER_SIZES,
    STYLES,
    DEFAULT_MARGIN,
    DEFAULT_STEP,
    DEFAULT_SEPARATION,
    parsePageRanges,
    convertSlidesToHandout,
  };
});
